module ContriverText.JsUtil

import Data.SortedMap
import Language.Reflection

import ContriverText.Util

-- This is based on jscall from
-- <http://docs.idris-lang.org/en/latest/reference/ffi.html>.
%inline
jsft : (t : Type) -> String -> {auto foreignType : FTy FFI_JS [] t} -> t
jsft t code = foreign FFI_JS code t

class HasJsPtr a where
  jsptr : a -> JS_IO Ptr

instance HasJsPtr Ptr where
  jsptr x = return x

instance HasJsPtr String where
  jsptr = jsft _ "%0"

instance HasJsPtr Int where
  jsptr = jsft _ "%0"

instance HasJsPtr Char where
  jsptr = jsft _ "%0"

instance HasJsPtr () where
  jsptr = jsft _ "%0"

instance HasJsPtr Float where
  jsptr = jsft _ "%0"

%inline
jsf0 : String -> JS_IO Ptr
jsf0 code = jsft _ code

%inline
jsf1 : String -> Ptr -> JS_IO Ptr
jsf1 code = jsft _ code

%inline
jsf2 : String -> Ptr -> Ptr -> JS_IO Ptr
jsf2 code = jsft _ code

%inline
jsf3 : String -> Ptr -> Ptr -> Ptr -> JS_IO Ptr
jsf3 code = jsft _ code

%inline
jsf4 : String -> Ptr -> Ptr -> Ptr -> Ptr -> JS_IO Ptr
jsf4 code = jsft _ code

%inline
jsf5 : String -> Ptr -> Ptr -> Ptr -> Ptr -> Ptr -> JS_IO Ptr
jsf5 code = jsft _ code

jsc0 : Ptr -> JS_IO Ptr
jsc0 = jsf1 """
  %0()
"""

jsc1 : Ptr -> Ptr -> JS_IO Ptr
jsc1 = jsf2 """
  %0( %1 )
"""

jsc2 : Ptr -> Ptr -> Ptr -> JS_IO Ptr
jsc2 = jsf3 """
  %0( %1, %2 )
"""

jsc3 : Ptr -> Ptr -> Ptr -> Ptr -> JS_IO Ptr
jsc3 = jsf4 """
  %0( %1, %2, %3 )
"""

jsc4 : Ptr -> Ptr -> Ptr -> Ptr -> Ptr -> JS_IO Ptr
jsc4 = jsf5 """
  %0( %1, %2, %3, %4 )
"""

jsn0 : Ptr -> JS_IO Ptr
jsn0 = jsf1 """
  new %0()
"""

jsn1 : Ptr -> Ptr -> JS_IO Ptr
jsn1 = jsf2 """
  new %0( %1 )
"""

jsn2 : Ptr -> Ptr -> Ptr -> JS_IO Ptr
jsn2 = jsf3 """
  new %0( %1, %2 )
"""

jsn3 : Ptr -> Ptr -> Ptr -> Ptr -> JS_IO Ptr
jsn3 = jsf4 """
  new %0( %1, %2, %3 )
"""

jsm0 : HasJsPtr a => Ptr -> a -> JS_IO Ptr
jsm0 obj meth = jsf2 """
  %0[ %1 ]()
""" obj !(jsptr meth)

jsm1 : HasJsPtr a => Ptr -> a -> Ptr -> JS_IO Ptr
jsm1 obj meth a0 = jsf3 """
  %0[ %1 ]( %2 )
""" obj !(jsptr meth) a0

jsm2 : HasJsPtr a => Ptr -> a -> Ptr -> Ptr -> JS_IO Ptr
jsm2 obj meth a0 a1 = jsf4 """
  %0[ %1 ]( %2, %3 )
""" obj !(jsptr meth) a0 a1

jsm3 : HasJsPtr a => Ptr -> a -> Ptr -> Ptr -> Ptr -> JS_IO Ptr
jsm3 obj meth a0 a1 a2 = jsf5 """
  %0[ %1 ]( %2, %3, %4 )
""" obj !(jsptr meth) a0 a1 a2

jsa0 : JS_IO Ptr
jsa0 = jsf0 """
  []
"""

jsa1 : Ptr -> JS_IO Ptr
jsa1 = jsf1 """
  [ %0 ]
"""

jsa2 : Ptr -> Ptr -> JS_IO Ptr
jsa2 = jsf2 """
  [ %0, %1 ]
"""

jsa3 : Ptr -> Ptr -> Ptr -> JS_IO Ptr
jsa3 = jsf3 """
  [ %0, %1, %2 ]
"""

-- The g is for "get."
jsg : HasJsPtr a => Ptr -> a -> JS_IO Ptr
jsg obj prop = jsf2 """
  (0, %0[ %1 ])
""" obj !(jsptr prop)

-- The p is for "put."
jsp : HasJsPtr a => Ptr -> a -> Ptr -> JS_IO ()
jsp obj prop val = jsft (Ptr -> Ptr -> Ptr -> JS_IO ()) """
  %0[ %1 ] = %2
""" obj !(jsptr prop) val

jso0 : JS_IO Ptr
jso0 = jsf0 """
  ({})
"""

jsint : Int -> JS_IO Ptr
jsint = jsptr


-- The e is for "eval."
-- The _f is for "sensitive to (f)ree variable clobbering."
jse0_f : String -> JS_IO Ptr
jse0_f code = jsc0 !(jsc1 !(jsf0 "Function") !(jsptr code))

jse1_f : String -> Ptr -> String -> JS_IO Ptr
jse1_f k0 v0 code =
  jsc1 !(jsc2 !(jsf0 "Function") !(jsptr k0) !(jsptr code)) v0

jse2_f : String -> Ptr -> String -> Ptr -> String -> JS_IO Ptr
jse2_f k0 v0 k1 v1 code =
  jsc2
    !(jsc3 !(jsf0 "Function") !(jsptr k0) !(jsptr k1) !(jsptr code))
    v0 v1

jse3_f :
  String -> Ptr ->
  String -> Ptr ->
  String -> Ptr ->
  String -> JS_IO Ptr
jse3_f k0 v0 k1 v1 k2 v2 code =
  jsc3
    !(jsc4 !(jsf0 "Function")
        !(jsptr k0) !(jsptr k1) !(jsptr k2) !(jsptr code))
    v0 v1 v2

-- The a is for "Array."
-- The _i is for "sensitive to (i)nitial value clobbering."
jsa_i : List Ptr -> JS_IO Ptr
jsa_i elements = do
  result <- jsa0
  for_ elements $ \element =>
    jsm1 result "push" element
  return result

-- The o is for "object."
-- The _i is for "sensitive to (i)nitial value clobbering."
jso_i : SortedMap String Ptr -> JS_IO Ptr
jso_i elements = do
  result <- jso0
  for_ {b=()} (Data.SortedMap.toList elements) $ \(k, v) => do
    jsp result k v
  return result

jso1_i : String -> Ptr -> JS_IO Ptr
jso1_i k0 v0 = jso_i (dic1 k0 v0)

jso2_i : String -> Ptr -> String -> Ptr -> JS_IO Ptr
jso2_i k0 v0 k1 v1 = jso_i (dic2 k0 v0 k1 v1)

jso3_i : String -> Ptr -> String -> Ptr -> String -> Ptr -> JS_IO Ptr
jso3_i k0 v0 k1 v1 k2 v2 = jso_i (dic3 k0 v0 k1 v1 k2 v2)

jsfn0 : JS_IO Ptr -> JS_IO Ptr
jsfn0 f = jsft (JsFn (() -> Ptr) -> JS_IO Ptr) """
  %0
""" (MkJsFn (\() => unsafePerformIO f))

jsfn1 : (Ptr -> JS_IO Ptr) -> JS_IO Ptr
jsfn1 f = jsft (JsFn (Ptr -> Ptr) -> JS_IO Ptr) """
  %0
""" (MkJsFn (\a0 => unsafePerformIO (f a0)))

-- NOTE: Surprisingly, this definition of jsfn2 receives both
-- arguments and sucessfully performs its side effects, but it doesn't
-- succeed at returning its result.
{-
jsfn2 : (Ptr -> Ptr -> JS_IO Ptr) -> JS_IO Ptr
jsfn2 f = jsft (JsFn (Ptr -> Ptr -> Ptr) -> JS_IO Ptr) """
  %0
""" (MkJsFn (\a0, a1 => unsafePerformIO (f a0 a1)))
-}

jsfn2_f : (Ptr -> Ptr -> JS_IO Ptr) -> JS_IO Ptr
jsfn2_f f = jse1_f
  "f" !(jsfn1 $ \args =>
          f !(jsg args !(jsint 0)) !(jsg args !(jsint 1)))
  """
    return function ( var_args ) {
        return f( arguments );
    };
  """

jsfn3_f : (Ptr -> Ptr -> Ptr -> JS_IO Ptr) -> JS_IO Ptr
jsfn3_f f = jse1_f
  "f" !(jsfn1 $ \args =>
          f !(jsg args !(jsint 0))
            !(jsg args !(jsint 1))
            !(jsg args !(jsint 2)))
  """
    return function ( var_args ) {
        return f( arguments );
    };
  """

