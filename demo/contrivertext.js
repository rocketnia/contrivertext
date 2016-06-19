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
                    if ( v === null ) {
                        el.removeAttribute( k );
                    } else if ( isString( v ) ) {
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
        
        result.push( { type: "text", text: m[ 1 ] } );
        result.push(
            { type: "focusLink", link: m[ 2 ], text: m[ 3 ] } );
        descRemaining = m[ 4 ];
    }
    if ( !/^[^\\\[\]]*$/.test( descRemaining ) )
        throw new Error();
    result.push( { type: "text", text: descRemaining } );
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
    var currentFocusOptions = [];
    function createFocusLink( topic, var_args ) {
        var rest = [].slice.call( arguments, 1 );
        return appendDom( "a", { href: "#", click: function ( e ) {
            e.preventDefault();
            setFocus( topic );
        } }, rest );
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
        
        return result;
    }
    function makeContentFromAnnotatedVisitEntry(
        annotatedVisitEntry ) {
        
        var visitEntry = annotatedVisitEntry.visitEntry;
        
        function makeContentFromDescription( content ) {
            return appendDom( "div", arrMap( content,
                function ( para ) {
                
                return appendDom( "p", arrMap( para,
                    function ( span ) {
                    
                    if ( span.type === "text" ) {
                        return "" + span.text;
                    } else if ( span.type === "focusLink" ) {
                        return createFocusLink( span.link,
                            "" + span.text );
                        
                    } else if (
                        span.type === "affordanceHereButton" ) {
                        
                        return appendDom( "button", "" + span.text, {
                            click: function () {
                                clientEmittable.emit( {
                                    type: "actHere",
                                    actor: pov,
                                    time: visitEntry.temporalFact.stopTime,
                                    action: span.link
                                } );
                            }
                        } );
                        
                    } else if (
                        span.type === "affordanceButton" ) {
                        
                        // TODO: Actually write something on the
                        // server side that generates this kind of
                        // button.
                        
                        return appendDom( "button", "" + span.text, {
                            click: function () {
                                clientEmittable.emit( {
                                    type: "act",
                                    actor: pov,
                                    time: visitEntry.stopTime,
                                    topic: span.topic,
                                    action: span.link
                                } );
                            }
                        } );
                    } else {
                        throw new Error();
                    }
                } ) );
            } ) );
        }
        
        if ( visitEntry.role === "chronicle" ) {
            var description = visitEntry.temporalFact.fact.chronicle;
            var descriptionClasses = " chronicle";
            var affordances = null;
        } else if ( visitEntry.role === "description" ) {
            var description =
                visitEntry.temporalFact.fact.description;
            var descriptionClasses = " description";
            var affordances =
                visitEntry.temporalFact.fact.affordances;
        } else if ( visitEntry.role === "noDescription" ) {
            var description =
                dsc( "((No description at the moment...))" );
            var descriptionClasses = " description";
            var affordances = null;
        } else {
            throw new Error();
        }
        
        var classes =
            makeClassesFromAnnotatedVisitEntry( annotatedVisitEntry );
        
        var result = {};
        result.descriptionClasses = classes + descriptionClasses;
        result.description = appendDom( "div", {
            class: "visit-entry" + result.descriptionClasses
        }, makeContentFromDescription( description ) );
        result.affordancesClasses = classes + " affordances";
        result.affordances = affordances === null ? null :
            { val: appendDom( "div", {
                class: "visit-entry" + result.affordancesClasses
            }, makeContentFromDescription( affordances.val ) ) };
        return result;
    }
    function makeContentFromChronicles( chronicles ) {
        return appendDom( "div", {
        }, arrMap( annotateChronicles( chronicles ),
            function ( visit ) {
            
            return appendDom( "div", {
                class: "visit"
            }, arrMappend( visit, function ( annotatedVisitEntry ) {
                var content = makeContentFromAnnotatedVisitEntry(
                    annotatedVisitEntry );
                return [ content.description ].concat(
                    content.affordances === null ? [] :
                        [ content.affordances.val ] );
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
                return [ [], [] ];
            } else if ( cell.type === "present" ) {
                var rowspan = 2 * cell.height - 1;
                // TODO: A table element's `rowspan` must be between 1
                // and 0xFFFE, inclusive, to have the usual behavior.
                // Figure out what to do for heights outside that
                // range.
                if ( !(1 <= rowspan && rowspan <= 0xFFFE) )
                    throw new Error();
                var content = makeContentFromAnnotatedVisitEntry(
                    cell.annotatedVisitEntry );
                return [
                    appendDom( "td", {
                        rowspan: "" + rowspan,
                        class: className + " " +
                            content.descriptionClasses
                    }, content.description ),
                    rowspan !== 1 ? [] :
                        appendDom( "td", {
                            // NOTE: We could include the `rowspan`,
                            // but it's already at the default value.
//                            rowspan: "1",
                            class: className + " " +
                                content.affordancesClasses
                        }, content.affordances === null ? [] :
                            content.affordances.val )
                ];
            } else {
                throw new Error();
            }
        }
        for ( var i = 0; i < n; i++ ) {
            var hereContent = makeContentFromCellData(
                "here-column", hereCells[ i ] );
            var focusContent = makeContentFromCellData(
                "focus-column", focusCells[ i ] );
            appendDom( tbody,
                appendDom( "tr",
                    hereContent[ 0 ], focusContent[ 0 ] ),
                appendDom( "tr",
                    hereContent[ 1 ], focusContent[ 1 ] ) );
        }
        
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
            var title = "" + forceMostRecentTitle( topic );
            appendDom( elements.focusTabsEl,
                appendDom( "li", {
                    class: topic === currentFocus ? "active" : null
                }, createFocusLink( topic, title ) ) );
        }
        function addOption( topic ) {
            var title = "" + forceMostRecentTitle( topic );
            appendDom( elements.focusDropdownEl,
                appendDom( "option", {
                    value: topic,
                    selected:
                        topic === currentFocus ? "selected" : null
                }, title ) );
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
        
        clearDom( elements.focusDropdownEl );
        arrEach( currentFocusOptions, function ( topic ) {
            addOption( topic );
        } );
        if ( !arrHasJson( currentFocusOptions, currentFocus ) ) {
            currentFocusOptions.push( currentFocus );
            addOption( currentFocus );
        }
        
        var focusChronicles = getChronicles( currentFocus );
        clearDom( elements.focusEl,
            makeContentFromChronicles( focusChronicles ) );
        clearDom( elements.hereAndFocusEl,
            makeContentFromHereAndFocusChronicles(
                hereChronicles, focusChronicles ) );
        
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
    
    appendDom( elements.focusDropdownEl, { change: function () {
        setFocus( elements.focusDropdownEl.value );
    } } );
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
    function getActionsPermittedFor( actor, worldState ) {
        return arrMappend( getActionsPermitted( worldState ),
            function ( actionPermitted ) {
                return actionPermitted.actor === actor ?
                    [ actionPermitted.action ] : [];
            } )
    }
    function actionToActionLabel( action ) {
        if ( action.type === "exit" ) {
            return action.direction;
        } else {
            throw new Error();
        }
    }
    function actionToUpdate( worldState, event ) {
        var actor = event.actor;
        var time = event.time;
        var actionLabel = event.action;
        if ( getFullPrivy( actor ).stopTime !== time )
            throw new Error();
        var matchingActions = arrKeep(
            getActionsPermittedFor( actor, worldState ),
            function ( action ) {
            
            return actionToActionLabel( action ) === actionLabel;
        } );
        if ( matchingActions.length !== 1 )
            throw new Error();
        var action = matchingActions[ 0 ];
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
    function applyAction( event ) {
        worldUpdates.push(
            actionToUpdate( getCurrentWorldState(), event ) );
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
            actions: getActionsPermittedFor( pov, worldState )
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
        return { stopTime: time, privy: privy };
    }
    var describers = {};
    function defDescribeRoom( room, describer ) {
        describers[ "|" + room ] = function ( actor, visibility ) {
            var described = describer( actor, visibility );
            
            return {
                title: described.title,
                description: described.description,
                affordances: null
            };
        };
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
        var described = firstRoom ?
            describe( actor, visibility, firstRoom.val ) :
            {
                description: dsc(
                    "((You don't seem to be located anywhere right " +
                    "now.))"
                ),
                affordances: null,
            };
        
        var affordancesPara = [];
        arrEach( visibility.actions, function ( action ) {
            if ( action.type === "exit" ) {
                if ( action.direction === "n" ) {
                    var label = "Go north.";
                } else if ( action.direction === "s" ) {
                    var label = "Go south.";
                } else if ( action.direction === "e" ) {
                    var label = "Go east.";
                } else if ( action.direction === "w" ) {
                    var label = "Go west.";
                } else if ( action.direction === "u" ) {
                    var label = "Ascend.";
                } else if ( action.direction === "d" ) {
                    var label = "Descend.";
                } else {
                    throw new Error();
                }
            } else {
                throw new Error();
            }
            affordancesPara.push(
                { type: "affordanceHereButton",
                    link: actionToActionLabel( action ),
                    text: label } );
        } );
        
        return {
            type: "describesHere",
            pov: actor,
            description: described.description,
            affordances: { val:
                (described.affordances === null ? dsc() :
                    described.affordances.val
                ).concat( [ affordancesPara ] ) }
        };
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
    defDescribeRoom( "you", function ( actor, visibility ) {
        return titleDsc( "You",
            "You're wearing your adventuring clothes today." );
    } );
    defDescribeRoom( "thing", function ( actor, visibility ) {
        return titleDsc( "Thing",
            "The thing has a [feature feature] on it." );
    } );
    defDescribeRoom( "feature", function ( actor, visibility ) {
        return titleDsc( "Feature",
            "The feature of the [thing thing] is nondescript." );
    } );
    defDescribeRoom( "northwest-room",
        function ( actor, visibility ) {
        
        return titleDsc( "Northwest room",
            "You're in [northwest-room the northwest room]." );
    } );
    defDescribeRoom( "northeast-room",
        function ( actor, visibility ) {
        
        return titleDsc( "Northeast room",
            "You're in [northeast-room the northeast room]." );
    } );
    defDescribeRoom( "southwest-room",
        function ( actor, visibility ) {
        
        return titleDsc( "Southwest room",
            "You're in [southwest-room the southwest room].",
            "There is a [thing thing] here." );
    } );
    defDescribeRoom( "southeast-room",
        function ( actor, visibility ) {
        
        return titleDsc( "Southeast room",
            "You're in [southeast-room the southeast room]." );
    } );
    
    function stateVisibilityToPrivyFacts( actor, visibility ) {
        return [
            describeHere( actor, visibility )
        ].concat( arrMappend( visibility.topics,
            function ( topic ) {
            
            var details = describe( actor, visibility, topic );
            return [
                { type: "titles", pov: actor, topic: topic,
                    title: details.title },
                { type: "describes", pov: actor, topic: topic,
                    description: details.description,
                    affordances: details.affordances }
            ];
        } ) );
    }
    function actionVisibilityToPrivyFacts(
        actor, visibility, before, after ) {
        
        var action = visibility.action;
        if ( action.type === "exit" ) {
            var isMe = actor === visibility.actor;
            var directionPlayByPlaysCardinal = function (
                directionText, directionOppositeText ) {
                
                return {
                    arrive:
                        (isMe ? "You arrive " : "Someone arrives ") +
                        "from the " + directionOppositeText + ".",
                    go:
                        (isMe ? "You go" : "Someone goes") + " " +
                        directionText + ".",
                    leave:
                        (isMe ? "You leave " : "Someone leaves ") +
                        "to the " + directionText + "."
                };
            };
            if ( action.direction === "n" ) {
                var directionPlayByPlays =
                    directionPlayByPlaysCardinal( "north", "south" );
            } else if ( action.direction === "s" ) {
                var directionPlayByPlays =
                    directionPlayByPlaysCardinal( "south", "north" );
            } else if ( action.direction === "e" ) {
                var directionPlayByPlays =
                    directionPlayByPlaysCardinal( "east", "west" );
            } else if ( action.direction === "w" ) {
                var directionPlayByPlays =
                    directionPlayByPlaysCardinal( "west", "east" );
            } else if ( action.direction === "u" ) {
                var directionPlayByPlays = {
                    arrive:
                        (isMe ? "You arrive " : "Someone arrives ") +
                        "from below.",
                    go: isMe ? "You ascend." : "Someone ascends.",
                    
                    // TODO: See if there's a more natural way to
                    // phrase this.
                    leave:
                        (isMe ? "You leave " : "Someone leaves ") +
                        "by ascending."
                };
            } else if ( action.direction === "d" ) {
                var directionPlayByPlays = {
                    arrive:
                        (isMe ? "You arrive " : "Someone arrives ") +
                        "from above.",
                    go: isMe ? "You descend." : "Someone descends.",
                    
                    // TODO: See if there's a more natural way to
                    // phrase this.
                    leave:
                        (isMe ? "You leave " : "Someone leaves ") +
                        "by descending."
                };
            } else {
                throw new Error();
            }
            var result = [
                { type: "chronicles", pov: actor,
                    topic: visibility.actor,
                    chronicle: dsc( directionPlayByPlays.go ) }
            ];
            if ( isMe ) {
                arrEach( before.topics, function ( topic ) {
                    if ( arrHasJson( after.topics, topic ) )
                        return;
                    result.push( { type: "chronicles", pov: actor,
                        topic: topic,
                        chronicle: dsc(
                            directionPlayByPlays.leave
                        ) } );
                } );
                arrEach( after.topics, function ( topic ) {
                    if ( arrHasJson( before.topics, topic ) )
                        return;
                    result.push( { type: "chronicles", pov: actor,
                        topic: topic,
                        chronicle: dsc(
                            directionPlayByPlays.arrive
                        ) } );
                } );
            } else {
                result.push( { type: "chronicles", pov: actor,
                    topic: action.from,
                    chronicle: dsc( directionPlayByPlays.leave ) } );
                result.push( { type: "chronicles", pov: actor,
                    topic: action.to,
                    chronicle: dsc( directionPlayByPlays.arrive ) } );
            }
            if ( isMe )
                result.push( { type: "chroniclesHere", pov: actor,
                    chronicle: dsc( directionPlayByPlays.go ) } );
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
                        privy: getFullPrivy( "you" ).privy } );
                }
                
                if ( event.type === "needsFullPrivy" ) {
                    emitFullPrivy();
                } else if ( event.type === "actHere" ) {
                    applyAction( event );
                    emitFullPrivy();
                } else if ( event.type === "act" ) {
                    applyAction( event );
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
        focusDropdownEl: document.getElementById( "focus-dropdown" )
    }, server.you, serverEvents.listenable, clientEvents.emittable );
};

// This is based on <http://output.jsbin.com/qofuwa/2/quiet>, reached
// via a link from
// <https://docs.google.com/document/d/12Ay4s3NWake8Qd6xQeGiYimGJ_gCe0UMDZKwP9Ni4m8/edit?pref=2&pli=1>,
// reached via a link from
// <http://stackoverflow.com/questions/29008194/disabling-androids-chrome-pull-down-to-refresh-feature>.
var preventingPullToRefresh = null;
appendDom( document, { touchstart: function ( e ) {
    if ( e.touches.length !== 1 )
        return;
    var y = e.touches[ 0 ].clientY;
    preventingPullToRefresh =
        window.pageYOffset === 0 ? { y: y } : null;
} } );
appendDom( document, { touchmove: function ( e ) {
    if ( preventingPullToRefresh === null )
        return;
    var y = e.touches[ 0 ].clientY;
    if ( preventingPullToRefresh.y < y )
        e.preventDefault();
    preventingPullToRefresh = null;
} } );


})();
