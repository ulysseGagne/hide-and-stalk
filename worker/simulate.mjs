// Load simulation: several teams playing at once, in real time, against a
// local `npm run dev`.
//
//   HNS_ADMIN_PASSWORD=... node simulate.mjs            6 teams of 6 (the default)
//   HNS_ADMIN_PASSWORD=... node simulate.mjs --teams 3 --size 4
//
// Every simulated phone behaves like the real client: it syncs every 5 s
// (POST /state with its position), asks again the moment a timer runs out,
// stalkers race each other to pick a card, the hider answers truthfully from
// where it really is, and rounds end every way they can: a QR scan, the
// "Hider has been found" button, question 7, a paused team, Play again.
// Debug mode is switched on so a round takes 7 minutes instead of 40.
//
// Alongside, it checks what must always hold:
//   - nobody ever sees another team, or the hider's position mid-round;
//   - teammates always see the same three cards, one pick per question, no
//     card offered twice in a round, openers first;
//   - the Hints map (the real src/hints.js, run here) always still contains the
//     hider, and the hider's shortened answer lists always offer the true one;
//   - every round ends with the right winner and the right time.
// Then it reports latency per endpoint and requests per player per minute.
//
// WARNING: it starts with /admin/clear, which deletes every player on the
// server it talks to. Local only.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import * as turf from "@turf/turf";

const BASE = process.env.HNS_API ?? "http://127.0.0.1:8787";
const ORIGIN = "http://localhost:8080";
const ADMIN_PASSWORD = process.env.HNS_ADMIN_PASSWORD;
// The admin to log in as: "admin" unless HNS_ADMIN_USERNAME names a local one.
const ADMIN_USERNAME = process.env.HNS_ADMIN_USERNAME || "admin";
const arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i === -1 ? fallback : Number(process.argv[i + 1]);
};
const TEAMS = arg("teams", 6);
const SIZE = arg("size", 6);
const POLL_MS = 5_000; // src/config.js locationPollIntervalMs
const ADMIN_POLL_MS = 2_000; // src/config.js adminPollIntervalMs

if (!ADMIN_PASSWORD) {
    console.error("Set HNS_ADMIN_PASSWORD to the admin account's password.");
    process.exit(1);
}
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(BASE)) {
    console.error("Refusing to run against a non-local server: this deletes every player.");
    process.exit(1);
}

const HERE = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const T0 = Date.now();
const clock = () => `${((Date.now() - T0) / 1000).toFixed(0).padStart(4)}s`;

// ---------------------------------------------------------------------------
// HTTP, with per-endpoint timing
// ---------------------------------------------------------------------------
const stats = new Map(); // "METHOD /path" -> { ms: [], status: Map }
let requestCount = 0;

// `wrangler dev` routes every request through a local proxy that now and then
// drops one ("Network connection lost") when several arrive at once. Cloudflare
// itself has no such proxy, and a real phone would simply sync again 5 s later,
// so those are retried once and counted apart from real errors.
const DEV_PROXY_DROP = /Network connection lost/;
let proxyDrops = 0;

async function call(path, options = {}) {
    const first = await callOnce(path, options);
    if (first.status !== 500 || !DEV_PROXY_DROP.test(JSON.stringify(first.json))) return first;
    proxyDrops++;
    await sleep(500);
    return callOnce(path, options);
}

async function callOnce(path, { method = "GET", token, body } = {}) {
    const key = `${method} ${path.split("?")[0]}`;
    const started = performance.now();
    let res;
    let json = null;
    try {
        res = await fetch(BASE + path, {
            method,
            headers: {
                Origin: ORIGIN,
                "Content-Type": "application/json",
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });
        const text = await res.text();
        try {
            json = JSON.parse(text);
        } catch {
            json = text;
        }
    } catch (err) {
        res = { status: 0 };
        json = { error: String(err) };
    }
    const ms = performance.now() - started;
    requestCount++;
    const entry = stats.get(key) ?? { ms: [], status: new Map() };
    entry.ms.push(ms);
    entry.status.set(res.status, (entry.status.get(res.status) ?? 0) + 1);
    stats.set(key, entry);
    return { status: res.status, json };
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------
const failures = [];
const counters = new Map();
function count(label) {
    counters.set(label, (counters.get(label) ?? 0) + 1);
}
function fail(label, detail) {
    failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
    console.log(`${clock()}  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
}
function check(label, ok, detail) {
    count(`checked: ${label}`);
    if (!ok) fail(label, detail);
    return ok;
}

// ---------------------------------------------------------------------------
// The real Hints code (src/hints.js), run here with a stand-in for Leaflet
// ---------------------------------------------------------------------------
const noLayer = { addTo: () => noLayer, clearLayers() {} };
const hintsContext = vm.createContext({
    turf,
    L: { layerGroup: () => noLayer, geoJSON: () => noLayer },
    window: {},
    console,
});
vm.runInContext(readFileSync(join(HERE, "..", "src", "hints.js"), "utf8"), hintsContext);
const HNSHints = hintsContext.window.HNSHints;

// ---------------------------------------------------------------------------
// Geometry for the hider's truthful answers (same metrics as hints.js)
// ---------------------------------------------------------------------------
let catalog = null;
let campus = null;
let campusLine = null;
const metres = (a, b) =>
    turf.distance(turf.point([a.lng, a.lat]), turf.point([b.lng, b.lat]), { units: "meters" });

/** Nearest place of a group the way the Voronoi cells measure it (hints.js). */
function nearestPlace(groupKey, pos) {
    const [, minY, , maxY] = turf.bbox(campus);
    const kx = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
    let best = null;
    for (const p of catalog.landmarkGroups[groupKey].places) {
        const d = Math.hypot((p.lng - pos.lng) * kx, p.lat - pos.lat);
        if (!best || d < best.d) best = { id: p.id, d };
    }
    return best.id;
}

const PHOTO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/yQALCAABAAEBAREA/8wABgAQEAX/2gAIAQEAAD8A0s8g/9k=";

function truthfulAnswer(card, play, hider) {
    const ask = { lat: play.askLat, lng: play.askLng };
    switch (card.hint?.type) {
        case "halfPlane":
            return card.hint.axis === "ns"
                ? hider.lat > ask.lat ? "North" : "South"
                : hider.lng > ask.lng ? "East" : "West";
        case "radius":
            return metres(hider, ask) <= card.hint.meters ? "Yes" : "No";
        case "walkTime":
            // No real routes here: walking is taken as 1.25x the straight line.
            return Math.min(90, Math.round((metres(hider, ask) * 1.25) / catalog.walk.speedMPerMin));
        case "closerThan": {
            const place = catalog.landmarks[card.hint.landmark];
            return metres(hider, place) < metres(ask, place) ? "Yes" : "No";
        }
        case "closerToBoundary": {
            const d = (p) => turf.pointToLineDistance(turf.point([p.lng, p.lat]), campusLine, { units: "meters" });
            return d(hider) < d(ask) ? "Yes" : "No";
        }
        case "nearest":
            return nearestPlace(card.hint.group, hider);
        case "section": {
            // The closest of the named building's section pins.
            const sections = catalog.buildings[play.target].sections;
            return sections.reduce((best, x) => (metres(hider, x) < metres(hider, best) ? x : best)).id;
        }
        case "point":
            return { lat: hider.lat, lng: hider.lng };
        case "zone": {
            // The first answer whose area holds the hider (the areas overlap).
            const pt = turf.point([hider.lng, hider.lat]);
            const zones = catalog.zones[card.hint.zones];
            return Object.keys(zones).find((a) => turf.booleanPointInPolygon(pt, turf.feature(zones[a])));
        }
        default:
            break;
    }
    switch (card.answer.type) {
        case "radio":
            return card.answer.options[Math.floor(Math.random() * card.answer.options.length)];
        case "text":
            return String(Math.floor(rand(0, 5)));
        case "number":
            return 3;
        case "photo":
            // Now and then nothing of the kind is around.
            return Math.random() < 0.2 && !card.answer.screenshot ? "N/A" : PHOTO;
        case "heatmap":
            // The square the phone would draw: any PNG will do here.
            return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
        default:
            return null;
    }
}

/** Any building, for a card the stalker names one for ("which part of <building>?"). */
const randomBuilding = () => {
    const ids = Object.keys(catalog.buildings);
    return ids[Math.floor(Math.random() * ids.length)];
};

function randomSpotOnCampus() {
    const [minX, minY, maxX, maxY] = turf.bbox(campus);
    for (;;) {
        const p = [rand(minX, maxX), rand(minY, maxY)];
        // Keep clear of the edge, where GPS noise could put a hider outside.
        if (
            turf.booleanPointInPolygon(turf.point(p), campus) &&
            turf.pointToLineDistance(turf.point(p), campusLine, { units: "meters" }) > 40
        ) {
            return { lat: p[1], lng: p[0] };
        }
    }
}

/** How far a point is from the edge of a (multi)polygon, in metres. */
function distanceToBoundary(pt, region) {
    let best = Infinity;
    turf.flattenEach(region, (poly) => {
        for (const ring of poly.geometry.coordinates) {
            best = Math.min(best, turf.pointToLineDistance(pt, turf.lineString(ring), { units: "meters" }));
        }
    });
    return best;
}

function stepToward(from, to, metresPerStep) {
    const d = metres(from, to);
    if (d <= metresPerStep) return { ...to };
    const f = metresPerStep / d;
    return { lat: from.lat + (to.lat - from.lat) * f, lng: from.lng + (to.lng - from.lng) * f };
}

// ---------------------------------------------------------------------------
// The plan: every way a round can go, spread over the teams
// ---------------------------------------------------------------------------
// startAt: seconds after the game opens that the team presses Start (async play).
const PLANS = [
    { startAt: 0, ending: "scan", endAtQuestion: 3 },
    { startAt: 0, ending: "found", endAtQuestion: 4 },
    { startAt: 5, ending: "timeout" },
    { startAt: 45, ending: "timeout", editAnswers: true },
    { startAt: 20, ending: "scan", endAtQuestion: 5, pauseAtQuestion: 2 },
    { startAt: 60, ending: "found", endAtQuestion: 2, playAgain: true },
];

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
console.log(`Simulating ${TEAMS} teams of ${SIZE} against ${BASE}\n`);
const admin = await call("/login", { method: "POST", body: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD } });
if (admin.status !== 200) {
    console.error("admin login failed:", admin.status, JSON.stringify(admin.json));
    process.exit(1);
}
const AT = admin.json.token;
const adminPost = (path, body) => call(path, { method: "POST", token: AT, body });

await adminPost("/admin/clear");
await adminPost("/admin/settings", { debug: true, discordUrl: "", todosDone: [] });

const players = [];
for (let i = 1; i <= TEAMS * SIZE; i++) {
    const username = `sim_${String(i).padStart(2, "0")}`;
    const r = await call("/register", { method: "POST", body: { username, password: "simulation1" } });
    if (r.status !== 201) {
        console.error("register failed", username, r.status, JSON.stringify(r.json));
        process.exit(1);
    }
    players.push({ username, token: r.json.token, id: r.json.user.id, requests: 0 });
}
catalog = (await call("/cards/catalog", { token: players[0].token })).json;
campus = turf.polygon([catalog.playArea.ring]);
campusLine = turf.polygonToLine(campus);
HNSHints.setCatalog(catalog);
const cardOf = new Map(catalog.cards.map((c) => [c.id, c]));

let r = await adminPost("/admin/make-teams", { size: SIZE });
check("make-teams builds the requested number of teams", r.status === 200 && r.json.made === TEAMS, JSON.stringify(r.json));
let board = (await call("/state", { token: AT })).json;
check(`${TEAMS} teams on the board`, board.teams.length === TEAMS);
const teams = board.teams.map((t, i) => {
    const members = board.users.filter((u) => u.groupId === t.id);
    return {
        id: t.id,
        plan: PLANS[i % PLANS.length],
        members: members.map((m) => players.find((p) => p.id === m.id)),
        state: null,
        dealt: new Set(),
        batchOfQuestion: new Map(),
        picksOfBatch: new Map(),
        hider: null,
        stalkers: [],
        done: false,
        rounds: 0,
        pausedAt: null,
        startedAt: null,
    };
});
for (const team of teams) {
    const members = board.users.filter((u) => u.groupId === team.id);
    check(`team ${team.id} has ${SIZE} players`, members.length === SIZE, `${members.length}`);
    check(`team ${team.id} has exactly one hider`, members.filter((m) => m.role === "hider").length === 1);
}
const START = { lat: 46.78035, lng: -71.27475 }; // by the ULaval sign
for (const p of players) {
    p.team = teams.find((t) => t.members.includes(p));
    p.pos = { lat: START.lat + rand(-0.0003, 0.0003), lng: START.lng + rand(-0.0003, 0.0003) };
}
function assignRoles(team) {
    const roles = new Map(board.users.map((u) => [u.id, u.role]));
    team.hider = team.members.find((p) => roles.get(p.id) === "hider");
    team.stalkers = team.members.filter((p) => p !== team.hider);
    team.hider.spot = randomSpotOnCampus();
}
teams.forEach(assignRoles);

// ---------------------------------------------------------------------------
// One simulated phone
// ---------------------------------------------------------------------------
let stopping = false;

/** Everything a player may see, checked on every poll. */
function checkIsolation(p, s) {
    const team = p.team;
    check("players only ever see their own team", s.users.every((u) => u.groupId === team.id), `${p.username} saw ${s.users.map((u) => u.groupId).join(",")}`);
    const live = s.team?.status !== "ended";
    if (live && s.me.role === "stalker") {
        const hider = s.users.find((u) => u.role === "hider");
        check("stalkers never see the hider's position mid-round", hider && hider.lat === null, `${p.username}`);
    }
    if (s.me.role !== "hider") check("only the hider gets their catch code", !s.me.catchCode);
}

async function poll(p) {
    const r = await call("/state", {
        method: "POST",
        token: p.token,
        body: { lat: p.pos.lat, lng: p.pos.lng, accuracy: rand(4, 15), fixAgeMs: Math.round(rand(100, 1500)), rttMs: 120 },
    });
    p.requests++;
    if (r.status !== 200) {
        fail("sync failed", `${p.username}: ${r.status} ${JSON.stringify(r.json)}`);
        return null;
    }
    const s = r.json;
    checkIsolation(p, s);
    p.last = s;
    p.lastAt = performance.now();
    if (s.team) p.team.state = s.team;
    return s;
}

/** Time until this phone's own timer says the server has something new. */
function nextBoundaryMs(s) {
    const t = s?.team;
    if (!t || t.status !== "playing" || t.paused) return Infinity;
    if (t.phase === "hiding") return t.hideRemainingMs;
    if (t.phase === "hunting") return t.nextQuestionInMs;
    return Infinity;
}

async function phone(p) {
    // Phones are not in step: spread the first sync over one interval.
    await sleep(rand(0, POLL_MS));
    while (!stopping) {
        const s = await poll(p);
        if (s) await act(p, s);
        // Like the real client: sync every 5 s, and the moment a timer hits 0.
        const boundary = nextBoundaryMs(s) + 150;
        await sleep(Math.max(200, Math.min(POLL_MS, boundary)));
        move(p, POLL_MS / 1000);
    }
}

function move(p, seconds) {
    const team = p.team;
    const phase = team.state?.phase;
    if (p === team.hider) {
        // Walks (1.3 m/s) to the spot while hiding, then stays put: its
        // answers stay true, which is what lets the map checks be exact.
        if (phase === "hiding" || phase === "ready") p.pos = stepToward(p.pos, p.spot, 1.3 * seconds);
        else if (phase === "hunting") p.pos = { ...p.spot };
        return;
    }
    // Stalkers wait during the hide, then run (3 m/s) roughly at the hider.
    if (phase !== "hunting") return;
    const target = {
        lat: team.hider.spot.lat + rand(-0.0006, 0.0006),
        lng: team.hider.spot.lng + rand(-0.0008, 0.0008),
    };
    p.pos = stepToward(p.pos, target, 3 * seconds);
}

// ---------------------------------------------------------------------------
// What each phone does with what it sees
// ---------------------------------------------------------------------------
const tierDistance = (card, q) => Math.min(...card.tiers.map((t) => Math.abs(t - q)));

async function act(p, s) {
    const team = p.team;
    const t = s.team;
    if (!t || team.done) return;

    if (t.phase === "hunting" && s.me.role === "stalker" && s.cards?.batch) {
        const batch = s.cards.batch;
        // Same question, same three cards, for every teammate.
        const known = team.batchOfQuestion.get(batch.question);
        if (known === undefined) {
            team.batchOfQuestion.set(batch.question, batch.id);
            // The oldest question in hand is face up: sends go oldest first, so
            // what is in hand is always the last few the clock brought.
            const faceUp = batch.playedCardId ? t.question : t.question - (s.cards.inHand ?? 1) + 1;
            check("the batch is the oldest question in hand", batch.question === faceUp, `batch ${batch.question}, clock ${t.question}, in hand ${s.cards.inHand}`);
            for (const id of batch.cardIds) {
                check("no card is offered twice in a round", !team.dealt.has(id), `team ${team.id}: ${id}`);
                team.dealt.add(id);
                check("cards come from the right tier", tierDistance(cardOf.get(id), batch.question) <= 1, `${id} as question ${batch.question}`);
            }
        } else {
            check("teammates see the same batch", known === batch.id, `team ${team.id} q${batch.question}: ${known} vs ${batch.id}`);
        }
        // Everyone on the team goes for a card at once: exactly one may win.
        if (!batch.playedCardId && !t.paused && !team.racing?.has(batch.id)) {
            team.racing ??= new Set();
            team.racing.add(batch.id);
            await sleep(rand(2000, 8000));
            // A "which X are you closest to?" card, when there is one, is what
            // everyone goes for (it is the one whose shortened list gets
            // checked); otherwise they each grab a different card.
            const wanted = batch.cardIds.find((id) => cardOf.get(id).answer.type === "choice");
            const results = await Promise.all(
                team.stalkers.map((st, i) =>
                    call("/cards/pick", {
                        method: "POST",
                        token: st.token,
                        body: { cardId: wanted ?? batch.cardIds[i % 3], target: randomBuilding() },
                    }),
                ),
            );
            const won = results.filter((x) => x.status === 200).length;
            if (won === 0 && results.some((x) => /paused/i.test(x.json?.error ?? ""))) {
                // The admin paused the team mid-race: try again after the resume.
                team.racing.delete(batch.id);
                count("picks refused while paused");
            } else {
                check("exactly one pick per question, however many race", won === 1, `team ${team.id} q${batch.question}: ${won} won, statuses ${results.map((x) => x.status).join(",")}`);
                count("picks raced");
            }
        }
        // Once the answer to the planned question is in, end it the planned way.
        const plan = team.plan;
        const answered = s.cards.currentPlay?.answer != null;
        if (plan.endAtQuestion && t.question >= plan.endAtQuestion && answered && !team.ending) {
            team.ending = true;
            await endRound(team, p);
        }
    }

    if (t.phase === "hunting" && s.me.role === "hider" && !team.answering) {
        team.answering = true;
        try {
            await answerAll(team, p, s);
        } finally {
            team.answering = false;
        }
    }

    // Pause test: freeze the team for a while at the planned question.
    const plan = team.plan;
    if (plan.pauseAtQuestion && t.phase === "hunting" && t.question === plan.pauseAtQuestion && !team.paused && p === team.hider) {
        team.paused = true;
        await pauseTest(team);
    }
}

async function answerAll(team, hider, s) {
    for (const play of s.cards.pending) {
        const card = cardOf.get(play.cardId);
        // The hider's shortened list must still offer the honest answer.
        if (card.answer.type === "choice") {
            HNSHints.setPlays(s.cards.hints);
            const possible = HNSHints.possiblePlaceIds(card.answer.group);
            const truth = nearestPlace(card.answer.group, hider.pos);
            if (possible) {
                check("the shortened answer list offers the true answer", possible.has(truth), `team ${team.id}: ${truth} not in ${[...possible].join(",")}`);
            }
            count(`choice lists checked (${possible ? "filtered" : "full"})`);
        }
        await sleep(rand(1000, 6000)); // reading, checking Google Maps...
        let answer = truthfulAnswer(card, play, hider.pos);
        // Edit test: send a wrong answer first, then correct it.
        const fixLater = team.plan.editAnswers && card.answer.type === "radio" && card.answer.options.length > 1;
        if (fixLater) {
            answer = card.answer.options.find((o) => o !== answer);
            team.correcting = true;
        }
        const r = await call("/cards/answer", { method: "POST", token: hider.token, body: { playId: play.id, answer } });
        check("the hider's answer is accepted", r.status === 200, `${r.status} ${JSON.stringify(r.json)}`);
        if (fixLater && r.status === 200) {
            await sleep(rand(1000, 3000));
            const fixed = await call("/cards/answer", {
                method: "POST",
                token: hider.token,
                body: { playId: play.id, answer: truthfulAnswer(card, play, hider.pos) },
            });
            check("a corrected answer is accepted and marked", fixed.status === 200 && fixed.json.edited === true);
            count("answers corrected");
            team.correcting = false;
            team.correctedAt = performance.now();
        }
    }
}

async function pauseTest(team) {
    const r = await adminPost("/admin/team", { teamId: team.id, action: "pause" });
    check("admin can pause a team", r.status === 200 && r.json.team.paused === true);
    const before = r.json.team.nextQuestionInMs;
    await sleep(8000);
    const s = (await call("/state", { token: team.hider.token })).json;
    check("a paused team's clock stands still", s.team.nextQuestionInMs === before, `${before} -> ${s.team.nextQuestionInMs}`);
    const picked = await call("/cards/pick", {
        method: "POST",
        token: team.stalkers[0].token,
        body: { cardId: "ns" },
    });
    check("nobody can pick while paused", picked.status === 409);
    team.pausedFor = 8000;
    const resumed = await adminPost("/admin/team", { teamId: team.id, action: "resume" });
    check("admin can resume", resumed.status === 200 && resumed.json.team.paused === false);
    console.log(`${clock()}  team ${team.id} paused 8 s at question ${s.team.question}, resumed`);
}

async function endRound(team, stalker) {
    const plan = team.plan;
    const question = team.state?.question; // gone from the state once it ends
    if (plan.ending === "scan") {
        // A stalker first scans some other team's hider by mistake...
        const other = teams.find((o) => o !== team && o.hider.last?.me?.catchCode);
        if (other) {
            const wrong = await call("/catch", { method: "POST", token: stalker.token, body: { code: other.hider.last.me.catchCode } });
            check("another team's hider cannot be caught", wrong.status === 403 || wrong.status === 409, `${wrong.status}`);
        }
        // ...then the right one, off the hider's own screen.
        const code = team.hider.last?.me?.catchCode;
        const r = await call("/catch", { method: "POST", token: stalker.token, body: { code } });
        check("scanning the hider's code ends the round", r.status === 200 && r.json.team.outcome === "seekers", `${r.status} ${JSON.stringify(r.json).slice(0, 200)}`);
    } else {
        const r = await call("/found", { method: "POST", token: stalker.token });
        check("'Hider has been found' ends the round", r.status === 200 && r.json.team.outcome === "seekers", `${r.status}`);
    }
    const again = await call("/found", { method: "POST", token: team.stalkers.at(-1).token });
    check("a round can only end once", again.status === 409);
    console.log(`${clock()}  team ${team.id}: stalkers won (${plan.ending}) at question ${question}`);
    await finishRound(team, "seekers");
}

async function finishRound(team, expected) {
    team.rounds++;
    const s = await poll(team.hider);
    check(`team ${team.id} round ${team.rounds} ends with the right winner`, s.team.outcome === expected, `${s.team.outcome}`);
    check("nothing is owed once the round is over", s.cards.pending.length === 0);
    const stalkerView = await poll(team.stalkers[0]);
    check("the hider's position is revealed afterwards", stalkerView.users.find((u) => u.role === "hider")?.lat != null);
    if (team.plan.playAgain && team.rounds === 1) {
        const oldHider = team.hider;
        const r = await call("/team/again", { method: "POST", token: team.stalkers[0].token });
        check("play again puts the team back to ready", r.status === 200 && r.json.team.phase === "ready");
        board = (await call("/state", { token: AT })).json;
        assignRoles(team);
        check("play again hands the hiding to someone else", team.hider !== oldHider, `${oldHider.username} -> ${team.hider.username}`);
        team.dealt = new Set();
        team.batchOfQuestion = new Map();
        team.racing = new Set();
        team.ending = false;
        team.plan = { ...team.plan, endAtQuestion: 1, playAgain: false };
        const started = await call("/team/start", { method: "POST", token: team.hider.token });
        check("the second round starts", started.status === 200 && started.json.team.phase === "hiding");
        console.log(`${clock()}  team ${team.id}: play again, ${team.hider.username} hides now`);
        return;
    }
    team.done = true;
}

// ---------------------------------------------------------------------------
// The Hints map, watched from the stalkers' side
// ---------------------------------------------------------------------------
async function watchMaps() {
    while (!stopping) {
        await sleep(3000);
        for (const team of teams) {
            const s = team.stalkers[0]?.last;
            if (!s?.cards?.hints?.length || s.team.status === "ended") continue;
            // A deliberately wrong answer is on its way to being corrected:
            // the map is allowed to be wrong until the stalkers have seen the fix.
            if (team.correcting || team.stalkers[0].lastAt < (team.correctedAt ?? 0)) continue;
            HNSHints.setPlays(s.cards.hints);
            const solved = hintsContext.solve();
            check("the answers never contradict each other", !solved.contradiction, `team ${team.id}`);
            if (!solved.region) continue;
            const pt = turf.point([team.hider.spot.lng, team.hider.spot.lat]);
            const inside = turf.booleanPointInPolygon(pt, solved.region);
            // Circles are drawn as 96-sided polygons: a hider standing right
            // on a line may land a hair outside. A few metres is that, not a bug.
            const edge = inside ? 0 : distanceToBoundary(pt, solved.region);
            check("the Hints map always still contains the hider", inside || edge < 5, `team ${team.id}: ${edge.toFixed(1)} m outside after ${solved.applied} answers`);
            count(`map checks (${solved.applied} answers applied)`);
        }
    }
}

// ---------------------------------------------------------------------------
// The admin, watching the board like Félix would
// ---------------------------------------------------------------------------
async function adminLoop() {
    while (!stopping) {
        const r = await call("/state", { token: AT });
        if (r.status === 200) {
            check("the admin board lists every team", r.json.teams.length === TEAMS);
            check("the admin board lists every player", r.json.users.filter((u) => !u.isAdmin).length === TEAMS * SIZE);
        } else {
            fail("admin sync failed", `${r.status}`);
        }
        await sleep(ADMIN_POLL_MS);
    }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const phones = players.map(phone);
const admins = [adminLoop(), watchMaps()];

// Each team presses Start on its own schedule: asynchronous play.
for (const team of teams) {
    setTimeout(async () => {
        const r = await call("/team/start", { method: "POST", token: team.stalkers[0].token });
        check("a team starts on its own", r.status === 200 && r.json.team.phase === "hiding", `${r.status}`);
        check("debug mode gives the short timers", r.json.team?.hideMs === 60000 && r.json.team?.intervalMs === 60000);
        team.startedAt = Date.now();
        console.log(`${clock()}  team ${team.id} started (${team.plan.ending}${team.plan.endAtQuestion ? ` at question ${team.plan.endAtQuestion}` : ""})`);
    }, team.plan.startAt * 1000);
}

// Wait for every team to finish; the timeout ones need the full 7 minutes.
const deadline = Date.now() + 12 * 60 * 1000;
const watchTimeouts = async () => {
    while (!stopping) {
        for (const team of teams) {
            if (team.done || team.plan.ending !== "timeout") continue;
            const s = team.hider.last;
            if (s?.team?.status === "ended") {
                check("question 7 never comes: the hider wins", s.team.outcome === "hider", `team ${team.id}: ${s.team.outcome}`);
                check("a full hunt is exactly 6 questions long", s.team.huntMs === 6 * s.team.intervalMs, `team ${team.id}: ${s.team.huntMs}`);
                console.log(`${clock()}  team ${team.id}: hider won (question 7 never came)`);
                await finishRound(team, "hider");
            }
        }
        if (teams.every((t) => t.done) || Date.now() > deadline) break;
        await sleep(1000);
    }
};
await watchTimeouts();
stopping = true;
await Promise.allSettled([...phones, ...admins]);

// ---------------------------------------------------------------------------
// Final state
// ---------------------------------------------------------------------------
board = (await call("/state", { token: AT })).json;
const expectedRounds = teams.reduce((n, t) => n + t.rounds, 0);
check("every team finished", teams.every((t) => t.done), teams.filter((t) => !t.done).map((t) => t.id).join(","));
check("every finished round is in the results", board.results.length === expectedRounds, `${board.results.length} vs ${expectedRounds}`);
check(
    "results are longest hide first",
    board.results.every((r, i, all) => i === 0 || all[i - 1].huntMs >= r.huntMs),
);
for (const team of teams.filter((t) => t.plan.pauseAtQuestion)) {
    const row = board.results.find((r) => r.teamId === team.id);
    // Caught at question 5: hunting time is 4-5 intervals, pause excluded.
    check("a pause does not count as hiding time", row && row.huntMs < 5 * 60000 && row.huntMs >= 4 * 60000, `${row?.huntMs}`);
}
await adminPost("/admin/settings", { debug: false });

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const pct = (arr, p) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
};
const minutes = (Date.now() - T0) / 60000;
console.log("\nLatency by endpoint (local wrangler dev):");
console.log("  endpoint                       count    p50    p95    max   statuses");
for (const [key, { ms, status }] of [...stats].sort((a, b) => b[1].ms.length - a[1].ms.length)) {
    console.log(
        `  ${key.padEnd(28)} ${String(ms.length).padStart(6)} ${pct(ms, 50).toFixed(0).padStart(5)}ms ${pct(ms, 95).toFixed(0).padStart(5)}ms ${Math.max(...ms).toFixed(0).padStart(5)}ms   ${[...status].map(([k, v]) => `${k}×${v}`).join(" ")}`,
    );
}
const perPlayer = players.reduce((n, p) => n + p.requests, 0) / players.length / minutes;
console.log(`\n${requestCount} requests in ${minutes.toFixed(1)} min; ${perPlayer.toFixed(1)} syncs per player per minute.`);
console.log(`Local dev-proxy drops retried: ${proxyDrops} (${((100 * proxyDrops) / requestCount).toFixed(2)}% of requests; not an app error).`);
console.log(`At that rate ${TEAMS * SIZE} players make ~${Math.round(perPlayer * TEAMS * SIZE * 60).toLocaleString("en")} requests (and as many database writes) per hour.`);
console.log("\nChecks:");
for (const [label, n] of [...counters].sort()) console.log(`  ${String(n).padStart(6)}  ${label}`);
console.log(failures.length ? `\n${failures.length} FAILURE(S)` : "\nall checks passed");
process.exit(failures.length ? 1 : 0);
