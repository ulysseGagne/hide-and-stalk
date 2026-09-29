===============================================================================
U. LAVAL HIDE + SEEK  --  QUESTION WORKSHOP (running log)
===============================================================================
GUIDING PRINCIPLE (per Ulysse, 2026-08-21): do NOT discard canonical questions.
ALWAYS find the campus-scale equivalent. Breadth first -- creativity is a
numbers game; we cut down to the final ~10-15 later. Goal: 5-10x the final count.

Legend:  [IN] adopted framing  |  [ALT] alternative held in reserve  |  [CUT] dropped

===============================================================================
STEP 1 -- ADAPTING THE SIX JET LAG CATEGORIES, ONE BY ONE
===============================================================================

--- MATCHING  (same nearest X as us?  Yes/No) ---------------------------------

Airport  (= "arrival hub": sparse, major, evenly spread)
  [IN]  Same nearest major PARKING structure/lot as us?
  [ALT] Same nearest bus TERMINAL as us?  (coarser hub)

Transit line / nearest stop
  [IN]  Is your nearest BUS STOP the same as ours?

Admin divisions (province / borough / ...)
  [IN]  Same PAVILLON as us?   (fine level only; coarse "sector" dropped)

Station name length
  [CUT] gimmick, near-zero signal.

Street or path
  [IN]  Same nearest STREET as us?   (unnamed path/allee version dropped)

Landmass / mountain
  [IN]  Same nearest TALL BUILDING as us?  (campus "peak")

Park / green space
  [CUT] campus green spaces aren't named as parks; "parks near me" returns
        little in Maps -> fails the answerability test.

VIABILITY FILTER (learned Round 2): keep a Matching/Tentacles referent ONLY if
"<X> near me" actually returns MULTIPLE campus results in Google Maps.
  Returns well: bus stops, parkings, cafes, ATMs, food, AVelo stations.
  Returns poorly: parks, museums, zoos, consulates -> don't use for Matching.

--- MEASURING / RADAR / THERMOMETER  (distance-based) -------------------------

Walking time  (Maps DIRECTIONS, seeker->hider, NOT bird's-eye)  ** strong **
  [IN]  How many minutes to walk from us to you?  (raw minutes; a walk-time
        isochrone that respects buildings/tunnels; the hider computes it from
        the seekers' shared location without revealing their own point)
  [ALT] Is your walk time under X min? (radar)  |  did it go up/down? (thermometer)

Matching amenities
  [IN]  Same nearest CAFE as us?
  [CUT] food, ATM, library (as matching).

Dead POIs (museum/zoo/amusement/golf/movie/consulate/single hospital)
  [CUT] all; no campus salvage taken.

Measuring -- landmark bisectors (closer to X than us?)
  [IN]  Closer to the PEPS (sports complex)?
  [IN]  Closer to the MAIN LIBRARY?
  [IN]  Closer to the EDGE of campus (boulevard/autoroute)?
  [CUT] student hub, elevation, river, parking, cafe.

--- RADAR (bird's-eye "within X of us?", via Mesurer une distance) ---
  [IN]  Within 100 m / 200 m / 300 m / 500 m of us?   (all four rings)

--- DIRECTION  (Ulysse's reframe -- REPLACES move-based Thermometer) ---
  [IN]  Are you NORTH or SOUTH of us?
  [IN]  Are you EAST or WEST of us?
  [IN]  Are you IN FRONT of or BEHIND us?  (uses the Maps orientation cone =
        which way the seekers are facing)
  [CUT] classic move-then-hotter/colder thermometer.

--- ABSOLUTE "WHICH X ARE YOU NEAREST?"  (Tentacles form) ---
DIRECTIVE (Ulysse): the absolute "which X" form REPLACES the relative
"same nearest X as us?" (Matching) form for every naming referent. So the
earlier [IN] "same ___ as us?" entries above are superseded by:
  [IN]  Which PAVILLON are you nearest?
  [IN]  Which CAFE are you nearest?
  [IN]  Which PARKING are you nearest?
  [IN]  Which BUS STOP are you nearest?
  [IN]  Which STREET are you on / nearest?
  [IN]  Which TALL BUILDING are you nearest?

--- PHOTO (frame to reveal little) -- confirmed so far ---
  [IN]  Tallest thing in your sightline
  [IN]  The sky, straight up
  [IN]  Nearest door or sign
  (brainstorming many more -- next round)

--- PHOTO (cont.) ---
  [IN]  Selfie (tight frame)
  [IN]  Feet + the ground you're standing on
  [IN]  Ceiling above you
  [IN]  Floor surface texture
  [IN]  A WINDOW -- shot from inside (view out) OR from outside (facade);
        leaks info both ways
  [PENDING] leaky-signage set (evacuation map / room plate / poster / exit sign)
        -- that question went unanswered; re-surface. Evacuation map = strongest.
  [CUT] shadow, reflection, vending/bin (not picked)

--- MEASURING -> ABSOLUTE landmark distance ---
  Decision: GO ABSOLUTE -- "Are you within X of <landmark>?" (no compare-to-us).
  [IN]  Within X of the PEPS?
  [IN]  Within X of the main library?
  [IN]  Are you in the OUTER RING of campus? (edge, absolute form)
  TODO: web-search more ICONIC campus landmarks (e.g. the "Universite Laval"
        sign) to add as absolute-distance referents.

--- MEASURING -> ABSOLUTE: LANDMARK REFERENTS (expanded w/ Ulysse's local list) ---
Form TBD: "Are you within X of <landmark>?"  and/or  "Which landmark nearest?"
  [IN]  Pavillon Casault (church tower)      [IN]  Twin towers (tours jumelles)
  [IN]  The Universite Laval sign (entrance) [IN]  La petite maison
  [IN]  Stade TELUS (stadium)                [IN]  Grand-Axe intersection
  [IN]  Piste d'athletisme (not "PEPS" generally)  [IN]  Terrain de golf
  [IN]  Les serres (greenhouses)             [IN]  Terrain de volleyball
  [IN]  Le pub universitaire (Pub U)
  [CUT] Palasis-Prince columns (not taken)

--- PHOTO: leaky signage --- [CUT] ALL (evac map / room plate / poster / exit) -- "none".

--- STEP 2 (ideas.txt) -- just-knowing pinpoints ---
  [IN]  Inside or outside?
  [IN]  What floor are you on?
  [IN]  Nearest classroom number?
  [CUT] "in the tunnel network?"
  RULE FLAG (Ulysse): likely DISALLOW hiding in tunnels -- they mess with GPS.
       => hiding spot must have usable GPS. Parks the tunnel-ambiguity idea;
       revisit at rules stage.

--- STEP 2 (ideas.txt) -- more seeds ---
  [IN]  Which AVelo (bike-share) station are you nearest?
  [IN]  Would we see you on Google Street View? (is your spot on a SV-covered road)
  [IN]  Can you see a bike lane from your spot? (perception form)
  [IN]  ** NEW (Ulysse): How many people can you see from your location? **
        (crowd density -- busy atrium vs quiet corner)
  [CUT] "on a Strava-hot route?"

--- STEP 3 (out-of-box) -- look-around / perception (Ulysse curated tight) ---
  [IN]  How many BUILDINGS can you see?
  [IN]  How many TREES can you see?
  [IN]  Can you see a PARKED CAR?     (new -- near parking/street)
  [IN]  Is the SUN on you right now?  (outdoors + which side)
  [CUT] moving bus, other pavillon's name, hear traffic, warmer-than-outside,
        hear people, ALL indoor-structure Qs, ALL map/camera-trick Qs.

TASTE NOTE: Ulysse favours SIMPLE, instant, mostly-outdoor perception questions;
cut fiddly indoor / tool-heavy ones. Apply going forward.

--- STEP 3 (out-of-box) batch 2 -- interrupted (only 'can you see' group answered) ---
  [IN]  Can you see GRASS?
  [IN]  Can you see a CONSTRUCTION SITE?
  [IN]  Can you see a BENCH?
  [PARKED, not triaged] how-many {bikes, cars, people within 10 m, floors on
        tallest visible}; campus-life {buy food now?, cafe-vs-PubU, study-vs-
        passage, seat within 5 steps}; can-you-see {flag, lamppost, bus shelter,
        road}.

--- CORRECTION (Ulysse): LANDMARKS use the RELATIVE form ---
  [IN]  "Are you closer to <landmark> than the seekers?"  (one question; the
        landmark is chosen from the full list). This SUPERSEDES the earlier
        "which landmark are you nearest?" / "within X of landmark" absolute
        framing for the landmark set.

--- (log continues) ---
===============================================================================
