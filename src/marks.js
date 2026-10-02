/* global Ink */

// The red layer on the app's own screens: everything red is drawn by hand
// (ink.js), never typeset. The marks, their sizes and their places are the
// design review's (design/promo/round-1/app/decorate.js); here they are drawn
// on the live page.
//
// Rules this file keeps:
//   - A screen always has one red thing telling you what to do: with nothing
//     else marked, an arrow at the button to press now (the black one).
//   - A notification outranks everything: a big arrow and NEW at the bell
//     until it is read.
//
// Marks are measured off the page and drawn into one SVG over the scrolling
// view, in its content coordinates, so they scroll with what they mark. The
// timer ticks every second, so a layer is only redrawn when what it would
// draw changes (its signature).

(function () {
    const W3 = "http://www.w3.org/2000/svg";
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];
    const visible = (el) => Boolean(el) && el.offsetParent !== null && !el.closest("[hidden]");
    const r1 = (n) => Math.round(n * 2) / 2;

    // -----------------------------------------------------------------------
    // Ids: a few marks clip with an id of their own (ink.js names it after
    // where the mark is). Many marks share a spot in their own little SVGs,
    // so every copy gets a fresh one.
    // -----------------------------------------------------------------------
    let idSerial = 0;
    function uniqueIds(svg) {
        const n = ++idSerial;
        return svg.replace(/id="([^"]+)"/g, `id="$1-u${n}"`).replace(/url\(#([^)]+)\)/g, `url(#$1-u${n})`);
    }

    // -----------------------------------------------------------------------
    // A layer over a scrolling container
    // -----------------------------------------------------------------------
    function makeLayer(container) {
        let svg = container.querySelector(":scope > svg.ink-layer");
        if (!svg) {
            svg = document.createElementNS(W3, "svg");
            svg.classList.add("ink-layer");
            svg.setAttribute("aria-hidden", "true");
            container.appendChild(svg);
        }
        return { container, svg, signature: null };
    }

    /** An element's box in the container's content coordinates. */
    function boxIn(container, el) {
        const o = container.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        return { x: r1(r.left - o.left + container.scrollLeft), y: r1(r.top - o.top + container.scrollTop), w: r1(r.width), h: r1(r.height) };
    }
    function rectIn(container, r) {
        const o = container.getBoundingClientRect();
        return { x: r1(r.left - o.left + container.scrollLeft), y: r1(r.top - o.top + container.scrollTop), w: r1(r.width), h: r1(r.height) };
    }

    /** Redraw a layer from its specs, unless they are what is already drawn. */
    function paint(layer, specs) {
        const signature = JSON.stringify(specs) + `|${layer.container.scrollWidth}x${layer.container.scrollHeight}`;
        if (signature === layer.signature) return;
        layer.signature = signature;
        layer.svg.setAttribute("width", layer.container.scrollWidth);
        layer.svg.setAttribute("height", layer.container.scrollHeight);
        layer.svg.innerHTML = specs.map(drawSpec).join("");
    }

    // -----------------------------------------------------------------------
    // The marks themselves (decorate.js's, one by one)
    // -----------------------------------------------------------------------
    const noteSvg = (text, x, y, o = {}) =>
        Ink.note(text, { x, y, size: o.size ?? 17, maxWidth: o.maxWidth ?? 160, seed: o.seed ?? text, tilt: o.tilt ?? -4, mess: o.mess, importance: o.importance ?? "aside", color: o.color, weight: o.weight }).svg;
    // As in the post (image 4): NEW's N a round turn at its top-left, not a point.
    const ROUND_N = [0.64, [[[0, 1], [0, 0.34], [0.03, 0.2], [0.11, 0.17], [0.19, 0.25], [0.64, 1], [0.64, 0]]]];
    const TUCK_GOTCHA = { size: 44, seed: "gotcha", mess: 1.2, tilt: -7, sizes: [1.5, 1, 0.98, 1.02, 0.96, 1.04], rises: [0.12, 0, 0.02, -0.02, 0.03, 0], spin: 4 };

    function drawSpec(s) {
        switch (s.t) {
            case "note":
                return noteSvg(s.text, s.x, s.y, s.o);
            case "write":
                // One line; past maxWidth it curls upward instead of wrapping.
                return Ink.write(s.text, { x: s.x, y: s.y, ...s.o }).svg;
            case "underline":
                return Ink.underline(s.x, s.y, s.w, { seed: s.seed, weight: s.weight });
            case "stamp": {
                // The role, stamped by hand at the reveal: a little bolder, box and word.
                const res = Ink.write(s.text, { x: s.x + 10, y: s.y + s.h + 8, size: 17, weight: 4.3, seed: "stamp", tilt: -6, spacing: 0.34, even: true });
                return Ink.box(s.x, s.y - 6, res.width + 22, s.h + 20, { seed: "stampbox", weight: 4.3, jitter: 2 }) + res.svg;
            }
            case "box":
                return Ink.box(s.x, s.y, s.w, s.h, { seed: s.seed, weight: s.weight, jitter: s.jitter });
            case "locked": {
                // Over the card's edge, a little unhinged; the words and the box a touch bold.
                const w = Ink.write("SENT · LOCKED IN", { x: s.x - 6, y: s.y + s.h - 10, size: 22, seed: "sent", tilt: -6, importance: "key", weight: 22 * 0.2 });
                return Ink.box(s.x - 24, s.y - 30, w.width + 42, s.h + 32, { seed: "sentbox", weight: 5, jitter: 6 }) + w.svg;
            }
            case "answer": {
                // The answer written in, and who gave it, small, in black.
                const res = Ink.write(s.text, { x: s.x + 4, y: s.y + 40, size: 34, seed: `ans${s.text}`, tilt: -3, maxWidth: s.w - 10, importance: "key" });
                return res.svg + Ink.write(`— ${s.who}`, { x: s.x + Math.min(res.width, s.w - 110) + 12, y: s.y + 56, size: 12, seed: "who", weight: 2.2, color: "#000", importance: "key" }).svg;
            }
            case "tick":
                return Ink.check(s.x, s.y, 28, { seed: s.seed, weight: 7 });
            case "bigcheck":
                return Ink.bigCheck(s.x, s.y, 40, { seed: s.seed, weight: 9 });
            case "arrow":
                return Ink.stubArrow(s.x1, s.y1, s.x2, s.y2, { seed: s.seed, weight: s.weight });
            case "circle":
                return Ink.circle(s.cx, s.cy, s.rx, s.ry, { seed: s.seed, weight: s.weight });
            case "gotcha": {
                // On top, so nothing typeset cuts it; the G big.
                const g = Ink.tuck("GOTCHA", TUCK_GOTCHA);
                return `<g transform="translate(${r1(s.right - g.box.w - g.box.x)} ${r1(s.top + 8 - (g.box.y + g.box.h))})">${g.svg}</g>`;
            }
            case "bell": {
                // Short and wide, NEW beside it.
                const tip = [s.x, s.y];
                return (
                    Ink.stubArrow(tip[0] - 78, tip[1] + 96, tip[0], tip[1], { seed: `bella${s.seed}`, weight: 13 }) +
                    Ink.write("NEW", { x: tip[0] - 22, y: tip[1] + 112, size: 44, weight: 9, seed: `belln${s.seed}`, tilt: -8, importance: "key", glyphs: { N: ROUND_N } }).svg
                );
            }
            default:
                return "";
        }
    }

    /** The arrow at the button to press now (the black one). */
    const ctaArrow = (b, seed) => ({ t: "arrow", x1: b.x + b.w - 34, y1: b.y + b.h + 64, x2: b.x + b.w - 70, y2: b.y + b.h - 8, seed: `cta${seed}`, weight: 11 });

    // -----------------------------------------------------------------------
    // The MENU view
    // -----------------------------------------------------------------------
    let menuLayer = null;

    /**
     * Draw the menu's marks for what is on it now.
     * s: { screen: "login" | "lobby" | "ready" | "hiding" | "hunting" | "ended" | "admin",
     *      role: "hider" | "stalker" | null, ending: "gotcha" | "howabout" | null }
     */
    function menu(s) {
        const view = $("#view-menu");
        if (!view) return;
        menuLayer ??= makeLayer(view);
        const box = (el) => boxIn(view, el);
        const panel = box($(".menu-panel", view));
        const right = panel.x + panel.w;
        const specs = [];

        if (s.screen === "login") {
            // Only until they start typing, or press Register.
            const form = $("#auth-form");
            const typed = form.username.value || form.password.value;
            const regBtn = $$(".auth-switch-btn")[1];
            if (!typed && !regBtn.classList.contains("active")) {
                const reg = box(regBtn);
                // Just under the tabs, so the username field still reads as empty.
                const nw = Ink.write("NEW? CLICK HERE", { x: 0, y: 0, size: 21, seed: "NEW? CLICK HERE", tilt: -4, importance: "info", weight: 4.6 }).width;
                specs.push({ t: "note", text: "NEW? CLICK HERE", x: r1(right - 4 - nw), y: reg.y + reg.h + 64, o: { size: 21, tilt: -4, maxWidth: 320, importance: "info", weight: 4.6 } });
                // A small arrow, touching no text: its point just under the R.
                const range = document.createRange();
                range.selectNodeContents(regBtn);
                const t = rectIn(view, range.getBoundingClientRect());
                const [ex, ey] = [t.x - 1, reg.y + reg.h - 4];
                specs.push({ t: "arrow", x1: ex - 26, y1: ey + 32, x2: ex, y2: ey, seed: "pareg", weight: 7 });
            }
        }

        const title = $("#status-title");
        if (s.screen === "lobby" && visible(title)) {
            // Underlined only where it helps: waiting for a team.
            const range = document.createRange();
            range.selectNodeContents(title);
            const rects = [...range.getClientRects()];
            const last = rects[rects.length - 1];
            if (last) {
                const b = rectIn(view, last);
                specs.push({ t: "underline", x: b.x, y: b.y + b.h + 5, w: Math.min(b.w, 250), seed: "tu", weight: 4 });
            }
            // READ THESE, under the Discord button (or, without one, the rules' heading).
            const d = $("#discord-btn");
            const anchor = visible(d) ? box(d) : (() => {
                const h = box($(".rules-head"));
                return { x: h.x, y: h.y - 70, w: h.w, h: 50 };
            })();
            specs.push({ t: "note", text: "READ THESE ↓", x: anchor.x + anchor.w - 262, y: anchor.y + anchor.h + 46, o: { size: 30, tilt: -6, maxWidth: 270, importance: "key", weight: 6.2 } });
            // The two rules that matter most, underlined.
            for (const strong of $$('.rules-list strong[data-mark="underline"]').filter(visible)) {
                const b = box(strong);
                specs.push({ t: "underline", x: b.x, y: b.y + b.h + 2, w: b.w, seed: `ru${strong.textContent.trim()}`, weight: 3.4 });
            }
        }

        // The role, stamped by hand at the reveal.
        const badge = $("#role-badge");
        const stamped = (s.screen === "ready" || s.screen === "hiding") && visible(badge);
        badge?.classList.toggle("stamped", stamped);
        if (stamped) specs.push({ t: "stamp", text: badge.textContent, ...box(badge) });

        if (s.screen === "hiding" && s.role === "hider") {
            // Under the paragraph and its rule, clear of both.
            const p = $("#status-text");
            const pb = visible(p) ? box(p) : box(title);
            specs.push({ t: "note", text: "WALK. DON'T RUN.", x: pb.x + 8, y: pb.y + pb.h + 86, o: { size: 30, maxWidth: 330, tilt: -4, importance: "key", weight: 6.2 } });
        }

        if (s.screen === "hunting" && s.role === "stalker") {
            const cards = $$("#card-row .card").filter(visible);
            const picked = cards.find((c) => c.classList.contains("picked"));
            if (cards.length) {
                // Between the rule and the first card (UNTIL QUESTION stays
                // readable), curling up. It stays once a card is picked, as in
                // the post (image 2).
                const first = box(cards[0]);
                specs.push({ t: "write", text: "PICK JUST ONE", x: first.x + 96, y: first.y - 10, o: { size: 32, weight: 5.6, spacing: 0.3, seed: "pick1", tilt: -5, maxWidth: first.w - 98, importance: "key" } });
            }
            if (picked) {
                const c = box(picked);
                specs.push({ t: "box", x: c.x - 4, y: c.y - 4, w: c.w + 8, h: c.h + 8, seed: "pick", weight: 5.5, jitter: 4 });
                const send = $("#send-btn");
                if (visible(send)) {
                    const b = box(send);
                    specs.push({ t: "note", text: "NOT SENT YET", x: b.x + b.w - 250, y: b.y + b.h + 44, o: { size: 34, maxWidth: 270, tilt: -5, importance: "key", weight: 6.5 } });
                }
            }
            const sent = $("#sent-card");
            if (visible(sent)) {
                if (sent.dataset.state === "waiting") specs.push({ t: "locked", ...box($(".sent-stamp", sent)) });
                const ans = $("#sent-answer");
                if (sent.dataset.state === "answered" && !sent.classList.contains("has-photo") && sent.dataset.answer) {
                    specs.push({ t: "answer", text: sent.dataset.answer, who: sent.dataset.who ?? "", ...box(ans) });
                }
                // A photo question: what it asks for, underlined by hand (the words stay black).
                for (const ul of $$(".ul-mark", sent)) {
                    for (const rect of ul.getClientRects()) {
                        const b = rectIn(view, rect);
                        specs.push({ t: "underline", x: b.x, y: b.y + b.h - 1 + 2.5, w: b.w, seed: "ul0a", weight: 5 });
                    }
                }
            }
        }

        if (s.role === "hider" && (s.screen === "hunting" || s.screen === "hiding")) {
            // The picked answer, ticked by hand like a ballot: on its circle.
            for (const opt of $$("#hider-panel .answer-option").filter(visible)) {
                const input = $("input", opt);
                if (!input?.checked) continue;
                const b = box(input);
                const cx = b.x + b.w / 2;
                const cy = b.y + b.h / 2;
                specs.push({ t: "tick", x: r1(cx - 0.55 * 28 + 2), y: r1(cy - 0.4 * 28 - 1), seed: `chk${opt.textContent.trim()}` });
            }
            // Answered: the big brush check at the right, just before the Change
            // button (the check is about 56 px wide), in the gap the question
            // and its answer leave there; one under the other down the list.
            for (const row of $$("#hider-answer-list .answer-row").filter(visible)) {
                const a = box($(".answer-row-answer", row));
                const change = $(".admin-btn", row);
                const x = change ? box(change).x - 58 : a.x + Math.min(a.w, 190) + 10;
                specs.push({ t: "bigcheck", x, y: a.y - 16, seed: `rc${row.dataset.playId}` });
            }
            const qrText = $("#hider-qr .hider-qr-text");
            // While a question waits, it is the thing to look at; the code's line comes after.
            const waiting = $$("#hider-question-list .question-card").some(visible);
            if (s.screen === "hunting" && visible(qrText) && !waiting) {
                // Under the code to read out (styles.css keeps the room), one
                // line, and an arrow after it pointing up at the code.
                const t = box(qrText);
                const text = "SHOW THIS TO THE STALKER";
                const o = { size: 17, maxWidth: 320, tilt: -3, importance: "key", weight: 4.8 };
                const y = t.y + t.h + 46;
                specs.push({ t: "note", text, x: t.x, y, o });
                const w = Ink.write(text, { x: 0, y: 0, seed: text, ...o }).width;
                // The tilt lifts the line's end: the arrow starts level with
                // its foot and leans up and left, toward the code.
                const ax = r1(t.x + w + 26);
                const ay = r1(y + 2 - w * Math.tan((3 * Math.PI) / 180));
                specs.push({ t: "arrow", x1: ax, y1: ay, x2: ax - 14, y2: ay - 36, seed: "qrup", weight: 6 });
            }
        }

        if (s.screen === "ended" && visible(title)) {
            const tb = box(title);
            if (s.ending === "gotcha") specs.push({ t: "gotcha", right: right - 6, top: tb.y });
            else if (s.ending === "howabout") specs.push({ t: "note", text: "HOW ABOUT THAT.", x: right - 282, y: tb.y + 8, o: { size: 26, tilt: -6, maxWidth: 300, importance: "vibe" } });
        }

        // Always something red telling you what to do: with nothing else
        // marked (here or at the bell), an arrow at the button to press now.
        if (!specs.length && !bellOn) {
            const cta = $$("#view-menu .cta").find(visible);
            if (cta) specs.push(ctaArrow(box(cta), s.screen));
        }
        paint(menuLayer, specs);
    }

    // -----------------------------------------------------------------------
    // The bell: a big arrow and NEW until the notification is read
    // -----------------------------------------------------------------------
    let bellOn = false;
    let screenSvg = null;
    let bellSignature = null;
    function bell(on, seed) {
        bellOn = Boolean(on);
        if (!screenSvg) {
            screenSvg = document.createElementNS(W3, "svg");
            screenSvg.id = "screen-ink";
            screenSvg.setAttribute("aria-hidden", "true");
            document.body.appendChild(screenSvg);
        }
        const btn = $("#bell");
        let spec = null;
        if (bellOn && visible(btn)) {
            const b = btn.getBoundingClientRect();
            spec = { t: "bell", x: r1(b.left + b.width / 2 - 6), y: r1(b.bottom + 6), seed };
        }
        const signature = JSON.stringify(spec) + `|${innerWidth}x${innerHeight}`;
        if (signature === bellSignature) return;
        bellSignature = signature;
        screenSvg.setAttribute("width", innerWidth);
        screenSvg.setAttribute("height", innerHeight);
        screenSvg.innerHTML = spec ? drawSpec(spec) : "";
    }

    // -----------------------------------------------------------------------
    // The permissions sheet
    // -----------------------------------------------------------------------
    let sheetLayer = null;
    function sheet() {
        const body = $("#perm-sheet .perm-body");
        if (!body || !visible(body)) return;
        sheetLayer ??= makeLayer(body);
        const box = (el) => boxIn(body, el);
        const specs = [];
        // The one thing to do next gets the arrow; what's done needs nothing.
        const next = $(".perm-btn.next", body);
        if (visible(next)) {
            const b = box(next);
            specs.push({ t: "arrow", x1: b.x - 36, y1: b.y + b.h + 50, x2: b.x + 16, y2: b.y + b.h - 10, seed: `pa${next.closest(".perm-row").dataset.perm}`, weight: 11 });
        }
        // Blocked: How to fix, circled.
        for (const fix of $$(".perm-row[data-state='blocked'] .perm-btn", body).filter(visible)) {
            const b = box(fix);
            specs.push({ t: "circle", cx: b.x + b.w / 2, cy: b.y + b.h / 2, rx: b.w / 2 + 12, ry: b.h / 2 + 12, seed: "fix", weight: 4.5 });
        }
        // Both on: the two Ons say it, no checks; the arrow goes to DONE.
        if (!specs.length) {
            const done = $("#perm-done");
            if (visible(done)) specs.push(ctaArrow(box(done), "permdone"));
        }
        paint(sheetLayer, specs);
    }

    // -----------------------------------------------------------------------
    // Handwriting in the flow of the page (the RESULTS tab's answers)
    // -----------------------------------------------------------------------
    /** One line of handwriting as an inline SVG, sized to itself. */
    function handwriting(text, o = {}) {
        const size = o.size ?? 22;
        const res = Ink.write(text, { x: 4, y: size + 6, size, seed: o.seed ?? `h${text}`, tilt: o.tilt ?? -2, maxWidth: o.maxWidth ?? 300, weight: o.weight ?? 4.2, color: o.color });
        const w = Math.ceil(res.width + 12);
        const h = Math.ceil(size + 16);
        return `<svg class="ink-inline" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" aria-hidden="true">${res.svg}</svg>`;
    }

    window.HNSMarks = {
        menu,
        bell,
        sheet,
        handwriting,
        uniqueIds,
        noteSvg,
        bellOn: () => bellOn,
        /** Forget what is drawn, so the next call redraws (fonts loaded, the page resized). */
        invalidate() {
            if (menuLayer) menuLayer.signature = null;
            if (sheetLayer) sheetLayer.signature = null;
            bellSignature = null;
        },
    };
})();
