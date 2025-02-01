import {
  addCourseNameHoverEffect,
  createAbbrElement,
  createLoadingAnimation,
  getColorClass,
  getDescription,
} from "./course-list.js";
import { mergeData } from "./utils.js";

// dom-utils.js (only runs in the browser)
if (typeof document !== "undefined") {
  (function () {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (!node.querySelectorAll) return;
          const rows = node.querySelectorAll("tr.course");

          rows.forEach((row) => {
            const emnekode = row.classList[1];
            const cell = row.querySelector("td");
            if (cell.classList.contains("emnehjelper-info")) return;

            const courseNameCell = row.querySelector("td:nth-child(2) > span");
            addCourseNameHoverEffect(courseNameCell);

            const loadingAnimation = createLoadingAnimation();
            cell.appendChild(loadingAnimation);

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
                  average_grade,
                  review_count,
                  is_graded,
                  pass_rate,
                } = mergedData;

                if (loadingAnimation) loadingAnimation.remove();

                const reviewAbbr = createAbbrElement(
                  `${review_count}`,
                  "gray",
                  `Antall anmeldelser`
                );
                cell.appendChild(reviewAbbr);

                const difficultyAbbr = createAbbrElement(
                  getDescription(average_difficulty, "difficulty"),
                  getColorClass(average_difficulty, "difficulty"),
                  "Tooltip for difficulty"
                );
                cell.appendChild(difficultyAbbr);

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
}
