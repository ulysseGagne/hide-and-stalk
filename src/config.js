// Base URL of the deployed Cloudflare Worker (see worker/README section in README.md).
// For local development run `npm run dev` inside worker/ and point this at it.

// When the page is served from localhost or a LAN address (i.e. `wrangler dev`
// on this machine, opened from this machine or from a phone on the same Wi-Fi),
// talk to the worker on that same host. Otherwise use the deployed worker.
const isLocalHost = /^(localhost|127\.0\.0\.1|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(
    location.hostname
);

window.HNS_CONFIG = {
    apiBase: isLocalHost
        ? `http://${location.hostname}:8787`
        : "https://hidenstalk-api.ulyssegagne.workers.dev",
    // How often (ms) a player syncs with the server: one request that sends
    // their position and brings back the game (questions, the map, everyone
    // else's pins). It is also the heartbeat the admin board's signal icon is
    // judged against. Every sync is a request and a database write, so this
    // is what decides whether a big game fits in Cloudflare's free tier.
    locationPollIntervalMs: 5_000,
    // Admins poll faster so the board's coordinates stay close to live.
    adminPollIntervalMs: 2_000,
};
