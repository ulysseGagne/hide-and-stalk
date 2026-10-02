/* global L */

// The campus map, drawn from OpenStreetMap's data in our own style (S20 in the
// design review): streets and paths solid black, buildings black, woods in
// close dots, grass and fields in sparse ones, the stadium and the running
// track hatched. No tiles to fetch and no text on the map.
//
// The data (data/campus-map.json) is built by tools/build-map.mjs: only what
// is drawn, already sorted, simplified, in Web Mercator pixels at zoom 20.
// This file draws any view of it onto a 2D canvas: the map's tiles (layer())
// and the receipt's printed map (receipt.js) use the same drawing. The tiles
// also print the hints' ruled-out area inverted (setMask), right in the
// canvas, so nothing has to be blended over the map while it zooms.

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

    /** Twice a ring's signed area (its sign says which way it winds). */
    function area2(r) {
        let a = 0;
        for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) a += r[j] * r[i + 1] - r[i] * r[j + 1];
        return a;
    }
    function contains(r, x, y) {
        let c = false;
        for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
            if (r[i + 1] > y !== r[j + 1] > y && x < ((r[j] - r[i]) * (y - r[i + 1])) / (r[j + 1] - r[i + 1]) + r[i]) c = !c;
        }
        return c;
    }
    /**
     * A shape's rings wound outer one way and holes the other, so a kind's
     * shapes can be filled together with "nonzero" (see fillArea). A ring
     * inside an odd number of the shape's other rings is a hole.
     */
    function wound(rings) {
        return rings.map((r, k) => {
            const depth = rings.reduce((n, o, m) => n + (m !== k && contains(o, r[0], r[1]) ? 1 : 0), 0);
            if (area2(r) > 0 === (depth % 2 === 0)) return r;
            const out = new Float64Array(r.length);
            for (let i = 0; i < r.length; i += 2) {
                out[i] = r[r.length - 2 - i];
                out[i + 1] = r[r.length - 1 - i];
            }
            return out;
        });
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
        for (const kind of ["sport", "grass", "wood"]) for (const rings of raw[kind]) add(kind, wound(rings.map(unpack)));
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

    // -----------------------------------------------------------------------
    // The heatmap (tools/build-heat.mjs): each tier above white as closed
    // rings, a point every 3 m. Loaded the first time it is needed: only once
    // the heatmap question has been asked.
    // -----------------------------------------------------------------------
    let heat = null;
    let heatPromise = null;
    function loadHeat(url = "data/campus-heat.json") {
        heatPromise ??= fetch(url)
            .then((r) => {
                if (!r.ok) throw new Error(`heatmap: HTTP ${r.status}`);
                return r.json();
            })
            .then((raw) => {
                heat = {
                    z: raw.z,
                    ox: raw.origin[0],
                    oy: raw.origin[1],
                    colors: raw.colors,
                    tiers: raw.tiers.map((rings) => rings.map((r) => {
                        const ring = unpack(r);
                        return { ring, bbox: bboxOf([ring]) };
                    })),
                };
                return heat;
            })
            .catch((err) => {
                heatPromise = null;
                throw err;
            });
        return heatPromise;
    }

    /**
     * The heatmap alone into ctx (view as for draw): white, then each tier on
     * top, its rings traced as curves through the midpoints between their
     * points, so the edges have no corners at any zoom.
     */
    function drawHeat(ctx, view) {
        const { z, x: vx, y: vy, w, h } = view;
        ctx.fillStyle = heat.colors[0];
        ctx.fillRect(0, 0, w, h);
        const s = 2 ** (z - heat.z);
        const bx = heat.ox * s - vx;
        const by = heat.oy * s - vy;
        const [x0, y0, x1, y1] = [-bx / s, -by / s, (w - bx) / s, (h - by) / s];
        heat.tiers.forEach((rings, i) => {
            ctx.beginPath();
            let any = false;
            for (const { ring, bbox } of rings) {
                if (bbox[2] < x0 || bbox[0] > x1 || bbox[3] < y0 || bbox[1] > y1) continue;
                const n = ring.length / 2;
                const X = (k) => ring[2 * (k % n)] * s + bx;
                const Y = (k) => ring[2 * (k % n) + 1] * s + by;
                ctx.moveTo((X(n - 1) + X(0)) / 2, (Y(n - 1) + Y(0)) / 2);
                for (let k = 0; k < n; k++) ctx.quadraticCurveTo(X(k), Y(k), (X(k) + X(k + 1)) / 2, (Y(k) + Y(k + 1)) / 2);
                ctx.closePath();
                any = true;
            }
            if (!any) return;
            ctx.fillStyle = heat.colors[i + 1];
            ctx.fill("evenodd");
        });
    }

    // The square the hider sends for the heatmap question: one phone screen of
    // the map at its closest zoom (about 80 x 115 m), centred on them.
    const SQUARE = { z: 19, w: 390, h: 560, ratio: 2 };

    /** The heatmap square around (lng, lat), heatmap only, as a PNG data URL. */
    async function heatSquare(lng, lat) {
        await loadHeat();
        const { z, w, h, ratio } = SQUARE;
        const [px, py] = project(lng, lat, z);
        const canvas = document.createElement("canvas");
        canvas.width = w * ratio;
        canvas.height = h * ratio;
        const ctx = canvas.getContext("2d");
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        drawHeat(ctx, { z, x: px - w / 2, y: py - h / 2, w, h });
        return canvas.toDataURL("image/png");
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

    /** A GeoJSON Polygon or MultiPolygon as its rings in zoom-20 pixels (global, not relative to the data). */
    function ringsAt20(geometry) {
        const polys = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
        const out = [];
        for (const poly of polys) {
            for (const ring of poly) {
                const flat = new Float64Array(ring.length * 2);
                ring.forEach(([lng, lat], i) => {
                    const [x, y] = project(lng, lat, 20);
                    flat[2 * i] = x;
                    flat[2 * i + 1] = y;
                });
                out.push(flat);
            }
        }
        return out;
    }

    // -----------------------------------------------------------------------
    // Drawing
    // -----------------------------------------------------------------------
    /**
     * Draw the map into ctx, already scaled to CSS pixels.
     * view: { z (any zoom), x, y (the canvas's top-left, global pixels at z),
     *         w, h (CSS pixels), ratio (device pixels per CSS pixel, a whole number),
     *         heat (optional: the heatmap in place of the streets, once loaded),
     *         mask (optional: rings from ringsAt20, printed inverted) }
     */
    function draw(ctx, view) {
        if (view.heat && heat) drawHeat(ctx, view);
        else drawCampus(ctx, view);
        printMask(ctx, view);
    }

    /** The streets, buildings and the key's areas (draw, without the heatmap). */
    function drawCampus(ctx, view) {
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
        // Every shape of a kind in one path, filled once: a patterned fill is
        // dear however small the shape (the grass is 175 of them), and drawing
        // them one by one made each tile several times slower. The rings are
        // wound outer one way, holes the other (decode), so "nonzero" keeps
        // the holes and fills where shapes overlap.
        const fillArea = (kind, style) => {
            ctx.beginPath();
            let any = false;
            for (const f of list) {
                if (f.kind !== kind) continue;
                for (const r of f.rings) trace(r, true);
                any = true;
            }
            if (!any) return;
            ctx.fillStyle = style;
            ctx.fill("nonzero");
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
        fillArea("sport", areaPattern(ctx, "sport", ratio, vx, vy));
        fillArea("grass", areaPattern(ctx, "grass", ratio, vx, vy));
        fillArea("wood", areaPattern(ctx, "wood", ratio, vx, vy));
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

    /** What the answers ruled out, inverted: a difference with white, as the receipt prints it. */
    function printMask(ctx, view) {
        const { z, x: vx, y: vy } = view;
        if (view.mask?.length) {
            const m = 2 ** (z - 20);
            ctx.globalCompositeOperation = "difference";
            ctx.fillStyle = "#fff";
            ctx.beginPath();
            for (const ring of view.mask) {
                ctx.moveTo(ring[0] * m - vx, ring[1] * m - vy);
                for (let i = 2; i < ring.length; i += 2) ctx.lineTo(ring[i] * m - vx, ring[i + 1] * m - vy);
                ctx.closePath();
            }
            ctx.fill("evenodd");
            ctx.globalCompositeOperation = "source-over";
        }
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
        let mask = null; // the ruled-out area (ringsAt20), printed inverted on every tile
        let heatOn = false; // the heatmap in place of the streets
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
                this._paint(tile, coords, done);
                return tile;
            },
            /** Draw a tile, in turn with the others; `done` (Leaflet's) when it is a new one. */
            _paint(tile, coords, done) {
                queue.push(() => {
                    if (!tile.isConnected && !this._tiles?.[this._tileCoordsToKey(coords)]) return done?.(null, tile);
                    const size = this.getTileSize();
                    const ratio = tile.width / size.x;
                    const ctx = tile.getContext("2d");
                    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
                    draw(ctx, { z: coords.z, x: coords.x * size.x, y: coords.y * size.y, w: size.x, h: size.y, ratio, mask, heat: heatOn });
                    done?.(null, tile);
                });
                ready.then(pump);
            },
            /**
             * What the answers ruled out (GeoJSON Polygon or MultiPolygon, or
             * null), printed inverted on the tiles. The tiles already up are
             * drawn again where they are, so the map never flashes blank.
             */
            setMask(geometry) {
                mask = geometry ? ringsAt20(geometry) : null;
                this._repaint();
            },
            /** The heatmap in place of the streets, or not; drawn once it has loaded. */
            setHeat(on) {
                if (heatOn === on) return;
                heatOn = on;
                if (on && !heat) loadHeat().then(() => heatOn && this._repaint(), (err) => console.error(err));
                else this._repaint();
            },
            /** Draw the tiles already up again where they are, so the map never flashes blank. */
            _repaint() {
                for (const t of Object.values(this._tiles ?? {})) this._paint(t.el, t.coords);
            },
        });
        return new Layer({ tileSize: 256, updateWhenZooming: false, keepBuffer: 4, ...options });
    }

    window.HNSMapDraw = { load, ready, draw, project, layer, canvasRatio, isReady: () => Boolean(data), loadHeat, heatSquare };
})();
