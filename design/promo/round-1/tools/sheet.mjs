// node tools/sheet.mjs <out.png> <cols> <cellWidth> files...   (contact sheet for review)
import { browser } from "./lib.mjs";
import fs from "node:fs";
import path from "node:path";
const [, , out, cols, cell, ...files] = process.argv;
const imgs = files.map((f) => `<figure><img src="data:image/png;base64,${fs.readFileSync(f).toString("base64")}"><figcaption>${path.basename(f, ".png")}</figcaption></figure>`).join("");
const html = `<style>body{margin:0;background:#ccc;font:bold 14px sans-serif}main{display:grid;grid-template-columns:repeat(${cols},${cell}px);gap:10px;padding:10px}figure{margin:0}img{width:100%;display:block;outline:1px solid #999}</style><main>${imgs}</main>`;
const b = await browser();
const p = await b.newPage({ viewport: { width: cols * (+cell + 10) + 10, height: 400 } });
await p.setContent(html);
await p.screenshot({ path: out, fullPage: true });
await b.close();
