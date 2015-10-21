"use strict";

(function () {


// ===== Generic utilities ===========================================

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
function arrKeep( arr, check ) {
    return arrMappend( arr, function ( item, i ) {
        return check( item, i ) ? [ item ] : [];
    } );
}
function arrRem( arr, check ) {
    return arrKeep( arr, function ( item, i ) {
        return !check( item, i );
    } );
}
function defer( body ) {
    setTimeout( function () {
        body();
    }, 0 );
}
function oncefn( body ) {
    var called = false;
    var result;
    return function () {
        if ( !called ) {
            result = body();
            called = true;
        }
        return result;
    };
}
function eventDispatcher() {
    var listeners = [];
    
    var result = {};
    result.emittable = {};
    result.emittable.emit = function ( event ) {
        arrEach( listeners, function ( listener ) {
            defer( function () {
                var listenerFunc = listener.func;
                listenerFunc( event );
            } );
        } );
    };
    result.listenable = {};
    result.listenable.on = function ( listenerFunc ) {
        var listenerToken = {};

        listeners.push(
            { token: listenerToken, func: listenerFunc } );
        
        var result = {};
        result.off = oncefn( function () {
            listeners = arrRem( listeners, function ( listener ) {
                return listenerToken === listener.token;
            } );
        } );
        return result;
    };
    return result;
}


// ===== DSL parser ==================================================

function dscPara( descCode ) {
    var result = [];
    var descRemaining = descCode;
    var m;
    while ( m =
        /^([^\\\[\]]*)\[([^\\\[\] ]*) ([^\\\[\]]*)\](.*)$/.exec(
            descRemaining ) ) {
        
        result.push( { link: null, text: m[ 1 ] } );
        result.push( { link: { val: m[ 2 ] }, text: m[ 3 ] } );
        descRemaining = m[ 4 ];
    }
    if ( !/^[^\\\[\]()]*$/.test( descRemaining ) )
        throw new Error();
    result.push( { link: null, text: descRemaining } );
    return arrRem( result, function ( span ) {
        return span.text.length === 0;
    } );
}

function dsc( var_args ) {
    return arrMap( arguments, function ( descCode ) {
        return dscPara( descCode );
    } );
}


// ===== ContriverText client ========================================

function initContriverTextClientWidget(
    elements, pov, here, serverListenable, clientEmittable ) {
    
    var loadedFirstPrivy = false;
    var privy = [];
    
    serverListenable.on( function ( event ) {
        if ( event.type === "fullPrivy" ) {
            loadedFirstPrivy = true;
            privy = event.privy;
            updateUi();
        } else {
            throw new Error();
        }
    } );
    
    clientEmittable.emit( { type: "needsFullPrivy" } );
    
    
    var currentFocus = null;
    var currentFocusTabs = [];
    var currentTime = 0;
    function createFocusLink( topic ) {
        var link = document.createElement( "a" );
        link.setAttribute( "href", "#" );
        link.onclick = function () {
            setFocus( topic );
            return false;
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
    function getCurrentFacts() {
        return arrMappend( privy, function ( temporalFact ) {
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
            
            return [ temporalFact.fact ];
        } );
    }
    function getTitle( topic ) {
        var descriptions = arrMappend( getCurrentFacts(),
            function ( fact ) {
            
            if ( fact.type === "titles"
                && fact.pov === pov
                && fact.topic === topic )
                return [ fact.title ];
            else
                return [];
        } );
        if ( descriptions.length !== 1 )
            return null;
        return descriptions[ 0 ];
    }
    function forceTitle( topic ) {
        var title = getTitle( topic );
        return title !== null ? title : "((Unknown))";
    }
    function getDescription( topic ) {
        var descriptions = arrMappend( getCurrentFacts(),
            function ( fact ) {
            
            if ( fact.type === "describes"
                && fact.pov === pov
                && fact.topic === topic )
                return [ fact.description ];
            else
                return [];
        } );
        if ( descriptions.length !== 1 )
            return null;
        return descriptions[ 0 ];
    }
    function forceDescription( topic ) {
        var desc = getDescription( topic );
        return desc !== null ? desc :
            dsc( "((No description at the moment...))" );
    }
    function setFocus( topic ) {
        currentFocus = topic;
        updateUi();
    }
    function updateUi() {
        
        setContent( elements.hereEl,
            loadedFirstPrivy ? forceDescription( here ) : dsc() );
//            dsc( "((Loading...))" ) );
        
        function addTab( topic ) {
            var tabEl = document.createElement( "li" );
            if ( topic === currentFocus )
                tabEl.className = "active";
            var tabLinkEl = createFocusLink( topic );
            tabLinkEl.appendChild(
                document.createTextNode( forceTitle( topic ) ) );
            tabEl.appendChild( tabLinkEl );
            elements.focusTabsEl.appendChild( tabEl );
        }
        function removeTabOverflow() {
            while ( elements.focusTabsEl.hasChildNodes()
                && elements.focusTabsEl.firstChild.offsetTop !==
                    elements.focusTabsEl.lastChild.offsetTop ) {
                
                elements.focusTabsEl.removeChild(
                    elements.focusTabsEl.firstChild );
                currentFocusTabs.shift();
            }
        }
        while ( elements.focusTabsEl.hasChildNodes() )
            elements.focusTabsEl.removeChild(
                elements.focusTabsEl.firstChild );
        arrEach( currentFocusTabs, function ( topic ) {
            addTab( topic );
        } );
        removeTabOverflow();
        if ( currentFocus !== null
            && !arrAny( currentFocusTabs, function ( tabTopic ) {
                return tabTopic === currentFocus;
            } ) ) {
            currentFocusTabs.push( currentFocus );
            addTab( currentFocus );
        }
        removeTabOverflow();
        setContent( elements.focusEl, currentFocus !== null ?
            forceDescription( currentFocus ) :
            [ [ ] ] );
    }
    updateUi();
}


// ===== ContriverText sample server =================================

function sampleServer() {
    // TODO: Actually use this somehow.
    var worldState = {};
    
    var result = {};
    result.you = "you";
    result.here = "here";
    result.addClient = function (
        you, clientListenable, serverEmittable ) {
        
        if ( you === "you" ) {
            clientListenable.on( function ( event ) {
                if ( event.type === "needsFullPrivy" ) {
                    serverEmittable.emit( { type: "fullPrivy", privy: arrMap( [
                        { type: "describes", pov: "you", topic: "here", description: dsc(
                            "You are here. There is a [thing thing] here."
                        ) },
                        { type: "titles", pov: "you", topic: "thing", title: "Thing" },
                        { type: "describes", pov: "you", topic: "thing", description: dsc(
                            "The thing has a [feature feature] on it."
                        ) },
                        { type: "titles", pov: "you", topic: "feature", title: "Feature" },
                        { type: "describes", pov: "you", topic: "feature", description: dsc(
                            "The feature of the [thing thing] is nondescript."
                        ) }
                    ], function ( fact ) {
                        return {
                            startTime: 0,
                            endTime: { type: "assumeAfter", time: 10, assumption: true },
                            fact: fact
                        };
                    } ) } );
                } else {
                    throw new Error();
                }
            } );
        }
    };
    return result;
}


// ===== ContriverText demo page logic ===============================

window.onload = function () {
    var server = sampleServer();
    
    var serverEvents = eventDispatcher();
    var clientEvents = eventDispatcher();
    server.addClient(
        server.you, clientEvents.listenable, serverEvents.emittable );
    initContriverTextClientWidget( {
        hereEl: document.getElementById( "here-pane" ),
        focusEl: document.getElementById( "focus-content" ),
        focusTabsEl: document.getElementById( "focus-tabs" )
    }, server.you, server.here,
        serverEvents.listenable, clientEvents.emittable );
};


})();
