// Constants and Enums
const URL_REGEX = /.*\/([A-Za-zÆØÅæøå]{2,5}\d{3,4})/;

const ENDPOINTS = {
  EMNR: (emnekode) => `https://emnr.no/course/${emnekode}`,
  KARAKTERWEB: (emnekode) => `https://www.karakterweb.no/ntnu/${emnekode}`,
  KARAKTERNET: (emnekode) => `https://karakterer.net/course/${emnekode}`,
};

const ColorScheme = {
  LOW_IS_GOOD: "low-is-good",
  HIGH_IS_GOOD: "high-is-good",
}

const WorkloadLevels = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
};

const DifficultyLevels = {
  EASY: 0,
  MEDIUM: 1,
  HARD: 2,
};

const Grades = {
  F: 0,
  E: 1,
  D: 2,
  C: 3,
  B: 4,
  A: 5,
};

const WORKLOAD_LABELS = {
  [WorkloadLevels.LOW]: "Lav",
  [WorkloadLevels.MEDIUM]: "Middels",
  [WorkloadLevels.HIGH]: "Høy",
};

const DIFFICULTY_LABELS = {
  [DifficultyLevels.EASY]: "Lav",
  [DifficultyLevels.MEDIUM]: "Middels",
  [DifficultyLevels.HARD]: "Høy",
};

const GRADE_LABELS = {
  [Grades.F]: "F",
  [Grades.E]: "E",
  [Grades.D]: "D",
  [Grades.C]: "C",
  [Grades.B]: "B",
  [Grades.A]: "A",
};

const PASS_FAIL_LABELS = ["Ikke Bestått", "Bestått"];

function extractEmnekodeFromURL(url) {
  const match = url.match(URL_REGEX);
  return match ? match[1] : null;
}

// Send a message to get data from the background script
async function fetchCourseData(emnekode) {
  try {
    const response = await chrome.runtime.sendMessage({
      contentScriptQuery: "get-karakter-data",
      emnekode,
    });
    return {
      emnrData: response.emnrData,
      karakterwebData: response.karakterwebData,
    };
  } catch (error) {
    console.error("Error fetching course data:", error);
  }
}

// Create anchor element with link
function createLinkElement(href, text) {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = text;
  return link;
}

function makePopUp(data, emnekode) {
  const popup = document.createElement("div");
  popup.className = "popup";

  // Add links
  popup.appendChild(
    createLinkElement(ENDPOINTS.EMNR(emnekode), `Emnr: ${emnekode}`)
  );
  addBr(popup);
  popup.appendChild(
    createLinkElement(
      ENDPOINTS.KARAKTERWEB(emnekode),
      `Karakterweb: ${emnekode}`
    )
  );
  addBr(popup);
  popup.appendChild(
    createLinkElement(
      ENDPOINTS.KARAKTERNET(emnekode),
      `Karakterer.net: ${emnekode}`
    )
  );

  // Create table with statistics
  const table = document.createElement("table");
  table.appendChild(
    createTableRow("Beståttprosent:", `${data.pass_rate?.toFixed(2) ?? "--"}%`)
  );
  table.appendChild(
    createTableRow(
      "Karakter/arbeid:",
      data.average_workload && data.average_grade > 0
        ? (data.average_grade / data.average_workload).toFixed(2)
        : "-.--"
    )
  );
  table.appendChild(
    createTableRow("Antall reviews:", `${data.review_count ?? "--"}`)
  );
  popup.appendChild(table);

  // Add workload and grade sliders with scales
  addSlider(
    popup,
    "Arbeidsmengde: ",
    data.average_workload,
    WORKLOAD_LABELS,
    WorkloadLevels.LOW,
    WorkloadLevels.HIGH,
    ColorScheme.LOW_IS_GOOD
  );
  addSlider(
    popup,
    "Vanskelighetsgrad: ",
    data.average_difficulty,
    DIFFICULTY_LABELS,
    DifficultyLevels.EASY,
    DifficultyLevels.HARD,
    ColorScheme.LOW_IS_GOOD
  );
  addSlider(
    popup,
    "Gjennomsnittskarakter: ",
    data.average_grade,
    GRADE_LABELS,
    Grades.F,
    Grades.A,
    ColorScheme.HIGH_IS_GOOD
  );

  // Add disclaimer and draggable functionality
  addBr(popup);
  addDisclaimer(popup);
  makePopupDraggable(popup);

  // Append the popup to the body
  document.body.appendChild(popup);
}

// Utility to create a table row
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

// Add sliders for workload and grades
function addSlider(parent, label, value, scaleLabels, min, max, colorScheme) {
  const slider = document.createElement("input");
  slider.className = `${colorScheme}`;
  slider.type = "range";
  slider.min = min;
  slider.max = max;
  slider.step = "0.01";
  slider.value = value?.toFixed(2) ?? min;
  slider.disabled = true;

  const sliderLabel = document.createElement("p");
  const sliderText = document.createElement("span");
  const sliderValue = document.createElement("span");

  sliderLabel.className = "scale-label";
  sliderText.textContent = label;

  // Display value or "-" if invalid
  const displayValue =
    value >= min && value <= max
      ? `${scaleLabels[Math.round(value)]} (${value.toFixed(2)})`
      : "- (-.--)";
  sliderValue.textContent = displayValue;
  sliderValue.className = "slider-value";

  sliderLabel.appendChild(sliderText);
  sliderLabel.appendChild(sliderValue);

  parent.appendChild(sliderLabel);
  parent.appendChild(slider);

  // Add scale below slider
  const scale = document.createElement("div");
  scale.className = "scale";
  let i = 0;
  Object.values(scaleLabels).forEach((label) => {
    const scaleLabel = document.createElement("span");
    scaleLabel.textContent = label + ` ${i}`;
    scale.appendChild(scaleLabel);
    i += 1;
  });

  parent.appendChild(scale);
}

// Helper to get the appropriate grade scale labels
function getGradeScaleLabels(data) {
  return data.is_graded ? GRADE_SCALE_LABELS : PASS_FAIL_LABELS;
}

// Add a disclaimer to the popup
function addDisclaimer(popup) {
  const disclaimer = document.createElement("span");
  disclaimer.className = "disclaimer";
  disclaimer.textContent =
    "Statistikken er sammenslått fra emnr og karakterweb🚀✨";
  popup.appendChild(disclaimer);
}

// Add draggable functionality to the popup
function makePopupDraggable(popup) {
  let isDragging = false;
  let initialX, initialY, offsetX, offsetY;

  popup.addEventListener("mousedown", (event) => {
    isDragging = true;
    initialX = event.clientX;
    initialY = event.clientY;
    offsetX = popup.getBoundingClientRect().left;
    offsetY = popup.getBoundingClientRect().top;
  });

  document.addEventListener("mousemove", (event) => {
    if (isDragging) {
      const dx = event.clientX - initialX;
      const dy = event.clientY - initialY;
      popup.style.left = `${offsetX + dx}px`;
      popup.style.top = `${offsetY + dy}px`;
    }
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
  });
}

// Helper to add a <br> element
function addBr(parent) {
  parent.appendChild(document.createElement("br"));
}

// Main function
(async function main() {
  const url = decodeURI(window.location.href);
  const emnekode = extractEmnekodeFromURL(url);

  if (emnekode) {
    console.debug("Emnekode fra URL:", emnekode);
    const { emnrData, karakterwebData } = await fetchCourseData(emnekode);
    const mergedData = mergeData(emnrData, karakterwebData);
    makePopUp(mergedData, emnekode);
  } else {
    console.error("Emnekode not found in the URL.");
  }
})();
