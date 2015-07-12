module Main

import ContriverText.Tests

main : IO ()
main = appMain {f=FFI_C}
