// ==UserScript==
// @name         Quokkit
// @namespace    http://tampermonkey.net/
// @version      1.0.0
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
    GM_addStyle('.selected { border: 1px dashed red }');
    let itemType = document.URL.search("\/post\/") >= 0 ? "comment" : "post"; // comment threads live under .../post/:postId
    let itemList;
    let cursorIndex = -1;

    const Direction = {
        DOWN: "Down",
        UP: "Up"
    }

    function isElementInViewport (el) {
        // https://stackoverflow.com/a/7557433
        var rect = el.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) && /* or $(window).height() */
            rect.right <= (window.innerWidth || document.documentElement.clientWidth) /* or $(window).width() */
        );
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
            document.getElementById(itemList[cursorIndex]).classList.remove("selected");
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
        item.classList.add("selected");
        if(!isElementInViewport(item)) {
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

    function listItemIDs() {
        const postSelector = '[id^="post-"]:not([id^="post-text-"])';
        const commentSelector = '[id^="comment-"][id$="-only"]';
        let tmpList;
        switch(itemType) {
            case "comment":
                tmpList = document.querySelectorAll(commentSelector);
                break;
            case "post":
                tmpList = document.querySelectorAll(postSelector);
                break;
            default:
                tmpList = [];
                break;
        }
        itemList = Array.from(tmpList).map(el => el.id);
    }

    function keyEventDispatcher(event) {
        if(!itemList) {
            console.log("lazy init item IDs");
            listItemIDs();
        }
        //console.log(event.target.type);
        if(event.target.type){
            // don't do keyboard navigation when we're typing a comment
            return;
        }
        const key = String.fromCharCode(event.keyCode);
        switch (key) {
            case 'j':
                cursor(Direction.DOWN);
                break;
            case 'k':
                cursor(Direction.UP);
                break;
            case 'a':
                vote(Direction.UP);
                break;
            case 'z':
                vote(Direction.DOWN);
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
            default:
                break;
        }
    }

    function initQuokkit() {
        listItemIDs();
        console.log("Quokkit loaded");
    }

    document.addEventListener("keypress", keyEventDispatcher);
    initQuokkit();
})();
