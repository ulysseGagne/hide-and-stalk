-- "Which part of <building> are you closest to?": the stalker names the
-- building when sending the card. It is kept with the play, so the hider, the
-- map and the hints all know whose sections the question is about.
--
-- Run with: npm run db:migrate   (or db:migrate:local)
-- Run it BEFORE deploying the worker that reads it. Safe to run again: a
-- repeat reports "duplicate column" and is skipped.

ALTER TABLE card_plays ADD COLUMN target TEXT;
