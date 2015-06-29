module ContriverText.Tests

import Effects
import Effect.System
import Language.Reflection

import ContriverText


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

runTests : IO ()
runTests = do
  putStrLn ("Hello tests " ++ show (myInc 4000))
  putStrLn (show someLocalVars)
  -- NOTE: This will only work in a non-JS build.
--  putStrLn (show !(run time))

testMain : IO ()
testMain = do
  putStrLn "Running the tests"
  runTests

appMain : IO ()
appMain = do
  putStrLn "Running the main app (which runs the tests)"
  runTests
