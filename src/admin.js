/* global HNSMap, qrcode */

// The admin dashboard: the join QR, the teams board, the results, the settings
// and the game-day to-dos. app.js hands over each /state poll through render().
//
// Everything here is wrapped in one function scope: the src/*.js files are
// classic scripts sharing a single global scope, and this file has no business
// adding names to it besides window.HNSAdmin.
(() => {
    const CONFIG = window.HNS_CONFIG;

    // The jobs that have to happen before game day, ticked off here because
    // this dashboard is where Félix already looks. Ticks are stored on the
    // server, so every admin sees the same list.
    const TODOS = [
        {
            id: "discord-server",
            who: "Félix",
            text: "Create the Discord server: one voice channel per team, so the admins can hop into any team's call.",
        },
        {
            id: "discord-link",
            who: "Félix",
            text: "Paste the server's invite link under Settings below. Every phone then gets a “Join the Discord call” button.",
        },
    ];

    let adminApi = null;
    let refresh = () => {};
    let state = null;
    let receivedAt = 0;
    let renderedTodosKey = null;

    const $ = (id) => document.getElementById(id);
    const el = {};

    const escapeHtml = (str) =>
        String(str ?? "").replace(
            /[&<>"']/g,
            (c) =>
                ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
        );

    function formatMs(ms) {
        const total = Math.max(0, Math.floor(ms / 1000));
        const h = Math.floor(total / 3600);
        const m = Math.floor((total % 3600) / 60);
        const s = total % 60;
        const mm = String(m).padStart(2, "0");
        const ss = String(s).padStart(2, "0");
        return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
    }

    const serverNow = () => (state ? state.serverNow + (performance.now() - receivedAt) : Date.now());

    /** A team's timers, moved on by however long ago the poll landed. */
    function liveTeam(team) {
        if (team.status !== "playing" || team.paused) return team;
        const elapsed = performance.now() - receivedAt;
        const less = (ms) => (ms === null ? null : Math.max(0, ms - elapsed));
        return {
            ...team,
            hideRemainingMs: less(team.hideRemainingMs),
            nextQuestionInMs: less(team.nextQuestionInMs),
        };
    }

    // -----------------------------------------------------------------------
    // Actions
    // -----------------------------------------------------------------------
    async function adminAction(path, body) {
        el.error.textContent = "";
        try {
            const data = await adminApi(path, { method: "POST", body: body ?? {} });
            await refresh();
            return data;
        } catch (err) {
            el.error.textContent =
                err.status === undefined ? "Could not reach the server" : err.message;
            return null;
        }
    }

    // -----------------------------------------------------------------------
    // Join QR: players point their camera at the admin's screen
    // -----------------------------------------------------------------------
    function renderJoinQr() {
        const url = `${location.origin}${location.pathname}?join`;
        el.joinUrl.textContent = url;
        const qr = qrcode(0, "M");
        qr.addData(url);
        qr.make();
        el.joinQr.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 4, alt: "Join the game" });
    }

    // -----------------------------------------------------------------------
    // Presence: the signal icon and coordinates on every name
    // -----------------------------------------------------------------------
    // Signal thresholds follow the heartbeat (every player poll carries one),
    // so they stay right if it's retuned: one late heartbeat is normal jitter,
    // two is a weak link, three is gone.
    const SIGNAL_WEAK_AFTER_MS = 2 * CONFIG.locationPollIntervalMs + 2_000;
    const SIGNAL_LOST_AFTER_MS = 3 * CONFIG.locationPollIntervalMs + 5_000;
    const SIGNAL_LABELS = ["No connection", "Weak connection", "OK connection", "Good connection"];

    // Wi-Fi fan: inner arc lights up from 1 bar, outer arc only at 3. The slash
    // only shows at 0 (see .signal-icon in styles.css).
    const SIGNAL_ICON = `<svg class="signal-icon" viewBox="0 0 24 24" fill="none"
            stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
        <path class="sig-3" d="M1.42 9a16 16 0 0 1 21.16 0" />
        <path class="sig-2" d="M5 12.55a11 11 0 0 1 14.08 0" />
        <path class="sig-1" d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <circle class="sig-dot" cx="12" cy="20" r="1.6" />
        <line class="sig-off" x1="3" y1="3" x2="21" y2="21" />
    </svg>`;

    function formatAgo(ms) {
        const s = Math.round(ms / 1000);
        if (s < 60) return `${s}s`;
        if (s < 3600) return `${Math.round(s / 60)} min`;
        return `${Math.round(s / 3600)} h`;
    }

    /** Signal level 0–3 plus the text shown for one player on the board. */
    function describePresence(u) {
        // Ages use the server's clock, so a skewed phone clock can't distort them.
        const now = serverNow();
        const age = u.lastSeenAt == null ? null : Math.max(0, now - u.lastSeenAt);

        let level;
        if (age === null || age > SIGNAL_LOST_AFTER_MS) level = 0;
        else if (u.rttMs == null) level = 2; // alive, speed not measured yet
        else if (u.rttMs <= 400) level = 3;
        else if (u.rttMs <= 1200) level = 2;
        else level = 1;
        if (level > 1 && age > SIGNAL_WEAK_AFTER_MS) level = 1;

        let coords;
        let coordsState;
        if (u.lat != null && u.lng != null) {
            coords = [`${u.lat.toFixed(5)}, ${u.lng.toFixed(5)}`];
            if (u.accuracy != null) coords.push(`±${Math.round(u.accuracy)} m`);
            coordsState = "fix";
            // How old the GPS fix itself is, not the heartbeat: a phone whose
            // GPS froze keeps checking in with the same old position.
            const fixAge = u.updatedAt == null ? null : Math.max(0, now - u.updatedAt);
            if (fixAge !== null && fixAge > SIGNAL_WEAK_AFTER_MS) {
                coords.push(`${formatAgo(fixAge)} old`);
                coordsState = "stale";
            }
        } else if (level === 0) {
            coords = [age === null ? "Not connected" : `No signal · ${formatAgo(age)} ago`];
            coordsState = "lost";
        } else {
            coords = ["Location off"];
            coordsState = "off";
        }

        const title = [SIGNAL_LABELS[level]];
        if (level > 0 && u.rttMs != null) title.push(`${Math.round(u.rttMs)} ms round trip`);
        if (age !== null) title.push(`last check-in ${formatAgo(age)} ago`);
        return { level, coords, coordsState, title: title.join(" · ") };
    }

    function makeBoardName(u) {
        const presence = describePresence(u);
        const node = document.createElement("div");
        node.className = "board-name";
        node.dataset.userId = String(u.id);
        node.dataset.role = u.role ?? "";
        node.dataset.signal = String(presence.level);
        node.classList.toggle("offline", presence.level === 0);
        // Online or not makes no difference: anyone can be moved at any time.
        node.draggable = true;
        node.innerHTML = `
            <span class="board-name-row">${SIGNAL_ICON}<span class="board-username"></span></span>
            <span class="board-coords" data-state="${presence.coordsState}"></span>`;
        node.querySelector(".board-username").textContent = u.username;
        const coords = node.querySelector(".board-coords");
        for (const part of presence.coords) {
            const span = document.createElement("span");
            span.textContent = part;
            coords.append(span, " ");
        }
        node.title = `${u.username}: ${presence.title}`;
        return node;
    }

    // -----------------------------------------------------------------------
    // Teams board
    // -----------------------------------------------------------------------
    /** One line on how a team is doing, kept short enough for a column header. */
    function describeTeam(team) {
        const t = liveTeam(team);
        if (t.phase === "ready") return "Ready — waiting for them to press Start";
        if (t.phase === "ended") {
            return t.outcome === "seekers"
                ? `Stalkers won — ${t.caughtByName ?? "?"} found ${t.hiderName ?? "the hider"} after ${formatMs(t.huntMs ?? 0)}`
                : `Hider won — ${t.hiderName ?? "the hider"} survived all ${t.maxQuestions} questions`;
        }
        const paused = t.paused ? " · PAUSED" : "";
        if (t.phase === "hiding") return `Hiding · ${formatMs(t.hideRemainingMs ?? 0)} left${paused}`;
        if (t.phase === "hunting") {
            return `Question ${t.question}/${t.maxQuestions} · next in ${formatMs(t.nextQuestionInMs ?? 0)} · ${t.questionsAsked} asked${paused}`;
        }
        return t.phase;
    }

    function teamControls(team) {
        const buttons = [];
        if (team.status === "ready") buttons.push(["start", "Start"]);
        if (team.status === "playing") buttons.push(team.paused ? ["resume", "Resume"] : ["pause", "Pause"]);
        if (team.status !== "ready") buttons.push(["reset", "Reset"]);
        return buttons
            .map(
                ([action, label]) =>
                    `<button type="button" class="admin-btn small" data-team-action="${action}" data-team-id="${team.id}">${label}</button>`,
            )
            .join("");
    }

    function boardColumn({ key, title, color, header = "", slots }) {
        const col = document.createElement("section");
        col.className = "board-group";
        col.dataset.teamId = key;
        if (color) col.style.setProperty("--group-color", color);
        col.innerHTML = `<h3>${escapeHtml(title)}</h3>${header}${slots
            .map(
                ({ role, label }) => `
                <div class="board-slot ${role}-slot" data-role="${role}">
                    ${label ? `<span class="slot-label">${escapeHtml(label)}</span>` : ""}
                    <div class="board-list"></div>
                </div>`,
            )
            .join("")}`;
        return col;
    }

    function renderBoard() {
        const players = state.users.filter((u) => !u.isAdmin);
        el.board.innerHTML = "";
        for (const team of state.teams) {
            const members = players.filter((u) => u.groupId === team.id);
            const col = boardColumn({
                key: String(team.id),
                title: `Team ${team.id}`,
                color: HNSMap.groupColor(team.id),
                header: `<p class="board-outcome" data-phase="${team.phase}">
                        <span class="team-clock" data-team-id="${team.id}">${escapeHtml(describeTeam(team))}</span>
                    </p>
                    <div class="team-controls">${teamControls(team)}</div>`,
                slots: [
                    { role: "hider", label: "Hider" },
                    { role: "stalker", label: "Stalkers" },
                ],
            });
            for (const u of members) {
                col.querySelector(
                    u.role === "hider" ? ".hider-slot .board-list" : ".stalker-slot .board-list",
                ).appendChild(makeBoardName(u));
            }
            el.board.appendChild(col);
        }
        const fresh = boardColumn({
            key: "new",
            title: "New team",
            slots: [
                { role: "hider", label: "Hider" },
                { role: "stalker", label: "Stalkers" },
            ],
        });
        fresh.classList.add("new-group");
        el.board.appendChild(fresh);

        // Those who left the game are gone until they log in again.
        const unassigned = players.filter((u) => !u.groupId && u.role !== "left");
        const pool = boardColumn({
            key: "none",
            title: `Not in a team (${unassigned.length})`,
            slots: [{ role: "none", label: "" }],
        });
        pool.classList.add("pool");
        const list = pool.querySelector(".board-list");
        for (const u of unassigned) list.appendChild(makeBoardName(u));
        if (!players.length) {
            list.innerHTML = '<p class="muted">Nobody has joined yet. Show them the QR code above.</p>';
        }
        el.board.appendChild(pool);
    }

    /** Tick the team headers between polls without touching the DOM around them. */
    function tickClocks() {
        if (!state) return;
        for (const span of el.board.querySelectorAll(".team-clock")) {
            const team = state.teams.find((t) => String(t.id) === span.dataset.teamId);
            if (team) span.textContent = describeTeam(team);
        }
    }

    // Drag & drop between slots. Uses native HTML5 DnD (desktop) with a pointer
    // fallback for touch devices, both funnelled through dropUser().
    let dragUserId = null;
    let boardPointerDown = false;
    let touchDrag = null;

    const isDragging = () => dragUserId !== null || touchDrag !== null || boardPointerDown;

    function clearDropHighlights() {
        for (const node of el.board.querySelectorAll(".drop-target")) {
            node.classList.remove("drop-target");
        }
    }

    async function dropUser(userId, slot) {
        const key = slot.closest(".board-group").dataset.teamId;
        const role = slot.dataset.role;
        const teamId = key === "none" ? null : key === "new" ? "new" : Number(key);
        await adminAction("/admin/assign", {
            userId,
            teamId,
            ...(teamId === null ? {} : { role }),
        });
    }

    function wireBoard() {
        el.board.addEventListener("pointerdown", () => {
            boardPointerDown = true;
        });
        for (const type of ["pointerup", "pointercancel", "dragend"]) {
            window.addEventListener(type, () => {
                boardPointerDown = false;
            });
        }
        el.board.addEventListener("dragstart", (e) => {
            const name = e.target.closest?.(".board-name[draggable='true']");
            if (!name) return;
            dragUserId = Number(name.dataset.userId);
            name.classList.add("dragging");
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", name.dataset.userId);
        });
        el.board.addEventListener("dragend", (e) => {
            e.target.closest?.(".board-name")?.classList.remove("dragging");
            clearDropHighlights();
            dragUserId = null;
        });
        el.board.addEventListener("dragover", (e) => {
            const slot = e.target.closest?.(".board-slot");
            if (!slot || dragUserId === null) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            clearDropHighlights();
            slot.classList.add("drop-target");
        });
        el.board.addEventListener("dragleave", (e) => {
            e.target.closest?.(".board-slot")?.classList.remove("drop-target");
        });
        el.board.addEventListener("drop", (e) => {
            const slot = e.target.closest?.(".board-slot");
            if (!slot || dragUserId === null) return;
            e.preventDefault();
            const userId = dragUserId;
            dragUserId = null;
            dropUser(userId, slot);
        });

        // Touch fallback: long-press-free pointer drag with a floating ghost.
        el.board.addEventListener(
            "touchstart",
            (e) => {
                const name = e.target.closest?.(".board-name[draggable='true']");
                if (!name) return;
                const t = e.touches[0];
                touchDrag = {
                    userId: Number(name.dataset.userId),
                    startX: t.clientX,
                    startY: t.clientY,
                    ghost: null,
                    source: name,
                };
            },
            { passive: true },
        );
        el.board.addEventListener(
            "touchmove",
            (e) => {
                if (!touchDrag) return;
                const t = e.touches[0];
                if (!touchDrag.ghost) {
                    if (Math.hypot(t.clientX - touchDrag.startX, t.clientY - touchDrag.startY) < 8) {
                        return;
                    }
                    touchDrag.ghost = touchDrag.source.cloneNode(true);
                    touchDrag.ghost.classList.add("drag-ghost");
                    document.body.appendChild(touchDrag.ghost);
                    touchDrag.source.classList.add("dragging");
                }
                e.preventDefault();
                touchDrag.ghost.style.left = `${t.clientX}px`;
                touchDrag.ghost.style.top = `${t.clientY}px`;
                clearDropHighlights();
                document
                    .elementFromPoint(t.clientX, t.clientY)
                    ?.closest(".board-slot")
                    ?.classList.add("drop-target");
            },
            { passive: false },
        );
        const endTouchDrag = (e) => {
            if (!touchDrag) return;
            const { ghost, source, userId } = touchDrag;
            touchDrag = null;
            if (ghost) {
                const t = e.changedTouches[0];
                ghost.remove();
                source.classList.remove("dragging");
                const slot = document.elementFromPoint(t.clientX, t.clientY)?.closest(".board-slot");
                if (slot) dropUser(userId, slot);
            }
            clearDropHighlights();
        };
        el.board.addEventListener("touchend", endTouchDrag);
        el.board.addEventListener("touchcancel", endTouchDrag);

        el.board.addEventListener("click", (e) => {
            const button = e.target.closest?.("[data-team-action]");
            if (!button) return;
            const teamId = Number(button.dataset.teamId);
            const action = button.dataset.teamAction;
            if (
                action === "reset" &&
                !confirm(`Reset Team ${teamId}? Their current round is thrown away and they go back to Ready.`)
            ) {
                return;
            }
            adminAction("/admin/team", { teamId, action });
        });
    }

    // -----------------------------------------------------------------------
    // Results, settings, to-dos
    // -----------------------------------------------------------------------
    function renderResults() {
        const results = state.results ?? [];
        if (!results.length) {
            el.results.innerHTML = '<li class="results-empty muted">No finished rounds yet.</li>';
            return;
        }
        el.results.innerHTML = results
            .map((r) => {
                const how =
                    r.outcome === "hider"
                        ? `survived all 6 questions`
                        : `found by ${escapeHtml(r.caughtByName ?? "?")} after ${r.questions} question${r.questions === 1 ? "" : "s"}`;
                return `<li><strong>${escapeHtml(r.hiderName ?? "?")}</strong>
                    <span class="result-time">${formatMs(r.huntMs)}</span>
                    <span class="muted">Team ${r.teamId} · ${how}</span></li>`;
            })
            .join("");
    }

    function renderSettings() {
        const settings = state.settings ?? {};
        el.debug.checked = Boolean(settings.debug);
        for (const [name, box] of Object.entries(el.debugOptions)) {
            box.checked = Boolean(settings[name]);
            box.disabled = !settings.debug;
        }
        // Never under the admin's fingers: a 2-second poll would eat the typing.
        if (document.activeElement !== el.discordUrl) el.discordUrl.value = settings.discordUrl ?? "";
        const done = new Set(settings.todosDone ?? []);
        // Rebuilt only when a tick changes, so a poll can't swallow a click.
        const key = [...done].sort().join(",");
        if (key === renderedTodosKey) return;
        renderedTodosKey = key;
        el.todos.innerHTML = "";
        for (const todo of TODOS) {
            const li = document.createElement("li");
            li.className = "todo-item";
            li.classList.toggle("done", done.has(todo.id));
            li.innerHTML = `<label><input type="checkbox" data-todo="${todo.id}" ${
                done.has(todo.id) ? "checked" : ""
            } /><span class="todo-who">${escapeHtml(todo.who)}</span> <span>${escapeHtml(todo.text)}</span></label>`;
            el.todos.appendChild(li);
        }
    }

    function renderSummary() {
        const players = state.users.filter((u) => !u.isAdmin && u.role !== "left");
        const left = state.users.filter((u) => u.role === "left").length;
        const playing = state.teams.filter((t) => t.status === "playing").length;
        const parts = [
            `${players.length} player${players.length === 1 ? "" : "s"}`,
            `${state.teams.length} team${state.teams.length === 1 ? "" : "s"} (${playing} playing)`,
        ];
        if (left) parts.push(`${left} left the game`);
        if (state.settings?.debug) parts.push("DEBUG MODE ON");
        el.summary.textContent = parts.join(" · ");
        el.summary.dataset.debug = state.settings?.debug ? "on" : "off";
    }

    // -----------------------------------------------------------------------
    // Public surface
    // -----------------------------------------------------------------------
    window.HNSAdmin = {
        init(options) {
            adminApi = options.api;
            refresh = options.refresh ?? (() => {});
            el.panel = $("admin-panel");
            el.summary = $("admin-summary");
            el.error = $("admin-error");
            el.joinQr = $("join-qr");
            el.joinUrl = $("join-url");
            el.teamSize = $("team-size");
            el.makeTeams = $("admin-make-teams");
            el.disband = $("admin-disband");
            el.clear = $("admin-clear");
            el.board = $("board-groups");
            el.results = $("results-list");
            el.debug = $("debug-toggle");
            el.debugOptions = {
                debugNoHide: $("debug-no-hide"),
                debugAllQuestions: $("debug-all-questions"),
                debugFakeLocation: $("debug-fake-location"),
            };
            el.discordUrl = $("discord-url");
            el.discordSave = $("discord-save");
            el.todos = $("todo-list");

            wireBoard();
            el.makeTeams.addEventListener("click", async () => {
                const size = Number(el.teamSize.value);
                el.makeTeams.disabled = true;
                const data = await adminAction("/admin/make-teams", { size });
                el.makeTeams.disabled = false;
                if (data) el.error.textContent = "";
            });
            el.disband.addEventListener("click", () => {
                if (confirm("Disband every team? Rounds in progress are thrown away. Results are kept.")) {
                    adminAction("/admin/disband");
                }
            });
            el.clear.addEventListener("click", () => {
                if (confirm("Delete EVERY player account, all teams and all results? This cannot be undone.")) {
                    adminAction("/admin/clear");
                }
            });
            el.debug.addEventListener("change", () => {
                adminAction("/admin/settings", { debug: el.debug.checked });
            });
            for (const [name, box] of Object.entries(el.debugOptions)) {
                box.addEventListener("change", () => adminAction("/admin/settings", { [name]: box.checked }));
            }
            const saveDiscord = () => {
                el.discordUrl.blur(); // let the next poll write the server's value back
                adminAction("/admin/settings", { discordUrl: el.discordUrl.value.trim() });
            };
            el.discordSave.addEventListener("click", saveDiscord);
            el.discordUrl.addEventListener("keydown", (e) => {
                if (e.key === "Enter") saveDiscord();
            });
            el.todos.addEventListener("change", (e) => {
                const box = e.target.closest?.("input[data-todo]");
                if (!box) return;
                const done = new Set(state?.settings?.todosDone ?? []);
                if (box.checked) done.add(box.dataset.todo);
                else done.delete(box.dataset.todo);
                adminAction("/admin/settings", { todosDone: [...done] });
            });
            setInterval(tickClocks, 1000);
            renderJoinQr();
        },

        /** Called after every /state poll while an admin is logged in. */
        render(next, at) {
            state = next;
            receivedAt = at;
            renderSummary();
            renderResults();
            renderSettings();
            // Don't rebuild the board mid-drag (or while a press may be about to
            // become one); the next poll will catch up.
            if (!isDragging()) renderBoard();
        },
    };
})();
