/* global HNSMap, HNSCards, HNSEndgame, HNSAdmin */

const CONFIG = window.HNS_CONFIG;
const TOKEN_KEY = "hns.token";
const COMPASS_DISMISSED_KEY = "hns.compass.dismissed";

// ---------------------------------------------------------------------------
// View tabs (MENU / MAP)
// ---------------------------------------------------------------------------
const tabs = document.querySelectorAll(".view-tab");
const views = {
    menu: document.getElementById("view-menu"),
    map: document.getElementById("view-map"),
};

function showView(name) {
    for (const [key, el] of Object.entries(views)) {
        el.hidden = key !== name;
    }
    for (const tab of tabs) {
        const active = tab.dataset.view === name;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
    }
    if (name === "map") setTimeout(() => HNSMap.invalidateSize(), 0);
}

for (const tab of tabs) {
    tab.addEventListener("click", () => showView(tab.dataset.view));
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------
let token = localStorage.getItem(TOKEN_KEY);
let currentUser = null;

async function api(path, { method = "GET", body, timeoutMs } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;
    // On a dead connection a request can hang instead of failing; aborting it
    // turns that into a network error (no `status`) like any other.
    const controller = timeoutMs ? new AbortController() : null;
    const timer = controller && setTimeout(() => controller.abort(), timeoutMs);
    let res;
    let data = null;
    try {
        res = await fetch(`${CONFIG.apiBase}${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: controller?.signal,
        });
        try {
            data = await res.json();
        } catch (err) {
            if (err.name === "AbortError") throw err;
            /* non-JSON body */
        }
    } finally {
        clearTimeout(timer);
    }
    if (!res.ok) {
        const err = new Error(data?.error ?? `HTTP ${res.status}`);
        err.status = res.status;
        throw err;
    }
    return data;
}

const errorText = (err) => (err.status === undefined ? "Could not reach the server" : err.message);

// ---------------------------------------------------------------------------
// Auth UI
// ---------------------------------------------------------------------------
const menuPanel = document.querySelector("#view-menu .menu-panel");
const authPanel = document.getElementById("auth-panel");
const playerPanel = document.getElementById("player-panel");
const adminPanel = document.getElementById("admin-panel");
const loggedInName = document.getElementById("logged-in-name");
const locationStatus = document.getElementById("location-status");
const authForm = document.getElementById("auth-form");
const authSubmit = document.getElementById("auth-submit");
const authError = document.getElementById("auth-error");
const authSwitchBtns = document.querySelectorAll(".auth-switch-btn");
const userStatus = document.getElementById("user-status");
const userStatusName = document.getElementById("user-status-name");
const logoutBtn = document.getElementById("logout-btn");

let authMode = "login";

function setAuthMode(mode) {
    authMode = mode;
    for (const btn of authSwitchBtns) {
        btn.classList.toggle("active", btn.dataset.mode === mode);
    }
    authSubmit.textContent = mode === "login" ? "Log in" : "Register";
    authForm.password.autocomplete =
        mode === "login" ? "current-password" : "new-password";
    authError.textContent = "";
}

for (const btn of authSwitchBtns) {
    btn.addEventListener("click", () => setAuthMode(btn.dataset.mode));
}

authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    authError.textContent = "";
    authSubmit.disabled = true;
    try {
        const data = await api(`/${authMode}`, {
            method: "POST",
            body: {
                username: authForm.username.value.trim(),
                password: authForm.password.value,
            },
        });
        setSession(data.token, data.user);
        authForm.reset();
    } catch (err) {
        authError.textContent = errorText(err);
    } finally {
        authSubmit.disabled = false;
    }
});

logoutBtn.addEventListener("click", async () => {
    try {
        await api("/logout", { method: "POST" });
    } catch {
        /* ignore — clear locally regardless */
    }
    setSession(null, null);
});

function setSession(newToken, user) {
    token = newToken;
    currentUser = user;
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
    if (!token) {
        gameState = null;
        stopSync();
        HNSCards.reset();
        HNSEndgame.reset();
    }
    renderAuthState();
    if (token) startSync();
}

function renderAuthState() {
    const loggedIn = Boolean(currentUser);
    const isAdmin = Boolean(currentUser?.isAdmin);
    // An admin gets the dashboard instead; the player box would sit empty.
    menuPanel.hidden = isAdmin;
    authPanel.hidden = loggedIn;
    playerPanel.hidden = !loggedIn || isAdmin;
    adminPanel.hidden = !isAdmin;
    userStatus.hidden = !loggedIn;
    if (loggedIn) {
        loggedInName.textContent = currentUser.username;
        userStatusName.textContent = isAdmin
            ? `${currentUser.username} (admin)`
            : currentUser.username;
        renderLocationStatus(HNSMap.getPosition());
    } else {
        HNSMap.setUserPins([], null);
    }
    renderNotices();
    renderHome();
}

function renderLocationStatus(pos) {
    locationStatus.textContent = pos
        ? "Sharing your location with your team."
        : "Location not shared (denied or unavailable).";
}

// ---------------------------------------------------------------------------
// Connection health + notices. Measured from our own background sync
// requests; feeds the red banner here and, through /location, the signal icon
// on the admin board.
// ---------------------------------------------------------------------------
const SYNC_TIMEOUT_MS = 8_000;
// Consecutive sync requests that got no answer before we call it lost.
const FAILURES_BEFORE_OFFLINE = 2;
// A GPS fix older than this gets a notice: the position the team sees is old.
const GPS_STALE_NOTICE_MS = 45_000;
const net = { rttMs: null, failures: 0, lastSyncAt: null };

const offlineNotice = document.getElementById("offline-notice");
const locationNotice = document.getElementById("location-notice");
const locationNoticeText = document.getElementById("location-notice-text");
const locationShareBtn = document.getElementById("location-share-btn");
const compassNotice = document.getElementById("compass-notice");
const compassBtn = document.getElementById("compass-btn");
const compassDismiss = document.getElementById("compass-dismiss");
let requestingLocation = false;

/** api() for the background sync calls: bounded, timed, and tracked. */
async function syncApi(path, options) {
    const started = performance.now();
    try {
        const data = await api(path, { ...options, timeoutMs: SYNC_TIMEOUT_MS });
        recordSyncRequest(performance.now() - started);
        return data;
    } catch (err) {
        // An HTTP error still proves the network works; only a request that
        // never got an answer counts against the connection.
        recordSyncRequest(err.status === undefined ? null : performance.now() - started);
        throw err;
    }
}

function recordSyncRequest(ms) {
    const wasOffline = isOffline();
    if (ms === null) net.failures++;
    else {
        net.failures = 0;
        net.lastSyncAt = performance.now();
    }
    // Smoothed, and a lost request counts as the slowest possible one, so a
    // flaky link reads as weak instead of flickering between good and gone.
    const sample = ms ?? SYNC_TIMEOUT_MS;
    net.rttMs = net.rttMs === null ? sample : 0.5 * net.rttMs + 0.5 * sample;
    if (isOffline() !== wasOffline) renderNotices();
}

function isOffline() {
    return navigator.onLine === false || net.failures >= FAILURES_BEFORE_OFFLINE;
}

window.addEventListener("offline", renderNotices);
window.addEventListener("online", () => {
    renderNotices();
    // Don't wait for the next tick to find out we're back.
    if (token) refreshState();
});

/** Where this player has to go to unblock location, as best we can tell. */
function unblockLocationHelp() {
    const ua = navigator.userAgent;
    // iPadOS claims to be a Mac; the touch screen gives it away.
    const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    if (iOS) {
        const app = /CriOS/.test(ua) ? "Chrome" : /FxiOS/.test(ua) ? "Firefox" : /EdgiOS/.test(ua) ? "Edge" : null;
        if (app) {
            return `Location is blocked. Open Settings → ${app} → Location, choose “While Using the App”, then try again.`;
        }
        return "Location is blocked. In Settings → Privacy & Security → Location Services, set Safari Websites to “While Using the App”. Then in Safari tap aA (page menu) → Website Settings → Location → Allow, and try again.";
    }
    if (/Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua)) {
        return "Location is blocked. Open Safari → Settings → Websites → Location, set this site to Allow, then try again.";
    }
    return "Location is blocked for this site. Allow it in your browser's site settings (the icon next to the address), then try again.";
}

function locationNoticeCopy(problem) {
    if (problem === "stale") {
        return {
            text: "Your GPS position stopped updating, so your team sees an old spot. Trying again…",
            button: "Try again now",
        };
    }
    if (problem === "unsupported") {
        return { text: "This browser can't share your location.", button: null };
    }
    if (problem === "insecure") {
        return {
            text: "Location only works on a secure (https://) page. Open the game from its normal web address.",
            button: null,
        };
    }
    if (problem === "unavailable") {
        return {
            text: "Can't get a GPS fix. Check that location services are on for this browser.",
            button: "Try again",
        };
    }
    // The browser won't show its prompt again until the site is unblocked.
    if (problem === "blocked" || HNSMap.getLocationPermission() === "denied") {
        return { text: unblockLocationHelp(), button: "Try again" };
    }
    return {
        text: "You're not sharing your location, so the game can't place you.",
        button: "Share location",
    };
}

function compassDismissed() {
    try {
        return localStorage.getItem(COMPASS_DISMISSED_KEY) === "1";
    } catch {
        return false;
    }
}

function renderNotices() {
    const loggedIn = Boolean(token && currentUser);
    const player = loggedIn && !currentUser.isAdmin;
    const offline = loggedIn && isOffline();
    const pos = HNSMap.getPosition();
    const age = HNSMap.getFixAgeMs();
    let problem = HNSMap.getLocationProblem();
    // A fix we still hold but that has stopped moving on is a problem too.
    if (pos && age !== null && age > GPS_STALE_NOTICE_MS && !document.hidden) problem = "stale";
    // No notice while the first fix or the browser's own prompt is pending.
    const locationOff = player && problem !== null && (problem === "stale" || !pos);
    const compassOff =
        player && HNSMap.getCompassState() === "needs-permission" && !compassDismissed();

    const changed =
        offlineNotice.hidden === offline ||
        locationNotice.hidden === locationOff ||
        compassNotice.hidden === compassOff;
    offlineNotice.hidden = !offline;
    locationNotice.hidden = !locationOff;
    compassNotice.hidden = !compassOff;
    if (locationOff && !requestingLocation) {
        const copy = locationNoticeCopy(problem);
        locationNoticeText.textContent = copy.text;
        locationShareBtn.hidden = copy.button === null;
        locationShareBtn.textContent = copy.button ?? "";
    }
    // The notices take height from the map, which has to re-measure.
    if (changed) HNSMap.invalidateSize();
}

locationShareBtn.addEventListener("click", async () => {
    requestingLocation = true;
    locationShareBtn.disabled = true;
    locationNoticeText.textContent = "Waiting for your browser…";
    let problem = null;
    try {
        problem = await HNSMap.requestLocation();
    } finally {
        requestingLocation = false;
        locationShareBtn.disabled = false;
        renderNotices();
    }
    if (problem !== null) {
        // A silent refusal takes milliseconds; flash so the press visibly did
        // something even when the text comes back the same.
        locationNotice.classList.remove("notice-flash");
        void locationNotice.offsetWidth; // restart the animation
        locationNotice.classList.add("notice-flash");
    }
});

compassBtn.addEventListener("click", async () => {
    await HNSMap.enableCompass();
    renderNotices();
});
compassDismiss.addEventListener("click", () => {
    try {
        localStorage.setItem(COMPASS_DISMISSED_KEY, "1");
    } catch {
        /* then it just comes back next time */
    }
    renderNotices();
});

// ---------------------------------------------------------------------------
// The home screen: one card that says what to do right now
// ---------------------------------------------------------------------------
const statusCard = document.getElementById("status-card");
const roleBadge = document.getElementById("role-badge");
const statusTitle = document.getElementById("status-title");
const statusTimer = document.getElementById("status-timer");
const statusText = document.getElementById("status-text");
const statusTeam = document.getElementById("status-team");
const teamStartBtn = document.getElementById("team-start-btn");
const teamAgainBtn = document.getElementById("team-again-btn");
const teamError = document.getElementById("team-error");
const discordBtn = document.getElementById("discord-btn");
const rulesCard = document.getElementById("rules-card");
const hiderPanel = document.getElementById("hider-panel");
const stalkerPanel = document.getElementById("stalker-panel");

let gameState = null; // last /state payload
let stateReceivedAt = 0; // performance.now() when gameState arrived
let clockTimer = null;
let rulesPhase = null; // the phase the rules card was last opened/closed for

function formatMs(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const minutes = (ms) => {
    const n = Math.round(ms / 60000);
    return `${n} minute${n === 1 ? "" : "s"}`;
};

/** The team from the last poll, its timers moved on by however long ago that was. */
function liveTeam() {
    const team = gameState?.team;
    if (!team) return null;
    if (team.status !== "playing" || team.paused) return team;
    const elapsed = performance.now() - stateReceivedAt;
    const less = (ms) => (ms === null ? null : Math.max(0, ms - elapsed));
    return {
        ...team,
        hideRemainingMs: less(team.hideRemainingMs),
        nextQuestionInMs: less(team.nextQuestionInMs),
        huntMs: team.huntMs === null ? null : team.huntMs + elapsed,
    };
}

const joinNames = (names) =>
    names.length <= 1
        ? (names[0] ?? "nobody yet")
        : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

/** Who hides next after Play again: the next player in line, like the server picks. */
function nextHiderName(users) {
    const members = [...users].sort((a, b) => a.id - b.id);
    const current = members.findIndex((u) => u.role === "hider");
    return members.length ? members[(current + 1) % members.length].username : null;
}

/**
 * Everything the status card says, for one player at one moment.
 * Progressive disclosure: only what matters right now, in plain words.
 */
function statusView(team, me, users) {
    const hider = users.find((u) => u.role === "hider")?.username ?? "your hider";
    const stalkers = users.filter((u) => u.role === "stalker").map((u) => u.username);
    const isHider = me.role === "hider";
    const view = {
        badge: isHider ? "HIDER" : "STALKER",
        badgeRole: me.role ?? "lobby",
        title: "",
        timer: null,
        timerLabel: "",
        text: "",
        teamLine: team
            ? isHider
                ? `Team ${team.id} · Stalkers hunting you: ${joinNames(stalkers)}`
                : `Team ${team.id} · Hider: ${hider} · Stalkers: ${joinNames(stalkers)}`
            : "",
        start: false,
        again: false,
        result: null,
    };

    if (!team) {
        return {
            ...view,
            badge: "NO TEAM YET",
            badgeRole: "lobby",
            title: "Waiting for a team",
            text: "The admin will put you in a team. Keep this page open, and read the rules below while you wait.",
        };
    }

    if (team.phase === "ready") {
        const hideFor = minutes(team.hideMs);
        return {
            ...view,
            title: isHider ? "You're the hider" : "You're a stalker",
            text: isHider
                ? `When your whole team is in the Discord call, press Start. You'll get ${hideFor} to hide.`
                : `When your whole team is in the Discord call, press Start. ${hider} gets ${hideFor} to hide, then you hunt.`,
            start: true,
        };
    }

    if (team.phase === "hiding") {
        return {
            ...view,
            title: isHider ? "Go hide!" : `Wait here: ${hider} is hiding`,
            timer: team.hideRemainingMs,
            timerLabel: isHider ? "to hide" : "until the hunt starts",
            text: team.paused
                ? "The admin has paused your team."
                : isHider
                  ? "Walk, don't run. Stay within 10–20 m of a path, where people on it could see you. No tunnels, nothing you have to open."
                  : "Your first question arrives when the timer hits zero.",
        };
    }

    if (team.phase === "hunting") {
        const last = team.question >= team.maxQuestions;
        const cards = gameState.cards;
        let text;
        if (team.paused) text = "The admin has paused your team.";
        else if (isHider) {
            text = cards?.pending?.length
                ? "A question is waiting for you below. Answer it truthfully."
                : last
                  ? "Last question! Stay hidden until the timer runs out and you win."
                  : "Answer each question truthfully when it comes. Walk, don't run.";
        } else {
            const batch = cards?.batch;
            text = !batch
                ? "Loading your question…"
                : !batch.playedCardId
                  ? `Pick one question below. It goes straight to ${hider}.`
                  : cards.currentPlay?.answer === null || !cards.currentPlay
                    ? `Sent! Waiting for ${hider} to answer.`
                    : last
                      ? `Last question! Find ${hider} before the timer runs out.`
                      : "Answered. Use it to close in. The next question comes when the timer hits zero.";
        }
        return {
            ...view,
            title: `Question ${team.question} of ${team.maxQuestions}${team.paused ? " (paused)" : ""}`,
            timer: team.nextQuestionInMs,
            timerLabel: last
                ? isHider
                    ? "until you win"
                    : "left to find the hider"
                : `until question ${team.question + 1}`,
            text,
        };
    }

    // Over.
    const stalkersWon = team.outcome === "seekers";
    const won = stalkersWon !== isHider;
    const huntTime = formatMs(team.huntMs ?? 0);
    const next = nextHiderName(users);
    let title;
    let text;
    if (stalkersWon) {
        title = isHider ? "You've been found" : `You found ${hider}!`;
        text = isHider
            ? `${team.caughtByName ?? "A stalker"} found you after ${huntTime} of hunting.`
            : `Found after ${huntTime} of hunting.`;
    } else {
        title = isHider ? "You win!" : `${hider} wins`;
        text = isHider
            ? `Nobody found you in ${team.maxQuestions} questions (${huntTime}).`
            : `Question ${team.maxQuestions + 1} never came: ${hider} stayed hidden.`;
    }
    return {
        ...view,
        title,
        text: `${text}${next ? ` Next up to hide: ${next}.` : ""}`,
        again: true,
        result: won ? "win" : "loss",
    };
}

function renderHome() {
    if (!currentUser || currentUser.isAdmin || !gameState) return;
    const { me, users } = gameState;
    const team = liveTeam();
    const view = statusView(team, me, users);

    roleBadge.textContent = view.badge;
    roleBadge.dataset.role = view.badgeRole;
    statusCard.dataset.phase = team?.phase ?? "none";
    if (view.result) statusCard.dataset.result = view.result;
    else delete statusCard.dataset.result;
    statusTitle.textContent = view.title;
    statusTimer.hidden = view.timer === null;
    if (view.timer !== null) {
        statusTimer.innerHTML = `<span class="timer-value">${formatMs(view.timer)}</span><span class="timer-label"></span>`;
        statusTimer.querySelector(".timer-label").textContent = view.timerLabel;
        statusTimer.classList.toggle("expiring", view.timer < 30_000 && !team?.paused);
    }
    statusText.textContent = view.text;
    statusTeam.textContent = view.teamLine;
    statusTeam.hidden = !view.teamLine;
    teamStartBtn.hidden = !view.start;
    teamAgainBtn.hidden = !view.again;

    hiderPanel.hidden = !(team && me.role === "hider" && team.phase !== "ready");
    stalkerPanel.hidden = !(team && me.role === "stalker" && team.phase !== "ready");

    const discordUrl = gameState.settings?.discordUrl;
    discordBtn.hidden = !discordUrl;
    if (discordUrl) discordBtn.href = discordUrl;

    // The rules are open until the hunt starts, then fold away so the cards
    // are on screen; a player who opens them again keeps them open.
    const phase = team?.phase ?? "none";
    if (phase !== rulesPhase) {
        rulesPhase = phase;
        rulesCard.open = phase === "none" || phase === "ready";
    }
}

teamStartBtn.addEventListener("click", async () => {
    const team = gameState?.team;
    const hider = gameState?.users.find((u) => u.role === "hider")?.username ?? "The hider";
    if (
        !confirm(
            `Start now? Everyone on your team should be in the Discord call. ${hider} gets ${minutes(team?.hideMs ?? 600000)} to hide.`,
        )
    ) {
        return;
    }
    teamError.textContent = "";
    teamStartBtn.disabled = true;
    try {
        await api("/team/start", { method: "POST" });
        await refreshState();
    } catch (err) {
        teamError.textContent = errorText(err);
    } finally {
        teamStartBtn.disabled = false;
    }
});

teamAgainBtn.addEventListener("click", async () => {
    teamError.textContent = "";
    teamAgainBtn.disabled = true;
    try {
        await api("/team/again", { method: "POST" });
        await refreshState();
    } catch (err) {
        teamError.textContent = errorText(err);
    } finally {
        teamAgainBtn.disabled = false;
    }
});

// ---------------------------------------------------------------------------
// "Look at your phone": a buzz and a beep when a question arrives
// ---------------------------------------------------------------------------
let audioCtx = null;

// Browsers only let a page make sound after a tap, so unlock on the first one.
function unlockAudio() {
    try {
        audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === "suspended") audioCtx.resume();
    } catch {
        audioCtx = null;
    }
}
window.addEventListener("pointerdown", unlockAudio, { passive: true });

function beep() {
    if (!audioCtx || audioCtx.state !== "running") return;
    const now = audioCtx.currentTime;
    for (const [at, freq] of [
        [0, 880],
        [0.18, 1175],
    ]) {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + at);
        gain.gain.exponentialRampToValueAtTime(0.2, now + at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + at + 0.15);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now + at);
        osc.stop(now + at + 0.16);
    }
}

function cue(message) {
    try {
        navigator.vibrate?.([180, 90, 180]);
    } catch {
        /* no vibration motor, or not allowed */
    }
    beep();
    HNSMap.toast(message, 3500);
}

// ---------------------------------------------------------------------------
// Debug strip (admin switch): what this phone itself knows
// ---------------------------------------------------------------------------
const debugStrip = document.getElementById("debug-strip");

function renderDebugStrip() {
    const on = Boolean(gameState?.settings?.debug) && Boolean(currentUser);
    const changed = debugStrip.hidden === on;
    debugStrip.hidden = !on;
    if (changed) HNSMap.invalidateSize();
    if (!on) return;
    const pos = HNSMap.getPosition();
    const age = HNSMap.getFixAgeMs();
    const heading = HNSMap.getHeading();
    const team = liveTeam();
    const parts = [
        pos ? `GPS ±${Math.round(pos.accuracy)} m, ${Math.round((age ?? 0) / 1000)} s old` : `GPS: ${HNSMap.getLocationProblem() ?? "waiting"}`,
        heading ? `heading ${Math.round(heading.degrees)}° (${heading.source})` : `heading: ${HNSMap.getCompassState()}`,
        net.rttMs === null ? "sync: —" : `sync ${Math.round(net.rttMs)} ms`,
        net.lastSyncAt === null ? "" : `polled ${Math.round((performance.now() - net.lastSyncAt) / 1000)} s ago`,
        team ? `team ${team.id}: ${team.phase}${team.question ? ` Q${team.question}` : ""}` : "",
        "DEBUG",
    ];
    debugStrip.textContent = parts.filter(Boolean).join(" · ");
}

// ---------------------------------------------------------------------------
// Sync: one request per poll. POST /state sends our position (or null) and
// brings back everything we may see. Sending the two together halves the
// traffic, which is what keeps a 36-player game inside Cloudflare's free
// daily request and write limits.
// ---------------------------------------------------------------------------
let pollTimer = null;
let unsubscribePosition = null;
let lastPhaseKey = null;
let boundaryRefreshAt = 0;
let hadPosition = false;

/** Our position as the server wants it, with the round trip for the admin board. */
function locationBody() {
    const pos = HNSMap.getPosition();
    // rttMs describes the requests before this one; the admin board turns it
    // into the signal icon.
    const rttMs = net.rttMs === null ? null : Math.round(net.rttMs);
    // How old the fix is, so the server can tell a live position from a
    // frozen one (see recordLocation in the worker).
    const fixAgeMs = HNSMap.getFixAgeMs();
    return pos
        ? {
              lat: pos.lat,
              lng: pos.lng,
              accuracy: pos.accuracy,
              fixAgeMs: fixAgeMs === null ? null : Math.round(fixAgeMs),
              rttMs,
          }
        : { lat: null, lng: null, rttMs };
}

/** The hunt starting and the round ending deserve a buzz of their own. */
function checkPhaseCue(state) {
    const team = state.team;
    const key = team ? `${team.id}:${team.phase}:${team.startedAt ?? ""}` : null;
    const previous = lastPhaseKey;
    lastPhaseKey = key;
    if (previous === null || key === null || key === previous) return;
    if (team.phase === "hunting" && previous.endsWith(`:hiding:${team.startedAt ?? ""}`)) {
        cue("The hunt is on!");
    } else if (team.phase === "ended") {
        cue("Round over!");
    }
}

async function refreshState() {
    if (!token) return;
    try {
        // Admins poll faster and nobody needs their position: no write for them.
        const state = currentUser?.isAdmin
            ? await syncApi("/state")
            : await syncApi("/state", { method: "POST", body: locationBody() });
        gameState = state;
        stateReceivedAt = performance.now();
        // Role/team can change server-side (the admin moving people, Play again).
        const roleChanged =
            currentUser &&
            (currentUser.role !== state.me.role ||
                currentUser.groupId !== state.me.groupId ||
                currentUser.isAdmin !== state.me.isAdmin);
        currentUser = state.me;
        if (roleChanged) renderAuthState();
        HNSMap.setUserPins(state.users, currentUser.username, {
            isAdmin: currentUser.isAdmin,
            role: currentUser.role,
            groupId: currentUser.groupId,
        });
        if (currentUser.isAdmin) {
            HNSAdmin.render(state, stateReceivedAt);
        } else {
            await HNSCards.render(state);
            renderHome();
            checkPhaseCue(state);
        }
        HNSEndgame.render(state);
        // Where the hider can still be: always on, for everyone in a team.
        HNSMap.setOverlayAvailable("hints", Boolean(state.team) && !state.me.isAdmin);
        renderDebugStrip();
    } catch (err) {
        if (err.status === 401) setSession(null, null);
    }
}

/**
 * Once a second: move the timers on, and the moment one reaches zero (the hunt
 * starting, the next question) ask the server for what comes next rather than
 * waiting for the next scheduled poll.
 */
function tick() {
    renderNotices();
    renderDebugStrip();
    if (!gameState || currentUser?.isAdmin) return;
    renderHome();
    const team = liveTeam();
    if (!team || team.status !== "playing" || team.paused) return;
    const due =
        (team.phase === "hiding" && team.hideRemainingMs <= 0) ||
        (team.phase === "hunting" && team.nextQuestionInMs <= 0);
    if (due && performance.now() - boundaryRefreshAt > 1500) {
        boundaryRefreshAt = performance.now();
        refreshState();
    }
}

function startSync() {
    stopSync();
    refreshState();
    pollTimer = setInterval(
        refreshState,
        currentUser?.isAdmin ? CONFIG.adminPollIntervalMs : CONFIG.locationPollIntervalMs,
    );
    clockTimer = setInterval(tick, 1000);
    hadPosition = Boolean(HNSMap.getPosition());
    unsubscribePosition = HNSMap.onPosition((pos) => {
        renderLocationStatus(pos);
        renderNotices();
        // The first fix (or one after a gap) goes out now; after that the
        // regular poll carries it.
        if (pos && !hadPosition) refreshState();
        hadPosition = Boolean(pos);
    });
}

function stopSync() {
    clearInterval(pollTimer);
    clearInterval(clockTimer);
    pollTimer = clockTimer = null;
    net.rttMs = null;
    net.failures = 0;
    net.lastSyncAt = null;
    lastPhaseKey = null;
    rulesPhase = null;
    unsubscribePosition?.();
    unsubscribePosition = null;
}

// Back from the lock screen or another app: catch up now, not in 5 seconds.
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && token) refreshState();
});

// ---------------------------------------------------------------------------
// Boot: restore session if a token is stored
// ---------------------------------------------------------------------------
(async function init() {
    setAuthMode("login");
    HNSCards.init({ api, onChanged: refreshState, onCue: cue });
    HNSEndgame.init({ api, onCaught: refreshState });
    HNSAdmin.init({ api, refresh: refreshState });

    // Arrived from the QR code on the admin's screen: they are new, so open
    // straight on Register, and tidy the address bar.
    const params = new URLSearchParams(location.search);
    if (params.has("join")) {
        params.delete("join");
        const query = params.toString();
        history.replaceState(null, "", `${location.pathname}${query ? `?${query}` : ""}${location.hash}`);
        if (!token) setAuthMode("register");
    }

    if (!token) {
        renderAuthState();
        showView("menu");
        return;
    }
    try {
        const { user } = await api("/me");
        setSession(token, user);
        showView("menu");
    } catch (err) {
        // Only a rejected token means "logged out". A 500 or a network blip
        // must not wipe the stored session, or every refresh during an outage
        // would sign the user out.
        if (err.status === 401) {
            setSession(null, null);
        } else {
            renderAuthState();
            authError.textContent =
                err.status === undefined
                    ? "Could not reach the server — refresh to retry"
                    : `Server error (${err.message}) — refresh to retry`;
        }
        showView("menu");
    }
})();
