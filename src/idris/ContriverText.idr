module ContriverText

import Data.SortedSet

orOrd : Ordering -> Ordering -> Ordering
orOrd EQ o2 = o2
orOrd o1 _ = o1

data MyMaybe a = MyNothing | MyJust a

instance Eq a => Eq (MyMaybe a) where
  (==) MyNothing MyNothing = True
  (==) (MyJust v1) (MyJust v2) = (==) v1 v2
  (==) _ _ = False

instance Ord a => Ord (MyMaybe a) where
  compare MyNothing MyNothing = EQ
  compare MyNothing _ = LT
  compare (MyJust v1) (MyJust v2) = compare v1 v2
  compare _ _ = GT

StoryElemId : Type
StoryElemId = String

data Link = LinkTopic StoryElemId

instance Eq Link where
  (==) (LinkTopic s1) (LinkTopic s2) = (==) s1 s2

instance Ord Link where
  compare (LinkTopic s1) (LinkTopic s2) = compare s1 s2

data TextSpan = MkTextSpan String

instance Eq TextSpan where
  (==) (MkTextSpan s1) (MkTextSpan s2) = (==) s1 s2

instance Ord TextSpan where
  compare (MkTextSpan s1) (MkTextSpan s2) = compare s1 s2

data HtextSpan = MkHtextSpan (MyMaybe Link) TextSpan

instance Eq HtextSpan where
  (==) (MkHtextSpan h1 t1) (MkHtextSpan h2 t2) =
    (==) h1 h2 &&
    (==) t1 t2

instance Ord HtextSpan where
  compare (MkHtextSpan h1 t1) (MkHtextSpan h2 t2) =
    compare h1 h2 `orOrd`
    compare t1 t2

data HtextBlock = MkHtextBlock (List HtextSpan)

instance Eq HtextBlock where
  (==) (MkHtextBlock b1) (MkHtextBlock b2) = (==) b1 b2

instance Ord HtextBlock where
  compare (MkHtextBlock b1) (MkHtextBlock b2) = compare b1 b2

-- NOTE: This alternative definition doesn't pan out because the Idris
-- compiler takes way too long to infer the type class instance for
-- (Ord (List (List (MyMaybe Link, TextSpan)))).
--data HtextBlocks = MkHtextBlocks (List (List (MyMaybe Link, TextSpan)))

data HtextBlocks = MkHtextBlocks (List HtextBlock)

instance Eq HtextBlocks where
  (==) (MkHtextBlocks b1) (MkHtextBlocks b2) = (==) b1 b2

instance Ord HtextBlocks where
  compare (MkHtextBlocks b1) (MkHtextBlocks b2) = compare b1 b2

-- TODO: Continue adding more kinds of facts as we need them.
data Fact = ExistsPov StoryElemId
  | ExistsTopic StoryElemId
  | PovWouldDescribe StoryElemId StoryElemId HtextBlocks

instance Eq Fact where
  (==) (ExistsPov p1) (ExistsPov p2) = (==) p1 p2
  (==) (ExistsTopic t1) (ExistsTopic t2) = (==) t1 t2
  (==) (PovWouldDescribe p1 t1 h1) (PovWouldDescribe p2 t2 h2) =
    (==) p1 p2 &&
    (==) t1 t2 &&
    (==) h1 h2
  (==) _ _ = False

instance Ord Fact where
  compare (ExistsPov p1) (ExistsPov p2) = compare p1 p2
  compare (ExistsPov _) _ = LT
  compare (ExistsTopic t1) (ExistsTopic t2) = compare t1 t2
  compare (ExistsTopic _) _ = LT
  compare (PovWouldDescribe p1 t1 h1)
    (PovWouldDescribe p2 t2 h2) =
    foldl orOrd EQ [
      compare p1 p2,
      compare t1 t2,
      compare h1 h2
    ]
  compare _ _ = GT

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
  compare (KnownEndTime _) _ = LT
  compare (AssumeAfter n1 b1) (AssumeAfter n2 b2) =
    compare n1 n2 `orOrd`
    compare b1 b2
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

-- TODO: This EndTime is extremely arbitrary. Once we figure out how
-- we're going to update the game state, we should update this however
-- needed in order for it to persist throughout the game. Maybe this
-- should just have an end time of infinity.
alwaysTrue : Fact -> TemporalFact
alwaysTrue fact =
  MkTemporalFact (MkStartTime 0) (AssumeAfter 10 True) fact

describe : String -> String -> List (List HtextSpan) -> Fact
describe who what how =
  PovWouldDescribe who what (MkHtextBlocks (map MkHtextBlock how))

noLink : String -> HtextSpan
noLink text = MkHtextSpan MyNothing (MkTextSpan text)

initialStoryState : StoryState
initialStoryState = fromList (map alwaysTrue [
  ExistsPov "you",
  ExistsTopic "here",
  describe "you" "here" [[noLink "You are here."]]
])


||| Converts a number to the same number plus one
myInc : Nat -> Nat
myInc x = x + 1
