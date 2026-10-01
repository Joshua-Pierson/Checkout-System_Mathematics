// Student cart UI: enter item codes, change quantities, remove items,
// and display the cart and running total.

const catalog = [
  { code: "BOOK101", name: "Math Textbook", price: 25.00 },
  { code: "PEN101", name: "Blue Pen", price: 1.50 }
];

const cart = [];

const form = document.querySelector("#add-item-form");
const codeInput = document.querySelector("#item-code");
const message = document.querySelector("#item-message");
const addedItems = document.querySelector("#added-items");
const cartTotal = document.querySelector("#cart-total");

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const code = codeInput.value.trim().toUpperCase();
  const item = catalog.find((product) => product.code === code);
  

  if (!item) {
    message.textContent = `No item found for code "${code}".`;
    return;
  }

  const cartItem = cart.find((entry) => entry.code === code);

  if (cartItem) {
    cartItem.quantity += 1;
  } else {
    cart.push({ ...item, quantity: 1 });
  }

  message.textContent = `${item.name} added to the cart.`;
  renderAddedItems();
  renderCartTotal();

  codeInput.value = "";
  codeInput.focus();
});

function renderAddedItems() {
  addedItems.replaceChildren();

  if (cart.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.textContent = "Your cart is empty.";
    addedItems.append(emptyMessage);
    cartTotal.textContent = "Cart total: $0.00";
    return;
  }

  let total = 0;

  for (const item of cart) {
    const lineTotal = item.price * item.quantity;
    total += lineTotal;

    const row = document.createElement("div");
    const details = document.createElement("span");
    const decreaseButton = document.createElement("button");
    const increaseButton = document.createElement("button");
    const removeButton = document.createElement("button");

    details.textContent =
      `${item.name} | $${item.price.toFixed(2)} each | ` +
      `Quantity: ${item.quantity} | Line total: $${lineTotal.toFixed(2)} `;

    decreaseButton.type = "button";
    decreaseButton.textContent = "−";
    decreaseButton.setAttribute("aria-label", `Decrease ${item.name} quantity`);
    decreaseButton.disabled = item.quantity === 1;
    decreaseButton.addEventListener("click", () => {
      item.quantity--;
      renderAddedItems();
    });

    increaseButton.type = "button";
    increaseButton.textContent = "+";
    increaseButton.setAttribute("aria-label", `Increase ${item.name} quantity`);
    increaseButton.addEventListener("click", () => {
      item.quantity++;
      renderAddedItems();
    });

    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.setAttribute("aria-label", `Remove ${item.name} from cart`);
    removeButton.addEventListener("click", () => {
      const index = cart.findIndex((entry) => entry.code === item.code);
      if (index !== -1) cart.splice(index, 1);

      message.textContent = `${item.name} removed from the cart.`;
      renderAddedItems();
    });

    row.append(details, decreaseButton, increaseButton, removeButton);
    addedItems.append(row);
  }

  cartTotal.textContent = `Cart total: $${total.toFixed(2)}`;
}

function renderCartTotal() {
  let total = 0;
  for (const item of cart) {
    total += item.price * item.quantity;
  }
  cartTotal.textContent = `Cart total: $${total.toFixed(2)}`;
}