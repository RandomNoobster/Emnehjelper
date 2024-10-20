chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.contentScriptQuery === "get-karakter-data") {
      let emnrResponse;
      let karakterwebResponse;
  
      // Use Promise.all to wait for both fetch calls to complete
      Promise.all([
        fetch(`https://api.emnr.no/course/${message.emnekode}/`)
          .then((response) => response.json())
          .then((data) => {
            emnrResponse = data;
          }),
        fetch(`https://www.karakterweb.no/api/v1/evals/NTNU/${message.emnekode}/`)
          .then((response) => response.json())
          .then((data) => {
            karakterwebResponse = data.data;
          }),
      ])
        .then(() => {
          // Once both fetches are completed, send the response
          sendResponse({
            emnrData: emnrResponse,
            karakterwebData: karakterwebResponse,
          });
        })
        .catch((error) => {
          console.error("Error fetching data:", error);
          sendResponse({
            emnrData: null,
            karakterwebData: null,
            error: "Failed to fetch data",
          });
        });
  
      // Indicate that the response will be sent asynchronously
      return true;
    }
  });
  