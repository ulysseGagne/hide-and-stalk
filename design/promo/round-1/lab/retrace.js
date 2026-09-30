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
        road: ["ffffff", "fefefe", "fdfdfd", "f7fabf", "fcd6a4", "f9b29c", "e892a2", "fa8072", "0000ff", "a0a0a0", "dddde8"],
        building: ["d9d0c9", "c4b6ab", "c1b3a8", "c6bbb1", "c2b5a9", "c9bdb4", "d5cbc4", "cfc4bb", "bca9a0"],
        green: ["add19e", "cdebb0", "88e0be", "aacbaf", "c8facc", "dffce2", "bddaa6", "c9e1bf", "aedfa3", "aed1a0", "b5e3b5", "aad3df", "c8d7ab", "def6c0"],
        ground: ["ffffe5", "fffeed", "fffeec", "ffffed", "f2efe9", "e0dfdf", "eeeeee", "ededed", "f2dad9", "e4e3e3", "dedddd", "dcdcdb", "dad9d9", "c7c7b4", "f3f3f3", "fafafa", "ebdbe8", "e6e4e0", "f5e9c6", "ffc0cb"],
    };
    const CLASS = { road: 1, building: 2, green: 3, ground: 4 };
    const LABEL = 5;
    const PAL = Object.entries(PALETTE).flatMap(([k, list]) => list.map((h) => [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), CLASS[k]]));

    // One colour -> one class; cached, since a tile has few distinct colours.
    const cache = new Map();
    function classify(r, g, b) {
        const key = (r << 16) | (g << 8) | b;
        let c = cache.get(key);
        if (c !== undefined) return c;
        let best = 1e9;
        c = LABEL;
        for (const [pr, pg, pb, k] of PAL) {
            const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
            if (d < best) {
                best = d;
                c = k;
            }
        }
        const luma = (0.3 * r + 0.59 * g + 0.11 * b) / 255;
        const neutral = Math.max(r, g, b) - Math.min(r, g, b) < 10;
        if (best > 22 ** 2) {
            // Not a map colour: a road edge (neutral grey), or a label.
            if (neutral && luma > 0.6 && luma < 0.86) c = CLASS.road;
            else if (best > 44 ** 2 || luma < 0.62) c = LABEL;
        }
        cache.set(key, c);
        return c;
    }

    /**
     * o.roads: "all" (fill and edges) | "fill" (edges white: thinner roads)
     * o.dots:  which classes get a light dot screen: [] | ["building"] | ["green"]
     * o.outline: outline weight in tile pixels (1 or 2)
     */
    function process(src, o) {
        const N = 256;
        const d = src.data;
        const cls = new Uint8Array(N * N);
        for (let i = 0; i < N * N; i++) {
            let c = classify(d[i * 4], d[i * 4 + 1], d[i * 4 + 2]);
            if (o.roads === "fill" && c === CLASS.road) {
                const r = d[i * 4];
                const g = d[i * 4 + 1];
                const b = d[i * 4 + 2];
                if (Math.max(r, g, b) - Math.min(r, g, b) < 10 && r < 235) c = CLASS.ground;
            }
            cls[i] = c;
        }
        // Labels and their halos: grow the label mask, then fill it in from
        // the classes around it, one ring at a time.
        const grow = 2;
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
        for (let i = 0; i < N * N; i++) if (unknown[i] && (cls[i] === CLASS.building || cls[i] === CLASS.green)) unknown[i] = 0;
        for (let pass = 0; pass < 40; pass++) {
            let left = 0;
            const fill = [];
            for (let y = 0; y < N; y++)
                for (let x = 0; x < N; x++) {
                    const i = y * N + x;
                    if (!unknown[i]) continue;
                    // The most common known class among the 8 neighbours; roads win ties.
                    const votes = [0, 0, 0, 0, 0];
                    for (let dy = -1; dy <= 1; dy++)
                        for (let dx = -1; dx <= 1; dx++) {
                            const xx = x + dx;
                            const yy = y + dy;
                            if (xx < 0 || yy < 0 || xx >= N || yy >= N) continue;
                            const j = yy * N + xx;
                            if (!unknown[j]) votes[cls[j]]++;
                        }
                    let bc = 0;
                    let bv = 0;
                    for (let c = 1; c <= 4; c++) if (votes[c] > bv || (votes[c] === bv && c === CLASS.road && bv > 0)) (bc = c), (bv = votes[c]);
                    if (bv) fill.push([i, bc]);
                    else left++;
                }
            for (const [i, c] of fill) {
                cls[i] = c;
                unknown[i] = 0;
            }
            if (!left) break;
        }
        for (let i = 0; i < N * N; i++) if (cls[i] === LABEL) cls[i] = CLASS.ground;
        despeckle(cls, N, o.speck ?? { 1: 9, 2: 40, 3: 160 });

        // Print: roads black; shapes white with a black edge; dots if asked.
        const out = new ImageData(N, N);
        const o4 = out.data;
        const isShape = (c) => c === CLASS.building || c === CLASS.green;
        const w = o.outline ?? 1;
        const dotted = new Set((o.dots ?? []).map((k) => CLASS[k]));
        for (let y = 0; y < N; y++)
            for (let x = 0; x < N; x++) {
                const i = y * N + x;
                const c = cls[i];
                let black = c === CLASS.road;
                if (!black && isShape(c)) {
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

    /**
     * Crumbs left from icons and tree patterns: any patch of road, building
     * or green smaller than `min[class]` pixels, not touching the tile's
     * edge (it may carry on in the next tile), takes the class around it.
     */
    function despeckle(cls, N, min) {
        const seen = new Int32Array(N * N).fill(-1);
        const stack = [];
        for (let s = 0; s < N * N; s++) {
            if (seen[s] !== -1) continue;
            const c = cls[s];
            const cap = min[c];
            const members = [];
            let edge = false;
            const around = [0, 0, 0, 0, 0];
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
                    } else around[cls[j]]++;
                }
            }
            if (!cap || edge || members.length >= cap) continue;
            let bc = CLASS.ground;
            let bv = -1;
            for (let k = 1; k <= 4; k++) if (around[k] > bv) (bc = k), (bv = around[k]);
            for (const i of members) cls[i] = bc;
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
                        ctx.putImageData(process(ctx.getImageData(0, 0, 256, 256), o), 0, 0);
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
