// Shared by the shoot scripts: a static server over the repo root, and a
// Chromium that answers the app's unpkg.com requests from node_modules (same
// packages, same versions — unpkg is only a CDN in front of npm).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";

export const ROUND = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const REPO = path.resolve(ROUND, "../../..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".geojson": "application/json", ".webp": "image/webp" };

export function serve(port = 4173) {
    const server = http.createServer((req, res) => {
        const url = decodeURIComponent(new URL(req.url, "http://x").pathname);
        let file = path.join(REPO, url);
        if (!file.startsWith(REPO)) return res.writeHead(403).end();
        if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
        if (!fs.existsSync(file)) return res.writeHead(404).end("not found");
        res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
        fs.createReadStream(file).pipe(res);
    });
    return new Promise((ok) => server.listen(port, () => ok({ server, base: `http://localhost:${port}` })));
}

const UNPKG = {
    "leaflet@1.9.4/dist/": "leaflet/dist/",
    "leaflet-contextmenu@1.4.0/dist/": "leaflet-contextmenu/dist/",
    "leaflet.heat@0.2.0/dist/": "leaflet.heat/dist/",
    "@turf/turf@7.2.0/": "@turf/turf/",
    "qrcode-generator@1.4.4/": "qrcode-generator/",
    "jsqr@1.4.0/dist/": "jsqr/dist/",
};

export async function browser() {
    const b = await chromium.launch();
    return b;
}

export async function context(b, opts = {}) {
    const ctx = await b.newContext({ viewport: opts.viewport ?? { width: 375, height: 812 }, deviceScaleFactor: opts.dpr ?? 2, ...opts.extra });
    await ctx.route("https://unpkg.com/**", (route) => {
        const rest = route.request().url().replace("https://unpkg.com/", "");
        const key = Object.keys(UNPKG).find((k) => rest.startsWith(k));
        if (!key) return route.abort();
        const file = path.join(ROUND, "node_modules", UNPKG[key], rest.slice(key.length));
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ path: file, contentType: TYPES[path.extname(file)] ?? "text/javascript" });
    });
    // OpenStreetMap tiles go through a disk cache (tools/.tiles, gitignored):
    // each tile is fetched once with curl (which knows this machine's proxy),
    // so re-shooting never hits the tile servers again.
    await ctx.route("https://tile.openstreetmap.org/**", (route) => {
        const rest = route.request().url().replace("https://tile.openstreetmap.org/", "");
        const file = path.join(ROUND, "tools/.tiles", rest);
        if (!fs.existsSync(file)) {
            fs.mkdirSync(path.dirname(file), { recursive: true });
            try {
                execFileSync("curl", ["-sfL", "-A", "hide-and-stalk-design/1.0 (campus game mockups)", "-o", file, route.request().url()], { timeout: 20000 });
            } catch {
                fs.rmSync(file, { force: true });
                return route.abort();
            }
        }
        route.fulfill({ path: file, contentType: "image/png" });
    });
    await ctx.route("https://overpass*/**", (route) => route.abort());
    return ctx;
}
