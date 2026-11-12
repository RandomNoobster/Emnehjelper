const UPSTREAM = "https://api.karakterweb.no";
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;
const CLIENT_HEADER = "X-Emnehjelper-Client";
const CLIENT_TOKEN = "emnehjelper-v1";

// Verified against https://karakterweb.no/api-docs and live upstream responses:
// 120 req/min, HTTP 429, no Retry-After header.
const KARAKTERWEB_RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_ATTEMPTS = 3;
const RATE_LIMIT_MAX_WAIT_MS = 180_000;

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
      console.log(`Cache hit for ${courseLabel}`);
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

    const upstreamResult = await fetchUpstreamWithRetry(
      upstreamUrl,
      env.KARAKTERWEB_API_KEY,
      courseLabel
    );

    if (!upstreamResult.ok) {
      const { response: upstreamError, rateLimited, attempts } = upstreamResult;
      console.warn(
        rateLimited
          ? `Upstream rate limit persisted for ${courseLabel} after ${attempts} attempts`
          : `Upstream error for ${courseLabel}: HTTP ${upstreamError.status}`
      );

      const headers = { "Content-Type": "application/json" };
      if (rateLimited) {
        // Tell the client how long to back off; it cannot see the upstream headers
        headers["Retry-After"] =
          upstreamError.headers.get("Retry-After") ??
          String(KARAKTERWEB_RATE_LIMIT_WINDOW_MS / 1000);
      }

      return new Response(upstreamError.body, {
        status: upstreamError.status,
        headers,
      });
    }

    const upstream = upstreamResult.response;
    console.log(`Successfully fetched ${courseLabel} (HTTP ${upstream.status})`);

    const response = new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
      },
    });

    // Write the cache in the background so it neither delays nor fails the response
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};

async function fetchUpstreamWithRetry(upstreamUrl, apiKey, label) {
  let totalWaitMs = 0;

  for (let attempt = 1; attempt <= RATE_LIMIT_MAX_ATTEMPTS; attempt++) {
    const upstream = await fetch(upstreamUrl, {
      headers: { "X-Client-Key": apiKey },
    });

    if (upstream.ok) {
      return { ok: true, response: upstream, attempts: attempt };
    }

    if (upstream.status !== 429) {
      return { ok: false, response: upstream, attempts: attempt };
    }

    const retryAfterMs = getRateLimitRetryDelayMs(
      upstream.headers.get("Retry-After")
    );

    if (
      attempt === RATE_LIMIT_MAX_ATTEMPTS ||
      totalWaitMs + retryAfterMs > RATE_LIMIT_MAX_WAIT_MS
    ) {
      return {
        ok: false,
        rateLimited: true,
        response: upstream,
        attempts: attempt,
      };
    }

    console.warn(
      `Upstream rate limited for ${label}: HTTP 429. Waiting ${retryAfterMs}ms before retry ${attempt + 1}/${RATE_LIMIT_MAX_ATTEMPTS}`
    );

    totalWaitMs += retryAfterMs;
    await sleep(retryAfterMs);
  }

  // Unreachable: the last attempt always returns above
  throw new Error(`Upstream retry loop for ${label} exited without a result`);
}

function getRateLimitRetryDelayMs(retryAfterHeader) {
  const parsed = parseRetryAfterHeader(retryAfterHeader);
  if (parsed !== null) {
    return Math.min(parsed, KARAKTERWEB_RATE_LIMIT_WINDOW_MS);
  }

  return KARAKTERWEB_RATE_LIMIT_WINDOW_MS;
}

function parseRetryAfterHeader(retryAfterHeader) {
  if (!retryAfterHeader) {
    return null;
  }

  const seconds = Number(retryAfterHeader);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const retryAt = Date.parse(retryAfterHeader);
  if (!Number.isNaN(retryAt)) {
    return Math.max(0, retryAt - Date.now());
  }

  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
