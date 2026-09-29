/* global Ink, Logo, Board */

// Set W, second pass (W13-W24), from the notes on W1-W12:
//
//  - the lockup is drawn by the same code, same seeds, same size as set L,
//    so the welcome screen is a pixel-for-pixel copy of the chosen title;
//  - the only red on the screen is the title's (and, on some, one small
//    hand-drawn arrow at the button);
//  - the button is typeset, not drawn: white with a black edge, black label,
//    discreet next to the title; "LET ME IN" first, then "I'M IN", "ENTER";
//  - no description text;
//  - drawn ink is always the top layer; nothing typeset sits over it;
//  - with an illustration, it's drawn zoomed in, so its borders and strokes
//    are as heavy as the button's and the title's;
//  - dark mode is the same screen with black and white swapped.

(function () {
    const FONT = "Arimo, 'Helvetica Neue', Helvetica, Arial, sans-serif";
    const NS = "http://www.w3.org/2000/svg";
    const W = 375;
    const H = 812;
    const BTN = { x: 24, w: W - 48, h: 58, y: H - 34 - 58 - 18 };

    // An illustrated screen shows the same lockup, uniformly scaled: still an
    // exact copy of set L, just smaller.
    function lockup(root, v, { top = 40, dark, k = 1 }) {
        const svg = document.createElementNS(NS, "svg");
        svg.setAttribute("width", W);
        svg.setAttribute("height", 520);
        svg.style.cssText = `position:absolute;left:0;top:${top}px;overflow:visible;z-index:30;transform:scale(${k});transform-origin:26px 0`;
        root.appendChild(svg);
        Logo.draw(svg, v, W, 520, { dark });
        const b = svg.getBBox();
        return { bottom: top + (b.y + b.height) * k };
    }

    function button(root, label, { dark }) {
        const ink = dark ? "#fff" : "#000";
        const paper = dark ? "#000" : "#fff";
        const d = document.createElement("div");
        d.style.cssText = `position:absolute;left:${BTN.x}px;top:${BTN.y}px;width:${BTN.w}px;height:${BTN.h}px;box-sizing:border-box;border:3px solid ${ink};background:${paper};color:${ink};font:700 17px/${BTN.h - 6}px ${FONT};letter-spacing:.12em;text-align:center;z-index:10`;
        d.textContent = label;
        root.appendChild(d);
    }

    /** The one extra red thing allowed: a small arrow at the button. */
    function arrow(root, side, seed) {
        const svg = document.createElementNS(NS, "svg");
        svg.setAttribute("width", W);
        svg.setAttribute("height", H);
        svg.style.cssText = "position:absolute;left:0;top:0;overflow:visible;z-index:40;pointer-events:none";
        const y = BTN.y;
        svg.innerHTML =
            side === "left"
                ? Ink.handArrow(46, y - 96, 92, y - 12, { seed, weight: 4, bend: -0.12, head: 16 })
                : Ink.handArrow(W - 48, y - 100, W - 100, y - 12, { seed, weight: 4, bend: 0.12, head: 16 });
        root.appendChild(svg);
    }

    async function scene(root, key, { top, dark, k = 1.4 }) {
        const sw = Board.SCENE.w;
        const sh = Board.SCENE.h;
        const box = document.createElement("div");
        box.style.cssText = `position:absolute;left:${(W - sw * k) / 2}px;top:${top}px;width:${sw}px;height:${sh}px;transform:scale(${k});transform-origin:0 0;z-index:20`;
        root.appendChild(box);
        await Board.draw(box, key, sw, sh, dark ? { surface: "black" } : undefined);
        box.style.background = "transparent";
    }

    function screen({ logo, label = "LET ME IN", arrowSide = null, illo = null, dark = false }) {
        return async (root) => {
            root.style.background = dark ? "#000" : "#fff";
            const l = lockup(root, logo, { dark, k: illo ? 0.8 : 1 });
            if (illo) {
                // Between the title and the button, never touching either.
                const k = 1.3;
                const top = Math.min(l.bottom + 14, BTN.y - 16 - Board.SCENE.h * k);
                await scene(root, illo, { top, dark, k });
            }
            button(root, label, { dark });
            if (arrowSide) arrow(root, arrowSide, `wa${logo}${arrowSide}`);
        };
    }

    const SCREENS = {
        13: { logo: "1.1", label: "LET ME IN", name: "L1.1, a plain button" },
        14: { logo: "1.1", label: "LET ME IN", arrowSide: "left", name: "L1.1, plain button, one small red arrow" },
        15: { logo: "1.5", label: "LET ME IN", arrowSide: "right", name: "L1.5 (tucked), arrow from the right" },
        16: { logo: "1.3", label: "I'M IN", name: "L1.3 (L8's STALK), I'M IN" },
        17: { logo: "7.4", label: "LET ME IN", arrowSide: "left", name: "L7.4 (one-width block), arrow" },
        18: { logo: "2.1", label: "ENTER", name: "L2.1 (& SEEK), ENTER" },
        19: { logo: "1.5", label: "LET ME IN", illo: "w1", name: "With a scene: card and photo, drawn heavy" },
        20: { logo: "1.1", label: "LET ME IN", illo: "w2", name: "With a scene: the map scrap and a card" },
        21: { logo: "1.5", label: "LET ME IN", illo: "w3", name: "With a scene: the face and a post-it" },
        22: { logo: "1.1", label: "LET ME IN", arrowSide: "left", dark: true, name: "Dark mode of W14" },
        23: { logo: "1.5", label: "LET ME IN", arrowSide: "right", dark: true, name: "Dark mode of W15" },
        24: { logo: "1.5", label: "LET ME IN", illo: "w1", dark: true, name: "Dark mode of W19" },
    };
    for (const [n, spec] of Object.entries(SCREENS)) Welcome.extra[n] = screen(spec);
    Welcome.second = SCREENS;
})();
