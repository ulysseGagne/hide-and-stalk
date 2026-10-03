-- Every stalker has to pick the same card before a question can go out. Each
-- stalker's pick on a batch, one row per stalker per batch; the whole team
-- sees them, and /cards/send checks them.
--
-- Run with: npm run db:migrate   (or db:migrate:local)
-- Run it BEFORE deploying the worker that reads it. Safe to run again.

CREATE TABLE IF NOT EXISTS card_picks (
    batch_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    card_id TEXT NOT NULL,
    picked_at INTEGER NOT NULL,
    PRIMARY KEY (batch_id, user_id)
);
