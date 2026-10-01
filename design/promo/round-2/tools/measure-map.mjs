// How the map does on a phone: load time and redraw cost, throttled.
//
//   node design/promo/round-2/tools/measure-map.mjs
//
// The profile is Lighthouse's mobile one: the CPU 4x slower than this
// machine's, and "slow 4G" (1.6 Mbit/s down, 150 ms round trip). src/ is
// served gzipped, as GitHub Pages serves it. The app talks to a fake game
// server (round-1's app/fake-api.mjs: the hider between questions, the
// hints layer up), so the map has its red layer, pins and box.
//
// It measures:
//   - what the map costs to download (campus-map.json, gzipped), and the
//     time from opening the app to the map data being ready;
//   - opening the MAP tab: until every tile on screen is drawn;
//   - panning (a fling across half the screen) and zooming in and out, the
//     map's own animations: frame times, frames over 50 ms, long tasks;
//   - the red layer's redraw after a zoom (the hints edge by hand).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { browser, context, REPO } from "../../round-1/tools/lib.mjs";
import { MAP_SCREENS, NOW, catalog } from "../../round-1/app/fake-api.mjs";

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".woff2": "font/woff2", ".svg": "image/svg+xml" };
const sizes = {};
const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const file = path.join(REPO, url);
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return res.writeHead(404).end();
    const ext = path.extname(file);
    let body = fs.readFileSync(file);
    const headers = { "Content-Type": TYPES[ext] ?? "application/octet-stream", "Cache-Control": "no-store" };
    if (/gzip/.test(req.headers["accept-encoding"] ?? "") && [".html", ".js", ".css", ".json", ".svg"].includes(ext)) {
        body = zlib.gzipSync(body, { level: 9 });
        headers["Content-Encoding"] = "gzip";
    }
    sizes[url] = body.length;
    res.writeHead(200, headers).end(body);
});
await new Promise((ok) => server.listen(0, ok));
const base = `http://localhost:${server.address().port}`;

const screen = MAP_SCREENS.g11a;
const b = await browser();
const ctx = await context(b, { dpr: 3, extra: { geolocation: { latitude: screen.you.lat, longitude: screen.you.lng, accuracy: 6 }, permissions: ["geolocation"] } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror:", e.message));
const cdp = await ctx.newCDPSession(page);
await cdp.send("Network.enable");
await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await page.addInitScript(() => {
    localStorage.setItem("hns.token", "demo");
    localStorage.setItem("hns.perm.seen", "1");
    window.__longtasks = [];
    new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__longtasks.push(e.duration);
    }).observe({ type: "longtask", buffered: true });
});
const catalogJson = JSON.stringify(catalog());
await page.route("**/src/config.js", (r) => r.fulfill({ contentType: "text/javascript", body: `window.HNS_CONFIG = { apiBase: location.origin + "/api", locationPollIntervalMs: 600000, adminPollIntervalMs: 600000 };` }));
await page.route("**/api/**", (r) => {
    const p = new URL(r.request().url()).pathname.replace("/api", "");
    const json = (body) => r.fulfill({ contentType: "application/json", body: typeof body === "string" ? body : JSON.stringify(body) });
    if (p === "/me") return json({ user: screen.state.me });
    if (p === "/state") return json(screen.state);
    if (p === "/cards/catalog") return json(catalogJson);
    return json({ ok: true });
});

const t0 = Date.now();
await page.goto(`${base}/src/index.html`);
await page.waitForFunction(() => window.HNSMapDraw?.isReady(), null, { timeout: 120000 });
const dataReady = Date.now() - t0;
await page.click("#home-screen");

// Opening the MAP tab: until every tile on screen is drawn.
const tabOpen = await page.evaluate(
    () =>
        new Promise((resolve) => {
            const start = performance.now();
            document.querySelector('.view-tab[data-view="map"]').click();
            const done = () => {
                const tiles = [...document.querySelectorAll(".leaflet-tile")];
                if (tiles.length && tiles.every((t) => t.classList.contains("leaflet-tile-loaded"))) resolve(performance.now() - start);
                else requestAnimationFrame(done);
            };
            requestAnimationFrame(done);
        }),
);

/** Frame intervals while `run` animates the map, until it settles. */
async function frames(label, run) {
    return page.evaluate(
        async ({ label, run }) => {
            window.__longtasks = [];
            window.__inkMs = 0;
            const gaps = [];
            let last = performance.now();
            let on = true;
            const tick = (t) => {
                gaps.push(t - last);
                last = t;
                if (on) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
            const map = window.HNSMap.map;
            const settled = new Promise((ok) => map.once("moveend", ok));
            // eslint-disable-next-line no-new-func
            new Function("map", run)(map);
            await settled;
            // Let the tiles and the red layer catch up after the move.
            await new Promise((ok) => setTimeout(ok, 600));
            on = false;
            const sorted = [...gaps].sort((a, b) => a - b);
            const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
            return { label, frames: gaps.length, median: +pct(0.5).toFixed(1), p95: +pct(0.95).toFixed(1), over50: gaps.filter((g) => g > 50).length, longest: +Math.max(...gaps).toFixed(1), longtasks: window.__longtasks.length, longestTask: +(Math.max(0, ...window.__longtasks)).toFixed(0), redLayerMs: Math.round(window.__inkMs) };
        },
        { label, run },
    );
}

// Time spent drawing the red layer by hand (the hints edge), per animation.
await page.evaluate(() => {
    window.__inkMs = 0;
    const wobble = window.Ink.wobble;
    window.Ink.wobble = (...args) => {
        const s = performance.now();
        const out = wobble(...args);
        window.__inkMs += performance.now() - s;
        return out;
    };
});
// VARIANT=noinvert: the hints mask pane hidden (to see what the blend costs).
if (process.env.VARIANT === "noinvert") await page.addStyleTag({ content: ".leaflet-invert-pane{display:none}" });
const results = [];
results.push(await frames("pan, half a screen", "map.panBy([180, 260], { animate: true, duration: 0.6 })"));
results.push(await frames("zoom in one level", "map.setZoom(map.getZoom() + 1, { animate: true })"));
results.push(await frames("zoom in another level", "map.setZoom(map.getZoom() + 1, { animate: true })"));
results.push(await frames("pan at that zoom", "map.panBy([-200, -300], { animate: true, duration: 0.6 })"));
results.push(await frames("zoom back out two levels", "map.setZoom(map.getZoom() - 2, { animate: true })"));

// PROFILE=1: where a zoom's time goes, by function (self time).
if (process.env.PROFILE) {
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
    await cdp.send("Profiler.start");
    await frames("profiled zoom in", "map.setZoom(map.getZoom() + 1, { animate: true })");
    const { profile } = await cdp.send("Profiler.stop");
    const self = new Map();
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    const dt = profile.timeDeltas;
    profile.samples.forEach((id, i) => {
        const n = byId.get(id);
        const key = `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").pop()}:${n.callFrame.lineNumber + 1}`;
        self.set(key, (self.get(key) ?? 0) + (dt[i] ?? 0) / 1000);
    });
    console.error([...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${v.toFixed(1).padStart(8)} ms  ${k}`).join("\n"));
}

// The cost of one tile, and of the red layer, measured directly (throttled).
const unit = await page.evaluate(() => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 512;
    const c = cv.getContext("2d");
    const times = [];
    // Tiles in the middle of campus, at the zooms the game is played at.
    const tile = (z, dx = 0, dy = 0) => {
        const [px, py] = window.HNSMapDraw.project(-71.2745, 46.7805, z);
        return [z, Math.floor(px / 256) + dx, Math.floor(py / 256) + dy];
    };
    for (const [z, x, y] of [tile(15), tile(15, 1, 0), tile(16), tile(16, 0, 1), tile(17), tile(18)]) {
        const s = performance.now();
        c.setTransform(2, 0, 0, 2, 0, 0);
        window.HNSMapDraw.draw(c, { z, x: x * 256, y: y * 256, w: 256, h: 256, ratio: 2 });
        times.push(performance.now() - s);
    }
    const ink = document.querySelector(".leaflet-ink-pane svg");
    return { tileMs: times.map((t) => +t.toFixed(1)), inkPaths: ink ? ink.querySelectorAll("path").length : 0 };
});

const report = {
    profile: "CPU 4x slower, slow 4G (1.6 Mbit/s, 150 ms RTT), 375x812 at 3x (tiles drawn at 2x)",
    downloadKB: { "campus-map.json (gzip)": +(sizes["/src/data/campus-map.json"] / 1024).toFixed(0), "mapdraw.js + map.js (gzip)": +(((sizes["/src/mapdraw.js"] ?? 0) + (sizes["/src/map.js"] ?? 0)) / 1024).toFixed(1), "ink.js (gzip)": +((sizes["/src/ink.js"] ?? 0) / 1024).toFixed(1) },
    msToMapDataReady: dataReady,
    msToOpenMapTab: Math.round(tabOpen),
    oneTileMs: unit.tileMs,
    animations: results,
};
console.log(JSON.stringify(report, null, 2));
await b.close();
server.close();
void NOW;
