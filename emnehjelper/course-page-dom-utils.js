// Create anchor element with link
function createLinkElement(href, text) {
  const link = document.createElement("a");
  link.href = href;
  link.textContent = text;
  link.target = "_blank";
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
  if (!data.is_graded) {
    addSlider(
      popup,
      "Beståttprosent: ",
      data.pass_rate,
      PASS_FAIL_LABELS,
      PassLevels.IKKE_BESTÅTT,
      PassLevels.BESTÅTT,
      ColorScheme.HIGH_IS_GOOD
    );
  } else {
    addSlider(
      popup,
      "Gjennomsnittskarakter: ",
      data.average_grade,
      GRADE_LABELS,
      Grades.F,
      Grades.A,
      ColorScheme.HIGH_IS_GOOD
    );
  }

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
  let displayValue;
  if (scaleLabels === PASS_FAIL_LABELS) {
    displayValue = value.toFixed(2) + "%";
  } else {
    displayValue =
      value >= min && value <= max
        ? `${scaleLabels[Math.round(value)]} (${value.toFixed(2)})`
        : "- (-.--)";
  }
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

(async function main() {
  if (typeof document === "undefined") return;
  const url = decodeURI(window.location.href);
  const emnekode = extractEmnekodeFromURL(url);

  if (emnekode) {
    console.debug("Emnekode fra URL:", emnekode);
    const { emnrData, karakterwebData } = await fetchCourseData(emnekode);
    makePopUp({ ...emnrData, ...karakterwebData }, emnekode);
  } else {
    console.error("Emnekode not found in the URL.");
  }
})();
