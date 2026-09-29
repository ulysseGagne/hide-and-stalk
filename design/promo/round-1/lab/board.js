/* global Ink, Campus */

// The conspiracy boards (set B): what the stalker has pinned up so far.
//
// The board is meant to explain the game at a glance: the pinned "evidence" is
// real question cards from the deck, answered in red (truthfully, for a real
// hider position, see campus.js), photo answers as polaroids, and the campus
// plan with everything ruled out hatched away. Red string ties it together.
//
// Polaroids are drawn in code as stand-ins until real photos land in the repo.

(function () {
    const FONT = "Arimo, 'Helvetica Neue', Helvetica, Arial, sans-serif";
    const RED = Ink.RED;

    function make(root, W, H, o = {}) {
        const dark = o.surface === "black";
        root.style.background = dark ? "#000" : "#fff";
        root.innerHTML = "";
        const under = el("div", { style: `position:absolute;inset:0` });
        root.appendChild(under);
        if (o.surface === "grid") under.innerHTML = gridSvg(W, H);
        if (o.surface === "dots") under.innerHTML = dotsSvg(W, H);
        const items = el("div", { style: "position:absolute;inset:0" });
        root.appendChild(items);
        const top = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        top.setAttribute("width", W);
        top.setAttribute("height", H);
        top.style.cssText = "position:absolute;inset:0;overflow:visible;pointer-events:none;z-index:50";
        root.appendChild(top);
        let topMarkup = "";
        const later = [];
        const api = {
            W,
            H,
            dark,
            ink: dark ? "#fff" : "#000",
            paper: dark ? "#000" : "#fff",
            /** Place an HTML item; returns helpers to find points on it. */
            item(html, { x, y, w, h, rot = 0, z = 1, style = "" }) {
                const d = el("div", { style: `position:absolute;left:${x}px;top:${y}px;width:${w}px;${h ? `height:${h}px;` : ""}transform:rotate(${rot}deg);transform-origin:center;z-index:${z};${style}` });
                d.innerHTML = html;
                items.appendChild(d);
                const hh = h ?? d.offsetHeight;
                const cx = x + w / 2;
                const cy = y + hh / 2;
                const a = (rot * Math.PI) / 180;
                /** A point given as fractions of the item's box, rotated with it. */
                const at = (fx, fy) => {
                    const px = x + w * fx - cx;
                    const py = y + hh * fy - cy;
                    return [cx + px * Math.cos(a) - py * Math.sin(a), cy + px * Math.sin(a) + py * Math.cos(a)];
                };
                return { at, h: hh, el: d };
            },
            pin(p, o2 = {}) {
                later.push(() => Ink.pin(p[0], p[1], { size: o2.size ?? 7.5, color: o2.color }));
                return p;
            },
            string(a, b, o2 = {}) {
                topMarkup += Ink.string(a[0], a[1], b[0], b[1], { width: o2.width ?? 1.8, sag: o2.sag });
            },
            draw(markup) {
                topMarkup += markup;
            },
            done() {
                top.innerHTML = topMarkup + later.map((f) => f()).join("");
            },
        };
        return api;
    }

    function el(tag, attrs) {
        const e = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
        return e;
    }

    function gridSvg(W, H) {
        let s = `<svg width="${W}" height="${H}">`;
        for (let x = 0; x < W; x += 18) s += `<line x1="${x}" y1="0" x2="${x}" y2="${H}" stroke="#000" stroke-width="0.4"/>`;
        for (let y = 0; y < H; y += 18) s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#000" stroke-width="0.4"/>`;
        return s + "</svg>";
    }

    /** "Cork" in 1 bit: a scatter of black specks, no grey anywhere. */
    function dotsSvg(W, H) {
        const r = Ink.rng("cork");
        let s = `<svg width="${W}" height="${H}">`;
        for (let i = 0; i < (W * H) / 60; i++) s += `<circle cx="${(r() * W).toFixed(1)}" cy="${(r() * H).toFixed(1)}" r="${(0.4 + r() * 0.9).toFixed(2)}" fill="#000"/>`;
        return s + "</svg>";
    }

    // -------------------------------------------------------------------
    // Pieces of evidence
    // -------------------------------------------------------------------
    /** An index card: the question typed, the answer scrawled in red. */
    function card(b, { x, y, w = 150, rot = 0, label, q, answer, seed, pin = "top", answerSize = 22, invert = false, z }) {
        const ink = invert ? "#fff" : "#000";
        const paper = invert ? "#000" : "#fff";
        const html = `<div style="background:${paper};color:${ink};border:2px solid ${ink};padding:9px 10px 38px;font-family:${FONT};">
            <div style="font-size:8.5px;font-weight:700;letter-spacing:.08em;">${label ?? ""}</div>
            <div style="font-size:13px;font-weight:700;line-height:1.18;margin-top:4px;letter-spacing:-.01em">${q}</div>
        </div>`;
        const it = b.item(html, { x, y, w, rot, z });
        if (answer) {
            const [ax, ay] = it.at(0.08, 0.9);
            b.draw(Ink.write(answer, { x: ax, y: ay, size: answerSize, seed: seed ?? answer, tilt: rot - 3, maxWidth: w * 0.86, mess: 0.5 }).svg);
        }
        const p = pin === "top" ? it.at(0.5, 0.06) : pin === "left" ? it.at(0.1, 0.1) : pin ? it.at(...pin) : null;
        if (p) b.pin(p);
        return { ...it, pinAt: p };
    }

    /** Polaroid with a code-drawn stand-in photo. */
    function polaroid(b, { x, y, w = 110, rot = 0, scene = "door", caption, seed, z }) {
        const ph = w - 14;
        const html = `<div style="background:#fff;border:2px solid #000;padding:7px 7px 30px;box-sizing:border-box;width:${w}px">
            <svg width="${ph - 4}" height="${ph - 4}" viewBox="0 0 100 100" style="display:block;background:#000">${SCENES[scene](seed ?? scene)}</svg>
        </div>`;
        const it = b.item(html, { x, y, w, rot, z });
        if (caption) {
            const [cx, cy] = it.at(0.08, 0.94);
            b.draw(Ink.write(caption, { x: cx, y: cy, size: 11, weight: 2.1, seed: caption, tilt: rot - 2, maxWidth: w * 0.85, color: "#000", mess: 0.4 }).svg);
        }
        const p = it.at(0.5, 0.05);
        b.pin(p);
        return { ...it, pinAt: p };
    }

    /** A sticky note: white with a black edge, or coloured-in red. */
    function sticky(b, { x, y, w = 96, rot = 0, text, red = false, seed, size = 15 }) {
        // A red note is coloured in by hand, never a flat red square.
        const fill = red ? `<svg width="${w}" height="${w}" style="position:absolute;inset:0;overflow:visible">${Ink.scribbleFill(0, 0, w, w, { seed: `st${text}`, weight: 12, gap: 9, overshoot: 3, misses: 0.04 })}</svg>` : "";
        const html = `<div style="position:relative;width:${w}px;height:${w}px;box-sizing:border-box;${red ? "" : `border:2px solid ${b.ink};background:${b.paper}`}">${fill}</div>`;
        const it = b.item(html, { x, y, w, h: w, rot });
        const [tx, ty] = it.at(0.1, 0.34);
        b.draw(Ink.note(text, { x: tx, y: ty, size, maxWidth: w * 0.78, seed: seed ?? text, color: red ? "#000" : RED, weight: size * 0.15, tilt: rot, mess: 0.6 }).svg);
        return it;
    }

    /** A torn-off piece of the campus plan. */
    function mapScrap(b, { x, y, w, h, rot = 0, scenario, hatch = "red", zoom = 1, center, labels = true, invert = false, z = 0, stops = false, marks }) {
        const sc = scenario ? Campus.scenario(scenario) : null;
        const m = Campus.map(w - 4, h - 4, { scenario: sc, hatch, zoom, center, labels, invert, stops, pad: 8 });
        const html = `<div style="border:2px solid ${invert ? "#fff" : "#000"};background:${invert ? "#000" : "#fff"};width:${w}px;height:${h}px;box-sizing:border-box"><svg width="${w - 4}" height="${h - 4}">${m.svg}</svg></div>`;
        const it = b.item(html, { x, y, w, h, rot, z });
        // Local map coords -> board coords.
        const toBoard = (lngLat) => {
            const [mx, my] = m.P(lngLat);
            return it.at((mx + 2) / w, (my + 2) / h);
        };
        if (marks) marks(toBoard, sc);
        return { ...it, toBoard, scenario: sc };
    }

    /** The subject: a hider silhouette with the face scratched out. */
    function subject(b, { x, y, w = 104, rot = 0, name = "HIDER", seed = "subj" }) {
        const html = `<div style="background:#fff;border:2px solid #000;padding:6px;font-family:${FONT}">
            <svg width="${w - 16}" height="${w - 4}" viewBox="0 0 100 112" style="display:block">${SCENES.figure(seed, true)}</svg>
            <div style="font-size:11px;font-weight:700;letter-spacing:.1em;margin-top:5px">${name}</div>
        </div>`;
        const it = b.item(html, { x, y, w, rot });
        const [fx, fy] = it.at(0.5, 0.3);
        b.draw(Ink.scribbleOut(fx - 16, fy - 12, 32, 22, { seed: `${seed}f`, passes: 3, weight: 4 }));
        b.draw(Ink.write("?", { x: it.at(0.78, 0.94)[0], y: it.at(0.78, 0.94)[1], size: 26, seed: `${seed}q` }).svg);
        const p = it.at(0.5, 0.04);
        b.pin(p);
        return { ...it, pinAt: p };
    }

    function typed(b, { x, y, text, size = 10, rot = 0, invert = false }) {
        return b.item(`<div style="display:inline-block;background:${invert ? "#fff" : "#000"};color:${invert ? "#000" : "#fff"};font:700 ${size}px ${FONT};letter-spacing:.12em;padding:3px 6px">${text}</div>`, { x, y, w: 220, rot });
    }

    // -------------------------------------------------------------------
    // Stand-in photos (100 x 100, white line art on black)
    // -------------------------------------------------------------------
    const W1 = (pts, s, seed) => Ink.pathEl(Ink.spline(pts, 5), { size: s, color: "#fff", thinning: 0.1, simulatePressure: false, seed });
    const SCENES = {
        door(seed) {
            const r = Ink.rng(seed);
            return (
                `<rect x="30" y="16" width="40" height="84" fill="none" stroke="#fff" stroke-width="3"/>` +
                `<rect x="36" y="24" width="28" height="30" fill="none" stroke="#fff" stroke-width="1.5"/>` +
                `<circle cx="62" cy="62" r="3" fill="#fff"/>` +
                `<rect x="38" y="6" width="24" height="7" fill="#fff"/>` +
                W1([[0, 100], [30, 99]], 2, r())
            );
        },
        tree(seed) {
            const r = Ink.rng(seed);
            let s = W1([[50, 100], [49, 70], [52, 50]], 7, 1) + W1([[50, 70], [34, 52]], 3, 2) + W1([[51, 62], [68, 46]], 3, 3);
            for (let i = 0; i < 26; i++) {
                const a = r() * Math.PI * 2;
                const d = r() * 26;
                s += `<circle cx="${50 + Math.cos(a) * d}" cy="${36 + Math.sin(a) * d * 0.8}" r="${4 + r() * 6}" fill="none" stroke="#fff" stroke-width="1.6"/>`;
            }
            return s;
        },
        figure(seed, onWhite = false) {
            const c = onWhite ? "#000" : "#fff";
            return `<g fill="${c}"><ellipse cx="50" cy="30" rx="15" ry="18"/><path d="M18 112 C20 74 32 56 50 56 C68 56 80 74 82 112 Z"/></g>`;
        },
        sky(seed) {
            // Looking straight up between two buildings.
            return `<rect width="100" height="100" fill="#fff"/><path d="M0 0 L38 30 L40 100 L0 100 Z" fill="#000"/><path d="M100 0 L64 26 L60 100 L100 100 Z" fill="#000"/>` + [34, 50, 66, 82].map((y) => `<line x1="${y / 3}" y1="${y}" x2="38" y2="${y - 4}" stroke="#fff" stroke-width="1"/>`).join("");
        },
        window(seed) {
            return `<rect x="16" y="14" width="68" height="72" fill="none" stroke="#fff" stroke-width="3"/><line x1="50" y1="14" x2="50" y2="86" stroke="#fff" stroke-width="2.5"/><line x1="16" y1="50" x2="84" y2="50" stroke="#fff" stroke-width="2.5"/>` + W1([[22, 80], [44, 56]], 1.2, 1) + W1([[56, 44], [78, 22]], 1.2, 2);
        },
        bench(seed) {
            return W1([[10, 62], [90, 60]], 4, 1) + W1([[12, 50], [88, 48]], 4, 2) + W1([[20, 62], [18, 84]], 3, 3) + W1([[80, 61], [82, 84]], 3, 4) + W1([[0, 88], [100, 90]], 1.5, 5);
        },
    };

    // -------------------------------------------------------------------
    // The twelve boards
    // -------------------------------------------------------------------
    const Q = {
        ns: "Are you north or south of me?",
        r500: "Are you within 500 m of me?",
        r300: "Are you within 300 m of me?",
        cafe: "Which café on campus are you closest to?",
        green: "Are you closer to the greenhouses than I am?",
        door: "Send a photo of the nearest door.",
        floor: "What floor are you on?",
        io: "Are you inside or outside?",
        ew: "Are you east or west of me?",
    };
    // The greenhouses game, answered for real.
    const G = () => Campus.scenario("greenhouses");
    const cafeName = (sc) => sc.answered.find((a) => a.nearest).answer.replace(/\s*\(.*\)$/, "").toUpperCase();

    const BOARDS = {
        // 1. Minimal: two cards, one string.
        1(root, W, H) {
            const b = make(root, W, H);
            const sc = G();
            const a = card(b, { x: 34, y: 60, w: 150, rot: -4, label: "Q1 · 13:10", q: Q.ns, answer: sc.answered[0].answer });
            const c = card(b, { x: 196, y: 180, w: 150, rot: 3, label: "Q2 · 13:15", q: Q.r500, answer: sc.answered[1].answer });
            b.string(a.pinAt, c.pinAt);
            b.done();
        },
        // 2. The chain: every question so far, strung in order.
        2(root, W, H) {
            const b = make(root, W, H);
            const sc = G();
            const cs = [
                card(b, { x: 16, y: 22, w: 138, rot: -5, label: "Q1 · 13:10", q: Q.ns, answer: sc.answered[0].answer }),
                card(b, { x: 214, y: 40, w: 140, rot: 4, label: "Q2 · 13:15", q: Q.r500, answer: sc.answered[1].answer }),
                card(b, { x: 28, y: 214, w: 150, rot: 3, label: "Q3 · 13:20", q: Q.cafe, answer: cafeName(sc), answerSize: 17 }),
                card(b, { x: 206, y: 250, w: 146, rot: -3, label: "Q4 · 13:25", q: Q.green, answer: sc.answered[3].answer }),
            ];
            for (let i = 0; i < cs.length - 1; i++) b.string(cs[i].pinAt, cs[i + 1].pinAt);
            b.done();
        },
        // 3. The map in the middle, everything strung to the spot.
        3(root, W, H) {
            const b = make(root, W, H);
            let target;
            const m = mapScrap(b, { x: 60, y: 96, w: 250, h: 200, rot: -2, scenario: "greenhouses", marks: (to) => (target = to([-71.2789, 46.7806])) });
            const a = card(b, { x: 8, y: 14, w: 128, rot: -6, label: "Q1", q: Q.ns, answer: m.scenario.answered[0].answer, answerSize: 18 });
            const c = card(b, { x: 236, y: 10, w: 128, rot: 5, label: "Q3", q: Q.cafe, answer: cafeName(m.scenario), answerSize: 14 });
            const p = polaroid(b, { x: 250, y: 280, w: 104, rot: 6, scene: "door", caption: "Q5 NEAREST DOOR" });
            b.pin(target, { size: 6 });
            for (const it of [a, c, p]) b.string(it.pinAt, target);
            b.draw(Ink.circle(target[0], target[1], 22, 17, { seed: "b3c", weight: 3.5 }));
            b.draw(Ink.write("HERE?", { x: 30, y: 350, size: 30, seed: "b3h", tilt: -6 }).svg);
            b.done();
        },
        // 4. Full chaos.
        4(root, W, H) {
            const b = make(root, W, H, { surface: "dots" });
            let target;
            const m = mapScrap(b, { x: 92, y: 110, w: 200, h: 160, rot: 3, scenario: "greenhouses", zoom: 1.1, marks: (to) => (target = to([-71.2789, 46.7806])) });
            const it = [
                card(b, { x: 4, y: 8, w: 120, rot: -8, label: "Q1", q: Q.ns, answer: m.scenario.answered[0].answer, answerSize: 17 }),
                card(b, { x: 128, y: 0, w: 116, rot: 4, label: "Q2", q: Q.r500, answer: m.scenario.answered[1].answer, answerSize: 17 }),
                card(b, { x: 250, y: 22, w: 118, rot: -3, label: "Q3", q: Q.cafe, answer: cafeName(m.scenario), answerSize: 12 }),
                polaroid(b, { x: 0, y: 188, w: 96, rot: -7, scene: "tree", caption: "BIGGEST TREE" }),
                polaroid(b, { x: 282, y: 184, w: 90, rot: 8, scene: "door", caption: "DOOR" }),
                card(b, { x: 20, y: 330, w: 130, rot: 4, label: "Q4", q: Q.green, answer: m.scenario.answered[3].answer, answerSize: 16 }),
                polaroid(b, { x: 250, y: 300, w: 96, rot: -4, scene: "window", caption: "WINDOW" }),
            ];
            sticky(b, { x: 162, y: 318, w: 82, rot: 6, text: "NOT INSIDE??", red: true, size: 13 });
            b.pin(target);
            for (const x of it) b.string(x.pinAt, target);
            b.string(it[0].pinAt, it[5].pinAt);
            b.string(it[3].pinAt, it[1].pinAt);
            b.draw(Ink.circle(target[0], target[1], 20, 15, { seed: "b4c", weight: 3.5 }) + Ink.circle(target[0], target[1], 28, 22, { seed: "b4d", weight: 2.5 }));
            b.draw(Ink.arrow(200, 300, target[0] + 8, target[1] + 16, { seed: "b4a" }));
            b.done();
        },
        // 5. Black board, white paper, red string.
        5(root, W, H) {
            const b = make(root, W, H, { surface: "black" });
            const sc = G();
            const cs = [
                card(b, { x: 22, y: 30, w: 140, rot: -4, label: "Q1 · 13:10", q: Q.ns, answer: sc.answered[0].answer }),
                polaroid(b, { x: 222, y: 20, w: 118, rot: 5, scene: "door", caption: "THE NEAREST DOOR" }),
                card(b, { x: 60, y: 226, w: 150, rot: 3, label: "Q3 · 13:20", q: Q.cafe, answer: cafeName(sc), answerSize: 17 }),
                subject(b, { x: 244, y: 232, w: 104, rot: -5 }),
            ];
            b.string(cs[0].pinAt, cs[1].pinAt);
            b.string(cs[0].pinAt, cs[2].pinAt);
            b.string(cs[1].pinAt, cs[3].pinAt);
            b.string(cs[2].pinAt, cs[3].pinAt);
            b.done();
        },
        // 6. Photos only: the hider's answers, and a subject with no face.
        6(root, W, H) {
            const b = make(root, W, H);
            const s = subject(b, { x: 136, y: 150, w: 104, rot: 2 });
            const ps = [
                polaroid(b, { x: 12, y: 20, w: 112, rot: -6, scene: "door", caption: "NEAREST DOOR" }),
                polaroid(b, { x: 252, y: 16, w: 110, rot: 5, scene: "sky", caption: "WHAT'S ABOVE YOU" }),
                polaroid(b, { x: 10, y: 262, w: 108, rot: 4, scene: "tree", caption: "BIGGEST TREE" }),
                polaroid(b, { x: 256, y: 270, w: 106, rot: -5, scene: "bench", caption: "PLACE TO SIT" }),
            ];
            for (const p of ps) b.string(p.pinAt, s.pinAt);
            b.draw(Ink.write("WHERE ARE YOU", { x: 128, y: 150 - 20, size: 17, seed: "b6w", tilt: -3 }).svg);
            b.done();
        },
        // 7. The elimination, big: the campus with most of it crossed out.
        7(root, W, H) {
            const b = make(root, W, H);
            let target;
            mapScrap(b, { x: 10, y: 20, w: 355, h: 300, rot: -1.5, scenario: "greenhouses", marks: (to) => (target = to([-71.2789, 46.7806])) });
            b.draw(Ink.circle(target[0], target[1], 34, 26, { seed: "b7c", weight: 4 }));
            b.draw(Ink.write("SHE'S IN HERE", { x: 150, y: 372, size: 26, seed: "b7h", tilt: -4 }).svg);
            b.draw(Ink.arrow(200, 348, target[0] + 26, target[1] + 22, { seed: "b7a", bend: 0.2 }));
            b.pin([30, 34]);
            b.pin([348, 30]);
            b.done();
        },
        // 8. A timeline: one question every 5 minutes, strung left to right.
        8(root, W, H) {
            const b = make(root, W, H);
            const sc = G();
            const y0 = 70;
            const rows = [
                ["13:10", Q.ns, sc.answered[0].answer],
                ["13:15", Q.r500, sc.answered[1].answer],
                ["13:20", Q.cafe, cafeName(sc)],
                ["13:25", Q.green, sc.answered[3].answer],
            ];
            const pins = [];
            rows.forEach(([t, q, a], i) => {
                const c = card(b, { x: 10 + (i % 2) * 180, y: y0 + Math.floor(i / 2) * 170 + (i % 2) * 22, w: 168, rot: i % 2 ? 2.5 : -2.5, label: `Q${i + 1} · ${t}`, q, answer: a, answerSize: a.length > 8 ? 15 : 20 });
                pins.push(c.pinAt);
            });
            for (let i = 0; i < pins.length - 1; i++) b.string(pins[i], pins[i + 1]);
            b.draw(Ink.write("EVERY 5 MIN", { x: 18, y: 40, size: 20, seed: "b8t", tilt: -2, color: "#000", weight: 3 }).svg);
            b.draw(Ink.write("Q5 · 13:30 ?", { x: 196, y: 424, size: 22, seed: "b8n", tilt: -5 }).svg);
            b.done();
        },
        // 9. Sticky notes only: the stalker's conclusions.
        9(root, W, H) {
            const b = make(root, W, H);
            const notes = [
                [24, 30, -6, "NORTH OF POLLACK", false],
                [230, 22, 5, "NOT WITHIN 500 M", true],
                [128, 150, 2, "NOT THE STADIUM", false],
                [16, 272, 4, "P\u2019TIT CAAF???", true],
                [244, 266, -5, "SHE'S OUTSIDE", false],
            ];
            const pins = notes.map(([x, y, rot, text, red]) => {
                const it = sticky(b, { x, y, w: 108, rot, text, red, size: 16 });
                return b.pin(it.at(0.5, 0.08));
            });
            b.string(pins[0], pins[2]);
            b.string(pins[1], pins[2]);
            b.string(pins[2], pins[3]);
            b.string(pins[2], pins[4]);
            b.done();
        },
        // 10. The dossier: subject file with a stamp.
        10(root, W, H) {
            const b = make(root, W, H);
            const it = b.item(
                `<div style="border:2px solid #000;background:#fff;font-family:${FONT};padding:14px 16px;height:100%;box-sizing:border-box">
                    <div style="font-size:10px;font-weight:700;letter-spacing:.14em">FILE Nº 005 · TEAM 3</div>
                    <div style="font-size:26px;font-weight:700;letter-spacing:-.02em;margin-top:6px">SUBJECT: HIDER</div>
                    <div style="height:2px;background:#000;margin:10px 0"></div>
                    <div style="font-size:12px;line-height:1.9">
                        LAST SEEN &nbsp;<b>13:00, POLLACK</b><br>
                        HEADING &nbsp;<b>UNKNOWN</b><br>
                        MOVES &nbsp;<b>WALKS, NEVER RUNS</b><br>
                        QUESTIONS LEFT &nbsp;<b>2 OF 6</b>
                    </div>
                </div>`,
                { x: 22, y: 30, w: 330, h: 230, rot: -1.5 },
            );
            const [sx, sy] = it.at(0.74, 0.24);
            b.draw(Ink.box(sx - 64, sy - 20, 118, 44, { seed: "b10b", weight: 3.5 }));
            b.draw(Ink.write("WANTED", { x: sx - 56, y: sy + 13, size: 26, seed: "b10w", tilt: -8 }).svg);
            b.draw(Ink.underline(it.at(0.36, 0.62)[0], it.at(0.36, 0.62)[1] + 4, 110, { seed: "b10u", weight: 3 }));
            polaroid(b, { x: 40, y: 250, w: 110, rot: -6, scene: "window", caption: "FROM INSIDE?" });
            const s = subject(b, { x: 220, y: 256, w: 100, rot: 5 });
            void s;
            b.pin(it.at(0.5, 0.04));
            b.done();
        },
        // 11. Graph paper, measured: circles drawn with a compass, a ruler line.
        11(root, W, H) {
            const b = make(root, W, H, { surface: "grid" });
            let asker;
            let target;
            const m = mapScrap(b, {
                x: 20,
                y: 34,
                w: 335,
                h: 270,
                rot: 0,
                marks: (to) => {
                    asker = to(Campus.at("building", "pav_pol"));
                    target = to([-71.2789, 46.7806]);
                },
            });
            void m;
            const [ax, ay] = asker;
            const r500 = Math.abs(asker[0] - m.toBoard([Campus.at("building", "pav_pol")[0] + 500 / (111320 * Math.cos((46.78 * Math.PI) / 180)), Campus.at("building", "pav_pol")[1]])[0]);
            b.draw(Ink.circle(ax, ay, r500, r500, { seed: "b11r", weight: 3, turns: 1.02, tilt: 0 }));
            b.draw(Ink.wobble([[0, ay], [W, ay + 2]], { seed: "b11l", weight: 2.5, amp: 1 }));
            b.draw(Ink.write("500 M", { x: ax + r500 * 0.72, y: ay - r500 * 0.72, size: 16, seed: "b11m", tilt: -30 }).svg);
            b.draw(Ink.write("N ↑  S ↓", { x: 26, y: ay - 8, size: 13, seed: "b11n", weight: 2.4 }).svg);
            b.draw(Ink.cross(target[0], target[1], 9, { seed: "b11x", weight: 3.5 }));
            b.draw(Ink.write("?", { x: target[0] + 12, y: target[1] + 4, size: 20, seed: "b11q" }).svg);
            b.pin([ax, ay], { size: 6 });
            b.draw(Ink.write("ME", { x: ax + 8, y: ay - 8, size: 13, seed: "b11me", weight: 2.4, color: "#000" }).svg);
            b.draw(Ink.write("NORTH, NOT WITHIN 500 M", { x: 26, y: 350, size: 19, seed: "b11s", tilt: -2, maxWidth: 320 }).svg);
            b.done();
        },
        // 12. Redacted: the file with everything but the answers blacked out.
        12(root, W, H) {
            const b = make(root, W, H);
            const sc = G();
            let target;
            mapScrap(b, { x: 150, y: 176, w: 210, h: 170, rot: 3, scenario: "greenhouses", hatch: "redact", marks: (to) => (target = to([-71.2789, 46.7806])) });
            const doc = b.item(
                `<div style="border:2px solid #000;background:#fff;font:12px/1.9 ${FONT};padding:12px 14px">
                    <div style="font-weight:700;letter-spacing:.14em;font-size:10px">QUESTIONS SO FAR</div>
                    <div>Q1 North or south? <b>${sc.answered[0].answer}</b></div>
                    <div>Q2 Within 500 m? <b>${sc.answered[1].answer}</b></div>
                    <div>Q3 Closest café? <b>${cafeName(sc)}</b></div>
                    <div>Q4 Closer to the greenhouses? <b>${sc.answered[3].answer}</b></div>
                    <div>Q5 <span style="background:#000;color:#000">████████████</span></div>
                </div>`,
                { x: 14, y: 22, w: 250, rot: -2 },
            );
            b.pin(doc.at(0.5, 0.04));
            b.draw(Ink.circle(target[0], target[1], 20, 16, { seed: "b12c", weight: 3.5 }));
            typed(b, { x: 22, y: 360, text: "CLASSIFIED · TEAM 3", size: 11, rot: -2 });
            b.done();
        },
    };

    window.Board = {
        count: Object.keys(BOARDS).length,
        draw(root, v, W, H) {
            BOARDS[v](root, W, H);
        },
        make,
        card,
        polaroid,
        sticky,
        mapScrap,
        subject,
    };
})();
