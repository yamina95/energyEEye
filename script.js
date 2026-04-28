const API_BASE = "http://127.0.0.1:5000";

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

async function apiGet(url, token) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  const result = await response.json();

  if (!response.ok || result.status !== "success") {
    throw new Error(result.message || "Request failed");
  }

  return result.data;
}

function setupLoginPage() {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const usernameValue = document.getElementById("username").value.trim();
    const passwordValue = document.getElementById("password").value.trim();
    const loginMessage = document.getElementById("loginMessage");

    loginMessage.textContent = "";

    try {
      const response = await fetch(`${API_BASE}/api/users/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username: usernameValue,
          password: passwordValue
        })
      });

      const result = await response.json();

      if (!response.ok || result.status !== "success") {
        loginMessage.textContent = result.message || "Login failed.";
        return;
      }

      localStorage.setItem("energyeye_token", result.data.token);
      localStorage.setItem(
        "energyeye_user_name",
        result.data.user_name || result.data.username || usernameValue
      );
      localStorage.setItem("energyeye_user_id", result.data.user_id);

      window.location.href = "dashboard.html";
    } catch (error) {
      console.error("LOGIN ERROR:", error);
      loginMessage.textContent = "Cannot connect to backend server.";
    }
  });
}

function renderBars(items) {
  const weeklyBars = document.getElementById("weeklyBars");
  if (!weeklyBars) return;

  weeklyBars.innerHTML = "";

  if (!items.length) {
    weeklyBars.innerHTML = `<p class="empty-state">No readings available for this meter.</p>`;
    return;
  }

  const maxValue = Math.max(...items.map(item => Number(item.consumption || 0)), 1);

  items.forEach(item => {
    const barItem = document.createElement("div");
    barItem.className = "bar-item";

    const valueText = document.createElement("span");
    valueText.className = "bar-value";
    valueText.textContent = `${item.consumption} kWh`;

    const bar = document.createElement("div");
    bar.className = "bar";
    bar.style.height = `${(Number(item.consumption || 0) / maxValue) * 150}px`;

    const dayText = document.createElement("p");
    dayText.textContent = item.date;

    barItem.appendChild(valueText);
    barItem.appendChild(bar);
    barItem.appendChild(dayText);
    weeklyBars.appendChild(barItem);
  });
}

function renderAlerts(alerts) {
  const alertsList = document.getElementById("alertsList");
  if (!alertsList) return;

  alertsList.innerHTML = "";

  if (!alerts.length) {
    alertsList.innerHTML = `<p class="empty-state">No alerts found.</p>`;
    return;
  }

  alerts.slice(0, 6).forEach(alertItem => {
    const alertDiv = document.createElement("div");
    alertDiv.className = "alert-card";

    alertDiv.innerHTML = `
      <div class="alert-card-top">
        <strong>${alertItem.alert_type}</strong>
        <span>${alertItem.is_read ? "Read" : "Unread"}</span>
      </div>
      <p>${alertItem.message}</p>
    `;

    alertsList.appendChild(alertDiv);
  });
}

function renderReadings(readings) {
  const tbody = document.getElementById("readingsTableBody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (!readings.length) {
    tbody.innerHTML = `<tr><td colspan="3">No readings found</td></tr>`;
    return;
  }

  readings.slice(0, 8).forEach(reading => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${reading.timestamp ? reading.timestamp.slice(0, 10) : "-"}</td>
      <td>${reading.value} kWh</td>
      <td>${reading.meter_id}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function setupDashboardPage() {
  const meterSelect = document.getElementById("meterSelect");
  if (!meterSelect) return;

  const token = localStorage.getItem("energyeye_token");
  const userName = localStorage.getItem("energyeye_user_name") || "User";

  if (!token) {
    window.location.href = "index.html";
    return;
  }

  setText("welcomeName", `Welcome, ${userName}`);
  setText("sidebarUserName", userName);
  setText("avatarLetter", userName.charAt(0).toUpperCase());

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      localStorage.removeItem("energyeye_token");
      localStorage.removeItem("energyeye_user_name");
      localStorage.removeItem("energyeye_user_id");
      window.location.href = "index.html";
    });
  }

  async function loadSummary(period, meterId) {
    return await apiGet(`${API_BASE}/api/consumption/summary?period=${period}&meter_id=${meterId}`, token);
  }

  async function loadBreakdown(meterId) {
    return await apiGet(`${API_BASE}/api/consumption/breakdown?type=daily&days=7&meter_id=${meterId}`, token);
  }

  async function loadAlerts() {
    return await apiGet(`${API_BASE}/api/alerts`, token);
  }

  async function loadReadings(meterId) {
    return await apiGet(`${API_BASE}/api/readings/${meterId}`, token);
  }

  async function loadBilling(meterId) {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const startDate = start.toISOString().slice(0, 10);
    const endDate = today.toISOString().slice(0, 10);

    try {
      return await apiGet(
        `${API_BASE}/api/billing?meter_id=${meterId}&start=${startDate}&end=${endDate}&price=5`,
        token
      );
    } catch (e) {
      return { total_cost: 0 };
    }
  }

updateMeterInfo();
await loadDashboardData();

let dashboardRefreshInterval = setInterval(async function () {
  await loadDashboardData();
}, 5000);

meterSelect.addEventListener("change", async function () {
  updateMeterInfo();
  await loadDashboardData();
});

  async function loadDashboardData() {
    const meterId = meterSelect.value;
    if (!meterId) return;

    try {
      const [today, week, month, breakdown, alerts, readings, billing] = await Promise.all([
        loadSummary("today", meterId),
        loadSummary("week", meterId),
        loadSummary("month", meterId),
        loadBreakdown(meterId),
        loadAlerts(),
        loadReadings(meterId),
        loadBilling(meterId)
      ]);

      const todayValue = Number(today.total_consumption || 0).toFixed(1);
      const weekValue = Number(week.total_consumption || 0).toFixed(1);
      const monthValue = Number(month.total_consumption || 0).toFixed(1);
      const avgValue = Number(month.average_daily || 0).toFixed(1);
      const billValue = Number(billing.total_cost || 0).toFixed(2);

      setText("todayConsumption", todayValue);
      setText("weekConsumption", `${weekValue} kWh`);
      setText("monthConsumptionTop", `${monthValue} kWh`);
      setText("averageDaily", `${avgValue} kWh`);
      setText("estimatedBill", `${billValue} DZD`);

      let status = "Normal";
      if (Number(today.total_consumption || 0) > 50) {
        status = "High usage warning";
      } else if (Number(today.total_consumption || 0) < 10) {
        status = "Low usage";
      }

      setText("statusText", status);
      setText("statusTextSecondary", status);

      renderBars(breakdown.breakdown || []);
      renderAlerts(alerts.alerts || []);
      renderReadings(readings.readings || []);
    } catch (error) {
      console.error("DASHBOARD LOAD ERROR:", error);
      alert("Failed to load dashboard data.");
    }
  }

  try {
    const data = await apiGet(`${API_BASE}/api/meters`, token);
    const meters = data.meters || [];

    if (!meters.length) {
      meterSelect.innerHTML = `<option>No meters found</option>`;
      return;
    }

    meterSelect.innerHTML = meters.map(m => `
      <option
        value="${m.id}"
        data-number="${m.meter_number}"
        data-location="${m.location}">
        ${m.meter_number} - ${m.location}
      </option>
    `).join("");

    updateMeterInfo();
    await loadDashboardData();

    meterSelect.addEventListener("change", async function () {
      updateMeterInfo();
      await loadDashboardData();
    });
  } catch (error) {
    console.error("METERS LOAD ERROR:", error);
    alert("Failed to load meters.");
  }
}
setInterval(() => {
    loadDashboard();
}, 5000);

window.addEventListener("DOMContentLoaded", function () {
  setupLoginPage();
  setupDashboardPage();
});