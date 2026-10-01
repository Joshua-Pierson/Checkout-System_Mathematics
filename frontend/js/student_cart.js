// Student cart UI.
// Load products from Python through api.js.
// Use item_id as the item code.
// Keep prices in cents when calculating totals.

function initializeStudentCart() {
  const form = document.querySelector("#add-item-form");
  const codeInput = document.querySelector("#item-code");
  const message = document.querySelector("#item-message");
  const addedItems = document.querySelector("#added-items");
  const cartTotal = document.querySelector("#cart-total");
  const productList = document.querySelector("#product-list");
  const catalogMessage = document.querySelector("#catalog-message");

  if (!form || !codeInput || !message || !addedItems || !cartTotal) {
    console.error("Required student cart HTML elements are missing.");
    return;
  }

  const addButton = form.querySelector('button[type="submit"]');

  if (!addButton) {
    message.textContent = "The Add Item button is missing.";
    return;
  }

  let catalog = [];
  const cart = [];
  let catalogReady = false;

  // Convert cents into a dollar amount.
  function money(cents) {
    return `$${(cents / 100).toFixed(2)}`;
  }

  // Convert CSV-derived fields into usable frontend values.
  function prepareProduct(product) {
    if (!product || typeof product !== "object") {
      throw new Error("The server returned an invalid product.");
    }

    const code = String(product.item_id ?? "").trim();
    const name = product.name;
    const rawPrice = product.unit_price;
    const rawStock = product.stock_quantity;

    if (
      !code ||
      typeof name !== "string" ||
      !name.trim() ||
      !["string", "number"].includes(typeof rawPrice) ||
      !["string", "number"].includes(typeof rawStock) ||
      String(rawPrice).trim() === "" ||
      String(rawStock).trim() === ""
    ) {
      throw new Error(`Product ${code || "(unknown)"} has invalid fields.`);
    }

    const price = Number(rawPrice);
    const stock = Number(rawStock);
    const priceCents = Math.round(price * 100);

    if (
      !Number.isFinite(price) ||
      price < 0 ||
      !Number.isSafeInteger(priceCents) ||
      !Number.isSafeInteger(stock) ||
      stock < 0
    ) {
      throw new Error(`Product ${code} has an invalid price or stock.`);
    }

    return {
      code,
      name: name.trim(),
      priceCents,
      category: String(product.category ?? "").trim(),
      stock
    };
  }

  // Show item codes, names, and costs in the product table.
  function renderCatalog() {
    if (!productList) return;

    productList.replaceChildren();

    for (const product of catalog) {
      const row = document.createElement("tr");

      for (const value of [
        product.code,
        product.name,
        money(product.priceCents)
      ]) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      }

      productList.append(row);
    }
  }

  // Create a cart control button.
  function createButton(text, label, disabled, action) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.disabled = disabled;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", action);
    return button;
  }

  // Display cart items, quantity controls, and the total.
  function renderCart() {
    addedItems.replaceChildren();
    let totalCents = 0;

    if (cart.length === 0) {
      const emptyMessage = document.createElement("p");
      emptyMessage.textContent = "Your cart is empty.";
      addedItems.append(emptyMessage);
    }

    for (const item of cart) {
      const lineTotal = item.priceCents * item.quantity;
      totalCents += lineTotal;

      const row = document.createElement("div");
      const details = document.createElement("span");

      details.textContent =
        `${item.name} | Code: ${item.code} | ` +
        `${money(item.priceCents)} each | ` +
        `Quantity: ${item.quantity} | ` +
        `Line total: ${money(lineTotal)} `;

      const decreaseButton = createButton(
        "−",
        `Decrease ${item.name} quantity`,
        item.quantity <= 1,
        () => {
          if (item.quantity <= 1) return;

          item.quantity--;
          renderCart();
          message.textContent = `${item.name} quantity updated.`;
        }
      );

      const increaseButton = createButton(
        "+",
        `Increase ${item.name} quantity`,
        item.quantity >= item.stock,
        () => {
          if (item.quantity >= item.stock) {
            message.textContent =
              `Only ${item.stock} of ${item.name} are available.`;
            return;
          }

          item.quantity++;
          renderCart();
          message.textContent = `${item.name} quantity updated.`;
        }
      );

      const removeButton = createButton(
        "Remove",
        `Remove ${item.name} from cart`,
        false,
        () => {
          const index = cart.findIndex(
            (entry) => entry.code === item.code
          );

          if (index === -1) return;

          cart.splice(index, 1);
          renderCart();
          message.textContent = `${item.name} removed from the cart.`;
        }
      );

      row.append(details, decreaseButton, increaseButton, removeButton);
      addedItems.append(row);
    }

    cartTotal.textContent = `Cart total: ${money(totalCents)}`;
  }

  // Add an item using its item ID, such as 1001.
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (!catalogReady) {
      message.textContent = "Products have not loaded yet.";
      return;
    }

    const code = codeInput.value.trim();
    const product = catalog.find((item) => item.code === code);

    if (!product) {
      message.textContent = `No product found for code "${code}".`;
      return;
    }

    const existingItem = cart.find((item) => item.code === code);
    const currentQuantity = existingItem ? existingItem.quantity : 0;

    if (currentQuantity >= product.stock) {
      message.textContent =
        product.stock === 0
          ? `${product.name} is out of stock.`
          : `Only ${product.stock} of ${product.name} are available.`;
      return;
    }

    if (existingItem) {
      existingItem.quantity++;
    } else {
      cart.push({ ...product, quantity: 1 });
    }

    renderCart();
    message.textContent = `${product.name} added to the cart.`;

    codeInput.value = "";
    codeInput.focus();
  });

  // Request the products from your existing api.js.
  async function loadInventory() {
    addButton.disabled = true;
    message.textContent = "Loading products...";

    try {
      if (typeof fetchInventory !== "function") {
        throw new Error("Load api.js before student_cart.js.");
      }

      const products = await fetchInventory();

      // Your api.js returns undefined when its request fails.
      if (products === undefined) {
        throw new Error(
          "Could not load products. Check that server.py is running."
        );
      }

      if (!Array.isArray(products)) {
        throw new Error("/api/items must return a JSON array.");
      }

      catalog = products.map(prepareProduct);

      const itemCodes = new Set(catalog.map((item) => item.code));

      if (itemCodes.size !== catalog.length) {
        throw new Error("The inventory contains duplicate item IDs.");
      }

      catalogReady = true;
      addButton.disabled = catalog.length === 0;
      renderCatalog();

      message.textContent = catalog.length
        ? "Products loaded. Enter an item code, such as 1001."
        : "No products are available.";

      if (catalogMessage) {
        catalogMessage.textContent = catalog.length
          ? ""
          : "No products are available.";
      }
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Could not load inventory.";

      message.textContent = errorMessage;

      if (catalogMessage) {
        catalogMessage.textContent = errorMessage;
      }

      console.error("Student cart error:", error);
    }
  }

  renderCart();
  loadInventory();
}

// Wait until the page elements exist.
if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    initializeStudentCart,
    { once: true }
  );
} else {
  initializeStudentCart();
}