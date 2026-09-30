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
    const step = Array.from({ length: 40 }, (_, i) => (i / 40 < 0.7 ? 0 : 1)).join(" ");
    const cut = (c) => Array.from({ length: 40 }, (_, i) => (i / 40 < c ? 0 : 1)).join(" ");
    const tf = (id, c) => `<filter id="${id}" color-interpolation-filters="sRGB">${LUMA}<feComponentTransfer><feFuncR type="discrete" tableValues="${cut(c)}"/><feFuncG type="discrete" tableValues="${cut(c)}"/><feFuncB type="discrete" tableValues="${cut(c)}"/></feComponentTransfer></filter>`;
    const FILTER = `<svg width="0" height="0" style="position:absolute"><defs>${tf("m2x", 0.7)}${tf("m2g", 0.86)}
        <filter id="m2l" color-interpolation-filters="sRGB">${LUMA}<feConvolveMatrix order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true"/><feComponentTransfer><feFuncR type="discrete" tableValues="1 1 0 0 0 0 0 0 0 0"/><feFuncG type="discrete" tableValues="1 1 0 0 0 0 0 0 0 0"/><feFuncB type="discrete" tableValues="1 1 0 0 0 0 0 0 0 0"/></feComponentTransfer></filter></defs></svg>`;
    // The skins: how the tiles are printed.
    const SKINS = { xerox: "url(#m2x)", ground: "url(#m2g)", lines: "url(#m2l)", grey: "grayscale(1) contrast(1.3)", osm: "none" };

    // The app around the map (direction E): header with MAP open, the question box.
    function chrome(box) {
        const hdr = `<div style="position:absolute;left:0;top:0;width:${W}px;height:${HEAD}px;background:#fff;border-bottom:3px solid #000;box-sizing:border-box;z-index:60">
            <div style="position:absolute;left:12px;top:17px;font:700 17px ${FONT};white-space:pre">HIDE &amp; SEEK</div>
            <div style="position:absolute;right:98px;top:12px;width:40px;height:40px;box-sizing:border-box;border:3px solid #000;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#000" stroke-width="2.5"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg></div>
            <div style="position:absolute;right:12px;top:12px;height:40px;box-sizing:border-box;border:3px solid #000;padding:0 10px;font:700 14px/34px ${FONT}">Log out</div>
            <div style="position:absolute;left:12px;bottom:-3px;display:flex;gap:6px;align-items:flex-end">
                <div style="width:124px;height:40px;box-sizing:border-box;border:3px solid #000;background:#000;color:#fff;font:700 17px/37px ${FONT};letter-spacing:.12em;text-align:center;margin-bottom:3px">MENU</div>
                <div style="width:124px;height:46px;box-sizing:border-box;border:3px solid #000;border-bottom:none;background:#fff;font:700 17px/43px ${FONT};letter-spacing:.12em;text-align:center">MAP</div></div></div>`;
        // The header's red steps back to black: the map always has its one red thing.
        const cx = document.createElement("canvas").getContext("2d");
        cx.font = `700 17px ${FONT}`;
        const sx = 12 + cx.measureText("HIDE & ").width;
        const skw = cx.measureText("SEEK").width;
        const hdrInk = Ink.scribbleOut(sx, 20, skw, 13, { seed: "m2h", passes: 3, weight: 3, color: "#000" }) + Ink.write("STALK", { x: sx + skw + 6, y: 38, size: 19, weight: 3.8, seed: "hdrs", tilt: -7, spacing: 0.1, mess: 0.45, color: "#000" }).svg;
        const q = `<div style="position:absolute;left:12px;top:${HEAD + 12}px;width:${W - 24}px;box-sizing:border-box;background:#fff;border:3px solid #000;padding:12px 14px;z-index:55;font-family:${FONT}">
            <div style="display:flex;justify-content:space-between;font:700 13px ${FONT};letter-spacing:.12em"><span>${box.kicker}</span><span>${box.clock ?? ""}</span></div>
            ${box.text ? `<div style="margin-top:6px;font:700 20px/1.2 ${FONT};letter-spacing:-.01em">${box.text}</div>` : ""}
            ${box.legend ? `<div style="margin-top:6px;font:400 14px/1.3 ${FONT}">${box.legend}</div>` : ""}</div>`;
        return { html: hdr + q, ink: hdrInk };
    }

    /** A player: a name tag pointing at where they are. */
    function tag(x, y, label, self) {
        const w = label.length * 8.6 + 16;
        return `<div style="position:absolute;left:${x - w / 2}px;top:${y - 34}px;width:${w}px;height:24px;box-sizing:border-box;background:${self ? "#000" : "#fff"};color:${self ? "#fff" : "#000"};border:3px solid #000;font:700 12px/18px ${FONT};letter-spacing:.06em;text-align:center">${label}</div>
            <div style="position:absolute;left:${x - 6}px;top:${y - 11}px;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:9px solid #000"></div>`;
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
        const g = state(o.game, o.upTo);
        root.style.background = "#fff";
        root.insertAdjacentHTML("beforeend", FILTER);
        const mapEl = document.createElement("div");
        mapEl.style.cssText = `position:absolute;left:0;top:${HEAD}px;width:${W}px;height:${H - HEAD}px;z-index:0;background:#fff`;
        root.appendChild(mapEl);
        const map = L.map(mapEl, { zoomControl: false, attributionControl: true, zoomSnap: 0, fadeAnimation: false, zoomAnimation: false });
        map.attributionControl.setPrefix(false);
        const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "© OpenStreetMap" }).addTo(map);
        mapEl.querySelector(".leaflet-tile-pane").style.filter = SKINS[o.skin ?? "xerox"];
        // The whole campus, below the question box: no auto-zoom.
        const ring = Campus.layers.campus.ring;
        map.fitBounds(L.latLngBounds(ring.map(([lng, lat]) => [lat, lng])), { paddingTopLeft: [10, 118], paddingBottomRight: [10, 16], animate: false });
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

    window.Maps2 = { list: LIST.map((o, i) => ({ n: i + 1, name: o.name })), draw };
})();
