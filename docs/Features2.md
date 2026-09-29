# FEATURES

> Campus-scale hide & seek, inspired by Jet Lag: The Game.
> Hosted as a static site on GitHub Pages.

> **Update (Sept. 28, feedback v1 + v2):** parts of this spec are superseded.
> Teams are now formed by the admin ahead of time and each team starts its own
> game (no global start, no global game timer); questions come every 5 minutes
> exactly (the heat map no longer changes the timer); question 7 never comes, so
> the hider wins after 6. See **How a game works** and **Game design notes** in
> `README.md` for the current rules.

---

## ACCOUNTS AND TEAMS

- **Auth is username + password only.** No email addresses, no email verification, no password recovery flow.
- One account = one player. Accounts persist in the database until an admin clears them.
- Players do **not** pick their role or their group. Both are assigned by the system when the game starts.
- Group assignment happens at game start (see `ADMIN` below): every non-admin account in the database is split into groups as evenly as possible. Each group then has exactly **one hider**; everyone else in that group becomes a **stalker**.

---

## ROLES

### ADMIN

Admins have a dedicated dashboard (`/admin`) that only they may access.

**Menu buttons (so far):**

| Button | Behaviour |
|---|---|
| **Board** | Shows every account currently in the database. Pre-game it's a flat pool of registered players. Once a game starts, the same board re-renders itself into the group/role structure (which group, who's the hider, who's a stalker). |
| **Direct Start** | Immediately runs group assignment and starts the game. |
| **Queued Start** | Starts a countdown stored under the constant `TIME_TO_HIDE` (currently 10 minutes). When it hits zero it does exactly what Direct Start does. Purpose: gives hiders time to actually go hide. |
| **Clear** | Deletes every person in the database **except admins**. |

**Suggested additions (not yet confirmed):**
- **Pause** — freezes all timers (card cooldowns, `TIME_TO_HIDE`, game clock) without destroying groups. For real-world interruptions.
- **Reset to lobby** — ends the current game and dumps everyone back into the unassigned pool, keeping accounts intact.

**Admin map view:** admins see *every* pin on the map, live. Colour-coded so that groups are distinguishable from each other, and roles (admin / hider / stalker) are distinguishable within a group.

### HIDERS

- One hider per group.
- Objective: stay hidden from their own group's stalkers for as long as possible.
- Their location feeds the map (visible to admins; visible to their stalkers only through the constraint overlay, not directly).
- **TODO:** the hider's MENU tab is not yet specified. Open questions in the section at the bottom.

### STALKERS

- Every non-hider member of a group.
- Objective: find their group's hider.
- Stalkers only ever interact with their *own* group's hider. Cross-group information is never shared.

---

## INTERFACE

### Shared header (all roles)

- Game name, centred.
- Directly beneath the header — visually attached to it, like a tab poking out — two horizontally parallel buttons on the left: **MAP** and **MENU**.
- These two tabs are the entire navigation. Every role has exactly one page with these two views.

### MAP tab

- Based on the map from **JetLagHideAndSeek**, with the built-in "questions" menu removed (questions are handled by our card system instead).
- Small overlay menu for toggling map overlays on and off.

#### Overlay: Activity heat map

- **Not live.** Pulled from an external API — first choice **Strava** (public activity density as a proxy for how trafficked a location is), rendered as a heat map layer over the map.
- ⚠️ Strava's global heatmap is not a documented free API and tiles are access-restricted. Fallback plan: derive density from **OpenStreetMap POI density** (buildings, amenities, footpaths) instead. Should be behind a single swappable data-source module either way.
- **This overlay is a balancing mechanic, not decoration.** The card refresh interval for stalkers scales with how exposed the hider's current position is:
  - Hider in a **crowded / public** area (high heat) → theoretically easier to find → stalkers' card refresh interval gets **longer**.
  - Hider in a **quiet / obscure** area (low heat) → harder to find → stalkers' card refresh interval gets **shorter**.
- The interval bounds and the heat→time mapping should live in named constants next to `TIME_TO_HIDE`.

#### Overlay: Hints (position constraint / elimination) — BUILT

- Toggled from the overlays menu on the map, and only offered to stalkers.
- Same approach as the JetLagHideAndSeek elimination overlay: start from the
  play area, intersect or subtract a polygon per answered card, shade everything
  outside what survives, and draw a border around what is left. `src/hints.js`,
  using turf.js.
- Every answered card that carries geometry becomes a constraint, so the search
  area visibly closes in as answers come back.
- **Scope: per stalker group.** Each group only ever sees constraints derived from *their own* hider's answers. No intel bleeds between groups.
- Fed directly by the card history (below).
- If the answers cannot all be true at once (a hider mis-tapped, or GPS drifted),
  the region goes empty and the menu says so rather than silently drawing
  nothing.

### MENU tab

#### ADMIN menu
Board / Direct Start / Queued Start / Clear, as described above.

#### STALKER menu — BUILT
- Above the cards: a **clock icon with a countdown timer** — the cooldown until the next batch.
- **Three cards, face up.** Changed from the original "face down" note: picking
  blind is a draw, not a choice. Seeing all three and burning two is the 1-of-3
  decision this was after.
- **The batch belongs to the group, not the stalker.** The first stalker to pick
  burns it for the whole group, so the hider fields one question per interval no
  matter how many stalkers are hunting them.
- When the countdown expires, a fresh batch of three is dealt.
- The countdown drains at a rate set by the activity heat map rule above.
- A **Card history** button opens every card the group has played with the
  hider's answer to each.

#### HIDER menu — BUILT
- A queue of the questions sent to them, newest last, each with the input the
  card calls for: radio buttons, checkboxes, a text box, a number, or a photo
  upload (downscaled in the browser before it is stored).
- Answers are final; a card cannot be answered twice.
- The hider does **not** get the Hints filter: they must not see what their
  stalkers have narrowed down.

---

## CARDS — BUILT

The deck lives in `worker/src/cards.js` and is served to the frontend at
`GET /cards/catalog`, so the client and server can never disagree about it.
32 cards in five categories:

| Category | Cards | Narrows the map? |
|---|---|---|
| Direction | north/south, east/west of the asker | yes, a half-plane |
| Distance | within 100/200/300/500 m of the asker; walking minutes away | yes, a disc or a ring |
| Proximity | closer than the asker to the church / twin towers / ULAVAL sign / athletics track / greenhouses / outer ring; nearest building / café / bus stop / àVélo station | yes, a circle, a perimeter band, or a Voronoi cell |
| Surroundings | inside or outside, floor number, nearest room number, on Street View, bike lane in sight, how many people around | no |
| Photo | tallest thing in sight, what is below/above you, nearest door/sign/window, biggest plant, a parked car, nearest place to sit | no |

- Dealt in batches of three, **face up** (see the stalker menu note above).
- Picking one discards the other two.
- Batch refresh is on a timer whose rate is modulated by the hider's exposure.
- Cards phrased relative to the asker ("...than me?") snapshot that stalker's
  position when the card is played, so the answer still means something after
  they walk away. They cannot be played by a stalker who is not sharing
  their location.
- A group never draws the same card twice until the deck runs dry.

### Card history — BUILT

- The system logs every card used by each **stalker group**, along with its result.
- This history is the data source for the Hints overlay.
- Viewable by the group from the **Card history** button or the header bell.
  Photos are stored separately from the listing and fetched only when a row that
  has one is shown.
- Cleared when a game starts or resets, since group ids are re-drawn from scratch.

### Notifications — BUILT

- A bell in the header for both roles.
- For the hider it counts questions they still owe an answer to; for a stalker it
  counts answers that have come back since they last opened the history.
- Each stalker's bell is tracked separately, so one teammate reading the answer
  does not clear it for the rest of the group.

---

## OPEN QUESTIONS

1. ~~**What do the cards actually do?**~~ Answered: see CARDS above. Curse cards
   are still unspecified.
2. **How does a round end?** What counts as a successful find — proximity, a manual "found" button, a photo, an admin confirmation?
3. **What happens after a find?** Does the group swap roles, does the game end, is there a scoring system across multiple rounds?
4. ~~**Does the hider answer cards manually?**~~ Answered: manually, in the hider
   menu. The hider is told to answer truthfully and nothing checks them against
   GPS — faithful to Jet Lag, and it keeps the photo and "what floor" cards
   possible at all.
5. ~~**Hider menu contents**~~ Answered: the question queue. Veto tokens are
   still unbuilt.
6. **Play area boundary** — the campus perimeter is a polygon in
   `worker/src/cards.js` (`PLAY_AREA`), currently an approximate bounding box
   that needs replacing with the real perimeter. What happens if a hider leaves
   it is still undecided.
7. **Location permissions / battery** — continuous GPS on phones for the length of a game is rough. Update interval needs to be a tunable constant.
8. **Landmark coordinates.** Every landmark in `worker/src/cards.js` ships with
   `lat`/`lng` set to `null`. Until they are filled in, the "closer to the X than
   me?" and "which X are you closest to?" cards are still dealt and answered but
   add nothing to the Hints filter.
