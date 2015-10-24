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
function arrAll( arr, check ) {
    for ( var i = 0, n = arr.length; i < n; i++ ) {
        var result = null;
        if ( !(result = check( arr[ i ], i )) )
            return result;
    }
    return true;
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
function isArray( x ) {
    return {}.toString.call( x ) === "[object Array]";
}
function objHas( obj, k ) {
    return {}.hasOwnProperty.call( obj, k );
}
function jsonIso( a, b ) {
    // NOTE: This isn't exactly right. See Lathe.js for a more serious
    // implementation. This just gets the job done.
    
    if ( a === b )
        return true;
    if ( isArray( a ) )
        return isArray( b ) && a.length === b.length &&
            arrAll( a, function ( aItem, i ) {
                return jsonIso( aItem, b[ i ] );
            } );
    if ( typeof a === "object" ) {
        if ( typeof b !== "object" )
            return false;
        for ( var k in a )
            if ( objHas( a, k )
                && !(objHas( b, k ) && jsonIso( a[ k ], b[ k ] )) )
                return false;
        for ( var k in b )
            if ( objHas( b, k ) && !objHas( a, k ) )
                return false;
        return true;
    }
    return a === b;
}
function arrHasJson( arr, x ) {
    return arrAny( arr, function ( item ) {
        return jsonIso( item, x );
    } );
}
function arrDedupJson( arr ) {
    var result = [];
    arrEach( arr, function ( item ) {
        if ( !arrHasJson( result, item ) )
            result.push( item );
    } );
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
    if ( !/^[^\\\[\]]*$/.test( descRemaining ) )
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
    
    
    var currentFocus = "you";
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
    function clearDom( el ) {
        while ( el.hasChildNodes() )
            el.removeChild( el.firstChild );
    }
    function setContent( containerEl, content ) {
        clearDom( containerEl );
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
        clearDom( elements.focusTabsEl );
        arrEach( currentFocusTabs, function ( topic ) {
            addTab( topic );
        } );
        removeTabOverflow();
        if ( !arrHasJson( currentFocusTabs, currentFocus ) ) {
            currentFocusTabs.push( currentFocus );
            addTab( currentFocus );
        }
        removeTabOverflow();
        setContent( elements.focusEl,
            forceDescription( currentFocus ) );
        
        clearDom( elements.futureEl );
        if ( loadedFirstPrivy )
            arrEach( getCurrentFacts(), function ( rel ) {
                if ( !(rel.type === "can" && rel.pov === pov) )
                    return;
                var button = document.createElement( "button" );
                button.appendChild(
                    document.createTextNode( "" + rel.label ) );
                button.onclick = function () {
                    clientEmittable.emit( { type: "act",
                        actor: pov, action: rel.action } );
                };
                elements.futureEl.appendChild( button );
            } );
    }
    updateUi();
}


// ===== ContriverText sample server =================================

function sampleServer() {
    var initialWorldState = [];
    var worldUpdates = [];
    function addExits( dir1, dir2, room1, room2 ) {
        initialWorldState.push( { type: "exit", direction: dir1,
            from: room2, to: room1 } );
        initialWorldState.push( { type: "exit", direction: dir2,
            from: room1, to: room2 } );
    }
    initialWorldState.push( { type: "in-room", element: "you",
        container: "southwest-room" } );
    initialWorldState.push( { type: "in-room", element: "thing",
        container: "southwest-room" } );
    initialWorldState.push( { type: "in-room", element: "feature",
        container: "southwest-room" } );
    addExits( "w", "e", "northwest-room", "northeast-room" );
    addExits( "w", "e", "southwest-room", "southeast-room" );
    addExits( "n", "s",
        "northwest-room",
        "southwest-room" );
    addExits( "n", "s",
        "northeast-room",
        "southeast-room" );
    function getActionsPermitted( worldState ) {
        return arrMappend( worldState, function ( rel1 ) {
            if ( rel1.type === "in-room" ) {
                return arrMappend( worldState, function ( rel2 ) {
                    if ( rel2.type === "exit"
                        && rel2.from === rel1.container ) {
                        // NOTE: We reuse the exit relation as an
                        // action. This might be too clever.
                        return [
                            { actor: rel1.element, action: rel2 } ];
                    } else {
                        return [];
                    }
                } );
            } else {
                return [];
            }
        } );
    }
    function actionIsPermitted( worldState, actor, action ) {
        return arrHasJson( getActionsPermitted( worldState ),
            { actor: actor, action: action } );
    }
    function actionToUpdate( worldState, actor, action ) {
        if ( action.type === "exit" ) {
            return { actor: actor, action: action, newWorldState:
                arrRem( worldState, function ( rel ) {
                    return rel.type === "in-room" &&
                        rel.element === actor;
                } ).concat( [ { type: "in-room", element: actor,
                    container: action.to } ] ) };
        } else {
            throw new Error();
        }
    }
    function getCurrentWorldState() {
        return worldUpdates.length === 0 ? initialWorldState :
            worldUpdates[ worldUpdates.length - 1 ].newWorldState;
    }
    function applyAction( actor, action ) {
        var worldState = getCurrentWorldState();
        if ( !actionIsPermitted( worldState, actor, action ) )
            throw new Error();
        worldUpdates.push(
            actionToUpdate( worldState, actor, action ) );
    }
    function getVisibility( worldState, actor ) {
        var rels = [];
        var containers = [];
        arrEach( worldState, function ( rel ) {
            if ( rel.type === "in-room" && rel.element === actor ) {
                containers.push( rel.container );
                rels.push( rel );
            }
        } );
        var topics = [ "here", actor ].concat( containers );
        arrEach( worldState, function ( rel ) {
            if ( rel.type === "in-room"
                && rel.element !== actor
                && arrHasJson( containers, rel.container ) ) {
                
                topics.push( rel.element );
                rels.push( rel );
            }
        } );
        return {
            topics: topics,
            worldState: rels,
            actions: arrMappend( getActionsPermitted( worldState ),
                function ( actionPermitted ) {
                    return actionPermitted.actor === actor ?
                        [ actionPermitted.action ] : [];
                } )
        };
    }
    var describers = {};
    function defDescribe( room, describer ) {
        describers[ "|" + room ] = describer;
    }
    function describe( actor, visibility, topic ) {
        var describer = describers[ "|" + topic ];
        return describer( actor, visibility );
    }
    function titleDsc( title, var_args ) {
        return { title: title,
            description:
                dsc.apply( null, [].slice.call( arguments, 1 ) ) };
    }
    defDescribe( "here", function ( actor, visibility ) {
        var firstRoom = arrAny( visibility.worldState,
            function ( rel ) {
            
            return rel.type === "in-room" && rel.element === actor ?
                { val: rel.container } : false;
        } );
        return { title: "Your surroundings",
            description: firstRoom ?
                describe( actor, visibility, firstRoom.val
                    ).description :
                dsc(
                    "((You don't seem to be located anywhere right " +
                    "now.))"
                ) };
    } );
    defDescribe( "you", function ( actor, visibility ) {
        return titleDsc( "You",
            "You're wearing your adventuring clothes today." );
    } );
    defDescribe( "thing", function ( actor, visibility ) {
        return titleDsc( "Thing",
            "The thing has a [feature feature] on it." );
    } );
    defDescribe( "feature", function ( actor, visibility ) {
        return titleDsc( "Feature",
            "The feature of the [thing thing] is nondescript." );
    } );
    defDescribe( "northwest-room", function ( actor, visibility ) {
        return titleDsc( "Northwest room",
            "You're in [northwest-room the northwest room]." );
    } );
    defDescribe( "northeast-room", function ( actor, visibility ) {
        return titleDsc( "Northeast room",
            "You're in [northeast-room the northeast room]." );
    } );
    defDescribe( "southwest-room", function ( actor, visibility ) {
        return titleDsc( "Southwest room",
            "You're in [southwest-room the southwest room].",
            "There is a [thing thing] here." );
    } );
    defDescribe( "southeast-room", function ( actor, visibility ) {
        return titleDsc( "Southeast room",
            "You're in [southeast-room the southeast room]." );
    } );
    
    function visibilityToPrivy( actor, visibility ) {
        var facts = arrMappend( visibility.topics,
            function ( topic ) {
            
            var details = describe( actor, visibility, topic );
            return [
                { type: "titles", pov: actor, topic: topic,
                    title: details.title },
                { type: "describes", pov: actor, topic: topic,
                    description: details.description }
            ];
        } ).concat( arrMap( visibility.actions, function ( action ) {
            // TODO: The "can" type carries more information than the
            // client strictly needs, and yet it doesn't necessarily
            // contain a good source of information from which to
            // determine a compass rose. Iterate further upon this
            // design.
            
            if ( action.type === "exit" ) {
                if ( action.direction === "n" ) {
                    var label = "Go north.";
                } else if ( action.direction === "s" ) {
                    var label = "Go south.";
                } else if ( action.direction === "e" ) {
                    var label = "Go east.";
                } else if ( action.direction === "w" ) {
                    var label = "Go west.";
                } else {
                    throw new Error();
                }
            } else {
                throw new Error();
            }
            return { type: "can",
                pov: actor, label: label, action: action };
        } ) );
        return arrMap( facts, function ( fact ) {
            return {
                startTime: 0,
                endTime: { type: "assumeAfter",
                    time: 10, assumption: true },
                fact: fact
            };
        } );
    }
    
    
    var result = {};
    result.you = "you";
    result.here = "here";
    result.addClient = function (
        you, clientListenable, serverEmittable ) {
        
        if ( you === "you" ) {
            clientListenable.on( function ( event ) {
                function emitFullPrivy() {
                    serverEmittable.emit( { type: "fullPrivy",
                        privy: visibilityToPrivy( "you",
                            getVisibility( getCurrentWorldState(),
                                "you" ) ) } );
                }
                
                if ( event.type === "needsFullPrivy" ) {
                    emitFullPrivy();
                } else if ( event.type === "act" ) {
                    applyAction( event.actor, event.action );
                    emitFullPrivy();
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
        focusTabsEl: document.getElementById( "focus-tabs" ),
        futureEl: document.getElementById( "future-pane" )
    }, server.you, server.here,
        serverEvents.listenable, clientEvents.emittable );
};


})();
