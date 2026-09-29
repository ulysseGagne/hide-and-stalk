===============================================================================
JET LAG: THE GAME  --  HIDE + SEEK
EXHAUSTIVE RULEBOOK + CIA CLUB (U. LAVAL / QUEBEC CITY) PLAYABLE ADAPTATION
===============================================================================

Scope & authority (per prompt.txt answers):
  * Canonical ruleset = the standardized "Home Game" (a.k.a. the Japan / Season
    7 large-size version): 62 questions + a physical Hider Deck of cards.
  * Season-specific variants (Switzerland's coin economy; NYC's medium mini-
    game) are documented as CALLOUTS in section 11, not as the core rules.
  * The last third of this file (section 13) adapts the game so the CIA club
    (Club d'IA, Universite Laval) can actually run it around Quebec City on the
    RTC transit network.

Companion files in this folder:
  - questions.txt              : every question in the menu, by category.
  - cards.txt                  : every card in the Hider Deck (bonuses/
                                 powerups/curses) with effects and casting costs.
  - progressive-disclosure.txt : analysis of how the show teaches the game fast
                                 (feeds section 12 below).

Sources: the three episode transcripts in ./transcripts/ (Japan, Switzerland,
NYC); the community rulebook & tools at jetlag.denull.ru/en/rules/ (questions,
curses); the fan docs/deck/map tools at lifack.ch; the official rules index at
rules.jetlagthegame.com; the Jet Lag fandom wiki. Where the show and the printed
Home Game differ on a number, both are noted.


===============================================================================
1. THE GAME IN ONE PARAGRAPH
===============================================================================

Hide + Seek is a real-world game played on a public-transit network. One player
is the HIDER; everyone else is the SEEKER team. The Hider gets a head start to
travel by transit to a secret hiding zone somewhere on the agreed map, then must
stay inside that zone. The Seekers, starting from a fixed point, try to find the
Hider as fast as possible by asking questions from a fixed menu. The Hider MUST
answer every question truthfully -- but each answered question lets the Hider
draw cards from the Hider Deck, giving them Time Bonuses (which pad their final
score) and Curses (which slow the Seekers down). When the Seekers reach the
Hider's zone and physically find them, roles rotate. After all rounds, the
player with the single LONGEST hiding run wins.


===============================================================================
2. ROLES, OBJECTIVE, AND HOW YOU WIN
===============================================================================

HIDER (one player or one team):
  - Objective: stay hidden as long as possible in a single run.
  - Must answer every Seeker question truthfully and within the answer time.
  - Earns cards for answering; plays Curses/Powerups to survive longer.
  - Their run is timed from the moment their hiding time ends (they must be in
    zone) until the moment they are caught.

SEEKERS (everyone else, acting as ONE team that moves together):
  - Objective: find the Hider as fast as possible, AND while spending as few
    questions as possible (every question you ask hands the Hider more cards).
  - Move together as a single unit. Share live location with the Hider off.

WINNING:
  - The number of rounds normally equals the number of players/teams, so each
    person hides once.
  - The winner is the player with the LONGEST SINGLE hiding run (not the sum of
    runs). One great hide beats several mediocre ones.
  - Final run length = elapsed hiding time + all Time Bonus cards still in the
    Hider's hand when they are caught (see section 8).


===============================================================================
3. GAME SIZES  (choose ONE before you start)
===============================================================================

The Home Game scales to three sizes. Pick the size that matches your transit
network and how long you want to play. All later rules (answer times, thermo/
radar distances, zone radius, which questions/tools exist) key off this choice.

  +----------+-------------+-------------+-------------+---------------------+
  | SIZE     | Play length | Hiding time | Zone radius | Map scale           |
  +----------+-------------+-------------+-------------+---------------------+
  | SMALL    | 4-8 hours   | 30 minutes  | 1/4 mi/400m | 1 town/neighborhood |
  |          |             |             |             | ~30-100 stations    |
  |          |             |             |             | 10-100 sq mi        |
  +----------+-------------+-------------+-------------+---------------------+
  | MEDIUM   | ~1 day      | 60 minutes  | 1/4 mi/400m | 1 city / metro area |
  |          |             |             |             | ~100-500 stations   |
  |          |             |             |             | 100-1,000 sq mi     |
  +----------+-------------+-------------+-------------+---------------------+
  | LARGE    | 2-4 days    | 180 minutes | 1/2 mi/800m | region / country    |
  |          |             |             |             | 500+ stations       |
  |          |             |             |             | 1,000+ sq mi        |
  +----------+-------------+-------------+-------------+---------------------+

  Notes:
   - "Stations" = the transit stops/terminals that are legal hiding-zone anchors
     and legal question references. Agree the list up front (section 5).
   - Which questions and tools EXIST depends on size (e.g., Tentacles do not
     exist in Small games; extra Thermometer/Radar distances unlock at larger
     sizes). See questions.txt for the size-by-size availability.
   - Show vs. printed game: the Japan episode (Large) gave the Hider a 3.5-hour
     head start rather than the printed 3 hours (180 min). Use the printed value
     unless you deliberately want a longer hide.


===============================================================================
4. WHAT YOU NEED (materials & pre-game setup)
===============================================================================

Per game you need:
  - A live location-sharing method for the Seekers (Hider's location OFF; the
    Seekers share theirs among themselves / with a neutral referee if used).
  - An online or paper map of the agreed play area (OpenStreetMap-based tools
    work best -- see section 13 for generators).
  - The question menu (questions.txt, or an app/printed "investigation book").
  - The Hider Deck (cards.txt, or a printed/online deck).
  - 4 dice: 2 for the Hider, 2 for the Seeker team (several curses need dice).
  - Phones with battery packs; transit app; snacks/water; weather-appropriate
    clothing.

Agree BEFORE play:
  - GAME SIZE (section 3).
  - THE MAP BORDERS. Draw explicit outer boundaries everyone accepts. Every
    player must feel safe everywhere inside the boundary.
  - VALID TRANSIT MODES. Decide which count: metro, commuter/regional train,
    tram, bus, ferry, etc. Walking is always allowed inside your own zone.
  - THE STARTING POINT. A single station all rounds start from (or "resume from
    the catch location," which the show uses).
  - REST PERIODS for multi-day games (section 10).
  - Teams, if grouping people (recommended for large groups / safety).


===============================================================================
5. THE CORE LOOP (a single turn)
===============================================================================

  1. HIDER travels. At game start the Hider gets their hiding time (30/60/180
     min by size) to ride transit anywhere on the map and pick a hiding zone.
     When the hiding time expires they must be inside a zone (their run clock
     starts here) and may only move within that zone from then on.

  2. SEEKERS ask a question. From the fixed menu, the Seekers choose ONE
     question and send it to the Hider. Seekers move together the whole game.

  3. HIDER answers truthfully within the answer time (section 7).

  4. HIDER draws cards. Answering a question lets the Hider draw from the Hider
     Deck. HOW MANY depends on the question's category (section 8). The Hider
     keeps the allowed number and adds them to their hand (hand limit 6, see
     section 8).

  5. HIDER may play cards. At (almost) any time the Hider may play Powerups and
     cast Curses from hand to slow, redirect, or block the Seekers (section 9).

  6. SEEKERS mark the map, deduce, and repeat from step 2 -- narrowing the area
     until they can travel to the Hider's zone.

  7. ENDGAME + CATCH (section 9? no -> see below) once Seekers reach the zone.

The Seeker tension: every question you ask hands the Hider more cards (more
curses, more time bonuses). So ask high-value questions and as FEW as you can.


===============================================================================
6. THE SIX QUESTION CATEGORIES (summary -- full list in questions.txt)
===============================================================================

All questions live in six categories. Each is a different "tool":

  MATCHING   - Is some attribute of the Hider's location the SAME or DIFFERENT
               as the Seekers'? (same 1st admin division? same nearest airport?
               same transit line?)  Yes/No answer.

  MEASURING  - Compared to the Seekers, is the Hider CLOSER TO or FURTHER FROM
               some feature? (closer to a coastline? to a hospital? to a
               high-speed line?)  Closer/Further answer.

  THERMOMETER- The Seekers travel at least a set distance in one direction, then
               ask whether that move made them HOTTER or COLDER (nearer/farther)
               to the Hider. Great for finding a direction.

  RADAR      - Is the Hider WITHIN a chosen distance of the Seekers, yes/no?
               Distances range from 1/4 mile up to 100 miles (plus a "choose any
               distance" option). Great for carving big circles off the map.

  PHOTO      - The Hider must send a photo of a named thing (the tallest visible
               structure, five buildings, a grocery aisle, the sky straight up,
               etc.). The Hider frames to reveal as little as possible.

  TENTACLES  - Only within a set radius of the Hider (1 mi medium / 15 mi
               large). The Hider must reveal which of a category of places
               (which museum? which metro line? which zoo?) they are NEAREST to.
               Not available in Small games. Powerful for closing out a search.

Rules that apply to all questions:
  - The Hider must answer TRUTHFULLY. Photos may be framed cleverly and text may
    be blurred where a question allows, but the answer cannot be false.
  - RE-ASKING: you may ask a question that was already asked, but the Hider
    draws DOUBLE cards for the 2nd ask (TRIPLE for a 3rd), so repeats are
    expensive for the Seekers. Choose fresh questions when you can.
  - Questions that reference map categories (parks, zoos, hospitals, museums...)
    use a standard map app's category (Google/Apple/OSM) as the source of truth.


===============================================================================
7. ANSWER TIMES & TRUTHFULNESS
===============================================================================

  - Non-photo questions: the Hider answers within 5 minutes.
  - Photo questions: 10 minutes (Small/Medium), 20 minutes (Large).
      (The Japan Large episode used 15 minutes for photos; use the printed value
       unless you agree otherwise before play.)
  - Tentacles and Strava/route-trace style photos can take the full photo time
    because the Hider must physically move/produce them.
  - The Hider answers truthfully. A Photo may be framed to hide information (crop
    out the mountains, shoot the least-revealing angle) -- that is legal skill,
    not cheating. What is illegal: a false statement, a doctored image, or
    concealing a required element the question explicitly demands in frame.
  - Two Powerups let the Hider avoid answering a specific question without lying:
    VETO (refuse; Seekers get nothing; the question still counts as "asked") and
    RANDOMIZE (Seekers instead get a random un-asked question from the SAME
    category, which the Hider answers). See cards.txt.


===============================================================================
8. THE CARD-DRAW ECONOMY  (how answering earns cards)
===============================================================================

Every answered question lets the Hider draw a "look at N, keep M" from the top
of the Hider Deck. The richer the information the Seekers bought, the more cards
the Hider gets. Draw/keep by category:

  +-------------+---------------------------+
  | Category    | Draw (look at) / Keep     |
  +-------------+---------------------------+
  | Matching    | Draw 3, keep 1            |
  | Measuring   | Draw 3, keep 1            |
  | Radar       | Draw 2, keep 1            |
  | Thermometer | Draw 2, keep 1            |
  | Photo       | Draw 1, keep 1 (blind)    |
  | Tentacles   | Draw 4, keep 2            |
  +-------------+---------------------------+

  - "Draw 3 keep 1" = look at the top 3 cards, choose 1 to keep, discard the
    rest. "Photo: draw 1 keep 1 (blind)" = take the top card sight unseen.
  - RE-ASK multiplier: a repeated question multiplies the draw (2nd ask = double
    the normal draw, 3rd = triple), rewarding the Hider for Seeker repetition.

HAND LIMIT:
  - The Hider may hold at most 6 cards. Drawing over the limit forces an
    immediate discard down to 6.
  - The "Draw 1, Expand 1" powerup raises the limit to 7 (to 8 if played twice).

TIME BONUS CARDS:
  - Time Bonus cards only count toward the Hider's final run IF they are still in
    hand when the run ends (i.e., when the Hider is caught). Bonuses spent as
    casting costs, or discarded, do not count.
  - The DUPLICATE powerup, if still in hand at the end of the run, doubles the
    value of one Time Bonus in hand.
  - Observed values in play: Large game bonuses of 5, 10 and 30 minutes (Japan);
    Medium game bonuses of 3, 6 and 9 minutes (NYC). A representative printed
    deck build uses 5/10/15/20/30-minute bonuses in decreasing quantity. Scale
    the denominations to your game size (bigger games -> bigger bonuses). Full
    deck composition is in cards.txt.


===============================================================================
9. THE HIDER DECK & CURSE RULES  (full catalog in cards.txt)
===============================================================================

The Hider Deck holds three kinds of cards:

  TIME BONUS  -- padding for the final score (section 8).
  POWERUP     -- deck/answer manipulation the Hider plays for their own benefit
                 (Veto, Randomize, Discard-and-draw, Expand hand, Duplicate,
                 Move). See cards.txt.
  CURSE       -- a one-time effect the Hider casts ON the Seekers to slow,
                 redirect, block, or handicap them. Every curse has a CASTING
                 COST that balances it (discard cards, satisfy a condition, or
                 roll a die that may fizzle the curse).

CURSE RULES (important):
  - The Hider casts a curse from hand whenever they judge it most damaging
    (e.g., right as the Seekers board a train, or leave a station).
  - Each curse's CASTING COST must be paid to cast it. Costs include: discard
    your hand / discard N cards / discard a Time Bonus or Powerup; OR a board
    condition (Seekers must be a certain distance away / outside / heading the
    wrong way); OR a die roll that can nullify the curse (e.g., "roll a die; if
    even, no effect").
  - ONE BLOCKING CURSE AT A TIME. A curse that blocks the Seekers from asking
    questions or from using transit cannot be stacked; only one such blocking
    curse may be active at once. (Passive/limitation curses that merely handicap
    movement can overlap with the rules as written -- agree edge cases up front.)
  - Curses may be cast during the ENDGAME too. The one card that CANNOT be used
    in the endgame is the MOVE powerup (you can't relocate your zone once the
    Seekers have arrived).
  - Scaling notation in cards.txt: many curses list three numbers "S/M/L"
    (Small/Medium/Large). Use the one matching your game size. Example: Jammed
    Door lasts 0.5/1/3 hours -> 30 min in a Small game, 3 hours in a Large game.


===============================================================================
10. THE ENDGAME & THE CATCH
===============================================================================

ENDGAME TRIGGER:
  - The endgame begins the moment the Seekers ENTER the Hider's zone (get within
    the zone radius of the hiding spot) AND leave transit (are on foot in-zone).
  - In practice the Seekers usually confirm the exact station/zone first (a Photo
    the Hider cannot answer, a Radar hit, or a Tentacles), then arrive.

HIDER RESTRICTIONS ONCE HIDING TIME ENDED:
  - The Hider must stay within the zone (1/4 mi Small/Medium, 1/2 mi Large)
    around their chosen station/anchor for the whole run.
  - Their actual hiding SPOT must be a single, publicly-accessible location:
      * open to the public during all game hours (except rest periods),
      * within ~10 feet of a path/road that exists on the map app,
      * NOT a bathroom, NOT a private residence, NOT deep/isolated wilderness,
      * chosen so as not to draw suspicion or risk being asked to leave,
      * businesses/stores avoided where possible.

THE CATCH:
  - A catch happens when a Seeker physically SPOTS the Hider and is within ~5
    feet (~1.5 m) of them and identifies them. Being near but not seeing them is
    not a catch -- the Seekers may have to keep searching or ask more questions.
  - On the catch: the Hider's run clock stops. Add every Time Bonus still in the
    Hider's hand (Duplicate doubling one bonus) to the elapsed time to get the
    final run length.


===============================================================================
11. ROTATION, SCORING, REST PERIODS, AND SEASON VARIATIONS
===============================================================================

ROTATION & SCORING:
  - After a catch, the next Hider gets 10 minutes to prepare; the next round
    resumes from the catch location (the show's convention) or the fixed start.
  - Everyone hides once (rounds = players/teams). Longest single run wins.

REST PERIODS (multi-day / Large games):
  - Agree rest periods (>= ~10 hours recommended, e.g., overnight). When play
    pauses, all players note their exact positions and return to them when play
    resumes. In NYC (early winter) they paused at "rest period" when it got dark.

SEASON VARIATIONS (callouts -- NOT the canonical rules; here for reference):

  >> LARGE / "Japan" (Season 7) -- this IS the canonical Home Game large size.
     62 questions in 6 categories; physical Hider Deck; ~3-3.5 h hide; 1/2 mile
     zone; curses named "Curse of the ___". Everything above matches this.

  >> MEDIUM / "NYC" (one-off) -- the Home Game medium size, shown as a 2-round,
     2-episode mini-game. 80-question "investigation book"; SOME large-game
     questions are BANNED at medium size ("a few questions from our large games
     are banned"); 1-hour hide; 1/4 mile zone; rest period at dark; same card
     deck. Curses seen: Drained Brain, Mediocre Travel Agent, Egg Partner.

  >> "Switzerland" (earlier season, PRE-card-deck economy) -- historical variant.
     76 questions in FIVE categories (Relative [= today's Matching+Measuring],
     Radar, Photo, Oddballs [~ today's Tentacles/tasks], Precision [~ endgame]).
     Instead of drawing cards, answering questions pays the Hider COINS (e.g., a
     relative question paid 40 coins). To curse, the Hider spends coins to ROLL
     CURSE DICE: 50 coins per die (100 = 2 dice, 150 = 3 dice, ...); sum the
     dice; the higher the total, the better/higher-tier the curse you receive
     (you don't choose it). Curses seen: William Tell (knock an apple off your
     partner's head from 15 ft), Swiss Clock (clap within 0.5 s of the 15-second
     mark). This coin/curse-dice system was REPLACED by the card deck in the
     modern Home Game; use the card deck.


===============================================================================
12. TEACHING THE GAME ON ACTIVITY DAY  (do NOT read the rulebook aloud)
===============================================================================

From progressive-disclosure.txt: the show never front-loads the rules. Copy
that. A ~3-minute intro is enough to start; explain everything else the first
time it happens. Suggested script for the CIA facilitator:

  MINUTE 0  -- The goal, one sentence:
     "The goal is simple: hide as long as you can without being found."

  MINUTE 0-1 -- The frame, ~7 facts:
     "One person hides and rides transit to a secret spot; the rest are seekers
      and try to find them. Seekers ask questions from this menu; the hider must
      answer truthfully -- but every answer lets the hider draw cards that help
      them (time bonuses, and curses that slow you down). When we find the
      hider, we swap. Longest single hide wins. We'll explain the fiddly stuff
      as it comes up -- the hider's clock is already ticking."

  MINUTE 1-2 -- The six tools, one line each, with a LOCAL example:
     Matching (same/different: same borough as us?), Measuring (closer/further:
     closer to the river?), Thermometer (move and check hotter/colder), Radar
     (are they within X of us?), Photo (send us a picture of Y), Tentacles
     ("we'll cover that one once we're close").

  MINUTE 2-3 -- Show ONE example turn: pick a question, send it, mark the map.

  THEN, JUST-IN-TIME (explain each the first time it fires):
     - "The hider just drew cards for that answer -- radars are worth 2, they
        keep 1." (Explain draw/keep the first time each category is used.)
     - "That's a curse. Curses slow us down and cost the hider something to
        cast." (Explain casting cost when the first curse lands.)
     - The endgame, rest periods, hiding-spot legality, penalties -- each the
       first time it becomes relevant.

Hand every hider a one-page card summary (see section 14) and let the deck/app
enforce the details.


===============================================================================
13. CIA CLUB ADAPTATION -- QUEBEC CITY / UNIVERSITE LAVAL / RTC
===============================================================================

Goal of this section: turn the Home Game into something the club can actually
run as a social activity around Universite Laval and Quebec City. Quebec City
has NO metro; transit is the RTC bus network (Reseau de transport de la
Capitale) -- high-frequency Metrobus lines (800/801/802/803/807), eXpress
commuter routes, and regular routes -- plus, for a bigger map, STLevis buses and
the Quebec<->Levis ferry (traverse). Build the game around buses.

13.1  RECOMMENDED SIZE & FORMAT
  - DEFAULT: a SMALL game (an afternoon, 4-6 h) is the right first club event.
    It fits one campus-anchored session, needs the fewest logistics, and has no
    overnight/rest-period complexity. 30-min hides, 1/4-mile (400 m) zones.
  - AMBITIOUS: a MEDIUM game (a full day) covering the whole RTC service area
    (and optionally Levis via the ferry). 60-min hides, 1/4-mile zones.
  - Avoid LARGE for a first event (multi-day, needs a regional rail-like network
    Quebec City lacks).

13.2  THE MAP & "STATIONS"
  - Because buses have hundreds of stops, DON'T treat every stop as a station.
    Instead agree a curated list of ~30-100 "stations" = major stops / terminals
    / Metrobus & eXpress interchanges. Good anchors:
        Universite Laval (campus bus interchange -- the natural START POINT),
        Terminus Sainte-Foy, Terminus Les Saules, Terminus Charlesbourg,
        Terminus Beauport, Terminus Belvedere, Place D'Youville / Old Quebec,
        Gare du Palais (train/bus), Terminus de la Gare-du-Palais,
        major Metrobus 800/801 stops along the Charest / Rene-Levesque axes,
        (Medium only) Levis ferry terminal + STLevis terminals.
  - Generate the boundary and question tooling with a map generator (13.6). Set
    the outer boundary to something everyone is comfortable traveling within
    (e.g., Small game: campus + Sainte-Foy-Sillery + Old Quebec + Limoilou;
    Medium: full RTC network).
  - Zone anchors: for Quebec's bus reality, let a "hiding zone" be the 400 m
    circle around a chosen major stop/terminal from the agreed station list.

13.3  TRANSIT RULES (Quebec-specific)
  - Valid transit = RTC buses (Metrobus, eXpress, regular). Decide before play
    whether eXpress (rush-hour-only, one-directional) routes count -- they can
    make certain timings unfair, exactly like the NYC Long Island Rail Road
    "once-an-hour fast train" the seekers worried about.
  - Medium option: allow STLevis buses + the Quebec-Levis ferry (predictable,
    scenic, and a natural "coastline/body-of-water" feature for Measuring/Photo
    questions). If you include Levis, include the ferry in "valid transit."
  - Walking allowed anywhere inside your own zone. Between zones = buses only.
  - Everyone uses the same trip planner (RTC / transit app) so timings are fair.

13.4  QUESTION-MENU TWEAKS FOR QUEBEC CITY
  Some canonical questions assume features Quebec City lacks or has few of.
  Before play, map each question to a local referent, and BAN any that don't
  work (the Home Game already bans some questions at smaller sizes):
    - "High-speed train line" (Measuring): no HSR here -> BAN, or reinterpret as
      "nearest VIA Rail line / Gare du Palais."
    - "Metro lines within 15 mi" (Tentacles, Large only): no metro -> reinterpret
      as "Metrobus lines" or BAN (you won't use Large anyway).
    - "Coastline / body of water" (Measuring/Photo): the St. Lawrence River is a
      strong, fair referent -- keep these.
    - "1st/2nd/3rd administrative division" (Matching): map to
      region (Capitale-Nationale) / RCM-agglomeration / BOROUGH (arrondissement:
      Sainte-Foy-Sillery-Cap-Rouge, La Cite-Limoilou, Les Rivieres, Charlesbourg,
      Beauport, La Haute-Saint-Charles). Boroughs are your best "same division?"
      question -- exactly how NYC used its 5 boroughs.
    - "Commercial airport" (Matching/Measuring): Quebec City (YQB) is the single
      obvious referent -- fine but low-information; consider banning at Small.
    - "Foreign consulate", "amusement park", "zoo", "aquarium" (Aquarium du
      Quebec exists; Valcartier/Village Vacances Valcartier as amusement/water
      park): keep the ones that have >=2 instances so the answer carries signal;
      ban singletons that give away too much or too little.
  Keep the six-category structure; just localize the referents. questions.txt
  lists every question so you can tick which to keep/ban.

13.5  GROUP SIZE -> TEAMS  (a club can be big; the game caps at ~4 "players")
  - Canonical: max ~4 players, Seekers move as ONE team. For a club social with
    many members, group people into TEAMS; each team acts as a single "player."
  - Options:
      (a) One Seeker team of 3-4, one Hider team of 2-3, rotate the hide across
          3-4 rounds in an afternoon (recommended for a first event).
      (b) If you have 15-25+ members: run 2-3 PARALLEL games with separate maps/
          decks, or split into a big Seeker pack of 2-3 sub-teams that must still
          converge on one answer (house-rule; less clean -- prefer parallel
          games). Assign a neutral referee per game to hold live locations and
          adjudicate curses.
  - Safety-size teams so nobody travels alone.

13.6  TOOLS TO PREP THE MAP & DECK (free, fan-made)
  - lifack.ch -- rulebook, "investigation book" (question tracker), deck builder
    ("Your Deck"), and a MAP GENERATOR. (Root domain may block some browsers;
    the /docs/ guide pages work.) Not affiliated with Jet Lag; ages 14+, 2-4+.
  - taibeled.github.io/JetLagHideAndSeek -- a popular open-source Map Generator
    for Hide + Seek; generate a Quebec City board from OpenStreetMap.
  - jetlag.denull.ru/en/rules/ -- clean community rulebook incl. the full
    questions and curses pages this folder's docs were built from.
  Generate the board on ONE of these, export/share the boundary + station list,
  and use the app's question/deck tools so the fiddly draw/curse math is
  automated on the day.

13.7  SAFETY, WEATHER, LOGISTICS (this is an Autumn A26 activity)
  - Autumn in Quebec City = cold, wet, and DARK EARLY. Set a hard end time
    before sunset for a Small game, or a rest period like the show if it runs
    long. Warn hiders that legal spots must be publicly accessible and not
    isolated wilderness -- doubly important in cold/dark.
  - Buddy system: no solo travel; teams of >=2. Seekers share live location
    among themselves / with a referee. Chargers/battery packs mandatory.
  - Confirm the day's RTC service (holiday/weekend schedules thin out frequency
    and change the fair-timing math). Have the RTC/transit app on every phone.
  - FARES/BUDGET: budget one RTC day pass ("Laissez-passer 1 jour") per player,
    or per-trip fares; CONFIRM CURRENT RTC PRICING before the event (fares
    change; students may have discounted/OPUS options). A Small afternoon game
    is cheap -- mostly fares + snacks. Keep this activity's cost separate from
    the broader A26 plan budget.
  - Ground rules: obey all transit rules and the law; no trespassing to hide;
    hiders answer truthfully; be considerate of the public (you are in real
    stations and neighborhoods).

13.8  A CONCRETE FIRST-EVENT RECIPE (copy/paste plan)
  - Size: SMALL. Start point: Universite Laval bus interchange.
  - Boundary: campus + Sainte-Foy-Sillery-Cap-Rouge + La Cite-Limoilou +
    (optional) Beauport, reachable by Metrobus/eXpress in ~30 min.
  - Stations: curated ~40 major stops/terminals (13.2).
  - Transit: RTC buses only; decide on eXpress; ferry/Levis excluded for v1.
  - Teams: 1 Seeker team (4), rotating Hider (teams of 2); 3-4 rounds; ~4-6 h.
  - Deck/questions: generate with a tool (13.6); ban Quebec-broken questions
    (13.4); print one summary card per hider (section 14).
  - Referee: 1 neutral member holds live locations + settles curse timing.
  - Hard stop before dark; debrief + longest-run winner announced at the end.


===============================================================================
14. QUICK-REFERENCE CARD  (print one per player)
===============================================================================

GOAL: hide longest (single run). Answer every question truthfully; each answer
lets you draw cards. Longest single hide wins.

SIZE (this game): ____  |  Hide time: 30/60/180 min  |  Zone: 400 m / 800 m
Start point: __________  |  Valid transit: __________________

CATEGORIES (ask one per turn; fewer = better for Seekers):
  Matching (same/diff, Yes/No) ....... Hider draws 3 keep 1
  Measuring (closer/further) ......... Hider draws 3 keep 1
  Radar (within X? Yes/No) ........... Hider draws 2 keep 1
  Thermometer (move, hotter/colder) .. Hider draws 2 keep 1
  Photo (send a picture) ............. Hider draws 1 keep 1 (blind)
  Tentacles (nearest which? med/large) Hider draws 4 keep 2

ANSWER TIME: 5 min (non-photo) / 10 min photo (S,M) / 20 min photo (L).
HAND LIMIT: 6 cards (7-8 with Draw1/Expand1).
CURSES: pay the casting cost; only ONE question/transit-BLOCKING curse at a time;
        curses OK in endgame; MOVE cannot be used in endgame.
TIME BONUSES: only count if still in hand when caught; Duplicate doubles one.
ENDGAME: starts when Seekers enter your zone on foot. CATCH = Seeker within ~5 ft
        and identifies you. Legal spot = public, near a mapped path, not a
        bathroom/home/wilderness.

===============================================================================
END OF rules.txt
===============================================================================
