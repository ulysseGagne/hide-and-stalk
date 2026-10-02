CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    -- NULL when the user has not shared / refused to share their position.
    lat REAL,
    lng REAL,
    location_updated_at INTEGER,
    -- GPS accuracy radius in metres, as reported by the browser. NULL = unknown.
    location_accuracy REAL,
    -- Round trip of the client's recent sync requests, in ms (smoothed).
    net_rtt_ms INTEGER,
    -- Last /location heartbeat. NULL after logout.
    last_seen_at INTEGER,
    -- 1 for admins. Admins are never put in a team and survive "Clear".
    is_admin INTEGER NOT NULL DEFAULT 0,
    -- The player's team (teams.id), set by the admin. NULL while unassigned.
    group_id INTEGER,
    -- 'hider' | 'stalker' | NULL (unassigned / admin)
    role TEXT,
    -- Card answers newer than this stamp are unread notifications (header bell).
    cards_seen_at INTEGER NOT NULL DEFAULT 0,
    -- What this player's QR code encodes while they are a hider. Minted every
    -- time their team starts, so last round's screenshot is worthless.
    catch_code TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_catch_code ON users(catch_code);

CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- One row per team. `id` is the same number as users.group_id. Every team runs
-- its own game on its own clock (see worker/src/teams.js).
--   status: 'ready'   formed, waiting for someone on the team to press Start
--           'playing' started; hiding for hide_ms, then hunting
--           'ended'   the hider was found, or question 7 came first
CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'ready',
    -- When Start was pressed. The team clock runs from here, minus pauses.
    started_at INTEGER,
    -- Timer lengths, frozen at Start so flipping debug mode mid-round can't
    -- move a running team's clock.
    hide_ms INTEGER,
    interval_ms INTEGER,
    -- Set while the admin has this team paused.
    paused_at INTEGER,
    paused_total_ms INTEGER NOT NULL DEFAULT 0,
    -- How the current round ended (status = 'ended').
    ended_at INTEGER,
    -- 'seekers' (hider found) | 'hider' (question 7 came first)
    outcome TEXT,
    hider_name TEXT,
    caught_by_name TEXT,
    -- Hunting time before the catch: the hider's score.
    hunt_ms INTEGER,
    created_at INTEGER NOT NULL
);

-- Every finished round, kept across "Play again" so the longest hide can win.
-- Names are copied rather than joined so a result survives "Delete players".
CREATE TABLE IF NOT EXISTS rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,
    hider_name TEXT,
    -- 'seekers' | 'hider'
    outcome TEXT NOT NULL,
    caught_by_name TEXT,
    hunt_ms INTEGER NOT NULL,
    questions INTEGER NOT NULL DEFAULT 0,
    ended_at INTEGER NOT NULL
);

-- Admin switches, one row each: 'debug' ('0' | '1'), 'discord_url',
-- 'todos_done' (JSON array of to-do ids).
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
);

-- One row per batch of three cards dealt to a team: one per question, due every
-- interval_ms of hunting (the team clock says when; nothing here counts down).
CREATE TABLE IF NOT EXISTS card_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    -- JSON array of three card ids from the catalogue.
    card_ids TEXT NOT NULL,
    dealt_at INTEGER NOT NULL,
    -- Left over from the old variable-rate timer; written as 0 / 1.0 / dealt_at
    -- and never read. Kept so databases migrated from it line up with this one.
    remaining_ms INTEGER NOT NULL DEFAULT 0,
    rate REAL NOT NULL DEFAULT 1.0,
    rate_updated_at INTEGER NOT NULL DEFAULT 0,
    activity REAL,
    -- Set once a stalker picks; the other two are discarded unseen.
    played_card_id TEXT,
    played_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    played_at INTEGER,
    -- Left over from when an unsent batch expired with the next question;
    -- no longer written or read.
    closed INTEGER NOT NULL DEFAULT 0,
    -- Which question (1-6) this batch was dealt as.
    question INTEGER
);

CREATE INDEX IF NOT EXISTS idx_batches_group ON card_batches(group_id, closed);

-- One batch per question per team, even when two teammates poll at the very
-- moment it is dealt (old batches have no question and never collide).
CREATE UNIQUE INDEX IF NOT EXISTS idx_batches_question ON card_batches(group_id, question);

-- One row per card actually played, with the hider's answer.
CREATE TABLE IF NOT EXISTS card_plays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    batch_id INTEGER REFERENCES card_batches(id) ON DELETE SET NULL,
    card_id TEXT NOT NULL,
    asked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    asked_by_name TEXT,
    asked_at INTEGER NOT NULL,
    -- The asking stalker's position, frozen at play time. NULL for cards that
    -- are not relative to the asker.
    ask_lat REAL,
    ask_lng REAL,
    -- JSON-encoded answer value; NULL until the hider replies.
    answer TEXT,
    -- Photo answers only: a downscaled JPEG data URL, kept out of /state.
    photo TEXT,
    answered_at INTEGER,
    -- Which question (1-6) this was, and when the hider last corrected it.
    question INTEGER,
    edited_at INTEGER,
    -- What the stalker named when sending, for a card that asks for it (the
    -- building of "Which part of <building>...?": a building id). NULL otherwise.
    target TEXT
);

CREATE INDEX IF NOT EXISTS idx_plays_group ON card_plays(group_id, asked_at);

-- Permanent admin account (username "admin"). PBKDF2-SHA256, 100k iterations.
INSERT OR IGNORE INTO users (username, password_hash, salt, created_at, is_admin)
VALUES (
    'admin',
    'ce2f3105bd7c2b33ad4cbd2cc19f5ad4cf59ac9baf9d77a530d6f43844f36674',
    'db24d29ec0000a743a0fe4e83fe2a15a',
    0,
    1
);
UPDATE users SET is_admin = 1 WHERE username = 'admin';
