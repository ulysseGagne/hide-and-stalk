// node tools/snap.mjs <url-path> <out.png> [width] [height] [fullPage]
import { serve, browser, context } from "./lib.mjs";
const [, , url, out, w = 375, h = 812, full] = process.argv;
const { server, base } = await serve(4180 + Math.floor(Math.random() * 500));
const b = await browser();
const ctx = await context(b, { viewport: { width: +w, height: +h } });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("pageerror:", e.message));
page.on("console", (m) => m.type() === "error" && console.error("console:", m.text()));
await page.goto(base + url, { waitUntil: "networkidle" });
await page.waitForFunction(() => document.fonts.ready.then(() => true));
await page.waitForTimeout(150);
await page.screenshot({ path: out, fullPage: full === "full" });
await b.close();
server.close();
console.log("wrote", out);
