===============================================================================
U. LAVAL HIDE + SEEK  --  THE BARE-BONES CAMPUS VERSION (CONCEPT / v0)
===============================================================================

Status: target design, agreed in the 2026-08-21 brainstorm. The QUESTION POOL
(the part that does all the work) is the next task -- see "still open" at the end.
Reader assumption: you know the original Jet Lag Home Game inside out. If not,
see ../original-game/. This doc only describes how OURS differs, and why.


-------------------------------------------------------------------------------
ONE LINE
-------------------------------------------------------------------------------
A ~15-30 minute hide-and-seek game on the Universite Laval campus, on foot, with
NO cards / curses / coins -- just a hider who freezes, seekers who ask a few
POWERFUL questions, and a website that runs the clock and paces the questions.


-------------------------------------------------------------------------------
WHAT WE KEEP FROM THE ORIGINAL
-------------------------------------------------------------------------------
  - The fantasy: one side hides, the other finds them by asking questions from a
    fixed menu; the hider must answer TRUTHFULLY.
  - The six "tools" as inspiration for question types (matching / measuring /
    thermometer / radar / photo / "which of these are you nearest").
  - Progressive-disclosure teaching (../original-game/progressive-disclosure.txt):
    a one-sentence goal, a tiny frame, learn-by-one-turn. No rulebook read aloud.
  - Scoring: everyone hides; the single LONGEST hide wins.


-------------------------------------------------------------------------------
WHAT WE CUT OR CHANGE (the deltas)
-------------------------------------------------------------------------------
1. SCALE. One campus, on FOOT. No transit. Bus stops / AVelo stations / parkings
   survive only as MAP REFERENTS for questions, never as a way to travel.

2. THE HIDER FREEZES. They pick a spot and do not move. The whole game is
   effectively the original's ENDGAME -- we start where Jet Lag ends.

3. NO ECONOMY. No Hider Deck, no cards, no curses, no coins, no hand, no time
   bonuses. Deleted entirely. (../original-game/cards.txt is reference only.)

4. QUESTIONS ONLY, FEW AND POWERFUL. Every question must CUT A LOT. Answered
   truthfully using one of three "tools" and nothing else:
       - Google Maps   ("which pavillon are you nearest?", "within 300 m of us?")
       - the camera     ("send a photo of the tallest thing you can see")
       - just knowing   ("what floor are you on?", "nearest classroom number?")

5. THE WEBSITE IS THE GAME MASTER, AND THE ONLY THROTTLE. It:
       - runs the hide clock;
       - deals a fresh DRAW OF 3 QUESTIONS at timed intervals (starting point to
         playtest: every 5 min for the first 3 draws, then every 10 min); the
         seekers PICK ONE;
       - composes the outgoing text (the chosen question + the seekers' shared
         location) so the seeker just pastes it into a message, and the hider
         pastes it straight into Google Maps;
       - at the catch, reports the FINAL TIME + a RECAP of the questions asked.
   The timed draw is what stops seekers from standing still and spamming, and
   forces them to spend each interval physically searching.

6. NO QUESTION "EVOLUTION" / UNLOCK-BY-PROGRESS. One CONSTANT pool. Precise
   questions SELF-GATE -- "what floor?" is useless before you know the pavillon,
   so a good seeker won't waste a pick on it early (and a weak one will). Each
   draw is 3 at random with light VARIETY curation only: no near-duplicates in a
   single draw, and never re-deal a question already asked.


-------------------------------------------------------------------------------
WHERE THE SKILL LIVES
-------------------------------------------------------------------------------
  SEEKERS: choosing the RIGHT question out of the 3 on offer, given what they
  already know. That single choice is the whole seeker game.

  HIDER: the SPOT. A good spot keeps answers AMBIGUOUS -- on the seam between two
  pavilions (so "nearest pavillon?" is a coin-flip), somewhere that reads as
  neither clearly inside nor outside (a covered walkway, an atrium, the tunnel
  level), or a spot with a boring photo profile. Indoor spots die to floor/class
  questions; outdoor spots die to photo/radius questions -- so WHERE you hide is
  a real, rules-free strategic choice. That is the hider's entire game.


-------------------------------------------------------------------------------
TARGETS (confirm by playtest)
-------------------------------------------------------------------------------
  - Found within ~5 questions.
  - Total length ~2-3x the time it would take if the seekers already KNEW the
    spot. So ~15-30 minutes. NEVER hours.
  - Rotate roles (swap), then the longest single hide wins.


-------------------------------------------------------------------------------
STILL OPEN (parked for later / playtest)
-------------------------------------------------------------------------------
  - THE QUESTION POOL: the ~10-15 questions strong enough to earn a slot. This
    is the next and most important task (prompt.txt steps 1-2).
  - Exact draw cadence, draw size, and pool size.
  - Adjudication: inside vs. outside, how the tunnel network counts, what counts
    as the hider's "nearest pavillon."
  - The play-area boundary on campus, and what makes a legal hiding spot.
  - Whether photo questions are in v1 (powerful; the one place a hider shows
    framing skill).
===============================================================================
