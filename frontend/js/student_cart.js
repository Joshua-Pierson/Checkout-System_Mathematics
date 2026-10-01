// Student cart UI: enter item codes, change quantities, remove items,
// and display the cart and running total.

const form = document.querySelector("#add-item-form");
const codeInput = document.querySelector("#item-code");
const message = document.querySelector("#item-message");
const addedItems = document.querySelector("#added-items");
const cartTotal = document.querySelector("#cart-total");

let cart = [];
let busy = false;

// Send a request and read the updated cart from Python.
async function requestCart(path = "", method = "GET", data = undefined) {
  const options = {
    method,
    credentials: "same-origin"
  };

  if (data !== undefined) {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(data);
  }

  const response = await fetch(`/api/cart${path}`, options);
  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || "Could not update the cart.");
  }

  cart = result.items;
  renderAddedItems(result.total);

  return result;
}

// Prevent overlapping changes while a request is running.
async function updateCart(path, method, data, successMessage) {
  if (busy) return false;

  busy = true;
  renderAddedItems(cartTotal.dataset.total || "0.00");

  try {
    const result = await requestCart(path, method, data);
    message.textContent = [successMessage, ...result.warnings]
      .filter(Boolean)
      .join(" ");
    return true;
  } catch (error) {
    message.textContent = error.message;
    return false;
  } finally {
    busy = false;
    renderAddedItems(cartTotal.dataset.total || "0.00");
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const code = codeInput.value.trim().toUpperCase();

  if (!code) {
    message.textContent = "Enter an item code.";
    return;
  }

  const added = await updateCart(
    `/items/${encodeURIComponent(code)}`,
    "POST",
    undefined,
    `${code} added to the cart.`
  );

  if (added) {
    codeInput.value = "";
    codeInput.focus();
  }
});

function renderAddedItems(total) {
  addedItems.replaceChildren();

  cartTotal.dataset.total = total;
  cartTotal.textContent = `Cart total: $${total}`;

  if (cart.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.textContent = "Your cart is empty.";
    addedItems.append(emptyMessage);
    return;
  }

  for (const item of cart) {
    const row = document.createElement("div");
    const details = document.createElement("span");
    const decreaseButton = document.createElement("button");
    const increaseButton = document.createElement("button");
    const removeButton = document.createElement("button");

    const path = `/items/${encodeURIComponent(item.code)}`;

    details.textContent =
      `${item.name} | $${item.price} each | ` +
      `Quantity: ${item.quantity} | Line total: $${item.line_total} ` +
      (item.available ? "" : "| Unavailable ");

    decreaseButton.type = "button";
    decreaseButton.textContent = "−";
    decreaseButton.disabled = busy || item.quantity === 1;
    decreaseButton.setAttribute(
      "aria-label", `Decrease ${item.name} quantity`
    );
    decreaseButton.addEventListener("click", () => {
      updateCart(
        path,
        "PATCH",
        { quantity: item.quantity - 1 },
        "Quantity updated."
      );
    });

    increaseButton.type = "button";
    increaseButton.textContent = "+";
    increaseButton.disabled = busy || !item.available;
    increaseButton.setAttribute(
      "aria-label", `Increase ${item.name} quantity`
    );
    increaseButton.addEventListener("click", () => {
      updateCart(
        path,
        "PATCH",
        { quantity: item.quantity + 1 },
        "Quantity updated."
      );
    });

    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.disabled = busy;
    removeButton.setAttribute(
      "aria-label", `Remove ${item.name} from cart`
    );
    removeButton.addEventListener("click", () => {
      updateCart(
        path,
        "DELETE",
        undefined,
        `${item.name} removed from the cart.`
      );
    });

    row.append(details, decreaseButton, increaseButton, removeButton);
    addedItems.append(row);
  }
}

// Restore the browser's cart when the page loads.
updateCart("", "GET", undefined, "");


// Load and display products from MySQL through Python.
async function loadProductCatalog() {
  const productList = document.querySelector("#product-list");
  const catalogMessage = document.querySelector("#catalog-message");

  catalogMessage.textContent = "Loading products...";
  productList.replaceChildren();

  try {
    const response = await fetch("/api/cart/catalog");

    if (!(response.headers.get("content-type") || "")
      .includes("application/json")) {
      throw new Error("Open this page through the Python server.");
    }

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Could not load products.");
    }

    for (const product of result.products) {
      const row = document.createElement("tr");
      const codeCell = document.createElement("td");
      const nameCell = document.createElement("td");
      const costCell = document.createElement("td");

      codeCell.textContent = product.code;
      nameCell.textContent = product.name;
      costCell.textContent = `$${product.price}`;

      row.append(codeCell, nameCell, costCell);
      productList.append(row);
    }

    catalogMessage.textContent =
      result.products.length === 0 ? "No products available." : "";
  } catch (error) {
    catalogMessage.textContent = error.message;
  }
}

loadProductCatalog();