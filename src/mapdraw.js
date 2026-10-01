/* global L */

// The campus map, drawn from OpenStreetMap's data in our own style (S20 in the
// design review): streets and paths solid black, buildings black, woods in
// close dots, grass and fields in sparse ones, the stadium and the running
// track hatched. No tiles to fetch and no text on the map.
//
// The data (data/campus-map.json) is built by tools/build-map.mjs: only what
// is drawn, already sorted, simplified, in Web Mercator pixels at zoom 20.
// This file draws any view of it onto a 2D canvas: the map's tiles (layer())
// and the receipt's printed map (receipt.js) use the same drawing.

(function () {
    // Road widths: metres, and the fewest pixels a road may shrink to (the
    // lab's osmdraw.js RANK). Drawn at 0.55 of their width, never under 0.7 of
    // the minimum; paths are a hairline.
    const RANKS = ["major", "medium", "minor", "service", "aisle", "path"];
    const RANK = [
        { m: 13, min: 3.2 },
        { m: 10, min: 2.6 },
        { m: 7, min: 2 },
        { m: 4.5, min: 1.5 },
        { m: 3, min: 1.2 },
        { m: 2, min: 1 },
    ];
    const PATH = RANKS.indexOf("path");
    // Zoomed out past this, paths get thinner and specks of buildings go.
    const FAR_BELOW = 15.5;
    const CELL = 2048; // the spatial index's cell, in zoom-20 pixels (~200 m)
    const CAMPUS_LAT = 46.78;

    let data = null;
    let readyResolve;
    const ready = new Promise((ok) => (readyResolve = ok));

    /** Undo build-map.mjs's delta encoding: one ring as absolute zoom-20 pixels (relative to the origin). */
    function unpack(deltas) {
        const out = new Float64Array(deltas.length);
        let x = 0;
        let y = 0;
        for (let i = 0; i < deltas.length; i += 2) {
            x += deltas[i];
            y += deltas[i + 1];
            out[i] = x;
            out[i + 1] = y;
        }
        return out;
    }

    function bboxOf(rings) {
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (const r of rings) {
            for (let i = 0; i < r.length; i += 2) {
                if (r[i] < x0) x0 = r[i];
                if (r[i] > x1) x1 = r[i];
                if (r[i + 1] < y0) y0 = r[i + 1];
                if (r[i + 1] > y1) y1 = r[i + 1];
            }
        }
        return [x0, y0, x1, y1];
    }

    function decode(raw) {
        const features = [];
        const add = (kind, rings, extra = {}) => features.push({ kind, rings, bbox: bboxOf(rings), ...extra });
        for (const [rank, up, line] of raw.roads) add(up ? "bridge" : "road", [unpack(line)], { rank });
        for (const rings of raw.buildings) add("building", rings.map(unpack));
        for (const kind of ["sport", "grass", "wood"]) for (const rings of raw[kind]) add(kind, rings.map(unpack));
        // A coarse grid: which features touch which cell.
        const grid = new Map();
        features.forEach((f, id) => {
            const [x0, y0, x1, y1] = f.bbox;
            for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
                for (let cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++) {
                    const k = cx * 65536 + cy;
                    let cell = grid.get(k);
                    if (!cell) grid.set(k, (cell = []));
                    cell.push(id);
                }
            }
        });
        return { z: raw.z, ox: raw.origin[0], oy: raw.origin[1], features, grid, seen: new Uint32Array(features.length), stamp: 0 };
    }

    function load(url) {
        return fetch(url)
            .then((r) => {
                if (!r.ok) throw new Error(`campus map: HTTP ${r.status}`);
                return r.json();
            })
            .then((raw) => {
                data = decode(raw);
                readyResolve(data);
                return data;
            });
    }

    /** Web Mercator: lng/lat to global pixels at zoom z (Leaflet's EPSG:3857 at 256 px). */
    function project(lng, lat, z) {
        const world = 256 * 2 ** z;
        const s = Math.sin((lat * Math.PI) / 180);
        return [((lng + 180) / 360) * world, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * world];
    }

    /** The features whose box meets the zoom-20 rectangle, each once. */
    function query(x0, y0, x1, y1) {
        const out = [];
        const stamp = ++data.stamp;
        for (let cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
            for (let cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++) {
                const cell = data.grid.get(cx * 65536 + cy);
                if (!cell) continue;
                for (const id of cell) {
                    if (data.seen[id] === stamp) continue;
                    data.seen[id] = stamp;
                    const b = data.features[id].bbox;
                    if (b[2] >= x0 && b[0] <= x1 && b[3] >= y0 && b[1] <= y1) out.push(data.features[id]);
                }
            }
        }
        return out;
    }

    // -----------------------------------------------------------------------
    // Patterns: the key's areas in black and white. Each one is anchored to
    // the world, not the canvas, so neighbouring tiles line up dot for dot.
    // -----------------------------------------------------------------------
    const patternCache = new Map();
    function patternCanvas(kind, ratio) {
        const key = `${kind}:${ratio}`;
        if (patternCache.has(key)) return patternCache.get(key);
        // [cell size in CSS px, draw the cell]: dots 0.8 px; the hatch's bars
        // 0.9 px every 3.2 px (five to a 16 px cell, so the cell is whole pixels).
        const spec = {
            wood: [3, (c) => c.fillRect(1.1, 1.1, 0.8, 0.8)],
            grass: [6, (c) => (c.fillRect(1.1, 1.1, 0.8, 0.8), c.fillRect(4.1, 4.1, 0.8, 0.8))],
            sport: [16, (c) => {
                for (let i = 0; i < 5; i++) c.fillRect(i * 3.2, 0, 0.9, 16);
            }],
        }[kind];
        const [size, draw] = spec;
        const cv = document.createElement("canvas");
        cv.width = cv.height = size * ratio;
        const c = cv.getContext("2d");
        c.scale(ratio, ratio);
        c.fillStyle = "#fff";
        c.fillRect(0, 0, size, size);
        c.fillStyle = "#000";
        draw(c);
        const entry = { cv, size };
        patternCache.set(key, entry);
        return entry;
    }

    const mod = (a, n) => ((a % n) + n) % n;

    /** A fill style for an area, lined up with the world at this view's origin. */
    function areaPattern(ctx, kind, ratio, vx, vy) {
        const { cv, size } = patternCanvas(kind, ratio);
        const pattern = ctx.createPattern(cv, "repeat");
        let m = new DOMMatrix();
        if (kind === "sport") {
            // The hatch is turned 45°: its cell repeats every 16·√2 px across and down.
            const p = size * Math.SQRT2;
            m = m.translate(-mod(vx, p), -mod(vy, p)).rotate(45);
        } else {
            m = m.translate(-mod(vx, size), -mod(vy, size));
        }
        pattern.setTransform(m.scale(1 / ratio));
        return pattern;
    }

    // -----------------------------------------------------------------------
    // Drawing
    // -----------------------------------------------------------------------
    /**
     * Draw the map into ctx, already scaled to CSS pixels.
     * view: { z (any zoom), x, y (the canvas's top-left, global pixels at z),
     *         w, h (CSS pixels), ratio (device pixels per CSS pixel, a whole number) }
     */
    function draw(ctx, view) {
        const { z, x: vx, y: vy, w, h } = view;
        const ratio = view.ratio ?? 1;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, w, h);
        if (!data) return;
        const s = 2 ** (z - data.z);
        // Zoom-20 pixels (relative to the origin) -> this canvas: X = v * s + bx.
        const bx = data.ox * s - vx;
        const by = data.oy * s - vy;
        const far = z < FAR_BELOW;
        const mpp = (40075016.686 * Math.cos((CAMPUS_LAT * Math.PI) / 180)) / (256 * 2 ** z);
        // The widest stroke (a major road), so roads just off the edge still draw their half.
        const pad = Math.max(8, (RANK[0].m / mpp) * 0.55) / s;
        const list = query((0 - bx) / s - pad, (0 - by) / s - pad, (w - bx) / s + pad, (h - by) / s + pad);

        const trace = (ring, close) => {
            ctx.moveTo(ring[0] * s + bx, ring[1] * s + by);
            for (let i = 2; i < ring.length; i += 2) ctx.lineTo(ring[i] * s + bx, ring[i + 1] * s + by);
            if (close) ctx.closePath();
        };
        const fillEach = (kind, style) => {
            ctx.fillStyle = style;
            for (const f of list) {
                if (f.kind !== kind) continue;
                ctx.beginPath();
                for (const r of f.rings) trace(r, true);
                ctx.fill("evenodd");
            }
        };
        const roadWidth = (rank) => (rank === PATH ? (far ? 0.6 : 1) : Math.max(RANK[rank].min * 0.7, (RANK[rank].m / mpp) * 0.55));
        const strokeRoads = (kind) => {
            ctx.strokeStyle = "#000";
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            for (let rank = 0; rank < RANKS.length; rank++) {
                ctx.beginPath();
                let any = false;
                for (const f of list) {
                    if (f.kind !== kind || f.rank !== rank) continue;
                    trace(f.rings[0], false);
                    any = true;
                }
                if (!any) continue;
                ctx.lineWidth = roadWidth(rank);
                ctx.stroke();
            }
        };

        // The stadium and the track under the fields, the fields under the woods.
        fillEach("sport", areaPattern(ctx, "sport", ratio, vx, vy));
        fillEach("grass", areaPattern(ctx, "grass", ratio, vx, vy));
        fillEach("wood", areaPattern(ctx, "wood", ratio, vx, vy));
        strokeRoads("road");
        ctx.fillStyle = "#000";
        for (const f of list) {
            if (f.kind !== "building") continue;
            if (far && (f.bbox[2] - f.bbox[0]) * s * (f.bbox[3] - f.bbox[1]) * s < 3) continue;
            ctx.beginPath();
            for (const r of f.rings) trace(r, true);
            ctx.fill("evenodd");
        }
        strokeRoads("bridge");
    }

    /** Device pixels per CSS pixel for the map's canvases: whole numbers only (see patternCanvas), at most 2. */
    const canvasRatio = () => Math.max(1, Math.min(2, Math.round(window.devicePixelRatio || 1)));

    /**
     * The map as a Leaflet layer: 256 px canvas tiles, drawn a few at a time
     * so a screenful never blocks the page in one go.
     */
    function layer(options = {}) {
        const queue = [];
        let busy = false;
        const pump = () => {
            if (busy) return;
            busy = true;
            const run = (deadline) => {
                const until = performance.now() + 12;
                while (queue.length && (deadline?.timeRemaining?.() ?? until - performance.now()) > 0) queue.shift()();
                if (queue.length) schedule(run);
                else busy = false;
            };
            schedule(run);
        };
        const schedule = (fn) => requestAnimationFrame(() => fn(null));
        const Layer = L.GridLayer.extend({
            createTile(coords, done) {
                const tile = document.createElement("canvas");
                const size = this.getTileSize();
                const ratio = canvasRatio();
                tile.width = size.x * ratio;
                tile.height = size.y * ratio;
                queue.push(() => {
                    if (!tile.isConnected && !this._tiles?.[this._tileCoordsToKey(coords)]) return done(null, tile);
                    const ctx = tile.getContext("2d");
                    ctx.scale(ratio, ratio);
                    draw(ctx, { z: coords.z, x: coords.x * size.x, y: coords.y * size.y, w: size.x, h: size.y, ratio });
                    done(null, tile);
                });
                ready.then(pump);
                return tile;
            },
        });
        return new Layer({ tileSize: 256, updateWhenZooming: false, keepBuffer: 4, ...options });
    }

    window.HNSMapDraw = { load, ready, draw, project, layer, canvasRatio, isReady: () => Boolean(data) };
})();
