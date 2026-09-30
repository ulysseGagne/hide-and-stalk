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
const ORDER = ["login", "loginfilled", "permask", "permasking", "permhalf", "permdone", "permblocked", "lobby", "rules1", "rules5", "rulesdone", "ready", "hiding", "cards", "selected", "waiting", "sent", "photo", "question", "choice", "tagcode", "history", "found", "win"];

// A stand-in for the hider's photo of "the nearest door" (real photos later).
const DOOR = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 60 80"><rect width="60" height="80" fill="#000"/><rect x="14" y="12" width="32" height="66" fill="none" stroke="#fff" stroke-width="2"/><rect x="19" y="18" width="22" height="22" fill="none" stroke="#fff" stroke-width="1"/><circle cx="40" cy="48" r="1.8" fill="#fff"/><rect x="21" y="5" width="18" height="5" fill="#fff"/><text x="30" y="9.2" font-family="Arial" font-weight="700" font-size="3.6" text-anchor="middle">SORTIE</text><path d="M0 78 L14 77 M46 77 L60 78" stroke="#fff" stroke-width="1"/></svg>`;
const DOOR_URL = `data:image/svg+xml;base64,${Buffer.from(DOOR).toString("base64")}`;

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

for (const style of styles) {
    for (const name of ORDER.filter((n) => only.includes(n))) {
        const screen = SCREENS[name];
        const ctx = await context(b, { extra: { geolocation: { latitude: screen.position.lat, longitude: screen.position.lng, accuracy: 6 }, permissions: ["geolocation"] } });
        const page = await ctx.newPage();
        page.on("pageerror", (e) => console.error(`[${style}/${name}] pageerror:`, e.message));
        await page.clock.setFixedTime(new Date(NOW));
        if (screen.token !== false) await page.addInitScript(() => localStorage.setItem("hns.token", "demo"));
        await page.route("**/src/config.js", (r) => r.fulfill({ contentType: "text/javascript", body: `window.HNS_CONFIG = { apiBase: location.origin + "/api", locationPollIntervalMs: 600000, adminPollIntervalMs: 600000 };` }));
        await page.route("**/src/styles.css", (r) => r.fulfill({ contentType: "text/css", body: css(style) }));
        await page.route("**/src/index.html", async (r) => {
            let html = fs.readFileSync(path.join(REPO, "src/index.html"), "utf8");
            html = html.replace("</head>", `<link rel="stylesheet" href="/design/promo/round-1/fonts/fonts.css" /></head>`);
            html = html.replace("</body>", `<script src="/design/promo/round-1/lab/vendor/perfect-freehand.js"></script><script src="/design/promo/round-1/lab/ink.js"></script><script src="/design/promo/round-1/app/decorate.js"></script></body>`);
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
            if (p === "/cards/photo") return json({ photo: DOOR_URL });
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
        await page.evaluate(([s, n, extra]) => window.InkApp.decorate(s, n, extra), [style, name, { perm: screen.perm ?? null, receipt: screen.receipt ?? null, rules: screen.rules ?? null }]);
        await page.waitForTimeout(150);
        const out = path.join(ROUND, "shots", `${style.toUpperCase()}-${String(ORDER.indexOf(name) + 1).padStart(2, "0")}-${name}.png`);
        await page.screenshot({ path: out });
        console.log("wrote", path.basename(out));
        await ctx.close();
    }
}
await b.close();
server.close();
