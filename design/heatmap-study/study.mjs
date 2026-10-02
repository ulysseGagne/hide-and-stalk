// Heatmap study: renders the review images for design/heatmap-study/index.html
// from the heatmap the app uses (tools/heat.mjs, which explains how the heat
// is made).
//
//   node design/heatmap-study/study.mjs [--stats]

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { turf, CELL, MARGIN, W, H, toM, borderM, bw, bh, pavilions, FIELD, COLORS, RAISES, STEP, SMOOTH_M, SPACING_M, smoothRing, contours } from "../../tools/heat.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "img");
// Contour lines, when asked for: each tier's edge in a darker grey.
const lineOf = (hex) => `#${Math.round(parseInt(hex.slice(1, 3), 16) * 0.55).toString(16).padStart(2, "0").repeat(3)}`;

// ---------------------------------------------------------------------------
// SVG
// ---------------------------------------------------------------------------
const r1 = (n) => Math.round(n * 10) / 10;

/**
 * One ring as a closed chain of cubic Béziers through its points (Catmull-Rom),
 * so the edge has no corners at any zoom. Points near the view are kept at the
 * detail the scale can use; far outside it, only one in twenty.
 */
function ringPath(ring, view, mpp) {
    const pts = ring.slice(0, -1);
    const fine = Math.max(1, Math.round((mpp * 3) / SPACING_M));
    const near = ([x, y]) => x > view.x0 - 60 && x < view.x1 + 60 && y > view.y0 - 60 && y < view.y1 + 60;
    const p = pts.filter((pt, i) => (i % fine === 0 && near(pt)) || i % 20 === 0);
    if (p.length < 4) return "";
    const dp = mpp < 1 ? 100 : 10;
    const f = ([x, y]) => `${Math.round(x * dp) / dp} ${Math.round(y * dp) / dp}`;
    const n = p.length;
    let d = `M${f(p[0])}`;
    for (let i = 0; i < n; i++) {
        const [a, b, c, e] = [p[(i - 1 + n) % n], p[i], p[(i + 1) % n], p[(i + 2) % n]];
        d += `C${f([b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6])} ${f([c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6])} ${f(c)}`;
    }
    return `${d}Z`;
}

/** A view of the field, x0/y0/w/h in metres, drawn `px` pixels wide. */
function svgView({ x0, y0, w, h, px, lines = false, outline = false, marks = [] }) {
    const colors = COLORS;
    const view = { x0, y0, x1: x0 + w, y1: y0 + h };
    const mpp = w / px;
    const out = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r1(x0)} ${r1(y0)} ${r1(w)} ${r1(h)}" width="${px}" height="${Math.round((px * h) / w)}">`, `<rect x="${r1(x0)}" y="${r1(y0)}" width="${r1(w)}" height="${r1(h)}" fill="${colors[0]}"/>`];
    contours().forEach((polys, i) => {
        const tier = i + 1;
        // Only shapes that reach into the view, whole (cut, their edges would
        // get corners), so a patch file holds little more than its patch.
        const reaches = (rings) => {
            const [bx0, by0, bx1, by1] = turf.bbox(turf.polygon(rings));
            return bx1 > x0 && bx0 < view.x1 && by1 > y0 && by0 < view.y1;
        };
        const d = polys.filter(reaches).map((rings) => rings.map((ring) => ringPath(ring, view, mpp)).join("")).join("");
        if (!d) return;
        const stroke = lines ? ` stroke="${lineOf(colors[tier])}" stroke-width="1.1" vector-effect="non-scaling-stroke"` : "";
        out.push(`<path fill="${colors[tier]}" fill-rule="evenodd"${stroke} d="${d}"/>`);
    });
    if (outline) {
        const ring = borderM.map(([x, y]) => `${r1(x)} ${r1(y)}`).join("L");
        out.push(`<path fill="#f2f2f2" fill-opacity="0.82" fill-rule="evenodd" d="M${r1(x0)} ${r1(y0)}h${r1(w)}v${r1(h)}h${-r1(w)}Z M${ring}Z"/>`);
    }
    for (const m of marks) {
        if (m.type === "box") out.push(`<rect x="${r1(m.x - m.w / 2)}" y="${r1(m.y - m.h / 2)}" width="${r1(m.w)}" height="${r1(m.h)}" fill="none" stroke="#000" stroke-width="3" vector-effect="non-scaling-stroke"/>`);
        if (m.type === "dot") out.push(`<circle cx="${r1(m.x)}" cy="${r1(m.y)}" r="${m.r}" fill="#fff" stroke="#000" stroke-width="2.5" vector-effect="non-scaling-stroke"/>`);
        if (m.type === "label") out.push(`<g transform="translate(${r1(m.x)} ${r1(m.y)})"><rect x="0" y="0" width="20" height="24" fill="#fff"/><text x="10" y="19" text-anchor="middle" font-family="Arimo, Helvetica, Arial, sans-serif" font-weight="700" font-size="20" fill="#000">${m.text}</text></g>`);
    }
    out.push("</svg>");
    return out.join("\n");
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------
// Web Mercator metres per pixel here, at zoom z.
const mPerPx = (z) => (156543.03 * Math.cos((46.78 * Math.PI) / 180)) / 2 ** z;
// The map on a phone: 390 x 560 CSS pixels.
const VIEW_W = 390;
const VIEW_H = 560;

const save = (name, text) => {
    writeFileSync(join(OUT, name), text);
    console.log(`img/${name}  ${(text.length / 1024).toFixed(0)} KB`);
};

// The hider's spot, and the patch around it, centred on them. The field is
// smooth enough that a match only gives an area anyway.
function patchFor([lng, lat], z) {
    const [hx, hy] = toM([lng, lat]);
    return { hx, hy, cx: hx, cy: hy, pw: VIEW_W * mPerPx(z), ph: VIEW_H * mPerPx(z) };
}
const patchSvg = (p, { lines = false } = {}) => svgView({ lines, x0: p.cx - p.pw / 2, y0: p.cy - p.ph / 2, w: p.pw, h: p.ph, px: VIEW_W });

const pav = (code) => pavilions.find((f) => f.properties.code === code).geometry.coordinates;
const whole = (px) => ({ x0: MARGIN - 20, y0: MARGIN - 20, w: bw - MARGIN + 40, h: bh - MARGIN + 40, px, outline: true });

// How bumpy the tier edges are, traced and smoothed: zigzag (turning that
// undoes itself within a stretch of edge) per 100 m, on edges evenly
// resampled every 1.5 m (node study.mjs --stats).
if (process.argv.includes("--stats")) {
    const { f, cuts } = FIELD;
    const pts = [];
    for (let gy = 0; gy < H; gy += STEP) for (let gx = 0; gx < W; gx += STEP) pts.push(turf.point([(gx + 0.5) * CELL, -(gy + 0.5) * CELL], { v: f[gy * W + gx] }));
    const grid = turf.featureCollection(pts);
    const max = f.reduce((m, v) => (v > m ? v : m), 0) + 1;
    const measure = (smoothM, windowM) => {
        let turn = 0;
        let len = 0;
        for (const cut of cuts) {
            for (const poly of turf.isobands(grid, [cut, max], { zProperty: "v" }).features[0]?.geometry.coordinates ?? []) {
                for (const raw of poly) {
                    if (raw.length < 4) continue;
                    const ring = smoothRing(raw, smoothM);
                    const dhs = [];
                    for (let i = 2; i < ring.length; i++) {
                        const h1 = Math.atan2(ring[i - 1][1] - ring[i - 2][1], ring[i - 1][0] - ring[i - 2][0]);
                        const h2 = Math.atan2(ring[i][1] - ring[i - 1][1], ring[i][0] - ring[i - 1][0]);
                        let dh = h2 - h1;
                        while (dh > Math.PI) dh -= 2 * Math.PI;
                        while (dh < -Math.PI) dh += 2 * Math.PI;
                        dhs.push(dh);
                        len += Math.hypot(ring[i][0] - ring[i - 1][0], ring[i][1] - ring[i - 1][1]);
                    }
                    // Zigzag: in each stretch, turning that undoes itself.
                    const win = Math.round(windowM / SPACING_M);
                    for (let i = 0; i + win <= dhs.length; i += win) {
                        const part = dhs.slice(i, i + win);
                        turn += part.reduce((a, v) => a + Math.abs(v), 0) - Math.abs(part.reduce((a, v) => a + v, 0));
                    }
                }
            }
        }
    return ((turn * 180) / Math.PI / (len / 100)).toFixed(0);
    };
    for (const windowM of [20, 40, 80]) {
        console.log(`zigzag within ${windowM} m: ${measure(0, windowM)} degrees per 100 m as traced, ${measure(SMOOTH_M, windowM)} smoothed`);
    }
}

{
    const { f, cuts } = FIELD;
    const [x, y] = toM([RAISES[0].lng, RAISES[0].lat]);
    const tierAt = (dy) => cuts.filter((c) => f[Math.floor((y + dy) / CELL) * W + Math.floor(x / CELL)] >= c).length + 1;
    console.log(`going south from the corner: tiers ${[0, 50, 100, 150, 250, 350].map((d) => `${tierAt(d)} at ${d} m`).join(", ")}`);
}
// The raise must leave white ground between it and the PEPS's own hill: the
// longest white stretch on the straight line from the PEPS to the corner.
{
    const { f, cuts } = FIELD;
    const [ax, ay] = toM(pav("PEPS"));
    const [bx, by] = toM([RAISES[0].lng, RAISES[0].lat]);
    const length = Math.hypot(bx - ax, by - ay);
    let run = 0;
    let best = 0;
    for (let d = 0; d <= length; d += 2) {
        const x = ax + ((bx - ax) * d) / length;
        const y = ay + ((by - ay) * d) / length;
        const white = f[Math.floor(y / CELL) * W + Math.floor(x / CELL)] < cuts[0];
        run = white ? run + 2 : 0;
        best = Math.max(best, run);
    }
    console.log(`raised area: longest white stretch between the PEPS and the corner ${best} m`);
}

// 1. The whole campus.
save(`campus.svg`, svgView({ ...whole(800) }));

// 2. Can you find it? Four hiders, their patches at the closest zoom, the map
// to search, the answers.
const FIND = [
    ["find-1", pav("PLT")],
    ["find-2", [-71.2808, 46.7795]],
    ["find-3", pav("PEPS")],
    ["find-4", [-71.2742, 46.7754]],
];
const answerMarks = [];
for (const [name, spot] of FIND) {
    const p = patchFor(spot, 19);
    save(`${name}.svg`, patchSvg(p));
    answerMarks.push(
        { type: "box", x: p.cx, y: p.cy, w: p.pw, h: p.ph },
        { type: "dot", x: p.hx, y: p.hy, r: 5 },
        { type: "label", text: name.slice(-1), x: p.cx - p.pw / 2 - 22, y: p.cy - p.ph / 2 },
    );
}
save(`find-map.svg`, svgView({ ...whole(1600) }));
save(`find-answers.svg`, svgView({ ...whole(1600), marks: answerMarks }));
