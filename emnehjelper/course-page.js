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

// Helper to get the appropriate grade scale labels
function getGradeScaleLabels(data) {
  return data.is_graded ? GRADE_LABELS : PASS_FAIL_LABELS;
}

module.exports = {
  extractEmnekodeFromURL,
  fetchCourseData,
  getGradeScaleLabels,
  URL_REGEX,
  ENDPOINTS,
  ColorScheme,
  WorkloadLevels,
  DifficultyLevels,
  Grades,
  PassLevels,
  WORKLOAD_LABELS,
  DIFFICULTY_LABELS,
  GRADE_LABELS,
  PASS_FAIL_LABELS,
};
