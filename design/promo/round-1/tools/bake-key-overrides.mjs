// node tools/bake-key-overrides.mjs <dir>
// Bakes the Color Map Editor's choices into lab/data/key-overrides.json.
// <dir> holds the editor's "overrides" collection as JSON files, one per kind
// (as the ArtifactData tool saves them with out_dir: { id, data: { ways } }
// or just { ways }). Every explicit choice is kept, even one that matches the
// rules today, so it still holds if the rules change.
import fs from "node:fs";
import path from "node:path";
import { ROUND } from "./lib.mjs";
const dir = process.argv[2];
if (!dir) throw new Error("usage: node tools/bake-key-overrides.mjs <dir with the overrides JSON files>");
const out = {};
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".json")).sort()) {
    const doc = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    const ways = (doc.data ?? doc).ways ?? {};
    for (const [id, on] of Object.entries(ways)) if (typeof on === "boolean") out[id] = on;
    console.log(f, Object.keys(ways).length, "ways");
}
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(path.join(ROUND, "lab/data/key-overrides.json"), JSON.stringify(sorted, null, 0) + "\n");
console.log("wrote lab/data/key-overrides.json:", Object.keys(sorted).length, "ways,", Object.values(sorted).filter(Boolean).length, "on");
