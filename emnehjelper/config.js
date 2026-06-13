// Single source of truth for Karakterweb cache worker settings.
// If you change KARAKTERWEB_CACHE_ORIGIN, also update the matching host_permission in manifest.json.

const KARAKTERWEB_CACHE_ORIGIN = "https://emnehjelper-cache.kriosen03.workers.dev";
const KARAKTERWEB_CACHE_BASE = `${KARAKTERWEB_CACHE_ORIGIN}/v1/courses/ntnu`;
const KARAKTERWEB_CLIENT_HEADER = "emnehjelper-v1";

const KARAKTERWEB_PUBLIC_BASE = "https://karakterweb.no/ntnu";

function karakterwebCourseUrl(emnekode) {
  return `${KARAKTERWEB_PUBLIC_BASE}/${emnekode.toLowerCase()}`;
}
