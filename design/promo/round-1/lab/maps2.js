/* global L, turf, Ink, Campus, Maps */

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
    };

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
        // HIDE & plus the logo's STALK, as in the app's header.
        const sx = 12 + cx.measureText("HIDE &").width + 7;
        const st = Ink.tuck("STALK", { size: 74, seed: "w13", mess: 1.15, tilt: -4, sizes: [1.06, 0.94, 1.02, 0.95, 1.0], rises: [0.02, -0.02, 0.03, 0, 0.02], spin: 5, overshoot: 0.05, color: "#000" });
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
    function tagBox(t) {
        const fs = TAGS === "big" ? 15 : TAGS === "base" ? 12 : 13;
        cv.font = tagFont(fs);
        const w = cv.measureText(t.label).width + fs * 1.3 + 12;
        const h = TAGS === "big" ? 30 : TAGS === "base" ? 24 : 26;
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
        // Every style but the original gets a 3px white ring, so it reads on black too.
        const ring = TAGS === "base" ? "" : ";box-shadow:0 0 0 3px #fff";
        const border = TAGS === "ink" && self ? "border:3px solid #000;outline:3px solid #fff;box-shadow:0 0 0 6px #000,0 0 0 9px #fff" : `border:3px solid #000${ring}`;
        if (TAGS === "sticker") out += `<div style="position:absolute;left:${left - 7}px;top:${top - 7}px;width:${w + 14}px;height:${h + 14}px;background:#fff"></div>`;
        if (TAGS === "shadow") out += `<div style="position:absolute;left:${left + 5}px;top:${top + 5}px;width:${w}px;height:${h}px;background:#000"></div>`;
        const pw = TAGS === "big" ? 9 : 7;
        if (!moved) out += `<div style="position:absolute;left:${x - pw}px;top:${top + h - 1}px;width:0;height:0;border-left:${pw}px solid transparent;border-right:${pw}px solid transparent;border-top:${TAGS === "big" ? 12 : 10}px solid #000"></div>`;
        out += `<div style="position:absolute;left:${left}px;top:${top}px;width:${w}px;height:${h}px;box-sizing:border-box;background:${dark ? "#000" : "#fff"};color:${dark ? "#fff" : "#000"};${border};font:${tagFont(fs)};line-height:${h - 6}px;letter-spacing:.06em;text-align:center">${label}</div>`;
        if (TAGS === "big" || TAGS === "sticker" || TAGS === "shadow" || moved) out += `<div style="position:absolute;left:${x - 5}px;top:${y - 5}px;width:10px;height:10px;background:#000;box-shadow:0 0 0 3px #fff"></div>`;
        return out;
    }
    /** A player: queued, so the tags can be spread out before drawing. */
    function tag(x, y, label, self) {
        PENDING.push({ x, y, label, self, dy: 0 });
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
        // Leaders first, so no line crosses over a tag.
        for (const t of list) html += tagHtml(t, boxes.get(t), "lead");
        for (const t of list) html += tagHtml(t, boxes.get(t), "body");
        PENDING = [];
        return html;
    }

    const ringsOf = (geom) => (geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates);
    const ringD = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join("") + "Z";

    /** The dashed line of an east/west or north/south question, by hand. */
    function dashed(a, b, seed) {
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
            out += Ink.pathEl([pt(s), pt(s + d / 2), pt(s + d)], { size: 4.2, color: R, thinning: 0.3, taperEnd: 3, taperStart: 2 });
        }
        return out;
    }

    async function draw(root, v) {
        const o = LIST[v - 1];
        TAGS = o.tags ?? "base";
        const g = state(o.game, o.upTo);
        root.style.background = "#fff";
        root.insertAdjacentHTML("beforeend", FILTER);
        const mapEl = document.createElement("div");
        mapEl.style.cssText = `position:absolute;left:0;top:${HEAD}px;width:${W}px;height:${H - HEAD}px;z-index:0;background:#fff`;
        root.appendChild(mapEl);
        const map = L.map(mapEl, { zoomControl: false, attributionControl: true, zoomSnap: 0, fadeAnimation: false, zoomAnimation: false });
        map.attributionControl.setPrefix(false);
        const redraw = RETRACE[o.skin];
        const tiles = (redraw ? Retrace.layer(redraw) : L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" })).addTo(map);
        mapEl.querySelector(".leaflet-tile-pane").style.filter = redraw ? "none" : SKINS[o.skin ?? "xerox"];
        // The whole campus, below the question box: no auto-zoom.
        const ring = Campus.layers.campus.ring;
        map.fitBounds(L.latLngBounds(ring.map(([lng, lat]) => [lat, lng])), { paddingTopLeft: [10, 118], paddingBottomRight: [10, 16], animate: false });
        // Skin samples only: the same moment, zoomed in on YOU.
        if (o.zoom) {
            const [lng, lat] = g.pos[g.me];
            map.setView([lat, lng], o.zoom, { animate: false });
        }
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
        if (q) {
            const who = g.pos[q.by];
            const c = P(who);
            if (q.ew) {
                red += dashed([c[0], HEAD + 110], [c[0], H + 10], `m2d${v}`);
                const y = HEAD + 150;
                red += Ink.write("WEST", { x: c[0] - 96, y: y + 190, size: 26, seed: `w${v}`, tilt: -3, importance: "key" }).svg + Ink.handArrow(c[0] - 26, y + 204, c[0] - 88, y + 206, { seed: `wa${v}`, weight: 3.6, bend: 0.05, head: 12 });
                red += Ink.write("EAST", { x: c[0] + 18, y: y + 190, size: 26, seed: `e${v}`, tilt: -3, importance: "key" }).svg + Ink.handArrow(c[0] + 24, y + 204, c[0] + 86, y + 202, { seed: `ea${v}`, weight: 3.6, bend: -0.05, head: 12 });
            } else if (q.radius) {
                const rp = q.radius * pxPerM;
                red += Ink.circle(c[0], c[1], rp, rp, { seed: `m2c${v}`, weight: 4.5, tilt: 0 });
                red += Ink.write(`${q.radius} M`, { x: c[0] + rp * 0.72 + 4, y: c[1] - rp * 0.72, size: 20, seed: `m2cm${v}`, tilt: -24, importance: "key" }).svg;
            } else if (q.nearest) {
                for (const p of Campus.layers[q.nearest].places) {
                    const [x, y] = P([p.lng, p.lat]);
                    if (y < HEAD + 110 || y > H) continue;
                    red += Ink.mapPin(x, y, { size: 13, seed: `m2p${p.id}`, color: R });
                }
            } else if (q.closer) {
                const lm = Campus.at("landmarks", q.closer);
                const [lx, ly] = P(lm);
                const rp = dist(lm, who) * pxPerM;
                red += Ink.circle(lx, ly, rp, rp, { seed: `m2k${v}`, weight: 4.5, tilt: 0 }) + Ink.mapPin(lx, ly, { size: 15, seed: "m2lm", color: R });
            }
        }

        // One string at most: the hider to the closest stalker.
        if (o.tether) {
            const hp = P(g.hider);
            const [name, p] = Object.entries(g.pos).sort((a, b) => dist(g.hider, a[1]) - dist(g.hider, b[1]))[0];
            const sp = P(p);
            red += Ink.string(hp[0], hp[1], sp[0], sp[1], { width: 3, sag: 10 });
            red += Ink.write(`${Math.round(dist(g.hider, p))} M`, { x: (hp[0] + sp[0]) / 2 - 20, y: (hp[1] + sp[1]) / 2 + 30, size: 18, seed: `t${v}`, tilt: -6, importance: "key" }).svg;
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

        // People: computer-drawn name tags.
        const me = o.view === "hider" ? null : g.me;
        if (o.view === "hider") {
            const hp = P(g.hider);
            html += tag(hp[0], hp[1], "YOU", true);
            for (const [n, p] of Object.entries(g.pos)) html += tag(...P(p), n.toUpperCase(), false);
        } else {
            for (const [n, p] of Object.entries(g.pos)) html += tag(...P(p), n === me ? "YOU" : n.toUpperCase(), n === me);
        }

        // Above the inverted layer, so the tags never get flipped.
        html += `<div style="position:absolute;inset:0;z-index:20">${flushTags()}</div>`;
        const c = chrome(o.box);
        const layer = (z, inner, svg) => root.insertAdjacentHTML("beforeend", svg ? `<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0;pointer-events:none;z-index:${z};overflow:visible">${inner}</svg>` : `<div style="position:absolute;inset:0;pointer-events:none;z-index:${z}">${inner}</div>`);
        layer(4, under, true);
        layer(6, html.split("<!--tags-->")[0]);
        layer(40, red, true);
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
        { game: G, upTo: 2, view: "stalker", ask: { nearest: "cafe", by: "noah_b" }, box: asked(3, "noah_b", "Which café on campus are you closest to?", "1:02"), name: "Q3 nearest café: the cafés, pinned in red (stalker)" },
        { game: G, upTo: 2, view: "hider", ask: { nearest: "cafe", by: "noah_b" }, box: asked(3, "noah_b", "Which café on campus are you closest to?", "1:02"), name: "Same question, the hider's map" },
        { game: G, upTo: 3, view: "stalker", ask: { closer: "greenhouses", by: "noah_b" }, box: asked(4, "noah_b", "Are you closer to the greenhouses than I am?", "0:48"), name: "Q4 closer than me: the circle through noah_b" },
        { game: G, upTo: 4, view: "stalker", ask: { ew: true, by: "camille" }, box: asked(5, "camille", "Are you east or west of me?", "2:40"), name: "Q5 east or west: the line, which side is which" },
        { game: G, upTo: 4, view: "hider", ask: { ew: true, by: "camille" }, box: asked(5, "camille", "Are you east or west of me?", "2:40"), name: "Same question, the hider's map" },
        { game: "pubu", upTo: 3, view: "stalker", ask: { radius: 200, by: "lea" }, box: asked(4, "lea", "Are you within 200 m of me?", "4:05"), name: "Game 2, within 200 m: the circle (stalker)" },
        { game: "pubu", upTo: 3, view: "hider", ask: { radius: 200, by: "lea" }, box: asked(4, "lea", "Are you within 200 m of me?", "4:05"), name: "Same question, the hider's map" },
        // The hider between questions: one string, to the closest stalker.
        { game: G, upTo: 2, view: "hider", tether: true, box: next(3, "3:12", "Closest stalker, as the crow flies."), name: "Hider between questions: one string, the closest stalker" },
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
    const SKIN_LIST = ["xerox", "xeroxdark", "ground", "grain", "hatch", "dots", "lines", "linesbold", "sketch", "streets", "grey", "osm", "xeroxmid", "grainlight", "traced", "tracedthin", "traceddots", "tracedgreen", "tracedbold", "dotsonly", "tone", "tonelight", "tonegrey", "dotsclean", "streetsclean", "grainclean"];
    const ZOOMS = { a: null, b: 16.6, c: 18.2 };
    function drawSkin(root, code) {
        const [, n, z] = /^(\d+)([abc])$/.exec(code);
        LIST.push({ game: G, upTo: 2, view: "stalker", skin: SKIN_LIST[n - 1], zoom: ZOOMS[z], box: next(3, "3:12") });
        return draw(root, LIST.length);
    }

    // The hints layer, third pass: N01-N03 only, on S16 (no text), each with
    // the five ways of making the players visible.
    const TAG_LIST = ["base", "big", "ink", "sticker", "shadow", "marker"];
    function drawHint(root, code) {
        const [, n, t] = /^(\d)([a-f])$/.exec(code);
        const base = LIST[Number(n) - 1];
        LIST.push({ ...base, skin: "tracedthin", tags: TAG_LIST["abcdef".indexOf(t)] });
        return draw(root, LIST.length);
    }

    window.Maps2 = { list: LIST.map((o, i) => ({ n: i + 1, name: o.name })), draw, drawSkin, drawHint, SKIN_LIST };
})();
