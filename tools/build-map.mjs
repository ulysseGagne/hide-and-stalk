// The campus map, drawn from OpenStreetMap's data instead of its tiles.
//
//   npm run build:map        (node tools/build-map.mjs)
//
// Reads the campus as GeoJSON (design/promo/round-1/lab/data/osm-campus.json,
// fetched from Overpass by design/promo/round-1/tools/fetch-osm.mjs;
// © OpenStreetMap contributors, ODbL) and writes src/data/campus-map.json:
// only what the map draws, already sorted into what it is drawn as, simplified
// and packed small enough for a phone. src/mapdraw.js draws it.
//
// What is kept is the decided map, S20 (skin "datablackdotsall" in
// design/promo/round-1/lab/maps2.js and osmdraw.js): every road and path
// OpenStreetMap has (tunnels never: the house rules say no tunnels), the
// buildings, and the key's areas (woods and scrub, grass with parks and
// fields, the stadium and the running track). Railway, water, car parks and
// land use are left off, as the key decided.
//
// And only campus: nothing outside the campus border
// (locations/geojson/campus-border.geojson, traced from the streets by
// tools/build-border.mjs). Roads are cut where they cross it, the streets it
// runs along kept; an area is kept only when it is wholly inside.
//
// Coordinates are Web Mercator pixels at zoom 20 (about 0.1 m here), rounded,
// relative to the data's top-left corner, and delta-encoded per line.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC = path.join(ROOT, "design/promo/round-1/lab/data/osm-campus.json");
const BORDER = path.join(ROOT, "locations/geojson/campus-border.geojson");
const OUT = path.join(ROOT, "src/data/campus-map.json");
const Z = 20;
// Douglas-Peucker tolerance in zoom-20 pixels: 2 px is about 0.2 m, under a
// pixel even at the map's closest zoom (19).
const TOLERANCE = 2;
// How far off the border line still counts as on it, in zoom-20 pixels (about
// 2 m): the border is the middle of a street, which stays on the map.
const ON_BORDER = 20;

// Road ranks (osmdraw.js): the lab's RANK_OF, and pedestrian streets drawn as
// side streets (the key's rule).
const RANK_OF = {
    motorway: "major", trunk: "major", primary: "major", motorway_link: "major", trunk_link: "major", primary_link: "major",
    secondary: "medium", tertiary: "medium", secondary_link: "medium", tertiary_link: "medium",
    residential: "minor", unclassified: "minor", living_street: "minor", road: "minor",
    service: "service",
    footway: "path", path: "path", cycleway: "path", pedestrian: "path", steps: "path", track: "path", bridleway: "path", platform: "path",
};
const RANKS = ["major", "medium", "minor", "service", "aisle", "path"];
const GREEN_OF = {
    "natural=wood": "wood", "landuse=forest": "wood", "natural=scrub": "scrub", "natural=wetland": "grass", "natural=grassland": "grass", "natural=heath": "grass",
    "landuse=grass": "grass", "landuse=meadow": "grass", "landuse=village_green": "grass", "landuse=recreation_ground": "park", "landuse=cemetery": "cemetery",
    "landuse=orchard": "orchard", "landuse=allotments": "allotments", "landuse=farmland": "farm",
    "leisure=park": "park", "leisure=garden": "grass", "leisure=golf_course": "grass", "leisure=common": "grass", "leisure=nature_reserve": "grass",
    "leisure=pitch": "pitch", "leisure=track": "pitch", "leisure=playground": "park",
};
const tagOf = (p, table) => {
    for (const k of ["natural", "landuse", "leisure", "amenity"]) if (p[k] && table[`${k}=${p[k]}`]) return table[`${k}=${p[k]}`];
    return null;
};

/** What a feature is drawn as on S20, or null when the map leaves it off. */
function classify(f) {
    const p = f.properties;
    const g = f.geometry;
    const area = g.type !== "LineString";
    const rings = g.type === "Polygon" ? g.coordinates : g.type === "MultiPolygon" ? g.coordinates.flat() : [g.coordinates];
    if (p.building && p.building !== "no" && area) return p.location === "underground" ? null : { kind: "building", rings };
    if (p.highway && !area) {
        const layer = Number(p.layer ?? 0);
        const tunnel = p.tunnel === "yes" || p.tunnel === "culvert" || layer < 0 || p.indoor === "yes";
        if (tunnel) return null;
        let rank = p.service === "parking_aisle" || p.service === "driveway" ? "aisle" : RANK_OF[p.highway];
        if (!rank) return null;
        if (p.highway === "pedestrian") rank = "minor";
        const up = (p.bridge !== undefined && p.bridge !== "no") || layer > 0;
        return { kind: "road", rank, up, line: rings[0], smooth: RANK_OF[p.highway] === "path" };
    }
    if (!area) return null;
    const green = tagOf(p, GREEN_OF);
    if (green) {
        if (green === "wood" || green === "scrub") return { kind: "wood", rings };
        if (p.leisure === "track") return { kind: "sport", rings };
        return { kind: "grass", rings };
    }
    if (p.leisure === "stadium" || p.leisure === "track") return { kind: "sport", rings };
    return null;
}

// Metres, near enough at this latitude (osmdraw.js's toM / toLL).
const toM = ([lng, lat]) => [lng * 76230, lat * 111200];
const toLL = ([x, y]) => [x / 76230, y / 111200];
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
/**
 * A path as the lab draws it (osmdraw.js's smoothLine): the mapped line's
 * jitter taken out (anything within 2 m of a straight run), then its corners
 * rounded off (three passes of corner cutting). The ends stay put.
 */
function smoothLine(line) {
    if (line.length < 3) return line;
    let pts = simplify(line.map(toM), 2);
    for (let k = 0; k < 3 && pts.length > 2; k++) {
        const out = [pts[0]];
        for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i];
            const b = pts[i + 1];
            if (i > 0) out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
            if (i < pts.length - 2) out.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
        }
        out.push(pts[pts.length - 1]);
        pts = out;
    }
    return pts.map(toLL);
}

// Web Mercator, zoom-20 pixels.
const WORLD = 256 * 2 ** Z;
const project = ([lng, lat]) => {
    const s = Math.sin((lat * Math.PI) / 180);
    return [((lng + 180) / 360) * WORLD, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * WORLD];
};

// The campus border, in the same zoom-20 pixels.
const border = JSON.parse(fs.readFileSync(BORDER, "utf8")).features[0].geometry.coordinates[0].map(project);
const insideBorder = ([x, y]) => {
    let c = false;
    for (let i = 0, j = border.length - 1; i < border.length; j = i++) {
        const [xi, yi] = border[i];
        const [xj, yj] = border[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
};
const onCampus = (p) => insideBorder(p) || border.some((a, i) => i > 0 && distToSeg(p, border[i - 1], a) <= ON_BORDER);
const lerp = (a, b, t) => [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
/** Where the segment a-b crosses the border, as fractions of the way from a to b. */
function crossings(a, b) {
    const out = [];
    for (let i = 1; i < border.length; i++) {
        const c = border[i - 1];
        const d = border[i];
        const den = (b[0] - a[0]) * (d[1] - c[1]) - (b[1] - a[1]) * (d[0] - c[0]);
        if (!den) continue;
        const t = ((c[0] - a[0]) * (d[1] - c[1]) - (c[1] - a[1]) * (d[0] - c[0])) / den;
        const u = ((c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0])) / den;
        if (t > 0 && t < 1 && u >= 0 && u <= 1) out.push(t);
    }
    return out.sort((x, y) => x - y);
}
/** A line's pieces on campus: cut where it crosses the border, each bit kept when its middle is on campus. */
function clipLine(line) {
    const pieces = [];
    let piece = null;
    for (let i = 0; i < line.length - 1; i++) {
        const at = [0, ...crossings(line[i], line[i + 1]), 1];
        for (let k = 0; k < at.length - 1; k++) {
            const p = lerp(line[i], line[i + 1], at[k]);
            const q = lerp(line[i], line[i + 1], at[k + 1]);
            if (!onCampus(lerp(p, q, 0.5))) {
                piece = null;
                continue;
            }
            if (!piece) pieces.push((piece = [p]));
            piece.push(q);
        }
    }
    return pieces;
}

const data = JSON.parse(fs.readFileSync(SRC, "utf8"));
const drawn = data.features.map(classify).filter(Boolean);
for (const f of drawn) if (f.kind === "road" && f.smooth) f.line = smoothLine(f.line);

// Only campus: a road as its pieces on campus, an area only when all of it is.
const kept = [];
let offCampus = 0;
for (const f of drawn) {
    if (f.kind === "road") {
        const pieces = clipLine(f.line.map(project));
        for (const piece of pieces) kept.push({ ...f, px: [piece] });
        if (!pieces.length) offCampus++;
    } else {
        const px = f.rings.map((r) => r.map(project));
        if (px.every((r) => r.every(onCampus))) kept.push({ ...f, px });
        else offCampus++;
    }
}

// The data's top-left corner, in zoom-20 pixels: every coordinate is relative to it.
let ox = Infinity;
let oy = Infinity;
for (const f of kept) {
    for (const r of f.px) for (const [x, y] of r) {
        ox = Math.min(ox, x);
        oy = Math.min(oy, y);
    }
}
ox = Math.floor(ox);
oy = Math.floor(oy);

/** One line or ring: simplified, rounded, then each point as the step from the one before. */
function pack(ring, closed) {
    let pts = ring.map(([x, y]) => [x - ox, y - oy]);
    if (closed && pts.length > 4) {
        // Simplify an open chain (the ring minus its closing point), then close it again.
        const open = simplify(pts.slice(0, -1), TOLERANCE);
        pts = open.length >= 3 ? [...open, open[0]] : pts;
    } else pts = simplify(pts, TOLERANCE);
    const out = [];
    let px = 0;
    let py = 0;
    for (const [x, y] of pts) {
        const rx = Math.round(x);
        const ry = Math.round(y);
        if (out.length && rx === px && ry === py) continue;
        out.push(rx - px, ry - py);
        px = rx;
        py = ry;
    }
    return out;
}

const out = { v: 1, z: Z, origin: [ox, oy], attribution: data.attribution, fetched: data.fetched, roads: [], buildings: [], wood: [], grass: [], sport: [] };
for (const f of kept) {
    if (f.kind === "road") {
        const line = pack(f.px[0], false);
        if (line.length >= 4) out.roads.push([RANKS.indexOf(f.rank), f.up ? 1 : 0, line]);
    } else {
        const rings = f.px.map((r) => pack(r, true)).filter((r) => r.length >= 6);
        if (rings.length) out[f.kind === "building" ? "buildings" : f.kind].push(rings);
    }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
const count = (list) => list.reduce((n, f) => n + (Array.isArray(f[0]) ? f.reduce((m, r) => m + r.length / 2, 0) : f[2].length / 2), 0);
console.log(
    `campus map: ${out.roads.length} roads, ${out.buildings.length} buildings, ${out.wood.length} woods, ${out.grass.length} grass, ${out.sport.length} sport`,
    `(${offCampus} off campus left out);`,
    `${Math.round(count(out.roads) + count(out.buildings) + count(out.wood) + count(out.grass) + count(out.sport))} points;`,
    `${(fs.statSync(OUT).size / 1024).toFixed(0)} KB -> ${path.relative(ROOT, OUT)}`,
);
