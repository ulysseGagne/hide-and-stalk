// The campus border, traced from OpenStreetMap's streets instead of by hand.
//
//   npm run build:border     (node tools/build-border.mjs)
//
// Writes locations/geojson/campus-border.geojson; run `npm run build:locations`
// and `npm run build:map` after it (the play area and the map both follow it).
//
// Campus is the block inside six streets: Ch. des Quatre-Bourgeois, Ch.
// Sainte-Foy, Av. Myrand, Bd René-Lévesque O., Bd Laurier and Autoroute
// Robert-Bourassa. The border is the innermost loop their carriageways make
// around campus: the campus-side carriageway where a street has two (or a
// collector beside it), the street's centreline where it has one. At a corner
// it takes the turn lane from one street onto the next when there is one (a
// ramp that joins two of the six streets: René-Lévesque onto Laurier,
// Quatre-Bourgeois onto Robert-Bourassa), cutting the corner as the hand-drawn
// border did. A ramp that leaves a street and comes back to the same one (to
// a campus road, a bus loop) plays no part, nor do sidewalks and cycle tracks,
// nor anything that dead-ends (a carriageway that only closes a loop through a
// campus road ends up inside the border, not on it).
//
// The geometry is the map's own (design/promo/round-1/lab/data/osm-campus.json,
// fetched by design/promo/round-1/tools/fetch-osm.mjs), so the border lies
// exactly on the streets the map draws. That file keeps no street names, so
// which ways belong to which of the six streets is asked of the Overpass API
// (one small request). © OpenStreetMap contributors, ODbL.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "design/promo/round-1/lab/data/osm-campus.json");
const GEOJSON = path.join(ROOT, "locations/geojson");
const OUT = path.join(GEOJSON, "campus-border.geojson");
const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

const STREETS = ["Chemin des Quatre-Bourgeois", "Chemin Sainte-Foy", "Avenue Myrand", "Boulevard René-Lévesque Ouest", "Boulevard Laurier", "Autoroute Robert-Bourassa"];
const CARRIAGEWAY = new Set(["motorway", "trunk", "primary", "secondary", "tertiary", "residential", "unclassified"]);
// Douglas-Peucker tolerance, metres: well under a road's drawn width.
const TOLERANCE = 0.5;

const data = JSON.parse(fs.readFileSync(SRC, "utf8"));

// Which ways are the six streets.
const [W, S, E, N] = data.bbox;
const query = `[out:json][timeout:60];way["highway"]["name"~"^(${STREETS.join("|")})$"](${S},${W},${N},${E});out tags;`;
let raw = null;
// Overpass is often busy for a moment (HTTP 429 or 504): a few rounds, a pause between.
for (let round = 0; round < 4 && !raw; round++) {
    if (round) execFileSync("sleep", ["15"]);
    for (const url of ENDPOINTS) {
        try {
            raw = execFileSync("curl", ["-sfL", "--max-time", "60", "-A", "hide-and-stalk/1.0 (campus game map)", "--data-urlencode", `data=${query}`, url], { maxBuffer: 1 << 24 }).toString();
            break;
        } catch (e) {
            console.error(`${url}: ${e.message.split("\n")[0].slice(0, 80)}…`);
        }
    }
}
if (!raw) throw new Error("Overpass unreachable");
const streetOf = new Map(JSON.parse(raw).elements.map((el) => [`w${el.id}`, el.tags.name]));
const lines = data.features.filter((f) => f.geometry.type === "LineString");
const carriageways = lines.filter((f) => streetOf.has(f.properties.id) && CARRIAGEWAY.has(f.properties.highway));
if (!carriageways.length) throw new Error("none of the six streets is in the map's data");

// The turn lanes: ramps (joined end to end into one run where they meet) that
// touch two different streets of the six.
const streetsAt = new Map(); // a node -> the streets through it
for (const f of carriageways) {
    for (const c of f.geometry.coordinates) {
        const k = c.join();
        if (!streetsAt.has(k)) streetsAt.set(k, new Set());
        streetsAt.get(k).add(streetOf.get(f.properties.id));
    }
}
const ramps = lines.filter((f) => f.properties.highway?.endsWith("_link"));
const run = ramps.map((_, i) => i);
const runOf = (i) => (run[i] === i ? i : (run[i] = runOf(run[i])));
const rampAt = new Map();
ramps.forEach((f, i) => {
    for (const c of f.geometry.coordinates) {
        const k = c.join();
        if (rampAt.has(k)) run[runOf(i)] = runOf(rampAt.get(k));
        else rampAt.set(k, i);
    }
});
const joins = new Map(); // a run of ramps -> the streets it touches
ramps.forEach((f, i) => {
    const r = runOf(i);
    if (!joins.has(r)) joins.set(r, new Set());
    for (const c of f.geometry.coordinates) for (const street of streetsAt.get(c.join()) ?? []) joins.get(r).add(street);
});
const turnLanes = ramps.filter((_, i) => joins.get(runOf(i)).size > 1);
const ways = [...carriageways, ...turnLanes];

// Metres, near enough at this latitude (build-map.mjs's toM / toLL), about campus.
const LNG0 = -71.275;
const LAT0 = 46.782;
const toM = ([lng, lat]) => [(lng - LNG0) * 76230, (lat - LAT0) * 111200];
const toLL = ([x, y]) => [x / 76230 + LNG0, y / 111200 + LAT0];

// Every carriageway as segments, cut wherever two of them cross: bridges and
// tunnels cross without sharing a node, and the border turns there all the same.
const segs = [];
for (const w of ways) {
    const c = w.geometry.coordinates.map(toM);
    for (let i = 0; i < c.length - 1; i++) segs.push({ a: c[i], b: c[i + 1], cuts: [] });
}
const EPS = 1e-9;
const box = (s) => [Math.min(s.a[0], s.b[0]), Math.min(s.a[1], s.b[1]), Math.max(s.a[0], s.b[0]), Math.max(s.a[1], s.b[1])];
for (const s of segs) s.box = box(s);
for (let i = 0; i < segs.length; i++) {
    const p = segs[i];
    for (let j = i + 1; j < segs.length; j++) {
        const q = segs[j];
        if (p.box[0] > q.box[2] || q.box[0] > p.box[2] || p.box[1] > q.box[3] || q.box[1] > p.box[3]) continue;
        const rx = p.b[0] - p.a[0];
        const ry = p.b[1] - p.a[1];
        const sx = q.b[0] - q.a[0];
        const sy = q.b[1] - q.a[1];
        const d = rx * sy - ry * sx;
        if (Math.abs(d) < EPS) continue; // parallel: they meet, if at all, at shared nodes
        const t = ((q.a[0] - p.a[0]) * sy - (q.a[1] - p.a[1]) * sx) / d;
        const u = ((q.a[0] - p.a[0]) * ry - (q.a[1] - p.a[1]) * rx) / d;
        if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) continue;
        const tIn = t > EPS && t < 1 - EPS;
        const uIn = u > EPS && u < 1 - EPS;
        if (!tIn && !uIn) continue; // end to end: a shared node already
        // One point for both segments, an existing end where there is one, so they join exactly.
        const at = !uIn ? (u < 0.5 ? q.a : q.b) : !tIn ? (t < 0.5 ? p.a : p.b) : [p.a[0] + t * rx, p.a[1] + t * ry];
        if (tIn) p.cuts.push([t, at]);
        if (uIn) q.cuts.push([u, at]);
    }
}

// The street graph: points joined by the pieces between cuts.
const key = ([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`;
const point = new Map();
const next = new Map();
const join = (a, b) => {
    const ka = key(a);
    const kb = key(b);
    if (ka === kb) return;
    point.set(ka, a);
    point.set(kb, b);
    if (!next.has(ka)) next.set(ka, new Set());
    if (!next.has(kb)) next.set(kb, new Set());
    next.get(ka).add(kb);
    next.get(kb).add(ka);
};
for (const s of segs) {
    const run = [s.a, ...s.cuts.sort((x, y) => x[0] - y[0]).map(([, at]) => at), s.b];
    for (let i = 0; i < run.length - 1; i++) join(run[i], run[i + 1]);
}
// Dead ends never bound anything: take them off, back to where they branch.
for (let again = true; again; ) {
    again = false;
    for (const [k, ks] of next) {
        if (ks.size > 1) continue;
        for (const o of ks) next.get(o).delete(k);
        next.delete(k);
        again = true;
    }
}

// Campus: the middle of the pavilions.
const pavilions = JSON.parse(fs.readFileSync(path.join(GEOJSON, "pavillons.geojson"), "utf8")).features.map((f) => toM(f.geometry.coordinates));
const centre = [0, 1].map((i) => pavilions.reduce((sum, p) => sum + p[i], 0) / pavilions.length);

// The first street east of it, walked northward (campus on the left)...
let first = null;
for (const [ka, ks] of next) {
    for (const kb of ks) {
        const [a, b] = [point.get(ka), point.get(kb)];
        if (a[1] > centre[1] === b[1] > centre[1]) continue;
        const x = a[0] + ((centre[1] - a[1]) * (b[0] - a[0])) / (b[1] - a[1]);
        if (x > centre[0] && (!first || x < first.x)) first = { x, from: a[1] < b[1] ? ka : kb, to: a[1] < b[1] ? kb : ka };
    }
}
if (!first) throw new Error("no street east of campus");
// ...then always the sharpest left, all the way round: the loop that holds campus.
const angle = (ka, kb) => Math.atan2(point.get(kb)[1] - point.get(ka)[1], point.get(kb)[0] - point.get(ka)[0]);
const loop = [first.from];
let [from, to] = [first.from, first.to];
for (;;) {
    loop.push(to);
    if (loop.length > point.size + 1) throw new Error("the walk round campus never closed");
    const back = angle(to, from);
    let best = null;
    let bestTurn = Infinity;
    for (const k of next.get(to)) {
        if (k === from) continue;
        let turn = back - angle(to, k);
        while (turn <= 0) turn += 2 * Math.PI;
        if (turn < bestTurn) [best, bestTurn] = [k, turn];
    }
    [from, to] = [to, best];
    if (from === first.from && to === first.to) break;
}

// The loop, simplified, as an open chain closed again (build-map.mjs's simplify).
const distToSeg = (p, a, b) => {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
function simplify(pts, eps) {
    if (pts.length < 3) return pts;
    let at = 0;
    let far = 0;
    for (let i = 1; i < pts.length - 1; i++) {
        const d = distToSeg(pts[i], pts[0], pts[pts.length - 1]);
        if (d > far) [far, at] = [d, i];
    }
    if (far <= eps) return [pts[0], pts[pts.length - 1]];
    return simplify(pts.slice(0, at + 1), eps).slice(0, -1).concat(simplify(pts.slice(at), eps));
}
const open = simplify(loop.slice(0, -1).map((k) => point.get(k)), TOLERANCE);
const ringM = [...open, open[0]];

// Every place in the game has to be inside it.
const inside = ([x, y], ring) => {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
};
const outside = [];
for (const file of fs.readdirSync(GEOJSON)) {
    if (!file.endsWith(".geojson") || file === "campus-border.geojson") continue;
    for (const f of JSON.parse(fs.readFileSync(path.join(GEOJSON, file), "utf8")).features) {
        if (f.geometry.type === "Point" && !inside(toM(f.geometry.coordinates), ringM)) outside.push(`${file}: ${f.properties.name}`);
    }
}
if (outside.length) throw new Error(`outside the traced border:\n  ${outside.join("\n  ")}`);

let area = 0;
for (let i = 0; i < ringM.length - 1; i++) area += ringM[i][0] * ringM[i + 1][1] - ringM[i + 1][0] * ringM[i][1];
const round = (n) => Number(n.toFixed(7));
const ring = ringM.map(toLL).map(([lng, lat]) => [round(lng), round(lat)]);
const border = {
    type: "FeatureCollection",
    features: [
        {
            type: "Feature",
            properties: {
                name: "U. Laval campus loop",
                desc: "Closed loop along the campus-side lanes of Ch. des Quatre-Bourgeois, Ch. Sainte-Foy, Av. Myrand, Bd René-Lévesque O., Bd Laurier and Autoroute Robert-Bourassa. Source: OpenStreetMap.",
                source: `OpenStreetMap (data as of ${data.fetched}), traced by tools/build-border.mjs`,
            },
            // Counterclockwise, as GeoJSON has it.
            geometry: { type: "Polygon", coordinates: [ring] },
        },
    ],
};
fs.writeFileSync(OUT, `${JSON.stringify(border)}\n`);
console.log(`campus border: ${carriageways.length} carriageways and ${turnLanes.length} turn lanes, ${ring.length} points, ${(area / 2 / 1e4).toFixed(1)} ha -> ${path.relative(ROOT, OUT)}`);
