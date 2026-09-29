-- End of game: a scannable code per hider, a whole-game time limit, and the
-- record of who was caught by whom.
-- Run with: npm run db:migrate:endgame   (or db:migrate:endgame:local)
-- Run it BEFORE deploying the worker that reads these columns.
-- Safe to run only once: ALTER TABLE ADD COLUMN fails if the column exists.

-- How long a whole game lasts, in ms. Editable from the admin dashboard and
-- kept across resets, since it's a property of how this group likes to play.
ALTER TABLE game ADD COLUMN duration_ms INTEGER NOT NULL DEFAULT 3600000;
-- When the clock ran out or the last hider was found (status = 'ended').
ALTER TABLE game ADD COLUMN ended_at INTEGER;

-- What a hider's QR code encodes. Minted per game, so last game's screenshot
-- is worthless. NULL for admins and for anyone who has never played.
ALTER TABLE users ADD COLUMN catch_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_catch_code ON users(catch_code);

-- One row per group whose hider has been found. A group with no row here is
-- either still being hunted or, once the game has ended, a win for its hider.
CREATE TABLE IF NOT EXISTS catches (
    group_id INTEGER PRIMARY KEY,
    hider_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    -- Names are copied rather than joined so a result survives "Clear".
    hider_name TEXT,
    caught_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    caught_by_name TEXT,
    caught_at INTEGER NOT NULL
);
