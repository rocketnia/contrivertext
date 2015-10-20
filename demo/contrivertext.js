"use strict";

window.onload = function () {
    function arrAny( arr, check ) {
        var result;
        for ( var i = 0, n = arr.length; i < n; i++ )
            if ( result = check( arr[ i ], i ) )
                return result;
        return false;
    }
    function arrEach( arr, body ) {
        for ( var i = 0, n = arr.length; i < n; i++ )
            body( arr[ i ], i );
    }
    function arrMappend( arr, func ) {
        var result = [];
        arrEach( arr, function ( item, i ) {
            arrEach( func( item, i ), function ( itemItem ) {
                result.push( itemItem );
            } );
        } );
        return result;
    }
    function arrMap( arr, func ) {
        return arrMappend( arr, function ( item, i ) {
            return [ func( item, i ) ];
        } );
    }
    var hereEl = document.getElementById( "here-pane" );
    var focusEl = document.getElementById( "focus-content" );
    var focusTabsEl = document.getElementById( "focus-tabs" );
    var currentFocusTabs = [];
    var currentTime = 0;
    var storyState = arrMap( [
        { type: "existsPov", pov: "you" },
        { type: "existsTopic", topic: "here" },
        { type: "describes", pov: "you", topic: "here", description: [ [
            { link: null, text: "You are here. There is a " },
            { link: { val: "thing" }, text: "thing" },
            { link: null, text: " here." }
        ] ] },
        { type: "existsTopic", topic: "thing" },
        { type: "existsTopic", topic: "feature" },
        { type: "describes", pov: "you", topic: "thing", description: [ [
            { link: null, text: "The thing has a " },
            { link: { val: "feature" }, text: "feature" },
            { link: null, text: " on it." }
        ] ] },
        { type: "describes", pov: "you", topic: "feature", description: [ [
            { link: null, text: "The feature of the " },
            { link: { val: "thing" }, text: "thing" },
            { link: null, text: " is nondescript." }
        ] ] }
    ], function ( fact ) {
        return {
            startTime: 0,
            endTime: { type: "assumeAfter", time: 10, assumption: true },
            fact: fact
        };
    } );
    function createFocusLink( topic ) {
        var link = document.createElement( "a" );
        link.setAttribute( "href", "#" );
        link.onclick = function () {
            setFocus( topic );
        };
        return link;
    }
    function setContent( containerEl, content ) {
        while ( containerEl.hasChildNodes() )
            containerEl.removeChild( containerEl.firstChild );
        var innerContainerEl = document.createElement( "div" );
        arrEach( content, function ( para ) {
            var paraEl = document.createElement( "p" );
            arrEach( para, function ( span ) {
                var spanEl = document.createTextNode( span.text );
                if ( span.link !== null ) {
                    var newSpanEl = createFocusLink( span.link.val );
                    newSpanEl.appendChild( spanEl );
                    spanEl = newSpanEl;
                }
                paraEl.appendChild( spanEl );
            } );
            innerContainerEl.appendChild( paraEl );
        } );
        containerEl.appendChild( innerContainerEl );
    }
    function getDescription( topic ) {
        var descriptions = arrMappend( storyState,
            function ( temporalFact ) {
            
            if ( currentTime < temporalFact.startTime )
                return [];
            
            var end = temporalFact.endTime;
            if ( end.type === "knownEndTime" ) {
                if ( end.time <= currentTime )
                    return [];
            } else if ( end.type === "assumeAfter" ) {
                if ( end.time <= currentTime && !end.assumption )
                    return [];
            } else {
                throw new Error();
            }
            
            var fact = temporalFact.fact;
            if ( fact.type === "describes"
                && fact.pov === "you"
                && fact.topic === topic )
                return [ fact.description ];
            else
                return [];
        } );
        if ( descriptions.length !== 1 )
            throw new Error();
        return descriptions[ 0 ];
    }
    function setFocus( topic ) {
        if ( !arrAny( currentFocusTabs, function ( tabTopic ) {
            return tabTopic === topic;
        } ) )
            currentFocusTabs.push( topic );
        setContent( focusEl, getDescription( topic ) );
        while ( focusTabsEl.hasChildNodes() )
            focusTabsEl.removeChild( focusTabsEl.firstChild );
        arrEach( currentFocusTabs, function ( tabTopic ) {
            var tabEl = document.createElement( "li" );
            if ( tabTopic === topic )
                tabEl.className = "active";
            var tabLinkEl = createFocusLink( tabTopic );
            tabLinkEl.appendChild( document.createTextNode( tabTopic ) );
            tabEl.appendChild( tabLinkEl );
            focusTabsEl.appendChild( tabEl );
        } );
        while ( focusTabsEl.firstChild.offsetTop !==
            focusTabsEl.lastChild.offsetTop ) {
            
            focusTabsEl.removeChild( focusTabsEl.firstChild );
            currentFocusTabs.shift();
        }
    }
    setContent( hereEl, getDescription( "here" ) );
};
