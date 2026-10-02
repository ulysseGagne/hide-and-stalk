/* global turf */

// The "Hints" map filter.
//
// Same idea as the elimination overlay in dependencies/JetLagHideAndSeek: start
// from the whole play area, turn every answered card into a piece of geometry,
// and intersect (or subtract) it. What survives is where the hider can still
// be. The map (map.js) inverts everything outside that region and draws its
// edge by hand in red, so the play area visibly closes in as answers come
// back; the receipt (receipt.js) prints the final one.
//
// Cards whose landmarks have no coordinates yet (see worker/src/cards.js) are
// skipped rather than guessed at, and reported through onStatus() so the UI can
// say so out loud.

// Padding around the play area, in degrees, for the half-plane rectangles.
// Big enough to cover anywhere a player might pan to.
const HALF_PLANE_PAD = 1;
// "Within 0 minutes' walk" still has to be a shape, not a point.
const MIN_WALK_RADIUS_M = 25;

// Every src/*.js file is a classic script sharing one global scope, so
// top-level names must not clash with cards.js / map.js (a duplicate
// let/const makes the whole later script fail to load).
let hintsCatalog = null;
let plays = [];
let enabled = false;
const statusListeners = new Set();
const notify = (status) => {
    for (const fn of statusListeners) fn(status);
};

const hintsCardById = (id) => hintsCatalog?.cards.find((c) => c.id === id) ?? null;

const hasCoords = (place) =>
    place && Number.isFinite(place.lat) && Number.isFinite(place.lng);

const playAreaPolygon = () =>
    hintsCatalog?.playArea?.ring ? turf.polygon([hintsCatalog.playArea.ring]) : null;

function paddedBox(pad) {
    const [minX, minY, maxX, maxY] = turf.bbox(playAreaPolygon());
    return turf.bboxPolygon([minX - pad, minY - pad, maxX + pad, maxY + pad]);
}

/** Everything on one side of a line of latitude / longitude through the asker. */
function halfPlane(axis, side, lat, lng) {
    const [minX, minY, maxX, maxY] = turf.bbox(paddedBox(HALF_PLANE_PAD));
    switch (side) {
        case "north":
            return turf.bboxPolygon([minX, lat, maxX, maxY]);
        case "south":
            return turf.bboxPolygon([minX, minY, maxX, lat]);
        case "east":
            return turf.bboxPolygon([lng, minY, maxX, maxY]);
        case "west":
            return turf.bboxPolygon([minX, minY, lng, maxY]);
        default:
            return null;
    }
}

const circleM = (lng, lat, meters) =>
    turf.circle([lng, lat], Math.max(meters, 1), { units: "meters", steps: 96 });

const metres = (aLng, aLat, bLng, bLat) =>
    turf.distance(turf.point([aLng, aLat]), turf.point([bLng, bLat]), {
        units: "meters",
    });

// A degree of longitude is only cos(latitude) as long as a degree of latitude —
// about 0.68 of one up here. Anything that measures distance planar-ly (i.e.
// turf.voronoi) has to work in these squashed coordinates, or it will call the
// wrong landmark "nearest" for every point close to a cell boundary.
function localProjection() {
    const [, minY, , maxY] = turf.bbox(playAreaPolygon());
    const kx = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);
    return {
        forward: ([lng, lat]) => [lng * kx, lat],
        inverse: ([x, y]) => [x / kx, y],
    };
}

// Each set of places' cells never change, so they are built once.
const voronoiCache = new Map();

/**
 * Every place of a set mapped to its Voronoi cell: the points closer to it
 * than to any of its siblings. Built in the local projection so "closer"
 * means closer on foot, then mapped straight back — the projection is linear,
 * so the cells' straight edges stay straight. null with fewer than two places.
 * @returns {Map<string, object>|null} place id -> polygon
 */
function voronoiOf(key, places) {
    if (voronoiCache.has(key)) return voronoiCache.get(key);
    const placed = places.filter(hasCoords);
    let result = null;
    if (placed.length >= 2) {
        const { forward, inverse } = localProjection();
        const [minX, minY, maxX, maxY] = turf.bbox(paddedBox(HALF_PLANE_PAD));
        const box = [...forward([minX, minY]), ...forward([maxX, maxY])];
        const points = turf.featureCollection(
            placed.map((pl) => turf.point(forward([pl.lng, pl.lat]))),
        );
        const cells = turf.voronoi(points, { bbox: box });
        result = new Map();
        placed.forEach((pl, i) => {
            const cell = cells.features[i];
            if (!cell) return;
            result.set(
                pl.id,
                turf.polygon(cell.geometry.coordinates.map((ring) => ring.map(inverse))),
            );
        });
    }
    voronoiCache.set(key, result);
    return result;
}

/** A landmark group's places mapped to their cells ("which X are you closest to?"). */
const voronoiCells = (groupKey) => voronoiOf(`group:${groupKey}`, hintsCatalog?.landmarkGroups?.[groupKey]?.places ?? []);

/** A building's section pins (A to D) mapped to their cells ("which part of <building>?"). */
const sectionCells = (buildingId) => voronoiOf(`building:${buildingId}`, hintsCatalog?.buildings?.[buildingId]?.sections ?? []);

/**
 * Turn one answered card into a constraint.
 * @returns {{shape: object, mode: "keep"|"exclude"}} | {skip: string}
 */
function constraintFor(play) {
    const card = hintsCardById(play.cardId);
    const hint = card?.hint;
    if (!hint) return { skip: "no map hint" };
    if (play.answer === null || play.answer === undefined) {
        return { skip: "not answered" };
    }
    // Everything relative to the asker needs the position we froze at play time.
    if (card.needsAsker && !(Number.isFinite(play.askLat) && Number.isFinite(play.askLng))) {
        return { skip: "asker position unknown" };
    }
    const { askLat, askLng } = play;

    switch (hint.type) {
        case "halfPlane": {
            const side = hint.keep[play.answer];
            const shape = side && halfPlane(hint.axis, side, askLat, askLng);
            return shape ? { shape, mode: "keep" } : { skip: "unrecognised answer" };
        }
        case "radius": {
            const which = hint.keep[play.answer];
            if (!which) return { skip: "unrecognised answer" };
            return {
                shape: circleM(askLng, askLat, hint.meters),
                mode: which === "within" ? "keep" : "exclude",
            };
        }
        case "walkTime": {
            const { speedMPerMin, detourFactor, slack } = hintsCatalog.walk;
            // The card asks for whole minutes, so the honest answer is already
            // up to half a minute - about 40 m - out either way. Bound the walk
            // by that band before anything else, or the ring can exclude the
            // very hider it was built from.
            const minutes = Number(play.answer);
            const shortestWalk = Math.max(0, (minutes - 0.5) * speedMPerMin);
            const longestWalk = (minutes + 0.5) * speedMPerMin;
            // Straight-line distance is never more than the walking distance,
            // and a real route is rarely more than detourFactor times longer.
            const outer = Math.max(longestWalk * slack, MIN_WALK_RADIUS_M);
            const inner = shortestWalk / detourFactor;
            const disc = circleM(askLng, askLat, outer);
            if (inner <= MIN_WALK_RADIUS_M) return { shape: disc, mode: "keep" };
            const ring = turf.difference(
                turf.featureCollection([disc, circleM(askLng, askLat, inner)]),
            );
            return ring ? { shape: ring, mode: "keep" } : { skip: "empty ring" };
        }
        case "point": {
            // The hider handed over a fix. All that is left is its own error.
            const { lat, lng } = play.answer ?? {};
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
                return { skip: "no coordinates in the answer" };
            }
            return { shape: circleM(lng, lat, hint.radiusM), mode: "keep" };
        }
        case "closerThan": {
            const place = hintsCatalog.landmarks[hint.landmark];
            if (!hasCoords(place)) return { skip: "landmark has no coordinates" };
            const which = hint.keep[play.answer];
            if (!which) return { skip: "unrecognised answer" };
            // Closer to the landmark than the asker is == inside the circle
            // centred on the landmark that passes through the asker.
            const radius = metres(place.lng, place.lat, askLng, askLat);
            return {
                shape: circleM(place.lng, place.lat, radius),
                mode: which === "closer" ? "keep" : "exclude",
            };
        }
        case "closerToBoundary": {
            const area = playAreaPolygon();
            if (!area) return { skip: "no play area" };
            const which = hint.keep[play.answer];
            if (!which) return { skip: "unrecognised answer" };
            const ring = turf.polygonToLine(area);
            const distKm = turf.pointToLineDistance(turf.point([askLng, askLat]), ring, {
                units: "kilometers",
            });
            const band = turf.buffer(ring, Math.max(distKm, 0.001), {
                units: "kilometers",
            });
            if (!band) return { skip: "could not build the perimeter band" };
            return { shape: band, mode: which === "closer" ? "keep" : "exclude" };
        }
        case "nearest": {
            const cells = voronoiCells(hint.group);
            if (!cells) return { skip: "need two or more landmarks" };
            const cell = cells.get(play.answer);
            if (!cell) return { skip: "landmark has no coordinates" };
            return { shape: cell, mode: "keep" };
        }
        case "section": {
            // Closest of the named building's section pins: true anywhere, in
            // the building or not.
            const cells = sectionCells(play.target);
            if (!cells) return { skip: "unknown building" };
            const cell = cells.get(play.answer);
            if (!cell) return { skip: "unknown section" };
            return { shape: cell, mode: "keep" };
        }
        default:
            return { skip: "unknown hint type" };
    }
}

let solvedKey = null;
let solved = null;
const playsKey = (list) =>
    list.map((p) => `${p.id}:${p.answeredAt}:${JSON.stringify(p.answer)}`).join("|");

/** solve(), remembered until the answers change. */
function solveCached() {
    const key = playsKey(plays);
    if (key !== solvedKey || !solved) {
        solved = solve();
        solvedKey = key;
    }
    return solved;
}

/**
 * Fold every answered card into the play area.
 * @returns {{region: object|null, applied: number, skipped: {cardId, reason}[],
 *            contradiction: boolean}}
 */
function solve() {
    const skipped = [];
    let region = playAreaPolygon();
    let applied = 0;
    if (!region) return { region: null, applied, skipped, contradiction: false };

    for (const play of plays) {
        const constraint = constraintFor(play);
        if (constraint.skip) {
            skipped.push({ cardId: play.cardId, reason: constraint.skip });
            continue;
        }
        const pair = turf.featureCollection([region, constraint.shape]);
        const next =
            constraint.mode === "keep" ? turf.intersect(pair) : turf.difference(pair);
        if (!next) {
            // Nothing left: the answers so far can't all be true at once.
            return { region: null, applied, skipped, contradiction: true };
        }
        region = next;
        applied += 1;
    }
    return { region, applied, skipped, contradiction: false };
}

function render() {
    if (!enabled || !hintsCatalog) {
        notify({ applied: 0, skipped: [], contradiction: false, ready: false, region: null, mask: null });
        return;
    }
    let result;
    try {
        result = solveCached();
    } catch (err) {
        console.error("hints: could not solve constraints", err);
        notify({ applied: 0, skipped: [], contradiction: false, error: true, region: null, mask: null });
        return;
    }
    const { region, applied, skipped, contradiction } = result;
    // What the hider can't be: campus with the surviving region punched out
    // of it. Past the campus border the map is blank and stays white.
    const mask = region ? maskFor(region) : null;
    notify({ applied, skipped, contradiction, ready: true, region, mask });
}

let maskKey = null;
let maskShape = null;
function maskFor(region) {
    if (region !== maskKey) {
        maskKey = region;
        maskShape = turf.difference(turf.featureCollection([playAreaPolygon(), region]));
    }
    return maskShape;
}

/**
 * The places that can still be the honest answer to "which X are you closest
 * to?": the ones whose cell still overlaps where the hider can be. Lets the
 * hider's list shrink from dozens of bus stops to the handful that matter.
 * null when that can't be worked out (no answers yet narrow anything, or they
 * contradict each other), meaning "offer everything".
 * @returns {Set<string>|null}
 */
function possiblePlaceIds(groupKey) {
    if (!hintsCatalog) return null;
    let result;
    try {
        result = solveCached();
    } catch {
        return null;
    }
    if (!result.region || !result.applied) return null;
    const cells = voronoiCells(groupKey);
    if (!cells) return null;
    const ids = new Set();
    for (const [id, cell] of cells) {
        try {
            if (turf.intersect(turf.featureCollection([cell, result.region]))) ids.add(id);
        } catch {
            ids.add(id); // when in doubt, offer it
        }
    }
    return ids;
}

/**
 * The buildings a stalker may still ask "which part of <building>?" about:
 * the ones whose footprint still overlaps where the hider can be, a building
 * partly cut off included. null when that can't be worked out, meaning "offer
 * every building".
 * @returns {Set<string>|null}
 */
function possibleBuildingIds() {
    if (!hintsCatalog?.buildings) return null;
    let result;
    try {
        result = solveCached();
    } catch {
        return null;
    }
    if (!result.region || !result.applied) return null;
    const ids = new Set();
    for (const [id, b] of Object.entries(hintsCatalog.buildings)) {
        try {
            if (turf.booleanIntersects(turf.polygon([b.outline]), result.region)) ids.add(id);
        } catch {
            ids.add(id); // when in doubt, offer it
        }
    }
    return ids;
}

/**
 * A building's sections as the map draws them: its outline, the lines between
 * its sections (the edges of its pins' cells inside the footprint, each once),
 * and where each letter goes (its pin). null for an unknown building.
 */
const sectionShapeCache = new Map();
function sectionShapes(buildingId) {
    if (sectionShapeCache.has(buildingId)) return sectionShapeCache.get(buildingId);
    const building = hintsCatalog?.buildings?.[buildingId];
    const cells = building && sectionCells(buildingId);
    if (!cells) return null;
    const outline = turf.polygon([building.outline]);
    const edge = turf.polygonToLine(outline);
    const dividers = [];
    const seen = new Set();
    const keyOf = ([x, y]) => `${x.toFixed(7)},${y.toFixed(7)}`;
    for (const cell of cells.values()) {
        let part;
        try {
            part = turf.intersect(turf.featureCollection([cell, outline]));
        } catch {
            continue;
        }
        if (!part) continue;
        const polys = part.geometry.type === "Polygon" ? [part.geometry.coordinates] : part.geometry.coordinates;
        for (const ring of polys.flat()) {
            for (let i = 1; i < ring.length; i++) {
                const a = ring[i - 1];
                const b = ring[i];
                const mid = turf.point([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
                // On the outline: the footprint's own wall, drawn whole elsewhere.
                if (turf.pointToLineDistance(mid, edge, { units: "meters" }) < 0.5) continue;
                const key = [keyOf(a), keyOf(b)].sort().join("|");
                if (seen.has(key)) continue;
                seen.add(key);
                dividers.push([a, b]);
            }
        }
    }
    const result = { outline: building.outline, dividers, labels: building.sections };
    sectionShapeCache.set(buildingId, result);
    return result;
}

window.HNSHints = {
    possibleBuildingIds,
    sectionShapes,
    setCatalog(next) {
        hintsCatalog = next;
        voronoiCache.clear();
        sectionShapeCache.clear();
        solved = null;
        render();
    },
    possiblePlaceIds,
    /** @param {object[]} nextPlays answered cards from /state -> cards.hints */
    setPlays(nextPlays) {
        const next = nextPlays ?? [];
        // Re-solving is not free; skip it when nothing actually changed.
        if (playsKey(next) === playsKey(plays)) return;
        plays = next;
        render();
    },
    setEnabled(next) {
        if (enabled === next) return;
        enabled = next;
        render();
    },
    /** fn(status) after every change: { ready, applied, skipped, contradiction, region, mask }. */
    onStatus(fn) {
        statusListeners.add(fn);
        return () => statusListeners.delete(fn);
    },
    /**
     * Where the hider can still be, from the answers set so far, whether or
     * not the map is showing it (the receipt prints the final one). null
     * before the catalog, or when the answers contradict each other.
     */
    region() {
        if (!hintsCatalog) return null;
        try {
            return solveCached().region;
        } catch {
            return null;
        }
    },
    /** Campus outside a region, for printing it inverted. */
    maskFor,
};
