// Turns locations/geojson/*.geojson into the two data modules the game reads:
//
//   src/locations.js         window.HNSLocations - every campus element, as
//                            toggleable map overlays (GitHub Pages only ships
//                            src/, so this has to be a committed .js file).
//   worker/src/locations.js  the same places as the play area, the landmarks
//                            and the landmark groups the cards ask about.
//
// Run it after editing anything under locations/:  npm run build:locations
//
// Both outputs are generated, so the coordinates the map draws and the
// coordinates the Hints filter computes with can never drift apart.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GEOJSON = join(ROOT, "locations", "geojson");

const read = (name) =>
    JSON.parse(readFileSync(join(GEOJSON, `${name}.geojson`), "utf8"));

// ~1 cm. Plenty for a game played at street level, and it keeps the generated
// files small.
const round = (n) => Number(Number(n).toFixed(7));

const slug = (str) =>
    String(str)
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "") // drop accents
        .toLowerCase()
        .replace(/['’]/g, "") // drop apostrophes rather than split on them
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");

/** Every point of a FeatureCollection, as [props, lng, lat]. */
const points = (name) =>
    read(name).features.map((f) => [f.properties ?? {}, ...f.geometry.coordinates]);

// ---------------------------------------------------------------------------
// Play area
// ---------------------------------------------------------------------------
const borderFeature = read("campus-border").features[0];
const CAMPUS_RING = borderFeature.geometry.coordinates[0].map(([lng, lat]) => [
    round(lng),
    round(lat),
]);

// ---------------------------------------------------------------------------
// Landmarks - the "are you closer to X than me?" cards, one card each
// ---------------------------------------------------------------------------
// `phrase` goes straight into the prompt, so it carries its own article:
// "closer to the church" but "closer to Pub U".
const LANDMARK_FILES = [
    ["church", "church", "the church"],
    ["twin_towers", "twin-towers", "the twin towers"],
    ["ulaval_sign", "ulaval-sign", "the ULaval sign"],
    ["greenhouses", "greenhouses", "the greenhouse"],
    ["football_stadium", "football-stadium", "the football stadium"],
    ["pub_u", "pub-u", "Pub U"],
];

const landmarks = LANDMARK_FILES.map(([key, file, phrase]) => {
    const [props, lng, lat] = points(file)[0];
    return {
        key,
        label: props.name,
        phrase,
        lat: round(lat),
        lng: round(lng),
        detail: [["About", props.desc]],
    };
});

// ---------------------------------------------------------------------------
// Landmark groups - the "which X are you closest to?" cards, one card each
// ---------------------------------------------------------------------------
const groups = {
    building: {
        label: "building",
        cardId: "nearest_building",
        places: points("pavillons").map(([p, lng, lat]) => ({
            id: `pav_${slug(p.code)}`,
            label: `${p.name} (${p.code})`,
            lat: round(lat),
            lng: round(lng),
            detail: [
                ["Code", p.code],
                ["OpenStreetMap", p.osm],
            ],
        })),
    },
    cafe: {
        label: "café",
        cardId: "nearest_cafe",
        places: points("cafes").map(([p, lng, lat]) => ({
            // One cafe per pavillon today; the uniqueness check below shouts if
            // that ever stops being true.
            id: `cafe_${slug(p.pav_code)}`,
            label: `${p.name} (${p.pav_code})`,
            lat: round(lat),
            lng: round(lng),
            detail: [
                ["Pavillon", p.pavillon],
                ["Room", p.local],
                ["Run by", p.operator],
                ["Kind", p.type === "student" ? "student-run" : "corporate"],
            ],
        })),
    },
    bus_stop: {
        label: "bus stop",
        cardId: "nearest_bus_stop",
        places: points("bus").map(([p, lng, lat]) => ({
            id: `stop_${p.ref}`,
            // Several stops share a name (Bibliotheques, Universite Laval), so
            // the RTC number - which is printed on the pole the hider is
            // standing at - always comes along.
            label: `${String(p.name).replace(/\/\d+$/, "")} (${p.ref})`,
            lat: round(lat),
            lng: round(lng),
            detail: [
                ["RTC stop", p.ref],
                ["Network", p.network],
            ],
        })),
    },
    velo: {
        label: "àVélo station",
        cardId: "nearest_velo",
        places: points("avelo").map(([p, lng, lat]) => ({
            id: `velo_${p.station_id}`,
            label: p.name,
            lat: round(lat),
            lng: round(lng),
            detail: [
                ["Capacity", p.capacity ? `${p.capacity} bikes` : null],
                ["Station", p.station_id],
            ],
        })),
    },
};

// Long radio lists are much easier to scan in alphabetical order.
for (const group of Object.values(groups)) {
    group.places.sort((a, b) => a.label.localeCompare(b.label, "fr"));
}

// ---------------------------------------------------------------------------
// Buildings - the "which part of <building> are you closest to?" card
// ---------------------------------------------------------------------------
// The stalker names the building when sending the card; the hider answers
// with the closest of its section pins (building-sections.geojson, placed by
// hand on the footprint). The outline, the pavilion's OpenStreetMap
// footprint, lets the phone offer only the buildings the hints still allow.
const OSM = JSON.parse(
    readFileSync(join(ROOT, "design", "promo", "round-1", "lab", "data", "osm-campus.json"), "utf8"),
);
const footprints = new Map(OSM.features.map((f) => [f.properties.id, f.geometry]));
const sectionPins = read("building-sections").features;
const buildings = {};
for (const [p] of points("pavillons")) {
    const osmId = String(p.osm).replace(/^way\//, "w").replace(/^relation\//, "r");
    const geom = footprints.get(osmId);
    if (!geom) throw new Error(`no footprint for ${p.code} (${p.osm})`);
    const outer = geom.type === "Polygon" ? geom.coordinates[0] : geom.coordinates[0][0];
    const sections = sectionPins
        .filter((f) => f.properties.pavilion === p.code)
        .map((f) => ({ id: f.properties.section, lat: round(f.geometry.coordinates[1]), lng: round(f.geometry.coordinates[0]) }))
        .sort((a, b) => a.id.localeCompare(b.id));
    const letters = sections.map((x) => x.id).join("");
    if (sections.length < 2 || letters !== "ABCD".slice(0, sections.length)) {
        throw new Error(`${p.code} needs section pins A, B (and C, D), got "${letters}"`);
    }
    buildings[`pav_${slug(p.code)}`] = {
        label: `${p.name} (${p.code})`,
        code: p.code,
        outline: outer.map(([lng, lat]) => [round(lng), round(lat)]),
        sections,
    };
}

// ---------------------------------------------------------------------------
// Overlay layers for the map
// ---------------------------------------------------------------------------
const GROUP_LAYER_LABELS = {
    building: "Pavilions",
    cafe: "Cafés",
    bus_stop: "Bus stops",
    velo: "àVélo stations",
};
const GROUP_LAYER_COLORS = {
    building: "#f97316",
    cafe: "#ec4899",
    bus_stop: "#3b82f6",
    velo: "#22c55e",
};

const LAYERS = [
    {
        key: "campus",
        label: "Campus border",
        color: "#eab308",
        kind: "polygon",
        // The play area itself: the perimeter this card measures against.
        cardIds: ["closer_outer_ring"],
        name: borderFeature.properties.name,
        detail: [["About", borderFeature.properties.desc]],
        ring: CAMPUS_RING,
    },
    {
        key: "landmarks",
        label: "Landmarks",
        color: "#a855f7",
        kind: "points",
        labelled: true, // only six, so their names can stay on screen
        cardIds: landmarks.map((l) => `closer_${l.key}`),
        places: landmarks.map((l) => ({
            id: l.key,
            label: l.label,
            lat: l.lat,
            lng: l.lng,
            detail: l.detail,
            cardIds: [`closer_${l.key}`],
        })),
    },
    ...Object.entries(groups).map(([key, group]) => ({
        key,
        label: GROUP_LAYER_LABELS[key],
        color: GROUP_LAYER_COLORS[key],
        kind: "points",
        cardIds: [group.cardId],
        places: group.places.map((p) => ({ ...p, cardIds: [group.cardId] })),
    })),
];

// ---------------------------------------------------------------------------
// Emit
// ---------------------------------------------------------------------------
const NUMBER = String.raw`-?\d+(?:\.\d+)?`;
const STRING = String.raw`"(?:[^"\\]|\\.)*"`;

/** JSON with every non-ASCII character escaped, so whatever encoding a browser
 *  or the Worker guesses for these files can never matter. Two-element pairs -
 *  [lng, lat] and ["Label", "value"] - are folded back onto one line, which is
 *  both how you want to read them and about a third of the bytes. */
const literal = (value, indent) =>
    JSON.stringify(value, null, indent)
        .replace(
            new RegExp(`\\[\\s+(${NUMBER}),\\s+(${NUMBER})\\s+\\]`, "g"),
            "[$1, $2]",
        )
        .replace(
            new RegExp(`\\[\\s+(${STRING}),\\s+(${STRING})\\s+\\]`, "g"),
            "[$1, $2]",
        )
        .replace(
            /[-￿]/g,
            (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`,
        );

const dropEmptyDetail = (list) =>
    list
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => [k, String(v)]);

for (const layer of LAYERS) {
    if (layer.detail) layer.detail = dropEmptyDetail(layer.detail);
    for (const place of layer.places ?? []) {
        place.detail = dropEmptyDetail(place.detail ?? []);
    }
}

// Ids end up in card_plays.answer, so a collision would silently mix two places
// up. Fail the build instead.
for (const layer of LAYERS) {
    const seen = new Set();
    for (const place of layer.places ?? []) {
        if (seen.has(place.id)) {
            throw new Error(`duplicate id "${place.id}" in layer "${layer.key}"`);
        }
        seen.add(place.id);
    }
}

const BANNER = `// GENERATED FILE - do not edit.
// Source: locations/geojson/*.geojson
// Regenerate: npm run build:locations  (tools/build-locations.mjs)
`;

writeFileSync(
    join(ROOT, "src", "locations.js"),
    `${BANNER}
// Every campus element, as its own toggleable map overlay. map.js turns each
// layer into a row of the overlays menu and each place into a marker whose
// popup links back to the cards that ask about it.

window.HNSLocations = {
    layers: ${literal(LAYERS, 4).replace(/\n/g, "\n    ")},
};
`,
    "utf8",
);

const workerLandmarks = Object.fromEntries(
    landmarks.map((l) => [
        l.key,
        { label: l.label, phrase: l.phrase, lat: l.lat, lng: l.lng },
    ]),
);
const workerGroups = Object.fromEntries(
    Object.entries(groups).map(([key, g]) => [
        key,
        {
            label: g.label,
            places: g.places.map(({ id, label, lat, lng }) => ({
                id,
                label,
                lat,
                lng,
            })),
        },
    ]),
);

writeFileSync(
    join(ROOT, "worker", "src", "locations.js"),
    `${BANNER}
// The places the deck asks about. cards.js builds PLAY_AREA, LANDMARKS and
// LANDMARK_GROUPS straight out of these, so every card's map hint is computed
// from the same coordinates the map draws.

export const CAMPUS_BORDER = ${literal(
        { name: borderFeature.properties.name, ring: CAMPUS_RING },
        4,
    )};

export const LANDMARK_POINTS = ${literal(workerLandmarks, 4)};

export const LANDMARK_GROUP_PLACES = ${literal(workerGroups, 4)};

export const BUILDINGS = ${literal(buildings, 4)};
`,
    "utf8",
);

const counts = LAYERS.map((l) => `${l.key} ${l.places ? l.places.length : 1}`).join(
    ", ",
);
console.log(`locations built - ${counts}`);
console.log(`play area: ${CAMPUS_RING.length} vertices`);
console.log(`buildings: ${Object.keys(buildings).length}, ${sectionPins.length} section pins`);
