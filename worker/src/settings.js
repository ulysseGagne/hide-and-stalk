// The admin's switches: debug mode and its own options, the Discord invite
// link (the club server's, DISCORD_URL in wrangler.toml, until an admin saves
// another), and which of the game-day to-dos are ticked. One row per key in
// the `settings` table.

const MAX_URL_LENGTH = 300;
const MAX_TODO_ID_LENGTH = 40;
const MAX_TODOS = 50;

const httpError = (message, status) => Object.assign(new Error(message), { status });

// Debug mode's own switches, each only in force while debug mode is on:
//   debugNoHide         a round that starts skips the hiding time
//   debugAllQuestions   the stalkers have all six questions in hand at once
//   debugFakeLocation   a player can put themselves anywhere on the map
const DEBUG_OPTIONS = {
    debugNoHide: "debug_no_hide",
    debugAllQuestions: "debug_all_questions",
    debugFakeLocation: "debug_fake_location",
};

export async function getSettings(env) {
    const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
    const raw = Object.fromEntries(results.map((r) => [r.key, r.value]));
    let todosDone = [];
    try {
        const parsed = JSON.parse(raw.todos_done ?? "[]");
        if (Array.isArray(parsed)) todosDone = parsed.filter((t) => typeof t === "string");
    } catch {
        /* a mangled value just means nothing is ticked */
    }
    return {
        debug: raw.debug === "1",
        ...Object.fromEntries(Object.entries(DEBUG_OPTIONS).map(([name, key]) => [name, raw[key] === "1"])),
        discordUrl: raw.discord_url || env.DISCORD_URL || null,
        todosDone,
    };
}

/** What every player gets: enough to draw the debug strip, the Discord button, and to move YOU by hand. */
export const publicSettings = (settings) => ({
    debug: settings.debug,
    debugFakeLocation: settings.debug && settings.debugFakeLocation,
    discordUrl: settings.discordUrl,
});

/** What a team that starts now gets: debug timers, and no hiding time if that switch is on. Frozen at Start. */
export const startOptions = (settings) => ({ debug: settings.debug, noHide: settings.debug && settings.debugNoHide });

/** Whether the stalkers have all six questions in hand at once (debug), not one per interval. */
export const allQuestionsAtOnce = (settings) => settings.debug && settings.debugAllQuestions;

/**
 * Apply whichever of { debug, debugNoHide, debugAllQuestions, debugFakeLocation,
 * discordUrl, todosDone } the body carries and
 * return the full set afterwards.
 */
export async function updateSettings(env, body) {
    const writes = [];
    const put = (key, value) =>
        env.DB.prepare(
            "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        ).bind(key, value);

    if (body.debug !== undefined) {
        if (typeof body.debug !== "boolean") throw httpError("debug must be true or false", 400);
        writes.push(put("debug", body.debug ? "1" : "0"));
    }
    for (const [name, key] of Object.entries(DEBUG_OPTIONS)) {
        if (body[name] === undefined) continue;
        if (typeof body[name] !== "boolean") throw httpError(`${name} must be true or false`, 400);
        writes.push(put(key, body[name] ? "1" : "0"));
    }
    if (body.discordUrl !== undefined) {
        const url = typeof body.discordUrl === "string" ? body.discordUrl.trim() : "";
        // Only a real https link gets turned into a button on every phone.
        if (url && (!/^https:\/\/\S+$/i.test(url) || url.length > MAX_URL_LENGTH)) {
            throw httpError("Paste the full invite link, starting with https://", 400);
        }
        writes.push(put("discord_url", url));
    }
    if (body.todosDone !== undefined) {
        const ids = body.todosDone;
        if (
            !Array.isArray(ids) ||
            ids.length > MAX_TODOS ||
            ids.some((id) => typeof id !== "string" || !id || id.length > MAX_TODO_ID_LENGTH)
        ) {
            throw httpError("Invalid to-do list", 400);
        }
        writes.push(put("todos_done", JSON.stringify([...new Set(ids)])));
    }
    if (writes.length) await env.DB.batch(writes);
    return getSettings(env);
}
