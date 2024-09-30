(async function () {
  // Hent emnekode fra URL med regex
  const url = window.location.href;
  const regex = /.*\/([A-Za-z]{2,5}\d{3,4})/;
  const match = url.match(regex);

  // If a match is found, extract the emnekode
  if (match && match[1]) {
    const emnekode = match[1];

    // Hent data fra API
    console.debug(emnekode);
    const emnrResponse = await fetch(`https://api.emnr.no/course/${emnekode}/`);
    const emnrData = await emnrResponse.json();
    console.debug(emnrData);

    // Call the function to create and display the popup
    makePopUp(emnrData);
  } else {
    console.error("Emnekode not found in the URL.");
  }
})();

function makePopUp(data) {
  // Create a div element for the popup
  const popup = document.createElement("div");
  popup.className = "popup";

  // Create a text element with the message
  const message = document.createElement("div");

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

  // Append the table to the message
  message.appendChild(table);

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
  workloadLabel.innerHTML = `Arbeidsmengde: <span>${
    data.review_count === 0
      ? "-.-- (-)"
      : (data.average_workload > 1.5
          ? "Høy"
          : data.average_workload > 0.5
          ? "Middels"
          : "Lav") + ` (${data.average_workload.toFixed(2)})`
  }</span>`;

  // Append the workload slider and label to the message
  message.appendChild(workloadLabel);
  message.appendChild(workloadSlider);

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
  message.appendChild(workloadScale);

  // Create a slider for Gjennomsnittskarakter with visual scale
  const gradeSlider = document.createElement("input");
  gradeSlider.type = "range";
  gradeSlider.min = "0";
  gradeSlider.max = "5";
  gradeSlider.step = "0.01";
  gradeSlider.value = data.average_grade.toFixed(2);
  gradeSlider.disabled = true;

  // Create a label for the grade slider
  const gradeLabel = document.createElement("p");
  gradeLabel.innerHTML = `Gjennomsnittskarakter: <span>${
    data.average_grade_letter ?? "-"
  } (${
    data.average_grade === 0 ? "-.--" : data.average_grade.toFixed(2)
  })</span>`;

  // Append the grade slider and label to the message
  message.appendChild(gradeLabel);
  message.appendChild(gradeSlider);

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
  message.appendChild(gradeScale);

  // Append the message to the popup
  popup.appendChild(message);

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
