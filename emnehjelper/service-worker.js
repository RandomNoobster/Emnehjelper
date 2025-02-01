const callsToEmnekode = {}; // Tracks ongoing calls

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.contentScriptQuery === "get-karakter-data") {
    const cacheKey = `karakter-data-${message.emnekode}`;
    const cacheTTL = 24 * 60 * 60 * 1000; // 1 days in milliseconds

    // Function to fetch data with retry
    const fetchWithRetry = (url, retryCount = 1) => {
      return fetch(url, {
        headers: {
          Accept: "application/json",
        },
      })
        .then((response) => response.json())
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
            let emnrResponse;
            let karakterwebResponse;

            Promise.all([
              fetchWithRetry(
                `https://api.emnr.no/course/${message.emnekode}/`
              ).then((data) => {
                emnrResponse = data;
              }),
              fetchWithRetry(
                `https://www.karakterweb.no/api/v1/evals/NTNU/${message.emnekode}/`
              ).then((data) => {
                karakterwebResponse = data.data;
              }),
            ])
              .then(() => {
                const responseData = {
                  emnrData: emnrResponse,
                  karakterwebData: karakterwebResponse,
                };

                // Cache the response with a timestamp
                chrome.storage.local.set({
                  [cacheKey]: { data: responseData, timestamp: Date.now() },
                });

                resolve(responseData);
              })
              .catch((error) => {
                console.error("Error fetching data:", error);
                resolve({
                  emnrData: null,
                  karakterwebData: null,
                  error: "Failed to fetch data",
                });
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
