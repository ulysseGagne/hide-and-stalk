/* global L */

// The map, redrawn from the OpenStreetMap tiles pixel by pixel (skins S15-S19).
//
// Only the raster tiles are reachable, so instead of filtering them as a
// whole, every pixel is sorted by its colour in the OSM palette:
//
//   road      white road fill, the coloured road types, footways, cycleways,
//             and the grey road edges            -> black
//   building  the building fill and its edge      -> white, black outline
//   green     forest, grass, parks, pitches, water -> white, black outline
//   ground    campus, residential, parking, land   -> white
//   label     anything dark or off-palette (text, icons) -> removed: filled
//             in from what's around it, so a road runs through where its
//             name was
//
// Then the result is printed in pure black and white. Each tile is done on
// its own canvas as it loads, so this works on a phone too.

(function () {
    const PALETTE = {
        road: ["ffffff", "fefefe", "fdfdfd", "f7fabf", "fcd6a4", "f9b29c", "e892a2", "fa8072", "0000ff", "dddde8"],
        building: ["d9d0c9", "c4b6ab", "c1b3a8", "c6bbb1", "c2b5a9", "c9bdb4", "d5cbc4", "cfc4bb", "bca9a0"],
        green: ["add19e", "cdebb0", "88e0be", "aacbaf", "c8facc", "dffce2", "bddaa6", "c9e1bf", "aedfa3", "aed1a0", "b5e3b5", "aad3df", "c8d7ab", "def6c0", "88b78e", "96b788", "a7a89a", "8dc56c", "9cc38a"],
        ground: ["ffffe5", "fffeed", "fffeec", "ffffed", "f2efe9", "e0dfdf", "eeeeee", "ededed", "f2dad9", "e4e3e3", "dedddd", "dcdcdb", "dad9d9", "c7c7b4", "f3f3f3", "fafafa", "ebdbe8", "e6e4e0", "f5e9c6", "ffc0cb"],
    };
    const CLASS = { road: 1, building: 2, green: 3, ground: 4 };
    const LABEL = 5;
    const PAL = Object.entries(PALETTE).flatMap(([k, list]) => list.map((h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), CLASS[k]]));

    // One colour -> one class; cached, since a tile has few distinct colours.
    const cache = new Map();
    const lumOf = new Map();
    function classify(r, g, b) {
        const key = (r << 16) | (g << 8) | b;
        let c = cache.get(key);
        if (c !== undefined) return c;
        let best = 1e9;
        let bl = -1;
        c = LABEL;
        for (const [pr, pg, pb, k] of PAL) {
            const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
            if (d < best) {
                best = d;
                c = k;
                bl = (0.3 * pr + 0.59 * pg + 0.11 * pb) / 255;
            }
        }
        lumOf.set(key, best > 22 ** 2 ? -1 : bl);
        const luma = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
        const neutral = Math.max(r, g, b) - Math.min(r, g, b) < 10;
        if (best > 22 ** 2) {
            // Not a map colour: a road edge (neutral grey), or a label.
            if (neutral && luma > 0.6 && luma < 0.86) c = CLASS.road;
            else c = LABEL;
        }
        cache.set(key, c);
        return c;
    }

    /**
     * o.roads: "all" (fill and edges) | "fill" (edges white: thinner roads)
     * o.dots:  which classes get a light dot screen: [] | ["building"] | ["green"]
     * o.outline: outline weight in tile pixels (1 or 2)
     */
    // The grey each class is printed as, where a pixel's own colour is lost (labels).
    const CLASS_LUMA = { 1: 1, 2: 0.83, 3: 0.84, 4: 0.99 };
    // Grain that lines up across tiles: a hash of the pixel's place in the world.
    const grain = (gx, gy) => {
        let h = Math.imul(gx | 0, 374761393) + Math.imul(gy | 0, 668265263);
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };

    function process(src, o, coords) {
        const N = 256;
        const d = src.data;
        const cls = new Uint8Array(N * N);
        for (let i = 0; i < N * N; i++) {
            let c = classify(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
            if ((o.roads === "fill" || o.thin) && c === CLASS.road) {
                const r = d[i * 4];
                const g = d[i * 4 + 1];
                const b = d[i * 4 + 2];
                if (Math.max(r, g, b) - Math.min(r, g, b) < 10 && r < 235) c = CLASS.ground;
            }
            cls[i] = c;
        }
        // Labels and their halos: grow the label mask, then fill it in from
        // the classes around it, one ring at a time.
        // Clean mode keeps colours, so it needs a wider cut around each label.
        const grow = 3;
        let unknown = new Uint8Array(N * N);
        for (let i = 0; i < N * N; i++) if (cls[i] === LABEL) unknown[i] = 1;
        for (let k = 0; k < grow; k++) {
            const next = unknown.slice();
            for (let y = 0; y < N; y++)
                for (let x = 0; x < N; x++) {
                    const i = y * N + x;
                    if (unknown[i]) continue;
                    if ((x > 0 && unknown[i - 1]) || (x < N - 1 && unknown[i + 1]) || (y > 0 && unknown[i - N]) || (y < N - 1 && unknown[i + N])) next[i] = 1;
                }
            unknown = next;
        }
        // Halo pixels that are clearly a shape keep it; white halo pixels don't.
        if (o.mode !== "clean") for (let i = 0; i < N * N; i++) if (unknown[i] && (cls[i] === CLASS.building || cls[i] === CLASS.green)) unknown[i] = 0;
        const wasLabel = unknown.slice();
        // The pixels' own colours, carried along as labels get filled in ("clean" mode).
        const col = new Uint32Array(N * N);
        for (let i = 0; i < N * N; i++) col[i] = (d[i * 4] << 16) | (d[i * 4 + 1] << 8) | d[i * 4 + 2];
        for (let pass = 0; pass < 40; pass++) {
            let left = 0;
            const fill = [];
            for (let y = 0; y < N; y++)
                for (let x = 0; x < N; x++) {
                    const i = y * N + x;
                    if (!unknown[i]) continue;
                    // The most common known class among the 8 neighbours; roads win ties.
                    const votes = [0, 0, 0, 0, 0];
                    const donor = [0, 0, 0, 0, 0];
                    for (let dy = -1; dy <= 1; dy++)
                        for (let dx = -1; dx <= 1; dx++) {
                            const xx = x + dx;
                            const yy = y + dy;
                            if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
                            const j = yy * N + xx;
                            if (!unknown[j]) {
                                votes[cls[j]]++;
                                donor[cls[j]] = col[j];
                            }
                        }
                    let bc = 0;
                    let bv = 0;
                    for (let c = 1; c <= 4; c++) if (votes[c] > bv || (votes[c] === bv && c === CLASS.road && bv > 0)) (bc = c), (bv = votes[c]);
                    if (bv) fill.push([i, bc, donor[bc]]);
                    else left++;
                }
            for (const [i, c, k] of fill) {
                cls[i] = c;
                col[i] = k;
                unknown[i] = 0;
            }
            if (!left) break;
        }
        for (let i = 0; i < N * N; i++) if (cls[i] === LABEL) cls[i] = CLASS.ground;
        despeckle(cls, N, o.speck ?? { 1: 9, 2: 40, 3: 160 }, col);

        const out = new ImageData(N, N);
        const o4 = out.data;
        if (o.mode === "clean") {
            // The tile as it was, minus its text and icons: a filter prints it after.
            // o.greenAs: every green printed in the buildings' fill colour.
            if (o.greenAs === "building") for (let i = 0; i < N * N; i++) if (cls[i] === CLASS.green) col[i] = 0xd9d0c9;
            for (let i = 0; i < N * N; i++) {
                o4[i * 4] = col[i] >>> 16;
                o4[i * 4 + 1] = (col[i] >>> 8) & 255;
                o4[i * 4 + 2] = col[i] & 255;
                o4[i * 4 + 3] = 255;
            }
            return out;
        }
        if (o.mode === "tone") {
            // No lines anywhere: every shape is a field of grain, darker for
            // darker map colours; roads are coloured in.
            const { lo = 0.45, hi = 0.97, gamma = 1 } = o;
            const tone = (l) => Math.max(0, Math.min(1, (hi - l) / (hi - lo))) ** gamma;
            for (let y = 0; y < N; y++)
                for (let x = 0; x < N; x++) {
                    const i = y * N + x;
                    const c = cls[i];
                    let dens;
                    if (c === CLASS.road && o.road !== "pixel") dens = o.road ?? 1;
                    else {
                        const key = (d[i * 4] << 16) | (d[i * 4 + 1] << 8) | d[i * 4 + 2];
                        let l = o.pixel ? (0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2]) / 255 : lumOf.get(key) ?? -1;
                        // Flat: one grey per shape, so no edge is drawn around it.
                        if (!o.pixel && c === CLASS.building) l = CLASS_LUMA[2];
                        if (!o.pixel && (wasLabel[i] || l < 0 || cache.get(key) !== c)) l = CLASS_LUMA[c];
                        if (o.pixel && wasLabel[i]) l = CLASS_LUMA[c];
                        dens = tone(l);
                    }
                    const v = grain(coords.x * N + x, coords.y * N + y) < dens ? 0 : 255;
                    o4[i * 4] = o4[i * 4 + 1] = o4[i * 4 + 2] = v;
                    o4[i * 4 + 3] = 255;
                }
            return out;
        }
        // Print: roads black; shapes white with a black edge; dots if asked.
        const lined = new Set((o.outlines ?? ["building", "green"]).map((k) => CLASS[k]));
        const isShape = (c) => c === CLASS.building || c === CLASS.green;
        const w = o.outline ?? 1;
        const dotted = new Set((o.dots ?? []).map((k) => CLASS[k]));
        const solid = new Set((o.solid ?? []).map((k) => CLASS[k]));
        // Roads as one line down their middle: the road mask thinned to its skeleton.
        let centre = null;
        if (o.roads === "center") {
            const m = new Uint8Array(N * N);
            for (let i = 0; i < N * N; i++) m[i] = cls[i] === CLASS.road ? 1 : 0;
            centre = skeleton(m, N);
            if (o.lineW > 1) {
                const g = centre.slice();
                for (let y = 1; y < N - 1; y++)
                    for (let x = 1; x < N - 1; x++) if (centre[y * N + x]) for (const j of [y * N + x + 1, (y + 1) * N + x, (y + 1) * N + x + 1]) g[j] = 1;
                centre = g;
            }
        }
        for (let y = 0; y < N; y++)
            for (let x = 0; x < N; x++) {
                const i = y * N + x;
                const c = cls[i];
                let black = c === CLASS.road;
                if (centre) black = !!centre[i];
                if (solid.has(c)) black = true;
                // Roads drawn as their two edges only.
                if (black && o.roads === "outline") {
                    black = (x > 0 && cls[i - 1] !== c) || (x < N - 1 && cls[i + 1] !== c) || (y > 0 && cls[i - N] !== c) || (y < N - 1 && cls[i + N] !== c);
                }
                if (!black && isShape(c) && !lined.has(c)) {
                    if (dotted.has(c) && x % 4 === 1 && y % 4 === 1) black = true;
                } else if (!black && isShape(c)) {
                    // An edge: some pixel within w is not this shape.
                    edge: for (let dy = -w; dy <= w; dy++)
                        for (let dx = -w; dx <= w; dx++) {
                            if (Math.abs(dx) + Math.abs(dy) > w) continue;
                            const xx = x + dx;
                            const yy = y + dy;
                            if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
                            const cc = cls[yy * N + xx];
                            if (cc !== c && cc !== CLASS.road) {
                                black = true;
                                break edge;
                            }
                        }
                    if (!black && dotted.has(c) && x % 4 === 1 && y % 4 === 1) black = true;
                }
                const v = black ? 0 : 255;
                o4[i * 4] = o4[i * 4 + 1] = o4[i * 4 + 2] = v;
                o4[i * 4 + 3] = 255;
            }
        return out;
    }

    /** Zhang-Suen thinning: a binary mask down to 1-pixel lines. */
    function skeleton(m, N) {
        const at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N ? 0 : m[y * N + x]);
        for (let iter = 0; iter < 30; iter++) {
            let changed = false;
            for (const step of [0, 1]) {
                const del = [];
                for (let y = 0; y < N; y++)
                    for (let x = 0; x < N; x++) {
                        if (!m[y * N + x]) continue;
                        const p = [at(x, y - 1), at(x + 1, y - 1), at(x + 1, y), at(x + 1, y + 1), at(x, y + 1), at(x - 1, y + 1), at(x - 1, y), at(x - 1, y - 1)];
                        const b = p.reduce((a, v) => a + v, 0);
                        if (b < 2 || b > 6) continue;
                        let a = 0;
                        for (let k = 0; k < 8; k++) if (!p[k] && p[(k + 1) % 8]) a++;
                        if (a !== 1) continue;
                        if (step === 0 ? p[0] * p[2] * p[4] || p[2] * p[4] * p[6] : p[0] * p[2] * p[6] || p[0] * p[4] * p[6]) continue;
                        del.push(y * N + x);
                    }
                for (const i of del) m[i] = 0;
                if (del.length) changed = true;
            }
            if (!changed) break;
        }
        return m;
    }

    /**
     * Crumbs left from icons and tree patterns: any patch of road, building
     * or green smaller than `min[class]` pixels, not touching the tile's
     * edge (it may carry on in the next tile), takes the class around it.
     */
    function despeckle(cls, N, min, col) {
        const seen = new Int32Array(N * N).fill(-1);
        const stack = [];
        for (let s = 0; s < N * N; s++) {
            if (seen[s] !== -1) continue;
            const c = cls[s];
            const cap = min[c];
            const members = [];
            let edge = false;
            const around = [0, 0, 0, 0, 0];
            const aroundCol = [0, 0, 0, 0, 0];
            stack.push(s);
            seen[s] = s;
            while (stack.length) {
                const i = stack.pop();
                members.push(i);
                const x = i % N;
                const y = (i - x) / N;
                if (x === 0 || y === 0 || x === N - 1 || y === N - 1) edge = true;
                for (const j of [x > 0 ? i - 1 : -1, x < N - 1 ? i + 1 : -1, y > 0 ? i - N : -1, y < N - 1 ? i + N : -1]) {
                    if (j < 0) continue;
                    if (cls[j] === c) {
                        if (seen[j] === -1) {
                            seen[j] = s;
                            stack.push(j);
                        }
                    } else {
                        around[cls[j]]++;
                        aroundCol[cls[j]] = col ? col[j] : 0;
                    }
                }
            }
            if (!cap || edge || members.length >= cap) continue;
            let bc = CLASS.ground;
            let bv = -1;
            for (let k = 1; k <= 4; k++) if (around[k] > bv) (bc = k), (bv = around[k]);
            for (const i of members) {
                cls[i] = bc;
                if (col) col[i] = aroundCol[bc];
            }
        }
    }

    function layer(o = {}) {
        const Layer = L.GridLayer.extend({
            createTile(coords, done) {
                const tile = document.createElement("canvas");
                tile.width = tile.height = 256;
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => {
                    const ctx = tile.getContext("2d", { willReadFrequently: true });
                    ctx.drawImage(img, 0, 0);
                    try {
                        ctx.putImageData(process(ctx.getImageData(0, 0, 256, 256), o, coords), 0, 0);
                    } catch (e) {
                        console.error("retrace", e.message);
                    }
                    done(null, tile);
                };
                img.onerror = () => done(new Error("tile"), tile);
                img.src = `https://tile.openstreetmap.org/${coords.z}/${coords.x}/${coords.y}.png`;
                return tile;
            },
        });
        return new Layer({ maxZoom: 19, maxNativeZoom: 19, attribution: "© OpenStreetMap" });
    }

    window.Retrace = { layer, classify };
})();
