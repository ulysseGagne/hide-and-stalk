// The heatmap: an activity heatmap of campus, baked from OpenStreetMap. Shared
// by tools/build-heat.mjs (the app's src/data/campus-heat.json) and
// design/heatmap-study/study.mjs (the review renders), so both draw the same.
//
// The heat is a fixed field on the ground (a 2 m grid), so a spot has the same
// colour at every zoom. Everything people go to or sit at warms the ground
// around it, blurred wide so the campus rolls like terrain; roads are left
// out. The field is cut into flat tiers spaced like contour lines: white for
// the quietest third of campus, then levels at equal steps of sqrt(heat), so
// hills of activity get rings like a topographic map; then the top three are
// merged into one, and the two below them into another: six tiers in all.
// Each tier is traced as smooth closed curves.
//
// Inputs: design/promo/round-1/lab/data/osm-campus.json (roads, paths,
// buildings, land use) and design/heatmap-study/osm-points.json (entrances,
// amenities, shops, leisure, bus stops, crossings; Overpass, 2026-10-02).
// © OpenStreetMap contributors, ODbL.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
// Turf comes with the worker's dev dependencies (cd worker && npm install).
export const turf = createRequire(join(ROOT, "worker", "package.json"))("@turf/turf");
const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));

const osm = readJson(join(ROOT, "design/promo/round-1/lab/data/osm-campus.json"));
const points = readJson(join(ROOT, "design/heatmap-study/osm-points.json")).elements;
const border = readJson(join(ROOT, "locations/geojson/campus-border.geojson")).features[0].geometry.coordinates[0];
export const pavilions = readJson(join(ROOT, "locations/geojson/pavillons.geojson")).features;

// ---------------------------------------------------------------------------
// Grid: metres east / south of the top-left corner, north up
// ---------------------------------------------------------------------------
export const CELL = 2; // metres
export const MARGIN = 150;
const lngs = border.map((p) => p[0]);
const lats = border.map((p) => p[1]);
const LAT0 = Math.max(...lats);
const LNG0 = Math.min(...lngs);
const M_LAT = 111320;
const M_LNG = 111320 * Math.cos((((Math.min(...lats) + LAT0) / 2) * Math.PI) / 180);
export const toM = ([lng, lat]) => [(lng - LNG0) * M_LNG + MARGIN, (LAT0 - lat) * M_LAT + MARGIN];
export const fromM = ([x, y]) => [(x - MARGIN) / M_LNG + LNG0, LAT0 - (y - MARGIN) / M_LAT];
export const [bw, bh] = toM([Math.max(...lngs), Math.min(...lats)]);
export const W = Math.ceil((bw + MARGIN) / CELL);
export const H = Math.ceil((bh + MARGIN) / CELL);

export const borderM = border.map(toM);
function inRing(ring, x, y) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}
export const inCampus = new Uint8Array(W * H);
for (let gy = 0; gy < H; gy++) {
    for (let gx = 0; gx < W; gx++) inCampus[gy * W + gx] = inRing(borderM, (gx + 0.5) * CELL, (gy + 0.5) * CELL) ? 1 : 0;
}

// ---------------------------------------------------------------------------
// What makes a spot busy, and how much
// ---------------------------------------------------------------------------
// Four layers, each blurred at its own scale (see LAYERS below).
const layer = { dots: new Float32Array(W * H), spots: new Float32Array(W * H), paths: new Float32Array(W * H), areas: new Float32Array(W * H) };
let target = layer.dots;
const addAt = (x, y, w) => {
    const gx = Math.floor(x / CELL);
    const gy = Math.floor(y / CELL);
    if (gx >= 0 && gy >= 0 && gx < W && gy < H) target[gy * W + gx] += w;
};

const POINT_WEIGHT = (t) => {
    if (t.entrance) return t.entrance === "main" ? 8 : t.entrance === "yes" ? 5 : 2;
    if (t.highway === "bus_stop") return 7;
    if (t.highway === "crossing") return 2;
    if (t.highway === "street_lamp") return 0.5;
    if (t.shop) return 5;
    const a = t.amenity;
    if (["cafe", "restaurant", "fast_food", "pub", "bar", "food_court"].includes(a)) return 7;
    if (["library", "theatre", "bank", "pharmacy", "atm"].includes(a)) return 5;
    if (a === "bicycle_rental") return 5;
    if (["bench", "bicycle_parking", "shelter", "vending_machine"].includes(a)) return 2.5;
    if (["waste_basket", "drinking_water", "post_box", "recycling", "toilets"].includes(a)) return 1.5;
    if (["picnic_table", "playground", "fitness_station"].includes(t.leisure)) return 2.5;
    return 0;
};
for (const e of points) {
    const t = e.tags ?? {};
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    if (lat == null) continue;
    const w = POINT_WEIGHT(t);
    // Places people go to (doors, stops, cafés) spread wider than street furniture.
    target = w >= 5 ? layer.spots : layer.dots;
    if (w) addAt(...toM([lon, lat]), w);
}

// Footpaths only, and faintly: roads drew a road map.
const LINE_WEIGHT = (p) => (["footway", "pedestrian", "steps", "path"].includes(p.highway) ? 0.08 : 0);
function addLine(coords, wPerM) {
    for (let i = 1; i < coords.length; i++) {
        const [x0, y0] = toM(coords[i - 1]);
        const [x1, y1] = toM(coords[i]);
        const len = Math.hypot(x1 - x0, y1 - y0);
        const n = Math.max(1, Math.ceil(len / (CELL / 2)));
        for (let k = 0; k < n; k++) {
            const f = (k + 0.5) / n;
            addAt(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, (wPerM * len) / n);
        }
    }
}

// Areas: people per square metre. A pavilion is full of students; a house is not.
function fillPolygon(rings, wPerM2) {
    const ringsM = rings.map((r) => r.map(toM));
    const ys = ringsM[0].map((p) => p[1]);
    const xs = ringsM[0].map((p) => p[0]);
    const gx0 = Math.max(0, Math.floor(Math.min(...xs) / CELL));
    const gx1 = Math.min(W - 1, Math.ceil(Math.max(...xs) / CELL));
    const gy0 = Math.max(0, Math.floor(Math.min(...ys) / CELL));
    const gy1 = Math.min(H - 1, Math.ceil(Math.max(...ys) / CELL));
    for (let gy = gy0; gy <= gy1; gy++) {
        for (let gx = gx0; gx <= gx1; gx++) {
            const x = (gx + 0.5) * CELL;
            const y = (gy + 0.5) * CELL;
            let inside = inRing(ringsM[0], x, y);
            for (let r = 1; inside && r < ringsM.length; r++) if (inRing(ringsM[r], x, y)) inside = false;
            if (inside) layer.areas[gy * W + gx] += wPerM2 * CELL * CELL;
        }
    }
}
const pavilionPts = pavilions.map((f) => toM(f.geometry.coordinates));
const AREA_WEIGHT = (p, rings) => {
    if (p.building) {
        const ring = rings[0].map(toM);
        if (pavilionPts.some(([x, y]) => inRing(ring, x, y))) return 0.05;
        if (["university", "college", "school", "commercial", "retail"].includes(p.building)) return 0.035;
        if (["house", "residential", "apartments", "garage", "roof"].includes(p.building)) return 0.004;
        return 0.012;
    }
    if (["pitch", "playground", "park", "sports_centre", "track"].includes(p.leisure)) return 0.006;
    if (p.amenity === "parking") return 0.003;
    return 0;
};

for (const f of osm.features) {
    const p = f.properties;
    const g = f.geometry;
    if (g.type === "LineString") {
        const w = p.highway ? LINE_WEIGHT(p) : 0;
        target = layer.paths;
        if (w) addLine(g.coordinates, w);
    } else if (g.type === "Polygon" || g.type === "MultiPolygon") {
        for (const rings of g.type === "Polygon" ? [g.coordinates] : g.coordinates) {
            const w = AREA_WEIGHT(p, rings);
            if (w) fillPolygon(rings, w);
        }
    }
}

// Busier than OpenStreetMap says, by hand, as one more busy place:
// [name, lng, lat, weight], spread over a disc 40 m across before the blur so
// it rises as a hill with rings like the rest. It sits on the even raise below
// (RAISES), which on its own read too smooth next to the rest of the map.
const BOOSTS = [["Ch. Sainte-Foy / Av. Myrand", -71.2705, 46.789, 250]];
for (const [, lng, lat, weight] of BOOSTS) {
    const [bx, by] = toM([lng, lat]);
    const cells = [];
    for (let dy = -20; dy <= 20; dy += CELL) for (let dx = -20; dx <= 20; dx += CELL) if (Math.hypot(dx, dy) <= 20) cells.push([bx + dx, by + dy]);
    target = layer.spots;
    for (const [x, y] of cells) addAt(x, y, weight / cells.length);
}

// ---------------------------------------------------------------------------
// Blur, then cut into tiers
// ---------------------------------------------------------------------------
function boxBlur(a, r) {
    const out = new Float32Array(a.length);
    const tmp = new Float32Array(a.length);
    const n = 2 * r + 1;
    for (let y = 0; y < H; y++) {
        let s = 0;
        for (let x = -r; x <= r; x++) s += a[y * W + Math.min(W - 1, Math.max(0, x))];
        for (let x = 0; x < W; x++) {
            tmp[y * W + x] = s / n;
            s += a[y * W + Math.min(W - 1, x + r + 1)] - a[y * W + Math.max(0, x - r)];
        }
    }
    for (let x = 0; x < W; x++) {
        let s = 0;
        for (let y = -r; y <= r; y++) s += tmp[Math.min(H - 1, Math.max(0, y)) * W + x];
        for (let y = 0; y < H; y++) {
            out[y * W + x] = s / n;
            s += tmp[Math.min(H - 1, y + r + 1) * W + x] - tmp[Math.max(0, y - r) * W + x];
        }
    }
    return out;
}
/** Three box blurs: close to a Gaussian of sigma `m` metres. */
function gauss(a, m) {
    const r = Math.max(1, Math.round((Math.sqrt((12 * (m / CELL) ** 2) / 3 + 1) - 1) / 2));
    return boxBlur(boxBlur(boxBlur(a, r), r), r);
}
const campusValues = (f) => {
    const v = [];
    for (let i = 0; i < f.length; i++) if (inCampus[i]) v.push(f[i]);
    return v.sort((a, b) => a - b);
};
const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];

const source = new Float32Array(W * H);
for (const a of Object.values(layer)) for (let i = 0; i < source.length; i++) source[i] += a[i];

/**
 * The field: everything blurred twice, a hill per busy place and a wider swell
 * per busy district, each scaled so its busiest 1% reads 1.
 * Tiers: white below the quietest third, then `levels` cuts at equal steps of
 * sqrt(heat) up to the busiest 0.5%.
 */
function makeField([near, far], levels = 9) {
    const f = new Float32Array(W * H);
    for (const [sigma, share] of [[near, 0.6], [far, 0.4]]) {
        const blurred = gauss(source, sigma);
        const top = quantile(campusValues(blurred), 0.99) || 1;
        for (let i = 0; i < f.length; i++) f[i] += (share * blurred[i]) / top;
    }
    const sorted = campusValues(f);
    const lo = Math.sqrt(quantile(sorted, 0.35));
    const hi = Math.sqrt(quantile(sorted, 0.995));
    const cuts = [];
    for (let k = 0; k < levels - 1; k++) cuts.push((lo + ((hi - lo) * k) / (levels - 2)) ** 2);
    // Counting white as 1: tiers 7, 8 and 9 become one, and so do 5 and 6.
    const merged = cuts.filter((_, k) => k !== 4 && k !== 6 && k !== 7);
    raise(f, merged);
    return { f, cuts: merged };
}

// Busier than OpenStreetMap says, by hand. The same heat is added everywhere
// in the area (edges softened over about 100 m): enough to lift white ground
// to `tier`, and everything else there by as much. The area is a disc of
// `radius` at the corner, drawn out along the campus border for `along`
// metres in `direction` (+1 or -1 along the border's points) and narrowing to
// `endRadius`, so it follows the street instead of reading as a circle.
// Added after the tiers are cut, so the rest of campus keeps its tiers.
export const RAISES = [{ name: "Ch. Sainte-Foy / Av. Myrand", lng: -71.2705, lat: 46.789, radius: 350, tier: 3, along: 450, endRadius: 150, direction: -1 }];
function raise(f, cuts) {
    for (const { lng, lat, radius, tier, along, endRadius, direction } of RAISES) {
        // Disc centres every 10 m from the corner along the border (Av. Myrand).
        const [cx, cy] = toM([lng, lat]);
        const n = borderM.length - 1;
        let i = borderM.reduce((best, p, k) => (Math.hypot(p[0] - cx, p[1] - cy) < Math.hypot(borderM[best][0] - cx, borderM[best][1] - cy) ? k : best), 0);
        const centres = [[cx, cy, radius]];
        let walked = 0;
        let [px, py] = [cx, cy];
        while (walked < along) {
            const j = (i + direction + n) % n;
            const [qx, qy] = borderM[j];
            const seg = Math.hypot(qx - px, qy - py);
            const steps = Math.max(1, Math.ceil(seg / 10));
            for (let k = 1; k <= steps && walked < along; k++) {
                walked += seg / steps;
                centres.push([px + ((qx - px) * k) / steps, py + ((qy - py) * k) / steps, radius + ((endRadius - radius) * walked) / along]);
            }
            [px, py] = [qx, qy];
            i = j;
        }
        const area = new Float32Array(W * H);
        for (const [x, y, r] of centres) {
            for (let gy = Math.max(0, Math.floor((y - r) / CELL)); gy <= Math.min(H - 1, Math.ceil((y + r) / CELL)); gy++) {
                for (let gx = Math.max(0, Math.floor((x - r) / CELL)); gx <= Math.min(W - 1, Math.ceil((x + r) / CELL)); gx++) {
                    if (Math.hypot((gx + 0.5) * CELL - x, (gy + 0.5) * CELL - y) <= r) area[gy * W + gx] = 1;
                }
            }
        }
        const soft = gauss(area, 100);
        // Halfway into the tier, clear of its edges.
        const lift = (cuts[tier - 2] + cuts[tier - 1]) / 2;
        for (let k = 0; k < f.length; k++) f[k] += lift * soft[k];
    }
}

// Between the two smoothest tried in the study (35/90 and 55/130 m; 20/60 was
// the third).
export const FIELD = makeField([45, 110]);
export const LEVELS = FIELD.cuts.length + 1;

// ---------------------------------------------------------------------------
// Colours: flat tiers, white for nobody, in even steps to near-black
// ---------------------------------------------------------------------------
export const COLORS = Array.from({ length: LEVELS }, (_, k) => {
    const v = Math.round(255 + ((0x11 - 255) * k) / (LEVELS - 1));
    return `#${v.toString(16).padStart(2, "0").repeat(3)}`;
});

// ---------------------------------------------------------------------------
// Contours: each tier as the area where the heat reaches its floor
// ---------------------------------------------------------------------------
// Traced on a 4 m grid, then smoothed along each edge. Where the ground is
// nearly flat, a ripple in the heat too small to matter moves an edge by
// metres, so the traced edges come out bumpy though well placed. Each ring is
// resampled every 1.5 m and every point averaged with its neighbours along the
// ring (a Gaussian of 8 m): bumps shorter than about 25 m go, the line stays
// within a metre or so of where it was.
export const STEP = 2; // cells
export const SMOOTH_M = 8;
export const SPACING_M = 1.5;
export function smoothRing(ring, smoothM = SMOOTH_M) {
    const pts = ring.slice(0, -1);
    const n0 = pts.length;
    const cum = [0];
    for (let i = 0; i < n0; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % n0];
        cum.push(cum[i] + Math.hypot(bx - ax, by - ay));
    }
    const length = cum[n0];
    const n = Math.max(12, Math.round(length / SPACING_M));
    const step = length / n;
    // Evenly spaced points around the loop.
    const even = [];
    for (let i = 0, j = 0; i < n; i++) {
        const at = i * step;
        while (cum[j + 1] < at) j++;
        const t = (at - cum[j]) / (cum[j + 1] - cum[j] || 1);
        const [ax, ay] = pts[j];
        const [bx, by] = pts[(j + 1) % n0];
        even.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
    }
    if (smoothM <= 0) return [...even, even[0]];
    // A small loop is smoothed less, or it would shrink to nothing.
    const sigma = Math.min(smoothM, length / 12);
    const half = Math.ceil((3 * sigma) / step);
    const w = Array.from({ length: 2 * half + 1 }, (_, k) => Math.exp(-(((k - half) * step) ** 2) / (2 * sigma * sigma)));
    const total = w.reduce((a, b) => a + b, 0);
    const out = even.map((_, i) => {
        let x = 0;
        let y = 0;
        for (let k = -half; k <= half; k++) {
            const [px, py] = even[(((i + k) % n) + n) % n];
            x += w[k + half] * px;
            y += w[k + half] * py;
        }
        return [x / total, y / total];
    });
    return [...out, out[0]];
}
let contourCache = null;
/**
 * Per tier from the second up (the first, white, is the ground): the polygons
 * (rings in metres, closed, smoothed) where the heat reaches that tier's floor.
 */
export function contours() {
    if (contourCache) return contourCache;
    const { f, cuts } = FIELD;
    const pts = [];
    // Rows north to south as turf's grid expects; y is flipped so "north" is up.
    for (let gy = 0; gy < H; gy += STEP) {
        for (let gx = 0; gx < W; gx += STEP) pts.push(turf.point([(gx + 0.5) * CELL, -(gy + 0.5) * CELL], { v: f[gy * W + gx] }));
    }
    const grid = turf.featureCollection(pts);
    const max = f.reduce((m, v) => (v > m ? v : m), 0) + 1;
    const tiers = cuts.map((cut) => {
        const band = turf.isobands(grid, [cut, max], { zProperty: "v" }).features[0];
        const polys = band?.geometry?.coordinates ?? [];
        return polys.map((poly) => poly.filter((ring) => ring.length > 3).map((ring) => smoothRing(ring.map(([x, y]) => [x, -y]))));
    });
    contourCache = tiers;
    return tiers;
}
