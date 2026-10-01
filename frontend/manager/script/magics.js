
function warnMessage() {
  return "Unsubmitted changes will be lost.";
}

// Checks for a form with the proper ID then executes following code
if (document.querySelector("#addForm")) {
const form = document.getElementById("addForm").addEventListener("submit", addFunction);
} else if (document.querySelector("#editForm")) {
const form = document.getElementById("editForm").addEventListener("submit", editFunction);
} else if (document.querySelector("#removeForm")) {
const form = document.getElementById("removeForm").addEventListener("submit", removeFunction);
}

/* This function is only meant to be used in conjunction with the "addForm" form within "add.html".
  It takes the data inputted within the form, turns it into an object, 
  then converts the object to a JSON value. 
*/
function addFunction(event) {
    const newItemData = new FormData(event.target);
    const itemAddObj = Object.fromEntries(newItemData.entries());
    const addItemJSON = JSON.stringify(itemAddObj);
    // The following line is meant to check the output.
    console.log(addItemJSON);
}

/* This function is only meant to be used in conjunction with the "editForm" form within "edit.html".
  This is similar to "addFunction", with the added capability of sending out a request to the server.
  (To be implemented) 
*/
function editFunction(event) {
    const editItemData = new FormData(event.target);
    const itemEditObj = Object.fromEntries(editItemData.entries());
    const editItemJSON = JSON.stringify(itemEditObj);
    // The following line is meant to check the output.
    console.log(editItemJSON);
    console.log("This is meant to send out an PUT/PATCH request.");
}

/* This function is only meant to be used in conjunction with the "removeForm" form within "remove.html".
  This removes the data associated with the item's ID in the catalog.
  (To be implemented)
*/
function removeFunction(event) {
    const removeItemData = new FormData(event.target);
    const itemRemoveObj = Object.fromEntries(removeItemData.entries());
    const removeItemJSON = JSON.stringify(itemRemoveObj);
    // The following line is meant to check the output.
    console.log(removeItemJSON);
    console.log("This is meant to send out a DELETE request.");
}

// Make function which sends a POST to Python backend

