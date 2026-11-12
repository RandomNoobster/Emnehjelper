// Single source of truth for Karakterweb cache worker settings.
// If you change KARAKTERWEB_CACHE_ORIGIN, also update the matching host_permission in manifest.json.
// Content scripts get this file from its own document_start entry in manifest.json, so it is
// evaluated once per page before course-page.js and course-list.js. Do not add it to those
// entries: their match patterns overlap on course pages, and re-evaluating these consts throws.

const KARAKTERWEB_CACHE_ORIGIN = "https://emnehjelper-cache.kriosen03.workers.dev";
const KARAKTERWEB_CACHE_BASE = `${KARAKTERWEB_CACHE_ORIGIN}/v1/courses/ntnu`;
// Must match CLIENT_HEADER / CLIENT_TOKEN in worker/src/index.js
const KARAKTERWEB_CLIENT_HEADER_NAME = "X-Emnehjelper-Client";
const KARAKTERWEB_CLIENT_TOKEN = "emnehjelper-v1";

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
