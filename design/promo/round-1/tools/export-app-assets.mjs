// Round 2: the app's two pieces of fixed artwork, rendered from the lab once
// and committed to src/ (the app has no build step and never loads design/).
//
//   node tools/export-app-assets.mjs
//
// - src/img/home.png: the home screen, W54.1b4 (lab/home3.js), at 3x.
// - The header's title: "HIDE &" set in Arimo, then the logo's STALK (L16.6b,
//   lab/logo.js) placed off its measured box exactly as app/decorate.js's
//   headerLogo() does. Printed to stdout as one <svg>, for src/index.html.
import fs from "node:fs";
import path from "node:path";
import { serve, browser, context, ROUND, REPO } from "./lib.mjs";

const { server, base } = await serve(7600 + Math.floor(Math.random() * 300));
const b = await browser();

// The home screen, at the post's 3x.
{
    const ctx = await context(b, { viewport: { width: 375, height: 812 }, dpr: 3 });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.error("pageerror:", e.message));
    await page.goto(`${base}/design/promo/round-1/lab/view.html?set=welcome&v=54.1b4&w=375&h=812`);
    await page.waitForSelector("body[data-ready='1']", { timeout: 60000 });
    const out = path.join(REPO, "src/img/home.png");
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.locator("#root").screenshot({ path: out });
    console.error("wrote", path.relative(REPO, out));
    await ctx.close();
}

// The header's title.
{
    const ctx = await context(b, { viewport: { width: 375, height: 200 } });
    const page = await ctx.newPage();
    await page.goto(`${base}/design/promo/round-1/lab/view.html?set=arrow&v=1&w=375&h=200`);
    await page.waitForSelector("body[data-ready='1']", { timeout: 60000 });
    const svg = await page.evaluate(() => {
        const FONT = "Arimo, 'Helvetica Neue', Helvetica, Arial, sans-serif";
        const holder = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        holder.setAttribute("width", 200);
        holder.setAttribute("height", 42);
        document.body.appendChild(holder);
        holder.innerHTML = `<text x="0" y="28" font-family="${FONT}" font-weight="700" font-size="19" letter-spacing="-0.3">HIDE &amp;</text>`;
        const a = holder.querySelector("text").getBBox();
        const st = window.Logo.stalk({ color: "#000" });
        const k = 27 / st.box.h;
        const x = a.x + a.width + 7;
        const r = (n) => Math.round(n * 1000) / 1000;
        // STALK's paths, their fill left to the page (currentColor), so the
        // app can turn it red when nothing else on screen is.
        const paths = st.svg.replace(/fill="#000(000)?"/gi, "");
        return `<svg class="title-svg" width="200" height="42" viewBox="0 0 200 42" role="img" aria-label="Hide and Stalk"><text x="0" y="28" font-family="${FONT}" font-weight="700" font-size="19" letter-spacing="-0.3" fill="#000">HIDE &amp;</text><g class="title-stalk" fill="currentColor" transform="translate(${r(x - 1.5 - st.box.x * k)} ${r(31.5 - (st.box.y + st.box.h) * k)}) scale(${r(k)})">${paths}</g></svg>`;
    });
    process.stdout.write(svg + "\n");
    await ctx.close();
}

await b.close();
server.close();
void ROUND;
