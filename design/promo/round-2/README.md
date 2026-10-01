# Round 2: the redesign, built into the app

Round 1 (`../round-1/`) explored the redesign as mock-ups layered over the
old app; its review gallery (`../round-1/gallery/`) is the target. Round 2
builds it into `src/` for real. This folder shows the result without running
anything:

| Sheet | Gallery screens |
| --- | --- |
| `1-opening.png` | S12a, the home screen |
| `2-login.png` | S21-S27, log in and "Before you start" |
| `3-lobby.png` | S31-S32, waiting for a team, the role stamped |
| `4-hider.png` | S41-S44, the hider |
| `5-stalkers.png` | S51-S56, the stalkers (and the post's images 2 and 4) |
| `6-map.png` | S61-S69, the map (and the post's images 3, 5 and 6) |
| `7-end.png` | S71-S74, the end and the receipt |

On each sheet, left: the gallery's image; right: the real app, shot the same
way (same fake game state, same phone size, reached by the same taps). Small
differences in the random hand-drawn jitter, the clock's last second and a
word wrapping one line later (the gallery was rendered on a Mac) are expected;
anything else is listed in the pull request.

## Re-making the sheets

```sh
cd design/promo/round-1
npm install
node tools/shoot-app.mjs real            # every screen -> shots/real/R-*.png
cd ../../..
node design/promo/round-2/tools/compare.mjs    # -> design/promo/round-2/*.png
```

`tools/shoot-app.mjs real` serves the real `src/` (no stylesheet swap, no
`decorate.js`) against the fake game server in `../round-1/app/fake-api.mjs`.
Each screen is reached the way a player gets there: a tap on the home screen,
the permissions sheet, a card picked, a tab opened. The map screens
(`MAP_SCREENS` in `fake-api.mjs`) are set up from what the lab drew: its view,
where YOU stood and faced, where the pins were, read off the lab's own
drawing by `tools/capture-lab-maps.mjs` (into `../round-1/app/lab-maps.json`).

## The other tools

- `tools/measure-map.mjs`: the map on a phone, throttled (Lighthouse's mobile
  profile: the CPU 4x slower, slow 4G): download size, time to the map data
  and to a full screen of tiles, frame times while panning and zooming.
- `tools/click-through.mjs`: a whole round in two browsers against a local
  worker (register, "Before you start", lobby, hide, a question picked, sent
  and answered, the QUESTIONS tab, both maps, found, the receipt, Play
  again), a screenshot at every step.
