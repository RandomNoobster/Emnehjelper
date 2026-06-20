const UPSTREAM = "https://api.karakterweb.no";
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;
const CLIENT_HEADER = "X-Emnehjelper-Client";
const CLIENT_TOKEN = "emnehjelper-v1";

export default {
  async fetch(request, env) {
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
      console.log(`Cache hit for ${institute}/${courseCode}`);
      return cached;
    }

    console.log(`Cache miss. Fetching ${institute}/${courseCode} from upstream`);

    const upstreamUrl = new URL(
      `/v1/courses/${institute}/${courseCode}`,
      UPSTREAM
    );
    upstreamUrl.searchParams.set("include", "grades,evaluations");
    upstreamUrl.searchParams.set("semester", "main");

    const upstream = await fetch(upstreamUrl, {
      headers: { "X-Client-Key": env.KARAKTERWEB_API_KEY },
    });

    if (!upstream.ok) {
      console.warn(`Upstream error for ${institute}/${courseCode}: HTTP ${upstream.status}`);
      const body = await upstream.text();
      return new Response(body, {
        status: upstream.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    console.log(`Successfully fetched ${institute}/${courseCode} (HTTP ${upstream.status})`);

    const response = new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`,
      },
    });

    await cache.put(cacheKey, response.clone());
    return response;
  },
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
