importScripts("config.js");

const callsToEmnekode = {}; // Tracks ongoing calls
const linkValidationQueue = {}; // Tracks link validation to avoid rate limiting
const VALIDATION_CACHE_KEY = 'link-validation-cache-v2';
const LEGACY_VALIDATION_CACHE_KEY = 'link-validation-cache';
const VALIDATION_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const TRANSIENT_FAILURE_CACHE_TTL = 15 * 60 * 1000; // 15 minutes in milliseconds
const SERVICE_WORKER_KEEPALIVE_INTERVAL_MS = 25 * 1000;

function normalizeKarakterwebLinkUrl(url) {
  try {
    const parsed = new URL(url);
    const isKarakterwebHost =
      parsed.hostname === "karakterweb.no" ||
      parsed.hostname.endsWith(".karakterweb.no");
    if (!isKarakterwebHost) {
      return url;
    }

    parsed.hostname = "karakterweb.no";
    parsed.protocol = "https:";

    const match = parsed.pathname.match(/^\/ntnu\/([^/]+)/i);
    if (match) {
      parsed.pathname = `/ntnu/${match[1].toLowerCase()}`;
    }

    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}

function isKarakterwebInstituteLandingPage(url) {
  return /^https:\/\/(www\.)?karakterweb\.no\/ntnu\/?$/i.test(url);
}

function semesterToNorwegian(semester) {
  if (semester === "spring") return "Vår";
  if (semester === "autumn") return "Høst";
  return semester;
}

// Letter-graded semesters are recognised by their scale, or by letter keys when the scale is missing or unexpected.
// Karakterskala and Karakterfordeling must agree, otherwise mergeData() discards the semester.
function isLetterGradeScale(scale, distribution) {
  return scale === "A-F" || distribution?.A !== undefined;
}

function distributionToKarakterfordeling(distribution, isLetterScale) {
  if (!distribution) return {};

  if (isLetterScale) {
    return Object.fromEntries(
      Object.entries(distribution).map(([grade, count]) => [
        grade,
        { Alle: count, Menn: 0, Kvinner: 0 },
      ])
    );
  }

  const passed =
    distribution.passed ??
    distribution.bestatt ??
    distribution.Bestått ??
    distribution.G ??
    0;
  const failed =
    distribution.failed ??
    distribution.stryk ??
    distribution["Ikke bestått"] ??
    distribution.H ??
    0;

  return {
    Bestått: { Alle: passed, Menn: 0, Kvinner: 0 },
    "Ikke bestått": { Alle: failed, Menn: 0, Kvinner: 0 },
  };
}

function normalizeKarakterwebResponse(raw) {
  if (!raw) return null;

  if (raw.grades?.data) {
    return {
      evaluations: raw.evaluations || [],
      grades: raw.grades,
    };
  }

  const semesters = raw.grades?.semesters || [];
  const gradesData = semesters.map((item) => {
    const isLetterScale = isLetterGradeScale(item.scale, item.distribution);
    return {
      Årstall: String(item.year),
      Semester: semesterToNorwegian(item.semester),
      Karakterskala: isLetterScale ? "A-F" : "G-H",
      Karakterfordeling: distributionToKarakterfordeling(
        item.distribution,
        isLetterScale
      ),
      Antall_kandidater_totalt: item.candidates ?? 0,
    };
  });

  const evaluations = Array.isArray(raw.evaluations)
    ? raw.evaluations
    : raw.evaluations?.questions || [];

  return {
    evaluations,
    grades: { data: gradesData },
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Chrome stops an extension service worker after 30s without events or extension API calls,
// and a pending timer does not count as activity. Calling an extension API resets that timer,
// so ping one while waiting out a rate-limit window that is longer than that.
async function sleepKeepingServiceWorkerAlive(ms) {
  const keepAlive = setInterval(
    () => chrome.runtime.getPlatformInfo(),
    SERVICE_WORKER_KEEPALIVE_INTERVAL_MS
  );
  try {
    await sleep(ms);
  } finally {
    clearInterval(keepAlive);
  }
}

// Attach the HTTP status so callers can tell a missing course (404) from a transient failure
function createHttpError(
  response,
  message = `HTTP ${response.status}: ${response.statusText}`
) {
  const error = new Error(message);
  error.status = response.status;
  return error;
}

// A missing course (HTTP 404) is a stable answer; rate limits, 5xx and network errors are worth retrying soon
function isTransientFailure(settledResult) {
  return (
    settledResult.status === "rejected" && settledResult.reason?.status !== 404
  );
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

function getRateLimitRetryDelayMs(retryAfterHeader) {
  const parsed = parseRetryAfterHeader(retryAfterHeader);
  if (parsed !== null) {
    return Math.min(parsed, KARAKTERWEB_RATE_LIMIT_WINDOW_MS);
  }

  return KARAKTERWEB_RATE_LIMIT_WINDOW_MS;
}

function isRateLimited(status) {
  return status === 429;
}

async function fetchWithRetry(url, options = {}, retryCount = 1) {
  const headers = {
    Accept: "application/json",
    ...(options.headers || {}),
  };

  try {
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      throw createHttpError(response);
    }
    // Await here so body/JSON failures are caught and retried as well
    return await response.json();
  } catch (error) {
    console.error(`Fetch failed: ${url}`, error);
    if (retryCount > 0) {
      await sleep(500);
      return fetchWithRetry(url, options, retryCount - 1);
    }
    throw error;
  }
}

async function fetchKarakterwebCache(url, options = {}) {
  const headers = {
    Accept: "application/json",
    ...(options.headers || {}),
  };

  let totalWaitMs = 0;
  let retriedServerError = false;

  for (let attempt = 1; attempt <= RATE_LIMIT_MAX_ATTEMPTS; attempt++) {
    const isLastAttempt = attempt === RATE_LIMIT_MAX_ATTEMPTS;
    let response;

    try {
      response = await fetch(url, { ...options, headers });
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      // Network failure or unreadable body: retry shortly
      console.error(`Karakterweb cache fetch failed: ${url}`, error);
      if (isLastAttempt) {
        throw error;
      }

      await sleep(500);
      continue;
    }

    // Retry a server error once, like fetchWithRetry() does for other APIs
    if (response.status >= 500 && !retriedServerError && !isLastAttempt) {
      retriedServerError = true;
      console.warn(
        `Karakterweb cache returned HTTP ${response.status} for ${url}. Retrying once`
      );
      await sleep(500);
      continue;
    }

    if (!isRateLimited(response.status)) {
      throw createHttpError(response);
    }

    const retryAfterMs = getRateLimitRetryDelayMs(
      response.headers.get("Retry-After")
    );

    if (isLastAttempt || totalWaitMs + retryAfterMs > RATE_LIMIT_MAX_WAIT_MS) {
      throw createHttpError(
        response,
        `Karakterweb cache rate limited after ${attempt} attempts (HTTP ${response.status})`
      );
    }

    console.warn(
      `Karakterweb cache rate limited for ${url}. Waiting ${retryAfterMs}ms before retry ${attempt + 1}/${RATE_LIMIT_MAX_ATTEMPTS}`
    );

    totalWaitMs += retryAfterMs;
    // Jitter so clients limited at the same moment do not all retry in the same instant
    await sleepKeepingServiceWorkerAlive(
      retryAfterMs + Math.random() * RATE_LIMIT_RETRY_JITTER_MS
    );
  }

  throw new Error("Karakterweb cache fetch failed after retries");
}

// The pre-v2 link-validation cache is never read again after the key bump; drop it on install/update
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.remove(LEGACY_VALIDATION_CACHE_KEY);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.contentScriptQuery === "validate-link") {
    const url = normalizeKarakterwebLinkUrl(message.url);
    
    // Check cache first
    chrome.storage.local.get(VALIDATION_CACHE_KEY, (result) => {
      const cache = result[VALIDATION_CACHE_KEY] || {};
      const cachedResult = cache[url];
      
      // Return cached result if valid
      if (cachedResult && (Date.now() - cachedResult.timestamp < VALIDATION_CACHE_TTL)) {
        sendResponse({ isValid: cachedResult.isValid });
        return;
      }
      
      // Check if validation is already in progress for this URL
      if (linkValidationQueue[url]) {
        linkValidationQueue[url].then((result) => sendResponse(result));
        return;
      }
      
      // Start validation with rate limiting
      const validationPromise = new Promise((resolve) => {
        // Add delay to avoid rate limiting - stagger requests
        const delay = 300 + Math.random() * 200; // Random 300-500ms delay
        setTimeout(() => {
          fetch(url, { method: "HEAD" })
            .then((response) => {
              // Accept 200-299 (success) and 300-399 (redirects) as valid
              // Mark 400-599 (client/server errors) as invalid
              let isValid = response.status >= 200 && response.status < 400;
              
              // Redirect to institute landing page means course doesn't exist
              if (isValid && isKarakterwebInstituteLandingPage(response.url)) {
                isValid = false;
              }
              
              // Cache the result - fetch current cache first to avoid overwriting
              chrome.storage.local.get(VALIDATION_CACHE_KEY, (cacheResult) => {
                const cache = cacheResult[VALIDATION_CACHE_KEY] || {};
                cache[url] = { isValid, timestamp: Date.now() };
                chrome.storage.local.set({ [VALIDATION_CACHE_KEY]: cache });
              });
              
              resolve({ isValid: isValid });
            })
            .catch((error) => {
              // Network/CORS errors - mark as invalid
              resolve({ isValid: false });
            })
            .finally(() => {
              // Clear from queue after 2 seconds
              setTimeout(() => delete linkValidationQueue[url], 2000);
            });
        }, delay);
      });
      
      linkValidationQueue[url] = validationPromise;
      validationPromise.then((result) => sendResponse(result));
    });
    
    return true; // Keep channel open for async response
  }
  
  if (message.contentScriptQuery === "get-karakter-data") {
    const cacheKey = `karakter-data-${message.emnekode}`;
    const cacheTTL = 72 * 60 * 60 * 1000; // 3 days in milliseconds

    // Handle ongoing calls
    if (callsToEmnekode[message.emnekode]) {
      // If there's an ongoing call, wait for it to resolve
      callsToEmnekode[message.emnekode].then((response) => {
        sendResponse(response);
      });
    } else {
      // Start new API request process
      const apiCall = new Promise((resolve) => {
        // Try to retrieve cached data first
        chrome.storage.local.get(cacheKey, (result) => {
          const cachedData = result[cacheKey];

          // Check if cache exists and is still valid (entries with a transient failure carry a shorter ttl)
          if (
            cachedData &&
            Date.now() - cachedData.timestamp < (cachedData.ttl ?? cacheTTL)
          ) {
            resolve(cachedData.data);
          } else {
            // Fetch both APIs with individual error handling to allow partial success
            Promise.allSettled([
              fetchWithRetry(`https://api.emnr.no/course/${message.emnekode}/`),
              // Normalize inside the chain so an unexpected payload shape counts as a karakterweb failure
              // instead of throwing in the handler below and leaving this request unresolved
              fetchKarakterwebCache(
                `${KARAKTERWEB_CACHE_BASE}/${message.emnekode.toLowerCase()}`,
                {
                  headers: {
                    [KARAKTERWEB_CLIENT_HEADER_NAME]: KARAKTERWEB_CLIENT_TOKEN,
                  },
                }
              ).then(normalizeKarakterwebResponse),
            ])
              .then(([emnrResult, karakterwebResult]) => {
                const emnrResponse = emnrResult.status === "fulfilled" ? emnrResult.value : null;
                const karakterwebResponse = karakterwebResult.status === "fulfilled" ? karakterwebResult.value : null;

                // Log any failures
                if (emnrResult.status === "rejected") {
                  console.error("emnr API failed:", emnrResult.reason);
                }
                if (karakterwebResult.status === "rejected") {
                  console.error("karakterweb API failed:", karakterwebResult.reason);
                }

                const responseData = {
                  emnrData: emnrResponse,
                  karakterwebData: karakterwebResponse,
                };

                if (emnrResponse !== null || karakterwebResponse !== null) {
                  // Keep partial data, but retry soon if the missing source failed for a transient reason
                  const hasTransientFailure =
                    isTransientFailure(emnrResult) ||
                    isTransientFailure(karakterwebResult);
                  chrome.storage.local.set({
                    [cacheKey]: {
                      data: responseData,
                      timestamp: Date.now(),
                      ttl: hasTransientFailure
                        ? TRANSIENT_FAILURE_CACHE_TTL
                        : cacheTTL,
                    },
                  });
                } else {
                  console.warn(`Not caching empty data for ${message.emnekode}`);
                }

                resolve(responseData);
              });
          }
        });
      });

      // Store the promise in the ongoing calls tracker
      callsToEmnekode[message.emnekode] = apiCall;

      // When the API call finishes, remove it from the tracker
      apiCall.finally(() => {
        delete callsToEmnekode[message.emnekode];
      });

      // Send the response once the API call completes
      apiCall.then((response) => {
        sendResponse(response);
      });
    }

    // Indicate that the response will be sent asynchronously
    return true;
  }
});
