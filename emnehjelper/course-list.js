// Define constants for class names, colors, and grade levels
const TAG_COLORS = {
  GREEN: "green",
  LIME: "lime",
  YELLOW: "yellow",
  ORANGE: "orange",
  RED: "red",
  GRAY: "gray",
};

// The thresholds are the upper bounds for each description
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

module.exports = {
  getDescription,
  getColorClass,
  createLoadingAnimation,
  createAbbrElement,
  addCourseNameHoverEffect,
};
