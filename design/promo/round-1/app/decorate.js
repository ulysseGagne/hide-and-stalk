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
            has: () => m.length > 0,
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
    function headerLogo(dark, red = Ink.RED) {
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
        probe.innerHTML += Ink.scribbleOut(sx + 1, 12, sw - 2, 15, { seed: "hdr", passes: 3, weight: 3.4, color: red });
        probe.innerHTML += Ink.write("STALK", { x: sx + sw + 6, y: 33, size: 21, weight: 4.2, seed: "hdrs", tilt: -7, spacing: 0.1, mess: 0.45, color: red }).svg;
    }

    const noteAt = (L, text, x, y, o = {}) => L.add(Ink.note(text, { x, y, size: o.size ?? 17, maxWidth: o.maxWidth ?? 160, seed: o.seed ?? text, tilt: o.tilt ?? -4, mess: o.mess, importance: o.importance ?? "aside", color: o.color, weight: o.weight }).svg);

    /** A layer over the whole phone screen, above everything (for arrows that cross regions). */
    function screenLayer() {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", innerWidth);
        svg.setAttribute("height", innerHeight);
        svg.style.cssText = "position:fixed;left:0;top:0;z-index:5000;pointer-events:none;overflow:visible";
        document.body.appendChild(svg);
        let m = "";
        return {
            box(el) {
                const r = el.getBoundingClientRect();
                return { x: r.left, y: r.top, w: r.width, h: r.height };
            },
            add(markup) {
                m += markup;
            },
            has: () => m.length > 0,
            done() {
                svg.innerHTML = m;
            },
        };
    }

    /** A stamp by hand: the word in a box that doesn't quite close, askew, over whatever is under it. */
    function stamp(L, text, x, y, o = {}) {
        const size = o.size ?? 20;
        const w = Ink.write(text, { x: x + 12, y: y + size + 8, size, seed: `st${text}`, tilt: o.tilt ?? -5, importance: "info", weight: size * 0.17 });
        L.add(Ink.box(x - 4, y - 4, w.width + 30, size + 26, { seed: `stb${text}`, weight: size * 0.16, jitter: 5 }) + w.svg);
    }

    // The rules, most important first (the Discord call and the timings last).
    const RULE_ORDER = ["Hide near a path.", "The hider walks.", "No tunnels.", "Nothing to open.", "Answer truthfully.", "Found?", "One hider", "Discord call."];
    const UNDERLINE = ["Hide near a path.", "Nothing to open."];

    // -------------------------------------------------------------------
    // Styles
    // -------------------------------------------------------------------
    const STYLES = {
        a: { dark: false, stampRole: "reveal" },
        b: { dark: false, stampRole: true },
        c: { timer: "underline", dark: false },
        d: { dark: true, stampRole: "reveal" },
        // The merge: only what's useful stays, and the header's red goes
        // black whenever something else on screen is red.
        e: { dark: false, stampRole: "reveal", prune: true, quietHeader: true },
    };

    /**
     * Direction E: cut what isn't useful at this moment. Round 1 hides it
     * here; round 2 removes it from src/.
     */
    function prune(screen) {
        const hide = (sel) => $$(sel).forEach((el) => (el.style.display = "none"));
        // Never useful: who you are logged in as, the team roll call, GPS chatter, the hint count.
        hide(".whoami, #status-team, #location-status, #hint-status");
        // Before the game only: the Discord call and the rules.
        if (!["lobby", "ready"].includes(screen)) hide("#discord-btn, #rules-card");
        // During the hunt the screen says it already (timer label, the cards, the bell).
        if (["cards", "selected", "waiting", "sent", "photo", "question", "choice", "tagcode"].includes(screen)) hide("#status-text");
        hide("#hider-questions > .muted");
        // The tag code: the hand-written line says what to do with it.
        const qrP = $("#hider-qr > p.muted:not(.hider-qr-text)");
        if (qrP) qrP.style.display = "none";
        // Who sent it is on the card; "tap to send" is no longer true.
        if (["cards", "selected", "waiting", "photo"].includes(screen)) hide("#card-note");
        // The scanner lives here now, not in the header.
        const found = $("#found-btn");
        if (found) found.textContent = "Found them? Scan their code";
        // Cards are numbered, so you can tell there are three.
        const cards = $$("#card-row .card");
        cards.forEach((c, i) => {
            const cat = $(".card-category", c);
            if (cat && !$(".card-count", cat)) cat.insertAdjacentHTML("beforeend", `<span class="card-count">${i + 1} OF ${cards.length}</span>`);
        });
    }

    // ---------------------------------------------------------------------
    // First launch: the two permissions (after marathon-quebec-2026/pacer's
    // "Before you start" card). Round 2 builds this into src/.
    // ---------------------------------------------------------------------
    const PIN_ICON = `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s7-7.6 7-13a7 7 0 0 0-14 0c0 5.4 7 13 7 13Z"/><circle cx="12" cy="9" r="2.6"/></svg>`;
    const COMPASS_ICON = `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19"/><path d="M12 5.5 15 12h-6Z" fill="currentColor"/><path d="M12 18.5 9 12h6Z"/></svg>`;
    function permSheet(perm) {
        const row = (n, key, icon, name, state, notes) => {
            const btn =
                state === "on" ? `<span class="perm-on">On</span>`
                : state === "asking" ? `<button type="button" class="perm-btn" disabled>Asking…</button>`
                : state === "blocked" ? `<button type="button" class="perm-btn">How to fix</button>`
                : `<button type="button" class="perm-btn${notes.next ? " next" : ""}">Turn on</button>`;
            return `<div class="perm-row" data-perm="${key}"><div class="perm-icon">${icon}</div><div class="perm-text"><b>${n}. ${name}</b><span>${notes[state] ?? notes.off}</span></div>${btn}</div>`;
        };
        const all = perm.loc === "on" && perm.compass === "on";
        const html = `<div id="perm-sheet" class="modal"><div class="modal-card">
            <div class="modal-head"><h2>Before you start</h2></div>
            <div class="perm-body">
                <p class="muted perm-intro">Two things to turn on. Tap a button, then choose <b>Allow</b> when the iPhone asks.</p>
                ${row(1, "loc", PIN_ICON, "Location", perm.loc, { off: "Needed. Puts you on the map, for your team and the game.", asking: "Choose Allow in the iPhone’s popup (“While Using the App”).", on: "On: GPS ±6 m.", blocked: "Blocked. How to fix shows how to allow it again on this phone.", next: perm.loc === "off" })}
                ${row(2, "compass", COMPASS_ICON, "Compass", perm.compass, { off: "Optional. Shows which way you’re facing on the map. The iPhone calls it “motion and orientation”.", on: "On.", next: perm.loc === "on" && perm.compass === "off" })}
                <button type="button" id="perm-done" class="big-btn${all ? " cta" : ""}">${all ? "Done" : "Later"}</button>
                <p class="muted perm-foot">Later on: the notices at the top of the screen.</p>
            </div></div></div>`;
        document.body.insertAdjacentHTML("beforeend", html);
    }

    function decorate(styleKey, screen, perm = null) {
        const S = STYLES[styleKey];
        document.body.dataset.style = styleKey;
        if (S.prune) prune(screen);
        const ink = S.dark ? "#fff" : "#000";

        // Rules in order of importance (round 2 moves this into src/index.html).
        const list = $(".rules-list");
        if (list) {
            const items = $$("li", list);
            const rank = (li) => RULE_ORDER.findIndex((k) => $("strong", li)?.textContent.trim().startsWith(k));
            items.sort((a, b) => rank(a) - rank(b)).forEach((li) => list.appendChild(li));
        }

        // Picking and sending are two actions: a picked card gets a Send button.
        if (screen === "selected") {
            const row = $("#card-row");
            const send = document.createElement("button");
            send.type = "button";
            send.className = "big-btn send-btn";
            send.textContent = "Send this question";
            row.after(send);
            // The app's line says a tap sends; in this flow a tap only picks.
            const note = $("#card-note");
            if (note) note.textContent = "Picked. Nothing is sent until you press Send.";
        }

        const menu = $("#view-menu");
        const L = layer(menu);
        const P = screenLayer();

        if (perm) {
            permSheet(perm);
            for (const on of $$("#perm-sheet .perm-on")) {
                const b = P.box(on);
                P.add(Ink.check(b.x + b.w + 4, b.y - 6, 26, { seed: `pc${b.y}`, weight: 5 }));
            }
            const fix = $("#perm-sheet .perm-row[data-perm=loc] .perm-btn");
            if (perm.loc === "blocked" && fix) {
                const b = P.box(fix);
                P.add(Ink.circle(b.x + b.w / 2, b.y + b.h / 2, b.w / 2 + 12, b.h / 2 + 12, { seed: "fix", weight: 4.5 }));
            }
        }

        // A notification is the most important thing on the screen: a big arrow at the bell.
        const count = $("#bell-count");
        if (visible(count)) {
            const bb = P.box($("#bell"));
            const cx = bb.x + bb.w / 2;
            const cy = bb.y + bb.h / 2;
            if (S.prune) {
                // Never a circle as well: one long arrow from low on the screen.
                P.add(Ink.bigArrow(64, innerHeight * 0.5, cx - 12, bb.y + bb.h + 8, { seed: `bella${screen}`, weight: 7, bend: -0.22 }));
                P.add(Ink.write("NEW", { x: 30, y: innerHeight * 0.5 + 46, size: 32, seed: `belln${screen}`, tilt: -8, importance: "key" }).svg);
            } else {
                P.add(Ink.circle(cx, cy, bb.w / 2 + 8, bb.h / 2 + 7, { seed: "bell", weight: 4.5 }));
                P.add(Ink.handArrow(cx - 150, cy + 96, cx - 16, cy + 18, { seed: `bella${screen}`, weight: 7, head: 26, bend: -0.18 }));
                P.add(Ink.write("NEW", { x: cx - 236, y: cy + 112, size: 30, seed: `belln${screen}`, tilt: -8, importance: "key" }).svg);
            }
        }

        // Role badge -> stamp (style B).
        const badge = $("#role-badge");
        if (S.stampRole && visible(badge) && (S.stampRole !== "reveal" || screen === "ready" || screen === "hiding")) {
            const b = L.box(badge);
            badge.style.visibility = "hidden";
            const res = Ink.write(badge.textContent, { x: b.x + 10, y: b.y + b.h + 8, size: 17, weight: 3.4, seed: "stamp", tilt: -6 });
            L.add(Ink.box(b.x, b.y - 6, res.width + 22, b.h + 20, { seed: "stampbox", weight: 3.2, jitter: 2 }));
            L.add(res.svg);
        }

        // The timer is already big: marked only while hiding, when it's the whole point.
        const title = $("#status-title");
        const timer = $(".timer-value");
        let timerBox = null;
        if (visible(timer) && screen === "hiding" && S.timer) {
            const range = document.createRange();
            range.selectNodeContents(timer);
            const tr = range.getBoundingClientRect();
            const o = menu.getBoundingClientRect();
            const tx = tr.left - o.left;
            const ty = tr.top - o.top + menu.scrollTop;
            timerBox = { x: tx, y: ty, w: tr.width, h: tr.height };
            if (S.timer === "box") L.add(Ink.box(tx - 10, ty - 6, tr.width + 20, tr.height + 12, { seed: "tb", weight: 3.5 }));
            else if (S.timer === "underline") L.add(Ink.underline(tx, ty + tr.height + 4, tr.width, { seed: "tl", weight: 9, lines: 1 }));
        }
        // Underlined only where it helps: waiting for a team.
        if (visible(title) && screen === "lobby") {
            const range = document.createRange();
            range.selectNodeContents(title);
            const rects = [...range.getClientRects()];
            const last = rects[rects.length - 1];
            const o = menu.getBoundingClientRect();
            if (last) L.add(Ink.underline(last.left - o.left, last.bottom - o.top + menu.scrollTop + 5, Math.min(last.width, 250), { seed: "tu", weight: 4 }));
        }

        // The stalker's three cards: pick just one, and there are more below.
        const cards = $$("#card-row .card").filter(visible);
        if (cards.length) {
            const first = L.box(cards[0]);
            if (styleKey === "c") {
                cards.forEach((c, i) => {
                    const b = L.box(c);
                    L.add(Ink.write(String(i + 1), { x: b.x + b.w - 40, y: b.y + 46, size: 34, seed: `n${i}`, weight: 7 }).svg);
                });
            } else if (styleKey !== "b") {
                if (S.prune && screen !== "selected") noteAt(L, "PICK JUST ONE.", first.x + first.w - 206, first.y + 4, { maxWidth: 220, size: 22, tilt: -4, importance: "key" });
                else if (!S.prune) noteAt(L, "PICK JUST ONE.", first.x + first.w - 190, first.y + 30, { maxWidth: 200, size: 22, tilt: -5, importance: "key" });
            }
            if (screen === "selected") {
                const c = L.box(cards[1]);
                L.add(Ink.box(c.x - 4, c.y - 4, c.w + 8, c.h + 8, { seed: "pick", weight: 5.5, jitter: 4 }));
                const send = L.box($(".send-btn"));
                if (S.prune) noteAt(L, "NOT SENT YET", send.x + send.w - 250, send.y + send.h + 44, { size: 34, maxWidth: 270, tilt: -5, importance: "key", weight: 6.5 });
                else noteAt(L, "NOT SENT YET", send.x + send.w - 176, send.y + send.h + 34, { size: 19, maxWidth: 180, tilt: -4, importance: "info" });
            } else {
                // More cards below the fold.
                const last = cards[cards.length - 1].getBoundingClientRect();
                if (last.bottom > innerHeight - 10) P.add(Ink.handArrow(innerWidth - 34, innerHeight - 150, innerWidth - 40, innerHeight - 40, { seed: "scroll", weight: 5, head: 20, bend: 0.1 }) + Ink.write("MORE", { x: innerWidth - 110, y: innerHeight - 120, size: 20, seed: "more", tilt: -8, importance: "aside" }).svg);
            }
        }

        // Sent: locked in while the hider hasn't answered; once answered, the answer and an ANSWERED stamp.
        const sent = $("#sent-card");
        if (visible(sent)) {
            const st = L.box($(".sent-stamp", sent));
            $(".sent-stamp", sent).style.visibility = "hidden";
            const ans = $("#sent-answer");
            const prompt = L.box($("#sent-prompt"));
            if (sent.dataset.state === "answered") {
                if (!visible($("#sent-photo"))) {
                    const a = L.box(ans);
                    const text = ans.textContent.replace(/^[^:]+:\s*/, "").replace(/\s*\(.*?\)\s*/g, " ").trim().toUpperCase();
                    const res = Ink.write(text, { x: a.x + 4, y: a.y + 40, size: 34, seed: `ans${text}`, tilt: -3, maxWidth: a.w - 10, importance: "key" });
                    L.add(res.svg);
                    L.add(Ink.write(`— ${ans.textContent.split(":")[0].toUpperCase()}`, { x: a.x + Math.min(res.width, a.w - 110) + 12, y: a.y + 56, size: 12, seed: "who", weight: 2.2, color: ink, importance: "key" }).svg);
                }
                // Halfway over the question, never on the photo.
                stamp(L, "ANSWERED", prompt.x + prompt.w - 150, prompt.y - 30, { size: 20, tilt: -7 });
            } else {
                // Over the card's edge, a little unhinged.
                const w = Ink.write("SENT · LOCKED IN", { x: st.x - 6, y: st.y + st.h - 10, size: 22, seed: "sent", tilt: -6, importance: "key" });
                L.add(Ink.box(st.x - 24, st.y - 30, w.width + 42, st.h + 32, { seed: "sentbox", weight: 4, jitter: 6 }) + w.svg);
            }
        }

        // Hider: the picked answer is ticked by hand, like a ballot.
        for (const opt of $$(".answer-option").filter(visible)) {
            const input = $("input", opt);
            if (!input?.checked) continue;
            const b = L.box(input);
            L.add(Ink.check(b.x - 5, b.y - 4, b.w + 10, { seed: `chk${opt.textContent.trim()}`, weight: 5 }));
        }
        for (const row of $$(".answer-row").filter(visible)) {
            const sAns = L.box($(".answer-row-answer", row));
            L.add(Ink.check(sAns.x - 2 + Math.min(sAns.w, 190) + 10, sAns.y - 2, 16, { seed: `rc${sAns.y}`, weight: 3.6 }));
        }

        // The tag code: what to do with it, plainly.
        const qr = $("#hider-qr-figure");
        if (visible(qr) && screen === "tagcode") {
            const q = L.box(qr);
            if (S.prune) {
                // Beside the heading, the top of it just over the code's frame.
                const hd = L.box($("#hider-qr .cards-title"));
                noteAt(L, "SHOW THIS TO THE STALKER", hd.x + 136, hd.y + 6, { size: 20, maxWidth: 200, tilt: -4, importance: "key" });
            } else noteAt(L, "SHOW THIS TO THE STALKER", q.x + 4, q.y + q.h + 70, { size: 21, maxWidth: 320, tilt: -3, importance: "key" });
        }

        // Per-screen notes.
        const tb = visible(title) ? L.box(title) : null;
        if (screen === "login" || screen === "loginfilled") {
            const reg = L.box($$(".auth-switch-btn")[1]);
            noteAt(L, "NEW? THIS ONE", innerWidth - 246, reg.y + reg.h + 58, { size: 27, tilt: -5, maxWidth: 240, importance: "info" });
            L.add(Ink.handArrow(reg.x + 70, reg.y + reg.h + 20, reg.x + 88, reg.y + reg.h - 4, { seed: "reg", weight: 4, head: 13 }));
        }
        // Black = press me now: only once there's something to log in with.
        if (screen === "loginfilled") $("#auth-submit").classList.add("cta");
        for (const id of ["#team-start-btn", "#team-again-btn"]) if (visible($(id))) $(id).classList.add("cta");
        if (visible($(".send-btn"))) $(".send-btn").classList.add("cta");
        if (list && visible(list) && screen === "lobby") {
            for (const strong of $$("li strong", list).filter(visible)) {
                if (!UNDERLINE.some((k) => strong.textContent.trim().startsWith(k))) continue;
                const b = L.box(strong);
                L.add(Ink.underline(b.x, b.y + b.h + 2, b.w, { seed: `ru${strong.textContent}`, weight: 3.4 }));
            }
        }
        if (screen === "lobby") {
            const d = L.box($("#view-menu .discord-btn"));
            noteAt(L, "READ THESE ↓", d.x + d.w - 262, d.y + d.h + 30, { size: 30, tilt: -6, maxWidth: 270, importance: "key", weight: 6.2 });
        }
        if (screen === "ready") {
            if (tb) noteAt(L, "WAIT FOR EVERYONE", tb.x + 160, tb.y - 14, { size: 15, maxWidth: 170 });

        }
        if (screen === "hiding" && tb) {
            noteAt(L, "WALK. DON'T RUN.", tb.x + 150, tb.y + 4, { size: 24, maxWidth: 190, tilt: -5, importance: "key" });
        }
        if ((screen === "found" || screen === "win") && tb) {
            if (S.prune) {
                // Above the title, just catching its top edge.
                if (screen === "found") noteAt(L, "GOTCHA.", innerWidth - 268, tb.y + 10, { size: 46, tilt: -7, maxWidth: 260, importance: "vibe" });
                else noteAt(L, "HOW ABOUT THAT.", innerWidth - 300, tb.y + 8, { size: 26, tilt: -6, maxWidth: 300, importance: "vibe" });
            } else if (screen === "found") noteAt(L, "GOTCHA.", tb.x + 150, tb.y + 26, { size: 52, tilt: -9, maxWidth: 260, importance: "vibe" });
            else noteAt(L, "HOW ABOUT THAT.", tb.x + 90, tb.y + 22, { size: 34, tilt: -8, maxWidth: 280, importance: "vibe" });
        }
        L.done();
        P.done();
        // The header's red is the brand; once anything else on the screen is
        // red, it steps back to black so the red means "look here".
        const quiet = S.quietHeader && (L.has() || P.has() || screen === "history");
        headerLogo(S.dark, quiet ? ink : Ink.RED);
        if (S.prune) $("#site-title svg").style.cssText = "transform:scale(0.88);transform-origin:0 0";

        // History modal: answers written in.
        const hist = $("#history-list");
        if (visible(hist)) {
            const H = layer(hist);
            for (const row of $$(".history-row", hist)) {
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
