// A fake game server for screenshots: canned /state payloads for one team
// (team 3) at the moments worth showing. Nothing here is invented about the
// game itself: the deck is the real one (worker/src/cards.js), and every
// answer is what an honest hider at HIDER would give (same rules as
// worker/simulate.mjs).
//
// Usernames are made up.

import { catalogPayload, LANDMARK_GROUPS, LANDMARKS } from "../../../../worker/src/cards.js";

export const NOW = Date.parse("2026-10-05T13:27:00-04:00");
const MIN = 60_000;

// Where everyone is (lat, lng).
export const HIDER = { lat: 46.7806, lng: -71.2789 }; // by the greenhouses
const POS = {
    jules: { lat: 46.779163, lng: -71.2692303 }, // Pollack
    noah_b: { lat: 46.7803276, lng: -71.2768114 }, // Vachon
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
    { id: 11, username: "maelle", role: "hider" },
    { id: 12, username: "jules", role: "stalker" },
    { id: 13, username: "noah_b", role: "stalker" },
    { id: 14, username: "camille", role: "stalker" },
    { id: 15, username: "theo", role: "stalker" },
];

// The round so far: question n was dealt at hunt start + (n-1) * 5 min.
const HUNT_START = NOW - 17 * MIN - 20_000; // 13:09:40 -> Q4 is live
const ROUND = [
    { q: 1, cardIds: ["ns", "closer_church", "radius_500"], picked: "ns", by: "jules" },
    { q: 2, cardIds: ["radius_500", "walk_minutes", "nearest_velo"], picked: "radius_500", by: "jules" },
    { q: 3, cardIds: ["nearest_cafe", "photo_window", "closer_outer_ring"], picked: "nearest_cafe", by: "noah_b" },
    { q: 4, cardIds: ["closer_greenhouses", "nearest_building", "photo_below"], picked: "closer_greenhouses", by: "noah_b" },
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
        hiderName: "maelle",
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

const settings = { debug: false, discordUrl: "https://discord.gg/hideandstalk" };

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
    ready: {
        position: POS.jules,
        state: { serverNow: NOW, settings, me: me("jules"), team: team("ready"), users: users("jules", { hunting: false }), cards: null },
    },
    hiding: {
        position: HIDER,
        state: { serverNow: NOW, settings, me: { ...me("maelle"), catchCode: "HNS1:7f3a9c2e41" }, team: team("hiding", { hideRemainingMs: 8 * MIN + 41_000 }), users: users("maelle"), cards: { role: "hider", pending: [], answered: [], answeredCount: 0, unread: 0, hints: [] } },
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
        position: POS.noah_b,
        state: (() => {
            const p = plays(3, { answerLast: false });
            return {
                serverNow: NOW,
                settings,
                me: me("noah_b"),
                team: team("hunting", { question: 3, nextQuestionInMs: 3 * MIN + 31_000, huntMs: 11 * MIN + 29_000 }),
                users: users("noah_b"),
                cards: { role: "stalker", batch: { id: 203, question: 3, cardIds: ROUND[2].cardIds, dealtAt: NOW - 90_000, playedCardId: "nearest_cafe", playedBy: 13, playedAt: NOW - 29_000 }, currentPlay: p[2], pending: [], historyCount: p.length, unread: 0, hints: hinted(p) },
            };
        })(),
    },
    // The answer is on screen, so it's read: no bell to point at.
    sent: {
        position: POS.noah_b,
        state: (() => {
            const p = plays(3);
            return {
                serverNow: NOW,
                settings,
                me: me("noah_b"),
                team: team("hunting", { question: 3, nextQuestionInMs: 2 * MIN + 3_000, huntMs: 12 * MIN + 57_000 }),
                users: users("noah_b"),
                cards: { role: "stalker", batch: { id: 203, question: 3, cardIds: ROUND[2].cardIds, dealtAt: NOW - 3 * MIN, playedCardId: "nearest_cafe", playedBy: 13, playedAt: NOW - 2 * MIN }, currentPlay: p[2], pending: [], historyCount: p.length, unread: 0, hints: hinted(p) },
            };
        })(),
    },
    photo: {
        position: POS.camille,
        photo: true,
        state: (() => {
            const extra = [{ q: 5, cardIds: ["photo_door", "radius_100", "floor"], picked: "photo_door", by: "camille", answer: "photo", photo: true }];
            const p = plays(5, { extra });
            return {
                serverNow: NOW,
                settings,
                me: me("camille"),
                team: team("hunting", { question: 5, nextQuestionInMs: 1 * MIN + 36_000, huntMs: 23 * MIN + 24_000 }),
                users: users("camille"),
                cards: { role: "stalker", batch: { id: 205, question: 5, cardIds: extra[0].cardIds, dealtAt: NOW - 3 * MIN, playedCardId: "photo_door", playedBy: 14, playedAt: NOW - 150_000 }, currentPlay: p[4], pending: [], historyCount: p.length, unread: 0, hints: hinted(p) },
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
                me: { ...me("maelle"), catchCode: "HNS1:7f3a9c2e41" },
                team: team("hunting", { question: 1, nextQuestionInMs: 4 * MIN + 31_000, huntMs: 29_000 }),
                users: users("maelle"),
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
                me: { ...me("maelle"), catchCode: "HNS1:7f3a9c2e41" },
                team: team("hunting", { question: 5, nextQuestionInMs: 3 * MIN + 50_000, huntMs: 21 * MIN + 10_000 }),
                users: users("maelle"),
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
                me: { ...me("maelle"), catchCode: "HNS1:7f3a9c2e41" },
                team: team("hunting", { question: 4, nextQuestionInMs: 2 * MIN + 40_000, huntMs: 17 * MIN + 20_000 }),
                users: users("maelle"),
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
    },
    win: {
        position: HIDER,
        state: (() => {
            const p = plays(4);
            return {
                serverNow: NOW,
                settings,
                me: me("maelle"),
                team: team("ended", { status: "ended", outcome: "hider", huntMs: 30 * MIN, endedAt: NOW - 20_000 }),
                users: users("maelle", { hunting: false }),
                cards: { role: "hider", pending: [], answered: [], answeredCount: 6, unread: 0, hints: hinted(p) },
            };
        })(),
    },
};

export const catalog = catalogPayload;
