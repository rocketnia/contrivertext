module ContriverText.Tests

import ContriverText

runTests : IO ()
runTests = putStrLn ("Hello tests " ++ show (myInc 40001))

testMain : IO ()
testMain = do
  putStrLn "Running the tests"
  runTests

appMain : IO ()
appMain = do
  putStrLn "Running the main app (which runs the tests)"
  runTests
