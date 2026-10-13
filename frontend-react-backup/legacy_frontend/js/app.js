// Main front-end file: start the app and handle navigation between screens.
// Switch between the student and manager sections.
const studentSection = document.querySelector("#student-section");
const managerSection = document.querySelector("#manager-section");

const studentButton = document.querySelector("#student-view-button");
const managerButton = document.querySelector("#manager-view-button");

// Show the student cart.
studentButton.addEventListener("click", () => {
  studentSection.hidden = false;
  managerSection.hidden = true;

  studentButton.setAttribute("aria-pressed", "true");
  managerButton.setAttribute("aria-pressed", "false");

  document.querySelector("#item-code").focus();
});

// Show the manager section.
managerButton.addEventListener("click", () => {
  studentSection.hidden = true;
  managerSection.hidden = false;

  studentButton.setAttribute("aria-pressed", "false");
  managerButton.setAttribute("aria-pressed", "true");
});

// Start on the student view.
studentSection.hidden = false;
managerSection.hidden = true;

studentButton.setAttribute("aria-pressed", "true");
managerButton.setAttribute("aria-pressed", "false");