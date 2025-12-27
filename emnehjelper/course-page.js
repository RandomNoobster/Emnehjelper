// Constants and Enums
const URL_REGEX = /.*\/([A-Za-zÆØÅæøå]{2,5}\d{3,4})/;

const ENDPOINTS = {
  EMNR: (emnekode) => `https://emnr.no/course/${emnekode}`,
  KARAKTERWEB: (emnekode) => `https://www.karakterweb.no/ntnu/${emnekode}`,
  KARAKTERNET: (emnekode) => `https://karakterer.net/courses/${emnekode}`,
  STUDIEKVALITETSPORTALEN: (emnekode) => `https://innsida.ntnu.no/studiekvalitetsportalen/emner/${emnekode}`,
};

const ColorScheme = {
  LOW_IS_GOOD: "low-is-good",
  HIGH_IS_GOOD: "high-is-good",
};

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

const PassLevels = {
  IKKE_BESTÅTT: 0,
  BESTÅTT: 100,
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

const PASS_FAIL_LABELS = {
  [PassLevels.IKKE_BESTÅTT]: "Ikke Bestått",
  [PassLevels.BESTÅTT]: "Bestått",
};

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

function makePopUp(data, emnekode, response) {
  const popupParent = document.createElement("div");
  popupParent.className = "popup";
  
  // Create main popup container
  const popup = document.createElement("div");
  popup.className = "popup-inner";

  // Bubble (shown when minimized)
  const bubble = document.createElement("img");
  bubble.className = "popup-bubble";
  bubble.src = chrome.runtime.getURL("media/e-h128.png");
  bubble.alt = "Emnehjelper Logo";

  // === HEADER ===
  const header = document.createElement("div");
  header.className = "popup-header";
  
  const headerLogo = document.createElement("img");
  headerLogo.className = "popup-header-logo";
  headerLogo.src = chrome.runtime.getURL("media/e-h128.png");
  headerLogo.alt = "Emnehjelper";
  
  const headerText = document.createElement("div");
  headerText.className = "popup-header-text";
  
  const headerTitle = document.createElement("h3");
  headerTitle.className = "popup-header-title";
  headerTitle.textContent = emnekode.toUpperCase();
  
  const headerSubtitle = document.createElement("p");
  headerSubtitle.className = "popup-header-subtitle";
  headerSubtitle.textContent = "Emnestatistikk og vurderinger";
  
  headerText.appendChild(headerTitle);
  headerText.appendChild(headerSubtitle);
  
  // Minimize button
  const minimizeButton = document.createElement("button");
  minimizeButton.className = "popup-minimize";
  minimizeButton.textContent = "−";
  minimizeButton.onclick = (e) => {
    e.stopPropagation();
    togglePopup(false);
  };
  
  header.appendChild(headerLogo);
  header.appendChild(headerText);
  header.appendChild(minimizeButton);
  popup.appendChild(header);

  // === CONTENT AREA ===
  const content = document.createElement("div");
  content.className = "popup-content";

  // Add warning banner if any API failed
  if (response && (response.emnrData === null || response.karakterwebData === null)) {
    const failedAPIs = [];
    if (response.emnrData === null) failedAPIs.push('emnr');
    if (response.karakterwebData === null) failedAPIs.push('karakterweb');
    
    const warning = document.createElement("div");
    warning.className = "warning-banner";
    warning.innerHTML = `<span class="warning-icon">⚠️</span> Data fra ${failedAPIs.join(' og ')} kunne ikke hentes. Viser kun tilgjengelig data.`;
    content.appendChild(warning);
  }

  // === STATS GRID ===
  const statsGrid = document.createElement("div");
  statsGrid.className = "stats-grid";
  
  // Pass rate stat
  const passRateStat = createStatCard(
    `${data.pass_rate?.toFixed(1) ?? "--"}%`,
    "Beståttprosent"
  );
  statsGrid.appendChild(passRateStat);
  
  // Grade/Work ratio stat
  const ratioValue = data.average_workload && data.average_grade > 0
    ? (data.average_grade / data.average_workload).toFixed(2)
    : "-.--";
  const ratioStat = createStatCard(ratioValue, "Karakter/Arbeid");
  statsGrid.appendChild(ratioStat);
  
  content.appendChild(statsGrid);

  // === REVIEWS SECTION ===
  const reviewsSection = document.createElement("div");
  reviewsSection.className = "reviews-section";
  
  const reviewsHeader = document.createElement("div");
  reviewsHeader.className = "reviews-header";
  reviewsHeader.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6l2-1.09V17h2V9L12 3zm6.82 6L12 12.72 5.18 9 12 5.28 18.82 9zM17 15.99l-5 2.73-5-2.73v-3.72L12 15l5-2.73v3.72z"/></svg>Studentvurderinger`;
  
  const reviewsBreakdown = document.createElement("div");
  reviewsBreakdown.className = "reviews-breakdown";
  
  // Emnr reviews
  reviewsBreakdown.appendChild(createReviewSource(
    chrome.runtime.getURL("media/emnr.ico"),
    "emnr",
    data.emnr_review_count ?? 0
  ));
  
  // Karakterweb reviews
  reviewsBreakdown.appendChild(createReviewSource(
    chrome.runtime.getURL("media/karakterweb.ico"),
    "karakterweb",
    data.karakterweb_review_count ?? 0
  ));
  
  reviewsSection.appendChild(reviewsHeader);
  reviewsSection.appendChild(reviewsBreakdown);
  content.appendChild(reviewsSection);

  // === DISCLAIMER ===
  const disclaimer = document.createElement("div");
  disclaimer.className = "disclaimer";
  disclaimer.textContent = "Statistikken er sammenslått fra emnr og karakterweb:";
  content.appendChild(disclaimer);

  // === SLIDERS SECTION ===
  const slidersSection = document.createElement("div");
  slidersSection.className = "sliders-section";

  addModernSlider(
    slidersSection,
    "Arbeidsmengde",
    data.average_workload,
    WORKLOAD_LABELS,
    WorkloadLevels.LOW,
    WorkloadLevels.HIGH,
    ColorScheme.LOW_IS_GOOD
  );
  
  addModernSlider(
    slidersSection,
    "Vanskelighetsgrad",
    data.average_difficulty,
    DIFFICULTY_LABELS,
    DifficultyLevels.EASY,
    DifficultyLevels.HARD,
    ColorScheme.LOW_IS_GOOD
  );
  
  if (!data.is_graded) {
    addModernSlider(
      slidersSection,
      "Beståttprosent",
      data.pass_rate,
      PASS_FAIL_LABELS,
      PassLevels.IKKE_BESTÅTT,
      PassLevels.BESTÅTT,
      ColorScheme.HIGH_IS_GOOD
    );
  } else {
    addModernSlider(
      slidersSection,
      "Gjennomsnittskarakter",
      data.average_grade,
      GRADE_LABELS,
      Grades.F,
      Grades.A,
      ColorScheme.HIGH_IS_GOOD
    );
  }
  
  content.appendChild(slidersSection);

  // === SERVICE LINKS ===
  const servicesSection = document.createElement("div");
  servicesSection.className = "services-section";
  
  const servicesHeader = document.createElement("div");
  servicesHeader.className = "services-header";
  servicesHeader.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>Se mer`;
  
  const servicesGrid = document.createElement("div");
  servicesGrid.className = "services-grid";
  
  servicesGrid.appendChild(createServiceButton(
    ENDPOINTS.EMNR(emnekode),
    chrome.runtime.getURL("media/emnr.ico"),
    "emnr.no",
    "Vurderinger"
  ));
  
  servicesGrid.appendChild(createServiceButton(
    ENDPOINTS.KARAKTERWEB(emnekode),
    chrome.runtime.getURL("media/karakterweb.ico"),
    "Karakterweb",
    "Fordelinger, historikk og vurderinger"
  ));
  
  servicesGrid.appendChild(createServiceButton(
    ENDPOINTS.KARAKTERNET(emnekode),
    chrome.runtime.getURL("media/karakterernet.ico"),
    "Karakterer.net",
    "Karakterfordelinger og historikk"
  ));
  
  servicesGrid.appendChild(createServiceButton(
    ENDPOINTS.STUDIEKVALITETSPORTALEN(emnekode),
    chrome.runtime.getURL("media/ntnu.ico"),
    "Studiekvalitetsportalen",
    "Kvalitetsvurderinger og referansegrupper"
  ));
  
  servicesSection.appendChild(servicesHeader);
  servicesSection.appendChild(servicesGrid);
  content.appendChild(servicesSection);

  popup.appendChild(content);
  popupParent.appendChild(popup);
  popupParent.appendChild(bubble);

  // Toggle popup visibility
  function togglePopup(showPopup) {
    const bubbleSize = 50;
    const popupWidth = 320;
    const margin = 10;
    
    if (showPopup) {
      // Expand from bubble - anchor on RIGHT edge
      const rect = popupParent.getBoundingClientRect();
      const rightEdge = rect.right;
      const newLeft = rightEdge - popupWidth;
      
      // Clamp to screen bounds
      const clampedLeft = Math.max(margin, Math.min(newLeft, window.innerWidth - popupWidth - margin));
      const clampedTop = Math.max(margin, Math.min(rect.top, window.innerHeight - 400));
      
      // First, set expanding state (keeps inner hidden during width change)
      popupParent.classList.remove("minimized");
      popupParent.classList.remove("minimizing");
      popupParent.classList.add("expanding");
      
      popupParent.style.left = `${clampedLeft}px`;
      popupParent.style.top = `${clampedTop}px`;
      popupParent.style.right = "auto";
      
      // After a frame, remove expanding to trigger the animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          popupParent.classList.remove("expanding");
        });
      });
    } else {
      // Minimize to bubble - anchor on RIGHT edge
      const rect = popupParent.getBoundingClientRect();
      const rightEdge = rect.right;
      const newLeft = rightEdge - bubbleSize;
      
      // Clamp to screen bounds
      const maxLeft = window.innerWidth - bubbleSize - margin;
      const maxTop = window.innerHeight - bubbleSize - margin;
      const clampedLeft = Math.max(margin, Math.min(newLeft, maxLeft));
      const clampedTop = Math.max(margin, Math.min(rect.top, maxTop));
      
      popupParent.style.left = `${clampedLeft}px`;
      popupParent.style.top = `${clampedTop}px`;
      popupParent.style.right = "auto";
      
      // Start minimizing animation
      popupParent.classList.add("minimizing");
      
      // After animation completes, switch to minimized state
      setTimeout(() => {
        popupParent.classList.remove("minimizing");
        popupParent.classList.add("minimized");
      }, 300);
    }
  }

  // Add draggable functionality (must be after togglePopup is defined)
  makePopupDraggable(popupParent, () => togglePopup(true));

  // Append to body
  document.body.appendChild(popupParent);
}

// Create a stat card element
function createStatCard(value, label, fullWidth = false) {
  const card = document.createElement("div");
  card.className = "stat-card" + (fullWidth ? " full-width" : "");
  
  const valueEl = document.createElement("div");
  valueEl.className = "stat-value";
  valueEl.textContent = value;
  
  const labelEl = document.createElement("div");
  labelEl.className = "stat-label";
  labelEl.textContent = label;
  
  card.appendChild(valueEl);
  card.appendChild(labelEl);
  return card;
}

// Create a review source element
function createReviewSource(logoUrl, name, count) {
  const source = document.createElement("div");
  source.className = "review-source";
  
  const logo = document.createElement("img");
  logo.className = "review-source-logo";
  logo.src = logoUrl;
  logo.alt = name;
  
  const info = document.createElement("div");
  info.className = "review-source-info";
  
  const countEl = document.createElement("span");
  countEl.className = "review-source-count";
  countEl.textContent = count;
  
  const nameEl = document.createElement("span");
  nameEl.className = "review-source-name";
  nameEl.textContent = name;
  
  info.appendChild(countEl);
  info.appendChild(nameEl);
  source.appendChild(logo);
  source.appendChild(info);
  
  return source;
}

// Function to validate if a link exists
async function validateLink(url) {
  try {
    const response = await chrome.runtime.sendMessage({
      contentScriptQuery: "validate-link",
      url: url,
    });
    return response.isValid;
  } catch (error) {
    console.error("Error validating link:", error);
    return true; // Assume valid if validation fails
  }
}

// Create a service button link
function createServiceButton(href, logoUrl, name, description) {
  const btn = document.createElement("a");
  btn.className = "service-btn";
  btn.href = href;
  btn.target = "_blank";
  
  const logo = document.createElement("img");
  logo.className = "service-btn-logo";
  logo.src = logoUrl;
  logo.alt = name;
  btn.appendChild(logo);
  
  const text = document.createElement("div");
  text.className = "service-btn-text";
  
  const nameEl = document.createElement("div");
  nameEl.className = "service-btn-name";
  nameEl.textContent = name;
  
  const descEl = document.createElement("div");
  descEl.className = "service-btn-desc";
  descEl.textContent = description;
  
  text.appendChild(nameEl);
  text.appendChild(descEl);
  btn.appendChild(text);
  
  const arrow = document.createElement("span");
  arrow.className = "service-btn-arrow";
  arrow.textContent = "→";
  btn.appendChild(arrow);
  
  // Validate all service links asynchronously
  // Add loading state
  btn.classList.add("service-btn-loading");
  const originalDesc = descEl.textContent;
  descEl.textContent = "Sjekker tilgjengelighet...";
  
  validateLink(href).then(isValid => {
    btn.classList.remove("service-btn-loading");
    if (!isValid) {
      btn.classList.add("service-btn-invalid");
      descEl.textContent = "Data er ikke tilgjengelig for dette emnet";
      // Keep button clickable so user can verify
    } else {
      descEl.textContent = originalDesc;
    }
  });
  
  return btn;
}

// Modern slider with proper structure
function addModernSlider(parent, label, value, scaleLabels, min, max, colorScheme) {
  const group = document.createElement("div");
  group.className = "slider-group";
  
  // Header with label and value
  const header = document.createElement("div");
  header.className = "slider-header";
  
  // Label wrapper with help icon
  const labelWrapper = document.createElement("div");
  labelWrapper.className = "slider-label-wrapper";
  
  const labelEl = document.createElement("span");
  labelEl.className = "slider-label";
  labelEl.textContent = label;
  
  // Help icon with tooltip
  const helpIcon = document.createElement("span");
  helpIcon.className = "slider-help";
  helpIcon.textContent = "?";
  
  const tooltip = document.createElement("div");
  tooltip.className = "slider-help-tooltip";
  
  // Create visual scale representation
  const tooltipTitle = document.createElement("div");
  tooltipTitle.className = "tooltip-title";
  
  const tooltipScale = document.createElement("div");
  tooltipScale.className = "tooltip-scale";
  
  if (scaleLabels === PASS_FAIL_LABELS) {
    tooltipTitle.textContent = "Skala for beståttprosent";
    const items = [
      { value: "0%", label: "Ingen" },
      { value: "50%", label: "Halvparten" },
      { value: "100%", label: "Alle" }
    ];
    items.forEach(item => {
      const scaleItem = document.createElement("div");
      scaleItem.className = "tooltip-scale-item";
      scaleItem.innerHTML = `<span class="tooltip-value">${item.value}</span><span class="tooltip-label">${item.label}</span>`;
      tooltipScale.appendChild(scaleItem);
    });
  } else if (scaleLabels === GRADE_LABELS) {
    tooltipTitle.textContent = "Karakterskala";
    const grades = ["F", "E", "D", "C", "B", "A"];
    grades.forEach((grade, i) => {
      const scaleItem = document.createElement("div");
      scaleItem.className = "tooltip-scale-item";
      scaleItem.innerHTML = `<span class="tooltip-value">${grade}</span><span class="tooltip-label">${i}</span>`;
      tooltipScale.appendChild(scaleItem);
    });
  } else if (label === "Vanskelighetsgrad") {
    tooltipTitle.textContent = "Skala for vanskelighetsgrad";
    const levels = [
      { value: "Lav", num: "0" },
      { value: "Middels", num: "1" },
      { value: "Høy", num: "2" }
    ];
    levels.forEach(level => {
      const scaleItem = document.createElement("div");
      scaleItem.className = "tooltip-scale-item";
      scaleItem.innerHTML = `<span class="tooltip-value">${level.value}</span><span class="tooltip-label">${level.num}</span>`;
      tooltipScale.appendChild(scaleItem);
    });
  } else {
    tooltipTitle.textContent = "Skala for arbeidsmengde";
    const levels = [
      { value: "Lav", num: "0" },
      { value: "Middels", num: "1" },
      { value: "Høy", num: "2" }
    ];
    levels.forEach(level => {
      const scaleItem = document.createElement("div");
      scaleItem.className = "tooltip-scale-item";
      scaleItem.innerHTML = `<span class="tooltip-value">${level.value}</span><span class="tooltip-label">${level.num}</span>`;
      tooltipScale.appendChild(scaleItem);
    });
  }
  
  tooltip.appendChild(tooltipTitle);
  tooltip.appendChild(tooltipScale);
  helpIcon.appendChild(tooltip);
  labelWrapper.appendChild(labelEl);
  labelWrapper.appendChild(helpIcon);
  
  const valueDisplay = document.createElement("span");
  valueDisplay.className = "slider-value-display";
  
  let displayValue;
  if (scaleLabels === PASS_FAIL_LABELS) {
    displayValue = value?.toFixed(1) + "%" ?? "--%";
  } else {
    displayValue = value >= min && value <= max
      ? `${scaleLabels[Math.round(value)]} (${value.toFixed(2)})`
      : "- (-.--)";
  }
  valueDisplay.textContent = displayValue;
  
  header.appendChild(labelWrapper);
  header.appendChild(valueDisplay);
  group.appendChild(header);
  
  // Slider
  const slider = document.createElement("input");
  slider.className = colorScheme;
  slider.type = "range";
  slider.min = min;
  slider.max = max;
  slider.step = "0.01";
  slider.value = value?.toFixed(2) ?? min;
  slider.disabled = true;
  group.appendChild(slider);
  
  // Scale labels - show all labels with equal spacing
  const scale = document.createElement("div");
  scale.className = "slider-scale";
  
  // For pass/fail, only show first and last
  if (scaleLabels === PASS_FAIL_LABELS) {
    const scaleKeys = Object.keys(scaleLabels);
    const firstLabel = document.createElement("span");
    firstLabel.textContent = scaleLabels[scaleKeys[0]];
    const lastLabel = document.createElement("span");
    lastLabel.textContent = scaleLabels[scaleKeys[scaleKeys.length - 1]];
    scale.appendChild(firstLabel);
    scale.appendChild(lastLabel);
  } else {
    // Show all labels for grades and workload/difficulty
    const scaleKeys = Object.keys(scaleLabels).sort((a, b) => Number(a) - Number(b));
    scaleKeys.forEach((key) => {
      const labelSpan = document.createElement("span");
      labelSpan.textContent = scaleLabels[key];
      scale.appendChild(labelSpan);
    });
  }
  
  group.appendChild(scale);
  
  parent.appendChild(group);
}

// Add draggable functionality to the popup
function makePopupDraggable(popup, onBubbleClick) {
  let isDragging = false;
  let hasDragged = false;
  let initialX, initialY, offsetX, offsetY;

  popup.addEventListener("mousedown", (event) => {
    isDragging = true;
    hasDragged = false;
    initialX = event.clientX;
    initialY = event.clientY;
    
    // Get current position before changing anything
    const rect = popup.getBoundingClientRect();
    offsetX = rect.left;
    offsetY = rect.top;
    
    // Set left position FIRST, then clear right to prevent jump
    popup.style.left = `${offsetX}px`;
    popup.style.top = `${offsetY}px`;
    popup.style.right = "auto";
  });

  document.addEventListener("mousemove", (event) => {
    if (isDragging) {
      const dx = event.clientX - initialX;
      const dy = event.clientY - initialY;
      
      // Only count as drag if moved more than 5px
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        hasDragged = true;
      }
      
      // Calculate new position - no bounds clamping, allow free movement
      const newLeft = offsetX + dx;
      const newTop = offsetY + dy;
      
      popup.style.left = `${newLeft}px`;
      popup.style.top = `${newTop}px`;
    }
  });

  document.addEventListener("mouseup", (event) => {
    if (isDragging) {
      if (!hasDragged) {
        // It was a click, not a drag - check if we clicked on the bubble
        const bubble = popup.querySelector(".popup-bubble");
        if (bubble && popup.classList.contains("minimized")) {
          onBubbleClick();
        }
      }
      // No bounds clamping after drag - keep position as-is
    }
    isDragging = false;
  });
}

// Main function
(async function main() {
  const url = decodeURI(window.location.href);
  const emnekode = extractEmnekodeFromURL(url);

  if (emnekode) {
    console.debug("Emnekode fra URL:", emnekode);
    const response = await fetchCourseData(emnekode);
    const mergedData = mergeData(response.emnrData, response.karakterwebData);
    if (mergedData) {
      makePopUp(mergedData, emnekode, response);
    } else {
      console.error("Failed to merge course data for:", emnekode);
    }
  } else {
    console.error("Emnekode not found in the URL.");
  }
})();
