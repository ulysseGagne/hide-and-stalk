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
            m += `<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${Ink.RED}"/>`;
            m += `<text x="${W / 2}" y="${top + h / 2 + 8}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="23" letter-spacing="0.06em" fill="#fff">${label}</text>`;
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

    function hand(root, v, W, H) {
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
        draw(root, v) {
            WELCOME[v](root);
        },
        hand,
        button,
    };
})();
