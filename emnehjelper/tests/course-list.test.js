const { getDescription, getColorClass } = require("../course-list");

describe("getDescription", () => {
  test("should return correct description for difficulty", () => {
    expect(getDescription(0.3, "difficulty")).toBe("Svært Lett");
    expect(getDescription(1, "difficulty")).toBe("Lett");
    expect(getDescription(1.2, "difficulty")).toBe("Vanskelig");
    expect(getDescription(1.8, "difficulty")).toBe("Svært Vanskelig");
    expect(getDescription(2.1, "difficulty")).toBe("Ukjent");
  });

  test("should return correct description for workload", () => {
    expect(getDescription(0.3, "workload")).toBe("Ikke Arbeidsomt");
    expect(getDescription(1, "workload")).toBe("Lite Arbeidsomt");
    expect(getDescription(1.2, "workload")).toBe("Arbeidsomt");
    expect(getDescription(1.8, "workload")).toBe("Svært Arbeidsomt");
    expect(getDescription(2.1, "workload")).toBe("Ukjent");
  });

  test("should return correct description for grade", () => {
    expect(getDescription(0.3, "grade")).toBe("F");
    expect(getDescription(1.5, "grade")).toBe("E");
    expect(getDescription(2.5, "grade")).toBe("D");
    expect(getDescription(3.5, "grade")).toBe("C");
    expect(getDescription(4.5, "grade")).toBe("B");
    expect(getDescription(5, "grade")).toBe("A");
    expect(getDescription(5.1, "grade")).toBe("Ukjent");
  });

  test("should return correct description for pass", () => {
    expect(getDescription(49, "pass")).toBe("Ikke Bestått");
    expect(getDescription(51, "pass")).toBe("Bestått");
    expect(getDescription(100, "pass")).toBe("Bestått");
    expect(getDescription(101, "pass")).toBe("Ukjent");
  });

  test("should handle invalid values", () => {
    expect(getDescription(NaN, "difficulty")).toBe("Ukjent");
    expect(getDescription(-1, "workload")).toBe("Ukjent");
  });
});

describe("getColorClass", () => {
  test("should return correct color class for difficulty", () => {
    expect(getColorClass(0.3, "difficulty")).toBe("green");
    expect(getColorClass(1, "difficulty")).toBe("lime");
    expect(getColorClass(1.2, "difficulty")).toBe("orange");
    expect(getColorClass(1.6, "difficulty")).toBe("red");
    expect(getColorClass(2.1, "difficulty")).toBe("gray");
  });

  test("should return correct color class for workload", () => {
    expect(getColorClass(0.3, "workload")).toBe("green");
    expect(getColorClass(1, "workload")).toBe("lime");
    expect(getColorClass(1.2, "workload")).toBe("orange");
    expect(getColorClass(1.8, "workload")).toBe("red");
    expect(getColorClass(2.1, "workload")).toBe("gray");
  });

  test("should return correct color class for grade", () => {
    expect(getColorClass(0.3, "grade")).toBe("red");
    expect(getColorClass(1.5, "grade")).toBe("red");
    expect(getColorClass(2.5, "grade")).toBe("orange");
    expect(getColorClass(3.5, "grade")).toBe("yellow");
    expect(getColorClass(4.5, "grade")).toBe("lime");
    expect(getColorClass(5, "grade")).toBe("green");
    expect(getColorClass(5.1, "grade")).toBe("gray");
  });

  test("should return correct color class for pass", () => {
    expect(getColorClass(49, "pass")).toBe("red");
    expect(getColorClass(51, "pass")).toBe("green");
    expect(getColorClass(100, "pass")).toBe("green");
    expect(getColorClass(101, "pass")).toBe("gray");
  });

  test("should handle invalid values", () => {
    expect(getColorClass(NaN, "difficulty")).toBe("gray");
    expect(getColorClass(-1, "workload")).toBe("gray");
  });
});
