/* global HNSMap, HNSCards, HNSEndgame, HNSAdmin, HNSMarks, HNSReceipt, HNSHints */

const CONFIG = window.HNS_CONFIG;
const TOKEN_KEY = "hns.token";
// Set once the player has been through "Before you start" (Done or Later).
const PERM_SEEN_KEY = "hns.perm.seen";

// ---------------------------------------------------------------------------
// View tabs: MENU (QUESTIONS from the hunt on) / MAP
// ---------------------------------------------------------------------------
const tabs = document.querySelectorAll(".view-tab");
const views = {
    menu: document.getElementById("view-menu"),
    map: document.getElementById("view-map"),
};
const menuTab = document.querySelector('.view-tab[data-view="menu"]');
let currentView = "menu";

function showView(name) {
    if (!views[name]) name = "menu";
    currentView = name;
    document.body.dataset.view = name;
    for (const [key, el] of Object.entries(views)) {
        el.hidden = key !== name;
    }
    for (const tab of tabs) {
        const active = tab.dataset.view === name;
        tab.classList.toggle("active", active);
        tab.setAttribute("aria-selected", String(active));
    }
    if (name === "map") setTimeout(() => HNSMap.shown(), 0);
    if (name === "menu") HNSCards.menuShown();
    scheduleMarks();
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
// The home screen: the app opens on it, every time; a tap anywhere goes on
// ---------------------------------------------------------------------------
const homeScreen = document.getElementById("home-screen");

function leaveHomeScreen() {
    if (homeScreen.hidden) return;
    homeScreen.hidden = true;
    maybeShowPermSheet();
    renderNotices();
    scheduleMarks();
}
homeScreen.addEventListener("click", leaveHomeScreen);
homeScreen.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        leaveHomeScreen();
    }
});
homeScreen.focus();

// ---------------------------------------------------------------------------
// Auth UI
// ---------------------------------------------------------------------------
const menuPanel = document.querySelector("#view-menu .menu-panel");
const authPanel = document.getElementById("auth-panel");
const playerPanel = document.getElementById("player-panel");
const adminPanel = document.getElementById("admin-panel");
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
    renderAuthButton();
}

/** Black = press me now: only once there's something to log in with. */
function renderAuthButton() {
    authSubmit.classList.toggle("cta", Boolean(authForm.username.value && authForm.password.value));
    scheduleMarks();
}

for (const btn of authSwitchBtns) {
    btn.addEventListener("click", () => setAuthMode(btn.dataset.mode));
}
authForm.addEventListener("input", renderAuthButton);

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
        renderAuthButton();
        maybeShowPermSheet();
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
        HNSReceipt.reset();
        HNSMap.setGame(null);
        renderTabs();
        showView("menu");
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
        userStatusName.textContent = isAdmin
            ? `${currentUser.username} (admin)`
            : currentUser.username;
    } else {
        HNSMap.setUserPins([], null);
    }
    renderNotices();
    renderHome();
    scheduleMarks();
}

// ---------------------------------------------------------------------------
// First launch: "Before you start", the two permissions, one button each.
// Location is needed; the compass is optional (iPhones only hand it over
// after a tap). Shown once per phone, after logging in.
// ---------------------------------------------------------------------------
const permSheet = document.getElementById("perm-sheet");
const permRows = {
    loc: permSheet.querySelector('.perm-row[data-perm="loc"]'),
    compass: permSheet.querySelector('.perm-row[data-perm="compass"]'),
};
const permDone = document.getElementById("perm-done");
const permLater = document.getElementById("perm-later");
// "off" | "asking" | "on" | "blocked"; help: the How to fix text is showing.
const perm = { loc: "off", compass: "off", locHelp: false, compassHelp: false };

function permSeen() {
    try {
        return localStorage.getItem(PERM_SEEN_KEY) === "1";
    } catch {
        return false;
    }
}

/** What the phone already says, before anyone presses anything. */
function readPermissions() {
    if (perm.loc !== "asking") {
        const problem = HNSMap.getLocationProblem();
        perm.loc = HNSMap.getLocationPermission() === "granted" || HNSMap.getPosition()
            ? "on"
            : problem === "blocked" || problem === "denied" || problem === "insecure" || HNSMap.getLocationPermission() === "denied"
              ? "blocked"
              : perm.loc === "blocked" ? "blocked" : "off";
    }
    if (perm.compass !== "asking") {
        const c = HNSMap.getCompassState();
        perm.compass = c === "on" ? "on" : c === "denied" ? "blocked" : c === "unsupported" ? "none" : "off";
    }
}

function maybeShowPermSheet() {
    if (!currentUser) return;
    // An admin, or a player who has been through the sheet: follow the GPS
    // now (the browser asks, if it still has to).
    if (currentUser.isAdmin || permSeen()) {
        HNSMap.startLocation();
        return;
    }
    if (!homeScreen.hidden) return;
    readPermissions();
    // Nothing to ask for: don't show a sheet of Ons.
    if (perm.loc === "on" && (perm.compass === "on" || perm.compass === "none")) {
        HNSMap.startLocation();
        return;
    }
    permSheet.hidden = false;
    renderPermSheet();
}

function renderPermSheet() {
    if (permSheet.hidden) return;
    readPermissions();
    const notes = {
        loc: { off: "Puts you on the map.", asking: "Choose Allow.", on: "Puts you on the map.", blocked: "Blocked. Tap How to fix." },
        compass: { off: "Shows which way you face.", asking: "Choose Allow.", on: "Shows which way you face.", blocked: "Blocked. Tap How to fix." },
    };
    const help = {
        loc: perm.locHelp ? unblockLocationHelp() : null,
        compass: perm.compassHelp ? "The compass is blocked. Close Safari completely (swipe it away), open the game again, then try again." : null,
    };
    for (const key of ["loc", "compass"]) {
        const row = permRows[key];
        const state = perm[key];
        row.hidden = state === "none";
        row.dataset.state = state;
        row.querySelector(".perm-note").textContent = help[key] ?? notes[key][state] ?? notes[key].off;
        const btn = row.querySelector(".perm-btn");
        const on = row.querySelector(".perm-on");
        on.hidden = state !== "on";
        btn.hidden = state === "on";
        btn.disabled = state === "asking";
        btn.textContent = state === "asking" ? "Asking…" : state === "blocked" ? (help[key] ? "Try again" : "How to fix") : "Turn on";
        // The one to press next is black: location first, then the compass.
        const next = state === "off" && (key === "loc" || perm.loc === "on");
        btn.classList.toggle("next", next);
    }
    const all = perm.loc === "on" && (perm.compass === "on" || perm.compass === "none");
    permDone.hidden = !all;
    permLater.hidden = all;
    requestAnimationFrame(() => HNSMarks.sheet());
}

async function permPressed(key) {
    const state = perm[key];
    if (state === "blocked" && !perm[`${key}Help`]) {
        perm[`${key}Help`] = true;
        renderPermSheet();
        return;
    }
    perm[`${key}Help`] = false;
    perm[key] = "asking";
    renderPermSheet();
    if (key === "loc") {
        const problem = await HNSMap.requestLocation();
        perm.loc = problem === null || problem === "unavailable" ? "on" : "blocked";
    } else {
        const result = await HNSMap.enableCompass();
        perm.compass = result === "on" ? "on" : "blocked";
    }
    renderPermSheet();
    renderNotices();
}

permRows.loc.querySelector(".perm-btn").addEventListener("click", () => permPressed("loc"));
permRows.compass.querySelector(".perm-btn").addEventListener("click", () => permPressed("compass"));

function closePermSheet() {
    try {
        localStorage.setItem(PERM_SEEN_KEY, "1");
    } catch {
        /* then it just comes back next time */
    }
    permSheet.hidden = true;
    renderNotices();
    scheduleMarks();
}
permDone.addEventListener("click", closePermSheet);
permLater.addEventListener("click", closePermSheet);

// ---------------------------------------------------------------------------
// Connection health + notices. Measured from our own background sync
// requests; feeds the black banner here and, through /state, the signal icon
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

function renderNotices() {
    const loggedIn = Boolean(token && currentUser);
    const player = loggedIn && !currentUser.isAdmin;
    // The home screen and "Before you start" come first; the notices after.
    const settled = homeScreen.hidden && permSheet.hidden;
    const offline = loggedIn && isOffline();
    const pos = HNSMap.getPosition();
    const age = HNSMap.getFixAgeMs();
    let problem = HNSMap.getLocationProblem();
    // A fix we still hold but that has stopped moving on is a problem too.
    if (pos && age !== null && age > GPS_STALE_NOTICE_MS && !document.hidden) problem = "stale";
    // No notice while the first fix or the browser's own prompt is pending.
    const locationOff = player && settled && problem !== null && (problem === "stale" || !pos);

    const changed = offlineNotice.hidden === offline || locationNotice.hidden === locationOff;
    offlineNotice.hidden = !offline;
    locationNotice.hidden = !locationOff;
    if (locationOff && !requestingLocation) {
        const copy = locationNoticeCopy(problem);
        locationNoticeText.textContent = copy.text;
        locationShareBtn.hidden = copy.button === null;
        locationShareBtn.textContent = copy.button ?? "";
    }
    // The notices take height from the map, which has to re-measure.
    if (changed) {
        HNSMap.invalidateSize();
        scheduleMarks();
    }
    if (!permSheet.hidden) renderPermSheet();
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

// ---------------------------------------------------------------------------
// The home screen: one card that says what to do right now
// ---------------------------------------------------------------------------
const statusCard = document.getElementById("status-card");
const roleBadge = document.getElementById("role-badge");
const statusTitle = document.getElementById("status-title");
const statusTimer = document.getElementById("status-timer");
const statusText = document.getElementById("status-text");
const teamStartBtn = document.getElementById("team-start-btn");
const teamAgainBtn = document.getElementById("team-again-btn");
const teamLeaveBtn = document.getElementById("team-leave-btn");
const teamError = document.getElementById("team-error");
const discordBtn = document.getElementById("discord-btn");
const rulesCard = document.getElementById("rules-card");
const hiderPanel = document.getElementById("hider-panel");
const stalkerPanel = document.getElementById("stalker-panel");

let gameState = null; // last /state payload
let stateReceivedAt = 0; // performance.now() when gameState arrived
let clockTimer = null;

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

/**
 * Everything the status card says, for one player at one moment.
 * Progressive disclosure: only what matters right now, in plain words.
 */
function statusView(team, me, users) {
    const hider = users.find((u) => u.role === "hider")?.username ?? "your hider";
    const isHider = me.role === "hider";
    const view = {
        badge: isHider ? "HIDER" : "STALKER",
        title: "",
        timer: null,
        timerLabel: "",
        text: "",
        start: false,
        again: false,
        leave: false,
        ending: null,
    };

    if (!team) {
        return {
            ...view,
            badge: "NO TEAM YET",
            title: "Waiting for a team",
            text: "You'll be put in a team. Read the rules while you wait.",
        };
    }

    // Only the hider starts the round: they know when they're ready to go.
    if (team.phase === "ready") {
        const hideFor = minutes(team.hideMs);
        return {
            ...view,
            title: isHider ? "You're the hider" : "You're a stalker",
            text: isHider
                ? `When your whole team is in the Discord call and you're ready, press Start. You'll get ${hideFor} to hide.`
                : `When your whole team is in the Discord call, ${hider} presses Start and gets ${hideFor} to hide. Then you hunt.`,
            start: isHider,
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
                  ? "Walk, don't run. Stay visible from where people walk: nothing a stalker would have to open, nothing underground. When the timer hits zero, freeze."
                  : `Close your eyes while ${hider} walks away. Your first question arrives when the timer hits zero.`,
        };
    }

    if (team.phase === "hunting") {
        const last = team.question >= team.maxQuestions;
        return {
            ...view,
            title: `Question ${team.question} of ${team.maxQuestions}${team.paused ? " (paused)" : ""}`,
            timer: team.nextQuestionInMs,
            timerLabel: last
                ? isHider
                    ? "until you win"
                    : "left to find the hider"
                : `until question ${team.question + 1}`,
            // During the hunt the screen says it already (the timer, the
            // cards, the bell); only a pause needs words.
            text: team.paused ? "The admin has paused your team." : "",
        };
    }

    // Over.
    const stalkersWon = team.outcome === "seekers";
    const huntTime = formatMs(team.huntMs ?? 0);
    let title;
    let text;
    if (stalkersWon) {
        title = isHider ? "You've been found" : `You found ${hider}!`;
        text = isHider
            ? `${team.caughtByName ?? "A stalker"} found you after ${huntTime} of hunting.`
            : `Found after ${huntTime} of hunting.`;
    } else {
        title = isHider ? "Hider wins!" : `${hider} wins`;
        text = isHider
            ? `Nobody found you in ${team.maxQuestions} questions (${huntTime}).`
            : `Question ${team.maxQuestions + 1} never came: ${hider} stayed hidden.`;
    }
    return {
        ...view,
        title,
        // The server picks the next hider when Play again is pressed: one of
        // those who have hidden least, at random.
        text: `${text} Play again to pick a new hider.`,
        again: true,
        leave: true,
        // The winners' line, by hand: GOTCHA for the stalkers who found the
        // hider, HOW ABOUT THAT. for the hider nobody found.
        ending: stalkersWon && !isHider ? "gotcha" : !stalkersWon && isHider ? "howabout" : null,
    };
}

let renderedTimerLabel = null;
let renderedPhase = null;

function renderHome() {
    if (!currentUser || currentUser.isAdmin || !gameState) return;
    const { me, users } = gameState;
    const team = liveTeam();
    const view = statusView(team, me, users);
    // A new phase (the hunt starting, the round over, Play again) says what
    // to do at the top of the screen: back up to it.
    const phaseKey = `${team?.id ?? ""}:${team?.phase ?? "none"}`;
    if (renderedPhase !== null && phaseKey !== renderedPhase) views.menu.scrollTop = 0;
    renderedPhase = phaseKey;

    roleBadge.textContent = view.badge;
    statusCard.dataset.phase = team?.phase ?? "none";
    if (statusTitle.textContent !== view.title) statusTitle.textContent = view.title;
    statusTimer.hidden = view.timer === null;
    if (view.timer !== null) {
        if (renderedTimerLabel !== view.timerLabel || !statusTimer.firstChild) {
            statusTimer.innerHTML = '<span class="timer-value"></span><span class="timer-label"></span>';
            statusTimer.querySelector(".timer-label").textContent = view.timerLabel;
            renderedTimerLabel = view.timerLabel;
        }
        statusTimer.querySelector(".timer-value").textContent = formatMs(view.timer);
    }
    if (statusText.textContent !== view.text) statusText.textContent = view.text;
    statusText.hidden = !view.text;
    teamStartBtn.hidden = !view.start;
    teamAgainBtn.hidden = !view.again;
    teamLeaveBtn.hidden = !view.leave;

    const phase = team?.phase ?? "none";
    hiderPanel.hidden = !(team && me.role === "hider" && (phase === "hiding" || phase === "hunting"));
    stalkerPanel.hidden = !(team && me.role === "stalker" && (phase === "hunting" || phase === "hiding"));

    // Before the game only: the Discord call and the rules.
    const before = phase === "none" || phase === "ready";
    const discordUrl = gameState.settings?.discordUrl;
    discordBtn.hidden = !(discordUrl && before);
    if (discordUrl) discordBtn.href = discordUrl;
    rulesCard.hidden = !before;

    HNSReceipt.render(phase === "ended" ? { team, me, users } : null);
    renderTabs();
    homeMarks = { screen: phase === "none" ? "lobby" : phase === "hunting" || phase === "hiding" || phase === "ready" ? phase : "ended", role: me.role, ending: view.ending };
    scheduleMarks();
}

/**
 * From the hunt on, the first tab is where questions are asked and answered
 * (and, for the stalkers, every answer so far), so it says QUESTIONS; MENU
 * before that.
 */
function renderTabs() {
    const phase = gameState?.team?.phase;
    const hunt = Boolean(currentUser && !currentUser.isAdmin && (phase === "hunting" || phase === "ended"));
    menuTab.textContent = hunt ? "QUESTIONS" : "MENU";
}

teamStartBtn.addEventListener("click", async () => {
    const team = gameState?.team;
    if (
        !confirm(
            `Start now? Everyone on your team should be in the Discord call. You'll get ${minutes(team?.hideMs ?? 600000)} to hide.`,
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

// Leaving between rounds: off the team on the server, then logged out here.
teamLeaveBtn.addEventListener("click", async () => {
    if (!confirm("Leave the game? You'll be taken off your team and logged out. Your rounds stay in the results.")) {
        return;
    }
    teamError.textContent = "";
    teamLeaveBtn.disabled = true;
    try {
        await api("/team/leave", { method: "POST" });
    } catch (err) {
        teamError.textContent = errorText(err);
        return;
    } finally {
        teamLeaveBtn.disabled = false;
    }
    logoutBtn.click();
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
// The red layer: redrawn after anything on screen changes (marks.js only
// repaints what actually moved)
// ---------------------------------------------------------------------------
let homeMarks = null;
let marksFrame = null;

function scheduleMarks() {
    if (marksFrame !== null) return;
    marksFrame = requestAnimationFrame(() => {
        marksFrame = null;
        renderMarks();
    });
}

function renderMarks() {
    const cards = gameState?.cards;
    const unread = currentUser && !currentUser.isAdmin ? (cards?.unread ?? 0) : 0;
    // A notification is the most important thing on the screen, the map included.
    HNSMarks.bell(unread > 0 && homeScreen.hidden && permSheet.hidden, cards?.role === "hider" ? "question" : "photo");
    if (currentView === "menu") {
        const screen = !currentUser ? "login" : currentUser.isAdmin ? "admin" : homeMarks?.screen ?? "lobby";
        HNSMarks.menu({ ...(homeMarks ?? {}), screen, role: currentUser?.role ?? null });
    }
}

document.getElementById("view-menu").addEventListener("change", scheduleMarks);
window.addEventListener("resize", () => {
    HNSMarks.invalidate();
    scheduleMarks();
});
new ResizeObserver(scheduleMarks).observe(menuPanel);
document.fonts?.ready.then(() => {
    HNSMarks.invalidate();
    scheduleMarks();
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
    // The admin can hide it from players (debugStrip); their own always shows.
    const settings = gameState?.settings;
    const on = Boolean(currentUser) && Boolean(currentUser.isAdmin ? settings?.debug : (settings?.debugStrip ?? settings?.debug));
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
// The map's question box and its one red thing follow the game every second
// ---------------------------------------------------------------------------
function renderMapGame() {
    if (!currentUser || currentUser.isAdmin || !gameState) {
        HNSMap.setGame(currentUser?.isAdmin ? { isAdmin: true } : null);
        return;
    }
    HNSMap.setGame({
        isAdmin: false,
        role: gameState.me.role,
        me: gameState.me.username,
        team: liveTeam(),
        cards: gameState.cards,
        users: gameState.users,
        settings: gameState.settings,
    });
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
        HNSHints.setEnabled(Boolean(state.team) && !state.me.isAdmin);
        renderMapGame();
        renderDebugStrip();
        scheduleMarks();
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
    renderMapGame();
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
    homeMarks = null;
    renderedPhase = null;
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
    HNSCards.init({
        api,
        onChanged: refreshState,
        onCue: cue,
        onRender: scheduleMarks,
        showView,
    });
    HNSEndgame.init({ api, onCaught: refreshState });
    HNSAdmin.init({ api, refresh: refreshState });
    HNSReceipt.init({ api, onRender: scheduleMarks });
    HNSMap.onRender(scheduleMarks);

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
        maybeShowPermSheet();
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
