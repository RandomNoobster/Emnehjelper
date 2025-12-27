/**
 * Convert semester and year to a comparable number for chronological ordering
 * Vår (Spring) comes before Høst (Fall) in the same year
 * @param {string} semester - "Vår" or "Høst"
 * @param {number} year - Year as number
 * @returns {number} - Comparable number (year * 10 + semester offset)
 */
function getSemesterSortValue(semester, year) {
  // Vår = 0, Høst = 5 (so 2020 Vår < 2020 Høst < 2021 Vår)
  const semesterOffset = semester === "Vår" ? 0 : 5;
  return year * 10 + semesterOffset;
}

/**
 * Calculate average grade from karakterweb grades data
 * @param {Array} gradesData - Array of grade objects from karakterweb
 * @param {number} yearsBack - Number of years to look back (null for all time)
 * @param {string} courseCode - Course code for logging
 * @returns {Object} - { average_grade, average_grade_letter, pass_rate, total_candidates, is_graded, has_mixed_scales }
 */
function calculateKarakterwebStats(gradesData, yearsBack = null, courseCode = 'unknown') {
  if (!gradesData || gradesData.length === 0) {
    return {
      average_grade: -1,
      average_grade_letter: null,
      pass_rate: -1,
      total_candidates: 0,
      is_graded: null,
      has_mixed_scales: false,
    };
  }

  // Sort data chronologically (most recent first)
  const sortedData = [...gradesData].sort((a, b) => {
    const aValue = getSemesterSortValue(a.Semester, parseInt(a.Årstall));
    const bValue = getSemesterSortValue(b.Semester, parseInt(b.Årstall));
    return bValue - aValue; // Descending (most recent first)
  });

  // Find the most recent entry to establish cutoff point
  const mostRecent = sortedData[0];
  const mostRecentValue = getSemesterSortValue(mostRecent.Semester, parseInt(mostRecent.Årstall));
  
  // Calculate cutoff based on years back from most recent exam (not current date)
  let cutoffValue = 0;
  if (yearsBack !== null) {
    const cutoffYear = parseInt(mostRecent.Årstall) - yearsBack;
    cutoffValue = getSemesterSortValue(mostRecent.Semester, cutoffYear);
  }

  // Filter data by time range
  const filteredData = sortedData.filter((item) => {
    const itemValue = getSemesterSortValue(item.Semester, parseInt(item.Årstall));
    return itemValue >= cutoffValue;
  });

  if (filteredData.length === 0) {
    return {
      average_grade: -1,
      average_grade_letter: null,
      pass_rate: 0,
      total_candidates: 0,
      is_graded: null,
      has_mixed_scales: false,
    };
  }

  // Check if all entries use the same grade scale
  const scales = [...new Set(filteredData.map(item => item.Karakterskala))];
  const has_mixed_scales = scales.length > 1;

  // Determine if course is graded or pass/fail based on karakterskala of most recent entry
  // G-H means pass/fail (Bestått/Stryk), everything else is graded (A-F)
  const karakterskala = filteredData[0].Karakterskala;
  const is_graded = karakterskala !== "G-H";

  let totalCandidates = 0;
  let totalPassed = 0;
  let gradeSum = 0;

  if (is_graded) {
    // Graded course (A-F scale) - calculate weighted average grade
    // A=5, B=4, C=3, D=2, E=1, F=0
    const gradeValues = { A: 5, B: 4, C: 3, D: 2, E: 1, F: 0 };

    filteredData.forEach((item) => {
      const distribution = item.Karakterfordeling;
      Object.keys(distribution).forEach((grade) => {
        const count = distribution[grade].Alle;
        if (gradeValues.hasOwnProperty(grade)) {
          gradeSum += gradeValues[grade] * count;
          totalCandidates += count;
          // Any grade better than F counts as passing
          if (grade !== "F") {
            totalPassed += count;
          }
        }
      });
    });
  } else {
    // Pass/fail course (Bestått/Stryk) - calculate pass rate
    filteredData.forEach((item) => {
      const distribution = item.Karakterfordeling;
      if (distribution["Bestått"]) {
        totalPassed += distribution["Bestått"].Alle;
        totalCandidates += distribution["Bestått"].Alle;
      }
      if (distribution["Ikke bestått"]) {
        totalCandidates += distribution["Ikke bestått"].Alle;
      }
    });
  }

  if (totalCandidates === 0) {
    return {
      average_grade: -1,
      average_grade_letter: null,
      pass_rate: -1,
      total_candidates: 0,
      is_graded,
      has_mixed_scales,
    };
  }

  const pass_rate = (totalPassed / totalCandidates) * 100;

  if (is_graded) {
    // Graded course - return average grade and letter
    const average_grade = gradeSum / totalCandidates;
    const gradeLetters = ["F", "E", "D", "C", "B", "A"];
    const average_grade_letter = gradeLetters[Math.round(average_grade)];

    return {
      average_grade,
      average_grade_letter,
      pass_rate,
      total_candidates: totalCandidates,
      is_graded,
      has_mixed_scales,
    };
  } else {
    // Pass/fail course - convert pass_rate to 0-5 scale for consistency with graded courses
    const average_grade = pass_rate / 20;

    return {
      average_grade,
      average_grade_letter: null,
      pass_rate,
      total_candidates: totalCandidates,
      is_graded,
      has_mixed_scales,
    };
  }
}

/**
 * Get the most recent single exam data
 * @param {Array} gradesData - Array of grade objects from karakterweb
 * @param {string} courseCode - Course code for logging
 * @returns {Object} - Stats for the most recent exam
 */
function getMostRecentStats(gradesData, courseCode = 'unknown') {
  if (!gradesData || gradesData.length === 0) {
    return {
      average_grade: -1,
      average_grade_letter: null,
      pass_rate: 0,
      total_candidates: 0,
      is_graded: null,
      has_mixed_scales: false,
    };
  }

  // Sort to find most recent
  const sortedData = [...gradesData].sort((a, b) => {
    const aValue = getSemesterSortValue(a.Semester, parseInt(a.Årstall));
    const bValue = getSemesterSortValue(b.Semester, parseInt(b.Årstall));
    return bValue - aValue;
  });

  // Use only the most recent entry
  return calculateKarakterwebStats([sortedData[0]], null, courseCode);
}

/**
 * Choose the best stats to display based on scale consistency
 * Priority: 3 years (if same scale) > most recent single exam
 * @param {Object} stats_3years - Stats for last 3 years
 * @param {Array} gradesData - Raw grades data
 * @param {string} courseCode - Course code for logging
 * @returns {Object} - { stats, timePeriodLabel } where timePeriodLabel is 'siste 3 år' or 'siste eksamen'
 */
function chooseBestStatsForDisplay(stats_3years, gradesData, courseCode = 'unknown') {
  // If 3 years data exists and uses consistent scale, use it
  if (stats_3years.total_candidates > 0 && !stats_3years.has_mixed_scales) {
    return { stats: stats_3years, timePeriodLabel: 'siste 3 år' };
  }
  
  // Otherwise, use most recent single exam
  return { stats: getMostRecentStats(gradesData, courseCode), timePeriodLabel: 'siste eksamen' };
}

function mergeData(emnrData, karakterwebData) {
  // Guard clause - only return null if BOTH are null
  if (!emnrData && !karakterwebData) {
    console.error("mergeData called with both null data");
    return null;
  }

  // Handle case where only karakterwebData is null
  if (!karakterwebData || !karakterwebData.grades) {
    if (karakterwebData !== null) {
      console.warn("karakterwebData is invalid, using empty structure");
    }
    karakterwebData = { evaluations: [], grades: { data: [] } };
  }

  // Handle case where only emnrData is null - create minimal valid object
  if (!emnrData) {
    console.warn("emnrData is null, using defaults");
    emnrData = {
      course_code: null,
      review_count: 0,
      average_grade: -1,
      average_grade_letter: null,
      pass_rate: 0,
      average_difficulty: 0,
      average_workload: 0,
    };
  }

  let karakterWebWorkloadReviewCount = 0;
  let karakterWebDifficultyReviewCount = 0;
  let karakterWebReviewCount = 0;
  let karakterWebAverageDifficulty = 0;
  let karakterWebAverageWorkload = 0;

  emnrData.review_count = emnrData.review_count ?? 0;

  // Process evaluations data (difficulty/workload questions)
  const evaluations = karakterwebData.evaluations || [];
  evaluations.forEach((question) => {
    // Find the highest review count and use it
    karakterWebReviewCount = Math.max(
      karakterWebReviewCount,
      question.answersTotal
    );
    if (question.answersTotal === 0) return;

    // Difficulty question has id 1
    if (question.questionId === 1) {
      let weigthedSum = 0;
      karakterWebDifficultyReviewCount = question.answersTotal;
      question.answers.forEach((answer) => {
        const value = answer.answerId / 2; // Divide by 2 to rescale from 0-4 to 0-2
        weigthedSum += value * answer.count;
      });
      karakterWebAverageDifficulty =
        weigthedSum / karakterWebDifficultyReviewCount;
    }

    // Workload question has id 2
    else if (question.questionId === 2) {
      let weigthedSum = 0;
      karakterWebWorkloadReviewCount = question.answersTotal;
      question.answers.forEach((answer) => {
        const value = answer.answerId / 2; // Divide by 2 to rescale from 0-4 to 0-2
        weigthedSum += value * answer.count;
      });
      karakterWebAverageWorkload = weigthedSum / karakterWebWorkloadReviewCount;
    }
  });

  const averageWorkload =
    (karakterWebAverageWorkload * karakterWebWorkloadReviewCount +
      emnrData.average_workload * emnrData.review_count) /
    (emnrData.review_count + karakterWebWorkloadReviewCount);
  const averageDifficulty =
    (karakterWebAverageDifficulty * karakterWebDifficultyReviewCount +
      emnrData.average_difficulty * emnrData.review_count) /
    (emnrData.review_count + karakterWebDifficultyReviewCount);

  const totalReviewCount = karakterWebReviewCount + emnrData.review_count;

  // Calculate grade statistics from karakterweb (primary) with emnr as fallback
  const gradesData = karakterwebData.grades?.data || [];
  const courseCode = emnrData.course_code || 'unknown';
  
  const stats_1year = calculateKarakterwebStats(gradesData, 1, courseCode);
  const stats_3years = calculateKarakterwebStats(gradesData, 3, courseCode);
  const stats_5years = calculateKarakterwebStats(gradesData, 5, courseCode);
  const stats_alltime = calculateKarakterwebStats(gradesData, null, courseCode);

  // Debug logging
  if (gradesData.length > 0) {
    console.log(`[${courseCode}] mergeData Scale: ${gradesData[0].Karakterskala}, is_graded: ${stats_alltime.is_graded}, avg_grade: ${stats_alltime.average_grade}, letter: ${stats_alltime.average_grade_letter}`);
  }

  // Use karakterweb data if available, otherwise fall back to emnr
  let primaryStats;
  let dataSource = "none";
  let timePeriodLabel = null;

  if (stats_alltime.total_candidates > 0) {
    // Choose best stats for display: 3 years with same scale, or most recent
    const result = chooseBestStatsForDisplay(stats_3years, gradesData, courseCode);
    primaryStats = result.stats;
    timePeriodLabel = result.timePeriodLabel;
    dataSource = "karakterweb";
  } else if (emnrData.average_grade > 0 || emnrData.pass_rate > 0) {
    // Fallback to emnr
    const is_graded =
      emnrData.average_grade_letter != null || emnrData.pass_rate <= 0;

    if (!is_graded) {
      emnrData.average_grade = emnrData.pass_rate / 20;
    } else if (emnrData.pass_rate <= 0) {
      if (emnrData.average_grade_letter == "F") {
        emnrData.average_grade_letter = null;
      }
      if (emnrData.average_grade == 0) {
        emnrData.average_grade = -1;
      }
    }

    primaryStats = {
      average_grade: emnrData.average_grade,
      average_grade_letter: emnrData.average_grade_letter,
      pass_rate: emnrData.pass_rate,
      total_candidates: 0,
      is_graded: is_graded,
    };
    dataSource = "emnr";
  } else {
    // No grade data available
    primaryStats = {
      average_grade: -1,
      average_grade_letter: null,
      pass_rate: -1,
      total_candidates: 0,
      is_graded: null,
    };
  }

  return {
    course_code: emnrData.course_code,
    pass_rate: primaryStats.pass_rate,
    is_graded: primaryStats.is_graded,
    average_grade: primaryStats.average_grade,
    average_grade_letter: primaryStats.average_grade_letter,
    average_workload: averageWorkload,
    average_difficulty: averageDifficulty,
    review_count: totalReviewCount,
    emnr_review_count: emnrData.review_count,
    karakterweb_review_count: karakterWebReviewCount,
    // Time-based statistics from karakterweb
    stats_1year,
    stats_3years,
    stats_5years,
    stats_alltime,
    grade_data_source: dataSource, // Track which source was used for grades
    time_period_label: timePeriodLabel, // Track which time period was used ('siste 3 år' or 'siste eksamen')
  };
}
