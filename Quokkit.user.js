// ==UserScript==
// @name         Quokkit
// @namespace    http://tampermonkey.net/
// @version      1.0.2
// @description  QOL features for The Motte
// @author       John Doe Fletcher
// @match        https://themotte.org/
// @match        https://www.themotte.org/
// @match        https://themotte.org/post/*
// @match        https://www.themotte.org/post/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=themotte.org
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // Globals
    let itemType;
    let itemList;
    let cursorIndex;
    let t_cursor;

    const Constants = {
        selected: "qk_selected",
        postSelector: '[id^="post-"]:not([id^="post-text-"])',
        commentSelector: '[id^="comment-"][id$="-only"]',
        css: {
            upvoted: ".active.arrow-up::before",
            downvoted: ".active.arrow-down::before"
        }
    };

    const Direction = {
        DOWN: "Down",
        UP: "Up"
    };

    const qk_utils = {
        throttle (callback, limit) {
            // https://stackoverflow.com/a/27078401
            var waiting = false;
            return function () {
                if (!waiting) {
                    callback.apply(this, arguments);
                    waiting = true;
                    setTimeout(function () {
                        waiting = false;
                    }, limit);
                }
            }
        },
        isElementInViewport (el) {
            // https://stackoverflow.com/a/7557433
            var rect = el.getBoundingClientRect();
            return (
                rect.top >= 0 &&
                rect.left >= 0 &&
                rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) && /* or $(window).height() */
                rect.right <= (window.innerWidth || document.documentElement.clientWidth) /* or $(window).width() */
            );
        },
        isStyleDefined: (function() {
            // Cache CSS selectors with rules defined at page load and return a closure that checks if a given selector is in the cache
            let rules = Array.from(document.styleSheets) // enumerate stylesheets
            .slice(2) // chop out the root style and the main stylesheet so we're only looking at custom themes and user-defined css
            .flatMap(sheet => Array.from(sheet.cssRules)
                     .flatMap(rule => rule.selectorText)); // stick em all in one flat list of strings

            return (selector) => rules.findIndex(st => st == selector) >= 0;
        })(),
        registerStyles() {
            // Register custom styles
            GM_addStyle(`.${Constants.selected} { border: 1px dashed red }`);
            if(!qk_utils.isStyleDefined(Constants.css.upvoted)) {
                GM_addStyle(`.${Constants.css.upvoted} { color: #bd2130 }`);
            }

            if(!qk_utils.isStyleDefined(Constants.css.downvoted)) {
                GM_addStyle(`.${Constants.css.downvoted} { color: #0062cc }`);
            }
        },
        findParentBySelector(element, selector) {
            return element.closest(selector);
        },
        listAncestors(element) {
            let ancestors = [];
            let cur = element;
            while(cur.parentElement) {
                ancestors.unshift(cur.parentElement.id);
                cur = cur.parentElement;
            }
            return ancestors;
        },
        listAncestorComments(element) {
            let ancestors = qk_utils.listAncestors(element);
            return ancestors.filter(id => id.indexOf("comment-") == 0);
        }
    };

    function selectItem(element) {
        if(!element) {
            return;
        }
        element.classList.add(Constants.selected);
        if(!qk_utils.isElementInViewport(element)) {
            element.scrollIntoView();
        }
    }

    function deselectItem(element) {
        if(!element) {
            return;
        }
        element.classList.remove(Constants.selected);
    }

    function vote(direction) {
        let item = document.getElementById(itemList[cursorIndex]);
        let upvote;
        let downvote;
        if(itemType == "comment") {
            let commentId = item.id.replace("-only", "");
            upvote = item.querySelector(`#${commentId}-actions>ul>li>button.upvote-button`);
            downvote = item.querySelector(`#${commentId}-actions>ul>li>button.downvote-button`);
        } else {
            upvote = item.querySelector('.upvote-button');
            downvote = item.querySelector('.downvote-button');
        }
        switch(direction){
            case Direction.UP:
                upvote.click();
                break;
            case Direction.DOWN:
                downvote.click();
                break;
            default:
                break;
        }
    }

    function reply() {
        if(itemType != "comment" || typeof openReplyBox !== "function") {
            return;
        }
        let commentId = (itemList[cursorIndex].replace("comment-", "").replace("-only", "") || "");
        openReplyBox(`reply-to-${commentId}`);
    }

    function frontPage() {
        window.open("https://themotte.org", "_self");
    }

    function navigate(inNewTab=true) {
        if(itemType == "comment") {
            return;
        }
        let selectedPost = document.getElementById(itemList[cursorIndex]);
        let target = selectedPost.querySelector('a').href;
        if(inNewTab) {
            window.open(target);
        } else {
            window.open(target, "_self");
        }
    }

    function cursor(direction) {
        if(cursorIndex >= 0) {
            //document.getElementById(itemList[cursorIndex]).classList.remove("selected");
            deselectItem(document.getElementById(itemList[cursorIndex]));
        }
        switch(direction) {
            case Direction.DOWN:
                cursorIndex++;
                break;
            case Direction.UP:
                cursorIndex--;
                break;
            default:
                break;
        }
        if(cursorIndex < 0) {
            cursorIndex = 0;
        } else if(cursorIndex >= itemList.length) {
            cursorIndex = itemList.length - 1;
        }

        let item = document.getElementById(itemList[cursorIndex]);
        //item.classList.add("selected");
        selectItem(item);
        if(!qk_utils.isElementInViewport(item)) {
            item.scrollIntoView();
        }
    }

    function toggleExpando() {
        if(itemType != "post" || typeof expandText !== "function") {
            return;
        }
        let postId = itemList[cursorIndex].replace("post-", "");
        // may not be as stable as getting the expando button element and click()-ing it but that's more work
        expandText(postId);
    }

    function edit() {
        if(itemType != "comment" || typeof toggleEdit !== "function") {
            return;
        }
        let commentId = itemList[cursorIndex].replace("comment-", "").replace("-only", "");
        toggleEdit(commentId);
    }

    function parent() {
        if(itemType != "comment") {
            //console.log("parent() not called on comments");
            return;
        }
        let el = document.getElementById(itemList[cursorIndex]);
        let parent = document.getElementById(qk_utils.listAncestorComments(el).reverse()[1]+"-only");
        if(parent) {
            jumpSelectItem(parent);
        }
    }

    function parentest() {
        if(itemType != "comment") {
            //console.log("parentest() not called on comments");
            return;
        }
        let el = document.getElementById(itemList[cursorIndex]);
        let parent = document.getElementById(qk_utils.listAncestorComments(el)[0]+"-only");
        if(parent) {
            jumpSelectItem(parent);
        }
    }

    function listItemIDs() {
        let tmpList;
        switch(itemType) {
            case "comment":
                tmpList = document.querySelectorAll(Constants.commentSelector);
                break;
            case "post":
                tmpList = document.querySelectorAll(Constants.postSelector);
                break;
            default:
                tmpList = [];
                break;
        }
        itemList = Array.from(tmpList).map(el => el.id);
    }

    function keyEventDispatcher(event) {
        if(!itemList) {
            console.log("qk: lazy init item IDs");
            listItemIDs();
        }
        if(event.target.type){
            // don't do keyboard navigation when we're typing a comment
            return; // TODO
            if(event.target.type.toLowerCase() == "textarea") {
                if(event.ctrlKey && event.key == "Enter") {
                    console.log("we'd submit the form here if it were implemented, but it's not implemented yet.");
                }
            }
            return;
        }
        if(event.ctrlKey) {
            // currently there's no plans to use ctrl in a default binding, so we bail out to avoid silly behavior.
            return;
        }
        switch (event.key) {
            case 'j':
                t_cursor(Direction.DOWN);
                break;
            case 'k':
                t_cursor(Direction.UP);
                break;
            case 'a':
                vote(Direction.UP);
                break;
            case 'z':
                vote(Direction.DOWN);
                break;
            case 'r':
                // kill the event so we don't type an 'r' into the textarea
                if(event.preventDefault) {
                    event.preventDefault();
                }
                reply();
                break;
            case 'e':
                // edit doesn't autofocus the textarea like reply does but let's not take chances
                if(event.preventDefault) {
                    event.preventDefault();
                }
                edit();
                break;
            case 'C':
                navigate();
                break;
            case 'c':
                navigate(false);
                break;
            case 'x':
                toggleExpando();
                break;
            case 'F':
                frontPage();
                break;
            case 'L':
                listItemIDs();
                break;
            case 'p':
                parent();
                break;
            case 'P':
                parentest();
                break;
            default:
                break;
        }
    }

    function jumpSelectItem(element) {
        if(!itemList) {
            listItemIDs();
        }

        let itemActual;
        if(itemType == "post") {
            //itemActual = qk_utils.findParentBySelector(element, Constants.postSelector);
            itemActual = element.closest(Constants.postSelector);
        } else if(itemType == "comment") {
            //itemActual = qk_utils.findParentBySelector(element, Constants.commentSelector);
            itemActual = element.closest(Constants.commentSelector);
        }
        if(!itemActual) {
            return;
        }
        //console.log(itemActual);

        let elementIndex = itemList.findIndex(item => item == itemActual.id);
        if(elementIndex >= 0) {
            deselectItem(document.getElementById(itemList[cursorIndex]));
            selectItem(document.getElementById(itemList[elementIndex]));
            cursorIndex = elementIndex;
        }
    }

    function qk_clickHandler(event) {
        if(event.target.classList.contains('upvote-button') || event.target.classList.contains('downvote-button')) {
            // ignore clicks on vote buttons, since we generate those in vote()
            return;
        }

        let tTag = event.target.tagName.toLowerCase();
        let tId = event.target.id.toLowerCase();
        if(tTag === "button"
           || tId.indexOf("edit-btn-") == 0
           || tId.indexOf("save-reply-to-comment_") == 0
        ) {
            // hack: update the item list after AJAX gets more items
            setTimeout(listItemIDs, 1000);
            setTimeout(listItemIDs, 2000);
            setTimeout(listItemIDs, 3000);
            return;
        }
        jumpSelectItem(event.target);
    }

    function initQuokkit() {
        cursorIndex = -1;
        t_cursor = qk_utils.throttle(cursor, 30); // smoother movement if the user holds the nav key down
        qk_utils.registerStyles();
        itemType = document.URL.search("\/post\/") >= 0 ? "comment" : "post"; // comment threads live under .../post/:postId
        listItemIDs();
        console.log("qk: Quokkit loaded");
    }

    document.addEventListener("click", qk_clickHandler);
    document.addEventListener("keydown", keyEventDispatcher);
    initQuokkit();
})();
