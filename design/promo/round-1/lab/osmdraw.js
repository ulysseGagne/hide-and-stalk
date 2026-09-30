/* global L */

// The map drawn from OpenStreetMap's data instead of its tiles (skins S11-S14).
//
// lab/data/osm-campus.json (tools/fetch-osm.mjs) holds every building, road,
// path, green and water as a real shape. Each one is projected with the
// Leaflet map and drawn as SVG in our own style, so an edge is exactly as
// straight or as smooth as it was mapped, and there is no text or icon to
// erase first. The same four looks as the tile skins:
//
//   outline  roads as their two edges, buildings outlined, no greens (S2)
//   solid    roads filled black, paths thin, buildings and greens outlined (S3)
//   grain    OSM's own shades printed through the toner grain (S9)
//   dots     roads as one line down their middle, buildings outlined,
//            greens dotted (S5)
//
// Zoomed out to the whole campus, pavements, crossings, parking aisles and
// driveways are left out and paths get thinner: the rest would be a smudge.

(function () {
    let DATA = null;
    const ready = fetch("data/osm-campus.json")
        .then((r) => r.json())
        .then((d) => {
            DATA = d.features.map(prepare).filter(Boolean);
            sortPaths(DATA);
            for (const f of DATA) if ((f.kind === "road" || f.kind === "tunnel") && f.rank === "path") f.draw = [smoothLine(f.rings[0])];
        });

    // Road ranks: width in metres, and the fewest pixels it may shrink to.
    const RANK = {
        major: { m: 13, min: 3.2 },
        medium: { m: 10, min: 2.6 },
        minor: { m: 7, min: 2 },
        service: { m: 4.5, min: 1.5 },
        aisle: { m: 3, min: 1.2 },
        path: { m: 2, min: 1 },
    };
    const RANK_OF = {
        motorway: "major", trunk: "major", primary: "major", motorway_link: "major", trunk_link: "major", primary_link: "major",
        secondary: "medium", tertiary: "medium", secondary_link: "medium", tertiary_link: "medium",
        residential: "minor", unclassified: "minor", living_street: "minor", road: "minor",
        service: "service",
        footway: "path", path: "path", cycleway: "path", pedestrian: "path", steps: "path", track: "path", bridleway: "path", platform: "path",
    };
    // OSM's own map colours as greys (their luma), for the grain print.
    const GREY = {
        land: 0.94, residential: 0.876, commercial: 0.88, retail: 0.87, industrial: 0.88, railway: 0.88, construction: 0.78, brownfield: 0.78, greenfield: 0.93,
        education: 0.99, parking: 0.93, pedestrian: 0.9, sport: 0.95,
        wood: 0.78, scrub: 0.82, grass: 0.87, park: 0.93, pitch: 0.78, cemetery: 0.76, farm: 0.93, allotments: 0.85, orchard: 0.81, water: 0.78,
        building: 0.82, buildingEdge: 0.72,
    };
    const GREEN_OF = {
        "natural=wood": "wood", "landuse=forest": "wood", "natural=scrub": "scrub", "natural=wetland": "grass", "natural=grassland": "grass", "natural=heath": "grass",
        "landuse=grass": "grass", "landuse=meadow": "grass", "landuse=village_green": "grass", "landuse=recreation_ground": "park", "landuse=cemetery": "cemetery",
        "landuse=orchard": "orchard", "landuse=allotments": "allotments", "landuse=farmland": "farm",
        "leisure=park": "park", "leisure=garden": "grass", "leisure=golf_course": "grass", "leisure=common": "grass", "leisure=nature_reserve": "grass",
        "leisure=pitch": "pitch", "leisure=track": "pitch", "leisure=playground": "park",
    };
    const GROUND_OF = {
        "landuse=residential": "residential", "landuse=commercial": "commercial", "landuse=retail": "retail", "landuse=industrial": "industrial", "landuse=railway": "railway",
        "landuse=construction": "construction", "landuse=brownfield": "brownfield", "landuse=greenfield": "greenfield", "landuse=education": "education",
        "amenity=university": "education", "amenity=school": "education", "amenity=kindergarten": "education",
        "leisure=sports_centre": "sport", "leisure=stadium": "sport",
    };
    const tagOf = (p, table) => {
        for (const k of ["natural", "landuse", "leisure", "amenity"]) if (p[k] && table[`${k}=${p[k]}`]) return table[`${k}=${p[k]}`];
        return null;
    };

    /** Sort a feature into what gets drawn, or drop it. */
    function prepare(f) {
        const p = f.properties;
        const g = f.geometry;
        const area = g.type !== "LineString";
        const rings = g.type === "Polygon" ? g.coordinates : g.type === "MultiPolygon" ? g.coordinates.flat() : [g.coordinates];
        const pts = rings.flat();
        const bbox = [Math.min(...pts.map((q) => q[0])), Math.min(...pts.map((q) => q[1])), Math.max(...pts.map((q) => q[0])), Math.max(...pts.map((q) => q[1]))];
        const layer = Number(p.layer ?? 0);
        const up = p.bridge !== undefined && p.bridge !== "no" ? 1 : layer > 0 ? 1 : 0;
        const base = { id: p.id, rings, bbox, up };
        if (p.building && p.building !== "no" && area) return p.location === "underground" ? null : { ...base, kind: "building" };
        if (p.highway && !area) {
            // The house rules say no tunnels: underground paths are kept apart
            // (kind "tunnel") and only the colour-coded key map shows them.
            const tunnel = p.tunnel === "yes" || p.tunnel === "culvert" || layer < 0 || p.indoor === "yes";
            const rank = p.service === "parking_aisle" || p.service === "driveway" ? "aisle" : RANK_OF[p.highway];
            if (!rank) return null;
            const detail = rank === "aisle" || ["sidewalk", "crossing", "traffic_island"].includes(p.footway);
            const c = rings[0];
            let len = 0;
            for (let i = 1; i < c.length; i++) len += Math.hypot((c[i][0] - c[i - 1][0]) * 76000, (c[i][1] - c[i - 1][1]) * 111200);
            return { ...base, kind: tunnel ? "tunnel" : "road", rank, detail, len, hw: p.highway, fw: p.footway, sv: p.service };
        }
        if (p.railway === "rail" && !area) return { ...base, kind: "rail" };
        if (!area) return null;
        if (p.natural === "water" || p.landuse === "reservoir" || p.landuse === "basin" || p.leisure === "swimming_pool" || p.waterway === "riverbank") return { ...base, kind: "water" };
        const green = tagOf(p, GREEN_OF);
        if (green) return { ...base, kind: "green", sub: green, surface: p.surface, leisure: p.leisure, area: green === "pitch" ? areaOf(rings[0]) : undefined };
        if (p.amenity === "parking" && p.parking !== "underground") return { ...base, kind: "ground", sub: "parking" };
        if (p.highway === "pedestrian" || p["area:highway"]) return { ...base, kind: "ground", sub: "pedestrian" };
        const ground = tagOf(p, GROUND_OF);
        if (ground) return { ...base, kind: "ground", sub: ground };
        return null;
    }

    /**
     * The colour-coded map ("key"): every kind of line and area in its own
     * colour, so each can be named and kept, dropped or restyled.
     * [key, colour, name, OSM tags, how it's drawn: line | dash | area]
     */
    const KEY = [
        ["major", "#c62828", "Big roads", "motorway, trunk, primary and their ramps", "line", 5],
        ["medium", "#ef6c00", "Main streets", "secondary, tertiary", "line", 4],
        ["minor", "#f9a825", "Side streets", "residential, unclassified", "line", 3],
        ["service", "#6d4c41", "Service roads", "highway=service", "line", 2.4],
        ["aisle", "#a1887f", "Parking aisles", "service=parking_aisle", "line", 1.6],
        ["driveway", "#bcaaa4", "Driveways", "service=driveway", "line", 1.6],
        ["footway", "#d81b60", "Footpaths", "highway=footway, away from roads", "line", 1.8],
        ["sidewalk", "#f48fb1", "Sidewalks", "footway=sidewalk, beside a road", "line", 1.8],
        ["crossing", "#7b1fa2", "Crosswalks", "footway=crossing", "line", 2.4],
        ["cycleway", "#1565c0", "Bike paths", "highway=cycleway", "line", 2.2],
        ["path", "#00897b", "Trails", "highway=path", "line", 2],
        ["steps", "#000000", "Stairs", "highway=steps", "line", 2.4],
        ["pedestrian", "#5e35b1", "Pedestrian streets", "highway=pedestrian", "line", 3],
        ["track", "#827717", "Tracks", "highway=track", "line", 2],
        ["tunnel", "#78909c", "Tunnels: never on the map", "tunnel=yes, or below ground", "dash", 2],
        ["rail", "#212121", "Railway", "railway=rail", "line", 1.5],
        ["building", "#9e9e9e", "Buildings", "building=*", "area"],
        ["wood", "#2e7d32", "Woods", "natural=wood, landuse=forest", "area"],
        ["scrub", "#7cb342", "Scrub", "natural=scrub", "area"],
        ["grass", "#c5e1a5", "Grass", "landuse=grass, meadow, cemetery", "area"],
        ["park", "#e8f5e9", "Parks, gardens, playgrounds", "leisure=park, garden, playground", "area"],
        ["pitch", "#4db6ac", "Sports fields", "leisure=pitch, track", "area"],
        ["water", "#4fc3f7", "Water and pools", "natural=water, swimming_pool", "area"],
        ["parking", "#cfd8dc", "Car parks", "amenity=parking", "area"],
        ["plaza", "#e1bee7", "Squares", "highway=pedestrian areas", "area"],
        ["residential", "#fff3e0", "Housing areas", "landuse=residential", "area"],
        ["education", "#fffde7", "Campus and schools", "amenity=university, school", "area"],
        ["other", "#eceff1", "Other land use", "commercial, industrial, construction", "area"],
    ];
    const KEY_OF = Object.fromEntries(KEY.map((k) => [k[0], k]));
    // The key, second pass, from your notes on the first: every street one
    // category; woods with scrub, grass with parks; no service roads, aisles,
    // driveways, sidewalks, crosswalks, stairs, tracks, tunnels, railway,
    // water, car parks, squares or land-use colours.
    const KEY2 = [
        ["street", "#e65100", "Streets", "big roads, main streets and side streets, one category", "line", 3.2],
        ["footway", "#d81b60", "Footpaths", "highway=footway, away from roads", "line", 1.8],
        ["cycleway", "#1565c0", "Bike paths", "highway=cycleway", "line", 2.2],
        ["path", "#00897b", "Trails", "highway=path", "line", 2],
        ["pedestrian", "#5e35b1", "Pedestrian streets", "highway=pedestrian", "line", 3],
        ["building", "#9e9e9e", "Buildings", "building=*", "area"],
        ["wood", "#2e7d32", "Woods and scrub", "natural=wood, scrub; landuse=forest", "area"],
        ["grass", "#c5e1a5", "Grass and parks", "grass, meadow, cemetery; parks, gardens, playgrounds", "area"],
        ["pitch", "#4db6ac", "Sports fields", "leisure=pitch, track", "area"],
    ];
    const KEY2_OF = Object.fromEntries(KEY2.map((k) => [k[0], k]));
    function keyOf2(f) {
        const k = keyOf(f);
        if (["major", "medium", "minor"].includes(k)) return "street";
        if (["footway", "cycleway", "path", "pedestrian", "building", "wood", "pitch"].includes(k)) return k;
        if (k === "scrub") return "wood";
        if (k === "grass" || k === "park") return "grass";
        return null;
    }
    function keyOf(f) {
        if (f.kind === "tunnel") return "tunnel";
        if (f.kind === "road") {
            if (["major", "medium", "minor", "service"].includes(f.rank)) return f.rank;
            if (f.sv === "parking_aisle") return "aisle";
            if (f.sv === "driveway") return "driveway";
            if (f.fw === "sidewalk") return "sidewalk";
            if (f.fw === "crossing" || f.fw === "traffic_island") return "crossing";
            if (["cycleway", "steps", "path", "pedestrian", "track"].includes(f.hw)) return f.hw;
            return "footway";
        }
        if (f.kind === "green") return { wood: "wood", scrub: "scrub", pitch: "pitch", park: "park" }[f.sub] ?? "grass";
        if (f.kind === "ground") return { parking: "parking", pedestrian: "plaza", residential: "residential", education: "education" }[f.sub] ?? "other";
        return f.kind;
    }
    /** The key itself, as HTML: a swatch, the name, the OSM tags behind it. */
    function legend(which = 1) {
        const table = which === 3 ? KEY3 : which === 2 ? KEY2 : KEY;
        const row = ([, color, name, tags, how, sw]) => {
            const swatch = how === "area" ? `<svg width="34" height="16"><rect x="1" y="1" width="32" height="14" fill="${color}" stroke="#000" stroke-width="0.6"/></svg>` : how === "outline" ? `<svg width="34" height="16"><rect x="1.5" y="1.5" width="31" height="13" fill="none" stroke="${color}" stroke-width="1.4" stroke-dasharray="3 2"/></svg>` : `<svg width="34" height="16"><path d="M2 8H32" stroke="${color}" stroke-width="${Math.max(2.4, sw)}"${how === "dash" ? ' stroke-dasharray="5 3"' : ""}/></svg>`;
            return `<div style="display:flex;gap:8px;align-items:center;padding:2.5px 0">${swatch}<div style="line-height:1.15"><b>${name}</b><br><span style="font-size:11px">${tags}</span></div></div>`;
        };
        const gone = which === 3 ? `<div style="margin-top:10px;padding-top:8px;border-top:2px solid #000"><b>Left off the map</b>${GONE3.map(([name, tags]) => `<div style="line-height:1.15;padding:2px 0"><span style="text-decoration:line-through">${name}</span> <span style="font-size:11px">${tags}</span></div>`).join("")}</div>` : "";
        return `<div style="padding:14px 16px;font:13px Arimo, Helvetica, Arial, sans-serif;columns:1">${table.map(row).join("")}${gone}</div>`;
    }

    // The key, third pass: pedestrian streets are streets; footpaths and
    // trails are one kind; paths and bike paths are split into the ones kept
    // and the ones left behind (sortPaths); sports fields go by surface.
    const KEY3 = [
        ["street", "#e65100", "Streets", "big roads, main streets, side streets and pedestrian streets", "line", 3.2],
        ["pathkeep", "#c2185b", "Footpaths and trails, kept", "a route of their own, away from the streets", "line", 2.6],
        ["pathdrop", "#f8bbd0", "Footpaths and trails, left behind", "along a street or a bike path, off campus, a short piece, a knot, or a stub to a door", "line", 1.6],
        ["bikekeep", "#1565c0", "Bike paths, kept", "every one, along a street or not", "line", 2.8],
        ["bikedrop", "#90caf9", "Bike paths, left behind", "only tiny bits: under 60 m on their own, or a stub", "line", 1.6],
        ["building", "#9e9e9e", "Buildings", "building=*", "area"],
        ["wood", "#2e7d32", "Woods and scrub", "natural=wood, scrub; landuse=forest", "area"],
        ["grass", "#c5e1a5", "Grass and parks", "and every sports field and court, whatever its surface", "area"],
        ["parking", "#b0bec5", "Car parks", "amenity=parking: surface lots, back by request", "area"],
        ["hard", "#616161", "The running track", "round the football field: plain ground on the map, outlined here only so you can find it", "outline"],
    ];
    // What the key has taken off the map, so nothing important goes missing unnoticed.
    const GONE3 = [
        ["Service roads", "highway=service"],
        ["Parking aisles and driveways", "service=parking_aisle, driveway"],
        ["Sidewalks and crosswalks", "footway=sidewalk, crossing"],
        ["Stairs on their own", "highway=steps; a flight on a kept path is drawn as that path"],
        ["Tracks and bus platforms", "highway=track, platform"],
        ["Tunnels", "tunnel=yes, or below ground"],
        ["Railway", "railway=rail"],
        ["Water and pools", "natural=water, leisure=swimming_pool"],
        ["Squares", "highway=pedestrian areas"],
        ["Housing areas", "landuse=residential"],
        ["Campus and schools", "amenity=university, school"],
        ["Other land use", "commercial, industrial, construction"],
    ];
    const KEY3_OF = Object.fromEntries(KEY3.map((k) => [k[0], k]));
    function keyOf3(f) {
        if (f.kind === "road") {
            if (["major", "medium", "minor"].includes(f.rank) || f.hw === "pedestrian") return "street";
            if (f.keep !== undefined) return (f.hw === "cycleway" ? "bike" : "path") + (f.keep ? "keep" : "drop");
            return null;
        }
        if (f.kind === "building") return "building";
        if (f.kind === "ground" && f.sub === "parking") return "parking";
        if (f.kind === "green") {
            if (f.sub === "wood" || f.sub === "scrub") return "wood";
            // Every field and court is grass and parks; the running track is plain ground.
            if (f.sub === "pitch") return f.leisure === "track" ? "hard" : "grass";
            return "grass";
        }
        return null;
    }

    // Corrections by hand, after looking at the sorted paths (OSM way ids):
    // kept although the rules leave them behind, or the other way round.
    const PATH_KEEP = new Set([]);
    const PATH_DROP = new Set([
        "w317276739", // round the stadium's stands
        "w1206313943", "w1207615096", "w281351990", // stubs round a small pavilion
        // A ring of short paths round a statue on the central square, and the four
        // walkways that coil round it on their way in: together, a knot.
        "w1206311785", "w1206311790", "w1206311791", "w1206311792", "w1206311793", "w1206311794", "w1206311795", "w1319727403",
        "w1206311786", "w1206311787", "w1206311788", "w1206311789",
    ]);
    /**
     * Footpaths, trails and bike paths: which are routes of their own and which
     * get left behind. Left behind, in this order: anything mostly outside the
     * campus border (the game is played inside it); whatever keeps to a street
     * (within 14 m, or within 35 m running the same way) for most of its
     * length, or to a bike path; small loops (a ring round a statue); then any
     * connected stretch of what's left under 60 m or fitting in a 40 m box (a
     * knot of paths); then dead ends under 20 m (a path to a door). Only the
     * small and messy goes: the first sort took far too much. Sets
     * f.keep on each (sidewalks, crossings, tracks and platforms are off the
     * map anyway).
     */
    function sortPaths(all) {
        const M = ([lng, lat]) => [lng * 76230, lat * 111200];
        const CELL = 40;
        const grid = new Map();
        const cell = (x, y) => x * 100003 + y;
        for (const f of all) {
            if (f.kind !== "road" || !(["major", "medium", "minor", "service"].includes(f.rank) || f.hw === "pedestrian")) continue;
            const c = f.rings[0].map(M);
            for (let i = 1; i < c.length; i++) {
                const a = c[i - 1];
                const b = c[i];
                for (let x = Math.floor(Math.min(a[0], b[0]) / CELL); x <= Math.floor(Math.max(a[0], b[0]) / CELL); x++)
                    for (let y = Math.floor(Math.min(a[1], b[1]) / CELL); y <= Math.floor(Math.max(a[1], b[1]) / CELL); y++) {
                        const k = cell(x, y);
                        if (!grid.has(k)) grid.set(k, []);
                        grid.get(k).push([a, b]);
                    }
            }
        }
        const segDist = (p, a, b) => {
            const dx = b[0] - a[0];
            const dy = b[1] - a[1];
            const l2 = dx * dx + dy * dy;
            const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
            return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
        };
        // Near a line: within 14 m of it, or within 35 m and running the same
        // way (a path that keeps to one side of a street, or of a bike path).
        const near = (g, p, dir) => {
            const cx = Math.floor(p[0] / CELL);
            const cy = Math.floor(p[1] / CELL);
            for (let x = cx - 1; x <= cx + 1; x++)
                for (let y = cy - 1; y <= cy + 1; y++)
                    for (const [a, b] of g.get(cell(x, y)) ?? []) {
                        const d = segDist(p, a, b);
                        if (d < 14) return true;
                        if (d < 35) {
                            const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
                            if (Math.abs(((b[0] - a[0]) * dir[0] + (b[1] - a[1]) * dir[1]) / l) > 0.9) return true;
                        }
                    }
            return false;
        };
        const nearStreet = (p, dir) => near(grid, p, dir);
        const border = (window.HNSLocations?.layers ?? []).find((l) => l.kind === "polygon")?.ring ?? null;
        const inside = ([x, y]) => {
            let c = false;
            for (let i = 0, j = border.length - 1; i < border.length; j = i++) {
                const [xi, yi] = border[i];
                const [xj, yj] = border[j];
                if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
            }
            return c;
        };
        const paths = all.filter((f) => f.kind === "road" && f.rank === "path" && !f.detail && !["pedestrian", "track", "platform"].includes(f.hw));
        const nearCount = (k, n) => k / n >= 0.6;
        for (const f of paths) {
            const g = f.rings[0];
            const c = g.map(M);
            let n = 0;
            let near = 0;
            let inCampus = 0;
            for (let i = 1; i < c.length; i++) {
                const segL = Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]) || 1;
                const dir = [(c[i][0] - c[i - 1][0]) / segL, (c[i][1] - c[i - 1][1]) / segL];
                const steps = Math.max(1, Math.round(segL / 5));
                for (let s = 0; s < steps; s++) {
                    const t = (s + 0.5) / steps;
                    n++;
                    if (nearStreet([c[i - 1][0] + (c[i][0] - c[i - 1][0]) * t, c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t], dir)) near++;
                    if (!border || inside([g[i - 1][0] + (g[i][0] - g[i - 1][0]) * t, g[i - 1][1] + (g[i][1] - g[i - 1][1]) * t])) inCampus++;
                }
            }
            f.along = n > 0 && nearCount(near, n);
            f.outside = n > 0 && inCampus / n < 0.5;
            const closed = g.length > 3 && g[0][0] === g[g.length - 1][0] && g[0][1] === g[g.length - 1][1];
            f.loop = closed && f.len < 120;
        }
        // A footpath that shadows a bike path (the two side by side) goes too.
        const bikes = new Map();
        for (const f of paths) {
            if (f.hw !== "cycleway" || f.loop) continue;
            const c = f.rings[0].map(M);
            for (let i = 1; i < c.length; i++) {
                const a = c[i - 1];
                const b = c[i];
                for (let x = Math.floor(Math.min(a[0], b[0]) / CELL); x <= Math.floor(Math.max(a[0], b[0]) / CELL); x++)
                    for (let y = Math.floor(Math.min(a[1], b[1]) / CELL); y <= Math.floor(Math.max(a[1], b[1]) / CELL); y++) {
                        const k = cell(x, y);
                        if (!bikes.has(k)) bikes.set(k, []);
                        bikes.get(k).push([a, b]);
                    }
            }
        }
        for (const f of paths) {
            if (f.hw === "cycleway" || f.along) continue;
            const c = f.rings[0].map(M);
            let n = 0;
            let nb = 0;
            for (let i = 1; i < c.length; i++) {
                const segL = Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]) || 1;
                const dir = [(c[i][0] - c[i - 1][0]) / segL, (c[i][1] - c[i - 1][1]) / segL];
                const steps = Math.max(1, Math.round(segL / 5));
                for (let s = 0; s < steps; s++) {
                    const t = (s + 0.5) / steps;
                    n++;
                    const p = [c[i - 1][0] + (c[i][0] - c[i - 1][0]) * t, c[i - 1][1] + (c[i][1] - c[i - 1][1]) * t];
                    // Only side by side, not the bike path itself: over 3 m away.
                    if (near(bikes, p, dir) && !near(new Map(), p, dir)) nb++;
                }
            }
            f.shadow = n > 0 && nb / n >= 0.6;
        }
        // What's left, in connected pieces: ways that share a point are one piece.
        // Bike paths stay unless they're a micro bit (below); footpaths and trails
        // also go when they follow a street or a bike path, or leave the campus.
        let left = paths.filter((f) => (f.hw === "cycleway" ? !f.loop : !f.along && !f.outside && !f.loop && !f.shadow));
        const parent = new Map(left.map((f) => [f, f]));
        const find = (f) => {
            while (parent.get(f) !== f) f = parent.get(f);
            return f;
        };
        const at = new Map();
        for (const f of left)
            for (const q of f.rings[0]) {
                const k = `${q[0]},${q[1]}`;
                if (at.has(k)) {
                    const a = find(f);
                    const b = find(at.get(k));
                    if (a !== b) parent.set(a, b);
                } else at.set(k, f);
            }
        const total = new Map();
        const box = new Map();
        for (const f of left) {
            const r = find(f);
            total.set(r, (total.get(r) ?? 0) + f.len);
            const b = box.get(r) ?? [Infinity, Infinity, -Infinity, -Infinity];
            for (const q of f.rings[0].map(M)) box.set(r, (b[0] = Math.min(b[0], q[0]), b[1] = Math.min(b[1], q[1]), b[2] = Math.max(b[2], q[0]), b[3] = Math.max(b[3], q[1]), b));
        }
        const knot = (r) => {
            const b = box.get(r);
            return Math.max(b[2] - b[0], b[3] - b[1]) < 40;
        };
        left = prune(left.filter((f) => total.get(find(f)) >= 60 && !knot(find(f))), 20);
        const keep = new Set(left);
        for (const f of paths) f.keep = PATH_KEEP.has(f.id) || (keep.has(f) && !PATH_DROP.has(f.id));
    }

    const grey = (l) => {
        const v = Math.round(l * 255);
        return `rgb(${v},${v},${v})`;
    };

    /**
     * Dead ends out: a path, aisle or service road that touches nothing at one
     * end and is shorter than `spur` metres goes, and so does a loose bit
     * touching nothing at either end (up to twice that). Repeated, since taking
     * one away can leave another hanging. Streets are never taken out.
     */
    // Metres, near enough at this latitude.
    const toM = ([lng, lat]) => [lng * 76230, lat * 111200];
    const toLL = ([x, y]) => [x / 76230, y / 111200];
    const distToSeg = (p, a, b) => {
        const dx = b[0] - a[0];
        const dy = b[1] - a[1];
        const l2 = dx * dx + dy * dy;
        const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
        return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
    };
    function areaOf(ring) {
        const c = ring.map(toM);
        let a = 0;
        for (let i = 0, j = c.length - 1; i < c.length; j = i++) a += (c[j][0] + c[i][0]) * (c[j][1] - c[i][1]);
        return Math.abs(a / 2);
    }
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
     * A path as it's drawn: the mapped line's jitter taken out (anything within
     * 2 m of a straight run), then its corners rounded off (three passes of
     * corner cutting). The ends stay put, so paths still meet where they meet.
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

    function prune(roads, spur = 60) {
        let kept = roads;
        for (let pass = 0; pass < 8; pass++) {
            const count = new Map();
            for (const f of kept) for (const k of new Set(f.rings[0].map((q) => `${q[0]},${q[1]}`))) count.set(k, (count.get(k) ?? 0) + 1);
            const free = (q) => (count.get(`${q[0]},${q[1]}`) ?? 0) < 2;
            const next = kept.filter((f) => {
                if (!["path", "aisle", "service"].includes(f.rank)) return true;
                const r = f.rings[0];
                const a = free(r[0]);
                const b = free(r[r.length - 1]);
                return (!a && !b) || f.len > (a && b ? spur * 2 : spur);
            });
            if (next.length === kept.length) break;
            kept = next;
        }
        return kept;
    }

    /**
     * The map as one SVG element, for the view `map` shows now.
     * spec: a look ("outline" | "solid" | "grain" | "dots" | "key" | "blackroads"
     * | "blackdots" | "figure"), or { look, drop, prune }: drop "detail"
     * (pavements, crossings, parking aisles, driveways) or "paths" (every
     * path), prune dead ends.
     */
    function render(map, spec, w, h) {
        const o = typeof spec === "string" ? { look: spec } : spec;
        const style = o.look;
        const zoom = map.getZoom();
        const lat = map.getCenter().lat;
        const mpp = (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (256 * 2 ** zoom);
        const far = zoom < 15.5;
        const vb = map.getBounds().pad(0.1);
        const inView = (f) => f.bbox[2] >= vb.getWest() && f.bbox[0] <= vb.getEast() && f.bbox[3] >= vb.getSouth() && f.bbox[1] <= vb.getNorth();
        const P = ([lng, lat2]) => {
            const q = map.latLngToContainerPoint([lat2, lng]);
            return `${Math.round(q.x * 10) / 10} ${Math.round(q.y * 10) / 10}`;
        };
        const ringD = (r, close) => `M${r.map(P).join("L")}${close ? "Z" : ""}`;
        const dOf = (f) => (f.draw ?? f.rings).map((r) => ringD(r, f.kind !== "road" && f.kind !== "rail")).join("");
        const pxArea = (f) => {
            const a = map.latLngToContainerPoint([f.bbox[1], f.bbox[0]]);
            const b = map.latLngToContainerPoint([f.bbox[3], f.bbox[2]]);
            return Math.abs(a.x - b.x) * Math.abs(a.y - b.y);
        };
        let list = DATA.filter(inView).filter((f) => !(far && f.kind === "road" && f.detail)).filter((f) => !(far && f.kind === "building" && pxArea(f) < 3));
        if (o.drop === "detail" || o.drop === "paths") list = list.filter((f) => !(f.kind === "road" && f.detail));
        if (o.drop === "paths") list = list.filter((f) => !(f.kind === "road" && f.rank === "path"));
        if (o.prune) {
            const roads = prune(list.filter((f) => f.kind === "road"), o.prune);
            list = list.filter((f) => f.kind !== "road").concat(roads);
        }
        const of = (kind, fn = () => true) => list.filter((f) => f.kind === kind && fn(f));
        const width = (f) => Math.max(RANK[f.rank].min, RANK[f.rank].m / mpp);
        // Roads grouped by width, so each group is one path element.
        const byWidth = (roads, wOf) => {
            const groups = new Map();
            for (const f of roads) {
                const k = Math.round(wOf(f) * 10) / 10;
                groups.set(k, (groups.get(k) ?? "") + dOf(f));
            }
            return [...groups.entries()].sort((a, b) => a[0] - b[0]);
        };
        const stroke = (d, color, sw, extra = "") => (d ? `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${extra}/>` : "");
        const fill = (d, color, extra = "") => (d ? `<path d="${d}" fill="${color}" fill-rule="evenodd"${extra}/>` : "");
        const join = (fs) => fs.map(dOf).join("");
        // One element per shape: in a shared path, overlapping shapes would cut holes in each other.
        const fillEach = (fs, color) => fs.map((f) => fill(dOf(f), color)).join("");
        const edge = far ? 0.8 : 1.1;
        const outlineW = far ? 0.6 : 1;

        // Shapes outlined once around their union: a double-width stroke under
        // the fills, so where two shapes touch, the shared edge disappears.
        // (Each fill also gets a hairline of its own colour, which covers the
        // anti-aliased seam the shared edge would otherwise leave.)
        const outlined = (fs, color = "#000", paper = "#fff") => stroke(join(fs), color, outlineW * 2 + 0.6) + fs.map((f) => fill(dOf(f), paper, ` stroke="${paper}" stroke-width="0.6"`)).join("");
        // Roads as their two edges: every casing first, then every fill, so
        // junctions merge. Paths too narrow for two edges are one thin line.
        const cased = (roads) => {
            const wide = roads.filter((f) => width(f) >= 2);
            const thin = roads.filter((f) => width(f) < 2);
            return (
                byWidth(wide, width).map(([k, d]) => stroke(d, "#000", k + edge * 2)).join("") +
                byWidth(wide, width).map(([k, d]) => stroke(d, "#fff", k)).join("") +
                stroke(join(thin), "#000", far ? 0.6 : 0.9)
            );
        };
        const roads = of("road", (f) => !f.up);
        const bridges = of("road", (f) => f.up);
        const rail = stroke(join(of("rail")), "#000", 1);
        let body = "";
        let defs = "";
        if (style === "outline") {
            body = cased(roads) + outlined(of("building")) + cased(bridges) + rail;
        } else if (style === "solid") {
            const solidW = (f) => (f.rank === "path" ? (far ? 0.6 : 1) : Math.max(RANK[f.rank].min * 0.7, (RANK[f.rank].m / mpp) * 0.55));
            const solidRoads = (rs) => byWidth(rs, solidW).map(([k, d]) => stroke(d, "#000", k)).join("");
            body = outlined([...of("green"), ...of("water")]) + solidRoads(roads) + outlined(of("building")) + solidRoads(bridges) + rail;
        } else if (style === "dots") {
            const s = 3;
            defs = `<pattern id="osmdots" width="${s}" height="${s}" patternUnits="userSpaceOnUse"><rect width="${s}" height="${s}" fill="#fff"/><rect x="${s / 2 - 0.4}" y="${s / 2 - 0.4}" width="0.8" height="0.8" fill="#000"/></pattern>`;
            const lineW = (f) => (f.rank === "path" || f.rank === "aisle" ? (far ? 0.5 : 0.9) : f.rank === "major" || f.rank === "medium" ? (far ? 1.2 : 2) : far ? 0.9 : 1.5);
            const centre = (rs) => byWidth(rs, lineW).map(([k, d]) => stroke(d, "#000", k)).join("");
            body = fillEach([...of("green"), ...of("water")], "url(#osmdots)") + centre(roads) + outlined(of("building")) + centre(bridges) + rail;
        } else if (style === "blackroads" || style === "blackdots" || style === "figure") {
            // Revived from the tile days: black buildings, with black roads and
            // outlined greens, black roads and dotted greens, or outlined roads.
            const solidW = (f) => (f.rank === "path" ? (far ? 0.6 : 1) : Math.max(RANK[f.rank].min * 0.7, (RANK[f.rank].m / mpp) * 0.55));
            const solidRoads = (rs) => byWidth(rs, solidW).map(([k, d]) => stroke(d, "#000", k)).join("");
            const black = fillEach(of("building"), "#000");
            if (style === "blackroads") body = outlined([...of("green"), ...of("water")]) + solidRoads(roads) + black + solidRoads(bridges) + rail;
            if (style === "blackdots") {
                const sp = 3;
                defs = `<pattern id="osmdots" width="${sp}" height="${sp}" patternUnits="userSpaceOnUse"><rect width="${sp}" height="${sp}" fill="#fff"/><rect x="${sp / 2 - 0.4}" y="${sp / 2 - 0.4}" width="0.8" height="0.8" fill="#000"/></pattern>`;
                body = fillEach([...of("green"), ...of("water")], "url(#osmdots)") + solidRoads(roads) + black + solidRoads(bridges) + rail;
            }
            if (style === "figure") body = cased(roads) + black + cased(bridges) + rail;
        } else if (style === "key3") {
            const k3 = (f) => keyOf3(f);
            body = of("ground").filter((f) => k3(f) === "parking").map((f) => fill(dOf(f), KEY3_OF.parking[1], ' stroke="#78909c" stroke-width="0.6"')).join("");
            body += of("green").filter((f) => k3(f) && k3(f) !== "hard").map((f) => fill(dOf(f), KEY3_OF[k3(f)][1])).join("");
            body += of("building").map((f) => fill(dOf(f), KEY3_OF.building[1], ' stroke="#616161" stroke-width="0.6"')).join("");
            body += of("green").filter((f) => k3(f) === "hard").map((f) => `<path d="${dOf(f)}" fill="none" stroke="${KEY3_OF.hard[1]}" stroke-width="1.2" stroke-dasharray="3 2"/>`).join("");
            // Left behind first, then streets, then what's kept, on top.
            const roads = of("road");
            for (const k of ["pathdrop", "bikedrop", "street", "pathkeep", "bikekeep"]) {
                const [, color, , , , sw] = KEY3_OF[k];
                body += stroke(join(roads.filter((f) => k3(f) === k)), color, far ? sw * 0.6 : sw);
            }
        } else if (style === "key2") {
            const areas = [...of("green"), ...of("building")].filter((f) => keyOf2(f));
            body = areas.filter((f) => f.kind !== "building").map((f) => fill(dOf(f), KEY2_OF[keyOf2(f)][1])).join("") + of("building").map((f) => fill(dOf(f), KEY2_OF.building[1], ' stroke="#616161" stroke-width="0.6"')).join("");
            const lines = of("road").filter((f) => keyOf2(f));
            for (const [k, color, , , how, sw] of KEY2) if (how !== "area") body += stroke(join(lines.filter((f) => keyOf2(f) === k)), color, far ? sw * 0.6 : sw);
        } else if (style === "key") {
            // Areas, then buildings, then every line on top, so nothing is hidden.
            const areas = [...of("ground"), ...of("green"), ...of("water")];
            body = areas.map((f) => fill(dOf(f), KEY_OF[keyOf(f)][1])).join("") + of("building").map((f) => fill(dOf(f), KEY_OF.building[1], ' stroke="#616161" stroke-width="0.6"')).join("");
            const lines = [...of("road"), ...of("tunnel"), ...of("rail")];
            for (const [k, color, , , how, sw] of KEY) {
                if (how === "area") continue;
                const d = join(lines.filter((f) => keyOf(f) === k));
                body += stroke(d, color, far ? sw * 0.6 : sw, how === "dash" ? ' stroke-dasharray="5 3"' : "");
            }
        } else if (style === "grain") {
            const byGrey = (fs, g) => fs.map((f) => fill(dOf(f), grey(GREY[g(f)]))).join("");
            body =
                `<rect width="${w}" height="${h}" fill="${grey(GREY.land)}"/>` +
                byGrey(of("ground"), (f) => f.sub) +
                byGrey(of("green"), (f) => f.sub) +
                fillEach(of("water"), grey(GREY.water)) +
                byWidth(roads.filter((f) => f.rank !== "path"), width).map(([k, d]) => stroke(d, "#fff", k)).join("") +
                stroke(join(roads.filter((f) => f.rank === "path")), "#fff", far ? 0.8 : 1.4) +
                stroke(join(of("building")), grey(GREY.buildingEdge), 1.5) +
                fillEach(of("building"), grey(GREY.building)) +
                byWidth(bridges, width).map(([k, d]) => stroke(d, "#fff", k)).join("") +
                stroke(join(of("rail")), grey(0.6), 1.2);
        }
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", w);
        svg.setAttribute("height", h);
        svg.style.cssText = `position:absolute;left:0;top:0;z-index:1;background:#fff;pointer-events:none${style === "grain" ? ";filter:url(#m2n)" : ""}`;
        svg.innerHTML = `<defs>${defs}</defs>${body}`;
        return svg;
    }

    window.OSMDraw = { ready, render, legend, count: () => DATA?.length ?? 0, paths: () => DATA.filter((f) => f.keep !== undefined) };
})();
