module ContriverText

import Data.SortedSet

orOrd : Ordering -> Ordering -> Ordering
orOrd EQ o2 = o2
orOrd o1 _ = o1

-- TODO
data Fact = MkFact String

instance Eq Fact where
  (==) (MkFact s1) (MkFact s2) = (==) s1 s2

instance Ord Fact where
  compare (MkFact s1) (MkFact s2) = compare s1 s2

data StartTime = MkStartTime Nat

instance Eq StartTime where
  (==) (MkStartTime n1) (MkStartTime n2) = (==) n1 n2

instance Ord StartTime where
  compare (MkStartTime n1) (MkStartTime n2) = compare n1 n2

data EndTime = KnownEndTime Nat | AssumeAfter Nat Bool

instance Eq EndTime where
  (==) (KnownEndTime n1) (KnownEndTime n2) = (==) n1 n2
  (==) (AssumeAfter n1 b1) (AssumeAfter n2 b2) =
    (==) n1 n2 &&
    (==) b1 b2
  (==) _ _ = False

instance Ord EndTime where
  compare (KnownEndTime n1) (KnownEndTime n2) = compare n1 n2
  compare (AssumeAfter n1 b1) (AssumeAfter n2 b2) =
    compare n1 n2 `orOrd`
    compare b1 b2
  compare (KnownEndTime n1) _ = LT
  compare _ _ = GT

data TemporalFact = MkTemporalFact StartTime EndTime Fact

instance Eq TemporalFact where
  (==) (MkTemporalFact s1 e1 f1) (MkTemporalFact s2 e2 f2) =
    (==) s1 s2 &&
    (==) e1 e2 &&
    (==) f1 f2

instance Ord TemporalFact where
  compare (MkTemporalFact s1 e1 f1) (MkTemporalFact s2 e2 f2) =
    foldl orOrd EQ [
      compare s1 s2,
      compare e1 e2,
      compare f1 f2
    ]

StoryState : Type
StoryState = SortedSet TemporalFact

initialStoryState : StoryState
initialStoryState = fromList [
  MkTemporalFact (MkStartTime 0) (AssumeAfter 10 True) (MkFact "abc"),
  MkTemporalFact (MkStartTime 0) (AssumeAfter 10 True) (MkFact "def")
]


||| Converts a number to the same number plus one
myInc : Nat -> Nat
myInc x = x + 1
