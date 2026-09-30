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

Gallery (all images, with Keep + notes): https://claude.ai/artifact/LdRszjr2qKJ9ckB1ZLNKgJ

| Path | What |
| --- | --- |
| `lab/ink.js` | The red layer: single-stroke capitals jittered per letter and drawn with perfect-freehand (Apple Pencil look), strike-outs, circles, arrows, coloured-in fills, wobbly lines, pins, string |
| `lab/logo.js` | Set L: the HIDE AND ~~SEEK~~ STALK lockups |
| `lab/campus.js` | The real campus plan from `src/locations.js`, and truthful eliminations folded with turf like `src/hints.js` |
| `lab/board.js` | Set B: the conspiracy boards |
| `lab/welcome.js` | Set W (welcome screens) and set H (handwriting comparison) |
| `app/style-*.css`, `app/decorate.js` | Directions A-D: restyles of the real app, plus the drawn marks on top |
| `app/fake-api.mjs` | Scripted game states for team 3 (real deck, truthful answers) |
| `tools/` | Static server, Playwright shooters, contact sheets |

```sh
npm install                                   # here, in design/promo/round-1
node tools/shoot-lab.mjs logo 1 12 375 480    # L01-L12
node tools/shoot-lab.mjs board 1 12 375 440   # B01-B12
node tools/shoot-lab.mjs board 13 24 375 480  # B13-B24, second pass (lab/board2.js)
node tools/shoot-lab.mjs welcome 1 12 375 812 # W01-W12
node tools/shoot-lab.mjs welcome 13 24 375 812 # W13-W24, second pass (lab/welcome2.js)
node tools/shoot-lab.mjs logo 1.1,1.2,1.3,1.4,1.5,1.6,2.1,2.2,3.1,3.2,7.1,7.2,7.3,7.4,12.1 0 375 520 L
node tools/shoot-lab.mjs hand 4 5 375 700 H   # H04-H05, the handwriting band
node tools/shoot-lab.mjs hand 1 3 375 560 H   # H01-H03
node tools/shoot-app.mjs e                     # E-01 ... E-21, the app (direction E; A-D retired)
node tools/shoot-lab.mjs arrow 1 8 375 420 R  # R01-R08, notification arrow options
node tools/shoot-lab.mjs wild 1 83 375 812 X  # X01-X83, the wild concepts (lab/wild.js, lab/wild2.js)
node tools/shoot-lab.mjs map 1 26 375 812 M   # M01-M26, first map pass (retired)
node tools/shoot-lab.mjs map2 1 16 375 812 N  # N01-N16, the map screen redone (lab/maps2.js)
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

The map (lab/maps2.js): everything needed is computer-drawn (tiles in 1-bit
black and white, hints layer, name tags, the question in a box at the top).
One red thing at a time: the hints layer while nothing is waiting, else only
the waiting question's drawing. No auto-zoom. At most one string (hider to
closest stalker).
