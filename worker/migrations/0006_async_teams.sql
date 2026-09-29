-- Asynchronous teams: every team runs its own game on its own clock.
--
-- Before: one global `game` row, groups drawn at the moment the game started,
-- and every group hunting on the same timer. Now the admin sets teams up ahead
-- of time, and each team presses Start whenever it is ready: 10 minutes to
-- hide, then a question every 5 minutes, and question 7 never comes (the hider
-- wins). Rounds that finish are kept in `rounds` for the results list.
--
-- Run with: npm run db:migrate   (or db:migrate:local)
-- Run it BEFORE deploying the worker that reads these tables.
--
-- migrate.mjs runs EVERY migration on every run, so nothing here may destroy
-- data on a second pass: only CREATE ... IF NOT EXISTS, ADD COLUMN (a repeat
-- reports "duplicate column" and is skipped) and INSERT OR IGNORE.
--
-- The old `game`, `catches` and `activity_cache` tables are left where they
-- are, unused, so the previous worker can still be rolled back to. Drop them
-- once the event is over.

-- One row per team. `id` is the same number as users.group_id.
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

-- Which question (1-6) a batch was dealt as. Batches no longer have a variable
-- countdown: the team clock says when the next one is due, so remaining_ms,
-- rate, rate_updated_at and activity are left over from the old timer.
ALTER TABLE card_batches ADD COLUMN question INTEGER;

-- One batch per question per team, even when two teammates poll at the very
-- moment it is dealt (old batches have no question and never collide).
CREATE UNIQUE INDEX IF NOT EXISTS idx_batches_question ON card_batches(group_id, question);

-- Which question a play answered, and when the hider last corrected it.
ALTER TABLE card_plays ADD COLUMN question INTEGER;
ALTER TABLE card_plays ADD COLUMN edited_at INTEGER;

-- Players who were already grouped by the old worker keep their team.
INSERT OR IGNORE INTO teams (id, status, created_at)
SELECT DISTINCT group_id, 'ready', 0 FROM users WHERE group_id IS NOT NULL;

-- Cards from the old global game belong to no round of the new one. They are
-- the only rows without a question number, so this is a no-op on a re-run.
DELETE FROM card_plays WHERE question IS NULL;
DELETE FROM card_batches WHERE question IS NULL;
