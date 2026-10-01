// A whole round, clicked through in two browsers against a local worker:
// one phone hides, the other stalks. Every step is a real tap on the real
// app (src/), and a screenshot.
//
//   cd worker && npx wrangler dev                       (the API, port 8787)
//   npx serve src -l 8080                               (the app, port 8080)
//   HNS_ADMIN_USERNAME=... HNS_ADMIN_PASSWORD=... node design/promo/round-2/tools/click-through.mjs
//
// Like the worker's tests, it starts by deleting every player on the server
// it talks to, so it refuses anything but a local one. Debug mode makes the
// round short: a 1-minute hide and a question every minute.
// Screenshots go to design/promo/round-1/shots/click/.
import fs from "node:fs";
import path from "node:path";
import { browser, context, ROUND } from "../../round-1/tools/lib.mjs";

const API = process.env.HNS_API ?? "http://127.0.0.1:8787";
const APP = process.env.HNS_APP ?? "http://localhost:8080";
if (!/^http:\/\/(127\.0\.0\.1|localhost)[:/]/.test(API)) throw new Error(`refusing to clear a non-local server: ${API}`);
const OUT = path.join(ROUND, "shots/click");
fs.mkdirSync(OUT, { recursive: true });

async function call(pathname, { method = "GET", body, token } = {}) {
    const res = await fetch(API + pathname, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(`${method} ${pathname}: ${res.status} ${data?.error ?? ""}`);
    return data;
}

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const admin = await call("/login", { method: "POST", body: { username: process.env.HNS_ADMIN_USERNAME || "admin", password: process.env.HNS_ADMIN_PASSWORD } });
await call("/admin/clear", { method: "POST", token: admin.token });
await call("/admin/settings", { method: "POST", token: admin.token, body: { debug: true, discordUrl: "https://discord.gg/hideandstalk" } });
log("server cleared, debug mode on");

// Two phones on campus: by the greenhouse, and by Pollack.
const SPOTS = { ana: { latitude: 46.7806, longitude: -71.2789 }, ben: { latitude: 46.779163, longitude: -71.2692303 } };
const b = await browser();
const phones = {};
let shot = 0;
async function snap(name, label) {
    const file = path.join(OUT, `${String(++shot).padStart(2, "0")}-${name}-${label}.png`);
    await phones[name].page.screenshot({ path: file });
    log("shot", path.basename(file));
}

for (const name of ["ana", "ben"]) {
    const ctx = await context(b, { dpr: 2, extra: { geolocation: { ...SPOTS[name], accuracy: 8 }, permissions: ["geolocation"], timezoneId: "America/Montreal" } });
    const page = await ctx.newPage();
    // ana's phone is an iPhone: the compass waits for a tap (and is allowed),
    // so "Before you start" has something to ask.
    if (name === "ana") {
        await page.addInitScript(() => {
            DeviceOrientationEvent.requestPermission = () => Promise.resolve("granted");
        });
    }
    page.on("pageerror", (e) => log(`[${name}] pageerror:`, e.message));
    page.on("console", (m) => m.type() === "error" && log(`[${name}] console:`, m.text()));
    page.on("dialog", (d) => d.accept());
    phones[name] = { ctx, page };
    await page.goto(`${APP}/index.html`);
    await page.waitForTimeout(800);
    await snap(name, "home");
    // A tap anywhere on the home screen.
    await page.click("#home-screen");
    await page.click('.auth-switch-btn[data-mode="register"]');
    await page.fill("#auth-form input[name=username]", name);
    await page.fill("#auth-form input[name=password]", "hunter22");
    await snap(name, "register");
    await page.click("#auth-submit");
    // "Before you start": location is allowed in this browser, the compass needs nothing.
    await page.waitForTimeout(1200);
    const sheet = await page.isVisible("#perm-sheet");
    log(`[${name}] permissions sheet ${sheet ? "shown" : "skipped (nothing to ask)"}`);
    if (sheet) {
        await snap(name, "before-you-start");
        if (await page.isVisible(".perm-row[data-perm=compass] .perm-btn")) {
            await page.click(".perm-row[data-perm=compass] .perm-btn");
            await page.waitForTimeout(500);
            await snap(name, "both-on");
        }
        await page.click("#perm-done:visible, #perm-later:visible");
    }
    await page.waitForTimeout(800);
    await snap(name, "lobby");
}

// The admin puts them in one team; the server picks the hider.
await call("/admin/make-teams", { method: "POST", token: admin.token, body: { size: 2 } });
await Promise.all(Object.values(phones).map(({ page }) => page.waitForSelector("#team-start-btn:not([hidden])", { timeout: 20000 })));
const state = await call("/state", { token: admin.token });
const hiderName = state.users.find((u) => u.role === "hider").username;
const stalkerName = hiderName === "ana" ? "ben" : "ana";
const hider = phones[hiderName].page;
const stalker = phones[stalkerName].page;
log(`team made: ${hiderName} hides, ${stalkerName} stalks`);
await snap(hiderName, "ready");
await snap(stalkerName, "ready");

// Start (the confirm dialog is accepted), then the hide.
await stalker.click("#team-start-btn");
await hider.waitForSelector('#status-card[data-phase="hiding"]', { timeout: 20000 });
await hider.waitForTimeout(800);
await snap(hiderName, "go-hide");
await snap(stalkerName, "wait");

// The hunt: the stalker picks the second card (nothing sent yet), then sends it.
await stalker.waitForSelector("#card-row .card", { timeout: 90000 });
await stalker.waitForTimeout(800);
await snap(stalkerName, "three-cards");
await stalker.click("#card-row .card:nth-child(2)");
await stalker.waitForTimeout(400);
const sentBefore = await call("/state", { token: admin.token });
const playedBeforeSend = sentBefore.teams?.[0]?.question ?? null;
await snap(stalkerName, "picked-not-sent");
const prompt = await stalker.textContent("#card-row .card.picked .card-prompt");
await stalker.click("#send-btn");
await stalker.waitForSelector('#sent-card[data-state="waiting"]', { timeout: 20000 });
await stalker.waitForTimeout(600);
await snap(stalkerName, "sent-locked-in");
log(`sent: "${prompt.trim()}" (question ${playedBeforeSend})`);

// The hider: the bell rings (NEW), the question is on the menu; answer it.
await hider.waitForSelector("#hider-question-list .question-card", { timeout: 20000 });
await hider.waitForTimeout(800);
await snap(hiderName, "new-question");
const form = hider.locator("#hider-question-list .question-card").first();
if (await form.locator(".answer-option input").count()) await form.locator(".answer-option input").first().check();
else if (await form.locator("input.answer-input[type=number]").count()) await form.locator("input.answer-input").fill("6");
else if (await form.locator("input.answer-input").count()) await form.locator("input.answer-input").fill("2");
else if (await form.locator(".answer-coords button").count()) await form.locator(".answer-coords button").click();
await hider.waitForTimeout(300);
await snap(hiderName, "answer-ticked");
await form.locator("button[type=submit]").click();
await hider.waitForSelector("#hider-answer-list .answer-row", { timeout: 20000 });
await hider.waitForTimeout(600);
await snap(hiderName, "answered");

// The stalker: the answer written in; NEW at the bell; the QUESTIONS tab reads it.
await stalker.waitForSelector('#sent-card[data-state="answered"]', { timeout: 20000 });
await stalker.waitForTimeout(800);
await snap(stalkerName, "answer-in");
await stalker.click('.view-tab[data-view="questions"]');
await stalker.waitForTimeout(1500);
await snap(stalkerName, "questions-tab");
const unread = (await call("/state", { token: (await stalker.evaluate(() => localStorage.getItem("hns.token"))) })).cards.unread;
log(`stalker's unread after opening QUESTIONS: ${unread}`);

// Both maps.
for (const [name, page] of [[hiderName, hider], [stalkerName, stalker]]) {
    await page.click('.view-tab[data-view="map"]');
    await page.waitForTimeout(2000);
    await snap(name, "map");
    await page.click('.view-tab[data-view="menu"]');
}

// Found: the scanner opens from the page; the camera won't start here, so the hider is found by hand.
await stalker.click("#scan-open");
await stalker.waitForTimeout(800);
await snap(stalkerName, "scanner");
await stalker.click("#found-btn");
await stalker.click("#found-btn");
await stalker.waitForSelector('#status-card[data-phase="ended"]', { timeout: 20000 });
await hider.waitForSelector('#status-card[data-phase="ended"]', { timeout: 20000 });
await stalker.waitForTimeout(2500);
await snap(stalkerName, "gotcha");
await snap(hiderName, "found");
for (const [name, page] of [[stalkerName, stalker], [hiderName, hider]]) {
    await page.evaluate(() => {
        const m = document.getElementById("view-menu");
        m.scrollTop = m.scrollHeight;
    });
    await page.waitForTimeout(500);
    await snap(name, "receipt");
}

// Play again: back to ready, the other player hides.
await hider.click("#team-again-btn");
await stalker.waitForSelector("#team-start-btn:not([hidden])", { timeout: 20000 });
await stalker.waitForTimeout(800);
const after = await call("/state", { token: admin.token });
log(`play again: ${after.users.find((u) => u.role === "hider")?.username} hides now`);
await snap(stalkerName, "play-again");
await snap(hiderName, "play-again");

await call("/admin/settings", { method: "POST", token: admin.token, body: { debug: false } });
await b.close();
log("done");
