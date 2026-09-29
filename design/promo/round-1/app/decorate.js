/* global Ink */

// Draws the red layer on top of the real app, once it has rendered.
//
// Round 1 only: it measures what src/ actually drew and marks it up, so every
// style can be judged on the real screens without touching the game code. The
// chosen style gets built into src/ properly in round 2.

(function () {
    const FONT = "Arimo, 'Helvetica Neue', Helvetica, Arial, sans-serif";
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];
    const visible = (el) => el && el.offsetParent !== null && !el.closest("[hidden]");

    /** An SVG laid over a scrolling container, in its content coordinates. */
    function layer(container) {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.classList.add("ink-layer");
        const w = container.scrollWidth;
        const h = container.scrollHeight;
        svg.setAttribute("width", w);
        svg.setAttribute("height", h);
        container.appendChild(svg);
        const origin = container.getBoundingClientRect();
        let m = "";
        return {
            box(el) {
                const r = el.getBoundingClientRect();
                return { x: r.left - origin.left + container.scrollLeft, y: r.top - origin.top + container.scrollTop, w: r.width, h: r.height };
            },
            add(markup) {
                m += markup;
            },
            done() {
                svg.innerHTML = m;
            },
        };
    }

    const svgUrl = (w, h, inner) => `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${inner}</svg>`)}")`;

    /** Colour a button in, like a child with a red marker. */
    function colourIn(btn, seed) {
        const w = btn.offsetWidth;
        const h = btn.offsetHeight;
        btn.style.backgroundImage = svgUrl(w, h, Ink.scribbleFill(-2, -2, w + 4, h + 4, { seed, weight: 11, overshoot: 0, misses: 0.07 }));
    }

    /** The in-app header: the lockup, small. */
    function headerLogo(dark) {
        const t = $("#site-title");
        if (!t) return;
        const ink = dark ? "#fff" : "#000";
        const w = 200;
        const h = 42;
        const probe = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        probe.setAttribute("width", w);
        probe.setAttribute("height", h);
        probe.innerHTML = `<text id="p1" x="0" y="26" font-family="${FONT}" font-weight="700" font-size="19" letter-spacing="-0.3">HIDE &amp;</text>`;
        t.textContent = "";
        t.appendChild(probe);
        const a = probe.querySelector("#p1").getBBox();
        const sx = a.width + 6;
        probe.innerHTML += `<text x="${sx}" y="26" font-family="${FONT}" font-weight="700" font-size="19" letter-spacing="-0.3" fill="${ink}">SEEK</text>`;
        probe.querySelector("#p1").setAttribute("fill", ink);
        const sw = 52;
        probe.innerHTML += Ink.scribbleOut(sx + 1, 12, sw - 2, 15, { seed: "hdr", passes: 3, weight: 3.4 });
        probe.innerHTML += Ink.write("STALK", { x: sx + sw + 6, y: 33, size: 21, weight: 4.2, seed: "hdrs", tilt: -7, spacing: 0.1 }).svg;
    }

    const noteAt = (L, text, x, y, o = {}) => L.add(Ink.note(text, { x, y, size: o.size ?? 17, maxWidth: o.maxWidth ?? 160, seed: o.seed ?? text, tilt: o.tilt ?? -4, mess: o.mess ?? 0.5, color: o.color }).svg);

    // -------------------------------------------------------------------
    // Styles
    // -------------------------------------------------------------------
    const STYLES = {
        a: { buttons: "colour", timer: "circle", title: "underline", dark: false },
        b: { buttons: "stamp", timer: "box", title: "none", dark: false, stampRole: true },
        c: { buttons: "none", timer: "underline", title: "none", dark: false, big: true },
        d: { buttons: "colour", timer: "circle", title: "underline", dark: true },
    };

    function decorate(styleKey, screen) {
        const S = STYLES[styleKey];
        document.body.dataset.style = styleKey;
        headerLogo(S.dark);
        // A new answer or question: the bell gets circled, by hand.
        const count = $("#bell-count");
        if (visible(count)) {
            const hdr = $("#site-header");
            const H = layer(hdr);
            const bb = H.box($("#bell"));
            H.add(Ink.circle(bb.x + bb.w / 2, bb.y + bb.h / 2, bb.w / 2 + 6, bb.h / 2 + 5, { seed: "bell", weight: 3.2 }));
            H.done();
        }
        const menu = $("#view-menu");
        const L = layer(menu);

        // Big buttons: Start / Play again / Log in.
        for (const btn of $$("#team-start-btn, #team-again-btn, #auth-submit")) {
            if (!visible(btn)) continue;
            if (S.buttons === "colour") colourIn(btn, btn.id);
            if (S.buttons === "stamp") {
                const b = L.box(btn);
                L.add(Ink.box(b.x + 8, b.y + 7, b.w - 16, b.h - 14, { seed: `${btn.id}s`, weight: 3.5 }));
            }
        }

        // Role badge -> stamp.
        const badge = $("#role-badge");
        if (S.stampRole && visible(badge)) {
            const b = L.box(badge);
            badge.style.visibility = "hidden";
            const res = Ink.write(badge.textContent, { x: b.x + 10, y: b.y + b.h + 8, size: 17, weight: 3.4, seed: "stamp", tilt: -6 });
            L.add(Ink.box(b.x, b.y - 6, res.width + 22, b.h + 20, { seed: "stampbox", weight: 3.2, jitter: 2 }));
            L.add(res.svg);
        }

        // Title and timer.
        const title = $("#status-title");
        if (visible(title) && S.title === "underline" && !["found", "win"].includes(screen)) {
            const b = L.box(title);
            const range = document.createRange();
            range.selectNodeContents(title);
            const rects = [...range.getClientRects()];
            const last = rects[rects.length - 1];
            const o = menu.getBoundingClientRect();
            if (last) L.add(Ink.underline(last.left - o.left, last.bottom - o.top + menu.scrollTop + 5, Math.min(last.width, 250), { seed: "tu", weight: 4 }));
            void b;
        }
        const timer = $(".timer-value");
        if (visible(timer)) {
            const b = L.box(timer);
            const range = document.createRange();
            range.selectNodeContents(timer);
            const tr = range.getBoundingClientRect();
            const o = menu.getBoundingClientRect();
            const tx = tr.left - o.left;
            const ty = tr.top - o.top + menu.scrollTop;
            if (S.timer === "circle") L.add(Ink.circle(tx + tr.width / 2, ty + tr.height / 2 + 4, tr.width / 2 + 20, tr.height / 2 + 2, { seed: `tm${screen}`, weight: 4.5 }));
            if (S.timer === "box") L.add(Ink.box(tx - 10, ty - 6, tr.width + 20, tr.height + 12, { seed: "tb", weight: 3.5 }));
            if (S.timer === "underline") L.add(Ink.underline(tx, ty + tr.height + 4, tr.width, { seed: "tl", weight: 9, lines: 1 }));
            void b;
        }

        // The stalker's three cards.
        const cards = $$("#card-row .card").filter(visible);
        if (cards.length) {
            const first = L.box(cards[0]);
            if (styleKey === "c") {
                cards.forEach((c, i) => {
                    const b = L.box(c);
                    L.add(Ink.write(String(i + 1), { x: b.x + b.w - 40, y: b.y + 46, size: 34, seed: `n${i}`, weight: 7 }).svg);
                });
            } else {
                if (styleKey !== "b") noteAt(L, "PICK ONE.", first.x + first.w - 112, first.y + 30, { maxWidth: 150, size: 17, tilt: -6 });
            }
        }

        // Sent: stamp it, and write the answer in.
        const sent = $("#sent-card");
        if (visible(sent)) {
            $(".sent-stamp", sent).style.visibility = "hidden";
            const st = L.box($(".sent-stamp", sent));
            const w = Ink.write("SENT · LOCKED IN", { x: st.x + 8, y: st.y + st.h - 2, size: 16, weight: 3.2, seed: "sent", tilt: -3 });
            L.add(Ink.box(st.x - 2, st.y - 6, w.width + 22, st.h + 12, { seed: "sentbox", weight: 3, jitter: 2 }) + w.svg);
            const ans = $("#sent-answer");
            if (sent.dataset.state === "answered" && visible($("#sent-photo"))) {
                const a = L.box(ans);
                noteAt(L, "WHICH BUILDING HAS THIS DOOR??", a.x + 4, a.y + 30, { size: 17, tilt: -3, maxWidth: 300 });
            } else if (sent.dataset.state === "answered") {
                const a = L.box(ans);
                const text = ans.textContent.replace(/^[^:]+:\s*/, "").replace(/\s*\(.*?\)\s*/g, " ").trim().toUpperCase();
                const res = Ink.write(text, { x: a.x + 4, y: a.y + 40, size: 32, seed: `ans${text}`, tilt: -3, maxWidth: a.w - 10, weight: 5.5 });
                L.add(res.svg);
                L.add(Ink.write(`— ${ans.textContent.split(":")[0].toUpperCase()}`, { x: a.x + Math.min(res.width, a.w - 110) + 12, y: a.y + 54, size: 12, seed: "who", weight: 2.2, color: S.dark ? "#fff" : "#000" }).svg);
            } else {
                noteAt(L, "WAITING...", L.box(ans).x + 150, L.box(ans).y + 40, { size: 15 });
            }
        }
        const photo = $("#sent-photo");
        if (visible(photo)) {
            const p = L.box(photo);
            L.add(Ink.circle(p.x + p.w * 0.5, p.y + p.h * 0.45, p.w * 0.2, p.h * 0.33, { seed: "door", weight: 4 }));

        }

        // Hider: circle the answer they picked.
        for (const opt of $$(".answer-option").filter(visible)) {
            if (!$("input", opt)?.checked) continue;
            const b = L.box(opt);
            const label = $("span", opt);
            const lb = L.box(label);
            L.add(Ink.circle(lb.x + lb.w / 2, b.y + b.h / 2, lb.w / 2 + 26, b.h / 2 + 6, { seed: `sel${label.textContent}`, weight: 4.5 }));
            L.add(Ink.check(b.x + 3, b.y + b.h * 0.3, 20, { seed: "chk", weight: 4.5 }));
        }
        for (const row of $$(".answer-row").filter(visible)) {
            const s = L.box($(".answer-row-answer", row));
            L.add(Ink.check(s.x - 2 + Math.min(s.w, 190) + 10, s.y - 2, 16, { seed: `rc${s.y}`, weight: 3.6 }));
        }

        // The tag code.
        const qr = $("#hider-qr-figure");
        if (visible(qr) && screen === "tagcode") {
            const b = L.box(qr);
            const hd = L.box($("#hider-qr .cards-title"));
            noteAt(L, "ONLY IF THEY FIND ME", hd.x + 128, hd.y + 12, { size: 15, maxWidth: 200, tilt: -4 });
            void b;
        }

        // Per-screen notes.
        const tb = visible(title) ? L.box(title) : null;
        if (screen === "login") {
            const reg = L.box($$(".auth-switch-btn")[1]);
            noteAt(L, "NEW? THIS ONE", reg.x + 30, reg.y + reg.h + 34, { size: 16, tilt: -5 });
            L.add(Ink.arrow(reg.x + 60, reg.y + reg.h + 14, reg.x + 76, reg.y + reg.h - 6, { seed: "reg", weight: 3.4, head: 11 }));
        }
        if (screen === "lobby") {
            const r = L.box($("#rules-card summary"));
            noteAt(L, "READ THESE ↓", r.x + 150, r.y + 4, { size: 17, tilt: -5 });
        }
        if (screen === "ready" && tb) noteAt(L, "WAIT FOR EVERYONE", tb.x + 160, tb.y - 14, { size: 15, maxWidth: 170 });
        if (screen === "hiding") {
            const t = L.box($(".timer-value"));
            noteAt(L, "WALK. DON'T RUN.", t.x + 176, t.y + t.h + 16, { size: 16, maxWidth: 170, tilt: -6 });
        }
        if ((screen === "found" || screen === "win") && tb) {
            const range = document.createRange();
            range.selectNodeContents(title);
            const r = range.getBoundingClientRect();
            const o = menu.getBoundingClientRect();
            L.add(Ink.circle(r.left - o.left + r.width / 2, r.top - o.top + menu.scrollTop + r.height / 2, r.width / 2 + 22, r.height / 2 + 16, { seed: `end${screen}`, weight: 5 }));
            noteAt(L, screen === "found" ? "GOTCHA." : "NEVER FOUND ME.", tb.x + (screen === "found" ? 200 : 140), tb.y - 20, { size: 19, tilt: -7, maxWidth: 200 });
        }
        L.done();

        // History modal: answers written in.
        const list = $("#history-list");
        if (visible(list)) {
            const H = layer(list);
            for (const row of $$(".history-row", list)) {
                const a = $(".history-answer", row);
                if (a.classList.contains("pending")) continue;
                const b = H.box(a);
                const text = a.textContent.replace(/\s*\(.*?\)\s*/g, " ").trim().toUpperCase();
                H.add(Ink.write(text, { x: b.x + 2, y: b.y + b.h + 2, size: 22, seed: `h${text}`, tilt: -2, maxWidth: 300, weight: 4.2 }).svg);
            }
            H.done();
        }
    }

    window.InkApp = { decorate };
})();
