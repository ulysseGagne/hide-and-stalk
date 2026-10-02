// The card catalogue — single source of truth for the deck.
//
// The Worker deals from it and validates answers against it; the frontend
// fetches it once from `GET /cards/catalog` so the two can never drift apart.
//
// A card has:
//   id          stable key, stored in card_plays.card_id
//   category    used for the card back / colour in the UI
//   prompt      the question the hider sees ({building}: the one the stalker named)
//   short       compact label: the line for this question on the end-of-round
//               receipt ("Q1 North or south?")
//   answer      how the hider replies:
//                 { type: "radio",    options: [...] }
//                 { type: "choice",   group: "<landmark group>" }  options from LANDMARK_GROUPS
//                 { type: "checkbox", options: [...] }
//                 { type: "text",     placeholder }
//                 { type: "number",   unit, min, max }
//                 { type: "coords" }                    -> { lat, lng }
//                 { type: "photo" }
//                 { type: "section" }                   a letter, A to D: the
//                                                       target building's section
//   target      "building" when the stalker names a building as they send it
//               (BUILDINGS); kept in card_plays.target
//   needsAsker  true when the question is relative to the stalker who played it
//               ("...than me?"). Such cards can only be played while that
//               stalker is sharing their position, and that position is
//               snapshotted at play time so later movement can't rewrite it.
//   hint        geometry descriptor consumed by src/hints.js, or null for cards
//               that narrow nothing on the map (photos, floor numbers, ...).
//   tiers       which question numbers this card may be dealt as. Question 1
//               arrives when the hunt starts, question 2 five minutes later, and
//               so on up to 6, so `tiers: [3, 4, 5]` means "mid-game card".
//               See TIERS below.

import {
    BUILDINGS,
    CAMPUS_BORDER,
    LANDMARK_POINTS,
    LANDMARK_GROUP_PLACES,
} from "./locations.js";

// ---------------------------------------------------------------------------
// Play area + landmarks
// ---------------------------------------------------------------------------
// All three come out of locations/geojson/*.geojson via
// tools/build-locations.mjs, which also generates the overlay data the map
// draws (src/locations.js). Edit the GeoJSON and re-run the generator - never
// the coordinates here.

// The starting region for the Hints filter: every answer intersects into this.
// The real campus perimeter, so the "outer ring of campus" card and the
// initial region are the loop players can actually walk.
export const PLAY_AREA = {
    name: CAMPUS_BORDER.name,
    // [lng, lat] pairs, first == last.
    ring: CAMPUS_BORDER.ring,
};

// Single places, used by the "are you closer to X than me?" cards. One card is
// generated per entry.
export const LANDMARKS = LANDMARK_POINTS;

// Sets of places, used by the "which X are you closest to?" cards. The hider
// picks one; the hint is that landmark's Voronoi cell inside the play area.
export const LANDMARK_GROUPS = LANDMARK_GROUP_PLACES;

// Straight-line distance can never exceed walking distance, and a real walking
// route on campus is rarely more than WALK_DETOUR_FACTOR times longer than the
// crow flies. Together these turn "N minutes to walk to you" into a ring
// around the stalker rather than a single circle.
export const WALK_SPEED_M_PER_MIN = 80;
export const WALK_DETOUR_FACTOR = 1.6;
// Slack on the outer edge for rounding in whatever app the hider consulted.
export const WALK_SLACK = 1.1;

const YES_NO = ["Yes", "No"];

// ---------------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------------
// How much a card gives away, expressed as the question numbers it may be dealt
// as: question 1 when the hunt starts, then one more every 5 minutes up to 6.
// Openers cut the campus in half; closers put a stalker in the right corridor.
// LATE lists 7 only to keep the pattern: question 7 never comes (the hider has
// won by then).
//
// batches.js prefers the tier matching the team's current question number and
// widens to the nearest tiers when one has been picked clean, so these are a
// running order rather than a hard gate.
const EARLY = [1, 2];
const EARLY_MID = [2, 3, 4];
const MID = [3, 4, 5];
const MID_LATE = [4, 5, 6];
const LATE = [5, 6, 7];
const ENDGAME = [6];

// ---------------------------------------------------------------------------
// Deck
// ---------------------------------------------------------------------------
const DIRECTION_CARDS = [
    {
        id: "ns",
        category: "direction",
        prompt: "Are you north or south of me?",
        short: "North or south?",
        answer: { type: "radio", options: ["North", "South"] },
        needsAsker: true,
        hint: {
            type: "halfPlane",
            axis: "ns",
            keep: { North: "north", South: "south" },
        },
        tiers: EARLY,
    },
    {
        id: "ew",
        category: "direction",
        prompt: "Are you east or west of me?",
        short: "East or west?",
        answer: { type: "radio", options: ["East", "West"] },
        needsAsker: true,
        hint: {
            type: "halfPlane",
            axis: "ew",
            keep: { East: "east", West: "west" },
        },
        tiers: EARLY,
    },
];

// A wide ring barely narrows anything; a tight one all but lands on the hider.
const RADIUS_TIERS = {
    50: LATE,
    100: MID,
    200: EARLY_MID,
    300: EARLY_MID,
    500: EARLY,
};

const RADIUS_CARDS = [50, 100, 200, 300, 500].map((m) => ({
    id: `radius_${m}`,
    category: "radius",
    prompt: `Are you within ${m} m of me?`,
    short: `Within ${m} m?`,
    answer: { type: "radio", options: YES_NO },
    needsAsker: true,
    hint: { type: "radius", meters: m, keep: { Yes: "within", No: "outside" } },
    tiers: RADIUS_TIERS[m],
}));

const WALK_CARD = {
    id: "walk_minutes",
    category: "radius",
    prompt:
        "Using Google Maps, how many minutes would it take me to walk to you? Round to the nearest minute.",
    short: "Minutes to walk?",
    answer: { type: "number", unit: "minutes", min: 0, max: 90 },
    needsAsker: true,
    hint: { type: "walkTime" },
    tiers: EARLY_MID,
};

const CLOSER_CARDS = Object.entries(LANDMARKS).map(([key, { label, phrase }]) => ({
    id: `closer_${key}`,
    category: "proximity",
    // `phrase` carries its own article: "the church", but "Pub U".
    prompt: `Are you closer to ${phrase} than I am?`,
    short: `Closer to ${phrase}?`,
    answer: { type: "radio", options: YES_NO },
    needsAsker: true,
    hint: {
        type: "closerThan",
        landmark: key,
        keep: { Yes: "closer", No: "farther" },
    },
    // Every named landmark sits well inside campus, so all of these split the
    // map coarsely - opening moves.
    tiers: EARLY,
}));

const RING_CARD = {
    id: "closer_outer_ring",
    category: "proximity",
    prompt: "Are you closer to the campus border than I am?",
    short: "Closer to the border?",
    answer: { type: "radio", options: YES_NO },
    needsAsker: true,
    hint: { type: "closerToBoundary", keep: { Yes: "closer", No: "farther" } },
    tiers: EARLY_MID,
};

// Six stations spread over the whole campus barely narrow it; twenty-five
// pavilions put you in one building.
const NEAREST_TIERS = {
    building: MID,
    cafe: EARLY_MID,
    bus_stop: MID,
    velo: EARLY,
};

const NEAREST_CARDS = Object.entries(LANDMARK_GROUPS).map(([key, { label }]) => ({
    id: `nearest_${key}`,
    category: "proximity",
    prompt: `Which ${label} are you closest to?`,
    short: `Closest ${label}?`,
    answer: { type: "choice", group: key },
    needsAsker: false,
    hint: { type: "nearest", group: key },
    tiers: NEAREST_TIERS[key],
}));

// What part of a building: the stalker names the building as they send it
// (the phone offers only those the hints still allow, a building partly cut
// off included), and the hider answers with the closest of its section pins,
// two to four of them, placed by hand (building-sections.geojson). A closer.
const SECTION_CARD = {
    id: "building_section",
    category: "proximity",
    prompt: "In what part of {building} are you?",
    short: "Part of {building}?",
    answer: { type: "section" },
    target: "building",
    needsAsker: false,
    hint: { type: "section" },
    tiers: MID_LATE,
};

const CONTEXT_CARDS = [
    {
        id: "inside_outside",
        category: "context",
        prompt: "Are you inside or outside?",
        short: "Inside or outside?",
        answer: { type: "radio", options: ["Inside", "Outside"] },
        needsAsker: false,
        hint: null,
        // Hiding inside a pavilion was too strong: the inside questions come
        // early, so the stalkers learn sooner that it is a building search.
        tiers: EARLY_MID,
    },
    // A room's id is its pavilion's code, then the floor, then the room:
    // ABC-1234. One card asks for each part, the part written out in the
    // prompt between [brackets] (cards.js on the phone underlines it); the
    // pavilion's code comes from "Which building are you closest to?".
    {
        id: "floor",
        category: "context",
        prompt: "What floor are you on? It is the first digit of the room numbers there: ABC-[1]234. Answer N/A if you are outside.",
        short: "Floor?",
        answer: { type: "text", placeholder: "e.g. 3, or N/A" },
        needsAsker: false,
        hint: null,
        tiers: MID,
    },
    {
        id: "room_digit",
        category: "context",
        prompt: "What is the second digit of the nearest room number? ABC-1[2]34. Answer N/A if you are outside.",
        short: "Room's 2nd digit?",
        answer: { type: "text", placeholder: "e.g. 7, or N/A" },
        needsAsker: false,
        hint: null,
        tiers: MID,
    },
    {
        id: "room_number",
        category: "context",
        prompt: "What are the last two digits of the nearest room number? ABC-12[34]. Answer N/A if you are outside.",
        short: "Room's last 2 digits?",
        answer: { type: "text", placeholder: "e.g. 01, or N/A" },
        needsAsker: false,
        hint: null,
        tiers: MID_LATE,
    },
    {
        id: "room_id",
        category: "context",
        prompt: "What is the exact id of the nearest room? [ABC-1234]. Answer N/A if you are outside.",
        short: "Exact room id?",
        answer: { type: "text", placeholder: "e.g. PLT-2701, or N/A" },
        needsAsker: false,
        // The pavilion code names the building, but only a human reading it
        // knows that, so this narrows nothing on the map by itself.
        hint: null,
        tiers: ENDGAME,
    },
    {
        id: "exact_coordinates",
        category: "context",
        prompt: "Send me your exact coordinates.",
        short: "Exact coordinates?",
        answer: { type: "coords" },
        needsAsker: false,
        // The card that ends the round: it pins the hider to a GPS fix's worth
        // of uncertainty.
        hint: { type: "point", radiusM: 30 },
        tiers: ENDGAME,
    },
    {
        id: "street_view",
        category: "context",
        prompt: "Could we see you on Google Street View from where you are?",
        short: "On Street View?",
        answer: { type: "radio", options: YES_NO },
        needsAsker: false,
        hint: null,
        tiers: MID,
    },
    {
        id: "bike_lane",
        category: "context",
        prompt: "Can you see a bike lane?",
        short: "Bike lane?",
        answer: { type: "radio", options: YES_NO },
        needsAsker: false,
        hint: null,
        tiers: MID,
    },
    {
        id: "people_around",
        category: "context",
        prompt: "How many people are around you?",
        short: "People around?",
        answer: {
            type: "radio",
            options: ["Nobody", "1-5", "6-20", "More than 20"],
        },
        needsAsker: false,
        hint: null,
        tiers: MID,
    },
    {
        // The rules keep the hider within 10-20 m of somewhere a pedestrian
        // belongs, so there is always a right answer here. Kept to six plain
        // options on purpose: easy to answer, nothing to argue about.
        id: "terrain",
        category: "context",
        prompt: "What kind of path are you closest to?",
        short: "Nearest path?",
        answer: {
            type: "radio",
            options: [
                "Sidewalk",
                "Bike path",
                "Indoor hallway",
                "Forest trail",
                "Plaza or courtyard",
                "Parking lot",
            ],
        },
        needsAsker: false,
        hint: null,
        tiers: MID,
    },
];

// A skyline shot could have been taken from half the campus; the door you are
// standing at could not.
// [key, what the prompt asks for, the receipt's short label, tiers]
const PHOTO_SUBJECTS = [
    ["tallest", "the tallest thing you can see", "Tallest thing in sight", EARLY_MID],
    ["window", "a window", "A window", EARLY_MID],
    ["below", "what is below you", "What is below you", MID],
    ["above", "what is above you", "What is above you", MID],
    ["plant", "the biggest plant or tree near you", "Biggest plant or tree", MID_LATE],
    ["seat", "the nearest place to sit", "Nearest place to sit", MID_LATE],
    ["car", "a car parked near you", "A car parked near you", MID_LATE],
    ["sign", "the nearest sign", "Nearest sign", LATE],
    ["door", "the nearest door", "Nearest door", LATE],
];

const PHOTO_CARDS = PHOTO_SUBJECTS.map(([key, subject, short, tiers]) => ({
    id: `photo_${key}`,
    category: "photo",
    prompt: `Send a photo of ${subject}.`,
    short,
    answer: { type: "photo" },
    needsAsker: false,
    hint: null,
    tiers,
}));

export const CARDS = [
    ...DIRECTION_CARDS,
    ...RADIUS_CARDS,
    WALK_CARD,
    ...CLOSER_CARDS,
    RING_CARD,
    ...NEAREST_CARDS,
    SECTION_CARD,
    ...CONTEXT_CARDS,
    ...PHOTO_CARDS,
];

export const CARDS_BY_ID = new Map(CARDS.map((card) => [card.id, card]));

// An untiered card would sort last for every question number and effectively
// never be dealt, which is the kind of thing you only notice three games in.
for (const card of CARDS) {
    if (!Array.isArray(card.tiers) || card.tiers.length === 0) {
        throw new Error(`card "${card.id}" has no tiers`);
    }
}

/** Everything the frontend needs to render and geometrise the deck. */
export const catalogPayload = () => ({
    cards: CARDS,
    landmarks: LANDMARKS,
    landmarkGroups: LANDMARK_GROUPS,
    buildings: BUILDINGS,
    playArea: PLAY_AREA,
    walk: {
        speedMPerMin: WALK_SPEED_M_PER_MIN,
        detourFactor: WALK_DETOUR_FACTOR,
        slack: WALK_SLACK,
    },
});

/**
 * Validate an answer against its card. Returns { value } (JSON-serialisable)
 * or { error } with a message to show the hider.
 */
/** The answer to `card`, checked; `play` is the play it answers (its target). */
export function validateAnswer(card, raw, play = null) {
    const spec = card.answer;
    switch (spec.type) {
        case "section":
            if (!BUILDINGS[play?.target]?.sections.some((x) => x.id === raw)) {
                return { error: "Pick one of the options" };
            }
            return { value: raw };
        case "radio":
            if (!spec.options.includes(raw)) return { error: "Pick one of the options" };
            return { value: raw };
        case "choice": {
            const group = LANDMARK_GROUPS[spec.group];
            if (!group?.places.some((p) => p.id === raw)) {
                return { error: "Pick one of the options" };
            }
            return { value: raw };
        }
        case "checkbox":
            if (!Array.isArray(raw) || raw.some((v) => !spec.options.includes(v))) {
                return { error: "Pick one or more of the options" };
            }
            return { value: raw };
        case "text": {
            if (typeof raw !== "string" || !raw.trim()) return { error: "Write an answer" };
            const trimmed = raw.trim();
            if (trimmed.length > 280) {
                return { error: "Answer is too long (280 characters max)" };
            }
            return { value: trimmed };
        }
        case "number": {
            const n = Number(raw);
            if (!Number.isFinite(n)) return { error: "Answer with a number" };
            if (n < spec.min || n > spec.max) {
                return { error: `Answer must be between ${spec.min} and ${spec.max}` };
            }
            return { value: n };
        }
        case "coords": {
            const lat = Number(raw?.lat);
            const lng = Number(raw?.lng);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return { error: "Send a latitude and a longitude" };
            }
            if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                return { error: "Those coordinates are not on Earth" };
            }
            // ~1 cm; anything beyond that is noise from the GPS anyway.
            return { value: { lat: Number(lat.toFixed(7)), lng: Number(lng.toFixed(7)) } };
        }
        case "photo":
            if (typeof raw !== "string" || !raw.startsWith("data:image/")) {
                return { error: "Attach a photo" };
            }
            return { value: raw };
        default:
            return { error: "Unknown card" };
    }
}
