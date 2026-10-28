/* =========================================
   GRAM PAYMENT — APP.JS
   Uses existing Gram Mart Supabase client
========================================= */

(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);

  const loginSection = $("loginSection");
  const dashboardSection = $("dashboardSection");
  const loginForm = $("loginForm");
  const loginBtn = $("loginBtn");
  const loginMessage = $("loginMessage");
  const dashboardMessage = $("dashboardMessage");
  const ordersList = $("ordersList");
  const notifyBtn = $("notifyBtn");
  const refreshBtn = $("refreshBtn");
  const logoutBtn = $("logoutBtn");
  const searchInput = $("searchInput");

  const QUEUE_VIEW = "payment_review_queue";
  const REVIEW_RPC = "gram_payment_review_order";

  let client = null;
  let allOrders = [];
  let pendingOnly = true;
  let busy = false;

  /* ---------- General helpers ---------- */

  function showMessage(element, message, type = "info") {
    element.textContent = message;
    element.className = `status ${type}`;
    element.classList.remove("hidden");
  }

  function hideMessage(element) {
    element.textContent = "";
    element.classList.add("hidden");
  }

  function setButtonBusy(button, isBusy, busyText = "Please wait...") {
    if (!button) return;

    if (isBusy) {
      button.dataset.originalText = button.textContent;
      button.textContent = busyText;
      button.disabled = true;
    } else {
      button.textContent =
        button.dataset.originalText || button.textContent;
      button.disabled = false;
    }
  }

  function formatMoney(value) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2
    }).format(Number(value || 0));
  }

  function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    });
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function getErrorMessage(error) {
    return error?.message || "Something went wrong. Please try again.";
  }

  /* ---------- Client initialization ---------- */

  function initializeClient() {
    // js/supabase.js should initialize window.supabaseClient.
    if (window.supabaseClient &&
        typeof window.supabaseClient.auth?.getSession === "function") {
      client = window.supabaseClient;
      return true;
    }

    showMessage(
      loginMessage,
      "Supabase client nahi mila. ../js/supabase.js ka path aur initialization check karo.",
      "error"
    );

    return false;
  }

  /* ---------- Session and authorization ---------- */

  async function verifyPaymentAdmin() {
    const { data, error } = await client.rpc("is_payment_admin");

    if (error) {
      throw new Error(
        "Admin permission verify nahi ho payi: " + getErrorMessage(error)
      );
    }

    if (data !== true) {
      throw new Error(
        "Is account ko Gram Payment admin access nahi hai."
      );
    }

    return true;
  }

  async function enterDashboard(user) {
    hideMessage(loginMessage);
    loginSection.classList.add("hidden");
    dashboardSection.classList.remove("hidden");

    $("adminEmail").textContent = user.email || "Authorized administrator";

    logoutBtn.classList.remove("hidden");
    refreshBtn.classList.remove("hidden");
    notifyBtn.classList.remove("hidden");

    await loadOrders();
    updateNotificationButton();
  }

  async function handleSession(session) {
    if (!session?.user) {
      showLogin();
      return;
    }

    try {
      await verifyPaymentAdmin();
      await enterDashboard(session.user);
    } catch (error) {
      showLogin();
      showMessage(loginMessage, getErrorMessage(error), "error");

      // Remove unauthorized session from this panel.
      await client.auth.signOut();
    }
  }

  function showLogin() {
    loginSection.classList.remove("hidden");
    dashboardSection.classList.add("hidden");

    logoutBtn.classList.add("hidden");
    refreshBtn.classList.add("hidden");
    notifyBtn.classList.add("hidden");

    ordersList.innerHTML = "";
    allOrders = [];
  }

  /* ---------- Login and logout ---------- */

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!client || busy) return;

    busy = true;
    setButtonBusy(loginBtn, true, "Signing in...");
    hideMessage(loginMessage);

    const email = $("email").value.trim();
    const password = $("password").value;

    try {
      const { data, error } = await client.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      if (!data?.user) {
        throw new Error("Login user details nahi mile.");
      }

      await verifyPaymentAdmin();
      await enterDashboard(data.user);
    } catch (error) {
      await client.auth.signOut().catch(() => {});

      showLogin();
      showMessage(loginMessage, getErrorMessage(error), "error");
    } finally {
      busy = false;
      setButtonBusy(loginBtn, false);
    }
  });

  logoutBtn.addEventListener("click", async () => {
    if (!client) return;

    const { error } = await client.auth.signOut();

    if (error) {
      showMessage(dashboardMessage, getErrorMessage(error), "error");
      return;
    }

    showLogin();
    showMessage(loginMessage, "You have been logged out.", "success");
  });

  /* ---------- Payment queue ---------- */

  async function loadOrders() {
    if (!client || busy) return;

    busy = true;
    refreshBtn.disabled = true;

    ordersList.innerHTML =
      '<div class="card empty">Loading payment records...</div>';

    hideMessage(dashboardMessage);

    try {
      // RLS/view must restrict this queue to payment admins.
      const { data, error } = await client
        .from(QUEUE_VIEW)
        .select(
          "id,total_amount,delivery_charge,payment_utr,payment_status,payment_submitted_at,created_at,status"
        )
        .order("payment_submitted_at", { ascending: false });

      if (error) throw error;

      allOrders = Array.isArray(data) ? data : [];

      renderStats();
      renderOrders();

      $("lastUpdated").textContent =
        "Updated " + new Date().toLocaleTimeString("en-IN");
    } catch (error) {
      ordersList.innerHTML =
        '<div class="card empty">Could not load payment records.</div>';

      showMessage(
        dashboardMessage,
        getErrorMessage(error),
        "error"
      );
    } finally {
      busy = false;
      refreshBtn.disabled = false;
    }
  }

  function getPendingOrders() {
    return allOrders.filter((order) =>
      order.payment_status === "pending" &&
      Boolean(order.payment_utr)
    );
  }

  function renderStats() {
    const pending = getPendingOrders();

    $("pendingCount").textContent = String(pending.length);

    $("pendingAmount").textContent = formatMoney(
      pending.reduce((sum, order) =>
        sum + Number(order.total_amount || 0), 0
      )
    );

    $("totalCount").textContent = String(allOrders.length);
  }

  function renderOrders() {
    const query = searchInput.value.trim().toLowerCase();

    let orders = allOrders.filter((order) => {
      const matchesSearch =
        String(order.id || "").toLowerCase().includes(query) ||
        String(order.payment_utr || "").toLowerCase().includes(query);

      const matchesStatus =
        !pendingOnly ||
        (order.payment_status === "pending" && Boolean(order.payment_utr));

      return matchesSearch && matchesStatus;
    });

    if (!orders.length) {
      ordersList.innerHTML = `
        <div class="card empty">
          <h3>No payment records found</h3>
          <p class="muted">Try another search or refresh the dashboard.</p>
        </div>
      `;
      return;
    }

    ordersList.innerHTML = orders.map((order) => {
      const status = String(order.payment_status || "pending").toLowerCase();
      const safeStatus = ["paid", "failed"].includes(status)
        ? status
        : "pending";

      const canReview =
        safeStatus === "pending" && Boolean(order.payment_utr);

      return `
        <article class="card order-card">
          <div class="order-top">
            <div>
              <div class="muted small">ORDER ID</div>
              <div class="order-id">${escapeHTML(order.id)}</div>
            </div>
            <span class="pill ${safeStatus}">
              ${escapeHTML(safeStatus)}
            </span>
          </div>

          <div class="amount">${formatMoney(order.total_amount)}</div>

          <div class="detail-row">
            <span>Delivery charge</span>
            <span>${formatMoney(order.delivery_charge)}</span>
          </div>

          <div class="detail-row">
            <span>Customer UTR</span>
            <span class="utr">${escapeHTML(order.payment_utr || "Not submitted")}</span>
          </div>

          <div class="detail-row">
            <span>Submitted</span>
            <span>${escapeHTML(formatDate(order.payment_submitted_at))}</span>
          </div>

          <div class="detail-row">
            <span>Order created</span>
            <span>${escapeHTML(formatDate(order.created_at))}</span>
          </div>

          <div class="detail-row">
            <span>Order status</span>
            <span>${escapeHTML(order.status || "—")}</span>
          </div>

          ${
            canReview
              ? `
                <div class="notice" style="margin-top:14px;margin-bottom:0">
                  Verify the actual credit in your bank/UPI app before making a decision.
                </div>

                <div class="order-actions">
                  <button
                    class="btn-green"
                    type="button"
                    data-action="paid"
                    data-order-id="${escapeHTML(order.id)}">
                    Mark Paid
                  </button>
                  <button
                    class="btn-red"
                    type="button"
                    data-action="failed"
                    data-order-id="${escapeHTML(order.id)}">
                    Mark Failed
                  </button>
                </div>
              `
              : ""
          }
        </article>
      `;
    }).join("");
  }

  ordersList.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");

    if (!button || button.disabled) return;

    const decision = button.dataset.action;
    const orderId = button.dataset.orderId;

    if (!["paid", "failed"].includes(decision) || !orderId) return;

    const order = allOrders.find((item) => item.id === orderId);

    if (!order || order.payment_status !== "pending" || !order.payment_utr) {
      showMessage(
        dashboardMessage,
        "This order is no longer awaiting payment review. Refresh the queue.",
        "error"
      );
      await loadOrders();
      return;
    }

    const promptText = decision === "paid"
      ? "Confirm that you checked the bank/UPI account and verified the actual credited amount and UTR. Mark this order PAID?"
      : "Confirm that you checked the payment and decided it was not received/valid. Mark this order FAILED and cancel it?";

    if (!window.confirm(promptText)) return;

    // The UI confirmation is not the authorization boundary.
    // The server-side RPC must enforce payment-admin permissions.
    button.disabled = true;

    try {
      const { data, error } = await client.rpc(REVIEW_RPC, {
        p_order_id: orderId,
        p_decision: decision
      });

      if (error) throw error;

      if (data !== true) {
        throw new Error("Payment review was not confirmed by the server.");
      }

      showMessage(
        dashboardMessage,
        decision === "paid"
          ? "Payment marked as PAID."
          : "Payment marked as FAILED. Order cancellation/stock handling depends on the database function.",
        "success"
      );

      await loadOrders();
    } catch (error) {
      showMessage(
        dashboardMessage,
        "Payment review failed: " + getErrorMessage(error),
        "error"
      );
      button.disabled = false;
    }
  });

  $("showAllBtn").addEventListener("click", () => {
    pendingOnly = false;
    renderOrders();
  });

  $("pendingOnlyBtn").addEventListener("click", () => {
    pendingOnly = true;
    renderOrders();
  });

  searchInput.addEventListener("input", renderOrders);

  refreshBtn.addEventListener("click", loadOrders);

  /* ---------- Web Push notifications ---------- */

  function updateNotificationButton() {
    if (!("Notification" in window)) {
      notifyBtn.textContent = "Notifications Unsupported";
      notifyBtn.disabled = true;
      return;
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      notifyBtn.textContent = "Push Not Supported";
      notifyBtn.disabled = true;
      return;
    }

    if (Notification.permission === "denied") {
      notifyBtn.textContent = "Notifications Blocked";
      notifyBtn.disabled = true;
      return;
    }

    notifyBtn.textContent = Notification.permission === "granted"
      ? "Enable Background Alerts"
      : "Enable Alerts";

    notifyBtn.disabled = false;
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const rawData = window.atob(base64);
    const output = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; i++) {
      output[i] = rawData.charCodeAt(i);
    }

    return output;
  }

  async function enablePushNotifications() {
    /*
      IMPORTANT:
      Replace this placeholder with the VAPID PUBLIC key generated
      for your own Web Push server. Never put the VAPID PRIVATE key
      or Supabase service_role key in this file.
    */
    const VAPID_PUBLIC_KEY = "BK1HKFZ4qG3ZokfoRU5NouiyJndcT7YaHNPaf3nRDAkRjyPbZV3f9aA1M4i0RYBoz1noBw_Ue1YRjkCS4v2xhvM";

    if (VAPID_PUBLIC_KEY === "BK1HKFZ4qG3ZokfoRU5NouiyJndcT7YaHNPaf3nRDAkRjyPbZV3f9aA1M4i0RYBoz1noBw_Ue1YRjkCS4v2xhvM") {
      showMessage(
        dashboardMessage,
        "Push setup pending: pehle VAPID public key aur server-side push sender configure karo.",
        "info"
      );
      return;
    }

    if (!window.isSecureContext) {
      throw new Error("Push notifications ke liye HTTPS zaroori hai.");
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      throw new Error("This browser does not support Web Push.");
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      throw new Error("Browser notification permission was not granted.");
    }

    const registration = await navigator.serviceWorker.register("./sw.js");

    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    const { data: userResult, error: userError } =
      await client.auth.getUser();

    if (userError || !userResult?.user) {
      throw new Error("Login session verify nahi ho paya.");
    }

    // RLS restricts subscription writes to authorized payment admins.
    const { error: saveError } = await client
      .from("payment_push_subscriptions")
      .upsert({
        user_id: userResult.user.id,
        endpoint: subscription.endpoint,
        subscription: subscription.toJSON(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: "endpoint"
      });

    if (saveError) throw saveError;

    updateNotificationButton();

    showMessage(
      dashboardMessage,
      "Browser push subscription saved. Server-side push sender must also be deployed for background alerts.",
      "success"
    );
  }

  notifyBtn.addEventListener("click", async () => {
    notifyBtn.disabled = true;

    try {
      await enablePushNotifications();
    } catch (error) {
      showMessage(
        dashboardMessage,
        "Notifications setup failed: " + getErrorMessage(error),
        "error"
      );
    } finally {
      updateNotificationButton();
    }
  });

  /* ---------- Start application ---------- */

  async function start() {
    if (!initializeClient()) return;

    try {
      const { data, error } = await client.auth.getSession();

      if (error) throw error;

      await handleSession(data.session);
    } catch (error) {
      showLogin();
      showMessage(loginMessage, getErrorMessage(error), "error");
    }

    // Re-check authorization when the session changes.
    client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        showLogin();
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        // Defer network work until after the auth callback returns.
        setTimeout(() => {
          handleSession(session).catch((error) => {
            showLogin();
            showMessage(loginMessage, getErrorMessage(error), "error");
          });
        }, 0);
      }
    });
  }

  start();
})();