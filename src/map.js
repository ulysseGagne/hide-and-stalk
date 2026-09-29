/* global L, HNSHints */

// Default view mirrors JetLagHideAndSeek's default (mapGeoLocation / zoom 5).
const DEFAULT_CENTER = [51.5074, -0.1278];
const DEFAULT_ZOOM = 5;

const OSM_ATTRIBUTION =
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Base maps. The CARTO styles the original shipped with (Voyager, Light, Dark)
// now answer every tile with an "API KEY REQUIRED" placeholder, so only the
// OpenStreetMap one is left. Add a layer here and the picker comes back.
const TILE_LAYERS = {
    osmcarto: {
        label: "OpenStreetMap",
        layer: L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
            attribution: OSM_ATTRIBUTION,
            maxZoom: 19,
            minZoom: 2,
            noWrap: true,
        }),
    },
};

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
const toastEl = document.createElement("div");
toastEl.id = "toast";
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
    center: DEFAULT_CENTER,
    zoom: DEFAULT_ZOOM,
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

let currentTileKey = "osmcarto";
TILE_LAYERS[currentTileKey].layer.addTo(map);

L.control.scale({ position: "bottomleft" }).addTo(map);

// ---------------------------------------------------------------------------
// Overlays
// ---------------------------------------------------------------------------
// Public-activity heatmap sourced from Overpass (OpenStreetMap). Since OSM has
// no GPS traces, we approximate "public activity" with the infrastructure people
// use in public: footways/paths/cycleways, parks & sports grounds, and amenities.
const OVERPASS_ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
];
const HEATMAP_MIN_ZOOM = 12;
const HEATMAP_MAX_POINTS = 20000;
// The whole algorithm, in the words a player needs: the more paths, benches,
// cafés, shops and bus stops OpenStreetMap has around a spot, the hotter it is.
const HEATMAP_EXPLAINED =
    "Busy areas: the more paths, benches, cafés and bus stops around a spot, the hotter it is (from OpenStreetMap).";

function buildActivityQuery(bounds) {
    const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
    return `
[out:json][timeout:25];
(
  way["highway"~"^(footway|path|pedestrian|cycleway|track|steps|living_street)$"](${bbox});
  way["leisure"~"^(park|pitch|playground|sports_centre|track|garden|fitness_station|dog_park)$"](${bbox});
  node["leisure"~"^(park|pitch|playground|sports_centre|fitness_station|dog_park)$"](${bbox});
  node["amenity"~"^(cafe|restaurant|bar|pub|fast_food|bench|school|university|library|marketplace|place_of_worship|community_centre)$"](${bbox});
  node["shop"](${bbox});
  node["public_transport"="stop_position"](${bbox});
  node["railway"="station"](${bbox});
);
out geom;
`;
}

async function fetchOverpass(query) {
    let lastErr = null;
    for (const endpoint of OVERPASS_ENDPOINTS) {
        try {
            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: `data=${encodeURIComponent(query)}`,
            });
            if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            lastErr = err;
        }
    }
    throw lastErr ?? new Error("Overpass request failed");
}

function overpassToHeatPoints(data) {
    const points = [];
    for (const el of data.elements ?? []) {
        if (el.type === "node" && el.lat != null) {
            points.push([el.lat, el.lon, 1]);
        } else if (el.type === "way" && Array.isArray(el.geometry)) {
            // Weight linear features lower per-vertex so dense path networks
            // don't drown out everything else.
            for (const pt of el.geometry) points.push([pt.lat, pt.lon, 0.5]);
        }
    }
    if (points.length > HEATMAP_MAX_POINTS) {
        const step = Math.ceil(points.length / HEATMAP_MAX_POINTS);
        return points.filter((_, i) => i % step === 0);
    }
    return points;
}

const activityHeatLayer = L.heatLayer([], {
    radius: 18,
    blur: 20,
    minOpacity: 0.3,
    maxZoom: 17,
});

let heatmapRequestId = 0;
let heatmapDebounce = null;

async function refreshActivityHeatmap() {
    if (map.getZoom() < HEATMAP_MIN_ZOOM) {
        activityHeatLayer.setLatLngs([]);
        showToast(`Zoom in to level ${HEATMAP_MIN_ZOOM}+ to load the heatmap`);
        return;
    }
    const requestId = ++heatmapRequestId;
    showToast("Loading activity heatmap…", 4000);
    try {
        const data = await fetchOverpass(buildActivityQuery(map.getBounds()));
        if (requestId !== heatmapRequestId) return; // stale response
        const points = overpassToHeatPoints(data);
        activityHeatLayer.setLatLngs(points);
        showToast(HEATMAP_EXPLAINED, 5000);
    } catch (err) {
        if (requestId !== heatmapRequestId) return;
        console.error(err);
        showToast("Failed to load heatmap data");
    }
}

function scheduleHeatmapRefresh() {
    clearTimeout(heatmapDebounce);
    heatmapDebounce = setTimeout(refreshActivityHeatmap, 600);
}

// ---------------------------------------------------------------------------
// Campus overlays
// ---------------------------------------------------------------------------
// One toggleable layer per element of locations/geojson, generated into
// src/locations.js by tools/build-locations.mjs. Everyone gets these - they are
// public campus reference points, and the hider needs them to answer honestly
// ("which bus stop are you closest to?" is unanswerable if you can't see which
// stops count).
//
// Each marker is clickable, and its popup names the cards that ask about it, so
// the link between a place on the map and the question it answers is visible
// rather than implied.

const CAMPUS_LAYERS = window.HNSLocations?.layers ?? [];

// Prompts come from the card catalogue rather than being baked in here, so the
// popups can never quote a question the deck no longer asks. It arrives after
// login (cards.js), which is why popups render their content on open.
let cardCatalog = null;

const campusBounds = (() => {
    const ring = CAMPUS_LAYERS.find((l) => l.kind === "polygon")?.ring;
    return ring ? L.latLngBounds(ring.map(([lng, lat]) => [lat, lng])) : null;
})();

function campusMarkerIcon(color) {
    return L.divIcon({
        html: `<span class="campus-pin" style="--campus-color:${color}"></span>`,
        className: "",
        iconSize: [12, 12],
        iconAnchor: [6, 6],
    });
}

/** "Asked by" block: every card in the deck that refers to this place. */
function cardLinkHtml(cardIds) {
    if (!cardCatalog || !cardIds?.length) return "";
    const prompts = cardIds
        .map((id) => cardCatalog.cards.find((c) => c.id === id)?.prompt)
        .filter(Boolean);
    if (!prompts.length) return "";
    return `<div class="campus-popup-cards">
        <span class="campus-popup-cards-title">Asked by</span>
        ${prompts.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}
    </div>`;
}

function campusPopupHtml(layer, { label, detail, cardIds }) {
    const rows = (detail ?? [])
        .map(
            ([key, value]) =>
                `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`,
        )
        .join("");
    return `<div class="campus-popup" style="--campus-color:${layer.color}">
        <strong class="campus-popup-name">${escapeHtml(label)}</strong>
        <span class="campus-popup-layer">${escapeHtml(layer.label)}</span>
        ${rows ? `<dl class="campus-popup-detail">${rows}</dl>` : ""}
        ${cardLinkHtml(cardIds)}
    </div>`;
}

function buildCampusLayer(layer) {
    const group = L.layerGroup();
    if (layer.kind === "polygon") {
        const shape = L.polygon(
            layer.ring.map(([lng, lat]) => [lat, lng]),
            {
                color: layer.color,
                weight: 3,
                opacity: 0.9,
                dashArray: "8 6",
                fillColor: layer.color,
                fillOpacity: 0.05,
            },
        ).addTo(group);
        shape.bindPopup(() =>
            campusPopupHtml(layer, {
                label: layer.name,
                detail: layer.detail,
                cardIds: layer.cardIds,
            }),
        );
        return group;
    }
    for (const place of layer.places) {
        const marker = L.marker([place.lat, place.lng], {
            icon: campusMarkerIcon(layer.color),
            title: place.label,
        }).addTo(group);
        // Rendered on open so a catalogue that loads later still shows up.
        marker.bindPopup(() => campusPopupHtml(layer, place), {
            className: "campus-popup-wrapper",
        });
        marker.bindTooltip(place.label, {
            direction: "right",
            offset: [8, 0],
            // Only the six landmarks are few enough to keep their names on
            // screen; the rest would be an unreadable pile.
            permanent: Boolean(layer.labelled),
            className: "campus-tooltip",
        });
    }
    return group;
}

/**
 * The map opens on the world view, so a player who ticks "Cafés" from there
 * would watch nothing happen. Bring campus into view the first time that is
 * the case.
 */
function revealCampus() {
    if (!campusBounds || map.getBounds().intersects(campusBounds)) return;
    map.fitBounds(campusBounds, { padding: [24, 24] });
    showToast("Moved to campus");
}

// ---------------------------------------------------------------------------
// The question on the table
// ---------------------------------------------------------------------------
// While a card is waiting for an answer, the thing it is asking about is drawn:
// the line you are north or south of, the circle you are inside or outside, the
// landmark you are nearer to or further from. Both sides of the hunt get it —
// the stalker to read the answer when it lands, the hider to answer honestly.
//
// It clears itself when the card is answered, because the card leaves `pending`
// and the Hints filter takes over from there.

const ASK_COLOR = "#f43f5e";
const askLayer = L.layerGroup().addTo(map);

// Campus overlays this file switched on for a live question, so it knows which
// ones it may switch back off. Anything the player toggles by hand leaves the
// set and is never touched again.
const autoEnabled = new Set();

/** Which campus overlay, if any, a given card wants on screen. */
const overlayForCard = new Map(
    CAMPUS_LAYERS.flatMap((layer) =>
        (layer.cardIds ?? []).map((cardId) => [cardId, `campus_${layer.key}`]),
    ),
);

/** A line of latitude or longitude, drawn well past the edges of campus. */
function askLine(axis, lat, lng) {
    const pad = 0.05;
    const b = campusBounds;
    const [south, north] = b ? [b.getSouth() - pad, b.getNorth() + pad] : [lat - pad, lat + pad];
    const [west, east] = b ? [b.getWest() - pad, b.getEast() + pad] : [lng - pad, lng + pad];
    return axis === "ns"
        ? [
              [lat, west],
              [lat, east],
          ]
        : [
              [south, lng],
              [north, lng],
          ];
}

function drawAsk(card, ask) {
    const hint = card.hint;
    const hasAsker = Number.isFinite(ask.lat) && Number.isFinite(ask.lng);
    const dashed = { color: ASK_COLOR, weight: 2, dashArray: "6 5", interactive: false };

    if (hint?.type === "halfPlane" && hasAsker) {
        L.polyline(askLine(hint.axis, ask.lat, ask.lng), dashed).addTo(askLayer);
        L.marker([ask.lat, ask.lng], {
            icon: L.divIcon({
                html: `<span class="ask-pin" style="--ask-color:${ASK_COLOR}"></span>`,
                className: "",
                iconSize: [10, 10],
                iconAnchor: [5, 5],
            }),
            interactive: false,
            keyboard: false,
        }).addTo(askLayer);
        return;
    }
    if (hint?.type === "radius" && hasAsker) {
        L.circle([ask.lat, ask.lng], {
            ...dashed,
            radius: hint.meters,
            fillColor: ASK_COLOR,
            fillOpacity: 0.06,
        })
            .addTo(askLayer)
            .bindTooltip(`${hint.meters} m`, { permanent: false, direction: "top" });
        return;
    }
    if (hint?.type === "closerThan") {
        const place = cardCatalog?.landmarks?.[hint.landmark];
        if (place) {
            L.circleMarker([place.lat, place.lng], {
                ...dashed,
                radius: 11,
                fill: false,
            }).addTo(askLayer);
        }
    }
}

/**
 * @param {{cardId: string, lat: number|null, lng: number|null}[]} asks
 *        the cards currently waiting on an answer
 */
function setAskOverlays(asks) {
    askLayer.clearLayers();
    const wanted = new Set();
    for (const ask of asks ?? []) {
        const card = cardCatalog?.cards.find((c) => c.id === ask.cardId);
        if (!card) continue;
        drawAsk(card, ask);
        const overlayKey = overlayForCard.get(ask.cardId);
        if (overlayKey) wanted.add(overlayKey);
    }
    for (const key of wanted) {
        if (OVERLAYS[key] && !OVERLAYS[key].enabled) {
            setOverlayEnabled(key, true);
            autoEnabled.add(key);
            syncOverlayRow(key);
        }
    }
    for (const key of [...autoEnabled]) {
        if (wanted.has(key)) continue;
        autoEnabled.delete(key);
        setOverlayEnabled(key, false);
        syncOverlayRow(key);
    }
}

const campusOverlays = Object.fromEntries(
    CAMPUS_LAYERS.map((layer) => [
        `campus_${layer.key}`,
        {
            label: layer.label,
            group: "Campus",
            layer: buildCampusLayer(layer),
            enabled: false,
            onEnable: revealCampus,
        },
    ]),
);

const OVERLAYS = {
    // Progressive elimination from the group's answered cards, for both sides
    // of the hunt: the stalkers watch it close in, the hider watches how much
    // of their cover they have given away. The geometry lives in hints.js.
    hints: {
        label: "Hints",
        layer: HNSHints.layer,
        enabled: false,
        // Off until app.js confirms the player is in a team.
        available: false,
        // Where the hider can still be is the point of the map, for the hider
        // and the stalkers alike, so it is always drawn and has no checkbox.
        alwaysOn: true,
        onEnable() {
            HNSHints.setEnabled(true);
        },
        onDisable() {
            HNSHints.setEnabled(false);
        },
    },
    activityHeatmap: {
        label: "Busy areas (heatmap)",
        layer: activityHeatLayer,
        enabled: false,
        onEnable() {
            map.on("moveend", scheduleHeatmapRefresh);
            refreshActivityHeatmap();
        },
        onDisable() {
            map.off("moveend", scheduleHeatmapRefresh);
            clearTimeout(heatmapDebounce);
            heatmapRequestId++;
            activityHeatLayer.setLatLngs([]);
        },
    },
    ...campusOverlays,
};

// Rows of the overlays menu, so they can be shown/hidden per role.
const overlayRows = {};

/** Put a checkbox back in step with its overlay after code toggled it. */
function syncOverlayRow(key) {
    const entry = overlayRows[key];
    if (entry) entry.checkbox.checked = Boolean(OVERLAYS[key]?.enabled);
}

function setOverlayEnabled(key, enabled) {
    const overlay = OVERLAYS[key];
    if (!overlay || overlay.enabled === enabled) return;
    overlay.enabled = enabled;
    if (enabled) {
        overlay.layer.addTo(map);
        overlay.onEnable?.();
    } else {
        overlay.onDisable?.();
        map.removeLayer(overlay.layer);
    }
}

// ---------------------------------------------------------------------------
// Custom controls (top-right, same as the original: fullscreen + tile select)
// ---------------------------------------------------------------------------
const FULLSCREEN_ICON =
    '<svg viewBox="0 0 1024 1024" fill="currentColor"><path d="M290 236.4l43.9-43.9a8.01 8.01 0 0 0-4.7-13.6L169 160c-5.1-.6-9.5 3.7-8.9 8.9L179 329.1c.8 6.6 8.9 9.4 13.6 4.7l43.7-43.7L370 423.7c3.1 3.1 8.2 3.1 11.3 0l42.4-42.3c3.1-3.1 3.1-8.2 0-11.3L290 236.4zm352.7 187.3c3.1 3.1 8.2 3.1 11.3 0l133.7-133.6 43.7 43.7a8.01 8.01 0 0 0 13.6-4.7L863.9 169c.6-5.1-3.7-9.5-8.9-8.9L694.8 179c-6.6.8-9.4 8.9-4.7 13.6l43.9 43.9L600.3 370a8.03 8.03 0 0 0 0 11.3l42.4 42.4zM845 694.9c-.8-6.6-8.9-9.4-13.6-4.7l-43.7 43.7L654 600.3a8.03 8.03 0 0 0-11.3 0l-42.4 42.3a8.03 8.03 0 0 0 0 11.3L734 787.6l-43.9 43.9a8.01 8.01 0 0 0 4.7 13.6L855 864c5.1.6 9.5-3.7 8.9-8.9L845 694.9zm-463.7-94.6a8.03 8.03 0 0 0-11.3 0L236.3 733.9l-43.7-43.7a8.01 8.01 0 0 0-13.6 4.7L160.1 855c-.6 5.1 3.7 9.5 8.9 8.9L329.2 845c6.6-.8 9.4-8.9 4.7-13.6L290 787.6 423.7 654c3.1-3.1 3.1-8.2 0-11.3l-42.4-42.4z"/></svg>';
const FULLSCREEN_EXIT_ICON =
    '<svg viewBox="0 0 1024 1024" fill="currentColor"><path d="M391 240.9c-.8-6.6-8.9-9.4-13.6-4.7l-43.7 43.7L200 146.3a8.03 8.03 0 0 0-11.3 0l-42.4 42.3a8.03 8.03 0 0 0 0 11.3L280 333.6l-43.9 43.9a8.01 8.01 0 0 0 4.7 13.6L401 410c5.1.6 9.5-3.7 8.9-8.9L391 240.9zm10.1 373.2L240.8 633c-6.6.8-9.4 8.9-4.7 13.6l43.9 43.9L146.3 824a8.03 8.03 0 0 0 0 11.3l42.4 42.3c3.1 3.1 8.2 3.1 11.3 0L333.7 744l43.7 43.7A8.01 8.01 0 0 0 391 783l18.9-160.1c.6-5.1-3.7-9.4-8.9-8.9zm221.8-204.2L783.2 391c6.6-.8 9.4-8.9 4.7-13.6L744 333.6 877.7 200c3.1-3.1 3.1-8.2 0-11.3l-42.4-42.3a8.03 8.03 0 0 0-11.3 0L690.3 279.9l-43.7-43.7a8.01 8.01 0 0 0-13.6 4.7L614.1 401c-.6 5.2 3.7 9.5 8.8 8.9zM744 690.4l43.9-43.9a8.01 8.01 0 0 0-4.7-13.6L623 614c-5.1-.6-9.5 3.7-8.9 8.9L633 783.1c.8 6.6 8.9 9.4 13.6 4.7l43.7-43.7L824 877.7c3.1 3.1 8.2 3.1 11.3 0l42.4-42.3c3.1-3.1 3.1-8.2 0-11.3L744 690.4z"/></svg>';

const CustomControls = L.Control.extend({
    options: { position: "topright" },
    onAdd() {
        const container = L.DomUtil.create("div", "leaflet-bar");
        container.style.border = "none";
        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.gap = "8px";

        // Fullscreen button
        const fullscreenBtn = L.DomUtil.create(
            "a",
            "leaflet-control-custom",
            container,
        );
        fullscreenBtn.title = "Toggle fullscreen";
        fullscreenBtn.innerHTML = FULLSCREEN_ICON;
        L.DomEvent.on(fullscreenBtn, "click", (e) => {
            L.DomEvent.stop(e);
            const target = document.getElementById(
                "map-modal-dialog-container-leaflet",
            );
            if (!document.fullscreenElement) {
                target.requestFullscreen?.();
            } else {
                document.exitFullscreen?.();
            }
        });
        document.addEventListener("fullscreenchange", () => {
            fullscreenBtn.innerHTML = document.fullscreenElement
                ? FULLSCREEN_EXIT_ICON
                : FULLSCREEN_ICON;
            setTimeout(() => map.invalidateSize(), 100);
        });

        // Tile layer picker, when there is more than one to pick from.
        const tileWrapper = L.DomUtil.create(
            "div",
            "leaflet-control-custom leaflet-control-tile-select",
            container,
        );
        const select = L.DomUtil.create("select", "", tileWrapper);
        select.title = "Base map";
        for (const [key, { label }] of Object.entries(TILE_LAYERS)) {
            const opt = document.createElement("option");
            opt.value = key;
            opt.textContent = label;
            if (key === currentTileKey) opt.selected = true;
            select.appendChild(opt);
        }
        L.DomEvent.on(select, "change", () => {
            map.removeLayer(TILE_LAYERS[currentTileKey].layer);
            currentTileKey = select.value;
            TILE_LAYERS[currentTileKey].layer.addTo(map);
        });
        tileWrapper.hidden = Object.keys(TILE_LAYERS).length < 2;

        // Overlays menu
        const overlaysWrapper = L.DomUtil.create(
            "div",
            "leaflet-control-overlays",
            container,
        );
        const overlaysToggle = L.DomUtil.create(
            "a",
            "leaflet-control-custom",
            overlaysWrapper,
        );
        overlaysToggle.title = "Overlays";
        overlaysToggle.innerHTML =
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>';
        const overlaysMenu = L.DomUtil.create(
            "div",
            "leaflet-control-overlays-menu",
            overlaysWrapper,
        );
        const menuTitle = L.DomUtil.create("div", "overlays-title", overlaysMenu);
        menuTitle.textContent = "Overlays";
        let currentGroup = null;
        for (const [key, overlay] of Object.entries(OVERLAYS)) {
            if (overlay.alwaysOn) continue; // nothing to toggle
            // The campus rows get their own heading so the menu doesn't read as
            // one long undifferentiated list.
            if (overlay.group && overlay.group !== currentGroup) {
                currentGroup = overlay.group;
                const heading = L.DomUtil.create(
                    "div",
                    "overlays-title overlays-subtitle",
                    overlaysMenu,
                );
                heading.textContent = overlay.group;
            }
            const row = L.DomUtil.create("label", "overlays-row", overlaysMenu);
            const checkbox = L.DomUtil.create("input", "", row);
            checkbox.type = "checkbox";
            checkbox.checked = overlay.enabled;
            const text = L.DomUtil.create("span", "", row);
            text.textContent = overlay.label;
            L.DomEvent.on(checkbox, "change", () => {
                // Touched by hand: the live-question logic stops managing it.
                autoEnabled.delete(key);
                setOverlayEnabled(key, checkbox.checked);
            });
            overlayRows[key] = { row, checkbox };
            row.hidden = overlay.available === false;
        }
        L.DomEvent.on(overlaysToggle, "click", (e) => {
            L.DomEvent.stop(e);
            overlaysMenu.classList.toggle("open");
        });

        // Stop map from reacting to clicks/scroll on the controls
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        return container;
    },
});
map.addControl(new CustomControls());

// ---------------------------------------------------------------------------
// Other users' pins (fed by app.js from the /locations endpoint)
// ---------------------------------------------------------------------------
const userPinsLayer = L.layerGroup().addTo(map);
const userPins = new Map(); // username -> { marker, key }

// Distinguishable group colours; wraps around for very large games.
const GROUP_PALETTE = [
    "#ef4444",
    "#3b82f6",
    "#22c55e",
    "#f59e0b",
    "#a855f7",
    "#06b6d4",
    "#ec4899",
    "#84cc16",
    "#f97316",
    "#14b8a6",
];
const ADMIN_COLOR = "#f8fafc";
const LOBBY_COLOR = "#94a3b8";

function groupColor(groupId) {
    if (!groupId) return LOBBY_COLOR;
    return GROUP_PALETTE[(groupId - 1) % GROUP_PALETTE.length];
}

function pinStyle(u) {
    if (u.isAdmin || u.role === "admin") {
        return { color: ADMIN_COLOR, role: "admin", label: `${u.username} (admin)` };
    }
    const color = groupColor(u.groupId);
    const role = u.role ?? "lobby";
    const label = u.groupId
        ? `${u.username} · T${u.groupId} ${role}`
        : u.username;
    return { color, role, label };
}

function makeUserPinIcon(u) {
    const { color, role, label } = pinStyle(u);
    return L.divIcon({
        html: `<div class="user-pin" data-role="${role}" style="--pin-color:${color}"><span class="user-pin-dot"></span><span class="user-pin-label">${escapeHtml(label)}</span></div>`,
        className: "",
        iconSize: null,
        iconAnchor: [9, 9],
    });
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

/**
 * Replace the set of user pins on the map. The server already scopes `users`
 * to what the caller may see (admins: everyone; players: own group only).
 * @param {{username: string, lat: number|null, lng: number|null, groupId?: number|null, role?: string|null, isAdmin?: boolean}[]} users
 * @param {string|null} selfUsername  pins for this user are skipped (follow-me marker covers it)
 * @param {{isAdmin?: boolean, role?: string|null, groupId?: number|null}} [self]  the caller, for the hider's tethers
 */
function setUserPins(users, selfUsername, self = {}) {
    setTetherTargets(users, self);
    const seen = new Set();
    for (const u of users) {
        if (u.lat == null || u.lng == null) continue; // NULL = not sharing
        if (selfUsername && u.username === selfUsername) continue;
        seen.add(u.username);
        const latlng = [u.lat, u.lng];
        const styleKey = `${u.isAdmin ? "A" : ""}${u.groupId ?? ""}:${u.role ?? ""}`;
        const existing = userPins.get(u.username);
        if (existing) {
            existing.marker.setLatLng(latlng);
            if (existing.key !== styleKey) {
                existing.marker.setIcon(makeUserPinIcon(u));
                existing.key = styleKey;
            }
        } else {
            const marker = L.marker(latlng, {
                icon: makeUserPinIcon(u),
                title: u.username,
            }).addTo(userPinsLayer);
            userPins.set(u.username, { marker, key: styleKey });
        }
    }
    for (const [username, { marker }] of userPins) {
        if (!seen.has(username)) {
            userPinsLayer.removeLayer(marker);
            userPins.delete(username);
        }
    }
}

// ---------------------------------------------------------------------------
// Follow-me location marker: the blue dot, plus a cone showing which way the
// player is facing (see "Heading" below). It turns grey when the GPS has gone
// quiet, so a frozen dot never passes for a live one.
// ---------------------------------------------------------------------------
let followMeMarker = null;
let lastKnownPosition = null; // { lat, lng, accuracy } or null when unavailable / denied
// When the last fix arrived (performance.now()), so its age is always known.
let lastFixAt = null;
// Why there is no position: null (have one, or still waiting for the first
// fix / the permission prompt), "denied", "unavailable" or "unsupported".
let locationProblem = "geolocation" in navigator ? null : "unsupported";
// The browser's stored decision: "granted" | "prompt" | "denied", or null when
// it has no Permissions API. "denied" here means the prompt won't come back and
// the player has to unblock the site in their browser settings.
let locationPermission = null;
let watchId = null;
let watchStartedAt = 0;
const positionListeners = new Set();

// A fix older than this is drawn grey. Phones report every second or two while
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
let renderedHeading = null;
let renderedStale = null;

function notifyPosition() {
    for (const fn of positionListeners) fn(lastKnownPosition);
}

const fixAgeMs = () => (lastFixAt === null ? null : performance.now() - lastFixAt);

function followMeHtml() {
    return `<div class="follow-me-marker">
        <div class="heading-cone" hidden></div>
        <svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" fill="#2A81CB" opacity="0.5"/><circle cx="8" cy="8" r="3" fill="#2A81CB"/></svg>
    </div>`;
}

function handlePosition(pos) {
    const latlng = [pos.coords.latitude, pos.coords.longitude];
    lastKnownPosition = {
        lat: latlng[0],
        lng: latlng[1],
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
    if (followMeMarker) {
        followMeMarker.setLatLng(latlng);
    } else {
        followMeMarker = L.marker(latlng, {
            icon: L.divIcon({
                html: followMeHtml(),
                className: "",
                iconSize: [20, 20],
                iconAnchor: [10, 10],
            }),
            zIndexOffset: 1000,
        }).addTo(map);
        // Close enough to read the campus paths.
        map.setView(latlng, 16);
    }
    renderFollowMe();
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
    // ages (and greys out) honestly, and the watchdog keeps retrying.
    notifyPosition();
    renderFollowMe();
}

function watchLocation() {
    if (!("geolocation" in navigator)) return;
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
    if (!("geolocation" in navigator)) return;
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
    renderFollowMe();
    if (document.visibilityState !== "visible") return;
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
// Heading: which way the player is facing, drawn as a cone on the blue dot.
// The compass is the real source; while walking, the GPS course fills in for
// phones without one. iPhones only hand the compass over after a tap, so
// app.js shows a "Turn on" button that calls enableCompass().
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
            renderFollowMe();
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

/** Point the cone, and grey the dot out when the GPS has gone quiet. */
function renderFollowMe() {
    const el = followMeMarker?.getElement();
    if (!el) return;
    const age = fixAgeMs();
    const stale = age === null || age > FIX_STALE_MS;
    if (stale !== renderedStale) {
        renderedStale = stale;
        el.querySelector(".follow-me-marker")?.classList.toggle("stale", stale);
    }
    const heading = currentHeading();
    const rounded = heading === null ? null : Math.round(heading);
    if (rounded === renderedHeading) return;
    renderedHeading = rounded;
    const cone = el.querySelector(".heading-cone");
    if (!cone) return;
    cone.hidden = rounded === null;
    if (rounded !== null) cone.style.transform = `translate(-50%, -50%) rotate(${rounded}deg)`;
}

// Everything the GPS callbacks touch exists now: start it.
watchLocation();
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

// ---------------------------------------------------------------------------
// Hider tethers: a dashed line from the hider to each stalker hunting them,
// labelled with the live distance between the two. Hider-only by construction —
// nobody else is ever sent the hider's position to draw a line from.
// ---------------------------------------------------------------------------
const tetherLayer = L.layerGroup().addTo(map);
const tethers = new Map(); // username -> { line, label, text, color }
let tetherTargets = []; // [{ username, lat, lng, color }]

function formatDistance(metres) {
    if (metres < 1000) return `${Math.round(metres)} m`;
    if (metres < 10000) return `${(metres / 1000).toFixed(2)} km`;
    return `${Math.round(metres / 1000)} km`;
}

function makeTetherLabelIcon(text, color) {
    return L.divIcon({
        html: `<span class="tether-label" style="--tether-color:${color}">${escapeHtml(text)}</span>`,
        className: "",
        iconSize: null,
    });
}

/**
 * Pick the stalkers a tether should be drawn to. Anyone else — a stalker, an
 * admin, a player in the lobby — gets an empty list and no lines.
 */
function setTetherTargets(users, self) {
    tetherTargets =
        self.role === "hider" && !self.isAdmin
            ? users
                  .filter(
                      (u) =>
                          u.role === "stalker" &&
                          u.groupId === self.groupId &&
                          u.lat != null &&
                          u.lng != null,
                  )
                  .map((u) => ({
                      username: u.username,
                      lat: u.lat,
                      lng: u.lng,
                      color: groupColor(u.groupId),
                  }))
            : [];
    redrawTethers();
}

/**
 * Redraw every tether from our own live GPS fix. Called both when a new roster
 * arrives and when we ourselves move, so the distances stay honest between polls.
 */
function redrawTethers() {
    const seen = new Set();
    // No fix of our own means no anchor point, so the lines simply disappear.
    if (lastKnownPosition) {
        const from = L.latLng(lastKnownPosition.lat, lastKnownPosition.lng);
        for (const target of tetherTargets) {
            seen.add(target.username);
            const to = L.latLng(target.lat, target.lng);
            const mid = L.latLng(
                (from.lat + to.lat) / 2,
                (from.lng + to.lng) / 2,
            );
            const text = formatDistance(map.distance(from, to));
            const existing = tethers.get(target.username);
            if (existing) {
                existing.line.setLatLngs([from, to]);
                existing.label.setLatLng(mid);
                if (existing.text !== text || existing.color !== target.color) {
                    if (existing.color !== target.color) {
                        existing.line.setStyle({ color: target.color });
                    }
                    existing.label.setIcon(
                        makeTetherLabelIcon(text, target.color),
                    );
                    existing.text = text;
                    existing.color = target.color;
                }
                continue;
            }
            const line = L.polyline([from, to], {
                color: target.color,
                weight: 2,
                opacity: 0.75,
                dashArray: "6 6",
                interactive: false,
            }).addTo(tetherLayer);
            const label = L.marker(mid, {
                icon: makeTetherLabelIcon(text, target.color),
                interactive: false,
                keyboard: false,
                zIndexOffset: 500,
            }).addTo(tetherLayer);
            tethers.set(target.username, {
                line,
                label,
                text,
                color: target.color,
            });
        }
    }
    for (const [username, entry] of tethers) {
        if (seen.has(username)) continue;
        tetherLayer.removeLayer(entry.line);
        tetherLayer.removeLayer(entry.label);
        tethers.delete(username);
    }
}

positionListeners.add(redrawTethers);

/**
 * Show or hide one overlay's row. Used for overlays that only mean something
 * once the player is in a game with a role.
 */
function setOverlayAvailable(key, available) {
    const overlay = OVERLAYS[key];
    if (!overlay) return;
    const wasAvailable = overlay.available;
    overlay.available = available;
    if (!available) {
        setOverlayEnabled(key, false);
    } else if (overlay.alwaysOn) {
        setOverlayEnabled(key, true);
        // Just joined a team: show them the campus the game is played on.
        if (!wasAvailable) revealCampus();
    }
    const entry = overlayRows[key];
    if (entry) {
        entry.row.hidden = !available;
        entry.checkbox.checked = overlay.enabled;
    }
}

// Public surface used by app.js
window.HNSMap = {
    map,
    setUserPins,
    setOverlayAvailable,
    /** The card deck, so campus popups can name the questions that use them. */
    setCardCatalog(catalog) {
        cardCatalog = catalog;
    },
    setAskOverlays,
    groupColor,
    getPosition: () => lastKnownPosition,
    /** How old the last GPS fix is, in ms; null without one. */
    getFixAgeMs: fixAgeMs,
    getLocationProblem: () => locationProblem,
    getLocationPermission: () => locationPermission,
    requestLocation,
    /** Degrees clockwise from north, and where it came from; null if unknown. */
    getHeading: () =>
        compassHeading !== null
            ? { degrees: compassHeading, source: "compass" }
            : gpsHeading !== null
              ? { degrees: gpsHeading, source: "gps" }
              : null,
    getCompassState: () => compassState,
    enableCompass,
    revealCampus,
    toast: showToast,
    onPosition(fn) {
        positionListeners.add(fn);
        return () => positionListeners.delete(fn);
    },
    invalidateSize: () => map.invalidateSize(),
};
