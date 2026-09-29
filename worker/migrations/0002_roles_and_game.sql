-- Upgrade an existing database created from the original schema.sql.
-- Run with: npm run db:migrate   (or db:migrate:local)
-- Safe to run only once: ALTER TABLE ADD COLUMN fails if the column exists.
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN group_id INTEGER;
ALTER TABLE users ADD COLUMN role TEXT;

CREATE TABLE IF NOT EXISTS game (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    status TEXT NOT NULL DEFAULT 'lobby',
    countdown_ends_at INTEGER,
    started_at INTEGER,
    paused_at INTEGER,
    paused_total_ms INTEGER NOT NULL DEFAULT 0,
    group_count INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO game (id, status) VALUES (1, 'lobby');

INSERT OR IGNORE INTO users (username, password_hash, salt, created_at, is_admin)
VALUES (
    'admin',
    'ce2f3105bd7c2b33ad4cbd2cc19f5ad4cf59ac9baf9d77a530d6f43844f36674',
    'db24d29ec0000a743a0fe4e83fe2a15a',
    0,
    1
);
UPDATE users SET is_admin = 1 WHERE username = 'admin';
