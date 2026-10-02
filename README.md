# HideNStalk

Campus-scale hide & seek. Static frontend (`src/`, deployed to GitHub Pages) +
a tiny Cloudflare Worker / D1 API (`worker/`) for accounts, teams and live
locations.

## Repository layout

| Path | What's in it |
| --- | --- |
| `src/` | Frontend, deployed to GitHub Pages |
| `worker/` | Cloudflare Worker + D1 API |
| `locations/` | Campus landmarks (`geojson/` source of truth, `gpx/` exports) |
| `tools/` | Build scripts (`npm run build:locations`) |
| `docs/` | Feature specs, question list, playtest feedback, notes |
| `design/game-design/` | Game design research: the original Jet Lag game and the ULaval adaptation (start with its `README.md`) |
| `design/promo/` | Event promotion: poster drafts and inspiration, the Discord announcement (`discord/`: the draft, and earlier posts for the tone), and the promo brief (`prompt.txt`) |
| `design/promo/round-1/` | The redesign, explored as code: the review gallery (`gallery/`, the target the app is built to), the drawing lab, the mock-ups over the old app (start with its `README.md`) |
| `design/promo/round-2/` | The redesign built into `src/`: each gallery screen next to the real app, and the tools that shoot, compare and measure it |

## How a game works

The admin puts the players into teams ahead of time (one hider each). After
that every team is on its own: whenever the team is ready, anyone on it
presses **Start** on their phone.

1. The hider has **10 minutes** to hide. Everyone on the team sees the same
   countdown.
2. Then the hunt starts: **a new question every 5 minutes**. The stalkers get
   three questions face up, pick one and send it; it goes straight to the
   hider, who answers truthfully. The map's hints layer closes in with every
   answer. A question the stalkers don't send in time isn't lost: questions
   pile up, and the next one is face up the moment one is sent.
3. The stalkers win by finding the hider (they scan the QR code on the hider's
   screen, or press **Hider has been found**). If question 7 would come first
   (30 minutes of hunting), the hider wins.
4. **Play again** puts the team back to ready with a new hider, picked at
   random among the players who have hidden the fewest rounds so far (never
   the one who just hid), so everyone hides equally often.
   Every finished round goes into the results; the longest hide wins.

The rules the players see before the game, most important first: hide near
a path (within 20 m of one); the hider walks, stalkers can run; no tunnels;
touch nothing (don't open, move or climb anything); answer truthfully;
found? show your code, stalkers win; one hider, 10 minutes to hide, a
question every 5 minutes; stay in the Discord call all game.

## Frontend (`src/`)

Plain HTML/JS/CSS, no build step. The look is the design review's
(`design/promo/round-1/gallery/`): black and white, one 3 px line, one
typeface (Arimo, self-hosted in `fonts/`), and red only ever drawn by hand.

- `index.html` – the home screen (the app opens on it; a tap goes on), the
  header (HIDE & STALK, the bell, Log out), the MENU (QUESTIONS once the hunt
  is on) / MAP / RESULTS tabs, login/register, "Before you start" (the two
  permissions, first launch only), the player's home screen, the scanner and
  the admin dashboard
- `app.js` – tabs, the home screen, auth, "Before you start", notices, the
  sync loop, and the player's status card: what to do right now (no team yet /
  ready / go hide / question N of 6 / result), Start and Play again, the rules
  (before the game only), the debug strip
- `marks.js` – the red layer on the app's screens, drawn with `ink.js`: the
  role stamped at the reveal, PICK JUST ONE, the picked card's box, SENT ·
  LOCKED IN, the answers written in, the hider's ticks, the arrow and NEW at the
  bell until a notification is read (on every tab, the map included), and an
  arrow at the button to press when nothing else is red
- `admin.js` – the admin dashboard: join QR, Make teams, the drag-and-drop
  board with each team's status and controls, results, settings, to-dos
- `cards.js` – the stalkers' three cards (a tap picks, Send sends) and the sent
  card (locked in until the answer is written in), the hider's questions and
  answers (with Change), the RESULTS tab, the bell
- `map.js` – the Leaflet map: the hints layer (what the answers ruled out,
  inverted; the edge of what's left drawn by hand), the question in a box at
  the top and what it needs drawn, YOU's arrow with its heading, the other
  players' pins
- `mapdraw.js` – draws the campus from OpenStreetMap's data
  (`data/campus-map.json`, **generated**, see *The map*) as canvas tiles, and
  for the receipt
- `receipt.js` – the end of a round as a till receipt, with the final hints
  map printed on it
- `hints.js` – turns answered cards into polygons and works out the surviving
  play area, the way the JetLagHideAndSeek elimination overlay does; also works
  out which "which X are you closest to?" answers are still possible
- `endgame.js` – the hider's QR code, the stalker's camera scanner (from "Found
  them? Scan their code"), and its "Hider has been found" fallback
- `ink.js`, `vendor/perfect-freehand.js` – the hand-drawn red (from the design
  lab, unchanged)
- `locations.js` – **generated**; every campus place, as map data
  (see *Configuring the play area*)
- `config.js` – **set `apiBase` to your deployed Worker URL**

Run locally with any static server, e.g.:

```sh
npx serve src -l 8080
```

## Backend (`worker/`)

```sh
cd worker
npm install
npx wrangler login
npx wrangler d1 create hidenstalk        # copy database_id into wrangler.toml
npm run db:init:local                    # create tables for local dev
npm run dev                              # http://127.0.0.1:8787
```

An existing database needs every migration it hasn't had yet, and it needs them
**before** deploying the worker that reads them — otherwise every request
answers "Internal server error".

```sh
npm run db:migrate:local                 # every migration, local
npm run db:migrate                       # every migration, deployed DB
```

Both are safe to run at any time, as often as you like: `migrate.mjs` sends each
statement separately and reports the ones already in place as `already` rather
than failing. Every migration must stay that way (see the header of
`migrations/0006_async_teams.sql`).

> **Do not run a migration with `wrangler d1 execute --file=...`.** That sends
> the file as one unit, and SQLite has no `ALTER TABLE ... ADD COLUMN IF NOT
> EXISTS`, so on a half-applied database it dies on the first `ALTER` and
> **silently skips every statement after it**. The "duplicate column" error is
> not harmless; it means the rest of that file did not run.

Deploying:

```sh
npm run db:init                          # first time only: create tables on the remote DB
npm run db:migrate                       # every time: bring the remote DB up to date
npm run deploy
```

Then:

1. Put the Worker URL (`https://hidenstalk-api.<you>.workers.dev`) into `src/config.js` → `apiBase`.
2. Add your GitHub Pages origin (`https://<you>.github.io`) to `ALLOWED_ORIGINS` in `worker/wrangler.toml` and redeploy.

> **Order matters.** Pushing to `main` deploys the frontend straight away
> (GitHub Pages). A frontend that talks to an older worker breaks, so run
> `npm run db:migrate` and `npm run deploy` **first**, then merge to `main`.

To test the frontend from another port (e.g. 8081), give the local worker a
`worker/.dev.vars` (git-ignored) with its own list:
`ALLOWED_ORIGINS="http://localhost:8081,http://127.0.0.1:8081"`.

### Testing

Both need `npm run dev` running and the admin password in
`HNS_ADMIN_PASSWORD` (and, to log in as a local admin rather than `admin`,
its name in `HNS_ADMIN_USERNAME`). **Both start by deleting every player** on
the server they talk to, so they refuse anything but a local one.

```sh
HNS_ADMIN_PASSWORD=... npm run smoke      # every rule, in seconds (moves the clock in the DB)
HNS_ADMIN_PASSWORD=... npm run simulate   # 6 teams of 6 playing at once, ~8 minutes
```

To keep your local players, run them against a throwaway database instead:
start the worker with `npx wrangler dev --persist-to <dir>` and give the smoke
test the same folder in `HNS_PERSIST_TO` (it moves the clock through it).

`simulate.mjs` plays whole rounds in real time (debug-mode timers): 36 phones
syncing like the real client, stalkers racing each other to pick, hiders
answering truthfully from where they really are, rounds ending by QR scan, by
the button, by question 7, with a pause, and with Play again. It checks that no
team ever sees another, that teammates always get the same cards, that the
Hints map (the real `src/hints.js`) always still contains the hider, and that
every result is right; then it prints latency per endpoint and the request
rate.

### Capacity

Each phone makes **one request every 5 seconds** (`POST /state` carries its
position and brings back the game), about 12 a minute. 36 players is then
~26,000 requests and as many D1 writes per hour. Cloudflare's free plan allows
100,000 Worker requests and 100,000 D1 row writes **per day**, so a 2-hour
event with 36 players fits, with room for testing earlier the same day. Longer
or bigger than that, check the account's plan first (Workers Paid lifts both
limits).

### API

| Method | Path          | Auth | Body / Result |
|--------|---------------|------|---------------|
| POST   | `/register`   | –    | `{username, password}` → `{token, user}` |
| POST   | `/login`      | –    | `{username, password}` → `{token, user}` |
| POST   | `/logout`     | ✓    | → `{ok}` (also clears location) |
| GET    | `/me`         | ✓    | → `{user}` |
| GET    | `/state`      | ✓    | players → `{serverNow, settings, me, team, users, cards}`; admins → `{serverNow, settings, me, teams, users, results}` |
| POST   | `/state`      | ✓    | same, with the caller's position as the body (`{lat, lng, accuracy?, fixAgeMs?, rttMs?}` or `{lat: null, lng: null}`) — the client's only sync call |
| POST   | `/location`   | ✓    | the position alone (older clients) |
| POST   | `/team/start` | team | start the round: hiding countdown, then the hunt |
| POST   | `/team/again` | team | after a round: back to ready, a new hider (whoever hid least, at random) |
| POST   | `/catch`      | stalker | `{code}` from the hider's QR → `{caught, team}` |
| POST   | `/found`      | stalker | no body — ends the own team's round without a scan |

`team` is where the caller's team is in its round: `phase` (`ready`, `hiding`,
`hunting`, `ended`), `hideRemainingMs`, `question` (1–6), `nextQuestionInMs`,
`huntMs`, `paused`, and once it ends `outcome` (`seekers` or `hider`),
`hiderName`, `caughtByName`. The client counts the timers down itself and asks
again the moment one reaches zero.

Positions are stamped with the age of the GPS fix (`fixAgeMs`), not the time
they were sent, and are `NULL` once older than 2 minutes, so a phone whose GPS
froze drops off the map instead of standing still looking live. Only non-null
locations get a pin. Admins additionally get `accuracy`, `rttMs` and
`lastSeenAt` per user, which drive the coordinates and signal icon on the admin
board. Players never receive these.

Admin-only routes (all `POST`):

| Path                | Body | Does |
|---------------------|------|------|
| `/admin/make-teams` | `{size?}` (2–8, default 4) | splits everyone not in a team into new teams, one hider each |
| `/admin/assign`     | `{userId, teamId, role}` | moves one player, online or not; `teamId` is a number, `"new"` or `null` (no team) |
| `/admin/team`       | `{teamId, action}` | `start`, `pause`, `resume` or `reset` one team |
| `/admin/disband`    | – | everyone back to no team (results are kept) |
| `/admin/clear`      | – | deletes every non-admin account, team and result |
| `/admin/settings`   | `{debug?, discordUrl?, todosDone?}` | debug mode, the Discord invite, the to-do ticks |

Every team keeps exactly one hider: making someone the hider turns the old one
into a stalker, and taking a team's hider away hands the role to whoever has
been on it longest. A team left empty is deleted.

**Debug mode** (admin switch): teams that start while it is on get a 1-minute
hide and a question every minute (a whole round in 7 minutes), and every
phone shows a strip with its GPS accuracy, the age of its fix, its heading and
its connection. A team keeps the timers it started with.

#### Cards

| Method | Path              | Auth | Body / Result |
|--------|-------------------|------|---------------|
| GET    | `/cards/catalog`  | ✓    | → the deck, landmarks and play area |
| POST   | `/cards/pick`     | stalker | `{cardId}` → `{playId}` |
| POST   | `/cards/answer`   | hider | `{playId, answer}` → `{ok, edited}`; sending it again for an answered card corrects it |
| POST   | `/cards/seen`     | ✓    | clears this user's bell |
| GET    | `/cards/history`  | ✓    | → `{plays}` for the caller's team |
| GET    | `/cards/photo`    | ✓    | `?playId=` → `{photo}` (a data URL) |

The `cards` block of `/state` differs by role: stalkers get the batch face up
(the oldest question they have not sent), `inHand` (how many they can send
right now) and the play made from that batch (so they watch the answer land);
the hider gets the questions they still owe and the ones they have answered.
Both get an `unread` count for the bell, and both get `hints` — the answered
geometry behind the Hints map. A corrected answer rings the stalkers' bell
again and is marked as changed.

### Game design notes

- **Teams are autonomous.** The admin forms them; each team starts, plays and
  ends on its own clock. Nothing in the database counts down: a team row keeps
  when it started and how long it was paused, and the phase, the question and
  the time left are worked out from that on every read. The one deadline that
  must be written down (question 7) is applied by the first request that
  notices it; there is no cron.
- **A question every 5 minutes, exactly.** Everyone knows when to look at their
  phone. (This replaces the earlier timer whose speed followed the heatmap under
  the hider — clever, but hard to follow for someone who wasn't listening.)
- **The batch is per team, not per stalker.** The first stalker to pick burns it
  for everyone, so the hider answers one question per interval no matter how
  many stalkers are hunting. Picking a card only marks it on that phone; Send
  is what plays it. Then the other two cards disappear and the sent one is
  stamped SENT · LOCKED IN until the hider's answer is written in.
- **Unsent questions pile up.** A question nobody sent before the next one
  arrived stays in hand. The oldest one in hand is face up, and the moment it
  is sent the next one is face up too, with no waiting for the timer; each keeps
  its own number and its own tier of cards. Whatever is still in hand when
  question 7 would arrive is lost with the round.
- **The deck has a running order.** Every card carries `tiers`: the question
  numbers it may be dealt as. Openers (`[1, 2]` — north/south, the named
  landmarks, the 500 m ring) cut the campus in half; closers (`[6]` — exact
  coordinates, the exact room id) end the round. `batches.js` prefers the tier
  matching the current question and widens to the nearest tiers when one has
  been picked clean.
- **No card is offered to the same team twice in a round.** Not just no card
  *played* twice — a card burnt unplayed in an earlier batch is still one the
  team has seen.
- **Everyone in a team sees the hints layer.** The stalkers watch the net
  close; the hider watches how much cover they have given away. It is built
  entirely out of answers the hider gave, so it tells them nothing they did not
  say. The hider's "which X are you closest to?" lists only offer the places
  still possible on that map, nearest first (the rest behind "Show more", in
  case an earlier answer was wrong).
- **The catch is the hider's to give.** Nothing about proximity ends a round —
  only the hider's own screen, held up and scanned (or the stalkers pressing
  the button). That keeps the final moment a face-to-face one, and a bad GPS
  fix can never cost someone the game.

### Configuring the play area

Every place in the game — the campus perimeter, the six landmarks, the 25
pavilions, 12 cafés, 23 bus stops and 6 àVélo stations — comes from
`locations/geojson/*.geojson`. Nothing is typed in by hand anywhere else.

```sh
npm run build:locations     # tools/build-locations.mjs
```

That reads the GeoJSON and writes two **generated** files, both committed:

| Generated | Used by | For |
|-----------|---------|-----|
| `src/locations.js` | `map.js` | the places a question pins on the map (with their pop-ups), the campus border the map opens on |
| `worker/src/locations.js` | `worker/src/cards.js` | `PLAY_AREA`, `LANDMARKS`, `LANDMARK_GROUPS` |

So the coordinates the map draws and the coordinates the Hints filter computes
with are the same numbers by construction. **Edit the GeoJSON and re-run the
generator — never the generated files.** The generator fails loudly if two
places in a layer would end up sharing an id, since ids are stored in
`card_plays.answer`.

Adding a place to a layer automatically adds it to that layer's card: drop a
feature into `cafes.geojson` and it becomes both a new pin on the map and a
new option on *"Which café are you closest to?"*. Adding a whole new `.geojson`
needs a matching entry in `tools/build-locations.mjs`.

The campus perimeter is not drawn by hand either. It is traced from
OpenStreetMap's streets: the innermost loop of the campus-side carriageways of
Ch. des Quatre-Bourgeois, Ch. Sainte-Foy, Av. Myrand, Bd René-Lévesque O.,
Bd Laurier and Autoroute Robert-Bourassa, cutting a corner on a turn lane where
one joins two of them (René-Lévesque onto Laurier, Quatre-Bourgeois onto
Robert-Bourassa). The tracer fails if any place in the game would end up
outside it. Run the other two generators after it:

```sh
npm run build:border        # tools/build-border.mjs -> campus-border.geojson
```

### The map

The map is drawn by the app, nothing is fetched as tiles: the campus from
OpenStreetMap's data (every road and path, never tunnels; buildings black;
woods, grass and fields dotted; the stadium and the track hatched), the hints
layer, the players and the question. It opens on the whole campus and never
zooms by itself.

- **One red thing at a time.** While nothing is waiting, the hints layer:
  everything the answers have ruled out is inverted (the white is where the
  hider can still be) and its edge is drawn by hand in red. While a question
  waits, only what it needs: the east/west or north/south line through the
  stalker who asked, the circle, the places of a "which X are you closest
  to?" (tap one for its name and where it is), or a tag on the landmark of a
  "closer than me?". The other players' pins step aside for a drawing.
- **The question in a box at the top**, with the time to the next one;
  between questions, when the next one comes, and, for the hider, how far the
  closest stalker is, scribbled in the box.
- **Players.** Everyone else is a red pushpin (tap it for the name); YOU is
  the red arrow, pointing the way your phone faces (the compass; iPhones ask
  once, from "Before you start"). It turns white when your GPS has stopped
  updating, and the app restarts the GPS by itself when that happens. The GPS
  only starts once location has been allowed or asked for, so the browser's
  prompt never comes before "Before you start" explains it.

The data is `src/data/campus-map.json`, **generated** from the campus as
GeoJSON (`design/promo/round-1/lab/data/osm-campus.json`, © OpenStreetMap
contributors, ODbL):

```sh
npm run build:map           # tools/build-map.mjs
```

Nothing outside the campus border is kept. Roads are cut where they cross it
(the street the border runs along stays drawn), and a building, wood or field
is kept only when it is wholly inside. That keeps the file near 80 KB, about
30 KB over the wire.
