===============================================================================
HIDE + SEEK  --  FOLDER GUIDE (read me first)
===============================================================================

This folder is the design project for a hide-and-seek game the CIA club (Club
d'IA, Universite Laval) wants to run as an autumn integration activity, inspired
by Jet Lag: The Game's Hide + Seek. Two bodies of work live here and MUST NOT be
confused -- hence this guide.


-------------------------------------------------------------------------------
LAYOUT
-------------------------------------------------------------------------------
  prompt.txt          The original brief (voice-memo transcription) -- the
                      source of truth for the game we actually want.

  original-game/      REFERENCE ONLY. An exhaustive teardown of the REAL Jet Lag
                      Home Game -- how it works, every question, every card, and
                      how the show teaches it fast:
                        rules.txt, questions.txt, cards.txt,
                        progressive-disclosure.txt
                      NOTE: these files also contain an earlier, LITERAL port to
                      Quebec City on the RTC bus network (rules.txt section 13 +
                      localization notes). That city/transit port is SUPERSEDED
                      by ulaval-version/ below. Keep it as reference; do not
                      build from it.

  ulaval-version/     OUR game. Bare-bones, one campus, on foot, questions only,
                      paced by a website. This is what we are actually building.
                        concept.txt -- the current target design.
                        rules.md -- the official rules (Oct 3): the eight
                          the app shows, their fine print, the organizers'
                          rulings, and why each rule exists.

  brainstorming/      Raw idea seeds (ideas.txt) + Google Maps screenshots that
                      prove the "answerable with only Maps" primitives work.

-------------------------------------------------------------------------------
ORIGINAL  vs.  U. LAVAL  (the short version)
-------------------------------------------------------------------------------
  +-----------------+----------------------------+---------------------------+
  | Aspect          | Original Jet Lag           | U. Laval version          |
  +-----------------+----------------------------+---------------------------+
  | Scale / travel  | City/region, by transit    | One campus, on foot       |
  | Hider           | Head start, then a zone    | Freezes at once; the      |
  |                 |                            | game is all "endgame"     |
  | Cards / curses  | Full Hider Deck            | Cut entirely              |
  | Cost of asking  | Arms the hider (cards)     | None -- a website times   |
  |                 |                            | and paces the questions   |
  | Question menu   | 62-80, size-gated          | ~10-15, one constant pool |
  | Length          | 4 hours to 4 days          | ~15-30 minutes            |
  | Scoring         | Longest single hide        | Same (rotate, then        |
  |                 |                            | longest hide wins)        |
  +-----------------+----------------------------+---------------------------+

  Mental model: original-game/ is the PARTS BIN; ulaval-version/ is the build.


-------------------------------------------------------------------------------
STATUS (2026-08-21)
-------------------------------------------------------------------------------
  Concept agreed (ulaval-version/concept.txt). NEXT: design the QUESTION POOL --
  the ~10-15 questions strong enough to carry the whole game (prompt.txt steps
  1-2). Everything after that is playtest tuning.
===============================================================================
