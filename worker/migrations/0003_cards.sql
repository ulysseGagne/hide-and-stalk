-- Cards: batches dealt to stalker groups, plays, answers, and the activity
-- cache that modulates the batch timer.
-- Run with: npm run db:migrate:cards   (or db:migrate:cards:local)

-- One row per batch of three cards dealt to a stalker group.
--
-- The countdown is NOT a fixed deadline: it drains at a variable `rate` set by
-- how exposed the group's hider currently is (busy area -> drains slower, so
-- the batch lasts longer). Readers advance it with
--   remaining_ms -= (now - rate_updated_at) * rate
-- and only write back when the rate changes, the batch is played, or it ends.
CREATE TABLE IF NOT EXISTS card_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL,
    -- JSON array of three card ids from the catalogue.
    card_ids TEXT NOT NULL,
    dealt_at INTEGER NOT NULL,
    remaining_ms INTEGER NOT NULL,
    rate REAL NOT NULL DEFAULT 1.0,
    rate_updated_at INTEGER NOT NULL,
    -- 0..1 heat under the hider when the rate was last computed; NULL = unknown.
    activity REAL,
    -- Set once a stalker picks; the other two are discarded unseen.
    played_card_id TEXT,
    played_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    played_at INTEGER,
    -- 1 once the countdown hit zero and the batch was replaced.
    closed INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_batches_group ON card_batches(group_id, closed);

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
    answered_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_plays_group ON card_plays(group_id, asked_at);

-- Overpass-derived "how public is this spot" scores, keyed by a coarse grid
-- cell so a moving hider doesn't hammer the API.
CREATE TABLE IF NOT EXISTS activity_cache (
    cell TEXT PRIMARY KEY,
    -- NULL until a lookup actually succeeds.
    activity REAL,
    fetched_at INTEGER,
    -- When we last *tried*, successful or not. Every reader would otherwise
    -- fire its own Overpass request while the cell is empty, which is a fast
    -- route to being rate limited into never succeeding at all.
    checked_at INTEGER NOT NULL
);

-- Everything in card_plays for this user's group answered after this stamp is
-- an unread notification (the bell in the header).
ALTER TABLE users ADD COLUMN cards_seen_at INTEGER NOT NULL DEFAULT 0;
