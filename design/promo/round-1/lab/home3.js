/* global Ink, Logo, Board, WildKit, turf */

// Home screens and boards, third pass (W31-W41, B25-B28, C01-C12), from the
// notes on B13-B24 and W25-W30 (and the fourth home pass, W42-W47, at the end
// of the home screens):
//
//  - the board is one composition made of the pieces that worked: question
//    cards, Polaroids, white post-its, the hider's profile, the file (file
//    number, SUBJECT, classified bars), the cut-out ransom note, the map;
//  - everything is drawn at screen size: one 3px line weight, no scaling;
//  - red string never crosses a card, a photo, red writing or another
//    string: pins sit near the corners that face each other, and the string
//    runs through the gap. Every string is checked; a crossing is logged;
//  - pins are always on top and nothing covers another item's pin; items
//    never overlap;
//  - words go on post-its, never loose on the board;
//  - the stalker's point of view throughout (the poster is the seeker's);
//  - the map is a placeholder (plain xerox, nothing coloured in) until the
//    skin is picked;
//  - home screen: the title, two pinned items, the button; the items sit
//    halfway between STALK and the button.

(function () {
    const FONT = "Arimo, 'Helvetica Neue', Helvetica, Arial, sans-serif";
    const LW = 3; // the one line weight
    const K = () => Board.kit2;
    const warn = (m) => (window.__warn = [...(window.__warn ?? []), m]);

    // -----------------------------------------------------------------
    // Measuring
    // -----------------------------------------------------------------
    const cv = document.createElement("canvas").getContext("2d");
    const textW = (s, size, weight = 700, family = FONT) => {
        cv.font = `${weight} 100px ${family}`;
        return (cv.measureText(s).width * size) / 100;
    };
    /** The biggest size (<= max) at which every line fits `width`. */
    const fitSize = (lines, width, max, weight = 700) => Math.min(max, ...lines.map((l) => width / textW(l, 1, weight)));

    /** Handwriting sized so its natural width fits `width` (no curl). */
    function fitWrite(text, width, max, o) {
        let size = max;
        for (; size > 9; size -= 1) if (Ink.write(text, { ...o, size, x: 0, y: 0 }).width <= width) break;
        return size;
    }

    // -----------------------------------------------------------------
    // A surface: items, pins and strings, validated
    // -----------------------------------------------------------------
    function surface(host, W, H) {
        const b = Board.make(host, W, H);
        host.insertAdjacentHTML("afterbegin", K().filters);
        const items = [];
        const strings = [];
        const avoid = []; // what's not a piece but must stay clear: the title
        const reds = []; // red marks inside items: [x, y, r]
        const s = {
            b,
            W,
            H,
            items,
            avoid,
            add(html, { x, y, w, h, rot = 0 }) {
                const it = b.item(html, { x, y, w, h, rot });
                const poly = [it.at(0, 0), it.at(1, 0), it.at(1, 1), it.at(0, 1)];
                const item = { ...it, w, x, y, rot, poly, pins: [] };
                items.push(item);
                return item;
            },
            pin(item, fx, fy) {
                const p = item.at(fx, fy);
                item.pins.push(p);
                b.pin(p, { size: 8 });
                return p;
            },
            link(p, q, o = {}) {
                strings.push({ p, q, pts: sample(p, q, o.sag) });
                b.string(p, q, { width: 2.6, sag: o.sag });
            },
            red(x, y, r) {
                reds.push([x, y, r]);
            },
            done() {
                check(items, strings, W, H, avoid);
                b.done();
            },
        };
        return s;
    }

    // Same curve as Ink.string (before its wobble), for checking.
    function sample(p, q, sag0) {
        const len = Math.hypot(q[0] - p[0], q[1] - p[1]);
        const sag = sag0 ?? Math.min(18, len * 0.05);
        const m = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2 + sag];
        const pts = [];
        for (let i = 0; i <= 40; i++) {
            const t = i / 40;
            pts.push([(1 - t) * (1 - t) * p[0] + 2 * (1 - t) * t * m[0] + t * t * q[0], (1 - t) * (1 - t) * p[1] + 2 * (1 - t) * t * m[1] + t * t * q[1]]);
        }
        return pts;
    }
    const inside = (poly, [x, y], pad = 0) => {
        // Rotated rectangle: test against the edges, grown by pad.
        for (let i = 0; i < 4; i++) {
            const [ax, ay] = poly[i];
            const [bx, by] = poly[(i + 1) % 4];
            const l = Math.hypot(bx - ax, by - ay);
            if (((bx - ax) * (y - ay) - (by - ay) * (x - ax)) / l < -pad) return false;
        }
        return true;
    };
    function check(items, strings, W, H, avoid = []) {
        const near = (a, b, d) => Math.hypot(a[0] - b[0], a[1] - b[1]) < d;
        for (const [i, st] of strings.entries()) {
            for (const pt of st.pts) {
                if (avoid.some((q) => inside(q, pt, 2))) return warn(`string ${i} crosses the title`);
                if (near(pt, st.p, 24) || near(pt, st.q, 24)) continue;
                for (const [j, it] of items.entries()) if (inside(it.poly, pt, 2)) return warn(`string ${i} crosses item ${j}`);
            }
            for (const [k, o] of strings.entries()) {
                if (k <= i) continue;
                for (const a of st.pts) for (const c of o.pts) if (near(a, c, 5) && !near(a, st.p, 12) && !near(a, st.q, 12)) return warn(`strings ${i} and ${k} touch`);
            }
        }
        for (const [i, a] of items.entries()) {
            for (const [j, c] of items.entries()) if (j > i && (a.poly.some((p) => inside(c.poly, p, 4)) || c.poly.some((p) => inside(a.poly, p, 4)))) warn(`items ${i} and ${j} overlap`);
            if (avoid.some((q) => a.poly.some((p) => inside(q, p, 4)) || q.some((p) => inside(a.poly, p, 4)))) warn(`item ${i} overlaps the title`);
            if (a.poly.some(([x, y]) => x < 20 || y < 6 || x > W - 20 || y > H - 6)) warn(`item ${i} is off the edge`);
        }
    }

    // -----------------------------------------------------------------
    // The pieces
    // -----------------------------------------------------------------
    const BOX = `box-sizing:border-box;border:${LW}px solid #000;background:#fff`;

    /** A question card: the question typed to fill the card, the answer by hand. */
    function card(s, { x, y, w = 164, rot = 0, q, answer, seed, square }) {
        const pad = 13;
        const inner = w - pad * 2 - LW * 2;
        const fs = fitSize(q, inner, 19);
        const ansSize = fitWrite(answer, inner, 30, { seed: seed ?? answer, importance: "key" });
        const h = square ? w : LW * 2 + pad + q.length * fs * 1.16 + 12 + ansSize * 1.05 + pad + 4;
        const html = `<div style="${BOX};width:${w}px;height:${h}px;padding:${pad}px;font:700 ${fs}px/1.16 ${FONT};letter-spacing:0;white-space:nowrap">${q.join("<br>")}</div>`;
        const it = s.add(html, { x, y, w, h, rot });
        // On a square card the answer sits higher: halfway between the question and the bottom.
        const qb = LW + pad + q.length * fs * 1.16;
        const base = square ? (qb + 10 + ansSize + (h - pad - 6)) / 2 : h - pad - 6;
        const [ax, ay] = it.at((LW + pad) / w, base / h);
        s.b.draw(Ink.write(answer, { x: ax, y: ay, size: ansSize, seed: seed ?? answer, tilt: rot - 2, importance: "key" }).svg);
        return it;
    }

    /**
     * A Polaroid: the photo (drawn by hand, white on black), the caption by hand.
     * ink: the caption's colour (red by default); a caption with "\n" is two lines.
     */
    function photo(s, { x, y, w = 140, rot = 0, scene = "sit", caption, ink, bold = 1 }) {
        const m = 9;
        const ph = w - m * 2 - LW * 2;
        const lines = caption ? caption.split("\n") : [];
        const capH = lines.length > 1 ? 50 : caption ? 40 : 22;
        const h = LW * 2 + m + ph + capH;
        const html = `<div style="${BOX};width:${w}px;height:${h}px;padding:${m}px ${m}px 0"><svg width="${ph}" height="${ph}" viewBox="0 0 100 100" style="display:block;background:#000">${K().photo(scene, "#fff")}</svg></div>`;
        const it = s.add(html, { x, y, w, h, rot });
        if (lines.length === 1) {
            const size = fitWrite(caption, ph * 0.94, 17, { seed: caption, importance: "aside" });
            const [cx, cy] = it.at((LW + m + 2) / w, (h - 12) / h);
            s.b.draw(Ink.write(caption, { x: cx, y: cy, size, seed: caption, tilt: rot - 1.5, importance: "aside", color: ink }).svg);
        } else if (lines.length) {
            const size = Math.min(...lines.map((l) => fitWrite(l, ph * 0.94, 15, { seed: l, importance: "aside" })));
            lines.forEach((l, i) => {
                const [cx, cy] = it.at((LW + m + 2) / w, (h - 30 + i * (size + 5)) / h);
                s.b.draw(Ink.write(l, { x: cx, y: cy, size, seed: l, tilt: rot - 1.5, importance: "aside", color: ink, weight: size * 0.16 * bold }).svg);
            });
        }
        return it;
    }

    /** A white post-it with the stalker's thought on it. */
    function postit(s, { x, y, w = 118, rot = 0, text, size = 20, lines }) {
        const it = s.add(`<div style="${BOX};width:${w}px;height:${w}px"></div>`, { x, y, w, h: w, rot });
        if (text && text.length <= 2) {
            // One mark, big, in the middle.
            const g = Ink.write(text, { x: 0, y: 0, size, seed: text, tilt: rot - 4, importance: "vibe" });
            const [cx, cy] = it.at(0.5, 0.5);
            s.b.draw(`<g transform="translate(${cx - g.width / 2} ${cy + size / 2})">${g.svg}</g>`);
        } else if (lines) {
            // Repeated, getting bigger: the obsessive one.
            let yy = 0.2;
            lines.forEach((l, i) => {
                const sz = size * (0.62 + i * 0.16);
                yy += (sz * 1.25) / w;
                const [tx, ty] = it.at(0.12 + i * 0.01, yy);
                s.b.draw(Ink.write(l, { x: tx, y: ty, size: sz, seed: `${l}${i}`, tilt: rot - 2 - i * 1.5, score: i / (lines.length - 1), maxWidth: w * 0.78 }).svg);
            });
        } else {
            // As big as fits: shrink until every line is inside the square.
            let sz = size;
            const o = { maxWidth: w * 0.74, seed: text, tilt: rot - 2, importance: "aside" };
            while (sz > 11 && Ink.note(text, { ...o, size: sz }).height > w * 0.72) sz -= 1;
            const [tx, ty] = it.at(0.13, (w * 0.16 + sz) / w);
            s.b.draw(Ink.note(text, { ...o, x: tx, y: ty, size: sz }).svg);
        }
        return it;
    }

    /** The hider's profile, as the app would print it: silhouette, name, team. */
    function profile(s, { x, y, w = 132, rot = 0, seed = `pf${x}` }) {
        const m = 10;
        const pw = w - m * 2 - LW * 2;
        const h = LW * 2 + m + pw * 1.06 + 44;
        const html = `<div style="${BOX};width:${w}px;height:${h}px;padding:${m}px;font-family:${FONT}">
            <svg width="${pw}" height="${pw * 1.06}" viewBox="0 0 100 106" style="display:block"><rect width="100" height="106" fill="#fff"/><g fill="#000"><ellipse cx="50" cy="36" rx="18" ry="21"/><path d="M12 106 C14 72 30 62 50 62 C70 62 86 72 88 106 Z"/></g></svg>
            <div style="font-size:15px;font-weight:700;letter-spacing:.1em;margin-top:8px">HIDER</div>
            <div style="font-size:11px;font-weight:700;letter-spacing:.12em">TEAM 3</div></div>`;
        const it = s.add(html, { x, y, w, h, rot });
        const [fx, fy] = it.at(0.5, (LW + m + pw * 0.34) / h);
        s.b.draw(Ink.roundScribble(fx - pw * 0.24, fy - pw * 0.16, pw * 0.48, pw * 0.3, { seed, passes: 3, weight: pw * 0.06 }));
        return it;
    }

    /** The file: typeset like a printout, what's not known yet blacked out. File Nº 005 is always HIDER LOCATION. */
    function file(s, { x, y, w = 170, rot = 0, rows }) {
        const bar = (n) => `<span style="display:inline-block;width:${n}px;height:11px;background:#000;vertical-align:-1px"></span>`;
        const body = rows.map(([k, v]) => `<div style="display:flex;justify-content:space-between;gap:8px;white-space:nowrap"><span>${k}</span><b>${typeof v === "number" ? bar(v) : v}</b></div>`).join("");
        const html = `<div style="${BOX};width:${w}px;padding:12px 13px 13px;font:12px/1.75 ${FONT}">
            <div style="font-size:10px;font-weight:700;letter-spacing:.14em">FILE Nº 005</div>
            <div class="subj" style="display:inline-block;font-size:${fitSize(["HIDER LOCATION"], w - 32, 22)}px;font-weight:700;letter-spacing:-.01em;line-height:1.2;margin-top:4px">HIDER LOCATION</div>
            <div style="height:${LW}px;background:#000;margin:8px 0 6px"></div>${body}</div>`;
        return s.add(html, { x, y, w, rot });
    }

    /**
     * B29's file: what's known so far, and its one red mark, 500 m underlined
     * by hand. Two lines: within 500 m and the closest café (where exactly is gone).
     */
    function file29(s, o) {
        const rows = [["Within <span class=\"u\">500 m</span>?", "NO"], ...ROWS.slice(2, 3)];
        const f = file(s, { ...o, rows });
        const u = f.el.querySelector(".u");
        let ox = 0;
        let oy = 0;
        for (let e = u; e && e !== f.el; e = e.offsetParent) {
            ox += e.offsetLeft;
            oy += e.offsetTop;
        }
        const [ux, uy] = f.at(ox / f.w, (oy + u.offsetHeight + 1) / f.h);
        const [vx] = f.at((ox + u.offsetWidth) / f.w, (oy + u.offsetHeight + 1) / f.h);
        s.b.draw(Ink.underline(ux - 3, uy, vx - ux + 6, { seed: "b29u", weight: 3.4 }));
        return f;
    }

    /**
     * The file, fifth pass: HIDER LOCATION. North or south answered by hand in
     * red, the way B29's card answers it (same hand); where exactly still
     * blacked out. stacked: the whole question on its own line, NORTH big
     * under it; otherwise "North or south?" with NORTH beside it.
     */
    function fileNS(s, { x, y, w = 184, rot = 0, stacked = true, only = false }) {
        const bar = (n) => `<span style="display:inline-block;width:${n}px;height:11px;background:#000;vertical-align:-1px"></span>`;
        // only: the one question, bigger and bold, NORTH bigger; where exactly is gone.
        const ns = only
            ? `<div style="font-size:15px;font-weight:700;line-height:1.3;margin-top:2px">Are you north or<br>south of me?</div><div class="hand" style="height:48px"></div>`
            : stacked
            ? `<div style="line-height:1.35;margin-top:2px">Are you north or<br>south of me?</div><div class="hand" style="height:44px"></div>`
            : `<div style="display:flex;justify-content:space-between;gap:8px;white-space:nowrap"><span>North or south?</span><span class="hand" style="display:inline-block;width:78px;height:21px"></span></div>`;
        const html = `<div style="${BOX};width:${w}px;padding:12px 13px 13px;font:12px/1.75 ${FONT}">
            <div style="font-size:10px;font-weight:700;letter-spacing:.14em">FILE Nº 005</div>
            <div style="display:inline-block;font-size:${fitSize(["HIDER LOCATION"], w - 32, 22)}px;font-weight:700;letter-spacing:-.01em;line-height:1.2;margin-top:4px">HIDER LOCATION</div>
            <div style="height:${LW}px;background:#000;margin:8px 0 6px"></div>${ns}
            ${only ? "" : `<div style="display:flex;justify-content:space-between;gap:8px;white-space:nowrap"><span>Where exactly?</span><b>${bar(56)}</b></div>`}</div>`;
        const f = s.add(html, { x, y, w, rot });
        const hand = f.el.querySelector(".hand");
        let ox = 0;
        let oy = 0;
        for (let e = hand; e && e !== f.el; e = e.offsetParent) {
            ox += e.offsetLeft;
            oy += e.offsetTop;
        }
        const size = only ? 34 : stacked ? 30 : 19;
        const [hx, hy] = f.at((ox + (stacked ? 2 : 4)) / f.w, (oy + hand.offsetHeight - (stacked ? 3 : 2)) / f.h);
        s.b.draw(Ink.write("NORTH", { x: hx, y: hy, size, seed: "NORTH", tilt: rot - 2, importance: "key" }).svg);
        return f;
    }

    /**
     * B29's north-or-south card, answered the way W53's file answers it: the
     * question in bold, NORTH big (W53's size, same seed) across the card.
     */
    function nsCard(s, { x, y, w = 178, rot = 0 }) {
        const pad = 13;
        const inner = w - pad * 2 - LW * 2;
        const size = fitWrite("NORTH", inner, 34, { seed: "NORTH", importance: "key" });
        const h = Math.round(LW * 2 + pad + 2 * 15 * 1.3 + 12 + size * 1.05 + pad);
        const html = `<div style="${BOX};width:${w}px;height:${h}px;padding:${pad}px;font:700 15px/1.3 ${FONT};white-space:nowrap">Are you north or<br>south of me?</div>`;
        const it = s.add(html, { x, y, w, h, rot });
        const [ax, ay] = it.at((LW + pad) / w, (h - pad - 5) / h);
        s.b.draw(Ink.write("NORTH", { x: ax, y: ay, size, seed: "NORTH", tilt: rot - 2, importance: "key" }).svg);
        return it;
    }

    // Cut-out letters, laid out in lines that stay inside the note.
    const CUTS = [
        ["#000", "#fff", FONT, 700],
        ["#fff", "#000", "Georgia, serif", 700],
        ["#fff", "#000", "'Courier New', monospace", 700],
        ["#000", "#fff", "Georgia, serif", 400],
        ["#fff", "#000", FONT, 400],
        ["#000", "#fff", "'Courier New', monospace", 700],
    ];
    function cutouts(text, { width, size, seed, alt }) {
        // Shrink until the longest word fits on a line of its own.
        for (let k = 0; k < 30; k++) {
            const c = cutoutsAt(text, { width, size, seed, alt });
            if (c.w <= width + 1) return c;
            size *= 0.94;
        }
        return cutoutsAt(text, { width, size, seed, alt });
    }
    function cutoutsAt(text, { width, size, seed, alt }) {
        const r = Ink.rng(seed ?? text);
        // alt: black and white letters take turns, never two of a kind side by side.
        const DARK = CUTS.filter((c) => c[0] === "#000");
        const LIGHT = CUTS.filter((c) => c[0] === "#fff");
        let n = r() < 0.5 ? 0 : 1;
        const words = text.split(" ").map((wd) =>
            [...wd].map((ch) => {
                const [bg, fg, font, wt] = alt ? r.pick(n++ % 2 ? DARK : LIGHT) : r.pick(CUTS);
                const sz = size * r.range(0.82, 1.16);
                return { ch, bg, fg, font, wt, sz, w: textW(ch, sz, wt, font) + Math.max(6, sz * 0.34), rot: r.range(-7, 7), dy: r.range(-4, 4) };
            }),
        );
        const lines = [[]];
        let lw = 0;
        const gap = 3;
        const space = size * 0.42;
        for (const wd of words) {
            const ww = wd.reduce((a, c) => a + c.w + gap, 0) - gap;
            if (lines.at(-1).length && lw + space + ww > width) {
                lines.push([]);
                lw = 0;
            }
            lines.at(-1).push(wd);
            lw += (lw ? space : 0) + ww;
        }
        const lineH = size * 1.42;
        let html = "";
        let maxW = 0;
        lines.forEach((ln, i) => {
            const total = ln.reduce((a, wd) => a + wd.reduce((b, c) => b + c.w + gap, 0) - gap, 0) + space * (ln.length - 1);
            maxW = Math.max(maxW, total);
            let cx = (width - total) / 2;
            for (const wd of ln) {
                for (const c of wd) {
                    html += `<div style="position:absolute;left:${cx.toFixed(1)}px;top:${(i * lineH + c.dy + (size * 1.16 - c.sz) / 2).toFixed(1)}px;width:${c.w - 4}px;padding:2px 2px;text-align:center;background:${c.bg};color:${c.fg};border:2px solid #000;font:${c.wt} ${c.sz.toFixed(1)}px/1 ${c.font};transform:rotate(${c.rot.toFixed(1)}deg)">${c.ch}</div>`;
                    cx += c.w + gap;
                }
                cx += space - gap;
            }
        });
        return { html, h: lines.length * lineH, w: maxW };
    }

    /** The ransom note: a card of cut-out letters. */
    function ransom(s, { x, y, w = 170, rot = 0, text, size = 24, seed, alt }) {
        const pad = 16;
        const inner = w - pad * 2 - LW * 2;
        const c = cutouts(text, { width: inner, size, seed, alt });
        const h = c.h + pad * 2 + LW * 2 + 2;
        const html = `<div style="${BOX};width:${w}px;height:${h}px;position:relative"><div style="position:absolute;left:${pad}px;top:${pad + 2}px;width:${inner}px">${c.html}</div></div>`;
        return s.add(html, { x, y, w, h, rot });
    }

    /** The map, as a placeholder: plain xerox, nothing coloured in. */
    function map(s, { x, y, w = 200, h = 150, rot = 0, zoom = 16.4 }) {
        const sc = K().SC();
        const m = K().scrap(s.b, { x, y, w, h, rot, center: K().centroid(sc.region), zoom, pins4: false, border: LW });
        const poly = [m.at(0, 0), m.at(1, 0), m.at(1, 1), m.at(0, 1)];
        const item = { ...m, w, poly, pins: [] };
        s.items.push(item);
        return item;
    }

    // -----------------------------------------------------------------
    // Home screens
    // -----------------------------------------------------------------
    const W = 375;
    const H = 812;
    const BTN = { x: 24, w: W - 48, h: 58, y: H - 34 - 58 - 18 };
    const LOGO = "13.1";

    // With a scene, the title is the same lockup, uniformly smaller.
    function title(root, k = 1, logo = LOGO) {
        const NS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(NS, "svg");
        svg.setAttribute("width", W);
        svg.setAttribute("height", 520);
        svg.style.cssText = `position:absolute;left:0;top:40px;overflow:visible;z-index:30;transform:scale(${k});transform-origin:26px 0`;
        root.appendChild(svg);
        Logo.draw(svg, logo, W, 520);
        const b = svg.getBBox();
        return 40 + (b.y + b.height) * k;
    }
    function button(root, label = "LET ME IN") {
        const d = document.createElement("div");
        d.style.cssText = `position:absolute;left:${BTN.x}px;top:${BTN.y}px;width:${BTN.w}px;height:${BTN.h}px;box-sizing:border-box;border:${LW}px solid #000;background:#fff;color:#000;font:700 17px/${BTN.h - 6}px ${FONT};letter-spacing:.12em;text-align:center;z-index:10`;
        d.textContent = label;
        root.appendChild(d);
        return d;
    }

    /** The title, a two-item scene halfway between STALK and the button, the button. */
    function home(sceneFn, sceneH, logo = LOGO) {
        return async (root) => {
            root.style.background = "#fff";
            const bottom = title(root, 0.84, logo);
            button(root);
            const top = Math.round(bottom + (BTN.y - bottom - sceneH) / 2);
            const host = document.createElement("div");
            host.style.cssText = `position:absolute;left:0;top:${top}px;width:${W}px;height:${sceneH}px;z-index:20`;
            root.appendChild(host);
            const s = surface(host, W, sceneH);
            sceneFn(s);
            s.done();
            host.style.background = "transparent";
            await K().settle(root);
        };
    }

    // Pins near the corners that face each other, string through the gap.
    const pair = (s, a, b, o = {}) => s.link(s.pin(a, o.ax ?? 0.91, o.ay ?? 0.06), s.pin(b, o.bx ?? 0.1, o.by ?? 0.06), { sag: o.sag ?? 5 });

    const Q = {
        ns: ["Are you north", "or south of me?"],
        green: ["Are you closer to", "the greenhouses", "than I am?"],
        r500: ["Are you within", "500 m of me?"],
        io: ["Are you inside", "or outside?"],
    };
    const ROWS = [
        ["North or south?", "NORTH"],
        ["Within 500 m?", "NO"],
        ["Closest café?", 54],
        ["Where exactly?", 56],
    ];

    const HOMES = {
        // W28 again: a card and a photo, lower, question filling the card.
        31: home((s) => {
            const a = card(s, { x: 28, y: 24, w: 162, rot: -4, q: Q.ns, answer: "NORTH" });
            const b = photo(s, { x: 206, y: 12, w: 134, rot: 5, scene: "sit", caption: "PLACE TO SIT" });
            pair(s, a, b);
        }, 210),
        // A card and the ransom note.
        32: home((s) => {
            const a = card(s, { x: 28, y: 14, w: 146, rot: -4, q: Q.green, answer: "YES" });
            const b = ransom(s, { x: 188, y: 34, w: 162, rot: 5, text: "GETTING CLOSER", size: 21, seed: "h32", alt: true });
            pair(s, a, b);
        }, 200),
        // The profile and a post-it with a question mark.
        33: home((s) => {
            const a = profile(s, { x: 44, y: 12, w: 136, rot: -4 });
            const b = postit(s, { x: 212, y: 42, w: 118, rot: 6, text: "?", size: 64 });
            pair(s, a, b, { ax: 0.84, ay: 0.05, bx: 0.16 });
        }, 220),
        // The file and a photo.
        34: home((s) => {
            const a = file(s, { x: 28, y: 20, w: 182, rot: -3, rows: ROWS });
            const b = photo(s, { x: 226, y: 4, w: 116, rot: 5, scene: "door", caption: "NEAREST DOOR" });
            pair(s, a, b, { ax: 0.88, ay: 0.05, bx: 0.14 });
        }, 190),
        // A post-it and a photo.
        35: home((s) => {
            const a = postit(s, { x: 34, y: 34, w: 130, rot: -5, text: "NORTH. NOT WITHIN 500 M.", size: 20 });
            const b = photo(s, { x: 196, y: 10, w: 140, rot: 4, scene: "tree", caption: "BIGGEST TREE" });
            pair(s, a, b);
        }, 210),
        // W29's idea: the map and a photo (map is a placeholder).
        36: home((s) => {
            const a = map(s, { x: 26, y: 26, w: 184, h: 150, rot: -3 });
            s.pin(a, 0.05, 0.06);
            s.pin(a, 0.95, 0.05);
            s.pin(a, 0.05, 0.94);
            s.pin(a, 0.95, 0.95);
            const b = photo(s, { x: 228, y: 16, w: 116, rot: 5, scene: "sit", caption: "PLACE TO SIT" });
            s.link(a.pins[1], s.pin(b, 0.16, 0.06), { sag: 4 });
        }, 200),
        // The ransom note and a photo.
        37: home((s) => {
            const a = ransom(s, { x: 28, y: 30, w: 168, rot: -5, text: "COMING FOR YOU", size: 22, seed: "h37", alt: true });
            const b = photo(s, { x: 212, y: 10, w: 124, rot: 5, scene: "sit", caption: "PLACE TO SIT" });
            pair(s, a, b);
        }, 200),
        // The file and a post-it.
        38: home((s) => {
            const a = file(s, { x: 28, y: 14, w: 186, rot: -3, rows: ROWS });
            const b = postit(s, { x: 230, y: 44, w: 108, rot: 6, text: "GREEN DOOR??", size: 16 });
            pair(s, a, b, { ax: 0.9, ay: 0.05, bx: 0.14 });
        }, 190),
    };

    // W26's arrow, redone: as thick as STALK's strokes, short, a wide head,
    // its point touching LET ME IN.
    function arrowed(kind) {
        return async (root) => {
            root.style.background = "#fff";
            title(root);
            const btn = button(root);
            const label = textW("LET ME IN", 17) + 17 * 0.12 * 8;
            const lx = W / 2 - label / 2;
            const ly = BTN.y + BTN.h / 2;
            const NS = "http://www.w3.org/2000/svg";
            const svg = document.createElementNS(NS, "svg");
            svg.setAttribute("width", W);
            svg.setAttribute("height", H);
            svg.style.cssText = "position:absolute;left:0;top:0;overflow:visible;z-index:40";
            const weight = 11; // the shaft thins at its ends; at its widest it matches STALK's stroke
            const head = { head: "open", spread: 0.72, headRatio: 0.34 };
            const A = {
                left: () => Ink.bigArrow(lx - 70, ly - 78, lx - 7, ly - 5, { seed: "wa1", weight, bend: -0.22, ...head }),
                above: () => Ink.bigArrow(W / 2 - 30, BTN.y - 86, W / 2 - 8, ly - 14, { seed: "wa2", weight, bend: 0.16, ...head }),
                right: () => Ink.bigArrow(lx + label + 74, ly - 76, lx + label + 7, ly - 5, { seed: "wa3", weight, bend: 0.22, ...head }),
            };
            svg.innerHTML = A[kind]();
            root.appendChild(svg);
            void btn;
        };
    }
    Object.assign(HOMES, { 39: arrowed("left"), 40: arrowed("above"), 41: arrowed("right") });

    // Fourth pass (W42-W47): the title is L16.6b, and the two pinned things are
    // two of B29's four pieces, every pair once. Each piece is B29's own (same
    // words, same seeds), only sized for the screen.
    const FINAL = "16.6b";
    const hider = (s, o) => profile(s, { ...o, seed: "pf246" });
    const bench = (s, o) => photo(s, { ...o, scene: "sit", caption: "PLACE TO SIT" });
    const northCard = (s, o) => card(s, { ...o, q: Q.ns, answer: "NORTH", square: true });
    Object.assign(HOMES, {
        // The file and the profile (B29's top row).
        42: home((s) => {
            const a = file29(s, { x: 26, y: 20, w: 184, rot: -3 });
            const b = hider(s, { x: 230, y: 14, w: 116, rot: 5 });
            pair(s, a, b, { ax: 0.9, ay: 0.05, bx: 0.14 });
        }, 190, FINAL),
        // The file and the photo.
        43: home((s) => {
            const a = file29(s, { x: 26, y: 22, w: 182, rot: -3 });
            const b = bench(s, { x: 226, y: 13, w: 122, rot: 5 });
            pair(s, a, b, { ax: 0.9, ay: 0.05, bx: 0.14 });
        }, 190, FINAL),
        // The file and the north-or-south card.
        44: home((s) => {
            const a = file29(s, { x: 26, y: 14, w: 180, rot: -3 });
            const b = northCard(s, { x: 220, y: 24, w: 128, rot: 5 });
            pair(s, a, b, { ax: 0.9, ay: 0.05, bx: 0.14 });
        }, 190, FINAL),
        // The profile and the photo.
        45: home((s) => {
            const a = hider(s, { x: 40, y: 12, w: 128, rot: -4 });
            const b = bench(s, { x: 202, y: 13, w: 138, rot: 5 });
            pair(s, a, b, { ax: 0.86, ay: 0.05, bx: 0.14 });
        }, 200, FINAL),
        // The profile and the card.
        46: home((s) => {
            const a = hider(s, { x: 40, y: 12, w: 128, rot: -4 });
            const b = northCard(s, { x: 200, y: 26, w: 140, rot: 5 });
            pair(s, a, b, { ax: 0.86, ay: 0.05, bx: 0.12 });
        }, 200, FINAL),
        // The photo and the card (B29's bottom row).
        47: home((s) => {
            const a = bench(s, { x: 30, y: 12, w: 140, rot: -4 });
            const b = northCard(s, { x: 198, y: 24, w: 144, rot: 5 });
            pair(s, a, b, { ax: 0.88, ay: 0.05, bx: 0.12 });
        }, 200, FINAL),
    });

    // Fifth pass (W48-W52), from W43: the profile is gone (its red fought the
    // title) and the Polaroid stays small. The file is HIDER LOCATION: north or
    // south answered by hand in red, where exactly still blacked out. The
    // bench photo stays; only its caption changes, written in black, so the
    // title and NORTH are the only red words.
    const benchAt = (caption) => (s, o) => photo(s, { ...o, scene: "sit", caption, ink: "#000" });
    const w43 = (caption, stacked = true) =>
        home((s) => {
            const a = fileNS(s, { x: 26, y: 14, w: 184, rot: -3, stacked });
            const b = benchAt(caption)(s, { x: 226, y: 12, w: 122, rot: 5 });
            pair(s, a, b, { ax: 0.9, ay: 0.05, bx: 0.14 });
        }, stacked ? 236 : 200, FINAL);
    Object.assign(HOMES, {
        48: w43("JUST SEEN HERE"),
        49: w43("LAST SEEN HERE"),
        50: w43("13:27"),
        51: w43("46.7797 N\n71.2756 W"),
        52: w43("46.7797 N\n71.2756 W", false),
        // W51, finished: only the one question, bigger and bold; NORTH bigger;
        // the Polaroid's coordinates in red, their strokes heavier.
        53: home((s) => {
            const a = fileNS(s, { x: 26, y: 14, w: 184, rot: -3, only: true });
            const b = photo(s, { x: 226, y: 12, w: 122, rot: 5, scene: "sit", caption: "46.7797 N\n71.2756 W", bold: 1.6 });
            pair(s, a, b, { ax: 0.9, ay: 0.05, bx: 0.14 });
        }, 236, FINAL),
    });
    for (const [n, f] of Object.entries(HOMES)) Welcome.extra[n] = f;

    // -----------------------------------------------------------------
    // Boards: one composition from all the pieces
    // -----------------------------------------------------------------
    const board = (fn) => async (root, W0 = 375, H0 = 480) => {
        root.style.position = "relative";
        const s = surface(root, W0, H0);
        fn(s);
        s.done();
        await K().settle(root);
    };
    const BOARDS = {
        // The map in the middle, four pieces around it, one string to each corner.
        25: board((s) => {
            const m = map(s, { x: 100, y: 170, w: 176, h: 134, rot: 1.5 });
            const c = [s.pin(m, 0.05, 0.07), s.pin(m, 0.95, 0.06), s.pin(m, 0.05, 0.93), s.pin(m, 0.95, 0.94)];
            const a = card(s, { x: 28, y: 26, w: 140, rot: -4, q: Q.ns, answer: "NORTH" });
            const b = photo(s, { x: 234, y: 20, w: 110, rot: 5, scene: "sit", caption: "PLACE TO SIT" });
            const p = postit(s, { x: 32, y: 336, w: 100, rot: -5, text: "NOT WITHIN 500 M", size: 17 });
            const r = ransom(s, { x: 182, y: 340, w: 162, rot: 4, text: "GETTING CLOSER", size: 19, seed: "b25", alt: true });
            s.link(s.pin(a, 0.92, 0.93), c[0], { sag: 2 });
            s.link(s.pin(b, 0.1, 0.97), c[1], { sag: 2 });
            s.link(s.pin(p, 0.9, 0.08), c[2], { sag: 2 });
            s.link(s.pin(r, 0.08, 0.1), c[3], { sag: 2 });
        }),
        // The file at the top, the profile beside it; a photo and the obsessive post-it under.
        26: board((s) => {
            const f = file(s, { x: 30, y: 30, w: 184, rot: -2.5, rows: ROWS });
            const pr = profile(s, { x: 246, y: 44, w: 96, rot: 5 });
            const ph = photo(s, { x: 50, y: 262, w: 124, rot: 4, scene: "door", caption: "NEAREST DOOR" });
            const p = postit(s, { x: 214, y: 282, w: 118, rot: -5, lines: ["CLOSER", "CLOSER", "CLOSER"], size: 22 });
            s.link(s.pin(f, 0.93, 0.07), s.pin(pr, 0.12, 0.05), { sag: 3 });
            s.link(s.pin(f, 0.34, 0.96), s.pin(ph, 0.42, 0.04), { sag: 1 });
            s.link(s.pin(pr, 0.5, 0.97), s.pin(p, 0.62, 0.06), { sag: 2 });
        }),
        // The profile at the centre, what's known pinned around it.
        27: board((s) => {
            const pr = profile(s, { x: 136, y: 160, w: 104, rot: -2 });
            const a = card(s, { x: 28, y: 24, w: 142, rot: -5, q: Q.green, answer: "YES" });
            const b = card(s, { x: 206, y: 30, w: 136, rot: 4, q: Q.r500, answer: "NO" });
            const ph = photo(s, { x: 30, y: 314, w: 104, rot: -4, scene: "sit", caption: "PLACE TO SIT" });
            const p = postit(s, { x: 250, y: 330, w: 90, rot: 6, text: "?", size: 50 });
            const top = s.pin(pr, 0.5, 0.04);
            s.link(s.pin(a, 0.9, 0.93), top, { sag: 1 });
            s.link(s.pin(b, 0.1, 0.93), top, { sag: 1 });
            s.link(s.pin(ph, 0.9, 0.05), s.pin(pr, 0.07, 0.94), { sag: 1 });
            s.link(s.pin(p, 0.1, 0.08), s.pin(pr, 0.93, 0.94), { sag: 1 });
        }),
        // Everything: map, two cards, photo, post-it, the ransom note.
        28: board((s) => {
            const m = map(s, { x: 132, y: 164, w: 150, h: 124, rot: 2 });
            const c = [s.pin(m, 0.06, 0.07), s.pin(m, 0.94, 0.06), s.pin(m, 0.06, 0.93), s.pin(m, 0.94, 0.94)];
            const a = card(s, { x: 28, y: 22, w: 136, rot: -4, q: Q.ns, answer: "NORTH" });
            const ph = photo(s, { x: 240, y: 20, w: 100, rot: 5, scene: "sit", caption: "PLACE TO SIT" });
            const p = postit(s, { x: 30, y: 196, w: 80, rot: -6, text: "COFFEE?", size: 15 });
            const r = ransom(s, { x: 28, y: 336, w: 160, rot: -3, text: "COMING FOR YOU", size: 18, seed: "b28", alt: true });
            const b = card(s, { x: 206, y: 334, w: 136, rot: 4, q: Q.io, answer: "OUTSIDE" });
            s.link(s.pin(a, 0.92, 0.93), c[0], { sag: 2 });
            s.link(s.pin(ph, 0.1, 0.96), c[1], { sag: 2 });
            s.link(s.pin(p, 0.9, 0.12), s.pin(m, 0.03, 0.45), { sag: 1 });
            s.link(s.pin(r, 0.92, 0.08), c[2], { sag: 1 });
            s.link(s.pin(b, 0.1, 0.08), c[3], { sag: 1 });
        }),
    };
    // B26, final: the bench instead of the door, the north/south card instead
    // of CLOSER CLOSER CLOSER, and that answer taken off the file (it's on the
    // card now). One red mark on the file: 500 m underlined.
    // Since W53, B29 is the source of truth, and it takes W53's pieces: the
    // Polaroid with the coordinates, and NORTH big on the card. The file keeps
    // two lines (within 500 m, the closest café).
    const coords = (s, o) => photo(s, { ...o, scene: "sit", caption: "46.7797 N\n71.2756 W", bold: 1.6 });
    /**
     * B29's four pieces and three strings. at: where each piece goes, if not
     * where B29 has it ({ f, pr, ph, c }: { x, y }), dy: everything moved
     * down, pins: other pin spots.
     */
    function b29(s, { at = {}, dy = 0, pins = {} } = {}) {
        const put = (o, k) => ({ ...o, ...at[k], y: (at[k]?.y ?? o.y) + dy });
        const f = file29(s, put({ x: 30, y: 30, w: 184, rot: -2.5 }, "f"));
        const pr = profile(s, put({ x: 246, y: 44, w: 96, rot: 5 }, "pr"));
        const ph = coords(s, put({ x: 40, y: 262, w: 122, rot: 4 }, "ph"));
        const c = nsCard(s, put({ x: 180, y: 312, w: 168, rot: -4 }, "c"));
        const p = { f1: [0.93, 0.07], pr1: [0.12, 0.05], f2: [0.34, 0.96], ph: [0.42, 0.04], pr2: [0.5, 0.97], c: [0.66, 0.07], ...pins };
        s.link(s.pin(f, ...p.f1), s.pin(pr, ...p.pr1), { sag: 3 });
        s.link(s.pin(f, ...p.f2), s.pin(ph, ...p.ph), { sag: 1 });
        s.link(s.pin(pr, ...p.pr2), s.pin(c, ...p.c), { sag: 2 });
    }
    BOARDS[29] = board((s) => b29(s));
    for (const [n, f] of Object.entries(BOARDS)) Board.extra[n] = f;

    // -----------------------------------------------------------------
    // Home screens, sixth pass (W54.1-W54.6): L16.6b and all of B29 on one
    // screen. B29's pieces and strings as they are; the title moves around,
    // with and without LET ME IN. The title and the button are obstacles:
    // no piece or string may cross them (checked like the rest).
    // -----------------------------------------------------------------
    /** L16.6b at scale k, its box's top-left at (x, y) (x "center": centred on the screen). Returns the box. */
    function titleBox(root, k, x, y) {
        const NS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(NS, "svg");
        svg.setAttribute("width", W);
        svg.setAttribute("height", 520);
        svg.style.cssText = "position:absolute;left:0;top:0;overflow:visible;z-index:30;transform-origin:0 0";
        root.appendChild(svg);
        Logo.draw(svg, FINAL, W, 520);
        const b = svg.getBBox();
        const left = x === "center" ? (W - b.width * k) / 2 : x;
        svg.style.transform = `translate(${left - b.x * k}px,${y - b.y * k}px) scale(${k})`;
        return [[left, y], [left + b.width * k, y], [left + b.width * k, y + b.height * k], [left, y + b.height * k]];
    }
    const box = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
    function homeBoard({ k, x = 17, y, btn = false, place }) {
        return async (root) => {
            root.style.background = "#fff";
            const t = titleBox(root, k, x, y);
            if (btn) button(root);
            const host = document.createElement("div");
            host.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:${H}px;z-index:20`;
            root.appendChild(host);
            const s = surface(host, W, H);
            s.avoid.push(t);
            if (btn) s.avoid.push(box(BTN.x, BTN.y, BTN.w, BTN.h));
            b29(s, place);
            s.done();
            host.style.background = "transparent";
            await K().settle(root);
        };
    }
    // The middle: the file and the profile above the title, the Polaroid and
    // the card below it, the two long strings pinned at the outer corners so
    // they run down the sides, clear of the title.
    const sides = { f2: [0.08, 0.96], ph: [0.14, 0.04], pr2: [0.78, 0.97], c: [0.84, 0.07] };
    Object.assign(Welcome.extra, {
        // The title on top, W53's way (left, a bit smaller); B29 under it, whole.
        54.1: homeBoard({ k: 0.76, y: 52, place: { dy: 339 } }),
        // The same with LET ME IN: the title smaller, B29's two rows closer.
        54.2: homeBoard({ k: 0.66, y: 50, btn: true, place: { dy: 298, at: { ph: { y: 212 }, c: { y: 258 } } } }),
        // B29 first, the title under it, as big as in W53, centred.
        54.3: homeBoard({ k: 0.84, x: "center", y: 462 }),
        // The same with LET ME IN: the title smaller.
        54.4: homeBoard({ k: 0.61, x: "center", y: 452, btn: true }),
        // The title in the middle of the board.
        54.5: homeBoard({ k: 0.68, x: "center", y: 261, place: { at: { ph: { y: 612 }, c: { y: 650 } }, pins: sides } }),
        // The same with LET ME IN: the bottom row higher, the title smaller.
        54.6: homeBoard({ k: 0.62, x: "center", y: 227, btn: true, place: { at: { ph: { y: 520 }, c: { y: 562 } }, pins: sides } }),
    });

    // -----------------------------------------------------------------
    // What the ransom note says (C01-C12): just the note
    // -----------------------------------------------------------------
    const NOTES = ["I SEE YOU", "FOUND YOU", "READY OR NOT", "NOT FAR NOW", "GETTING WARMER", "I'M CLOSE", "NOWHERE TO HIDE", "LOOK BEHIND YOU", "COMING FOR YOU", "I KNOW WHERE YOU ARE", "SAY CHEESE", "RUN",
        // Second round (C13-C18): the letters alternate black and white.
        "GETTING CLOSER", "GETTING WARMER", "COMING FOR YOU", "BEHIND YOU", "NOWHERE TO GO", "WARMER"];
    window.Home3 = {
        NOTES,
        async note(root, v) {
            root.style.background = "#fff";
            root.style.position = "relative";
            const s = surface(root, 375, 300);
            const it = ransom(s, { x: 62, y: 50, w: 250, rot: -3, text: NOTES[v - 1], size: 30, seed: `c${v}`, alt: v > 12 });
            s.pin(it, 0.5, 0.07);
            s.done();
        },
    };
    void turf;
    void WildKit;
})();
