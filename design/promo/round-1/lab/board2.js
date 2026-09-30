/* global Ink, Campus, Board, turf */

// Set B, second pass (B13-B22), from the notes on B1-B12:
//
//  - balanced and centred, with room to breathe: nothing within ~30 px of
//    the edge, the cluster sits in the middle, never a symmetric grid;
//  - a mix of objects, never four of the same card; no "Q1 · 13:10" labels;
//  - maps people recognise: a torn-off scrap of the real map (OSM tiles,
//    xeroxed to black and white), not the bare campus outline;
//  - what's ruled out is coloured in like a four-year-old would, ~95%
//    filled, over and under the edges; no border + circle on top of it;
//  - one or two hand-drawn map pins, not a scatter of dots;
//  - photos drawn by hand (like B6's "place to sit"), arrows never perfect;
//  - kept from B5/B7/B9/B10/B11/B12: the black board, the four-pin card,
//    white post-its, the dossier with WANTED over it and NEVER RUNS
//    underlined, the stalker's thoughts written under things, 500 M, and
//    CLASSIFIED (now by hand).

(function () {
    const FONT = "Arimo, 'Helvetica Neue', Helvetica, Arial, sans-serif";
    const { make } = Board;
    const W0 = 375;
    const H0 = 480;
    const HIDER = [-71.2789, 46.7806];

    const Q = {
        ns: "Are you north or south of me?",
        r500: "Are you within 500 m of me?",
        cafe: "Which café on campus are you closest to?",
        green: "Are you closer to the greenhouses than I am?",
        sit: "Send a photo of the nearest place to sit.",
        door: "Send a photo of the nearest door.",
        io: "Are you inside or outside?",
    };
    const SC = () => Campus.scenario("greenhouses");
    const centroid = (f) => turf.centroid(f).geometry.coordinates;
    const cafeName = (sc) => sc.answered.find((a) => a.nearest).answer.replace(/\s*\(.*\)$/, "").toUpperCase();

    // The 1-bit tile treatment (same as the map set).
    const LUMA = `<feColorMatrix type="matrix" values="0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0 0 0 1 0"/>`;
    const step = (cut) => Array.from({ length: 40 }, (_, i) => (i / 40 < cut ? 0 : 1)).join(" ");
    const FILTERS = `<svg width="0" height="0" style="position:absolute"><defs><filter id="bx" color-interpolation-filters="sRGB">${LUMA}<feComponentTransfer><feFuncR type="discrete" tableValues="${step(0.72)}"/><feFuncG type="discrete" tableValues="${step(0.72)}"/><feFuncB type="discrete" tableValues="${step(0.72)}"/></feComponentTransfer></filter></defs></svg>`;

    // ---------------------------------------------------------------------
    // Pieces
    // ---------------------------------------------------------------------
    /** A question card: the question typed, the answer written in red. No label. */
    function card(b, { x, y, w = 150, rot = 0, q, answer, seed, answerSize = 24, pin = "top", pins4 = false }) {
        const ink = b.ink;
        const paper = b.paper;
        const html = `<div style="background:${paper};color:${ink};border:2px solid ${ink};padding:12px 12px 46px;font:700 14px/1.2 ${FONT};letter-spacing:-.01em">${q}</div>`;
        const it = b.item(html, { x, y, w, rot });
        if (answer) {
            const [ax, ay] = it.at(0.09, 0.88);
            b.draw(Ink.write(answer, { x: ax, y: ay, size: answerSize, seed: seed ?? answer, tilt: rot - 3, maxWidth: w * 0.84, importance: "key" }).svg);
        }
        let p = null;
        if (pins4) for (const f of [[0.07, 0.07], [0.93, 0.08], [0.06, 0.93], [0.94, 0.92]]) b.pin(it.at(...f), { size: 6 });
        else if (pin) b.pin((p = it.at(0.5, 0.07)));
        return { ...it, pinAt: p ?? it.at(0.5, 0.07) };
    }

    // Photos drawn by hand: white strokes on black, 100 x 100.
    let STROKE = "#fff";
    const sk = (pts, w, seed) => Ink.pathEl(Ink.spline(pts, 6), { size: w, color: STROKE, thinning: 0.3, wobbleAmp: 1.1, taperEnd: 2, seed });
    const SCENES = {
        sit: () => sk([[10, 62], [50, 60.5], [90, 60]], 4.5) + sk([[12, 49], [52, 48], [88, 47]], 4.5) + sk([[20, 62], [19, 86]], 3.5) + sk([[80, 61], [82, 86]], 3.5) + sk([[0, 90], [55, 89], [100, 91]], 1.6),
        door: () => sk([[30, 100], [31, 50], [30, 18]], 3.5) + sk([[30, 18], [52, 17.5], [70, 18]], 3.5) + sk([[70, 18], [69, 60], [70, 100]], 3.5) + sk([[37, 26], [63, 26], [62, 52], [37, 53], [37, 26]], 2) + sk([[62, 64], [63, 66]], 5) + sk([[39, 6], [61, 6], [61, 12], [39, 12], [39, 6]], 2.2) + sk([[43, 9], [57, 9]], 1.6),
        tree: () => {
            const r = Ink.rng("tree");
            const loops = [];
            for (let i = 0; i < 70; i++) {
                const a = i * 0.9;
                const rr = 12 + (i % 7) * 2.6 + r.range(-2, 2);
                loops.push([50 + Math.cos(a) * rr * 1.1 + Math.sin(i * 0.37) * 6, 36 + Math.sin(a) * rr * 0.8]);
            }
            return sk([[48, 100], [49, 72], [51, 52]], 6) + sk([[49, 74], [36, 58]], 3) + sk([[51, 66], [66, 52]], 3) + Ink.pathEl(Ink.spline(loops, 3), { size: 1.8, color: STROKE, thinning: 0.3, wobbleAmp: 0.6 });
        },
        above: () => sk([[0, 8], [36, 32], [40, 100]], 3) + sk([[100, 4], [64, 28], [60, 100]], 3) + [40, 56, 72, 88].map((y, i) => sk([[y / 3.4, y + 2], [37, y - 5]], 1.4, i)).join("") + [40, 56, 72, 88].map((y, i) => sk([[63, y - 6], [100 - y / 3.4, y]], 1.4, i + 9)).join(""),
    };
    function polaroid(b, { x, y, w = 118, rot = 0, scene = "sit", caption, pin = true }) {
        const ph = w - 16;
        STROKE = b.paper;
        const html = `<div style="background:${b.paper};border:2px solid ${b.ink};padding:7px 7px 34px;box-sizing:border-box;width:${w}px">
            <svg width="${ph - 2}" height="${ph - 2}" viewBox="0 0 100 100" style="display:block;background:${b.ink}">${SCENES[scene]()}</svg></div>`;
        const it = b.item(html, { x, y, w, rot });
        if (caption) {
            const [cx, cy] = it.at(0.08, 0.95);
            b.draw(Ink.write(caption, { x: cx, y: cy, size: 13, seed: caption, tilt: rot - 3, maxWidth: w * 0.86, importance: "aside" }).svg);
        }
        const p = it.at(0.5, 0.05);
        if (pin) b.pin(p);
        return { ...it, pinAt: p };
    }

    /** White post-it with the stalker's thought in red; or a coloured-in red one with nothing on it. */
    function postit(b, { x, y, w = 104, rot = 0, text, red = false, size = 18 }) {
        const fill = red ? `<svg width="${w}" height="${w}" style="position:absolute;inset:0;overflow:visible">${Ink.colorIn([[[0, 0], [w, 0], [w, w], [0, w]]], { seed: `pi${x}`, weight: 12, overshoot: 3 })}</svg>` : "";
        const html = `<div style="position:relative;width:${w}px;height:${w}px;box-sizing:border-box;${red ? "" : `border:2px solid ${b.ink};background:${b.paper}`}">${fill}</div>`;
        const it = b.item(html, { x, y, w, h: w, rot });
        if (text) {
            const [tx, ty] = it.at(0.1, 0.38);
            b.draw(Ink.note(text, { x: tx, y: ty, size, maxWidth: w * 0.8, seed: text, tilt: rot - 2, importance: "aside" }).svg);
        }
        const p = it.at(0.5, 0.09);
        b.pin(p);
        return { ...it, pinAt: p };
    }

    /** The subject: a silhouette with the face scribbled out. */
    function subject(b, { x, y, w = 108, rot = 0, name = "HIDER" }) {
        const html = `<div style="background:${b.paper};color:${b.ink};border:2px solid ${b.ink};padding:7px;font-family:${FONT}">
            <svg width="${w - 18}" height="${w - 6}" viewBox="0 0 100 112" style="display:block"><g fill="${b.ink}"><ellipse cx="50" cy="32" rx="16" ry="19"/><path d="M16 112 C18 74 32 58 50 58 C68 58 82 74 84 112 Z"/></g></svg>
            <div style="font-size:12px;font-weight:700;letter-spacing:.12em;margin-top:6px">${name}</div></div>`;
        const it = b.item(html, { x, y, w, rot });
        const [fx, fy] = it.at(0.5, 0.3);
        b.draw(Ink.pencilScribble(fx - 22, fy - 16, 44, 30, { seed: `sub${x}`, passes: 3, weight: 7 }));
        const p = it.at(0.5, 0.04);
        b.pin(p);
        return { ...it, pinAt: p };
    }

    // ---------------------------------------------------------------------
    // The map scrap: real OSM tiles, xeroxed, with the ruled-out part coloured in
    // ---------------------------------------------------------------------
    function worldPx(lng, lat, z) {
        const n = 256 * 2 ** z;
        const s = Math.sin((lat * Math.PI) / 180);
        return [((lng + 180) / 360) * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
    }
    /**
     * o: { center [lng, lat], zoom, excluded: turf polygon | "region" (use the
     *      scenario's region: everything else gets coloured), ink(P, w, h) }
     */
    function scrap(b, { x, y, w, h, rot = 0, center, zoom = 15.4, region, pins4 = true, pin = false, ink }) {
        const tz = Math.min(18, Math.ceil(zoom));
        const k = 2 ** (zoom - tz);
        const [cx, cy] = worldPx(center[0], center[1], tz);
        const x0 = cx - w / 2 / k;
        const y0 = cy - h / 2 / k;
        let imgs = "";
        for (let tx = Math.floor(x0 / 256); tx <= Math.floor((x0 + w / k) / 256); tx++) {
            for (let ty = Math.floor(y0 / 256); ty <= Math.floor((y0 + h / k) / 256); ty++) {
                imgs += `<img src="https://tile.openstreetmap.org/${tz}/${tx}/${ty}.png" style="position:absolute;left:${((tx * 256 - x0) * k).toFixed(1)}px;top:${((ty * 256 - y0) * k).toFixed(1)}px;width:${(256 * k).toFixed(2)}px;height:${(256 * k).toFixed(2)}px">`;
            }
        }
        const P = ([lng, lat]) => {
            const [X, Y] = worldPx(lng, lat, tz);
            return [(X - x0) * k, (Y - y0) * k];
        };
        let svg = "";
        if (region) {
            const geo = region.geometry;
            const polys = geo.type === "Polygon" ? [geo.coordinates] : geo.coordinates;
            const holes = polys.flatMap((poly) => poly.map((ring) => ring.map(P)));
            const pad = 14;
            svg += Ink.colorIn([[[-pad, -pad], [w + pad, -pad], [w + pad, h + pad], [-pad, h + pad]], ...holes], { seed: `sc${x}${y}`, weight: 12, overshoot: 5 });
        }
        if (ink) svg += ink(P, w, h);
        const html = `<div style="position:relative;width:${w}px;height:${h}px;border:2px solid ${b.ink};box-sizing:border-box;overflow:hidden;background:${b.paper}">
            <div style="position:absolute;inset:0;filter:url(#bx)${b.dark ? " invert(1)" : ""}">${imgs}</div>
            <svg width="${w}" height="${h}" style="position:absolute;left:-2px;top:-2px;overflow:visible">${svg}</svg></div>`;
        const it = b.item(html, { x, y, w, h, rot });
        if (pins4) for (const f of [[0.04, 0.05], [0.96, 0.04], [0.05, 0.95], [0.95, 0.96]]) b.pin(it.at(...f), { size: 6.5 });
        const toBoard = (lngLat) => {
            const [mx, my] = P(lngLat);
            return it.at(mx / w, my / h);
        };
        const top = it.at(0.5, 0.04);
        if (pin) b.pin(top);
        return { ...it, P, toBoard, pinAt: pins4 ? it.at(0.04, 0.05) : top, pinR: it.at(0.96, 0.04) };
    }

    async function settle(root) {
        await Promise.all([...root.querySelectorAll("img")].map((i) => (i.complete ? null : new Promise((ok) => ((i.onload = ok), (i.onerror = ok))))));
    }

    let current = null;
    const start = (root, W, H, o) => {
        const b = make(root, W, H, o);
        current = b;
        root.insertAdjacentHTML("afterbegin", FILTERS);
        return b;
    };
    const thought = (b, text, x, y, o = {}) => b.draw(Ink.note(text, { x, y, size: o.size ?? 20, maxWidth: o.maxWidth ?? 300, seed: text, tilt: o.tilt ?? -2, importance: o.importance ?? "aside", color: o.color }).svg);
    const BOLD = { width: 3.4 };

    // ---------------------------------------------------------------------
    // The boards
    // ---------------------------------------------------------------------
    const BOARDS = {
        // B1, kept minimal: no labels, a bolder string, the thought underneath.
        13(root, W, H) {
            const b = start(root, W, H);
            const sc = SC();
            const a = card(b, { x: 44, y: 70, w: 156, rot: -4, q: Q.ns, answer: sc.answered[0].answer });
            const c = card(b, { x: 176, y: 196, w: 156, rot: 3, q: Q.r500, answer: sc.answered[1].answer });
            b.string(a.pinAt, c.pinAt, BOLD);
            thought(b, "NORTH, NOT WITHIN 500 M", 48, 408);
        },
        // B2, rebalanced: tighter, centred, a photo instead of a fourth card.
        14(root, W, H) {
            const b = start(root, W, H);
            const sc = SC();
            const cs = [
                card(b, { x: 44, y: 60, w: 146, rot: -4, q: Q.ns, answer: sc.answered[0].answer }),
                card(b, { x: 196, y: 84, w: 142, rot: 3, q: Q.r500, answer: sc.answered[1].answer }),
                card(b, { x: 196, y: 262, w: 146, rot: -2, q: Q.cafe, answer: cafeName(sc), answerSize: 19 }),
                polaroid(b, { x: 56, y: 236, w: 124, rot: -6, scene: "sit", caption: "PLACE TO SIT" }),
            ];
            for (let i = 0; i < cs.length - 1; i++) b.string(cs[i].pinAt, cs[i + 1].pinAt, BOLD);
        },
        // The real map, torn off and pinned at four corners, coloured in.
        15(root, W, H) {
            const b = start(root, W, H);
            const sc = SC();
            const a = card(b, { x: 34, y: 30, w: 142, rot: -5, q: Q.ns, answer: sc.answered[0].answer });
            const c = card(b, { x: 200, y: 40, w: 142, rot: 4, q: Q.cafe, answer: cafeName(sc), answerSize: 18 });
            const m = scrap(b, { x: 44, y: 186, w: 288, h: 220, rot: -2, center: centroid(sc.region), zoom: 16.3, region: sc.region });
            b.string(a.pinAt, m.pinAt, BOLD);
            b.string(c.pinAt, m.pinR, BOLD);
            const hole = m.toBoard(HIDER);
            b.draw(Ink.handArrow(206, 432, hole[0] + 10, hole[1] + 16, { seed: "b15a", weight: 4 }));
            b.draw(Ink.write("HERE?", { x: 214, y: 452, size: 30, seed: "b15h", tilt: -7, importance: "vibe" }).svg);
        },
        // 500 m, made visual: the circle is coloured in because she isn't in it.
        16(root, W, H) {
            const b = start(root, W, H);
            const sc = SC();
            const pol = Campus.at("building", "pav_pol");
            const disc = turf.circle(pol, 500, { units: "meters", steps: 64 });
            const bb = turf.bboxPolygon([-71.32, 46.7, -71.2, 46.86]);
            const south = turf.bboxPolygon([-71.32, 46.7, -71.2, pol[1]]);
            const region = turf.difference(turf.featureCollection([bb, disc]));
            void south;
            const m = scrap(b, {
                x: 40, y: 150, w: 296, h: 250, rot: 1.5, center: [pol[0] + 0.0008, pol[1] + 0.0002], zoom: 14.3, region,
                ink: (P) => {
                    const [px, py] = P(pol);
                    const edge = P(turf.destination(pol, 500, 45, { units: "meters" }).geometry.coordinates);
                    return Ink.mapPin(px, py, { size: 26, seed: "b16p", color: "#000" }) + Ink.write("ME", { x: px + 20, y: py - 30, size: 16, seed: "b16me", importance: "info", color: "#000" }).svg + Ink.write("500 M", { x: edge[0] + 6, y: edge[1] - 4, size: 20, seed: "b16m", tilt: -30, importance: "info", color: "#000" }).svg;
                },
            });
            const c = card(b, { x: 116, y: 26, w: 170, rot: -3, q: Q.r500, answer: sc.answered[1].answer });
            b.string(c.pinAt, m.pinR, BOLD);
            thought(b, "NORTH, NOT WITHIN 500 M", 46, 440, { size: 19 });
        },
        // B5, on black: fewer things, not symmetric.
        17(root, W, H) {
            const b = start(root, W, H, { surface: "black" });
            const sc = SC();
            const a = card(b, { x: 40, y: 74, w: 156, rot: -4, q: Q.ns, answer: sc.answered[0].answer });
            const s = subject(b, { x: 206, y: 196, w: 124, rot: 5 });
            b.string(a.pinAt, s.pinAt, BOLD);
            b.draw(Ink.write("?", { x: 96, y: 390, size: 96, seed: "b17q", tilt: -8, importance: "vibe" }).svg);
        },
        // Post-its: white with a thought, one red one coloured in, nothing on it.
        18(root, W, H) {
            const b = start(root, W, H);
            const sc = SC();
            const c = card(b, { x: 40, y: 56, w: 160, rot: -3, q: Q.cafe, answer: cafeName(sc), answerSize: 19 });
            const p1 = postit(b, { x: 226, y: 70, w: 106, rot: 5, text: "SHE LIKES COFFEE?" });
            const ph = polaroid(b, { x: 60, y: 250, w: 124, rot: 4, scene: "tree", caption: "BIGGEST TREE" });
            const p2 = postit(b, { x: 214, y: 268, w: 104, rot: -4, text: "OUTSIDE!!" });
            postit(b, { x: 176, y: 196, w: 66, rot: 10, red: true });
            b.string(c.pinAt, p1.pinAt, BOLD);
            b.string(c.pinAt, ph.pinAt, BOLD);
            b.string(ph.pinAt, p2.pinAt, BOLD);
        },
        // The dossier, simpler, as one element; WANTED over it; NEVER RUNS underlined.
        19(root, W, H) {
            const b = start(root, W, H);
            const it = b.item(
                `<div style="border:2px solid #000;background:#fff;font-family:${FONT};padding:16px 18px">
                    <div style="font-size:10px;font-weight:700;letter-spacing:.14em">FILE Nº 005 · TEAM 3</div>
                    <div style="font-size:28px;font-weight:700;letter-spacing:-.02em;margin-top:8px">SUBJECT: HIDER</div>
                    <div style="height:2px;background:#000;margin:12px 0 10px"></div>
                    <div style="font-size:13px;line-height:1.9">MOVES &nbsp;<b>WALKS, NEVER RUNS</b><br>QUESTIONS LEFT &nbsp;<b>2 OF 6</b></div>
                </div>`,
                { x: 34, y: 44, w: 300, rot: -1.5 },
            );
            b.pin(it.at(0.5, 0.05));
            const [sx, sy] = it.at(0.8, 0.42);
            b.draw(Ink.box(sx - 66, sy - 22, 122, 46, { seed: "b10b", weight: 3.5 }));
            b.draw(Ink.write("WANTED", { x: sx - 58, y: sy + 13, size: 26, seed: "b10w", tilt: -8, mess: 0.8 }).svg);
            const [ux, uy] = it.at(0.4, 0.64);
            b.draw(Ink.underline(ux, uy + 6, 112, { seed: "b19u", weight: 3.2 }));
            const ph = polaroid(b, { x: 196, y: 262, w: 130, rot: 5, scene: "door", caption: "NEAREST DOOR" });
            b.string(it.at(0.5, 0.05), ph.pinAt, BOLD);
            thought(b, "GREEN DOOR??", 52, 330, { size: 21, tilt: -5, maxWidth: 130 });
        },
        // Classified, by hand, over the file of what she's admitted.
        20(root, W, H) {
            const b = start(root, W, H);
            const sc = SC();
            const bar = (n) => `<span style="display:inline-block;width:${n}px;height:12px;background:#000;vertical-align:-1px"></span>`;
            const doc = b.item(
                `<div style="border:2px solid #000;background:#fff;font:13px/2 ${FONT};padding:16px 18px">
                    <div style="font-weight:700;letter-spacing:.14em;font-size:10px">WHAT SHE'S ADMITTED</div>
                    <div>North or south? <b>${sc.answered[0].answer}</b></div>
                    <div>Within 500 m? <b>${sc.answered[1].answer}</b></div>
                    <div>Closest café? ${bar(90)}</div>
                    <div>Closer to the greenhouses? <b>${sc.answered[3].answer}</b></div>
                    <div>Where exactly? ${bar(120)}</div>
                </div>`,
                { x: 40, y: 70, w: 290, rot: -2 },
            );
            b.pin(doc.at(0.5, 0.05));
            const [cx, cy] = doc.at(0.62, 0.9);
            b.draw(Ink.box(cx - 120, cy - 20, 230, 52, { seed: "b20b", weight: 4 }));
            b.draw(Ink.write("CLASSIFIED", { x: cx - 110, y: cy + 18, size: 30, seed: "b20c", tilt: -9, mess: 0.8 }).svg);
            const s = subject(b, { x: 60, y: 300, w: 100, rot: -5 });
            b.string(doc.at(0.5, 0.05), s.pinAt, BOLD);
        },
        // Obsessive: the same question, over and over, down the board.
        21(root, W, H) {
            const b = start(root, W, H);
            const s = subject(b, { x: 40, y: 150, w: 128, rot: -4 });
            const sizes = [14, 17, 20, 24, 29, 35];
            let y = 70;
            sizes.forEach((sz, i) => {
                y += sz * 1.55;
                b.draw(Ink.write("WHERE ARE YOU", { x: 188 - i * 4, y, size: sz * 0.62, seed: `b21${i}`, tilt: -2 - i * 1.4, score: i / 5, maxWidth: 160 }).svg);
            });
            b.draw(Ink.write("WHERE", { x: 60, y: 432, size: 44, seed: "b21w", tilt: -5, importance: "vibe" }).svg);
            void s;
        },
        // Everything, balanced: map, card, photo, post-it.
        22(root, W, H) {
            const b = start(root, W, H);
            const sc = SC();
            const m = scrap(b, { x: 48, y: 150, w: 280, h: 200, rot: 1.5, center: centroid(sc.region), zoom: 16.2, region: sc.region });
            const c = card(b, { x: 34, y: 34, w: 148, rot: -5, q: Q.green, answer: sc.answered[3].answer });
            const ph = polaroid(b, { x: 214, y: 26, w: 118, rot: 5, scene: "sit", caption: "PLACE TO SIT" });
            const p = postit(b, { x: 206, y: 340, w: 110, rot: -5, text: "NORTH, NOT WITHIN 500 M", size: 15 });
            b.string(c.pinAt, m.pinAt, BOLD);
            b.string(ph.pinAt, m.pinR, BOLD);
            const hole = m.toBoard(HIDER);
            b.string(p.pinAt, hole, BOLD);
            b.pin(hole, { size: 6.5 });
            b.draw(Ink.write("HERE?", { x: 52, y: 420, size: 30, seed: "b22h", tilt: -6, importance: "vibe" }).svg);
        },
    };

    // Small scenes for the welcome screen: drawn at 250 x 160 and shown at 1.5x,
    // so borders, strokes and pins come out as heavy as the title's.
    const SCENE_W = 250;
    const SCENE_H = 160;
    Object.assign(BOARDS, {
        // A card and a photo, strung.
        w1(root, W, H, o) {
            const b = start(root, W, H, o);
            const sc = SC();
            const c = card(b, { x: 12, y: 14, w: 116, rot: -5, q: Q.ns, answer: sc.answered[0].answer, answerSize: 20 });
            const ph = polaroid(b, { x: 150, y: 8, w: 88, rot: 6, scene: "sit", caption: "PLACE TO SIT" });
            b.string(c.pinAt, ph.pinAt, { width: 2.6 });
        },
        // The map scrap and one card.
        w2(root, W, H, o) {
            const b = start(root, W, H, o);
            const sc = SC();
            const m = scrap(b, { x: 104, y: 14, w: 134, h: 128, rot: 3, center: turf.centroid(sc.region).geometry.coordinates, zoom: 15.9, region: sc.region });
            const c = card(b, { x: 10, y: 22, w: 112, rot: -5, q: Q.green, answer: sc.answered[3].answer, answerSize: 20 });
            b.string(c.pinAt, m.pinAt, { width: 2.6 });
        },
        // The subject and a post-it.
        w3(root, W, H, o) {
            const b = start(root, W, H, o);
            const s2 = subject(b, { x: 24, y: 10, w: 90, rot: -5 });
            const p = postit(b, { x: 140, y: 26, w: 90, rot: 5, text: "WHERE ARE YOU", size: 15 });
            b.string(s2.pinAt, p.pinAt, { width: 2.6 });
        },
        // B22 with the ransom note (X24): cut-out letters pinned to the board.
        23(root, W, H) {
            const b = start(root, W, H);
            const sc = SC();
            const m = scrap(b, { x: 48, y: 160, w: 280, h: 196, rot: 1.5, center: turf.centroid(sc.region).geometry.coordinates, zoom: 16.2, region: sc.region });
            const c = card(b, { x: 34, y: 34, w: 148, rot: -5, q: Q.green, answer: sc.answered[3].answer });
            const note = b.item(`<div style="position:relative;width:230px;height:118px;background:#fff;border:2px solid #000">${WildKit.ransom("WHERE", 14, 12, 30, "bn1")}${WildKit.ransom("ARE YOU", 34, 62, 30, "bn2")}</div>`, { x: 120, y: 344, w: 230, h: 118, rot: -4 });
            const pn = note.at(0.5, 0.06);
            b.pin(pn);
            b.string(c.pinAt, m.pinAt, BOLD);
            b.string(pn, m.toBoard(HIDER), BOLD);
            b.pin(m.toBoard(HIDER), { size: 6.5 });
            const ph = polaroid(b, { x: 214, y: 24, w: 116, rot: 5, scene: "sit", caption: "PLACE TO SIT" });
            b.string(ph.pinAt, m.pinR, BOLD);
        },
        // The redacted file (X07) as one piece of evidence: what she's admitted, the rest blacked out.
        24(root, W, H) {
            const b = start(root, W, H);
            const sc = SC();
            const bar = (n) => `<span style="display:inline-block;width:${n}px;height:13px;background:#000;vertical-align:-2px"></span>`;
            const m = scrap(b, { x: 150, y: 196, w: 196, h: 230, rot: 2.5, center: turf.centroid(sc.region).geometry.coordinates, zoom: 16.4, region: sc.region, pins4: false, pin: true });
            const doc = b.item(`<div style="border:2px solid #000;background:#fff;font:14px/1.9 ${FONT};padding:14px 16px">
                <div style="font-weight:700;letter-spacing:.14em;font-size:11px">SUBJECT: ${bar(70)}</div>
                <div>Last seen ${bar(96)}</div><div>North of ${bar(60)}</div><div>Not within ${bar(44)} m</div><div>Closest café ${bar(88)}</div><div>Hiding ${bar(120)}</div></div>`, { x: 28, y: 40, w: 220, rot: -3 });
            const dp = doc.at(0.5, 0.05);
            b.pin(dp);
            const [sx, sy] = doc.at(0.46, 0.93);
            b.draw(Ink.box(sx - 96, sy - 22, 196, 48, { seed: "b24b", weight: 4 }));
            b.draw(Ink.write("CLASSIFIED", { x: sx - 86, y: sy + 14, size: 26, seed: "b24c", tilt: -8, mess: 0.8 }).svg);
            b.string(dp, m.pinAt, BOLD);
        },
    });

    for (const [n, f] of Object.entries(BOARDS)) {
        Board.extra[n] = async (root, W = W0, H = H0, o) => {
            f(root, W, H, o);
            // make() collects the ink until done() lays it on top.
            current.done();
            await settle(root);
        };
    }
    void W0;
    void H0;
    Board.SCENE = { w: SCENE_W, h: SCENE_H };
})();
