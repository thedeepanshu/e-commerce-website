/*
 * Tempovolt - shared site behaviour.
 * Mobile menu, product gallery, cart with coupons (stored in localStorage),
 * product filtering/sorting, coupon copy buttons and demo forms.
 */
(function () {
  "use strict";

  const CART_KEY = "tempovolt-cart";
  const COUPON_KEY = "tempovolt-coupon";
  const TAX_RATE = 0.1;
  const MAX_QUANTITY = 10;

  // Keep in sync with the codes listed on coupons.html.
  const COUPONS = {
    WELCOME10: { percent: 10, minSubtotal: 0 },
    RUN15: { percent: 15, minSubtotal: 100 },
    ATHLETE20: { percent: 20, minSubtotal: 200 },
  };

  const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  });

  // Money is handled in whole cents to avoid floating-point rounding errors.
  const toCents = (dollars) => Math.round(dollars * 100);
  const formatCents = (cents) => currency.format(cents / 100);

  /* ---------- Storage helpers ---------- */

  function readJSON(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Storage may be full or blocked (private mode); data just won't persist.
    }
  }

  /* ---------- Cart ---------- */

  function clampQuantity(value) {
    const quantity = Math.floor(Number(value));
    if (!Number.isFinite(quantity) || quantity < 1) return 1;
    return Math.min(quantity, MAX_QUANTITY);
  }

  function isValidItem(item) {
    return (
      item !== null &&
      typeof item === "object" &&
      typeof item.id === "string" &&
      typeof item.name === "string" &&
      typeof item.image === "string" &&
      typeof item.size === "string" &&
      Number.isFinite(item.price) &&
      Number.isFinite(item.quantity)
    );
  }

  function readCart() {
    const cart = readJSON(CART_KEY, []);
    return Array.isArray(cart) ? cart.filter(isValidItem) : [];
  }

  function writeCart(cart) {
    writeJSON(CART_KEY, cart);
    updateCartCount(cart);
  }

  function addToCart(newItem) {
    const cart = readCart();
    const existing = cart.find(
      (item) => item.id === newItem.id && item.size === newItem.size
    );
    if (existing) {
      existing.quantity = clampQuantity(existing.quantity + newItem.quantity);
    } else {
      cart.push(newItem);
    }
    writeCart(cart);
  }

  function updateCartCount(cart) {
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.querySelectorAll(".cart-link").forEach((link) => {
      const badge = link.querySelector(".cart-count");
      if (badge) {
        badge.textContent = String(count);
        badge.hidden = count === 0;
      }
      link.setAttribute(
        "aria-label",
        count === 1 ? "Shopping cart, 1 item" : `Shopping cart, ${count} items`
      );
    });
  }

  function readCoupon() {
    const code = readJSON(COUPON_KEY, null);
    return typeof code === "string" && COUPONS[code] ? code : null;
  }

  /* ---------- Mobile menu ---------- */

  function initMenu() {
    const toggle = document.querySelector(".menu-icon");
    const menu = document.getElementById("MenuItems");
    if (!toggle || !menu) return;

    function setOpen(isOpen) {
      menu.classList.toggle("open", isOpen);
      toggle.setAttribute("aria-expanded", String(isOpen));
    }

    toggle.addEventListener("click", () => {
      setOpen(!menu.classList.contains("open"));
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && menu.classList.contains("open")) {
        setOpen(false);
        toggle.focus();
      }
    });
  }

  /* ---------- Product page ---------- */

  function initGallery() {
    const mainImage = document.querySelector(".pro-img");
    const thumbnails = document.querySelectorAll(".small-img-col");
    if (!mainImage) return;

    thumbnails.forEach((thumbnail) => {
      thumbnail.addEventListener("click", () => {
        mainImage.src = thumbnail.querySelector("img").src;
        thumbnails.forEach((other) =>
          other.setAttribute("aria-pressed", String(other === thumbnail))
        );
      });
    });
  }

  function initAddToCart() {
    document.querySelectorAll(".add-to-cart").forEach((form) => {
      const status = form.querySelector(".form-status");

      form.addEventListener("submit", (event) => {
        event.preventDefault();
        const data = new FormData(form);
        const quantity = clampQuantity(data.get("quantity"));
        const { id, name, price, image } = form.dataset;

        addToCart({
          id,
          name,
          image,
          price: Number(price),
          size: data.get("size") || "",
          quantity,
        });

        const cartLink = document.createElement("a");
        cartLink.href = "shoppingcart.html";
        cartLink.textContent = "View cart";
        status.textContent = `Added ${quantity} × ${name} to your cart. `;
        status.append(cartLink);
      });
    });
  }

  /* ---------- Cart page ---------- */

  function createCartRow(item, cart) {
    const row = document.createElement("tr");

    const productCell = document.createElement("td");
    const info = document.createElement("div");
    info.className = "cart-info";

    const image = document.createElement("img");
    image.src = item.image;
    image.alt = "";
    image.width = 80;
    image.height = 96;

    const details = document.createElement("div");
    const name = document.createElement("p");
    name.textContent = item.name;
    const meta = document.createElement("small");
    meta.textContent =
      (item.size ? `Size: ${item.size} · ` : "") +
      `Price: ${formatCents(toCents(item.price))}`;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "link-btn";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove ${item.name} from cart`);
    remove.addEventListener("click", () => {
      writeCart(cart.filter((other) => other !== item));
      renderCart();
      document.getElementById("cart-title").focus();
    });

    details.append(name, meta, remove);
    info.append(image, details);
    productCell.append(info);

    const quantityCell = document.createElement("td");
    const quantity = document.createElement("input");
    quantity.type = "number";
    quantity.min = "1";
    quantity.max = String(MAX_QUANTITY);
    quantity.value = String(item.quantity);
    quantity.setAttribute("aria-label", `Quantity of ${item.name}`);
    quantity.addEventListener("change", () => {
      item.quantity = clampQuantity(quantity.value);
      writeCart(cart);
      renderCart();
    });
    quantityCell.append(quantity);

    const subtotalCell = document.createElement("td");
    subtotalCell.textContent = formatCents(
      toCents(item.price) * item.quantity
    );

    row.append(productCell, quantityCell, subtotalCell);
    return row;
  }

  function renderCart() {
    const body = document.getElementById("cart-items");
    if (!body) return;

    const cart = readCart();
    const isEmpty = cart.length === 0;
    body.replaceChildren(...cart.map((item) => createCartRow(item, cart)));

    document.querySelector(".cart-table").hidden = isEmpty;
    document.querySelector(".cart-summary").hidden = isEmpty;
    document.querySelector(".cart-empty").hidden = !isEmpty;

    const subtotal = cart.reduce(
      (sum, item) => sum + toCents(item.price) * item.quantity,
      0
    );

    const code = readCoupon();
    const coupon = code ? COUPONS[code] : null;
    const couponStatus = document.getElementById("coupon-status");
    let discount = 0;
    if (coupon && subtotal >= toCents(coupon.minSubtotal)) {
      discount = Math.round((subtotal * coupon.percent) / 100);
      couponStatus.textContent = `${code} applied: ${coupon.percent}% off.`;
    } else if (coupon) {
      const shortfall = toCents(coupon.minSubtotal) - subtotal;
      couponStatus.textContent = `Add ${formatCents(shortfall)} more to use ${code}.`;
    }
    document.getElementById("remove-coupon").hidden = !code;

    const tax = Math.round((subtotal - discount) * TAX_RATE);
    document.getElementById("cart-subtotal").textContent = formatCents(subtotal);
    document.getElementById("discount-row").hidden = discount === 0;
    document.getElementById("cart-discount").textContent = `−${formatCents(discount)}`;
    document.getElementById("cart-tax").textContent = formatCents(tax);
    document.getElementById("cart-total").textContent = formatCents(
      subtotal - discount + tax
    );
  }

  function initCartPage() {
    const couponForm = document.getElementById("coupon-form");
    if (!couponForm) return;

    const input = document.getElementById("coupon-code");
    const status = document.getElementById("coupon-status");
    const orderStatus = document.getElementById("order-status");

    couponForm.addEventListener("submit", (event) => {
      event.preventDefault();
      const code = input.value.trim().toUpperCase();
      if (!COUPONS[code]) {
        status.textContent = `"${code}" isn't a valid coupon code.`;
        return;
      }
      writeJSON(COUPON_KEY, code);
      input.value = "";
      renderCart();
    });

    document.getElementById("remove-coupon").addEventListener("click", () => {
      writeJSON(COUPON_KEY, null);
      status.textContent = "Coupon removed.";
      renderCart();
    });

    // Demo checkout: there is no payment backend, so the order is simulated.
    document.getElementById("checkout-btn").addEventListener("click", () => {
      const orderNumber = Math.floor(100000 + Math.random() * 900000);
      writeCart([]);
      writeJSON(COUPON_KEY, null);
      status.textContent = "";
      renderCart();
      document.querySelector(".cart-empty").hidden = true;
      orderStatus.textContent = `Thank you! Order #TV${orderNumber} has been placed. (Demo store: no payment was taken.)`;
      orderStatus.hidden = false;
      orderStatus.focus();
    });

    renderCart();
  }

  /* ---------- Products page ---------- */

  function initProductFilters() {
    const grid = document.getElementById("product-grid");
    const sortSelect = document.getElementById("sort-products");
    const filterSelect = document.getElementById("filter-category");
    const resultCount = document.getElementById("result-count");
    if (!grid || !sortSelect || !filterSelect) return;

    const cards = Array.from(grid.children);
    const comparators = {
      default: (a, b) => cards.indexOf(a) - cards.indexOf(b),
      "price-asc": (a, b) => a.dataset.price - b.dataset.price,
      "price-desc": (a, b) => b.dataset.price - a.dataset.price,
      rating: (a, b) => b.dataset.rating - a.dataset.rating,
      name: (a, b) => a.dataset.name.localeCompare(b.dataset.name),
    };

    // Allow links such as products.html?category=Shoes.
    const requested = new URLSearchParams(window.location.search).get("category");
    if (requested && filterSelect.querySelector(`option[value="${CSS.escape(requested)}"]`)) {
      filterSelect.value = requested;
    }

    function apply() {
      const category = filterSelect.value;
      const compare = comparators[sortSelect.value] || comparators.default;
      let visible = 0;
      cards.slice().sort(compare).forEach((card) => {
        const show = category === "all" || card.dataset.category === category;
        card.hidden = !show;
        if (show) visible += 1;
        grid.append(card);
      });
      resultCount.textContent =
        visible === 1 ? "Showing 1 product" : `Showing ${visible} products`;
    }

    sortSelect.addEventListener("change", apply);
    filterSelect.addEventListener("change", () => {
      const url = new URL(window.location.href);
      if (filterSelect.value === "all") url.searchParams.delete("category");
      else url.searchParams.set("category", filterSelect.value);
      window.history.replaceState(null, "", url);
      apply();
    });
    apply();
  }

  /* ---------- Account page ---------- */

  function initAccountTabs() {
    const container = document.querySelector(".form-container");
    if (!container) return;

    const loginForm = document.getElementById("loginform");
    const registerForm = document.getElementById("regform");
    const loginTab = document.getElementById("login-tab");
    const registerTab = document.getElementById("register-tab");

    function showForm(showLogin) {
      container.classList.toggle("show-login", showLogin);
      loginForm.inert = !showLogin;
      registerForm.inert = showLogin;
      loginTab.setAttribute("aria-pressed", String(showLogin));
      registerTab.setAttribute("aria-pressed", String(!showLogin));
    }

    loginTab.addEventListener("click", () => showForm(true));
    registerTab.addEventListener("click", () => showForm(false));

    loginForm.querySelector(".forgot-password").addEventListener("click", () => {
      loginForm.querySelector(".form-status").textContent =
        "Password reset is coming soon.";
    });
  }

  /* ---------- Demo forms, coupons and social links ---------- */

  // Forms without a backend acknowledge the submission client-side.
  function initDemoForms() {
    document.querySelectorAll("form[data-demo-message]").forEach((form) => {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        form.querySelector(".form-status").textContent =
          form.dataset.demoMessage;
        form.reset();
      });
    });
  }

  function initCopyButtons() {
    document.querySelectorAll(".copy-code").forEach((button) => {
      const label = button.textContent;
      button.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(button.dataset.code);
          button.textContent = "Copied!";
        } catch (error) {
          button.textContent = `Code: ${button.dataset.code}`;
        }
        setTimeout(() => {
          button.textContent = label;
        }, 2000);
      });
    });
  }

  // Social profiles don't exist yet, so these links intentionally go nowhere.
  function initSocialLinks() {
    document.querySelectorAll(".social-link").forEach((link) => {
      link.addEventListener("click", (event) => event.preventDefault());
    });
  }

  function initYear() {
    document.querySelectorAll("[data-year]").forEach((element) => {
      element.textContent = String(new Date().getFullYear());
    });
  }

  /* ---------- Boot ---------- */

  initMenu();
  initGallery();
  initAddToCart();
  initCartPage();
  initProductFilters();
  initAccountTabs();
  initDemoForms();
  initCopyButtons();
  initSocialLinks();
  initYear();
  updateCartCount(readCart());

  // Keep the cart in sync when it changes in another tab.
  window.addEventListener("storage", (event) => {
    if (event.key !== CART_KEY && event.key !== COUPON_KEY) return;
    updateCartCount(readCart());
    renderCart();
  });
})();
