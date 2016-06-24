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
    function makeContentFromDescription( time, content ) {
        return appendDom( "div", arrMap( content, function ( para ) {
            return appendDom( "p", arrMap( para, function ( span ) {
                if ( span.type === "text" ) {
                    return "" + span.text;
                } else if ( span.type === "focusLink" ) {
                    return createFocusLink( span.link,
                        "" + span.text );
                } else if ( span.type === "affordanceHereButton" ) {
                    if ( time === null )
                        throw new Error();
                    return appendDom( "button", "" + span.text, {
                        click: function () {
                            clientEmittable.emit( {
                                type: "actHere",
                                actor: pov,
                                time: time,
                                action: span.link
                            } );
                        }
                    } );
                } else if ( span.type === "affordanceButton" ) {
                    // TODO: Actually write something on the server
                    // side that generates this kind of button.
                    if ( time === null )
                        throw new Error();
                    return appendDom( "button", "" + span.text, {
                        click: function () {
                            clientEmittable.emit( {
                                type: "act",
                                actor: pov,
                                time: time,
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
    function makeContentFromAnnotatedVisitEntry(
        annotatedVisitEntry ) {
        
        var visitEntry = annotatedVisitEntry.visitEntry;
        
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
        var time = visitEntry.role === "noDescription" ? null :
            visitEntry.temporalFact.stopTime;
        
        var result = {};
        result.descriptionClasses = classes + descriptionClasses;
        result.description = appendDom( "div", {
            class: "visit-entry" + result.descriptionClasses
        }, makeContentFromDescription( time, description ) );
        result.affordancesClasses = classes + " affordances";
        result.affordances = affordances === null ? null :
            { val:
                appendDom( "div", {
                    class: "visit-entry" + result.affordancesClasses
                }, makeContentFromDescription(
                    time, affordances.val ) ) };
        return result;
    }
    function makeContentFiller() {
        var result = {};
        result.descriptionClasses = "redundant description";
        result.description = appendDom( "div", {
            class: "visit-entry" + result.descriptionClasses
        }, makeContentFromDescription( null, dsc() ) );
        result.affordancesClasses = "affordances";
        result.affordances = null;
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
            
            var prevStopIndex = null;
            arrEach( ann, function ( annotatedVisitEntry ) {
                var visitEntry = annotatedVisitEntry.visitEntry;
                if ( visitEntry.role === "noDescription" ) {
                    setResult( result.length - 1, {
                        type: "present",
                        height: 1,
                        annotatedVisitEntry:
                            { val: annotatedVisitEntry }
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
                    var fact = visitEntry.temporalFact.fact;
                    if ( prevStopIndex !== null
                        && prevStopIndex < startIndex
                        && !(fact.type === "chronicles"
                            && fact.arriving) )
                        setResult( prevStopIndex, {
                            type: "present",
                            height: startIndex - prevStopIndex,
                            annotatedVisitEntry: null
                        } );
                    prevStopIndex = startIndex + height;
                    setResult( startIndex, {
                        type: "present",
                        height: height,
                        annotatedVisitEntry:
                            { val: annotatedVisitEntry }
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
                var content = cell.annotatedVisitEntry === null ?
                    makeContentFiller() :
                    makeContentFromAnnotatedVisitEntry(
                        cell.annotatedVisitEntry.val );
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
            if ( n !== 0
                && resultEntry.temporalFact.fact.type === "chronicles"
                && resultEntry.temporalFact.fact.arriving ) {
                // NOTE: We used to use this check instead of
                // `arriving`, but it doesn't work for the simple case
                // where some event just isn't interesting enough to
                // chronicle for some topic.
//            if ( !(n === 0
//                || resultEntry.temporalFact.startTime <=
//                    resultSegment[ n - 1 ].temporalFact.stopTime) ) {
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
    var afforders = {};
    var describers = {};
    function addExits( dir1, dir2, room1, room2 ) {
        initialWorldState.push( { type: "exit", direction: dir1,
            from: room2, to: room1 } );
        initialWorldState.push( { type: "exit", direction: dir2,
            from: room1, to: room2 } );
    }
    function defAffordRoom( room, afforder ) {
        afforders[ "|" + room ] = afforder;
    }
    function defDescribeRoom( room, describer ) {
        describers[ "|" + room ] = describer;
    }
    function getAffordances( actor, worldState, topic ) {
        var afforder = afforders[ "|" + topic ];
        return afforder ? afforder( actor, worldState ) : [];
    }
    function describe( actor, visibility, topic ) {
        var describer = describers[ "|" + topic ];
        return describer( actor, visibility );
    }
    function getActionsPermitted( worldState ) {
        return arrMappend( worldState, function ( rel1 ) {
            if ( rel1.type === "in-room" ) {
                var actor = rel1.element;
                var room = rel1.container;
                return arrMappend( worldState, function ( rel2 ) {
                    if ( rel2.type === "exit"
                        && rel2.from === room ) {
                        // NOTE: We reuse the exit relation as an
                        // action. This might be too clever.
                        return [ { actor: actor, action: rel2 } ];
                    } else {
                        return [];
                    }
                } ).concat(
                    arrMap( getAffordances( actor, worldState, room ),
                        function ( action ) {
                            return { actor: actor, action: action };
                        } ) );
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
        } else if ( action.type === "misc-action" ) {
            return action.label;
        } else {
            throw new Error();
        }
    }
    function moveRel( worldState, element, container ) {
        return arrRem( worldState, function ( rel ) {
            return rel.type === "in-room" && rel.element === element;
        } ).concat( [ { type: "in-room", element: element,
            container: container } ] );
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
                moveRel( worldState, actor, action.to ) };
        } else if ( action.type = "misc-action" ) {
            return { actor: actor, action: action, newWorldState:
                action.newWorldState };
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
                
            } else if ( rel.type === "has-state"
                && arrAny( containers, function ( room ) {
                    return arrHasJson( rel.rooms, room );
                } ) ) {
                
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
    function titleDsc( title, var_args ) {
        return { title: title,
            description:
                dsc.apply( null, [].slice.call( arguments, 1 ) ),
            affordances: null };
    }
    function currentRoom( worldState, element ) {
        return arrAny( worldState, function ( rel ) {
            return rel.type === "in-room" && rel.element === element ?
                { val: rel.container } : false;
        } );
    }
    function describeHere( actor, visibility ) {
        var firstRoom = currentRoom( visibility.worldState, actor );
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
            } else if ( action.type === "misc-action" ) {
                var label = action.description;
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
    function getStateRel( worldState, name ) {
        var rels = arrKeep( worldState, function ( rel ) {
            return rel.type === "has-state" && rel.name === name;
        } );
        return rels.length === 1 ? rels[ 0 ].state : void 0;
    }
    function putStateRel( worldState, rooms, name, state ) {
        return arrRem( worldState, function ( rel ) {
            return rel.type === "has-state" && rel.name === name;
        } ).concat( [ { type: "has-state",
            rooms: rooms, name: name, state: state } ] );
    }
    
    initialWorldState.push( { type: "in-room", element: "you",
        container: "beginning" } );
    initialWorldState.push( { type: "in-room",
        element: "environmentalizer",
        container: "living-room" } );
    initialWorldState.push( { type: "in-room", element: "legs",
        container: "living-room" } );
    initialWorldState.push( { type: "has-state",
        rooms: [ "living-room", "ending-1" ],
        name: "environmentalizer-state",
        state: "intact" } );
    initialWorldState.push( { type: "has-state",
        rooms: [ "living-room", "ending-1", "attic" ],
        name: "fan-state",
        state: "incomplete" } );
    initialWorldState.push( { type: "has-state",
        rooms: [ "living-room", "ending-1", "bathroom" ],
        name: "sink-state",
        state: "incomplete" } );
    initialWorldState.push( { type: "has-state",
        rooms: [ "living-room", "ending-1", "kitchen" ],
        name: "stove-state",
        state: "incomplete" } );
    addExits( "w", "e", "attic", "bathroom" );
    addExits( "w", "e", "living-room", "kitchen" );
    addExits( "u", "d",
        "attic",
        "living-room" );
    addExits( "u", "d",
        "bathroom",
        "kitchen" );
    defDescribeRoom( "you", function ( actor, visibility ) {
        var room = currentRoom( visibility.worldState, actor );
        
        return titleDsc( "You",
            "Today you're wearing a suede maroon slacks and jacket " +
            "combo over a white turtleneck. A sapphire necklace " +
            "tops it off." +
            (room !== null
                && (room.val === "living-room"
                    || room.val === "attic"
                    || room.val === "bathroom"
                    || room.val === "kitchen") ?
                " The camera crew follows behind you." :
                "") );
    } );
    defDescribeRoom( "beginning", function ( actor, visibility ) {
        return titleDsc( "((Beginning))",
            "Symple Home Renovations",
            "Rocketnia 2016",
            "Version 1",
            "It's time for another episode of Symple Home " +
            "Renovations, and [you you]'re the host. The two " +
            "residents of this home are already safely on the " +
            "front lawn, where some of the camera crew will stay " +
            "behind and record their reactions to the strange " +
            "noises, smells, and energies come out of the house " +
            "while you're in there.",
            "Your supplies under one arm, you're ready to begin." );
    } );
    defAffordRoom( "beginning", function ( actor, worldState ) {
        return [ { type: "misc-action",
            label: "open-the-front-door",
            description: "Open the front door.",
            playByPlayAffectedTopics:
                [ "living-room", "environmentalizer", "legs" ],
            playByPlayMe: dsc(
                "You open the front door, which the camera crew " +
                "closes behind you again. You set your " +
                "[environmentalizer environmentalizer] on the " +
                "table." ),
            playByPlayNotMe: dsc(
                "((Someone opens the front door, etc.))" ),
            newWorldState: moveRel( worldState, "you", "living-room" )
        } ];
    } );
    defDescribeRoom( "living-room", function ( actor, visibility ) {
        function countState( name ) {
            return getStateRel( visibility.worldState, name ) ===
                "complete" ?
                1 : 0;
        }
        
        var numLights =
            countState( "fan-state" ) +
            countState( "sink-state" ) +
            2 * countState( "stove-state" ) +
            countState( "stove-state" );
        
        return titleDsc( "Living room",
            "You're in [living-room the living room]. A stairway " +
            "leads up to the attic. Your [environmentalizer Symple " +
            "sympathetic environmentalizer] is " +
            (getStateRel( visibility.worldState,
                "environmentalizer-state" ) === "intact" ?
                "perched on the dining table." +
                (numLights === 1 ?
                    " You notice it has a flashing light." :
                    numLights === 2 ?
                        " You notice it has two flashing lights." :
                    numLights === 3 ?
                        " It has three flashing lights." :
                    numLights === 4 ?
                        " All four of its lights are actively " +
                        "flashing." :
                        "") :
                "rattling on the floor by the dining table, " +
                "flashing several lights.") );
    } );
    defDescribeRoom( "environmentalizer",
        function ( actor, visibility ) {
        
        if ( getStateRel( visibility.worldState,
                "environmentalizer-state" ) ===
            "fallen" )
            return titleDsc( "Environmentalizer",
                "The environmentalizer has fallen to the floor and " +
                "spun its dials out of whack. Along with the other " +
                "four meters, a fifth meter blinks: Love. An " +
                "element of nurture.",
                
                "Unlike the others, this meter blinks with a " +
                "whopping three bars. That's more of an earthquake " +
                "advisory warning, not what you want to see in a " +
                "TV production. The camera crew zooms in on it " +
                "anyway; it's good material." );
        
        function isComplete( name ) {
            return getStateRel( visibility.worldState, name ) ===
                "complete";
        }
        function countState( name ) {
            return isComplete( name ) ? 1 : 0;
        }
        
        
        var elementsIncomplete = [];
        var elementsComplete = [];
        function completeElement( stateName, elementText ) {
            (isComplete( stateName ) ?
                elementsComplete : elementsIncomplete
            ).push( elementText );
        }
        completeElement( "fan-state", "air" );
        completeElement( "sink-state", "water" );
        completeElement( "stove-state", "earth" );
        completeElement( "stove-state", "fire" );
        
        function displayList( list ) {
            if ( list.length === 0 )
                throw new Error();
            if ( list.length === 1 )
                return list[ 0 ];
            if ( list.length === 2 )
                return list.join( " and " );
            return list.slice( 0, list.length - 1 ).join( ", " ) +
                ", and " + list[ list.length - 1 ];
        }
        
        return titleDsc( "Environmentalizer",
            "Your Symple sympathetic environmentalizer rests on " +
            "the dining table, occasionally humming as it lets off " +
            "excess sympathetic energy from the miscellaneous " +
            "intentions it detects in [you you] and your camera " +
            "crew.",
            "Physically, it's a blocky console standing on [legs " +
            "two whittled bird legs], with dials and meters on its " +
            "surface. You've set the dials so meters 1 through 4 " +
            "display the icons of the four elements of nature. The " +
            "homeowners would like to renovate with elemental magic.",
            (elementsComplete.length === 0 ?
                "For now, all four meters are unlit, indicating a " +
                "lack of nearby elemental intentions to amplify." :
                elementsIncomplete.length === 0 ?
                    "All four meters are lit up and flashing, " +
                    "which means the renovations are complete." :
                    "The " +
                    (elementsComplete.length === 1 ?
                        "meter " : "meters ") +
                    "for " + displayList( elementsComplete ) + " " +
                    (elementsComplete.length === 1 ? "is " : "are ") +
                    "flashing brightly, but the renovations for " +
                    displayList( elementsIncomplete ) + " " +
                    "are still incomplete.") );
    } );
    defDescribeRoom( "legs", function ( actor, visibility ) {
        return titleDsc( "Bird legs",
            "[environmentalizer The environmentalizer]'s whittled " +
            "bird legs are Symple's trademark motif, but they also " +
            "serve a function: They catch and amplify wish " +
            "leylines like a tuning fork and synchronize them with " +
            "the ground leylines. Hence the term \"sympathetic.\"" );
    } );
    defAffordRoom( "living-room", function ( actor, worldState ) {
        function isComplete( name ) {
            return getStateRel( worldState, name ) === "complete";
        }
        
        var result = [];
        if ( isComplete( "fan-state" )
            && isComplete( "sink-state" )
            && isComplete( "stove-state" ) ) {
            
            var newWorldState = worldState;
            newWorldState =
                moveRel( newWorldState, "you", "ending-1" );
            newWorldState = putStateRel( newWorldState,
                [ "living-room", "ending-1" ],
                "environmentalizer-state",
                "fallen" );
            
            // Now you can *see* the living room (and its contents),
            // but the living room description doesn't actually show
            // in the "here" tab because it would interfere with the
            // action.
            newWorldState =
                moveRel( newWorldState, "living-room", "ending-1" );
            newWorldState =
                moveRel( newWorldState,
                    "environmentalizer", "ending-1" );
            newWorldState =
                moveRel( newWorldState, "legs", "ending-1" );
            
            result.push( { type: "misc-action",
                label: "open-the-front-door",
                description: "Open the front door.",
                playByPlayAffectedTopics:
                    [ "living-room", "environmentalizer" ],
                playByPlayMe: dsc(
                    "You open the front door, and the two eager " +
                    "residents rush in.",
                    
                    "You explain the function of the Symple " +
                    "sympathetic environmentalizer and show them " +
                    "around their like-new home, demontrating all " +
                    "the wonders it made possible with only a few " +
                    "simple actions.",
                    
                    "They love it. They love you. They love each " +
                    "other. They... oh. Oh, no. They're courting.",
                    
                    "The [environmentalizer environmentalizer] " +
                    "hums violently, throwing itself off the " +
                    "table. When it hits the floor, the dials spin " +
                    "out of place, and one of them lands on love. " +
                    "The love meter is blinking. It's blinking " +
                    "with three bars." ),
                playByPlayNotMe: dsc(
                    "((Someone opens the front door, etc.))" ),
                newWorldState: newWorldState
            } );
        } else {
            result.push( { type: "misc-action",
                label: "open-the-front-door",
                description: "Open the front door.",
                playByPlayAffectedTopics: [],
                playByPlayMe: dsc(
                    "You can open up the door again to invite the " +
                    "residents in, but not before you've finished " +
                    "the renovations." ),
                playByPlayNotMe: dsc(
                    "Someone thinks about opening the front door." ),
                newWorldState: worldState
            } );
        }
        return result;
    } );
    defDescribeRoom( "attic", function ( actor, visibility ) {
        return titleDsc( "Attic",
            "You're in [attic the attic]. A stairway leads down to " +
            "the living room. " +
            (getStateRel( visibility.worldState, "fan-state" ) ===
                "incomplete" ?
                "A standing fan sits abandoned and dusty in the " +
                "corner." :
                "Turbine-slatted holes in the ceiling provide " +
                "cushioning for wooly inflatable furniture. A " +
                "[lightning lightning channel] feeds right through " +
                "the middle of the room, sending ambient power " +
                "collected from the rooftop down into the rest of " +
                "the house.") );
    } );
    defDescribeRoom( "lightning", function ( actor, visibility ) {
        return titleDsc( "Lightning channel",
            "The lightning channel doesn't just supply electrical " +
            "power to the home. Its raw arcs also shape themselves " +
            "to display satellite illusion broadcasts. Right now, " +
            "it's playing a Symple infomercial. The infomercial is " +
            "honestly boring, but it's lucky. If your camera crew " +
            "picked up anything else, [you you]'d have to blur it " +
            "out in post." );
    } );
    defAffordRoom( "attic", function ( actor, worldState ) {
        var result = [];
        if ( getStateRel( worldState, "fan-state" ) === "incomplete" )
            result.push( { type: "misc-action",
                label: "plug-in-the-fan",
                description: "Plug in the fan.",
                playByPlayAffectedTopics: [ "attic", "lightning" ],
                playByPlayMe: dsc( "You plug in the fan." ),
                playByPlayNotMe: dsc( "Someone plugs in the fan." ),
                newWorldState:
                    putStateRel( worldState,
                        [ "living-room", "ending-1", "attic" ],
                        "fan-state",
                        "complete"
                    ).concat( [ {
                        type: "in-room",
                        element: "lightning",
                        container: "attic"
                    } ] )
            } );
        return result;
    } );
    defDescribeRoom( "bathroom", function ( actor, visibility ) {
        return titleDsc( "Bathroom",
            "You're in [bathroom the bathroom]. " +
            (getStateRel( visibility.worldState, "sink-state" ) ===
                "incomplete" ?
                "" :
                "Curtains of water pour down from the walls, " +
                "cascading into a wide whirlpool at the edges of " +
                "the room.") + " " +
            "Between the sink and the shower is a fire pole to the " +
            "floor below." );
    } );
    defAffordRoom( "bathroom", function ( actor, worldState ) {
        var result = [];
        if ( getStateRel( worldState, "sink-state" ) ===
            "incomplete" )
            result.push( { type: "misc-action",
                label: "turn-on-the-sink",
                description: "Turn on the sink.",
                playByPlayAffectedTopics: [ "bathroom" ],
                playByPlayMe: dsc( "You turn on the sink." ),
                playByPlayNotMe: dsc( "Someone turns on the sink." ),
                newWorldState:
                    putStateRel( worldState,
                        [ "living-room", "ending-1", "bathroom" ],
                        "sink-state",
                        "complete" )
            } );
        return result;
    } );
    defDescribeRoom( "kitchen", function ( actor, visibility ) {
        return titleDsc( "Kitchen",
            "You're in [kitchen the kitchen]. A fire pole leads up " +
            "to the room above. " +
            (getStateRel( visibility.worldState, "stove-state" ) ===
                "incomplete" ?
                "There's a stovetop here with some empty clay pots " +
                "on it. Ooh! Two elements at once." :
                "The pots ignite with Symple Friendly Fire, a " +
                "basic eternal flame that consumes only metal " +
                "kitchen supplies. Soon a colony of microgoblets " +
                "have arranged themselves in a smelting pattern, " +
                "melting and casting each other into various " +
                "shapes, each more fashionable and efficient than " +
                "the last. They proudly display an interactive " +
                "catalog of their latest designs.") );
    } );
    defAffordRoom( "kitchen", function ( actor, worldState ) {
        var result = [];
        if ( getStateRel( worldState, "stove-state" ) ===
            "incomplete" )
            result.push( { type: "misc-action",
                label: "light-the-stove",
                description: "Light the stove.",
                playByPlayAffectedTopics: [ "kitchen" ],
                playByPlayMe: dsc(
                    "You twist the knobs, and the stovetop burners " +
                    "light up." ),
                playByPlayNotMe: dsc(
                    "Someone twists the knobs, and the stovetop " +
                    "burners light up." ),
                newWorldState:
                    putStateRel( worldState,
                        [ "living-room", "ending-1", "kitchen" ],
                        "stove-state",
                        "complete" )
            } );
        return result;
    } );
    defDescribeRoom( "ending-1", function ( actor, visibility ) {
        return titleDsc( "((Ending 1))" );
    } );
    defAffordRoom( "ending-1", function ( actor, worldState ) {
        var playByPlay = dsc(
            "You all rush out to the front lawn. The lovebirds are " +
            "flustered and ashamed, but at least they don't make " +
            "any trouble about it.",
            
            "Up in the sky, a vortex of colors coalesces into a " +
            "dryadoid shape. \"Electricity and garbage! Natural " +
            "gas and water! Love! Your invoices combined, I am the " +
            "utility functionary!\"",
            
            "You shout back, as though the hovering figure were " +
            "drowning out your words like a helicopter. \"This " +
            "house is off the grid now! What do you mean, " +
            "utilities?\"",
            
            "The figure gives off a confident smile and explains, " +
            "\"Those who can meet their own needs have an " +
            "obligation to provide for others. Say, have you " +
            "registered these inventions so the public can " +
            "benefit? Are they independently certified to be free " +
            "of harmful effects on the environment?\"" );
        
        return [ { type: "misc-action",
            label: "out-everybody-out",
            description: "Out! Everybody out!",
            playByPlayAffectedTopics: [],
            playByPlayMe: playByPlay,
            playByPlayNotMe: playByPlay,
            newWorldState:
                moveRel( worldState, "you", "ending-2" )
        } ];
    } );
    defDescribeRoom( "ending-2", function ( actor, visibility ) {
        return titleDsc( "((Ending 2))" );
    } );
    defAffordRoom( "ending-2", function ( actor, worldState ) {
        var playByPlay = dsc(
            "\"There's only one way to deal with a Popular Culture " +
            "subscriber,\" you say. \"To the van!\"",
            
            "You all pile into the crew's van, the home residents " +
            "sheepishly hanging onto the video equipment.",
            
            "You pull on your seat belt. As it comes out, other " +
            "belts emerge from recesses in the van, securing " +
            "everyone and everything.",
            
            "You rev the engine, and the van's own chicken legs " +
            "spring out and find their balance. You shove the van " +
            "into gear and slam on the gas." );
        
        return [ { type: "misc-action",
            label: "to-the-van",
            description: "To the van!",
            playByPlayAffectedTopics: [],
            playByPlayMe: playByPlay,
            playByPlayNotMe: playByPlay,
            newWorldState:
                moveRel( worldState, "you", "ending-3" )
        } ];
    } );
    defDescribeRoom( "ending-3", function ( actor, visibility ) {
        return titleDsc( "((Ending 3))" );
    } );
    defAffordRoom( "ending-3", function ( actor, worldState ) {
        var playByPlay = dsc(
            "The homeowners go white as the van launches itself " +
            "through their front door, finally riding up on the " +
            "dining table and snapping it into splinters. You " +
            "reach out and pick up the environmentalizer as the " +
            "house warps around you.",
            
            "The living room walls develop hand rails and cup " +
            "holders, and the floor rises to merge with the van's " +
            "floor. Lightning surges into the video equipment, and " +
            "the microgoblets take hold of the engine.",
            
            "Outside, a jingle plays, and a small voice announces " +
            "itself. \"Life, auto, or even home. With State " +
            "insurance, you're not alone!\"",
            
            "You pull the house around and watch as a besuited dog " +
            "flies up to shake hands with the utility functionary. " +
            "\"Would you like to exchange information?\"",
            
            "\"What information could the State possibly have to " +
            "offer that isn't...\" but the functionary trails off." );
        
        return [ { type: "misc-action",
            label: "forward",
            description: "Forward...",
            playByPlayAffectedTopics: [],
            playByPlayMe: playByPlay,
            playByPlayNotMe: playByPlay,
            newWorldState:
                moveRel( worldState, "you", "ending-4" )
        } ];
    } );
    defDescribeRoom( "ending-4", function ( actor, visibility ) {
        return titleDsc( "((Ending 4))" );
    } );
    defAffordRoom( "ending-4", function ( actor, worldState ) {
        var playByPlay = dsc(
            "You've been fiddling with the controls on the " +
            "environmentalizer. Now the first five dials all point " +
            "to love, and the rattling has finally stopped. Seeing " +
            "all those heart symbols on the console, you start to " +
            "believe you could return the feeling. The homeowners " +
            "have incorporated themselves into the video equipment " +
            "to have some thrilling adventures, which you're " +
            "certainly going to have to blur out.",
            
            "\"What I mean to say is,\" the functionary begins, " +
            "\"uh, what chat services do you use?\"",
            
            "The dog laughs. \"Ah, I chat on basically everything, " +
            "but usually I'm done within fifteen minutes.",
            
            "\"You know, I can be... pretty sustainable.\"",
            
            "\"I bet you can! In fact, I have the odds right " +
            "here.\" The dog pulls out an actuarial table.",
            
            "That should be enough. You set out onto the road, " +
            "headed for an RV lot where you can lay low until the " +
            "apparitions have to make other appearances. You'll " +
            "to have a long talk with the homeowners about whether " +
            "they get to keep your van." );
        
        return [ { type: "misc-action",
            label: "check-on-the-environmentalizer",
            description: "Check on the environmentalizer.",
            playByPlayAffectedTopics: [],
            playByPlayMe: playByPlay,
            playByPlayNotMe: playByPlay,
            newWorldState:
                moveRel( worldState, "you", "ending-5" )
        } ];
    } );
    defDescribeRoom( "ending-5", function ( actor, visibility ) {
        return titleDsc( "((Ending 5))",
            "*** End ***" );
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
        var isMe = actor === visibility.actor;
        if ( action.type === "exit" ) {
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
                    arriving: false,
                    chronicle: dsc( directionPlayByPlays.go ) }
            ];
            if ( isMe ) {
                result.push( { type: "chroniclesHere", pov: actor,
                    chronicle: dsc( directionPlayByPlays.go ) } );
                arrEach( before.topics, function ( topic ) {
                    if ( arrHasJson( after.topics, topic ) )
                        return;
                    result.push( { type: "chronicles", pov: actor,
                        topic: topic,
                        arriving: false,
                        chronicle: dsc(
                            directionPlayByPlays.leave
                        ) } );
                } );
                arrEach( after.topics, function ( topic ) {
                    if ( arrHasJson( before.topics, topic ) )
                        return;
                    result.push( { type: "chronicles", pov: actor,
                        topic: topic,
                        arriving: true,
                        chronicle: dsc(
                            directionPlayByPlays.arrive
                        ) } );
                } );
            } else {
                result.push( { type: "chronicles", pov: actor,
                    topic: action.from,
                    arriving: false,
                    chronicle: dsc( directionPlayByPlays.leave ) } );
                result.push( { type: "chronicles", pov: actor,
                    topic: action.to,
                    arriving: false,
                    chronicle: dsc( directionPlayByPlays.arrive ) } );
            }
            return result;
        } else if ( action.type === "misc-action" ) {
            var playByPlay =
                isMe ? action.playByPlayMe : action.playByPlayNotMe;
            var result = [
                { type: "chronicles", pov: actor,
                    topic: visibility.actor,
                    arriving: false,
                    chronicle: playByPlay }
            ];
            if ( isMe )
                result.push( { type: "chroniclesHere", pov: actor,
                    chronicle: playByPlay } );
            arrEach( action.playByPlayAffectedTopics,
                function ( topic ) {
                
                result.push( { type: "chronicles", pov: actor,
                    topic: topic,
                    arriving: false,
                    chronicle: playByPlay } );
            } );
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
