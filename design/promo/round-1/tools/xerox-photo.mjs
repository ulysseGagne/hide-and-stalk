// The xerox treatment for E18's stand-in photo: every pixel pure black or
// pure white. Most of it is a plain threshold (140 of 255); on the column's
// faces, where the metal darkens smoothly toward the bottom, each pixel
// is weighed against the grey around it instead, so the face stays white and
// only the holes cut through the sculpture (much darker than their
// surroundings) and its solid shadows go black. Everything outside the column is left as is.
//
//   node tools/xerox-photo.mjs <photo.jpg>   → app/sculpture.png (900 px wide)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const W = 900;
const src = process.argv[2];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "xerox-"));
execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", src, "-vf", `scale=${W}:-1,format=gray`, "-f", "rawvideo", path.join(tmp, "g.raw")]);
const g = fs.readFileSync(path.join(tmp, "g.raw"));
const H = g.length / W;

// The column, in 900-px-wide coordinates: its front face with the sculpture's
// ring, and its left face, out to the building's edge (228,198 to 0,660).
const FACE = [[228, 198], [556, 146], [588, 380], [690, 410], [760, 470], [792, 540], [780, 610], [735, 655], [672, 680], [728, 930], [740, H], [0, H], [0, 664], [4, 657]];
const inside = (x, y) => {
    let c = false;
    for (let i = 0, j = FACE.length - 1; i < FACE.length; j = i++) {
        const [xi, yi] = FACE[i];
        const [xj, yj] = FACE[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
};

// The local mean grey, over a (2R+1)² box, from a summed-area table.
const R = 30;
const sat = new Float64Array((W + 1) * (H + 1));
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) sat[(y + 1) * (W + 1) + x + 1] = g[y * W + x] + sat[y * (W + 1) + x + 1] + sat[(y + 1) * (W + 1) + x] - sat[y * (W + 1) + x];
const mean = (x, y) => {
    const x0 = Math.max(0, x - R), x1 = Math.min(W, x + R + 1), y0 = Math.max(0, y - R), y1 = Math.min(H, y + R + 1);
    return (sat[y1 * (W + 1) + x1] - sat[y0 * (W + 1) + x1] - sat[y1 * (W + 1) + x0] + sat[y0 * (W + 1) + x0]) / ((x1 - x0) * (y1 - y0));
};

const out = Buffer.alloc(W * H);
for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
        const v = g[y * W + x];
        // Truly dark parts (the sculpture's solid shadows) stay black whatever surrounds them;
        // the metal only gets that dark near the bottom, well below the screen's crop.
        const white = inside(x, y) ? v > 140 || (v > mean(x, y) - 30 && v > (y < 760 ? 55 : 25)) : v > 140;
        out[y * W + x] = white ? 255 : 0;
    }
fs.writeFileSync(path.join(tmp, "o.pgm"), Buffer.concat([Buffer.from(`P5\n${W} ${H}\n255\n`), out]));
const dest = path.join(path.dirname(new URL(import.meta.url).pathname), "../app/sculpture.png");
execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-i", path.join(tmp, "o.pgm"), "-pix_fmt", "monob", dest]);
console.log("wrote", dest);
