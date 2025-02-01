const { mergeData } = require("../utils");
const { emnrData, karakterwebData } = require("./mockData");

describe("mergeData function", () => {
  test("should correctly merge data from emnr and karakterweb", () => {
    const result = mergeData(emnrData, karakterwebData);
    expect(result).toEqual({
      course_code: "EXPH0300",
      pass_rate: 98.02414928649836,
      is_graded: true,
      average_grade: 3.14873765093304,
      average_grade_letter: "C",
      average_workload: 0.6981981981981982,
      average_difficulty: 0.8947368421052632,
      review_count: 126,
      emnr_review_count: 57,
      karakterweb_review_count: 69,
    });
  });

  test("should handle empty karakterwebData", () => {
    const result = mergeData(emnrData, []);
    expect(result).toEqual({
      course_code: emnrData.course_code,
      pass_rate: emnrData.pass_rate,
      is_graded: true,
      average_grade: emnrData.average_grade,
      average_grade_letter: emnrData.average_grade_letter,
      average_workload: emnrData.average_workload,
      average_difficulty: emnrData.average_difficulty,
      review_count: emnrData.review_count,
      emnr_review_count: emnrData.review_count,
      karakterweb_review_count: 0,
    });
  });

  test("should handle empty emnrData", () => {
    const emptyEmnrData = {
      course_code: "EXPH0300",
      pass_rate: 0,
      average_grade: 0,
      average_grade_letter: null,
      average_workload: 0,
      average_difficulty: 0,
      review_count: 0,
    };
    const result = mergeData(emptyEmnrData, karakterwebData);
    expect(result).toEqual({
      course_code: "EXPH0300",
      pass_rate: 0,
      is_graded: true,
      average_grade: -1,
      average_grade_letter: null,
      average_workload: 0.8796296296296297,
      average_difficulty: 1.2456140350877194,
      review_count: 69,
      emnr_review_count: 0,
      karakterweb_review_count: 69,
    });
  });

  test("should handle null karakterwebData", () => {
    const result = mergeData(emnrData, null);
    expect(result).toEqual({
      course_code: emnrData.course_code,
      pass_rate: emnrData.pass_rate,
      is_graded: true,
      average_grade: emnrData.average_grade,
      average_grade_letter: emnrData.average_grade_letter,
      average_workload: emnrData.average_workload,
      average_difficulty: emnrData.average_difficulty,
      review_count: emnrData.review_count,
      emnr_review_count: emnrData.review_count,
      karakterweb_review_count: 0,
    });
  });
});
