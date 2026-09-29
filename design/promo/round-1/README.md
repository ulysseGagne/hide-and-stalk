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
node tools/shoot-lab.mjs board 13 22 375 480  # B13-B22, second pass (lab/board2.js)
node tools/shoot-lab.mjs welcome 1 12 375 812 # W01-W12
node tools/shoot-lab.mjs welcome 13 24 375 812 # W13-W24, second pass (lab/welcome2.js)
node tools/shoot-lab.mjs logo 1.1,1.2,1.3,1.4,1.5,1.6,2.1,2.2,3.1,3.2,7.1,7.2,7.3,7.4,12.1 0 375 520 L
node tools/shoot-lab.mjs hand 4 5 375 700 H   # H04-H05, the handwriting band
node tools/shoot-lab.mjs hand 1 3 375 560 H   # H01-H03
node tools/shoot-app.mjs a,b,c,d              # A/01 ... D/13
node tools/shoot-lab.mjs wild 1 83 375 812 X  # X01-X83, the wild concepts (lab/wild.js, lab/wild2.js)
node tools/shoot-lab.mjs map 1 26 375 812 M   # M01-M26, maps on real OSM tiles (lab/maps.js)
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
