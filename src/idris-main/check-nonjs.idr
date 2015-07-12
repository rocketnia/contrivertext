module Main

import ContriverText.Tests

main : IO ()
main = testMain {f=FFI_C}
