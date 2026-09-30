/* global getStroke */

// Ink: the "someone unhinged drew on the app" layer.
//
// Everything red in the brand is drawn by this file, never typed: the STALK
// scrawl, crossings-out, circles, arrows, notes, the coloured-in buttons. It
// draws the way an Apple Pencil does: a skeleton of points, pushed around by
// seeded noise so no two letters come out the same, then turned into a
// pressure-sensitive outline by perfect-freehand.
//
// Seeded: the same seed always draws the same mark, so a screen doesn't
// "boil" every time it re-renders, but two marks never look copy-pasted.
//
// Output is SVG markup (strings), so it drops into any <svg>.

(function () {
    const RED = "#E7191F";

    // -----------------------------------------------------------------------
    // Randomness
    // -----------------------------------------------------------------------
    function hash(str) {
        let h = 2166136261 >>> 0;
        for (const ch of String(str)) {
            h ^= ch.codePointAt(0);
            h = Math.imul(h, 16777619) >>> 0;
        }
        return h;
    }

    /** mulberry32: a small, good-enough seeded PRNG. */
    function rng(seed) {
        let a = typeof seed === "number" ? seed >>> 0 : hash(seed);
        const next = () => {
            a = (a + 0x6d2b79f5) >>> 0;
            let t = a;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        next.range = (lo, hi) => lo + next() * (hi - lo);
        next.sign = () => (next() < 0.5 ? -1 : 1);
        next.pick = (arr) => arr[Math.floor(next() * arr.length)];
        return next;
    }

    /** Smooth 1D value noise in [-1, 1]; wavelength ~1 unit of t. */
    function noise1(r) {
        const lattice = Array.from({ length: 256 }, () => r() * 2 - 1);
        return (t) => {
            const i = Math.floor(t);
            const f = t - i;
            const a = lattice[((i % 256) + 256) % 256];
            const b = lattice[(((i + 1) % 256) + 256) % 256];
            const s = (1 - Math.cos(f * Math.PI)) / 2;
            return a + (b - a) * s;
        };
    }

    // -----------------------------------------------------------------------
    // Geometry helpers
    // -----------------------------------------------------------------------
    /** Catmull-Rom through the points: turns a skeleton into a smooth curve. */
    function spline(pts, steps = 6) {
        if (pts.length < 3) return densify(pts, steps * 2);
        const out = [];
        for (let i = 0; i < pts.length - 1; i++) {
            const p0 = pts[i - 1] ?? pts[i];
            const p1 = pts[i];
            const p2 = pts[i + 1];
            const p3 = pts[i + 2] ?? p2;
            for (let s = 0; s < steps; s++) {
                const t = s / steps;
                const t2 = t * t;
                const t3 = t2 * t;
                out.push([
                    0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
                    0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
                ]);
            }
        }
        out.push(pts[pts.length - 1]);
        return out;
    }

    function densify(pts, per = 8) {
        const out = [];
        for (let i = 0; i < pts.length - 1; i++) {
            for (let s = 0; s < per; s++) {
                const t = s / per;
                out.push([pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]);
            }
        }
        out.push(pts[pts.length - 1]);
        return out;
    }

    const rot = ([x, y], a, [cx, cy] = [0, 0]) => {
        const c = Math.cos(a);
        const s = Math.sin(a);
        return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c];
    };

    const r1 = (n) => Math.round(n * 10) / 10;

    /** perfect-freehand outline -> SVG path data. */
    function outlinePath(points, opts = {}) {
        const stroke = getStroke(points, {
            size: opts.size ?? 6,
            thinning: opts.thinning ?? 0.2,
            smoothing: opts.smoothing ?? 0.62,
            streamline: opts.streamline ?? 0.35,
            simulatePressure: opts.simulatePressure ?? true,
            start: { taper: opts.taperStart ?? 0, cap: true },
            end: { taper: opts.taperEnd ?? 0, cap: true },
            last: true,
        });
        if (!stroke.length) return "";
        const d = ["M", r1(stroke[0][0]), r1(stroke[0][1]), "Q"];
        for (let i = 0; i < stroke.length; i++) {
            const [x0, y0] = stroke[i];
            const [x1, y1] = stroke[(i + 1) % stroke.length];
            d.push(r1(x0), r1(y0), r1((x0 + x1) / 2), r1((y0 + y1) / 2));
        }
        d.push("Z");
        return d.join(" ");
    }

    /**
     * The house rule: nothing drawn is ever perfectly straight or perfectly
     * round. Every stroke is resampled and nudged sideways by slow, seeded
     * noise, more on long lines (a hand drifts over distance), barely at all
     * on a letter.
     */
    function humanize(points, opts = {}) {
        if (opts.wobble === false || points.length < 2) return points;
        const dense = [points[0]];
        for (let i = 1; i < points.length; i++) {
            const [ax, ay] = points[i - 1];
            const [bx, by] = points[i];
            const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / 5));
            for (let k = 1; k <= steps; k++) dense.push([ax + ((bx - ax) * k) / steps, ay + ((by - ay) * k) / steps]);
        }
        let total = 0;
        const dist = dense.map((p, i) => (i ? (total += Math.hypot(p[0] - dense[i - 1][0], p[1] - dense[i - 1][1])) : 0));
        if (total < 3) return points;
        const n = noise1(rng(`${Math.round(points[0][0])},${Math.round(points[0][1])},${Math.round(total)}`));
        const amp = opts.wobbleAmp ?? Math.min(2.4, 0.3 + total * 0.006);
        const wave = Math.max(24, total / 3);
        return dense.map((p, i) => {
            const prev = dense[Math.max(0, i - 1)];
            const next = dense[Math.min(dense.length - 1, i + 1)];
            let nx = -(next[1] - prev[1]);
            let ny = next[0] - prev[0];
            const l = Math.hypot(nx, ny) || 1;
            nx /= l;
            ny /= l;
            // Ends stay put, so a stroke still meets what it points at.
            const ease = Math.min(1, dist[i] / 8, (total - dist[i]) / 8);
            const k = (n(dist[i] / wave) + n(dist[i] / 7 + 50) * 0.18) * amp * ease;
            return [p[0] + nx * k, p[1] + ny * k];
        });
    }

    function pathEl(points, opts = {}) {
        const d = outlinePath(humanize(points, opts), opts);
        return d ? `<path d="${d}" fill="${opts.color ?? RED}"/>` : "";
    }

    // -----------------------------------------------------------------------
    // Letter skeletons: single strokes in a unit box. y=0 cap height, y=1
    // baseline; [width, strokes]. Curves get smoothed by spline(), so a few
    // points per bend is enough. Capitals only: the notes are shouted.
    // -----------------------------------------------------------------------
    const O_RING = [[0.36, 0], [0.1, 0.1], [0, 0.48], [0.08, 0.86], [0.36, 1], [0.64, 0.87], [0.74, 0.5], [0.66, 0.13], [0.4, 0], [0.26, 0.05]];
    const GLYPHS = {
        A: [0.72, [[[0, 1], [0.36, 0], [0.72, 1]], [[0.14, 0.64], [0.6, 0.6]]]],
        B: [0.62, [[[0, 1], [0, 0]], [[0, 0], [0.38, 0], [0.54, 0.1], [0.55, 0.3], [0.38, 0.46], [0.02, 0.48]], [[0.02, 0.48], [0.44, 0.5], [0.62, 0.64], [0.6, 0.86], [0.42, 1], [0, 1]]]],
        C: [0.64, [[[0.62, 0.16], [0.46, 0.01], [0.2, 0.03], [0.03, 0.26], [0.02, 0.7], [0.2, 0.97], [0.46, 1], [0.64, 0.84]]]],
        D: [0.66, [[[0, 0], [0, 1]], [[0, 0], [0.3, 0], [0.58, 0.16], [0.66, 0.5], [0.56, 0.84], [0.3, 1], [0, 1]]]],
        E: [0.56, [[[0.56, 0], [0, 0], [0, 1], [0.58, 1]], [[0, 0.5], [0.44, 0.49]]]],
        F: [0.54, [[[0.56, 0], [0, 0], [0, 1]], [[0, 0.48], [0.42, 0.47]]]],
        G: [0.68, [[[0.62, 0.15], [0.46, 0.01], [0.2, 0.03], [0.03, 0.26], [0.02, 0.7], [0.2, 0.97], [0.46, 1], [0.66, 0.88], [0.67, 0.58], [0.4, 0.58]]]],
        H: [0.64, [[[0, 0], [0, 1]], [[0.64, 0], [0.64, 1]], [[0, 0.5], [0.64, 0.49]]]],
        I: [0.12, [[[0.06, 0], [0.06, 1]]]],
        J: [0.52, [[[0.5, 0], [0.5, 0.74], [0.4, 0.96], [0.2, 1], [0.02, 0.84]]]],
        K: [0.62, [[[0, 0], [0, 1]], [[0.58, 0], [0.02, 0.6]], [[0.2, 0.44], [0.64, 1]]]],
        L: [0.52, [[[0, 0], [0, 1], [0.54, 1]]]],
        M: [0.8, [[[0, 1], [0.04, 0], [0.4, 0.66], [0.76, 0], [0.8, 1]]]],
        N: [0.64, [[[0, 1], [0, 0], [0.64, 1], [0.64, 0]]]],
        O: [0.74, [O_RING]],
        P: [0.58, [[[0, 1], [0, 0], [0.4, 0], [0.58, 0.13], [0.58, 0.36], [0.4, 0.5], [0, 0.52]]]],
        Q: [0.76, [O_RING, [[0.44, 0.7], [0.78, 1.06]]]],
        R: [0.62, [[[0, 1], [0, 0], [0.4, 0], [0.58, 0.13], [0.58, 0.36], [0.4, 0.5], [0, 0.52]], [[0.24, 0.52], [0.64, 1]]]],
        S: [0.6, [[[0.6, 0.12], [0.42, 0], [0.15, 0.02], [0.03, 0.2], [0.12, 0.4], [0.35, 0.5], [0.55, 0.6], [0.62, 0.82], [0.45, 1], [0.15, 1], [0, 0.88]]]],
        T: [0.66, [[[0, 0], [0.68, 0]], [[0.34, 0], [0.33, 1]]]],
        U: [0.64, [[[0, 0], [0, 0.7], [0.12, 0.95], [0.32, 1], [0.52, 0.95], [0.64, 0.7], [0.64, 0]]]],
        V: [0.66, [[[0, 0], [0.33, 1], [0.66, 0]]]],
        W: [0.9, [[[0, 0], [0.2, 1], [0.44, 0.34], [0.68, 1], [0.9, 0]]]],
        X: [0.62, [[[0, 0], [0.62, 1]], [[0.62, 0], [0, 1]]]],
        Y: [0.64, [[[0, 0], [0.32, 0.5], [0.64, 0]], [[0.32, 0.5], [0.32, 1]]]],
        Z: [0.62, [[[0, 0], [0.62, 0], [0, 1], [0.64, 1]]]],
        0: [0.58, [[[0.3, 0], [0.08, 0.12], [0, 0.5], [0.07, 0.88], [0.3, 1], [0.52, 0.88], [0.6, 0.5], [0.52, 0.12], [0.3, 0], [0.2, 0.05]]]],
        1: [0.3, [[[0, 0.2], [0.24, 0], [0.24, 1]]]],
        2: [0.58, [[[0.03, 0.2], [0.2, 0.02], [0.42, 0.02], [0.56, 0.2], [0.5, 0.42], [0, 1], [0.6, 1]]]],
        3: [0.56, [[[0.04, 0.1], [0.25, 0], [0.48, 0.05], [0.55, 0.22], [0.45, 0.42], [0.22, 0.48], [0.5, 0.56], [0.6, 0.78], [0.45, 0.97], [0.2, 1], [0.02, 0.88]]]],
        4: [0.62, [[[0.46, 1], [0.46, 0], [0, 0.68], [0.64, 0.68]]]],
        5: [0.58, [[[0.56, 0], [0.08, 0], [0.04, 0.45], [0.3, 0.4], [0.52, 0.5], [0.6, 0.72], [0.5, 0.95], [0.25, 1], [0.02, 0.88]]]],
        6: [0.58, [[[0.52, 0.05], [0.3, 0], [0.1, 0.18], [0.02, 0.55], [0.1, 0.9], [0.3, 1], [0.5, 0.9], [0.58, 0.7], [0.45, 0.5], [0.25, 0.5], [0.05, 0.66]]]],
        7: [0.58, [[[0, 0], [0.6, 0], [0.2, 1]]]],
        8: [0.58, [[[0.3, 0.48], [0.08, 0.35], [0.08, 0.12], [0.3, 0], [0.5, 0.12], [0.5, 0.35], [0.3, 0.48], [0.05, 0.62], [0.05, 0.88], [0.3, 1], [0.56, 0.88], [0.56, 0.62], [0.32, 0.48]]]],
        9: [0.58, [[[0.55, 0.3], [0.4, 0.48], [0.18, 0.48], [0.03, 0.3], [0.12, 0.05], [0.32, 0], [0.52, 0.1], [0.56, 0.35], [0.52, 0.7], [0.35, 1], [0.08, 0.95]]]],
        ".": [0.14, [[[0.06, 0.95], [0.08, 1]]]],
        ",": [0.16, [[[0.1, 0.92], [0.02, 1.14]]]],
        "!": [0.14, [[[0.08, 0], [0.06, 0.7]], [[0.06, 0.95], [0.07, 1]]]],
        "?": [0.52, [[[0, 0.18], [0.15, 0.02], [0.38, 0], [0.52, 0.18], [0.44, 0.38], [0.24, 0.5], [0.23, 0.7]], [[0.23, 0.95], [0.24, 1]]]],
        ":": [0.14, [[[0.06, 0.3], [0.07, 0.35]], [[0.06, 0.95], [0.07, 1]]]],
        "'": [0.12, [[[0.07, 0], [0.04, 0.26]]]],
        '"': [0.26, [[[0.06, 0], [0.04, 0.26]], [[0.22, 0], [0.2, 0.26]]]],
        "-": [0.38, [[[0, 0.56], [0.38, 0.54]]]],
        "—": [0.7, [[[0, 0.56], [0.7, 0.53]]]],
        "–": [0.5, [[[0, 0.56], [0.5, 0.54]]]],
        "/": [0.44, [[[0.44, -0.02], [0, 1.02]]]],
        "+": [0.5, [[[0, 0.55], [0.5, 0.54]], [[0.25, 0.3], [0.25, 0.8]]]],
        "=": [0.5, [[[0, 0.42], [0.5, 0.41]], [[0, 0.68], [0.5, 0.67]]]],
        "(": [0.24, [[[0.24, -0.04], [0.04, 0.3], [0.03, 0.72], [0.24, 1.06]]]],
        ")": [0.24, [[[0, -0.04], [0.2, 0.3], [0.21, 0.72], [0, 1.06]]]],
        "&": [0.66, [[[0.66, 1], [0.14, 0.42], [0.1, 0.15], [0.28, 0], [0.46, 0.12], [0.42, 0.3], [0.02, 0.65], [0.06, 0.92], [0.26, 1], [0.46, 0.9], [0.64, 0.58]]]],
        "#": [0.62, [[[0.2, 0.05], [0.14, 0.95]], [[0.46, 0.05], [0.4, 0.95]], [[0, 0.35], [0.62, 0.34]], [[0, 0.65], [0.6, 0.64]]]],
        "%": [0.62, [[[0.6, 0], [0, 1]], [[0.1, 0.06], [0.02, 0.18], [0.12, 0.3], [0.2, 0.16], [0.1, 0.06]], [[0.5, 0.7], [0.42, 0.82], [0.52, 0.94], [0.6, 0.8], [0.5, 0.7]]]],
        "·": [0.14, [[[0.06, 0.52], [0.08, 0.56]]]],
        "→": [0.8, [[[0, 0.54], [0.8, 0.5]], [[0.5, 0.28], [0.8, 0.5], [0.52, 0.76]]]],
        "←": [0.8, [[[0.8, 0.54], [0, 0.5]], [[0.3, 0.28], [0, 0.5], [0.28, 0.76]]]],
        "↑": [0.5, [[[0.25, 1], [0.26, 0]], [[0.02, 0.28], [0.26, 0], [0.48, 0.3]]]],
        "↓": [0.5, [[[0.25, 0], [0.26, 1]], [[0.02, 0.72], [0.26, 1], [0.48, 0.7]]]],
        "×": [0.5, [[[0, 0.3], [0.5, 0.85]], [[0.5, 0.3], [0, 0.85]]]],
    };

    // Accents ride on the plain capital: the notes only ever need French names.
    const MARKS = {
        acute: [[0.3, -0.12], [0.5, -0.3]],
        grave: [[0.22, -0.3], [0.42, -0.12]],
        circ: [[0.12, -0.12], [0.3, -0.3], [0.48, -0.12]],
        cedilla: [[0.36, 1], [0.38, 1.12], [0.24, 1.2]],
        diaeresis: [[0.18, -0.2], [0.2, -0.16]],
    };
    const ACCENTED = {
        É: ["E", "acute"], È: ["E", "grave"], Ê: ["E", "circ"], Ë: ["E", "diaeresis"],
        À: ["A", "grave"], Â: ["A", "circ"], Ç: ["C", "cedilla"], Ô: ["O", "circ"],
        Î: ["I", "circ"], Ï: ["I", "diaeresis"], Ù: ["U", "grave"], Û: ["U", "circ"],
    };

    function glyphFor(ch) {
        const up = ch.toLocaleUpperCase("fr");
        if (GLYPHS[up]) return GLYPHS[up];
        const acc = ACCENTED[up];
        if (acc) {
            const [w, strokes] = GLYPHS[acc[0]];
            const mark = MARKS[acc[1]].map(([x, y]) => [x * (w / 0.6), y]);
            return [w, [...strokes, mark]];
        }
        const plain = up.normalize("NFD").replace(/[̀-ͯ]/g, "");
        return GLYPHS[plain] ?? null;
    }

    // -----------------------------------------------------------------------
    // Handwriting
    // -----------------------------------------------------------------------
    /**
     * Lay out and draw one line of capitals.
     * @param {string} text
     * @param {object} o
     *   x, y      baseline start
     *   size      cap height in px
     *   weight    stroke width in px (default size * 0.16)
     *   seed      same seed, same scrawl
     *   mess      0 calm .. 1 unhinged (default 0.5)
     *   tilt      whole-line angle in degrees (default: a little random)
     *   maxWidth  when the line runs out of room it curls upward and squeezes
     *   spacing   extra tracking, in cap heights
     *   color
     * @returns {{svg: string, width: number, end: [number, number]}}
     */
    // -----------------------------------------------------------------------
    // The handwriting spectrum. H1 (calm, mess 0.35) is 0% and H3 (unhinged,
    // mess 1.7) is 100%. App text lives between 30% and 70% of that, so a
    // line's score (0..1) maps into that band: 0 is the new calm, 1 the new
    // unhinged. Unless a line says otherwise, its score comes from how big
    // it is and how much it matters: small or important leans calm, big or
    // just-for-the-vibes leans wild.
    // -----------------------------------------------------------------------
    const H1_MESS = 0.35;
    const H3_MESS = 1.7;
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const messFor = (score) => H1_MESS + (H3_MESS - H1_MESS) * (0.3 + 0.4 * clamp01(score));
    const IMPORTANCE = { key: 0.2, info: 0.4, aside: 0.6, vibe: 0.85 };
    /** A line's score from its size (cap height, px) and importance. */
    function score(size, importance = "info") {
        const base = IMPORTANCE[importance] ?? IMPORTANCE.info;
        return clamp01(base + (size - 22) / 90);
    }

    function write(text, o = {}) {
        const r = rng(o.seed ?? text);
        const n = noise1(r);
        const size = o.size ?? 32;
        const mess = o.mess ?? messFor(o.score ?? score(size, o.importance));
        const weight = o.weight ?? size * 0.16;
        const color = o.color ?? RED;
        const spacing = (o.spacing ?? 0.2) * size;
        const tilt = ((o.tilt ?? r.range(-2.5, 1.5)) * Math.PI) / 180;

        // 1. Natural layout along a straight baseline, in local units.
        const items = [];
        let cursor = 0;
        for (const ch of text) {
            if (ch === " ") {
                cursor += size * r.range(0.36, 0.5);
                continue;
            }
            const g = glyphFor(ch);
            if (!g) continue;
            const scale = size * (1 + (r() - 0.5) * 0.22 * mess);
            const [w, strokes] = g;
            items.push({ x: cursor, scale, w, strokes, ch });
            const gap = r.range(0.6, 1.4);
            cursor += w * scale + spacing * (o.even ? 1 : gap);
        }
        const natural = Math.max(0, cursor - spacing);

        // 2. The baseline. Straight, drifting a little; if it overflows
        //    maxWidth, the last stretch bends upward (a writer running out
        //    of room) just enough that the end lands on the edge.
        const maxWidth = o.maxWidth ?? Infinity;
        const MAX_BEND = (38 * Math.PI) / 180;
        let bend = 0; // heading reached at the very end of the line, radians
        let squeeze = 1;
        const bendFrom = 0.6; // fraction of the line that stays straight
        // Heading at fraction u of the line: flat, then turning upward ever faster.
        const heading = (u) => (u <= bendFrom ? 0 : -bend * ((u - bendFrom) / (1 - bendFrom)) ** 1.6);
        const extent = (L) => {
            let x = 0;
            const steps = 60;
            for (let i = 0; i < steps; i++) x += Math.cos(heading((i + 0.5) / steps)) * (L / steps);
            return x;
        };
        if (natural > maxWidth) {
            // Cram a little, curl upward, and cram harder only if that's not enough.
            squeeze = Math.max(0.88, maxWidth / natural);
            let lo = 0;
            let hi = MAX_BEND;
            bend = hi;
            while (extent(natural * squeeze) > maxWidth && squeeze > 0.6) squeeze -= 0.02;
            for (let i = 0; i < 30; i++) {
                bend = (lo + hi) / 2;
                if (extent(natural * squeeze) > maxWidth) lo = bend;
                else hi = bend;
            }
            bend = hi;
        }
        const L = natural * squeeze;
        // Position and heading on the baseline at arc length s.
        const baseline = (s) => {
            if (!bend || s <= L * bendFrom) return { x: s, y: 0, a: 0 };
            let x = 0;
            let y = 0;
            const steps = 40;
            const ds = s / steps;
            for (let i = 0; i < steps; i++) {
                const a = heading((ds * (i + 0.5)) / L);
                x += Math.cos(a) * ds;
                y += Math.sin(a) * ds;
            }
            return { x, y, a: heading(s / L) };
        };

        // 3. Draw each glyph: jitter its skeleton, place it on the baseline.
        const paths = [];
        const jitter = 0.035 + 0.06 * mess;
        let end = [0, 0];
        for (const it of items) {
            const s = it.x * squeeze;
            const b = baseline(s);
            const drift = n(s / (size * 2.2)) * size * 0.1 * mess;
            const lean = ((n(s / size + 40) * 5 * mess + (o.slant ?? 0)) * Math.PI) / 180;
            const angle = b.a + lean;
            const sx = it.scale * (0.94 + r() * 0.1) * (squeeze < 1 ? squeeze : 1);
            const sy = it.scale;
            for (const stroke of it.strokes) {
                const pts = stroke.map(([px, py]) => {
                    const jx = (r() - 0.5) * jitter * 2;
                    const jy = (r() - 0.5) * jitter * 2;
                    // Italic-ish shear so the letters lean together.
                    const lx = (px + jx) * sx + (1 - py) * sy * 0.06 * mess;
                    const ly = (py - 1 + jy) * sy + drift;
                    const [qx, qy] = rot([lx, ly], angle);
                    return [b.x + qx, b.y + qy];
                });
                const smooth = pts.length > 2 ? spline(pts, 7) : densify(pts, 10);
                const placed = smooth.map((p) => {
                    const [x, y] = rot(p, tilt);
                    return [(o.x ?? 0) + x, (o.y ?? 0) + y];
                });
                paths.push(pathEl(placed, { size: weight * (0.9 + r() * 0.22), color, thinning: 0.18 + 0.12 * mess, taperEnd: r() * 4 }));
            }
            const tail = rot([b.x + it.w * sx, b.y], tilt);
            end = [(o.x ?? 0) + tail[0], (o.y ?? 0) + tail[1]];
        }
        return { svg: paths.join(""), width: Math.min(natural * squeeze, maxWidth), end };
    }

    /** Several lines, each its own angle; wraps on words at maxWidth. */
    function note(text, o = {}) {
        const r = rng((o.seed ?? text) + ":note");
        const size = o.size ?? 22;
        o = { ...o, mess: o.mess ?? messFor(o.score ?? score(size, o.importance)) };
        const lineH = size * (o.leading ?? 1.55);
        const maxWidth = o.maxWidth ?? 240;
        const words = String(text).split(/\s+/);
        // Rough measure, so wrapping works before anything is drawn.
        const measure = (s) => [...s].reduce((w, ch) => w + (ch === " " ? 0.43 : (glyphFor(ch)?.[0] ?? 0.5) + 0.16), 0) * size;
        const lines = [];
        let line = "";
        for (const w of words) {
            const next = line ? `${line} ${w}` : w;
            // Allow a little overflow on the last word: that's where the curl lives.
            if (line && measure(next) > maxWidth * 1.12) {
                lines.push(line);
                line = w;
            } else line = next;
        }
        if (line) lines.push(line);
        let svg = "";
        lines.forEach((l, i) => {
            const res = write(l, {
                ...o,
                size,
                x: (o.x ?? 0) + r.range(-1, 1) * size * 0.15 * (o.mess ?? 0.5),
                y: (o.y ?? 0) + i * lineH,
                seed: `${o.seed ?? text}:${i}`,
                tilt: (o.tilt ?? 0) + r.range(-2, 2) * (o.mess ?? 0.5),
                maxWidth,
            });
            svg += res.svg;
        });
        return { svg, height: lines.length * lineH, lines: lines.length };
    }

    // -----------------------------------------------------------------------
    // Marks
    // -----------------------------------------------------------------------
    const stroke = (pts, o, extra = {}) =>
        pathEl(spline(pts, 8), { size: o.weight ?? 6, color: o.color ?? RED, thinning: o.thinning ?? 0.22, ...extra });

    /** Zigzag crossing-out, the SEEK scribble: up, down, up, slanted. */
    function scribbleOut(x, y, w, h, o = {}) {
        // Everything crossed out now uses the pressure scribble (the first
        // zigzag was too even); the old one stays as scribbleOutFlat.
        return pencilScribble(x, y, w, h, { ...o, weight: (o.weight ?? h * 0.16) * 1.3 });
    }

    function scribbleOutFlat(x, y, w, h, o = {}) {
        const r = rng(o.seed ?? "scribble");
        const passes = o.passes ?? 3;
        const over = h * (o.overshoot ?? 0.16);
        const pts = [[x - w * 0.06, y + h * r.range(0.45, 0.7)]];
        for (let i = 0; i < passes; i++) {
            const t = (i + 0.5) / passes;
            const tt = (i + 1) / passes;
            pts.push([x + w * t + r.range(-0.04, 0.04) * w, y - over * r.range(0.5, 1.2)]);
            pts.push([x + w * (tt - 0.55 / passes) + r.range(-0.03, 0.03) * w, y + h + over * r.range(0.4, 1)]);
        }
        pts.push([x + w * 1.05, y + h * r.range(-0.05, 0.3)]);
        // Sharp turns: no spline smoothing across the zigzag, just a little.
        const dense = [];
        for (let i = 0; i < pts.length - 1; i++) {
            const seg = spline([pts[i], [(pts[i][0] + pts[i + 1][0]) / 2 + r.range(-2, 2), (pts[i][1] + pts[i + 1][1]) / 2 + r.range(-2, 2)], pts[i + 1]], 6);
            dense.push(...(i ? seg.slice(1) : seg));
        }
        return pathEl(dense, { size: o.weight ?? h * 0.16, color: o.color ?? RED, thinning: 0.15, smoothing: 0.5, streamline: 0.25 });
    }

    /**
     * A stroke with real pen pressure, the way an Apple Pencil draws: the
     * line swells where the hand presses and thins where it lets up.
     * `pressure(u)` gives 0..1 along the stroke (u = 0..1 by length).
     */
    function pressed(points, pressure, o = {}) {
        const pts = humanize(points, o);
        let total = 0;
        const acc = pts.map((p, i) => (i ? (total += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1])) : 0));
        const withP = pts.map((p, i) => [p[0], p[1], Math.max(0.05, Math.min(1, pressure(total ? acc[i] / total : 0)))]);
        const d = outlinePath(withP, { size: o.size ?? 10, thinning: o.thinning ?? 0.72, smoothing: 0.55, streamline: 0.28, simulatePressure: false, taperStart: o.taperStart ?? 6, taperEnd: o.taperEnd ?? 18 });
        return d ? `<path d="${d}" fill="${o.color ?? RED}"/>` : "";
    }

    /**
     * The SEEK scribble, by hand: a zigzag whose legs bow and wander, whose
     * turns are round (not sharp), each leg a different height, and whose
     * width follows the pressure: heavy through the middle of a stroke,
     * light at the turns, lighter again as the hand gets bored at the end.
     */
    function pencilScribble(x, y, w, h, o = {}) {
        const r = rng(o.seed ?? "pencil");
        const n = noise1(r);
        const legs = (o.passes ?? 3) * 2 + 1;
        const over = h * (o.overshoot ?? 0.14);
        const verts = [[x - w * r.range(0.03, 0.08), y + h * r.range(0.5, 0.75)]];
        for (let i = 1; i < legs; i++) {
            const t = i / legs;
            const up = i % 2 === 1;
            const reach = r.range(0.3, 1.3);
            // Slanted like handwriting: the tops land further right than the bottoms.
            const slant = up ? w * r.range(0.03, 0.08) : -w * r.range(0, 0.04);
            verts.push([x + w * (t + r.range(-0.06, 0.06)) + slant, up ? y - over * reach * 0.6 + h * r.range(0, 0.2) : y + h + over * reach - h * r.range(0, 0.18)]);
        }
        verts.push([x + w * r.range(1.02, 1.1), y + h * r.range(0.05, 0.45)]);
        // Each leg bows sideways a little, and the turns get a rounded shoulder.
        const ctrl = [verts[0]];
        for (let i = 1; i < verts.length; i++) {
            const [ax, ay] = verts[i - 1];
            const [bx, by] = verts[i];
            const len = Math.hypot(bx - ax, by - ay) || 1;
            const nx = -(by - ay) / len;
            const ny = (bx - ax) / len;
            const bow = r.range(-0.09, 0.09) * len;
            ctrl.push([ax + (bx - ax) * 0.35 + nx * bow * 0.8, ay + (by - ay) * 0.35 + ny * bow * 0.8]);
            ctrl.push([ax + (bx - ax) * 0.68 + nx * bow, ay + (by - ay) * 0.68 + ny * bow]);
            // Close to the turn the hand is nearly straight again, so turns stay tight.
            ctrl.push([ax + (bx - ax) * 0.94 + nx * bow * 0.2, ay + (by - ay) * 0.94 + ny * bow * 0.2]);
            ctrl.push([bx, by]);
        }
        const path = spline(ctrl, 10);
        const pressure = (u) => {
            const leg = u * (verts.length - 1);
            const f = leg - Math.floor(leg);
            const mid = Math.sin(Math.PI * f) ** 0.8;
            const fatigue = 1 - 0.3 * u;
            return (0.28 + 0.72 * mid) * fatigue * (0.8 + 0.25 * n(u * 7 + 3));
        };
        return pressed(path, pressure, { size: o.weight ?? h * 0.2, color: o.color, thinning: o.thinning ?? 0.7, wobbleAmp: o.wobbleAmp ?? 1.6, taperEnd: 24 });
    }

    /**
     * The SEEK scribble, second pass. The turns are evenly spaced across the
     * word (no gap in the middle), every leg leans the same way, and each
     * turn has its own roundness: mostly a round hairpin like a real hand
     * scribble, now and then a sharp one. Tops and bottoms reach past the
     * letters by uneven amounts, and a few fly well out. The pressure swells
     * in every leg and eases at every turn, the same at the end as at the
     * start.
     */
    function roundScribble(x, y, w, h, o = {}) {
        const r = rng(o.seed ?? "round");
        const n = noise1(r);
        const legs = (o.passes ?? 4) * 2;
        // How far past the letters it reaches, above and below.
        const overTop = h * (o.overTop ?? 0.05);
        const overBottom = h * (o.overBottom ?? 0.3);
        const slant = w * (o.slant ?? 0.035);
        const [rLo, rHi] = o.round ?? [0.35, 0.85];
        const x0 = x;
        const x1 = x + w * 1.03;
        const pts = [[x0, y + h * r.range(0.55, 0.75)]];
        for (let i = 0; i < legs; i++) {
            const up = i % 2 === 0;
            const t = (i + 0.5) / legs;
            let reach = r.range(0.45, 1.15);
            if (r() < (o.fly ?? 0.3)) reach += r.range(0.7, 1.4);
            pts.push([x0 + (x1 - x0) * t + r.range(-0.015, 0.015) * w + (up ? slant : -slant), up ? y - overTop * reach : y + h + overBottom * reach]);
        }
        pts.push([x1 + slant, y + h * r.range(0.25, 0.45)]);
        // Round each turn: the pen slows down, swings round, heads back.
        const ctrl = [pts[0]];
        const turnAt = [];
        for (let i = 1; i < pts.length; i++) {
            const [ax, ay] = pts[i - 1];
            const [bx, by] = pts[i];
            const len = Math.hypot(bx - ax, by - ay) || 1;
            const bow = r.range(-0.05, 0.05) * len;
            ctrl.push([(ax + bx) / 2 - ((by - ay) / len) * bow, (ay + by) / 2 + ((bx - ax) / len) * bow]);
            if (i === pts.length - 1) {
                ctrl.push([bx, by]);
                break;
            }
            const [cx, cy] = pts[i + 1];
            const k = r.range(rLo, rHi);
            const d = k * Math.min(len, Math.hypot(cx - bx, cy - by)) * (o.turn ?? 0.13);
            const ua = [(ax - bx) / len, (ay - by) / len];
            const lb = Math.hypot(cx - bx, cy - by) || 1;
            const ub = [(cx - bx) / lb, (cy - by) / lb];
            const mid = [bx + ((ua[0] + ub[0]) / 2) * d, by + ((ua[1] + ub[1]) / 2) * d];
            ctrl.push([bx + ua[0] * d, by + ua[1] * d]);
            turnAt.push(ctrl.length);
            ctrl.push([bx + (mid[0] - bx) * (1 - k) * 0.7, by + (mid[1] - by) * (1 - k) * 0.7]);
            ctrl.push([bx + ub[0] * d, by + ub[1] * d]);
        }
        const STEPS = 10;
        const path = spline(ctrl, STEPS);
        let total = 0;
        const acc = path.map((p, i) => (i ? (total += Math.hypot(p[0] - path[i - 1][0], p[1] - path[i - 1][1])) : 0));
        const marks = [0, ...turnAt.map((c) => acc[Math.min(acc.length - 1, c * STEPS)] / total), 1];
        const legP = marks.map(() => r.range(0.86, 1.08));
        const pressure = (u) => {
            let i = 0;
            while (i < marks.length - 2 && u > marks[i + 1]) i++;
            const f = (u - marks[i]) / (marks[i + 1] - marks[i] || 1);
            return (0.3 + 0.7 * Math.sin(Math.PI * Math.max(0, Math.min(1, f))) ** 0.7) * legP[i] * (0.92 + 0.1 * n(u * 9 + 2));
        };
        return pressed(path, pressure, { size: o.weight ?? h * 0.2, color: o.color, thinning: o.thinning ?? 0.62, wobbleAmp: o.wobbleAmp ?? 1.4, taperStart: o.taper ?? 16, taperEnd: o.taper ?? 16 });
    }

    /**
     * Crossing a word out rather than scribbling it: a few fast, nearly
     * flat pressure strokes. `style`: "one" (one heavy line), "two" (two
     * lines), "back" (right, back left, right again, like crossing out in
     * a hurry), "x" (one cross over the whole word).
     */
    function crossOut(x, y, w, h, o = {}) {
        const r = rng(o.seed ?? "cross");
        const weight = o.weight ?? h * 0.2;
        const line = (x1, y1, x2, y2, taperS = 10, taperE = 22) => {
            const pts = [];
            const sag = r.range(-0.05, 0.05) * h;
            for (let i = 0; i <= 12; i++) {
                const t = i / 12;
                pts.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + Math.sin(Math.PI * t) * sag]);
            }
            const lean = r.range(0.85, 1.05);
            return pressed(spline(pts, 4), (u) => (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, u * 1.15)) ** 0.5) * lean, { size: weight, color: o.color, thinning: 0.55, wobbleAmp: 1.2, taperStart: taperS, taperEnd: taperE });
        };
        const L = x - w * 0.02;
        const R = x + w * 1.04;
        const mid = y + h * 0.52;
        const rise = -h * (o.rise ?? 0.1);
        switch (o.style ?? "one") {
            case "two":
                return line(L, mid - h * 0.14 - rise / 2, R, mid - h * 0.14 + rise / 2) + line(L + w * 0.03, mid + h * 0.2 - rise / 2 + r.range(-2, 2), R - w * 0.02, mid + h * 0.2 + rise / 2);
            case "back": {
                // One continuous stroke: across, back, across again.
                const pts = [
                    [L, mid - h * 0.1 - rise / 2],
                    [R, mid - h * 0.16 + rise / 2],
                    [R - w * 0.02, mid + h * 0.02],
                    [L + w * 0.05, mid + h * 0.12 - rise / 2],
                    [L + w * 0.04, mid + h * 0.24],
                    [R + w * 0.02, mid + h * 0.18 + rise / 2],
                ];
                return pressed(spline(pts, 14), (u) => 0.6 + 0.4 * Math.abs(Math.sin(Math.PI * u * 3)) ** 0.5, { size: weight * 0.85, color: o.color, thinning: 0.55, wobbleAmp: 1.4, taperStart: 10, taperEnd: 22 });
            }
            case "x":
                return line(L + w * 0.04, y - h * 0.18, R - w * 0.04, y + h * 1.15) + line(L + w * 0.02, y + h * 1.12, R - w * 0.02, y - h * 0.12);
            default:
                return line(L, mid - rise / 2, R, mid + rise / 2);
        }
    }

    /**
     * Handwriting with the letters tucked into each other ("emboîtées"):
     * every letter its own size and height on the line, each one slid as
     * close to the ones before as it can go without touching them.
     * Draws at the origin (baseline y = 0) and returns its bounding box, so
     * a lockup can measure it and then move it into place.
     */
    function tuck(text, o = {}) {
        const r = rng(o.seed ?? text);
        const n = noise1(r);
        const size = o.size ?? 60;
        const weight = o.weight ?? size * 0.17;
        const gap = o.gap ?? weight * 0.22;
        const mess = o.mess ?? 0.5;
        const sizes = o.sizes ?? [];
        const rises = o.rises ?? [];
        const glyphs = [];
        [...text].forEach((ch, i) => {
            const g = glyphFor(ch);
            if (!g) return;
            const [gw, strokes] = g;
            const k = sizes[i] ?? 1 + r.range(-1, 1) * (o.sizeVar ?? 0.22);
            const sy = size * k;
            const sx = sy * r.range(0.9, 1.06);
            const rise = (rises[i] ?? r.range(-1, 1) * (o.riseVar ?? 0.08)) * size;
            const lean = ((n(i * 1.7 + 5) * 7 * mess + r.range(-1, 1) * (o.spin ?? 0) + (o.slant ?? 0)) * Math.PI) / 180;
            const jitter = 0.035 + 0.05 * mess;
            const local = strokes.map((st) => {
                const pts = st.map(([px, py]) => {
                    const lx = (px + r.range(-jitter, jitter)) * sx + (1 - py) * sy * 0.06 * mess;
                    const ly = (py - 1 + r.range(-jitter, jitter)) * sy - rise;
                    return rot([lx, ly], lean);
                });
                // A fast hand overshoots where a stroke starts and ends.
                if (o.overshoot) {
                    const ext = (a, b) => {
                        const l = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
                        const e = r.range(0, o.overshoot) * size;
                        return [a[0] + ((a[0] - b[0]) / l) * e, a[1] + ((a[1] - b[1]) / l) * e];
                    };
                    pts[0] = ext(pts[0], pts[1]);
                    pts[pts.length - 1] = ext(pts[pts.length - 1], pts[pts.length - 2]);
                }
                return densify(pts.length > 2 ? spline(pts, 8) : pts, 3);
            });
            glyphs.push({ local, w: gw * sx, weight: weight * r.range(0.9, 1.12) });
        });
        // Slide each letter left until it would touch something already down.
        const placed = [];
        const clear = (pts, dx, need) => {
            for (const q of placed) for (const [px, py] of pts) if (Math.hypot(px + dx - q[0], py - q[1]) < need) return false;
            return true;
        };
        const out = [];
        let cursor = 0;
        let prevLeft = -Infinity;
        for (const g of glyphs) {
            const pts = g.local.flat();
            const minX = Math.min(...pts.map((p) => p[0]));
            const need = g.weight / 2 + weight / 2 + gap;
            let dx = cursor + weight * 2 - minX;
            if (placed.length) while (dx > prevLeft - minX + weight * 0.4 && clear(pts, dx - 1, need)) dx -= 1;
            else dx = -minX;
            prevLeft = minX + dx;
            for (const p of pts) placed.push([p[0] + dx, p[1]]);
            cursor = Math.max(cursor, Math.max(...pts.map((p) => p[0])) + dx);
            out.push({ strokes: g.local.map((st) => st.map(([px, py]) => [px + dx, py])), weight: g.weight });
        }
        const tilt = ((o.tilt ?? -2) * Math.PI) / 180;
        let svg = "";
        const all = [];
        for (const g of out) {
            for (const st of g.strokes) {
                const pts = st.map((p) => rot(p, tilt));
                all.push(...pts);
                svg += pathEl(pts, { size: g.weight, color: o.color ?? RED, thinning: 0.2 + 0.12 * mess, taperEnd: r() * 4, wobbleAmp: 0.6 });
            }
        }
        const pad = weight / 2;
        const xs = all.map((p) => p[0]);
        const ys = all.map((p) => p[1]);
        return { svg, box: { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 } };
    }

    /** Dense back-and-forth scribble that blacks a word out completely. */
    function blackout(x, y, w, h, o = {}) {
        const r = rng(o.seed ?? "blackout");
        // Tight loops dragged left to right, then a second messier pass back.
        const loops = o.loops ?? Math.max(6, Math.round(w / (h * 0.16)));
        const pass = (dir, amp) => {
            const pts = [];
            for (let i = 0; i <= loops * 6; i++) {
                const t = i / (loops * 6);
                const a = t * loops * Math.PI * 2;
                const px = x + (dir > 0 ? t : 1 - t) * w + Math.cos(a) * h * 0.22 * amp;
                const py = y + h / 2 + Math.sin(a) * h * 0.62 * amp + r.range(-2, 2);
                pts.push([px, py]);
            }
            return pts;
        };
        const weight = o.weight ?? h * 0.22;
        return (
            pathEl(pass(1, 1), { size: weight, color: o.color ?? RED, thinning: 0.1, smoothing: 0.4, streamline: 0.2 }) +
            pathEl(pass(-1, 0.85).map(([px, py]) => [px, py + r.range(-3, 3)]), { size: weight * 0.8, color: o.color ?? RED, thinning: 0.1, smoothing: 0.4, streamline: 0.2 })
        );
    }

    /** One or two nearly-flat strokes through a word. */
    function strike(x, y, w, h, o = {}) {
        const r = rng(o.seed ?? "strike");
        const out = [];
        for (let i = 0; i < (o.lines ?? 1); i++) {
            const yy = y + h * (0.5 + (i - ((o.lines ?? 1) - 1) / 2) * 0.24) + r.range(-2, 2);
            const lean = r.range(-0.08, 0.04) * h;
            out.push(stroke([[x - w * 0.06, yy - lean], [x + w * 0.5, yy + r.range(-2, 2)], [x + w * 1.06, yy + lean]], { weight: o.weight ?? h * 0.12, color: o.color }, { taperEnd: 6 }));
        }
        return out.join("");
    }

    /** A loop around something, never quite closed, a bit more than one turn. */
    function circle(cx, cy, rx, ry, o = {}) {
        const r = rng(o.seed ?? "circle");
        const n = noise1(r);
        const turns = o.turns ?? r.range(1.08, 1.25);
        const start = r.range(-Math.PI * 0.9, -Math.PI * 0.4);
        const steps = 64;
        const pts = [];
        for (let i = 0; i <= steps * turns; i++) {
            const t = i / steps;
            const a = start + t * Math.PI * 2 * (o.dir ?? 1);
            const k = 1 + n(t * 3) * 0.07 + t * 0.06;
            pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k * (1 + (o.squash ?? 0))]);
        }
        const tilt = ((o.tilt ?? r.range(-8, 8)) * Math.PI) / 180;
        return pathEl(pts.map((p) => rot(p, tilt, [cx, cy])), { size: o.weight ?? 5, color: o.color ?? RED, thinning: 0.3, taperEnd: 12, taperStart: 3 });
    }

    function underline(x, y, w, o = {}) {
        const r = rng(o.seed ?? "underline");
        const out = [];
        for (let i = 0; i < (o.lines ?? 1); i++) {
            const yy = y + i * (o.gap ?? 7);
            out.push(stroke([[x + r.range(-4, 2), yy + r.range(-1, 2)], [x + w * 0.5, yy + r.range(-2, 1)], [x + w + r.range(-2, 8), yy + r.range(-5, 1)]], o, { taperEnd: 10 }));
        }
        return out.join("");
    }

    /** A curved arrow with a two-stroke head. */
    function arrow(x1, y1, x2, y2, o = {}) {
        const r = rng(o.seed ?? "arrow");
        const bend = o.bend ?? r.range(-0.25, 0.25);
        const mx = (x1 + x2) / 2 - (y2 - y1) * bend;
        const my = (y1 + y2) / 2 + (x2 - x1) * bend;
        const shaft = [];
        for (let i = 0; i <= 20; i++) {
            const t = i / 20;
            shaft.push([(1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2, (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * my + t * t * y2]);
        }
        const ang = Math.atan2(y2 - my, x2 - mx);
        const head = o.head ?? 16;
        const wing = (side) => {
            const a = ang + Math.PI + side * r.range(0.42, 0.62);
            return [[x2 + Math.cos(a) * head * r.range(0.9, 1.2), y2 + Math.sin(a) * head * r.range(0.9, 1.2)], [x2 + r.range(-1, 1), y2 + r.range(-1, 1)]];
        };
        const w = o.weight ?? 4.5;
        return (
            pathEl(shaft, { size: w, color: o.color ?? RED, thinning: 0.25, taperStart: 4 }) +
            pathEl(densify(wing(1), 6), { size: w, color: o.color ?? RED }) +
            pathEl(densify(wing(-1), 6), { size: w, color: o.color ?? RED })
        );
    }

    function cross(cx, cy, s, o = {}) {
        const r = rng(o.seed ?? "cross");
        const a = [[cx - s + r.range(-3, 3), cy - s + r.range(-3, 3)], [cx + s + r.range(-3, 3), cy + s * r.range(0.8, 1.1)]];
        const b = [[cx + s * r.range(0.8, 1.1), cy - s + r.range(-3, 3)], [cx - s * r.range(0.9, 1.2), cy + s + r.range(-3, 3)]];
        return stroke(a, { weight: o.weight ?? s * 0.3, color: o.color }, { taperEnd: 5 }) + stroke(b, { weight: o.weight ?? s * 0.3, color: o.color }, { taperEnd: 5 });
    }

    function check(x, y, s, o = {}) {
        const r = rng(o.seed ?? "check");
        return stroke([[x, y + s * 0.5], [x + s * 0.35, y + s * r.range(0.85, 1)], [x + s * 1.1, y - s * r.range(0.1, 0.3)]], { weight: o.weight ?? s * 0.2, color: o.color }, { taperEnd: 8 });
    }

    /** Proofreader's caret: insert here. */
    function caret(x, y, s, o = {}) {
        return stroke([[x - s * 0.5, y + s * 0.4], [x, y - s * 0.4], [x + s * 0.52, y + s * 0.38]], { weight: o.weight ?? s * 0.18, color: o.color, seed: o.seed });
    }

    /**
     * Coloured in like a child would: one back-and-forth zigzag across the
     * shape, overshooting the edge in places, falling short in others, with
     * the odd gap. Clip-free on purpose; the overshoot IS the look.
     */
    function scribbleFill(x, y, w, h, o = {}) {
        const r = rng(o.seed ?? "fill");
        const gap = o.gap ?? Math.max(5, (o.weight ?? 9) * 1.2);
        const angle = ((o.angle ?? r.range(-24, -14)) * Math.PI) / 180;
        const over = o.overshoot ?? 5;
        const cx = x + w / 2;
        const cy = y + h / 2;
        // Work in a rotated frame big enough to cover the box.
        const diag = Math.hypot(w, h);
        const rows = Math.ceil(diag / gap);
        const inside = ([px, py]) => {
            const [qx, qy] = rot([px, py], -angle, [0, 0]);
            return [cx + qx, cy + qy];
        };
        const segs = [];
        let current = [];
        for (let i = 0; i <= rows; i++) {
            const v = -diag / 2 + i * gap + r.range(-gap * 0.2, gap * 0.2);
            // Where this row crosses the box, in the rotated frame.
            const hits = [];
            for (let s = -diag; s <= diag; s += 1.5) {
                const [px, py] = inside([s, v]);
                if (px >= x && px <= x + w && py >= y && py <= y + h) hits.push(s);
            }
            if (!hits.length) continue;
            let a = hits[0] - r.range(-over * 0.6, over);
            let b = hits[hits.length - 1] + r.range(-over * 0.6, over);
            if (r() < (o.misses ?? 0.05)) {
                // A gap: lift the pen, skip a row.
                if (current.length) segs.push(current);
                current = [];
                continue;
            }
            const row = i % 2 ? [[b, v], [a, v]] : [[a, v], [b, v]];
            current.push(...row.map(inside));
        }
        if (current.length) segs.push(current);
        return segs
            .map((seg) => pathEl(densify(seg, 3), { size: o.weight ?? 9, color: o.color ?? RED, thinning: 0.12, smoothing: 0.3, streamline: 0.2 }))
            .join("");
    }

    /** Even-odd point-in-polygon over several rings. */
    function insideRings(rings, x, y) {
        let inside = false;
        for (const ring of rings) {
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                const [xi, yi] = ring[i];
                const [xj, yj] = ring[j];
                if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
            }
        }
        return inside;
    }

    /**
     * A shape coloured in the way a four-year-old does when asked to fill it
     * all with red: thick back-and-forth strokes that overlap, so it reads as
     * a colour, not as lines; each stroke stops a little short of the edge or
     * runs a little over it; one lazier pass at another angle; a few specks
     * of paper left showing. About 95% filled.
     * rings: [[x, y], ...][] in screen coordinates (even-odd).
     */
    function colorIn(rings, o = {}) {
        const r = rng(o.seed ?? "colorIn");
        const weight = o.weight ?? 11;
        const pts = rings.flat();
        const minX = Math.min(...pts.map((p) => p[0]));
        const maxX = Math.max(...pts.map((p) => p[0]));
        const minY = Math.min(...pts.map((p) => p[1]));
        const maxY = Math.max(...pts.map((p) => p[1]));
        const cx = (minX + maxX) / 2;
        const cy = (minY + maxY) / 2;
        const diag = Math.hypot(maxX - minX, maxY - minY) / 2 + weight;
        const pass = (angleDeg, gap, keep, w, over) => {
            const a = (angleDeg * Math.PI) / 180;
            const toXY = (u, v) => [cx + u * Math.cos(a) - v * Math.sin(a), cy + u * Math.sin(a) + v * Math.cos(a)];
            const chains = [];
            let open = [];
            for (let v = -diag; v <= diag; v += gap * r.range(0.85, 1.15)) {
                const runs = [];
                let start = null;
                for (let u = -diag; u <= diag; u += 1.5) {
                    const [x, y] = toXY(u, v);
                    const inn = insideRings(rings, x, y);
                    if (inn && start === null) start = u;
                    if (!inn && start !== null) {
                        runs.push([start, u]);
                        start = null;
                    }
                }
                if (start !== null) runs.push([start, diag]);
                // A miss is a short skip inside a stroke (the crayon lifted for
                // a moment), never a whole row: a missed row would leave a
                // ruler-straight white line.
                const split = [];
                for (const [ua, ub] of runs) {
                    if (ub - ua > 60 && r() > keep) {
                        const at = ua + (ub - ua) * r.range(0.2, 0.8);
                        const gapLen = r.range(4, 12);
                        split.push([ua, at - gapLen / 2], [at + gapLen / 2, ub]);
                    } else split.push([ua, ub]);
                }
                runs.length = 0;
                runs.push(...split);
                const next = [];
                for (const [ua, ub] of runs) {
                    if (ub - ua < 3) continue;
                    // Stops short of the line, or runs over it.
                    const a2 = ua - r.range(-over * 0.5, over);
                    const b2 = ub + r.range(-over * 0.5, over);
                    const chain = open.find((c) => !c.used && c.last[1] > ua - gap && c.last[0] < ub + gap);
                    if (chain) {
                        chain.used = true;
                        chain.dir *= -1;
                        chain.pts.push(...(chain.dir > 0 ? [[a2, v], [b2, v]] : [[b2, v], [a2, v]]).map(([u, vv]) => toXY(u, vv)));
                        chain.last = [ua, ub];
                        next.push(chain);
                    } else {
                        const c = { pts: [[a2, v], [b2, v]].map(([u, vv]) => toXY(u, vv)), dir: 1, last: [ua, ub] };
                        chains.push(c);
                        next.push(c);
                    }
                }
                for (const c of next) c.used = false;
                open = next;
            }
            return chains
                .filter((c) => c.pts.length >= 2)
                .map((c) => pathEl(densify(c.pts, 4), { size: w * r.range(0.9, 1.1), color: o.color ?? RED, thinning: 0.1, smoothing: 0.35, streamline: 0.2, wobbleAmp: 1.4 }))
                .join("");
        };
        const angle = o.angle ?? r.range(-38, -22);
        return pass(angle, weight * 0.68, 1 - (o.misses ?? 0.004), weight, o.overshoot ?? 5) + pass(angle + r.range(55, 75), weight * 1.6, 0.97, weight * 0.8, (o.overshoot ?? 5) * 0.6);
    }

    /**
     * An arrow as a hand draws it: one curved, pressured shaft that doesn't
     * quite aim, and a head in a single flick (down one side, back up the
     * other), the two sides never the same length.
     */
    function handArrow(x1, y1, x2, y2, o = {}) {
        const r = rng(o.seed ?? "handArrow");
        const len = Math.hypot(x2 - x1, y2 - y1);
        const bend = o.bend ?? r.range(-0.22, 0.22);
        const mx = (x1 + x2) / 2 - (y2 - y1) * bend + r.range(-4, 4);
        const my = (y1 + y2) / 2 + (x2 - x1) * bend + r.range(-4, 4);
        const shaft = [];
        for (let i = 0; i <= 24; i++) {
            const t = i / 24;
            shaft.push([(1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2, (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * my + t * t * y2]);
        }
        const w = o.weight ?? 4.5;
        const ang = Math.atan2(y2 - my, x2 - mx);
        const head = o.head ?? Math.min(22, 8 + len * 0.1);
        const side = (sgn, k) => {
            const a = ang + Math.PI + sgn * r.range(0.38, 0.6);
            return [x2 + Math.cos(a) * head * k, y2 + Math.sin(a) * head * k];
        };
        const flick = [side(1, r.range(0.8, 1.15)), [x2 + r.range(-1.5, 1.5), y2 + r.range(-1.5, 1.5)], side(-1, r.range(0.6, 1.3))];
        return (
            pressed(shaft, (u) => 0.45 + 0.5 * Math.sin(Math.PI * Math.min(1, u * 1.2)), { size: w * 1.5, color: o.color, thinning: 0.55, taperStart: 8, taperEnd: 2, wobbleAmp: o.wobbleAmp ?? 1.8 }) +
            pressed(spline(flick, 6), (u) => 0.4 + 0.6 * Math.sin(Math.PI * u), { size: w * 1.4, color: o.color, thinning: 0.55, taperStart: 3, taperEnd: 8 })
        );
    }

    /**
     * The attention arrow: a long pressured shaft, and a head in one flick
     * that thins at the turn, so the point is sharp; the head is big (about
     * a quarter of the shaft) and its sides never match.
     * o.head: "flick" | "filled" | "open"; o.shaft: "single" | "double" | "dashed"; o.loop: start with a curl.
     */
    function bigArrow(x1, y1, x2, y2, o = {}) {
        const r = rng(o.seed ?? "bigArrow");
        const len = Math.hypot(x2 - x1, y2 - y1);
        const bend = o.bend ?? r.range(-0.2, 0.2);
        const mx = (x1 + x2) / 2 - (y2 - y1) * bend;
        const my = (y1 + y2) / 2 + (x2 - x1) * bend;
        const w = o.weight ?? 7;
        const pts = [];
        if (o.loop) {
            // A curl at the tail, the pen winding up before it goes.
            for (let i = 0; i <= 26; i++) {
                const a = Math.PI * 0.5 + (i / 26) * Math.PI * 2.1;
                pts.push([x1 + Math.cos(a) * 26, y1 + Math.sin(a) * 22 - 22]);
            }
        }
        for (let i = 0; i <= 30; i++) {
            const t = i / 30;
            pts.push([(1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2, (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * my + t * t * y2]);
        }
        let shaft = "";
        const fat = (u) => 0.35 + 0.6 * Math.sin(Math.PI * Math.min(1, 0.1 + u * 1.05));
        if (o.shaft === "double") {
            const off = w * 0.9;
            const side = (k) => pts.map((p, i) => {
                const q = pts[Math.min(pts.length - 1, i + 1)];
                const p0 = pts[Math.max(0, i - 1)];
                const nx = -(q[1] - p0[1]);
                const ny = q[0] - p0[0];
                const l = Math.hypot(nx, ny) || 1;
                return [p[0] + (nx / l) * off * k, p[1] + (ny / l) * off * k];
            });
            shaft = pressed(side(1), fat, { size: w, color: o.color, thinning: 0.5, taperStart: 6, taperEnd: 3 }) + pressed(side(-1), fat, { size: w, color: o.color, thinning: 0.5, taperStart: 6, taperEnd: 3 });
        } else if (o.shaft === "dashed") {
            const n = pts.length;
            for (let i = 0; i < n - 3; i += 5) shaft += pressed(pts.slice(i, i + 4), () => 0.8, { size: w, color: o.color, thinning: 0.3, taperStart: 2, taperEnd: 2 });
        } else {
            shaft = pressed(pts, fat, { size: w * 1.5, color: o.color, thinning: 0.55, taperStart: 10, taperEnd: 2, wobbleAmp: o.wobbleAmp ?? 2 });
        }
        const ang = Math.atan2(y2 - my, x2 - mx);
        const head = o.head === undefined || typeof o.head === "string" ? Math.max(20, Math.min(46, len * (o.headRatio ?? 0.13))) : o.head;
        const spread = o.spread ?? 0.52;
        const wing = (sgn, k) => {
            const a = ang + Math.PI + sgn * spread * r.range(0.85, 1.15);
            return [x2 + Math.cos(a) * head * k, y2 + Math.sin(a) * head * k];
        };
        const A = wing(1, r.range(0.85, 1.1));
        const B = wing(-1, r.range(0.7, 1.2));
        const tip = [x2 + Math.cos(ang) * 3, y2 + Math.sin(ang) * 3];
        let headSvg;
        if (o.head === "filled") {
            headSvg = colorIn([[A, tip, B, [x2 - Math.cos(ang) * head * 0.55, y2 - Math.sin(ang) * head * 0.55]]], { seed: `${o.seed}h`, weight: Math.max(4, w * 0.9), overshoot: 2, color: o.color });
        } else if (o.head === "open") {
            headSvg = pressed(densify([A, tip], 6), (u) => 0.5 + 0.5 * u, { size: w * 1.3, color: o.color, thinning: 0.5, taperStart: 6, taperEnd: 1 }) + pressed(densify([B, tip], 6), (u) => 0.5 + 0.5 * u, { size: w * 1.3, color: o.color, thinning: 0.5, taperStart: 6, taperEnd: 1 });
        } else {
            // One flick: out to one side, sharp turn at the point, back out; thinnest at the point.
            const flick = [A, [(A[0] + tip[0]) / 2, (A[1] + tip[1]) / 2], tip, [(B[0] + tip[0]) / 2, (B[1] + tip[1]) / 2], B];
            headSvg = pressed(densify(flick, 6), (u) => 0.25 + 0.75 * Math.abs(u - 0.5) * 2, { size: w * 1.5, color: o.color, thinning: 0.6, taperStart: 4, taperEnd: 6, wobbleAmp: 0.5 });
        }
        return shaft + headSvg;
    }

    /** A map pin (the teardrop), drawn: a pressured outline and a coloured-in head. */
    function mapPin(x, y, o = {}) {
        const s = o.size ?? 16;
        const r = rng(o.seed ?? `mp${Math.round(x)},${Math.round(y)}`);
        // A circle for the head, two tangents down to the tip.
        const R = s * 0.6;
        const d = s * 1.4;
        const cy = y - d;
        // Tangent points sit at pi/2 +- alpha from the centre (screen coords, y down).
        const alpha = Math.acos(R / d);
        const loop = [[x + r.range(-0.5, 0.5), y]];
        const steps = 30;
        for (let i = 0; i <= steps; i++) {
            const f = Math.PI / 2 + alpha + (i / steps) * (2 * Math.PI - 2 * alpha);
            const k = R * (1 + r.range(-0.04, 0.04));
            loop.push([x + Math.cos(f) * k, cy + Math.sin(f) * k]);
        }
        loop.push([x + r.range(-1, 1), y + r.range(0, 1.5)]);
        const hole = [];
        for (let i = 0; i < 14; i++) {
            const a = (i / 14) * Math.PI * 2;
            hole.push([x + Math.cos(a) * s * 0.2, cy + Math.sin(a) * s * 0.2]);
        }
        // Outline, then a small coloured-in dot where the hole would be.
        return pressed(loop, (u) => 0.5 + 0.5 * Math.sin(Math.PI * u), { size: Math.max(2.2, s * 0.13), color: o.color, thinning: 0.5, taperStart: 2, taperEnd: 4, wobbleAmp: 0.6 }) + colorIn([hole], { seed: `${o.seed}f`, weight: Math.max(2, s * 0.12), overshoot: 1 , color: o.color });
    }

    /** An imperfect box: four strokes, corners overshooting or not meeting. */
    function box(x, y, w, h, o = {}) {
        const r = rng(o.seed ?? "box");
        const j = o.jitter ?? 3;
        const c = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([px, py]) => [px + r.range(-j, j), py + r.range(-j, j)]);
        const out = [];
        for (let i = 0; i < 4; i++) {
            const a = c[i];
            const b = c[(i + 1) % 4];
            const ext = r.range(-3, 7);
            const dx = (b[0] - a[0]) / Math.hypot(b[0] - a[0], b[1] - a[1]);
            const dy = (b[1] - a[1]) / Math.hypot(b[0] - a[0], b[1] - a[1]);
            const mid = [(a[0] + b[0]) / 2 + r.range(-j, j) * 0.6, (a[1] + b[1]) / 2 + r.range(-j, j) * 0.6];
            out.push(stroke([[a[0] - dx * ext, a[1] - dy * ext], mid, [b[0] + dx * ext, b[1] + dy * ext]], o, { taperEnd: 3 }));
        }
        return out.join("");
    }

    /** Hand-drawn line along any polyline (screen coords), gently wobbling. */
    function wobble(points, o = {}) {
        const r = rng(o.seed ?? "wobble");
        const n = noise1(r);
        const amp = o.amp ?? 2.5;
        const dense = [];
        for (let i = 0; i < points.length - 1; i++) {
            const [ax, ay] = points[i];
            const [bx, by] = points[i + 1];
            const len = Math.hypot(bx - ax, by - ay);
            const steps = Math.max(1, Math.round(len / 6));
            for (let s = 0; s < steps; s++) dense.push([ax + ((bx - ax) * s) / steps, ay + ((by - ay) * s) / steps]);
        }
        dense.push(points[points.length - 1]);
        let dist = 0;
        const out = dense.map((p, i) => {
            if (i) dist += Math.hypot(p[0] - dense[i - 1][0], p[1] - dense[i - 1][1]);
            const prev = dense[Math.max(0, i - 1)];
            const next = dense[Math.min(dense.length - 1, i + 1)];
            const nx = -(next[1] - prev[1]);
            const ny = next[0] - prev[0];
            const l = Math.hypot(nx, ny) || 1;
            const k = n(dist / (o.wavelength ?? 40)) * amp + n(dist / 9 + 100) * amp * 0.25;
            return [p[0] + (nx / l) * k, p[1] + (ny / l) * k];
        });
        return pathEl(out, { size: o.weight ?? 4, color: o.color ?? RED, thinning: 0.18, smoothing: 0.5, streamline: 0.3 });
    }

    // -----------------------------------------------------------------------
    // Board furniture (not handwriting, but part of the same drawing)
    // -----------------------------------------------------------------------
    /** A pushpin seen from above: red head, white glint, black rim. */
    /** A pushpin seen from above: a lumpy red head, a white glint, a black rim. */
    function pin(x, y, o = {}) {
        const s = o.size ?? 9;
        const c = o.color ?? RED;
        const n = noise1(rng(`pin${Math.round(x)},${Math.round(y)}`));
        const pts = [];
        for (let i = 0; i < 18; i++) {
            const a = (i / 18) * Math.PI * 2;
            const k = s * (1 + n(i * 0.7) * 0.1);
            pts.push(`${r1(x + Math.cos(a) * k)},${r1(y + Math.sin(a) * k * 0.94)}`);
        }
        return `<g><polygon points="${pts.join(" ")}" fill="${c}" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/><ellipse cx="${r1(x - s * 0.33)}" cy="${r1(y - s * 0.36)}" rx="${r1(s * 0.3)}" ry="${r1(s * 0.22)}" fill="#fff" transform="rotate(-30 ${r1(x - s * 0.33)} ${r1(y - s * 0.36)})"/></g>`;
    }

    /** Red string between two pins: sagging, a little slack, never ruler-straight. */
    function string(x1, y1, x2, y2, o = {}) {
        const len = Math.hypot(x2 - x1, y2 - y1);
        const sag = o.sag ?? Math.min(18, len * 0.05);
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2 + sag;
        const pts = [];
        const steps = Math.max(8, Math.round(len / 6));
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            pts.push([(1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * mx + t * t * x2, (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * my + t * t * y2]);
        }
        return pathEl(pts, { size: (o.width ?? 2) * 1.1, color: o.color ?? RED, thinning: 0.08, simulatePressure: false, smoothing: 0.5, streamline: 0.2, wobbleAmp: Math.min(2.2, 0.6 + len * 0.004) });
    }

    window.Ink = {
        RED,
        rng,
        noise1,
        spline,
        outlinePath,
        pathEl,
        humanize,
        write,
        note,
        score,
        messFor,
        scribbleOut,
        pencilScribble,
        roundScribble,
        crossOut,
        pressed,
        colorIn,
        handArrow,
        bigArrow,
        mapPin,
        tuck,
        blackout,
        strike,
        circle,
        underline,
        arrow,
        cross,
        check,
        caret,
        scribbleFill,
        box,
        wobble,
        pin,
        string,
    };
})();
