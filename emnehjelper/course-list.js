// Define constants for class names, colors, and grade levels
const TAG_COLORS = {
  GREEN: "green",
  LIME: "lime",
  YELLOW: "yellow",
  ORANGE: "orange",
  RED: "red",
  GRAY: "gray",
};

const DESCRIPTIONS = {
  DIFFICULTY: [
    { threshold: 0.5, label: "Svært Lett", color: TAG_COLORS.GREEN },
    { threshold: 1, label: "Lett", color: TAG_COLORS.LIME },
    { threshold: 1.5, label: "Vanskelig", color: TAG_COLORS.ORANGE },
    { threshold: 2, label: "Svært Vanskelig", color: TAG_COLORS.RED },
    { threshold: Infinity, label: "Ukjent", color: TAG_COLORS.GRAY },
  ],
  WORKLOAD: [
    { threshold: 0.5, label: "Ikke Arbeidsomt", color: TAG_COLORS.GREEN },
    { threshold: 1, label: "Lite Arbeidsomt", color: TAG_COLORS.LIME },
    { threshold: 1.5, label: "Arbeidsomt", color: TAG_COLORS.ORANGE },
    { threshold: 2, label: "Svært Arbeidsomt", color: TAG_COLORS.RED },
    { threshold: Infinity, label: "Ukjent", color: TAG_COLORS.GRAY },
  ],
  GRADE: [
    { threshold: 0.5, label: "F", color: TAG_COLORS.RED },
    { threshold: 1.5, label: "E", color: TAG_COLORS.RED },
    { threshold: 2.5, label: "D", color: TAG_COLORS.ORANGE },
    { threshold: 3.5, label: "C", color: TAG_COLORS.YELLOW },
    { threshold: 4.5, label: "B", color: TAG_COLORS.LIME },
    { threshold: 5, label: "A", color: TAG_COLORS.GREEN },
    { threshold: Infinity, label: "Ukjent", color: TAG_COLORS.GRAY },
  ],
  PASS: [
    { threshold: 50, label: "Stryk", color: TAG_COLORS.RED },
    { threshold: 100, label: "Bestått", color: TAG_COLORS.GREEN },
    { threshold: Infinity, label: "Ukjent", color: TAG_COLORS.GRAY },
  ],
};

const COLUMN_HEADERS = [
  { label: "Antall", dataAttr: "reviews", sortType: "number", tooltip: "Antall studentvurderinger fra emnr.no og karakterweb.no" },
  { label: "Vanskelighet", dataAttr: "difficulty", sortType: "number", tooltip: "Vektet gjennomsnitt av vanskelighetsgradene rapportert av emnr og karakterweb\nSkala: Svært Lett - Lett - Vanskelig - Svært Vanskelig" },
  { label: "Arbeidsmengde", dataAttr: "workload", sortType: "number", tooltip: "Vektet gjennomsnitt av arbeidsmengdene rapportert av emnr og karakterweb\nSkala: Ikke Arbeidsomt - Lite Arbeidsomt - Arbeidsomt - Svært Arbeidsomt" },
  { label: "Snitt", dataAttr: "grade", sortType: "number", tooltip: "Gjennomsnittskarakter basert på siste 3 år eller siste eksamen (avhengig av om skala har endret seg)" },
  { label: "Lenker", dataAttr: "links", sortType: "none", tooltip: "" },
];

const EXTERNAL_LINKS = {
  EMNR: {
    baseUrl: "https://emnr.no/course/",
    title: "Se på emnr.no",
    icon: chrome.runtime.getURL("media/emnr.ico"),
  },
  KARAKTERWEB: {
    baseUrl: `${KARAKTERWEB_PUBLIC_BASE}/`,
    title: "Se på karakterweb.no",
    icon: chrome.runtime.getURL("media/karakterweb.ico"),
  },
  KARAKTERER: {
    baseUrl: "https://karakterer.net/courses/",
    title: "Se på karakterer.net",
    icon: chrome.runtime.getURL("media/karakterernet.ico"),
  },
  STUDIEKVALITETSPORTALEN: {
    baseUrl: "https://innsida.ntnu.no/studiekvalitetsportalen/emner/",
    title: "Se på studiekvalitetsportalen",
    icon: chrome.runtime.getURL("media/ntnu.ico"),
  },
};

// Function to get the appropriate description for difficulty or workload
function getDescription(value, type) {
  if (isNaN(value) || value < 0) value = Infinity;
  const thresholds = DESCRIPTIONS[type.toUpperCase()];
  return thresholds.find((item) => value <= item.threshold).label;
}

// Function to get the appropriate color class
function getColorClass(value, type) {
  if (isNaN(value) || value < 0) value = Infinity;
  const thresholds = DESCRIPTIONS[type.toUpperCase()];
  return thresholds.find((item) => value <= item.threshold).color;
}

// Function to get a sortable numeric value (returns -1 for unknown/invalid values)
function getSortValue(value) {
  if (value == null || isNaN(value) || value < 0) return -1;
  return value;
}

// Function to create a loading animation
function createLoadingAnimation() {
  const loadingAnimation = document.createElement("div");
  loadingAnimation.classList.add("emnehjelper-loading");
  loadingAnimation.innerHTML = `
    <span class="dot"></span>
    <span class="dot"></span>
    <span class="dot"></span>`;
  return loadingAnimation;
}

// Function to create a compact pill element
function createPill(text, colorClass, tooltipText = "") {
  const pill = document.createElement("span");
  pill.classList.add("emnehjelper-pill", colorClass);
  if (tooltipText) {
    pill.title = tooltipText;
  }
  pill.textContent = text;
  pill.setAttribute("role", "status");
  if (tooltipText) {
    pill.setAttribute("aria-label", tooltipText);
  }
  return pill;
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

// Function to create an external link icon
function createExternalLink(emnekode, service) {
  const link = document.createElement("a");
  const fullUrl =
    service === "KARAKTERWEB"
      ? karakterwebCourseUrl(emnekode)
      : EXTERNAL_LINKS[service].baseUrl + emnekode;
  link.href = fullUrl;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.title = EXTERNAL_LINKS[service].title;
  link.classList.add("emnehjelper-link");
  link.setAttribute("aria-label", EXTERNAL_LINKS[service].title);
  
  // Prevent row click from hijacking link clicks
  link.addEventListener("click", (e) => {
    e.stopPropagation();
    // Keep link clickable even if invalid so user can verify
  });
  
  const img = document.createElement("img");
  img.src = EXTERNAL_LINKS[service].icon;
  img.alt = EXTERNAL_LINKS[service].title;
  img.classList.add("emnehjelper-link-icon");
  link.appendChild(img);
  
  // Validate all external links asynchronously
  // Add loading state
  link.classList.add("emnehjelper-link-loading");
  const serviceName = service === "STUDIEKVALITETSPORTALEN" ? "studiekvalitetsportalen" : 
                      service === "EMNR" ? "emnr" :
                      service === "KARAKTERWEB" ? "karakterweb" : "karakterer.net";
  link.title = `Sjekker om ${serviceName} har data for emnet...`;
  
  validateLink(fullUrl).then(isValid => {
    link.classList.remove("emnehjelper-link-loading");
    if (!isValid) {
      link.classList.add("emnehjelper-link-invalid");
      link.title = `${serviceName.charAt(0).toUpperCase() + serviceName.slice(1)} har ikke data for dette emnet`;
      link.setAttribute("aria-label", `${serviceName.charAt(0).toUpperCase() + serviceName.slice(1)} har ikke data for dette emnet`);
    } else {
      link.title = EXTERNAL_LINKS[service].title;
    }
  });
  
  return link;
}

// Function to create a table cell with content
function createCell(content) {
  const cell = document.createElement("td");
  cell.classList.add("emnehjelper-cell");
  if (content) {
    if (Array.isArray(content)) {
      content.forEach(item => cell.appendChild(item));
    } else {
      cell.appendChild(content);
    }
  }
  return cell;
}

// Function to add column headers to a table if not already present
function addColumnHeaders(table) {
  const headerRow = table.querySelector("thead tr, tr:first-child");
  if (!headerRow || headerRow.querySelector(".emnehjelper-header")) return;
  
  COLUMN_HEADERS.forEach((col, index) => {
    const th = document.createElement("th");
    th.classList.add("emnehjelper-header");
    
    // Create abbr element with tooltip if tooltip exists
    if (col.tooltip) {
      const abbr = document.createElement("abbr");
      abbr.textContent = col.label;
      abbr.title = col.tooltip;
      abbr.style.textDecoration = "underline dotted";
      abbr.style.cursor = "help";
      th.appendChild(abbr);
    } else {
      th.textContent = col.label;
    }
    
    th.dataset.emnehjelperCol = col.dataAttr;
    th.dataset.sortType = col.sortType;
    th.setAttribute("aria-sort", "none");
    
    if (col.sortType !== "none") {
      th.style.cursor = "pointer";
      th.addEventListener("click", () => sortTable(table, index, col.sortType));
    }
    
    headerRow.appendChild(th);
  });
}

// Function to sort table by emnehjelper column
function sortTable(table, colIndex, sortType) {
  const tbody = table.querySelector("tbody") || table;
  const rows = Array.from(tbody.querySelectorAll("tr.course, tr.courserow"));
  const headerRow = table.querySelector("thead tr, tr:first-child");
  const headers = headerRow.querySelectorAll(".emnehjelper-header");
  const header = headers[colIndex];
  
  // Determine sort direction
  const currentDir = header.dataset.sortDir || "none";
  const newDir = currentDir === "asc" ? "desc" : "asc";
  
  // Reset all header sort indicators
  headers.forEach(h => {
    h.dataset.sortDir = "none";
    h.classList.remove("sort-asc", "sort-desc");
    h.setAttribute("aria-sort", "none");
  });
  
  header.dataset.sortDir = newDir;
  header.classList.add(newDir === "asc" ? "sort-asc" : "sort-desc");
  header.setAttribute("aria-sort", newDir === "asc" ? "ascending" : "descending");
  
  // Calculate actual column index (original columns + our custom column index)
  const originalColCount = headerRow.children.length - COLUMN_HEADERS.length;
  const actualColIndex = originalColCount + colIndex;
  
  rows.sort((a, b) => {
    const cellA = a.children[actualColIndex];
    const cellB = b.children[actualColIndex];
    
    if (!cellA || !cellB) return 0;
    
    let valA = cellA.dataset.sortValue ?? cellA.textContent.trim();
    let valB = cellB.dataset.sortValue ?? cellB.textContent.trim();
    
    if (sortType === "number") {
      valA = parseFloat(valA) || -Infinity;
      valB = parseFloat(valB) || -Infinity;
    }
    
    let result = 0;
    if (valA < valB) result = -1;
    if (valA > valB) result = 1;
    
    return newDir === "asc" ? result : -result;
  });
  
  // Re-append rows in sorted order
  rows.forEach(row => tbody.appendChild(row));
}

// Function to add hover logic for course name expansion
function addCourseNameHoverEffect(courseNameCell) {
  let timeout;

  courseNameCell.addEventListener("mouseenter", () => {
    timeout = setTimeout(() => {
      courseNameCell.classList.add("expanded");
    }, 300); // Delay in milliseconds
  });

  courseNameCell.addEventListener("mouseleave", () => {
    clearTimeout(timeout);
    courseNameCell.classList.remove("expanded");
  });
}

(async function () {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (!node.querySelectorAll) {
          return;
        }
        
        // Add headers to any new tables
        const tables = node.querySelectorAll ? node.querySelectorAll("table.courselist") : [];
        tables.forEach(addColumnHeaders);
        if (node.tagName === "TABLE" && node.classList.contains("courselist")) {
          addColumnHeaders(node);
        }
        
        let rows = node.querySelectorAll("tr.course, tr.courserow");
        if (rows.length == 0 && node.classList.contains("courserow")) {
          rows = [node];
        }

        rows.forEach((row) => {
          const cell = row.querySelector("td");
          const emnekode = row.classList[1] ?? cell.textContent;
          if (row.classList.contains("emnehjelper-processed")) return;
          row.classList.add("emnehjelper-processed");
          
          const courseNameCell = row.querySelector("td:nth-child(2) > span") ?? row.querySelector("td.coursecode");
          addCourseNameHoverEffect(courseNameCell);

          // Add placeholder cells for loading state
          const reviewsCell = createCell(createLoadingAnimation());
          const difficultyCell = createCell();
          const workloadCell = createCell();
          const gradeCell = createCell();
          const linksCell = createCell();
          
          row.appendChild(reviewsCell);
          row.appendChild(difficultyCell);
          row.appendChild(workloadCell);
          row.appendChild(gradeCell);
          row.appendChild(linksCell);

          // Fetch data for each row immediately and update the DOM
          chrome.runtime
            .sendMessage({
              contentScriptQuery: "get-karakter-data",
              emnekode: emnekode,
            })
            .then((response) => {
              const mergedData = mergeData(
                response.emnrData,
                response.karakterwebData
              );

              // Clear loading animation
              reviewsCell.innerHTML = "";

              if (!mergedData) {
                // Show error state
                reviewsCell.textContent = "—";
                difficultyCell.appendChild(createPill("—", TAG_COLORS.GRAY, "Ingen data tilgjengelig"));
                workloadCell.appendChild(createPill("—", TAG_COLORS.GRAY, "Ingen data tilgjengelig"));
                gradeCell.appendChild(createPill("—", TAG_COLORS.GRAY, "Ingen data tilgjengelig"));
                return;
              }

              const {
                average_difficulty,
                average_workload,
                average_grade,
                emnr_review_count,
                karakterweb_review_count,
                review_count,
                is_graded,
                pass_rate,
              } = mergedData;

              // Check for API failures and show warning if needed
              const hasEmnrData = response.emnrData !== null;
              const hasKarakterweb = response.karakterwebData !== null;
              
              // Create difficulty pill
              const difficultyPill = createPill(
                getDescription(average_difficulty, "difficulty"),
                getColorClass(average_difficulty, "difficulty")
              );
              difficultyCell.appendChild(difficultyPill);
              difficultyCell.dataset.sortValue = getSortValue(average_difficulty);
              
              // Add review count to its own cell with breakdown
              const reviewAbbr = document.createElement("abbr");
              reviewAbbr.classList.add("emnehjelper-reviews");
              reviewAbbr.textContent = review_count;
              reviewAbbr.title = `${emnr_review_count} fra emnr.no\n${karakterweb_review_count} fra karakterweb.no`;
              reviewAbbr.style.textDecoration = "underline dotted";
              reviewAbbr.style.cursor = "help";
              reviewsCell.appendChild(reviewAbbr);
              reviewsCell.dataset.sortValue = review_count ?? 0;

              // Create workload pill
              const workloadPill = createPill(
                getDescription(average_workload, "workload"),
                getColorClass(average_workload, "workload")
              );
              workloadCell.appendChild(workloadPill);
              workloadCell.dataset.sortValue = getSortValue(average_workload);

              // Create grade/pass pill
              if (is_graded) {
                const gradePill = createPill(
                  getDescription(average_grade, "grade"),
                  getColorClass(average_grade, "grade")
                );
                gradeCell.appendChild(gradePill);
                gradeCell.dataset.sortValue = getSortValue(average_grade);
              } else {
                const passPill = createPill(
                  getDescription(pass_rate, "pass"),
                  getColorClass(pass_rate, "pass")
                );
                gradeCell.appendChild(passPill);
                gradeCell.dataset.sortValue = getSortValue(pass_rate);
              }

              // Add warning indicator if API failed
              if (!hasEmnrData || !hasKarakterweb) {
                const failedAPIs = [];
                if (!hasEmnrData) failedAPIs.push('emnr.no');
                if (!hasKarakterweb) failedAPIs.push('karakterweb.no');
                
                // Mark row as having warning
                row.classList.add('emnehjelper-warning-row');
                
                // Add floating warning indicator
                const warningIndicator = document.createElement('div');
                warningIndicator.className = 'emnehjelper-warning-indicator';
                warningIndicator.title = `Ufullstendige data: Kunne ikke hente fra ${failedAPIs.join(' og ')}`;
                reviewsCell.style.position = 'relative';
                reviewsCell.appendChild(warningIndicator);
              }

              // Create external links
              const linksContainer = document.createElement("div");
              linksContainer.classList.add("emnehjelper-links");
              linksContainer.appendChild(createExternalLink(emnekode, "EMNR"));
              linksContainer.appendChild(createExternalLink(emnekode, "KARAKTERWEB"));
              linksContainer.appendChild(createExternalLink(emnekode, "KARAKTERER"));
              linksContainer.appendChild(createExternalLink(emnekode, "STUDIEKVALITETSPORTALEN"));
              linksCell.appendChild(linksContainer);
            })
            .catch((error) => {
              console.error(
                `Error fetching course data for ${emnekode}`,
                error
              );
              difficultyCell.innerHTML = "";
              difficultyCell.appendChild(createPill("—", TAG_COLORS.GRAY, "Feil ved henting av data"));
            });
        });
      });
    });
  });
  
  // Initial scan for existing tables
  document.querySelectorAll("table.courselist").forEach(addColumnHeaders);
  
  observer.observe(document, { childList: true, subtree: true });
})();
