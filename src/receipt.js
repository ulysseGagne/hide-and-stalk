/* global HNSCards, HNSHints, HNSMapDraw, Ink */

// The end of a round, as a till receipt (S71-S74 in the design review,
// decided Oct 1): the questions and their answers, the hunt time big, the
// hide time, who found the hider (or, when nobody did, where they hid,
// redacted), and the round's final hints map printed on the slip in black and
// white only: what the answers ruled out inverted, the white the hider could
// still be in as the map, no red, framed on that white. Then a barcode, and
// the torn bottom edge.

(function () {
    let onRender = () => {};
    let renderedKey = null;
    let building = null;
    const el = () => document.getElementById("receipt");

    const escapeHtml = (str) =>
        String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

    function formatMs(ms) {
        const total = Math.max(0, Math.round(ms / 1000));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        const mm = String(m).padStart(2, "0");
        const ss = String(s).padStart(2, "0");
        return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
    }

    /** One answer as the slip prints it: short, in capitals. */
    function slipAnswer(card, play) {
        if (play.answeredAt === null || play.answer === null) return "—";
        const type = card?.answer.type;
        if (type === "photo") return "PHOTO";
        if (type === "choice") {
            const place = HNSCards.catalog()?.landmarkGroups[card.answer.group]?.places.find((p) => p.id === play.answer);
            const label = place?.label ?? String(play.answer);
            // Buildings by their code; bus stops keep their number (several share a name).
            const code = /\(([^)]+)\)\s*$/.exec(label)?.[1];
            if (card.answer.group === "building" && code) return code.toUpperCase();
            if (card.answer.group === "bus_stop") return label.toUpperCase();
            return label.replace(/\s*\(.*?\)\s*/g, " ").trim().toUpperCase();
        }
        return String(HNSCards.describeAnswer(card, play.answer) ?? "").toUpperCase();
    }

    const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const pad2 = (n) => String(n).padStart(2, "0");

    /** A till-slip barcode: black bars, typeset (not drawn), from the slip's own number. */
    function barcode(digits) {
        const r = Ink.rng(`bc${digits}`);
        let x = 0;
        let bars = "";
        while (x < 236) {
            const w = r.pick([1.5, 1.5, 3, 4.5]);
            bars += `<rect x="${x}" y="0" width="${w}" height="44" fill="#000"/>`;
            x += w + r.pick([1.5, 3, 3, 4.5]);
        }
        return `<svg viewBox="0 0 ${x} 44" preserveAspectRatio="none" aria-hidden="true">${bars}</svg><div class="rc-num">${escapeHtml(digits)}</div>`;
    }

    /**
     * The torn bottom: the same 3px line as the sides, zigzagging across. The
     * drawing stretches to the receipt's width, so its sides sit on its own
     * edges, and styles.css insets it by half a line: they land on the
     * middle of the sides' line, whatever the width.
     */
    function tear() {
        let d = "M0 0";
        const n = 20;
        for (let i = 0; i <= n; i++) d += ` L${((i / n) * 100).toFixed(2)} ${i % 2 ? 1.5 : 10.5}`;
        d += " L100 0";
        return `<svg class="rc-tear" viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true"><path d="${d} Z" fill="#fff" stroke="none"/><path d="${d}" fill="none" stroke="#000" stroke-width="3" vector-effect="non-scaling-stroke" stroke-linejoin="miter"/></svg>`;
    }

    function slipHtml({ team, plays }) {
        const ended = new Date(team.endedAt ?? Date.now());
        const head = `TEAM ${team.id} · ${DAYS[ended.getDay()]} ${ended.getDate()} ${MONTHS[ended.getMonth()]} · ${pad2(ended.getHours())}:${pad2(ended.getMinutes())}`;
        const digits = `${team.id % 10} ${pad2(ended.getDate())}${pad2(ended.getMonth() + 1)}${pad2(ended.getFullYear() % 100)} ${pad2(ended.getHours())}${pad2(ended.getMinutes())}${pad2(ended.getSeconds())}`;
        const row = (label, value) => `<div class="rc-row"><span>${label}</span><b>${value}</b></div>`;
        const lines = [...plays]
            .sort((a, b) => (a.question ?? 0) - (b.question ?? 0) || a.askedAt - b.askedAt)
            .map((play) => {
                const card = HNSCards.cardById(play.cardId);
                // "Q1 North or south?": the number in a black box, like the app's labels.
                return row(`<em class="rc-q">Q${play.question}</em>${escapeHtml(card?.short ?? play.cardId)}`, escapeHtml(slipAnswer(card, play)));
            })
            .join("");
        const found = team.outcome === "seekers";
        const totals =
            row("Hide", formatMs(team.hideMs ?? 0)) +
            (found ? row("Found by", escapeHtml(team.caughtByName ?? "—")) : row("Where", '<i class="rc-redact" aria-label="Redacted"></i>'));
        return `<div class="rc-paper">
            <div class="rc-title">HIDE AND STALK</div>
            <div class="rc-head">${escapeHtml(head)}</div>
            <div class="rc-rule"></div>
            <div class="rc-hero"><span>Hunt</span><b>${formatMs(team.huntMs ?? 0)}</b></div>
            <div class="rc-rule"></div>
            ${lines}
            <div class="rc-rule"></div>
            ${totals}
            <div class="rc-rule"></div>
            ${row("Questions asked", `${plays.length} of ${team.maxQuestions}`)}
            <div class="rc-map"><canvas aria-label="Where the hider could still be when the round ended"></canvas></div>
            <div class="rc-osm">© OpenStreetMap</div>
            <div class="rc-code">${barcode(digits)}</div>
        </div>${tear()}`;
    }

    // -----------------------------------------------------------------------
    // The map on the slip
    // -----------------------------------------------------------------------
    /**
     * The view that frames a box (lng/lat) in w x h with a margin, as
     * Leaflet's fitBounds({ padding }) would: { z, x, y } for mapdraw.js.
     */
    function frame(bbox, w, h, margin) {
        const [minX, minY, maxX, maxY] = bbox;
        const a = HNSMapDraw.project(minX, maxY, 0);
        const b = HNSMapDraw.project(maxX, minY, 0);
        const dx = Math.max(b[0] - a[0], 1e-9);
        const dy = Math.max(b[1] - a[1], 1e-9);
        const z = Math.min(18, Math.log2(Math.min((w - 2 * w * margin) / dx, (h - 2 * h * margin) / dy)));
        const k = 2 ** z;
        const cx = ((a[0] + b[0]) / 2) * k;
        const cy = ((a[1] + b[1]) / 2) * k;
        return { z, x: cx - w / 2, y: cy - h / 2 };
    }

    function ringsOf(geom) {
        return geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
    }

    function bboxOf(geom) {
        let b = [Infinity, Infinity, -Infinity, -Infinity];
        for (const poly of ringsOf(geom)) for (const [x, y] of poly[0]) b = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)];
        return b;
    }

    let drawn = null; // what the map was last printed with: { canvas, region, w, h }
    async function printMap(canvas, region) {
        await HNSMapDraw.ready;
        const holder = canvas.parentElement;
        const w = holder.clientWidth;
        const h = holder.clientHeight;
        if (!w || !h || !region) return;
        if (drawn?.canvas === canvas && drawn.region === region && drawn.w === w && drawn.h === h) return;
        drawn = { canvas, region, w, h };
        const ratio = HNSMapDraw.canvasRatio();
        canvas.width = Math.round(w * ratio);
        canvas.height = Math.round(h * ratio);
        const ctx = canvas.getContext("2d");
        ctx.scale(ratio, ratio);
        const view = { ...frame(bboxOf(region.geometry), w, h, 0.22), w, h, ratio };
        HNSMapDraw.draw(ctx, view);
        // What the answers ruled out, inverted: everything but the region, as a difference with white.
        ctx.globalCompositeOperation = "difference";
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.rect(-10, -10, w + 20, h + 20);
        for (const poly of ringsOf(region.geometry)) {
            for (const ring of poly) {
                ring.forEach(([lng, lat], i) => {
                    const [px, py] = HNSMapDraw.project(lng, lat, view.z);
                    const x = px - view.x;
                    const y = py - view.y;
                    if (i) ctx.lineTo(x, y);
                    else ctx.moveTo(x, y);
                });
                ctx.closePath();
            }
        }
        ctx.fill("evenodd");
        ctx.globalCompositeOperation = "source-over";
    }

    async function build(key, { team }) {
        const plays = await HNSCards.history();
        if (renderedKey !== key) return;
        const node = el();
        node.innerHTML = slipHtml({ team, plays });
        node.hidden = false;
        onRender();
        // The round can end while another tab is open (the map's box is 0
        // wide until this one is shown) or before the hints have their last
        // answer: the map is printed whenever its box gets a size, and again
        // when the hints change (init), not just now.
        mapObserver?.disconnect();
        mapObserver = new ResizeObserver(() => printMap(node.querySelector(".rc-map canvas"), HNSHints.region()));
        mapObserver.observe(node.querySelector(".rc-map"));
        await printMap(node.querySelector(".rc-map canvas"), HNSHints.region());
        onRender();
    }

    let mapObserver = null;

    window.HNSReceipt = {
        init(options) {
            onRender = options.onRender ?? (() => {});
            HNSHints.onStatus(() => {
                const canvas = renderedKey ? el()?.querySelector(".rc-map canvas") : null;
                if (canvas) printMap(canvas, HNSHints.region());
            });
        },
        /** Called with every render of the home screen: { team, me, users } once the round is over, else null. */
        render(ctx) {
            const node = el();
            if (!ctx) {
                if (renderedKey !== null) {
                    renderedKey = null;
                    mapObserver?.disconnect();
                    drawn = null;
                    node.hidden = true;
                    node.innerHTML = "";
                }
                return;
            }
            const { team, me } = ctx;
            const key = `${team.id}:${team.endedAt}:${team.outcome}:${me.role}`;
            if (key === renderedKey) return;
            renderedKey = key;
            building = build(key, ctx).catch((err) => {
                console.error("receipt:", err);
                // Try again in a little while (the next render after that).
                setTimeout(() => {
                    if (renderedKey === key) renderedKey = null;
                }, 5000);
            });
        },
        reset() {
            renderedKey = null;
            const node = el();
            if (node) {
                node.hidden = true;
                node.innerHTML = "";
            }
        },
        ready: () => building,
    };
})();
