(async function () {
  // Hent emnekode fra URL med regex
  const url = window.location.href;
  const regex = /.*\/([A-Za-z]{2,5}\d{3,4})/;
  const match = url.match(regex);

  // If a match is found, extract the emnekode
  if (match && match[1]) {
    const emnekode = match[1];
    console.debug("Emnekode fra URL:", emnekode);

    // Send a message to the background script to get the data
    const response = await chrome.runtime.sendMessage({
      contentScriptQuery: "get-karakter-data",
      emnekode: emnekode,
    });
    const emnrData = response.emnrData;
    const karakterwebData = response.karakterwebData;
    console.debug("Data from background script:", emnrData, karakterwebData);

    // Combine the data from both sources
    const mergedData = mergeData(emnrData, karakterwebData);

    // Call the function to create and display the popup
    makePopUp(mergedData);
  } else {
    console.error("Emnekode not found in the URL.");
  }
})();

function mergeData(emnrData, karakterwebData) {
  let karakterWebReviewCount = 0;
  let karakterWebAverageDifficulty;
  let karakterWebAverageWorkload;

  karakterwebData.forEach((question) => {
    // Find the highest review count and use it
    karakterWebReviewCount = Math.max(
      karakterWebReviewCount,
      question.answersTotal
    );

    // Difficulty question has id 1
    if (question.questionId === 1) {
      let weigthedSum = 0;
      question.answers.forEach((answer) => {
        const value = answer.answerId / 2; // Divide by 2 to rescale from 0-4 to 0-2
        weigthedSum += value * answer.count;
      });
      karakterWebAverageDifficulty = weigthedSum / question.answersTotal;
    }

    // Workload question has id 2
    else if (question.questionId === 2) {
      let weigthedSum = 0;
      question.answers.forEach((answer) => {
        const value = answer.answerId / 2; // Divide by 2 to rescale from 0-4 to 0-2
        weigthedSum += value * answer.count;
      });
      karakterWebAverageWorkload = weigthedSum / question.answersTotal;
    }
  });

  const totalReviewCount = karakterWebReviewCount + emnrData.review_count;
  const averageWorkload =
    (karakterWebAverageWorkload * karakterWebReviewCount +
      emnrData.average_workload * emnrData.review_count) /
    totalReviewCount;
  const averageDifficulty =
    (karakterWebAverageDifficulty * karakterWebReviewCount +
      emnrData.average_difficulty * emnrData.review_count) /
    totalReviewCount;

  return {
    course_code: emnrData.course_code,
    pass_rate: emnrData.pass_rate,
    average_grade: emnrData.average_grade,
    average_grade_letter: emnrData.average_grade_letter,
    average_workload: averageWorkload,
    average_difficulty: averageDifficulty,
    review_count: totalReviewCount,
  };
}

function makePopUp(data) {
  // Create a div element for the popup
  const popup = document.createElement("div");
  popup.className = "popup";

  // Create links
  const emnrLink = document.createElement("a");
  emnrLink.href = `https://emnr.no/course/${data.course_code}`;
  emnrLink.textContent = `Emnr: ${data.course_code}`;
  popup.appendChild(emnrLink);

  const karakterLink = document.createElement("a");
  karakterLink.href = `https://www.karakterweb.no/ntnu/${data.course_code}`;
  karakterLink.textContent = `Karakterweb: ${data.course_code}`;
  popup.appendChild(karakterLink);

  const karakternetLink = document.createElement("a");
  karakternetLink.href = `https://karakterer.net/course/${data.course_code}`;
  karakternetLink.textContent = `Karakterer.net: ${data.course_code}`;
  popup.appendChild(karakternetLink);

  // Create table layout
  const table = document.createElement("table");

  // Add rows to the table
  const rows = [
    createTableRow("Beståttprosent:", `${data.pass_rate.toFixed(2)}%`),
    createTableRow(
      "Karakter/arbeid:",
      data.review_count === 0
        ? "-.--"
        : (data.average_grade / data.average_workload).toFixed(2)
    ),
    createTableRow("Antall reviews:", `${data.review_count}`),
  ];

  // Append rows to the table
  rows.forEach((row) => table.appendChild(row));

  // Append the table to the popup
  popup.appendChild(table);

  // Create a slider for Arbeidsmengde
  const workloadSlider = document.createElement("input");
  workloadSlider.className = "workload-slider";
  workloadSlider.type = "range";
  workloadSlider.min = "0";
  workloadSlider.max = "2";
  workloadSlider.step = "0.01";
  workloadSlider.value = data.average_workload.toFixed(2);
  workloadSlider.disabled = true;

  // Create a label for the workload slider
  const workloadLabel = document.createElement("p");
  const workloadText = document.createElement("span");
  const workloadValue = document.createElement("span");

  workloadLabel.className = "scale-label";
  workloadText.textContent = "Arbeidsmengde: ";

  // Calculate the workload description based on the average workload
  let workloadDescription = "- (-.--)";
  if (data.review_count !== 0) {
    workloadDescription =
      (data.average_workload > 1.5
        ? "Høy"
        : data.average_workload > 0.5
        ? "Middels"
        : "Lav") + ` (${data.average_workload.toFixed(2)})`;
  }

  // Set the workload description as text content
  workloadValue.textContent = workloadDescription;
  workloadValue.className = "scale-value";

  // Append the text and workload value to the label
  workloadLabel.appendChild(workloadText);
  workloadLabel.appendChild(workloadValue);

  // Append the workload slider and label to the popup
  popup.appendChild(workloadLabel);
  popup.appendChild(workloadSlider);

  // Create a scale under the workload slider
  const workloadScale = document.createElement("div");
  workloadScale.className = "scale";

  // Labels for 0 to 2 scale
  const workloadLabels = ["Lav 0", "Middels 1", "Høy 2"];
  workloadLabels.forEach((label) => {
    const scaleLabel = document.createElement("span");
    scaleLabel.textContent = label;
    workloadScale.appendChild(scaleLabel);
  });

  // Append the workload scale under the slider
  popup.appendChild(workloadScale);

  // Create a slider for Gjennomsnittskarakter with visual scale
  const gradeSlider = document.createElement("input");
  gradeSlider.className = "grade-slider";
  gradeSlider.type = "range";
  gradeSlider.min = "0";
  gradeSlider.max = "5";
  gradeSlider.step = "0.01";
  gradeSlider.value = data.average_grade.toFixed(2);
  gradeSlider.disabled = true;

  // Create a label for the grade slider
  const gradeLabel = document.createElement("p");
  const gradeText = document.createElement("span");
  const gradeValue = document.createElement("span");

  gradeLabel.className = "scale-label";
  gradeText.textContent = "Gjennomsnittskarakter: ";

  // Calculate the grade description based on the average grade
  const gradeLetter = data.average_grade_letter ?? "-";
  const gradeDescription =
    data.average_grade === 0 ? "-.--" : data.average_grade.toFixed(2);

  // Set the grade description as text content
  gradeValue.textContent = `${gradeLetter} (${gradeDescription})`;
  gradeValue.className = "scale-value";

  // Append the text and grade value to the label
  gradeLabel.appendChild(gradeText);
  gradeLabel.appendChild(gradeValue);

  // Append the grade slider and label to the popup
  popup.appendChild(gradeLabel);
  popup.appendChild(gradeSlider);

  // Create a scale under the slider
  const gradeScale = document.createElement("div");
  gradeScale.className = "scale";

  // Labels for F to A scale
  const labels = ["F 0", "E 1 ", "D 2", "C 3", "B 4", "A 5"];
  labels.forEach((label, index) => {
    const scaleLabel = document.createElement("span");
    scaleLabel.textContent = label;
    gradeScale.appendChild(scaleLabel);
  });

  // Append the grade scale under the slider
  popup.appendChild(gradeScale);

  const disclaimer = document.createElement("p");
  disclaimer.className = "disclaimer";
  disclaimer.textContent =
    "Statistikken er sammenslått fra emnr og karakterweb🚀✨";
  popup.appendChild(disclaimer);

  let isDragging = false;
  let initialX, initialY, offsetX, offsetY;

  // Function to handle mouse down event
  function handleMouseDown(event) {
    isDragging = true;
    initialX = event.clientX;
    initialY = event.clientY;
    offsetX = popup.getBoundingClientRect().left;
    offsetY = popup.getBoundingClientRect().top;
  }

  // Function to handle mouse move event
  function handleMouseMove(event) {
    if (isDragging) {
      const dx = event.clientX - initialX;
      const dy = event.clientY - initialY;
      popup.style.left = offsetX + dx + "px";
      popup.style.top = offsetY + dy + "px";
      popup.style.right = null;
    }
  }

  // Function to handle mouse up event
  function handleMouseUp() {
    isDragging = false;
  }

  // Add event listeners for mouse events
  popup.addEventListener("mousedown", handleMouseDown);
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);

  // Append the popup to the body of the page
  document.body.appendChild(popup);
}

// Utility to create table rows
function createTableRow(label, value) {
  const row = document.createElement("tr");
  const labelCell = document.createElement("td");
  const valueCell = document.createElement("td");

  labelCell.textContent = label;
  valueCell.textContent = value;

  row.appendChild(labelCell);
  row.appendChild(valueCell);

  return row;
}
