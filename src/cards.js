/* global HNSHints, HNSMap, L */

// Card UI: the stalkers' batch of three (and what happens once one is sent),
// the hider's questions and answers, the shared history, and the header bell.
//
// The server owns every rule (what is dealt, who may pick, when the next
// question comes). This file only draws it and posts the actions back. The
// clock itself lives in the status card at the top of the home screen (app.js).

const CATEGORY_LABELS = {
    direction: "Direction",
    radius: "Distance",
    proximity: "Proximity",
    context: "Surroundings",
    photo: "Photo",
};

const ANSWER_LABELS = {
    radio: "Multiple choice",
    choice: "Multiple choice",
    checkbox: "Select all that apply",
    text: "Written answer",
    number: "A number",
    coords: "Your exact position",
    photo: "Photo",
};

// Photos are stored inline in D1, so they get shrunk hard before upload.
const PHOTO_MAX_DIMENSION = 1024;
const PHOTO_QUALITY_STEPS = [0.7, 0.55, 0.4];
const PHOTO_MAX_CHARS = 400_000;

let cardsApi = null;
let onChanged = () => {};
let onCue = () => {};
let catalog = null;
let catalogPromise = null;

let cardsState = null; // /state -> cards
let teamState = null; // /state -> team
let hiderName = null;
let picking = false;

// ---------------------------------------------------------------------------
// Elements
// ---------------------------------------------------------------------------
const el = {};
function cacheElements() {
    el.bell = document.getElementById("bell");
    el.bellCount = document.getElementById("bell-count");
    el.stalkerCards = document.getElementById("stalker-cards");
    el.cardRow = document.getElementById("card-row");
    el.sentCard = document.getElementById("sent-card");
    el.sentPrompt = document.getElementById("sent-prompt");
    el.sentAnswer = document.getElementById("sent-answer");
    el.sentPhoto = document.getElementById("sent-photo");
    el.cardNote = document.getElementById("card-note");
    el.cardError = document.getElementById("card-error");
    el.historyBtn = document.getElementById("history-btn");
    el.historyCount = document.getElementById("history-count");
    el.hiderQuestions = document.getElementById("hider-questions");
    el.hiderList = document.getElementById("hider-question-list");
    el.hiderAnswers = document.getElementById("hider-answers");
    el.hiderAnswerList = document.getElementById("hider-answer-list");
    el.modal = document.getElementById("history-modal");
    el.modalList = document.getElementById("history-list");
    el.modalClose = document.getElementById("history-close");
    el.hintStatus = document.getElementById("hint-status");
}

const escapeCardHtml = (str) =>
    String(str).replace(
        /[&<>"']/g,
        (c) =>
            ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );

const cardById = (id) => catalog?.cards.find((c) => c.id === id) ?? null;

const formatLatLng = (lat, lng) => `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;

/** Human-readable answer for the history / question lists. */
function describeAnswer(card, answer) {
    if (answer === null || answer === undefined) return null;
    if (card?.answer.type === "photo") return "Photo";
    if (card?.answer.type === "choice") {
        const group = catalog?.landmarkGroups[card.answer.group];
        return group?.places.find((p) => p.id === answer)?.label ?? String(answer);
    }
    if (card?.answer.type === "coords") {
        return Number.isFinite(answer?.lat) && Number.isFinite(answer?.lng)
            ? formatLatLng(answer.lat, answer.lng)
            : "No position";
    }
    if (Array.isArray(answer)) return answer.join(", ");
    if (card?.answer.type === "number") {
        return `${answer} ${card.answer.unit}`;
    }
    return String(answer);
}

const timeAgo = (ts) => {
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
};

const questionLabel = (play) => (play?.question ? `Question ${play.question}` : "Question");

// Photos only change when the hider re-answers, so fetch each version once.
const photoCache = new Map(); // `${playId}:${answeredAt}` -> Promise<dataUrl>
function loadPhoto(play) {
    const key = `${play.id}:${play.answeredAt}`;
    if (!photoCache.has(key)) {
        photoCache.set(
            key,
            cardsApi(`/cards/photo?playId=${play.id}`).then(({ photo }) => photo),
        );
    }
    return photoCache.get(key);
}

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------
async function ensureCatalog() {
    if (catalog) return catalog;
    if (!catalogPromise) {
        catalogPromise = cardsApi("/cards/catalog")
            .then((data) => {
                catalog = data;
                HNSHints.setCatalog(data);
                // Lets the campus overlays name the cards each place answers.
                HNSMap.setCardCatalog(data);
                return data;
            })
            .catch((err) => {
                catalogPromise = null;
                throw err;
            });
    }
    return catalogPromise;
}

// ---------------------------------------------------------------------------
// Stalker: the batch of three, then the sent card
// ---------------------------------------------------------------------------
function makeCardFace(card, { disabled }) {
    const node = document.createElement("button");
    node.type = "button";
    node.className = "card";
    node.dataset.category = card.category;
    node.dataset.cardId = card.id;
    node.disabled = disabled;
    const hintBadge = card.hint
        ? '<span class="card-badge hint">Narrows the map</span>'
        : "";
    node.innerHTML = `
        <span class="card-category">${escapeCardHtml(CATEGORY_LABELS[card.category] ?? card.category)}</span>
        <span class="card-prompt">${escapeCardHtml(card.prompt)}</span>
        <span class="card-foot">
            <span class="card-badge">${escapeCardHtml(ANSWER_LABELS[card.answer.type] ?? "")}</span>
            ${hintBadge}
        </span>`;
    return node;
}

let renderedBatchKey = null;
let renderedSentKey = null;

function renderStalker(cards) {
    const batch = cards.batch;
    const paused = Boolean(teamState?.paused);
    const hider = hiderName ?? "your hider";

    // No batch: still hiding, or the round is over. The status card says which.
    if (!batch) {
        el.cardRow.hidden = true;
        el.sentCard.hidden = true;
        renderedBatchKey = null;
        renderedSentKey = null;
        el.cardNote.textContent = "";
        return;
    }

    if (!batch.playedCardId) {
        // Three face-up cards. Polls land every few seconds; rebuilding the
        // row each time would fight whatever the stalker is in the middle of
        // tapping, so only a new batch (or a pause) redraws it.
        el.sentCard.hidden = true;
        renderedSentKey = null;
        el.cardRow.hidden = false;
        const key = `${batch.id}:${paused}`;
        if (key !== renderedBatchKey) {
            renderedBatchKey = key;
            el.cardRow.innerHTML = "";
            for (const cardId of batch.cardIds) {
                const card = cardById(cardId);
                if (!card) continue;
                el.cardRow.appendChild(makeCardFace(card, { disabled: picking || paused }));
            }
        }
        el.cardNote.textContent = paused
            ? "The admin has paused your team."
            : "Tap one to send it. The other two disappear.";
        return;
    }

    // Sent: the other two are gone, and the one that went out is stamped so
    // nobody wonders whether they still have to do something.
    renderedBatchKey = null;
    el.cardRow.hidden = true;
    el.cardRow.innerHTML = "";
    el.sentCard.hidden = false;
    const play = cards.currentPlay;
    const card = cardById(batch.playedCardId);
    el.sentPrompt.textContent = card?.prompt ?? "";
    const key = `${batch.id}:${play?.answeredAt ?? ""}`;
    if (key === renderedSentKey) return;
    renderedSentKey = key;
    const sender = play?.askedByName ? `${play.askedByName} sent it. ` : "";
    if (!play || play.answer === null) {
        el.sentCard.dataset.state = "waiting";
        el.sentAnswer.textContent = `Waiting for ${hider} to answer…`;
        el.sentPhoto.hidden = true;
        el.cardNote.textContent = `${sender}Nothing else to do until the next question.`;
        return;
    }
    el.sentCard.dataset.state = "answered";
    const answerText = describeAnswer(card, play.answer);
    el.sentAnswer.textContent = `${hider}: ${answerText}${play.editedAt ? " (changed)" : ""}`;
    el.cardNote.textContent = card?.hint
        ? "The map has been updated with this answer."
        : "Nothing else to do until the next question.";
    el.sentPhoto.hidden = true;
    if (play.hasPhoto) {
        loadPhoto(play)
            .then((photo) => {
                if (renderedSentKey !== key) return;
                el.sentPhoto.src = photo;
                el.sentPhoto.hidden = false;
            })
            .catch(() => {
                /* the history view says so if it still fails there */
            });
    }
}

// ---------------------------------------------------------------------------
// Hider: answering
// ---------------------------------------------------------------------------
const metresBetween = (a, b) => L.latLng(a.lat, a.lng).distanceTo(L.latLng(b.lat, b.lng));

const formatMetres = (m) => (m < 1000 ? `${Math.round(m / 5) * 5} m` : `${(m / 1000).toFixed(1)} km`);

/**
 * The options for a "which X are you closest to?" card. Only the places still
 * possible given the map come first, nearest first, so the hider is not
 * scrolling through two dozen bus stops; the rest sit behind "Show more" in
 * case an earlier answer was wrong.
 */
function choiceOptions(spec) {
    const places = catalog?.landmarkGroups[spec.group]?.places ?? [];
    const pos = HNSMap.getPosition();
    const options = places.map((p) => ({
        value: p.id,
        label: p.label,
        distance: pos && Number.isFinite(p.lat) ? metresBetween(pos, p) : null,
    }));
    if (pos) options.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
    const possible = HNSHints.possiblePlaceIds(spec.group);
    if (!possible) return { first: options, more: [] };
    const first = options.filter((o) => possible.has(o.value));
    if (!first.length) return { first: options, more: [] };
    return { first, more: options.filter((o) => !possible.has(o.value)) };
}

function optionLabel(type, name, opt) {
    const label = document.createElement("label");
    label.className = "answer-option";
    const input = document.createElement("input");
    input.type = type;
    input.name = name;
    input.value = opt.value;
    const span = document.createElement("span");
    span.textContent = opt.label;
    label.append(input, span);
    if (opt.distance !== null && opt.distance !== undefined) {
        const dist = document.createElement("span");
        dist.className = "answer-distance";
        dist.textContent = formatMetres(opt.distance);
        label.appendChild(dist);
    }
    return label;
}

let widgetSerial = 0;

function answerWidget(card, form) {
    const spec = card.answer;
    const wrap = document.createElement("div");
    wrap.className = "answer-widget";
    // Radio groups are named per form, so an edit form never steals the
    // selection of a question form on the same page.
    const name = `answer-${card.id}-${++widgetSerial}`;

    switch (spec.type) {
        case "choice": {
            const { first, more } = choiceOptions(spec);
            for (const opt of first) wrap.appendChild(optionLabel("radio", name, opt));
            if (more.length) {
                const showMore = document.createElement("button");
                showMore.type = "button";
                showMore.className = "answer-more";
                showMore.textContent = `Not in the list? Show ${more.length} more`;
                showMore.addEventListener("click", () => {
                    for (const opt of more) wrap.insertBefore(optionLabel("radio", name, opt), showMore);
                    showMore.remove();
                });
                wrap.appendChild(showMore);
            }
            break;
        }
        case "radio":
        case "checkbox": {
            const type = spec.type === "checkbox" ? "checkbox" : "radio";
            for (const o of spec.options ?? []) {
                wrap.appendChild(optionLabel(type, name, { value: o, label: o }));
            }
            break;
        }
        case "text": {
            const input = document.createElement("input");
            input.type = "text";
            input.className = "answer-input";
            input.maxLength = 280;
            input.placeholder = spec.placeholder ?? "";
            wrap.appendChild(input);
            break;
        }
        case "number": {
            const input = document.createElement("input");
            input.type = "number";
            input.className = "answer-input";
            input.min = spec.min;
            input.max = spec.max;
            input.step = "1";
            input.inputMode = "numeric";
            input.placeholder = spec.unit;
            wrap.appendChild(input);
            break;
        }
        case "coords": {
            // No typing: the hider hands over the fix their own phone has, so
            // there is nothing to mistype and nothing to quietly fudge.
            const row = document.createElement("div");
            row.className = "answer-coords";
            const button = document.createElement("button");
            button.type = "button";
            button.className = "admin-btn";
            button.textContent = "Use my current location";
            const readout = document.createElement("output");
            readout.className = "answer-coords-readout";
            readout.textContent = "No position yet";
            button.addEventListener("click", async () => {
                button.disabled = true;
                setFormError(form, "");
                const problem = await HNSMap.requestLocation();
                const pos = HNSMap.getPosition();
                if (pos) {
                    form.dataset.lat = String(pos.lat);
                    form.dataset.lng = String(pos.lng);
                    readout.textContent = `${formatLatLng(pos.lat, pos.lng)} (±${Math.round(
                        pos.accuracy,
                    )} m)`;
                } else {
                    setFormError(
                        form,
                        problem === "denied" || problem === "blocked"
                            ? "Your browser is blocking location for this site"
                            : "Could not get a position — try again outside",
                    );
                }
                button.disabled = false;
            });
            row.append(button, readout);
            wrap.appendChild(row);
            break;
        }
        case "photo": {
            const input = document.createElement("input");
            input.type = "file";
            input.className = "answer-file";
            input.accept = "image/*";
            input.capture = "environment";
            const preview = document.createElement("img");
            preview.className = "answer-preview";
            preview.hidden = true;
            input.addEventListener("change", async () => {
                const file = input.files?.[0];
                if (!file) return;
                form.dataset.busy = "1";
                try {
                    const dataUrl = await downscalePhoto(file);
                    form.dataset.photo = dataUrl;
                    preview.src = dataUrl;
                    preview.hidden = false;
                } catch (err) {
                    console.error(err);
                    setFormError(form, "Could not read that image");
                } finally {
                    delete form.dataset.busy;
                }
            });
            wrap.append(input, preview);
            break;
        }
        default:
            break;
    }
    return wrap;
}

/** Shrink a camera photo until it fits in a D1 row. */
async function downscalePhoto(file) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    let width = Math.round(bitmap.width * scale);
    let height = Math.round(bitmap.height * scale);
    for (let attempt = 0; attempt < PHOTO_QUALITY_STEPS.length + 2; attempt++) {
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
        const quality = PHOTO_QUALITY_STEPS[Math.min(attempt, PHOTO_QUALITY_STEPS.length - 1)];
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        if (dataUrl.length <= PHOTO_MAX_CHARS) return dataUrl;
        // Still too big: shrink it and try again.
        width = Math.round(width * 0.75);
        height = Math.round(height * 0.75);
    }
    throw new Error("Could not shrink the photo enough");
}

function setFormError(form, message) {
    const p = form.querySelector(".answer-error");
    if (p) p.textContent = message ?? "";
}

function readAnswer(card, form) {
    const spec = card.answer;
    switch (spec.type) {
        case "radio":
        case "choice": {
            const picked = form.querySelector("input:checked");
            return picked ? picked.value : null;
        }
        case "checkbox": {
            const picked = [...form.querySelectorAll("input:checked")].map((i) => i.value);
            return picked.length ? picked : null;
        }
        case "text": {
            const value = form.querySelector(".answer-input").value.trim();
            return value || null;
        }
        case "number": {
            const value = form.querySelector(".answer-input").value;
            return value === "" ? null : Number(value);
        }
        case "coords": {
            const lat = Number(form.dataset.lat);
            const lng = Number(form.dataset.lng);
            return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
        }
        case "photo":
            return form.dataset.photo || null;
        default:
            return null;
    }
}

/**
 * The asking stalker's position, with a button that copies it. Paste straight
 * into Google Maps to read the walking time off a real route.
 */
function askerLocationRow(play) {
    const row = document.createElement("div");
    row.className = "asker-location";
    const text = formatLatLng(play.askLat, play.askLng);

    const label = document.createElement("span");
    label.className = "asker-location-text";
    label.textContent = `They asked from ${text}`;

    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "admin-btn";
    copy.textContent = "Copy stalker's location";
    copy.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(text);
            copy.textContent = "Copied";
        } catch {
            // No clipboard permission (or no clipboard at all): the coordinates
            // are on screen anyway, so just say so.
            copy.textContent = "Copy failed — select it above";
        }
        setTimeout(() => {
            copy.textContent = "Copy stalker's location";
        }, 2000);
    });

    const maps = document.createElement("a");
    maps.className = "admin-btn";
    maps.target = "_blank";
    maps.rel = "noopener";
    maps.href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(text)}&travelmode=walking`;
    maps.textContent = "Open in Google Maps";

    row.append(label, copy, maps);
    return row;
}

/**
 * One answer form: the question, the input it calls for, and a submit button.
 * Used both for a new question and for correcting an answer already given.
 */
function answerForm(play, card, { submitLabel, onCancel }) {
    const form = document.createElement("form");
    form.className = "question-card";
    form.dataset.playId = String(play.id);

    const head = document.createElement("div");
    head.className = "question-head";
    head.innerHTML = `<span class="card-category">${escapeCardHtml(
        CATEGORY_LABELS[card.category] ?? card.category,
    )}</span><span class="question-meta">${escapeCardHtml(questionLabel(play))} · from ${escapeCardHtml(
        play.askedByName ?? "a stalker",
    )} · ${escapeCardHtml(timeAgo(play.askedAt))}</span>`;

    const prompt = document.createElement("p");
    prompt.className = "question-prompt";
    prompt.textContent = card.prompt;

    const parts = [head, prompt];
    // "How long would it take me to walk to you?" is unanswerable without
    // knowing where "me" is, so hand over the position frozen at play time.
    if (card.hint?.type === "walkTime" && Number.isFinite(play.askLat)) {
        parts.push(askerLocationRow(play));
    }

    const actions = document.createElement("div");
    actions.className = "question-actions";
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "admin-btn primary";
    submit.textContent = submitLabel;
    actions.appendChild(submit);
    if (onCancel) {
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "admin-btn";
        cancel.textContent = "Cancel";
        cancel.addEventListener("click", onCancel);
        actions.appendChild(cancel);
    }

    const error = document.createElement("p");
    error.className = "auth-error answer-error";

    form.append(...parts, answerWidget(card, form), actions, error);
    form.addEventListener("submit", (e) => submitAnswer(e, card, form, submit));
    return form;
}

// Forms currently on screen, by play id. A poll arrives every few seconds and
// must not wipe a half-typed answer or a photo the hider just attached, so
// existing forms are left strictly alone.
const openForms = new Map();

function renderHiderQuestions(cards) {
    const wanted = new Set(cards.pending.map((p) => p.id));
    for (const [playId, form] of openForms) {
        if (!wanted.has(playId)) {
            form.remove();
            openForms.delete(playId);
        }
    }
    let empty = el.hiderList.querySelector(".questions-empty");
    if (!cards.pending.length) {
        if (!empty) {
            empty = document.createElement("p");
            empty.className = "muted questions-empty";
            el.hiderList.appendChild(empty);
        }
        empty.textContent = cards.answeredCount
            ? "All answered. The next question comes with the timer at the top."
            : "No question yet. The first one comes when the hunt starts.";
        return;
    }
    empty?.remove();
    for (const play of cards.pending) {
        if (openForms.has(play.id)) continue;
        const card = cardById(play.cardId);
        if (!card) continue;
        const form = answerForm(play, card, { submitLabel: "Send answer" });
        el.hiderList.appendChild(form);
        openForms.set(play.id, form);
    }
}

// The answer being corrected, if any; its row is left alone while it is open.
let editingPlayId = null;
let renderedAnswersKey = null;

function renderHiderAnswers(cards) {
    const answered = [...(cards.answered ?? [])].reverse(); // newest first
    el.hiderAnswers.hidden = !answered.length;
    const key = answered.map((p) => `${p.id}:${p.answeredAt}`).join("|");
    if (editingPlayId !== null) {
        // The form is open: only drop it if its question vanished (new round).
        if (answered.some((p) => p.id === editingPlayId)) return;
        editingPlayId = null;
    }
    if (key === renderedAnswersKey) return;
    renderedAnswersKey = key;
    el.hiderAnswerList.innerHTML = "";
    for (const play of answered) {
        const card = cardById(play.cardId);
        if (!card) continue;
        const row = document.createElement("div");
        row.className = "answer-row";
        const text = document.createElement("div");
        text.className = "answer-row-text";
        text.innerHTML = `<span class="question-meta">${escapeCardHtml(questionLabel(play))}</span>
            <span class="answer-row-prompt">${escapeCardHtml(card.prompt)}</span>
            <strong class="answer-row-answer">${escapeCardHtml(describeAnswer(card, play.answer) ?? "")}${
                play.editedAt ? ' <span class="changed-mark">changed</span>' : ""
            }</strong>`;
        const change = document.createElement("button");
        change.type = "button";
        change.className = "admin-btn";
        change.textContent = "Change";
        change.addEventListener("click", () => {
            editingPlayId = play.id;
            const form = answerForm(play, card, {
                submitLabel: "Save new answer",
                onCancel: () => {
                    editingPlayId = null;
                    renderedAnswersKey = null;
                    renderHiderAnswers(cardsState);
                },
            });
            form.classList.add("editing");
            row.replaceWith(form);
        });
        row.append(text, change);
        el.hiderAnswerList.appendChild(row);
    }
}

async function submitAnswer(event, card, form, submit) {
    event.preventDefault();
    setFormError(form, "");
    if (form.dataset.busy) {
        setFormError(form, "Still processing the photo...");
        return;
    }
    const answer = readAnswer(card, form);
    if (answer === null) {
        setFormError(form, "Answer the question first");
        return;
    }
    submit.disabled = true;
    try {
        await cardsApi("/cards/answer", {
            method: "POST",
            body: { playId: Number(form.dataset.playId), answer },
        });
        if (form.classList.contains("editing")) {
            editingPlayId = null;
            renderedAnswersKey = null;
        }
        onChanged();
    } catch (err) {
        setFormError(form, err.status === undefined ? "Could not reach the server" : err.message);
        submit.disabled = false;
    }
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------
async function openHistory() {
    el.modal.hidden = false;
    el.modalList.innerHTML = '<p class="muted">Loading...</p>';
    try {
        const { plays } = await cardsApi("/cards/history");
        renderHistory(plays);
    } catch (err) {
        el.modalList.innerHTML = `<p class="auth-error">${escapeCardHtml(
            err.status === undefined ? "Could not reach the server" : err.message,
        )}</p>`;
    }
}

function renderHistory(plays) {
    el.modalList.innerHTML = "";
    if (!plays.length) {
        el.modalList.innerHTML =
            '<p class="muted">No questions asked yet.</p>';
        return;
    }
    for (const play of plays) {
        const card = cardById(play.cardId);
        const row = document.createElement("article");
        row.className = "history-row";
        row.dataset.category = card?.category ?? "";

        const answered = play.answeredAt !== null;
        const answerText = describeAnswer(card, play.answer);
        row.innerHTML = `
            <header class="history-head">
                <span class="card-category">${escapeCardHtml(
                    CATEGORY_LABELS[card?.category] ?? "Card",
                )}</span>
                <span class="question-meta">${escapeCardHtml(questionLabel(play))} · ${escapeCardHtml(
                    play.askedByName ?? "?",
                )} · ${escapeCardHtml(timeAgo(play.askedAt))}</span>
            </header>
            <p class="history-prompt">${escapeCardHtml(card?.prompt ?? play.cardId)}</p>
            <p class="history-answer ${answered ? "" : "pending"}">${
                answered ? escapeCardHtml(answerText) : "Waiting for the hider..."
            }${answered && play.editedAt ? ' <span class="changed-mark">changed</span>' : ""}</p>`;

        if (answered && play.hasPhoto) {
            const img = document.createElement("img");
            img.className = "history-photo";
            img.alt = card?.short ?? "Photo answer";
            img.loading = "lazy";
            loadPhoto(play)
                .then((photo) => {
                    img.src = photo;
                })
                .catch(() => {
                    img.replaceWith(
                        Object.assign(document.createElement("p"), {
                            className: "muted",
                            textContent: "Photo could not be loaded",
                        }),
                    );
                });
            row.appendChild(img);
        }
        if (answered && card?.hint) {
            const badge = document.createElement("span");
            badge.className = "card-badge hint";
            badge.textContent = "On the map";
            row.appendChild(badge);
        }
        el.modalList.appendChild(row);
    }
}

// ---------------------------------------------------------------------------
// Bell
// ---------------------------------------------------------------------------
function renderBell(cards) {
    const unread = cards?.unread ?? 0;
    el.bell.hidden = !cards;
    el.bell.classList.toggle("ringing", unread > 0);
    el.bellCount.hidden = unread === 0;
    el.bellCount.textContent = unread > 99 ? "99+" : String(unread);
    el.bell.title = !cards
        ? "Notifications"
        : cards.role === "hider"
          ? unread
              ? `${unread} question${unread === 1 ? "" : "s"} waiting for your answer`
              : "No questions waiting"
          : unread
            ? `${unread} new answer${unread === 1 ? "" : "s"} from your hider`
            : "No new answers";
}

async function bellClicked() {
    const role = cardsState?.role;
    if (role === "stalker") {
        await openHistory();
        try {
            await cardsApi("/cards/seen", { method: "POST" });
            onChanged();
        } catch {
            /* the badge will clear on the next successful poll */
        }
    } else if (role === "hider") {
        document.querySelector('.view-tab[data-view="menu"]')?.click();
        el.hiderQuestions?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

// ---------------------------------------------------------------------------
// Hints status line
// ---------------------------------------------------------------------------
function renderHintStatus(status) {
    if (!el.hintStatus) return;
    if (!status?.ready) {
        el.hintStatus.textContent = "";
        return;
    }
    if (status.contradiction) {
        el.hintStatus.textContent =
            "The answers so far cannot all be true — check the questions so far for a mistake.";
        el.hintStatus.dataset.tone = "warn";
        return;
    }
    el.hintStatus.textContent = status.applied
        ? `${status.applied} answer${status.applied === 1 ? " is" : "s are"} narrowing the map.`
        : "";
    el.hintStatus.dataset.tone = "muted";
}

// ---------------------------------------------------------------------------
// "A new question is here": the one moment everyone should look at their phone
// ---------------------------------------------------------------------------
let cueKey = null;

function checkCue(cards) {
    // Stalkers: a new batch. Hider: a question they had not seen yet.
    const key =
        cards?.role === "stalker"
            ? `s:${cards.batch?.id ?? ""}`
            : cards?.role === "hider"
              ? `h:${cards.pending.map((p) => p.id).join(",")}`
              : null;
    const previous = cueKey;
    cueKey = key;
    // Nothing to compare with on the first poll after loading the page.
    if (previous === null || key === null || key === previous) return;
    if (cards.role === "stalker" && cards.batch) {
        onCue("New question! Pick one.");
    } else if (cards.role === "hider") {
        const before = new Set(previous.slice(2).split(",").filter(Boolean));
        if (cards.pending.some((p) => !before.has(String(p.id)))) {
            onCue("New question for you!");
        }
    }
}

// ---------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------
window.HNSCards = {
    init(options) {
        cardsApi = options.api;
        onChanged = options.onChanged ?? (() => {});
        onCue = options.onCue ?? (() => {});
        cacheElements();
        el.bell.addEventListener("click", bellClicked);
        el.historyBtn.addEventListener("click", openHistory);
        el.modalClose.addEventListener("click", () => {
            el.modal.hidden = true;
        });
        el.modal.addEventListener("click", (e) => {
            if (e.target === el.modal) el.modal.hidden = true;
        });
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") el.modal.hidden = true;
        });
        el.cardRow.addEventListener("click", (e) => {
            const node = e.target.closest?.(".card[data-card-id]");
            if (node && !node.disabled) pickCard(node.dataset.cardId);
        });
        HNSHints.onStatus(renderHintStatus);
    },

    /** Called after every /state poll. */
    async render(state) {
        const cards = state?.cards ?? null;
        cardsState = cards;
        teamState = state?.team ?? null;
        hiderName = state?.users?.find((u) => u.role === "hider")?.username ?? null;
        // Nothing to show a stalker until the hunt starts; afterwards the
        // panel stays for its "Questions so far" recap.
        el.stalkerCards.hidden = !(
            cards?.role === "stalker" &&
            (teamState?.phase === "hunting" || teamState?.phase === "ended")
        );
        el.hiderQuestions.hidden = !(cards?.role === "hider" && teamState?.phase === "hunting");
        renderBell(cards);

        if (!cards) {
            HNSHints.setPlays([]);
            HNSMap.setAskOverlays([]);
            el.hiderAnswers.hidden = true;
            cueKey = null;
            return;
        }
        try {
            await ensureCatalog();
        } catch {
            el.cardNote.textContent = "Could not load the questions. Retrying…";
            return;
        }

        // Both sides of the hunt see the same closing net and the same drawing
        // of whatever question is currently on the table.
        HNSHints.setPlays(cards.hints ?? []);
        HNSMap.setAskOverlays(
            cards.pending.map((p) => ({
                cardId: p.cardId,
                lat: p.askLat,
                lng: p.askLng,
            })),
        );

        if (cards.role === "stalker") {
            renderStalker(cards);
            el.historyCount.textContent = cards.historyCount
                ? ` (${cards.historyCount})`
                : "";
        } else {
            renderHiderQuestions(cards);
            renderHiderAnswers(cards);
        }
        checkCue(cards);
    },

    reset() {
        cardsState = null;
        teamState = null;
        renderedBatchKey = null;
        renderedSentKey = null;
        renderedAnswersKey = null;
        editingPlayId = null;
        cueKey = null;
        openForms.clear();
        photoCache.clear();
        el.hiderList.innerHTML = "";
        el.hiderAnswerList.innerHTML = "";
        el.hiderAnswers.hidden = true;
        el.cardRow.innerHTML = "";
        el.sentCard.hidden = true;
        HNSMap.setAskOverlays([]);
        el.modal.hidden = true;
        renderBell(null);
        HNSHints.setPlays([]);
    },
};

async function pickCard(cardId) {
    if (picking) return;
    picking = true;
    el.cardError.textContent = "";
    for (const node of el.cardRow.querySelectorAll(".card")) node.disabled = true;
    // Show it as sent straight away; the next poll confirms (or the error
    // below puts the three cards back).
    const chosen = el.cardRow.querySelector(`.card[data-card-id="${CSS.escape(cardId)}"]`);
    chosen?.classList.add("sending");
    try {
        await cardsApi("/cards/pick", { method: "POST", body: { cardId } });
    } catch (err) {
        el.cardError.textContent =
            err.status === undefined ? "Could not reach the server" : err.message;
        renderedBatchKey = null; // redraw the row enabled again
    } finally {
        picking = false;
        onChanged();
    }
}
