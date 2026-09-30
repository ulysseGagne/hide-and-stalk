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
    function chrome(box) {
        const hdr = `<div style="position:absolute;left:0;top:0;width:${W}px;height:${HEAD}px;background:#fff;border-bottom:3px solid #000;box-sizing:border-box;z-index:60">
            <div style="position:absolute;left:12px;top:17px;font:700 17px ${FONT};white-space:pre">HIDE &amp;</div>
            <div style="position:absolute;right:98px;top:12px;width:40px;height:40px;box-sizing:border-box;border:3px solid #000;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#000" stroke-width="2.5"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg></div>
            <div style="position:absolute;right:12px;top:12px;height:40px;box-sizing:border-box;border:3px solid #000;padding:0 10px;font:700 14px/34px ${FONT}">Log out</div>
            <div style="position:absolute;left:12px;bottom:-3px;display:flex;gap:6px;align-items:flex-end">
                <div style="width:124px;height:40px;box-sizing:border-box;border:3px solid #000;background:#000;color:#fff;font:700 17px/37px ${FONT};letter-spacing:.12em;text-align:center;margin-bottom:3px">MENU</div>
                <div style="width:124px;height:46px;box-sizing:border-box;border:3px solid #000;border-bottom:none;background:#fff;font:700 17px/43px ${FONT};letter-spacing:.12em;text-align:center">MAP</div></div></div>`;
        // The header's red steps back to black: the map always has its one red thing.
        const cx = document.createElement("canvas").getContext("2d");
        cx.font = `700 17px ${FONT}`;
        // HIDE & plus the logo's STALK (L16.6b's), as in the app's header.
        const sx = 12 + cx.measureText("HIDE &").width + 7;
        const st = Logo.stalk({ color: "#000" });
        const sk = 25 / st.box.h;
        const hdrInk = `<g transform="translate(${sx - st.box.x * sk} ${40 - (st.box.y + st.box.h) * sk}) scale(${sk})">${st.svg}</g>`;
        const q = `<div style="position:absolute;left:12px;top:${HEAD + 12}px;width:${W - 24}px;box-sizing:border-box;background:#fff;border:3px solid #000;padding:12px 14px;z-index:55;font-family:${FONT}">
            <div style="display:flex;justify-content:space-between;font:700 13px ${FONT};letter-spacing:.12em"><span>${box.kicker}</span><span>${box.clock ?? ""}</span></div>
            ${box.text ? `<div style="margin-top:6px;font:700 20px/1.2 ${FONT};letter-spacing:-.01em">${box.text}</div>` : ""}
            ${box.legend ? `<div style="margin-top:6px;font:400 14px/1.3 ${FONT}">${box.legend}</div>` : ""}</div>`;
        return { html: hdr + q, ink: hdrInk };
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
        // No pin: the circle is the one red thing; the landmark gets a white tag.
        "10.1": { mark: "tag" },
        // The hints layer with one player tapped: her name shows above her pin.
        "3a.1": { tapped: "camille" },
        // N08 with the map pins filled in, the dot a hole; and a café tapped.
        "8a": { pins: "filled" },
        // N08 with the glossy map pin (G1: the pins' look, the map through its hole).
        "8b": { pins: "gloss", gloss: 1 },
        "8.2a": { pins: "filled", popup: true },
    };

    async function draw(root, code) {
        const v = parseInt(String(code), 10);
        // "08.2a" and "8.2a" are the same variant.
        const o = { ...LIST[v - 1], ...(VARIANTS[String(code).replace(/^0+(?=\d)/, "")] ?? {}) };
        const skin = o.skin ?? MAP_SKIN;
        TAGS = o.tags ?? "base";
        const g = state(o.game, o.upTo);
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
        if (q) {
            const who = g.pos[q.by];
            const c = P(who);
            if (q.ew) {
                // A bolder line; the words well clear of it, no arrows. WEST goes a
                // little further out than EAST: its T reads closer to the line.
                red += dashed([c[0], HEAD + 110], [c[0], H + 10], `m2d${v}`, 6.2);
                const y = HEAD + 340;
                const west = { size: 26, seed: `w${v}`, tilt: -3, importance: "key", weight: 26 * 0.21 };
                red += Ink.write("WEST", { ...west, x: c[0] - 30 - Ink.write("WEST", west).width, y }).svg;
                red += Ink.write("EAST", { x: c[0] + 28, y, size: 26, seed: `e${v}`, tilt: -3, importance: "key", weight: 26 * 0.21 }).svg;
            } else if (q.radius) {
                // Circles are exact (centre and radius), only drawn by hand.
                const rp = q.radius * pxPerM;
                red += Ink.ring(c[0], c[1], rp, { seed: `m2c${v}`, weight: 4.5 });
                red += Ink.write(`${q.radius} M`, { x: c[0] + rp * 0.72 + 14, y: c[1] - rp * 0.72 - 8, size: 24, seed: `m2cm${v}`, tilt: -24, importance: "key" }).svg;
            } else if (q.nearest) {
                const shown = [];
                for (const p of Campus.layers[q.nearest].places) {
                    const [x, y] = P([p.lng, p.lat]);
                    if (y < HEAD + 110 || y > H) continue;
                    red += pinAt(x, y, 13, `m2p${p.id}`);
                    shown.push({ p, x, y });
                }
                // One café tapped: its box, as the app's popup has it (the name, then where).
                if (o.popup) {
                    const { p, x, y } = shown.filter((s) => s.y > HEAD + 260).sort((a, b) => a.y - b.y)[0];
                    const w = 214;
                    const left = Math.max(12, Math.min(W - 12 - w, x - w / 2));
                    const bottom = y - (o.pins === "push" ? 16 : 34);
                    const rows = (p.detail ?? []).filter(([k]) => k === "Pavillon" || k === "Room").map(([k, val]) => `<div><span style="font-weight:700">${k}</span> ${val}</div>`).join("");
                    popup = `<div style="position:absolute;left:${x - 9}px;top:${bottom - 3}px;width:0;height:0;border-left:9px solid transparent;border-right:9px solid transparent;border-top:12px solid #000"></div>
                        <div style="position:absolute;left:${left}px;top:${bottom}px;transform:translateY(-100%);width:${w}px;box-sizing:border-box;background:#fff;border:3px solid #000;padding:8px 10px;font:400 13px/1.35 ${FONT}">
                        <div style="font:700 15px/1.2 ${FONT};margin-bottom:3px">${p.label}</div>${rows}</div>`;
                }
            } else if (q.closer) {
                const lm = Campus.at("landmarks", q.closer);
                const [lx, ly] = P(lm);
                const rp = dist(lm, who) * pxPerM;
                red += Ink.ring(lx, ly, rp, { seed: `m2k${v}`, weight: 4.5 });
                if (o.mark === "tag") tag(lx, ly, q.closer.toUpperCase(), false, true);
                else red += pinAt(lx, ly, 15, "m2lm");
            }
        }

        // One string at most: the hider to the closest stalker.
        if (o.tether) {
            const hp = P(g.hider);
            const [name, p] = Object.entries(g.pos).sort((a, b) => dist(g.hider, a[1]) - dist(g.hider, b[1]))[0];
            const sp = P(p);
            red += Ink.string(hp[0], hp[1], sp[0], sp[1], { width: 3, sag: 10 });
            red += Ink.write(`${Math.round(dist(g.hider, p))} M`, { x: (hp[0] + sp[0]) / 2 - 24, y: (hp[1] + sp[1]) / 2 + 34, size: 22, seed: `t${v}`, tilt: -6, importance: "key" }).svg;
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
        const other = (n, p) => {
            const [px, py] = P(p);
            pins += Ink.pin(px, py, { size: 8 });
            if (o.tapped === n) tag(px, py - 7, n.toUpperCase(), false);
        };
        if (o.view === "hider") {
            const hp = P(g.hider);
            const [, near] = Object.entries(g.pos).sort((a, b) => dist(g.hider, a[1]) - dist(g.hider, b[1]))[0];
            you = youMark(hp[0], hp[1], "p", bearing(g.hider, near));
            for (const [n, p] of Object.entries(g.pos)) other(n, p);
        } else {
            for (const [n, p] of Object.entries(g.pos)) {
                if (n !== g.me) other(n, p);
                else you = youMark(...P(p), "p", bearing(p, g.hider));
            }
        }

        // Design rule: the players' names are the one thing drawn over the red.
        const tagsHtml = flushTags();
        const c = chrome(o.box);
        const layer = (z, inner, svg) => root.insertAdjacentHTML("beforeend", svg ? `<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0;pointer-events:none;z-index:${z};overflow:visible">${inner}</svg>` : `<div style="position:absolute;inset:0;pointer-events:none;z-index:${z}">${inner}</div>`);
        layer(4, under, true);
        layer(6, html.split("<!--tags-->")[0]);
        layer(40, red, true);
        layer(49, pins, true);
        layer(50, tagsHtml);
        layer(52, you, true);
        layer(55, popup);
        layer(60, c.html);
        layer(65, c.ink, true);
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
        { game: G, upTo: 2, view: "stalker", ask: { nearest: "cafe", by: "noah" }, box: asked(3, "noah", "Which café on campus are you closest to?", "1:02"), name: "Q3 nearest café: the cafés, pinned in red (stalker)" },
        { game: G, upTo: 2, view: "hider", ask: { nearest: "cafe", by: "noah" }, box: asked(3, "noah", "Which café on campus are you closest to?", "1:02"), name: "Same question, the hider's map" },
        { game: G, upTo: 3, view: "stalker", ask: { closer: "greenhouses", by: "noah" }, box: asked(4, "noah", "Are you closer to the greenhouses than I am?", "0:48"), name: "Q4 closer than me: the circle through noah" },
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
        // p: B29's pushpin, no name; p.1: tapped, the name above it.
        if (t === "p" || t === "p.1") {
            const pin = Ink.pin(x, y, { size: 8 });
            if (t === "p") return pin;
            const bb = bubble(x, y - 7, label);
            return `${pin}<path d="M${bb.pts.map((q) => q.join(" ")).join("L")}Z" fill="#fff" stroke="#000" stroke-width="3" stroke-linejoin="miter"/>${tagText(bb.cx, bb.cy, label)}`;
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

    window.Maps2 = { tagsOnly, youOnly, pinOnly, list: LIST.map((o, i) => ({ n: i + 1, name: o.name })), draw, drawSkin, drawHint, SKIN_LIST };
})();
