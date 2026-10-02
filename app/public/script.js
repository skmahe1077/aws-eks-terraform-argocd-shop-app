// Workshop Shop - frontend logic.
// All cart state lives in the browser's localStorage. There is no
// backend cart API - the server only supplies product data (see
// /api/store-info) and the checkout is entirely simulated here.

const CART_STORAGE_KEY = "workshopShopCart";

let products = [];
let cart = loadCart();

// --- Money helpers -----------------------------------------------------
// We always calculate with integer pence to avoid floating point rounding
// errors, and only format to a GBP string for display.
function formatGBP(pence) {
  return `£${(pence / 100).toFixed(2)}`;
}

// --- Cart persistence (localStorage) -----------------------------------
function loadCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn("Could not read cart from localStorage, starting empty.", err);
    return {};
  }
}

function saveCart() {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
}

// --- Rendering -----------------------------------------------------------
function renderProducts() {
  const grid = document.getElementById("product-grid");
  grid.innerHTML = "";

  products.forEach((product) => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <div class="icon">${product.icon}</div>
      <div class="name">${product.name}</div>
      <div class="price">${formatGBP(product.pricePence)}</div>
      <button type="button" data-id="${product.id}">Add to cart</button>
    `;
    card.querySelector("button").addEventListener("click", () => addToCart(product.id));
    grid.appendChild(card);
  });
}

function renderCart() {
  const container = document.getElementById("cart-items");
  const entries = Object.entries(cart);

  if (entries.length === 0) {
    container.innerHTML = '<p class="empty-cart-message">Your cart is empty.</p>';
    document.getElementById("checkout-button").disabled = true;
    document.getElementById("cart-total").textContent = formatGBP(0);
    return;
  }

  container.innerHTML = "";
  let totalPence = 0;

  entries.forEach(([productId, quantity]) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return; // product removed from catalog since cart was saved

    const lineTotal = product.pricePence * quantity;
    totalPence += lineTotal;

    const line = document.createElement("div");
    line.className = "cart-line";
    line.innerHTML = `
      <span>${product.icon} ${product.name}</span>
      <span class="qty-controls">
        <button type="button" data-action="decrease" data-id="${productId}">-</button>
        ${quantity}
        <button type="button" data-action="increase" data-id="${productId}">+</button>
      </span>
      <span>${formatGBP(lineTotal)}</span>
      <button type="button" class="remove-button" data-id="${productId}">Remove</button>
    `;
    container.appendChild(line);
  });

  container.querySelectorAll('[data-action="increase"]').forEach((btn) => {
    btn.addEventListener("click", () => changeQuantity(btn.dataset.id, 1));
  });
  container.querySelectorAll('[data-action="decrease"]').forEach((btn) => {
    btn.addEventListener("click", () => changeQuantity(btn.dataset.id, -1));
  });
  container.querySelectorAll(".remove-button").forEach((btn) => {
    btn.addEventListener("click", () => removeFromCart(btn.dataset.id));
  });

  document.getElementById("cart-total").textContent = formatGBP(totalPence);
  document.getElementById("checkout-button").disabled = false;
}

// --- Cart actions --------------------------------------------------------
function addToCart(productId) {
  cart[productId] = (cart[productId] || 0) + 1;
  saveCart();
  renderCart();
}

function changeQuantity(productId, delta) {
  cart[productId] = (cart[productId] || 0) + delta;
  if (cart[productId] <= 0) {
    delete cart[productId];
  }
  saveCart();
  renderCart();
}

function removeFromCart(productId) {
  delete cart[productId];
  saveCart();
  renderCart();
}

// --- Checkout simulation ---------------------------------------------------
function simulateCheckout() {
  const itemCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const orderNumber = `DEMO-${Date.now().toString().slice(-6)}`;

  document.getElementById("confirmation-text").textContent =
    `Order ${orderNumber} placed for ${itemCount} item(s). Thank you for shopping (not really)!`;
  document.getElementById("confirmation-overlay").classList.add("visible");

  cart = {};
  saveCart();
  renderCart();
}

// --- Startup --------------------------------------------------------------
async function init() {
  const response = await fetch("/api/store-info");
  const data = await response.json();

  document.getElementById("banner").textContent = data.banner;
  document.getElementById("app-version").textContent = `v${data.version}`;
  products = data.products;

  renderProducts();
  renderCart();

  document.getElementById("checkout-button").addEventListener("click", simulateCheckout);
  document.getElementById("confirmation-close").addEventListener("click", () => {
    document.getElementById("confirmation-overlay").classList.remove("visible");
  });
}

init();
