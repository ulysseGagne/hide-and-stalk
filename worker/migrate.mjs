// Run a migration one statement at a time, so an already-applied step cannot
// take the rest of the file down with it.
//
//   node migrate.mjs               every migration, local
//   node migrate.mjs --remote      every migration, against the deployed DB
//   node migrate.mjs --remote 0005 just that one
//
// Why this exists: `wrangler d1 execute --file=...` sends the file as one unit,
// and SQLite has no `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. So re-running a
// migration that is half-applied fails on its first ALTER and silently skips
// everything after it — which is how you end up with `duration_ms` present but
// the `catches` table missing, and every /state answering 500.
//
// Here each statement is its own execute, and the two errors that mean "this
// step was already done" are counted as successes rather than fatal.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, "migrations");

const args = process.argv.slice(2);
const remote = args.includes("--remote");
const only = args.find((a) => !a.startsWith("--"));

// "duplicate column name: x" and "table x already exists" both mean the step is
// already in place. Anything else is a real failure and stops the run.
const ALREADY_APPLIED = /duplicate column name|already exists/i;

/** Statements of one .sql file, comments stripped. */
function statements(sql) {
    return sql
        .split("\n")
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean);
}

// Run wrangler's entry point under this same node, rather than through the
// `npx`/`.cmd` shim: no shell means the SQL goes across as one argv entry, so
// its newlines, commas and parentheses arrive intact.
const WRANGLER = join(HERE, "node_modules", "wrangler", "bin", "wrangler.js");

function execute(sql) {
    execFileSync(
        process.execPath,
        [
            WRANGLER, "d1", "execute", "hidenstalk",
            remote ? "--remote" : "--local",
            ...(remote ? ["-y"] : []),
            "--command", sql,
        ],
        { cwd: HERE, stdio: "pipe" },
    );
}

const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => !only || f.startsWith(only))
    .sort();

if (!files.length) {
    console.error(only ? `no migration matching "${only}"` : "no migrations found");
    process.exit(1);
}

console.log(`${remote ? "REMOTE" : "local"} database — ${files.length} migration(s)\n`);
let failed = 0;

for (const file of files) {
    console.log(file);
    for (const sql of statements(readFileSync(join(MIGRATIONS, file), "utf8"))) {
        const label = sql.replace(/\s+/g, " ").slice(0, 68);
        try {
            execute(sql);
            console.log(`  applied  ${label}`);
        } catch (err) {
            const text = `${err.stdout ?? ""}${err.stderr ?? ""}`;
            if (ALREADY_APPLIED.test(text)) {
                console.log(`  already  ${label}`);
            } else {
                failed++;
                console.log(`  FAILED   ${label}`);
                console.log(`           ${text.trim().split("\n").slice(-3).join("\n           ")}`);
            }
        }
    }
    console.log("");
}

console.log(failed ? `${failed} statement(s) failed` : "database is up to date");
process.exit(failed ? 1 : 0);
