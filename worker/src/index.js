// HideNStalk API — Cloudflare Worker backed by D1.
//
// Every team plays on its own clock: the admin sets teams up, and each team
// presses Start whenever it is ready (see teams.js for the rules of the clock).
//
// Endpoints (all JSON):
//   POST /register            { username, password }       -> { token, user }
//   POST /login               { username, password }       -> { token, user }
//   POST /logout              (Bearer token)               -> { ok }
//   GET  /me                  (Bearer token)               -> { user }
//   POST /location            (Bearer token) { lat, lng, accuracy?, fixAgeMs?, rttMs? }
//                             | { lat: null, lng: null, rttMs? }
//                             Doubles as the heartbeat: every call stamps last_seen_at.
//   GET  /state               (Bearer token)
//   POST /state               same, with the caller's position as the body (the
//                             /location fields): one request per poll, not two.
//                             players -> { serverNow, settings, me, team, users, cards }
//                             admins  -> { serverNow, settings, me, teams, users, results }
//                             `users` is scoped: a player sees only their own team,
//                             and within it only the stalkers' positions (the hider's
//                             is never sent to anyone but the hider until the round
//                             is over). Only admins get accuracy / rttMs / lastSeenAt.
//
// Team (any member of the team):
//   POST /team/start          start the round: hiding countdown, then the hunt
//   POST /team/again          after a round: back to ready, next player hides
//   POST /catch               (stalker) { code } from the hider's QR -> { caught }
//   POST /found               (stalker) end the hunt without a scan
//
// Admin-only (Bearer token of a user with is_admin = 1):
//   POST /admin/make-teams    { size? } split everyone not in a team into teams
//   POST /admin/assign        { userId, teamId: number|"new"|null, role } move a player
//   POST /admin/team          { teamId, action: start|pause|resume|reset }
//   POST /admin/disband       every team back to unassigned (results are kept)
//   POST /admin/clear         delete every non-admin account and everything else
//   POST /admin/settings      { debug?, discordUrl?, todosDone? }
//
// Cards:
//   GET  /cards/catalog       the deck + landmarks + play area (see cards.js)
//   POST /cards/pick          (stalker) { cardId } play one card from the live batch
//   POST /cards/answer        (hider)   { playId, answer } answer truthfully; sending
//                             it again for an answered card corrects it
//   POST /cards/seen          clear this user's bell
//   GET  /cards/history       every card the caller's team has played, with answers
//   GET  /cards/photo?playId= the photo answer for one play

import {
    CARDS_BY_ID,
    catalogPayload,
    validateAnswer,
} from "./cards.js";
import {
    cardIsInBatch,
    liveTeamBatch,
    publicBatch,
} from "./batches.js";
import {
    adminTeamAction,
    assignPlayer,
    disbandTeams,
    endRound,
    loadTeam,
    loadTeams,
    makeTeams,
    playAgain,
    publicTeam,
    startTeam,
    teamPhase,
    TARGET_TEAM_SIZE,
} from "./teams.js";
import { getSettings, publicSettings, updateSettings } from "./settings.js";

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 128;
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_HASH = "SHA-256";
const KEY_LENGTH_BYTES = 32;
// Positions older than this are treated as stale and returned as NULL; a
// device that has not checked in for this long counts as offline.
const LOCATION_STALE_MS = 2 * 60 * 1000;
// A "...than me?" card freezes the asker's position, so it has to be a recent
// one: a stalker whose GPS stopped updating a while ago may be far from it.
const ASKER_FIX_MAX_AGE_MS = 60 * 1000;
// Sanity caps for what a client reports alongside its position. Anything
// outside these is stored as NULL rather than rejected, so a quirky browser
// never breaks location sharing.
const MAX_ACCURACY_M = 100_000;
const MAX_RTT_MS = 60_000;
const MAX_FIX_AGE_MS = 24 * 60 * 60 * 1000;

// Photo answers are downscaled in the browser and stored inline in D1, so they
// have to stay small. ~400 KB of base64 is roughly a 300 KB JPEG.
const MAX_PHOTO_CHARS = 400_000;
// A hider's QR encodes this prefix plus their catch_code, so a stalker who
// scans a bus timetable gets told what went wrong instead of "invalid code".
const CATCH_CODE_PREFIX = "HNS1:";
const CATCH_CODE_RE = /^[a-f0-9]{16}$/;
// How many finished rounds the admin's results list shows.
const MAX_RESULTS = 100;

const ROLES = new Set(["hider", "stalker"]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function corsHeaders(request, env) {
    const origin = request.headers.get("Origin") ?? "";
    const allowed = (env.ALLOWED_ORIGINS ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    const allowOrigin = allowed.includes(origin) ? origin : allowed[0] ?? "";
    return {
        "Access-Control-Allow-Origin": allowOrigin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
    };
}

function json(data, status, request, env) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            ...corsHeaders(request, env),
        },
    });
}

function error(message, status, request, env) {
    return json({ error: message }, status, request, env);
}

function toHex(buf) {
    return [...new Uint8Array(buf)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

function fromHex(hex) {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
}

function randomHex(bytes) {
    return toHex(crypto.getRandomValues(new Uint8Array(bytes)));
}

async function deriveKey(password, saltHex) {
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveBits"],
    );
    const bits = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            hash: PBKDF2_HASH,
            salt: fromHex(saltHex),
            iterations: PBKDF2_ITERATIONS,
        },
        keyMaterial,
        KEY_LENGTH_BYTES * 8,
    );
    return toHex(bits);
}

function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return diff === 0;
}

async function readJson(request) {
    try {
        return await request.json();
    } catch {
        return null;
    }
}

function validateCredentials(body) {
    if (!body || typeof body !== "object") return "Invalid JSON body";
    const { username, password } = body;
    if (typeof username !== "string" || !USERNAME_RE.test(username)) {
        return "Username must be 3-20 characters: letters, numbers, underscore";
    }
    if (
        typeof password !== "string" ||
        password.length < MIN_PASSWORD_LENGTH ||
        password.length > MAX_PASSWORD_LENGTH
    ) {
        return `Password must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_LENGTH} characters`;
    }
    return null;
}

async function createSession(env, userId) {
    const token = randomHex(32);
    await env.DB.prepare(
        "INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
    )
        .bind(token, userId, Date.now())
        .run();
    return token;
}

async function authenticate(request, env) {
    const header = request.headers.get("Authorization") ?? "";
    const match = /^Bearer\s+([a-f0-9]{64})$/i.exec(header);
    if (!match) return null;
    const row = await env.DB.prepare(
        `SELECT u.id, u.username, u.is_admin, u.group_id, u.role, u.cards_seen_at
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token = ?`,
    )
        .bind(match[1])
        .first();
    return row ? { ...row, token: match[1] } : null;
}

function publicUser(row) {
    return {
        id: row.id,
        username: row.username,
        isAdmin: Boolean(row.is_admin),
        groupId: row.group_id ?? null,
        role: row.is_admin ? "admin" : (row.role ?? null),
        // Card answers newer than this are unread (header bell).
        cardsSeenAt: row.cards_seen_at ?? 0,
    };
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------
async function handleRegister(request, env) {
    const body = await readJson(request);
    const invalid = validateCredentials(body);
    if (invalid) return error(invalid, 400, request, env);

    const existing = await env.DB.prepare(
        "SELECT id FROM users WHERE username = ?",
    )
        .bind(body.username)
        .first();
    if (existing) return error("Username already taken", 409, request, env);

    const salt = randomHex(16);
    const hash = await deriveKey(body.password, salt);
    const result = await env.DB.prepare(
        `INSERT INTO users (username, password_hash, salt, created_at)
         VALUES (?, ?, ?, ?)`,
    )
        .bind(body.username, hash, salt, Date.now())
        .run();
    const userId = result.meta.last_row_id;
    const token = await createSession(env, userId);
    return json(
        {
            token,
            user: publicUser({
                id: userId,
                username: body.username,
                is_admin: 0,
                group_id: null,
                role: null,
            }),
        },
        201,
        request,
        env,
    );
}

async function handleLogin(request, env) {
    const body = await readJson(request);
    const invalid = validateCredentials(body);
    if (invalid) return error("Invalid username or password", 401, request, env);

    const row = await env.DB.prepare(
        `SELECT id, username, password_hash, salt, is_admin, group_id, role
         FROM users WHERE username = ?`,
    )
        .bind(body.username)
        .first();
    if (!row) return error("Invalid username or password", 401, request, env);

    const hash = await deriveKey(body.password, row.salt);
    if (!timingSafeEqual(hash, row.password_hash)) {
        return error("Invalid username or password", 401, request, env);
    }
    const token = await createSession(env, row.id);
    return json({ token, user: publicUser(row) }, 200, request, env);
}

async function handleLogout(request, env, user) {
    await env.DB.prepare("DELETE FROM sessions WHERE token = ?")
        .bind(user.token)
        .run();
    // Mark location as unknown once the user leaves, and drop presence so the
    // admin board shows them as disconnected rather than "last seen just now".
    await env.DB.prepare(
        `UPDATE users SET lat = NULL, lng = NULL, location_accuracy = NULL,
                net_rtt_ms = NULL, last_seen_at = NULL, location_updated_at = ?
         WHERE id = ?`,
    )
        .bind(Date.now(), user.id)
        .run();
    return json({ ok: true }, 200, request, env);
}

async function handleMe(request, env, user) {
    return json({ user: publicUser(user) }, 200, request, env);
}


/**
 * Store a position report (or "not sharing") for one user, and stamp the
 * heartbeat. Returns false when the coordinates are nonsense.
 */
async function recordLocation(env, userId, body, now) {
    let { lat, lng } = body;
    const isNull = lat === null || lng === null || lat === undefined || lng === undefined;
    if (!isNull) {
        lat = Number(lat);
        lng = Number(lng);
        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lng) ||
            lat < -90 ||
            lat > 90 ||
            lng < -180 ||
            lng > 180
        ) {
            return false;
        }
    }
    const inRange = (value, max) => {
        const n = Number(value);
        return value !== null && value !== undefined && Number.isFinite(n) && n >= 0 && n <= max
            ? n
            : null;
    };
    const accuracy = isNull ? null : inRange(body.accuracy, MAX_ACCURACY_M);
    const rtt = inRange(body.rttMs, MAX_RTT_MS);
    // Stamp the position with when the GPS produced it, not when it was sent.
    // A phone whose GPS has quietly stopped keeps sending its last fix; dated
    // honestly, that fix goes stale and drops off the map instead of standing
    // there looking live.
    const fixAge = isNull ? 0 : (inRange(body.fixAgeMs, MAX_FIX_AGE_MS) ?? 0);
    await env.DB.prepare(
        `UPDATE users SET lat = ?, lng = ?, location_accuracy = ?, net_rtt_ms = ?,
                last_seen_at = ?, location_updated_at = ?
         WHERE id = ?`,
    )
        .bind(
            isNull ? null : lat,
            isNull ? null : lng,
            accuracy,
            rtt === null ? null : Math.round(rtt),
            now,
            now - Math.round(fixAge),
            userId,
        )
        .run();
    return true;
}

async function handleLocation(request, env, user) {
    const body = await readJson(request);
    if (!body || typeof body !== "object") {
        return error("Invalid JSON body", 400, request, env);
    }
    if (!(await recordLocation(env, user.id, body, Date.now()))) {
        return error("Invalid coordinates", 400, request, env);
    }
    return json({ ok: true, shared: body.lat != null && body.lng != null }, 200, request, env);
}

function isOnline(row, now) {
    return row.last_seen_at !== null && now - row.last_seen_at <= LOCATION_STALE_MS;
}

function hasFreshPosition(row, now, maxAgeMs = LOCATION_STALE_MS) {
    return (
        row.lat !== null &&
        row.lng !== null &&
        row.location_updated_at !== null &&
        now - row.location_updated_at <= maxAgeMs
    );
}

const USER_COLUMNS = `id, username, is_admin, group_id, role, lat, lng, location_updated_at,
                      location_accuracy, net_rtt_ms, last_seen_at`;

/**
 * Snapshot of everything the caller is allowed to know.
 *  - Admins: every account with live positions, every team, the results.
 *  - Players in a team: their own team only. Every stalker's position goes to
 *    the whole team, the hider included, so the hider can watch the net close
 *    in. The hider's own coordinates never leave them while the round is on:
 *    stalkers only ever narrow the hider down through the cards. Once the
 *    round is over there is nothing left to protect, and everyone still has to
 *    find each other.
 *  - Players not in a team yet: nothing but themselves.
 */
async function handleState(request, env, user) {
    const now = Date.now();
    // POST /state carries the caller's position too: one request every few
    // seconds instead of two, which is what keeps a 36-player game inside
    // Cloudflare's free daily limits. A bad fix is dropped, never the poll.
    if (request.method === "POST") {
        const body = await readJson(request);
        if (body && typeof body === "object" && "lat" in body) {
            await recordLocation(env, user.id, body, now);
        }
    }
    const settings = await getSettings(env);
    const meRow = await env.DB.prepare(
        `SELECT id, username, is_admin, group_id, role, cards_seen_at, catch_code
         FROM users WHERE id = ?`,
    )
        .bind(user.id)
        .first();
    const me = publicUser(meRow ?? user);
    if (me.isAdmin) {
        return json(await adminState(env, now, settings, me), 200, request, env);
    }

    const team = await loadTeam(env, me.groupId, now);
    const users = [];
    if (team) {
        const { results } = await env.DB.prepare(
            `SELECT ${USER_COLUMNS} FROM users
             WHERE group_id = ? AND is_admin = 0 ORDER BY role, username`,
        )
            .bind(team.id)
            .all();
        const roundOver = team.status === "ended";
        for (const row of results) {
            const base = {
                ...publicUser(row),
                online: isOnline(row, now),
                lat: null,
                lng: null,
                updatedAt: row.location_updated_at,
            };
            const showPosition = row.id === me.id || row.role === "stalker" || roundOver;
            if (showPosition && hasFreshPosition(row, now)) {
                base.lat = row.lat;
                base.lng = row.lng;
            }
            users.push(base);
        }
    }

    const cards = team ? await cardsForUser(env, team, me, now) : null;
    // A hider needs their own code to draw the QR; nobody else may ever see it.
    if (me.role === "hider" && team?.status === "playing" && meRow?.catch_code) {
        me.catchCode = CATCH_CODE_PREFIX + meRow.catch_code;
    }
    return json(
        {
            serverNow: now,
            settings: publicSettings(settings),
            me,
            team: team ? publicTeam(team, now, { debug: settings.debug }) : null,
            users,
            cards,
        },
        200,
        request,
        env,
    );
}

/** The admin board: every player, every team, and every finished round. */
async function adminState(env, now, settings, me) {
    const { results: rows } = await env.DB.prepare(
        `SELECT ${USER_COLUMNS} FROM users ORDER BY is_admin DESC, group_id, role, username`,
    ).all();
    const users = rows.map((row) => {
        const base = {
            ...publicUser(row),
            online: isOnline(row, now),
            lat: null,
            lng: null,
            updatedAt: row.location_updated_at,
            // Connection quality for the admin board. Never sent to players:
            // a hider's signal dropping could hint at where they are.
            accuracy: null,
            rttMs: row.net_rtt_ms,
            lastSeenAt: row.last_seen_at,
        };
        if (hasFreshPosition(row, now)) {
            base.lat = row.lat;
            base.lng = row.lng;
            base.accuracy = row.location_accuracy;
        }
        return base;
    });
    const { results: counts } = await env.DB.prepare(
        "SELECT group_id, COUNT(*) AS n FROM card_plays GROUP BY group_id",
    ).all();
    const asked = new Map(counts.map((c) => [c.group_id, c.n]));
    const teams = (await loadTeams(env, now)).map((team) => ({
        ...publicTeam(team, now, { debug: settings.debug }),
        questionsAsked: asked.get(team.id) ?? 0,
    }));
    const { results: rounds } = await env.DB.prepare(
        `SELECT id, team_id, hider_name, outcome, caught_by_name, hunt_ms, questions, ended_at
         FROM rounds ORDER BY hunt_ms DESC, ended_at ASC LIMIT ?`,
    )
        .bind(MAX_RESULTS)
        .all();
    return {
        serverNow: now,
        settings,
        me,
        teams,
        users,
        results: rounds.map((r) => ({
            id: r.id,
            teamId: r.team_id,
            hiderName: r.hider_name,
            outcome: r.outcome,
            caughtByName: r.caught_by_name,
            huntMs: r.hunt_ms,
            questions: r.questions,
            endedAt: r.ended_at,
        })),
        cards: null,
    };
}

// ---------------------------------------------------------------------------
// Cards
// ---------------------------------------------------------------------------
/** A played card, minus the photo blob (fetched separately). */
function publicPlay(row) {
    return {
        id: row.id,
        cardId: row.card_id,
        batchId: row.batch_id,
        question: row.question,
        askedByName: row.asked_by_name,
        askedAt: row.asked_at,
        askLat: row.ask_lat,
        askLng: row.ask_lng,
        answer: row.answer === null ? null : JSON.parse(row.answer),
        hasPhoto: Boolean(row.photo_present),
        answeredAt: row.answered_at,
        editedAt: row.edited_at,
    };
}

const PLAY_COLUMNS = `id, batch_id, card_id, question, asked_by, asked_by_name, asked_at,
                      ask_lat, ask_lng, answer, answered_at, edited_at,
                      photo IS NOT NULL AS photo_present`;

/**
 * The cards half of /state, scoped to the caller's role.
 *  - stalkers: the live batch, how many questions they have in hand (the
 *    ones they let slip pile up), the play made from the live batch (so they
 *    can watch the answer land), what the hider still owes them, and the
 *    answered geometry behind the Hints map filter.
 *  - hiders: the questions they still have to answer, and the ones they have
 *    answered (they may correct those while the round is on).
 * Both get an unread count for the header bell. Once a round is over the
 * geometry stays, so the final map is still there to look at.
 */
async function cardsForUser(env, team, me, now) {
    if (!me.role) return null;
    const live = team.status === "playing";
    const { results: plays } = await env.DB.prepare(
        `SELECT ${PLAY_COLUMNS} FROM card_plays WHERE group_id = ? ORDER BY asked_at`,
    )
        .bind(team.id)
        .all();
    const answered = plays.filter((p) => p.answered_at !== null);
    // Only cards that actually constrain the map, and only once answered.
    const hints = answered.filter((p) => CARDS_BY_ID.get(p.card_id)?.hint).map(publicPlay);
    // Nothing is owed once the round is over.
    const pending = live
        ? plays.filter((p) => p.answered_at === null).map(publicPlay)
        : [];

    if (me.role === "hider") {
        return {
            role: "hider",
            pending,
            answered: live ? answered.map(publicPlay) : [],
            answeredCount: answered.length,
            // One bell ding per question still owed.
            unread: pending.length,
            // The hider sees the same closing net their stalkers do — it is
            // built entirely from answers they gave themselves.
            hints,
        };
    }

    const state = teamPhase(team, now);
    const { batch: batchRow, inHand } =
        live && state.phase === "hunting"
            ? await liveTeamBatch(env, team.id, state.question, now)
            : { batch: null, inHand: 0 };
    const current = batchRow?.played_card_id
        ? plays.find((p) => p.batch_id === batchRow.id)
        : null;
    const seenAt = me.cardsSeenAt ?? 0;
    return {
        role: "stalker",
        batch: batchRow ? publicBatch(batchRow) : null,
        inHand,
        currentPlay: current ? publicPlay(current) : null,
        pending,
        historyCount: plays.length,
        unread: answered.filter((p) => p.answered_at > seenAt).length,
        hints,
    };
}

async function handleCardCatalog(request, env) {
    return json(catalogPayload(), 200, request, env);
}

/** The caller's team, if it is in the hunt right now; otherwise a thrown 409. */
async function huntingTeam(env, user, now) {
    const team = await loadTeam(env, user.group_id, now);
    if (!team || team.status === "ready") {
        throw Object.assign(new Error("Your team has not started yet"), { status: 409 });
    }
    if (team.status === "ended") {
        throw Object.assign(new Error("This round is over"), { status: 409 });
    }
    const state = teamPhase(team, now);
    if (state.phase !== "hunting") {
        throw Object.assign(new Error("The hunt has not started yet — the hider is still hiding"), {
            status: 409,
        });
    }
    return { team, state };
}

async function handleCardPick(request, env, user) {
    const now = Date.now();
    if (user.role !== "stalker" || !user.group_id) {
        return error("Only stalkers can play cards", 403, request, env);
    }
    const { team, state } = await huntingTeam(env, user, now);
    if (team.paused_at) {
        return error("The admin has paused your team", 409, request, env);
    }
    const body = await readJson(request);
    const card = CARDS_BY_ID.get(body?.cardId);
    if (!card) return error("Unknown card", 400, request, env);

    const { batch } = await liveTeamBatch(env, team.id, state.question, now);
    if (!cardIsInBatch(batch, card.id)) {
        // Face down already: a teammate sent this question first. If the team
        // has another question in hand, it is face up now.
        return error(
            batch.played_card_id
                ? "Your team already sent its question — wait for the next one"
                : "A teammate sent that question first — here is the next one",
            409,
            request,
            env,
        );
    }

    // "...than me?" cards are anchored to where the stalker stands right now,
    // so the answer still means something after they walk away.
    let askLat = null;
    let askLng = null;
    if (card.needsAsker) {
        const me = await env.DB.prepare(
            "SELECT lat, lng, location_updated_at FROM users WHERE id = ?",
        )
            .bind(user.id)
            .first();
        if (!me || !hasFreshPosition(me, now, ASKER_FIX_MAX_AGE_MS)) {
            return error(
                "This question uses where you are, and your location isn't updating. Check that location is on, then try again.",
                409,
                request,
                env,
            );
        }
        askLat = me.lat;
        askLng = me.lng;
    }

    // Claim the batch first: the UPDATE only matches while it is still unplayed,
    // so two stalkers tapping at the same moment cannot both burn it.
    const claim = await env.DB.prepare(
        `UPDATE card_batches SET played_card_id = ?, played_by = ?, played_at = ?
         WHERE id = ? AND played_card_id IS NULL`,
    )
        .bind(card.id, user.id, now, batch.id)
        .run();
    if (!claim.meta.changes) {
        return error("A teammate sent that question first", 409, request, env);
    }

    const inserted = await env.DB.prepare(
        `INSERT INTO card_plays
            (group_id, batch_id, card_id, question, asked_by, asked_by_name, asked_at, ask_lat, ask_lng)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
        .bind(
            team.id,
            batch.id,
            card.id,
            batch.question,
            user.id,
            user.username,
            now,
            askLat,
            askLng,
        )
        .run();

    return json({ ok: true, playId: inserted.meta.last_row_id }, 200, request, env);
}

/**
 * The hider answers — or, for a card they already answered, corrects it. A
 * wrong tap should not stay locked in, so an answer can be changed until the
 * round is over; the change re-rings the stalkers' bell and is marked as such.
 */
async function handleCardAnswer(request, env, user) {
    const now = Date.now();
    if (user.role !== "hider" || !user.group_id) {
        return error("Only the hider answers cards", 403, request, env);
    }
    const team = await loadTeam(env, user.group_id, now);
    if (!team || team.status !== "playing") {
        return error("This round is over", 409, request, env);
    }
    const body = await readJson(request);
    const playId = Number(body?.playId);
    if (!Number.isInteger(playId)) return error("Invalid playId", 400, request, env);

    const play = await env.DB.prepare(
        "SELECT id, group_id, card_id, answered_at FROM card_plays WHERE id = ?",
    )
        .bind(playId)
        .first();
    if (!play || play.group_id !== user.group_id) {
        return error("Question not found", 404, request, env);
    }

    const card = CARDS_BY_ID.get(play.card_id);
    if (!card) return error("Unknown card", 400, request, env);

    const { value, error: invalid } = validateAnswer(card, body?.answer);
    if (invalid) return error(invalid, 400, request, env);

    const isPhoto = card.answer.type === "photo";
    if (isPhoto && value.length > MAX_PHOTO_CHARS) {
        return error("Photo is too large — try again", 413, request, env);
    }
    const editing = play.answered_at !== null;
    // Photos live in their own column so /state and /cards/history stay small.
    await env.DB.prepare(
        `UPDATE card_plays SET answer = ?, photo = ?, answered_at = ?, edited_at = ?
         WHERE id = ?`,
    )
        .bind(
            JSON.stringify(isPhoto ? "photo" : value),
            isPhoto ? value : null,
            now,
            editing ? now : null,
            playId,
        )
        .run();
    return json({ ok: true, edited: editing }, 200, request, env);
}

async function handleCardsSeen(request, env, user) {
    await env.DB.prepare("UPDATE users SET cards_seen_at = ? WHERE id = ?")
        .bind(Date.now(), user.id)
        .run();
    return json({ ok: true }, 200, request, env);
}

async function handleCardHistory(request, env, user) {
    if (!user.group_id) return json({ plays: [] }, 200, request, env);
    const { results } = await env.DB.prepare(
        `SELECT ${PLAY_COLUMNS} FROM card_plays WHERE group_id = ? ORDER BY asked_at DESC`,
    )
        .bind(user.group_id)
        .all();
    return json({ plays: results.map(publicPlay) }, 200, request, env);
}

async function handleCardPhoto(request, env, user) {
    const playId = Number(new URL(request.url).searchParams.get("playId"));
    if (!Number.isInteger(playId)) return error("Invalid playId", 400, request, env);
    const row = await env.DB.prepare(
        "SELECT group_id, photo FROM card_plays WHERE id = ?",
    )
        .bind(playId)
        .first();
    if (!row || !row.photo) return error("No photo for that card", 404, request, env);
    if (!user.is_admin && row.group_id !== user.group_id) {
        return error("Forbidden", 403, request, env);
    }
    return json({ photo: row.photo }, 200, request, env);
}

// ---------------------------------------------------------------------------
// The team's own buttons, and the two ways stalkers end a round
// ---------------------------------------------------------------------------
async function handleTeamStart(request, env, user) {
    const now = Date.now();
    if (!user.group_id) return error("You are not in a team yet", 409, request, env);
    const settings = await getSettings(env);
    const team = await startTeam(env, user.group_id, now, { debug: settings.debug });
    return json({ team: publicTeam(team, now) }, 200, request, env);
}

async function handleTeamAgain(request, env, user) {
    const now = Date.now();
    if (!user.group_id) return error("You are not in a team yet", 409, request, env);
    const team = await playAgain(env, user.group_id);
    return json({ team: publicTeam(team, now) }, 200, request, env);
}

/**
 * The hider's team has found them: end the round for the stalkers. Shared by
 * the QR scan and the "Hider has been found" button.
 */
async function catchHider(request, env, user, target, now) {
    const { team } = await huntingTeam(env, user, now);
    const ended = await endRound(env, team, {
        outcome: "seekers",
        caughtByName: user.username,
        at: now,
    });
    if (!ended) return error("Your hider has already been found", 409, request, env);
    const after = await loadTeam(env, team.id, now);
    return json(
        {
            ok: true,
            caught: { teamId: team.id, hiderName: target.username },
            team: publicTeam(after, now),
        },
        200,
        request,
        env,
    );
}

/**
 * A stalker scanned a QR code. If it is their own team's hider, that hider is
 * found and the round is over.
 *
 * Every rejection says which of the several ways it went wrong, because the
 * person holding the phone is standing in the street looking at a stranger's
 * poster and needs to know whether to keep scanning.
 */
async function handleCatch(request, env, user) {
    const now = Date.now();
    if (user.role !== "stalker" || !user.group_id) {
        return error("Only stalkers can catch a hider", 403, request, env);
    }
    const body = await readJson(request);
    const scanned = typeof body?.code === "string" ? body.code.trim() : "";
    if (!scanned.startsWith(CATCH_CODE_PREFIX)) {
        return error("That is not a HideNStalk code", 400, request, env);
    }
    const code = scanned.slice(CATCH_CODE_PREFIX.length).toLowerCase();
    if (!CATCH_CODE_RE.test(code)) {
        return error("That code is damaged — scan it again", 400, request, env);
    }
    const target = await env.DB.prepare(
        "SELECT id, username, group_id, role FROM users WHERE catch_code = ?",
    )
        .bind(code)
        .first();
    if (!target || target.role !== "hider") {
        return error("That code does not belong to a hider", 404, request, env);
    }
    if (target.group_id !== user.group_id) {
        return error(
            "That is another team's hider — yours is still out there",
            403,
            request,
            env,
        );
    }
    return catchHider(request, env, user, target, now);
}

/**
 * "Hider has been found" — the same ending as a QR scan, without the camera.
 * Deliberately no code to check: this is the fallback for when the scanner
 * will not cooperate, so requiring the thing that just failed would defeat it.
 * It can only ever end the presser's *own* team's round.
 */
async function handleFound(request, env, user) {
    const now = Date.now();
    if (user.role !== "stalker" || !user.group_id) {
        return error("Only stalkers can end a hunt", 403, request, env);
    }
    const target = await env.DB.prepare(
        `SELECT id, username FROM users
         WHERE group_id = ? AND role = 'hider' AND is_admin = 0`,
    )
        .bind(user.group_id)
        .first();
    if (!target) return error("Your team has no hider", 409, request, env);
    return catchHider(request, env, user, target, now);
}

// ---------------------------------------------------------------------------
// Admin handlers
// ---------------------------------------------------------------------------
async function handleAdminMakeTeams(request, env) {
    const now = Date.now();
    const body = (await readJson(request)) ?? {};
    const size = body.size === undefined ? TARGET_TEAM_SIZE : Number(body.size);
    const made = await makeTeams(env, now, size);
    return json({ ok: true, made }, 200, request, env);
}

async function handleAdminAssign(request, env) {
    const now = Date.now();
    const body = await readJson(request);
    if (!body || typeof body !== "object") {
        return error("Invalid JSON body", 400, request, env);
    }
    const userId = Number(body.userId);
    if (!Number.isInteger(userId)) return error("Invalid userId", 400, request, env);
    let teamId = body.teamId;
    if (teamId !== null && teamId !== "new") {
        teamId = Number(teamId);
        if (!Number.isInteger(teamId) || teamId < 1) {
            return error("Invalid teamId", 400, request, env);
        }
    }
    const role = teamId === null ? null : body.role;
    if (teamId !== null && !ROLES.has(role)) return error("Invalid role", 400, request, env);
    await assignPlayer(env, now, { userId, teamId, role });
    return json({ ok: true }, 200, request, env);
}

async function handleAdminTeam(request, env) {
    const now = Date.now();
    const body = await readJson(request);
    const teamId = Number(body?.teamId);
    if (!Number.isInteger(teamId)) return error("Invalid teamId", 400, request, env);
    const settings = await getSettings(env);
    const team = await adminTeamAction(env, teamId, body?.action, now, {
        debug: settings.debug,
    });
    return json({ team: publicTeam(team, now) }, 200, request, env);
}

async function handleAdminDisband(request, env) {
    await disbandTeams(env);
    return json({ ok: true }, 200, request, env);
}

async function handleAdminClear(request, env) {
    await env.DB.batch([
        env.DB.prepare(
            "DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE is_admin = 0)",
        ),
        env.DB.prepare("DELETE FROM card_plays"),
        env.DB.prepare("DELETE FROM card_batches"),
        env.DB.prepare("DELETE FROM users WHERE is_admin = 0"),
        env.DB.prepare("DELETE FROM teams"),
        env.DB.prepare("DELETE FROM rounds"),
    ]);
    return json({ ok: true }, 200, request, env);
}

async function handleAdminSettings(request, env) {
    const body = await readJson(request);
    if (!body || typeof body !== "object") {
        return error("Invalid JSON body", 400, request, env);
    }
    const settings = await updateSettings(env, body);
    return json({ settings }, 200, request, env);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
export default {
    async fetch(request, env) {
        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: corsHeaders(request, env),
            });
        }

        const { pathname } = new URL(request.url);
        const method = request.method;

        try {
            if (method === "POST" && pathname === "/register") {
                return await handleRegister(request, env);
            }
            if (method === "POST" && pathname === "/login") {
                return await handleLogin(request, env);
            }

            // Everything below requires a valid session.
            const user = await authenticate(request, env);
            if (!user) return error("Unauthorized", 401, request, env);

            if (method === "POST" && pathname === "/logout") {
                return await handleLogout(request, env, user);
            }
            if (method === "GET" && pathname === "/me") {
                return await handleMe(request, env, user);
            }
            if (method === "POST" && pathname === "/location") {
                return await handleLocation(request, env, user);
            }
            if ((method === "GET" || method === "POST") && pathname === "/state") {
                return await handleState(request, env, user);
            }
            if (method === "POST" && pathname === "/team/start") {
                return await handleTeamStart(request, env, user);
            }
            if (method === "POST" && pathname === "/team/again") {
                return await handleTeamAgain(request, env, user);
            }
            if (method === "POST" && pathname === "/catch") {
                return await handleCatch(request, env, user);
            }
            if (method === "POST" && pathname === "/found") {
                return await handleFound(request, env, user);
            }

            if (pathname.startsWith("/cards/")) {
                if (method === "GET") {
                    switch (pathname) {
                        case "/cards/catalog":
                            return await handleCardCatalog(request, env);
                        case "/cards/history":
                            return await handleCardHistory(request, env, user);
                        case "/cards/photo":
                            return await handleCardPhoto(request, env, user);
                    }
                }
                if (method === "POST") {
                    switch (pathname) {
                        case "/cards/pick":
                            return await handleCardPick(request, env, user);
                        case "/cards/answer":
                            return await handleCardAnswer(request, env, user);
                        case "/cards/seen":
                            return await handleCardsSeen(request, env, user);
                    }
                }
                return error("Not found", 404, request, env);
            }

            if (pathname.startsWith("/admin/")) {
                if (!user.is_admin) return error("Forbidden", 403, request, env);
                if (method !== "POST") return error("Not found", 404, request, env);
                switch (pathname) {
                    case "/admin/make-teams":
                        return await handleAdminMakeTeams(request, env);
                    case "/admin/assign":
                        return await handleAdminAssign(request, env);
                    case "/admin/team":
                        return await handleAdminTeam(request, env);
                    case "/admin/disband":
                        return await handleAdminDisband(request, env);
                    case "/admin/clear":
                        return await handleAdminClear(request, env);
                    case "/admin/settings":
                        return await handleAdminSettings(request, env);
                }
            }
            return error("Not found", 404, request, env);
        } catch (err) {
            if (err && Number.isInteger(err.status)) {
                return error(err.message, err.status, request, env);
            }
            console.error(err);
            return error("Internal server error", 500, request, env);
        }
    },
};
