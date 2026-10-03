// A fake game server for screenshots: canned /state payloads for one team
// (team 3) at the moments worth showing. Nothing here is invented about the
// game itself: the deck is the real one (worker/src/cards.js), and every
// answer is what an honest hider at HIDER would give (same rules as
// worker/simulate.mjs).
//
// Usernames are made up.

import fs from "node:fs";
import { catalogPayload, LANDMARK_GROUPS, LANDMARKS } from "../../../../worker/src/cards.js";

export const NOW = Date.parse("2026-10-05T13:27:00-04:00");
const MIN = 60_000;

// Where everyone is (lat, lng).
export const HIDER = { lat: 46.7806, lng: -71.2789 }; // by the greenhouses
const POS = {
    jules: { lat: 46.779163, lng: -71.2692303 }, // Pollack
    felix: { lat: 46.7803276, lng: -71.2768114 }, // Vachon
    camille: { lat: 46.7814, lng: -71.2748 },
    theo: { lat: 46.7797, lng: -71.2731 },
};

const metres = (a, b) => {
    const R = 6371000;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const la = (a.lat * Math.PI) / 180;
    const lb = (b.lat * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la) * Math.cos(lb) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
};

/** The truthful answer to a card, for the hider where they are. */
function truth(cardId, asker) {
    if (cardId === "ns") return HIDER.lat > asker.lat ? "North" : "South";
    if (cardId === "ew") return HIDER.lng > asker.lng ? "East" : "West";
    if (cardId.startsWith("radius_")) return metres(HIDER, asker) <= Number(cardId.slice(7)) ? "Yes" : "No";
    if (cardId.startsWith("nearest_")) {
        const places = LANDMARK_GROUPS[cardId.slice(8)].places;
        return places.reduce((best, p) => (metres(HIDER, p) < metres(HIDER, best) ? p : best)).id;
    }
    if (cardId.startsWith("closer_") && LANDMARKS[cardId.slice(7)]) {
        const lm = LANDMARKS[cardId.slice(7)];
        return metres(HIDER, lm) < metres(asker, lm) ? "Yes" : "No";
    }
    if (cardId === "walk_minutes") return Math.round((metres(HIDER, asker) * 1.3) / 80);
    if (cardId === "inside_outside") return "Outside";
    if (cardId === "terrain") return "Forest trail";
    if (cardId === "people_around") return "1-5";
    return null;
}

const USERS = [
    { id: 11, username: "ulysse", role: "hider" },
    { id: 12, username: "jules", role: "stalker" },
    { id: 13, username: "felix", role: "stalker" },
    { id: 14, username: "camille", role: "stalker" },
    { id: 15, username: "theo", role: "stalker" },
];

// The round so far: question n was dealt at hunt start + (n-1) * 5 min.
const HUNT_START = NOW - 17 * MIN - 20_000; // 13:09:40 -> Q4 is live
const ROUND = [
    { q: 1, cardIds: ["ns", "closer_church", "radius_500"], picked: "ns", by: "jules" },
    { q: 2, cardIds: ["radius_500", "walk_minutes", "nearest_velo"], picked: "radius_500", by: "jules" },
    { q: 3, cardIds: ["nearest_cafe", "photo_window", "closer_outer_ring"], picked: "nearest_cafe", by: "felix" },
    { q: 4, cardIds: ["closer_greenhouses", "nearest_building", "photo_below"], picked: "closer_greenhouses", by: "felix" },
];

function plays(upTo, { answerLast = true, extra = [] } = {}) {
    const out = [];
    for (const r of [...ROUND, ...extra]) {
        if (r.q > upTo) break;
        const asker = POS[r.by];
        const askedAt = HUNT_START + (r.q - 1) * 5 * MIN + 50_000;
        const last = r.q === upTo;
        const answered = !last || answerLast;
        const answer = answered ? (r.answer ?? truth(r.picked, asker)) : null;
        out.push({
            id: 100 + r.q,
            cardId: r.picked,
            batchId: 200 + r.q,
            question: r.q,
            askedByName: r.by,
            askedAt,
            askLat: asker.lat,
            askLng: asker.lng,
            answer,
            hasPhoto: Boolean(r.photo) && answered,
            answeredAt: answered ? askedAt + 70_000 : null,
            editedAt: null,
        });
    }
    return out;
}

const CARDS = new Map(catalogPayload().cards.map((c) => [c.id, c]));
const hinted = (list) => list.filter((p) => p.answer !== null && CARDS.get(p.cardId)?.hint);

function team(phase, o = {}) {
    const base = {
        id: 3,
        status: phase === "ready" ? "ready" : phase === "ended" ? "ended" : "playing",
        phase,
        paused: false,
        hideMs: 10 * MIN,
        intervalMs: 5 * MIN,
        maxQuestions: 6,
        startedAt: phase === "ready" ? null : HUNT_START - 10 * MIN,
        hideRemainingMs: null,
        question: null,
        nextQuestionInMs: null,
        huntMs: null,
        huntRemainingMs: null,
        outcome: null,
        hiderName: "ulysse",
        caughtByName: null,
        endedAt: null,
    };
    return { ...base, ...o };
}

function users(meName, { hunting = true } = {}) {
    return USERS.map((u) => {
        const own = u.username === meName;
        const visible = own || u.role === "stalker" || !hunting;
        const pos = u.role === "hider" ? HIDER : POS[u.username];
        return { ...u, isAdmin: false, groupId: 3, cardsSeenAt: 0, online: true, lat: visible ? pos.lat : null, lng: visible ? pos.lng : null, updatedAt: NOW - 3000 };
    });
}

const me = (name) => {
    const u = USERS.find((x) => x.username === name);
    return { ...u, isAdmin: false, groupId: 3, cardsSeenAt: 0 };
};

const settings = { debug: false, discordUrl: "https://discord.gg/Hh3SaS32j" };

/** Every screen: what the server says, and where the phone is. */
export const SCREENS = {
    login: { token: false, position: POS.jules },
    // Both fields typed in: the Log in button gets its mark.
    loginfilled: { token: false, position: POS.jules, fill: { "#auth-form input[name=username]": "jules", "#auth-form input[name=password]": "hunter22" } },
    // First launch (after logging in): the two permissions, one button each
    // (the pattern from marathon-quebec-2026/pacer). Drawn by decorate.js.
    permask: { position: POS.jules, perm: { loc: "off", compass: "off" }, state: { serverNow: NOW, settings, me: { ...me("jules"), groupId: null, role: null }, team: null, users: [], cards: null } },
    permasking: { position: POS.jules, perm: { loc: "asking", compass: "off" }, state: { serverNow: NOW, settings, me: { ...me("jules"), groupId: null, role: null }, team: null, users: [], cards: null } },
    permhalf: { position: POS.jules, perm: { loc: "on", compass: "off" }, state: { serverNow: NOW, settings, me: { ...me("jules"), groupId: null, role: null }, team: null, users: [], cards: null } },
    permdone: { position: POS.jules, perm: { loc: "on", compass: "on" }, state: { serverNow: NOW, settings, me: { ...me("jules"), groupId: null, role: null }, team: null, users: [], cards: null } },
    permblocked: { position: POS.jules, perm: { loc: "blocked", compass: "off" }, state: { serverNow: NOW, settings, me: { ...me("jules"), groupId: null, role: null }, team: null, users: [], cards: null } },
    lobby: {
        position: POS.jules,
        state: { serverNow: NOW, settings, me: { ...me("jules"), groupId: null, role: null }, team: null, users: [], cards: null },
    },
    // Before the game: the rules, one at a time, each OK'd and initialled.
    rules1: { position: POS.jules, rules: { signed: 0 }, state: { serverNow: NOW, settings, me: me("jules"), team: team("ready"), users: users("jules", { hunting: false }), cards: null } },
    rules5: { position: POS.jules, rules: { signed: 4 }, state: { serverNow: NOW, settings, me: me("jules"), team: team("ready"), users: users("jules", { hunting: false }), cards: null } },
    rulesdone: { position: POS.jules, rules: { signed: 8 }, state: { serverNow: NOW, settings, me: me("jules"), team: team("ready"), users: users("jules", { hunting: false }), cards: null } },
    ready: {
        position: POS.jules,
        state: { serverNow: NOW, settings, me: me("jules"), team: team("ready"), users: users("jules", { hunting: false }), cards: null },
    },
    hiding: {
        position: HIDER,
        state: { serverNow: NOW, settings, me: { ...me("ulysse"), catchCode: "HNS1:7f3a9c2e41" }, team: team("hiding", { hideRemainingMs: 8 * MIN + 41_000 }), users: users("ulysse"), cards: { role: "hider", pending: [], answered: [], answeredCount: 0, unread: 0, hints: [] } },
    },
    cards: {
        position: POS.jules,
        state: (() => {
            const p = plays(1);
            return {
                serverNow: NOW,
                settings,
                me: me("jules"),
                team: team("hunting", { question: 2, nextQuestionInMs: 4 * MIN + 12_000, huntMs: 5 * MIN + 48_000 }),
                users: users("jules"),
                cards: { role: "stalker", batch: { id: 202, question: 2, cardIds: ROUND[1].cardIds, dealtAt: NOW - 48_000, playedCardId: null, playedBy: null, playedAt: null }, currentPlay: null, pending: [], historyCount: p.length, unread: 0, hints: hinted(p) },
            };
        })(),
    },
    // A card picked but not sent yet: picking and sending are two actions.
    selected: {
        position: POS.jules,
        scrollTo: "#card-row .card:nth-child(2)",
        state: (() => {
            const p = plays(1);
            return {
                serverNow: NOW,
                settings,
                me: me("jules"),
                team: team("hunting", { question: 2, nextQuestionInMs: 4 * MIN + 2_000, huntMs: 5 * MIN + 58_000 }),
                users: users("jules"),
                cards: { role: "stalker", batch: { id: 202, question: 2, cardIds: ROUND[1].cardIds, dealtAt: NOW - 58_000, playedCardId: null, playedBy: null, playedAt: null }, currentPlay: null, pending: [], historyCount: p.length, unread: 0, hints: hinted(p) },
            };
        })(),
    },
    // Sent, the hider hasn't answered yet: SENT · LOCKED IN.
    waiting: {
        position: POS.felix,
        state: (() => {
            const p = plays(3, { answerLast: false });
            return {
                serverNow: NOW,
                settings,
                me: me("felix"),
                team: team("hunting", { question: 3, nextQuestionInMs: 3 * MIN + 31_000, huntMs: 11 * MIN + 29_000 }),
                users: users("felix"),
                cards: { role: "stalker", batch: { id: 203, question: 3, cardIds: ROUND[2].cardIds, dealtAt: NOW - 90_000, playedCardId: "nearest_cafe", playedBy: 13, playedAt: NOW - 29_000 }, currentPlay: p[2], pending: [], historyCount: p.length, unread: 0, hints: hinted(p) },
            };
        })(),
    },
    // The answer is on screen, so it's read: no bell to point at.
    sent: {
        position: POS.felix,
        state: (() => {
            const p = plays(3);
            return {
                serverNow: NOW,
                settings,
                me: me("felix"),
                team: team("hunting", { question: 3, nextQuestionInMs: 2 * MIN + 3_000, huntMs: 12 * MIN + 57_000 }),
                users: users("felix"),
                cards: { role: "stalker", batch: { id: 203, question: 3, cardIds: ROUND[2].cardIds, dealtAt: NOW - 3 * MIN, playedCardId: "nearest_cafe", playedBy: 13, playedAt: NOW - 2 * MIN }, currentPlay: p[2], pending: [], historyCount: p.length, unread: 0, hints: hinted(p) },
            };
        })(),
    },
    photo: {
        position: POS.camille,
        photo: true,
        state: (() => {
            const extra = [{ q: 5, cardIds: ["photo_seat", "radius_100", "floor"], picked: "photo_seat", by: "camille", answer: "photo", photo: true }];
            const p = plays(5, { extra });
            return {
                serverNow: NOW,
                settings,
                me: me("camille"),
                team: team("hunting", { question: 5, nextQuestionInMs: 1 * MIN + 36_000, huntMs: 23 * MIN + 24_000 }),
                users: users("camille"),
                // For the post: a notification on the bell too.
                cards: { role: "stalker", batch: { id: 205, question: 5, cardIds: extra[0].cardIds, dealtAt: NOW - 3 * MIN, playedCardId: "photo_seat", playedBy: 14, playedAt: NOW - 150_000 }, currentPlay: p[4], pending: [], historyCount: p.length, unread: 1, hints: hinted(p) },
            };
        })(),
    },
    question: {
        // The hider, a fresh question waiting.
        position: HIDER,
        state: (() => {
            const p = plays(1, { answerLast: false });
            return {
                serverNow: NOW,
                settings,
                me: { ...me("ulysse"), catchCode: "HNS1:7f3a9c2e41" },
                team: team("hunting", { question: 1, nextQuestionInMs: 4 * MIN + 31_000, huntMs: 29_000 }),
                users: users("ulysse"),
                cards: { role: "hider", pending: p.filter((x) => x.answer === null), answered: [], answeredCount: 0, unread: 1, hints: [] },
            };
        })(),
        select: "North",
    },
    choice: {
        // The hider picking which pavilion: only the ones still possible, nearest first.
        position: HIDER,
        state: (() => {
            const extra = [{ q: 5, cardIds: ["nearest_building", "room_number", "photo_seat"], picked: "nearest_building", by: "camille" }];
            const p = plays(5, { answerLast: false, extra });
            return {
                serverNow: NOW,
                settings,
                me: { ...me("ulysse"), catchCode: "HNS1:7f3a9c2e41" },
                team: team("hunting", { question: 5, nextQuestionInMs: 3 * MIN + 50_000, huntMs: 21 * MIN + 10_000 }),
                users: users("ulysse"),
                cards: { role: "hider", pending: p.filter((x) => x.answer === null), answered: p.filter((x) => x.answer !== null), answeredCount: 4, unread: 1, hints: hinted(p) },
            };
        })(),
        select: 0,
    },
    tagcode: {
        position: HIDER,
        scrollTo: "#hider-qr",
        state: (() => {
            const p = plays(4);
            return {
                serverNow: NOW,
                settings,
                me: { ...me("ulysse"), catchCode: "HNS1:7f3a9c2e41" },
                team: team("hunting", { question: 4, nextQuestionInMs: 2 * MIN + 40_000, huntMs: 17 * MIN + 20_000 }),
                users: users("ulysse"),
                cards: { role: "hider", pending: [], answered: p, answeredCount: 4, unread: 0, hints: hinted(p) },
            };
        })(),
    },
    history: {
        position: POS.jules,
        click: "#history-btn",
        state: (() => {
            const p = plays(4);
            return {
                serverNow: NOW,
                settings,
                me: me("jules"),
                team: team("hunting", { question: 4, nextQuestionInMs: 2 * MIN + 40_000, huntMs: 17 * MIN + 20_000 }),
                users: users("jules"),
                cards: { role: "stalker", batch: { id: 204, question: 4, cardIds: ROUND[3].cardIds, dealtAt: NOW - 3 * MIN, playedCardId: "closer_greenhouses", playedBy: 13, playedAt: NOW - 2 * MIN }, currentPlay: p[3], pending: [], historyCount: p.length, unread: 0, hints: hinted(p) },
            };
        })(),
        history: () => plays(4).reverse(),
    },
    found: {
        position: POS.jules,
        receipt: {
            head: "TEAM 3 · MON 5 OCT · 13:32",
            lines: [["Q1 North or south?", "NORTH"], ["Q2 Within 500 m?", "NO"], ["Q3 Closest café?", "P'TIT CAAF"], ["Q4 Closer to the greenhouse?", "YES"]],
            totals: [["Hide", "10:00"], ["Hunt", "23:14"], ["Found by", "jules"]],
            // Where they got her, for the X on the receipt map (being tried).
            hider: [HIDER.lng, HIDER.lat],
            asked: 4,
            of: 6,
        },
        state: (() => {
            const p = plays(4);
            return {
                serverNow: NOW,
                settings,
                me: me("jules"),
                team: team("ended", { status: "ended", outcome: "seekers", caughtByName: "jules", huntMs: 23 * MIN + 14_000, endedAt: NOW - 20_000 }),
                users: users("jules", { hunting: false }),
                cards: { role: "stalker", batch: null, currentPlay: null, pending: [], historyCount: 4, unread: 0, hints: hinted(p) },
            };
        })(),
        // Round 2: the receipt's lines come from the round's questions.
        history: () => plays(4).reverse(),
    },
    win: {
        position: HIDER,
        receipt: {
            head: "TEAM 3 · MON 5 OCT · 13:39",
            lines: [["Q1 North or south?", "NORTH"], ["Q2 Within 500 m?", "NO"], ["Q3 Closest café?", "P'TIT CAAF"], ["Q4 Closer to the greenhouse?", "YES"], ["Q5 Nearest door", "PHOTO"], ["Q6 Nearest building?", "ABP"]],
            totals: [["Hide", "10:00"], ["Hunt", "30:00"], ["Where", "REDACTED"]],
            asked: 6,
            of: 6,
        },
        state: (() => {
            // Its receipt lists six answers: Q6 (nearest building, truthfully ABP) narrows the map too; Q5 is a photo.
            const p = plays(6, { extra: [{ q: 6, cardIds: ["nearest_building", "photo_below", "ns"], picked: "nearest_building", by: "theo" }] });
            return {
                serverNow: NOW,
                settings,
                me: me("ulysse"),
                team: team("ended", { status: "ended", outcome: "hider", huntMs: 30 * MIN, endedAt: NOW - 20_000 }),
                users: users("ulysse", { hunting: false }),
                cards: { role: "hider", pending: [], answered: [], answeredCount: 6, unread: 0, hints: hinted(p) },
            };
        })(),
        // Round 2: the receipt's lines come from the round's questions (Q5, a photo of the nearest door).
        history: () =>
            plays(6, {
                extra: [
                    { q: 5, cardIds: ["photo_door", "radius_100", "floor"], picked: "photo_door", by: "camille", answer: "photo", photo: true },
                    { q: 6, cardIds: ["nearest_building", "photo_below", "ns"], picked: "nearest_building", by: "theo" },
                ],
            }).reverse(),
    },
};
// For the how-to-play page's walkthrough (src/how-to-play/): question 1 from
// the start, on a clock that agrees with itself. The screens above share one
// NOW late in the round, so their question 1 was "asked 16m ago".
// Two stalkers have a say (jules, the phone shown, and felix; camille and
// theo are away), so every question waits until both picked the same card.
// The page names only ulysse and felix: questions reach the hider from felix.
const q1Batch = (ago) => ({ id: 201, question: 1, cardIds: ROUND[0].cardIds, dealtAt: NOW - ago, playedCardId: null, playedBy: null, playedAt: null });
const q1Cards = (ago, picks = []) => ({
    serverNow: NOW,
    settings,
    me: me("jules"),
    team: team("hunting", { question: 1, nextQuestionInMs: 5 * MIN - ago, huntMs: ago }),
    users: users("jules"),
    cards: { role: "stalker", batch: q1Batch(ago), picks, voterIds: [12, 13], currentPlay: null, pending: [], historyCount: 0, unread: 0, hints: [] },
});
// Dealt: three cards, nothing picked.
SCREENS["demo-cards"] = { position: POS.jules, state: q1Cards(29_000) };
// The first card picked (tools/shoot-app.mjs taps it); felix went for the
// 500 m one: Send waits for felix.
SCREENS["demo-picked"] = {
    position: POS.jules,
    // Far enough that the timer's digits are all under the tabs.
    scrollTo: "#card-row .card:nth-child(1)",
    scrollPad: 100,
    state: q1Cards(36_000, [{ userId: 13, cardId: "radius_500" }]),
};
// Talked over in the call: both on north or south. Send in black.
SCREENS["demo-agreed"] = {
    position: POS.jules,
    scrollTo: "#card-row .card:nth-child(1)",
    scrollPad: 100,
    state: q1Cards(52_000, [
        { userId: 12, cardId: "ns" },
        { userId: 13, cardId: "ns" },
    ]),
};
// The hider, a few seconds later: north or south, North ticked, not sent yet.
SCREENS["demo-question"] = {
    position: HIDER,
    state: {
        serverNow: NOW,
        settings,
        me: { ...me("ulysse"), catchCode: "HNS1:7f3a9c2e41" },
        team: team("hunting", { question: 1, nextQuestionInMs: 4 * MIN + 12_000, huntMs: 48_000 }),
        users: users("ulysse"),
        cards: {
            role: "hider",
            pending: [{ id: 101, cardId: "ns", batchId: 201, question: 1, askedByName: "felix", askedAt: NOW - 8_000, askLat: POS.felix.lat, askLng: POS.felix.lng, answer: null, hasPhoto: false, answeredAt: null, editedAt: null }],
            answered: [],
            answeredCount: 0,
            // Read: no NEW arrow at the bell, which on the page pointed away from the button to tap.
            unread: 0,
            hints: [],
        },
    },
    select: "North",
};
// The page's questions carousel: one question each, as the hider gets it.
// On the QUESTIONS tab, nothing ticked yet; question q of the round.
const hiderAsked = (cardId, by, q, clock, at = HIDER) => ({
    position: at,
    scrollTo: "#hider-questions",
    scrollPad: 18,
    state: {
        serverNow: NOW,
        settings,
        me: { ...me("ulysse"), catchCode: "HNS1:7f3a9c2e41" },
        team: team("hunting", { question: q, nextQuestionInMs: clock, huntMs: q * 5 * MIN - clock }),
        users: users("ulysse"),
        cards: {
            role: "hider",
            pending: [{ id: 100 + q, cardId, batchId: 200 + q, question: q, askedByName: by, askedAt: NOW - 12_000, askLat: POS[by].lat, askLng: POS[by].lng, answer: null, hasPhoto: false, answeredAt: null, editedAt: null }],
            answered: [],
            answeredCount: q - 1,
            unread: 0,
            hints: [],
        },
    },
});
SCREENS["q-inside"] = hiderAsked("inside_outside", "felix", 2, 4 * MIN + 36_000);
SCREENS["q-room"] = hiderAsked("room_digit", "felix", 4, 4 * MIN + 41_000);
SCREENS["q-road"] = hiderAsked("street_distance", "felix", 4, 4 * MIN + 30_000);
// Which café: the hider's list, nearest first (the demo shows the map).
SCREENS["q-cafe"] = hiderAsked("nearest_cafe", "felix", 3, 4 * MIN + 20_000);
SCREENS["q-path"] = hiderAsked("terrain", "felix", 3, 4 * MIN + 44_000);
SCREENS["q-walk"] = hiderAsked("walk_minutes", "felix", 2, 4 * MIN + 27_000);
// The sculpture photo, as the stalkers get it (the mock-up's card), read: no NEW arrow.
SCREENS["q-photo"] = { ...SCREENS.photo, scrollTo: "#sent-card", scrollPad: 24, state: { ...SCREENS.photo.state, cards: { ...SCREENS.photo.state.cards, unread: 0 } } };
// For the post: the three cards as dealt (S51's layout), one of them circled.
SCREENS.cardspick = SCREENS.cards;
// The home screen (W54.1b4): the app as it opens, before any tap.
SCREENS.home = { token: false, position: POS.jules };

// ---------------------------------------------------------------------------
// Round 2: the gallery's map screens, shot on the real app (tools/shoot-app.mjs
// real). Each is the moment the lab drew (lab/maps2.js): the same answers
// behind the hints, the same question waiting, the same view, YOU on the same
// spot facing the same way, the stalkers' pins where the lab put them. The
// views, spots and headings are read off the lab's own drawing by
// design/promo/round-2/tools/capture-lab-maps.mjs (app/lab-maps.json).
// ---------------------------------------------------------------------------
const LAB = JSON.parse(fs.readFileSync(new URL("./lab-maps.json", import.meta.url), "utf8"));
const ll = ([lng, lat]) => ({ lat, lng });

/** A play waiting for its answer: question n, asked by `by` from `at`. */
function waiting(q, cardId, by, at) {
    const askedAt = HUNT_START + (q - 1) * 5 * MIN + 50_000;
    return { id: 100 + q, cardId, batchId: 200 + q, question: q, askedByName: by, askedAt, askLat: at?.lat ?? null, askLng: at?.lng ?? null, answer: null, hasPhoto: false, answeredAt: null, editedAt: null };
}

/** The hider's /state for one map screen. */
function mapState({ me = "ulysse", users: list, question, clock, answered, pending = [], unread = pending.length }) {
    const roster = list.map((u, i) => ({ id: 11 + i, username: u.name, role: u.role, isAdmin: false, groupId: 3, cardsSeenAt: 0, online: true, lat: u.at?.lat ?? null, lng: u.at?.lng ?? null, updatedAt: NOW - 3000 }));
    const meRow = roster.find((u) => u.username === me);
    return {
        serverNow: NOW,
        settings,
        me: { id: meRow.id, username: me, role: "hider", isAdmin: false, groupId: 3, cardsSeenAt: 0, catchCode: "HNS1:7f3a9c2e41" },
        team: team("hunting", { question, nextQuestionInMs: clock, huntMs: (question - 1) * 5 * MIN + 5 * MIN - clock, hiderName: me }),
        users: roster,
        cards: { role: "hider", pending, answered, answeredCount: answered.length, unread, hints: hinted(answered) },
    };
}

/** On the MAP tab, at the lab's view, YOU facing the lab's way; then a tap, if the screen has one. */
const mapSetup = (lab, tap) => async (page) => {
    await page.click('.view-tab[data-view="map"]');
    // The map tab shows the whole campus the first time it opens; then the lab's view.
    await page.waitForTimeout(300);
    await page.evaluate(({ v, deg }) => {
        window.HNSMap.map.setView([v.lat, v.lng], v.zoom, { animate: false });
        // The phone's compass: an absolute orientation event (alpha turns the other way).
        window.dispatchEvent(new DeviceOrientationEvent("deviceorientationabsolute", { alpha: (360 - deg) % 360, beta: 0, gamma: 0, absolute: true }));
    }, { v: lab.view, deg: lab.deg });
    await page.waitForTimeout(1500);
    if (tap) {
        const at = await page.evaluate((t) => {
            const p = window.HNSMap.map.latLngToContainerPoint([t.lat, t.lng]);
            const box = document.getElementById("map").getBoundingClientRect();
            return [box.left + p.x, box.top + p.y + (t.dy ?? 0)];
        }, tap);
        await page.mouse.click(at[0], at[1]);
        await page.waitForTimeout(400);
    }
};

const GH = LAB.g9a;
const greenhouseHints = (n) => plays(n);
const stalkersAt = (pins) => [
    { name: "jules", role: "stalker" },
    { name: "felix", role: "stalker", at: pins[0] },
    { name: "camille", role: "stalker", at: pins[1] },
    { name: "theo", role: "stalker" },
];
const VELO_63 = LANDMARK_GROUPS.velo.places.find((p) => p.id === "velo_63");
// Where the heat around the hider varies most (by the church).
const HEAT_SPOT = { lat: 46.7835, lng: -71.2701 };

// The Pub U game (lab/maps.js GAMES.pubu): olivier hides; three answers in.
const PUBU = LAB.pubu;
const OLIVIER = ll(PUBU.hider);
const pubuPlays = () => {
    const metres = (a, b) => {
        const R = 6371000;
        const dLat = ((b.lat - a.lat) * Math.PI) / 180;
        const dLng = ((b.lng - a.lng) * Math.PI) / 180;
        const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(h));
    };
    const truthful = (q) => {
        const at = ll(q.at);
        if (q.ew) return { cardId: "ew", answer: OLIVIER.lng > at.lng ? "East" : "West" };
        if (q.ns) return { cardId: "ns", answer: OLIVIER.lat > at.lat ? "North" : "South" };
        return { cardId: `radius_${q.radius}`, answer: metres(OLIVIER, at) <= q.radius ? "Yes" : "No" };
    };
    return PUBU.qs.map((q, i) => {
        const { cardId, answer } = truthful(q);
        const askedAt = HUNT_START + i * 5 * MIN + 50_000;
        const at = ll(q.at);
        return { id: 100 + i + 1, cardId, batchId: 201 + i, question: i + 1, askedByName: q.by, askedAt, askLat: at.lat, askLng: at.lng, answer, hasPhoto: false, answeredAt: askedAt + 70_000, editedAt: null };
    });
};

export const MAP_SCREENS = {
    // S61, the post's image 5: the hints layer between questions (two answers in).
    g9a: { you: LAB.g9a.you, state: mapState({ users: [{ name: "ulysse", role: "hider", at: LAB.g9a.you }, ...stalkersAt(GH.pins)], question: 2, clock: 3 * MIN + 12_000, answered: greenhouseHints(2) }), setup: mapSetup(LAB.g9a) },
    // S62: the same, camille's pin tapped: her name above it.
    g10a: { you: LAB.g10a.you, state: mapState({ users: [{ name: "ulysse", role: "hider", at: LAB.g10a.you }, ...stalkersAt(LAB.g10a.pins)], question: 2, clock: 3 * MIN + 12_000, answered: greenhouseHints(2) }), setup: mapSetup(LAB.g10a, LAB.g10a.pins[1]) },
    // S68: the same moment, how far the closest stalker is scribbled in the box.
    g11a: { you: LAB.g11a.you, state: mapState({ users: [{ name: "ulysse", role: "hider", at: LAB.g11a.you }, ...stalkersAt(LAB.g11a.pins)], question: 2, clock: 3 * MIN + 12_000, answered: greenhouseHints(2) }), setup: mapSetup(LAB.g11a) },
    // S63, the post's image 3: "Which àVélo station are you closest to?" waiting.
    v2c: { you: LAB.v2c.you, state: mapState({ users: [{ name: "ulysse", role: "hider", at: LAB.v2c.you }, ...stalkersAt([null, null])], question: 3, clock: 62_000, answered: greenhouseHints(2), pending: [waiting(3, "nearest_velo", "felix", null)] }), setup: mapSetup(LAB.v2c) },
    // S64: the same, her station's pin tapped: its pop-up.
    v8c: { you: LAB.v8c.you, state: mapState({ users: [{ name: "ulysse", role: "hider", at: LAB.v8c.you }, ...stalkersAt([null, null])], question: 3, clock: 62_000, answered: greenhouseHints(2), pending: [waiting(3, "nearest_velo", "felix", null)] }), setup: mapSetup(LAB.v8c, { lat: VELO_63.lat, lng: VELO_63.lng, dy: -24 }) },
    // S69, the post's image 6: north or south, asked from the line.
    n11d: { you: LAB.n11d.you, state: mapState({ users: [{ name: "ulysse", role: "hider", at: LAB.n11d.you }, { name: "jules", role: "stalker" }, { name: "felix", role: "stalker" }, { name: "camille", role: "stalker", at: LAB.n11d.asker }, { name: "theo", role: "stalker" }], question: 5, clock: 2 * MIN + 40_000, answered: greenhouseHints(4), pending: [waiting(5, "ns", "camille", LAB.n11d.asker)] }), setup: mapSetup(LAB.n11d) },
    // S65: closer to the greenhouse than felix: the place's tag, no circle; the two stalkers' pins.
    "N10.2": { you: LAB["N10.2"].you, state: mapState({ users: [{ name: "ulysse", role: "hider", at: LAB["N10.2"].you }, ...stalkersAt(LAB["N10.2"].pins)], question: 4, clock: 48_000, answered: greenhouseHints(3), pending: [waiting(4, "closer_greenhouses", "felix", POS.felix)] }), setup: mapSetup(LAB["N10.2"]) },
    // S66: east or west of camille.
    N12: { you: LAB.N12.you, state: mapState({ users: [{ name: "ulysse", role: "hider", at: LAB.N12.you }, { name: "jules", role: "stalker", at: POS.jules }, { name: "felix", role: "stalker", at: POS.felix }, { name: "camille", role: "stalker", at: POS.camille }, { name: "theo", role: "stalker", at: POS.theo }], question: 5, clock: 2 * MIN + 40_000, answered: greenhouseHints(4), pending: [waiting(5, "ew", "camille", POS.camille)] }), setup: mapSetup(LAB.N12) },
    // The how-to-play page's demo: the hider's map for question 1 (north or
    // south of felix, asked from Vachon: ulysse is just north of the line),
    // and for "which café", every café pinned.
    "demo-line": {
        you: HIDER,
        state: mapState({ users: [{ name: "ulysse", role: "hider", at: HIDER }, { name: "jules", role: "stalker" }, { name: "felix", role: "stalker", at: POS.felix }, { name: "camille", role: "stalker" }, { name: "theo", role: "stalker" }], question: 1, clock: 4 * MIN + 12_000, answered: [], pending: [{ ...waiting(1, "ns", "felix", POS.felix), askedAt: NOW - 8_000 }], unread: 0 }),
        setup: mapSetup({ view: { lat: 46.7805, lng: -71.2779, zoom: 16.8 }, deg: 100 }),
    },
    "demo-cafes": {
        you: HIDER,
        state: mapState({ users: [{ name: "ulysse", role: "hider", at: HIDER }, ...stalkersAt([null, null])], question: 3, clock: 4 * MIN + 20_000, answered: greenhouseHints(2), pending: [waiting(3, "nearest_cafe", "felix", null)], unread: 0 }),
        setup: mapSetup({ view: { lat: 46.7801, lng: -71.2783, zoom: 16 }, deg: 20 }),
    },
    // The page's questions carousel: each question waiting on the hider's
    // map, as it draws it. Read: no NEW arrow over the question.
    "q-ns": { you: LAB.n11d.you, state: mapState({ users: [{ name: "ulysse", role: "hider", at: LAB.n11d.you }, { name: "jules", role: "stalker" }, { name: "felix", role: "stalker", at: LAB.n11d.asker }, { name: "camille", role: "stalker" }, { name: "theo", role: "stalker" }], question: 5, clock: 2 * MIN + 40_000, answered: greenhouseHints(4), pending: [waiting(5, "ns", "felix", LAB.n11d.asker)], unread: 0 }), setup: mapSetup(LAB.n11d) },
    "q-radius": {
        you: HIDER,
        state: mapState({ users: [{ name: "ulysse", role: "hider", at: HIDER }, ...stalkersAt([POS.felix, null])], question: 2, clock: 4 * MIN + 10_000, answered: greenhouseHints(1), pending: [waiting(2, "radius_200", "felix", POS.felix)], unread: 0 }),
        setup: mapSetup({ view: { lat: POS.felix.lat - 0.0002, lng: POS.felix.lng + 0.0003, zoom: 16 }, deg: 80 }),
    },
    "q-closer": {
        you: HIDER,
        state: mapState({ users: [{ name: "ulysse", role: "hider", at: HIDER }, ...stalkersAt([POS.camille, null])], question: 1, clock: 4 * MIN + 25_000, answered: [], pending: [waiting(1, "closer_church", "felix", POS.camille)], unread: 0 }),
        setup: mapSetup({ view: { lat: 46.7812, lng: -71.2748, zoom: 15.5 }, deg: 70 }),
    },
    "q-velo": { you: LAB.v2c.you, state: mapState({ users: [{ name: "ulysse", role: "hider", at: LAB.v2c.you }, ...stalkersAt([null, null])], question: 3, clock: 62_000, answered: greenhouseHints(2), pending: [waiting(3, "nearest_velo", "felix", null)], unread: 0 }), setup: mapSetup(LAB.v2c) },
    // In what part of Vachon: the stalkers named it; ulysse is inside, by B.
    "q-section": {
        you: { lat: 46.78062, lng: -71.27712 },
        state: mapState({ users: [{ name: "ulysse", role: "hider", at: { lat: 46.78062, lng: -71.27712 } }, ...stalkersAt([null, null])], question: 5, clock: 3 * MIN + 5_000, answered: [], pending: [{ ...waiting(5, "building_section", "felix", null), target: "pav_vch" }], unread: 0 }),
        setup: mapSetup({ view: { lat: 46.78035, lng: -71.2769, zoom: 17.6 }, deg: 40 }),
    },
    // The heatmap question: the hider's map, the whole campus, the heatmap
    // switch on (it is there once the question has been asked). No answers
    // yet, so nothing covers the heat.
    "q-heat": {
        you: HEAT_SPOT,
        state: (() => {
            const s = mapState({ users: [{ name: "ulysse", role: "hider", at: HEAT_SPOT }, ...stalkersAt([null, null])], question: 3, clock: 4 * MIN + 22_000, answered: [], pending: [waiting(3, "heatmap", "felix", null)], unread: 0 });
            return { ...s, cards: { ...s.cards, askedCardIds: ["heatmap"] } };
        })(),
        setup: async (page) => {
            await mapSetup({ view: { lat: 46.7821, lng: -71.2747, zoom: 14.55 }, deg: 20 })(page);
            await page.click("#heat-switch");
            await page.waitForTimeout(1500);
        },
    },
    // S67: within 200 m of lea (the Pub U game).
    N14: { you: LAB.N14.you, state: mapState({ me: "olivier", users: [{ name: "olivier", role: "hider", at: LAB.N14.you }, ...Object.entries(PUBU.pos).map(([name, at]) => ({ name, role: "stalker", at: ll(at) }))], question: 4, clock: 4 * MIN + 5_000, answered: pubuPlays(), pending: [waiting(4, "radius_200", "lea", ll(PUBU.pos.lea))] }), setup: mapSetup(LAB.N14) },
};

// For the mock-up only (not a real card): the photo question asks for the nearest sculpture.
export const catalog = () => {
    const c = catalogPayload();
    const swap = {
        photo_seat: { prompt: "Send a photo of the nearest sculpture.", short: "Photo: the nearest sculpture" },
        closer_greenhouses: { prompt: "Are you closer to the greenhouse than I am?" },
        // As the map's question box has it (image 3 of the post): no "on campus".
        nearest_velo: { prompt: "Which àVélo station are you closest to?" },
    };
    // Every "nearest" question as the post words it (image 3): no "on campus".
    const plain = (k) => (k.id.startsWith("nearest_") ? { ...k, prompt: k.prompt.replace(" on campus", "") } : k);
    return { ...c, cards: c.cards.map((k) => plain(swap[k.id] ? { ...k, ...swap[k.id] } : k)) };
};
