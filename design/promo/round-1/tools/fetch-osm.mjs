// The campus from OpenStreetMap's own data (not its tiles), once, into
// lab/data/osm-campus.json: buildings, roads and paths, greens, water,
// parking and land use as GeoJSON, for lab/osmdraw.js to draw in any style.
//
//   node tools/fetch-osm.mjs
//
// One request to the Overpass API (free, no key). The box is what the
// whole-campus view shows on a phone, with a margin; re-run it to pick up
// newer edits. Data © OpenStreetMap contributors, ODbL.

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROUND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const BBOX = [46.766, -71.29, 46.8015, -71.259]; // south, west, north, east
const ENDPOINTS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
const KINDS = ["building", "highway", "landuse", "leisure", "natural", "amenity=parking", "waterway", "water", "railway", "area:highway", "man_made=bridge"];
const KEEP = ["building", "highway", "service", "footway", "area", "area:highway", "landuse", "leisure", "natural", "amenity", "parking", "waterway", "water", "wetland", "railway", "tunnel", "bridge", "layer", "level", "indoor", "location", "covered", "man_made", "surface", "access"];

const b = BBOX.join(",");
const sel = (k) => {
    const [key, val] = k.split("=");
    const t = val ? `["${key}"="${val}"]` : `["${key}"]`;
    return `way${t}(${b});relation${t}(${b});`;
};
const query = `[out:json][timeout:180];(${KINDS.map(sel).join("")});out geom;`;

let raw = null;
for (const url of ENDPOINTS) {
    try {
        raw = execFileSync("curl", ["-sfL", "-A", "hide-and-stalk-design/1.0 (campus game mockups)", "--data-urlencode", `data=${query}`, url], { timeout: 200000, maxBuffer: 1 << 28 }).toString();
        break;
    } catch (e) {
        console.error(`${url}: ${e.message.split("\n")[0]}`);
    }
}
if (!raw) throw new Error("Overpass unreachable");
const osm = JSON.parse(raw);

const r6 = (n) => Math.round(n * 1e6) / 1e6;
const pt = (g) => [r6(g.lon), r6(g.lat)];
const props = (el) => {
    const p = { id: `${el.type[0]}${el.id}` };
    for (const k of KEEP) if (el.tags?.[k] !== undefined) p[k] = el.tags[k];
    return p;
};
const closed = (c) => c.length > 3 && c[0][0] === c[c.length - 1][0] && c[0][1] === c[c.length - 1][1];
const AREA_KEYS = ["building", "landuse", "leisure", "natural", "amenity", "water", "area:highway", "man_made"];
// A closed way is an area unless it's a road loop (a roundabout, a path around a field).
const isArea = (t) => t.area === "yes" || (!t.highway && !t.waterway && !t.railway && AREA_KEYS.some((k) => t[k] !== undefined)) || (t.highway && t.area === "yes");

/** Join a relation's member ways end to end into closed rings. */
function rings(members) {
    const segs = members.map((m) => m.geometry.map(pt)).filter((s) => s.length > 1);
    const out = [];
    while (segs.length) {
        let ring = segs.shift();
        let grew = true;
        while (!closed(ring) && grew) {
            grew = false;
            const end = ring[ring.length - 1];
            for (let i = 0; i < segs.length; i++) {
                const s = segs[i];
                const same = (a, c) => a[0] === c[0] && a[1] === c[1];
                if (same(s[0], end)) ring = ring.concat(s.slice(1));
                else if (same(s[s.length - 1], end)) ring = ring.concat(s.slice(0, -1).reverse());
                else continue;
                segs.splice(i, 1);
                grew = true;
                break;
            }
        }
        if (closed(ring)) out.push(ring);
    }
    return out;
}
const inside = ([x, y], ring) => {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
};

const features = [];
for (const el of osm.elements) {
    const t = el.tags ?? {};
    if (el.type === "way" && el.geometry) {
        const c = el.geometry.map(pt);
        const geometry = closed(c) && isArea(t) ? { type: "Polygon", coordinates: [c] } : { type: "LineString", coordinates: c };
        features.push({ type: "Feature", properties: props(el), geometry });
    } else if (el.type === "relation" && el.members && (t.type === "multipolygon" || t.type === "building")) {
        const ways = el.members.filter((m) => m.type === "way" && m.geometry);
        const outer = rings(ways.filter((m) => m.role !== "inner"));
        const inner = rings(ways.filter((m) => m.role === "inner"));
        if (!outer.length) continue;
        const polys = outer.map((o) => [o, ...inner.filter((h) => inside(h[0], o))]);
        features.push({ type: "Feature", properties: props(el), geometry: polys.length === 1 ? { type: "Polygon", coordinates: polys[0] } : { type: "MultiPolygon", coordinates: polys } });
    }
}

const out = path.join(ROUND, "lab/data/osm-campus.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
const fc = { type: "FeatureCollection", bbox: [BBOX[1], BBOX[0], BBOX[3], BBOX[2]], fetched: osm.osm3s?.timestamp_osm_base, attribution: "© OpenStreetMap contributors (ODbL)", features };
fs.writeFileSync(out, JSON.stringify(fc));
const count = (k) => features.filter((f) => f.properties[k] !== undefined).length;
console.log(`wrote ${path.relative(ROUND, out)}: ${features.length} features (${count("building")} buildings, ${count("highway")} roads and paths), ${(fs.statSync(out).size / 1e6).toFixed(1)} MB, data as of ${fc.fetched}`);
