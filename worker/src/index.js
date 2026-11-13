const UPSTREAM = "https://api.karakterweb.no";
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;
// Courses Karakterweb does not have; shorter, so newly added courses show up within a day
const NOT_FOUND_CACHE_TTL_SECONDS = 60 * 60 * 24;
const CLIENT_HEADER = "X-Emnehjelper-Client";
const CLIENT_TOKEN = "emnehjelper-v1";

// Verified against https://karakterweb.no/api-docs and live upstream responses:
// 120 req/min, HTTP 429, no Retry-After header. Clients are told to wait one full window.
const DEFAULT_RETRY_AFTER_SECONDS = 60;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ ok: true });
    }

    if (request.method !== "GET") {
      return json({ error: "method_not_allowed" }, 405);
    }

    if (request.headers.get(CLIENT_HEADER) !== CLIENT_TOKEN) {
      return json({ error: "forbidden" }, 403);
    }

    const match = url.pathname.match(/^\/v1\/courses\/([^/]+)\/([^/]+)$/i);
    if (!match) {
      return json({ error: "not_found" }, 404);
    }

    const institute = match[1].toLowerCase();
    const courseCode = match[2].toLowerCase();
    const courseLabel = `${institute}/${courseCode}`;

    if (institute !== (env.ALLOWED_INSTITUTE || "ntnu").toLowerCase()) {
      return json({ error: "institute_not_supported" }, 404);
    }

    const cache = caches.default;
    const cacheKey = new Request(
      `https://cache.internal/${institute}/${courseCode}`,
      request
    );

    const cached = await cache.match(cacheKey);
    if (cached) {
      console.log(`Cache hit for ${courseLabel} (HTTP ${cached.status})`);
      return cached;
    }

    // Without the secret, the upstream call would send the literal string "undefined" as the key
    if (!env.KARAKTERWEB_API_KEY) {
      console.error("KARAKTERWEB_API_KEY secret is not configured");
      return json({ error: "upstream_not_configured" }, 500);
    }

    console.log(`Cache miss. Fetching ${courseLabel} from upstream`);

    const upstreamUrl = new URL(
      `/v1/courses/${institute}/${courseCode}`,
      UPSTREAM
    );
    upstreamUrl.searchParams.set("include", "grades,evaluations");
    upstreamUrl.searchParams.set("semester", "main");

    const upstream = await fetch(upstreamUrl, {
      headers: { "X-Client-Key": env.KARAKTERWEB_API_KEY },
    });

    if (upstream.status === 429) {
      // Do not wait out the limit here. Chrome stops the extension's service worker when a
      // fetch() response takes over 30 s, so the extension does the waiting and retrying.
      console.warn(`Upstream rate limited for ${courseLabel}`);
      return new Response(upstream.body, {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          // The client cannot see the upstream headers, so always tell it how long to back off
          "Retry-After":
            upstream.headers.get("Retry-After") ??
            String(DEFAULT_RETRY_AFTER_SECONDS),
        },
      });
    }

    if (!upstream.ok && upstream.status !== 404) {
      console.warn(`Upstream error for ${courseLabel}: HTTP ${upstream.status}`);
      return new Response(upstream.body, {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const isNotFound = upstream.status === 404;
    console.log(
      isNotFound
        ? `Course ${courseLabel} not found upstream`
        : `Successfully fetched ${courseLabel} (HTTP ${upstream.status})`
    );

    // Cache 404s too, so lookups of courses Karakterweb lacks do not spend the shared quota
    const ttlSeconds = isNotFound ? NOT_FOUND_CACHE_TTL_SECONDS : CACHE_TTL_SECONDS;
    const response = new Response(upstream.body, {
      status: upstream.status,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${ttlSeconds}`,
      },
    });

    // Write the cache in the background so it neither delays nor fails the response
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
