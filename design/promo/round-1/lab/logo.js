/* global Ink */

// The HIDE AND SEEK -> STALK lockups (set L).
//
// The typeset part is deliberately dull: Helvetica Bold (Arimo stands in
// here), black, flush left, tight. Everything red is drawn by ink.js, so it
// has to be measured against the real type first: each lockup typesets its
// words into the SVG, reads their boxes back, then draws on top.

(function () {
    const NS = "http://www.w3.org/2000/svg";
    const FONT = "Arimo, 'Helvetica Neue', Helvetica, Arial, sans-serif";
    // Type colour: black, or white in dark mode (the red never changes).
    let TYPE = "#000";

    /** Typeset one word and return its box (cap-height box, not the em box). */
    function word(svg, text, x, y, size, o = {}) {
        const t = document.createElementNS(NS, "text");
        t.setAttribute("x", x);
        t.setAttribute("y", y);
        t.setAttribute("font-family", FONT);
        t.setAttribute("font-weight", "700");
        t.setAttribute("font-size", size);
        t.setAttribute("letter-spacing", o.tracking ?? `${-0.02 * size}`);
        t.setAttribute("fill", o.fill ?? TYPE);
        if (o.anchor) t.setAttribute("text-anchor", o.anchor);
        t.textContent = text;
        svg.appendChild(t);
        const b = t.getBBox();
        // Helvetica caps are ~0.72 em tall; the bbox includes the descender
        // space, so rebuild the box from the baseline instead.
        const cap = size * 0.716;
        return { x: b.x, y: y - cap, w: b.width, h: cap, base: y, el: t };
    }

    function ink(svg, markup) {
        const g = document.createElementNS(NS, "g");
        g.innerHTML = markup;
        svg.appendChild(g);
        return g;
    }

    /** STALK, scrawled. Returns where it ended. */
    let canvasW = 375;
    function stalk(svg, x, y, size, o = {}) {
        const opts = { y, size, weight: o.weight ?? size * 0.18, seed: o.seed ?? "stalk", mess: o.mess ?? 0.45, tilt: o.tilt ?? -2, spacing: o.spacing ?? 0.12, color: o.color };
        // Measure first, then keep the scrawl on screen.
        const probe = Ink.write(o.text ?? "STALK", { ...opts, x: 0 });
        const right = o.right ?? canvasW - 14;
        const res = Ink.write(o.text ?? "STALK", { ...opts, x: Math.max(8, Math.min(x, right - probe.width)) });
        ink(svg, res.svg);
        return res;
    }

    const M = 26; // left margin

    // Each lockup draws into an SVG of the given size. `dark` swaps the ink.
    const LOCKUPS = {
        // Faithful to the poster, stacked for a phone.
        1(svg) {
            const s = 104;
            word(svg, "HIDE", M, 128, s);
            word(svg, "AND", M, 216, s);
            const seek = word(svg, "SEEK", M, 304, s);
            ink(svg, Ink.scribbleOut(seek.x + 6, seek.y - 4, seek.w - 8, seek.h + 8, { seed: "L1", passes: 3, weight: 13 }));
            stalk(svg, seek.x + seek.w * 0.34, 394, 84, { seed: "L1s" });
        },
        // The & version: HIDE / & SEEK / STALK.
        2(svg) {
            const s = 104;
            word(svg, "HIDE", M, 128, s);
            const amp = word(svg, "&", M, 216, s * 0.78);
            const seek = word(svg, "SEEK", amp.x + amp.w + 14, 216, s * 0.78);
            ink(svg, Ink.scribbleOut(seek.x + 4, seek.y - 4, seek.w - 6, seek.h + 8, { seed: "L2", passes: 3, weight: 12 }));
            stalk(svg, M + 8, 330, 100, { seed: "L2s", tilt: -3 });
        },
        // STALK written straight across SEEK, much bigger, at an angle.
        3(svg) {
            const s = 104;
            word(svg, "HIDE", M, 128, s);
            word(svg, "AND", M, 216, s);
            const seek = word(svg, "SEEK", M, 304, s);
            ink(svg, Ink.strike(seek.x, seek.y, seek.w, seek.h, { seed: "L3k", weight: 9 }));
            stalk(svg, M + 22, 380, 96, { seed: "L3s", tilt: -13, mess: 0.6 });
        },
        // Proofreader: one clean strike, a caret, STALK inserted above.
        4(svg) {
            const s = 104;
            word(svg, "HIDE", M, 128, s);
            word(svg, "AND", M, 216, s);
            const seek = word(svg, "SEEK", M, 370, s);
            ink(svg, Ink.strike(seek.x, seek.y, seek.w, seek.h, { seed: "L4k", weight: 8, lines: 2 }));
            stalk(svg, M + 96, 262, 58, { seed: "L4s", tilt: -4 });
            ink(svg, Ink.caret(M + 170, 390, 40, { seed: "L4c", weight: 6 }));
            ink(svg, Ink.arrow(M + 172, 372, M + 168, 280, { seed: "L4a", bend: 0.05, weight: 4 }));
        },
        // SEEK blacked out entirely; STALK underneath, big.
        5(svg) {
            const s = 104;
            word(svg, "HIDE", M, 128, s);
            word(svg, "AND", M, 216, s);
            const seek = word(svg, "SEEK", M, 304, s);
            ink(svg, Ink.blackout(seek.x - 6, seek.y - 6, seek.w + 12, seek.h + 12, { seed: "L5" }));
            stalk(svg, M + 4, 404, 90, { seed: "L5s", tilt: -5, mess: 0.55 });
        },
        // HIDE AND small on one line; SEEK huge.
        6(svg) {
            word(svg, "HIDE AND", M, 92, 56);
            const seek = word(svg, "SEEK", M, 222, 124);
            ink(svg, Ink.scribbleOut(seek.x + 6, seek.y - 6, seek.w - 8, seek.h + 10, { seed: "L6", passes: 4, weight: 15 }));
            stalk(svg, M + 10, 352, 100, { seed: "L6s", tilt: -3 });
        },
        // Centred stack.
        7(svg, W) {
            const s = 100;
            word(svg, "HIDE", W / 2, 124, s, { anchor: "middle" });
            word(svg, "AND", W / 2, 222, s, { anchor: "middle" });
            const seek = word(svg, "SEEK", W / 2, 320, s, { anchor: "middle" });
            ink(svg, Ink.scribbleOut(seek.x + 6, seek.y - 4, seek.w - 10, seek.h + 8, { seed: "L7", passes: 3, weight: 12 }));
            stalk(svg, W / 2 - 112, 414, 82, { seed: "L7s" });
        },
        // SEEK circled and crossed, an arrow down the side to STALK.
        8(svg) {
            const s = 100;
            word(svg, "HIDE", M, 124, s);
            word(svg, "AND", M, 222, s);
            const seek = word(svg, "SEEK", M, 320, s);
            ink(svg, Ink.circle(seek.x + seek.w / 2, seek.y + seek.h / 2, seek.w * 0.62, seek.h * 0.9, { seed: "L8c", weight: 5 }));
            ink(svg, Ink.cross(seek.x + seek.w / 2, seek.y + seek.h / 2, seek.h * 0.6, { seed: "L8x", weight: 9 }));
            ink(svg, Ink.arrow(seek.x + seek.w + 10, seek.y + 10, seek.x + seek.w - 20, 380, { seed: "L8a", bend: -0.35, weight: 5 }));
            stalk(svg, M + 60, 440, 76, { seed: "L8s", tilt: -2 });
        },
        // Obsessive: STALK three times, each one angrier.
        9(svg) {
            const s = 96;
            word(svg, "HIDE", M, 118, s);
            word(svg, "AND", M, 212, s);
            const seek = word(svg, "SEEK", M, 306, s);
            ink(svg, Ink.scribbleOut(seek.x + 6, seek.y - 4, seek.w - 8, seek.h + 8, { seed: "L9", passes: 3, weight: 12 }));
            stalk(svg, M + 150, 372, 50, { seed: "L9a", mess: 0.3, tilt: -1 });
            stalk(svg, M + 40, 428, 62, { seed: "L9b", mess: 0.55, tilt: -4 });
            stalk(svg, M + 120, 496, 76, { seed: "L9c", mess: 0.9, tilt: -7 });
        },
        // HIDE gets marked too: the target, circled.
        10(svg) {
            const s = 104;
            const hide = word(svg, "HIDE", M, 128, s);
            word(svg, "AND", M, 216, s);
            const seek = word(svg, "SEEK", M, 304, s);
            ink(svg, Ink.circle(hide.x + hide.w / 2, hide.y + hide.h / 2, hide.w * 0.6, hide.h * 0.95, { seed: "L10c", weight: 4.5, turns: 1.35 }));
            ink(svg, Ink.write("?!", { x: hide.x + hide.w + 26, y: hide.base - 20, size: 40, seed: "L10q", weight: 6 }).svg);
            ink(svg, Ink.scribbleOut(seek.x + 6, seek.y - 4, seek.w - 8, seek.h + 8, { seed: "L10", passes: 3, weight: 13 }));
            stalk(svg, seek.x + seek.w * 0.34, 394, 84, { seed: "L10s" });
        },
        // L1, on black.
        11(svg, W, H) {
            const bg = document.createElementNS(NS, "rect");
            Object.entries({ x: 0, y: 0, width: W, height: H, fill: "#000" }).forEach(([k, v]) => bg.setAttribute(k, v));
            svg.appendChild(bg);
            const s = 104;
            word(svg, "HIDE", M, 128, s, { fill: "#fff" });
            word(svg, "AND", M, 216, s, { fill: "#fff" });
            const seek = word(svg, "SEEK", M, 304, s, { fill: "#fff" });
            ink(svg, Ink.scribbleOut(seek.x + 6, seek.y - 4, seek.w - 8, seek.h + 8, { seed: "L1", passes: 3, weight: 13 }));
            stalk(svg, seek.x + seek.w * 0.34, 394, 84, { seed: "L1s" });
        },
        // Small uses: the in-app header lockup, and a home-screen icon.
        12(svg, W) {
            // Header bar
            const line = document.createElementNS(NS, "rect");
            Object.entries({ x: 0, y: 96, width: W, height: 3, fill: "#000" }).forEach(([k, v]) => line.setAttribute(k, v));
            svg.appendChild(line);
            const a = word(svg, "HIDE &", 20, 64, 28);
            const seek = word(svg, "SEEK", a.x + a.w + 9, 64, 28);
            ink(svg, Ink.scribbleOut(seek.x + 2, seek.y - 2, seek.w - 2, seek.h + 4, { seed: "L12h", passes: 3, weight: 4 }));
            stalk(svg, seek.x + seek.w + 14, 80, 34, { seed: "L12s", weight: 6, tilt: -8 });
            // Icon: black-on-white square, stacked initials.
            const ix = W / 2 - 90;
            const iy = 170;
            const sq = document.createElementNS(NS, "rect");
            Object.entries({ x: ix, y: iy, width: 180, height: 180, rx: 40, fill: "#fff", stroke: "#000", "stroke-width": 3 }).forEach(([k, v]) => sq.setAttribute(k, v));
            svg.appendChild(sq);
            const h = word(svg, "H&", ix + 22, iy + 88, 74);
            const ss = word(svg, "S", ix + 22, iy + 158, 74);
            ink(svg, Ink.scribbleOut(ss.x + 2, ss.y - 2, ss.w, ss.h + 4, { seed: "L12i", passes: 2, weight: 7 }));
            stalk(svg, ss.x + ss.w + 12, iy + 160, 58, { seed: "L12k", text: "S", weight: 10, tilt: -8 });
            void h;
            ink(svg, Ink.write("HEADER + APP ICON", { x: 20, y: 420, size: 16, seed: "L12n", weight: 2.6, color: "#000", mess: 0.2 }).svg);
        },
    };

    // ---------------------------------------------------------------------
    // Round 1, second pass (feedback on L1, L2, L3, L7, L8, L12)
    // ---------------------------------------------------------------------
    const EDGE = 24; // nothing drawn closer than this to the screen's edge

    /** Move an inked group so its top sits at `top`; left at `x` or centred on `cx`; kept off the edges. */
    function place(g, o) {
        const b = g.getBBox();
        const room = canvasW - EDGE * 2;
        const k = o.width ? o.width / b.width : Math.min(o.scale ?? 1, room / b.width);
        let left = o.cx !== undefined ? o.cx - (b.width * k) / 2 : o.x ?? b.x;
        left = Math.max(EDGE, Math.min(left, canvasW - EDGE - b.width * k));
        g.setAttribute("transform", `translate(${left - b.x * k} ${o.top - b.y * k}) scale(${k})`);
        return { x: left, y: o.top, w: b.width * k, h: b.height * k, bottom: o.top + b.height * k };
    }

    /** The bottom edge of what's drawn so far in a group. */
    const bottomOf = (g) => {
        const b = g.getBBox();
        return b.y + b.height;
    };

    /** The SEEK scribble, pressure and all. */
    const scribble = (svg, box, o = {}) => ink(svg, Ink.pencilScribble(box.x + 4, box.y - 2, box.w - 6, box.h + 4, { seed: o.seed ?? "p1", passes: o.passes ?? 3, weight: o.weight ?? box.h * 0.22, overshoot: o.overshoot, even: o.even }));

    /** STALK as in L1 or L8 (the plain scrawl), drawn at the origin, to be placed. */
    const scrawl = (svg, o = {}) => ink(svg, Ink.write(o.text ?? "STALK", { x: 0, y: 0, size: o.size ?? 84, weight: (o.size ?? 84) * 0.18, seed: o.seed ?? "L1s", mess: o.mess ?? 0.45, tilt: o.tilt ?? -2, spacing: 0.12 }).svg);

    /** STALK with its letters tucked together, drawn at the origin, to be placed. */
    const tucked = (svg, o = {}) => ink(svg, Ink.tuck(o.text ?? "STALK", { size: o.size ?? 84, seed: o.seed ?? "t1", sizeVar: o.sizeVar, riseVar: o.riseVar, sizes: o.sizes, rises: o.rises, tilt: o.tilt ?? -3, mess: o.mess ?? 0.45, gap: o.gap, spin: o.spin, overshoot: o.overshoot, weights: o.weights, pulls: o.pulls, glyphs: o.glyphs, blunt: o.blunt }).svg);

    /** One typeset word at whatever size makes it exactly `width` wide. */
    function fitWord(svg, text, x, top, width, o = {}) {
        const w0 = word(svg, text, 0, 0, 100, { tracking: o.tracking });
        const size = (100 * width) / w0.w;
        w0.el.remove();
        const cap = size * 0.716;
        const w = word(svg, text, x, top + cap, size, { tracking: `${-0.02 * size}`, anchor: o.anchor });
        // Nudge for the side bearing, so the ink edge (not the advance) lines up.
        const shift = x - w.x - (o.anchor === "middle" ? 0 : 0);
        if (!o.anchor) {
            w.el.setAttribute("x", x + shift);
            w.x += shift;
        }
        return w;
    }

    /** One typeset word at a fixed size, its letters spread to exactly `width`. */
    function spreadWord(svg, text, x, base, size, width) {
        const w = word(svg, text, x, base, size, { tracking: "0" });
        w.el.setAttribute("textLength", width);
        w.el.setAttribute("lengthAdjust", "spacing");
        const b = w.el.getBBox();
        w.el.setAttribute("x", x - (b.x - x));
        return { ...w, x, w: width };
    }

    const stack = (svg, s = 104) => {
        word(svg, "HIDE", M, 118, s);
        word(svg, "AND", M, 206, s);
        return word(svg, "SEEK", M, 294, s);
    };

    const TUCK_A = { sizes: [1.2, 0.72, 1.04, 0.7, 1.16], rises: [0, 0.3, 0.02, -0.12, 0.05] };

    Object.assign(LOCKUPS, {
        // L1, pencil scribble, STALK lowered clear of it.
        "1.1"(svg) {
            const seek = stack(svg);
            const sc = scribble(svg, seek, { seed: "p11" });
            place(scrawl(svg), { top: bottomOf(sc) + 22, x: seek.x + seek.w * 0.3 });
        },
        // L1.1 with the letters tucked in, each its own size.
        "1.2"(svg) {
            const seek = stack(svg);
            const sc = scribble(svg, seek, { seed: "p12" });
            place(tucked(svg, { seed: "t12", size: 88 }), { top: bottomOf(sc) + 20, x: seek.x + seek.w * 0.26 });
        },
        // L1 with L8's STALK.
        "1.3"(svg) {
            const seek = stack(svg);
            const sc = scribble(svg, seek, { seed: "p13" });
            place(scrawl(svg, { seed: "L8s", size: 76 }), { top: bottomOf(sc) + 30, x: M + 60 });
        },
        // Tucked, bigger swings in size and height.
        "1.4"(svg) {
            const seek = stack(svg);
            const sc = scribble(svg, seek, { seed: "p14", passes: 4 });
            place(tucked(svg, { seed: "t14", size: 92, sizeVar: 0.32, riseVar: 0.14, tilt: -5 }), { top: bottomOf(sc) + 20, x: seek.x + seek.w * 0.18 });
        },
        // Tucked by design: big S, small T nestled under its curve, big K.
        "1.5"(svg) {
            const seek = stack(svg);
            const sc = scribble(svg, seek, { seed: "p15" });
            place(tucked(svg, { seed: "t15", size: 90, ...TUCK_A }), { top: bottomOf(sc) + 20, x: seek.x + seek.w * 0.22 });
        },
        // A looser scribble that overshoots SEEK, L1's STALK.
        "1.6"(svg) {
            const seek = stack(svg);
            const sc = scribble(svg, seek, { seed: "p16", passes: 2, overshoot: 0.3, weight: 20 });
            place(scrawl(svg), { top: bottomOf(sc) + 22, x: seek.x + seek.w * 0.34 });
        },
        // HIDE / & SEEK, one type size throughout; big STALK inside the margins.
        "2.1"(svg) {
            const s = 96;
            word(svg, "HIDE", M, 126, s);
            const amp = word(svg, "&", M, 222, s);
            const seek = word(svg, "SEEK", amp.x + amp.w + 18, 222, s);
            const sc = scribble(svg, seek, { seed: "p21" });
            place(scrawl(svg, { seed: "L2s", size: 110, tilt: -3 }), { top: bottomOf(sc) + 24, x: M });
        },
        "2.2"(svg) {
            const s = 96;
            word(svg, "HIDE", M, 126, s);
            const amp = word(svg, "&", M, 222, s);
            const seek = word(svg, "SEEK", amp.x + amp.w + 18, 222, s);
            const sc = scribble(svg, seek, { seed: "p22" });
            place(tucked(svg, { seed: "t22", size: 112, ...TUCK_A }), { top: bottomOf(sc) + 22, x: M });
        },
        // STALK written over SEEK: it is the crossing-out. No line under it.
        "3.1"(svg) {
            const seek = stack(svg);
            const g = scrawl(svg, { seed: "L3s", size: 100, tilt: -11, mess: 0.6 });
            place(g, { top: seek.y - 34, cx: canvasW / 2, width: canvasW - EDGE * 2 - 10 });
        },
        "3.2"(svg) {
            const seek = stack(svg);
            const g = tucked(svg, { seed: "t32", size: 104, tilt: -9, ...TUCK_A });
            place(g, { top: seek.y - 40, cx: canvasW / 2, width: canvasW - EDGE * 2 - 10 });
        },
        // Centred, every word sized to the same width: one block.
        "7.1"(svg, W) {
            const TW = W - M * 2;
            const hide = fitWord(svg, "HIDE", M, 36, TW);
            const and = fitWord(svg, "AND", M, hide.base + 16, TW);
            const seek = fitWord(svg, "SEEK", M, and.base + 16, TW);
            const sc = scribble(svg, seek, { seed: "p71" });
            place(scrawl(svg, { seed: "L8s", size: 76 }), { top: bottomOf(sc) + 26, cx: W / 2 });
        },
        // One type size, the letters spaced out so every line is the same width.
        "7.2"(svg, W) {
            const TW = W - M * 2;
            const s = 100;
            spreadWord(svg, "HIDE", M, 120, s, TW);
            spreadWord(svg, "AND", M, 212, s, TW);
            const seek = spreadWord(svg, "SEEK", M, 304, s, TW);
            const sc = scribble(svg, { x: seek.x, y: seek.y, w: TW, h: seek.h }, { seed: "p72" });
            place(tucked(svg, { seed: "t72", size: 84, ...TUCK_A }), { top: bottomOf(sc) + 22, cx: W / 2 });
        },
        // The same-width block, flush left, with L1's STALK.
        "7.3"(svg, W) {
            const TW = W - M * 2 - 40;
            const hide = fitWord(svg, "HIDE", M, 36, TW);
            const and = fitWord(svg, "AND", M, hide.base + 16, TW);
            const seek = fitWord(svg, "SEEK", M, and.base + 16, TW);
            const sc = scribble(svg, seek, { seed: "p73" });
            place(scrawl(svg), { top: bottomOf(sc) + 24, x: M + 30 });
        },
        // The whole unit one width, STALK included.
        "7.4"(svg, W) {
            const TW = W - M * 2;
            const hide = fitWord(svg, "HIDE", M, 30, TW);
            const and = fitWord(svg, "AND", M, hide.base + 14, TW);
            const seek = fitWord(svg, "SEEK", M, and.base + 14, TW);
            const sc = scribble(svg, seek, { seed: "p74" });
            place(tucked(svg, { seed: "t74", size: 90, ...TUCK_A, tilt: -2 }), { top: bottomOf(sc) + 20, x: M, width: TW });
        },
        // Header as in L12, and the icon as H & in type, S by hand.
        "12.1"(svg, W) {
            const line = document.createElementNS(NS, "rect");
            Object.entries({ x: 0, y: 96, width: W, height: 3, fill: "#000" }).forEach(([k, v]) => line.setAttribute(k, v));
            svg.appendChild(line);
            const a = word(svg, "HIDE &", 20, 64, 28);
            const seek = word(svg, "SEEK", a.x + a.w + 9, 64, 28);
            ink(svg, Ink.pencilScribble(seek.x + 1, seek.y - 1, seek.w - 2, seek.h + 2, { seed: "p121", passes: 3, weight: 6 }));
            stalk(svg, seek.x + seek.w + 14, 80, 34, { seed: "L12s", weight: 6, tilt: -8 });
            const icon = (ix, iy, sz, dark, layout) => {
                const sq = document.createElementNS(NS, "rect");
                Object.entries({ x: ix, y: iy, width: sz, height: sz, rx: sz * 0.22, fill: dark ? "#000" : "#fff", stroke: "#000", "stroke-width": 3 }).forEach(([k, v]) => sq.setAttribute(k, v));
                svg.appendChild(sq);
                const fill = dark ? "#fff" : "#000";
                if (layout === "row") {
                    const h = word(svg, "H&", ix + sz * 0.1, iy + sz * 0.62, sz * 0.34, { fill });
                    const g = ink(svg, Ink.write("S", { x: 0, y: 0, size: sz * 0.4, weight: sz * 0.08, seed: `ic${ix}`, tilt: -8, mess: 0.5 }).svg);
                    const b = g.getBBox();
                    const k = (sz * 0.44) / b.height;
                    g.setAttribute("transform", `translate(${h.x + h.w + sz * 0.05 - b.x * k} ${h.y - sz * 0.1 - b.y * k}) scale(${k})`);
                } else {
                    const h = word(svg, "H&", ix + sz * 0.13, iy + sz * 0.46, sz * 0.36, { fill });
                    const g = ink(svg, Ink.write("S", { x: 0, y: 0, size: sz * 0.42, weight: sz * 0.085, seed: `ic${ix}`, tilt: -10, mess: 0.5 }).svg);
                    place(g, { top: h.base + sz * 0.06, x: ix + sz * 0.42 });
                }
            };
            icon(24, 150, 150, false, "row");
            icon(200, 150, 150, false, "stack");
            icon(24, 340, 104, true, "row");
            icon(148, 340, 104, false, "row");
            icon(272, 364, 60, false, "row");
            ink(svg, Ink.write("H & IN TYPE, S BY HAND", { x: 24, y: 330, size: 15, seed: "L121n", weight: 2.4, color: "#000", mess: 0.25, tilt: -2 }).svg);
            ink(svg, Ink.write("DARK MODE?", { x: 30, y: 472, size: 14, seed: "L121d", weight: 2.4, color: "#000", mess: 0.25, tilt: 3 }).svg);
        },
    });

    // ---------------------------------------------------------------------
    // Round 1, third pass: a rounder, balanced scribble (L13), a wilder
    // STALK with even spacing (L14), SEEK crossed out (L15), the same-width
    // block smaller and centred (L7.5), one app icon (L12.2).
    // ---------------------------------------------------------------------

    /** The new scribble, over a typeset box. */
    const round = (svg, box, o = {}) => ink(svg, Ink.roundScribble(box.x + 2, box.y, box.w - 4, box.h, { ...o, weight: box.h * (o.weight ?? 0.2) }));

    /** STALK at the top of the handwriting band: even gaps, a loose hand. */
    const WILD = { sizes: [1.06, 0.94, 1.02, 0.95, 1.0], rises: [0.02, -0.02, 0.03, 0, 0.02] };
    const wildOpts = (o = {}) => ({ seed: "w1", size: 74, mess: 1.15, tilt: -4, ...WILD, spin: 5, overshoot: 0.05, ...o });
    const wild = (svg, o = {}) => tucked(svg, wildOpts(o));

    /** A plain stack whose SEEK is scribbled by `mark`, STALK below. */
    function lockup(svg, mark, st, o = {}) {
        const seek = stack(svg);
        const m = mark(svg, seek);
        const b = m.getBBox();
        place(st(svg), { top: Math.max(b.y + b.height, seek.base) + (o.gap ?? 18), x: seek.x + seek.w * (o.at ?? 0.16), width: o.width });
    }

    const S13 = { seed: "w13" };
    Object.assign(LOCKUPS, {
        "13.1"(svg) {
            lockup(svg, (s, k) => round(s, k, { seed: "r131", weight: 0.16 }), (s) => wild(s, S13), { gap: 2 });
        },
        "13.2"(svg) {
            lockup(svg, (s, k) => round(s, k, { seed: "r132", round: [0.7, 1], weight: 0.16 }), (s) => wild(s, S13));
        },
        "13.3"(svg) {
            lockup(svg, (s, k) => round(s, k, { seed: "r133", round: [0.1, 0.9], fly: 0.45 }), (s) => wild(s, S13));
        },
        "13.4"(svg) {
            lockup(svg, (s, k) => round(s, k, { seed: "r134", passes: 5, weight: 0.18 }), (s) => wild(s, S13));
        },
        "13.5"(svg) {
            lockup(svg, (s, k) => round(s, k, { seed: "r135", passes: 3, fly: 0.6, weight: 0.23 }), (s) => wild(s, S13));
        },
        "13.6"(svg) {
            lockup(svg, (s, k) => round(s, k, { seed: "r136", slant: 0.07, round: [0.3, 0.8] }), (s) => wild(s, S13));
        },
    });

    /** An earlier STALK (plain scrawl), pushed up the band, gaps made even. */
    const loose = (svg, o) => ink(svg, Ink.write("STALK", { glyphs: o.glyphs, extra: o.extra, x: 0, y: 0, size: o.size ?? 78, weight: (o.size ?? 78) * 0.18 * (o.bold ?? 1), seed: o.seed, mess: o.mess ?? 1.15, tilt: o.tilt ?? -3, spacing: o.spacing ?? 0.15, even: true }).svg);
    const R14 = (s, k) => round(s, k, { seed: "r131", weight: 0.16 });
    Object.assign(LOCKUPS, {
        // L1.3's STALK, wilder, even gaps.
        "14.1"(svg) {
            lockup(svg, R14, (s) => loose(s, { seed: "L8s" }));
        },
        // L3.1's STALK, under SEEK instead of over it.
        "14.2"(svg) {
            lockup(svg, R14, (s) => loose(s, { seed: "L3s", size: 84, tilt: -8, mess: 1.1, spacing: 0.05 }), { at: 0.08 });
        },
        // Tucked, letters close to one size.
        "14.3"(svg) {
            lockup(svg, R14, (s) => wild(s, { seed: "w143" }));
        },
        // Tucked, the K pulled in against the L.
        "14.4"(svg) {
            lockup(svg, R14, (s) => wild(s, { seed: "w144", sizes: [1.06, 0.94, 1.02, 0.96, 0.9], rises: [0.14, -0.02, 0.03, 0, 0.16], gap: 0, pulls: [0, 0, 0, 0, 0.05] }));
        },
        // Tucked, top of the band: more lean, overshooting strokes.
        "14.5"(svg) {
            lockup(svg, R14, (s) => wild(s, { seed: "w145", mess: 1.3, spin: 9, overshoot: 0.1, tilt: -6 }));
        },
        // L2.2 again: HIDE / & SEEK, a big tucked STALK, sizes closer, K tucked in.
        "14.6"(svg) {
            const s = 96;
            word(svg, "HIDE", M, 126, s);
            const amp = word(svg, "&", M, 222, s);
            const seek = word(svg, "SEEK", amp.x + amp.w + 18, 222, s);
            const m = round(svg, { ...seek, w: seek.w - 12 }, { seed: "r146", passes: 3 });
            const b = m.getBBox();
            place(wild(svg, { seed: "w146", size: 104, sizes: [1.1, 0.92, 1.02, 0.96, 0.92], rises: [0.02, -0.03, 0.03, 0, 0.14], gap: 0 }), { top: b.y + b.height + 18, x: M, width: canvasW - EDGE * 2 - 20 });
        },
    });

    // SEEK crossed out rather than scribbled.
    const cross = (style, seed) => (s, k) => ink(s, Ink.crossOut(k.x, k.y, k.w, k.h, { style, seed, weight: k.h * 0.19 }));
    Object.assign(LOCKUPS, {
        "15.1"(svg) {
            lockup(svg, cross("one", "c151"), (s) => wild(s, { seed: "w143" }));
        },
        "15.2"(svg) {
            lockup(svg, cross("two", "c152"), (s) => wild(s, { seed: "w143" }));
        },
        "15.3"(svg) {
            lockup(svg, cross("back", "c153"), (s) => wild(s, { seed: "w143" }));
        },
        "15.4"(svg) {
            lockup(svg, cross("x", "c154"), (s) => wild(s, { seed: "w143" }));
        },
    });

    Object.assign(LOCKUPS, {
        // L7.3 centred and smaller: the same-width block with room around it.
        "7.5"(svg, W) {
            const TW = W - M * 2 - 90;
            const x = (W - TW) / 2;
            const hide = fitWord(svg, "HIDE", x, 56, TW);
            const and = fitWord(svg, "AND", x, hide.base + 14, TW);
            const seek = fitWord(svg, "SEEK", x, and.base + 14, TW);
            const m = round(svg, seek, { seed: "r175" });
            const b = m.getBBox();
            place(wild(svg, { seed: "w143", size: 60 }), { top: b.y + b.height + 16, cx: W / 2 });
        },
        // The same, keeping L7.1's scribble.
        "7.6"(svg, W) {
            const TW = W - M * 2 - 90;
            const x = (W - TW) / 2;
            const hide = fitWord(svg, "HIDE", x, 56, TW);
            const and = fitWord(svg, "AND", x, hide.base + 14, TW);
            const seek = fitWord(svg, "SEEK", x, and.base + 14, TW);
            const m = scribble(svg, seek, { seed: "p71", even: true });
            const b = m.getBBox();
            place(wild(svg, { seed: "w143", size: 60, weights: [1, 1, 1, 1, 1.3] }), { top: b.y + b.height + 16, cx: W / 2 });
        },
        // The app icon: H & in type, S by hand at the H's height, even gaps.
        "12.2"(svg, W) {
            const sz = 220;
            const ix = (W - sz) / 2;
            const iy = 80;
            const sq = document.createElementNS(NS, "rect");
            Object.entries({ x: ix, y: iy, width: sz, height: sz, fill: "#fff", stroke: "#000", "stroke-width": 3 }).forEach(([k, v]) => sq.setAttribute(k, v));
            svg.appendChild(sq);
            const size = sz * 0.44;
            const h = word(svg, "H", 0, 0, size);
            const amp = word(svg, "&", 0, 0, size);
            const g = ink(svg, Ink.write("S", { x: 0, y: 0, size, weight: size * 0.2, seed: "ic122", tilt: -6, mess: 1 }).svg);
            const gb = g.getBBox();
            const k = h.h / gb.height;
            const gap = size * 0.08;
            const total = h.w + gap + amp.w + gap + gb.width * k;
            let cx = ix + (sz - total) / 2;
            const base = iy + sz / 2 + h.h / 2;
            const put = (w) => {
                w.el.setAttribute("x", cx - (w.x - Number(w.el.getAttribute("x"))));
                w.el.setAttribute("y", base);
                cx += w.w + gap;
            };
            put(h);
            put(amp);
            g.setAttribute("transform", `translate(${cx - gb.x * k} ${base - h.h - gb.y * k}) scale(${k})`);
        },
    });

    // Fifth pass: the stack flush left, L7.6's scribble (even), and the STALK
    // of L14.2 or L14.4 at different sizes and places.
    const P76 = (s, k) => scribble(s, k, { seed: "p71", even: true });
    const P76light = (s, k) => scribble(s, k, { seed: "p71", even: true, weight: k.h * 0.16 });
    // Final touches: the K's stem runs longer, above and below the rest of it;
    // the L gets a real corner (a curved one read as a J or a C).
    const K_LONG = [0.62, [[[0, -0.14], [0, 1.12]], [[0.6, 0], [0.03, 0.56], [0.64, 1]]]];
    const L_SHARP = [0.46, [[[0, 0], [0, 0.93], [0.01, 1], [0.07, 1.01], [0.42, 1]]]];
    const S142 = (o = {}) => (s) => loose(s, { seed: "L3s", size: 84, tilt: -8, mess: 1.1, spacing: 0.05, ...o });
    const S144o = (o = {}) => ({ seed: "w144", sizes: [1.06, 0.94, 1.02, 0.96, 0.9], rises: [0.14, -0.02, 0.03, 0, 0.16], gap: 0, pulls: [0, 0, 0, 0, 0.05], ...o });
    const S144 = (o = {}) => (s) => wild(s, S144o(o));
    // The chosen logo's STALK (L16.6b), also drawn on its own in the app's header.
    const FINAL_STALK = wildOpts(S144o({ size: 64, glyphs: { K: K_LONG } }));
    Object.assign(LOCKUPS, {
        "16.1"(svg) {
            lockup(svg, P76, S142(), { at: 0.08, gap: 8 });
        },
        "16.2"(svg) {
            lockup(svg, P76, S142(), { at: 0, gap: 6, width: 300 });
        },
        "16.3"(svg) {
            lockup(svg, P76, S142({ size: 70 }), { at: 0.3, gap: 4 });
        },
        "16.4"(svg) {
            lockup(svg, P76, S144(), { at: 0.1, gap: 8 });
        },
        "16.5"(svg) {
            lockup(svg, P76, S144(), { at: 0, gap: 6, width: 300 });
        },
        "16.6"(svg) {
            lockup(svg, P76, S144({ size: 64 }), { at: 0.34, gap: 2 });
        },
        // The two kept, each with STALK bolder (a) or the scribble lighter (b).
        "16.3a"(svg) {
            lockup(svg, P76, S142({ size: 70, bold: 1.3 }), { at: 0.3, gap: 4 });
        },
        "16.3b"(svg) {
            lockup(svg, P76light, S142({ size: 70 }), { at: 0.3, gap: 4 });
        },
        "16.6a"(svg) {
            lockup(svg, P76, S144({ size: 64, weights: [1.3, 1.3, 1.3, 1.3, 1.3] }), { at: 0.34, gap: 2 });
        },
        // L14.2's STALK at the size and place L14.4's has in L16.6b.
        "16.3c"(svg) {
            const seek = stack(svg);
            const m = P76light(svg, seek);
            const b = m.getBBox();
            const top = Math.max(b.y + b.height, seek.base) + 2;
            const ref = S144({ size: 64 })(svg);
            const r = place(ref, { top, x: seek.x + seek.w * 0.34 });
            ref.remove();
            const g = S142({ size: 70, glyphs: { K: K_LONG, L: L_SHARP }, extra: [0, 0, 0.16, 0.4] })(svg);
            // Same width and the same vertical middle as the reference.
            const at = place(g, { top, x: r.x, width: r.w });
            g.setAttribute("transform", g.getAttribute("transform").replace(/translate\(([-\d.]+) ([-\d.]+)\)/, (_, x, y) => `translate(${x} ${Number(y) + (r.h - at.h) / 2 + 4})`));
        },
        "16.6b"(svg) {
            lockup(svg, P76light, (s) => tucked(s, FINAL_STALK), { at: 0.34, gap: 2 });
        },
        // L16.6b with the scribble a touch lighter, closer to STALK's own stroke.
        "16.6b1"(svg) {
            lockup(svg, (s, k) => scribble(s, k, { seed: "p71", even: true, weight: k.h * 0.135 }), S144({ size: 64, glyphs: { K: K_LONG } }), { at: 0.34, gap: 2 });
        },
        // L16.6b, adjusted: a heavier T; S, T and A each nudged right so nothing
        // touches; the K raised and pulled left to sit inside the L's foot; no
        // pointed stroke ends.
        "16.6c"(svg) {
            lockup(svg, P76light, S144({ size: 64, glyphs: { K: K_LONG }, weights: [1, 1.35, 1, 1, 1], pulls: [-0.06, -0.2, -0.05, -0.06, 0.1], rises: [0.14, -0.02, 0.03, 0, 0.24], blunt: true }), { at: 0.34, gap: 2 });
        },
    });

    window.Logo = {
        count: Object.keys(LOCKUPS).length,
        /** L16.6b's STALK alone, as Ink.tuck draws it ({ svg, box }): the app's header. */
        stalk: (o = {}) => Ink.tuck("STALK", { ...FINAL_STALK, ...o }),
        draw(svg, v, W, H, o = {}) {
            canvasW = W;
            TYPE = o.dark ? "#fff" : "#000";
            LOCKUPS[v](svg, W, H);
            TYPE = "#000";
        },
    };
})();
