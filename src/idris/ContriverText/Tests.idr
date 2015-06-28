module ContriverText.Tests

import Effects
import Effect.System

import ContriverText

runTests : IO ()
runTests = do
  putStrLn ("Hello tests " ++ show (myInc 4000))
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
