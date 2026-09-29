/* global L, turf, Ink, Campus, WildKit */

// Set M: the map screen, on real OpenStreetMap tiles, in simulated games.
//
// Every game is a hider's real campus position, stalkers at real spots, and
// questions answered truthfully (Campus.solve folds them the way
// src/hints.js does). Everything red is drawn on top by hand — the
// elimination, the border of what's left, the question on the table, the
// hider's tethers — so nothing red is ever straight.
//
// The tiles get the palette treatment with SVG filters: thresholded to pure
// black and white ("xerox", "ground"), inverted ("night"), traced to lines
// ("lines"), or left alone ("osm", "mono") as the rule-breaking baselines.

(function () {
    const { t, box, hw, note, lockup, F, M, R } = WildKit;
    const W = 375;
    const H = 812;
    const at = Campus.at;
    const L_ = window.L;

    // ---------------------------------------------------------------------
    // Games
    // ---------------------------------------------------------------------
    const off = ([lng, lat], dx, dy) => [lng + dx / (111320 * Math.cos((lat * Math.PI) / 180)), lat + dy / 110540];
    const dist = (a, b) => turf.distance(turf.point(a), turf.point(b), { units: "meters" });

    const GAMES = {
        // The same round as the app screenshots: maelle by the greenhouses.
        greenhouses: () => {
            const pos = { jules: [-71.2692303, 46.779163], noah_b: [-71.2768114, 46.7803276], camille: [-71.2748, 46.7814], theo: [-71.2731, 46.7797] };
            return {
                hider: [-71.2789, 46.7806],
                hiderName: "maelle",
                me: "jules",
                pos,
                qs: [
                    { ns: true, at: at("building", "pav_pol") ?? pos.jules, by: "jules", label: "N / S?" },
                    { radius: 500, at: at("building", "pav_pol") ?? pos.jules, by: "jules", label: "WITHIN 500 M?" },
                    { nearest: "cafe", by: "noah_b", label: "NEAREST CAFÉ?" },
                    { closer: "greenhouses", at: pos.noah_b, by: "noah_b", label: "CLOSER TO THE GREENHOUSES?" },
                ],
                pending: { ew: true, at: pos.camille, by: "camille", label: "Q5: EAST OR WEST OF ME?" },
                q: 5,
                clock: "2:40",
            };
        },
        // Pub U, south-east: three answers in, a 200 m circle on the table.
        pubu: () => {
            const dkn = at("building", "pav_dkn");
            const pos = { lea: off(dkn, 120, -60), sam: off(dkn, -260, 90), yanis: off(dkn, 60, 260), ines: off(at("landmarks", "twin_towers"), -40, 30) };
            return {
                hider: [-71.2702, 46.7792],
                hiderName: "olivier",
                me: "lea",
                pos,
                qs: [
                    { ew: true, at: dkn, by: "lea", label: "E / W?" },
                    { ns: true, at: dkn, by: "sam", label: "N / S?" },
                    { radius: 300, at: at("landmarks", "twin_towers"), by: "ines", label: "WITHIN 300 M?" },
                ],
                pending: { radius: 200, at: pos.lea, by: "lea", label: "Q4: WITHIN 200 M OF ME?" },
                q: 4,
                clock: "4:05",
            };
        },
        // Near the library (Bonenfant), west of the grand axis.
        library: () => {
            const bnf = at("building", "pav_bnf");
            const peps = at("building", "pav_peps");
            const pos = { ana: off(peps, 80, 120), felix: off(bnf, 330, -150), zoe: off(bnf, -120, 260), max: off(bnf, 250, 200) };
            return {
                hider: off(bnf, -70, -40),
                hiderName: "rosalie",
                me: "ana",
                pos,
                qs: [
                    { radius: 1000, at: pos.ana, by: "ana", label: "WITHIN 1 KM?" },
                    { nearest: "velo", by: "felix", label: "NEAREST ÀVÉLO?" },
                    { closer: "church", at: pos.felix, by: "felix", label: "CLOSER TO THE CHURCH?" },
                    { ew: true, at: pos.zoe, by: "zoe", label: "E / W?" },
                    { nearest: "bus_stop", by: "max", label: "NEAREST STOP?" },
                ],
                pending: { ns: true, at: pos.max, by: "max", label: "Q6: NORTH OR SOUTH OF ME?" },
                q: 6,
                clock: "0:52",
            };
        },
    };

    const cache = {};
    function game(name) {
        if (cache[name]) return cache[name];
        const g = GAMES[name]();
        const res = Campus.solve(g.hider, g.qs);
        const campusArea = turf.area(turf.polygon([Campus.layers.campus.ring]));
        g.region = res.region;
        g.answered = res.answered;
        g.left = Math.max(1, Math.round((turf.area(res.region) / campusArea) * 100));
        if (g.pending) g.pending.answer = Campus.solve(g.hider, [g.pending]).answered[0].answer;
        return (cache[name] = g);
    }

    // ---------------------------------------------------------------------
    // Tile treatments
    // ---------------------------------------------------------------------
    // Luminance, then a hard step: below `cut` is black, the rest white.
    const step = (cut) => Array.from({ length: 40 }, (_, i) => (i / 40 < cut ? 0 : 1)).join(" ");
    const LUMA = `<feColorMatrix type="matrix" values="0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0 0 0 1 0"/>`;
    const thresh = (cut, invert = false) => {
        const tv = invert ? step(cut).replace(/[01]/g, (d) => (d === "0" ? "1" : "0")) : step(cut);
        return `${LUMA}<feComponentTransfer><feFuncR type="discrete" tableValues="${tv}"/><feFuncG type="discrete" tableValues="${tv}"/><feFuncB type="discrete" tableValues="${tv}"/></feComponentTransfer>`;
    };
    const FILTERS = `<svg width="0" height="0" style="position:absolute"><defs>
        <filter id="f-xerox" color-interpolation-filters="sRGB">${thresh(0.7)}</filter>
        <filter id="f-ground" color-interpolation-filters="sRGB">${thresh(0.86)}</filter>
        <filter id="f-night" color-interpolation-filters="sRGB">${thresh(0.86, true)}</filter>
        <filter id="f-lines" color-interpolation-filters="sRGB">${LUMA}<feConvolveMatrix order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true"/><feComponentTransfer><feFuncR type="discrete" tableValues="1 1 0 0 0 0 0 0 0 0"/><feFuncG type="discrete" tableValues="1 1 0 0 0 0 0 0 0 0"/><feFuncB type="discrete" tableValues="1 1 0 0 0 0 0 0 0 0"/></feComponentTransfer></filter>
    </defs></svg>`;
    const TILE_CSS = {
        osm: "none",
        mono: "grayscale(1) contrast(1.3)",
        xerox: "url(#f-xerox)",
        ground: "url(#f-ground)",
        night: "url(#f-night)",
        lines: "url(#f-lines)",
    };
    const dark = (tiles) => tiles === "night";

    // ---------------------------------------------------------------------
    // Ink helpers in screen space
    // ---------------------------------------------------------------------
    const rings = (geom) => (geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates);
    const ringD = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("") + "Z";

    /** A long line that is never straight, broken into hand-drawn dashes. */
    function dashedLine(a, b, o = {}) {
        const r = Ink.rng(o.seed ?? "dash");
        const n = Ink.noise1(r);
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const ux = (b[0] - a[0]) / len;
        const uy = (b[1] - a[1]) / len;
        const bend = (s) => n(s / 90) * (o.amp ?? 7) + n(s / 23 + 40) * 1.6;
        const pt = (s) => [a[0] + ux * s - uy * bend(s), a[1] + uy * s + ux * bend(s)];
        let out = "";
        const dash = o.dash ?? 16;
        const gap = o.gap ?? 9;
        for (let s = 0; s < len; s += dash + gap) {
            const d = dash * r.range(0.7, 1.25);
            const pts = [];
            for (let k = 0; k <= 4; k++) pts.push(pt(s + (d * k) / 4));
            out += Ink.pathEl(pts, { size: o.weight ?? 3.4, color: o.color ?? R, thinning: 0.35, taperEnd: 4, taperStart: 2 });
        }
        return out;
    }

    /**
     * Colouring in a whole screen the way a person would: patch by patch,
     * each at its own angle, overlapping here, missing a bit there.
     */
    function crayon(o = {}) {
        const r = Ink.rng(o.seed ?? "crayon");
        const cell = o.cell ?? 150;
        let out = "";
        for (let y = -30; y < H + 30; y += cell * 0.9) {
            for (let x = -30; x < W + 30; x += cell * 0.9) {
                const jx = r.range(-14, 14);
                const jy = r.range(-14, 14);
                out += Ink.scribbleFill(x + jx, y + jy, cell * r.range(0.9, 1.1), cell * r.range(0.9, 1.1), { seed: `${o.seed}${x},${y}`, weight: o.weight ?? 3, gap: o.gap ?? 12, angle: (o.angle ?? -30) + r.range(-14, 14), color: o.color ?? R, misses: o.misses ?? 0.05, overshoot: 8 });
            }
        }
        return out;
    }

    // Handwriting over a busy map: the same words first in paper colour, fat,
    // so the red sits on a hand-cut halo.
    let PAPER = "#fff";
    const kn = (txt, x, y, size, o = {}) => note(txt, x, y, size, { ...o, color: PAPER, weight: size * 0.16 + 6 }) + note(txt, x, y, size, o);
    const khw = (txt, x, y, size, o = {}) => hw(txt, x, y, size, { ...o, color: PAPER, weight: (o.weight ?? size * 0.16) + 5 }) + hw(txt, x, y, size, o);

    /** Hand-drawn stroke along a ring or line (screen coords). */
    const trace = (pts, o = {}) => Ink.wobble(pts, { seed: o.seed, weight: o.weight ?? 3.2, amp: o.amp ?? 1.8, color: o.color });

    // ---------------------------------------------------------------------
    // Pins
    // ---------------------------------------------------------------------
    function namePin(x, y, name, o = {}) {
        const ink = o.dark ? "#fff" : "#000";
        const paper = o.dark ? "#000" : "#fff";
        const s = o.self ? 16 : 11;
        let h = box(x - s / 2 - 3, y - s / 2 - 3, s + 6, s + 6, `border-radius:50%;background:${paper}`);
        h += box(x - s / 2, y - s / 2, s, s, `border-radius:50%;background:${ink}`);
        if (o.self) h += box(x - 3, y - 3, 6, 6, `border-radius:50%;background:${paper}`);
        if (name) {
            const label = name.toUpperCase();
            const lw = label.length * 8 + 10;
            const lx = x + s / 2 + 5 + lw > W - 6 ? x - s / 2 - 5 - lw : x + s / 2 + 5;
            h += t(lx, y - 9, 11, label, { c: paper, st: `background:${ink};padding:2px 5px 3px;letter-spacing:.04em;white-space:nowrap` });
        }
        return h;
    }

    // ---------------------------------------------------------------------
    // Chrome: the app around the map
    // ---------------------------------------------------------------------
    function chrome(g, o) {
        const ink = dark(o.tiles) ? "#fff" : "#000";
        const paper = dark(o.tiles) ? "#000" : "#fff";
        let h = "";
        let ink2 = "";
        if (o.chrome === "none") return { h, ink: ink2 };
        // Header strip with the lockup and the two tabs.
        h += box(0, 0, W, 104, `background:${paper};border-bottom:2px solid ${ink}`);
        const lk = lockup(16, 18, 21, { color: ink });
        h += lk.html;
        ink2 += lk.ink;
        const role = o.view === "hider" ? "HIDER" : "STALKER";
        h += t(W - 150, 20, 11, `TEAM 3 · ${role}`, { w: 134, align: "right", c: ink, ls: ".08em" });
        h += box(W - 150, 62, 64, 30, `border:2px solid ${ink};background:${paper}`, t(0, 7, 12, "MENU", { w: 60, align: "center", c: ink, ls: ".06em" }));
        h += box(W - 80, 62, 64, 30, `border:2px solid ${ink};background:${ink}`, t(0, 7, 12, "MAP", { w: 60, align: "center", c: paper, ls: ".06em" }));
        // Bottom card: what's on the table.
        if (o.chrome !== "min") {
            const y = H - 132;
            h += box(12, y, W - 24, 104, `background:${paper};border:2px solid ${ink}`);
            if (o.ended) {
                h += t(28, y + 16, 12, o.ended.kicker, { c: ink, ls: ".1em" });
                h += t(28, y + 36, 30, o.ended.title, { c: ink, ls: "-0.03em" });
                h += t(28, y + 74, 12, o.ended.sub, { c: ink, wt: 400 });
            } else if (o.view === "hider") {
                h += t(28, y + 16, 12, `QUESTION ${g.q} IN ${g.clock}`, { c: ink, ls: ".1em" });
                h += t(28, y + 36, 26, `${g.left}% of campus left`, { c: ink, ls: "-0.03em" });
                h += t(28, y + 72, 12, `${g.answered.length} answers given · your code is under MENU`, { c: ink, wt: 400 });
            } else {
                h += t(28, y + 16, 12, `QUESTION ${g.q} · ASKED BY ${g.pending.by.toUpperCase()}`, { c: ink, ls: ".1em" });
                h += t(28, y + 36, 26, `${g.left}% of campus left`, { c: ink, ls: "-0.03em" });
                h += t(28, y + 72, 12, `${g.answered.length} answers · next question in ${g.clock}`, { c: ink, wt: 400 });
            }
        }
        return { h, ink: ink2 };
    }

    // ---------------------------------------------------------------------
    // Drawing one variation
    // ---------------------------------------------------------------------
    async function draw(root, v) {
        const o = LIST[v - 1];
        const g = game(o.game);
        root.style.background = dark(o.tiles) ? "#000" : "#fff";
        root.insertAdjacentHTML("beforeend", FILTERS);
        const mapEl = document.createElement("div");
        mapEl.style.cssText = `position:absolute;left:0;top:0;z-index:0;width:${W}px;height:${H}px;background:${dark(o.tiles) ? "#000" : "#fff"}`;
        root.appendChild(mapEl);
        const map = L_.map(mapEl, { zoomControl: false, attributionControl: true, zoomSnap: 0, fadeAnimation: false, zoomAnimation: false, inertia: false });
        map.attributionControl.setPrefix(false);
        const tiles = L_.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap contributors" }).addTo(map);
        mapEl.querySelector(".leaflet-tile-pane").style.filter = TILE_CSS[o.tiles];

        // Frame: the campus, the region, or the hider.
        const top = o.chrome === "none" ? 20 : 118;
        const bottom = o.chrome === "none" || o.chrome === "min" ? 20 : 150;
        const bounds = (coords) => L_.latLngBounds(coords.map(([lng, lat]) => [lat, lng]));
        let fit;
        if (o.frame === "hider") fit = bounds([off(g.hider, -150, -150), off(g.hider, 150, 150)]);
        else if (o.frame === "region") fit = bounds(rings(g.region.geometry).flatMap((p) => p[0]));
        else if (o.frame === "campus") fit = bounds(Campus.layers.campus.ring);
        else if (o.view === "hider") fit = bounds([...Object.values(g.pos), g.hider].flatMap((p) => [off(p, -50, -50), off(p, 50, 50)]));
        else fit = bounds([...rings(g.region.geometry).flatMap((p) => p[0]), ...Object.values(g.pos), g.hider, ...(g.pending?.at ? [g.pending.at] : [])].flatMap((p) => [off(p, -60, -60), off(p, 60, 60)]));
        map.fitBounds(fit, { paddingTopLeft: [14, top], paddingBottomRight: [14, bottom], animate: false });
        await new Promise((ok) => {
            if (!tiles.isLoading()) ok();
            tiles.once("load", ok);
            setTimeout(ok, 15000);
        });

        const P = ([lng, lat]) => {
            const p = map.latLngToContainerPoint([lat, lng]);
            return [p.x, p.y];
        };
        const pxPerM = (() => {
            const a = P(g.hider);
            const b = P(off(g.hider, 100, 0));
            return (b[0] - a[0]) / 100;
        })();
        const ink = dark(o.tiles) ? "#fff" : "#000";
        const paper = dark(o.tiles) ? "#000" : "#fff";
        PAPER = paper;
        let svg = "";
        let html = "";

        // Where the hider can't be: the whole screen, minus what's left.
        const regionRings = rings(g.region.geometry).map((poly) => poly.map((ring) => ring.map(P)));
        const maskD = `M-40 -40H${W + 40}V${H + 40}H-40Z` + regionRings.map((poly) => poly.map(ringD).join("")).join("");
        const showHints = o.view !== "hider" || o.hiderHints;
        if (showHints && o.hatch !== "none") {
            svg += `<defs><clipPath id="mask"><path d="${maskD}" clip-rule="evenodd"/></clipPath></defs>`;
            if (o.hatch === "redact") svg += `<path d="${maskD}" fill="#000" fill-rule="evenodd"/>`;
            else if (o.hatch === "whiteout") svg += `<path d="${maskD}" fill="${paper}" fill-rule="evenodd"/>`;
            else if (o.hatch === "solid") svg += `<g clip-path="url(#mask)">${crayon({ seed: `${o.game}s`, weight: 12, gap: 19, cell: 190, misses: 0.06 })}</g>`;
            else {
                const color = o.hatch === "black" ? ink : R;
                svg += `<g clip-path="url(#mask)">${crayon({ seed: `${o.game}h`, weight: o.hatchWeight ?? 2.4, gap: o.hatchGap ?? 15, color })}</g>`;
            }
            for (const [i, poly] of regionRings.entries()) svg += trace(poly[0], { seed: `${o.game}r${i}`, weight: 3.6 });
        }

        // Handwritten reasoning on each answered constraint.
        if (o.annotate && showHints) {
            g.answered.forEach((q, i) => {
                const seed = `${o.game}a${i}`;
                let x;
                let y;
                if (q.ns || q.ew) {
                    const c = P(q.at);
                    const a = q.ns ? [-30, c[1]] : [c[0], -30];
                    const b = q.ns ? [W + 30, c[1]] : [c[0], H + 30];
                    svg += dashedLine(a, b, { seed, weight: 2.6 });
                    [x, y] = q.ns ? [22, c[1] + (q.answer === "NORTH" ? -44 : 14)] : [c[0] + (q.answer === "EAST" ? 12 : -110), top + 60 + i * 40];
                } else if (q.radius || q.closer) {
                    const centre = q.radius ? q.at : at("landmarks", q.closer);
                    const rm = q.radius ?? dist(centre, q.at);
                    const c = P(centre);
                    svg += Ink.circle(c[0], c[1], rm * pxPerM, rm * pxPerM, { seed, weight: 2.8, tilt: 0 });
                    [x, y] = [Math.min(W - 150, Math.max(14, c[0] - 40)), Math.max(top + 10, c[1] - rm * pxPerM - 34)];
                } else {
                    const c = regionRings[0][0].reduce((s, p) => [s[0] + p[0], s[1] + p[1]], [0, 0]).map((s) => s / regionRings[0][0].length);
                    [x, y] = [Math.min(W - 160, c[0] + 30), c[1] + 50];
                }
                svg += kn(`${i + 1}. ${q.answer}`, Math.min(W - 150, Math.max(14, x)), Math.min(H - 190, Math.max(top + 30, y)), 15, { seed: `${seed}n`, tilt: -4, maxWidth: 150 });
            });
        }

        // The question on the table (stalker view, and the hider's too).
        if (g.pending && !o.ended && o.ask !== false) {
            const q = g.pending;
            const c = P(q.at);
            if (q.ns || q.ew) {
                const a = q.ns ? [-30, c[1]] : [c[0], -30];
                const b = q.ns ? [W + 30, c[1]] : [c[0], H + 30];
                svg += dashedLine(a, b, { seed: `${o.game}ask`, weight: 8, color: paper, dash: 18, gap: 8 }) + dashedLine(a, b, { seed: `${o.game}ask`, weight: 4.4, dash: 18, gap: 8 });
                svg += q.ns ? Ink.arrow(W - 40, c[1] - 12, W - 40, c[1] - 62, { seed: "askn", weight: 3.2 }) + Ink.arrow(W - 40, c[1] + 12, W - 40, c[1] + 62, { seed: "asks", weight: 3.2 }) : Ink.arrow(c[0] - 12, top + 40, c[0] - 62, top + 40, { seed: "askw", weight: 3.2 }) + Ink.arrow(c[0] + 12, top + 40, c[0] + 62, top + 40, { seed: "aske", weight: 3.2 });
            } else if (q.radius) {
                const rp = q.radius * pxPerM;
                svg += Ink.circle(c[0], c[1], rp, rp, { seed: `${o.game}ask`, weight: 3.8, tilt: 0 });
            }
            if (o.askNote !== false && !o.hiderNote) svg += kn(q.label, 18, top + 26 + (q.ew ? 60 : 0), 17, { seed: `${o.game}askn`, maxWidth: q.ew ? Math.max(120, c[0] - 40) : 250, tilt: -3 });
        }

        // Stalker trails (endgame): black dotted, the only precise lines.
        if (o.trails) {
            for (const [name, end] of Object.entries(g.pos)) {
                const r = Ink.rng(`trail${name}`);
                const start = g.pos[Object.keys(g.pos)[0]];
                const pts = [];
                for (let k = 0; k <= 12; k++) {
                    const tt = k / 12;
                    const target = o.trails === "converge" ? g.hider : end;
                    const from = o.trails === "converge" ? end : start;
                    pts.push(P([from[0] + (target[0] - from[0]) * tt + r.range(-1, 1) * 0.0006 * Math.sin(tt * Math.PI), from[1] + (target[1] - from[1]) * tt + r.range(-1, 1) * 0.0004 * Math.sin(tt * Math.PI)]));
                }
                svg += `<path d="${Ink.spline(pts, 6).map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("")}" fill="none" stroke="${ink}" stroke-width="2.2" stroke-dasharray="1 5" stroke-linecap="round"/>`;
            }
        }

        // People.
        const hp = P(g.hider);
        if (o.view === "hider") {
            const placed = [];
            for (const [name, p] of Object.entries(g.pos)) {
                const sp = P(p);
                svg += Ink.string(hp[0], hp[1], sp[0], sp[1], { width: 2.4, sag: Math.min(24, Math.hypot(sp[0] - hp[0], sp[1] - hp[1]) * 0.08) });
                const m = Math.round(dist(g.hider, p));
                // Along the string, wherever there's room: nearer the stalker first.
                let best = null;
                const len = Math.hypot(sp[0] - hp[0], sp[1] - hp[1]) || 1;
                // Off to one side of the string, never on it.
                let nx = -(sp[1] - hp[1]) / len;
                let ny = (sp[0] - hp[0]) / len;
                if (ny > 0) [nx, ny] = [-nx, -ny];
                for (const f of [0.62, 0.72, 0.5, 0.82, 0.4, 0.3]) {
                    const mx = Math.min(W - 70, Math.max(10, hp[0] + (sp[0] - hp[0]) * f + nx * 18 - 22));
                    const my = Math.min(H - 20, Math.max(top + 30, hp[1] + (sp[1] - hp[1]) * f + ny * 18));
                    const clash = placed.some(([x, y]) => Math.abs(x - mx) < 64 && Math.abs(y - my) < 24);
                    if (!clash) {
                        best = [mx, my];
                        break;
                    }
                    best ??= [mx, my + 22];
                }
                placed.push(best);
                svg += khw(`${m} M`, best[0], best[1], 15, { seed: `d${name}${o.game}`, tilt: -6, weight: 2.8 });
                html += namePin(sp[0], sp[1], name, { dark: dark(o.tiles) });
            }
            svg += Ink.pin(hp[0], hp[1], { size: 11 });
            html += t(hp[0] - 24, hp[1] + 16, 11, "YOU", { c: paper, st: `background:${ink};padding:2px 5px 3px;letter-spacing:.06em` });
            if (o.hiderNote) svg += kn(o.hiderNote, 22, top + 30, 19, { seed: `hn${o.game}`, maxWidth: 230, tilt: -4 });
        } else {
            for (const [name, p] of Object.entries(g.pos)) {
                const sp = P(p);
                html += namePin(sp[0], sp[1], name === g.me ? null : name, { dark: dark(o.tiles), self: name === g.me });
            }
        }
        if (o.ended) {
            svg += Ink.circle(hp[0], hp[1], 34, 30, { seed: `end${o.game}`, weight: 5 });
            svg += Ink.cross(hp[0], hp[1], 14, { seed: `endx${o.game}`, weight: 5 });
            svg += kn(o.ended.note, Math.max(16, hp[0] + 40 > W - 170 ? hp[0] - 200 : hp[0] + 40), Math.max(top + 30, hp[1] - 110), 24, { seed: `endn${o.game}`, maxWidth: 160, tilt: -6 });
        }

        // Layers: the red, then people, then the app's chrome and its own ink.
        const c = chrome(g, o);
        const layer = (z, inner, isSvg) =>
            root.insertAdjacentHTML("beforeend", isSvg ? `<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0;pointer-events:none;z-index:${z};overflow:visible">${inner}</svg>` : `<div style="position:absolute;inset:0;pointer-events:none;z-index:${z}">${inner}</div>`);
        layer(40, svg, true);
        layer(45, html);
        layer(50, c.h);
        layer(55, c.ink, true);
        const attr = mapEl.querySelector(".leaflet-control-attribution");
        if (attr) attr.style.cssText = `background:${paper};color:${ink};font:400 9px ${F};padding:1px 4px;margin:0 ${o.chrome === "none" || o.chrome === "min" ? 0 : 0}px ${o.chrome === "none" || o.chrome === "min" ? 0 : 0}px 0`;
        mapEl.querySelector(".leaflet-bottom.leaflet-right").style.cssText = `z-index:60;bottom:${o.chrome === "none" || o.chrome === "min" ? 0 : 0}px`;
    }

    // ---------------------------------------------------------------------
    // The set
    // ---------------------------------------------------------------------
    const LIST = [
        // Game 1, the greenhouses — stalker's map across every tile treatment.
        { game: "greenhouses", view: "stalker", tiles: "xerox", hatch: "red", name: "Xerox tiles, red hatch" },
        { game: "greenhouses", view: "stalker", tiles: "ground", hatch: "red", name: "Figure-ground tiles, red hatch" },
        { game: "greenhouses", view: "stalker", tiles: "lines", hatch: "red", name: "Traced tiles, red hatch" },
        { game: "greenhouses", view: "stalker", tiles: "night", hatch: "red", name: "Night tiles, red hatch" },
        { game: "greenhouses", view: "stalker", tiles: "mono", hatch: "red", name: "Grey tiles (breaks the palette)" },
        { game: "greenhouses", view: "stalker", tiles: "osm", hatch: "red", name: "Plain OSM (breaks the palette)" },
        // Same map, other ways of saying "not here".
        { game: "greenhouses", view: "stalker", tiles: "xerox", hatch: "black", name: "Black hatch, red border" },
        { game: "greenhouses", view: "stalker", tiles: "xerox", hatch: "redact", name: "Redacted: the rest of the world blacked out" },
        { game: "greenhouses", view: "stalker", tiles: "ground", hatch: "whiteout", name: "Whiteout: the map only exists where she can be" },
        { game: "greenhouses", view: "stalker", tiles: "xerox", hatch: "solid", name: "Coloured in: thick red crayon" },
        { game: "greenhouses", view: "stalker", tiles: "xerox", hatch: "red", annotate: true, name: "Annotated: every answer written on the map" },
        { game: "greenhouses", view: "stalker", tiles: "ground", hatch: "red", frame: "region", chrome: "min", name: "Zoomed to what's left" },
        { game: "greenhouses", view: "stalker", tiles: "lines", hatch: "whiteout", chrome: "none", annotate: true, name: "No chrome: just the evidence" },
        // Game 1 — the hider's map: tethers to every stalker.
        { game: "greenhouses", view: "hider", tiles: "xerox", name: "Hider: red strings to each stalker" },
        { game: "greenhouses", view: "hider", tiles: "night", name: "Hider, night tiles" },
        { game: "greenhouses", view: "hider", tiles: "ground", frame: "hider", chrome: "min", hiderNote: "NOAH IS 160 M AWAY. DON'T MOVE.", name: "Hider, close up" },
        { game: "greenhouses", view: "hider", tiles: "lines", hiderHints: true, hatch: "black", name: "Hider sees what she's given away" },
        // Game 2, Pub U.
        { game: "pubu", view: "stalker", tiles: "xerox", hatch: "red", name: "Pub U: a 200 m circle on the table" },
        { game: "pubu", view: "stalker", tiles: "night", hatch: "solid", annotate: true, name: "Pub U, night, annotated" },
        { game: "pubu", view: "hider", tiles: "ground", name: "Pub U, the hider's strings" },
        { game: "pubu", view: "stalker", tiles: "lines", hatch: "redact", frame: "region", name: "Pub U, redacted, zoomed" },
        // Game 3, the library.
        { game: "library", view: "stalker", tiles: "ground", hatch: "red", name: "Library: north or south of Max?" },
        { game: "library", view: "stalker", tiles: "xerox", hatch: "black", annotate: true, name: "Library, five answers written up" },
        { game: "library", view: "hider", tiles: "night", hiderNote: "THEY'RE CLOSING IN", name: "Library, the hider at night" },
        // Endgames.
        { game: "greenhouses", view: "stalker", tiles: "xerox", hatch: "red", frame: "hider", trails: "converge", ended: { kicker: "FOUND · 13:32", title: "jules found maelle", sub: "23:14 of hunting · 4 questions", note: "GOT HER" }, name: "Found: the trails that got there" },
        { game: "pubu", view: "stalker", tiles: "ground", hatch: "none", trails: "converge", annotate: true, ended: { kicker: "ROUND OVER · 30:00", title: "olivier got away", sub: "Never found · 6 questions asked", note: "HE WAS HERE THE WHOLE TIME" }, name: "Got away: where he was all along" },
    ];

    window.Maps = {
        get list() {
            return LIST.map((o, i) => ({ n: i + 1, ...o }));
        },
        draw,
    };
})();
