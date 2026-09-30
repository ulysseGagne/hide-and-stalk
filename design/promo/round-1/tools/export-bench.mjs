// node tools/export-bench.mjs
// Writes app/bench.svg: the bench from B29's Polaroid (lab/board2.js, scene
// "sit"), white on black, 3:4 like a phone photo. It stands in for the hider's
// photo of "the nearest place to sit" on E18 (tools/shoot-app.mjs).
import { serve, browser, context, ROUND } from "./lib.mjs";
import fs from "node:fs";
import path from "node:path";
const { server, base } = await serve(7300 + Math.floor(Math.random() * 200));
const b = await browser();
const ctx = await context(b, {});
const page = await ctx.newPage();
await page.goto(`${base}/design/promo/round-1/lab/view.html?set=logo&v=16.6b&w=375&h=520`);
await page.waitForSelector("body[data-ready='1']", { timeout: 60000 });
const scene = await page.evaluate(() => Board.kit2.photo("sit", "#fff"));
// The square scene centred in a 3:4 frame.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 -16.67 100 133.33"><rect x="0" y="-16.67" width="100" height="133.33" fill="#000"/>${scene}</svg>`;
fs.writeFileSync(path.join(ROUND, "app/bench.svg"), svg);
console.log("wrote app/bench.svg", svg.length, "bytes");
await b.close();
server.close();
