/* global L, HNSHints, HNSMapDraw, HNSMarks, Ink */

// The map (S61-S69 in the design review). Everything on it is drawn by the
// app, nothing is fetched as tiles:
//
//   - the campus itself, from OpenStreetMap's data (mapdraw.js);
//   - the hints layer: everything the answers have ruled out, inverted, and
//     the edge of what is left drawn by hand in red (hints.js says where);
//   - the players: everyone else as a red pushpin (tap one for the name), YOU
//     as a red arrow pointing the way your phone faces;
//   - the question on the table, in a box at the top, and what it needs drawn
//     on the map: the east/west or north/south line, the circle, the places.
//
// One red thing at a time: the hints layer while nothing is waiting, else only
// the waiting question's drawing (the other players' pins step aside for it).
// No auto-zoom: the map opens on the whole campus; players move it.

const CAMPUS_LAYERS = window.HNSLocations?.layers ?? [];
const campusRing = CAMPUS_LAYERS.find((l) => l.kind === "polygon")?.ring ?? null;
const campusBounds = campusRing
    ? L.latLngBounds(campusRing.map(([lng, lat]) => [lat, lng]))
    : L.latLngBounds([46.7705, -71.2885], [46.7895, -71.2645]);
const CAMPUS_CENTER = campusBounds.getCenter();
// The whole campus, below the question box.
const FIT = { paddingTopLeft: [10, 118], paddingBottomRight: [10, 16] };
const RED = Ink.RED;
const FONT = "Arimo, 'Helvetica Neue', Helvetica, Arial, sans-serif";

// Where you are and which way you face (the GPS and compass code is at the
// end of the file; its state is up here, where everything can see it).
let lastKnownPosition = null; // { lat, lng, accuracy } or null when unavailable / denied
// When the last fix arrived (performance.now()), so its age is always known.
let lastFixAt = null;
// Why there is no position: null (have one, or still waiting for the first
// fix / the permission prompt), "off" (not asked for yet), "denied",
// "unavailable" or "unsupported".
let locationProblem = "geolocation" in navigator ? "off" : "unsupported";
// The GPS only starts once location is allowed, asked for from "Before you
// start" (app.js), or started by app.js for a player who has seen that sheet:
// never at page load, where the browser's prompt would come before the
// explanation.
let locationStarted = false;
// The browser's stored decision: "granted" | "prompt" | "denied", or null when
// it has no Permissions API. "denied" here means the prompt won't come back and
// the player has to unblock the site in their browser settings.
let locationPermission = null;
let watchId = null;
let watchStartedAt = 0;
const positionListeners = new Set();

// A fix older than this is drawn white. Phones report every second or two while
// the GPS is healthy, so ten seconds of silence already means something.
const FIX_STALE_MS = 10_000;
// No fix for this long and the watch gets torn down and started over. That is
// the fix for the "location froze until I refreshed" bug: some phones (iOS
// Safari especially, after the screen locks or the app is switched) keep a
// watch that silently never fires again.
const WATCH_STUCK_MS = 20_000;
const WATCH_RESTART_GAP_MS = 15_000;
const WATCHDOG_TICK_MS = 5_000;
let lastRestartAt = 0;

// Heading state (see "Heading" below). Declared up here because a fix can
// arrive the moment the GPS starts, and handlePosition() writes to it.
const GPS_HEADING_MIN_SPEED = 0.8; // m/s, a slow walk
const COMPASS_GRANTED_KEY = "hns.compass";
let gpsHeading = null;
let compassHeading = null;
// "on" | "needs-permission" | "denied" | "unsupported"
let compassState = "unsupported";
let headingFrame = null;

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
const toastEl = document.createElement("div");
toastEl.id = "toast";
toastEl.setAttribute("role", "status");
document.body.appendChild(toastEl);
let toastTimer = null;

function showToast(message, duration = 1500) {
    toastEl.textContent = message;
    toastEl.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("visible"), duration);
}

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------
const map = L.map("map", {
    center: CAMPUS_CENTER,
    zoom: 15,
    zoomControl: false,
    // The tiles are drawn here, in a few milliseconds: nothing to fade in from.
    fadeAnimation: false,
    // Pinch to any zoom; the map is drawn for whatever it lands on.
    zoomSnap: 0,
    zoomDelta: 0.5,
    minZoom: 13,
    maxZoom: 19,
    // The data stops at the campus border; past it is blank paper to pan into.
    maxBounds: campusBounds.pad(1.2),
    maxBoundsViscosity: 0.8,
    contextmenu: true,
    contextmenuWidth: 140,
    contextmenuItems: [
        {
            text: "Copy Coordinates",
            callback: (e) => {
                if (!navigator.clipboard) {
                    showToast("Clipboard API not supported in your browser");
                    return;
                }
                const { lat, lng } = e.latlng;
                const text = `${Math.abs(lat)}°${lat > 0 ? "N" : "S"}, ${Math.abs(lng)}°${lng > 0 ? "E" : "W"}`;
                navigator.clipboard
                    .writeText(text)
                    .then(() => showToast("Coordinates copied!"))
                    .catch(() => showToast("An error occurred while copying"));
            },
        },
        {
            text: "Center map here",
            callback: (e) => map.panTo(e.latlng),
        },
    ],
});
map.attributionControl.setPrefix(false);
map.attributionControl.addAttribution('<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a>');

// The panes, bottom to top: the campus (tiles, with what's ruled out printed
// inverted in them), the red layer, the pins, the names, YOU, a place's pop-up.
for (const [name, z] of [
    ["inkPane", 450],
    ["tagPane", 650],
    ["youPane", 660],
    ["popPane", 700],
]) {
    map.createPane(name).style.zIndex = String(z);
}
map.getPane("inkPane").classList.add("leaflet-ink-pane");

const campusLayer = HNSMapDraw.layer().addTo(map);
HNSMapDraw.load("data/campus-map.json").catch((err) => {
    console.error(err);
    showToast("The map could not be loaded. Reload to try again.", 5000);
});

let fitted = false;
const renderListeners = new Set();
const notifyRender = () => {
    for (const fn of renderListeners) fn();
};

/** The map tab was opened: measure, and the first time, show the whole campus. */
function shown() {
    map.invalidateSize();
    if (!fitted && map.getSize().y > 0) {
        fitted = true;
        map.fitBounds(campusBounds, { ...FIT, animate: false });
    }
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------
/** A drawn mark as a Leaflet icon: svg markup around (0, 0), the marker's spot. */
function markIcon(svg, [x0, y0, x1, y1], className = "") {
    const w = Math.ceil(x1 - x0);
    const h = Math.ceil(y1 - y0);
    return L.divIcon({
        html: `<svg width="${w}" height="${h}" viewBox="${x0} ${y0} ${w} ${h}" aria-hidden="true">${HNSMarks.uniqueIds(svg)}</svg>`,
        className: `map-mark ${className}`,
        iconSize: [w, h],
        iconAnchor: [-x0, -y0],
    });
}

const tagCanvas = document.createElement("canvas").getContext("2d");
/** A name tag: one outlined shape, box and pointer together, its point on (x, y). */
function bubble(x, y, label) {
    tagCanvas.font = `700 12px ${FONT}`;
    const w = tagCanvas.measureText(label).width + 12 * 1.3 + 12 + label.length * 0.72;
    const h = 24;
    const left = x - w / 2;
    const top = y - h - 12;
    const b = top + h;
    const pts = [[left, top], [left + w, top], [left + w, b], [x + 7, b], [x, b + 10], [x - 7, b], [left, b]];
    const svg = `<path d="M${pts.map((p) => p.map((n) => n.toFixed(1)).join(" ")).join("L")}Z" fill="#fff" stroke="#000" stroke-width="3" stroke-linejoin="miter"/><text x="${x}" y="${(top + h / 2 + 4.3).toFixed(1)}" text-anchor="middle" font-family="${FONT}" font-weight="700" font-size="12" letter-spacing="0.72" fill="#000">${escapeHtml(label)}</text>`;
    return { svg, box: [left - 3, top - 3, left + w + 3, b + 12] };
}

function escapeHtml(str) {
    return String(str).replace(
        /[&<>"']/g,
        (c) =>
            ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;",
            })[c],
    );
}

/** The dashed line of an east/west or north/south question, by hand: round ends, no droplets. */
function dashedLine(cx, cy, ux, uy, from, to, seed, weight = 6.2) {
    // Anchored on the asker (cx, cy), so the dashes stay put as the map moves.
    const r = Ink.rng(seed);
    const n = Ink.noise1(r);
    const pt = (s) => {
        const k = n((s + 10000) / 110) * 5;
        return [cx + ux * s - uy * k, cy + uy * s + ux * k];
    };
    let out = "";
    const start = Math.floor(from / 26) * 26;
    for (let s = start; s < to; s += 26) {
        const d = 13 + (Math.abs(Math.sin(s * 12.9898)) * 43758.5453 % 1) * 6;
        out += Ink.pathEl([pt(s), pt(s + d / 2), pt(s + d)], { size: weight, color: RED, thinning: 0.04, taperEnd: 0, taperStart: 0 });
    }
    return out;
}

// ---------------------------------------------------------------------------
// The red layer: hand-drawn marks in map coordinates. Redrawn when the zoom
// changes or the map pans out of what is drawn; scaled along with the map
// while it zooms. Marks are drawn in coordinates fixed to the campus at each
// zoom, so their hand-drawn wobble doesn't change as the map pans.
//
// A wheel or a trackpad zooms in many small steps, each one a new zoom: the
// marks stay scaled along with the map until it has been still for a moment,
// then are drawn again once, rather than at every step.
// ---------------------------------------------------------------------------
const INK_SETTLE_MS = 250;
const InkLayer = L.Renderer.extend({
    options: { padding: 0.5, pane: "inkPane" },
    initialize(draw, options) {
        L.Renderer.prototype.initialize.call(this, options);
        this._draw = draw;
        this._dirty = true;
    },
    _initContainer() {
        this._container = L.DomUtil.create("div", "map-ink");
    },
    _destroyContainer() {
        L.DomUtil.remove(this._container);
        delete this._container;
    },
    redraw() {
        this._dirty = true;
        if (this._map) this._update();
    },
    _update() {
        if (this._map._animatingZoom && this._bounds) return;
        const m = this._map;
        const zoom = m.getZoom();
        if (this._bounds && this._drawnZoom !== zoom && !this._settling) {
            clearTimeout(this._settle);
            this._settle = setTimeout(() => {
                this._settling = true;
                if (this._map) this._update();
                this._settling = false;
            }, INK_SETTLE_MS);
            return;
        }
        const pixelOrigin = m.getPixelOrigin();
        if (!this._dirty && this._bounds && this._drawnZoom === zoom && this._drawnOrigin?.equals(pixelOrigin)) {
            const view = L.bounds(m.containerPointToLayerPoint([0, 0]), m.containerPointToLayerPoint(m.getSize()));
            if (this._bounds.contains(view)) return;
        }
        L.Renderer.prototype._update.call(this);
        this._dirty = false;
        this._drawnZoom = zoom;
        this._drawnOrigin = pixelOrigin;
        const b = this._bounds;
        const size = b.getSize();
        L.DomUtil.setPosition(this._container, b.min);
        const origin = m.project(CAMPUS_CENTER, zoom).round();
        const shift = origin.subtract(pixelOrigin).subtract(b.min);
        const frame = {
            zoom,
            // Map coordinates -> the layer's fixed coordinates.
            P: (lat, lng) => {
                const p = m.project([lat, lng], zoom);
                return [p.x - origin.x, p.y - origin.y];
            },
            // The screen (the map's own box) in the same coordinates.
            screen: (() => {
                const tl = m.containerPointToLayerPoint([0, 0]).add(pixelOrigin).subtract(origin);
                const sz = m.getSize();
                return { x: tl.x, y: tl.y, w: sz.x, h: sz.y };
            })(),
            drawn: { x: -shift.x, y: -shift.y, w: size.x, h: size.y },
            pxPerMetre: (() => {
                const a = m.project(CAMPUS_CENTER, zoom);
                const c = m.project(L.latLng(CAMPUS_CENTER.lat, CAMPUS_CENTER.lng + 100 / (111320 * Math.cos((CAMPUS_CENTER.lat * Math.PI) / 180))), zoom);
                return (c.x - a.x) / 100;
            })(),
        };
        const inner = this._draw(frame) ?? "";
        this._container.innerHTML = inner
            ? `<svg width="${size.x}" height="${size.y}" style="overflow:visible" aria-hidden="true"><g transform="translate(${shift.x} ${shift.y})">${inner}</g></svg>`
            : "";
    },
});

// ---------------------------------------------------------------------------
// The game, as the map needs it (app.js calls setGame every second)
// ---------------------------------------------------------------------------
let cardCatalog = null;
let game = null; // { isAdmin, role, me, team, cards, users }
let hints = { region: null, mask: null, ready: false };
let tapped = null; // the player whose name is showing
let popupPlace = null; // the place whose pop-up is showing

const cardOf = (id) => cardCatalog?.cards.find((c) => c.id === id) ?? null;

/** The question waiting for its answer, if any: the oldest one still owed. */
function waitingPlay() {
    const pending = game?.cards?.pending ?? [];
    if (!pending.length || game?.team?.phase !== "hunting") return null;
    return [...pending].sort((a, b) => a.askedAt - b.askedAt)[0];
}

/** What a waiting question draws: "ew" | "ns" | "radius" | "nearest" | "section" | "tag" | null. */
function drawingOf(play) {
    const card = play && cardOf(play.cardId);
    const hint = card?.hint;
    if (!hint) return null;
    const asker = Number.isFinite(play.askLat) && Number.isFinite(play.askLng);
    if (hint.type === "halfPlane" && asker) return hint.axis === "ew" ? "ew" : "ns";
    if (hint.type === "radius" && asker) return "radius";
    if (hint.type === "nearest") return "nearest";
    if (hint.type === "section" && play.target) return "section";
    // Closer than me: only the place's tag, no circle.
    if (hint.type === "closerThan") return "tag";
    return null;
}

const showHints = () => Boolean(game && !game.isAdmin && game.team && hints.ready && hints.region && !waitingPlay());

// ---------------------------------------------------------------------------
// The hints layer: what's ruled out, inverted, and the edge of what's left, by
// hand. The inverting is printed into the campus tiles (mapdraw.js): a white
// layer blended over the map had to be blended again on every frame of a
// zoom, which is what made zooming stutter.
// ---------------------------------------------------------------------------
let maskShown = null;

function renderMask() {
    const mask = showHints() ? hints.mask : null;
    if (mask === maskShown) return;
    maskShown = mask;
    campusLayer.setMask(mask?.geometry ?? null);
}

/** A ring's points on screen, cut down to the stretches near the drawn area. */
function clipRing(points, rect) {
    const pad = 40;
    const bounds = L.bounds([rect.x - pad, rect.y - pad], [rect.x + rect.w + pad, rect.y + rect.h + pad]);
    const runs = [];
    let run = null;
    for (let i = 1; i < points.length; i++) {
        const seg = L.LineUtil.clipSegment(L.point(points[i - 1]), L.point(points[i]), bounds, false, true);
        if (!seg) {
            run = null;
            continue;
        }
        const [a, b] = seg;
        if (!run || run.last.x !== a.x || run.last.y !== a.y) {
            run = { pts: [[a.x, a.y]], last: a };
            runs.push(run);
        }
        run.pts.push([b.x, b.y]);
        run.last = b;
    }
    return runs.map((r) => r.pts).filter((p) => p.length > 1);
}

function drawHintsEdge(frame) {
    const geom = hints.region?.geometry;
    if (!geom) return "";
    const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
    let out = "";
    polys.forEach((poly, i) => {
        poly.forEach((ring, j) => {
            const pts = L.LineUtil.simplify(ring.map(([lng, lat]) => L.point(frame.P(lat, lng))), 0.8).map((p) => [p.x, p.y]);
            let length = 0;
            for (let k = 1; k < pts.length; k++) length += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
            // Whole while it's small enough to draw whole (its wobble never
            // changes as the map pans); cut to the screen when zoomed far in.
            const parts = length < 9000 ? [pts] : clipRing(pts, frame.drawn);
            for (const part of parts) out += Ink.wobble(part, { seed: `hint${i}.${j}`, weight: 4.4, amp: 1.6 });
        });
    });
    return out;
}

// ---------------------------------------------------------------------------
// The question on the table, drawn
// ---------------------------------------------------------------------------
function drawQuestion(frame, play, kind) {
    const card = cardOf(play.cardId);
    const [cx, cy] = frame.P(play.askLat, play.askLng);
    const s = frame.screen;
    const d = frame.drawn;
    const you = lastKnownPosition ? frame.P(lastKnownPosition.lat, lastKnownPosition.lng) : null;
    const top = s.y + 110; // under the question box
    if (kind === "ew") {
        // A bolder line; the words well clear of it, no arrows: a little under
        // the middle of the map (S66), or out of YOU's way.
        let out = dashedLine(cx, cy, 0, 1, Math.max(d.y, top) - cy, d.y + d.h - cy, `ew${play.id}`);
        let labelY = s.y + 340;
        if (you && Math.abs(you[1] - labelY) < 70 && Math.abs(you[0] - cx) < 170) labelY = you[1] > labelY ? you[1] - 90 : you[1] + 110;
        // Kerned by hand: the W let go of the E, EAST's T up and out of the S's way;
        // the W's two outer arms reach a little above the other letters.
        const TALL_W = [0.9, [[[0, -0.16], [0.2, 1], [0.44, 0.34], [0.68, 1], [0.9, -0.16]]]];
        const west = { size: 26, seed: `w${play.id}`, tilt: -3, importance: "key", weight: 26 * 0.25, extra: [0.16, 0.04, 0.06], lift: [0.04, 0, 0, -0.06], glyphs: { W: TALL_W } };
        out += Ink.write("WEST", { ...west, x: cx - 30 - Ink.write("WEST", west).width, y: labelY }).svg;
        out += Ink.write("EAST", { x: cx + 28, y: labelY, size: 26, seed: `e${play.id}`, tilt: -3, importance: "key", weight: 26 * 0.25, extra: [0.02, 0.02, 0.07], lift: [0, 0, 0, -0.12] }).svg;
        return out;
    }
    if (kind === "ns") {
        // The line flat: NORTH above it, SOUTH below; the words centred, or
        // away from YOU when YOU is close to the line.
        let out = dashedLine(cx, cy, 1, 0, d.x - cx, d.x + d.w - cx, `ns${play.id}`);
        const nOpt = { size: 26, seed: `n${play.id}`, tilt: -3, importance: "key", weight: 26 * 0.25, extra: [0.32, 0.14, 0.18, 0.26] };
        const sOpt = { size: 26, seed: `s${play.id}`, tilt: -3, importance: "key", weight: 26 * 0.25, extra: [0.28, 0.18, 0.16, 0.26] };
        const nw = Ink.write("NORTH", nOpt).width;
        const sw = Ink.write("SOUTH", sOpt).width;
        let mid = s.x + s.w / 2;
        if (you && Math.abs(you[1] - cy) < 150) mid = you[0] - s.x > s.w / 2 ? s.x + 105 : s.x + s.w - 105;
        out += Ink.write("NORTH", { ...nOpt, x: mid - nw / 2, y: cy - 24 }).svg;
        out += Ink.write("SOUTH", { ...sOpt, x: mid - sw / 2, y: cy + 24 + 26 }).svg;
        return out;
    }
    if (kind === "radius") {
        // Circles are exact (centre and radius), only drawn by hand.
        const rp = card.hint.meters * frame.pxPerMetre;
        return (
            Ink.ring(cx, cy, rp, { seed: `ring${play.id}`, weight: 4.5 }) +
            Ink.write(`${card.hint.meters} M`, { x: cx + rp * 0.72 + 14, y: cy - rp * 0.72 - 8, size: 27, seed: `ringm${play.id}`, tilt: -24, importance: "key", weight: 27 * 0.255 }).svg
        );
    }
    return "";
}

const inkLayer = new InkLayer((frame) => {
    let out = "";
    if (showHints()) out += drawHintsEdge(frame);
    const play = waitingPlay();
    const kind = drawingOf(play);
    if (kind === "ew" || kind === "ns" || kind === "radius") out += drawQuestion(frame, play, kind);
    if (kind === "section") out += drawSections(frame, play);
    return out;
}).addTo(map);

/**
 * Which part of <building>: the building and the lines between its sections,
 * by hand, and each section's letter where its pin is. Zoomed out, while its
 * sections would sit too close to read, only the building is drawn.
 */
function drawSections(frame, play) {
    const shapes = HNSHints.sectionShapes(play.target);
    if (!shapes) return "";
    const pt = ([lng, lat]) => frame.P(lat, lng);
    let out = Ink.wobble(shapes.outline.map(pt), { seed: `secw${play.target}`, weight: 3.6, amp: 1 });
    const pins = shapes.labels.map((sec) => frame.P(sec.lat, sec.lng));
    let closest = Infinity;
    pins.forEach((a, i) => pins.slice(i + 1).forEach((b) => (closest = Math.min(closest, Math.hypot(a[0] - b[0], a[1] - b[1])))));
    if (closest < 44) return out;
    shapes.dividers.forEach(([a, b], i) => {
        out += Ink.wobble([pt(a), pt(b)], { seed: `secd${play.target}${i}`, weight: 3.2, amp: 0.8 });
    });
    const size = Math.max(16, Math.min(30, closest * 0.4));
    for (const sec of shapes.labels) {
        const [x, y] = frame.P(sec.lat, sec.lng);
        const o = { size, seed: `secl${play.target}${sec.id}`, importance: "key", weight: size * 0.22 };
        const w = Ink.write(sec.id, { x: 0, y: 0, ...o }).width;
        out += Ink.write(sec.id, { ...o, x: x - w / 2, y: y + size * 0.36 }).svg;
    }
    return out;
}

// ---------------------------------------------------------------------------
// Places: a waiting "which X are you closest to?" pins its places in red;
// tapped, a place shows its pop-up
// ---------------------------------------------------------------------------
const placeLayer = L.layerGroup().addTo(map);
const PLACE_PIN = 18;
let placesShown = null;

function placeGroupLayer(group) {
    return CAMPUS_LAYERS.find((l) => l.key === group) ?? null;
}

function renderPlaces() {
    const play = waitingPlay();
    const group = drawingOf(play) === "nearest" ? cardOf(play.cardId).hint.group : null;
    const tagged = drawingOf(play) === "tag" ? cardOf(play.cardId).hint.landmark : null;
    const key = `${group ?? ""}|${tagged ?? ""}`;
    if (key === placesShown) return;
    placesShown = key;
    placeLayer.clearLayers();
    closePopup();
    if (group) {
        const layer = placeGroupLayer(group);
        for (const place of layer?.places ?? []) {
            // The pins' look: the red, a thin black edge, the shine drawn by hand (G4.1).
            const svg = Ink.glossPin(0, 0, { size: PLACE_PIN, seed: `gp${place.id}`, dot: "cut", shine: "arcHand" });
            const marker = L.marker([place.lat, place.lng], {
                icon: markIcon(svg, [-14, -PLACE_PIN * 2.1, 14, 3], "map-pin-hit"),
                keyboard: false,
                title: place.label,
                riseOnHover: false,
            }).addTo(placeLayer);
            marker.on("click", (e) => {
                L.DomEvent.stop(e);
                if (popupPlace === place) closePopup();
                else openPopup(place);
            });
        }
    }
    if (tagged) {
        const lm = cardCatalog?.landmarks?.[tagged];
        if (lm && Number.isFinite(lm.lat)) {
            // The place in a white tag, black and white: no circle, nothing red.
            const t = bubble(0, 0, String(lm.label).toUpperCase());
            L.marker([lm.lat, lm.lng], { icon: markIcon(t.svg, t.box), pane: "tagPane", interactive: false, keyboard: false }).addTo(placeLayer);
        }
    }
}

let popupMarker = null;
function closePopup() {
    popupPlace = null;
    if (popupMarker) map.removeLayer(popupMarker);
    popupMarker = null;
}

/**
 * A place's pop-up: a box with the name, then where (a café's pavilion and
 * room, a station's number), its tail white with a black edge, the box slid
 * sideways off any other pin.
 */
function openPopup(place) {
    closePopup();
    popupPlace = place;
    const rows = (place.detail ?? [])
        .filter(([k]) => ["Pavillon", "Room", "Station"].includes(k))
        .map(([k, v]) => `<div class="map-pop-row"><b>${escapeHtml(k)}</b> ${escapeHtml(v)}</div>`)
        .join("");
    const bottom = 2 * PLACE_PIN + 16; // the box's bottom edge, above the pin's point
    const html = `<div class="map-pop" style="left:0;bottom:${bottom}px"><div class="map-pop-name">${escapeHtml(place.label)}</div>${rows}</div>
        <svg width="24" height="20" style="position:absolute;left:-12px;bottom:${bottom - 17}px;overflow:visible" aria-hidden="true"><path d="M1.2 -4L12 14L22.8 -4" fill="#fff" stroke="#000" stroke-width="3"/></svg>`;
    popupMarker = L.marker([place.lat, place.lng], {
        icon: L.divIcon({ html, className: "map-mark", iconSize: [0, 0], iconAnchor: [0, 0] }),
        pane: "popPane",
        interactive: false,
        keyboard: false,
    }).addTo(map);
    placePopupBox();
}

/** Centre the pop-up over its pin unless that covers another pin; then slide it off. */
function placePopupBox() {
    const el = popupMarker?.getElement()?.querySelector(".map-pop");
    if (!el || !popupPlace) return;
    const { width: bw, height: bh } = el.getBoundingClientRect();
    const at = map.latLngToContainerPoint([popupPlace.lat, popupPlace.lng]);
    const bottom = at.y - (2 * PLACE_PIN + 16);
    let left = at.x - bw / 2;
    const others = (placeGroupLayer(cardOf(waitingPlay()?.cardId)?.hint?.group)?.places ?? []).filter((p) => p !== popupPlace);
    for (const p of others) {
        const o = map.latLngToContainerPoint([p.lat, p.lng]);
        if (o.y < bottom - bh - 4 || o.y - 2 * PLACE_PIN > bottom + 4) continue;
        const half = PLACE_PIN * 0.6 + 8;
        if (o.x < at.x && o.x + half > left) left = o.x + half;
        if (o.x > at.x && o.x - half < left + bw) left = o.x - half - bw;
    }
    const W = map.getSize().x;
    left = Math.max(12, Math.min(W - 12 - bw, at.x - 22, Math.max(at.x + 22 - bw, left)));
    el.style.left = `${Math.round(left - at.x)}px`;
}

// ---------------------------------------------------------------------------
// Other players: B29's pushpin on their exact spot, no name; tapped, the name
// shows above it. The admin sees everyone, named, by team.
// ---------------------------------------------------------------------------
const userPinsLayer = L.layerGroup().addTo(map);
const userPins = new Map(); // username -> { marker, key, user }
let tagMarker = null;

// Distinguishable group colours (the admin board and the admin's pins).
const GROUP_PALETTE = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6"];
const ADMIN_COLOR = "#f8fafc";
const LOBBY_COLOR = "#94a3b8";

function groupColor(groupId) {
    if (!groupId) return LOBBY_COLOR;
    return GROUP_PALETTE[(groupId - 1) % GROUP_PALETTE.length];
}

function adminPinIcon(u) {
    const role = u.isAdmin || u.role === "admin" ? "admin" : (u.role ?? "lobby");
    const color = role === "admin" ? ADMIN_COLOR : groupColor(u.groupId);
    const label = role === "admin" ? `${u.username} (admin)` : u.groupId ? `${u.username} · T${u.groupId} ${role}` : u.username;
    return L.divIcon({
        html: `<div class="user-pin" data-role="${role}" style="--pin-color:${color}"><span class="user-pin-dot"></span><span class="user-pin-label">${escapeHtml(label)}</span></div>`,
        className: "",
        iconSize: null,
        iconAnchor: [9, 9],
    });
}

let pinIconCache = null;
const playerPinIcon = () => (pinIconCache ??= markIcon(Ink.pin(0, 0, { size: 9 }), [-12, -12, 12, 12], "map-pin-hit"));

/**
 * Replace the set of user pins on the map. The server already scopes `users`
 * to what the caller may see (admins: everyone; players: own group only).
 */
function setUserPins(users, selfUsername, self = {}) {
    const asAdmin = Boolean(self.isAdmin);
    const seen = new Set();
    for (const u of users) {
        if (u.lat == null || u.lng == null) continue; // NULL = not sharing
        if (selfUsername && u.username === selfUsername) continue;
        seen.add(u.username);
        const latlng = [u.lat, u.lng];
        const key = asAdmin ? `A${u.isAdmin ? "A" : ""}${u.groupId ?? ""}:${u.role ?? ""}` : "P";
        const existing = userPins.get(u.username);
        if (existing) {
            existing.marker.setLatLng(latlng);
            existing.user = u;
            if (existing.key !== key) {
                existing.marker.setIcon(asAdmin ? adminPinIcon(u) : playerPinIcon());
                existing.key = key;
            }
        } else {
            const marker = L.marker(latlng, { icon: asAdmin ? adminPinIcon(u) : playerPinIcon(), keyboard: false, title: u.username }).addTo(userPinsLayer);
            const entry = { marker, key, user: u };
            marker.on("click", (e) => {
                L.DomEvent.stop(e);
                if (userPins.get(u.username)?.key !== "P") return;
                tapped = tapped === u.username ? null : u.username;
                renderTag();
            });
            userPins.set(u.username, entry);
        }
    }
    for (const [username, { marker }] of userPins) {
        if (!seen.has(username)) {
            userPinsLayer.removeLayer(marker);
            userPins.delete(username);
        }
    }
    if (tapped && !userPins.has(tapped)) tapped = null;
    renderTag();
    renderPinsShown();
    renderBox();
}

/** The tapped player's name, above the pin. */
function renderTag() {
    if (tagMarker) map.removeLayer(tagMarker);
    tagMarker = null;
    const entry = tapped && userPins.get(tapped);
    if (!entry || !pinsShown) return;
    const t = bubble(0, -7, tapped.toUpperCase());
    tagMarker = L.marker(entry.marker.getLatLng(), { icon: markIcon(t.svg, t.box), pane: "tagPane", interactive: false, keyboard: false }).addTo(map);
}

// A question drawn on the map is the one red thing: the others' pins step aside.
let pinsShown = true;
function renderPinsShown() {
    const kind = drawingOf(waitingPlay());
    const show = game?.isAdmin || !(kind === "ew" || kind === "ns" || kind === "radius" || kind === "nearest" || kind === "section");
    if (show === pinsShown) return;
    pinsShown = show;
    if (show) userPinsLayer.addTo(map);
    else map.removeLayer(userPinsLayer);
    renderTag();
}

map.on("click", () => {
    let changed = false;
    if (tapped) {
        tapped = null;
        renderTag();
        changed = true;
    }
    if (popupPlace) {
        closePopup();
        changed = true;
    }
    void changed;
});
map.on("zoomend", placePopupBox);

// ---------------------------------------------------------------------------
// YOU: the red arrow on your exact spot, pointing the way your phone faces;
// white when the GPS has gone quiet, so a frozen spot never passes for a live one
// ---------------------------------------------------------------------------
let youMarker = null;

function youSvg(deg, stale) {
    // B29's pin look on the navigation arrow (Yp.6.5): the pin's red, its thin
    // black edge (a touch uneven), and a white blade of shine.
    const r = (deg * Math.PI) / 180;
    const S = ([px, py]) => [px * Math.cos(r) - py * Math.sin(r), px * Math.sin(r) + py * Math.cos(r)];
    const pts = [[0, -21], [15, 15], [0, 6], [-15, 15]].map(S);
    const n = Ink.noise1(Ink.rng("yp"));
    const ring = [];
    pts.forEach((q, i) => {
        const nx = pts[(i + 1) % pts.length];
        for (let k = 0; k < 6; k++) ring.push([q[0] + ((nx[0] - q[0]) * k) / 6, q[1] + ((nx[1] - q[1]) * k) / 6]);
    });
    const cx = pts.reduce((t, q) => t + q[0], 0) / 4;
    const cy = pts.reduce((t, q) => t + q[1], 0) / 4;
    const d = `M${ring
        .map(([px, py], i) => {
            // Corners stay put; between them the edge moves by up to 0.7 px.
            const k = i % 6 === 0 ? 0 : n(i * 0.45) * 0.7;
            const l = Math.hypot(px - cx, py - cy) || 1;
            return `${(px + ((px - cx) / l) * k).toFixed(1)} ${(py + ((py - cy) / l) * k).toFixed(1)}`;
        })
        .join("L")}Z`;
    if (stale) return `<path d="${d}" fill="#fff" stroke="#000" stroke-width="2" stroke-linejoin="round"/>`;
    // The shine, in the arrow's own frame (tip up), turned with it.
    const f = (q) => S(q).map((v) => v.toFixed(1)).join(" ");
    const T = [0, -21];
    const Lw = [-15, 15];
    const inset = (t, k) => {
        const q = [T[0] + (Lw[0] - T[0]) * t, T[1] + (Lw[1] - T[1]) * t];
        return [q[0] + (36 / 39) * k, q[1] + (15 / 39) * k];
    };
    const shine = `<path d="M${f(inset(0.14, 1.8))}L${f(inset(0.76, 1.8))}L${f(inset(0.66, 4.5))}Z" fill="#fff"/>`;
    return `<defs><clipPath id="you"><path d="${d}"/></clipPath></defs><path d="${d}" fill="${RED}"/><g clip-path="url(#you)">${shine}</g><path d="${d}" fill="none" stroke="#000" stroke-width="1.6" stroke-linejoin="round"/>`;
}

let renderedYou = null;
function renderYou() {
    if (!lastKnownPosition) {
        if (youMarker) map.removeLayer(youMarker);
        youMarker = null;
        renderedYou = null;
        return;
    }
    const latlng = [lastKnownPosition.lat, lastKnownPosition.lng];
    const age = fixAgeMs();
    const stale = age === null || age > FIX_STALE_MS;
    const heading = currentHeading();
    const deg = heading === null ? 0 : Math.round(heading);
    const key = `${deg}:${stale}`;
    if (!youMarker) {
        youMarker = L.marker(latlng, { icon: markIcon(youSvg(deg, stale), [-26, -26, 26, 26]), pane: "youPane", interactive: false, keyboard: false }).addTo(map);
        renderedYou = key;
        return;
    }
    youMarker.setLatLng(latlng);
    if (key !== renderedYou) {
        renderedYou = key;
        const svg = youMarker.getElement()?.querySelector("svg");
        if (svg) svg.innerHTML = HNSMarks.uniqueIds(youSvg(deg, stale));
    }
}

// ---------------------------------------------------------------------------
// The question box, at the top
// ---------------------------------------------------------------------------
const box = {
    el: document.getElementById("map-box"),
    kicker: document.getElementById("map-box-kicker"),
    clock: document.getElementById("map-box-clock"),
    text: document.getElementById("map-box-text"),
    legend: document.getElementById("map-box-legend"),
    hand: document.getElementById("map-box-hand"),
};
let renderedHand = null;

const clockText = (ms) => {
    const total = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
};

const setText = (node, text) => {
    if (node.textContent !== text) node.textContent = text;
    node.hidden = !text;
};

/** How far the closest stalker is, for the hider between questions. */
function closestStalkerMetres() {
    if (!lastKnownPosition || game?.role !== "hider") return null;
    let best = null;
    for (const u of game.users ?? []) {
        if (u.role !== "stalker" || u.lat == null || u.lng == null) continue;
        const m = map.distance([lastKnownPosition.lat, lastKnownPosition.lng], [u.lat, u.lng]);
        if (best === null || m < best) best = m;
    }
    return best;
}

function renderBox() {
    const team = game?.team;
    if (!game || game.isAdmin || !team || (team.phase !== "hiding" && team.phase !== "hunting")) {
        box.el.hidden = true;
        return;
    }
    box.el.hidden = false;
    const hider = game.users?.find((u) => u.role === "hider")?.username ?? "your hider";
    const isHider = game.role === "hider";
    let kicker = "";
    let clock = "";
    let text = "";
    let legend = "";
    let hand = "";
    const timeLeft = team.paused ? "PAUSED" : null;
    if (team.phase === "hiding") {
        kicker = isHider ? "Go hide" : `${hider} is hiding`;
        clock = timeLeft ?? clockText(team.hideRemainingMs ?? 0);
    } else {
        const play = waitingPlay();
        clock = timeLeft ?? clockText(team.nextQuestionInMs ?? 0);
        if (play) {
            const card = cardOf(play.cardId);
            kicker = `Question ${play.question} · from ${play.askedByName ?? "a stalker"}`;
            // The room cards' [brackets] mark the part of ABC-1234 asked about; plain here.
            text = (window.HNSCards?.promptOf(card, play) ?? card?.prompt ?? "").replace(/[[\]]/g, "");
        } else {
            const last = team.question >= team.maxQuestions;
            if (last) {
                kicker = `${isHider ? "Until you win" : "Left to find the hider"} ${clock}`;
            } else {
                kicker = `Question ${team.question + 1} in ${clock}`;
            }
            clock = "";
            if (showHints()) legend = isHider ? "They know you're inside the red line." : "The hider is inside the red line.";
            // No strings: how far the closest stalker is gets scribbled in the box.
            const m = closestStalkerMetres();
            if (m !== null) hand = `${Math.round(m)} M AWAY`;
        }
    }
    setText(box.kicker, kicker.toUpperCase());
    box.clock.textContent = clock;
    setText(box.text, text);
    setText(box.legend, legend);
    if (hand !== renderedHand) {
        renderedHand = hand;
        box.hand.hidden = !hand;
        if (hand) {
            const o = { size: 15, seed: "bh", tilt: -2, importance: "info", weight: 15 * 0.24 };
            const res = Ink.write(hand, { ...o, x: 4, y: 26 });
            const w = Math.ceil(res.width + 10);
            box.hand.innerHTML = `<svg width="${w}" height="36" viewBox="0 0 ${w} 36" aria-hidden="true">${res.svg}</svg>`;
        } else box.hand.innerHTML = "";
    }
}

// ---------------------------------------------------------------------------
// Everything the game changes
// ---------------------------------------------------------------------------
let renderedState = null;

function setGame(next) {
    game = next;
    const play = waitingPlay();
    const key = JSON.stringify([
        Boolean(game),
        game?.isAdmin,
        game?.team?.phase,
        game?.team?.id,
        play?.id ?? null,
        Boolean(cardCatalog),
        hints.region ? 1 : 0,
        hints.mask ? 1 : 0,
    ]);
    if (key !== renderedState) {
        renderedState = key;
        renderMask();
        renderPlaces();
        renderPinsShown();
        inkLayer.redraw();
        notifyRender();
    }
    renderBox();
}

HNSHints.onStatus((status) => {
    const changed = status.region !== hints.region || status.ready !== hints.ready;
    hints = { region: status.region ?? null, mask: status.mask ?? null, ready: Boolean(status.ready) };
    if (!changed) return;
    renderedState = null;
    setGame(game);
});

// ---------------------------------------------------------------------------
// Where you are: the GPS fix, watched and kept alive.
// ---------------------------------------------------------------------------

function notifyPosition() {
    for (const fn of positionListeners) fn(lastKnownPosition);
}

const fixAgeMs = () => (lastFixAt === null ? null : performance.now() - lastFixAt);

function handlePosition(pos) {
    lastKnownPosition = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
    };
    lastFixAt = performance.now();
    // Course over ground: only means anything while actually moving.
    const { heading, speed } = pos.coords;
    gpsHeading =
        Number.isFinite(heading) && Number.isFinite(speed) && speed > GPS_HEADING_MIN_SPEED
            ? heading
            : null;
    locationProblem = null;
    notifyPosition();
    renderYou();
    renderBox();
}

// Quicker than anyone can read a permission dialog and answer it. A denial this
// fast means the browser refused without asking: Safari remembers a "Don't
// Allow" for about a day, and never asks when iOS has Safari Websites set to
// "Never", yet it still reports the permission as "prompt".
const SILENT_DENIAL_MS = 400;

/**
 * @param {GeolocationPositionError} err
 * @param {number|null} askedAt performance.now() when a button asked, if one did
 */
function handlePositionError(err, askedAt = null) {
    if (err.code === 1 /* PERMISSION_DENIED */) {
        // Treated as NULL: the player has to do something about it.
        lastKnownPosition = null;
        lastFixAt = null;
        if (!window.isSecureContext) {
            // Plain-http pages (e.g. a phone testing over the LAN) are refused
            // outright; no prompt will ever appear.
            locationProblem = "insecure";
        } else if (askedAt !== null && performance.now() - askedAt < SILENT_DENIAL_MS) {
            locationProblem = "blocked";
        } else {
            locationProblem = "denied";
        }
    } else if (!lastKnownPosition) {
        locationProblem = "unavailable";
    }
    // A timeout or a lost signal with a fix already in hand keeps that fix: it
    // ages (and whitens) honestly, and the watchdog keeps retrying.
    notifyPosition();
    renderYou();
}

function watchLocation() {
    if (!("geolocation" in navigator)) return;
    locationStarted = true;
    if (locationProblem === "off") locationProblem = null;
    // A watch that failed on permission never recovers by itself, so start over.
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchStartedAt = performance.now();
    watchId = navigator.geolocation.watchPosition(handlePosition, handlePositionError, {
        enableHighAccuracy: true,
        maximumAge: 2000,
        timeout: 20000,
    });
}

/**
 * Ask for the position again. Call it straight from a click: that's what lets
 * the browser show its "share your location?" prompt again (Safari insists on
 * a user gesture). Resolves with the resulting problem, or null on success.
 */
function requestLocation() {
    if (!("geolocation" in navigator)) return Promise.resolve("unsupported");
    const askedAt = performance.now();
    locationStarted = true;
    if (locationProblem === "off") locationProblem = null;
    return new Promise((resolve) => {
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                handlePosition(pos);
                watchLocation();
                resolve(null);
            },
            (err) => {
                handlePositionError(err, askedAt);
                resolve(locationProblem);
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
        );
    });
}

/** Start the GPS over: a fresh watch, and a one-off fix to kick it. */
function restartLocation() {
    if (!("geolocation" in navigator) || !locationStarted) return;
    // Denied needs the player; restarting would only fail again.
    if (locationProblem !== null && locationProblem !== "unavailable") return;
    lastRestartAt = performance.now();
    watchLocation();
    navigator.geolocation.getCurrentPosition(handlePosition, (err) => handlePositionError(err), {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
    });
}

function watchdog() {
    renderYou();
    if (!locationStarted || document.visibilityState !== "visible") return;
    // Never had a fix and never been granted: the permission prompt may still
    // be up, and asking again every 15 s would only nag.
    if (lastFixAt === null && locationPermission !== "granted") return;
    const age = fixAgeMs();
    const stuck =
        age === null ? performance.now() - watchStartedAt > WATCH_STUCK_MS : age > WATCH_STUCK_MS;
    if (stuck && performance.now() - lastRestartAt > WATCH_RESTART_GAP_MS) restartLocation();
}

try {
    navigator.permissions?.query({ name: "geolocation" }).then(
        (status) => {
            locationPermission = status.state;
            // Allowed on an earlier visit: no prompt will show, so start now.
            if (status.state === "granted") startLocation();
            status.addEventListener("change", () => {
                locationPermission = status.state;
                // Unblocked from the browser's site settings: resume without
                // making the player press anything.
                if (status.state === "granted" && !lastKnownPosition) {
                    locationProblem = null;
                    watchLocation();
                }
                notifyPosition();
            });
        },
        () => {},
    );
} catch {
    /* Permissions API present but doesn't know "geolocation" */
}

// ---------------------------------------------------------------------------
// Heading: which way the player is facing, YOU's arrow. The compass is the
// real source; while walking, the GPS course fills in for phones without one.
// iPhones only hand the compass over after a tap ("Before you start", app.js).
// ---------------------------------------------------------------------------

const compassNeedsTap =
    typeof DeviceOrientationEvent !== "undefined" &&
    typeof DeviceOrientationEvent.requestPermission === "function";

function screenAngle() {
    const angle = screen.orientation?.angle ?? window.orientation ?? 0;
    return Number.isFinite(angle) ? angle : 0;
}

function onOrientation(e) {
    let heading = null;
    if (typeof e.webkitCompassHeading === "number" && e.webkitCompassHeading >= 0) {
        heading = e.webkitCompassHeading; // iOS: degrees clockwise from north
    } else if (e.absolute && typeof e.alpha === "number") {
        heading = 360 - e.alpha; // alpha turns the other way
    }
    if (heading === null) return;
    compassHeading = (heading + screenAngle() + 360) % 360;
    if (headingFrame === null) {
        headingFrame = requestAnimationFrame(() => {
            headingFrame = null;
            renderYou();
        });
    }
}

function startCompass() {
    compassState = "on";
    if ("ondeviceorientationabsolute" in window) {
        window.addEventListener("deviceorientationabsolute", onOrientation);
    } else {
        window.addEventListener("deviceorientation", onOrientation);
    }
}

/** Call from a tap. Resolves with the new compass state. */
async function enableCompass() {
    if (!compassNeedsTap) return compassState;
    try {
        const answer = await DeviceOrientationEvent.requestPermission();
        if (answer === "granted") {
            startCompass();
            try {
                localStorage.setItem(COMPASS_GRANTED_KEY, "1");
            } catch {
                /* private mode: they will just be asked again */
            }
        } else {
            compassState = "denied";
        }
    } catch {
        compassState = "denied";
    }
    return compassState;
}

if (typeof DeviceOrientationEvent !== "undefined") {
    if (!compassNeedsTap) {
        startCompass();
    } else {
        compassState = "needs-permission";
        // Granted on an earlier visit: iOS still wants a tap per page load, but
        // no longer shows a prompt, so any first tap will do.
        let grantedBefore = false;
        try {
            grantedBefore = localStorage.getItem(COMPASS_GRANTED_KEY) === "1";
        } catch {
            /* no storage */
        }
        if (grantedBefore) {
            const onFirstTap = () => {
                window.removeEventListener("click", onFirstTap, true);
                enableCompass();
            };
            window.addEventListener("click", onFirstTap, true);
        }
    }
}

const currentHeading = () => compassHeading ?? gpsHeading;

/** Start following the GPS (once); app.js calls it when the player may be asked. */
function startLocation() {
    if (!locationStarted) watchLocation();
}

setInterval(watchdog, WATCHDOG_TICK_MS);
// Coming back to the page (screen unlocked, app switched back, bfcache) is
// exactly when a watch is most likely to have died quietly.
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") restartLocation();
});
window.addEventListener("pageshow", (e) => {
    if (e.persisted) restartLocation();
});
window.addEventListener("online", restartLocation);

// Public surface used by app.js
window.HNSMap = {
    map,
    setUserPins,
    /** The card deck, so the map can draw the question on the table and name places. */
    setCardCatalog(catalog) {
        cardCatalog = catalog;
        renderedState = null;
        setGame(game);
    },
    setGame,
    shown,
    onRender(fn) {
        renderListeners.add(fn);
        return () => renderListeners.delete(fn);
    },
    groupColor,
    getPosition: () => lastKnownPosition,
    /** How old the last GPS fix is, in ms; null without one. */
    getFixAgeMs: fixAgeMs,
    getLocationProblem: () => locationProblem,
    getLocationPermission: () => locationPermission,
    requestLocation,
    startLocation,
    /** Degrees clockwise from north, and where it came from; null if unknown. */
    getHeading: () =>
        compassHeading !== null
            ? { degrees: compassHeading, source: "compass" }
            : gpsHeading !== null
              ? { degrees: gpsHeading, source: "gps" }
              : null,
    getCompassState: () => compassState,
    enableCompass,
    toast: showToast,
    onPosition(fn) {
        positionListeners.add(fn);
        return () => positionListeners.delete(fn);
    },
    invalidateSize: () => map.invalidateSize(),
};
