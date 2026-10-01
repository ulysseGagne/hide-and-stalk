/* global L, turf, Ink, Campus, Maps, Logo, OSMDraw */

// Set M, second pass: the map screen rethought from the notes on M1-M26.
//
//   - Everything you need is computer-drawn: the map, the hints layer, the
//     players, the question (in a plain box at the top). With the red taken
//     away, the map still works.
//   - Red is the one thing to look at right now, and only one thing: with no
//     question waiting, the hints layer; while a question waits, only what
//     the question needs (the east/west line, the circle, the café pins), and
//     the hints layer steps aside.
//   - No auto-zoom: the map opens on the whole campus; players move it.
//   - Tiles in pure black and white. No text halos, no percentages.
//   - The players' name tags are the only thing ever drawn over the red:
//     above the hints, the question's marks and the answer's marks.

(function () {
    const W = 375;
    const H = 812;
    const R = Ink.RED;
    const FONT = "Arimo, 'Helvetica Neue', Helvetica, Arial, sans-serif";
    const HEAD = 104;
    const dist = (a, b) => turf.distance(turf.point(a), turf.point(b), { units: "meters" });

    // One game (the greenhouses), at different moments, plus a radius question from game 2.
    function state(name, upTo) {
        const g = Maps.GAMES[name]();
        const qs = g.qs.slice(0, upTo);
        const res = Campus.solve(g.hider, qs);
        return { ...g, qs, region: res.region };
    }

    const LUMA = `<feColorMatrix type="matrix" values="0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0.3 0.59 0.11 0 0  0 0 0 1 0"/>`;
    // A luma threshold: below c goes to `lo`, above to `hi` (200 steps, so c can be fine).
    const cut = (c, lo = 0, hi = 1) => Array.from({ length: 200 }, (_, i) => (i / 200 < c ? lo : hi)).join(" ");
    const ct = (c, attrs = "", lo, hi) => `<feComponentTransfer ${attrs}><feFuncR type="discrete" tableValues="${cut(c, lo, hi)}"/><feFuncG type="discrete" tableValues="${cut(c, lo, hi)}"/><feFuncB type="discrete" tableValues="${cut(c, lo, hi)}"/></feComponentTransfer>`;
    const tf = (id, c) => `<filter id="${id}" color-interpolation-filters="sRGB">${LUMA}${ct(c)}</filter>`;
    const EDGE = `<feConvolveMatrix order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true"/>${ct(0.01, "", 1, 0).replace(/tableValues="[^"]*"/g, 'tableValues="1 1 0 0 0 0 0 0 0 0"')}`;
    const pat = (w, body) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${w}'><rect width='${w}' height='${w}' fill='white'/>${body}</svg>`)}`;
    const HATCH = pat(7, "<path d='M-1 8L8 -1M-1 1L1 -1M6 8L8 6' stroke='black' stroke-width='1.6'/>");
    const DOTS = pat(6, "<circle cx='1.5' cy='1.5' r='1.1'/><circle cx='4.5' cy='4.5' r='1.1'/>");
    // Buildings (OSM's tan, luma ~0.83) filled with a pattern; lines and labels (luma < 0.7) black.
    const patterned = (id, href, w) => `<filter id="${id}" color-interpolation-filters="sRGB">${LUMA.replace("/>", ' result="l"/>')}
        ${ct(0.845, 'in="l" result="b"')}${ct(0.7, 'in="l" result="x"')}
        <feImage href="${href}" x="0" y="0" width="${w}" height="${w}" result="p"/><feTile in="p" result="t"/>
        <feBlend in="b" in2="t" mode="lighten" result="bt"/><feBlend in="bt" in2="x" mode="darken"/></filter>`;
    const FILTER = `<svg width="0" height="0" style="position:absolute"><defs>${tf("m2x", 0.7)}${tf("m2k", 0.8)}${tf("m2g", 0.86)}
        <filter id="m2l" color-interpolation-filters="sRGB">${LUMA}${EDGE}</filter>
        <filter id="m2L" color-interpolation-filters="sRGB">${LUMA}${EDGE}<feMorphology operator="erode" radius="0.8"/></filter>
        <filter id="m2w" color-interpolation-filters="sRGB">${LUMA}${EDGE.replace("/>", ' result="e"/>')}<feMorphology operator="erode" radius="0.5" result="e2"/>
            <feTurbulence type="fractalNoise" baseFrequency="0.025" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="e2" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G"/></filter>
        ${patterned("m2h", HATCH, 7)}${patterned("m2d", DOTS, 6)}
        <filter id="m2m" color-interpolation-filters="sRGB">${LUMA}${ct(0.75)}</filter>
        <filter id="m2N" color-interpolation-filters="sRGB">${LUMA.replace("/>", ' result="l"/>')}
            <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="3"/><feColorMatrix type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" result="n"/>
            <feComposite in="l" in2="n" operator="arithmetic" k2="1" k3="0.34" k4="-0.17"/>${ct(0.8)}</filter>
        <filter id="m2n" color-interpolation-filters="sRGB">${LUMA.replace("/>", ' result="l"/>')}
            <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="3"/><feColorMatrix type="matrix" values="1 0 0 0 0  1 0 0 0 0  1 0 0 0 0  0 0 0 0 1" result="n"/>
            <feComposite in="l" in2="n" operator="arithmetic" k2="1" k3="0.45" k4="-0.225"/>${ct(0.845)}</filter>
        <filter id="m2s" color-interpolation-filters="sRGB">${LUMA.replace("/>", ' result="l"/>')}${ct(0.995, 'in="l" result="r"', 1, 0)}${ct(0.62, 'in="l" result="x"')}<feBlend in="r" in2="x" mode="darken"/></filter>
        </defs></svg>`;
    // The skins: how the tiles are printed. Every one is the same OpenStreetMap tiles, filtered.
    const SKINS = {
        xerox: "url(#m2x)", xeroxdark: "url(#m2k)", ground: "url(#m2g)", grain: "url(#m2n)", hatch: "url(#m2h)", dots: "url(#m2d)",
        lines: "url(#m2l)", linesbold: "url(#m2L)", sketch: "url(#m2w)", streets: "url(#m2s)", grey: "grayscale(1) contrast(1.3)", osm: "none",
        xeroxmid: "url(#m2m)", grainlight: "url(#m2N)",
    };
    // Redrawn skins (retrace.js): the tiles sorted pixel by pixel, not filtered.
    const RETRACE = {
        traced: { roads: "all" },
        tracedthin: { roads: "fill" },
        traceddots: { roads: "all", dots: ["building"] },
        tracedgreen: { roads: "all", dots: ["green"] },
        tracedbold: { roads: "all", outline: 2, dots: ["building"] },
        // Third round: no text anywhere, so the kept filter skins are redrawn too.
        dotsonly: { roads: "fill", outlines: [], dots: ["building"] },
        tone: { mode: "tone", road: 1 },
        tonelight: { mode: "tone", road: 1, gamma: 1.8 },
        tonegrey: { mode: "tone", road: 0.72, gamma: 1.8 },
        dotsclean: { roads: "outline", outlines: ["building"], dots: ["building"] },
        streetsclean: { roads: "fill", outlines: [] },
        grainclean: { mode: "tone", pixel: true, road: "pixel" },
        // S04 exactly (the same grain filter), on tiles with the text taken out.
        grainnotext: { mode: "clean", filter: "url(#m2n)" },
        grainsamegreen: { mode: "clean", filter: "url(#m2n)", greenAs: "building" },
        grainlightgreen: { mode: "clean", filter: "url(#m2n)", greenAs: "residential" },
        xeroxnotext: { mode: "clean", filter: "url(#m2x)" },
        xeroxdarknotext: { mode: "clean", filter: "url(#m2k)" },
        greynotext: { mode: "clean", filter: "grayscale(1)" },
        // S27's grain with the order changed: buildings black, roads dark grey, greens light grey.
        grainshift: { mode: "clean", filter: "url(#m2n)", shift: true },
        grainreorder: { mode: "clean", filter: "url(#m2n)", recolor: { building: 0x000000, road: 0xc2c2c2, green: 0xe0dfdf } },
        // Xerox: roads and buildings black, everything else white.
        xeroxsolid: { roads: "all", outlines: [], solid: ["building"] },
        // The hints layer's map (S16), traced into straight lines instead of pixels.
        vector16: { mode: "vector", sharp: true, thin: true, outlines: ["building"], eps: 2, minLen: 14 },
        vector161: { mode: "vector", sharp: true, thin: true, roads: "outline", outlines: ["building"], eps: 2, minLen: 14 },
        // S2, simpler: no footpaths or parking aisles, no small shapes, straighter lines.
        vector161s: { mode: "vector", sharp: true, thin: true, roads: "outline", outlines: ["building"], eps: 3, minLen: 30, open: 2, minArea: 150 },
        vector161ss: { mode: "vector", sharp: true, thin: true, roads: "outline", outlines: ["building"], eps: 4.5, minLen: 50, open: 3, minArea: 400 },
        vector16g: { mode: "vector", sharp: true, thin: true, outlines: ["building", "green"], eps: 2, epsGreen: 3, minLen: 30 },
        // Sixth round.
        tracedoutline: { thin: true, roads: "outline" },
        centerline: { roads: "center", lineW: 2, dots: ["green"] },
        dotsgreen: { roads: "outline", outlines: ["building"], dots: ["building", "green"] },
        centerlinegreen: { roads: "center", lineW: 2, outlines: ["building"], dots: ["green"] },
        blackbuildings: { thin: true, outlines: [], solid: ["building"], dots: ["green"] },
    };

    // Drawn from OpenStreetMap's data instead of its tiles (osmdraw.js): S2, S3, S9 and S5 redone.
    const DATA_SKINS = {
        dataoutline: "outline", datasolid: "solid", datagrain: "grain", datadots: "dots", datakey: "key", datakey2: "key2", datakey3: "key3",
        // Decluttered: S11 without paths, S11 without dead ends, S14 without what doubles the streets or hangs loose.
        dataoutlinenopaths: { look: "outline", drop: "paths" },
        dataoutlinepruned: { look: "outline", prune: 60 },
        dataoutlineclean: { look: "outline", drop: "detail", prune: 60 },
        datadotsclean: { look: "dots", drop: "detail", prune: 60 },
        // Revived from the tile days, redrawn from the data.
        datablackroads: "blackroads", datablackdots: "blackdots", datafigure: "figure",
        // The three looks left (S11, S20, S14), showing only what the key keeps.
        dataoutlinekey: { look: "outline", key: 3 }, datablackdotskey: { look: "blackdots", key: 3 }, datadotskey: { look: "dots", key: 3 },
        // The key's fourth pass, and S20 drawn with it (hand edits from the key editor included).
        datakey4: "key4", datablackdotskey4: { look: "blackdots", key: 4 },
        // The same, with every road and path OpenStreetMap has: the gallery's S20 (S21 is the editor's).
        datablackdotsall: { look: "blackdots", key: 4, roads: "all" },
    };
    // The map under every screen that doesn't name its own skin (the hints
    // layer, the questions): S20, decided: every road and path OpenStreetMap
    // has, with the key's areas.
    const MAP_SKIN = "datablackdotsall";

    // The app around the map (direction E): header with MAP open, the question box.
    function chrome(box, v = 0) {
        // The app's header exactly (app/style-e.css, app/decorate.js's headerLogo),
        // MAP open: the same title, bell, Log out and tabs, to the pixel, so
        // nothing moves between the map and the app's other screens.
        const tab = (label, open) => `<div style="box-sizing:border-box;min-width:88px;height:${open ? 46 : 40}px;padding:0 12px;border:3px solid #000;border-bottom:none;background:${open ? "#fff" : "#000"};color:${open ? "#000" : "#fff"};font:700 16px ${FONT};letter-spacing:.12em;white-space:nowrap;display:flex;align-items:center;justify-content:center;margin-bottom:${open ? 0 : 3}px">${label}</div>`;
        // 104 px and the 3 px line under them, as the app has it (its border sits outside the height).
        const hdr = `<div style="position:absolute;left:0;top:0;width:${W}px;height:${HEAD + 3}px;background:#fff;border-bottom:3px solid #000;box-sizing:border-box;z-index:60;-webkit-font-smoothing:antialiased">
            <svg class="m2-title" width="200" height="42" style="position:absolute;left:12px;top:8px;overflow:visible"><text x="0" y="28" font-family="${FONT}" font-weight="700" font-size="19" letter-spacing="-0.3" fill="#000">HIDE &amp;</text></svg>
            <div style="position:absolute;right:98px;top:12px;width:40px;height:40px;box-sizing:border-box;border:3px solid #000;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg></div>
            <div style="position:absolute;right:12px;top:12px;height:40px;box-sizing:border-box;border:3px solid #000;padding:0 10px;font:700 14px ${FONT};display:flex;align-items:center">Log out</div>
            <div style="position:absolute;left:12px;bottom:-3px;display:flex;gap:6px;align-items:flex-end">${tab("MENU")}${tab("MAP", true)}${tab("QUESTIONS")}</div></div>`;
        // STALK goes on once the title is in the page (see titleInk): placed off
        // HIDE &'s measured box, as headerLogo does.
        const hdrInk = "";
        const q = `<div style="position:absolute;left:12px;top:${HEAD + 12}px;width:${W - 24}px;box-sizing:border-box;background:#fff;border:3px solid #000;padding:12px 14px;z-index:55;font-family:${FONT}">
            <div style="display:flex;justify-content:space-between;font:700 13px ${FONT};letter-spacing:.12em"><span>${box.kicker}</span><span>${box.clock ?? ""}</span></div>
            ${box.text ? `<div style="margin-top:6px;font:700 20px/1.2 ${FONT};letter-spacing:-.01em">${box.text}</div>` : ""}
            ${box.legend ? `<div style="margin-top:6px;font:400 14px/1.3 ${FONT}">${box.legend}</div>` : ""}</div>`;
        // A note by hand at the right of the box's top line (N15: how far the closest stalker is).
        let hand = "";
        if (box.hand) {
            const o = { size: 15, seed: `bh${v}`, tilt: -2, importance: "info", weight: 15 * 0.24 };
            hand = Ink.write(box.hand, { ...o, x: W - 12 - 14 - Ink.write(box.hand, o).width, y: HEAD + 12 + 34 }).svg;
        }
        return { html: hdr + q, ink: hdrInk + hand };
    }

    /**
     * Ways to make the players stand out, still black and white only:
     *   big      bigger tags, a heavier pointer, a dot on the exact spot
     *   ink      every tag solid black; YOU white with a double edge
     *   sticker  each tag cut out of the map: a wide white margin around it
     *   shadow   a solid black block offset under each tag, like a raised card
     *   marker   a black square with a white ring on the spot, the name beside it
     */
    let TAGS = "base";
    let PENDING = [];
    const tagFont = (fs) => `700 ${fs}px/1 ${FONT}`;
    const cv = document.createElement("canvas").getContext("2d");
    /** Size of a tag in the current style. */
    // In "ink", a stalker's tag is exactly the original YOU tag: same size, no ring.
    const plain = (t) => TAGS === "base" || (TAGS === "ink" && !t.self);
    function tagBox(t) {
        const fs = TAGS === "big" ? 15 : plain(t) ? 12 : 13;
        cv.font = tagFont(fs);
        const w = cv.measureText(t.label).width + fs * 1.3 + 12;
        const h = TAGS === "big" ? 30 : plain(t) ? 24 : 26;
        if (TAGS === "marker") return { fs: 14, w: w + 2, h: 26, x: t.x + 14, y: t.y - 13 };
        return { fs, w, h, x: t.x - w / 2, y: t.y - h - 12 };
    }
    /** Draw one tag at its (possibly moved) box, with a leader line if it was moved. */
    function tagHtml(t, bx, part) {
        const { x, y, label, self } = t;
        const { fs, w, h } = bx;
        const left = bx.x;
        const top = bx.y + t.dy;
        let out = "";
        const moved = t.dy !== 0;
        if (TAGS === "marker") {
            const sq = self ? 16 : 13;
            out += `<div style="position:absolute;left:${x - sq / 2 - 4}px;top:${y - sq / 2 - 4}px;width:${sq + 8}px;height:${sq + 8}px;background:#fff"></div><div style="position:absolute;left:${x - sq / 2}px;top:${y - sq / 2}px;width:${sq}px;height:${sq}px;background:#000"></div>`;
            if (part === "lead") return moved ? `<div style="position:absolute;left:${x - 1.5}px;top:${top + h / 2}px;width:3px;height:${y - top - h / 2}px;background:#000"></div><div style="position:absolute;left:${x}px;top:${top + h / 2 - 1.5}px;width:${left - x}px;height:3px;background:#000"></div>` : "";
            return out + `<div style="position:absolute;left:${left}px;top:${top}px;height:${h}px;width:${w}px;box-sizing:border-box;padding:0 7px;background:${self ? "#000" : "#fff"};color:${self ? "#fff" : "#000"};border:3px solid #000;box-shadow:0 0 0 3px #fff;font:${tagFont(fs)};line-height:${h - 6}px;letter-spacing:.06em">${label}</div>`;
        }
        if (part === "lead") return moved ? `<div style="position:absolute;left:${x - 1.5}px;top:${top + h}px;width:3px;height:${y - top - h}px;background:#000;box-shadow:0 0 0 2px #fff"></div>` : "";
        const dark = TAGS === "ink" ? !self : self;
        // A white tag is one outlined shape, box and pointer together (Ta's
        // bubble): no filled triangle under a white box.
        if (TAGS === "base" && !dark && !moved) {
            const bb = bubble(x, y, label, w, h);
            return `<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0;overflow:visible"><path d="M${bb.pts.map((p) => p.join(" ")).join("L")}Z" fill="#fff" stroke="#000" stroke-width="3" stroke-linejoin="miter"/>${tagText(bb.cx, bb.cy, label)}</svg>`;
        }
        // Every style but the original gets a 3px white ring, so it reads on black too.
        const ring = plain(t) ? "" : ";box-shadow:0 0 0 3px #fff";
        const border = TAGS === "ink" && self ? "border:3px solid #000;outline:3px solid #fff;box-shadow:0 0 0 6px #000,0 0 0 9px #fff" : `border:3px solid #000${ring}`;
        if (TAGS === "sticker") out += `<div style="position:absolute;left:${left - 7}px;top:${top - 7}px;width:${w + 14}px;height:${h + 14}px;background:#fff"></div>`;
        if (TAGS === "shadow") out += `<div style="position:absolute;left:${left + 5}px;top:${top + 5}px;width:${w}px;height:${h}px;background:#000"></div>`;
        const pw = TAGS === "big" ? 9 : 7;
        if (!moved) out += `<div style="position:absolute;left:${x - pw}px;top:${top + h - 1}px;width:0;height:0;border-left:${pw}px solid transparent;border-right:${pw}px solid transparent;border-top:${TAGS === "big" ? 12 : 10}px solid #000"></div>`;
        out += `<div style="position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px;box-sizing:border-box;background:${dark ? "#000" : "#fff"};color:${dark ? "#fff" : "#000"};${border};font:${tagFont(fs)};line-height:${h - 6}px;letter-spacing:.06em;text-align:center">${label}</div>`;
        if (TAGS === "big" || TAGS === "sticker" || TAGS === "shadow" || moved) out += `<div style="position:absolute;left:${x - 5}px;top:${y - 5}px;width:10px;height:10px;background:#000;box-shadow:0 0 0 3px #fff"></div>`;
        return out;
    }
    /** A player (or, with place, a landmark): queued, so the tags can be spread out before drawing. */
    function tag(x, y, label, self, place = false) {
        PENDING.push({ x, y, label, self, place, dy: 0 });
        return "";
    }
    /** Draw every queued tag; any that would overlap one already placed moves up. */
    function flushTags() {
        const placed = [];
        const list = PENDING.sort((a, b) => b.y - a.y);
        const hit = (a, b) => a.x < b.x + b.w + 6 && b.x < a.x + a.w + 6 && a.y < b.y + b.h + 6 && b.y < a.y + a.h + 6;
        let html = "";
        const boxes = new Map();
        for (const t of list) {
            const bx = tagBox(t);
            if (TAGS !== "base") while (placed.some((p) => hit({ ...bx, y: bx.y + t.dy }, p))) t.dy -= 8;
            placed.push({ ...bx, y: bx.y + t.dy });
            boxes.set(t, bx);
        }
        // Leaders first, so no line crosses over a tag. Then the tags from the
        // top of the screen down: where two overlap, the lower one is on top.
        // A landmark's tag goes over the players'; YOU goes last, over
        // everything, so it is never hidden.
        const lvl = (t) => (t.self ? 2 : t.place ? 1 : 0);
        const order = [...list].sort((a, b) => lvl(a) - lvl(b) || boxes.get(a).y + a.dy - (boxes.get(b).y + b.dy));
        for (const t of order) html += tagHtml(t, boxes.get(t), "lead");
        for (const t of order) html += tagHtml(t, boxes.get(t), "body");
        PENDING = [];
        return html;
    }

    const ringsOf = (geom) => (geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates);
    const ringD = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("") + "Z";

    /** The dashed line of an east/west or north/south question, by hand. */
    function dashed(a, b, seed, weight = 4.2) {
        const r = Ink.rng(seed);
        const n = Ink.noise1(r);
        const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const ux = (b[0] - a[0]) / len;
        const uy = (b[1] - a[1]) / len;
        const pt = (s) => {
            const k = n(s / 110) * 5;
            return [a[0] + ux * s - uy * k, a[1] + uy * s + ux * k];
        };
        let out = "";
        for (let s = 0; s < len; s += 26) {
            const d = r.range(13, 19);
            // Round ends, the same width all along: no droplets.
            out += Ink.pathEl([pt(s), pt(s + d / 2), pt(s + d)], { size: weight, color: R, thinning: 0.04, taperEnd: 0, taperStart: 0 });
        }
        return out;
    }

    // Variants of a screen (N08.1 …): the base screen with one thing changed. They
    // keep the base screen's seeds, so everything else is drawn exactly the same.
    const VARIANTS = {
        "8.1": { pins: "push" },
        "8.2": { pins: "push", popup: true },
        // No circle at all: the place's black and white tag, and everyone's pins.
        "10.1": { mark: "tag", bare: true, label: "greenhouse" },
        // The same from the hider's side, as the post's maps are: the hider a little
        // south of the greenhouse (clear of its tag), two stalkers, as in the post.
        "10.2": { mark: "tag", bare: true, label: "greenhouse", view: "hider", hiderShift: [-40, -150], only: ["noah", "camille"] },
        // The hider between questions with two stalkers, as in the post (noah is still the closest: 162 M).
        "15": { only: ["noah", "camille"] },
        // The hints layer with one player tapped: her name shows above her pin.
        "3a.1": { tapped: "camille" },
        // N08 with the map pins filled in, the dot a hole; and a café tapped.
        "8a": { pins: "filled" },
        // N08 with the glossy map pin: G4.1, the one decided.
        "8b": { pins: "gloss", gloss: "4.1" },
        "8.2a": { pins: "filled", popup: true },
    };

    async function draw(root, code) {
        const v = parseInt(String(code), 10);
        // "08.2a" and "8.2a" are the same variant.
        const o = { ...LIST[v - 1], ...(VARIANTS[String(code).replace(/^0+(?=\d)/, "")] ?? {}) };
        const skin = o.skin ?? MAP_SKIN;
        TAGS = o.tags ?? "base";
        const g = o.g ?? state(o.game, o.upTo);
        // Post conventions on older screens: only some of the stalkers, the hider moved (metres east, north).
        if (o.only) g.pos = Object.fromEntries(Object.entries(g.pos).filter(([n]) => o.only.includes(n)));
        if (o.hiderShift) g.hider = Maps.off(g.hider, ...o.hiderShift);
        root.style.background = "#fff";
        root.insertAdjacentHTML("beforeend", FILTER);
        // The colour-coded key map is shown bare: the whole screen is map, no app around it.
        const bare = ["datakey", "datakey2", "datakey3", "datakey4"].includes(skin);
        const mapEl = document.createElement("div");
        mapEl.style.cssText = `position:absolute;left:0;top:${bare ? 0 : HEAD}px;width:${W}px;height:${bare ? H : H - HEAD}px;z-index:0;background:#fff`;
        root.appendChild(mapEl);
        const map = L.map(mapEl, { zoomControl: false, attributionControl: true, zoomSnap: 0, fadeAnimation: false, zoomAnimation: false });
        map.attributionControl.setPrefix(false);
        const redraw = RETRACE[skin];
        const data = DATA_SKINS[skin];
        // Redrawn tiles are stretched a pixel so no seam shows between them.
        if (redraw) mapEl.insertAdjacentHTML("beforeend", `<style>.leaflet-tile{width:${redraw.sharp ? 129 : 257}px!important;height:${redraw.sharp ? 129 : 257}px!important}</style>`);
        const tiles = data ? null : (redraw ? Retrace.layer(redraw) : L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" })).addTo(map);
        if (tiles) mapEl.querySelector(".leaflet-tile-pane").style.filter = redraw ? redraw.filter ?? "none" : SKINS[skin];
        else map.attributionControl.addAttribution("© OpenStreetMap");
        // The whole campus, below the question box: no auto-zoom.
        const ring = Campus.layers.campus.ring;
        map.fitBounds(L.latLngBounds(ring.map(([lng, lat]) => [lat, lng])), { paddingTopLeft: [10, 118], paddingBottomRight: [10, 16], animate: false });
        // Skin samples only: the same moment, zoomed in on YOU.
        if (o.zoom) {
            const [lng, lat] = g.pos[g.me];
            map.setView([lat, lng], o.zoom, { animate: false });
        }
        // The post's maps: their own view, and the players placed to suit it.
        if (o.frame) o.frame(map, g, o);
        if (data) {
            await OSMDraw.ready;
            mapEl.appendChild(OSMDraw.render(map, data, W, bare ? H : H - HEAD));
            if (bare) return;
        } else
            await new Promise((ok) => {
                if (!tiles.isLoading()) ok();
                tiles.once("load", ok);
                setTimeout(ok, 15000);
            });
        const P = ([lng, lat]) => {
            const p = map.latLngToContainerPoint([lat, lng]);
            return [p.x, p.y + HEAD];
        };
        const pxPerM = (() => {
            const a = P(g.hider);
            const b = P(Maps.off(g.hider, 100, 0));
            return (b[0] - a[0]) / 100;
        })();

        let html = "";
        let under = ""; // computer-drawn hints layer
        let red = ""; // the one red thing

        // The hints layer: only while no question is waiting.
        if (o.hints) {
            const rr = ringsOf(g.region.geometry).map((poly) => poly.map((r) => r.map(P)));
            const mask = `M-20 ${HEAD}H${W + 20}V${H + 20}H-20Z` + rr.map((poly) => poly.map(ringD).join("")).join("");
            const regionD = rr.map((poly) => poly.map(ringD).join("")).join("");
            if (o.hints.out === "invert") html += `<div style="position:absolute;left:0;top:0;width:${W}px;height:${H}px;backdrop-filter:invert(1);-webkit-backdrop-filter:invert(1);clip-path:path(evenodd,'${mask}');z-index:5"></div>`;
            if (o.hints.out === "delete") under += `<path d="${mask}" fill="#fff" fill-rule="evenodd"/>`;
            if (o.hints.edge === "computer") under += `<path d="${regionD}" fill="none" stroke="${o.hints.edgeColor ?? "#000"}" stroke-width="3" stroke-linejoin="miter"/>`;
            if (o.hints.edge === "hand") for (const [i, poly] of rr.entries()) red += Ink.wobble(poly[0], { seed: `m2r${i}${v}`, weight: 4.4, amp: 1.6 });
        }

        // The question on the table, and only that, in red.
        const q = o.ask;
        // A pin on an exact spot: the map pin's point, or B29's pushpin centred on it.
        const pinAt = (x, y, size, seed) => (o.pins === "push" ? Ink.pin(x, y, { size: size * 0.55 }) : o.pins === "gloss" ? Ink.glossPin(x, y, { size, seed, ...GPINS[o.gloss ?? 1] }) : Ink.mapPin(x, y, { size, seed, color: R, fill: o.pins === "filled" }));
        let popup = "";
        let popAt = null;
        if (q) {
            const who = g.pos[q.by];
            const c = P(who);
            if (q.ew) {
                // A bolder line; the words well clear of it, no arrows. WEST goes a
                // little further out than EAST: its T reads closer to the line.
                red += dashed([c[0], HEAD + 110], [c[0], H + 10], `m2d${v}`, 6.2);
                const y = o.labelY ?? HEAD + 340;
                // Kerned by hand: the W let go of the E, EAST's T up and out of the S's way;
                // the weight is NORTH and SOUTH's (the post, image 6).
                // The W's two outer arms reach a little above the other letters.
                const TALL_W = [0.9, [[[0, -0.16], [0.2, 1], [0.44, 0.34], [0.68, 1], [0.9, -0.16]]]];
                const west = { size: 26, seed: `w${v}`, tilt: -3, importance: "key", weight: 26 * 0.25, extra: [0.16, 0.04, 0.06], lift: [0.04, 0, 0, -0.06], glyphs: { W: TALL_W } };
                red += Ink.write("WEST", { ...west, x: c[0] - 30 - Ink.write("WEST", west).width, y }).svg;
                red += Ink.write("EAST", { x: c[0] + 28, y, size: 26, seed: `e${v}`, tilt: -3, importance: "key", weight: 26 * 0.25, extra: [0.02, 0.02, 0.07], lift: [0, 0, 0, -0.12] }).svg;
            } else if (q.ns) {
                // EAST/WEST's line turned flat: NORTH above it, SOUTH below, on the side away from YOU.
                red += dashed([-10, c[1]], [W + 10, c[1]], `m2n${v}`, 6.2);
                const cx0 = o.labelX ?? W / 2;
                // Kerned by hand, like WEST and EAST: no two letters touch.
                // A touch lighter than WEST and EAST, and spaced wider: five letters run together sooner.
                const nOpt = { size: 26, seed: `n${v}`, tilt: -3, importance: "key", weight: 26 * 0.25, extra: [0.32, 0.14, 0.18, 0.26] };
                const sOpt = { size: 26, seed: `s${v}`, tilt: -3, importance: "key", weight: 26 * 0.25, extra: [0.28, 0.18, 0.16, 0.26] };
                const nw = Ink.write("NORTH", nOpt).width;
                const sw = Ink.write("SOUTH", sOpt).width;
                // Centred on labelX, or (labelLeft) both flush with the screen's left margin.
                red += Ink.write("NORTH", { ...nOpt, x: o.labelLeft ? 18 : cx0 - nw / 2, y: c[1] - 24 }).svg;
                red += Ink.write("SOUTH", { ...sOpt, x: o.labelLeft ? 18 : cx0 - sw / 2, y: c[1] + 24 + 26 }).svg;
            } else if (q.radius) {
                // Circles are exact (centre and radius), only drawn by hand.
                const rp = q.radius * pxPerM;
                red += Ink.ring(c[0], c[1], rp, { seed: `m2c${v}`, weight: 4.5 });
                red += Ink.write(`${q.radius} M`, { x: c[0] + rp * 0.72 + 14, y: c[1] - rp * 0.72 - 8, size: 27, seed: `m2cm${v}`, tilt: -24, importance: "key", weight: 27 * 0.255 }).svg;
            } else if (q.nearest) {
                const shown = [];
                for (const p of Campus.layers[q.nearest].places) {
                    const [x, y] = P([p.lng, p.lat]);
                    if (y < HEAD + (o.pinTop ?? 110) || y > H) continue;
                    // Size 18, as in the post (image 3), on every map.
                    red += pinAt(x, y, o.pinSize ?? 18, `m2p${p.id}`);
                    shown.push({ p, x, y });
                }
                // One place tapped: its box, as the app's popup has it (the name, then where:
                // a café's pavilion and room, a station's number). o.popup names the place, or
                // takes the highest pin with room above it.
                if (o.popup) {
                    const hit = shown.find((s) => s.p.id === o.popup) ?? shown.filter((s) => s.y > HEAD + 260).sort((a, b) => a.y - b.y)[0];
                    const { p, x, y } = hit;
                    const rows = (p.detail ?? []).filter(([k]) => ["Pavillon", "Room", "Station"].includes(k)).map(([k, val]) => `<div><span style="font-weight:700">${k}</span> ${val}</div>`).join("");
                    const name = `<div style="font:700 15px/1.2 ${FONT};margin-bottom:3px">${p.label}</div>`;
                    if (o.pins === "gloss") {
                        // A speech bubble: the box as wide as its words, its tail white with a black
                        // edge (it reads over black buildings too), the tip just above the pin's head
                        // (2 sizes tall). The box is placed once laid out: see popAt below.
                        const size = o.pinSize ?? 18;
                        const bottom = y - 2 * size - 16;
                        popAt = { x, bottom, others: shown.filter((s) => s !== hit).map((s) => [s.x, s.y, size]) };
                        popup = `<div class="m2-pop" style="position:absolute;left:0;top:${bottom}px;transform:translateY(-100%);width:max-content;max-width:${W - 24}px;box-sizing:border-box;background:#fff;border:3px solid #000;padding:8px 10px;font:400 13px/1.35 ${FONT}">${name}${rows}</div>
                            <svg width="24" height="20" style="position:absolute;left:${x - 12}px;top:${bottom - 3}px"><path d="M1.2 -4L12 14L22.8 -4" fill="#fff" stroke="#000" stroke-width="3"/></svg>`;
                    } else {
                        const w = 214;
                        const left = Math.max(12, Math.min(W - 12 - w, x - w / 2));
                        const bottom = y - (o.pins === "push" ? 16 : 34);
                        popup = `<div style="position:absolute;left:${x - 9}px;top:${bottom - 3}px;width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-top:12px solid #000"></div>
                            <div style="position:absolute;left:${left}px;top:${bottom}px;transform:translateY(-100%);width:${w}px;box-sizing:border-box;background:#fff;border:3px solid #000;padding:8px 10px;font:400 13px/1.35 ${FONT}">${name}${rows}</div>`;
                    }
                }
            } else if (q.closer) {
                const lm = Campus.at("landmarks", q.closer);
                const [lx, ly] = P(lm);
                const rp = dist(lm, who) * pxPerM;
                // o.bare: no circle, only the place's tag (and everyone's pins).
                if (!o.bare) red += Ink.ring(lx, ly, rp, { seed: `m2k${v}`, weight: 4.5 });
                if (o.mark === "tag") tag(lx, ly, (o.label ?? q.closer).toUpperCase(), false, true);
                else red += pinAt(lx, ly, 15, "m2lm");
            }
        }

        // The closest stalker: no line on the map any more, only how far.
        if (o.tether) {
            const [name, p] = Object.entries(g.pos).sort((a, b) => dist(g.hider, a[1]) - dist(g.hider, b[1]))[0];
            // How far, not on the map: scribbled at the right of the box above, kept up to date.
            o.box = { ...o.box, hand: `${Math.round(dist(g.hider, p))} M AWAY` };
            void name;
        }

        // The hider's walk through the round (for the receipt), ending in the X.
        if (o.path) {
            const r = Ink.rng("walk");
            const start = Campus.at("building", "pav_pol");
            const pts = [];
            for (let k = 0; k <= 9; k++) {
                const t = k / 9;
                pts.push(P([start[0] + (g.hider[0] - start[0]) * t + Math.sin(t * 7) * 0.0012 * (1 - t) + r.range(-1, 1) * 0.0003, start[1] + (g.hider[1] - start[1]) * t + Math.cos(t * 5) * 0.0008 * (1 - t) + r.range(-1, 1) * 0.0002]));
            }
            red += Ink.pathEl(Ink.spline(pts, 8), { size: 3.4, color: R, thinning: 0.2, wobbleAmp: 1.6 });
            const e = P(g.hider);
            red += Ink.cross(e[0], e[1], 10, { seed: "m2x", weight: 5 });
        }

        // People: everyone else is one of B29's pushpins on their exact spot,
        // no name (a tap shows it: o.tapped); YOU is Yp, B29's pin look on Yn's
        // arrow, pointing the way your phone faces (a stalker's toward the
        // hider, the hider's toward the closest stalker), over everything.
        const bearing = (a, b) => (turf.bearing(turf.point(a), turf.point(b)) + 360) % 360;
        let you = "";
        let pins = "";
        // A question on the map is the one red thing: the others' pins step aside (YOU stays).
        // With no red drawn for it (o.bare), they stay.
        const other = (n, p) => {
            if (q && !o.bare) return;
            const [px, py] = P(p);
            // Size 9, as in the post (image 5), on every map.
            pins += Ink.pin(px, py, { size: 9 });
            if (o.tapped === n) tag(px, py - 7, n.toUpperCase(), false);
        };
        if (o.view === "hider") {
            const hp = P(g.hider);
            // No stalker on screen (all white, zoomed right in): she faces north-east.
            const near = Object.entries(g.pos).sort((a, b) => dist(g.hider, a[1]) - dist(g.hider, b[1]))[0]?.[1] ?? off(g.hider, 60, 100);
            you = youMark(hp[0], hp[1], "p.6.5", g.deg ?? bearing(g.hider, g.face ?? near));
            for (const [n, p] of Object.entries(g.pos)) other(n, p);
        } else {
            for (const [n, p] of Object.entries(g.pos)) {
                if (n !== g.me) other(n, p);
                else you = youMark(...P(p), "p.6.5", bearing(p, g.hider));
            }
        }

        // Design rule: the players' names are the one thing drawn over the red.
        const tagsHtml = flushTags();
        const c = chrome(o.box, v);
        const layer = (z, inner, svg) => root.insertAdjacentHTML("beforeend", svg ? `<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0;pointer-events:none;z-index:${z};overflow:visible">${inner}</svg>` : `<div style="position:absolute;inset:0;pointer-events:none;z-index:${z}">${inner}</div>`);
        layer(4, under, true);
        layer(6, html.split("<!--tags-->")[0]);
        layer(40, red, true);
        layer(49, pins, true);
        layer(50, tagsHtml);
        layer(52, you, true);
        layer(55, popup);
        // The tapped place's box: centred over its pin, unless it would cover another pin;
        // then it slides sideways off it. The tail stays on the tapped pin, clear of the corners.
        if (popAt) {
            await document.fonts.ready;
            const box = root.querySelector(".m2-pop");
            const { width: bw, height: bh } = box.getBoundingClientRect();
            const { x, bottom, others } = popAt;
            let left = x - bw / 2;
            for (const [ox, oy, s] of others) {
                if (oy < bottom - bh - 4 || oy - 2 * s > bottom + 4) continue;
                const half = s * 0.6 + 8;
                if (ox < x && ox + half > left) left = ox + half;
                if (ox > x && ox - half < left + bw) left = ox - half - bw;
            }
            left = Math.max(12, Math.min(W - 12 - bw, x - 22, Math.max(x + 22 - bw, left)));
            box.style.left = `${left}px`;
        }
        layer(60, c.html);
        layer(65, c.ink, true);
        // The header's STALK, exactly as app/decorate.js's headerLogo sets it: black (the map
        // always has its one red thing), 27 px tall, off HIDE &'s box, a hair toward it.
        const title = root.querySelector(".m2-title");
        if (title) {
            const a = title.querySelector("text").getBBox();
            const st = Logo.stalk({ color: "#000" });
            const k = 27 / st.box.h;
            const x = a.x + a.width + 7;
            title.insertAdjacentHTML("beforeend", `<g transform="translate(${x - 1.5 - st.box.x * k} ${31.5 - (st.box.y + st.box.h) * k}) scale(${k})">${st.svg}</g>`);
        }
        const attr = mapEl.querySelector(".leaflet-control-attribution");
        if (attr) attr.style.cssText = `background:#fff;color:#000;font:400 9px ${FONT};padding:1px 4px`;
    }

    const G = "greenhouses";
    const next = (n, clock, legend) => ({ kicker: `QUESTION ${n} IN ${clock}`, legend });
    const asked = (n, who, text, clock) => ({ kicker: `QUESTION ${n} · FROM ${who.toUpperCase()}`, text, clock });
    const LIST = [
        // The hints layer, six ways (stalker, after two answers, nothing waiting).
        { game: G, upTo: 2, view: "stalker", hints: { edge: "hand" }, box: next(3, "3:12", "She's inside the red line."), name: "Hints: the map unchanged, the red line is all (hand-drawn)" },
        { game: G, upTo: 2, view: "stalker", hints: { out: "invert" }, box: next(3, "3:12", "She's in the white part."), name: "Hints: ruled out inverted to black, no line" },
        { game: G, upTo: 2, view: "stalker", hints: { out: "invert", edge: "hand" }, box: next(3, "3:12", "She's inside the red line."), name: "Hints: inverted, red line by hand" },
        { game: G, upTo: 2, view: "stalker", hints: { out: "invert", edge: "computer" }, box: next(3, "3:12", "She's in the white part."), name: "Hints: inverted, a computer line" },
        { game: G, upTo: 2, view: "stalker", hints: { out: "delete", edge: "computer" }, box: next(3, "3:12", "The map only shows where she can be."), name: "Hints: ruled out deleted, a computer line" },
        { game: G, upTo: 2, view: "stalker", hints: { out: "delete", edge: "hand" }, box: next(3, "3:12", "The map only shows where she can be."), name: "Hints: deleted, red line by hand" },
        { game: G, upTo: 2, view: "stalker", hints: { out: "delete" }, box: next(3, "3:12", "The map only shows where she can be."), name: "Hints: deleted, no line" },
        // A question waiting: only what it needs is red; the hints step aside.
        { game: G, upTo: 2, view: "stalker", ask: { nearest: "cafe", by: "noah" }, box: asked(3, "noah", "Which café are you closest to?", "1:02"), name: "Q3 nearest café: the cafés, pinned in red (stalker)" },
        { game: G, upTo: 2, view: "hider", ask: { nearest: "cafe", by: "noah" }, box: asked(3, "noah", "Which café are you closest to?", "1:02"), name: "Same question, the hider's map" },
        { game: G, upTo: 3, view: "stalker", ask: { closer: "greenhouses", by: "noah" }, box: asked(4, "noah", "Are you closer to the greenhouse than I am?", "0:48"), name: "Q4 closer than me: the circle through noah" },
        { game: G, upTo: 4, view: "stalker", ask: { ew: true, by: "camille" }, box: asked(5, "camille", "Are you east or west of me?", "2:40"), name: "Q5 east or west: the line, which side is which" },
        { game: G, upTo: 4, view: "hider", ask: { ew: true, by: "camille" }, box: asked(5, "camille", "Are you east or west of me?", "2:40"), name: "Same question, the hider's map" },
        { game: "pubu", upTo: 3, view: "stalker", ask: { radius: 200, by: "lea" }, box: asked(4, "lea", "Are you within 200 m of me?", "4:05"), name: "Game 2, within 200 m: the circle (stalker)" },
        { game: "pubu", upTo: 3, view: "hider", ask: { radius: 200, by: "lea" }, box: asked(4, "lea", "Are you within 200 m of me?", "4:05"), name: "Same question, the hider's map" },
        // The hider between questions: one string, to the closest stalker.
        { game: G, upTo: 2, view: "hider", tether: true, box: next(3, "3:12"), name: "Hider between questions: one string, the closest stalker" },
        // For the receipt: her walk, and where they got her.
        { game: G, upTo: 4, view: "hider", path: true, box: { kicker: "FOUND · 13:32", text: "Your walk, from the start to the X." }, name: "For the receipt: her walk, the X where they found her" },
        // The skins, on the same moment (nothing waiting, no hints): just the map and the players.
        { game: G, upTo: 2, view: "stalker", skin: "xerox", box: next(3, "3:12"), name: "Skin: xerox (pure black and white, light)" },
        { game: G, upTo: 2, view: "stalker", skin: "ground", box: next(3, "3:12"), name: "Skin: figure-ground (buildings black)" },
        { game: G, upTo: 2, view: "stalker", skin: "lines", box: next(3, "3:12"), name: "Skin: traced (outlines only)" },
        { game: G, upTo: 2, view: "stalker", skin: "grey", box: next(3, "3:12"), name: "Skin: grey (breaks the no-grey rule)" },
        { game: G, upTo: 2, view: "stalker", skin: "osm", box: next(3, "3:12"), name: "Skin: plain OpenStreetMap (breaks the palette)" },
    ];

    // Skin samples: every skin at three zoom levels (a: whole campus, b: a few buildings, c: close up).
    const SKIN_LIST = ["xerox", "xeroxdark", "ground", "grain", "hatch", "dots", "lines", "linesbold", "sketch", "streets", "grey", "osm", "xeroxmid", "grainlight", "traced", "tracedthin", "traceddots", "tracedgreen", "tracedbold", "dotsonly", "tone", "tonelight", "tonegrey", "dotsclean", "streetsclean", "grainclean", "grainnotext", "blackbuildings"];
    // Variants numbered after the skin they come from.
    const SKIN_ALIAS = { "16.1": "tracedoutline", "18.1": "centerline", "18.2": "centerlinegreen", "27.1": "grainsamegreen", "27.2": "grainlightgreen", "1.1": "xeroxnotext", "2.1": "xeroxdarknotext", "11.1": "greynotext", "27.3": "grainreorder", "27.4": "grainshift", "2.2": "xeroxsolid", "16.2": "vector16", "16.3": "vector161", "16.31": "vector161s", "16.32": "vector161ss", "16.4": "vector16g", "24.1": "dotsgreen", "30.2": "dataoutline", "30.3": "datasolid", "30.9": "datagrain", "30.5": "datadots", "30.0": "datakey", "30.01": "datakey2", "30.02": "datakey3", "30.21": "dataoutlinenopaths", "30.22": "dataoutlinepruned", "30.23": "dataoutlineclean", "30.51": "datadotsclean", "31.1": "datablackroads", "31.2": "datablackdots", "31.3": "datafigure", "30.24": "dataoutlinekey", "31.21": "datablackdotskey", "30.52": "datadotskey", "30.03": "datakey4", "31.22": "datablackdotskey4", "31.23": "datablackdotsall" };
    const ZOOMS = { a: null, b: 16.6, c: 18.2 };
    function drawSkin(root, code) {
        const [, n, z] = /^([\d.]+)([abc])$/.exec(code);
        LIST.push({ game: G, upTo: 2, view: "stalker", skin: SKIN_ALIAS[n] ?? SKIN_LIST[n - 1], zoom: ZOOMS[z], box: next(3, "3:12") });
        return draw(root, LIST.length);
    }

    // The hints layer, third pass: N01-N03 only, each with the five ways of
    // making the players visible. On S20 now (it was S16, the traced tiles).
    const TAG_LIST = ["base", "big", "ink", "sticker", "shadow", "marker"];
    function drawHint(root, code) {
        const [, n, t] = /^(\d)([a-f])$/.exec(code);
        const base = LIST[Number(n) - 1];
        LIST.push({ ...base, skin: MAP_SKIN, tags: TAG_LIST["abcdef".indexOf(t)] });
        return draw(root, LIST.length);
    }

    /**
     * Name tags, fifth pass: everyone else and YOU are separate choices now.
     * The app knows only your own heading (the others' positions come without
     * one), so YOU is a mark that shows which way your phone points, and
     * everyone else is a tag.
     *   Others: a (the outline running round the pointer too), c, f, g (a red
     *   pin), k (a's shape, its edge drawn by hand in red), l (coloured in red).
     *   YOU: g (beam), h (arrow, bigger), j (outlined beam), m (the arrow's
     *   edge by hand in red), n (the arrow coloured in red).
     */
    const PIN_R = 7.5;
    const tagW = (label) => {
        cv.font = tagFont(12);
        return cv.measureText(label).width + 12 * 1.3 + 12;
    };
    const tagText = (cx, cy, label, color = "#000") => `<text x="${cx}" y="${cy + 4.3}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="12" letter-spacing="0.72" fill="${color}">${label}</text>`;
    /** a's tag as one shape, box and pointer, its point on the spot (w: its width, if not the typed name's). */
    function bubble(x, y, label, w = tagW(label), h = 24) {
        const left = x - w / 2;
        const top = y - h - 12;
        const b = top + h;
        const pts = [[left, top], [left + w, top], [left + w, b], [x + 7, b], [x, b + 10], [x - 7, b], [left, b]];
        return { pts, left, cx: x, cy: top + h / 2 };
    }
    function otherTag(t, x, y, label) {
        // p: B29's pushpin as everyone else is shown: no name, and (right) tapped,
        // the name above it. p.1: the tapped pin alone.
        if (t === "p" || t === "p.1") {
            const tapped = (px) => {
                const bb = bubble(px, y - 7, label);
                return `${Ink.pin(px, y, { size: 9 })}<path d="M${bb.pts.map((q) => q.join(" ")).join("L")}Z" fill="#fff" stroke="#000" stroke-width="3" stroke-linejoin="miter"/>${tagText(bb.cx, bb.cy, label)}`;
            };
            return t === "p" ? Ink.pin(x - 62, y, { size: 9 }) + tapped(x + 44) : tapped(x);
        }
        if (t === "a" || t === "k" || t === "k.1" || t === "l") {
            // k.1: k with the name written by hand too, in red like its edge; the tag fits the handwriting.
            const hand = { size: 15, seed: `tk1${label}`, tilt: -2, importance: "info" };
            const handW = t === "k.1" ? Ink.write(label, hand).width : 0;
            const bb = handW ? bubble(x, y, label, handW + 26, 30) : bubble(x, y, label);
            const d = `M${bb.pts.map((p) => p.join(" ")).join("L")}Z`;
            if (t === "a") return `<path d="${d}" fill="#fff" stroke="#000" stroke-width="3" stroke-linejoin="miter"/>${tagText(bb.cx, bb.cy, label)}`;
            const name = handW ? Ink.write(label, { ...hand, x: bb.left + 13, y: bb.cy + 7.5 }).svg : tagText(bb.cx, bb.cy, label);
            if (t === "k" || t === "k.1") return `<path d="${d}" fill="#fff"/>${Ink.wobble([...bb.pts, bb.pts[0], bb.pts[1]].map((p, i, a) => (i === a.length - 1 ? [p[0] - 14, p[1]] : p)), { seed: `tk${label}`, weight: 3.4, amp: 0.9 })}${name}`;
            // Coloured in: solid red under a hand-drawn red edge (a scribble fill is a blob at this size).
            return `<path d="${d}" fill="${R}"/>${Ink.wobble([...bb.pts, bb.pts[0], bb.pts[1]].map((p, i, a) => (i === a.length - 1 ? [p[0] - 14, p[1]] : p)), { seed: `tl${label}`, weight: 3.4, amp: 0.9 })}${tagText(bb.cx, bb.cy, label)}`;
        }
        if (t === "g") {
            const w = tagW(label);
            return `${Ink.pin(x, y, { size: PIN_R })}<rect x="${x - w / 2 + 1.5}" y="${y - PIN_R - 7 - 24 + 1.5}" width="${w - 3}" height="21" fill="#fff" stroke="#000" stroke-width="3"/>${tagText(x, y - PIN_R - 7 - 12, label)}`;
        }
        // c and f: the earlier styles, stalker only.
        TAGS = t === "c" ? "ink" : "marker";
        PENDING = [];
        tag(x, y, label, false);
        return `<foreignObject x="0" y="0" width="240" height="175"><div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;width:240px;height:175px">${flushTags()}</div></foreignObject>`;
    }
    /** YOU: the spot and the way you're facing (deg clockwise from north). */
    function youMark(x, y, kind, deg) {
        const a = ((deg - 90) * Math.PI) / 180;
        const at = (ang, r) => `${(x + Math.cos(ang) * r).toFixed(1)} ${(y + Math.sin(ang) * r).toFixed(1)}`;
        const wedge = (r, half) => `M${x} ${y}L${at(a - half, r)}A${r} ${r} 0 0 1 ${at(a + half, r)}Z`;
        const dot = `<circle cx="${x}" cy="${y}" r="8.5" fill="#fff"/><circle cx="${x}" cy="${y}" r="6.5" fill="#000"/>`;
        if (kind === "g") return `<path d="${wedge(38, 0.6)}" fill="#000"/>${dot}`;
        if (kind === "j") return `<path d="${wedge(40, 0.55)}" fill="none" stroke="#000" stroke-width="3" stroke-linejoin="round"/>${dot}`;
        // The navigation arrow, half as big again as h's first pass: point ahead, notch behind.
        const r = (deg * Math.PI) / 180;
        const pts = [[0, -21], [15, 15], [0, 6], [-15, 15]].map(([px, py]) => [x + px * Math.cos(r) - py * Math.sin(r), y + px * Math.sin(r) + py * Math.cos(r)]);
        const poly = pts.map((p) => p.map((n) => n.toFixed(1)).join(",")).join(" ");
        const edge = (seed) => Ink.wobble([...pts, pts[0], pts[1]].map((p, i, all) => (i === all.length - 1 ? [(p[0] + all[i - 1][0]) / 2, (p[1] + all[i - 1][1]) / 2] : p)), { seed, weight: 3.4, amp: 0.7 });
        if (kind === "m") return `<polygon points="${poly}" fill="#fff"/>${edge("youm")}`;
        if (kind === "n") return `<polygon points="${poly}" fill="${R}"/>${edge("youn")}`;
        if (kind === "p" || kind.startsWith("p.")) {
            // Yn in B29's pin look: the pin's red, its thin black edge (a touch
            // uneven, as the pin's is), and its white shine, kept inside the
            // arrow. p: an oval streak along the left side; p.1 a straight
            // line; p.2 a small triangle, a facet at the front; p.3 a blade
            // along the left edge; p.4 the fold down the middle; p.5 two strokes;
            // p.6 the blade turned around; p.7 and p.8 that, further down.
            const n = Ink.noise1(Ink.rng(`yp${Math.round(x)},${Math.round(y)}`));
            const ring = [];
            pts.forEach((q, i) => {
                const nx = pts[(i + 1) % pts.length];
                for (let k = 0; k < 6; k++) ring.push([q[0] + ((nx[0] - q[0]) * k) / 6, q[1] + ((nx[1] - q[1]) * k) / 6]);
            });
            const cx = pts.reduce((t, q) => t + q[0], 0) / 4;
            const cy = pts.reduce((t, q) => t + q[1], 0) / 4;
            const d = `M${ring.map(([px, py], i) => {
                // Corners stay put; between them the edge moves by up to 0.7 px.
                const k = i % 6 === 0 ? 0 : n(i * 0.45) * 0.7;
                const l = Math.hypot(px - cx, py - cy) || 1;
                return `${(px + ((px - cx) / l) * k).toFixed(1)} ${(py + ((py - cy) / l) * k).toFixed(1)}`;
            }).join("L")}Z`;
            const id = `yp${Math.round(x)}x${Math.round(y)}`;
            // The shine, drawn in the arrow's own frame (tip up) and turned with it.
            const S = ([px, py]) => [x + px * Math.cos(r) - py * Math.sin(r), y + px * Math.sin(r) + py * Math.cos(r)];
            const f = (q) => S(q).map((v) => v.toFixed(1)).join(" ");
            const T = [0, -21];
            const Lw = [-15, 15];
            const N = [0, 6];
            const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
            // In from the left edge, toward the middle.
            const inset = (t, k) => {
                const q = lerp(T, Lw, t);
                return [q[0] + (36 / 39) * k, q[1] + (15 / 39) * k];
            };
            const line = (a, b, w) => `<path d="M${f(a)}L${f(b)}" stroke="#fff" stroke-width="${w}" stroke-linecap="round" fill="none"/>`;
            const tri = (a, b, c) => `<path d="M${f(a)}L${f(b)}L${f(c)}Z" fill="#fff"/>`;
            const [sx, sy] = S([-5, 0]);
            const sa = (Math.atan2(36, -15) * 180) / Math.PI + deg;
            const shine = {
                p: `<ellipse cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" rx="5.2" ry="1.9" fill="#fff" transform="rotate(${sa.toFixed(1)} ${sx.toFixed(1)} ${sy.toFixed(1)})"/>`,
                "p.1": line(inset(0.22, 2.4), inset(0.6, 2.4), 2.1),
                "p.2": tri(inset(0.2, 2), inset(0.5, 2), [-1.2, -8.8]),
                "p.3": tri(inset(0.18, 1.8), inset(0.66, 1.8), inset(0.27, 4.4)),
                "p.4": line([-0.9, -15.6], lerp(T, N, 0.75).map((v, i) => (i ? v : v - 0.9)), 1.9),
                "p.5": line(inset(0.24, 2.2), inset(0.5, 2.2), 1.9) + line(inset(0.4, 4.6), inset(0.52, 4.6), 1.9),
                // p.3 turned around: widest toward the back, a point toward the tip.
                "p.6": tri(inset(0.14, 1.8), inset(0.66, 1.8), inset(0.56, 4.4)),
                // p.6 further down: stopping about 2 px short of the back edge (p.7),
                // or running into it, cut by the edge itself (p.8).
                "p.7": tri(inset(0.14, 1.8), inset(0.86, 1.8), inset(0.76, 4.6)),
                "p.8": tri(inset(0.14, 1.8), inset(1.08, 1.8), inset(0.9, 5.6)),
                // Between p.6 and p.7: the one decided, on every map.
                "p.6.5": tri(inset(0.14, 1.8), inset(0.76, 1.8), inset(0.66, 4.5)),
            }[kind];
            return `<defs><clipPath id="${id}"><path d="${d}"/></clipPath></defs><path d="${d}" fill="${R}"/><g clip-path="url(#${id})">${shine}</g><path d="${d}" fill="none" stroke="#000" stroke-width="1.6" stroke-linejoin="round"/>`;
        }
        return `<polygon points="${poly}" fill="#000" stroke="#fff" stroke-width="5" stroke-linejoin="round" paint-order="stroke"/>`;
    }

    // The map pin in the pins' look, six ways (Ink.glossPin): G1 ... G6.
    const GPINS = {
        1: { dot: "cut", shine: "oval" },
        2: { dot: "none", shine: "oval" },
        3: { dot: "white", shine: "oval" },
        4: { dot: "cut", shine: "arc" },
        5: { dot: "cut", shine: "blade" },
        6: { dot: "none", shine: "line" },
        // G4.1: G4 (the same pin), the arc drawn by hand.
        4.1: { dot: "cut", shine: "arcHand", seed: "g4" },
    };
    /** One glossy map pin alone, enlarged 3x: its point near the bottom. */
    function pinOnly(root, code) {
        root.style.background = "#fff";
        root.innerHTML = `<svg width="240" height="175" style="position:absolute;left:0;top:0;overflow:visible"><g transform="translate(120 140) scale(3)">${Ink.glossPin(0, 0, { size: 13, seed: `g${code}`, ...GPINS[code] })}</g></svg>`;
    }

    /** YOU alone, enlarged (3x, same proportions), to compare the shines: p, p.1 ... p.5. */
    function youOnly(root, kind, zoom = 3) {
        root.style.background = "#fff";
        root.innerHTML = `<svg width="240" height="175" style="position:absolute;left:0;top:0;overflow:visible"><g transform="translate(120 90) scale(${zoom})">${youMark(0, 0, kind, 35)}</g></svg>`;
    }

    /** One mark alone on white: another player's tag (a, c, f, g, k, l) or YOU (Yg, Yh, Yj, Ym, Yn). */
    function tagsOnly(root, t) {
        root.style.background = "#fff";
        const inner = t.startsWith("Y") ? youMark(120, 92, t.slice(1), 35) : otherTag(t, 120, 108, "CAMILLE");
        root.innerHTML = `<svg width="240" height="175" style="position:absolute;left:0;top:0;overflow:visible">${inner}</svg>`;
    }

    // ---------------------------------------------------------------------
    // For the post: the maps kept (the hints layer, the nearest àVélo, east or
    // west, north or south), each in a few places on campus and at five zooms,
    // a (the whole campus, as the map opens) to e (a few buildings). Always
    // the hider's map: YOU is the hider, the pins are the two stalkers.
    // Code: kind, place, zoom (h2c: the hints layer, place 2, zoom c).
    // ---------------------------------------------------------------------
    const POST_ZOOMS = { a: null, b: 15.3, c: 15.9, d: 16.5, e: 17.1 };
    const off = (p, dx, dy) => Maps.off(p, dx, dy);
    const LM = (id) => Campus.at("landmarks", id);
    const VS = (id) => Campus.at("velo", id);
    const campusPoly = () => turf.polygon([Campus.layers.campus.ring]);
    const onCampus = (ll) => turf.booleanPointInPolygon(turf.point(ll), campusPoly());
    // Screen <-> map, the question box's header included.
    const scr = (map) => ({
        P: ([lng, lat]) => {
            const p = map.latLngToContainerPoint([lat, lng]);
            return [p.x, p.y + HEAD];
        },
        LL: (x, y) => {
            const l = map.containerPointToLatLng([x, y - HEAD]);
            return [l.lng, l.lat];
        },
    });
    /** Zoom to z, then slide the map so `ll` lands on the screen point `at`. */
    function aim(map, ll, z, at) {
        if (z) map.setView([ll[1], ll[0]], z, { animate: false });
        if (!at) return;
        const [x, y] = scr(map).P(ll);
        map.panBy([at[0] == null ? 0 : x - at[0], at[1] == null ? 0 : y - at[1]], { animate: false });
    }
    const segDist = (x, y, [ax, ay], [bx, by]) => {
        const dx = bx - ax;
        const dy = by - ay;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
        return Math.hypot(x - ax - t * dx, y - ay - t * dy);
    };
    const angGap = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

    /**
     * The two stalkers, in the black: just outside the red line, on either
     * side of it, clear of YOU and of the question box.
     */
    function placeStalkers(map, g, a1) {
        const { P, LL } = scr(map);
        const rings = ringsOf(g.region.geometry).flatMap((poly) => poly.map((r) => r.map(P)));
        const inside = (x, y) => {
            let c = false;
            for (const r of rings)
                for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
                    const [xi, yi] = r[i];
                    const [xj, yj] = r[j];
                    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
                }
            return c;
        };
        const edge = (x, y) => {
            let d = Infinity;
            for (const r of rings) for (let i = 1; i < r.length; i++) d = Math.min(d, segDist(x, y, r[i - 1], r[i]));
            return d;
        };
        const [hx, hy] = P(g.hider);
        const cands = [];
        for (let y = HEAD + 130; y <= H - 40; y += 6)
            for (let x = 34; x <= W - 34; x += 6) {
                if (inside(x, y)) continue;
                const d = edge(x, y);
                const dh = Math.hypot(x - hx, y - hy);
                if (d < 22 || dh < 80) continue;
                cands.push({ x, y, d, a: Math.atan2(y - hy, x - hx) });
            }
        const score = (c, a) => Math.abs(c.d - 50) + 60 * angGap(c.a, a);
        const s1 = cands.reduce((b, c) => (!b || score(c, a1) < score(b, a1) ? c : b), null);
        if (!s1) return void (g.pos = {});
        const rest = cands.filter((c) => Math.hypot(c.x - s1.x, c.y - s1.y) > 120);
        const s2 = rest.reduce((b, c) => (!b || score(c, a1 + Math.PI) < score(b, a1 + Math.PI) ? c : b), null);
        g.pos = { noah: LL(s1.x, s1.y), ...(s2 ? { camille: LL(s2.x, s2.y) } : {}) };
    }

    /** YOU near a spot on screen: tried from `D` px at `deg` (screen, 90 = down), then closer and turned, until `ok`. */
    function placeYou(map, from, deg, ok, D = 110) {
        const { LL } = scr(map);
        for (let d = D; d >= 40; d -= 10)
            for (const k of [0, 1, -1, 2, -2, 3, -3, 4, -4]) {
                const a = ((deg + k * 20) * Math.PI) / 180;
                const x = from[0] + Math.cos(a) * d;
                const y = from[1] + Math.sin(a) * d;
                if (x < 40 || x > W - 40 || y < HEAD + 170 || y > H - 40) continue;
                const ll = LL(x, y);
                if (onCampus(ll) && ok(x, y, ll)) return ll;
            }
        return LL(from[0] + Math.cos((deg * Math.PI) / 180) * 50, from[1] + Math.sin((deg * Math.PI) / 180) * 50);
    }

    // The hints layer: where the hider hides, what's been answered (truthfully),
    // and which way the first stalker stands from her (screen radians, 0 = right).
    // From late in the game (a small white zone) to early (a big one).
    const HINT_PLACES = [
        { name: "By the greenhouses (late: a small zone)", hider: () => off(LM("greenhouses"), 45, 25), qs: (h) => [{ nearest: "building" }, { radius: 220, at: off(h, -60, 90) }], a1: -0.6 },
        { name: "The grand axe (late)", hider: () => off(LM("twin_towers"), -70, -30), qs: (h) => [{ nearest: "building" }, { radius: 260, at: off(h, 110, -70) }], a1: 2.6 },
        { name: "South, by Adrien-Pouliot (mid-game)", hider: () => off(VS("velo_63"), 40, 60), qs: (h) => [{ nearest: "cafe" }, { ew: true, at: off(h, -120, 0) }], a1: 1.0 },
        { name: "By the church (mid-game)", hider: () => off(LM("church"), -40, -50), qs: (h) => [{ nearest: "cafe" }, { ns: true, at: off(h, 0, -140) }], a1: 2.2 },
        { name: "By the stadium (early: a big zone)", hider: () => off(LM("football_stadium"), 110, -70), qs: (h) => [{ ns: true, at: off(h, 0, -160) }, { radius: 500, at: off(h, 280, 120) }], a1: 0.3 },
        { name: "By Pub U (early)", hider: () => off(LM("pub_u"), -50, 30), qs: (h) => [{ ew: true, at: off(h, -260, 0) }, { radius: 450, at: off(h, -120, 180) }], a1: -2.4 },
    ];
    // Nearest àVélo: the station she's closest to, and which way from it she stands (screen degrees, 90 = below).
    const VELO_PLACES = [
        { name: "Abitibi-Price", id: "velo_90", deg: 100 },
        { name: "Adrien-Pouliot", id: "velo_63", deg: 60 },
        { name: "Alphonse-Desjardins", id: "velo_61", deg: 120 },
        { name: "Charles-De Koninck", id: "velo_60", deg: 80 },
        { name: "PEPS", id: "velo_62", deg: 110 },
        // 5.2c (Adrien-Pouliot, zoom c) the same, a little further out, then further still.
        { name: "Adrien-Pouliot, a little further out", id: "velo_63", deg: 60, zoomOut: 0.3 },
        { name: "Adrien-Pouliot, further out still", id: "velo_63", deg: 60, zoomOut: 0.55 },
        // 5.2c (the post's image 3) with her station tapped: its pop-up.
        { name: "Adrien-Pouliot, its pin tapped", id: "velo_63", deg: 60, popup: "velo_63" },
    ];
    // East or west / north or south: who asks, from where; which side of the line YOU is on (+1 east or
    // south, -1 west or north), and where along the line (screen y for east/west, x for north/south).
    const EW_PLACES = [
        { name: "The ULaval sign", asker: () => LM("ulaval_sign"), side: 1, along: 560 },
        { name: "By the greenhouses", asker: () => off(LM("greenhouses"), 60, 0), side: -1, along: 600 },
        { name: "PEPS", asker: () => VS("velo_62"), side: 1, along: 470 },
        { name: "By Pub U", asker: () => off(LM("pub_u"), -80, 20), side: -1, along: 540 },
    ];
    const NS_PLACES = [
        { name: "The twin towers", asker: () => LM("twin_towers"), side: 1, along: 250 },
        { name: "By the stadium", asker: () => off(LM("football_stadium"), 0, -60), side: 1, along: 130 },
        { name: "By the church", asker: () => off(LM("church"), -30, 0), side: -1, along: 240 },
        { name: "Adrien-Pouliot", asker: () => VS("velo_63"), side: -1, along: 120 },
        // 6N.3d redone (zoom d only): the same map, the line and its words up in
        // the white field's middle, YOU just south of the church. Screen points.
        { name: "By the church: the line high, YOU under the church", asker: () => off(LM("church"), -30, 0), side: -1, along: 240, screen: { line: 318, you: [248, 700] } },
        { name: "By the church: the line a little lower", asker: () => off(LM("church"), -30, 0), side: -1, along: 240, screen: { line: 348, you: [214, 706] } },
        { name: "By the church: the line lower still, YOU to the east", asker: () => off(LM("church"), -30, 0), side: -1, along: 240, screen: { line: 378, you: [286, 690] } },
        // 6N.5d's YOU facing west-north-west, 6N.6d's line, the words at the screen's left.
        { name: "By the church: 5d's hider facing left, 6d's line, the words left", asker: () => off(LM("church"), -30, 0), side: -1, along: 240, screen: { line: 348, you: [248, 700], deg: 290, left: true } },
        // 8d, a little closer, then closer still.
        { name: "8d, a little closer", asker: () => off(LM("church"), -30, 0), side: -1, along: 240, screen: { line: 348, you: [248, 700], deg: 290, left: true, zoomBy: 0.3 } },
        { name: "8d, closer still", asker: () => off(LM("church"), -30, 0), side: -1, along: 240, screen: { line: 348, you: [248, 700], deg: 290, left: true, zoomBy: 0.55 } },
        // The one settled: 6d, YOU facing straight left.
        { name: "Settled", asker: () => off(LM("church"), -30, 0), side: -1, along: 240, screen: { line: 348, you: [214, 706], deg: 270 } },
    ];
    // S61's hints layer, as it was (the greenhouses game after two answers),
    // with the hider in different spots inside it. Any spot inside the white
    // gives the same answers, so the zone stays exactly the same.
    const S61_PLACES = [
        { name: "By the greenhouses", hider: () => [-71.2789, 46.7806], a1: -0.6 },
        { name: "By PEPS", hider: () => off(VS("velo_62"), -40, 30), a1: 2.4 },
        { name: "By the stadium", hider: () => off(LM("football_stadium"), 70, -90), a1: 0.4 },
        { name: "By Abitibi-Price", hider: () => off(VS("velo_90"), 60, 70), a1: -2.2 },
        { name: "By the ULaval sign", hider: () => off(LM("ulaval_sign"), -60, 60), a1: 1.2 },
        // 4B.3a redone (the whole campus only): the hider out in the big white
        // field, the two stalkers together in the black under the red curve.
        // Screen points, 375 x 812.
        { name: "In the field, stalkers under the curve", hider: () => [-71.2789, 46.7806], screen: { you: [252, 402], st: [[232, 524], [270, 508]] } },
        { name: "Further east in the field, stalkers lower", hider: () => [-71.2789, 46.7806], screen: { you: [298, 428], st: [[214, 544], [252, 556]] } },
        { name: "The field's west end, stalkers to the east", hider: () => [-71.2789, 46.7806], screen: { you: [212, 392], st: [[300, 512], [334, 530]] } },
        // The one settled: 8a's hider facing the bottom-left corner, 7a's stalkers closer together.
        { name: "Settled", hider: () => [-71.2789, 46.7806], screen: { you: [212, 392], deg: 225, st: [[222, 546], [248, 553]] } },
        // The same, a stalker tapped: his name shows above his pin (Tp).
        { name: "Settled, a stalker tapped", hider: () => [-71.2789, 46.7806], screen: { you: [212, 392], deg: 225, st: [[222, 546], [248, 553]] }, tapped: "camille" },
        // The same between questions, as S67 had it: how far the closest stalker is, scribbled in the box.
        { name: "Settled, between questions: the distance", hider: () => [-71.2789, 46.7806], screen: { you: [212, 392], deg: 225, st: [[222, 546], [248, 553]] }, tether: true },
    ];
    const POST_PLACES = { h: HINT_PLACES, g: S61_PLACES, v: VELO_PLACES, e: EW_PLACES, n: NS_PLACES };

    function drawPost(root, code) {
        const [, kind, n, zk] = /^([hgven])(\d+)([a-e])$/.exec(code);
        const spec = POST_PLACES[kind][Number(n) - 1];
        const z = POST_ZOOMS[zk];
        // Where the map's middle goes on screen: the middle of what the question box leaves.
        const MID = [W / 2, 520];
        let o;
        if (kind === "h" || kind === "g") {
            let hider = spec.hider();
            let qs;
            let region;
            if (kind === "g") {
                const s61 = state(G, 2);
                ({ qs, region } = s61);
                // Not well inside the white (60 m from the line)? Walk toward its middle until she is.
                const mid = turf.centroid(region).geometry.coordinates;
                const lines = ringsOf(region.geometry).flat().map((r) => turf.lineString(r));
                const deep = (p) => turf.booleanPointInPolygon(turf.point(p), region) && Math.min(...lines.map((l) => turf.pointToLineDistance(turf.point(p), l, { units: "meters" }))) > 60;
                for (let k = 0; !deep(hider) && k < 12; k++) hider = [hider[0] + (mid[0] - hider[0]) * 0.15, hider[1] + (mid[1] - hider[1]) * 0.15];
            } else {
                qs = spec.qs(hider);
                region = Campus.solve(hider, qs).region;
            }
            const g = { hider, pos: {}, qs, region };
            o = {
                g, view: "hider", hints: { out: "invert", edge: "hand" }, tapped: spec.tapped, tether: spec.tether,
                box: next(3, "3:12", "They know you're inside the red line."),
                frame: (map) => {
                    if (z) {
                        aim(map, g.hider, z, MID);
                        const { P } = scr(map);
                        const rings = ringsOf(g.region.geometry).flatMap((poly) => poly.map((r) => r.map(P)));
                        const xs = rings.flat().map((p) => p[0]);
                        const ys = rings.flat().map((p) => p[1]);
                        // A zone that fits goes in the middle, whole; a bigger one is
                        // framed on YOU and the nearest stretch of the red line.
                        if (Math.max(...xs) - Math.min(...xs) < W * 0.8 && Math.max(...ys) - Math.min(...ys) < (H - HEAD - 150) * 0.8) aim(map, turf.centroid(g.region).geometry.coordinates, null, MID);
                        else {
                            const [hx, hy] = P(g.hider);
                            let best = null;
                            for (const r of rings)
                                for (let i = 1; i < r.length; i++) {
                                    const [ax, ay] = r[i - 1];
                                    const [bx, by] = r[i];
                                    const t = Math.max(0, Math.min(1, ((hx - ax) * (bx - ax) + (hy - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2 || 1)));
                                    const q = [ax + t * (bx - ax), ay + t * (by - ay)];
                                    const d = Math.hypot(q[0] - hx, q[1] - hy);
                                    if (!best || d < best.d) best = { q, d };
                                }
                            map.panBy([(hx + best.q[0]) / 2 - MID[0], (hy + best.q[1]) / 2 - MID[1]], { animate: false });
                        }
                        // YOU never at the screen's edge.
                        const [hx, hy] = P(g.hider);
                        const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
                        map.panBy([hx - clamp(hx, 70, W - 70), hy - clamp(hy, HEAD + 190, H - 80)], { animate: false });
                    }
                    if (spec.screen) {
                        // Placed by hand on screen; a stalker that lands in the white steps down into the black.
                        const { LL } = scr(map);
                        const inWhite = (ll) => turf.booleanPointInPolygon(turf.point(ll), g.region);
                        g.hider = LL(...spec.screen.you);
                        g.deg = spec.screen.deg;
                        g.pos = {};
                        spec.screen.st.forEach(([x, y], i) => {
                            let moved = false;
                            while (inWhite(LL(x, y))) (y += 4), (moved = true);
                            g.pos[i ? "camille" : "noah"] = LL(x, moved ? y + 14 : y);
                        });
                    } else placeStalkers(map, g, spec.a1);
                },
            };
        } else if (kind === "v") {
            const st = VS(spec.id);
            const g = { hider: st, pos: {}, qs: [], face: st };
            o = {
                g, view: "hider", pins: "gloss", gloss: "4.1", pinTop: 150, pinSize: 18, popup: spec.popup,
                ask: { nearest: "velo", by: "noah" },
                box: asked(3, "noah", "Which àVélo station are you closest to?", "1:02"),
                frame: (map) => {
                    if (z) aim(map, st, z, MID);
                    const { P } = scr(map);
                    const pins = Campus.layers.velo.places.map((p) => [p, P([p.lng, p.lat])]);
                    // Closest to this station, well clear of every pin (whose head stands above its point).
                    const ok = (x, y, ll) =>
                        pins.every(([, [px, py]]) => Math.abs(x - px) > 38 || y < py - 70 || y > py + 34) &&
                        pins.every(([p]) => p.id === spec.id || dist(ll, [p.lng, p.lat]) > dist(ll, st));
                    g.hider = placeYou(map, P(st), spec.deg, ok);
                    // The station and YOU together in the middle.
                    if (z) {
                        const [ax, ay] = P(st);
                        const [bx, by] = P(g.hider);
                        map.panBy([(ax + bx) / 2 - MID[0], (ay + by) / 2 - MID[1]], { animate: false });
                        // The same scene from a little further out, around its middle.
                        if (spec.zoomOut) map.setZoomAround(L.point(MID[0], MID[1] - HEAD), map.getZoom() - spec.zoomOut, { animate: false });
                    }
                    g.pos = { noah: off(st, 600, 500) };
                },
            };
        } else {
            const ew = kind === "e";
            const asker = spec.asker();
            const g = { hider: asker, pos: { camille: asker }, qs: [] };
            o = {
                g, view: "hider",
                ask: ew ? { ew: true, by: "camille" } : { ns: true, by: "camille" },
                box: asked(5, "camille", ew ? "Are you east or west of me?" : "Are you north or south of me?", "2:40"),
                frame: (map, _, oo) => {
                    // The line off-centre, leaving YOU's side the room.
                    const line = ew ? (spec.side > 0 ? 150 : W - 150) : spec.side > 0 ? 420 : 590;
                    aim(map, asker, z, ew ? [line, z ? MID[1] : null] : [z ? MID[0] : null, line]);
                    const { P } = scr(map);
                    const [lx, ly] = P(asker);
                    const from = ew ? [lx, spec.along] : [spec.along, ly];
                    // Straight across the line from where it's asked, D px off it.
                    const deg = ew ? (spec.side > 0 ? 0 : 180) : spec.side > 0 ? 90 : 270;
                    g.hider = placeYou(map, from, deg, (x, y) => (ew ? Math.abs(x - lx) > 70 : Math.abs(y - ly) > 70), 105);
                    g.face = asker;
                    const [hx, hy] = P(g.hider);
                    // The words where YOU isn't.
                    if (ew) oo.labelY = hy > 470 ? 340 : 690;
                    else oo.labelX = hx > W / 2 ? 105 : W - 105;
                    // Placed by hand: the line (through whoever asked) at a screen height, the words centred.
                    if (spec.screen) {
                        const { LL } = scr(map);
                        g.hider = LL(...spec.screen.you);
                        // A little closer, around the church: YOU keeps her spot under it, the line keeps its height.
                        if (spec.screen.zoomBy) map.setZoomAround(L.latLng(LM("church")[1], LM("church")[0]), map.getZoom() + spec.screen.zoomBy, { animate: false });
                        const at = LL(W / 2, spec.screen.line);
                        g.pos.camille = at;
                        g.face = at;
                        g.deg = spec.screen.deg;
                        oo.labelX = W / 2;
                        oo.labelLeft = spec.screen.left;
                    }
                },
            };
        }
        LIST.push(o);
        return draw(root, LIST.length);
    }
    const POST = Object.fromEntries(Object.entries(POST_PLACES).map(([k, list]) => [k, list.map((p) => p.name)]));

    window.Maps2 = { tagsOnly, youOnly, pinOnly, list: LIST.map((o, i) => ({ n: i + 1, name: o.name })), draw, drawSkin, drawHint, drawPost, POST, SKIN_LIST };
})();
