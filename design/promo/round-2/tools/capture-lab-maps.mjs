// The gallery's map screens, as the lab drew them: for each one, the map's
// view (centre and zoom), where YOU was, which way YOU faced, and where the
// other players' pins were. round-1's app/fake-api.mjs (MAP_SCREENS) sets the
// real app up the same way, so each map can be compared like for like.
//
//   node design/promo/round-2/tools/capture-lab-maps.mjs > design/promo/round-1/app/lab-maps.json
//
// The lab places YOU and the stalkers by screen position (lab/maps2.js,
// drawPost) or from its scripted games (lab/maps.js, GAMES); this reads them
// back off the drawing: Leaflet's map, the pins Ink.pin drew, and the seed
// YOU's mark draws its edge with.
import { serve, browser, context } from "../../round-1/tools/lib.mjs";
import * as turf from "../../round-1/node_modules/@turf/turf/dist/esm/index.js";


// [screen, lab set, lab code, what YOU faces]
const SCREENS = [
    ["g9a", "post", "g9a", { deg: 225 }],
    ["g10a", "post", "g10a", { deg: 225 }],
    ["g11a", "post", "g11a", { deg: 225 }],
    ["v2c", "post", "v2c", { place: ["velo", "velo_63"] }],
    ["v8c", "post", "v8c", { place: ["velo", "velo_63"] }],
    ["n11d", "post", "n11d", { deg: 270 }],
    ["N10.2", "map2", "10.2", { nearest: "pins" }],
    ["N12", "map2", "12", { nearest: "greenhouses" }],
    ["N14", "map2", "14", { nearest: "pubu" }],
];

const { server, base } = await serve(7900 + Math.floor(Math.random() * 300));
const b = await browser();
const out = {};
for (const [name, set, code, face] of SCREENS) {
    const ctx = await context(b, { viewport: { width: 375, height: 812 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.error(`[${name}] pageerror:`, e.message));
    await page.addInitScript(() => {
        window.__maps = [];
        window.__pins = [];
        window.__you = null;
        let L0;
        Object.defineProperty(window, "L", {
            configurable: true,
            get: () => L0,
            set(v) {
                L0 = v;
                const make = v.map;
                v.map = function (...args) {
                    const m = make.apply(this, args);
                    window.__maps.push(m);
                    return m;
                };
            },
        });
        let Ink0;
        Object.defineProperty(window, "Ink", {
            configurable: true,
            get: () => Ink0,
            set(v) {
                Ink0 = v;
                const pin = v.pin;
                v.pin = (x, y, o) => {
                    window.__pins.push([x, y, o?.size ?? 9]);
                    return pin(x, y, o);
                };
                const rng = v.rng;
                v.rng = (seed) => {
                    const m = /^yp(-?\d+),(-?\d+)$/.exec(String(seed));
                    if (m) window.__you = [Number(m[1]), Number(m[2])];
                    return rng(seed);
                };
            },
        });
    });
    await page.goto(`${base}/design/promo/round-1/lab/view.html?set=${set}&v=${code}&w=375&h=812`);
    await page.waitForSelector("body[data-ready='1']", { timeout: 60000 });
    const got = await page.evaluate(() => {
        const HEAD = 104;
        const m = window.__maps.find((x) => x.getSize().x === 375 && x.getSize().y > 600);
        const ll = (x, y) => {
            const p = m.containerPointToLatLng([x, y - HEAD]);
            return { lat: p.lat, lng: p.lng };
        };
        const c = m.getCenter();
        return {
            view: { lat: c.lat, lng: c.lng, zoom: m.getZoom(), h: m.getSize().y },
            you: window.__you ? ll(...window.__you) : null,
            pins: window.__pins.filter((p) => p[2] === 9).map(([x, y]) => ll(x, y)),
            // The post's north or south (n11d): the question asked from the line, placed on screen at (W/2, 348).
            line: ll(375 / 2, 348),
            games: { greenhouses: window.Maps.GAMES.greenhouses(), pubu: window.Maps.GAMES.pubu() },
            velo: window.Campus.layers.velo.places.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng })),
        };
    });
    // Which way YOU faces, as the lab had it: a fixed heading, a place, or the closest stalker.
    const at = (p) => [p.lng, p.lat];
    let deg = face.deg;
    if (face.place) {
        const st = got.velo.find((p) => p.id === face.place[1]);
        deg = turf.bearing(turf.point(at(got.you)), turf.point(at(st)));
    } else if (face.nearest) {
        const others = face.nearest === "pins" ? got.pins.map(at) : Object.values(got.games[face.nearest].pos);
        const near = others.sort((a, b) => turf.distance(turf.point(at(got.you)), turf.point(a)) - turf.distance(turf.point(at(got.you)), turf.point(b)))[0];
        deg = turf.bearing(turf.point(at(got.you)), turf.point(near));
    }
    out[name] = { view: got.view, you: got.you, deg: Math.round(((deg % 360) + 360) % 360), pins: got.pins, ...(name === "n11d" ? { asker: got.line } : {}) };
    if (name === "N14") out.pubu = got.games.pubu;
    await ctx.close();
}
await b.close();
server.close();
process.stdout.write(JSON.stringify(out, null, 1) + "\n");
