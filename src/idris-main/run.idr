module Main

import ContriverText.Tests

main : JS_IO ()
main = do
  appMain {f=FFI_JS}
  runJsTests
