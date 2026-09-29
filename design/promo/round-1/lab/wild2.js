/* global Ink, Campus, turf, WildKit */

// Set X, second batch: borrowed interfaces and borrowed objects. Each one
// takes something everybody already knows how to read (a lock screen, a
// CAPTCHA, a departures board, a dating app) and makes it the game.

(function () {
    const { t, box, hw, note, lockup, campus, photo, mw, concept, QS, HIDER, F, M, R, W, esc } = WildKit;
    const black = `<div style="position:absolute;inset:0;background:#000"></div>`;
    const btn = (y, label, dark = false) => box(20, y, W - 40, 60, `border:3px solid ${dark ? "#fff" : "#000"}`, t(0, 17, 21, label, { w: W - 46, align: "center", c: dark ? "#fff" : "#000", ls: ".08em" }));

    // Real numbers for the greenhouses game, used across several concepts.
    const SC = Campus.scenario("greenhouses");
    const fullArea = turf.area(turf.polygon([Campus.layers.campus.ring]));
    const leftPct = Math.round((turf.area(SC.region) / fullArea) * 100);
    const stepsPct = (() => {
        // Area left after each answer, folded one at a time.
        const out = [100];
        let region = turf.polygon([Campus.layers.campus.ring]);
        for (const a of SC.answered) {
            const keep = !(a.radius && a.answer === "NO") && !(a.closer && a.answer === "NO");
            const next = keep ? turf.intersect(turf.featureCollection([region, a.shape])) : turf.difference(turf.featureCollection([region, a.shape]));
            if (next) region = next;
            out.push(Math.round((turf.area(region) / fullArea) * 100));
        }
        return out;
    })();

    // ======================================================================
    // 26. LOCK SCREEN — the game lives in your notifications.
    // ======================================================================
    const notif = (y, app, time, title, body) => box(10, y, W - 20, 0, "height:auto;background:#fff;border-radius:20px;padding:12px 14px;border:2px solid #000", `<div style="display:flex;gap:8px;align-items:center;font:700 12px ${F}"><span style="width:20px;height:20px;border:2px solid #000;border-radius:6px;display:inline-block"></span>${app}<span style="margin-left:auto;font-weight:400">${time}</span></div><div style="font:700 16px/1.25 ${F};margin-top:6px">${title}</div><div style="font:400 15px/1.3 ${F}">${body}</div>`);
    concept("X26", "Lock Screen", "The game reaches you through notifications. The most native screenshot possible: an iPhone lock screen, the time huge, a question stacked in the notifications, the red scrawl on top.", [
        ["hider", "Hider's lock screen", () => {
            let h = black + t(0, 90, 16, "Monday 5 October", { w: W, align: "center", c: "#fff", wt: 400 }) + t(0, 110, 96, "13:25", { w: W, align: "center", c: "#fff", ls: "-0.03em" });
            h += notif(420, "HIDE AND STALK", "now", "New question from noah_b", "Are you closer to the greenhouses than I am?");
            h += notif(540, "HIDE AND STALK", "5 min ago", "Question 3 answered", "You said: P'tit CAAF (ABP)");
            h += notif(650, "Discord", "9 min ago", "Team 3 · voice", "jules: she's north, 100%");
            return { html: h, ink: Ink.circle(188, 470, 170, 60, { seed: "ls", weight: 4 }) + note("DON'T PICK UP", 190, 400, 18) };
        }],
        ["stalker", "Stalker's lock screen", () => {
            let h = black + t(0, 90, 16, "Monday 5 October", { w: W, align: "center", c: "#fff", wt: 400 }) + t(0, 110, 96, "13:20", { w: W, align: "center", c: "#fff", ls: "-0.03em" });
            h += notif(440, "HIDE AND STALK", "now", "maelle answered", "Which café on campus are you closest to? — P'tit CAAF (ABP)");
            h += notif(570, "HIDE AND STALK", "5 min ago", "Question 3 of 6", "Pick one: 3 new questions");
            return { html: h, ink: Ink.underline(24, 546, 180, { seed: "lsu", weight: 5 }) + note("GO GO GO", 220, 540, 22) };
        }],
        ["welcome", "Wallpaper", () => {
            const L = lockup(24, 300, 66, { stack: true, color: "#fff" });
            let h = black + t(0, 90, 16, "Monday 5 October", { w: W, align: "center", c: "#fff", wt: 400 }) + t(0, 110, 96, "12:59", { w: W, align: "center", c: "#fff", ls: "-0.03em" }) + L.html.replace(/color:#000/g, "color:#fff");
            h += t(0, 760, 13, "swipe up to hide", { w: W, align: "center", c: "#fff", wt: 400 });
            return { html: h, ink: L.ink };
        }],
    ]);

    // ======================================================================
    // 27. CAPTCHA — prove you're not the hider.
    // ======================================================================
    const captchaHead = (title, sub) => box(12, 70, W - 24, 110, "background:#000", t(16, 14, 14, sub, { c: "#fff", wt: 400 }) + t(16, 36, 30, title, { c: "#fff", ls: "-0.02em" }));
    concept("X27", "CAPTCHA", "Logging in is a CAPTCHA: “select all squares with the hider”. The map screen is the same grid laid over the real campus, and you tick the squares she can still be in.", [
        ["login", "I'm not a hider", () => {
            let h = captchaHead("the hider", "Select all images with");
            const kinds = ["door", "tree", "bench", "sky", "figure", "door", "bench", "tree", "sky"];
            kinds.forEach((k, i) => (h += box(12 + (i % 3) * 118, 190 + Math.floor(i / 3) * 118, 114, 114, "border:2px solid #000;overflow:hidden", photo(k, 110))));
            h += box(12, 560, W - 24, 70, "border:2px solid #000", box(16, 20, 28, 28, "border:3px solid #000", "") + t(58, 22, 18, "I'm not the hider", { wt: 400 }) + t(250, 14, 10, "reCAPTCHA-ish<br>Privacy · Terms", { f: M, wt: 400, lh: 1.4 }));
            h += btn(700, "VERIFY");
            return { html: h, ink: Ink.check(28, 594, 28, { seed: "cap", weight: 5 }) + Ink.circle(306, 422, 50, 50, { seed: "capc", weight: 4 }) + note("OBVIOUSLY", 250, 510, 16) };
        }],
        ["map", "Select the squares", () => {
            const c = campus(351, 351, { pad: 6 });
            let h = captchaHead("where she can still be", "Select all squares showing");
            h += box(12, 190, 351, 351, "border:2px solid #000", c.svg);
            let grid = "";
            for (let i = 1; i < 4; i++) grid += box(12 + i * 87.75, 190, 2, 351, "background:#fff", "") + box(12, 190 + i * 87.75, 351, 2, "background:#fff", "");
            h += grid + btn(700, "SKIP", false);
            const [hx, hy] = c.P(HIDER);
            const cx = Math.floor(hx / 87.75);
            const cy = Math.floor(hy / 87.75);
            return { html: h, ink: Ink.check(12 + cx * 87.75 + 30, 190 + cy * 87.75 + 30, 30, { seed: "cps", weight: 6 }) + Ink.box(12 + cx * 87.75 + 4, 190 + cy * 87.75 + 4, 80, 80, { seed: "cpb", weight: 4 }) + note(`${leftPct}% OF CAMPUS LEFT`, 30, 600, 20, { maxWidth: 300 }) };
        }],
    ]);

    // ======================================================================
    // 28. SWIPE — a dating app for questions.
    // ======================================================================
    concept("X28", "Swipe", "The three questions are a dating-app stack: swipe right on the one you want to ask, left burns it. The ending is “It's a match”. Ridiculous, which is the point.", [
        ["cards", "The stack", () => {
            let h = t(0, 30, 18, "hide & stalk", { w: W, align: "center", ls: "-0.02em" });
            h += box(34, 110, 307, 460, "border:3px solid #000;border-radius:18px;background:#fff;transform:rotate(4deg)", "") + box(28, 100, 319, 470, "border:3px solid #000;border-radius:18px;background:#fff;transform:rotate(-3deg)", "");
            h += box(20, 90, 335, 480, "border:3px solid #000;border-radius:18px;background:#fff;overflow:hidden", photo("sky", 335, 280) + t(20, 296, 12, "DISTANCE · 500 M AWAY", { f: M }) + t(20, 318, 26, "Are you within 500 m of me?", { w: 290, lh: 1.1 }) + t(20, 408, 14, "Loves: circles. Dislikes: vague answers. Looking for: a yes or a no.", { w: 290, wt: 400, lh: 1.35 }));
            h += box(70, 620, 90, 90, "border:3px solid #000;border-radius:50%", t(0, 26, 34, "✕", { w: 84, align: "center", wt: 400 })) + box(215, 620, 90, 90, "border:3px solid #000;border-radius:50%", "");
            return { html: h, ink: Ink.scribbleFill(222, 628, 76, 76, { seed: "sw", weight: 10 }) + hw("ASK", 232, 678, 24, { color: "#000", weight: 4.5 }) + note("SWIPE RIGHT = SEND", 170, 760, 16) };
        }],
        ["end", "It's a match", () => {
            let h = black + t(0, 150, 54, "It's a", { w: W, align: "center", c: "#fff", wt: 400 }) + t(0, 210, 90, "match.", { w: W, align: "center", c: "#fff", ls: "-0.04em" });
            h += box(40, 360, 140, 140, "border:3px solid #fff;border-radius:50%;overflow:hidden", photo("figure", 134)) + box(195, 360, 140, 140, "border:3px solid #fff;border-radius:50%;overflow:hidden", photo("figure", 134));
            h += t(0, 530, 17, "You and maelle found each other after 23:14.", { w: W, align: "center", c: "#fff", wt: 400 }) + btn(700, "PLAY AGAIN", true);
            return { html: h, ink: Ink.string(180, 430, 195, 430, { width: 3 }) + note("FINALLY", 130, 640, 26) };
        }],
    ]);

    // ======================================================================
    // 29. BUBBLE SHEET — the hider answers on an exam scantron.
    // ======================================================================
    const bubble = (x, y, filled) => box(x, y, 26, 26, "border:2px solid #000;border-radius:50%", "");
    concept("X29", "Bubble Sheet", "The hider answers on a machine-read exam sheet, filling the bubble with a red marker, badly. The history is the whole answer grid. Everyone on campus knows this form.", [
        ["answer", "Answer sheet", () => {
            let h = t(20, 30, 12, "HIDE AND STALK · ANSWER SHEET · USE RED MARKER ONLY", { f: M, wt: 700, w: 335 }) + box(20, 54, 335, 3, "background:#000", "");
            const rows = [["1", "North or south of me?", ["N", "S"], 0], ["2", "Within 500 m of me?", ["Y", "N"], 1], ["3", "Closest café?", ["A", "B", "C", "D"], 0], ["4", "Closer to the greenhouses?", ["Y", "N"], 0], ["5", "Which building are you closest to?", ["A", "B", "C", "D"], -1], ["6", "—", ["A", "B", "C", "D"], -2]];
            let ink = "";
            rows.forEach(([n, q, opts, pick], i) => {
                const y = 80 + i * 108;
                h += t(20, y, 22, n) + t(52, y + 4, 15, q, { w: 290, wt: 400 });
                opts.forEach((o, j) => {
                    h += bubble(52 + j * 56, y + 34, false) + t(52 + j * 56, y + 38, 12, o, { w: 26, align: "center", f: M });
                    if (j === pick) ink += Ink.scribbleFill(54 + j * 56, y + 36, 22, 22, { seed: `bs${i}`, weight: 7, gap: 5, overshoot: 4 });
                });
                if (pick === -1) ink += note("← NOW", 52 + opts.length * 56, y + 50, 16);
            });
            return { html: h, ink };
        }],
    ]);

    // ======================================================================
    // 30. DEPARTURES — the round as a split-flap board.
    // ======================================================================
    const flap = (x, y, txt, n, size = 18) => {
        let out = "";
        const s = txt.padEnd(n).slice(0, n);
        for (let i = 0; i < n; i++) out += box(x + i * (size * 0.78), y, size * 0.72, size * 1.3, "background:#fff;border-radius:2px", `<div style="position:absolute;left:0;right:0;top:50%;height:1px;background:#000"></div>` + t(0, size * 0.12, size, s[i] === " " ? "&nbsp;" : esc(s[i]), { w: size * 0.72, align: "center", f: M }));
        return out;
    };
    concept("X30", "Departures", "The whole round on one split-flap board, like a train station: each question is a departure, its answer the platform. Question 5 is boarding. Legible from across a quad.", [
        ["board", "Board", () => {
            let h = black + t(16, 30, 14, "DEPARTURES · TEAM 3", { f: M, c: "#fff" }) + t(260, 30, 14, "13:25:40", { f: M, c: "#fff" });
            const rows = [["13:10", "Q1 N/S", "NORTH"], ["13:15", "Q2 500M", "NO"], ["13:20", "Q3 CAFE", "PTIT CAAF"], ["13:25", "Q4 GRNHS", "YES"], ["13:30", "Q5", "BOARDING"], ["13:35", "Q6", "SCHEDULED"], ["13:40", "Q7", "CANCELLED"]];
            rows.forEach(([a, b, c], i) => {
                const y = 80 + i * 70;
                h += flap(10, y, a, 5, 14) + flap(72, y, b, 8, 14) + flap(170, y, c, 9, 20);
            });
            h += t(16, 600, 14, "Q7 NEVER DEPARTS: THE HIDER WINS WHEN THE BOARD RUNS OUT.", { f: M, c: "#fff", w: 340, lh: 1.4 });
            return { html: h, ink: Ink.circle(260, 377, 100, 26, { seed: "dp", weight: 4 }) + Ink.strike(166, 500, 205, 30, { seed: "dps", weight: 4 }) };
        }],
    ]);

    // ======================================================================
    // 31. MERCURY — how much campus is left, as a thermometer.
    // ======================================================================
    concept("X31", "Mercury", `The only number that matters: how much of campus she can still be in. A thermometer that drops with every answer, coloured in by hand. From the real game: ${stepsPct.join("% → ")}%.`, [
        ["hunt", "Area left", () => {
            let h = t(20, 40, 12, "WHERE SHE CAN STILL BE", { f: M, wt: 700 });
            const top = 110;
            const hgt = 540;
            h += box(60, top, 64, hgt, "border:3px solid #000;border-radius:32px", "") + box(40, top + hgt - 20, 104, 104, "border:3px solid #000;border-radius:50%;background:#fff", "");
            stepsPct.forEach((p, i) => {
                const y = top + hgt - (hgt * p) / 100;
                h += box(128, y, 20, 2, "background:#000", "") + t(154, y - 10, 15, `${p}%`, { f: M }) + t(210, y - 9, 12, i === 0 ? "start" : `after Q${i}`, { f: M, wt: 400 });
            });
            const lvl = top + hgt - (hgt * leftPct) / 100;
            const ink = Ink.scribbleFill(66, lvl, 52, top + hgt - lvl, { seed: "mc", weight: 9, gap: 7 }) + Ink.scribbleFill(48, top + hgt - 12, 88, 88, { seed: "mcb", weight: 11, gap: 8 });
            h += t(20, 720, 60, `${leftPct}%`, { ls: "-0.04em" });
            return { html: h, ink: ink + note("COLDER. SHE'S RUNNING OUT OF CAMPUS", 170, 740, 16, { maxWidth: 190 }) };
        }],
    ]);

    // ======================================================================
    // 32. METRO — the round drawn as a transit line.
    // ======================================================================
    concept("X32", "Line 3", "The round as a metro line: every question is a station, the answer is the station's name, the train is where you are now. The end of the line is question 7, where the hider wins.", [
        ["line", "The line", () => {
            let h = t(20, 36, 44, "LINE 3", { ls: "-0.03em" }) + t(20, 90, 13, "HUNT DIRECTION → FOUND", { f: M });
            const stops = [["Q1", "North of Pollack"], ["Q2", "Not within 500 m"], ["Q3", "P'tit CAAF"], ["Q4", "Greenhouses side"], ["Q5", "Nearest door?"], ["Q6", "Exact coordinates?"], ["Q7", "Hider wins"]];
            const pts = stops.map((_, i) => [70 + (i % 2) * 30, 160 + i * 88]);
            let ink = Ink.wobble(pts, { seed: "mt", weight: 9, amp: 2 });
            stops.forEach(([q, n], i) => {
                const [x, y] = pts[i];
                h += box(x - 13, y - 13, 26, 26, `border:4px solid #000;border-radius:50%;background:${i <= 3 ? "#000" : "#fff"}`, "") + t(x + 30, y - 22, 12, q, { f: M }) + t(x + 30, y - 6, 19, esc(n), { w: 240, wt: i <= 3 ? 700 : 400 });
            });
            ink += note("YOU ARE HERE", 150, pts[4][1] + 30, 18) + Ink.arrow(146, pts[4][1] + 14, 104, pts[4][1] - 2, { seed: "mta" });
            return { html: h, ink };
        }],
    ]);

    // ======================================================================
    // 33. BOARD GAME — a track, a pawn, a spinner.
    // ======================================================================
    concept("X33", "Board Game", "The round as a board game: six squares around the track, a pawn on the current question, and a spinner instead of three cards. Kids' game graphics for a stalker game.", [
        ["hunt", "The track", () => {
            let h = "";
            const sq = [[20, 100], [140, 100], [260, 100], [260, 240], [260, 380], [140, 380], [20, 380], [20, 240]];
            const lbl = ["START", "Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "HIDER WINS"];
            sq.forEach(([x, y], i) => (h += box(x, y, 100, 100, `border:3px solid #000;background:${i === 7 ? "#000" : "#fff"}`, t(8, 8, i === 7 ? 13 : 20, lbl[i], { c: i === 7 ? "#fff" : "#000", w: 84 }))));
            h += box(150, 220, 80, 80, "border:3px solid #000;border-radius:50%", "");
            h += t(20, 520, 22, "Spin for your question", {}) + t(20, 552, 15, "Land on a colour-in segment and that's what you ask. 04:12 until your next turn.", { w: 330, wt: 400, lh: 1.35 });
            return { html: h, ink: Ink.arrow(190, 260, 218, 232, { seed: "spn", weight: 4, head: 10 }) + `<circle cx="310" cy="300" r="16" fill="#000"/>` + Ink.scribbleFill(262, 382, 96, 96, { seed: "bgq4", weight: 8, gap: 12 }) + note("HERE", 300, 510, 18) };
        }],
    ]);

    // ======================================================================
    // 34. LOADING — the app pretends to locate her.
    // ======================================================================
    concept("X34", "Locating", "Between questions, the app plays a fake terminal: triangulating, cross-referencing, 62%. It's theatre (the real work is the answers), but it makes waiting feel like closing in.", [
        ["hunt", "Triangulating", () => {
            let h = black + t(16, 40, 13, "HIDE AND STALK v1.0 · TEAM 3", { f: M, c: "#fff" });
            const lines = ["> loading campus border ........ ok", "> 25 pavilions, 12 cafés, 23 stops", "> applying Q1  NORTH ........... ok", "> applying Q2  NOT 500 M ....... ok", "> applying Q3  P'TIT CAAF ...... ok", "> applying Q4  CLOSER GREENH. .. ok", `> area left ................... ${leftPct}%`, "> waiting for question 5 _"];
            lines.forEach((l, i) => (h += t(16, 90 + i * 26, 13, esc(l), { f: M, c: "#fff", wt: 500 })));
            h += t(16, 380, 60, "LOCATING", { c: "#fff", ls: "-0.03em" }) + t(16, 446, 60, "HIDER…", { c: "#fff", ls: "-0.03em" });
            h += box(16, 560, 343, 40, "border:3px solid #fff", "") + t(16, 612, 13, "04:12 UNTIL MORE DATA", { f: M, c: "#fff" });
            return { html: h, ink: Ink.scribbleFill(19, 563, 337 * (1 - leftPct / 100), 34, { seed: "ld", weight: 9, gap: 7 }) + note(`${100 - leftPct}% RULED OUT`, 200, 660, 18) };
        }],
    ]);

    // ======================================================================
    // 35. FORECAST — the weather report for being found.
    // ======================================================================
    concept("X35", "Forecast", "A weather app for the hider: “chance of being found: 81%”, an hourly strip of questions, conditions “stalkers approaching from the east”. Big numbers, deadpan tone.", [
        ["hider", "Today", () => {
            let h = t(0, 60, 18, "Behind the greenhouses", { w: W, align: "center", wt: 400 }) + t(0, 90, 120, "81%", { w: W, align: "center", ls: "-0.06em" }) + t(0, 230, 18, "chance of being found", { w: W, align: "center", wt: 400 }) + t(0, 258, 15, "Stalkers approaching from the east. Clearing by 13:40.", { w: W, align: "center" });
            h += box(16, 320, 343, 150, "border:3px solid #000", "");
            ["13:25", "13:30", "13:35", "13:40"].forEach((tm, i) => (h += t(30 + i * 82, 334, 13, tm, { f: M }) + t(30 + i * 82, 420, 17, ["Q4", "Q5", "Q6", "WIN"][i])));
            h += box(16, 490, 343, 180, "border:3px solid #000", t(14, 12, 12, "CLOSEST STALKER", { f: M }) + t(14, 36, 54, "96 m") + t(14, 110, 14, "camille · walking · 1.4 m/s", { f: M, wt: 400 }));
            let ink = "";
            [0, 1, 2].forEach((i) => (ink += Ink.circle(56 + i * 82, 390, 16, 16, { seed: `fc${i}`, weight: 3, color: "#000" })));
            ink += hw("☂", 294, 402, 26, { weight: 4 });
            return { html: h, ink: ink + Ink.pathEl([[270, 390], [290, 372], [310, 392], [330, 374]], { size: 4, color: R }) + note("BRING AN UMBRELLA", 170, 720, 18) };
        }],
    ]);

    // ======================================================================
    // 36. BINGO — campus bingo; the pavilions are the squares.
    // ======================================================================
    concept("X36", "Bingo", "A 5 × 5 campus bingo card of pavilion codes. Every answer marks off the buildings she can't be in; the last square standing is where you run.", [
        ["card", "Card", () => {
            const places = Campus.layers.building.places;
            const inside = (p) => turf.booleanPointInPolygon(turf.point([p.lng, p.lat]), SC.region);
            let h = t(20, 40, 64, "B I N G O", { ls: ".08em" });
            let ink = "";
            places.slice(0, 25).forEach((p, i) => {
                const x = 20 + (i % 5) * 67;
                const y = 140 + Math.floor(i / 5) * 67;
                const code = (p.label.match(/\(([A-Z]+)\)/) ?? [, "?"])[1];
                h += box(x, y, 67, 67, "border:2px solid #000", t(0, 22, 18, code, { w: 63, align: "center", f: M }));
                ink += inside(p) ? Ink.circle(x + 33, y + 33, 28, 26, { seed: `bg${i}`, weight: 4 }) : Ink.cross(x + 33, y + 33, 22, { seed: `bx${i}`, weight: 4 });
            });
            h += t(20, 500, 15, "Every answer crosses off the pavilions she can't be near. Circled: still possible.", { w: 335, wt: 400, lh: 1.35 });
            return { html: h, ink: ink + note("RUN TO THE CIRCLES", 150, 600, 22, { maxWidth: 220 }) };
        }],
    ]);

    // ======================================================================
    // 37. PASSPORT — each question a stamp.
    // ======================================================================
    concept("X37", "Passport", "The history is a passport page: every question gets a stamp with its time and answer, stamped at a crooked angle in red. The welcome screen is the cover.", [
        ["history", "Stamps", () => {
            let h = t(20, 30, 12, "VISAS · HUNT OF 5 OCT", { f: M, wt: 700 }) + box(20, 50, 335, 2, "background:#000", "");
            let ink = "";
            const stamps = [["Q1 · 13:10", "NORTH", 90, 150, -12], ["Q2 · 13:15", "NO", 270, 170, 9], ["Q3 · 13:20", "P'TIT CAAF", 110, 360, 6], ["Q4 · 13:25", "YES", 270, 390, -8]];
            for (const [a, b, x, y, rot] of stamps) {
                ink += Ink.circle(x, y, 76, 60, { seed: `ps${a}`, weight: 4, tilt: rot, turns: 1.05 }) + Ink.circle(x, y, 66, 50, { seed: `pt${a}`, weight: 2, tilt: rot, turns: 1.02 });
                ink += hw(b, x - 50, y + 10, b.length > 5 ? 17 : 26, { tilt: rot, weight: 4 }) + hw(a, x - 44, y - 22, 11, { tilt: rot, weight: 2.2 });
            }
            h += box(20, 520, 335, 180, "border:2px dashed #000", t(0, 76, 14, "Q5 · stamp pending", { w: 335, align: "center", f: M }));
            return { html: h, ink };
        }],
        ["welcome", "Cover", () => {
            let h = black + box(40, 90, 295, 560, "border:3px solid #fff", t(0, 60, 16, "CLUB D'IA · UNIVERSITÉ LAVAL", { w: 295, align: "center", c: "#fff", ls: ".1em" }) + t(0, 440, 30, "PASSPORT", { w: 295, align: "center", c: "#fff", ls: ".3em" }));
            const L = lockup(70, 180, 44, { stack: true });
            h += L.html.replace(/color:#000/g, "color:#fff");
            return { html: h, ink: L.ink };
        }],
    ]);

    // ======================================================================
    // 38. ROAD SIGN — the poster is a warning sign.
    // ======================================================================
    concept("X38", "Road Sign", "The poster is a diamond warning sign: HIDER CROSSING, the silhouette mid-stride. Works as a sticker, a Discord avatar, a thumbnail at any size.", [
        ["welcome", "Hider crossing", () => {
            let h = box(62, 90, 250, 250, "border:6px solid #000;transform:rotate(45deg);background:#fff", "");
            h += t(0, 440, 38, "HIDER CROSSING", { w: W, align: "center", ls: "-0.02em" }) + t(0, 490, 16, "NEXT 1.8 KM · MON 5 OCT · 13:00", { w: W, align: "center", f: M });
            const L = lockup(24, 580, 30);
            const fig = [[188, 170], [188, 240], [170, 290], [188, 240], [210, 285], [188, 200], [166, 225], [188, 200], [212, 222]];
            return { html: h + L.html, ink: `<circle cx="188" cy="152" r="14" fill="#000"/>` + Ink.pathEl(fig, { size: 9, color: "#000" }) + L.ink + Ink.cross(260, 150, 16, { seed: "rs", weight: 5 }) };
        }],
    ]);

    // ======================================================================
    // 39. NAME TAG — HELLO my name is STALKER.
    // ======================================================================
    concept("X39", "Name Tag", "The role reveal as a sticky name tag: HELLO my name is, and your role written in with a marker. The red band is coloured in, of course.", [
        ["role", "Role reveal", () => {
            let h = box(20, 180, 335, 330, "border:3px solid #000;border-radius:18px;overflow:hidden", t(0, 20, 52, "HELLO", { w: 335, align: "center", ls: ".02em" }) + t(0, 84, 18, "my name is", { w: 335, align: "center", wt: 400 }));
            h += t(20, 540, 15, "Team 3 · 5 stalkers hunting maelle. The hunt starts when her 10 minutes run out.", { w: 335, wt: 400, lh: 1.35 }) + btn(700, "GOT IT");
            return { html: h, ink: Ink.scribbleFill(20, 180, 335, 118, { seed: "nt", weight: 12, gap: 10 }) + hw("STALKER", 36, 440, 50, { color: "#000", weight: 8, tilt: -4, maxWidth: 300 }) };
        }],
    ]);

    // ======================================================================
    // 40. TICKET — getting found is a parking ticket.
    // ======================================================================
    concept("X40", "Violation", "Getting found is a parking ticket slipped under your wiper: violation code, officer, time, fine. The hider's losing screen, made funny instead of sad.", [
        ["end", "Notice", () => {
            let h = box(30, 60, 315, 640, "border:3px solid #000", t(20, 20, 13, "UNIVERSITÉ LAVAL · CAMPUS ENFORCEMENT", { f: M, wt: 700, w: 275 }) + t(20, 60, 44, "NOTICE OF", { ls: "-0.03em" }) + t(20, 106, 44, "VIOLATION", { ls: "-0.03em" }));
            const rows = [["CODE", "H-07 · FOUND"], ["LOCATION", "BEHIND THE GREENHOUSES"], ["TIME", "13:32:14"], ["OFFICER", "JULES"], ["HIDE TIME", "23:14"], ["FINE", "HIDE AGAIN NEXT ROUND"]];
            rows.forEach(([a, b], i) => (h += t(50, 250 + i * 56, 11, a, { f: M }) + t(50, 266 + i * 56, 18, b, { w: 280 })));
            return { html: h, ink: hw("jules", 200, 480, 34, { color: "#000", weight: 4.5, mess: 0.9 }) + Ink.box(190, 180, 140, 54, { seed: "vt", weight: 4 }) + hw("GUILTY", 200, 220, 30, { tilt: -8 }) };
        }],
    ]);

    // ======================================================================
    // 41. CREDITS — the round ends like a film.
    // ======================================================================
    concept("X41", "Credits", "Each round ends with film credits: the hider starring, the stalkers as supporting cast, every question credited. The welcome screen is the title card of the film.", [
        ["end", "Rolling credits", () => {
            let h = black;
            const rows = [["A CLUB D'IA PRODUCTION", ""], ["", ""], ["starring", "maelle"], ["as", "the hider"], ["", ""], ["with", "jules · noah_b · camille · theo"], ["", ""], ["question 1", "north or south"], ["question 2", "within 500 m"], ["question 3", "the café"], ["question 4", "the greenhouses"], ["", ""], ["running time", "23 min 14 s"], ["filmed on location at", "Université Laval"]];
            rows.forEach(([a, b], i) => (h += t(0, 60 + i * 44, 12, a.toUpperCase(), { w: W, align: "center", c: "#fff", f: M, wt: 500 }) + t(0, 76 + i * 44, 20, esc(b), { w: W, align: "center", c: "#fff" })));
            return { html: h, ink: "" };
        }],
        ["welcome", "Title card", () => {
            let h = black + t(0, 200, 13, "CLUB D'IA PRESENTS", { w: W, align: "center", c: "#fff", f: M, ls: ".2em" });
            const L = lockup(60, 280, 50, { stack: true });
            h += L.html.replace(/color:#000/g, "color:#fff") + t(0, 650, 13, "IN CINEMAS · MON 5 OCT · 13:00 · ALL OF CAMPUS", { w: W, align: "center", c: "#fff", f: M });
            return { html: h, ink: L.ink };
        }],
    ]);

    // ======================================================================
    // 42. WRAPPED — the end of the day as stat slides.
    // ======================================================================
    concept("X42", "Wrapped", "The end-of-day recap as a string of story slides with one enormous number each: your longest hide, the question you asked most, the stalker who ran the most. Built to be posted.", [
        ["slide1", "Slide: longest hide", () => {
            let h = box(10, 20, 355, 4, "background:#000", "") + t(20, 80, 20, "Your longest hide was", { wt: 400 }) + t(10, 130, 150, "23:14", { ls: "-0.07em" }) + t(20, 320, 20, "behind the greenhouses, 4 questions deep.", { wt: 400, w: 330 });
            h += t(20, 420, 20, "That's longer than", { wt: 400 }) + t(20, 450, 64, "71%", { ls: "-0.04em" }) + t(20, 530, 20, "of everyone who hid today.", { wt: 400 });
            return { html: h, ink: Ink.underline(20, 290, 330, { seed: "wr", weight: 7 }) + note("LEGEND", 220, 480, 30) };
        }],
        ["slide2", "Slide: favourite question", () => {
            let h = black + t(20, 80, 20, "Most asked question today", { wt: 400, c: "#fff" }) + t(20, 130, 44, "“Are you north or south of me?”", { c: "#fff", w: 335, lh: 1.05, ls: "-0.02em" }) + t(20, 420, 120, "×14", { c: "#fff", ls: "-0.05em" });
            return { html: h, ink: note("BASIC.", 200, 600, 30) };
        }],
    ]);

    // ======================================================================
    // 43. HEARTBEAT — the hider's pulse: closest stalker over time.
    // ======================================================================
    concept("X43", "Heartbeat", "For the hider: a heart-monitor trace of the closest stalker's distance over the round. Every spike is someone walking past you. It beeps.", [
        ["hider", "Monitor", () => {
            let h = black + t(16, 40, 13, "CLOSEST STALKER · LAST 17 MIN", { f: M, c: "#fff" });
            const pts = [];
            let d = 900;
            const r = Ink.rng("hb");
            for (let i = 0; i <= 60; i++) {
                d = Math.max(60, d - r.range(-30, 55));
                const spike = i % 9 === 4 ? -60 : i % 9 === 5 ? 40 : 0;
                pts.push([16 + i * 5.7, 120 + (d / 900) * 300 + spike]);
            }
            h += t(16, 460, 100, "96", { c: "#fff", ls: "-0.05em" }) + t(150, 520, 22, "M", { c: "#fff" }) + t(16, 580, 15, "camille, 1 min ago. Hold still.", { c: "#fff", wt: 400 });
            for (let i = 0; i < 5; i++) h += box(16, 120 + i * 75, 343, 1, "background:#fff", "");
            return { html: h, ink: Ink.wobble(pts, { seed: "hbl", weight: 3.5, amp: 1 }) + note("BREATHE", 220, 480, 26) };
        }],
    ]);

    // ======================================================================
    // 44. LENS — a magnifying glass over the map.
    // ======================================================================
    concept("X44", "Lens", "The map is shown small and quiet, and a drawn magnifying glass shows the one area that's still possible, blown up. You read the whole game, then the detail, in one look.", [
        ["map", "Magnified", () => {
            const small = campus(375, 420, { labels: false, pad: 20 });
            const [hx, hy] = small.P(HIDER);
            const big = campus(240, 240, { zoom: 3.2, center: HIDER, pad: 0 });
            let h = box(0, 40, 375, 420, "", small.svg);
            h += box(90, 470, 240, 240, "border-radius:50%;overflow:hidden;border:6px solid #000", big.svg);
            h += t(20, 740, 14, "The possible area, ×3. Everything else is gone.", { wt: 400, w: 335 });
            return { html: h, ink: Ink.circle(hx, hy + 40, 26, 26, { seed: "ln", weight: 3.5 }) + Ink.string(hx, hy + 60, 150, 490, { width: 2 }) + Ink.pathEl([[122, 690], [70, 760]], { size: 16, color: "#000" }) };
        }],
    ]);

    // ======================================================================
    // 45. RULES AS A CONTRACT — fine print you have to initial.
    // ======================================================================
    concept("X45", "Fine Print", "The rules screen is a contract you initial clause by clause before the hunt: walk don't run, no tunnels, nothing to open, answer truthfully. Your initials, drawn, next to each.", [
        ["rules", "Initial here", () => {
            let h = t(20, 30, 26, "TERMS OF THE HUNT", { ls: "-0.02em" }) + box(20, 70, 335, 3, "background:#000", "");
            const clauses = ["§1 Everyone stays in the team's Discord call for the whole game.", "§2 The hider gets 10 minutes, then a question every 5 minutes.", "§3 The hider walks. Never runs. Stalkers may run.", "§4 Hide within 10–20 m of a path, where people on it could see you.", "§5 No tunnels.", "§6 Nothing to open: no doors, lockers or bins.", "§7 Answer truthfully. Every question, every time."];
            let ink = "";
            clauses.forEach((c, i) => {
                const y = 90 + i * 86;
                h += t(20, y, 15, esc(c), { w: 250, wt: 400, lh: 1.35 }) + box(290, y + 6, 60, 44, "border-bottom:2px solid #000", "");
                if (i < 5) ink += hw("JB", 300, y + 44, 26, { weight: 4.5, seed: `ini${i}`, mess: 0.8 });
            });
            ink += note("INITIAL ALL 7 TO PLAY", 150, 720, 18);
            return { html: h, ink };
        }],
    ]);
})();
