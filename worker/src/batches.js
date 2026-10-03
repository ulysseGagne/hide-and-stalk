// Card batches: three cards per question, one question every interval.
//
// The team clock (teams.js) says how many questions have arrived; this file
// deals them. A batch belongs to the team, not to one stalker: every stalker
// picks a card, and the question goes out once they have all picked the same
// one (index.js, /cards/send), so the hider answers one question per interval
// no matter how many stalkers are hunting them.
//
// A question the stalkers let slip is not lost: it stays in hand, and the
// questions pile up until they are sent. The oldest one in hand is the one
// face up, and the moment it goes out the next one in hand is face up too,
// with no waiting for the timer.

import { CARDS, CARDS_BY_ID } from "./cards.js";

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

/**
 * Every card this team has been *offered* this round - not just the ones it
 * played. A card burnt unplayed in an earlier batch is still one they have
 * seen, so it does not come back. Also the ones it played, for `notAfter`.
 */
async function roundSoFar(env, teamId) {
    const { results } = await env.DB.prepare(
        "SELECT card_ids, played_card_id FROM card_batches WHERE group_id = ?",
    )
        .bind(teamId)
        .all();
    const dealt = new Set();
    const played = new Set();
    for (const row of results) {
        for (const id of JSON.parse(row.card_ids)) dealt.add(id);
        if (row.played_card_id) played.add(row.played_card_id);
    }
    return { dealt, played };
}

/** A card's `notAfter`: one of its sets has been played in full. */
const ruledOut = (card, played) =>
    card.notAfter?.some((set) => set.every((id) => played.has(id))) ?? false;

/** How far a card's tier sits from the question being dealt. 0 == right on it. */
const tierDistance = (card, question) =>
    Math.min(...card.tiers.map((t) => Math.abs(t - question)));

/**
 * The three cards for a question.
 *
 * Three rules, in order of precedence:
 *  1. Never offer a card its `notAfter` rules out (the exact room id once the
 *     room number has come out in parts). This one holds even when the deck
 *     comes back.
 *  2. Never offer the same card to the same team twice in a round. Only if the
 *     whole deck has been through does everything come back.
 *  3. Prefer cards whose tier matches the question number, so question 1 is
 *     openers and question 6 is closers. When a tier has been picked clean the
 *     nearest tiers fill in, rather than the batch drying up.
 *
 * Questions are dealt only when they come face up, after every earlier one has
 * been sent, so `played` is everything the hider has been asked before this.
 */
async function pickCards(env, teamId, question) {
    const { dealt, played } = await roundSoFar(env, teamId);
    const allowed = CARDS.filter((c) => !ruledOut(c, played));
    let pool = allowed.filter((c) => !dealt.has(c.id));
    if (pool.length < 3) pool = allowed;
    // Shuffle first, then a *stable* sort on tier distance: random within a
    // tier, ordered between tiers.
    return shuffle([...pool])
        .sort((a, b) => tierDistance(a, question) - tierDistance(b, question))
        .slice(0, 3)
        .map((c) => c.id);
}

const batchFor = (env, teamId, question) =>
    env.DB.prepare("SELECT * FROM card_batches WHERE group_id = ? AND question = ?")
        .bind(teamId, question)
        .first();

/**
 * The batch the team's stalkers are looking at, and how many questions they
 * have in hand. Every question the clock has brought so far (1 to `question`)
 * is theirs until they send it; the oldest one not sent is face up, dealt now
 * if nobody has looked at it yet. With nothing in hand, it is the last one
 * they sent, so its card stays on screen while the answer comes in.
 *
 * Safe to race: (group_id, question) is unique, so two teammates polling the
 * moment a question arrives both end up looking at the same three cards.
 * @returns {Promise<{ batch: object, inHand: number }>}
 */
export async function liveTeamBatch(env, teamId, question, now) {
    const { results } = await env.DB.prepare(
        "SELECT question FROM card_batches WHERE group_id = ? AND played_card_id IS NOT NULL",
    )
        .bind(teamId)
        .all();
    const sent = new Set(results.map((r) => r.question));
    let first = null;
    let inHand = 0;
    for (let q = 1; q <= question; q++) {
        if (sent.has(q)) continue;
        inHand++;
        first ??= q;
    }
    const face = first ?? question;
    const existing = await batchFor(env, teamId, face);
    if (existing) return { batch: existing, inHand };
    const cardIds = await pickCards(env, teamId, face);
    // remaining_ms / rate / rate_updated_at belong to the old variable-rate
    // timer and are not read any more, but databases migrated from it still
    // insist on a value.
    await env.DB.prepare(
        `INSERT OR IGNORE INTO card_batches
            (group_id, card_ids, dealt_at, remaining_ms, rate, rate_updated_at, question)
         VALUES (?, ?, ?, 0, 1.0, ?, ?)`,
    )
        .bind(teamId, JSON.stringify(cardIds), now, now, face)
        .run();
    return { batch: await batchFor(env, teamId, face), inHand };
}

/** Shape a batch for the stalker menu. */
export function publicBatch(batch) {
    return {
        id: batch.id,
        question: batch.question,
        cardIds: JSON.parse(batch.card_ids),
        dealtAt: batch.dealt_at,
        playedCardId: batch.played_card_id,
        playedBy: batch.played_by,
        playedAt: batch.played_at,
    };
}

/** Each stalker's pick on a batch: user id -> card id. */
export async function picksOn(env, batchId) {
    const { results } = await env.DB.prepare("SELECT user_id, card_id FROM card_picks WHERE batch_id = ?")
        .bind(batchId)
        .all();
    return new Map(results.map((r) => [r.user_id, r.card_id]));
}

/** Guard for /cards/pick and /cards/send: the card must be face up in the team's live batch, still unsent. */
export function cardIsInBatch(batch, cardId) {
    if (!batch || batch.played_card_id) return false;
    if (!CARDS_BY_ID.has(cardId)) return false;
    return JSON.parse(batch.card_ids).includes(cardId);
}
