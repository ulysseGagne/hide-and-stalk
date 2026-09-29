/* global qrcode, jsQR */

// How a round ends: the hider's QR code, the stalker's scanner, and the "Hider
// has been found" button for when the camera won't cooperate. The result itself
// is shown by the status card at the top of the home screen (app.js).
//
// The server owns the verdict. This file only draws the code, decodes one, and
// posts it to /catch — every rule about who may catch whom lives in the worker.

// Redraw the QR only when the code actually changes; regenerating it every poll
// would flicker the SVG under the hider's thumb.
let renderedCode = null;

// Scanning at full sensor resolution is wasted work on a phone. jsQR reads a
// code comfortably at this width, and the smaller frame keeps the loop smooth.
const SCAN_WIDTH = 480;
// Re-scanning the same rejected code 30 times a second would bury the real
// error message under its own repeats.
const RESCAN_PAUSE_MS = 2500;

let endgameApi = null;
let onCaught = () => {};

// Live scanner plumbing, all torn down on close.
let stream = null;
let scanFrame = null;
let scanning = false;
let submitting = false;
let lastRejected = null; // { code, at } so a bad code isn't retried instantly
let canvas = null;
let ctx2d = null;

const endgameEl = {};
function cacheEndgameElements() {
    endgameEl.scanBtn = document.getElementById("scan-btn");
    endgameEl.qr = document.getElementById("hider-qr");
    endgameEl.qrFigure = document.getElementById("hider-qr-figure");
    endgameEl.qrCode = document.getElementById("hider-qr-code");
    endgameEl.modal = document.getElementById("scan-modal");
    endgameEl.close = document.getElementById("scan-close");
    endgameEl.video = document.getElementById("scan-video");
    endgameEl.stage = endgameEl.modal.querySelector(".scan-stage");
    endgameEl.status = document.getElementById("scan-status");
    endgameEl.error = document.getElementById("scan-error");
    endgameEl.fallback = document.getElementById("scan-fallback");
    endgameEl.fileInput = endgameEl.fallback.querySelector("input");
    endgameEl.foundPanel = document.getElementById("found-panel");
    endgameEl.foundBtn = document.getElementById("found-btn");
    endgameEl.foundError = document.getElementById("found-error");
}

// ---------------------------------------------------------------------------
// Ending the hunt by hand
// ---------------------------------------------------------------------------
// Same ending as a scan, for when the camera will not play along. It ends the
// presser's own round, so it asks twice before it does.
const FOUND_CONFIRM_MS = 5000;
const FOUND_LABEL = "Hider has been found";
let foundConfirmTimer = null;
let foundBusy = false;

function resetFoundButton() {
    clearTimeout(foundConfirmTimer);
    foundConfirmTimer = null;
    delete endgameEl.foundBtn.dataset.confirm;
    endgameEl.foundBtn.textContent = FOUND_LABEL;
}

async function foundClicked() {
    if (foundBusy) return;
    endgameEl.foundError.textContent = "";
    if (!endgameEl.foundBtn.dataset.confirm) {
        endgameEl.foundBtn.dataset.confirm = "1";
        endgameEl.foundBtn.textContent = "Tap again to end the hunt";
        foundConfirmTimer = setTimeout(resetFoundButton, FOUND_CONFIRM_MS);
        return;
    }
    foundBusy = true;
    clearTimeout(foundConfirmTimer);
    endgameEl.foundBtn.disabled = true;
    endgameEl.foundBtn.textContent = "Ending the hunt...";
    try {
        await endgameApi("/found", { method: "POST" });
        onCaught();
    } catch (err) {
        endgameEl.foundError.textContent =
            err.status === undefined ? "Could not reach the server" : err.message;
    } finally {
        foundBusy = false;
        endgameEl.foundBtn.disabled = false;
        resetFoundButton();
    }
}

// ---------------------------------------------------------------------------
// The hider's code
// ---------------------------------------------------------------------------
function renderHiderQr(me) {
    const code = me?.role === "hider" ? (me.catchCode ?? null) : null;
    endgameEl.qr.hidden = !code;
    if (!code) {
        renderedCode = null;
        endgameEl.qrFigure.innerHTML = "";
        return;
    }
    if (code === renderedCode) return;
    renderedCode = code;
    endgameEl.qrCode.textContent = code;
    // Type 0 = pick the smallest version that fits; "M" survives a phone
    // screen's glare and a bit of a fingerprint.
    const qr = qrcode(0, "M");
    qr.addData(code);
    qr.make();
    endgameEl.qrFigure.innerHTML = qr.createSvgTag({
        cellSize: 8,
        margin: 8,
        alt: "Your tag code",
    });
}

// ---------------------------------------------------------------------------
// The stalker's scanner
// ---------------------------------------------------------------------------
/** Stalkers get the camera button, but only while the hunt is on. */
function canScan(payload) {
    const me = payload?.me;
    return Boolean(
        me && !me.isAdmin && me.role === "stalker" && payload.team?.phase === "hunting",
    );
}

function setScanStatus(text) {
    endgameEl.status.textContent = text;
}

function setScanError(message) {
    endgameEl.error.textContent = message ?? "";
}

async function openScanner() {
    endgameEl.modal.hidden = false;
    setScanError(null);
    endgameEl.fallback.hidden = true;
    endgameEl.stage.hidden = false;
    lastRejected = null;
    setScanStatus("Starting the camera…");

    if (!navigator.mediaDevices?.getUserMedia) {
        showFallback("This browser won't open a live camera.");
        return;
    }
    try {
        // The rear camera is the one pointed at the person you just caught.
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
        });
    } catch (err) {
        // Denied, already in use, or blocked because the page isn't https.
        showFallback(
            err?.name === "NotAllowedError"
                ? "Camera permission was refused."
                : "The camera could not be opened.",
        );
        return;
    }
    endgameEl.video.srcObject = stream;
    try {
        await endgameEl.video.play();
    } catch {
        /* autoplay policies; the frame loop copes with a paused video */
    }
    setScanStatus("Point the camera at your hider's code.");
    scanning = true;
    scanFrame = requestAnimationFrame(tickScan);
}

function showFallback(reason) {
    stopCamera();
    setScanStatus(reason);
    // Nothing will ever appear in the viewfinder, so take it away.
    endgameEl.stage.hidden = true;
    endgameEl.fallback.hidden = false;
}

function stopCamera() {
    scanning = false;
    if (scanFrame !== null) cancelAnimationFrame(scanFrame);
    scanFrame = null;
    for (const track of stream?.getTracks() ?? []) track.stop();
    stream = null;
    endgameEl.video.srcObject = null;
}

function closeScanner() {
    stopCamera();
    endgameEl.modal.hidden = true;
    endgameEl.fileInput.value = "";
}

function ensureCanvas() {
    if (!canvas) {
        canvas = document.createElement("canvas");
        // Reading back pixels every frame is the whole point of this canvas.
        ctx2d = canvas.getContext("2d", { willReadFrequently: true });
    }
    return ctx2d;
}

/** Decode whatever is currently on screen; returns the QR text or null. */
function decodeFrom(source, width, height) {
    if (!width || !height) return null;
    const scale = Math.min(1, SCAN_WIDTH / width);
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const ctx = ensureCanvas();
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(source, 0, 0, w, h);
    const image = ctx.getImageData(0, 0, w, h);
    // "attemptBoth" also reads a code shown on another phone's screen, which
    // is inverted compared to ink on paper.
    const result = jsQR(image.data, w, h, { inversionAttempts: "attemptBoth" });
    return result?.data ?? null;
}

function tickScan() {
    if (!scanning) return;
    scanFrame = requestAnimationFrame(tickScan);
    if (submitting || endgameEl.video.readyState < 2) return;
    let code;
    try {
        code = decodeFrom(endgameEl.video, endgameEl.video.videoWidth, endgameEl.video.videoHeight);
    } catch {
        return; // a frame we couldn't read; the next one will be fine
    }
    if (!code) return;
    // Hold off on a code the server has already turned down, or the error text
    // would be rewritten faster than it can be read.
    if (
        lastRejected &&
        lastRejected.code === code &&
        Date.now() - lastRejected.at < RESCAN_PAUSE_MS
    ) {
        return;
    }
    submitCode(code);
}

async function onPhotoPicked() {
    const file = endgameEl.fileInput.files?.[0];
    if (!file) return;
    setScanError(null);
    setScanStatus("Reading the photo…");
    let code = null;
    try {
        const bitmap = await createImageBitmap(file);
        code = decodeFrom(bitmap, bitmap.width, bitmap.height);
        bitmap.close?.();
    } catch {
        /* unreadable file */
    }
    endgameEl.fileInput.value = "";
    if (!code) {
        setScanStatus("No code in that photo — get closer and try again.");
        return;
    }
    await submitCode(code);
}

async function submitCode(code) {
    if (submitting) return;
    submitting = true;
    setScanError(null);
    setScanStatus("Checking that code…");
    try {
        const result = await endgameApi("/catch", {
            method: "POST",
            body: { code },
        });
        stopCamera();
        setScanStatus(`Caught ${result.caught.hiderName}!`);
        endgameEl.fallback.hidden = true;
        onCaught();
        // Leave the confirmation up long enough to be read, then get out of
        // the way of the result underneath.
        setTimeout(closeScanner, 1800);
    } catch (err) {
        lastRejected = { code, at: Date.now() };
        setScanStatus("Point the camera at your hider's code.");
        setScanError(
            err.status === undefined ? "Could not reach the server" : err.message,
        );
    } finally {
        submitting = false;
    }
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------
window.HNSEndgame = {
    init(options) {
        endgameApi = options.api;
        onCaught = options.onCaught ?? (() => {});
        cacheEndgameElements();
        endgameEl.scanBtn.addEventListener("click", openScanner);
        endgameEl.close.addEventListener("click", closeScanner);
        endgameEl.modal.addEventListener("click", (e) => {
            if (e.target === endgameEl.modal) closeScanner();
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && !endgameEl.modal.hidden) closeScanner();
        });
        endgameEl.fileInput.addEventListener("change", onPhotoPicked);
        endgameEl.foundBtn.addEventListener("click", foundClicked);
        // A camera left running in a backgrounded tab is a battery leak and,
        // on some phones, a permanently lit indicator light.
        document.addEventListener("visibilitychange", () => {
            if (document.hidden && !endgameEl.modal.hidden) closeScanner();
        });
    },

    /** Called after every /state poll. */
    render(payload) {
        const scannable = canScan(payload);
        endgameEl.scanBtn.hidden = !scannable;
        // Same test as the camera button: a stalker with someone left to catch.
        endgameEl.foundPanel.hidden = !scannable;
        if (!scannable) resetFoundButton();
        endgameEl.scanBtn.title = "Scan your hider's code";
        // Caught mid-scan, or the clock ran out while the camera was up.
        if (!scannable && !endgameEl.modal.hidden && !submitting) closeScanner();
        renderHiderQr(payload?.me);
    },

    reset() {
        renderedCode = null;
        closeScanner();
        resetFoundButton();
        endgameEl.foundPanel.hidden = true;
        endgameEl.scanBtn.hidden = true;
        endgameEl.qr.hidden = true;
        endgameEl.qrFigure.innerHTML = "";
    },
};
