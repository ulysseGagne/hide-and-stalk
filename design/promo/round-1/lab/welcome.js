/* global Ink, Logo, Board */

// The welcome screens (set W): the app's first screen, a title card with the
// button at the bottom. Logo in the top half, a board in the bottom half,
// composed from sets L and B at phone size (375 x 812, iPhone 12 mini points).
//
// Also the handwriting comparison (set H).

(function () {
    const FONT = "Arimo, 'Helvetica Neue', Helvetica, Arial, sans-serif";
    const NS = "http://www.w3.org/2000/svg";
    const SAFE_TOP = 50;
    const SAFE_BOTTOM = 34;

    function svgEl(W, H) {
        const s = document.createElementNS(NS, "svg");
        s.setAttribute("width", W);
        s.setAttribute("height", H);
        s.style.cssText = "position:absolute;left:0;top:0;overflow:visible";
        return s;
    }

    /** A logo lockup, drawn at 375 wide and scaled into a slot. */
    function logoSlot(root, v, { top, height, scale = 1, dark = false }) {
        const box = document.createElement("div");
        box.style.cssText = `position:absolute;left:0;top:${top}px;width:375px;height:${height}px;overflow:hidden`;
        const svg = document.createElementNS(NS, "svg");
        svg.setAttribute("width", 375);
        svg.setAttribute("height", height);
        svg.setAttribute("viewBox", `0 0 ${375 / scale} ${height / scale}`);
        box.appendChild(svg);
        root.appendChild(box);
        Logo.draw(svg, v, 375 / scale, 520);
        if (dark) box.style.background = "#000";
    }

    /** A board, drawn at 375 x 440 and scaled into a slot. */
    function boardSlot(root, v, { top, height, scale }) {
        const box = document.createElement("div");
        const k = scale ?? height / 440;
        box.style.cssText = `position:absolute;left:${(375 - 375 * k) / 2}px;top:${top}px;width:375px;height:440px;transform:scale(${k});transform-origin:0 0;overflow:hidden`;
        root.appendChild(box);
        Board.draw(box, v, 375, 440);
    }

    /**
     * The button. Styles:
     *  fill   coloured in red like a child would, black label
     *  solid  plain black slab, white label
     *  ring   white with a black edge, the label circled in red
     *  red    solid red slab, white label, an arrow pointing at it
     */
    function button(root, { label, style = "fill", dark = false, y }) {
        const W = 375;
        const h = 60;
        const x = 20;
        const w = W - 40;
        const top = y ?? 812 - SAFE_BOTTOM - h - 14;
        const ink = dark ? "#fff" : "#000";
        const paper = dark ? "#000" : "#fff";
        const wrap = document.createElement("div");
        wrap.style.cssText = `position:absolute;left:0;top:0;width:${W}px;height:812px;pointer-events:none;z-index:60`;
        const svg = svgEl(W, 812);
        let m = "";
        if (style === "fill") {
            m += `<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${paper}" stroke="${ink}" stroke-width="3"/>`;
            m += Ink.scribbleFill(x, top, w, h, { seed: `btn${label}`, weight: 11, misses: 0.06, overshoot: 7 });
            // Typed over the scribble afterwards: a white halo keeps it legible.
            m += `<text x="${W / 2}" y="${top + h / 2 + 8}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="23" letter-spacing="0.06em" fill="${ink}" stroke="${paper}" stroke-width="7" stroke-linejoin="round" paint-order="stroke">${label}</text>`;
        } else if (style === "solid") {
            m += `<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${ink}"/>`;
            m += `<text x="${W / 2}" y="${top + h / 2 + 8}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="23" letter-spacing="0.06em" fill="${paper}">${label}</text>`;
            m += Ink.underline(W / 2 - 70, top + h + 12, 140, { seed: "btnu", weight: 3.5 });
        } else if (style === "ring") {
            m += `<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${paper}" stroke="${ink}" stroke-width="3"/>`;
            m += `<text x="${W / 2}" y="${top + h / 2 + 8}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="23" letter-spacing="0.06em" fill="${ink}">${label}</text>`;
            m += Ink.circle(W / 2, top + h / 2, label.length * 9 + 26, 24, { seed: `ring${label}`, weight: 4 });
        } else if (style === "red") {
            // Coloured in hard, nearly solid, still going over the edges.
            m += Ink.scribbleFill(x, top, w, h, { seed: `red${label}`, weight: 14, gap: 9, overshoot: 6, misses: 0.03 });
            m += `<text x="${W / 2}" y="${top + h / 2 + 8}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="23" letter-spacing="0.06em" fill="${ink}" stroke="${paper}" stroke-width="7" stroke-linejoin="round" paint-order="stroke">${label}</text>`;
        }
        svg.innerHTML = m;
        wrap.appendChild(svg);
        root.appendChild(wrap);
    }

    function caption(root, text, { y, dark = false, align = "left" }) {
        const d = document.createElement("div");
        d.style.cssText = `position:absolute;left:20px;right:20px;top:${y}px;font:700 10.5px ${FONT};letter-spacing:.14em;color:${dark ? "#fff" : "#000"};text-align:${align};z-index:61`;
        d.textContent = text;
        root.appendChild(d);
    }

    function inkLayer(root, markup) {
        const svg = svgEl(375, 812);
        svg.style.zIndex = 70;
        svg.innerHTML = markup;
        root.appendChild(svg);
    }

    const WELCOME = {
        // Title only, the poster's lockup stacked.
        1(root) {
            logoSlot(root, 1, { top: 150, height: 470 });
            button(root, { label: "ENTER", style: "fill" });
        },
        // Title only, the & version, with one quiet line of context.
        2(root) {
            logoSlot(root, 2, { top: 140, height: 440 });
            caption(root, "CAMPUS HIDE & SEEK · UNIVERSITÉ LAVAL", { y: 620 });
            button(root, { label: "I'M IN", style: "solid" });
        },
        // Title only, on black.
        3(root) {
            root.style.background = "#000";
            logoSlot(root, 11, { top: 150, height: 470, dark: true });
            button(root, { label: "LET ME IN", style: "ring", dark: true });
        },
        // Title + the minimal board.
        4(root) {
            logoSlot(root, 1, { top: SAFE_TOP, height: 380, scale: 0.86 });
            boardSlot(root, 1, { top: 408, height: 284 });
            button(root, { label: "ENTER", style: "fill" });
        },
        // Title + the question chain.
        5(root) {
            logoSlot(root, 1, { top: SAFE_TOP, height: 360, scale: 0.8 });
            boardSlot(root, 2, { top: 392, height: 300 });
            button(root, { label: "JOIN THE HUNT", style: "solid" });
        },
        // Centred title + the map with everything strung to the spot.
        6(root) {
            logoSlot(root, 7, { top: SAFE_TOP, height: 350, scale: 0.8 });
            boardSlot(root, 3, { top: 380, height: 312 });
            button(root, { label: "PLAY", style: "fill" });
        },
        // Big SEEK + the elimination map.
        7(root) {
            logoSlot(root, 6, { top: SAFE_TOP + 10, height: 330, scale: 0.84 });
            boardSlot(root, 7, { top: 372, height: 320 });
            button(root, { label: "START STALKING", style: "red" });
        },
        // Title + the photo board.
        8(root) {
            logoSlot(root, 1, { top: SAFE_TOP, height: 360, scale: 0.8 });
            boardSlot(root, 6, { top: 392, height: 300 });
            button(root, { label: "I'M IN", style: "ring" });
        },
        // All black: title + the black board.
        9(root) {
            root.style.background = "#000";
            logoSlot(root, 11, { top: SAFE_TOP, height: 360, scale: 0.8, dark: true });
            boardSlot(root, 5, { top: 392, height: 300 });
            button(root, { label: "ENTER", style: "red", dark: true });
        },
        // Title across SEEK + the chaos board.
        10(root) {
            logoSlot(root, 3, { top: SAFE_TOP, height: 350, scale: 0.8 });
            boardSlot(root, 4, { top: 380, height: 312 });
            button(root, { label: "LET ME IN", style: "fill" });
        },
        // & title + sticky notes.
        11(root) {
            logoSlot(root, 2, { top: SAFE_TOP, height: 340, scale: 0.8 });
            boardSlot(root, 9, { top: 372, height: 320 });
            button(root, { label: "JOIN THE HUNT", style: "fill" });
        },
        // Proofreader title + graph-paper board, with a note on the button.
        12(root) {
            logoSlot(root, 4, { top: SAFE_TOP, height: 390, scale: 0.8 });
            boardSlot(root, 11, { top: 404, height: 288 });
            button(root, { label: "ENTER", style: "ring" });
            inkLayer(root, Ink.write("YOU'RE NEXT", { x: 214, y: 716, size: 16, seed: "w12", tilt: -6, weight: 2.8 }).svg);
        },
    };

    // -------------------------------------------------------------------
    // Handwriting comparison
    // -------------------------------------------------------------------
    const SAMPLES = [
        ["NOT HERE!!", 30],
        ["NORTH OF POLLACK", 24],
        ["WITHIN 300 M???", 26],
    ];
    const LONG = "SHE WALKED PAST THE GREENHOUSES AT 13:42 THEN NOTHING";

    const measureCtx = document.createElement("canvas").getContext("2d");

    /** H2: a real handwriting font, shaken letter by letter. */
    function fontWrite(text, { x, y, size, seed, maxWidth = Infinity, color = Ink.RED }) {
        const r = Ink.rng(seed);
        let cx = 0;
        let out = "";
        const tilt = r.range(-3, 1);
        measureCtx.font = `650 ${size}px 'Shantell Sans'`;
        const est = measureCtx.measureText(text).width;
        for (const ch of text) {
            measureCtx.font = `650 ${size}px 'Shantell Sans'`;
            const w = measureCtx.measureText(ch === " " ? "\u00a0" : ch).width * r.range(0.95, 1.08);
            const over = Math.max(0, cx - (maxWidth - est * 0.3));
            const lift = est > maxWidth ? -(over * over) / (size * 12) : 0;
            const rotch = r.range(-7, 7) + (lift ? -over / 6 : 0);
            const s = size * r.range(0.9, 1.12);
            const bnce = Math.round(r.range(-100, 100));
            out += `<text x="${(x + cx).toFixed(1)}" y="${(y + r.range(-3, 3) + lift + (cx * Math.tan((tilt * Math.PI) / 180))).toFixed(1)}" font-family="'Shantell Sans'" font-weight="${Math.round(r.range(560, 700))}" font-size="${s.toFixed(1)}" fill="${color}" style="font-variation-settings:'BNCE' ${bnce}, 'INFM' 100" transform="rotate(${rotch.toFixed(1)} ${(x + cx).toFixed(1)} ${y})">${ch === " " ? "&#160;" : ch.replace("&", "&amp;")}</text>`;
            cx += (w * (est > maxWidth ? Math.max(0.86, maxWidth / est) : 1));
        }
        return out;
    }

    const HANDS = {
        1: { title: "H1 · DRAWN STROKES, CALM", mess: 0.35 },
        2: { title: "H2 · HANDWRITING FONT + SHAKE", font: true },
        3: { title: "H3 · DRAWN STROKES, UNHINGED", mess: 1.7 },
    };

    const label = (x, y, txt, o = {}) => `<text x="${x}" y="${y}" font-family="${FONT}" font-weight="${o.wt ?? 700}" font-size="${o.size ?? 10}" letter-spacing="0.08em" fill="#000"${o.anchor ? ` text-anchor="${o.anchor}"` : ""}>${txt}</text>`;

    /** H4: one line across the new band, score 0 (new calm) to 1 (new unhinged), between H1 and H3. */
    function spectrum(W) {
        let m = label(20, 34, "H4 · THE BAND: 30–70% FROM H1 TO H3", { size: 11 });
        const rows = [
            ["H1 (0%) · FOR REFERENCE, NOT USED", { mess: 0.35 }],
            ["SCORE 0 · 30% · THE NEW CALM", { score: 0 }],
            ["SCORE 0.25 · 40%", { score: 0.25 }],
            ["SCORE 0.5 · 50% · MOST TEXT", { score: 0.5 }],
            ["SCORE 0.75 · 60%", { score: 0.75 }],
            ["SCORE 1 · 70% · THE NEW UNHINGED", { score: 1 }],
            ["H3 (100%) · FOR REFERENCE, NOT USED", { mess: 1.7 }],
        ];
        let y = 92;
        rows.forEach(([txt, o], i) => {
            m += label(20, y - 38, txt, { wt: i === 0 || i === rows.length - 1 ? 400 : 700 });
            m += Ink.write("NORTH OF POLLACK", { x: 22, y, size: 25, seed: `h4-${i}`, ...o }).svg;
            y += 72;
        });
        m += `<line x1="248" y1="${y - 30}" x2="248" y2="${y + 56}" stroke="#000" stroke-dasharray="3 4"/>`;
        m += label(20, y - 36, "OUT OF ROOM, IT CURLS UP · SCORE 0.2 AND 0.8", { wt: 400 });
        m += Ink.write("CHECK THE GREENHOUSES", { x: 22, y: y + 6, size: 20, seed: "h4c", score: 0.2, maxWidth: 222 }).svg;
        m += Ink.write("CHECK THE GREENHOUSES", { x: 22, y: y + 52, size: 20, seed: "h4d", score: 0.8, maxWidth: 222 }).svg;
        return m;
    }

    /** H5: real app lines, each scored from its size and importance (no hand-tuning). */
    function scored(W) {
        let m = label(20, 34, "H5 · SCORED AUTOMATICALLY: SIZE + IMPORTANCE", { size: 11 });
        const LINES = [
            ["4:12 LEFT", 34, "key", "the timer"],
            ["NORTH", 30, "key", "an answer, big"],
            ["NOAH IS 160 M AWAY", 17, "key", "a warning, small"],
            ["THIS ONE", 20, "info", "pointing at a card"],
            ["Q5: EAST OR WEST OF ME?", 18, "info", "question on the map"],
            ["NO TAKE-BACKS.", 17, "aside", "a side note"],
            ["SHE WAS HERE", 26, "aside", "a map annotation"],
            ["GOT HER", 40, "vibe", "the ending"],
            ["I SEE YOU", 22, "vibe", "decoration"],
        ];
        let y = 58;
        for (const [txt, size, imp, what] of LINES) {
            const sc = Ink.score(size, imp);
            y += size + 8;
            m += Ink.write(txt, { x: 22, y, size, seed: `h5${txt}`, importance: imp }).svg;
            y += 20;
            m += label(22, y, `${what.toUpperCase()} · ${size} PX · ${imp.toUpperCase()} → SCORE ${sc.toFixed(2)}`, { wt: 400, size: 9 });
            y += 14;
        }
        return m;
    }

    function hand(root, v, W, H) {
        if (v === 4 || v === 5) {
            const svg = svgEl(W, H);
            svg.innerHTML = v === 4 ? spectrum(W) : scored(W);
            root.appendChild(svg);
            return;
        }
        const spec = HANDS[v];
        const svg = svgEl(W, H);
        let m = `<text x="20" y="34" font-family="${FONT}" font-weight="700" font-size="11" letter-spacing="0.14em">${spec.title}</text>`;
        let y = 94;
        for (const [text, size] of SAMPLES) {
            m += spec.font ? fontWrite(text, { x: 22, y, size: size * 1.25, seed: `${v}${text}` }) : Ink.write(text, { x: 22, y, size, seed: `${v}${text}`, mess: spec.mess }).svg;
            y += 62;
        }
        // Running out of room: the long note in a narrow column.
        m += `<line x1="250" y1="${y - 26}" x2="250" y2="${y + 110}" stroke="#000" stroke-dasharray="3 4"/>`;
        if (spec.font) {
            const words = LONG.split(" ");
            const lines = [words.slice(0, 4).join(" "), words.slice(4, 7).join(" "), words.slice(7).join(" ")];
            lines.forEach((l, i) => (m += fontWrite(l, { x: 22, y: y + i * 34, size: 24, seed: `${v}l${i}`, maxWidth: 225 })));
        } else {
            m += Ink.note(LONG, { x: 22, y, size: 19, maxWidth: 225, seed: `${v}long`, mess: spec.mess }).svg;
        }
        y += 150;
        // Marks on typeset text.
        m += `<text x="30" y="${y}" font-family="${FONT}" font-weight="700" font-size="22">Café Équilibre</text>`;
        m += Ink.circle(106, y - 8, 94, 24, { seed: `${v}c`, weight: 4 });
        m += spec.font ? fontWrite("THIS ONE", { x: 230, y: y + 50, size: 24, seed: `${v}t` }) : Ink.write("THIS ONE", { x: 230, y: y + 50, size: 19, seed: `${v}t`, mess: spec.mess }).svg;
        m += Ink.arrow(226, y + 34, 196, y + 10, { seed: `${v}a`, weight: 3.5 });
        svg.innerHTML = m;
        root.appendChild(svg);
    }

    window.Welcome = {
        count: Object.keys(WELCOME).length,
        /** More screens, registered by later files (welcome2.js). */
        extra: {},
        draw(root, v) {
            return (WELCOME[v] ?? this.extra[v])(root);
        },
        hand,
        button,
    };
})();
