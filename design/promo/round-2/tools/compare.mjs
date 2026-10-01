// Side-by-side sheets: each gallery screen (the target, design/promo/round-1/
// gallery/img) next to the real app shot the same way (round-1's
// tools/shoot-app.mjs real -> round-1/shots/real).
//
//   node design/promo/round-2/tools/compare.mjs [section ...]
//
// Writes design/promo/round-2/<section>.png, one sheet per gallery section.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { browser } from "../../round-1/tools/lib.mjs";

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GALLERY = path.resolve(HERE, "../round-1/gallery/img");
const REAL = path.resolve(HERE, "../round-1/shots/real");

// [code, caption, gallery image, real shot]
export const SECTIONS = {
    "1-opening": [["S12a", "Home screen", "W54.1b4.png", "R-home.png"]],
    "2-login": [
        ["S21", "Log in", "E-01-login.png", "R-login.png"],
        ["S22", "Both fields typed", "E-02-loginfilled.png", "R-loginfilled.png"],
        ["S23", "Before you start", "E-03-permask.png", "R-permask.png"],
        ["S24", "Asking", "E-04-permasking.png", "R-permasking.png"],
        ["S25", "Location on", "E-05-permhalf.png", "R-permhalf.png"],
        ["S26", "Both on: Done", "E-06-permdone.png", "R-permdone.png"],
        ["S27", "Location blocked", "E-07-permblocked.png", "R-permblocked.png"],
    ],
    "3-lobby": [
        ["S31", "Waiting for a team", "E-08-lobby.png", "R-lobby.png"],
        ["S32", "Ready: the role stamped", "E-12-ready.png", "R-ready.png"],
    ],
    "4-hider": [
        ["S41", "Go hide", "E-13-hiding.png", "R-hiding.png"],
        ["S42", "A new question", "E-19-question.png", "R-question.png"],
        ["S43", "Which pavilion", "E-20-choice.png", "R-choice.png"],
        ["S44", "Found: the tag code", "E-21-tagcode.png", "R-tagcode.png"],
    ],
    "5-stalkers": [
        ["S51", "Three cards", "E-14-cards.png", "R-cards.png"],
        ["S51.5", "Post 2: one picked", "E-25-cardspick.png", "R-cardspick.png"],
        ["S52", "Picked, not sent", "E-15-selected.png", "R-selected.png"],
        ["S53", "Sent: locked in", "E-16-waiting.png", "R-waiting.png"],
        ["S54", "Answered", "E-17-sent.png", "R-sent.png"],
        ["S55", "Post 4: a photo answer", "E-18a-photo.png", "R-photo.png"],
        ["S56", "Questions so far", "E-22-history.png", "R-history.png"],
    ],
    "6-map": [
        ["S61", "Post 5: hints layer", "Pg9a.png", "R-g9a.png"],
        ["S62", "A stalker tapped", "Pg10a.png", "R-g10a.png"],
        ["S63", "Post 3: nearest àVélo", "Pv2c.png", "R-v2c.png"],
        ["S64", "A station tapped", "Pv8c.png", "R-v8c.png"],
        ["S65", "Closer to the greenhouse", "N10.2.png", "R-N10.2.png"],
        ["S66", "East or west", "N12.png", "R-N12.png"],
        ["S67", "Within 200 m", "N14.png", "R-N14.png"],
        ["S68", "Between questions", "Pg11a.png", "R-g11a.png"],
        ["S69", "Post 6: north or south", "Pn11d.png", "R-n11d.png"],
    ],
    "7-end": [
        ["S71", "Stalkers win", "E-23-found.png", "R-found.png"],
        ["S72", "Their receipt, to its end", "E-23b-found.png", "R-foundb.png"],
        ["S73", "The hider wins", "E-24-win.png", "R-win.png"],
        ["S74", "Her receipt, to its end", "E-24b-win.png", "R-winb.png"],
    ],
};

const wanted = process.argv.slice(2);
const b = await browser();
for (const [name, pairs] of Object.entries(SECTIONS)) {
    if (wanted.length && !wanted.some((w) => name.includes(w))) continue;
    const img = (file) => (fs.existsSync(file) ? `<img src="data:image/png;base64,${fs.readFileSync(file).toString("base64")}">` : `<div class="missing">not shot</div>`);
    const cells = pairs
        .map(([code, cap, g, r]) => `<section><h2>${code} · ${cap}</h2><div class="pair"><figure>${img(path.join(GALLERY, g))}<figcaption>Gallery (target): ${g}</figcaption></figure><figure>${img(path.join(REAL, r))}<figcaption>The app (round 2)</figcaption></figure></div></section>`)
        .join("");
    const cols = Math.min(pairs.length, 2);
    const html = `<style>body{margin:0;background:#fff;font:15px Arial,sans-serif;color:#000}main{display:grid;grid-template-columns:repeat(${cols},auto);gap:28px;padding:20px}section{border:3px solid #000;padding:12px}h2{margin:0 0 10px;font-size:17px}.pair{display:grid;grid-template-columns:375px 375px;gap:14px}figure{margin:0}img{width:375px;display:block;outline:1px solid #999}figcaption{font-size:12px;margin-top:6px}.missing{width:375px;height:812px;display:flex;align-items:center;justify-content:center;background:#eee}</style><main>${cells}</main>`;
    const p = await b.newPage({ viewport: { width: cols * 810 + 60, height: 600 } });
    await p.setContent(html);
    const out = path.join(HERE, `${name}.png`);
    await p.screenshot({ path: out, fullPage: true });
    await p.close();
    console.log("wrote", path.relative(path.resolve(HERE, "../../.."), out));
}
await b.close();
