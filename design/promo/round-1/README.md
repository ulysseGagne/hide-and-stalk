# Round 1: design exploration

Everything here is code. Nothing in `src/` is changed yet; the chosen
direction gets built into the app in round 2.

**House rule:** nothing red is ever perfectly straight or round. Every
stroke goes through `humanize()` in `lab/ink.js` (slow seeded wobble, more on
long lines); string, pins and red fills are drawn, never CSS shapes. In round
2 this includes the map: the hider-to-stalker tethers, the north/south line,
radius circles and the Hints border all get drawn the same way.

**Handwriting band:** H1 (calm) is 0% and H3 (unhinged) is 100% of one
scale; app text lives between 30% and 70% of it. Every line has a score
from 0 (30%) to 1 (70%): pass `score`, or let `Ink.score(size, importance)`
work it out (`key` < `info` < `aside` < `vibe`; bigger text leans wilder).
`write()` and `note()` use it whenever no explicit `mess` is given.

Gallery (all images, with Keep + notes): https://claude.ai/artifact/He5TXmq1iCTb7XiyVuGYRk
(the up-to-date one, version 6, Sept 30, on the ugagne08 login). Color Map
Editor: https://claude.ai/artifact/Y6kmr77pJjn1JwPpUyfp9n (same login). Older
galleries: https://claude.ai/artifact/6LoZgEJAQMzaR6Z6AintGP (version 14, the
other login) and https://claude.ai/artifact/LdRszjr2qKJ9ckB1ZLNKgJ (this
login's first, shared by link, left as it was). Each login can only publish to
its own; notes left on the other login's gallery can't be read from this one.

## Where things stand (handoff, Sept 30, second session)

The page `gallery.html` in this folder is the source of the gallery above.
Whichever login picks this up: read the up-to-date gallery with the Artifact
tool (`read`, and `paths` to pull its images, since `shots/` is gitignored), or
re-render every image with the commands below, then publish `gallery.html`
with its `shots/` to that login's own artifact. The user reviews live:
republish after every change they might want to see.

- **Decided:** logo L16.6b, handwriting H06, board B29, ransom notes C19,
  notification arrow R10.3, skin S20, YOU = Yn on every map.
- **B29 is the source of truth** for the board and its pieces: File Nº 005
  is always HIDER LOCATION (two lines: within 500 m, closest café; where
  exactly is gone), the hider's profile, W53's Polaroid with the coordinates,
  the north-or-south card with NORTH big (`nsCard`). `b29()` places the
  pieces and strings anywhere.
- **Home screen:** the user picked W54.1 (the title over all of B29). This
  pass, one 30 px margin everywhere: W54.1a (black lines centred on SEEK's
  axis, the red keeps its place; past scale 0.88 STALK nears the edge),
  W54.1b (lockup centred), W54.1c (cards overlapping, pinned, no strings),
  W54.1d (top cards tucked under the title), W54.1e (with LET ME IN); W55.1
  and W55.2, the home screen in two steps (title alone, then the board under
  the app's header with LET ME IN). The string checker treats the title and
  the button as obstacles (`s.avoid`); `s.loose` allows overlapping pieces.
- **App (E):** this pass: E01's arrow above NEW, stamps bolder (E12, E13),
  E14's MORE arrow like E19's, E18 asks for the nearest place to sit (card
  `photo_seat`, the bench from `app/bench.svg`), E19/E20 ticks on their
  circles, E21's tick sharp (`Ink.sharpCheck`). NOAH_B is NOAH everywhere.
- **Map.** S20 (streets and buildings black, woods in close dots, grass in
  sparse ones, the stadium and track hatched) with the key's fourth pass:
  - `KEY4`, `kindOf4`, `lineOn`, `areaOf4` in `lab/osmdraw.js`: streets on;
    footpaths and bike paths on unless small and messy (`sortPaths`: small
    loops, loose pieces under 60 m, knots in a 40 m box, stubs under 20 m);
    parking aisles and driveways on; service roads, sidewalks, tracks off;
    car parks, tunnels, railway, water, squares, land use off; the Rouge et
    Or stadium (`leisure=stadium`) and the running track (`leisure=track`)
    as their own area. Legend K04, key map S30.03a (skin code 30.03).
  - Hand edits: the user switches ways on or off in the Color Map Editor
    (`key-editor/`, data from `tools/export-key-editor.mjs`). Its database
    holds collection `overrides`, one document per kind (`{ ways: { osmId:
    true|false } }`). To bake them: ArtifactData `list` of `overrides` with
    `out_dir`, then `node tools/bake-key-overrides.mjs <that dir>/overrides`,
    which writes `lab/data/key-overrides.json`; re-render the key map, S20
    and the N screens, and republish. Baked last at 5:37 AM (1,013 ways);
    the user was still editing.
  - Next, asked but not started: smoothing over every path and road (roads
    only a little; footpaths and bike paths are the worst). Paths are already
    simplified and corner-cut (`smoothLine`).
- **Map screens:** section 2 (N2a, N3a) and 3 (N08, N08a with filled pins,
  N08.2a the café tapped, N10.1 with a white GREENHOUSES tag, N11 with WEST
  and EAST bolder, N13, N15 without its subtitle) all on S20. White tags are
  one outlined shape, pointer included; YOU is Yn, facing the hider (or, for
  the hider, the closest stalker).
- **Rendering on Linux:** `tools/lib.mjs` turns off LCD text (grey edges, as
  on the Mac), and `tools/shoot-app.mjs` gives pages the iPhone's compass
  permission hook so the compass notice shows, as it always did on the Mac.

| Path | What |
| --- | --- |
| `lab/ink.js` | The red layer: single-stroke capitals jittered per letter and drawn with perfect-freehand (Apple Pencil look), strike-outs, circles, arrows, coloured-in fills, wobbly lines, pins, string |
| `lab/logo.js` | Set L: the HIDE AND ~~SEEK~~ STALK lockups |
| `lab/campus.js` | The real campus plan from `src/locations.js`, and truthful eliminations folded with turf like `src/hints.js` |
| `lab/osmdraw.js` | The map drawn from OpenStreetMap's data (S20 and the colour-coded key, fourth pass): every road, path, building and green as a real shape, in our own style |
| `lab/data/key-overrides.json` | The Color Map Editor's choices, baked in (`tools/bake-key-overrides.mjs`): OSM way id -> on |
| `key-editor/` | The Color Map Editor artifact (`index.html`, and `ways.json` from `tools/export-key-editor.mjs`) |
| `lab/data/osm-campus.json` | That data for the campus, as GeoJSON (`tools/fetch-osm.mjs`; © OpenStreetMap contributors, ODbL) |
| `lab/board.js` | Set B: the conspiracy boards |
| `lab/home3.js` | B25-B29, the home screens W31-W55 and the ransom notes; B29's pieces (`file29`, `profile`, `photo`, `nsCard`, `b29()`) |
| `lab/welcome.js` | Set W (welcome screens) and set H (handwriting comparison) |
| `app/style-*.css`, `app/decorate.js` | Directions A-D: restyles of the real app, plus the drawn marks on top |
| `app/fake-api.mjs` | Scripted game states for team 3 (real deck, truthful answers) |
| `tools/` | Static server, Playwright shooters, contact sheets |

```sh
npm install                                   # here, in design/promo/round-1
npm install --no-save playwright-core         # on a Mac: drives the installed Google Chrome
node tools/shoot-lab.mjs logo 1 12 375 480    # L01-L12
node tools/shoot-lab.mjs board 1 12 375 440   # B01-B12
node tools/shoot-lab.mjs board 13 24 375 480  # B13-B24, second pass (lab/board2.js)
node tools/shoot-lab.mjs welcome 1 12 375 812 # W01-W12
node tools/shoot-lab.mjs welcome 13 24 375 812 # W13-W24, second pass (lab/welcome2.js)
node tools/shoot-lab.mjs welcome 42 47 375 812 # W42-W47, L16.6b and two of B29's pieces (lab/home3.js)
node tools/shoot-lab.mjs logo 1.1,1.2,1.3,1.4,1.5,1.6,2.1,2.2,3.1,3.2,7.1,7.2,7.3,7.4,12.1 0 375 520 L
node tools/shoot-lab.mjs hand 4 5 375 700 H   # H04-H05, the handwriting band
node tools/shoot-lab.mjs hand 1 3 375 560 H   # H01-H03
node tools/shoot-app.mjs e                     # E-01 ... E-21, the app (direction E; A-D retired)
node tools/shoot-lab.mjs arrow 1 8 375 420 R  # R01-R08, notification arrow options
node tools/shoot-lab.mjs wild 1 83 375 812 X  # X01-X83, the wild concepts (lab/wild.js, lab/wild2.js)
node tools/shoot-lab.mjs map 1 26 375 812 M   # M01-M26, first map pass (retired)
node tools/shoot-lab.mjs map2 1 16 375 812 N  # N01-N16, the map screen redone (lab/maps2.js)
node tools/shoot-lab.mjs map2 08.1,08.2,10.1 0 375 812 N  # variants: B29's pushpins, a café tapped
node tools/fetch-osm.mjs                        # the campus from OpenStreetMap's data, once (Overpass, no key)
node tools/shoot-lab.mjs skin 30.2a,30.2b 0 375 812 S  # S11, whole campus and a few blocks (codes in SKIN_ALIAS, lab/maps2.js; c is a close-up)
node tools/shoot-lab.mjs skin 30.02a 0 375 812 S  # the colour-coded key map, third pass: paths kept or left behind (30.0, 30.01: earlier passes)
node tools/shoot-lab.mjs osmkey 3 3 375 480 K  # K03, its legend
node tools/shoot-lab.mjs tags a,c,f,g,k,l 0 240 175 T  # other players' tags
node tools/shoot-lab.mjs tags Yg,Yh,Yj,Ym,Yn 0 240 175 ""  # YOU's heading marks
node tools/shoot-lab.mjs arrow 10.3 0 375 420 R  # R10.3, the notification arrow (decided)
node tools/shoot-lab.mjs welcome 53 53 375 812 # W53, the home screen: the file and the Polaroid (lab/home3.js)
node tools/shoot-lab.mjs board 29 29 375 480 B  # B29, the board (the source of truth)
node tools/shoot-lab.mjs welcome 54.1,54.1a,54.1b,54.1c,54.1d,54.1e,55.1,55.2 0 375 812 W  # W54.1 and its variations, W55 in two steps
node tools/shoot-lab.mjs osmkey 4 4 375 640 K  # K04, the key's legend, fourth pass
node tools/shoot-lab.mjs skin 30.03a,31.22a,31.22b 0 375 812 S  # the key map, and S20 with the key (whole campus, a few blocks)
node tools/shoot-lab.mjs hint 2a,3a 0 375 812 N  # the hints layer on S20
node tools/shoot-lab.mjs map2 08,08a,08.2a,10.1,11,13,15 0 375 812 N  # the question screens on S20
node tools/shoot-app.mjs e                     # E-01 ... E-24b (needs app/bench.svg: node tools/export-bench.mjs)
node tools/export-key-editor.mjs               # key-editor/ways.json, for the Color Map Editor
node tools/bake-key-overrides.mjs <dir>        # the editor's choices -> lab/data/key-overrides.json
```

The app's libraries are served from `node_modules` (same packages as the
unpkg links in `src/index.html`). OpenStreetMap tiles are fetched once with
curl and cached in `tools/.tiles/` (gitignored), so re-shooting never hits the
tile servers again.

## Round 2: app changes the mockups already assume

Mocked on top of the current app in `app/decorate.js`; they need real code in `src/`:

- Picking a card and sending it are two steps: tap picks (hand-drawn box), a
  separate Send button sends. Today a tap sends.
- SENT · LOCKED IN only while the hider hasn't answered; afterwards an
  ANSWERED stamp over the question (never over a photo).
- Rules in order of importance: near a path, walks, no tunnels, nothing to
  open, truthfully, found, timings, Discord last. Two underlined.
- Hider's radio answers: the ring stays; the pick is ticked by hand.
- A notification gets a big red arrow at the bell until it's read.
- Browser-style MENU / MAP tabs.

House rules from the feedback, for every screen:

- Buttons: white + border = not yet; black = press this now; red (drawn) =
  pressed or picked.
- At most two red highlights on a screen.
- No new text for flavour; new wording only replaces existing text.
- One typeface in the app (the case-file mono is out).

Direction E (`app/style-e.css`, `prune()` in `app/decorate.js`) is the one
to build. Round 2 also needs:

- First launch: a "Before you start" sheet for the two permissions, location
  (needed) and compass (optional, iPhone "motion and orientation"), one
  button each: Turn on → Asking… → On (ticked) / How to fix; Later → Done.
  Same flow as marathon-quebec-2026/pacer (`#sheet-welcome`, renderWelcome in
  pacer/js/app.js), replacing the two notices at first launch.
- The camera (scan) button leaves the header; the scanner opens from the
  in-page "Found them? Scan their code" button.
- Everything prune() hides gets removed from src/ for that phase.
- The header's red goes black while anything else on screen is red.
- Before the game: the rules one at a time, OK on each, the player's
  initials drawn on its line; Done after the last (X45).
- End screens: the round as a receipt (questions, answers, hide and hunt
  time, found by / where redacted, campus left as a hand-coloured bar).

The map (lab/maps2.js): everything needed is computer-drawn (the map itself
from OpenStreetMap's data in lab/osmdraw.js, no tiles; hints layer, name tags,
the question in a box at the top).
One red thing at a time: the hints layer while nothing is waiting, else only
the waiting question's drawing. No auto-zoom. At most one string (hider to
closest stalker).
