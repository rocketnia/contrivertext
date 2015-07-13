module ContriverText.Tests

import Data.SortedSet
import Effects
import Effect.System

import ContriverText
import ContriverText.JsUtil

quoteListOfStrings : List String -> TT
quoteListOfStrings [] = `([] : List String)
quoteListOfStrings (x :: xs) =
  `((~(TConst (Str x)) :: ~(quoteListOfStrings xs)) : List String)

bindingToStrings : (TTName, Binder TT) -> List String
bindingToStrings (UN v, t) = [v]
bindingToStrings _ = []

-- The failure message is based on idris-dev's
-- test/quasiquote004/Quasiquote004.idr

currentLocalVars : List (TTName, Binder TT) -> TT -> Tactic
currentLocalVars ctxt `(List String) =
  Exact (quoteListOfStrings (ctxt >>= bindingToStrings))
currentLocalVars _ _ = Fail [TextPart "Not a List String goal"]

someLocalVars : List String
someLocalVars = proof
  let myVariable : String = "foo"
  let myOtherVariable : String = "bar"
  applyTactic currentLocalVars

runTests : {auto f : FFI} -> IO' f ()
runTests = do
  putStrLn ("Hello tests " ++ show (myInc 4000))
  putStrLn
    ("Number of facts in the initial story state " ++
       show (length (Data.SortedSet.toList initialStoryState)))
  putStrLn (show someLocalVars)
  -- NOTE: This will only work in a non-JS build.
--  putStrLn (show !(run time))

-- NOTE: Some of these tests are very memory-intensive to compile, so
-- we actually can't uncomment the tests all at once (on my machine).
--
-- TODO: See if this will cause problems for actual application
-- development.
--
runJsTests : JS_IO ()
runJsTests = do
  jsf0 """
    console.log( "hello" )
  """
  let foo = jsft (Int -> Int -> JS_IO ()) """
    console.log( "heya " + (%0 + %1) )
  """
  foo 5 6
  foo2 <- jsf0 """function (a, b) {
    console.log( "heya2 " + (a + b) )
  }"""
  jsft (Ptr -> Int -> Int -> JS_IO ()) """
    %0( %1, %2 )
  """ foo2 5 6
  jsc2 foo2 !(jsint 5) !(jsint 10)
{-
  jsm1 !(jsf0 "console") "log"
    !(jsm1 !(jsf0 "JSON") "stringify"
        !(jso2_i
            "foo" !(jsint 1)
            "bar" !(jsint 2)))
-}
{-
  jsft (JsFn (Int -> Int) -> JS_IO ()) """
    console.log(%0(4))
  """ (MkJsFn (\a => unsafePerformIO (do
    jsf0 """
      console.log( "inside 1" )
    """
    return (a + 1))))
-}
{-
  jsm1 !(jsf0 "console") "log"
    !(jsc0 !(jsfn0 (do
      jsf0 """
        console.log( "inside 2" )
      """
      jsptr "outside 2"
    )))
-}
{-
  jsm1 !(jsf0 "console") "log"
    !(jsc1 !(jsfn1 (\s0 => do
      jsf1 """
        console.log( "inside 3 " + %0 )
      """ s0
      jsptr "outside 3"
    )) !(jsptr "world"))
-}
  jsm1 !(jsf0 "console") "log"
    !(jsc2 !(jsfn2_f (\s0, s1 => do
      jsf2 """
        console.log( "inside 4 " + %0 + " " + %1 )
      """ s0 s1
      jsptr "outside 4"
    )) !(jsptr "world") !(jsptr "tour"))
  return ()

testMain : {auto f : FFI} -> IO' f ()
testMain = do
  putStrLn "Running the tests"
  runTests

appMain : {auto f : FFI} -> IO' f ()
appMain = do
  putStrLn "Running the main app (which runs the tests)"
  runTests
