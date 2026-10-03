// Smoke test for asynchronous teams, against a local `npm run dev`.
//
//   HNS_ADMIN_PASSWORD=... node smoke-teams.mjs
//
// Covers: making and editing teams (online or not), a team starting on its
// own, the hiding countdown, one question per interval with no repeats,
// unsent questions piling up and going out back to back, the locked-in pick,
// answering and correcting an answer, catching the hider, question 7 handing
// the win to the hider, Play again rotating the hider, leaving the game
// between rounds, pausing, the settings, and that nothing leaks between teams.
//
// Time is moved by editing the local database (the team clock only stores
// when it started), so the whole run takes seconds, not 40 minutes.
//
// WARNING: it starts with /admin/clear, which deletes every player on the
// server it talks to. Local only.

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = process.env.HNS_API ?? "http://127.0.0.1:8787";
const ORIGIN = "http://localhost:8080";
const ADMIN_PASSWORD = process.env.HNS_ADMIN_PASSWORD;
// The admin to log in as: "admin" unless HNS_ADMIN_USERNAME names a local one.
const ADMIN_USERNAME = process.env.HNS_ADMIN_USERNAME || "admin";
if (!ADMIN_PASSWORD) {
    console.error("Set HNS_ADMIN_PASSWORD to the admin account's password.");
    process.exit(1);
}
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(BASE)) {
    console.error("Refusing to run against a non-local server: this test deletes every player.");
    process.exit(1);
}

const HERE = dirname(fileURLToPath(import.meta.url));
const WRANGLER = join(HERE, "node_modules", "wrangler", "bin", "wrangler.js");
// Where `wrangler dev --persist-to` keeps the local database, when it was started with one.
const PERSIST = process.env.HNS_PERSIST_TO ? ["--persist-to", process.env.HNS_PERSIST_TO] : [];

/** Run SQL on the local database behind `wrangler dev`. */
function sql(command) {
    const out = execFileSync(
        process.execPath,
        [WRANGLER, "d1", "execute", "hidenstalk", "--local", ...PERSIST, "--json", "--command", command],
        { cwd: HERE, stdio: "pipe" },
    ).toString();
    return JSON.parse(out).at(-1)?.results ?? [];
}

async function call(path, { method = "GET", token, body } = {}) {
    const res = await fetch(BASE + path, {
        method,
        headers: {
            Origin: ORIGIN,
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json;
    try {
        json = JSON.parse(text);
    } catch {
        json = text;
    }
    return { status: res.status, json };
}

let failures = 0;
function check(label, ok, detail) {
    console.log(`${ok ? "  ok  " : " FAIL "} ${label}${detail ? ` — ${detail}` : ""}`);
    if (!ok) failures++;
}

const admin = await call("/login", {
    method: "POST",
    body: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
});
if (admin.status !== 200) {
    console.error("admin login failed:", admin.status, JSON.stringify(admin.json));
    process.exit(1);
}
const at = admin.json.token;
const adminPost = (path, body) => call(path, { method: "POST", token: at, body });

// A spot on campus, and a helper to put a player there (fresh fix).
const CAMPUS = { lat: 46.7817, lng: -71.2747 };
const place = (token, dLat = 0, dLng = 0) =>
    call("/location", {
        method: "POST",
        token,
        body: { lat: CAMPUS.lat + dLat, lng: CAMPUS.lng + dLng, accuracy: 8, fixAgeMs: 500 },
    });

// Move a team's clock forward by pretending it started earlier.
const advance = (teamId, ms) =>
    sql(`UPDATE teams SET started_at = started_at - ${ms} WHERE id = ${teamId}`);

// ---------------------------------------------------------------------------
console.log("\nSetup");
await adminPost("/admin/clear");
await adminPost("/admin/settings", { debug: false, discordUrl: "", todosDone: [] });
const tokens = {};
const names = ["alice", "bob", "carol", "dave", "erin", "frank", "gina"];
for (const name of names) {
    const r = await call("/register", {
        method: "POST",
        body: { username: name, password: "pw123456" },
    });
    tokens[name] = r.json.token;
}
check("7 players registered", Object.values(tokens).every(Boolean));
// frank never shares a position and never polls: an "offline" player.
for (const name of names.filter((n) => n !== "frank")) await place(tokens[name]);

let s = await call("/state", { token: tokens.alice });
check("unassigned player has no team", s.status === 200 && s.json.team === null, `status ${s.status}`);
check("unassigned player sees no one", Array.isArray(s.json.users) && s.json.users.length === 0);
check("settings reach players", s.json.settings?.debug === false && s.json.settings?.discordUrl === null);

// ---------------------------------------------------------------------------
console.log("\nMaking teams");
let r = await adminPost("/admin/make-teams", { size: 1 });
check("team size 1 is refused", r.status === 400);
r = await adminPost("/admin/make-teams", { size: 3 });
check("make-teams (size 3) with 7 players makes 2 teams", r.status === 200 && r.json.made === 2, JSON.stringify(r.json));
let a = await call("/state", { token: at });
check("admin sees 2 teams, both ready", a.json.teams?.length === 2 && a.json.teams.every((t) => t.phase === "ready"));
const teamOf = (name) => a.json.users.find((u) => u.username === name)?.groupId;
const membersOf = (teamId) => a.json.users.filter((u) => u.groupId === teamId && !u.isAdmin);
for (const t of a.json.teams) {
    const m = membersOf(t.id);
    check(`team ${t.id} has exactly one hider`, m.filter((u) => u.role === "hider").length === 1, m.map((u) => `${u.username}:${u.role}`).join(" "));
}
r = await adminPost("/admin/make-teams", {});
check("make-teams again with nobody waiting is refused", r.status === 400);

// Latecomer, placed by hand while offline.
r = await call("/register", { method: "POST", body: { username: "hank", password: "pw123456" } });
tokens.hank = r.json.token;
a = await call("/state", { token: at });
const hankId = a.json.users.find((u) => u.username === "hank").id;
const frankId = a.json.users.find((u) => u.username === "frank").id;
r = await adminPost("/admin/assign", { userId: hankId, teamId: a.json.teams[0].id, role: "stalker" });
check("offline latecomer dragged into team", r.status === 200);
r = await adminPost("/admin/assign", { userId: frankId, teamId: "new", role: "stalker" });
check("offline player moved to a new team", r.status === 200);
a = await call("/state", { token: at });
const frankTeam = a.json.users.find((u) => u.id === frankId).groupId;
check("alone on a new team, frank becomes its hider", a.json.users.find((u) => u.id === frankId).role === "hider");
r = await adminPost("/admin/assign", { userId: frankId, teamId: null });
a = await call("/state", { token: at });
check("empty team is deleted when its last player leaves", !a.json.teams.some((t) => t.id === frankTeam));
check("frank is unassigned", a.json.users.find((u) => u.id === frankId).groupId === null);

// Pick the two teams we will play with.
const [teamA, teamB] = a.json.teams.map((t) => t.id);
const hiderOf = (teamId) => membersOf(teamId).find((u) => u.role === "hider");
const stalkersOf = (teamId) => membersOf(teamId).filter((u) => u.role === "stalker");
const hA = hiderOf(teamA);
const sA = stalkersOf(teamA);
const hB = hiderOf(teamB);
const sB = stalkersOf(teamB);
const tok = (u) => tokens[u.username];
await place(tok(hA), 0.002, 0.001); // the hider, ~250 m north-east
for (const u of [...sA, ...sB, hB]) await place(tok(u));

// ---------------------------------------------------------------------------
console.log("\nVisibility");
s = await call("/state", { token: tok(sA[0]) });
check("stalker sees only their own team", s.json.users.every((u) => u.groupId === teamA), s.json.users.map((u) => u.username).join(","));
check("stalker does not see the hider's position", s.json.users.find((u) => u.role === "hider")?.lat === null);
check("stalker sees teammates' positions", s.json.users.filter((u) => u.role === "stalker").every((u) => u.lat !== null));
s = await call("/state", { token: tok(hA) });
check("hider sees every stalker's position", s.json.users.filter((u) => u.role === "stalker").every((u) => u.lat !== null));
// The client sends its position with every poll (POST /state), not separately.
r = await call("/state", {
    method: "POST",
    token: tok(sA[0]),
    body: { lat: CAMPUS.lat + 0.001, lng: CAMPUS.lng, accuracy: 5, fixAgeMs: 200, rttMs: 90 },
});
s = await call("/state", { token: tok(hA) });
check(
    "POST /state carries the poller's position",
    r.status === 200 && Math.abs(s.json.users.find((u) => u.id === sA[0].id)?.lat - (CAMPUS.lat + 0.001)) < 1e-9,
);
r = await call("/state", { method: "POST", token: tok(sA[0]), body: { lat: 999, lng: 0 } });
check("a nonsense position never fails the poll", r.status === 200 && r.json.team?.id === teamA);
await place(tok(sA[0]));
check("ready hider has no catch code yet", !s.json.me.catchCode);

// ---------------------------------------------------------------------------
console.log("\nStart, hiding");
r = await call("/cards/pick", { method: "POST", token: tok(sA[0]), body: { cardId: "ns" } });
check("no picking before the team starts", r.status === 409);
r = await call("/team/start", { method: "POST", token: tok(sA[0]) });
check("a stalker starts the team", r.status === 200 && r.json.team.phase === "hiding", JSON.stringify(r.json));
check("real timers when debug is off", r.json.team?.hideMs === 600000 && r.json.team?.intervalMs === 300000);
r = await call("/team/start", { method: "POST", token: tok(hA) });
check("pressing Start twice is harmless", r.status === 200 && r.json.team.phase === "hiding");
s = await call("/state", { token: tok(hA) });
check("the hider sees the hiding countdown", s.json.team.phase === "hiding" && s.json.team.hideRemainingMs > 590000, `${s.json.team.hideRemainingMs}`);
check("the hider gets their catch code", /^HNS1:[a-f0-9]{16}$/.test(s.json.me.catchCode ?? ""));
check("hints are there from the start (empty)", Array.isArray(s.json.cards?.hints) && s.json.cards.hints.length === 0);
s = await call("/state", { token: tok(sB[0]) });
check("the other team did not start", s.json.team.phase === "ready");
r = await call("/found", { method: "POST", token: tok(sA[0]) });
check("no catching while the hider is still hiding", r.status === 409);
r = await call("/cards/pick", { method: "POST", token: tok(sA[0]), body: { cardId: "ns" } });
check("no picking while the hider is hiding", r.status === 409);

// ---------------------------------------------------------------------------
console.log("\nHunting");
advance(teamA, 600000);
s = await call("/state", { token: tok(sA[0]) });
check("after 10 minutes the hunt is on, question 1", s.json.team.phase === "hunting" && s.json.team.question === 1, JSON.stringify(s.json.team));
const batch1 = s.json.cards.batch;
check("question 1 deals three cards", batch1?.cardIds?.length === 3 && batch1.question === 1);
const s2 = await call("/state", { token: tok(sA[1]) });
check("teammates see the same batch", s2.json.cards.batch.id === batch1.id);
const catalog = (await call("/cards/catalog", { token: tok(sA[0]) })).json;
const card = (id) => catalog.cards.find((c) => c.id === id);
check("the deck has the terrain question", Boolean(card("terrain")) && card("terrain").answer.options.length === 6);
check("question 1 cards are openers", batch1.cardIds.every((id) => card(id).tiers.includes(1)), batch1.cardIds.join(","));
check("hider does not get the batch", (await call("/state", { token: tok(hA) })).json.cards.batch === undefined);

// Prefer a card relative to the asker, to exercise the snapshot.
const pickId = batch1.cardIds.find((id) => card(id).needsAsker) ?? batch1.cardIds[0];
sql(`UPDATE users SET location_updated_at = location_updated_at - 300000 WHERE username = '${sA[0].username}'`);
if (card(pickId).needsAsker) {
    r = await call("/cards/pick", { method: "POST", token: tok(sA[0]), body: { cardId: pickId } });
    check("an asker-relative card needs a fresh position", r.status === 409, r.json.error);
}
await place(tok(sA[0]));
r = await call("/cards/pick", { method: "POST", token: tok(sA[0]), body: { cardId: pickId } });
check("stalker picks a card", r.status === 200, JSON.stringify(r.json));
const playId = r.json.playId;
r = await call("/cards/pick", {
    method: "POST",
    token: tok(sA[1]),
    body: { cardId: batch1.cardIds.find((id) => id !== pickId) },
});
check("the batch is burnt for the teammate", r.status === 409);
s = await call("/state", { token: tok(sA[1]) });
check("teammate sees the sent card, locked in", s.json.cards.currentPlay?.id === playId && s.json.cards.currentPlay.answer === null);

s = await call("/state", { token: tok(hA) });
check("hider has one question pending", s.json.cards.pending.length === 1 && s.json.cards.unread === 1);
check("the pending question knows its number", s.json.cards.pending[0].question === 1);
const spec = card(pickId).answer;
const answerFor = (spec, alt = false) => {
    switch (spec.type) {
        case "radio":
            return spec.options[alt ? spec.options.length - 1 : 0];
        case "choice":
            return catalog.landmarkGroups[spec.group].places[alt ? 1 : 0].id;
        case "number":
            return alt ? 7 : 5;
        case "text":
            return alt ? "3" : "2";
        case "coords":
            return { lat: CAMPUS.lat, lng: CAMPUS.lng };
        case "photo":
            return "data:image/jpeg;base64,AAAA";
        case "heatmap":
            return "data:image/png;base64,AAAA";
        default:
            return null;
    }
};
r = await call("/cards/answer", { method: "POST", token: tok(hA), body: { playId, answer: answerFor(spec) } });
check("hider answers", r.status === 200 && r.json.edited === false, JSON.stringify(r.json));
s = await call("/state", { token: tok(sA[1]) });
check("stalker sees the answer land", s.json.cards.currentPlay?.answer !== null && s.json.cards.unread === 1);
await call("/cards/seen", { method: "POST", token: tok(sA[1]) });
s = await call("/state", { token: tok(sA[1]) });
check("the bell clears once read", s.json.cards.unread === 0);
await new Promise((res) => setTimeout(res, 20));
r = await call("/cards/answer", { method: "POST", token: tok(hA), body: { playId, answer: answerFor(spec, true) } });
check("hider corrects the answer", r.status === 200 && r.json.edited === true, JSON.stringify(r.json));
s = await call("/state", { token: tok(sA[1]) });
check("the correction re-rings the bell and is marked", s.json.cards.unread === 1 && Boolean(s.json.cards.currentPlay.editedAt));
s = await call("/state", { token: tok(hA) });
check("hider lists the answered question", s.json.cards.answered.length === 1 && s.json.cards.pending.length === 0);

// Question 2 arrives with fresh cards.
advance(teamA, 300000);
s = await call("/state", { token: tok(sA[0]) });
const batch2 = s.json.cards.batch;
check("five minutes later: question 2", s.json.team.question === 2 && batch2?.question === 2);
check("question 2 repeats none of question 1's cards", batch2.cardIds.every((id) => !batch1.cardIds.includes(id)));
check("the new batch is open again", batch2.playedCardId === null && s.json.cards.currentPlay === null);

// Isolation: team B's stalker cannot catch team A's hider, and sees nothing of A.
const codeA = (await call("/state", { token: tok(hA) })).json.me.catchCode;
await call("/team/start", { method: "POST", token: tok(hB) });
advance(teamB, 600000);
r = await call("/catch", { method: "POST", token: tok(sB[0]), body: { code: codeA } });
check("another team's hider cannot be caught", r.status === 403, r.json.error);
r = await call("/cards/history", { token: tok(sB[0]) });
check("history is per team", r.json.plays.every((p) => p.question !== undefined) && !r.json.plays.some((p) => p.id === playId));
r = await call(`/cards/photo?playId=${playId}`, { token: tok(sB[0]) });
check("no peeking at another team's photos", r.status === 403 || r.status === 404);

// ---------------------------------------------------------------------------
console.log("\nPause");
await adminPost("/admin/team", { teamId: teamA, action: "pause" });
s = await call("/state", { token: tok(sA[0]) });
const frozen = s.json.team.nextQuestionInMs;
check("paused team says so", s.json.team.paused === true);
r = await call("/cards/pick", { method: "POST", token: tok(sA[0]), body: { cardId: batch2.cardIds[0] } });
check("no picking while paused", r.status === 409);
await new Promise((res) => setTimeout(res, 1500));
s = await call("/state", { token: tok(sA[0]) });
check("the clock is frozen while paused", s.json.team.nextQuestionInMs === frozen, `${frozen} -> ${s.json.team.nextQuestionInMs}`);
await adminPost("/admin/team", { teamId: teamA, action: "resume" });
s = await call("/state", { token: tok(sA[0]) });
check("resumed", s.json.team.paused === false && s.json.team.question === 2);

// ---------------------------------------------------------------------------
console.log("\nCatch");
r = await call("/catch", { method: "POST", token: tok(sA[0]), body: { code: "not a code" } });
check("a random QR is rejected", r.status === 400);
r = await call("/catch", { method: "POST", token: tok(sA[1]), body: { code: codeA } });
check("scanning your own hider catches them", r.status === 200 && r.json.team.phase === "ended", JSON.stringify(r.json));
s = await call("/state", { token: tok(sA[0]) });
check("stalkers won", s.json.team.outcome === "seekers" && s.json.team.caughtByName === sA[1].username);
// One advanced question, plus however long this test took in real time.
check("the hunt time is about one question", s.json.team.huntMs >= 300000 && s.json.team.huntMs < 360000, `${s.json.team.huntMs}`);
check("the hider's position is revealed afterwards", s.json.users.find((u) => u.role === "hider")?.lat !== null);
check("the final map stays", s.json.cards.hints.length >= 0 && s.json.cards.batch === null);
s = await call("/state", { token: tok(hA) });
check("the hider's code is gone once caught", !s.json.me.catchCode);
r = await call("/cards/answer", { method: "POST", token: tok(hA), body: { playId, answer: answerFor(spec) } });
check("no answering once the round is over", r.status === 409);
r = await call("/found", { method: "POST", token: tok(sA[0]) });
check("no double catch", r.status === 409);
a = await call("/state", { token: at });
check("the round is in the results", a.json.results.length === 1 && a.json.results[0].outcome === "seekers" && a.json.results[0].hiderName === hA.username);
check("results count the questions asked", a.json.results[0].questions === 1);

// ---------------------------------------------------------------------------
console.log("\nPlay again, and question 7");
r = await call("/team/again", { method: "POST", token: tok(sA[0]) });
check("play again", r.status === 200 && r.json.team.phase === "ready");
a = await call("/state", { token: at });
const newHider = hiderOf(teamA);
check("the next player hides", newHider.id !== hA.id, `${hA.username} -> ${newHider.username}`);
check("still exactly one hider", membersOf(teamA).filter((u) => u.role === "hider").length === 1);
r = await call("/cards/history", { token: tok(sA[0]) });
check("a new round starts with a clean history", r.json.plays.length === 0);
await adminPost("/admin/settings", { debug: true });
r = await call("/team/start", { method: "POST", token: tok(newHider) });
check("debug mode starts a fast round", r.json.team?.hideMs === 60000 && r.json.team?.intervalMs === 60000, JSON.stringify(r.json.team));
await adminPost("/admin/settings", { debug: false });
s = await call("/state", { token: tok(newHider) });
check("turning debug off does not touch a running round", s.json.team.intervalMs === 60000);

// Questions the stalkers let slip pile up, and go out back to back.
const sA2 = stalkersOf(teamA);
for (const u of sA2) await place(tok(u));
advance(teamA, 60000 + 2 * 60000 + 1000); // two minutes into the hunt: question 3
s = await call("/state", { token: tok(sA2[0]) });
check("three questions in, none sent: all three in hand", s.json.team.question === 3 && s.json.cards.inHand === 3, `question ${s.json.team.question}, in hand ${s.json.cards.inHand}`);
check("the oldest one is face up", s.json.cards.batch?.question === 1 && s.json.cards.batch.playedCardId === null);
const plainCard = (b) => b.cardIds.find((id) => !card(id).needsAsker) ?? b.cardIds[0];
for (const [q, left] of [[1, 2], [2, 1]]) {
    r = await call("/cards/pick", { method: "POST", token: tok(sA2[0]), body: { cardId: plainCard(s.json.cards.batch) } });
    check(`question ${q} sent`, r.status === 200, JSON.stringify(r.json));
    s = await call("/state", { token: tok(sA2.at(-1)) });
    const b = s.json.cards.batch;
    check(`no wait: question ${q + 1} is face up straight away`, b?.question === q + 1 && b.playedCardId === null && s.json.cards.inHand === left, `batch ${b?.question}, in hand ${s.json.cards.inHand}`);
}
// Question 3 is "which part of <building>?": sent with a building, answered with a letter.
sql(`UPDATE card_batches SET card_ids = '["building_section","ns","ew"]' WHERE group_id = ${teamA} AND question = 3`);
r = await call("/cards/pick", { method: "POST", token: tok(sA2[0]), body: { cardId: "building_section" } });
check("a building question needs its building", r.status === 400, r.json.error);
r = await call("/cards/pick", { method: "POST", token: tok(sA2[0]), body: { cardId: "building_section", target: "pav_nowhere" } });
check("and a building that exists", r.status === 400, r.json.error);
r = await call("/cards/pick", { method: "POST", token: tok(sA2[0]), body: { cardId: "building_section", target: "pav_plt" } });
check("question 3 sent, about Pouliot", r.status === 200, JSON.stringify(r.json));
const sectionPlay = r.json.playId;
s = await call("/state", { token: tok(sA2.at(-1)) });
check("all sent: the last one stays on screen", s.json.cards.inHand === 0 && s.json.cards.batch?.question === 3 && s.json.cards.batch.playedCardId !== null && s.json.cards.currentPlay?.question === 3);
s = await call("/state", { token: tok(newHider) });
check("the hider owes all three, numbered as they came", s.json.cards.pending.map((p) => p.question).join(",") === "1,2,3", s.json.cards.pending.map((p) => p.question).join(","));
check("the building question knows its building", s.json.cards.pending.find((p) => p.id === sectionPlay)?.target === "pav_plt");
r = await call("/cards/answer", { method: "POST", token: tok(newHider), body: { playId: sectionPlay, answer: "E" } });
check("a section the building does not have is refused", r.status === 400, r.json.error);
r = await call("/cards/answer", { method: "POST", token: tok(newHider), body: { playId: sectionPlay, answer: "B" } });
check("the hider answers with a section", r.status === 200, JSON.stringify(r.json));
advance(teamA, 4 * 60000); // the rest of the way to question 7
s = await call("/state", { token: tok(newHider) });
check("question 7 never comes: the hider wins", s.json.team.phase === "ended" && s.json.team.outcome === "hider", JSON.stringify(s.json.team));
check("a full hunt is exactly six questions long", s.json.team.huntMs === 6 * 60000, `${s.json.team.huntMs}`);
a = await call("/state", { token: at });
check("both rounds are in the results, longest first", a.json.results.length === 2 && a.json.results[0].huntMs >= a.json.results[1].huntMs);
r = await call("/team/again", { method: "POST", token: tok(newHider) });
a = await call("/state", { token: at });
const thirdHider = hiderOf(teamA);
const fresh = membersOf(teamA).filter((u) => u.id !== hA.id && u.id !== newHider.id);
check(
    "the third hider is someone who has not hidden yet",
    fresh.length ? fresh.some((u) => u.id === thirdHider.id) : thirdHider.id === hA.id,
    `${hA.username}, ${newHider.username} -> ${thirdHider.username}`,
);

// ---------------------------------------------------------------------------
console.log("\nLeave");
a = await call("/state", { token: at });
const leaver = stalkersOf(teamA)[0];
await call("/team/start", { method: "POST", token: tok(hiderOf(teamA)) });
r = await call("/team/leave", { method: "POST", token: tok(leaver) });
check("no leaving mid-round", r.status === 409, r.json.error);
await adminPost("/admin/team", { teamId: teamA, action: "reset" });
r = await call("/team/leave", { method: "POST", token: tok(leaver) });
check("a stalker leaves between rounds", r.status === 200, JSON.stringify(r.json));
s = await call("/state", { token: tok(leaver) });
check("the leaver is off the team", s.json.team === null && s.json.me.groupId === null);
a = await call("/state", { token: at });
check("their team still has its hider", hiderOf(teamA)?.id !== leaver.id && membersOf(teamA).filter((u) => u.role === "hider").length === 1);
const quitter = hiderOf(teamA);
r = await call("/team/leave", { method: "POST", token: tok(quitter) });
a = await call("/state", { token: at });
check("the hider leaves: someone else hides", r.status === 200 && membersOf(teamA).filter((u) => u.role === "hider").length === 1 && hiderOf(teamA).id !== quitter.id);
await adminPost("/admin/make-teams", { size: 2 });
a = await call("/state", { token: at });
check("make-teams leaves those who left alone", [leaver, quitter].every((u) => a.json.users.find((x) => x.id === u.id).groupId === null));
r = await call("/login", { method: "POST", body: { username: leaver.username, password: "pw123456" } });
tokens[leaver.username] = r.json.token;
check("logging back in: waiting for a team again", r.status === 200 && r.json.user.role === null && r.json.user.groupId === null);
a = await call("/state", { token: at });

// ---------------------------------------------------------------------------
console.log("\nAdmin");
r = await adminPost("/admin/team", { teamId: teamB, action: "reset" });
check("reset puts a team back to ready", r.status === 200 && r.json.team.phase === "ready");

// Debug mode's own options: no hiding time, all six questions at once.
r = await adminPost("/admin/settings", { debugNoHide: true, debugAllQuestions: true });
check("debug options are saved", r.status === 200 && r.json.settings.debugNoHide === true && r.json.settings.debugAllQuestions === true);
r = await adminPost("/admin/settings", { debug: true });
r = await call("/team/start", { method: "POST", token: tok(hiderOf(teamB)) });
check("no hiding time: straight to the hunt", r.json.team?.phase === "hunting" && r.json.team.hideMs === 0, JSON.stringify(r.json.team));
s = await call("/state", { token: tok(stalkersOf(teamB)[0]) });
check("all six questions in hand at once", s.json.cards.inHand === 6 && s.json.cards.batch?.question === 1, `in hand ${s.json.cards.inHand}`);
r = await adminPost("/admin/settings", { debug: false });
s = await call("/state", { token: tok(stalkersOf(teamB)[0]) });
check("with debug off, one question at a time again", s.json.cards.inHand === 1, `in hand ${s.json.cards.inHand}`);
await adminPost("/admin/settings", { debugNoHide: false, debugAllQuestions: false });
await adminPost("/admin/team", { teamId: teamB, action: "reset" });
r = await adminPost("/admin/settings", { discordUrl: "not a link" });
check("a non-https Discord link is refused", r.status === 400);
r = await adminPost("/admin/settings", { discordUrl: "https://discord.gg/example", todosDone: ["discord", "poster"] });
check("settings saved", r.status === 200 && r.json.settings.discordUrl === "https://discord.gg/example" && r.json.settings.todosDone.length === 2);
s = await call("/state", { token: tok(sB[0]) });
check("players get the Discord link, not the to-dos", s.json.settings.discordUrl === "https://discord.gg/example" && s.json.settings.todosDone === undefined);
r = await call("/admin/settings", { method: "POST", token: tok(sB[0]), body: { debug: true } });
check("players cannot touch admin settings", r.status === 403);
r = await adminPost("/admin/disband");
a = await call("/state", { token: at });
check("disband: nobody is in a team", a.json.teams.length === 0 && a.json.users.every((u) => u.groupId === null));
check("disband keeps the results", a.json.results.length === 2);
check("disband keeps whoever left out of the next teams", a.json.users.find((u) => u.id === quitter.id).role === "left");
r = await adminPost("/admin/make-teams", { size: 3 });
a = await call("/state", { token: at });
check(
    "make-teams again: everyone but the one who left",
    r.status === 200 && a.json.users.find((u) => u.id === quitter.id).groupId === null && a.json.users.filter((u) => !u.isAdmin && u.id !== quitter.id).every((u) => u.groupId !== null),
    JSON.stringify(r.json),
);
await adminPost("/admin/settings", { discordUrl: "", todosDone: [] });
await adminPost("/admin/clear");
a = await call("/state", { token: at });
check("clear: only admins are left", a.json.users.every((u) => u.isAdmin) && a.json.results.length === 0);

console.log(failures ? `\n${failures} check(s) FAILED` : "\nall checks passed");
process.exit(failures ? 1 : 0);
