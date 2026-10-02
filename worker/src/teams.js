// Teams, and the clock every team runs on its own.
//
// The admin sets teams up ahead of time. After that each team is autonomous:
// anyone on it presses Start whenever the team is ready, the hider gets HIDE_MS
// to go hide, and then the stalkers get a new question every
// QUESTION_INTERVAL_MS. There are MAX_QUESTIONS of them. The moment question 7
// would arrive the hunt is over and the hider has won; finding the hider before
// that ends it the other way.
//
// Nothing counts down in the database. A team row only says when it started
// and how long it has been paused; the phase, the current question and the
// time left are all worked out from that clock whenever someone asks. The one
// deadline that has to be written down - question 7 arriving - is applied
// lazily by the first request that notices it (there is no cron).

export const HIDE_MS = 10 * 60 * 1000;
export const QUESTION_INTERVAL_MS = 5 * 60 * 1000;
export const MAX_QUESTIONS = 6;
// Debug mode: a whole round in seven minutes, so a test game fits in a break.
export const DEBUG_HIDE_MS = 60 * 1000;
export const DEBUG_QUESTION_INTERVAL_MS = 60 * 1000;
// "Make teams" aims for this many players per team by default: one hider,
// three stalkers. The admin can ask for anything from MIN to MAX instead.
export const TARGET_TEAM_SIZE = 4;
export const MAX_TEAM_SIZE = 8;
// The smallest team that can play: one hider + one stalker.
export const MIN_TEAM_SIZE = 2;

const httpError = (message, status) => Object.assign(new Error(message), { status });

function randomHex(bytes) {
    return [...crypto.getRandomValues(new Uint8Array(bytes))]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ---------------------------------------------------------------------------
// The clock
// ---------------------------------------------------------------------------
const hideMsOf = (team) => team.hide_ms ?? HIDE_MS;
const intervalMsOf = (team) => team.interval_ms ?? QUESTION_INTERVAL_MS;
const huntLengthMsOf = (team) => intervalMsOf(team) * MAX_QUESTIONS;

/** Ms since Start, pauses excluded. Frozen while paused and once the round ends. */
export function teamClockMs(team, now) {
    if (!team.started_at) return 0;
    const end = team.status === "ended" ? (team.ended_at ?? now) : (team.paused_at ?? now);
    return Math.max(0, end - team.started_at - team.paused_total_ms);
}

/**
 * Where a team is in its round.
 *   ready    waiting for Start
 *   hiding   the hider is hiding; hideRemainingMs until the hunt
 *   hunting  question `question` of MAX_QUESTIONS is on the table
 *   ended    over; `outcome` says who won
 * A playing team whose clock has run past question 6 is reported as `overdue`
 * so the caller can settle it (see settleTeam).
 */
export function teamPhase(team, now) {
    if (team.status === "ready") return { phase: "ready" };
    if (team.status === "ended") return { phase: "ended" };
    const clock = teamClockMs(team, now);
    const hideMs = hideMsOf(team);
    if (clock < hideMs) {
        return { phase: "hiding", clockMs: clock, hideRemainingMs: hideMs - clock };
    }
    const huntMs = clock - hideMs;
    const intervalMs = intervalMsOf(team);
    if (huntMs >= huntLengthMsOf(team)) return { phase: "overdue", clockMs: clock, huntMs };
    return {
        phase: "hunting",
        clockMs: clock,
        huntMs,
        question: Math.floor(huntMs / intervalMs) + 1,
        nextQuestionInMs: intervalMs - (huntMs % intervalMs),
        huntRemainingMs: huntLengthMsOf(team) - huntMs,
    };
}

/**
 * What a team looks like to its players (and to the admin board). A team that
 * has not started yet shows the timers it would get if it started now, which
 * depends on debug mode.
 */
export function publicTeam(team, now, { debug = false } = {}) {
    const state = teamPhase(team, now);
    const notStarted = team.status === "ready";
    return {
        id: team.id,
        status: team.status,
        phase: state.phase,
        paused: Boolean(team.paused_at) && team.status === "playing",
        hideMs: notStarted ? (debug ? DEBUG_HIDE_MS : HIDE_MS) : hideMsOf(team),
        intervalMs: notStarted
            ? debug
                ? DEBUG_QUESTION_INTERVAL_MS
                : QUESTION_INTERVAL_MS
            : intervalMsOf(team),
        maxQuestions: MAX_QUESTIONS,
        startedAt: team.started_at ?? null,
        hideRemainingMs: state.hideRemainingMs ?? null,
        question: state.question ?? null,
        nextQuestionInMs: state.nextQuestionInMs ?? null,
        huntMs: team.status === "ended" ? (team.hunt_ms ?? 0) : (state.huntMs ?? null),
        huntRemainingMs: state.huntRemainingMs ?? null,
        outcome: team.outcome ?? null,
        hiderName: team.hider_name ?? null,
        caughtByName: team.caught_by_name ?? null,
        endedAt: team.ended_at ?? null,
    };
}

// ---------------------------------------------------------------------------
// Reading teams (with any deadline that has passed already applied)
// ---------------------------------------------------------------------------
const getTeamRow = (env, teamId) =>
    env.DB.prepare("SELECT * FROM teams WHERE id = ?").bind(teamId).first();

/**
 * End a round. Guarded on status, so two requests noticing the same catch or
 * the same deadline cannot both record it.
 * @param {{outcome: "seekers"|"hider", caughtByName?: string, at: number}} how
 * @returns {Promise<boolean>} whether this call was the one that ended it
 */
export async function endRound(env, team, { outcome, caughtByName = null, at }) {
    // A catch while the admin had the team paused: the clock stopped at the
    // pause, so fold it in before stamping the end.
    const pausedTotal = team.paused_at
        ? team.paused_total_ms + Math.max(0, at - team.paused_at)
        : team.paused_total_ms;
    const clock = Math.max(0, at - team.started_at - pausedTotal);
    const huntMs = Math.min(huntLengthMsOf(team), Math.max(0, clock - hideMsOf(team)));
    const hider = await env.DB.prepare(
        "SELECT username FROM users WHERE group_id = ? AND role = 'hider' AND is_admin = 0",
    )
        .bind(team.id)
        .first();
    const asked = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM card_plays WHERE group_id = ?",
    )
        .bind(team.id)
        .first();
    const res = await env.DB.prepare(
        `UPDATE teams SET status = 'ended', ended_at = ?, paused_at = NULL,
             paused_total_ms = ?, outcome = ?, hider_name = ?, caught_by_name = ?,
             hunt_ms = ?
         WHERE id = ? AND status = 'playing'`,
    )
        .bind(at, pausedTotal, outcome, hider?.username ?? null, caughtByName, huntMs, team.id)
        .run();
    if (!res.meta.changes) return false;
    await env.DB.prepare(
        `INSERT INTO rounds (team_id, hider_name, outcome, caught_by_name, hunt_ms, questions, ended_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
        .bind(team.id, hider?.username ?? null, outcome, caughtByName, huntMs, asked?.n ?? 0, at)
        .run();
    return true;
}

/** If question 7 has arrived, the hider has won: write that down. */
async function settleTeam(env, team, now) {
    if (!team || team.status !== "playing" || team.paused_at) return team;
    if (teamPhase(team, now).phase !== "overdue") return team;
    // Backdate to the deadline itself, so the result reads exactly 6 questions
    // of hunting however late this request happened to arrive.
    const deadline =
        team.started_at + team.paused_total_ms + hideMsOf(team) + huntLengthMsOf(team);
    await endRound(env, team, { outcome: "hider", at: deadline });
    return getTeamRow(env, team.id);
}

/** One team, settled. null when it does not exist. */
export async function loadTeam(env, teamId, now) {
    if (!teamId) return null;
    return settleTeam(env, await getTeamRow(env, teamId), now);
}

/** Every team, settled, in number order. */
export async function loadTeams(env, now) {
    const { results } = await env.DB.prepare("SELECT * FROM teams ORDER BY id").all();
    const teams = [];
    for (const team of results) teams.push(await settleTeam(env, team, now));
    return teams;
}

// ---------------------------------------------------------------------------
// A team's own buttons: Start and Play again
// ---------------------------------------------------------------------------
const clearTeamCards = (env, teamId) => [
    env.DB.prepare("DELETE FROM card_plays WHERE group_id = ?").bind(teamId),
    env.DB.prepare("DELETE FROM card_batches WHERE group_id = ?").bind(teamId),
];

async function teamMembers(env, teamId) {
    const { results } = await env.DB.prepare(
        "SELECT id, username, role FROM users WHERE group_id = ? AND is_admin = 0 ORDER BY id",
    )
        .bind(teamId)
        .all();
    return results;
}

/**
 * Start a team's round: the hider has hide_ms to hide from now. `debug` makes
 * it a seven-minute test round. Pressing Start twice is harmless.
 */
export async function startTeam(env, teamId, now, { debug = false } = {}) {
    const team = await getTeamRow(env, teamId);
    if (!team) throw httpError("That team does not exist", 404);
    if (team.status === "playing") return team; // a teammate beat us to it
    if (team.status !== "ready") {
        throw httpError("This round is over — press Play again first", 409);
    }
    const members = await teamMembers(env, teamId);
    const hiders = members.filter((m) => m.role === "hider").length;
    if (hiders !== 1) throw httpError("Your team needs a hider — ask the admin", 409);
    if (members.length < MIN_TEAM_SIZE) {
        throw httpError("Your team needs at least one stalker — ask the admin", 409);
    }
    const res = await env.DB.prepare(
        `UPDATE teams SET status = 'playing', started_at = ?, hide_ms = ?, interval_ms = ?,
             paused_at = NULL, paused_total_ms = 0, ended_at = NULL, outcome = NULL,
             hider_name = NULL, caught_by_name = NULL, hunt_ms = NULL
         WHERE id = ? AND status = 'ready'`,
    )
        .bind(
            now,
            debug ? DEBUG_HIDE_MS : HIDE_MS,
            debug ? DEBUG_QUESTION_INTERVAL_MS : QUESTION_INTERVAL_MS,
            teamId,
        )
        .run();
    if (res.meta.changes) {
        // Fresh codes for everyone, not just the hider: a screenshot of last
        // round's QR has to stop working, and the admin can still swap roles.
        await env.DB.batch([
            ...clearTeamCards(env, teamId),
            ...members.map((m) =>
                env.DB.prepare(
                    "UPDATE users SET catch_code = ?, cards_seen_at = 0 WHERE id = ?",
                ).bind(randomHex(8), m.id),
            ),
        ]);
    }
    return getTeamRow(env, teamId);
}

/**
 * Who hides next: one of the players who have hidden the fewest rounds so far
 * (every round in `rounds`, whichever team it was played in), at random, and
 * never the one who just hid unless they are the only one there. So everyone
 * gets the same number of turns at hiding, in no set order.
 */
async function nextHider(env, members) {
    if (!members.length) return null;
    const { results } = await env.DB.prepare(
        `SELECT hider_name, COUNT(*) AS n FROM rounds
         WHERE hider_name IN (${members.map(() => "?").join(", ")})
         GROUP BY hider_name`,
    )
        .bind(...members.map((m) => m.username))
        .all();
    const hid = new Map(results.map((r) => [r.hider_name, r.n]));
    const times = (m) => hid.get(m.username) ?? 0;
    const others = members.filter((m) => m.role !== "hider");
    const pool = others.length ? others : members;
    const fewest = Math.min(...pool.map(times));
    const due = pool.filter((m) => times(m) === fewest);
    return due[Math.floor(Math.random() * due.length)];
}

/**
 * After a round: back to ready, with a new hider (nextHider). The finished
 * round stays in `rounds`.
 */
export async function playAgain(env, teamId) {
    const team = await getTeamRow(env, teamId);
    if (!team) throw httpError("That team does not exist", 404);
    if (team.status === "ready") return team; // a teammate beat us to it
    if (team.status !== "ended") throw httpError("This round is still going", 409);
    const members = await teamMembers(env, teamId);
    const next = await nextHider(env, members);
    const res = await env.DB.prepare(
        `UPDATE teams SET status = 'ready', started_at = NULL, paused_at = NULL,
             paused_total_ms = 0, ended_at = NULL, outcome = NULL, hider_name = NULL,
             caught_by_name = NULL, hunt_ms = NULL
         WHERE id = ? AND status = 'ended'`,
    )
        .bind(teamId)
        .run();
    if (res.meta.changes && next) {
        await env.DB.batch([
            ...clearTeamCards(env, teamId),
            env.DB.prepare(
                "UPDATE users SET role = CASE WHEN id = ? THEN 'hider' ELSE 'stalker' END WHERE group_id = ? AND is_admin = 0",
            ).bind(next.id, teamId),
        ]);
    }
    return getTeamRow(env, teamId);
}

// ---------------------------------------------------------------------------
// Admin: forming teams and stepping in
// ---------------------------------------------------------------------------
/** The smallest team numbers not in use, so numbers stay short. */
async function freeTeamIds(env, count) {
    const { results } = await env.DB.prepare("SELECT id FROM teams").all();
    const used = new Set(results.map((r) => r.id));
    const ids = [];
    for (let id = 1; ids.length < count; id++) if (!used.has(id)) ids.push(id);
    return ids;
}

/**
 * Split every player not yet in a team into new teams of about `size`, one
 * hider each. Teams that already exist are untouched, so this can be pressed
 * again for latecomers. Returns how many teams it made.
 */
export async function makeTeams(env, now, size = TARGET_TEAM_SIZE) {
    if (!Number.isInteger(size) || size < MIN_TEAM_SIZE || size > MAX_TEAM_SIZE) {
        throw httpError(
            `Team size must be between ${MIN_TEAM_SIZE} and ${MAX_TEAM_SIZE}`,
            400,
        );
    }
    const { results } = await env.DB.prepare(
        "SELECT id FROM users WHERE is_admin = 0 AND group_id IS NULL",
    ).all();
    const ids = shuffle(results.map((r) => r.id));
    if (ids.length < MIN_TEAM_SIZE) {
        throw httpError(
            ids.length
                ? "Only one player is waiting — drag them into a team instead"
                : "Everyone is already in a team",
            400,
        );
    }
    // Rounding up could leave a team of one (5 players in teams of 2 would be
    // 2 + 2 + 1), and a lone hider has nobody hunting them.
    const teamCount = Math.max(
        1,
        Math.min(Math.round(ids.length / size), Math.floor(ids.length / MIN_TEAM_SIZE)),
    );
    const teamIds = await freeTeamIds(env, teamCount);
    await env.DB.batch([
        ...teamIds.map((id) =>
            env.DB.prepare(
                "INSERT INTO teams (id, status, created_at) VALUES (?, 'ready', ?)",
            ).bind(id, now),
        ),
        ...ids.map((userId, i) =>
            env.DB.prepare(
                "UPDATE users SET group_id = ?, role = ?, catch_code = ? WHERE id = ?",
            ).bind(
                teamIds[i % teamCount],
                i < teamCount ? "hider" : "stalker",
                randomHex(8),
                userId,
            ),
        ),
    ]);
    return teamCount;
}

/**
 * Move one player, online or not. `teamId` is a team number, "new" for a new
 * team, or null to take them out of every team. Making someone the hider turns
 * the old hider into a stalker; taking a team's hider away hands the role to
 * whoever has been on it longest. Teams left empty are deleted.
 */
export async function assignPlayer(env, now, { userId, teamId, role }) {
    const target = await env.DB.prepare(
        "SELECT id, is_admin, group_id, role FROM users WHERE id = ?",
    )
        .bind(userId)
        .first();
    if (!target) throw httpError("Player not found", 404);
    if (target.is_admin) throw httpError("Admins do not play", 400);

    let destination = teamId;
    if (teamId === "new") {
        [destination] = await freeTeamIds(env, 1);
        await env.DB.prepare(
            "INSERT INTO teams (id, status, created_at) VALUES (?, 'ready', ?)",
        )
            .bind(destination, now)
            .run();
    } else if (teamId !== null && !(await getTeamRow(env, teamId))) {
        throw httpError("That team does not exist", 400);
    }

    const statements = [];
    if (destination !== null && role === "hider") {
        statements.push(
            env.DB.prepare(
                "UPDATE users SET role = 'stalker' WHERE group_id = ? AND role = 'hider' AND id != ?",
            ).bind(destination, userId),
        );
    }
    statements.push(
        env.DB.prepare(
            `UPDATE users SET group_id = ?, role = ?,
                 catch_code = COALESCE(catch_code, ?) WHERE id = ?`,
        ).bind(destination, destination === null ? null : role, randomHex(8), userId),
    );
    await env.DB.batch(statements);

    // Every team keeps exactly one hider: the one they joined (a first player
    // dropped on a brand-new team's stalker slot is still its only player) and
    // the one they left. A team left with nobody on it goes away.
    const touched = new Set([destination, target.group_id].filter((id) => id !== null));
    for (const id of touched) {
        const members = await teamMembers(env, id);
        if (!members.length) {
            await env.DB.batch([
                ...clearTeamCards(env, id),
                env.DB.prepare("DELETE FROM teams WHERE id = ?").bind(id),
            ]);
        } else if (!members.some((m) => m.role === "hider")) {
            await env.DB.prepare("UPDATE users SET role = 'hider' WHERE id = ?")
                .bind(members[0].id)
                .run();
        }
    }
}

/** The admin's own buttons on one team. */
export async function adminTeamAction(env, teamId, action, now, { debug = false } = {}) {
    const team = await loadTeam(env, teamId, now);
    if (!team) throw httpError("That team does not exist", 404);
    switch (action) {
        case "start":
            return startTeam(env, teamId, now, { debug });
        case "pause":
            if (team.status !== "playing") throw httpError("That team is not playing", 409);
            await env.DB.prepare(
                "UPDATE teams SET paused_at = ? WHERE id = ? AND paused_at IS NULL",
            )
                .bind(now, teamId)
                .run();
            return getTeamRow(env, teamId);
        case "resume":
            await env.DB.prepare(
                `UPDATE teams SET paused_total_ms = paused_total_ms + (? - paused_at),
                     paused_at = NULL
                 WHERE id = ? AND paused_at IS NOT NULL`,
            )
                .bind(now, teamId)
                .run();
            return getTeamRow(env, teamId);
        case "reset":
            // Back to ready without recording anything: for a round that went
            // wrong, not one that was played out.
            await env.DB.batch([
                ...clearTeamCards(env, teamId),
                env.DB.prepare(
                    `UPDATE teams SET status = 'ready', started_at = NULL, paused_at = NULL,
                         paused_total_ms = 0, ended_at = NULL, outcome = NULL,
                         hider_name = NULL, caught_by_name = NULL, hunt_ms = NULL
                     WHERE id = ?`,
                ).bind(teamId),
            ]);
            return getTeamRow(env, teamId);
        default:
            throw httpError("Unknown action", 400);
    }
}

/** Everyone back to unassigned. Finished rounds stay, so the results survive. */
export async function disbandTeams(env) {
    await env.DB.batch([
        env.DB.prepare("UPDATE users SET group_id = NULL, role = NULL, cards_seen_at = 0"),
        env.DB.prepare("DELETE FROM card_plays"),
        env.DB.prepare("DELETE FROM card_batches"),
        env.DB.prepare("DELETE FROM teams"),
    ]);
}
