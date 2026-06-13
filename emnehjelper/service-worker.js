importScripts("config.js");

const callsToEmnekode = {}; // Tracks ongoing calls
const linkValidationQueue = {}; // Tracks link validation to avoid rate limiting
const VALIDATION_CACHE_KEY = 'link-validation-cache-v2';
const VALIDATION_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

function normalizeKarakterwebLinkUrl(url) {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith("karakterweb.no")) {
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

function scaleToKarakterskala(scale) {
  if (scale === "A-F") return "A-F";
  return "G-H";
}

function distributionToKarakterfordeling(distribution, scale) {
  if (!distribution) return {};

  if (scale === "A-F" || distribution.A !== undefined) {
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
  const gradesData = semesters.map((item) => ({
    Årstall: String(item.year),
    Semester: semesterToNorwegian(item.semester),
    Karakterskala: scaleToKarakterskala(item.scale),
    Karakterfordeling: distributionToKarakterfordeling(
      item.distribution,
      item.scale
    ),
    Antall_kandidater_totalt: item.candidates ?? 0,
  }));

  const evaluations = Array.isArray(raw.evaluations)
    ? raw.evaluations
    : raw.evaluations?.questions || [];

  return {
    evaluations,
    grades: { data: gradesData },
  };
}

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

    const fetchWithRetry = (url, options = {}, retryCount = 1) => {
      const headers = {
        Accept: "application/json",
        ...(options.headers || {}),
      };

      return fetch(url, { ...options, headers })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.json();
        })
        .catch((error) => {
          console.error(`Fetch failed: ${url}`, error);
          if (retryCount > 0) {
            return new Promise((resolve) =>
              setTimeout(
                () => resolve(fetchWithRetry(url, options, retryCount - 1)),
                500
              )
            );
          }

          throw new Error("Fetch failed after retrying");
        });
    };

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

          // Check if cache exists and is still valid
          if (cachedData && Date.now() - cachedData.timestamp < cacheTTL) {
            resolve(cachedData.data);
          } else {
            // Fetch both APIs with individual error handling to allow partial success
            Promise.allSettled([
              fetchWithRetry(`https://api.emnr.no/course/${message.emnekode}/`),
              fetchWithRetry(
                `${KARAKTERWEB_CACHE_BASE}/${message.emnekode.toLowerCase()}`,
                {
                  headers: {
                    "X-Emnehjelper-Client": KARAKTERWEB_CLIENT_HEADER,
                  },
                }
              ),
            ])
              .then(([emnrResult, karakterwebResult]) => {
                const emnrResponse = emnrResult.status === "fulfilled" ? emnrResult.value : null;
                const karakterwebRaw = karakterwebResult.status === "fulfilled" ? karakterwebResult.value : null;
                const karakterwebResponse = normalizeKarakterwebResponse(karakterwebRaw);

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
                  chrome.storage.local.set({
                    [cacheKey]: { data: responseData, timestamp: Date.now() },
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
