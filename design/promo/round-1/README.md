# Round 1: design exploration

Everything here is code. Nothing in `src/` is changed yet; the chosen
direction gets built into the app in round 2.

**House rule:** nothing red is ever perfectly straight or round. Every
stroke goes through `humanize()` in `lab/ink.js` (slow seeded wobble, more on
long lines); string, pins and red fills are drawn, never CSS shapes. In round
2 this includes the map: the hider-to-stalker tethers, the north/south line,
radius circles and the Hints border all get drawn the same way.

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
node tools/shoot-lab.mjs welcome 1 12 375 812 # W01-W12
node tools/shoot-lab.mjs hand 1 3 375 560 H   # H01-H03
node tools/shoot-app.mjs a,b,c,d              # A/01 ... D/13
node tools/shoot-lab.mjs wild 1 56 375 812 X  # X01-X56, the wild concepts (lab/wild.js)
```

The app's libraries are served from `node_modules` (same packages as the
unpkg links in `src/index.html`). Map tiles are blocked in the cloud
environment for now, so the map set (M) is still to come.
