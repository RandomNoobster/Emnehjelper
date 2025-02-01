const emnrData = {
  course_code: "EXPH0300",
  institution: 194,
  version: 1,
  course_name_norwegian: "Examen philosophicum for naturvitenskap og teknologi",
  course_name_english: "Examen philosophicum for Science and Technology",
  study_level: 70,
  semester: "HØST",
  course_type: "",
  is_thesis: false,
  credit: 7.5,
  language: "NORSK",
  campus: [],
  connected_studyprograms: [],
  average_grade: 3.14873765093304,
  pass_rate: 98.02414928649836,
  review_count: 57,
  average_review_score: 2.9473684210526314,
  average_difficulty: 0.543859649122807,
  average_workload: 0.5263157894736842,
  advanced_sorting_score: -1,
  average_grade_letter: "C",
};

const karakterwebData = [
  {
    questionId: 0,
    question: "Hva er ditt generelle inntrykk av kurset?",
    answers: [
      {
        answerId: 0,
        answer: "Svært dårlig",
        count: 37,
        active: false,
      },
      {
        answerId: 1,
        answer: "Dårlig",
        count: 6,
        active: false,
      },
      {
        answerId: 2,
        answer: "Nøytral",
        count: 9,
        active: false,
      },
      {
        answerId: 3,
        answer: "Bra",
        count: 8,
        active: false,
      },
      {
        answerId: 4,
        answer: "Svært bra",
        count: 9,
        active: false,
      },
    ],
    answersTotal: 69,
  },
  {
    questionId: 1,
    question: "Hva synes du om emnets nivå?",
    answers: [
      {
        answerId: 0,
        answer: "Svært lett",
        count: 4,
        active: false,
      },
      {
        answerId: 1,
        answer: "Lett",
        count: 4,
        active: false,
      },
      {
        answerId: 2,
        answer: "Passende",
        count: 23,
        active: false,
      },
      {
        answerId: 3,
        answer: "Vanskelig",
        count: 12,
        active: false,
      },
      {
        answerId: 4,
        answer: "Svært vanskelig",
        count: 14,
        active: false,
      },
    ],
    answersTotal: 57,
  },
  {
    questionId: 2,
    question:
      "Hva synes du om arbeidsmengden sett i forhold til antall studiepoeng?",
    answers: [
      {
        answerId: 0,
        answer: "Svært liten",
        count: 12,
        active: false,
      },
      {
        answerId: 1,
        answer: "Liten",
        count: 10,
        active: false,
      },
      {
        answerId: 2,
        answer: "Passe",
        count: 17,
        active: false,
      },
      {
        answerId: 3,
        answer: "Stor",
        count: 9,
        active: false,
      },
      {
        answerId: 4,
        answer: "Svært stor",
        count: 6,
        active: false,
      },
    ],
    answersTotal: 54,
  },
];

module.exports = {
  emnrData,
  karakterwebData,
};
