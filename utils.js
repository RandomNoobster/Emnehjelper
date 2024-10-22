function mergeData(emnrData, karakterwebData) {
  let karakterWebWorkloadReviewCount = 0;
  let karakterWebDifficultyReviewCount = 0;
  let karakterWebReviewCount = 0;
  let karakterWebAverageDifficulty = 0;
  let karakterWebAverageWorkload = 0;

  emnrData.review_count = emnrData.review_count ?? 0;

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

  karakterwebData.forEach((question) => {
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

  return {
    course_code: emnrData.course_code,
    pass_rate: emnrData.pass_rate,
    is_graded: is_graded,
    average_grade: emnrData.average_grade,
    average_grade_letter: emnrData.average_grade_letter,
    average_workload: averageWorkload,
    average_difficulty: averageDifficulty,
    review_count: totalReviewCount,
    emnr_review_count: emnrData.review_count,
    karakterweb_review_count: karakterWebReviewCount,
  };
}
