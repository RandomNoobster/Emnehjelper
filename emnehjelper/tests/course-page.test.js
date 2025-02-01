const {
  extractEmnekodeFromURL,
  fetchCourseData,
  getGradeScaleLabels,
  PASS_FAIL_LABELS,
  GRADE_LABELS,
} = require("../course-page");

describe("extractEmnekodeFromURL", () => {
  test("should extract emnekode from valid URL", () => {
    const url = "https://example.com/ABC1234";
    const emnekode = extractEmnekodeFromURL(url);
    expect(emnekode).toBe("ABC1234");
  });

  test("should return null for invalid URL", () => {
    const url = "https://example.com/";
    const emnekode = extractEmnekodeFromURL(url);
    expect(emnekode).toBeNull();
  });
});

describe("fetchCourseData", () => {
  beforeAll(() => {
    global.chrome = {
      runtime: {
        sendMessage: jest.fn().mockImplementation((message) => {
          if (message.contentScriptQuery === "get-karakter-data") {
            return Promise.resolve({
              emnrData: { some: "data" },
              karakterwebData: { other: "data" },
            });
          }
          return Promise.reject(new Error("Unknown query"));
        }),
      },
    };
  });

  test("should fetch course data successfully", async () => {
    const emnekode = "ABC1234";
    const data = await fetchCourseData(emnekode);
    expect(data).toEqual({
      emnrData: { some: "data" },
      karakterwebData: { other: "data" },
    });
  });

  test("should handle error while fetching course data", async () => {
    global.chrome.runtime.sendMessage.mockImplementationOnce(() =>
      Promise.reject(new Error("Network error"))
    );
    const emnekode = "ABC1234";
    const data = await fetchCourseData(emnekode);
    expect(data).toBeUndefined();
  });
});

describe("getGradeScaleLabels", () => {
  test("should return GRADE_LABELS when data is graded", () => {
    const data = { is_graded: true };
    const labels = getGradeScaleLabels(data);
    expect(labels).toBe(GRADE_LABELS);
  });

  test("should return PASS_FAIL_LABELS when data is not graded", () => {
    const data = { is_graded: false };
    const labels = getGradeScaleLabels(data);
    expect(labels).toBe(PASS_FAIL_LABELS);
  });
});
