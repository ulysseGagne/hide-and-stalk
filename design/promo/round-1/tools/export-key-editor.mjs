// node tools/export-key-editor.mjs
// Writes key-editor/ways.json: what the key editor draws, straight from
// lab/osmdraw.js (every road and path with its kind, the rules' default, its
// groups and its shape as drawn; the areas; the campus border).
import { serve, browser, context, ROUND } from "./lib.mjs";
import fs from "node:fs";
import path from "node:path";
const { server, base } = await serve(7600 + Math.floor(Math.random() * 300));
const b = await browser();
const ctx = await context(b, {});
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror:", e.message));
await page.goto(`${base}/design/promo/round-1/lab/view.html?set=osmkey&v=4&w=375&h=700`);
await page.waitForSelector("body[data-ready='1']", { timeout: 60000 });
const data = await page.evaluate(() => OSMDraw.editorData());
const out = path.join(ROUND, "key-editor/ways.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(data));
const count = {};
for (const l of data.lines) count[l.k] = (count[l.k] ?? 0) + 1;
console.log("wrote", path.relative(ROUND, out), `${(fs.statSync(out).size / 1e6).toFixed(2)} MB`, JSON.stringify(count), data.areas.length, "areas");
await b.close();
server.close();
