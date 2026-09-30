// node tools/shoot-lab.mjs <set> <from> <to> <w> <h> [prefix]
// Renders lab/view.html variations into shots/<prefix><n>.png
import { serve, browser, context, ROUND } from "./lib.mjs";
import path from "node:path";
const [, , set, from, to, w = 375, h = 460, prefix = set[0].toUpperCase()] = process.argv;
const { server, base } = await serve(7100 + Math.floor(Math.random() * 500));
const b = await browser();
const ctx = await context(b, { viewport: { width: +w, height: +h } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror:", e.message));
// A list ("a,c,f"), a code with a dot ("16.6b") or any single non-number code ("Yg") is taken as is; two numbers are a range.
const vs = from.includes(",") || from.includes(".") || Number.isNaN(+from) ? from.split(",").filter(Boolean) : Array.from({ length: +to - +from + 1 }, (_, i) => +from + i);
for (const v of vs) {
    await page.goto(`${base}/design/promo/round-1/lab/view.html?set=${set}&v=${v}&w=${w}&h=${h}`);
    await page.waitForSelector("body[data-ready='1']", { timeout: 60000 });
    const w8 = await page.evaluate(() => window.__warn);
    if (w8) console.log(v, "WARN", w8.join("; "));
    const out = path.join(ROUND, "shots", `${prefix}${typeof v === "string" ? v : String(v).padStart(2, "0")}.png`);
    await page.locator("#root").screenshot({ path: out });
    console.log("wrote", path.basename(out));
}
await b.close();
server.close();
