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
    { threshold: 50, label: "Ikke Bestått", color: TAG_COLORS.RED },
    { threshold: 100, label: "Bestått", color: TAG_COLORS.GREEN },
    { threshold: Infinity, label: "Ukjent", color: TAG_COLORS.GRAY },
  ],
};

const TOOLTIP_TEXT = {
  DIFFICULTY:
    "Vektet gjennomsnitt av vanskelighetsgradene rapportert av emnr og karakterweb\nSkala: Svært Lett - Lett - Vanskelig - Svært Vanskelig",
  WORKLOAD:
    "Vektet gjennomsnitt av arbeidsmengdene rapportert av emnr og karakterweb\nSkala: Ikke Arbeidsomt - Lite Arbeidsomt - Arbeidsomt - Svært Arbeidsomt",
  GRADE: "Gjennomsnittlig karakter gjennom årene\nSkala: F - E - D - C - B - A",
  PASS: "Andel studenter som har bestått emnet",
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

// Function to create a loading animation
function createLoadingAnimation() {
  const loadingAnimation = document.createElement("div");
  loadingAnimation.classList.add("loading");
  loadingAnimation.innerHTML = `
    <span class="dot"></span>
    <span class="dot"></span>
    <span class="dot"></span>`;
  return loadingAnimation;
}

// Function to create an abbreviation (abbr) element with a tooltip
function createAbbrElement(text, colorClass, tooltipText) {
  const abbr = document.createElement("abbr");
  abbr.classList.add("tag", colorClass);
  abbr.title = tooltipText;
  abbr.textContent = text;
  return abbr;
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
        let rows = node.querySelectorAll("tr.course, tr.courserow");
        if (rows.length == 0 && node.classList.contains("courserow")) {
          rows = [node];
        }

        rows.forEach((row) => {
          const cell = row.querySelector("td");
          const emnekode = row.classList[1] ?? cell.textContent;
          if (cell.classList.contains("emnehjelper-info")) return;
          const courseNameCell = row.querySelector("td:nth-child(2) > span") ?? row.querySelector("td.coursecode");
          addCourseNameHoverEffect(courseNameCell);

          const loadingAnimation = createLoadingAnimation();
          cell.appendChild(loadingAnimation);

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

              if (!mergedData) return;

              const {
                average_difficulty,
                average_workload,
                average_grade_letter,
                average_grade,
                emnr_review_count,
                karakterweb_review_count,
                review_count,
                is_graded,
                pass_rate,
              } = mergedData;

              if (loadingAnimation) loadingAnimation.remove();

              // Create and append review abbr element
              const reviewAbbr = createAbbrElement(
                `${review_count}`,
                TAG_COLORS.GRAY,
                `Antall anmeldelser (${emnr_review_count} fra emnr og ${karakterweb_review_count} fra karakterweb)`
              );
              cell.appendChild(reviewAbbr);

              // Create and append difficulty abbr element
              const difficultyAbbr = createAbbrElement(
                getDescription(average_difficulty, "difficulty"),
                getColorClass(average_difficulty, "difficulty"),
                TOOLTIP_TEXT.DIFFICULTY
              );
              cell.appendChild(difficultyAbbr);

              // Create and append workload abbr element
              const workloadAbbr = createAbbrElement(
                getDescription(average_workload, "workload"),
                getColorClass(average_workload, "workload"),
                TOOLTIP_TEXT.WORKLOAD
              );
              cell.appendChild(workloadAbbr);

              // Create and append grade abbr element
              const gradeAbbr = is_graded
                ? createAbbrElement(
                    getDescription(average_grade, "grade"),
                    getColorClass(average_grade, "grade"),
                    TOOLTIP_TEXT.GRADE
                  )
                : createAbbrElement(
                    getDescription(pass_rate, "pass"),
                    getColorClass(pass_rate, "pass"),
                    TOOLTIP_TEXT.PASS
                  );
              cell.appendChild(gradeAbbr);

              // Mark the cell as processed
              cell.classList.add("emnehjelper-info");
            })
            .catch((error) => {
              console.error(
                `Error fetching course data for ${emnekode}`,
                error
              );
              if (loadingAnimation) loadingAnimation.remove();
            });
        });
      });
    });
  });
  observer.observe(document, { childList: true, subtree: true });
})();
