-- Live presence for the admin board: how precise a player's fix is, how slow
-- their connection is, and when their device last checked in.
-- Run with: npm run db:migrate:presence   (or db:migrate:presence:local)
-- Run it BEFORE deploying the worker that reads these columns.
-- Safe to run only once: ALTER TABLE ADD COLUMN fails if the column exists.

-- GPS accuracy radius in metres, as reported by the browser. NULL = unknown.
ALTER TABLE users ADD COLUMN location_accuracy REAL;
-- Round trip of the client's recent sync requests, in ms (smoothed).
ALTER TABLE users ADD COLUMN net_rtt_ms INTEGER;
-- Last /location heartbeat. NULL after logout.
ALTER TABLE users ADD COLUMN last_seen_at INTEGER;
