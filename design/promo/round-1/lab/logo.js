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

    /** Typeset one word and return its box (cap-height box, not the em box). */
    function word(svg, text, x, y, size, o = {}) {
        const t = document.createElementNS(NS, "text");
        t.setAttribute("x", x);
        t.setAttribute("y", y);
        t.setAttribute("font-family", FONT);
        t.setAttribute("font-weight", "700");
        t.setAttribute("font-size", size);
        t.setAttribute("letter-spacing", o.tracking ?? `${-0.02 * size}`);
        t.setAttribute("fill", o.fill ?? "#000");
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

    window.Logo = {
        count: Object.keys(LOCKUPS).length,
        draw(svg, v, W, H) {
            canvasW = W;
            LOCKUPS[v](svg, W, H);
        },
    };
})();
