const callsToEmnekode = {}; // Tracks ongoing calls

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.contentScriptQuery === "get-karakter-data") {
    const cacheKey = `karakter-data-${message.emnekode}`;
    const cacheTTL = 72 * 60 * 60 * 1000; // 3 days in milliseconds

    // Function to fetch data with retry
    const fetchWithRetry = (url, retryCount = 1) => {
      return fetch(url, {
        headers: {
          Accept: "application/json",
        },
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          return response.json();
        })
        .catch((error) => {
          console.error(`Fetch failed: ${url}`, error);
          if (retryCount > 0) {
            // Wait 0.5 seconds and retry once
            return new Promise((resolve) =>
              setTimeout(
                () => resolve(fetchWithRetry(url, retryCount - 1)),
                500
              )
            );
          } else {
            throw new Error("Fetch failed after retrying");
          }
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
                `https://www.karakterweb.no/api/evals?institute=NTNU&courseCode=${message.emnekode}`
              ),
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

                // Only cache if BOTH APIs succeeded (don't cache partial/failed data)
                if (emnrResponse !== null && karakterwebResponse !== null) {
                  chrome.storage.local.set({
                    [cacheKey]: { data: responseData, timestamp: Date.now() },
                  });
                } else {
                  console.warn(`Not caching partial data for ${message.emnekode}`);
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
