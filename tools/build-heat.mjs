// The heatmap the app draws, from tools/heat.mjs.
//
//   npm run build:heat       (node tools/build-heat.mjs; ~10 s)
//
// Writes src/data/campus-heat.json: each tier above white as smooth closed
// rings, cut at the campus border like the rest of the map, in the campus
// map's own coordinates (Web Mercator pixels at zoom 20, rounded, relative to
// the data's top-left corner, delta-encoded per ring), with a point every 3 m.
// src/mapdraw.js draws them as curves through those points, so the edges stay
// smooth at any zoom (and, with a point every 3 m along the border too, the
// border's corners stay corners). Run it again after anything tools/heat.mjs
// reads changes.

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { COLORS, borderM, contours, fromM, smoothRing, turf } from "./heat.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "src/data/campus-heat.json");
const Z = 20;
// The rings come every 1.5 m; every other point is plenty for a curve.
const EVERY = 2;

/** Web Mercator: lng/lat to global pixels at zoom z (src/mapdraw.js's project). */
function project(lng, lat, z) {
    const world = 256 * 2 ** z;
    const s = Math.sin((lat * Math.PI) / 180);
    return [((lng + 180) / 360) * world, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * world];
}

// Only campus: the map's data stops at its border.
const campus = turf.polygon([borderM]);
const tiers = contours().map((polys) =>
    polys
        .map((rings) => turf.intersect(turf.featureCollection([turf.polygon(rings), campus])))
        .filter(Boolean)
        .flatMap((cut) => (cut.geometry.type === "Polygon" ? [cut.geometry.coordinates] : cut.geometry.coordinates))
        .flat()
        // Evenly every 1.5 m again (the border's long straight stretches too), then every other point.
        .map((ring) => smoothRing(ring, 0).slice(0, -1).filter((_, i) => i % EVERY === 0).map((pt) => project(...fromM(pt), Z))),
);
let ox = Infinity;
let oy = Infinity;
for (const rings of tiers) for (const ring of rings) for (const [x, y] of ring) [ox, oy] = [Math.min(ox, x), Math.min(oy, y)];
ox = Math.floor(ox);
oy = Math.floor(oy);

const packed = tiers.map((rings) =>
    rings.map((ring) => {
        const out = [];
        let px = 0;
        let py = 0;
        for (const [x, y] of ring) {
            const rx = Math.round(x - ox);
            const ry = Math.round(y - oy);
            out.push(rx - px, ry - py);
            [px, py] = [rx, ry];
        }
        return out;
    }),
);

const json = JSON.stringify({
    about: "The heatmap: each tier above white as closed rings. Built by tools/build-heat.mjs from OpenStreetMap (© OpenStreetMap contributors, ODbL).",
    z: Z,
    origin: [ox, oy],
    colors: COLORS,
    tiers: packed,
});
writeFileSync(OUT, json);
const points = packed.reduce((n, rings) => n + rings.reduce((m, r) => m + r.length / 2, 0), 0);
console.log(`wrote ${OUT}: ${packed.length} tiers, ${packed.reduce((n, r) => n + r.length, 0)} rings, ${points} points, ${(json.length / 1024).toFixed(0)} KB`);
