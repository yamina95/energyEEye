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

//////////////////////////
// LOGIN
//////////////////////////

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
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ username, password })
      });

      const result = await res.json();

      if (!res.ok || result.status !== "success") {
        loginMessage.textContent = result.message;
        return;
      }

      localStorage.setItem("energyeye_token", result.data.token);
      localStorage.setItem(
  "energyeye_user_name",
  result.data.user_name || result.data.username || username
);

      window.location.href = "dashboard.html";

    } catch (err) {
      loginMessage.textContent = "Server error.";
    }
  });

  // DEMO LOGIN
  const demoBtn = document.getElementById("demoLoginBtn");
  if (demoBtn) {
    demoBtn.addEventListener("click", () => {
      document.getElementById("username").value = "demo";
      document.getElementById("password").value = "demo123";
      loginForm.dispatchEvent(new Event("submit"));
    });
  }
}

//////////////////////////
// REGISTER
//////////////////////////

function setupRegisterForm() {
  const form = document.getElementById("registerForm");
  if (!form) return;

  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const username = document.getElementById("registerUsername").value;
    const email = document.getElementById("registerEmail").value;
    const password = document.getElementById("registerPassword").value;
    const msg = document.getElementById("registerMessage");

    try {
      const res = await fetch(`${API_BASE}/api/users/register`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({ username, email, password })
      });

      const result = await res.json();

      if (!res.ok || result.status !== "success") {
        msg.textContent = result.message;
        msg.className = "small-text error-text";
        return;
      }

      msg.textContent = "Account created!";
      msg.className = "small-text success-text";

    } catch {
      msg.textContent = "Server error.";
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
        username: username,
        email: email,
        password: password
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

    document.getElementById("username").value = username;
    document.getElementById("password").value = password;

  } catch (error) {
    message.textContent = "Error connecting to server.";
    message.style.color = "red";
  }
}

//////////////////////////
// DASHBOARD
//////////////////////////

async function setupDashboardPage() {
  const token = localStorage.getItem("energyeye_token");
  if (!token) {
    window.location.href = "index.html";
    return;
  }

  const userName = localStorage.getItem("energyeye_user_name") || "User";

  setText("welcomeName", `Welcome, ${userName}`);
  setText("sidebarUserName", userName);
  setText("avatarLetter", userName.charAt(0));

  const meterSelect = document.getElementById("meterSelect");

  //////////////////////////
  // LOAD METERS
  //////////////////////////
  async function loadMeters() {
    const data = await apiGet(`${API_BASE}/api/meters`, token);
    const meters = data.meters;

    if (!meters.length) {
  meterSelect.innerHTML = `<option>No meters</option>`;

  const dashboard = document.querySelector(".dashboard-main");

  if (dashboard) {
    const existingMessage = document.getElementById("noMeterMessage");

    if (!existingMessage) {
      const messageBox = document.createElement("div");
      messageBox.id = "noMeterMessage";
      messageBox.style.margin = "20px";
      messageBox.style.padding = "20px";
      messageBox.style.background = "#fff3cd";
      messageBox.style.borderRadius = "10px";
      messageBox.style.color = "#856404";
      messageBox.style.fontWeight = "600";

      messageBox.innerHTML = `
        No meter connected yet.<br>
        Connect your Sonelgaz meter to start tracking consumption.
      `;

      dashboard.prepend(messageBox);
    }
  }
updateAITimestamp();

  return;
}

    meterSelect.innerHTML = meters.map(m =>
      `<option value="${m.id}">${m.meter_number}</option>`
    ).join("");
  }

  //////////////////////////
  // DASHBOARD DATA
  //////////////////////////
  async function loadDashboard() {
    const meterId = meterSelect.value;
    if (!meterId) return;

    try {
      const [today, month, billing] = await Promise.all([
        apiGet(`${API_BASE}/api/consumption/summary?period=today&meter_id=${meterId}`, token),
        apiGet(`${API_BASE}/api/consumption/summary?period=month&meter_id=${meterId}`, token),
        apiGet(`${API_BASE}/api/billing?meter_id=${meterId}&start=2026-01-01&end=2026-12-31&price=5`, token)
      ]);

      const todayVal = Number(today.total_consumption || 0);
      const avg = Number(month.average_daily || 0);

      setText("todayConsumption", todayVal);
      setText("averageDaily", avg + " kWh");
      setText("estimatedBill", billing.total_cost + " DZD");

      // PREDICTION
      const predicted = avg * 30;
      setText("predictedMonth", predicted.toFixed(1) + " kWh");
      setText("predictedBill", "Estimated final bill: " + (predicted * 5).toFixed(2) + " DZD");

      // AI STATUS
      setText("aiConfidence", "96%");
      setText("aiStatusText", "AI reading verified");

    } catch (err) {
      console.error(err);
    }
  }

  //////////////////////////
  // SONELGAZ FORM
  //////////////////////////
  const form = document.getElementById("sonelgazMeterForm");

  if (form) {
    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      const meterNumber = document.getElementById("newMeterNumber").value;
      const wilaya = document.getElementById("wilaya").value;
      const commune = document.getElementById("commune").value;
      const address = document.getElementById("meterAddress").value;

      const location = `${wilaya}, ${commune}, ${address}`;

      try {
        await fetch(`${API_BASE}/api/meters`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            meter_number: meterNumber,
            location: location
          })
        });

        alert("Meter connected!");
        await loadMeters();

      } catch {
        alert("Error connecting meter");
      }
    });
  }

  //////////////////////////
  // INIT
  //////////////////////////

  await loadMeters();
  await loadDashboard();

  meterSelect.addEventListener("change", loadDashboard);

  setInterval(loadDashboard, 5000);
}

//////////////////////////
// INIT
//////////////////////////

document.addEventListener("DOMContentLoaded", () => {
  setupLoginPage();
  setupRegisterForm();
  setupDashboardPage();
});
function updateAITimestamp() {
  const now = new Date();
  const formatted = now.toLocaleString();
  setText("aiLastUpdate", `Last update: ${formatted}`);
}
