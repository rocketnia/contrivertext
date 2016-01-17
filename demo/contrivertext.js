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
function numMap( n, body ) {
    var result = [];
    for ( var i = 0; i < n; i++ )
        result.push( body( i ) );
    return result;
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

function isString( x ) {
    return typeof x === "string";
}
function isFunction( x ) {
    return typeof x === "function";
}
function isArray( x ) {
    return {}.toString.call( x ) === "[object Array]";
}
function isNode( x ) {
    return x !== null && typeof x === "object" &&
        x instanceof Node;
}
function appendDom( elOrTagName, var_args ) {
    var el = isString( elOrTagName ) ?
        document.createElement( elOrTagName ) :
        elOrTagName;
    function appendOneDom( arg ) {
        if ( isString( arg ) ) {
            el.appendChild( document.createTextNode( arg ) );
        } else if ( isArray( arg ) ) {
            arrEach( arg, function ( item ) {
                appendOneDom( item );
            } );
        } else if ( isNode( arg ) ) {
            el.appendChild( arg );
        } else if ( arg !== null && typeof arg === "object" ) {
            for ( var k in arg ) {
                if ( objHas( arg, k ) ) {
                    var v = arg[ k ];
                    if ( v === null || isString( v ) ) {
                        el.setAttribute( k, v );
                    } else if ( isFunction( v ) ) {
                        el.addEventListener( k, v, !"capture" );
                    } else {
                        throw new Error();
                    }
                }
            }
        } else {
            throw new Error();
        }
    }
    appendOneDom( [].slice.call( arguments, 1 ) );
    return el;
}
function clearDom( el, var_args ) {
    while ( el.hasChildNodes() )
        el.removeChild( el.firstChild );
    appendDom.apply( null, arguments );
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
    elements, pov, serverListenable, clientEmittable ) {
    
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
    function createFocusLink( topic, var_args ) {
        var rest = [].slice.call( arguments, 1 );
        return appendDom( "a", { href: "#", click: function ( e ) {
            e.preventDefault();
            setFocus( topic );
        } }, rest );
    }
    function makeContentFromDescription( content ) {
        return appendDom( "div", arrMap( content, function ( para ) {
            return appendDom( "p", arrMap( para, function ( span ) {
                var spanText = "" + span.text;
                return span.link === null ? spanText :
                    createFocusLink( span.link.val, spanText );
            } ) );
        } ) );
    }
    function annotateChronicles( chronicles ) {
        var annotatedLastDescriptionEntry = null;
        var annotatedDescriptionBefore = null;
        var annotatedChronicles = arrMap( chronicles,
            function ( visit ) {
            
            var isFirstVisitEntry = true;
            var annotatedLastVisitEntry = null;
            var annotatedVisit = arrMap( visit,
                function ( visitEntry ) {
                
                var annotatedVisitEntry = {
                    sameAsBefore: false,
                    sameAsAfter: false,
                    isFirstVisitEntry: isFirstVisitEntry,
                    isLastVisitEntry: false,
                    isLastDescription: false,
                    visitEntry: visitEntry
                };
                isFirstVisitEntry = false;
                annotatedLastVisitEntry = annotatedVisitEntry;
                if ( visitEntry.role === "description" ) {
                    if ( annotatedDescriptionBefore !== null
                        && jsonIso(
                            annotatedDescriptionBefore.visitEntry.
                                temporalFact.fact.description,
                            visitEntry.temporalFact.fact.description )
                    ) {
                        annotatedDescriptionBefore.sameAsAfter = true;
                        annotatedVisitEntry.sameAsBefore = true;
                    }
                    annotatedDescriptionBefore = annotatedVisitEntry;
                    annotatedLastDescriptionEntry =
                        annotatedVisitEntry;
                }
                return annotatedVisitEntry;
            } );
            if ( annotatedLastVisitEntry !== null )
                annotatedLastVisitEntry.isLastVisitEntry = true;
            return annotatedVisit;
        } );
        if ( annotatedLastDescriptionEntry === null ) {
            annotatedLastDescriptionEntry = {
                sameAsBefore: false,
                sameAsAfter: false,
                isFirstVisitEntry: true,
                isLastVisitEntry: true,
                isLastDescription: true,
                visitEntry: { role: "noDescription" }
            };
            annotatedChronicles.push(
                [ annotatedLastDescriptionEntry ] );
        }
        annotatedLastDescriptionEntry.isLastDescription = true;
        return annotatedChronicles;
    }
    function makeClassesFromAnnotatedVisitEntry(
        annotatedVisitEntry ) {
        
        var visitEntry = annotatedVisitEntry.visitEntry;
        
        var result = "" +
            (annotatedVisitEntry.sameAsBefore
                && annotatedVisitEntry.sameAsAfter ?
                " redundant" : "") +
            (annotatedVisitEntry.isFirstVisitEntry ?
                " first-visit-entry" : "") +
            (annotatedVisitEntry.isLastVisitEntry ?
                " last-visit-entry" : "") +
            (annotatedVisitEntry.isLastDescription ?
                " last-description" : "");
        
        if ( visitEntry.role === "chronicle" ) {
            result += " chronicle";
        } else if ( visitEntry.role === "description" ) {
            result += " description";
        } else if ( visitEntry.role === "noDescription" ) {
            result += " description";
        } else {
            throw new Error();
        }
        
        return result;
    }
    function makeContentFromAnnotatedVisitEntry(
        annotatedVisitEntry ) {
        
        var visitEntry = annotatedVisitEntry.visitEntry;
        
        if ( visitEntry.role === "chronicle" ) {
            var description = visitEntry.temporalFact.fact.chronicle;
        } else if ( visitEntry.role === "description" ) {
            var description =
                visitEntry.temporalFact.fact.description;
        } else if ( visitEntry.role === "noDescription" ) {
            var description =
                dsc( "((No description at the moment...))" );
        } else {
            throw new Error();
        }
        
        return appendDom( "div", {
            class: "visit-entry" +
                makeClassesFromAnnotatedVisitEntry(
                    annotatedVisitEntry )
        }, makeContentFromDescription( description ) );
    }
    function makeContentFromChronicles( chronicles ) {
        return appendDom( "div", {
        }, arrMap( annotateChronicles( chronicles ),
            function ( visit ) {
            
            return appendDom( "div", {
                class: "visit"
            }, arrMap( visit, function ( annotatedVisitEntry ) {
                return makeContentFromAnnotatedVisitEntry(
                    annotatedVisitEntry );
            } ) );
        } ) );
    }
    function makeContentFromHereAndFocusChronicles(
        hereChronicles, focusChronicles ) {
        
        function flatAnnotateChronicles( chronicles ) {
            return arrMappend( annotateChronicles( chronicles ),
                function ( visit ) {
                    return visit;
                } );
        }
        var hereAnn = flatAnnotateChronicles( hereChronicles );
        var focusAnn = flatAnnotateChronicles( focusChronicles );
        
        var allTimestampsPresenceObj = {};
        var allTimestamps = [];
        function addTimestamp( ts ) {
            if ( objHas( allTimestampsPresenceObj, ts ) )
                return;
            allTimestampsPresenceObj[ ts ] = true;
            allTimestamps.push( ts );
        }
        arrEach( [ hereAnn, focusAnn ], function ( ann ) {
            arrEach( ann, function ( annotatedVisitEntry ) {
                var visitEntry = annotatedVisitEntry.visitEntry;
                if ( visitEntry.role === "noDescription" )
                    return;
                addTimestamp( visitEntry.temporalFact.startTime );
                addTimestamp( visitEntry.temporalFact.stopTime );
            } );
        } );
        allTimestamps.sort( function ( a, b ) {
            return a - b;
        } );
        var allTimestampsIndexObj = {};
        arrEach( allTimestamps, function ( ts, i ) {
            allTimestampsIndexObj[ ts ] = i;
        } );
        
        function cellData( ann ) {
            var result =
                // This includes
                // `Math.max( 0, allTimestamps.length - 1 )` entries
                // for the timestamped segments, plus one more entry
                // for the `noDescription` entry.
                numMap( Math.max( 0, allTimestamps.length - 1 ) + 1,
                    function ( i ) {
                        return { type: "absent" };
                    } );
            
            function setResult( i, val ) {
                if ( result[ i ].type !== "absent" )
                    throw new Error();
                result[ i ] = val;
            }
            
            arrEach( ann, function ( annotatedVisitEntry ) {
                var visitEntry = annotatedVisitEntry.visitEntry;
                if ( visitEntry.role === "noDescription" ) {
                    setResult( result.length - 1, {
                        type: "present",
                        height: 1,
                        annotatedVisitEntry: annotatedVisitEntry
                    } );
                } else {
                    var startIndex = allTimestampsIndexObj[
                        visitEntry.temporalFact.startTime ];
                    var height =
                        allTimestampsIndexObj[
                            visitEntry.temporalFact.stopTime ] -
                        startIndex;
                    if ( height < 1 )
                        throw new Error();
                    setResult( startIndex, {
                        type: "present",
                        height: height,
                        annotatedVisitEntry: annotatedVisitEntry
                    } );
                }
            } );
            return result;
        }
        
        var hereCells = cellData( hereAnn );
        var focusCells = cellData( focusAnn );
        var n = hereCells.length;
        if ( n !== focusCells.length )
            throw new Error();
        var tbody = appendDom( "tbody" );
        function makeContentFromCellData( className, cell ) {
            if ( cell.type === "absent" ) {
                return [];
            } else if ( cell.type === "present" ) {
                // TODO: A table element's `rowspan` must be between 1
                // and 0xFFFE, inclusive, to have the usual behavior.
                // Figure out what to do for heights outside that
                // range.
                if ( !(1 <= cell.height && cell.height <= 0xFFFE) )
                    throw new Error();
                return appendDom( "td", {
                    rowspan: "" + cell.height,
                    class: className + " " +
                        makeClassesFromAnnotatedVisitEntry(
                            cell.annotatedVisitEntry )
                }, makeContentFromAnnotatedVisitEntry(
                    cell.annotatedVisitEntry
                ) );
            } else {
                throw new Error();
            }
        }
        for ( var i = 0; i < n; i++ )
            appendDom( tbody,
                appendDom( "tr",
                    makeContentFromCellData(
                        "here-column", hereCells[ i ] ),
                    makeContentFromCellData(
                        "focus-column", focusCells[ i ] ) ) );
        
        return appendDom( "table", tbody );
    }
    function getMostRecentTemporalFact(
        stopEarlierThanTime, checkFact ) {
        
        var results = [];
        var attemptedStopEarlierThanTime =
            stopEarlierThanTime;
        while ( true ) {
            arrEach( privy, function ( tf ) {
                if ( (results.length === 0
                        || results[ 0 ].stopTime < tf.stopTime
                        || (results[ 0 ].stopTime === tf.stopTime
                            // If multiple facts conflict, the ones
                            // that started the earliest take
                            // precedence.
                            && tf.startTime <=
                                results[ 0 ].startTime))
                    && tf.stopTime < attemptedStopEarlierThanTime
                    && checkFact( tf.fact ) ) {
                    
                    if ( results.length === 0
                        || (results[ 0 ].stopTime === tf.stopTime
                            && tf.startTime ===
                                results[ 0 ].startTime) )
                        results.push( tf );
                    else
                        results = [ tf ];
                }
            } );
            if ( results.length <= 1 )
                break;
            // If multiple facts conflict and they all start at the
            // same time, then none of them take effect at all, and we
            // try again with an earlier time.
            attemptedStopEarlierThanTime = results[ 0 ].stopTime;
        }
        return results.length === 1 ? results[ 0 ] : null;
    }
    function getHistoryOfTemporalFacts( checkFact ) {
        var results = [];
        var stopEarlierThanTime = 1 / 0;
        while ( true ) {
            var tf = getMostRecentTemporalFact(
                stopEarlierThanTime, checkFact );
            if ( tf === null )
                break;
            results.unshift( tf );
            stopEarlierThanTime = tf.stopTime;
        }
        return results;
    }
    function getCurrentTime() {
        var currentTime = 0;
        arrEach( privy, function ( tf ) {
            currentTime = Math.max( currentTime, tf.stopTime );
        } );
        return currentTime;
    }
    function getCurrentFacts() {
        var currentTime = getCurrentTime();
        return arrMappend( privy, function ( tf ) {
            return currentTime === tf.stopTime ? [ tf.fact ] : [];
        } );
    }
    function forceMostRecentTitle( topic ) {
        var tf = getMostRecentTemporalFact( 1 / 0, function ( fact ) {
            return fact.type === "titles" &&
                fact.pov === pov &&
                fact.topic === topic;
        } );
        return tf === null ? "((Unknown))" : tf.fact.title;
    }
    function mergeChronicles( chronicles, descriptions ) {
        var result = [];
        var resultSegment = [];
        var cn = chronicles.length;
        var dn = descriptions.length;
        var ci = 0;
        var di = 0;
        function process( resultEntry ) {
            var n = resultSegment.length;
            if ( !(n === 0
                || resultEntry.temporalFact.startTime <=
                    resultSegment[ n - 1 ].temporalFact.stopTime) ) {
                result.push( resultSegment );
                resultSegment = [];
            }
            resultSegment.push( resultEntry );
        }
        function processChronicle() {
            process( { role: "chronicle",
                temporalFact: chronicles[ ci ] } );
            ci++;
        }
        function processDescription() {
            process( { role: "description",
                temporalFact: descriptions[ di ] } );
            di++;
        }
        while ( true ) {
            if ( ci < cn ) {
                if ( di < dn ) {
                    var c = chronicles[ ci ];
                    var d = descriptions[ di ];
                    if ( c.startTime <= d.startTime )
                        processChronicle();
                    else
                        processDescription();
                } else {
                    processChronicle();
                }
            } else {
                if ( di < dn ) {
                    processDescription();
                } else {
                    break;
                }
            }
        }
        if ( resultSegment.length !== 0 )
            result.push( resultSegment );
        return result;
    }
    function getChronicles( topic ) {
        return mergeChronicles(
            getHistoryOfTemporalFacts( function ( fact ) {
                return fact.type === "chronicles" &&
                    fact.pov === pov &&
                    fact.topic === topic;
            } ),
            getHistoryOfTemporalFacts( function ( fact ) {
                return fact.type === "describes" &&
                    fact.pov === pov &&
                    fact.topic === topic;
            } ) );
    }
    function getChroniclesHere() {
        return mergeChronicles(
            getHistoryOfTemporalFacts( function ( fact ) {
                return fact.type === "chroniclesHere" &&
                    fact.pov === pov;
            } ),
            getHistoryOfTemporalFacts( function ( fact ) {
                return fact.type === "describesHere" &&
                    fact.pov === pov;
            } ) );
    }
    function setFocus( topic ) {
        currentFocus = topic;
        updateUi();
    }
    function getScrollState( el ) {
        var forgivenessPx = 10;
        var maxScrollTop = el.scrollHeight - el.clientHeight;
        var scrollTop = el.scrollTop;
        return {
            atBottom: maxScrollTop - scrollTop <= forgivenessPx,
            
            // NOTE: This can result in NaN, but it doesn't matter.
            fraction: scrollTop / maxScrollTop
        };
    }
    function restoreScrollState( scrollState, el ) {
        var maxScrollTop = el.scrollHeight - el.clientHeight;
        el.scrollTop = maxScrollTop *
            (scrollState.atBottom ? 1 : scrollState.fraction);
    }
    function updateUi() {
        
        var wasScrollingCombined = "true" ===
            elements.contriverTextClientEl.getAttribute(
                "data-combined-scrolling" );
        var nowScrollingCombined =
            elements.combinedScrollingCheckboxEl.checked;
        if ( wasScrollingCombined ) {
            var hereAndFocusScrollState =
                getScrollState( elements.hereAndFocusEl );
            var hereScrollState = hereAndFocusScrollState;
            var focusScrollState = hereAndFocusScrollState;
        } else {
            var hereScrollState = getScrollState( elements.hereEl );
            var focusScrollState = getScrollState( elements.focusEl );
            var hereAndFocusScrollState = hereScrollState;
        }
        elements.contriverTextClientEl.setAttribute(
            "data-combined-scrolling",
            "" + elements.combinedScrollingCheckboxEl.checked );
        
        
        var hereChronicles = loadedFirstPrivy ? getChroniclesHere() :
            [ { role: "description", temporalFact: {
                startTime: 0,
                stopTime: 1,
                fact: { type: "describesHere", pov: pov,
                    description: dsc() }
//                    description: dsc( "((Loading...))" ) }
            } } ];
        clearDom( elements.hereEl,
            makeContentFromChronicles( hereChronicles ) );
        
        function addTab( topic ) {
            appendDom( elements.focusTabsEl,
                appendDom( "li", {
                    class: topic === currentFocus ? "active" : null
                }, createFocusLink( topic,
                    "" + forceMostRecentTitle( topic )
                ) ) );
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
        var focusChronicles = getChronicles( currentFocus );
        clearDom( elements.focusEl,
            makeContentFromChronicles( focusChronicles ) );
        clearDom( elements.hereAndFocusEl,
            makeContentFromHereAndFocusChronicles(
                hereChronicles, focusChronicles ) );
        
        clearDom( elements.futureEl );
        if ( loadedFirstPrivy )
            arrEach( getCurrentFacts(), function ( rel ) {
                if ( !(rel.type === "can" && rel.pov === pov) )
                    return;
                appendDom( elements.futureEl,
                    appendDom( "button", "" + rel.label, {
                        click: function () {
                            clientEmittable.emit( { type: "act",
                                actor: pov, action: rel.action } );
                        }
                    } ) );
            } );
        restoreScrollState( hereScrollState, elements.hereEl );
        restoreScrollState( focusScrollState, elements.focusEl );
        restoreScrollState( hereAndFocusScrollState,
            elements.hereAndFocusEl );
    }
    updateUi();
    
    appendDom( elements.combinedScrollingCheckboxEl, {
        change: function () {
            updateUi();
        }
    } );
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
    function getInstantaneousVisibility( worldState, pov ) {
        var rels = [];
        var containers = [];
        arrEach( worldState, function ( rel ) {
            if ( rel.type === "in-room" && rel.element === pov ) {
                containers.push( rel.container );
                rels.push( rel );
            }
        } );
        var topics = [ pov ].concat( containers );
        arrEach( worldState, function ( rel ) {
            if ( rel.type === "in-room"
                && rel.element !== pov
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
                    return actionPermitted.actor === pov ?
                        [ actionPermitted.action ] : [];
                } )
        };
    }
    function getActionVisibility(
        pov, actor, action, before, after ) {
        
        return {
            actor: actor,
            action:
                (arrHasJson( before.topics, actor )
                    || arrHasJson( after.topics, actor )) ?
                    action :
                    { type: "nothing" }
        };
    }
    function getFullPrivy( actor ) {
        var states = [ initialWorldState ].concat(
            arrMap( worldUpdates, function ( update ) {
                return update.newWorldState;
            } ) );
        var stateVisibilities = arrMap( states, function ( state ) {
            return getInstantaneousVisibility( state, actor );
        } );
        var actionVisibilities = arrMap( worldUpdates,
            function ( update, i ) {
            
            return getActionVisibility( actor,
                update.actor, update.action,
                stateVisibilities[ i ], stateVisibilities[ i + 1 ] );
        } );
        var n = actionVisibilities.length;
        var privy = [];
        var time = 0;
        function addFactsAsTimeStep( facts ) {
            privy = privy.concat( arrMap( facts, function ( fact ) {
                return {
                    startTime: time,
                    stopTime: time + 1,
                    fact: fact
                };
            } ) );
            time++;
        }
        var prevSv = null;
        for ( var i = 0; ; i++ ) {
            var sv = stateVisibilities[ i ];
            if ( prevSv === null || !jsonIso( prevSv, sv ) )
                addFactsAsTimeStep(
                    stateVisibilityToPrivyFacts( actor, sv ) );
            if ( n <= i )
                break;
            var av = actionVisibilities[ i ];
            if ( av.action.type === "nothing" ) {
                prevSv = sv;
            } else {
                prevSv = null;
                addFactsAsTimeStep(
                    actionVisibilityToPrivyFacts(
                        actor, av, sv, stateVisibilities[ i + 1 ] ) );
            }
        }
        return privy;
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
    function describeHere( actor, visibility ) {
        var firstRoom = arrAny( visibility.worldState,
            function ( rel ) {
            
            return rel.type === "in-room" && rel.element === actor ?
                { val: rel.container } : false;
        } );
        return firstRoom ?
            describe( actor, visibility, firstRoom.val ).description :
            dsc(
                "((You don't seem to be located anywhere right now.))"
            );
    }
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
    
    function stateVisibilityToPrivyFacts( actor, visibility ) {
        return [
            { type: "describesHere", pov: actor,
                description: describeHere( actor, visibility ) }
        ].concat( arrMappend( visibility.topics,
            function ( topic ) {
            
            var details = describe( actor, visibility, topic );
            return [
                { type: "titles", pov: actor, topic: topic,
                    title: details.title },
                { type: "describes", pov: actor, topic: topic,
                    description: details.description }
            ];
        } ), arrMap( visibility.actions, function ( action ) {
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
    }
    function actionVisibilityToPrivyFacts(
        actor, visibility, before, after ) {
        
        var action = visibility.action;
        if ( action.type === "exit" ) {
            if ( action.direction === "n" ) {
                var directionText = "north";
                var directionOppositeText = "south";
            } else if ( action.direction === "s" ) {
                var directionText = "south";
                var directionOppositeText = "north";
            } else if ( action.direction === "e" ) {
                var directionText = "east";
                var directionOppositeText = "west";
            } else if ( action.direction === "w" ) {
                var directionText = "west";
                var directionOppositeText = "east";
            } else {
                throw new Error();
            }
            var isMe = actor === visibility.actor;
            var result = [
                { type: "chronicles", pov: actor,
                    topic: visibility.actor,
                    chronicle: dsc(
                        (isMe ? "You go" : "Someone goes") + " " +
                        directionText + "."
                    ) }
            ];
            if ( isMe ) {
                arrEach( before.topics, function ( topic ) {
                    if ( arrHasJson( after.topics, topic ) )
                        return;
                    result.push( { type: "chronicles", pov: actor,
                        topic: topic,
                        chronicle: dsc(
                            "You leave to the " + directionText + "."
                        ) } );
                } );
                arrEach( after.topics, function ( topic ) {
                    if ( arrHasJson( before.topics, topic ) )
                        return;
                    result.push( { type: "chronicles", pov: actor,
                        topic: topic,
                        chronicle: dsc(
                            "You arrive from the " +
                            directionOppositeText + "."
                        ) } );
                } );
            } else {
                result.push( { type: "chronicles", pov: actor,
                    topic: action.from,
                    chronicle: dsc(
                        "Someone leaves to the " + directionText + "."
                    ) } );
                result.push( { type: "chronicles", pov: actor,
                    topic: action.to,
                    chronicle: dsc(
                        "Someone arrives from the " +
                        directionOppositeText + "."
                    ) } );
            }
            if ( isMe )
                result.push( { type: "chroniclesHere", pov: actor,
                    chronicle: dsc(
                        "You go " + directionText + "."
                    ) } );
            return result;
        } else {
            throw new Error();
        }
    }
    
    
    var result = {};
    result.you = "you";
    result.addClient = function (
        you, clientListenable, serverEmittable ) {
        
        if ( you === "you" ) {
            clientListenable.on( function ( event ) {
                function emitFullPrivy() {
                    serverEmittable.emit( { type: "fullPrivy",
                        privy: getFullPrivy( "you" ) } );
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
        contriverTextClientEl:
            document.getElementById( "contrivertext-client" ),
        combinedScrollingCheckboxEl:
            document.getElementById( "combined-scrolling-checkbox" ),
        hereEl: document.getElementById( "here-pane" ),
        focusEl: document.getElementById( "focus-content" ),
        hereAndFocusEl:
            document.getElementById( "here-and-focus-pane" ),
        focusTabsEl: document.getElementById( "focus-tabs" ),
        futureEl: document.getElementById( "future-pane" )
    }, server.you, serverEvents.listenable, clientEvents.emittable );
};


})();
