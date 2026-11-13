importScripts("config.js");

const callsToEmnekode = {}; // Tracks ongoing calls
const linkValidationQueue = {}; // Tracks link validation to avoid rate limiting
const VALIDATION_CACHE_KEY = 'link-validation-cache-v2';
const LEGACY_VALIDATION_CACHE_KEY = 'link-validation-cache';
const VALIDATION_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const COURSE_DATA_CACHE_KEY_PREFIX = 'karakter-data-';
const COURSE_DATA_CACHE_TTL = 72 * 60 * 60 * 1000; // 3 days in milliseconds
const TRANSIENT_FAILURE_CACHE_TTL = 15 * 60 * 1000; // 15 minutes in milliseconds
// Same as the cache worker's 404 TTL, so courses newly added to Karakterweb show up within a day
const NOT_FOUND_CACHE_TTL = 24 * 60 * 60 * 1000;
const SERVICE_WORKER_KEEPALIVE_INTERVAL_MS = 25 * 1000;
// Minimum gap between link-validation HEAD requests to the same host
const LINK_VALIDATION_HOST_SPACING_MS = 50;
const LETTER_GRADES = ["A", "B", "C", "D", "E", "F"];

const nextLinkValidationSlotByHost = {};
let linkValidationCacheWrite = Promise.resolve();

function semesterToNorwegian(semester) {
  if (semester === "spring") return "Vår";
  if (semester === "autumn") return "Høst";
  return semester;
}

// Letter-graded semesters are recognised by their scale, or by letter keys when the scale is missing or unexpected.
// Any letter counts: a sparse distribution may leave out grades nobody got (e.g. no A).
// Karakterskala and Karakterfordeling must agree, otherwise mergeData() discards the semester.
function isLetterGradeScale(scale, distribution) {
  return (
    scale === "A-F" ||
    LETTER_GRADES.some((grade) => distribution?.[grade] !== undefined)
  );
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

// The service has no data for this course (HTTP 404): a stable answer, not a fetch failure
function isNotFound(settledResult) {
  return (
    settledResult.status === "rejected" && settledResult.reason?.status === 404
  );
}

// Rate limits, 5xx and network errors are worth retrying soon
function isTransientFailure(settledResult) {
  return settledResult.status === "rejected" && !isNotFound(settledResult);
}

// A 4xx such as 404 will not change on an immediate retry; 408 and 429 might
function isStableHttpError(error) {
  return (
    error.status >= 400 &&
    error.status < 500 &&
    error.status !== 408 &&
    !isRateLimited(error.status)
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
    if (retryCount > 0 && !isStableHttpError(error)) {
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

// Give each HEAD request to a host its own slot, so a study plan's many links reach that host
// spread out over time instead of all within the same few hundred milliseconds
function getLinkValidationDelayMs(url) {
  let host = url;
  try {
    host = new URL(url).host;
  } catch {
    // Unparseable URL: fall back to spacing per URL
  }

  const now = Date.now();
  const slot = Math.max(
    now + 300 + Math.random() * 200,
    nextLinkValidationSlotByHost[host] ?? 0
  );
  nextLinkValidationSlotByHost[host] = slot + LINK_VALIDATION_HOST_SPACING_MS;
  return slot - now;
}

// Writes run one after another: concurrent read-modify-write of the shared map would drop entries
function persistLinkValidation(url, entry) {
  linkValidationCacheWrite = linkValidationCacheWrite
    .then(async () => {
      const stored = await chrome.storage.local.get(VALIDATION_CACHE_KEY);
      const cache = stored[VALIDATION_CACHE_KEY] || {};
      cache[url] = entry;
      await chrome.storage.local.set({ [VALIDATION_CACHE_KEY]: cache });
    })
    .catch((error) => console.error("Failed to cache link validation:", error));
}

// Expired course entries are only replaced when that course is looked up again, so courses the user
// stopped visiting would otherwise stay in chrome.storage.local (10 MB quota) forever
async function removeExpiredCourseData() {
  try {
    const stored = await chrome.storage.local.get(null);
    const now = Date.now();
    const expiredKeys = Object.keys(stored).filter((key) => {
      if (!key.startsWith(COURSE_DATA_CACHE_KEY_PREFIX)) return false;
      const entry = stored[key];
      return !(now - entry?.timestamp < (entry?.ttl ?? COURSE_DATA_CACHE_TTL));
    });
    if (expiredKeys.length > 0) {
      await chrome.storage.local.remove(expiredKeys);
    }
  } catch (error) {
    console.error("Failed to remove expired course data:", error);
  }
}

// The pre-v2 link-validation cache is never read again after the key bump; drop it on install/update
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.remove(LEGACY_VALIDATION_CACHE_KEY);
  removeExpiredCourseData();
});

chrome.runtime.onStartup.addListener(removeExpiredCourseData);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.contentScriptQuery === "validate-link") {
    const url = message.url;
    
    // Check cache first
    chrome.storage.local.get(VALIDATION_CACHE_KEY, (result) => {
      const cache = result[VALIDATION_CACHE_KEY] || {};
      const cachedResult = cache[url];
      
      // Return cached result if still fresh (results from a rate limit or server error carry a shorter ttl)
      if (
        cachedResult &&
        Date.now() - cachedResult.timestamp <
          (cachedResult.ttl ?? VALIDATION_CACHE_TTL)
      ) {
        sendResponse({ isValid: cachedResult.isValid });
        return;
      }
      
      // Check if validation is already in progress for this URL
      if (linkValidationQueue[url]) {
        linkValidationQueue[url].then((result) => sendResponse(result));
        return;
      }
      
      // Start validation, staggered per host to avoid rate limiting
      const validationPromise = new Promise((resolve) => {
        setTimeout(() => {
          fetch(url, { method: "HEAD" })
            .then((response) => {
              // Accept 200-299 (success) and 300-399 (redirects) as valid
              // Mark 400-599 (client/server errors) as invalid
              const isValid = response.status >= 200 && response.status < 400;
              
              // A rate limit or server error says nothing about the course, so check it again soon
              const isTransientStatus =
                isRateLimited(response.status) || response.status >= 500;
              persistLinkValidation(url, {
                isValid,
                timestamp: Date.now(),
                ttl: isTransientStatus
                  ? TRANSIENT_FAILURE_CACHE_TTL
                  : VALIDATION_CACHE_TTL,
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
        }, getLinkValidationDelayMs(url));
      });
      
      linkValidationQueue[url] = validationPromise;
      validationPromise.then((result) => sendResponse(result));
    });
    
    return true; // Keep channel open for async response
  }
  
  if (message.contentScriptQuery === "get-karakter-data") {
    // One cache entry and one request per course, however the page spells the code
    const emnekode = String(message.emnekode ?? "").trim().toUpperCase();
    const cacheKey = `${COURSE_DATA_CACHE_KEY_PREFIX}${emnekode}`;

    // Handle ongoing calls
    if (callsToEmnekode[emnekode]) {
      // If there's an ongoing call, wait for it to resolve
      callsToEmnekode[emnekode].then((response) => {
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
            Date.now() - cachedData.timestamp < (cachedData.ttl ?? COURSE_DATA_CACHE_TTL)
          ) {
            resolve(cachedData.data);
          } else {
            // Fetch both APIs with individual error handling to allow partial success
            Promise.allSettled([
              fetchWithRetry(`https://api.emnr.no/course/${emnekode}/`),
              // Normalize inside the chain so an unexpected payload shape counts as a karakterweb failure
              // instead of throwing in the handler below and leaving this request unresolved
              fetchKarakterwebCache(
                `${KARAKTERWEB_CACHE_BASE}/${emnekode.toLowerCase()}`,
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

                // Log any failures; a course a service does not have is expected, so it stays out of the error log
                for (const [source, result] of [["emnr", emnrResult], ["karakterweb", karakterwebResult]]) {
                  if (isNotFound(result)) {
                    console.log(`${source} has no data for ${emnekode}`);
                  } else if (result.status === "rejected") {
                    console.error(`${source} API failed:`, result.reason);
                  }
                }

                const responseData = {
                  emnrData: emnrResponse,
                  karakterwebData: karakterwebResponse,
                  // Lets content scripts tell "this service has no data for the course" from a failed fetch
                  emnrNotFound: isNotFound(emnrResult),
                  karakterwebNotFound: isNotFound(karakterwebResult),
                };

                const hasTransientFailure =
                  isTransientFailure(emnrResult) ||
                  isTransientFailure(karakterwebResult);

                // Keep partial data and stable 404 answers, but retry soon if a source failed for a transient reason
                if (
                  emnrResponse !== null ||
                  karakterwebResponse !== null ||
                  !hasTransientFailure
                ) {
                  let ttl = COURSE_DATA_CACHE_TTL;
                  if (hasTransientFailure) {
                    ttl = TRANSIENT_FAILURE_CACHE_TTL;
                  } else if (responseData.karakterwebNotFound) {
                    ttl = NOT_FOUND_CACHE_TTL;
                  }

                  chrome.storage.local.set({
                    [cacheKey]: {
                      data: responseData,
                      timestamp: Date.now(),
                      ttl,
                    },
                  });
                } else {
                  console.warn(`Not caching failed lookups for ${emnekode}`);
                }

                resolve(responseData);
              });
          }
        });
      });

      // Store the promise in the ongoing calls tracker
      callsToEmnekode[emnekode] = apiCall;

      // When the API call finishes, remove it from the tracker
      apiCall.finally(() => {
        delete callsToEmnekode[emnekode];
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
