module Main

import ContriverText.Tests

main : JS_IO ()
main = do
  testMain {f=FFI_JS}
  runJsTests
