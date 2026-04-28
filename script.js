const API_BASE = "https://energyeye.onrender.com";

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

function forgotPassword() {
  alert("Password reset is not available yet. Please contact EnergyEye support.");
}

function setupLoginPage() {
  const loginForm = document.getElementById("loginForm");
  if (!loginForm) return;

  loginForm.addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const loginMessage = document.getElementById("loginMessage");

    loginMessage.textContent = "";

    try {
      const res = await fetch(`${API_BASE}/api/users/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username,
          password
        })
      });

      const result = await res.json();

      if (!res.ok || result.status !== "success") {
        loginMessage.textContent = result.message || "Login failed.";
        return;
      }

      localStorage.setItem("energyeye_token", result.data.token);
      localStorage.setItem(
        "energyeye_user_name",
        result.data.user_name || result.data.username || username
      );

      window.location.href = "dashboard.html";

    } catch (err) {
      console.error("LOGIN ERROR:", err);
      loginMessage.textContent = "Server error.";
    }
  });

  const demoBtn = document.getElementById("demoLoginBtn");
  if (demoBtn) {
    demoBtn.addEventListener("click", function () {
      document.getElementById("username").value = "demo";
      document.getElementById("password").value = "demo123";
      loginForm.dispatchEvent(new Event("submit"));
    });
  }
}

function setupRegisterForm() {
  const form = document.getElementById("registerForm");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = document.getElementById("registerUsername").value.trim();
    const email = document.getElementById("registerEmail").value.trim();
    const password = document.getElementById("registerPassword").value.trim();
    const msg = document.getElementById("registerMessage");

    msg.textContent = "";

    try {
      const res = await fetch(`${API_BASE}/api/users/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          username,
          email,
          password
        })
      });

      const result = await res.json();

      if (!res.ok || result.status !== "success") {
        msg.textContent = result.message || "Registration failed.";
        msg.className = "small-text error-text";
        return;
      }

      msg.textContent = "Account created successfully. You can now login.";
      msg.className = "small-text success-text";

      const loginUsername = document.getElementById("username");
      const loginPassword = document.getElementById("password");

      if (loginUsername) loginUsername.value = username;
      if (loginPassword) loginPassword.value = password;

    } catch (err) {
      console.error("REGISTER ERROR:", err);
      msg.textContent = "Server error.";
      msg.className = "small-text error-text";
    }
  });
}

async function registerUser() {
  const username = document.getElementById("registerUsername").value.trim();
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value.trim();
  const message = document.getElementById("registerMessage");

  message.textContent = "";

  try {
    const res = await fetch(`${API_BASE}/api/users/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        username,
        email,
        password
      })
    });

    const data = await res.json();

    if (!res.ok || data.status !== "success") {
      message.textContent = data.message || "Registration failed.";
      message.style.color = "red";
      return;
    }

    message.textContent = "Account created successfully. You can now login.";
    message.style.color = "green";

    const loginUsername = document.getElementById("username");
    const loginPassword = document.getElementById("password");

    if (loginUsername) loginUsername.value = username;
    if (loginPassword) loginPassword.value = password;

  } catch (error) {
    console.error("REGISTER USER ERROR:", error);
    message.textContent = "Error connecting to server.";
    message.style.color = "red";
  }
}

async function setupDashboardPage() {
  const meterSelect = document.getElementById("meterSelect");

  if (!meterSelect) {
    return;
  }

  const token = localStorage.getItem("energyeye_token");

  if (!token) {
    window.location.href = "index.html";
    return;
  }

  const userName = localStorage.getItem("energyeye_user_name") || "User";

  setText("welcomeName", `Welcome, ${userName}`);
  setText("sidebarUserName", userName);
  setText("avatarLetter", userName.charAt(0).toUpperCase());

  const logoutBtn = document.getElementById("logoutBtn");

  if (logoutBtn) {
    logoutBtn.addEventListener("click", function () {
      localStorage.removeItem("energyeye_token");
      localStorage.removeItem("energyeye_user_name");
      window.location.href = "index.html";
    });
  }

  async function loadMeters() {
    try {
      const data = await apiGet(`${API_BASE}/api/meters`, token);
      const meters = data.meters || [];

      if (!meters.length) {
        meterSelect.innerHTML = `<option value="">No meters</option>`;

        const dashboard = document.querySelector(".dashboard-main");

        if (dashboard && !document.getElementById("noMeterMessage")) {
          const messageBox = document.createElement("div");
          messageBox.id = "noMeterMessage";
          messageBox.style.marginBottom = "18px";
          messageBox.style.padding = "20px";
          messageBox.style.background = "#fff3cd";
          messageBox.style.borderRadius = "14px";
          messageBox.style.color = "#856404";
          messageBox.style.fontWeight = "600";

          messageBox.innerHTML = `
            No meter connected yet.<br>
            Connect your Sonelgaz meter to start tracking consumption.
          `;

          dashboard.prepend(messageBox);
        }

        updateAITimestamp();
        return;
      }

      const oldMessage = document.getElementById("noMeterMessage");
      if (oldMessage) oldMessage.remove();

      meterSelect.innerHTML = meters.map(m => `
        <option 
          value="${m.id}" 
          data-number="${m.meter_number}" 
          data-location="${m.location}">
          ${m.meter_number}
        </option>
      `).join("");

      updateMeterInfo();

    } catch (err) {
      console.error("LOAD METERS ERROR:", err);
    }
  }

  function updateMeterInfo() {
    const selected = meterSelect.options[meterSelect.selectedIndex];

    if (!selected) return;

    setText("meterIdText", selected.value || "-");
    setText("meterNumberText", selected.dataset.number || "-");
    setText("meterLocationText", selected.dataset.location || "-");
  }

  async function loadDashboard() {
    const meterId = meterSelect.value;
   // 🔥 DEMO DATA OVERRIDE
const userName = localStorage.getItem("energyeye_user_name");

if (userName === "demo") {
  setText("todayConsumption", "18.5");
  setText("weekConsumption", "102.3 kWh");
  setText("monthConsumptionTop", "245.0 kWh");
  setText("averageDaily", "8.2 kWh");
  setText("estimatedBill", "1225.00 DZD");

  setText("predictedMonth", "310.0 kWh");
  setText("predictedBill", "Estimated final bill: 1550.00 DZD");

  setText("aiConfidence", "96%");
  setText("aiStatusText", "AI reading verified");

  setText("statusText", "High usage detected yesterday");
  setText("statusTextSecondary", "High usage detected yesterday");

  updateAITimestamp();

  return; // ⛔ skip real API
}
    if (!meterId) {
      return;
    }

    try {
      const [today, week, month, billing] = await Promise.all([
        apiGet(`${API_BASE}/api/consumption/summary?period=today&meter_id=${meterId}`, token),
        apiGet(`${API_BASE}/api/consumption/summary?period=week&meter_id=${meterId}`, token),
        apiGet(`${API_BASE}/api/consumption/summary?period=month&meter_id=${meterId}`, token),
        apiGet(`${API_BASE}/api/billing?meter_id=${meterId}&start=2026-01-01&end=2026-12-31&price=5`, token)
      ]);

      const todayVal = Number(today.total_consumption || 0);
      const weekVal = Number(week.total_consumption || 0);
      const monthVal = Number(month.total_consumption || 0);
      const avg = Number(month.average_daily || 0);
      const bill = Number(billing.total_cost || 0);

      setText("todayConsumption", todayVal.toFixed(1));
      setText("weekConsumption", `${weekVal.toFixed(1)} kWh`);
      setText("monthConsumptionTop", `${monthVal.toFixed(1)} kWh`);
      setText("averageDaily", `${avg.toFixed(1)} kWh`);
      setText("estimatedBill", `${bill.toFixed(2)} DZD`);

      const predicted = avg * 30;
      const predictedBill = predicted * 5;

      setText("predictedMonth", `${predicted.toFixed(1)} kWh`);
      setText("predictedBill", `Estimated final bill: ${predictedBill.toFixed(2)} DZD`);

      setText("aiConfidence", "96%");
      setText("aiStatusText", "AI reading verified");

      let status = "Normal";

      if (todayVal > 50) {
        status = "High usage warning";
      } else if (todayVal < 10) {
        status = "Low usage";
      }

      setText("statusText", status);
      setText("statusTextSecondary", status);

      updateAITimestamp();

    } catch (err) {
      console.error("LOAD DASHBOARD ERROR:", err);
    }
  }

  const sonelgazForm = document.getElementById("sonelgazMeterForm");

  if (sonelgazForm) {
    sonelgazForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      const customerNumber = document.getElementById("customerNumber").value.trim();
      const meterNumber = document.getElementById("newMeterNumber").value.trim();
      const wilaya = document.getElementById("wilaya").value.trim();
      const commune = document.getElementById("commune").value.trim();
      const address = document.getElementById("meterAddress").value.trim();
      const message = document.getElementById("meterFormMessage");

      const location = `${wilaya}, ${commune}, ${address} | Sonelgaz Customer No: ${customerNumber}`;

      message.textContent = "";

      try {
        const res = await fetch(`${API_BASE}/api/meters`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            meter_number: meterNumber,
            location
          })
        });

        const result = await res.json();

        if (!res.ok || result.status !== "success") {
          message.textContent = result.message || "Could not connect meter.";
          message.className = "small-text error-text";
          return;
        }

        message.textContent = "Sonelgaz meter connected successfully.";
        message.className = "small-text success-text";

        sonelgazForm.reset();

        await loadMeters();
        await loadDashboard();

      } catch (err) {
        console.error("CONNECT METER ERROR:", err);
        message.textContent = "Error connecting meter.";
        message.className = "small-text error-text";
      }
    });
  }

  await loadMeters();
  await loadDashboard();

  meterSelect.addEventListener("change", async function () {
    updateMeterInfo();
    await loadDashboard();
  });

  setInterval(loadDashboard, 5000);
}

function updateAITimestamp() {
  const now = new Date();
  const formatted = now.toLocaleString();
  setText("aiLastUpdate", `Last update: ${formatted}`);
}

document.addEventListener("DOMContentLoaded", function () {
  setupLoginPage();
  const demoBtn = document.getElementById("demoLoginBtn");
if (demoBtn) {
  demoBtn.addEventListener("click", function () {
    document.getElementById("username").value = "demo";
    document.getElementById("password").value = "demo123";
    loginForm.dispatchEvent(new Event("submit"));
  });
}
const demoBtn = document.getElementById("demoLoginBtn");

if (demoBtn) {
  demoBtn.addEventListener("click", function () {
    document.getElementById("username").value = "demo";
    document.getElementById("password").value = "demo123";
    loginForm.dispatchEvent(new Event("submit"));
  });
}
  setupRegisterForm();
  setupDashboardPage();
});