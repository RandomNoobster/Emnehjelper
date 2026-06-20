// Single source of truth for Karakterweb cache worker settings.
// If you change KARAKTERWEB_CACHE_ORIGIN, also update the matching host_permission in manifest.json.

const KARAKTERWEB_CACHE_ORIGIN = "https://emnehjelper-cache.kriosen03.workers.dev";
const KARAKTERWEB_CACHE_BASE = `${KARAKTERWEB_CACHE_ORIGIN}/v1/courses/ntnu`;
const KARAKTERWEB_CLIENT_HEADER = "emnehjelper-v1";

const KARAKTERWEB_PUBLIC_BASE = "https://karakterweb.no/ntnu";

// Karakterweb API: 120 req/min, HTTP 429 with body {"error":{"message":"Rate limit exceeded"}}.
// No Retry-After header is sent today; wait one full minute window before retrying.
// https://karakterweb.no/api-docs
const KARAKTERWEB_RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_ATTEMPTS = 4;
const RATE_LIMIT_MAX_WAIT_MS = 240_000;

function karakterwebCourseUrl(emnekode) {
  return `${KARAKTERWEB_PUBLIC_BASE}/${emnekode.toLowerCase()}`;
}
