module ContriverText.Util

import Data.SortedMap

dic0 : Ord k => SortedMap k v
dic0 = fromList []

dic1 : Ord k => k -> v -> SortedMap k v
dic1 k0 v0 = fromList [(k0, v0)]

dic2 : Ord k => k -> v -> k -> v -> SortedMap k v
dic2 k0 v0 k1 v1 = fromList [(k0, v0), (k1, v1)]

dic3 : Ord k => k -> v -> k -> v -> k -> v -> SortedMap k v
dic3 k0 v0 k1 v1 k2 v2 = fromList [(k0, v0), (k1, v1), (k2, v2)]

dic4 : Ord k => k -> v -> k -> v -> k -> v -> k -> v -> SortedMap k v
dic4 k0 v0 k1 v1 k2 v2 k3 v3 =
  fromList [(k0, v0), (k1, v1), (k2, v2), (k3, v3)]
