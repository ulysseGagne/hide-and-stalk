/* global turf, Ink */

// The real campus, drawn as a plain black-and-white plan: the loop road
// (campus border), the pavilions, the six landmarks. Everything comes from
// src/locations.js (itself generated from locations/geojson), so the boards
// show the actual play area, not an illustration of one.
//
// Eliminations are real too: a scenario is a hider's position plus the
// questions asked, each answered truthfully, folded with turf exactly the way
// src/hints.js folds them in the app.

(function () {
    const layers = window.HNSLocations?.layers ?? [];
    const byKey = Object.fromEntries(layers.map((l) => [l.key, l]));
    const RING = byKey.campus.ring; // [lng, lat]
    const area = turf.polygon([RING]);
    const [minX, minY, maxX, maxY] = turf.bbox(area);
    const KX = Math.cos((((minY + maxY) / 2) * Math.PI) / 180);

    const place = (layer, id) => byKey[layer].places.find((p) => p.id === id);

    /** A projection that fits the campus into w x h (north up). */
    function projector(w, h, pad = 10, zoom = 1, center = null) {
        const spanX = (maxX - minX) * KX;
        const spanY = maxY - minY;
        const k = Math.min((w - pad * 2) / spanX, (h - pad * 2) / spanY) * zoom;
        const cx = center ? center[0] : (minX + maxX) / 2;
        const cy = center ? center[1] : (minY + maxY) / 2;
        return ([lng, lat]) => [w / 2 + (lng - cx) * KX * k, h / 2 - (lat - cy) * k];
    }

    const pathD = (ring, P) => ring.map((pt, i) => `${i ? "L" : "M"}${P(pt)[0].toFixed(1)} ${P(pt)[1].toFixed(1)}`).join(" ") + "Z";

    function geomD(geom, P) {
        const polys = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];
        return polys.map((poly) => poly.map((ring) => pathD(ring, P)).join(" ")).join(" ");
    }

    // ---------------------------------------------------------------------
    // Constraints (same maths as src/hints.js)
    // ---------------------------------------------------------------------
    const PAD = 0.05;
    const box = [minX - PAD, minY - PAD, maxX + PAD, maxY + PAD];
    const circle = (lng, lat, m) => turf.circle([lng, lat], m, { units: "meters", steps: 96 });

    function voronoiCell(layerKey, id) {
        const pts = byKey[layerKey].places;
        const fwd = ([x, y]) => [x * KX, y];
        const inv = ([x, y]) => [x / KX, y];
        const cells = turf.voronoi(turf.featureCollection(pts.map((p) => turf.point(fwd([p.lng, p.lat])))), { bbox: [box[0] * KX, box[1], box[2] * KX, box[3]] });
        const i = pts.findIndex((p) => p.id === id);
        const cell = cells.features[i];
        return turf.polygon(cell.geometry.coordinates.map((r) => r.map(inv)));
    }

    const dist = (a, b) => turf.distance(turf.point(a), turf.point(b), { units: "meters" });

    /**
     * Answer each question truthfully for a hider at `hider` ([lng, lat]) and
     * fold the answers into the play area.
     * question kinds: {ns, at}, {ew, at}, {radius, m, at}, {nearest: layer},
     * {closer: landmarkId, at}
     */
    function solve(hider, questions) {
        let region = area;
        const answered = [];
        for (const q of questions) {
            let shape;
            let keep = true;
            let answer;
            if (q.ns) {
                const south = hider[1] < q.at[1];
                answer = south ? "SOUTH" : "NORTH";
                shape = south ? turf.bboxPolygon([box[0], box[1], box[2], q.at[1]]) : turf.bboxPolygon([box[0], q.at[1], box[2], box[3]]);
            } else if (q.ew) {
                const east = hider[0] > q.at[0];
                answer = east ? "EAST" : "WEST";
                shape = east ? turf.bboxPolygon([q.at[0], box[1], box[2], box[3]]) : turf.bboxPolygon([box[0], box[1], q.at[0], box[3]]);
            } else if (q.radius) {
                const inside = dist(hider, q.at) <= q.radius;
                answer = inside ? "YES" : "NO";
                shape = circle(q.at[0], q.at[1], q.radius);
                keep = inside;
            } else if (q.nearest) {
                const pts = byKey[q.nearest].places;
                let best = pts[0];
                for (const p of pts) if (dist(hider, [p.lng, p.lat]) < dist(hider, [best.lng, best.lat])) best = p;
                answer = best.label;
                shape = voronoiCell(q.nearest, best.id);
            } else if (q.closer) {
                const lm = place("landmarks", q.closer);
                const r = dist([lm.lng, lm.lat], q.at);
                const closer = dist(hider, [lm.lng, lm.lat]) < r;
                answer = closer ? "YES" : "NO";
                shape = circle(lm.lng, lm.lat, r);
                keep = closer;
            }
            const next = keep ? turf.intersect(turf.featureCollection([region, shape])) : turf.difference(turf.featureCollection([region, shape]));
            if (next) region = next;
            answered.push({ ...q, answer, shape });
        }
        const excluded = turf.difference(turf.featureCollection([area, region]));
        return { region, excluded, answered };
    }

    // ---------------------------------------------------------------------
    // Drawing
    // ---------------------------------------------------------------------
    let clipSerial = 0;

    /**
     * The campus plan as SVG markup in a w x h box.
     * o: { pad, zoom, center, labels: true, pavilions: true, border: "plain"|"ink",
     *      scenario: result of solve(), hatch: "red"|"black"|"whiteout"|"redact",
     *      invert: false, stroke }
     */
    function map(w, h, o = {}) {
        const P = projector(w, h, o.pad ?? 12, o.zoom ?? 1, o.center);
        const ink = o.invert ? "#fff" : "#000";
        const paper = o.invert ? "#000" : "#fff";
        const id = `cm${++clipSerial}`;
        let s = `<defs><clipPath id="${id}"><rect x="0" y="0" width="${w}" height="${h}"/></clipPath></defs><g clip-path="url(#${id})">`;
        s += `<rect width="${w}" height="${h}" fill="${paper}"/>`;
        // The loop road: a double line, like a printed plan.
        s += `<path d="${pathD(RING, P)}" fill="none" stroke="${ink}" stroke-width="${o.stroke ?? 2.2}" stroke-linejoin="round"/>`;
        if (o.roads !== false) s += `<path d="${pathD(RING, P)}" fill="none" stroke="${ink}" stroke-width="0.8" stroke-dasharray="1 5" transform="translate(0 0)" opacity="1"/>`;
        if (o.pavilions !== false) {
            for (const p of byKey.building.places) {
                const [x, y] = P([p.lng, p.lat]);
                const sz = (o.zoom ?? 1) * 5.5;
                s += `<rect x="${(x - sz / 2).toFixed(1)}" y="${(y - sz / 2).toFixed(1)}" width="${sz.toFixed(1)}" height="${sz.toFixed(1)}" fill="${ink}"/>`;
            }
        }
        if (o.stops) {
            for (const p of byKey.bus_stop.places) {
                const [x, y] = P([p.lng, p.lat]);
                s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.8" fill="none" stroke="${ink}" stroke-width="1"/>`;
            }
        }
        // Scenario: hatch out where the hider can't be, outline where they can.
        const sc = o.scenario;
        if (sc) {
            const exD = sc.excluded ? geomD(sc.excluded.geometry, P) : "";
            const hid = `${id}x`;
            if (exD) {
                s += `<defs><clipPath id="${hid}"><path d="${exD}" clip-rule="evenodd"/></clipPath></defs>`;
                const hatch = o.hatch ?? "red";
                if (hatch === "whiteout") s += `<path d="${exD}" fill="${paper}" fill-rule="evenodd"/>`;
                else if (hatch === "redact") s += `<path d="${exD}" fill="#000" fill-rule="evenodd"/>`;
                else {
                    const color = hatch === "black" ? ink : Ink.RED;
                    s += `<g clip-path="url(#${hid})">${Ink.scribbleFill(0, 0, w, h, { seed: `${id}h`, weight: o.hatchWeight ?? 2.4, gap: o.hatchGap ?? 7, angle: -32, color, misses: 0 })}</g>`;
                }
            }
            if (sc.region) {
                const polys = sc.region.geometry.type === "Polygon" ? [sc.region.geometry.coordinates] : sc.region.geometry.coordinates;
                for (const poly of polys) {
                    s += Ink.wobble(poly[0].map(P), { seed: `${id}r`, weight: o.regionWeight ?? 3.2, amp: 1.6 });
                }
            }
        }
        if (o.labels !== false) {
            for (const p of byKey.landmarks.places) {
                const [x, y] = P([p.lng, p.lat]);
                s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="${ink}"/>`;
                s += `<text x="${(x + 6).toFixed(1)}" y="${(y + 3.5).toFixed(1)}" font-family="Arimo, Helvetica, sans-serif" font-weight="700" font-size="${o.labelSize ?? 8.5}" fill="${ink}" letter-spacing="0.02em">${p.label.toUpperCase()}</text>`;
            }
        }
        s += "</g>";
        return { svg: s, P };
    }

    // A few games, ready to pin up. Positions are real campus spots.
    const at = (layer, id) => {
        const p = place(layer, id);
        return [p.lng, p.lat];
    };
    const SCENARIOS = {
        // Hider tucked near the greenhouses; stalkers start at Pollack.
        greenhouses: () =>
            solve([-71.2789, 46.7806], [
                { ns: true, at: at("building", "pav_pol") },
                { radius: 500, at: at("building", "pav_pol") },
                { nearest: "cafe" },
                { closer: "greenhouses", at: at("building", "pav_vch") },
            ]),
        // Hider near Pub U, south-east corner.
        pubu: () =>
            solve([-71.2702, 46.7792], [
                { ew: true, at: at("building", "pav_dkn") },
                { ns: true, at: at("building", "pav_dkn") },
                { radius: 300, at: at("landmarks", "twin_towers") },
            ]),
    };

    window.Campus = {
        map,
        solve,
        projector,
        scenario: (name) => SCENARIOS[name](),
        at,
        place,
        layers: byKey,
    };
})();
