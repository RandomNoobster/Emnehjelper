(async function () {
  // Hent emnekode fra URL med regex
  const url = window.location.href;
  const regex = /.*\/([A-Za-z]{2,5}\d{3,4})/;
  const match = url.match(regex);

  // If a match is found, extract the emnekode
  if (match && match[1]) {
    const emnekode = match[1];

    // Hent data fra API
    console.debug(emnekode);
    const emnrResponse = await fetch(`https://api.emnr.no/course/${emnekode}/`);
    const emnrData = await emnrResponse.json();
    console.debug(emnrData);

    // Call the function to create and display the popup
    makePopUp(emnrData);
  } else {
    console.error("Emnekode not found in the URL.");
  }
})();

function makePopUp(data) {
  // Create a div element for the popup
  const popup = document.createElement("div");
  popup.className = "popup";

  // Create a text element with the message
  const message = document.createElement("p");

  // Create links
  const emnrLink = document.createElement("a");
  emnrLink.href = `https://emnr.no/course/${data.course_code}`;
  emnrLink.textContent = `Emnr: ${data.course_code}`;
  popup.appendChild(emnrLink);

  const karakterLink = document.createElement("a");
  karakterLink.href = `https://www.karakterweb.no/ntnu/${data.course_code}`;
  karakterLink.textContent = `Karakterweb: ${data.course_code}`;
  popup.appendChild(karakterLink);

  const karakternetLink = document.createElement("a");
  karakternetLink.href = `https://karakterer.net/course/${data.course_code}`;
  karakternetLink.textContent = `Karakterer.net: ${data.course_code}`;
  popup.appendChild(karakternetLink);

  message.textContent += `
    Statistikk fra emnr.no:
    Beståttprosent: ${data.pass_rate.toFixed(2)}%
    Karakter/arbeid: ${
      data.review_count === 0
        ? "-.--"
        : (data.average_grade / data.average_workload).toFixed(2)
    }
    Antall reviews: ${data.review_count}
    `;

  // Append the elements to the popup
  popup.appendChild(message);

  // Create a slider for Arbeidsmengde
  const workloadSlider = document.createElement("input");
  workloadSlider.type = "range";
  workloadSlider.min = "0";
  workloadSlider.max = "2";
  workloadSlider.step = "0.01";
  workloadSlider.value = data.average_workload.toFixed(2);
  workloadSlider.disabled = true;

  // Create a label for the workload slider
  const workloadLabel = document.createElement("p");
  workloadLabel.textContent = `Arbeidsmengde: ${
    data.review_count === 0 ? "-.--" : data.average_workload.toFixed(2)
  }`;

  // Append the workload slider and label to the message
  message.appendChild(workloadLabel);
  message.appendChild(workloadSlider);

  // Create a slider for Gjennomsnittskarakter
  const gradeSlider = document.createElement("input");
  gradeSlider.type = "range";
  gradeSlider.min = "0";
  gradeSlider.max = "5";
  gradeSlider.step = "0.01";
  gradeSlider.value = data.average_grade.toFixed(2);
  gradeSlider.disabled = true;

  // Create a label for the grade slider
  const gradeLabel = document.createElement("p");
  gradeLabel.textContent = `Gjennomsnittskarakter: ${
    data.average_grade === 0 ? "-.--" : data.average_grade.toFixed(2)
  } (${data.average_grade_letter ?? "-"})`;

  // Append the grade slider and label to the message
  message.appendChild(gradeLabel);
  message.appendChild(gradeSlider);

  let isDragging = false;
  let initialX, initialY, offsetX, offsetY;

  // Function to handle mouse down event
  function handleMouseDown(event) {
    isDragging = true;
    initialX = event.clientX;
    initialY = event.clientY;
    offsetX = popup.getBoundingClientRect().left;
    offsetY = popup.getBoundingClientRect().top;
  }

  // Function to handle mouse move event
  function handleMouseMove(event) {
    if (isDragging) {
      const dx = event.clientX - initialX;
      const dy = event.clientY - initialY;
      popup.style.left = offsetX + dx + "px";
      popup.style.top = offsetY + dy + "px";
      popup.style.right = null;
    }
  }

  // Function to handle mouse up event
  function handleMouseUp() {
    isDragging = false;
  }

  // Add event listeners for mouse events
  popup.addEventListener("mousedown", handleMouseDown);
  document.addEventListener("mousemove", handleMouseMove);
  document.addEventListener("mouseup", handleMouseUp);

  // Append the popup to the body of the page
  document.body.appendChild(popup);
}
