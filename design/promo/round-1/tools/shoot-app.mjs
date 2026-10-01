// Screenshots of the real app (src/) in each style direction, fed by the fake
// game server in app/fake-api.mjs.
//
//   node tools/shoot-app.mjs [styles=a,b,c,d] [screens=all]
//
// Nothing in src/ is modified: Playwright swaps styles.css for a direction's
// stylesheet, points config.js at the fake API, and adds the ink layer.

import fs from "node:fs";
import path from "node:path";
import { serve, browser, context, ROUND, REPO } from "./lib.mjs";
import { SCREENS, NOW, catalog } from "../app/fake-api.mjs";

const styles = (process.argv[2] ?? "a,b,c,d").split(",");
const only = process.argv[3] && process.argv[3] !== "all" ? process.argv[3].split(",") : Object.keys(SCREENS);
const ORDER = ["login", "loginfilled", "permask", "permasking", "permhalf", "permdone", "permblocked", "lobby", "rules1", "rules5", "rulesdone", "ready", "hiding", "cards", "selected", "waiting", "sent", "photo", "question", "choice", "tagcode", "history", "found", "win", "cardspick"];

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

for (const style of styles) {
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
