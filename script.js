/* =========================================================
   EnergyEye – script.js
   Flow: Backend /api/latest-reading → Dashboard
   ========================================================= */

const API_BASE = "https://energyeye.onrender.com";

// Price per kWh in DZD (Algerian tariff approx)
const PRICE_PER_KWH = 5.0;

// ── Utility ──────────────────────────────────────────────
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function getToken() {
  return localStorage.getItem("energyeye_token");
}

function getUserName() {
  return localStorage.getItem("energyeye_user_name") || "User";
}

function isDemoMode() {
  return localStorage.getItem("energyeye_demo") === "true";
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const json = await res.json();
  return { ok: res.ok, status: res.status, json };
}

// ── Forgot password placeholder ──────────────────────────
function forgotPassword() {
  alert("Password reset is not available yet. Please contact EnergyEye support.");
}

// =========================================================
// LOGIN PAGE
// =========================================================
function setupLoginPage() {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const msg = document.getElementById("loginMessage");
    msg.textContent = "Logging in…";
    msg.className = "small-text";

    try {
      const { ok, json } = await apiFetch("/api/users/login", {
        method: "POST",
        body: JSON.stringify({ username, password })
      });

      if (!ok || json.status !== "success") {
        msg.textContent = json.message || "Login failed.";
        msg.className = "small-text error-text";
        return;
      }

      localStorage.setItem("energyeye_token", json.data.token);
      localStorage.setItem("energyeye_user_name", json.data.user_name || username);
      localStorage.removeItem("energyeye_demo");
      window.location.href = "dashboard.html";

    } catch (err) {
      msg.textContent = "Network error – check connection.";
      msg.className = "small-text error-text";
    }
  });

  // Demo button
  const demoBtn = document.getElementById("demoLoginBtn");
  if (demoBtn) {
    demoBtn.addEventListener("click", function () {
      localStorage.setItem("energyeye_demo", "true");
      localStorage.setItem("energyeye_user_name", "Demo User");
      localStorage.removeItem("energyeye_token");
      window.location.href = "dashboard.html";
    });
  }
}

// =========================================================
// REGISTER PAGE
// =========================================================
function setupRegisterForm() {
  const form = document.getElementById("registerForm");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();
    const username = document.getElementById("registerUsername").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value.trim();
    const msg = document.getElementById("registerMessage");
    msg.textContent = "Creating account…";
    msg.className = "small-text";

    try {
      const { ok, json } = await apiFetch("/api/users/register", {
        method: "POST",
        body: JSON.stringify({ username, email, password })
      });

      if (!ok || json.status !== "success") {
        msg.textContent = json.message || "Registration failed.";
        msg.className = "small-text error-text";
        return;
      }

      msg.textContent = "Account created! You can now log in.";
      msg.className = "small-text success-text";
      form.reset();
    } catch {
      msg.textContent = "Network error.";
      msg.className = "small-text error-text";
    }
  });
}

// =========================================================
// DASHBOARD PAGE
// =========================================================
async function setupDashboardPage() {
  const meterSelect = document.getElementById("meterSelect");
  if (!meterSelect) return; // not on dashboard

  const demo = isDemoMode();
  const token = getToken();

  // Redirect non-demo users who have no token
  if (!demo && !token) {
    window.location.href = "index.html";
    return;
  }

  // Show user name
  const userName = getUserName();
  setText("welcomeName", `Welcome, ${userName}`);
  setText("sidebarUserName", userName);
  setText("avatarLetter", userName.charAt(0).toUpperCase());

  // Logout
  document.getElementById("logoutBtn")?.addEventListener("click", function () {
    localStorage.removeItem("energyeye_token");
    localStorage.removeItem("energyeye_user_name");
    localStorage.removeItem("energyeye_demo");
    window.location.href = "index.html";
  });

  if (demo) {
    loadDemoData();
    renderDemoHistory();
    setInterval(loadDemoData, 10000);
    return;
  }

  // ── Real mode ──────────────────────────────────────────
  await loadMeters(meterSelect);

  meterSelect.addEventListener("change", function () {
    const mid = parseInt(this.value);
    if (!isNaN(mid)) loadRealDashboard(mid);
  });

  const firstMeter = parseInt(meterSelect.value);
  if (!isNaN(firstMeter)) {
    await loadRealDashboard(firstMeter);
    // Poll every 5 seconds
    setInterval(() => {
      const mid = parseInt(meterSelect.value);
      if (!isNaN(mid)) loadRealDashboard(mid);
    }, 5000);
  }
}

// ── Load meters into select ───────────────────────────────
async function loadMeters(select) {
  try {
    const { ok, json } = await apiFetch("/api/meters");
    if (!ok || !json.data) return;

    const meters = json.data.meters || [];
    select.innerHTML = "";

    if (meters.length === 0) {
      select.innerHTML = '<option value="">No meters registered</option>';
      return;
    }

    meters.forEach(m => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = `${m.meter_number} – ${m.location}`;
      select.appendChild(opt);
    });

    // Update settings panel with first meter info
    const first = meters[0];
    setText("meterIdText", first.id);
    setText("meterNumberText", first.meter_number);
    setText("meterLocationText", first.location);

    select.addEventListener("change", function () {
      const m = meters.find(x => x.id === parseInt(this.value));
      if (m) {
        setText("meterIdText", m.id);
        setText("meterNumberText", m.meter_number);
        setText("meterLocationText", m.location);
      }
    });

  } catch (err) {
    console.error("loadMeters error:", err);
  }
}

// ── Real dashboard load ───────────────────────────────────
async function loadRealDashboard(meterId) {
  await Promise.all([
    loadLatestReading(meterId),
    loadConsumption(meterId),
    loadReadingsHistory(meterId),
    loadAlerts()
  ]);
}

// ── Latest reading from backend ───────────────────────────
async function loadLatestReading(meterId) {
  try {
    const { ok, json } = await apiFetch(`/api/latest-reading/${meterId}`);

    if (!ok || !json.data) {
      setText("aiReading", "No reading yet");
      setText("aiConfidence", "—");
      setText("aiStatusText", "Waiting for ESP32 data");
      setText("aiLastUpdate", "Never updated");
      setText("statusText", "No data yet");
      setText("statusTextSecondary", "No data yet");
      return;
    }

    const d = json.data;
    const reading = d.value !== undefined ? Number(d.value).toFixed(0) : "—";
    const conf = d.confidence !== null && d.confidence !== undefined
      ? Math.round(Number(d.confidence) * 100) + "%"
      : "—";
    const ts = d.timestamp ? new Date(d.timestamp).toLocaleString() : "—";

    setText("aiReading", `${reading} kWh`);
    setText("aiConfidence", conf);
    setText("aiStatusText", "AI reading verified ✓");
    setText("aiLastUpdate", `Updated: ${ts}`);
    setText("statusText", "Live data connected");
    setText("statusTextSecondary", "Live data connected");

  } catch (err) {
    console.error("loadLatestReading error:", err);
    setText("aiStatusText", "Connection error");
    setText("statusText", "Connection error");
  }
}

// ── Consumption summary ───────────────────────────────────
async function loadConsumption(meterId) {
  try {
    // Today
    const { json: todayJson } = await apiFetch(
      `/api/consumption/summary?meter_id=${meterId}&period=today`
    );
    const todayKwh = todayJson?.data?.total_consumption ?? 0;
    setText("todayConsumption", todayKwh.toFixed(1));

    // Week
    const { json: weekJson } = await apiFetch(
      `/api/consumption/summary?meter_id=${meterId}&period=week`
    );
    const weekKwh = weekJson?.data?.total_consumption ?? 0;
    setText("weekConsumption", `${weekKwh.toFixed(1)} kWh`);

    // Month
    const { json: monthJson } = await apiFetch(
      `/api/consumption/summary?meter_id=${meterId}&period=month`
    );
    const monthKwh = monthJson?.data?.total_consumption ?? 0;
    const avgDaily = monthJson?.data?.average_daily ?? 0;
    setText("monthConsumptionTop", `${monthKwh.toFixed(1)} kWh`);
    setText("averageDaily", `${avgDaily.toFixed(1)} kWh`);

    // Bill estimate
    const billDZD = monthKwh * PRICE_PER_KWH;
    setText("estimatedBill", `${billDZD.toFixed(2)} DZD`);

    // Prediction (project month total using avg daily × 30)
    const predictedKwh = avgDaily * 30;
    const predictedBill = predictedKwh * PRICE_PER_KWH;
    setText("predictedMonth", `${predictedKwh.toFixed(1)} kWh`);
    setText("predictedBill", `${predictedBill.toFixed(2)} DZD`);

    // High usage alert
    if (todayKwh > 20) {
      setText("statusText", "⚠ High usage today");
    }

  } catch (err) {
    console.error("loadConsumption error:", err);
  }
}

// ── Readings history table ────────────────────────────────
async function loadReadingsHistory(meterId) {
  try {
    const { ok, json } = await apiFetch(`/api/readings/${meterId}`);
    if (!ok || !json.data) return;

    const readings = (json.data.readings || []).slice(0, 10);
    const tbody = document.getElementById("readingsTableBody");
    if (!tbody) return;

    if (readings.length === 0) {
      tbody.innerHTML = '<tr><td colspan="3" style="color:#64748b">No readings yet</td></tr>';
      return;
    }

    tbody.innerHTML = readings.map(r => {
      const date = r.timestamp ? new Date(r.timestamp).toLocaleDateString() : "—";
      return `<tr>
        <td>${date}</td>
        <td>${Number(r.value).toFixed(0)} kWh</td>
        <td>#${r.meter_id}</td>
      </tr>`;
    }).join("");

    // Also render bar chart
    renderBars(readings);

  } catch (err) {
    console.error("loadReadingsHistory error:", err);
  }
}

// ── Bar chart ─────────────────────────────────────────────
function renderBars(readings) {
  const container = document.getElementById("weeklyBars");
  if (!container || readings.length < 2) return;

  // Compute daily deltas from last 7 readings
  const sliced = readings.slice(0, 7).reverse();
  const deltas = [];
  for (let i = 1; i < sliced.length; i++) {
    const delta = Math.max(sliced[i].value - sliced[i - 1].value, 0);
    deltas.push({ date: sliced[i].timestamp, val: delta });
  }

  if (deltas.length === 0) return;
  const maxVal = Math.max(...deltas.map(d => d.val), 1);

  container.innerHTML = deltas.map(d => {
    const h = Math.max(Math.round((d.val / maxVal) * 180), 10);
    const label = d.date ? new Date(d.date).toLocaleDateString("en", { month: "short", day: "numeric" }) : "";
    return `<div class="bar-item">
      <span class="bar-value">${d.val.toFixed(1)}</span>
      <div class="bar" style="height:${h}px"></div>
      <p>${label}</p>
    </div>`;
  }).join("");
}

// ── Alerts ────────────────────────────────────────────────
async function loadAlerts() {
  try {
    const { ok, json } = await apiFetch("/api/alerts");
    if (!ok || !json.data) return;

    const alerts = json.data.alerts || [];
    const container = document.getElementById("alertsList");
    if (!container) return;

    if (alerts.length === 0) {
      container.innerHTML = '<p class="empty-state">No alerts.</p>';
      return;
    }

    container.innerHTML = alerts.slice(0, 5).map(a => `
      <div class="alert-card">
        <div class="alert-card-top">
          <span>${a.alert_type.replace(/_/g, " ").toUpperCase()}</span>
          <small>${a.created_at ? new Date(a.created_at).toLocaleString() : ""}</small>
        </div>
        <p>${a.message}</p>
      </div>
    `).join("");

  } catch (err) {
    console.error("loadAlerts error:", err);
  }
}

// =========================================================
// DEMO MODE DATA
// =========================================================
function loadDemoData() {
  const now = new Date().toLocaleString();
  setText("aiReading", "1394 kWh");
  setText("aiConfidence", "38%");
  setText("aiStatusText", "Demo – AI reading simulated");
  setText("aiLastUpdate", `Demo updated: ${now}`);
  setText("todayConsumption", "18.5");
  setText("weekConsumption", "102.3 kWh");
  setText("monthConsumptionTop", "245.0 kWh");
  setText("averageDaily", "8.2 kWh");
  setText("estimatedBill", "1225.00 DZD");
  setText("predictedMonth", "310.0 kWh");
  setText("predictedBill", "1550.00 DZD");
  setText("statusText", "Demo mode active");
  setText("statusTextSecondary", "Demo mode active");
  setText("meterIdText", "demo-meter");
  setText("meterNumberText", "SONELGAZ-MTR-001");
  setText("meterLocationText", "Algiers");
  setText("weekConsumption", "102.3 kWh");

  const meterSelect = document.getElementById("meterSelect");
  if (meterSelect) {
    meterSelect.innerHTML = '<option value="demo-meter">SONELGAZ-MTR-001 (Demo)</option>';
  }
}

function renderDemoHistory() {
  const tbody = document.getElementById("readingsTableBody");
  if (tbody) {
    tbody.innerHTML = `
      <tr><td>2026-05-18</td><td>1394 kWh</td><td>demo-meter</td></tr>
      <tr><td>2026-05-17</td><td>1376 kWh</td><td>demo-meter</td></tr>
      <tr><td>2026-05-16</td><td>1360 kWh</td><td>demo-meter</td></tr>
    `;
  }

  const container = document.getElementById("alertsList");
  if (container) {
    container.innerHTML = `
      <div class="alert-card">
        <div class="alert-card-top"><span>HIGH CONSUMPTION</span><small>Demo</small></div>
        <p>Demo alert: consumption exceeded 20 kWh today.</p>
      </div>
    `;
  }

  const bars = document.getElementById("weeklyBars");
  if (bars) {
    const data = [
      { label: "Mon", val: 7.2 }, { label: "Tue", val: 9.1 }, { label: "Wed", val: 8.5 },
      { label: "Thu", val: 11.3 }, { label: "Fri", val: 6.8 }, { label: "Sat", val: 15.2 },
      { label: "Sun", val: 18.5 }
    ];
    const maxVal = Math.max(...data.map(d => d.val));
    bars.innerHTML = data.map(d => {
      const h = Math.round((d.val / maxVal) * 180);
      return `<div class="bar-item">
        <span class="bar-value">${d.val}</span>
        <div class="bar" style="height:${h}px"></div>
        <p>${d.label}</p>
      </div>`;
    }).join("");
  }
}

// =========================================================
// BOOT
// =========================================================
document.addEventListener("DOMContentLoaded", function () {
  setupLoginPage();
  setupRegisterForm();
  setupDashboardPage();
});
