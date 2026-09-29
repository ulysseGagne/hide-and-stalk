/* global Ink, Campus */

// Set X: the wild ones. Each concept is a whole design system for the app,
// shown on the welcome screen (the poster) and the in-app screens that carry
// the game: the three questions, the hider answering, the map, the ending.
// Deliberately far apart, some deliberately against the brief.
//
// Drawn as standalone mockups (not the real src/ DOM) so layouts can go
// anywhere. Content is the real game's.

(function () {
    const F = "Arimo, 'Helvetica Neue', Helvetica, Arial, sans-serif";
    const M = "'IBM Plex Mono', ui-monospace, monospace";
    const S = "'Shantell Sans', cursive";
    const R = Ink.RED;
    const W = 375;
    const H = 812;
    const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

    const ctx = document.createElement("canvas").getContext("2d");
    const mw = (txt, size, font = F, weight = 700) => {
        ctx.font = `${weight} ${size}px ${font}`;
        return ctx.measureText(txt).width;
    };

    /** Absolutely placed text. */
    const t = (x, y, size, txt, o = {}) =>
        `<div style="position:absolute;left:${x}px;top:${y}px;${o.w ? `width:${o.w}px;` : ""}font:${o.wt ?? 700} ${size}px/${o.lh ?? 1.08} ${o.f ?? F};color:${o.c ?? "#000"};letter-spacing:${o.ls ?? "-0.01em"};${o.align ? `text-align:${o.align};` : ""}${o.st ?? ""}">${txt}</div>`;
    const box = (x, y, w, h, st, inner = "") => `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;box-sizing:border-box;${st}">${inner}</div>`;
    const hw = (txt, x, y, size, o = {}) => Ink.write(txt, { x, y, size, seed: o.seed ?? `${txt}${x}${y}`, weight: o.weight, mess: o.mess ?? 0.5, tilt: o.tilt, maxWidth: o.maxWidth, color: o.color, spacing: o.spacing }).svg;
    const note = (txt, x, y, size, o = {}) => Ink.note(txt, { x, y, size, maxWidth: o.maxWidth ?? 220, seed: o.seed ?? `${txt}${x}`, tilt: o.tilt ?? -3, mess: o.mess ?? 0.5, color: o.color, weight: o.weight }).svg;

    /** The lockup, anywhere, any size: HIDE AND [SEEK, scribbled] STALK. */
    function lockup(x, y, size, o = {}) {
        const c = o.color ?? "#000";
        const lead = o.amp ? "HIDE &" : "HIDE AND";
        let html = "";
        let ink = "";
        if (o.stack) {
            html += t(x, y, size, "HIDE", { c, lh: 0.9, ls: "-0.03em" }) + t(x, y + size * 0.88, size, o.amp ? "&" : "AND", { c, lh: 0.9, ls: "-0.03em" }) + t(x, y + size * 1.76, size, "SEEK", { c, lh: 0.9, ls: "-0.03em" });
            const sw = mw("SEEK", size);
            ink += Ink.scribbleOut(x + 4, y + size * 1.76 + size * 0.14, sw - 6, size * 0.72, { seed: `lk${x}${y}`, weight: size * 0.13 });
            ink += hw("STALK", x + sw * 0.3, y + size * 3.3, size * 0.8, { seed: `lks${x}${y}`, weight: size * 0.15, tilt: -3, spacing: 0.12 });
        } else {
            const lw = mw(`${lead} `, size);
            const sw = mw("SEEK", size);
            html += t(x, y, size, `${lead} SEEK`, { c, lh: 1, ls: "-0.02em" });
            ink += Ink.scribbleOut(x + lw + 2, y + size * 0.18, sw - 4, size * 0.72, { seed: `lk${x}${y}`, weight: size * 0.12 });
            ink += hw("STALK", x + lw + sw * 0.1, y + size * 1.75, size * 0.72, { seed: `lks${x}${y}`, weight: size * 0.14, tilt: -4, spacing: 0.12 });
        }
        return { html, ink };
    }

    /** The drawn campus, from the real border and pavilions, with the real elimination. */
    function campus(w, h, o = {}) {
        const sc = o.scenario === false ? null : Campus.scenario(o.scenario ?? "greenhouses");
        const m = Campus.map(w, h, { scenario: sc, hatch: o.hatch ?? "red", invert: o.invert, labels: o.labels ?? true, pad: o.pad ?? 10, zoom: o.zoom, center: o.center, stops: o.stops });
        return { svg: `<svg width="${w}" height="${h}" style="display:block">${m.svg}</svg>`, P: m.P, sc };
    }
    const HIDER = [-71.2789, 46.7806];

    /** Stand-in photo scenes (white line art on black), 100x100 viewBox. */
    const PHOTO = {
        door: `<rect width="100" height="100" fill="#000"/><rect x="30" y="16" width="40" height="84" fill="none" stroke="#fff" stroke-width="3"/><rect x="36" y="24" width="28" height="30" fill="none" stroke="#fff" stroke-width="1.5"/><circle cx="62" cy="62" r="3" fill="#fff"/><rect x="38" y="6" width="24" height="7" fill="#fff"/>`,
        sky: `<rect width="100" height="100" fill="#fff"/><path d="M0 0 L38 30 L40 100 L0 100 Z" fill="#000"/><path d="M100 0 L64 26 L60 100 L100 100 Z" fill="#000"/>`,
        tree: `<rect width="100" height="100" fill="#000"/><path d="M50 100 L49 64 L52 48" stroke="#fff" stroke-width="7" fill="none"/>${[[40, 34, 12], [58, 30, 13], [50, 20, 12], [34, 44, 9], [66, 44, 10], [48, 40, 11]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="#fff" stroke-width="1.6"/>`).join("")}`,
        figure: `<rect width="100" height="100" fill="#fff"/><ellipse cx="50" cy="32" rx="14" ry="17" fill="#000"/><path d="M18 100 C20 70 32 54 50 54 C68 54 80 70 82 100 Z" fill="#000"/>`,
        bench: `<rect width="100" height="100" fill="#000"/><path d="M10 60 L90 58 M12 48 L88 46 M20 60 L18 84 M80 59 L82 84 M0 88 L100 90" stroke="#fff" stroke-width="4" fill="none"/>`,
    };
    const photo = (kind, w, h = w) => `<svg width="${w}" height="${h}" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" style="display:block">${PHOTO[kind]}</svg>`;

    const QS = [
        ["Are you within 500 m of me?", "Distance", "Yes / No"],
        ["Using Google Maps, how many minutes would it take me to walk to you?", "Distance", "A number"],
        ["Which àVélo station on campus are you closest to?", "Proximity", "Pick one"],
    ];

    /** Every concept: code, name, pitch, screens. */
    const C = [];
    const concept = (code, name, pitch, screens) => C.push({ code, name, pitch, screens });

    // ======================================================================
    // 1. THREAD — the whole game is a text conversation with a stranger.
    // ======================================================================
    const bubble = (x, y, w, txt, me = false, o = {}) =>
        box(me ? W - 16 - w : 16, y, w, o.h ?? 0, `height:auto;padding:10px 14px;border-radius:20px;${me ? "background:#000;color:#fff;border-bottom-right-radius:4px" : "background:#fff;color:#000;border:2px solid #000;border-bottom-left-radius:4px"};font:${o.wt ?? 400} ${o.size ?? 17}px/1.3 ${F}`, txt);
    concept("X01", "Thread", "The app is a text conversation with a stranger who knows where you are. Every question arrives as a message; you answer in quick replies. Screenshots read instantly because everybody knows this interface.", [
        ["welcome", "Welcome", (root) => {
            let h = t(0, 58, 13, "Unknown", { w: W, align: "center", wt: 700 }) + t(0, 76, 11, "iMessage · Today 12:58", { w: W, align: "center", wt: 400 });
            h += box(W / 2 - 22, 18, 44, 44, "border-radius:50%;background:#000", "") + t(W / 2 - 22, 28, 20, "?", { w: 44, align: "center", c: "#fff" });
            h += bubble(0, 120, 120, "hey") + bubble(0, 176, 220, "i can see you from here") + bubble(0, 256, 250, "don't turn around");
            h += bubble(0, 336, 150, "who is this??", true);
            h += box(16, 400, 250, 250, "border:2px solid #000;border-radius:18px;overflow:hidden;background:#fff", "");
            const L = lockup(34, 426, 48, { stack: true });
            h += L.html;
            h += t(16, 660, 11, "Delivered", { w: W - 32, align: "right", wt: 400 });
            h += box(16, 720, W - 32, 48, "border:2px solid #000;border-radius:24px", "") + t(34, 733, 17, "Reply to play…", { wt: 400 });
            return { html: h, ink: L.ink + Ink.circle(W - 46, 744, 20, 18, { seed: "thr", weight: 3.5 }) + hw("GO", W - 60, 754, 16, { weight: 3 }) };
        }],
        ["cards", "Question 2 arrives", (root) => {
            let h = t(0, 24, 13, "Team 3 · Hunt", { w: W, align: "center" }) + t(0, 42, 11, "4:12 until question 3", { w: W, align: "center", wt: 400 });
            h += bubble(0, 80, 230, "Question 2 of 6. Pick one. It goes straight to maelle.", false, { size: 16 });
            QS.forEach(([q], i) => (h += bubble(0, 176 + i * 104, 280, q, true, { size: 16, wt: 700 })));
            h += t(16, 500, 11, "Tap a message to send it. The other two disappear.", { w: W - 32, wt: 400 });
            h += bubble(0, 560, 150, "north", false, { size: 17 }) + t(16, 606, 11, "maelle · Q1 answer", { wt: 400 });
            return { html: h, ink: Ink.circle(W - 150, 216, 140, 34, { seed: "thc", weight: 4 }) + note("THIS ONE", 20, 250, 17, {}) };
        }],
        ["answer", "Hider answering", (root) => {
            let h = t(0, 24, 13, "jules", { w: W, align: "center" }) + t(0, 42, 11, "stalker · 180 m away", { w: W, align: "center", wt: 400 });
            h += bubble(0, 90, 260, "Are you north or south of me?", false, { size: 18, wt: 700 });
            h += t(16, 160, 11, "Answer truthfully.", { wt: 400 });
            h += box(16, 640, 160, 54, "border:2px solid #000;border-radius:27px", t(0, 15, 18, "North", { w: 156, align: "center" }));
            h += box(W - 176, 640, 160, 54, "border:2px solid #000;border-radius:27px", t(0, 15, 18, "South", { w: 156, align: "center" }));
            h += bubble(0, 540, 90, "north", true);
            return { html: h, ink: Ink.circle(96, 667, 90, 34, { seed: "tha", weight: 4.5 }) + note("SENT. NO TAKE-BACKS.", 150, 520, 16) };
        }],
        ["map", "Shared location", (root) => {
            const c = campus(280, 230);
            let h = t(0, 24, 13, "Team 3 · Hunt", { w: W, align: "center" });
            h += bubble(0, 70, 240, "Here's everywhere she can still be:", false, { size: 16 });
            h += box(16, 130, 284, 234, "border:2px solid #000;border-radius:18px;overflow:hidden", c.svg);
            h += t(20, 372, 11, "4 answers · updated 13:25", { wt: 400 });
            h += bubble(0, 420, 170, "on my way", true) + bubble(0, 480, 210, "check the greenhouses", true);
            return { html: h, ink: "" };
        }],
        ["end", "Found", (root) => {
            let h = t(0, 24, 13, "Unknown", { w: W, align: "center" });
            h += bubble(0, 90, 150, "turn around");
            h += bubble(0, 150, 110, "found you.", false, { wt: 700 });
            h += t(16, 202, 11, "Read 13:32", { wt: 400 });
            h += t(20, 300, 64, "23:14", { ls: "-0.04em" }) + t(22, 370, 13, "OF HUNTING · 4 QUESTIONS", { ls: ".1em" });
            h += box(16, 700, W - 32, 56, "background:#000;border-radius:28px", t(0, 17, 17, "Play again · next hider: jules", { w: W - 32, align: "center", c: "#fff" }));
            return { html: h, ink: Ink.circle(92, 172, 70, 30, { seed: "the", weight: 4.5 }) + note("GOTCHA", 200, 160, 26) };
        }],
    ]);

    // ======================================================================
    // 2. RECEIPT — the round prints out like a thermal receipt.
    // ======================================================================
    const receipt = (x, y, w, h, inner) => box(x, y, w, h, "background:#fff;clip-path:polygon(" + Array.from({ length: 21 }, (_, i) => `${(i * 100) / 20}% ${i % 2 ? 100 : 98.6}%`).join(",") + ",100% 0,0 0)", inner);
    const rl = (y, a, b, o = {}) => t(20, y, o.s ?? 13, `<span>${a}</span><span>${b}</span>`, { f: M, wt: o.wt ?? 500, w: 275, st: "display:flex;justify-content:space-between" });
    concept("X02", "Receipt", "Each round prints like a thermal receipt: questions are line items, answers are stamped on, the hunt time is the total. Tear it off at the end and post it.", [
        ["welcome", "Ticket", (root) => {
            let inner = t(20, 26, 12, "CLUB D'IA · UNIVERSITÉ LAVAL", { f: M, wt: 700, w: 275, align: "center" });
            inner += t(0, 60, 44, "HIDE AND SEEK", { w: 315, align: "center", ls: "-0.03em" });
            inner += t(20, 128, 12, "- - - - - - - - - - - - - - - - - - - -", { f: M, w: 275 });
            inner += rl(150, "ADMIT", "ONE") + rl(172, "CAMPUS", "ALL OF IT") + rl(194, "HIDE", "10:00") + rl(216, "QUESTIONS", "6 MAX") + rl(238, "EVERY", "5 MIN");
            inner += t(20, 262, 12, "- - - - - - - - - - - - - - - - - - - -", { f: M, w: 275 });
            inner += rl(284, "TICKET", "#0005", { wt: 700 }) + rl(306, "MON 05 OCT", "13:00");
            inner += box(40, 350, 235, 60, "background:repeating-linear-gradient(90deg,#000 0 2px,#fff 2px 4px,#000 4px 7px,#fff 7px 8px,#000 8px 9px,#fff 9px 12px)", "");
            inner += t(20, 420, 11, "KEEP THIS. SHOW IT TO NOBODY.", { f: M, w: 275, align: "center" });
            let h = `<div style="position:absolute;inset:0;background:#000"></div>` + box(30, 60, 315, 560, "", receipt(0, 0, 315, 560, inner));
            h += box(20, 700, W - 40, 60, "border:3px solid #fff", t(0, 17, 21, "TEAR HERE TO JOIN", { w: W - 46, align: "center", c: "#fff", ls: ".06em" }));
            const sw = mw("SEEK", 44);
            const x0 = 30 + (315 - mw("HIDE AND SEEK", 44)) / 2 + mw("HIDE AND ", 44);
            return { html: h, ink: Ink.scribbleOut(x0, 128, sw - 4, 32, { seed: "rc", weight: 7 }) + hw("STALK", x0 - 8, 214, 40, { weight: 7, tilt: -8 }) + Ink.wobble([[10, 686], [W - 10, 682]], { seed: "rct", weight: 2.5, amp: 3 }) };
        }],
        ["cards", "Pick one", (root) => {
            let inner = t(20, 24, 12, "TEAM 3 · QUESTION 2 OF 6", { f: M, wt: 700, w: 275 }) + t(20, 44, 12, "13:14:52 · NEXT IN 04:12", { f: M, w: 275 });
            inner += t(20, 70, 12, "================================", { f: M, w: 275 });
            QS.forEach(([q, cat], i) => {
                inner += t(20, 96 + i * 120, 11, `[ ] ${cat.toUpperCase()}`, { f: M, wt: 700 });
                inner += t(20, 114 + i * 120, 16, esc(q), { w: 275, lh: 1.2 });
            });
            inner += t(20, 460, 12, "================================", { f: M, w: 275 });
            inner += t(20, 482, 12, "PICK ONE. OTHERS VOID.", { f: M, wt: 700, w: 275, align: "center" });
            const h = `<div style="position:absolute;inset:0;background:#000"></div>` + box(30, 50, 315, 540, "", receipt(0, 0, 315, 540, inner));
            return { html: h, ink: Ink.check(52, 140, 18, { seed: "rcc", weight: 4 }) + Ink.strike(46, 268, 280, 60, { seed: "rs1", weight: 4 }) + Ink.strike(46, 388, 280, 60, { seed: "rs2", weight: 4 }) + note("VOID", 250, 290, 20, {}) };
        }],
        ["end", "Total", (root) => {
            let inner = t(20, 24, 12, "TEAM 3 · ROUND 1", { f: M, wt: 700, w: 275 }) + t(20, 44, 12, "HIDER: MAELLE", { f: M, w: 275 });
            inner += t(20, 68, 12, "--------------------------------", { f: M, w: 275 });
            [["Q1 NORTH OR SOUTH", "NORTH"], ["Q2 WITHIN 500 M", "NO"], ["Q3 NEAREST CAFE", "P'TIT CAAF"], ["Q4 CLOSER TO GREENH.", "YES"]].forEach(([a, b], i) => (inner += rl(92 + i * 26, a, b)));
            inner += t(20, 200, 12, "--------------------------------", { f: M, w: 275 });
            inner += rl(224, "HIDE TIME", "10:00") + rl(248, "HUNT TIME", "23:14");
            inner += t(20, 280, 12, "================================", { f: M, w: 275 });
            inner += rl(306, "TOTAL", "23:14", { s: 26, wt: 700 });
            inner += t(20, 360, 12, "CAUGHT BY JULES, 13:32", { f: M, w: 275 });
            inner += t(20, 390, 12, "THANK YOU FOR HIDING", { f: M, wt: 700, w: 275, align: "center" });
            const h = `<div style="position:absolute;inset:0;background:#000"></div>` + box(30, 60, 315, 460, "", receipt(0, 0, 315, 460, inner));
            return { html: h, ink: Ink.box(150, 420, 170, 70, { seed: "rbx", weight: 4 }) + hw("FOUND", 164, 474, 38, { tilt: -10, weight: 7 }) };
        }],
    ]);

    // ======================================================================
    // 3. MISSING — the welcome screen is a missing-person flyer.
    // ======================================================================
    concept("X03", "Missing", "A lost-person flyer, the kind stapled to a lamppost. The hider is the missing person; the tear-off tabs at the bottom are how you join. Unsettling on purpose.", [
        ["welcome", "Flyer", (root) => {
            let h = t(0, 40, 88, "MISSING", { w: W, align: "center", ls: "-0.05em" });
            h += box(62, 150, 250, 250, "border:3px solid #000", photo("figure", 244));
            h += t(24, 420, 22, "HAVE YOU SEEN THIS PERSON?", { w: W - 48, align: "center", ls: "-0.02em" });
            h += t(24, 460, 15, "Last seen on the Université Laval campus. Walks, never runs. Stays within 20 m of a path. Answers any question truthfully.", { w: W - 48, wt: 400, lh: 1.35, align: "center" });
            for (let i = 0; i < 7; i++) h += box(8 + i * 51, 640, 51, 150, "border-left:2px dashed #000;border-top:2px dashed #000", `<div style="position:absolute;left:14px;top:136px;transform:rotate(-90deg);transform-origin:0 0;font:700 13px ${F};white-space:nowrap">HIDE AND STALK · JOIN</div>`);
            const L = lockup(24, 548, 22);
            return { html: h + L.html, ink: L.ink + Ink.scribbleOut(160, 186, 56, 36, { seed: "msf", weight: 7 }) + note("TEAR ONE ↓", 230, 610, 17, { tilt: -6 }) + Ink.cross(33 + 51, 700, 22, { seed: "tab", weight: 5 }) };
        }],
        ["end", "Found", (root) => {
            let h = t(0, 40, 88, "MISSING", { w: W, align: "center", ls: "-0.05em" });
            h += box(62, 150, 250, 250, "border:3px solid #000", photo("figure", 244));
            h += t(24, 420, 22, "MAELLE, 23 MIN 14 S", { w: W - 48, align: "center" });
            return { html: h, ink: Ink.strike(20, 40, 335, 90, { seed: "msx", weight: 12 }) + hw("FOUND", 70, 150, 70, { tilt: -12, weight: 12, mess: 0.7 }) + note("BY JULES, BEHIND THE GREENHOUSES", 30, 520, 22, { maxWidth: 300 }) };
        }],
    ]);

    // ======================================================================
    // 4. SYSTEM 1 — a 1984 black-and-white desktop, windows and alerts.
    // ======================================================================
    const macWin = (x, y, w, h, title, inner) =>
        box(x, y, w, h, "background:#fff;border:2px solid #000;box-shadow:4px 4px 0 #000", `<div style="height:22px;border-bottom:2px solid #000;background:repeating-linear-gradient(#fff 0 2px,#000 2px 3px);display:flex;justify-content:center;align-items:center"><span style="background:#fff;padding:0 8px;font:700 13px ${M}">${title}</span></div><div style="position:relative">${inner}</div>`);
    const macBtn = (x, y, w, label, def = false) => box(x, y, w, 34, `border:2px solid #000;border-radius:10px;background:#fff;${def ? "outline:3px solid #000;outline-offset:2px;" : ""}`, t(0, 7, 15, label, { w: w - 4, align: "center", f: M }));
    const desk = `<div style="position:absolute;inset:0;background:#fff;background-image:radial-gradient(#000 0.8px,transparent 0.9px);background-size:4px 4px"></div><div style="position:absolute;left:0;top:0;right:0;height:26px;background:#fff;border-bottom:2px solid #000;font:700 13px ${M};padding:5px 12px;box-sizing:border-box">  File  Edit  Hunt  Special</div>`;
    concept("X04", "System 1", "The app as a 1984 black-and-white desktop: dithered backdrop, striped title bars, alert boxes with two buttons. Questions are dialogs you can't close. Black and white is its native tongue.", [
        ["welcome", "Desktop", (root) => {
            let h = desk + macWin(28, 110, 320, 330, "HIDE AND STALK", "");
            const L = lockup(52, 150, 60, { stack: true });
            h += L.html;
            h += macWin(40, 520, 296, 150, "Alert", t(60, 20, 15, "A hider is somewhere on campus. Join the hunt?", { w: 220, wt: 400, f: M, lh: 1.35 }) + macBtn(20, 90, 110, "Later") + macBtn(156, 90, 110, "Join", true));
            h += t(16, 576, 34, "!", { f: M });
            return { html: h, ink: L.ink + Ink.circle(252, 627, 70, 30, { seed: "mw", weight: 4 }) };
        }],
        ["cards", "Three dialogs", (root) => {
            let h = desk;
            QS.forEach(([q, cat], i) => (h += macWin(18 + i * 14, 70 + i * 170, 310, 190, `Q2 · ${cat}`, t(16, 18, 17, esc(q), { w: 276, lh: 1.25 }) + macBtn(180, 130, 110, "Send", i === 2))));
            h += macWin(40, 640, 290, 80, "Clock", t(16, 10, 34, "04:12", { f: M }) + t(140, 22, 12, "until Q3", { f: M, wt: 400 }));
            return { html: h, ink: note("THE BOTTOM ONE?", 190, 620, 16) };
        }],
        ["answer", "Alert", (root) => {
            let h = desk + macWin(24, 200, 327, 250, "Question 1 from jules", t(70, 24, 20, "Are you north or south of me?", { w: 230, lh: 1.2 }) + t(70, 104, 13, "You must answer truthfully.", { f: M, wt: 400 }) + macBtn(24, 170, 120, "North", true) + macBtn(178, 170, 120, "South"));
            h += t(34, 244, 44, "☻", { wt: 400 });
            return { html: h, ink: Ink.circle(107, 413, 78, 30, { seed: "ma", weight: 4.5 }) + Ink.check(60, 470, 26, { seed: "mac", weight: 5 }) };
        }],
        ["map", "Map window", (root) => {
            const c = campus(300, 250);
            let h = desk + macWin(20, 80, 336, 320, "Campus — 4 answers", `<div style="padding:8px 16px">${c.svg}</div>`);
            h += macWin(40, 450, 296, 150, "Get Info", t(16, 12, 13, "Possible area: 0.21 km²<br>Pavilions left: 3<br>Answers applied: 4<br>Contradictions: none", { f: M, wt: 500, lh: 1.6 }));
            return { html: h, ink: "" };
        }],
        ["end", "Found alert", (root) => {
            let h = desk + macWin(24, 220, 327, 220, "Alert", t(70, 24, 20, "The hider has been found.", { w: 230 }) + t(70, 60, 13, "maelle lasted 23:14. Next up to hide: jules.", { f: M, wt: 400, w: 230, lh: 1.4 }) + macBtn(178, 140, 120, "Play again", true));
            h += t(30, 250, 44, "✋", { wt: 400 });
            return { html: h, ink: note("FINALLY", 60, 180, 30, { tilt: -8 }) };
        }],
    ]);

    // ======================================================================
    // 5. THE CLOCK IS THE APP — nothing but the countdown, enormous.
    // ======================================================================
    concept("X05", "The Clock", "Nothing matters but time. The countdown fills the screen edge to edge; everything else is small print under it. Each passing question gets scratched off like days in a cell.", [
        ["welcome", "Welcome", (root) => {
            let h = t(-8, 80, 250, "10", { ls: "-0.08em", lh: 0.8 }) + t(-8, 290, 250, "00", { ls: "-0.08em", lh: 0.8 });
            h += t(20, 520, 14, "MINUTES TO HIDE. THEN A QUESTION EVERY 5 MINUTES. 6 QUESTIONS. THEN THE HIDER WINS.", { w: 300, ls: ".04em", lh: 1.4 });
            const L = lockup(20, 610, 30);
            h += L.html + box(20, 720, W - 40, 60, "border:3px solid #000", t(0, 17, 21, "START THE CLOCK", { w: W - 46, align: "center", ls: ".06em" }));
            return { html: h, ink: L.ink };
        }],
        ["cards", "Hunt, Q2", (root) => {
            let h = t(-6, 30, 196, "04:", { ls: "-0.08em", lh: 0.8 }) + t(-6, 196, 196, "12", { ls: "-0.08em", lh: 0.8 });
            h += t(20, 370, 13, "UNTIL QUESTION 3 · PICK ONE NOW", { ls: ".1em" });
            QS.forEach(([q], i) => (h += box(20, 410 + i * 110, W - 40, 96, "border-top:4px solid #000", t(0, 12, 18, esc(q), { w: W - 60, lh: 1.15 }))));
            let tally = "";
            for (let i = 0; i < 6; i++) tally += Ink.pathEl([[250 + i * 18, 386], [252 + i * 18, 340]], { size: 5, color: i < 1 ? "#000" : R, seed: `tl${i}` });
            return { html: h, ink: tally + Ink.pathEl([[240, 366], [362, 356]], { size: 4, seed: "tlx" }) };
        }],
        ["hiding", "Hiding", (root) => {
            let h = `<div style="position:absolute;inset:0;background:#000"></div>` + t(-8, 60, 250, "08", { ls: "-0.08em", lh: 0.8, c: "#fff" }) + t(-8, 270, 250, "41", { ls: "-0.08em", lh: 0.8, c: "#fff" });
            h += t(20, 520, 22, "GO HIDE.", { c: "#fff" }) + t(20, 552, 15, "Walk, don't run. Within 20 m of a path, where people on it could see you.", { c: "#fff", wt: 400, w: 300, lh: 1.35 });
            return { html: h, ink: Ink.scribbleOut(10, 290, 360, 160, { seed: "hd", weight: 14, passes: 2 }) + note("DON'T LOOK BACK", 150, 640, 22, { maxWidth: 200 }) };
        }],
        ["end", "Last question", (root) => {
            let h = t(-6, 60, 250, "00", { ls: "-0.08em", lh: 0.8 }) + t(-6, 270, 250, "37", { ls: "-0.08em", lh: 0.8 });
            h += t(20, 520, 22, "LAST QUESTION.", {}) + t(20, 552, 15, "Find maelle before the timer runs out, or she wins.", { wt: 400, w: 300 });
            return { html: h, ink: Ink.circle(190, 380, 180, 110, { seed: "lq", weight: 6 }) + Ink.circle(190, 380, 170, 104, { seed: "lq2", weight: 3 }) + note("HURRY HURRY HURRY", 150, 640, 22, { maxWidth: 200, mess: 1.2 }) };
        }],
    ]);

    // ======================================================================
    // 6. NOTEBOOK — the stalker's spiral notebook; elimination is a list.
    // ======================================================================
    const ruled = `<div style="position:absolute;inset:0;background:#fff;background-image:linear-gradient(#000 1px,transparent 1px);background-size:100% 32px;background-position:0 20px"></div><div style="position:absolute;top:0;bottom:0;left:52px;width:2px;background:#000"></div>`;
    const rings = Array.from({ length: 14 }, (_, i) => `<div style="position:absolute;left:14px;top:${30 + i * 56}px;width:18px;height:18px;border-radius:50%;border:2px solid #000;background:#fff"></div>`).join("");
    concept("X06", "Notebook", "The stalker's spiral notebook. The map becomes a list: every pavilion on campus, crossed out as answers rule it out, until one name is left standing. Deduction you can read.", [
        ["welcome", "Cover", (root) => {
            let h = `<div style="position:absolute;inset:0;background:#000"></div>` + box(40, 180, 295, 200, "background:#fff;border:3px solid #000", "");
            const L = lockup(58, 204, 40, { amp: false });
            h += L.html + t(58, 330, 13, "PROPERTY OF: ______________", { f: M, wt: 500 });
            h += box(20, 720, W - 40, 60, "border:3px solid #fff", t(0, 17, 21, "OPEN", { w: W - 46, align: "center", c: "#fff", ls: ".1em" }));
            return { html: h + rings.replace(/background:#fff/g, "background:#000;border-color:#fff"), ink: L.ink + hw("JULES", 260, 346, 20, { color: "#000", weight: 3.4 }) };
        }],
        ["list", "Pavilions left", (root) => {
            const sc = Campus.scenario("greenhouses");
            const places = Campus.layers.building.places;
            const inside = (p) => turf.booleanPointInPolygon(turf.point([p.lng, p.lat]), sc.region);
            let h = ruled + rings + t(64, 12, 20, "WHERE IS SHE", { f: M, wt: 700 });
            let ink = "";
            places.slice(0, 22).forEach((p, i) => {
                const y = 60 + i * 32;
                const name = p.label.replace("Pavillon ", "");
                h += t(64, y - 4, 15, esc(name), { wt: 400, f: F });
                if (!inside(p)) ink += Ink.strike(62, y - 6, Math.min(280, mw(name, 15, F, 400)) + 4, 22, { seed: `nb${i}`, weight: 3.2 });
                else ink += Ink.circle(64 + mw(name, 15, F, 400) / 2, y + 5, mw(name, 15, F, 400) / 2 + 16, 16, { seed: `nc${i}`, weight: 3.5 }) + hw("!!", 80 + mw(name, 15, F, 400) + 12, y + 14, 18, { weight: 3.5 });
            });
            return { html: h, ink };
        }],
        ["map", "Sketch map", (root) => {
            const sc = Campus.scenario("greenhouses");
            const P = Campus.projector(300, 300, 12);
            const ring = Campus.layers.campus.ring.map(P).map(([x, y]) => [x + 60, y + 90]);
            let h = ruled + rings + t(64, 12, 20, "Q4 · 13:25", { f: M, wt: 700 });
            let ink = Ink.wobble(ring, { seed: "sk", weight: 2.6, color: "#000", amp: 3 });
            for (const p of Campus.layers.building.places) {
                const [x, y] = P([p.lng, p.lat]);
                ink += Ink.cross(x + 60, y + 90, 3, { seed: `sx${p.id}`, weight: 1.8, color: "#000" });
            }
            const reg = sc.region.geometry.type === "Polygon" ? sc.region.geometry.coordinates[0] : sc.region.geometry.coordinates[0][0];
            ink += Ink.wobble(reg.map(P).map(([x, y]) => [x + 60, y + 90]), { seed: "skr", weight: 4, amp: 2.5 });
            const [hx, hy] = P(HIDER);
            ink += note("SHE'S HERE. HAS TO BE.", hx + 80, hy + 150, 20, { maxWidth: 200 }) + Ink.arrow(hx + 110, hy + 124, hx + 64, hy + 96, { seed: "ska" });
            ink += note("NORTH OF POL · NOT 500 M · P'TIT CAAF · CLOSER TO GREENH.", 64, 470, 17, { maxWidth: 280, color: "#000" });
            return { html: h, ink };
        }],
        ["answer", "Question page", (root) => {
            let h = ruled + rings + t(64, 12, 14, "QUESTION 3 · FROM NOAH_B · 13:20", { f: M, wt: 700 });
            h += t(64, 52, 26, "Which café on campus are you closest to?", { w: 280, lh: 1.23 });
            ["P'tit CAAF (ABP)", "Snak (VCH)", "Le Vecteur (PLT)", "FAS Café (FAS)"].forEach((c, i) => (h += t(64, 186 + i * 64, 18, `○ &nbsp;${c}`, { wt: 400 })));
            return { html: h, ink: Ink.circle(150, 196, 110, 26, { seed: "nq", weight: 4.5 }) + note("65 M FROM ME", 214, 238, 15) + Ink.strike(62, 244, 170, 24, { seed: "nq2", weight: 2.5 }) + Ink.strike(62, 308, 170, 24, { seed: "nq3", weight: 2.5 }) + Ink.strike(62, 372, 170, 24, { seed: "nq4", weight: 2.5 }) };
        }],
    ]);

    // ======================================================================
    // 7. REDACTED — you only ever see what the hider has told you.
    // ======================================================================
    const bar = (x, y, w, h = 18) => box(x, y, w, h, "background:#000", "");
    concept("X07", "Redacted", "A classified file where everything is blacked out except what the hider has admitted. Each answer declassifies one line. The map, too: only the possible area is visible, the rest is black marker.", [
        ["welcome", "Classified", (root) => {
            let h = t(24, 60, 12, "FILE Nº 0005 · CLUB D'IA · TOP SECRET", { f: M, wt: 700 });
            h += t(24, 110, 58, "HIDE", { ls: "-0.03em" }) + t(24, 170, 58, "AND", { ls: "-0.03em" }) + bar(24, 240, 190, 50);
            [300, 330, 360, 390, 420, 450, 480].forEach((y, i) => (h += bar(24, y, [310, 250, 290, 180, 320, 260, 140][i])));
            h += t(24, 520, 14, "SUBJECT is hiding on campus. SUBJECT will answer any question truthfully. Location: ", { w: 320, wt: 400, lh: 1.5 }) + bar(118, 564, 150);
            h += box(24, 720, W - 48, 60, "background:#000", t(0, 18, 20, "DECLASSIFY", { w: W - 48, align: "center", c: "#fff", ls: ".12em" }));
            return { html: h, ink: hw("STALK", 110, 296, 62, { weight: 11, tilt: -6 }) + Ink.box(230, 40, 130, 44, { seed: "rd", weight: 3.5 }) + hw("EYES ONLY", 240, 70, 17, { weight: 3.2, tilt: -4 }) };
        }],
        ["map", "Blacked-out map", (root) => {
            const c = campus(355, 420, { hatch: "redact", labels: false });
            let h = t(10, 30, 12, "EXHIBIT 4 · WHERE SUBJECT CAN STILL BE", { f: M, wt: 700 }) + box(10, 56, 355, 420, "border:2px solid #000", c.svg);
            h += t(10, 500, 14, "Q1 NORTH · Q2 NOT WITHIN 500 M · Q3 P'TIT CAAF · Q4 CLOSER TO THE GREENHOUSES", { f: M, w: 355, lh: 1.5 });
            h += bar(10, 560, 200) + bar(10, 586, 290) + bar(10, 612, 120);
            const [hx, hy] = c.P(HIDER);
            return { html: h, ink: Ink.circle(hx + 12, hy + 58, 30, 24, { seed: "rdm", weight: 4 }) };
        }],
        ["cards", "Questions", (root) => {
            let h = t(24, 40, 12, "QUESTION 2 OF 6 · CHOOSE ONE TO SEND", { f: M, wt: 700 });
            QS.forEach(([q], i) => {
                h += t(24, 90 + i * 160, 20, esc(q), { w: 320, lh: 1.25 });
                h += bar(24, 150 + i * 160 + (i === 1 ? 26 : 0), 140) + t(174, 148 + i * 160 + (i === 1 ? 26 : 0), 13, "← ANSWER WITHHELD", { f: M });
            });
            return { html: h, ink: note("ASK THIS ONE", 210, 110, 17) };
        }],
    ]);

    // ======================================================================
    // 8. TAROT — three questions dealt like tarot cards.
    // ======================================================================
    const tarot = (x, y, w, h, num, name, sym, rot = 0) =>
        box(x, y, w, h, `background:#fff;border:3px solid #000;outline:2px solid #000;outline-offset:-10px;transform:rotate(${rot}deg)`, t(0, 18, 18, num, { w: w - 6, align: "center", f: "Georgia, serif", wt: 400 }) + `<svg width="${w - 6}" height="${h * 0.5}" viewBox="0 0 100 100" style="position:absolute;left:0;top:${h * 0.18}px">${sym}</svg>` + t(0, h - 52, 14, name, { w: w - 6, align: "center", ls: ".16em" }));
    const SYM = {
        radius: `<circle cx="50" cy="50" r="34" fill="none" stroke="#000" stroke-width="3"/><circle cx="50" cy="50" r="4" fill="#000"/><path d="M50 50 L84 50" stroke="#000" stroke-width="2"/>`,
        walk: `<path d="M40 88 L48 60 L38 40 L54 26 M48 60 L62 88 M44 44 L62 54" stroke="#000" stroke-width="4" fill="none"/><circle cx="56" cy="16" r="7" fill="#000"/>`,
        wheel: `<circle cx="30" cy="66" r="18" fill="none" stroke="#000" stroke-width="3"/><circle cx="72" cy="66" r="18" fill="none" stroke="#000" stroke-width="3"/><path d="M30 66 L46 40 L64 40 L72 66 M46 40 L40 30" stroke="#000" stroke-width="3" fill="none"/>`,
        eye: `<path d="M8 50 Q50 10 92 50 Q50 90 8 50 Z" fill="none" stroke="#000" stroke-width="3"/><circle cx="50" cy="50" r="14" fill="#000"/>`,
    };
    concept("X08", "Tarot", "The three questions are dealt like tarot cards, each with a name and a sign. Picking one is reading your fate. Breaks the Helvetica rule on purpose with a serif for the numerals.", [
        ["welcome", "The Hider", (root) => {
            let h = tarot(62, 90, 250, 420, "0", "THE HIDER", SYM.eye);
            const L = lockup(40, 560, 32);
            h += L.html + box(20, 720, W - 40, 60, "border:3px solid #000", t(0, 17, 21, "DRAW", { w: W - 46, align: "center", ls: ".2em" }));
            return { html: h, ink: L.ink };
        }],
        ["cards", "The spread", (root) => {
            let h = t(20, 40, 12, "QUESTION II OF VI · 04:12", { f: M, wt: 700 });
            h += tarot(8, 110, 150, 250, "XIX", "THE RING", SYM.radius, -8) + tarot(112, 90, 150, 250, "VII", "THE WALK", SYM.walk, 0) + tarot(218, 110, 150, 250, "XII", "THE WHEEL", SYM.wheel, 8);
            h += t(20, 420, 20, "“Are you within 500 m of me?”", { w: 335, lh: 1.25, f: "Georgia, serif", wt: 400 });
            h += t(20, 480, 14, "The Ring asks whether the hider stands inside a circle 500 m around you. One card only. The others burn.", { w: 335, wt: 400, lh: 1.4 });
            return { html: h, ink: Ink.circle(83, 240, 90, 150, { seed: "tr", weight: 4.5, tilt: -8 }) };
        }],
    ]);

    // ======================================================================
    // 9. SURVEILLANCE — CCTV grid; you are always on camera.
    // ======================================================================
    const cam = (x, y, w, h, label, kind) => box(x, y, w, h, "background:#000;border:2px solid #000;overflow:hidden", photo(kind, w, h) + t(6, 4, 10, label, { f: M, c: "#fff", st: "background:#000;padding:1px 3px" }) + t(6, h - 18, 10, "13:27:04", { f: M, c: "#fff", st: "background:#000;padding:1px 3px" }));
    concept("X09", "Surveillance", "The app is a wall of camera feeds. Photo answers land as CCTV stills with timestamps; the map is camera 00. It turns the hider's photos into evidence.", [
        ["welcome", "Monitor wall", (root) => {
            let h = `<div style="position:absolute;inset:0;background:#000"></div>`;
            [["CAM 01 PEPS", "bench"], ["CAM 02 VACHON", "door"], ["CAM 03 GREENH.", "tree"], ["CAM 04 ???", "figure"]].forEach(([l, k], i) => (h += cam(8 + (i % 2) * 182, 60 + Math.floor(i / 2) * 182, 176, 176, l, k)));
            const L = lockup(20, 430, 40, { color: "#fff" });
            h += L.html.replace(/color:#000/g, "color:#fff") + t(20, 560, 13, "6 players · 1 hider · every camera on campus", { f: M, c: "#fff", wt: 500 });
            h += box(20, 720, W - 40, 60, "border:3px solid #fff", t(0, 17, 21, "GO LIVE", { w: W - 46, align: "center", c: "#fff", ls: ".14em" }));
            return { html: h, ink: L.ink + Ink.circle(290, 330, 64, 64, { seed: "cc", weight: 4 }) + hw("HER?", 250, 440, 26, { tilt: -6 }) + `<ellipse cx="342" cy="34" rx="7" ry="6" fill="${R}"/>` + hw("REC", 300, 42, 14, { color: "#fff", weight: 2.8 }) };
        }],
        ["photo", "Photo answer", (root) => {
            let h = `<div style="position:absolute;inset:0;background:#000"></div>` + cam(0, 70, 375, 460, "Q5 · NEAREST DOOR · FROM MAELLE", "door");
            h += t(16, 550, 16, "Send a photo of the nearest door.", { c: "#fff" }) + t(16, 576, 12, "Received 13:26:41 · asked by camille", { f: M, c: "#fff", wt: 500 });
            return { html: h, ink: Ink.circle(188, 270, 90, 150, { seed: "cd", weight: 4.5 }) + note("SORTIE SIGN = SOUTH ENTRANCE? WHICH BUILDING", 20, 640, 18, { maxWidth: 330 }) };
        }],
        ["map", "Camera 00", (root) => {
            const c = campus(371, 500, { invert: true });
            let h = `<div style="position:absolute;inset:0;background:#000"></div>` + box(2, 60, 371, 500, "border:2px solid #fff;overflow:hidden", c.svg + t(6, 4, 10, "CAM 00 · OVERHEAD · 4 ANSWERS", { f: M, c: "#000", st: "background:#fff;padding:1px 3px" }));
            return { html: h, ink: "" };
        }],
    ]);

    // ======================================================================
    // 10. RADAR — the hider's screen: stalkers as blips closing in.
    // ======================================================================
    concept("X10", "Radar", "For the hider: you are the dot in the middle, the stalkers are blips with their distances, and the rings are drawn by a shaking hand. The screen they keep checking while crouched behind a bush.", [
        ["radar", "Hider radar", (root) => {
            let h = `<div style="position:absolute;inset:0;background:#000"></div>` + t(20, 40, 12, "YOU · HIDER · Q4 IN 02:40", { f: M, wt: 700, c: "#fff" });
            const cx = 188;
            const cy = 360;
            let ink = "";
            [60, 120, 180].forEach((r, i) => (ink += Ink.circle(cx, cy, r, r, { seed: `rr${i}`, weight: 2.4, turns: 1.03, tilt: 0 })));
            ink += Ink.pathEl([[cx - 180, cy], [cx + 180, cy]], { size: 1.6, color: R }) + Ink.pathEl([[cx, cy - 180], [cx, cy + 180]], { size: 1.6, color: R });
            const blips = [["JULES", 142, -40], ["NOAH_B", 210, 150], ["CAMILLE", 96, 250], ["THEO", 330, 60]];
            for (const [n, d, a] of blips) {
                const rr = Math.min(175, d * 0.55);
                const x = cx + Math.cos((a * Math.PI) / 180) * rr;
                const y = cy + Math.sin((a * Math.PI) / 180) * rr;
                h += box(x - 6, y - 6, 12, 12, "background:#fff;border-radius:50%", "") + t(x + 10, y - 8, 11, `${n} ${d} M`, { f: M, c: "#fff" });
                ink += Ink.string(cx, cy, x, y, { width: 1.4, sag: 4 });
            }
            h += box(cx - 8, cy - 8, 16, 16, "background:#fff", "");
            h += t(20, 600, 60, "96 M", { c: "#fff", ls: "-0.04em" }) + t(20, 668, 13, "CLOSEST: CAMILLE · MOVING TOWARD YOU", { f: M, c: "#fff" });
            return { html: h, ink: ink + note("DON'T MOVE", 220, 610, 24, { maxWidth: 140 }) };
        }],
        ["welcome", "Welcome", (root) => {
            let h = `<div style="position:absolute;inset:0;background:#000"></div>`;
            let ink = "";
            [40, 90, 140, 190, 240].forEach((r, i) => (ink += Ink.circle(188, 300, r, r, { seed: `wr${i}`, weight: 2, turns: 1.02, tilt: 0 })));
            h += box(182, 294, 12, 12, "background:#fff", "");
            const L = lockup(20, 600, 34);
            h += L.html.replace(/color:#000/g, "color:#fff") + box(20, 730, W - 40, 56, "border:3px solid #fff", t(0, 15, 20, "ENTER THE RADIUS", { w: W - 46, align: "center", c: "#fff", ls: ".1em" }));
            return { html: h, ink: ink + L.ink + note("THAT'S YOU", 200, 340, 16) };
        }],
    ]);

    // ======================================================================
    // 11. CRIME SCENE — tape across everything.
    // ======================================================================
    const tape = (y, rot, text, dark = false) => `<div style="position:absolute;left:-60px;top:${y}px;width:${W + 120}px;height:44px;transform:rotate(${rot}deg);background:${dark ? "#000" : "#fff"};border-top:3px solid #000;border-bottom:3px solid #000;overflow:hidden;white-space:nowrap;font:700 20px/38px ${F};letter-spacing:.14em;color:${dark ? "#fff" : "#000"}">${(text + " · ").repeat(8)}</div>`;
    concept("X11", "Crime Scene", "Police tape strung across the screen, the title printed on it. Bold, cheap, instantly readable in a Discord thumbnail. The chalk outline is where the hider was last seen.", [
        ["welcome", "Taped off", (root) => {
            let h = tape(120, -12, "HIDE AND STALK") + tape(300, 8, "DO NOT CROSS", true) + tape(560, -5, "HIDER ON CAMPUS");
            h += box(20, 720, W - 40, 60, "border:3px solid #000;background:#fff", t(0, 17, 21, "CROSS THE LINE", { w: W - 46, align: "center", ls: ".08em" }));
            const body = [[150, 420], [170, 380], [210, 378], [225, 420], [250, 470], [230, 520], [205, 500], [200, 540], [175, 540], [170, 500], [140, 520], [125, 470]];
            return { html: h, ink: Ink.wobble([...body, body[0]], { seed: "chalk", weight: 4, amp: 3 }) + Ink.circle(190, 360, 22, 20, { seed: "hd2", weight: 4 }) + note("LAST SEEN 13:00", 230, 470, 17) };
        }],
        ["end", "Case closed", (root) => {
            let h = tape(80, -6, "CASE CLOSED", true) + t(20, 220, 16, "HIDER", { f: M }) + t(20, 244, 48, "maelle") + t(20, 330, 16, "FOUND BY", { f: M }) + t(20, 354, 48, "jules") + t(20, 440, 16, "AFTER", { f: M }) + t(20, 464, 48, "23:14");
            h += tape(620, 4, "NEXT HIDER: JULES");
            return { html: h, ink: Ink.underline(20, 310, 170, { seed: "cc1", weight: 5 }) + Ink.circle(90, 492, 90, 36, { seed: "cc2", weight: 5 }) };
        }],
    ]);

    // ======================================================================
    // 12. ALL HAND — no Helvetica anywhere. The unhinged layer IS the app.
    // ======================================================================
    concept("X12", "All Hand", "Against the brief: no typeset text at all. Every word, box and button is drawn. It loses the boring-vs-crazy contrast you liked, but it's the most unhinged thing possible.", [
        ["welcome", "Welcome", (root) => {
            let ink = hw("HIDE", 28, 150, 92, { color: "#000", weight: 12, mess: 0.8 }) + hw("AND", 28, 270, 92, { color: "#000", weight: 12, mess: 0.8 }) + hw("SEEK", 28, 390, 92, { color: "#000", weight: 12, mess: 0.8 });
            ink += Ink.scribbleOut(30, 300, 290, 90, { seed: "ah", weight: 13 }) + hw("STALK", 30, 500, 78, { weight: 13, mess: 0.9, tilt: -6 });
            ink += Ink.box(30, 690, 315, 70, { seed: "ahb", weight: 4, color: "#000" }) + hw("LET ME IN", 100, 740, 30, { color: "#000", weight: 4.5 });
            return { html: "", ink };
        }],
        ["cards", "Three questions", (root) => {
            let ink = hw("QUESTION 2 OF 6", 24, 60, 26, { color: "#000", weight: 4 }) + hw("04:12", 24, 170, 80, { color: "#000", weight: 10 });
            QS.forEach(([q], i) => {
                ink += Ink.box(20, 220 + i * 170, 335, 150, { seed: `ahc${i}`, weight: 3, color: "#000" });
                ink += Ink.note(q.toUpperCase(), { x: 36, y: 262 + i * 170, size: 18, maxWidth: 300, color: "#000", seed: `ahq${i}`, weight: 2.8 }).svg;
            });
            return { html: "", ink: ink + Ink.circle(188, 470, 180, 90, { seed: "ahx", weight: 4.5 }) };
        }],
        ["answer", "Answer", (root) => {
            let ink = hw("FROM JULES:", 24, 80, 22, { color: "#000", weight: 3.6 }) + Ink.note("ARE YOU NORTH OR SOUTH OF ME?", { x: 24, y: 150, size: 36, maxWidth: 320, color: "#000", seed: "ahn", weight: 5.5 }).svg;
            ink += Ink.box(24, 380, 150, 80, { seed: "b1", weight: 3.5, color: "#000" }) + hw("NORTH", 44, 435, 30, { color: "#000", weight: 4.5 }) + Ink.box(200, 380, 150, 80, { seed: "b2", weight: 3.5, color: "#000" }) + hw("SOUTH", 220, 435, 30, { color: "#000", weight: 4.5 });
            ink += Ink.scribbleFill(24, 380, 150, 80, { seed: "ahf", weight: 10 });
            return { html: "", ink };
        }],
    ]);

    // ======================================================================
    // 13. SWISS POSTER — type as architecture, rotated, cropped, huge.
    // ======================================================================
    concept("X13", "Poster Grid", "Swiss poster typography pushed until it breaks: words rotated 90°, numbers cropped off the edge, a strict grid the red scrawl ignores. The welcome screen doubles as the Discord poster.", [
        ["welcome", "Poster", (root) => {
            let h = `<div style="position:absolute;left:-8px;top:812px;transform:rotate(-90deg);transform-origin:0 0;font:700 190px/0.8 ${F};letter-spacing:-0.06em;white-space:nowrap">HIDE</div>`;
            h += t(170, 60, 110, "&", { lh: 0.8 }) + t(170, 190, 86, "SEEK", { lh: 0.8, ls: "-0.05em" });
            h += box(170, 330, 190, 4, "background:#000", "") + t(170, 350, 14, "Campus-wide hide-and-seek. Six questions. One hider. Mon 05.10, 13:00.", { w: 190, wt: 400, lh: 1.35 });
            h += t(170, 470, 150, "05", { lh: 0.8, ls: "-0.07em" }) + t(170, 596, 150, "10", { lh: 0.8, ls: "-0.07em" });
            return { html: h, ink: Ink.scribbleOut(172, 196, 190, 64, { seed: "sw", weight: 11 }) + hw("STALK", 176, 318, 52, { weight: 10, tilt: -10 }) + Ink.circle(250, 590, 90, 120, { seed: "swc", weight: 4 }) };
        }],
        ["cards", "Question 2", (root) => {
            let h = t(-10, 10, 260, "2", { lh: 0.8, ls: "-0.08em" }) + t(160, 40, 14, "OF 6<br>04:12 LEFT", { lh: 1.3 }) + box(160, 90, 200, 4, "background:#000", "");
            QS.forEach(([q], i) => (h += box(0, 300 + i * 160, W, 160, `border-top:${i ? 2 : 6}px solid #000`, t(20, 14, 13, `0${i + 1}`, { f: M }) + t(70, 12, 22, esc(q), { w: 285, lh: 1.08, ls: "-0.02em" }))));
            return { html: h, ink: Ink.arrow(40, 430, 60, 330, { seed: "swa", weight: 4 }) + note("THIS", 20, 470, 20) };
        }],
    ]);

    // ======================================================================
    // 14. LETTERS — every question is a letter; the welcome is an envelope.
    // ======================================================================
    concept("X14", "Letters", "Every question arrives as a typed letter signed by the stalker, and the hider writes the answer across the bottom by hand. Slow, polite and deeply creepy.", [
        ["welcome", "Envelope", (root) => {
            let h = `<div style="position:absolute;inset:0;background:#000"></div>` + box(20, 200, 335, 230, "background:#fff", `<svg width="335" height="230" style="position:absolute;inset:0"><path d="M0 0 L167 130 L335 0" fill="none" stroke="#000" stroke-width="2"/></svg>`);
            h += t(40, 380, 14, "TO: YOU. YES, YOU.", { f: M, wt: 700 });
            const L = lockup(20, 520, 36, {});
            h += L.html.replace(/color:#000/g, "color:#fff") + box(20, 720, W - 40, 60, "border:3px solid #fff", t(0, 17, 21, "OPEN IT", { w: W - 46, align: "center", c: "#fff", ls: ".14em" }));
            const seal = Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2; const r = 30 + (i % 2) * 6; return `${188 + Math.cos(a) * r},${330 + Math.sin(a) * r}`; }).join(" ");
            return { html: h, ink: `<polygon points="${seal}" fill="${R}"/>` + hw("S", 176, 346, 30, { color: "#fff", weight: 6 }) + L.ink };
        }],
        ["answer", "Letter", (root) => {
            let h = t(30, 40, 14, "Pollack, 13:10", { f: M, wt: 500, w: 315, align: "right" });
            h += t(30, 90, 16, "Dear maelle,<br><br>I hope you're comfortable, wherever you are. I have a question for you, and you'll answer it truthfully, won't you?<br><br><b style='font-size:22px;line-height:1.2;display:block'>Are you north or south of me?</b><br>I'll be waiting. I'm always waiting.<br><br>Yours,<br>jules", { f: M, wt: 500, w: 315, lh: 1.5 });
            h += box(30, 620, 315, 2, "background:#000", "") + t(30, 630, 11, "YOUR REPLY", { f: M });
            return { html: h, ink: hw("NORTH.", 40, 700, 48, { weight: 8 }) + hw("— M.", 240, 730, 20, { weight: 3.6, color: "#000" }) };
        }],
    ]);

    // ======================================================================
    // 15. CLOCK FACE — the round as a hand-drawn clock with six wedges.
    // ======================================================================
    concept("X15", "Clock Face", "The 30-minute hunt drawn as a clock: six wedges, one per question, the used ones hatched out, the hand sweeping toward question 7. You read the whole round in one glance.", [
        ["hunt", "Hunt clock", (root) => {
            const cx = 188;
            const cy = 300;
            const r = 150;
            let ink = Ink.circle(cx, cy, r, r, { seed: "cf", weight: 4, color: "#000", turns: 1.02, tilt: 0 });
            let h = "";
            for (let i = 0; i < 6; i++) {
                const a = -Math.PI / 2 + (i / 6) * Math.PI * 2;
                ink += Ink.pathEl([[cx, cy], [cx + Math.cos(a) * r, cy + Math.sin(a) * r]], { size: 2.5, color: "#000", seed: `cfl${i}` });
                const am = a + Math.PI / 6;
                h += t(cx + Math.cos(am) * (r + 26) - 12, cy + Math.sin(am) * (r + 26) - 10, 16, `Q${i + 1}`, { f: M });
            }
            const clip = `<clipPath id="wedge"><path d="M${cx} ${cy} L${cx} ${cy - r} A${r} ${r} 0 0 1 ${cx + Math.cos(Math.PI / 6) * r} ${cy + Math.sin(Math.PI / 6) * r} Z"/></clipPath>`;
            ink += `<defs>${clip}</defs><g clip-path="url(#wedge)">${Ink.scribbleFill(cx - r, cy - r, r * 2, r * 2, { seed: "cfh", weight: 3, gap: 9, angle: -30 })}</g>`;
            const ha = -Math.PI / 2 + (1.72 / 6) * Math.PI * 2;
            ink += Ink.arrow(cx, cy, cx + Math.cos(ha) * (r - 20), cy + Math.sin(ha) * (r - 20), { seed: "cfa", weight: 6, head: 18, bend: 0.02 });
            h += t(20, 510, 64, "04:12", { ls: "-0.04em" }) + t(20, 580, 13, "UNTIL QUESTION 3", { ls: ".1em" });
            return { html: h, ink: ink + note("2 DOWN, 4 TO GO", 190, 520, 20, { maxWidth: 170 }) };
        }],
    ]);

    // ======================================================================
    // 16. FINGERPRINT — press your thumb to begin.
    // ======================================================================
    concept("X16", "Thumbprint", "The welcome screen asks for your thumb. The print is drawn in red, one wobbling ridge at a time, and it doubles as the start button. Pure theatre; the app just logs you in.", [
        ["welcome", "Press to begin", (root) => {
            const L = lockup(24, 70, 50, { stack: true });
            let ink = L.ink;
            for (let i = 0; i < 12; i++) ink += Ink.circle(188, 560, 14 + i * 9, 20 + i * 11, { seed: `fp${i}`, weight: 2.4, turns: 0.82 + (i % 3) * 0.05, tilt: 4 });
            const h = L.html + t(0, 730, 15, "HOLD YOUR THUMB HERE TO JOIN", { w: W, align: "center", ls: ".12em" });
            return { html: h, ink };
        }],
    ]);

    // ======================================================================
    // 17. MAP IS THE APP — no menu, the drawn campus is the interface.
    // ======================================================================
    concept("X17", "Map First", "No menu screen at all: the campus plan fills the phone, the timer is written on it, and the three questions are sticky notes stuck along the bottom. Everything happens on the map.", [
        ["cards", "Map + notes", (root) => {
            const c = campus(375, 560, { pad: 20 });
            let h = box(0, 0, 375, 560, "", c.svg);
            [0, 1, 2].forEach((i) => (h += box(14 + i * 118, 560, 112, 200, `background:#fff;border:3px solid #000;transform:rotate(${[-4, 2, -2][i]}deg)`, t(10, 10, 11, `Q2 · ${QS[i][1].toUpperCase()}`, { f: M }) + t(10, 30, 14, esc(QS[i][0]), { w: 92, lh: 1.15 }))));
            const [hx, hy] = c.P(HIDER);
            return { html: h, ink: hw("04:12", 20, 70, 52, { weight: 9 }) + hw("TILL Q3", 30, 100, 16, { weight: 3 }) + Ink.circle(hx, hy, 26, 22, { seed: "mf", weight: 4 }) + note("PULL ONE", 150, 790, 16) };
        }],
        ["answer", "Hider on the map", (root) => {
            const c = campus(375, 812, { pad: 20, scenario: false });
            let h = box(0, 0, 375, 812, "", c.svg);
            const P = c.P;
            let ink = "";
            const [hx, hy] = P(HIDER);
            for (const [n, lng, lat] of [["JULES", -71.2692303, 46.779163], ["NOAH_B", -71.2768114, 46.7803276], ["CAMILLE", -71.2748, 46.7814]]) {
                const [x, y] = P([lng, lat]);
                ink += Ink.string(hx, hy, x, y, { width: 1.8, sag: 10 }) + Ink.pin(x, y, { size: 7 });
                h += t(x + 10, y - 20, 11, n, { f: M, st: "background:#fff;padding:1px 3px" });
            }
            h += box(hx - 8, hy - 8, 16, 16, "background:#000", "");
            h += box(14, 600, 347, 190, "background:#fff;border:3px solid #000", t(14, 12, 11, "QUESTION 3 · FROM NOAH_B", { f: M }) + t(14, 34, 21, "Which café on campus are you closest to?", { w: 310, lh: 1.15 }) + t(14, 100, 16, "P'tit CAAF (ABP) · 65 m", { wt: 700 }) + t(14, 128, 16, "Snak (VCH) · 190 m", { wt: 400 }));
            return { html: h, ink: ink + Ink.circle(118, 710, 110, 18, { seed: "mfa", weight: 4 }) };
        }],
    ]);

    // ======================================================================
    // 18. TABLOID — the round as tomorrow's front page.
    // ======================================================================
    concept("X18", "Tabloid", "Every round ends as a front page: headline, photo, columns. The welcome screen is the teaser edition. Made to be screenshotted and dropped straight into Discord.", [
        ["welcome", "Front page", (root) => {
            let h = t(16, 20, 12, "MONDAY 5 OCTOBER 2026 · CAMPUS EDITION · FREE", { f: M, w: 343, st: "border-bottom:2px solid #000;padding-bottom:6px" });
            h += t(16, 50, 70, "THE DAILY", { ls: "-0.04em", lh: 0.9 }) + t(16, 116, 70, "STALKER", { ls: "-0.04em", lh: 0.9 }) + box(16, 190, 343, 6, "background:#000", "");
            h += t(16, 210, 34, "CAMPUS HIDER STILL AT LARGE AFTER 6 QUESTIONS", { lh: 1, ls: "-0.02em", w: 343 });
            h += box(16, 346, 343, 220, "border:2px solid #000;overflow:hidden", photo("sky", 339, 216));
            h += t(16, 578, 12, "“She was right there,” says a stalker who asked to be named jules.", { f: "Georgia,serif", wt: 400, w: 343 });
            h += t(16, 610, 13, "Hide-and-seek on the whole Université Laval campus. One hider, six questions, answered truthfully. Mon 13:00.", { wt: 400, w: 165, lh: 1.35 }) + t(194, 610, 13, "A question every five minutes, a map that closes in with every answer. Longest hide wins.", { wt: 400, w: 165, lh: 1.35 });
            h += box(16, 730, 343, 56, "background:#000", t(0, 16, 19, "READ THE FULL STORY", { w: 343, align: "center", c: "#fff", ls: ".1em" }));
            return { html: h, ink: Ink.scribbleOut(20, 128, 300, 56, { seed: "tb", weight: 10 }) + hw("HIDER", 190, 200, 34, { weight: 7, tilt: -8 }) + Ink.circle(188, 456, 60, 70, { seed: "tbc", weight: 4 }) };
        }],
        ["end", "Final edition", (root) => {
            let h = t(16, 20, 12, "LATE EDITION · 13:33", { f: M, w: 343, st: "border-bottom:2px solid #000;padding-bottom:6px" });
            h += t(16, 50, 64, "FOUND.", { ls: "-0.04em" }) + t(16, 130, 26, "Hider maelle caught behind the greenhouses after 23 minutes 14 seconds", { lh: 1.05, w: 343 });
            h += box(16, 250, 343, 240, "border:2px solid #000;overflow:hidden", photo("tree", 339, 236));
            h += t(16, 500, 13, "North of Pollack. Not within 500 m. Nearest café: P'tit CAAF. Closer to the greenhouses. Four questions was all it took, says jules, who made the catch.", { wt: 400, w: 343, lh: 1.4 });
            return { html: h, ink: Ink.circle(90, 88, 90, 38, { seed: "tbe", weight: 5 }) };
        }],
    ]);

    // ======================================================================
    // 19. THE EYE — a single image: the campus as an iris.
    // ======================================================================
    concept("X19", "The Eye", "One image for the poster: a huge drawn eye whose iris is the campus border, the pupil sitting exactly where the hider is. No explanation, just I SEE YOU.", [
        ["welcome", "I see you", (root) => {
            const P = Campus.projector(220, 220, 6);
            const ring = Campus.layers.campus.ring.map(P).map(([x, y]) => [x + 78, y + 230]);
            let ink = Ink.wobble([[10, 340], [100, 210], [188, 180], [276, 210], [365, 340]], { seed: "e1", weight: 5, color: "#000", amp: 3 }) + Ink.wobble([[10, 340], [100, 470], [188, 500], [276, 470], [365, 340]], { seed: "e2", weight: 5, color: "#000", amp: 3 });
            ink += Ink.wobble(ring, { seed: "e3", weight: 4, amp: 2 });
            const [hx, hy] = P(HIDER);
            ink += `<circle cx="${hx + 78}" cy="${hy + 230}" r="14" fill="#000"/>`;
            for (let i = 0; i < 9; i++) ink += Ink.pathEl([[40 + i * 38, 222 - Math.abs(4 - i) * 6], [30 + i * 40, 180 - Math.abs(4 - i) * 10]], { size: 3, color: "#000", seed: `lash${i}` });
            const L = lockup(24, 580, 34);
            return { html: t(0, 90, 42, "I SEE YOU.", { w: W, align: "center", ls: "-0.03em" }) + L.html, ink: ink + L.ink };
        }],
    ]);

    // ======================================================================
    // 20. EVIDENCE BAGS — each answer sealed and labelled.
    // ======================================================================
    const bag = (x, y, w, h, n, label, inner, rot = 0) =>
        box(x, y, w, h, `transform:rotate(${rot}deg);border:3px solid #000;background:#fff`, `<div style="height:16px;border-bottom:3px double #000"></div><div style="margin:10px;border:2px solid #000;padding:6px;font:700 11px ${M}">EVIDENCE Nº ${n}<br>${label}</div>${inner}`);
    concept("X20", "Evidence", "Every answer comes back sealed in an evidence bag with a chain-of-custody label. The history screen is the evidence locker.", [
        ["history", "Evidence locker", (root) => {
            let h = t(20, 30, 26, "EVIDENCE · TEAM 3");
            h += bag(14, 80, 170, 200, 1, "Q1 · 13:10 · JULES", "", -3) + bag(192, 90, 170, 200, 2, "Q2 · 13:15 · JULES", "", 2);
            h += bag(14, 300, 170, 230, 3, "Q3 · 13:20 · NOAH_B", "", 2) + bag(192, 310, 170, 230, 4, "Q5 · 13:26 · CAMILLE", `<div style="margin:0 10px">${photo("door", 140, 120)}</div>`, -2);
            return { html: h, ink: hw("NORTH", 36, 240, 30, { weight: 6 }) + hw("NO", 220, 250, 36, { weight: 6 }) + hw("P'TIT", 30, 450, 30, { weight: 6 }) + hw("CAAF", 40, 490, 30, { weight: 6 }) + note("DOOR. WHICH ONE.", 200, 540, 16) };
        }],
    ]);

    // ======================================================================
    // 21. WANTED — the login screen is a wanted poster you sign.
    // ======================================================================
    concept("X21", "Sign Here", "Logging in is signing a confession. Your username goes on the line in your own handwriting (the app draws it), and the Register button is a thumbprint box.", [
        ["login", "Confession", (root) => {
            let h = t(24, 60, 13, "STATEMENT OF INTENT", { f: M, wt: 700 }) + t(24, 96, 20, "I, the undersigned, agree to hunt the hider across the entire Université Laval campus, to ask only one question every five minutes, and never to open a door.", { w: 327, lh: 1.35, wt: 400 });
            h += box(24, 330, 327, 2, "background:#000", "") + t(24, 338, 11, "USERNAME (SIGNATURE)", { f: M });
            h += box(24, 440, 327, 2, "background:#000", "") + t(24, 448, 11, "PASSWORD (NOBODY WILL SEE THIS)", { f: M });
            h += box(24, 520, 120, 120, "border:3px solid #000", t(0, 128, 11, "THUMB", { f: M }));
            h += box(170, 560, 181, 60, "border:3px solid #000", t(0, 17, 19, "I AGREE", { w: 175, align: "center", ls: ".1em" }));
            let fp = "";
            for (let i = 0; i < 6; i++) fp += Ink.circle(84, 580, 8 + i * 7, 12 + i * 8, { seed: `sp${i}`, weight: 2, turns: 0.85 });
            return { html: h, ink: hw("jules", 34, 320, 44, { weight: 5.5, color: "#000", mess: 0.9 }) + hw("••••••••", 34, 428, 28, { weight: 4, color: "#000" }) + fp + Ink.scribbleFill(170, 560, 181, 60, { seed: "sh", weight: 11 }) };
        }],
    ]);

    // ======================================================================
    // 22. COUNTDOWN POSTER — the welcome screen as the event itself.
    // ======================================================================
    concept("X22", "The Date", "For the Discord post only: the date and time as the whole image, days torn off a calendar pad, one word crossed out. Tells people when to show up and nothing else.", [
        ["welcome", "Calendar", (root) => {
            let h = box(40, 100, 295, 420, "border:3px solid #000;background:#fff", `<div style="height:70px;background:#000;color:#fff;font:700 28px/70px ${F};text-align:center;letter-spacing:.1em">OCTOBER</div>` + t(0, 90, 220, "5", { w: 289, align: "center", ls: "-0.06em" }) + t(0, 330, 24, "MONDAY · 13:00", { w: 289, align: "center", ls: ".08em" }));
            for (let i = 0; i < 4; i++) h += box(40 + i * 3, 90 - i * 8, 295, 10, "border:2px solid #000;border-bottom:none;background:#fff", "");
            const L = lockup(24, 580, 34);
            return { html: h + L.html, ink: L.ink + hw("DON'T BE LATE", 150, 90, 20, { tilt: 8 }) + Ink.circle(188, 290, 90, 120, { seed: "dt", weight: 5 }) };
        }],
    ]);

    // ======================================================================
    // 23. TWO SCREENS — the phone split: what the stalker sees vs the hider.
    // ======================================================================
    concept("X23", "Split", "One screen, cut in half: top is what the stalkers know, bottom is where the hider actually is. Only for the promo: the one image that explains the whole game.", [
        ["welcome", "Both sides", (root) => {
            const top = campus(375, 380, { pad: 14 });
            const bot = campus(375, 380, { pad: 14, scenario: false });
            let h = box(0, 0, 375, 380, "", top.svg) + box(0, 406, 375, 380, "background:#000", bot.svg);
            h += box(0, 380, 375, 26, "background:#000", t(12, 5, 13, "WHAT THEY KNOW ↑ · WHERE SHE IS ↓", { f: M, c: "#fff" }));
            const [hx, hy] = bot.P(HIDER);
            return { html: h, ink: Ink.circle(hx, hy + 406, 20, 18, { seed: "sp", weight: 5 }) + Ink.cross(hx, hy + 406, 7, { seed: "spx", weight: 3.5 }) + hw("HIDE AND STALK", 20, 60, 24, { weight: 4.5, color: "#000" }) + note("4 ANSWERS AWAY", 190, 760, 18) };
        }],
    ]);

    // ======================================================================
    // 24. RANSOM — every letter cut from a different magazine.
    // ======================================================================
    const CUTS = [
        ["#000", "#fff", F, 700], ["#fff", "#000", "Georgia,serif", 700], ["#fff", "#000", M, 700], ["#000", "#fff", "Georgia,serif", 400],
        ["#fff", "#000", F, 400], ["#fff", R, F, 700], ["#fff", "#000", "'Courier New',monospace", 700],
    ];
    function ransom(txt, x, y, size, seed) {
        const r = Ink.rng(seed);
        let out = "";
        let cx = x;
        for (const ch of txt) {
            if (ch === " ") { cx += size * 0.4; continue; }
            const [bg, fg, font, wt] = r.pick(CUTS);
            const s2 = size * r.range(0.8, 1.2);
            const w = mw(ch, s2, font, wt) + 8;
            out += `<div style="position:absolute;left:${cx}px;top:${y + r.range(-6, 6)}px;padding:2px 4px;background:${bg};color:${fg};border:${bg === "#fff" ? "2px solid #000" : "2px solid #000"};font:${wt} ${s2}px/1 ${font};transform:rotate(${r.range(-8, 8)}deg)">${esc(ch)}</div>`;
            cx += w + r.range(0, 4);
        }
        return out;
    }
    concept("X24", "Ransom", "Every word is cut out of a different magazine, the way a ransom note is. Throws out the Helvetica rule completely. Loud, funny, impossible to scroll past.", [
        ["welcome", "The note", (root) => {
            let h = ransom("HIDE", 24, 90, 62, "r1") + ransom("AND", 24, 190, 62, "r2") + ransom("SEEK", 24, 290, 62, "r3") + ransom("STALK", 60, 400, 70, "r4");
            h += ransom("MON 13:00", 24, 560, 30, "r5") + ransom("CAMPUS", 170, 620, 30, "r6");
            h += box(20, 720, W - 40, 60, "border:3px solid #000", t(0, 17, 21, "WE HAVE YOUR ATTENTION", { w: W - 46, align: "center", ls: ".06em" }));
            return { html: h, ink: Ink.scribbleOut(20, 290, 290, 70, { seed: "rn", weight: 13 }) };
        }],
        ["answer", "Question as a note", (root) => {
            let h = t(24, 40, 12, "QUESTION 1 · FROM JULES", { f: M, wt: 700 });
            h += ransom("NORTH", 24, 110, 50, "r7") + ransom("OR", 24, 190, 50, "r8") + ransom("SOUTH", 24, 270, 50, "r9") + ransom("OF ME?", 24, 350, 50, "r10");
            h += box(20, 560, 160, 70, "border:3px solid #000", t(0, 20, 24, "NORTH", { w: 154, align: "center" })) + box(195, 560, 160, 70, "border:3px solid #000", t(0, 20, 24, "SOUTH", { w: 154, align: "center" }));
            return { html: h, ink: Ink.circle(100, 595, 92, 44, { seed: "rq", weight: 5 }) + note("ANSWER TRUTHFULLY. OR ELSE.", 30, 690, 20, { maxWidth: 320 }) };
        }],
    ]);

    // ======================================================================
    // 25. WALKIE — one giant push-to-talk button runs the whole hunt.
    // ======================================================================
    concept("X25", "Walkie", "The app as a walkie-talkie: a speaker grille, a channel number (your team), and one huge button that sends the question. Built for thumbs and running.", [
        ["cards", "Channel 3", (root) => {
            let h = `<div style="position:absolute;inset:0;background:#000"></div>` + box(40, 40, 295, 150, "border:3px solid #fff;background:repeating-radial-gradient(circle at 50% 50%,#fff 0 2px,#000 2px 7px)", "");
            h += box(40, 210, 295, 110, "background:#fff", t(14, 10, 12, "CH 03 · Q2 OF 6", { f: M }) + t(14, 30, 58, "04:12", { f: M, ls: "-0.04em" }));
            h += t(40, 340, 14, "QUEUED:", { f: M, c: "#fff" }) + t(40, 362, 20, "Are you within 500 m of me?", { c: "#fff", w: 295, lh: 1.2 });
            h += t(40, 420, 12, "◀ SWIPE FOR THE OTHER TWO ▶", { f: M, c: "#fff" });
            h += box(62, 470, 250, 250, "border-radius:50%;border:4px solid #fff", t(0, 104, 22, "HOLD TO ASK", { w: 242, align: "center", c: "#fff", ls: ".12em" }));
            return { html: h, ink: Ink.scribbleFill(80, 488, 214, 214, { seed: "wk", weight: 12, gap: 13, misses: 0.05 }).replace(/<path/g, '<path opacity="1"') + note("PUSH", 250, 760, 22) };
        }],
    ]);

    // Flatten: one entry per screen.
    const LIST = [];
    for (const c of C) for (const [key, label, fn] of c.screens) LIST.push({ code: c.code, name: c.name, pitch: c.pitch, key, label, fn });

    window.Wild = {
        list: LIST.map(({ code, name, pitch, key, label }) => ({ code, name, pitch, key, label })),
        draw(root, v) {
            const s = LIST[v - 1];
            root.style.background = "#fff";
            const { html, ink } = s.fn(root);
            root.innerHTML = html;
            const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            svg.setAttribute("width", W);
            svg.setAttribute("height", H);
            svg.style.cssText = "position:absolute;left:0;top:0;overflow:visible;pointer-events:none;z-index:90";
            svg.innerHTML = ink;
            root.appendChild(svg);
        },
    };
})();
