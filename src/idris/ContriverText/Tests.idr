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
  jsm1 !(jsf0 "console") "log"
    !(jsm1 !(jsf0 "JSON") "stringify"
        !(jso2_p
            "foo" !(jsint 1)
            "bar" !(jsint 2)))
  return ()

testMain : {auto f : FFI} -> IO' f ()
testMain = do
  putStrLn "Running the tests"
  runTests

appMain : {auto f : FFI} -> IO' f ()
appMain = do
  putStrLn "Running the main app (which runs the tests)"
  runTests
