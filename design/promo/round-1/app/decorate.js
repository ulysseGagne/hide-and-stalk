/* global Ink, Logo */

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

    /**
     * The in-app header: HIDE & in type, then the logo's STALK right after
     * it. No SEEK and no scribble: at this size a scribble over black type
     * is just a smudge. STALK is the chosen logo's (L16.6b's, lab/logo.js).
     */
    function headerLogo(dark, red = Ink.RED) {
        const t = $("#site-title");
        if (!t) return;
        const ink = dark ? "#fff" : "#000";
        const w = 200;
        const h = 42;
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", w);
        svg.setAttribute("height", h);
        svg.style.overflow = "visible";
        svg.innerHTML = `<text id="p1" x="0" y="28" font-family="${FONT}" font-weight="700" font-size="19" letter-spacing="-0.3" fill="${ink}">HIDE &amp;</text>`;
        t.textContent = "";
        t.appendChild(svg);
        const a = svg.querySelector("#p1").getBBox();
        const st = Logo.stalk({ color: red });
        const k = 27 / st.box.h;
        const x = a.x + a.width + 7;
        svg.innerHTML += `<g transform="translate(${x - st.box.x * k} ${31 - (st.box.y + st.box.h) * k}) scale(${k})">${st.svg}</g>`;
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
    const RULE_ORDER = ["Hide near a path.", "The hider walks.", "No tunnels.", "Touch nothing.", "Answer truthfully.", "Found?", "One hider", "Discord call."];
    const UNDERLINE = ["Hide near a path.", "Touch nothing."];
    // As short as they can be (round 2 puts these in src/index.html).
    const RULE_TEXT = {
        "Hide near a path.": ["Hide near a path.", "Within 20 m of one."],
        "The hider walks.": ["The hider walks.", "Stalkers can run."],
        "No tunnels.": ["No tunnels.", ""],
        "Nothing to open.": ["Touch nothing.", "Don't open, move or climb anything."],
        "Answer truthfully.": ["Answer truthfully.", ""],
        "Found?": ["Found?", "Show your code. Stalkers win."],
        "One hider": ["One hider.", "10 min to hide, a question every 5 min."],
        "Discord call.": ["Discord call.", "Stay in it all game."],
    };

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
        // Shorter copy.
        const goal = $(".rules-goal");
        if (goal) goal.textContent = "Stalkers win if they find the hider before question 7.";
        for (const li of $$(".rules-list li")) {
            const k = $("strong", li)?.textContent.trim();
            const t = RULE_TEXT[k];
            if (t) li.innerHTML = `<strong>${t[0]}</strong>${t[1] ? ` ${t[1]}` : ""}`;
        }
        const st = $("#status-text");
        if (st && screen === "lobby") {
            // The app re-renders this line every tick; keep the short one.
            const short = "You'll be put in a team. Read the rules while you wait.";
            st.textContent = short;
            new MutationObserver(() => st.textContent !== short && (st.textContent = short)).observe(st, { childList: true, characterData: true, subtree: true });
        }
        // Questions so far: a tab up top, not a button in the page.
        const hb = $("#history-btn");
        if (hb && (visible(hb) || screen === "history")) {
            hb.style.display = "none";
            const tabs = $("#view-tabs");
            if (tabs && !$(".view-tab.q-tab", tabs)) {
                tabs.insertAdjacentHTML("beforeend", `<button type="button" class="view-tab q-tab" role="tab">QUESTIONS</button>`);
            }
        }
        // Buildings: the code first, heavy, then the whole name.
        for (const sp of $$(".answer-option > span:not(.answer-distance)")) {
            const m = sp.textContent.match(/^(.*?)\s*\(([A-Z]{2,6})\)$/);
            if (m) sp.innerHTML = `<b class="opt-code">${m[2]}</b> ${m[1]}`;
        }
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
    const COMPASS_ICON = `<svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.6"/><path d="M12 5.8 15 13H9Z" fill="currentColor" stroke="none"/></svg>`;
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
                <p class="muted perm-intro">Tap <b>Turn on</b>, then <b>Allow</b>.</p>
                ${row(1, "loc", PIN_ICON, "Location", perm.loc, { off: "Puts you on the map.", asking: "Choose Allow.", on: "Puts you on the map.", blocked: "Blocked. Tap How to fix.", next: perm.loc === "off" })}
                ${row(2, "compass", COMPASS_ICON, "Compass", perm.compass, { off: "Shows which way you face.", on: "Shows which way you face.", next: perm.loc === "on" && perm.compass === "off" })}
                ${all ? `<button type="button" id="perm-done" class="big-btn cta">Done</button>` : `<button type="button" id="perm-later" class="small-btn">Later</button>`}
            </div></div></div>`;
        document.body.insertAdjacentHTML("beforeend", html);
    }

    // ---------------------------------------------------------------------
    // Before the game: the rules one at a time (from X45). Each gets an OK,
    // and the player's initials go on its line. Round 2 builds it into src/.
    // ---------------------------------------------------------------------
    function rulesSheet(signed) {
        const items = $$(".rules-list li").map((li) => li.innerHTML);
        const total = items.length;
        const done = Math.min(signed, total);
        let rows = "";
        items.slice(0, done).forEach((html, i) => (rows += `<div class="rule-row signed"><span class="rule-n">${i + 1}</span><p>${html}</p><span class="rule-sign" data-i="${i}"></span></div>`));
        const current = done < total ? `<div class="rule-row current"><span class="rule-n">${done + 1}</span><p>${items[done]}</p></div><button type="button" class="big-btn cta rule-ok">OK</button>` : "";
        const html = `<div id="rules-sheet" class="modal"><div class="modal-card">
            <div class="modal-head"><h2>Rules</h2><span class="rule-count">${done < total ? `${done + 1} OF ${total}` : `${total} OF ${total}`}</span></div>
            <div class="rules-body">${rows}${current}${done >= total ? `<button type="button" class="big-btn cta rule-ok">Done</button>` : ""}</div></div></div>`;
        document.body.insertAdjacentHTML("beforeend", html);
        const body = $("#rules-sheet .rules-body");
        body.scrollTop = body.scrollHeight;
    }

    // ---------------------------------------------------------------------
    // The end: the round as a receipt (from X02, X34, X42). Typeset like a
    // till slip; the only drawn thing is the campus-left bar, coloured in,
    // and it stays inside the paper.
    // ---------------------------------------------------------------------
    /** A till-slip barcode: black bars, typeset (not drawn). */
    function barcode(seed) {
        const r = Ink.rng(`bc${seed}`);
        let x = 0;
        let bars = "";
        while (x < 236) {
            const w = r.pick([1.5, 1.5, 3, 4.5]);
            bars += `<rect x="${x}" y="0" width="${w}" height="44" fill="#000"/>`;
            x += w + r.pick([1.5, 3, 3, 4.5]);
        }
        return `<svg viewBox="0 0 ${x} 44" preserveAspectRatio="none" width="100%" height="44" style="display:block">${bars}</svg><div class="rc-num">5 051005 133208</div>`;
    }
    /** The torn bottom: the same 3px line as the sides, zigzagging across. */
    function tear() {
        let d = "M1.5 0";
        const n = 20;
        for (let i = 0; i <= n; i++) d += ` L${(1.5 + (i / n) * 97).toFixed(2)} ${i % 2 ? 1.5 : 10.5}`;
        d += " L98.5 0";
        return `<svg class="rc-tear" viewBox="0 0 100 12" preserveAspectRatio="none" width="100%" height="12"><path d="${d} Z" fill="#fff" stroke="none"/><path d="${d}" fill="none" stroke="#000" stroke-width="3" vector-effect="non-scaling-stroke" stroke-linejoin="miter"/></svg>`;
    }
    function receiptEl(rc) {
        const row = ([a, b]) => `<div class="rc-row"><span>${a}</span><b>${b === "REDACTED" ? '<i class="rc-redact"></i>' : b}</b></div>`;
        const html = `<div class="receipt"><div class="rc-paper">
            <div class="rc-title">HIDE AND STALK</div>
            <div class="rc-head">${rc.head}</div>
            <div class="rc-rule"></div>${rc.lines.map(row).join("")}
            <div class="rc-rule"></div>${rc.totals.map(row).join("")}
            <div class="rc-rule"></div>
            <div class="rc-row"><span>Questions asked</span><b>${rc.asked} of ${rc.of}</b></div>
            <div class="rc-bar"></div>
            <div class="rc-code">${barcode(rc.head)}</div>
        </div>${tear()}</div>`;
        const btn = $("#team-again-btn");
        btn.insertAdjacentHTML("afterend", html);
    }

    function decorate(styleKey, screen, extra = null) {
        const perm = extra?.perm ?? null;
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

        if (extra?.rules) {
            rulesSheet(extra.rules.signed);
            const who = ($("#logged-in-name")?.textContent || "jules").slice(0, 2).toUpperCase();
            // Initials in the player's own hand: black, like a signature (red stays for "look here").
            for (const sign of $$("#rules-sheet .rule-sign")) {
                const b = P.box(sign);
                if (b.y + b.h < 0 || b.y > innerHeight) continue;
                P.add(Ink.write(who, { x: b.x + 6, y: b.y + b.h - 6, size: 22, seed: `ini${sign.dataset.i}`, color: ink, importance: "info", tilt: -6 }).svg);
            }
        }
        if (extra?.receipt && S.prune && visible($("#team-again-btn"))) {
            receiptEl(extra.receipt);
            const bar = $(".rc-bar");
            const b = L.box(bar);
            const w = (b.w - 16) * (extra.receipt.asked / extra.receipt.of);
            // Ruled out, coloured in by hand; stays inside the bar.
            L.add(Ink.colorIn([[[b.x + 8, b.y + 8], [b.x + 3 + w, b.y + 8], [b.x + 3 + w, b.y + b.h - 8], [b.x + 8, b.y + b.h - 8]]], { seed: `bar${screen}`, weight: 7, overshoot: 0 }));
        }
        if (perm) {
            permSheet(perm);
            // The one thing to do next gets the arrow; what's done needs nothing.
            const next = $("#perm-sheet .perm-btn.next");
            if (next) {
                const b = P.box(next);
                P.add(Ink.stubArrow(b.x - 36, b.y + b.h + 50, b.x + 16, b.y + b.h - 10, { seed: `pa${perm.loc}`, weight: 11 }));
            }
            // Both on: each On gets its own big check.
            if (perm.loc === "on" && perm.compass === "on") {
                for (const [i, on] of $$("#perm-sheet .perm-on").entries()) {
                    const b = P.box(on);
                    P.add(Ink.bigCheck(b.x + b.w + 2, b.y - 16, 40, { seed: `pdone${i}`, weight: 9 }));
                }
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
                // Short and wide, NEW beside it (the R set's second round).
                const tip = [cx - 6, bb.y + bb.h + 6];
                P.add(Ink.stubArrow(tip[0] - 78, tip[1] + 96, tip[0], tip[1], { seed: `bella${screen}`, weight: 13 }));
                // Beside the arrow, in the empty end of the badge row.
                P.add(Ink.write("NEW", { x: tip[0] - 22, y: tip[1] + 104, size: 44, weight: 9, seed: `belln${screen}`, tilt: -8, importance: "key" }).svg);
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
            // A little bolder, box and word, like WALK. DON'T RUN. and PICK JUST ONE.
            const res = Ink.write(badge.textContent, { x: b.x + 10, y: b.y + b.h + 8, size: 17, weight: 4.3, seed: "stamp", tilt: -6, spacing: 0.34, even: true });
            L.add(Ink.box(b.x, b.y - 6, res.width + 22, b.h + 20, { seed: "stampbox", weight: 4.3, jitter: 2 }));
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
        // (Room above them for the note.)
        if (S.prune && screen === "cards" && $("#card-row")) $("#card-row").style.marginTop = "34px";
        const cards = $$("#card-row .card").filter(visible);
        if (cards.length) {
            const first = L.box(cards[0]);
            if (styleKey === "c") {
                cards.forEach((c, i) => {
                    const b = L.box(c);
                    L.add(Ink.write(String(i + 1), { x: b.x + b.w - 40, y: b.y + 46, size: 34, seed: `n${i}`, weight: 7 }).svg);
                });
            } else if (styleKey !== "b") {
                if (S.prune && screen !== "selected") {
                    // Between the rule and the first card (UNTIL QUESTION stays readable), curling up.
                    L.add(Ink.write("PICK JUST ONE.", { x: first.x + 96, y: first.y - 10, size: 32, weight: 5.6, spacing: 0.3, seed: "pick1", tilt: -5, maxWidth: first.w - 98, importance: "key" }).svg);
                }
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
                // E19's arrow, pointing down: bulky, a big pointed head; MORE where
                // it was, as bold as PICK JUST ONE.
                if (last.bottom > innerHeight - 10) P.add(Ink.stubArrow(innerWidth - 40, innerHeight - 150, innerWidth - 46, innerHeight - 40, { seed: "scroll2", weight: 11, head: 34 }) + Ink.write("MORE", { x: innerWidth - 116, y: innerHeight - 120, size: 21, weight: 4.8, spacing: 0.3, seed: "more", tilt: -8, importance: "key" }).svg);
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
                // No stamp: the answer (or the photo) already says it.
                void prompt;
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
            // On the circle: the tick's box centred on it, its corner at the circle's lower edge.
            const s = 28;
            const cx = b.x + b.w / 2;
            const cy = b.y + b.h / 2;
            L.add(Ink.check(cx - 0.55 * s + 2, cy - 0.4 * s - 1, s, { seed: `chk${opt.textContent.trim()}`, weight: 7 }));
        }
        for (const row of $$(".answer-row").filter(visible)) {
            const sAns = L.box($(".answer-row-answer", row));
            L.add(Ink.sharpCheck(sAns.x + Math.min(sAns.w, 190) + 22, sAns.y - 8, 28, { seed: `rc${sAns.y}`, weight: 8 }));
        }

        // The tag code: what to do with it, plainly.
        const qr = $("#hider-qr-figure");
        if (visible(qr) && screen === "tagcode") {
            const q = L.box(qr);
            if (S.prune) {
                // Beside the heading, the top of it just over the code's frame.
                const hd = L.box($("#hider-qr .cards-title"));
                // In the gap above the heading, one line, clear of the code.
                noteAt(L, "SHOW THIS TO THE STALKER", hd.x, hd.y - 16, { size: 21, maxWidth: 350, tilt: -3, importance: "key", weight: 5.2 });
            } else noteAt(L, "SHOW THIS TO THE STALKER", q.x + 4, q.y + q.h + 70, { size: 21, maxWidth: 320, tilt: -3, importance: "key" });
        }

        // Per-screen notes.
        const tb = visible(title) ? L.box(title) : null;
        // Only until they start typing (or press Register).
        if (screen === "login") {
            const reg = L.box($$(".auth-switch-btn")[1]);
            const cx = reg.x + reg.w / 2;
            // Just under the tabs, so the username field still reads as empty;
            // the arrow comes up from the note's start, as thick as its letters.
            const nw = Ink.write("NEW? CLICK HERE", { x: 0, y: 0, size: 21, seed: "NEW? CLICK HERE", tilt: -4, importance: "info", weight: 4.6 }).width;
            const base = reg.y + reg.h + 50;
            const nx = innerWidth - 22 - nw;
            noteAt(L, "NEW? CLICK HERE", nx, base, { size: 21, tilt: -4, maxWidth: 320, importance: "info", weight: 4.6 });
            // E02's and E19's arrow: it starts just above NEW and curves up a
            // little to the middle of Register, clear of the words.
            L.add(Ink.stubArrow(nx + 12, base - 30, cx + 8, reg.y + reg.h + 5, { seed: "reg2", weight: 8, head: 20, bend: -0.16 }));
            void cx;
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
            noteAt(L, "READ THESE ↓", d.x + d.w - 262, d.y + d.h + 46, { size: 30, tilt: -6, maxWidth: 270, importance: "key", weight: 6.2 });
        }
        if (screen === "ready") {

        }
        if (screen === "hiding" && tb) {
            // Under the paragraph, just over its last line and the rule.
            const p = $("#status-text");
            const pb = p && visible(p) ? L.box(p) : { x: tb.x, y: tb.y + 200, w: 300, h: 0 };
            noteAt(L, "WALK. DON'T RUN.", pb.x + 8, pb.y + pb.h + 36, { size: 30, maxWidth: 330, tilt: -4, importance: "key", weight: 6.2 });
        }
        if ((screen === "found" || screen === "win") && tb) {
            if (S.prune) {
                // Above the title, just catching its top edge.
                if (screen === "found") {
                    // On the top layer, so nothing typeset cuts it; the G big.
                    const t = P.box(title);
                    const g = Ink.tuck("GOTCHA", { size: 44, seed: "gotcha", mess: 1.2, tilt: -7, sizes: [1.5, 1, 0.98, 1.02, 0.96, 1.04], rises: [0.12, 0, 0.02, -0.02, 0.03, 0], spin: 4 });
                    P.add(`<g transform="translate(${innerWidth - 24 - g.box.w - g.box.x} ${t.y + 8 - (g.box.y + g.box.h)})">${g.svg}</g>`);
                }
                else noteAt(L, "HOW ABOUT THAT.", innerWidth - 300, tb.y + 8, { size: 26, tilt: -6, maxWidth: 300, importance: "vibe" });
            } else if (screen === "found") noteAt(L, "GOTCHA.", tb.x + 150, tb.y + 26, { size: 52, tilt: -9, maxWidth: 260, importance: "vibe" });
            else noteAt(L, "HOW ABOUT THAT.", tb.x + 90, tb.y + 22, { size: 34, tilt: -8, maxWidth: 280, importance: "vibe" });
        }
        // Questions so far is a tab now: the page sits under the header, its tab open.
        const hm = $("#history-modal");
        if (S.prune && hm && !hm.hidden) {
            const hdr = $("#view-tabs").getBoundingClientRect();
            hm.style.top = `${hdr.bottom}px`;
            $$(".view-tab").forEach((t) => t.classList.toggle("active", t.classList.contains("q-tab")));
            const head = $(".modal-head", hm);
            if (head) head.style.display = "none";
        }
        // Always something red telling you what to do: with nothing else
        // marked, an arrow at the button to press now.
        if (S.prune && !L.has() && !P.has() && screen !== "history") {
            const cta = $$(".cta, .big-btn.cta, #auth-submit.cta").find(visible);
            if (cta) {
                const b = P.box(cta);
                P.add(Ink.stubArrow(b.x + b.w - 34, b.y + b.h + 64, b.x + b.w - 70, b.y + b.h - 8, { seed: `cta${screen}`, weight: 11 }));
            }
        }
        L.done();
        P.done();
        // The header's STALK is always black in the app: red means "look here".
        const quiet = S.quietHeader || L.has() || P.has();
        headerLogo(S.dark, quiet ? ink : Ink.RED);

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
