/* global Ink */

// Set R: arrow options for the one thing that must never be missed, a new
// notification. Each is drawn on the same header (the app's, in direction E),
// pointing at the bell from low on the screen, with NEW at its tail.

(function () {
    const FONT = "Arimo, 'Helvetica Neue', Helvetica, Arial, sans-serif";
    const W = 375;
    const H = 420;
    const BELL = { x: W - 118 - 40, y: 12, w: 40, h: 40 };
    const bx = BELL.x + BELL.w / 2;
    const by = BELL.y + BELL.h + 6;

    // The header's STALK (the logo's), black: the arrow is the red on this screen.
    function stalk() {
        const st = Ink.tuck("STALK", { size: 74, seed: "w13", mess: 1.15, tilt: -4, sizes: [1.06, 0.94, 1.02, 0.95, 1.0], rises: [0.02, -0.02, 0.03, 0, 0.02], spin: 5, overshoot: 0.05, color: "#000" });
        const k = 27 / st.box.h;
        return `<svg width="120" height="44" style="position:absolute;left:0;top:0;overflow:visible"><g transform="translate(${83 - st.box.x * k} ${43 - (st.box.y + st.box.h) * k}) scale(${k})">${st.svg}</g></svg>`;
    }

    function header() {
        return `<div style="position:absolute;left:0;top:0;width:${W}px;height:104px;border-bottom:3px solid #000;box-sizing:border-box;background:#fff">
            <div style="position:absolute;left:12px;top:16px;font:700 19px ${FONT}">HIDE &amp;</div>${stalk()}
            <div style="position:absolute;left:${BELL.x}px;top:${BELL.y}px;width:40px;height:40px;box-sizing:border-box;border:3px solid #000;display:flex;align-items:center;justify-content:center">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#000" stroke-width="2.5"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                <div style="position:absolute;top:-8px;right:-8px;width:18px;height:18px;background:#000;color:#fff;font:700 11px/18px ${FONT};text-align:center">1</div></div>
            <div style="position:absolute;right:12px;top:12px;height:40px;box-sizing:border-box;border:3px solid #000;padding:0 12px;font:700 15px/34px ${FONT}">Log out</div>
            <div style="position:absolute;left:12px;bottom:-3px;display:flex;gap:6px;align-items:flex-end">
                <div style="width:124px;height:46px;box-sizing:border-box;border:3px solid #000;border-bottom:none;background:#fff;font:700 17px/43px ${FONT};letter-spacing:.12em;text-align:center">MENU</div>
                <div style="width:124px;height:40px;box-sizing:border-box;border:3px solid #000;background:#000;color:#fff;font:700 17px/37px ${FONT};letter-spacing:.12em;text-align:center;margin-bottom:3px">MAP</div></div>
        </div>
        <div style="position:absolute;left:18px;top:128px;font:700 36px ${FONT};letter-spacing:-.02em">Question 1 of 6</div>
        <div style="position:absolute;left:18px;top:172px;font:700 112px/1 ${FONT};letter-spacing:-.04em">04:31</div>`;
    }

    const T = [60, 330]; // tail, low on the screen
    const V = [
        ["Long curve, one flick, sharp point", () => Ink.bigArrow(T[0], T[1], bx - 12, by + 8, { seed: "r1", weight: 7, bend: -0.22 })],
        ["Straighter and heavier", () => Ink.bigArrow(T[0] + 30, T[1], bx - 10, by + 8, { seed: "r2", weight: 9, bend: -0.06, headRatio: 0.12 })],
        ["Coloured-in head", () => Ink.bigArrow(T[0], T[1], bx - 12, by + 8, { seed: "r3", weight: 7, bend: -0.2, head: "filled" })],
        ["Open head, long sides", () => Ink.bigArrow(T[0], T[1], bx - 12, by + 8, { seed: "r4", weight: 7, bend: -0.25, head: "open", headRatio: 0.17, spread: 0.6 })],
        ["Double shaft", () => Ink.bigArrow(T[0], T[1], bx - 12, by + 8, { seed: "r5", weight: 5, bend: -0.18, shaft: "double" })],
        ["Curl at the tail", () => Ink.bigArrow(T[0] + 20, T[1], bx - 12, by + 8, { seed: "r6", weight: 7, bend: -0.22, loop: true })],
        ["Dashed shaft", () => Ink.bigArrow(T[0], T[1], bx - 12, by + 8, { seed: "r7", weight: 6, bend: -0.22, shaft: "dashed" })],
        ["From the other side", () => Ink.bigArrow(W - 40, T[1], bx + 10, by + 10, { seed: "r8", weight: 7, bend: 0.2 })],
    ];

    // Second round: short and wide (R2's straightness, R1's head, bigger),
    // NEW beside the arrow in big heavy letters, never at its tail.
    const tip = [bx - 6, by + 6];
    const from = (dx, dy) => [tip[0] + dx, tip[1] + dy];
    const S = [
        ["Short, from below left", from(-78, 96), { weight: 13 }, [-22, 98]],
        ["Straight up from below", from(-6, 112), { weight: 14 }, [20, 96]],
        ["Wider head", from(-80, 92), { weight: 13, spread: 0.78 }, [14, 84]],
        ["Heaviest, shortest", from(-62, 78), { weight: 17 }, [14, 76]],
        ["From below right", from(56, 100), { weight: 14 }, [-150, 110]],
        ["A bit longer, same width", from(-100, 132), { weight: 14, head: 58 }, [16, 96]],
    ];
    S.forEach(([name, t, o, nw], i) => {
        V.push([name, () => Ink.stubArrow(t[0], t[1], tip[0], tip[1], { seed: `s${i}`, ...o }), [tip[0] + nw[0], tip[1] + nw[1]]]);
    });

    // Third round: nudges on the kept ones (same seeds, so the same strokes).
    const shift = ([x, y], dx, dy) => [x + dx, y + dy];
    const EXTRA = {
        // R09, NEW lower and to the right, clear of the arrow.
        "9.1": () => Ink.stubArrow(...from(-78, 96), ...tip, { seed: "s0", weight: 13 }) + Ink.write("NEW", { x: tip[0] - 4, y: tip[1] + 122, size: 44, weight: 9, seed: "new9.1", tilt: -8, importance: "key" }).svg,
        // R11 and R12, the whole arrow a bit to the left and higher.
        "11.1": () => Ink.stubArrow(...shift(from(-80, 92), -10, -8), ...shift(tip, -10, -8), { seed: "s2", weight: 13, spread: 0.78 }) + Ink.write("NEW", { x: tip[0] + 4, y: tip[1] + 76, size: 44, weight: 9, seed: "new11.1", tilt: -8, importance: "key" }).svg,
        "12.1": () => Ink.stubArrow(...shift(from(-62, 78), -10, -8), ...shift(tip, -10, -8), { seed: "s3", weight: 17 }) + Ink.write("NEW", { x: tip[0] + 4, y: tip[1] + 68, size: 44, weight: 9, seed: "new12.1", tilt: -8, importance: "key" }).svg,
    };

    window.Arrows = {
        list: V.map(([name], i) => ({ n: i + 1, name })),
        draw(root, v) {
            root.style.cssText += `;width:${W}px;height:${H}px;background:#fff`;
            if (EXTRA[v]) {
                root.innerHTML = header() + `<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0;overflow:visible;z-index:5">${EXTRA[v]()}</svg>`;
                return;
            }
            const [, fn, beside] = V[v - 1];
            const tail = beside ?? (v === 8 ? [W - 118, T[1] + 38] : [T[0] - 20, T[1] + 44]);
            const nw = beside ? Ink.write("NEW", { x: tail[0], y: tail[1], size: 44, weight: 9, seed: `new${v}`, tilt: -8, importance: "key" }) : Ink.write("NEW", { x: tail[0], y: tail[1], size: 32, seed: `new${v}`, tilt: -8, importance: "key" });
            root.innerHTML = header() + `<svg width="${W}" height="${H}" style="position:absolute;left:0;top:0;overflow:visible;z-index:5">${fn()}${nw.svg}</svg>`;
        },
    };
})();
