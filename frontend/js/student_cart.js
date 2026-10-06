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
  const categoryFilter = document.querySelector("#category-filter");
  const searchInput = document.querySelector("#product-search");
  const cancelButton = document.querySelector("#cancel-transaction");

  const requiredElements = [
    form,
    codeInput,
    message,
    addedItems,
    cartTotal,
    productList,
    catalogMessage,
    categoryFilter,
    searchInput,
    cancelButton
  ];

  if (!requiredElements.every(Boolean)) {
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
      category: String(product.category ?? "").trim() || "Uncategorized",
      stock
    };
  }

  // Create a button with an accessible label.
  function createButton(text, label, disabled, action) {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = text;
    button.disabled = disabled;
    button.setAttribute("aria-label", label);
    button.addEventListener("click", action);

    return button;
  }

  // Task 1939: Build the category dropdown from inventory.
  function renderCategories() {
    categoryFilter.replaceChildren();

    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = "All categories";
    categoryFilter.append(allOption);

    const categories = [
      ...new Set(catalog.map((item) => item.category))
    ].sort((a, b) => a.localeCompare(b));

    for (const category of categories) {
      const option = document.createElement("option");

      option.value = category;
      option.textContent = category;

      categoryFilter.append(option);
    }
  }

  // Tasks 1939 and 1940:
  // Filter by category and part of the item name.
  function renderCatalog() {
    productList.replaceChildren();

    const query = searchInput.value.trim().toLowerCase();
    const category = categoryFilter.value;

    const matches = catalog.filter((item) => {
      const matchesCategory =
        !category || item.category === category;

      const matchesName =
        item.name.toLowerCase().includes(query);

      return matchesCategory && matchesName;
    });

    if (matches.length > 0) {
      catalogMessage.textContent =
        `${matches.length} product${matches.length === 1 ? "" : "s"} found.`;
    } else if (catalog.length === 0) {
      catalogMessage.textContent = "No products are available.";
    } else {
      catalogMessage.textContent =
        "No items match your search or selected category.";
    }

    for (const product of matches) {
      const row = document.createElement("tr");

      for (const value of [
        product.code,
        product.name,
        money(product.priceCents),
        product.category
      ]) {
        const cell = document.createElement("td");
        cell.textContent = value;
        row.append(cell);
      }

      const cartItem = cart.find(
        (item) => item.code === product.code
      );

      const currentQuantity = cartItem ? cartItem.quantity : 0;
      const actionCell = document.createElement("td");

      const productAddButton = createButton(
        product.stock === 0 ? "Out of stock" : "Add",
        `Add ${product.name} to cart`,
        currentQuantity >= product.stock,
        () => addItem(product.code)
      );

      actionCell.append(productAddButton);
      row.append(actionCell);
      productList.append(row);
    }
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
          refresh();

          message.textContent = `${item.name} quantity updated.`;
        }
      );

      const increaseButton = createButton(
        "+",
        `Increase ${item.name} quantity`,
        item.quantity >= item.stock,
        () => addItem(item.code)
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
          refresh();

          message.textContent = `${item.name} removed from the cart.`;
        }
      );

      row.append(
        details,
        decreaseButton,
        increaseButton,
        removeButton
      );

      addedItems.append(row);
    }

    cartTotal.textContent = `Cart total: ${money(totalCents)}`;
    cancelButton.disabled = cart.length === 0;
  }

  // Update both displays after changing the cart.
  function refresh() {
    renderCart();
    renderCatalog();
  }

  // Code entry and product buttons use the same stock checks.
  function addItem(code) {
    if (!catalogReady) {
      message.textContent = "Products have not loaded yet.";
      return false;
    }

    const product = catalog.find((item) => item.code === code);

    if (!product) {
      message.textContent = `No product found for code "${code}".`;
      return false;
    }

    const existingItem = cart.find((item) => item.code === code);
    const currentQuantity = existingItem ? existingItem.quantity : 0;

    if (currentQuantity >= product.stock) {
      message.textContent =
        product.stock === 0
          ? `${product.name} is out of stock.`
          : `Only ${product.stock} of ${product.name} are available.`;

      return false;
    }

    if (existingItem) {
      existingItem.quantity++;
    } else {
      cart.push({ ...product, quantity: 1 });
    }

    refresh();
    message.textContent = `${product.name} added to the cart.`;

    return true;
  }

  // Add an item using its item ID, such as 1001.
  form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (addItem(codeInput.value.trim())) {
      codeInput.value = "";
      codeInput.focus();
    }
  });

  // Update the product table when the category changes.
  categoryFilter.addEventListener("change", renderCatalog);

  // Update matching products immediately as the student types.
  searchInput.addEventListener("input", renderCatalog);

  // Task 1935: Cancel the whole transaction.
  cancelButton.addEventListener("click", () => {
    // Clear only the frontend cart.
    // No inventory update or checkout request is sent.
    cart.length = 0;

    form.reset();
    categoryFilter.value = "";
    searchInput.value = "";

    refresh();

    message.textContent =
      "Transaction canceled. Ready for the next customer.";

    codeInput.focus();
  });

  // Request products from your existing api.js.
  async function loadInventory() {
    addButton.disabled = true;
    message.textContent = "Loading products...";
    catalogMessage.textContent = "Loading products...";

    try {
      if (typeof fetchInventory !== "function") {
        throw new Error("Load api.js before student_cart.js.");
      }

      const products = await fetchInventory();

      if (products === undefined) {
        throw new Error(
          "Could not load products. Check that server.py is running."
        );
      }

      if (!Array.isArray(products)) {
        throw new Error("/api/items must return a JSON array.");
      }

      catalog = products.map(prepareProduct);

      const itemCodes = new Set(
        catalog.map((item) => item.code)
      );

      if (itemCodes.size !== catalog.length) {
        throw new Error("The inventory contains duplicate item IDs.");
      }

      catalogReady = true;

      const inventoryEmpty = catalog.length === 0;

      addButton.disabled = inventoryEmpty;
      categoryFilter.disabled = inventoryEmpty;
      searchInput.disabled = inventoryEmpty;

      renderCategories();
      refresh();

      message.textContent = inventoryEmpty
        ? "No products are available."
        : "Products loaded. Enter a code or browse and add an item.";
    } catch (error) {
      const errorMessage = error instanceof Error
        ? error.message
        : "Could not load inventory.";

      message.textContent = errorMessage;
      catalogMessage.textContent = errorMessage;

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