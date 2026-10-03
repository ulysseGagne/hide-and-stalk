// Screenshots of the real app (src/) in each style direction, fed by the fake
// game server in app/fake-api.mjs.
//
//   node tools/shoot-app.mjs [styles=a,b,c,d] [screens=all]
//   node tools/shoot-app.mjs real [screens=all]
//
// Nothing in src/ is modified: Playwright swaps styles.css for a direction's
// stylesheet, points config.js at the fake API, and adds the ink layer.
//
// "real" (round 2) shoots src/ exactly as it ships: no stylesheet swap, no
// decorate.js. Each screen is reached the way a player gets there (a tap on
// the home screen, the permissions sheet, a card picked, a tab opened); the
// map screens are the gallery's, set up from app/fake-api.mjs's MAP_SCREENS.
// Output: shots/real/R-<name>.png.

import fs from "node:fs";
import path from "node:path";
import { serve, browser, context, ROUND, REPO } from "./lib.mjs";
import { SCREENS, NOW, catalog, MAP_SCREENS } from "../app/fake-api.mjs";

const styles = (process.argv[2] ?? "a,b,c,d").split(",");
const ALL = { ...SCREENS, ...MAP_SCREENS };
const only = process.argv[3] && process.argv[3] !== "all" ? process.argv[3].split(",") : Object.keys(ALL);
const ORDER = ["login", "loginfilled", "permask", "permasking", "permhalf", "permdone", "permblocked", "lobby", "rules1", "rules5", "rulesdone", "ready", "hiding", "cards", "selected", "waiting", "sent", "photo", "question", "choice", "tagcode", "history", "found", "win", "cardspick"];
// Round 2's real app: the home screen first, the map screens last.
// The how-to-play page's walkthrough: question 1, dealt, picked, at the hider.
const DEMO = ["demo-cards", "demo-picked", "demo-question"];
const REAL_ORDER = ["home", ...ORDER, ...DEMO, ...Object.keys(MAP_SCREENS)];

// A stand-in for the hider's photo, for the mock-up only: a sculpture on
// campus, xeroxed to pure black and white by tools/xerox-photo.mjs.
// Shown whole from its top; the screen's bottom edge crops the rest.
const PHOTO_URL = `data:image/png;base64,${fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), "../app/sculpture.png")).toString("base64")}`;

function css(style) {
    // E stands alone; B-D are layered over A.
    if (style === "e") return fs.readFileSync(path.join(ROUND, "app/style-e.css"), "utf8");
    const base = fs.readFileSync(path.join(ROUND, "app/style-a.css"), "utf8");
    const extra = style === "a" ? "" : fs.readFileSync(path.join(ROUND, `app/style-${style}.css`), "utf8");
    return base + "\n" + extra;
}

const { server, base } = await serve(5200 + Math.floor(Math.random() * 400));
const b = await browser();
const catalogJson = JSON.stringify(catalog());

// Screens shown in several versions (E-18a-photo, …): only the one kept now.
const ARROWS = { photo: ["a"] };

/**
 * The receipt's map: drawn by the lab (lab/view.html?set=receipt, the map as
 * the app shows it) at the size the slip leaves it, then set on the slip.
 */
async function receiptMap(page) {
    const need = await page.evaluate(() => window.InkApp.receiptMapNeed());
    if (!need) return;
    const ctx = await context(b, { viewport: { width: need.w, height: need.h } });
    const lab = await ctx.newPage();
    lab.on("pageerror", (e) => console.error("[receipt map] pageerror:", e.message));
    await lab.addInitScript((spec) => (window.__receipt = spec), { region: need.region });
    await lab.goto(`${base}/design/promo/round-1/lab/view.html?set=receipt&v=1&w=${need.w}&h=${need.h}`);
    await lab.waitForSelector("body[data-ready='1']", { timeout: 60000 });
    const png = await lab.locator("#root").screenshot();
    await ctx.close();
    await page.evaluate(async (src) => {
        const img = document.querySelector(".rc-map img");
        img.src = src;
        await img.decode();
    }, `data:image/png;base64,${png.toString("base64")}`);
}


// ---------------------------------------------------------------------------
// Round 2: the real app, as it ships
// ---------------------------------------------------------------------------
// Screens the design had that round 2 does not build (decided Oct 1).
const REAL_SKIP = { rules1: true, rules5: true, rulesdone: true };
const REAL_OUT = path.join(process.env.OUT ? path.resolve(process.env.OUT) : path.join(ROUND, "shots"), "real");

/** What a player does to get to each screen, after the app has loaded. */
const REAL_STEPS = {
    // The home screen: nothing; every other screen starts with a tap on it.
    home: async () => {},
    loginfilled: async (page) => {
        await page.fill("#auth-form input[name=username]", "jules");
        await page.fill("#auth-form input[name=password]", "hunter22");
    },
    // Location asked, the browser's prompt still up: the request never answers.
    permasking: async (page) => {
        await page.evaluate(() => {
            navigator.geolocation.getCurrentPosition = () => {};
        });
        await page.click(".perm-row[data-perm=loc] .perm-btn");
    },
    permdone: async (page) => {
        await page.click(".perm-row[data-perm=compass] .perm-btn");
    },
    // Location refused straight away (headless Chromium answers at once): blocked.
    permblocked: async (page) => {
        await page.click(".perm-row[data-perm=loc] .perm-btn");
    },
    cardspick: async (page) => {
        await page.click("#card-row .card:nth-child(2)");
    },
    selected: async (page) => {
        await page.click("#card-row .card:nth-child(2)");
    },
    "demo-picked": async (page) => {
        await page.click("#card-row .card:nth-child(1)");
    },
    // Every answer so far: under the stalker's cards (the RESULTS tab is gone).
    history: async (page) => {
        await page.evaluate(() => document.getElementById("stalker-answers")?.scrollIntoView({ block: "start" }));
    },
};

async function shootReal(name) {
    const screen = ALL[name];
    const isPerm = name.startsWith("perm");
    const isMap = Boolean(MAP_SCREENS[name]);
    // Location: granted, except where the permissions sheet must still ask for it.
    const grant = !["permask", "permasking", "permblocked"].includes(name);
    const pos = screen.position ?? screen.you;
    // Montréal time, as the game is played (the receipt prints the hour).
    const ctx = await context(b, { extra: { geolocation: { latitude: pos.lat, longitude: pos.lng, accuracy: 6 }, permissions: grant ? ["geolocation"] : [], timezoneId: "America/Montreal" } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.error(`[real/${name}] pageerror:`, e.message));
    page.on("console", (m) => m.type() === "error" && console.error(`[real/${name}] console:`, m.text()));
    await page.clock.setFixedTime(new Date(NOW));
    if (screen.token !== false) await page.addInitScript(() => localStorage.setItem("hns.token", "demo"));
    // "Before you start" has been seen, except on its own screens.
    if (!isPerm) await page.addInitScript(() => localStorage.setItem("hns.perm.seen", "1"));
    if (!grant) {
        // A phone that was never asked says "prompt" (headless Chromium says "denied").
        await page.addInitScript(() => {
            const query = navigator.permissions.query.bind(navigator.permissions);
            navigator.permissions.query = (d) => (d?.name === "geolocation" ? Promise.resolve({ state: "prompt", addEventListener() {} }) : query(d));
        });
    }
    if (isPerm) {
        // An iPhone: the compass waits for a tap (and, on permdone, is allowed).
        await page.addInitScript((allow) => {
            if (typeof DeviceOrientationEvent === "undefined") window.DeviceOrientationEvent = class DeviceOrientationEvent extends Event {};
            DeviceOrientationEvent.requestPermission = () => (allow ? Promise.resolve("granted") : new Promise(() => {}));
        }, name === "permdone");
    }
    await page.route("**/src/config.js", (r) => r.fulfill({ contentType: "text/javascript", body: `window.HNS_CONFIG = { apiBase: location.origin + "/api", locationPollIntervalMs: 600000, adminPollIntervalMs: 600000 };` }));
    await page.route("**/api/**", (r) => {
        const url = new URL(r.request().url());
        const p = url.pathname.replace("/api", "");
        const json = (body, status = 200) => r.fulfill({ status, contentType: "application/json", body: typeof body === "string" ? body : JSON.stringify(body) });
        if (p === "/me") return json({ user: screen.state?.me ?? null });
        if (p === "/state") return json(screen.state);
        if (p === "/cards/catalog") return json(catalogJson);
        if (p === "/cards/history") return json({ plays: screen.history ? screen.history() : [] });
        if (p === "/cards/photo") return json({ photo: PHOTO_URL });
        return json({ ok: true });
    });
    await page.goto(`${base}/src/index.html`);
    await page.waitForFunction(() => document.fonts.ready.then(() => true));
    await page.waitForTimeout(600);
    if (name !== "home") await page.click("#home-screen");
    await page.waitForTimeout(300);
    if (screen.select !== undefined) {
        await page.evaluate((sel) => {
            const opts = [...document.querySelectorAll("#hider-question-list .answer-option")];
            const opt = typeof sel === "number" ? opts[sel] : opts.find((o) => o.textContent.trim().startsWith(sel));
            opt?.querySelector("input")?.click();
        }, screen.select);
    }
    await REAL_STEPS[name]?.(page);
    if (isMap) await screen.setup(page);
    await page.waitForTimeout(400);
    if (screen.scrollTo) {
        await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            const menu = document.getElementById("view-menu");
            menu.scrollTop = el.getBoundingClientRect().top - menu.getBoundingClientRect().top + menu.scrollTop - 120;
        }, screen.scrollTo);
    }
    // The receipt's map is drawn once its data has loaded.
    if (name === "found" || name === "win") await page.evaluate(() => window.HNSReceipt.ready()).catch(() => {});
    await page.waitForTimeout(500);
    fs.mkdirSync(REAL_OUT, { recursive: true });
    const out = path.join(REAL_OUT, `R-${name}.png`);
    await page.screenshot({ path: out });
    console.log("wrote", path.relative(ROUND, out));
    // The receipt runs past the fold: a second shot, scrolled to its end.
    if (name === "found" || name === "win") {
        await page.evaluate(() => {
            const m = document.getElementById("view-menu");
            m.scrollTop = m.scrollHeight;
        });
        await page.waitForTimeout(300);
        const outB = path.join(REAL_OUT, `R-${name}b.png`);
        await page.screenshot({ path: outB });
        console.log("wrote", path.relative(ROUND, outB));
    }
    await ctx.close();
}

for (const style of styles) {
    if (style === "real") {
        for (const name of REAL_ORDER.filter((n) => only.includes(n) && ALL[n] && REAL_SKIP[n] !== true)) await shootReal(name);
        continue;
    }
    for (const name of ORDER.filter((n) => only.includes(n))) for (const arrow of ARROWS[name] ?? [null]) {
        const screen = SCREENS[name];
        const ctx = await context(b, { extra: { geolocation: { latitude: screen.position.lat, longitude: screen.position.lng, accuracy: 6 }, permissions: ["geolocation"] } });
        const page = await ctx.newPage();
        page.on("pageerror", (e) => console.error(`[${style}/${name}] pageerror:`, e.message));
        await page.clock.setFixedTime(new Date(NOW));
        if (screen.token !== false) await page.addInitScript(() => localStorage.setItem("hns.token", "demo"));
        // As on an iPhone (and as the Mac's Chrome has always shot these): the
        // compass waits for a tap, so the app shows its compass notice.
        await page.addInitScript(() => {
            if (typeof DeviceOrientationEvent === "undefined") window.DeviceOrientationEvent = class DeviceOrientationEvent extends Event {};
            if (typeof DeviceOrientationEvent.requestPermission !== "function") DeviceOrientationEvent.requestPermission = () => new Promise(() => {});
        });
        await page.route("**/src/config.js", (r) => r.fulfill({ contentType: "text/javascript", body: `window.HNS_CONFIG = { apiBase: location.origin + "/api", locationPollIntervalMs: 600000, adminPollIntervalMs: 600000 };` }));
        await page.route("**/src/styles.css", (r) => r.fulfill({ contentType: "text/css", body: css(style) }));
        await page.route("**/src/index.html", async (r) => {
            let html = fs.readFileSync(path.join(REPO, "src/index.html"), "utf8");
            html = html.replace("</head>", `<link rel="stylesheet" href="/design/promo/round-1/fonts/fonts.css" /></head>`);
            html = html.replace("</body>", `<script src="/design/promo/round-1/lab/vendor/perfect-freehand.js"></script><script src="/design/promo/round-1/lab/ink.js"></script><script src="/design/promo/round-1/lab/logo.js"></script><script src="/design/promo/round-1/app/decorate.js"></script></body>`);
            r.fulfill({ contentType: "text/html", body: html });
        });
        await page.route("**/api/**", (r) => {
            const url = new URL(r.request().url());
            const p = url.pathname.replace("/api", "");
            const json = (body, status = 200) => r.fulfill({ status, contentType: "application/json", body: typeof body === "string" ? body : JSON.stringify(body) });
            if (p === "/me") return json({ user: screen.state?.me ?? null });
            if (p === "/state") return json(screen.state);
            if (p === "/cards/catalog") return json(catalogJson);
            if (p === "/cards/history") return json({ plays: screen.history ? screen.history() : [] });
            if (p === "/cards/photo") return json({ photo: PHOTO_URL });
            return json({ ok: true });
        });
        await page.goto(`${base}/src/index.html`);
        await page.waitForFunction(() => document.fonts.ready.then(() => true));
        await page.waitForTimeout(900);
        if (screen.fill) for (const [sel, val] of Object.entries(screen.fill)) await page.fill(sel, val);
        if (screen.select !== undefined) {
            await page.evaluate((sel) => {
                const opts = [...document.querySelectorAll("#hider-question-list .answer-option")];
                const opt = typeof sel === "number" ? opts[sel] : opts.find((o) => o.textContent.trim().startsWith(sel));
                opt?.querySelector("input")?.click();
            }, screen.select);
        }
        if (screen.click) {
            await page.click(screen.click);
            await page.waitForTimeout(500);
        }
        if (screen.scrollTo) {
            await page.evaluate((sel) => {
                const el = document.querySelector(sel);
                const menu = document.getElementById("view-menu");
                menu.scrollTop = el.getBoundingClientRect().top - menu.getBoundingClientRect().top + menu.scrollTop - 120;
            }, screen.scrollTo);
        }
        await page.evaluate(([s, n, extra]) => window.InkApp.decorate(s, n, extra), [style, name, { perm: screen.perm ?? null, receipt: screen.receipt ?? null, rules: screen.rules ?? null, arrow }]);
        if (screen.receipt) await receiptMap(page);
        await page.waitForTimeout(150);
        // OUT=<dir> writes somewhere else (the post's export), leaving shots/ alone.
        const out = path.join(process.env.OUT ? path.resolve(process.env.OUT) : path.join(ROUND, "shots"), `${style.toUpperCase()}-${String(ORDER.indexOf(name) + 1).padStart(2, "0")}${arrow ?? ""}-${name}.png`);
        await page.screenshot({ path: out });
        console.log("wrote", path.basename(out));
        // The receipt runs past the fold: a second shot, scrolled to its end.
        if ((name === "found" || name === "win") && style === "e") {
            await page.evaluate(() => {
                const m = document.getElementById("view-menu");
                m.scrollTop = m.scrollHeight;
                document.querySelectorAll("body > svg").forEach((s) => (s.style.display = "none"));
            });
            await page.waitForTimeout(100);
            const outB = out.replace(`-${name}.png`, `b-${name}.png`);
            await page.screenshot({ path: outB });
            console.log("wrote", path.basename(outB));
        }
        await ctx.close();
    }
}
await b.close();
server.close();
