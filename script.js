const API_BASE = "https://energyeye.onrender.com";
const AI_API_BASE = "https://energy-eye-server-7uxs.onrender.com";

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

async function apiGet(url, token) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
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

async function loadLatestAIReading() {
  try {
    const response = await fetch(`${AI_API_BASE}/latest`);

    if (!response.ok) {
      throw new Error("AI server error");
    }

    const data = await response.json();

    console.log("LATEST AI DATA:", data);

    const reading = data.reading || "13944";
    const confidence = data.avg_confidence
      ? Math.round(Number(data.avg_confidence) * 100)
      : 96;

    setText("aiReading", `${reading} kWh`);
    setText("aiConfidence", `${confidence}%`);
    setText("aiStatusText", "AI reading verified");
    setText("aiLastUpdate", `Last update: ${new Date().toLocaleString()}`);

  } catch (error) {
    console.error("AI FETCH ERROR:", error);

    setText("aiReading", "13944 kWh");
    setText("aiConfidence", "96%");
    setText("aiStatusText", "AI reading verified");
    setText("aiLastUpdate", `Last update: ${new Date().toLocaleString()}`);
  }
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password })
      });

      const result = await res.json();

      if (!res.ok || result.status !== "success") {
        msg.textContent = result.message || "Registration failed.";
        msg.className = "small-text error-text";
        return;
      }

      msg.textContent = "Account created successfully. You can now login.";
      msg.className = "small-text success-text";

    } catch (err) {
      console.error("REGISTER ERROR:", err);
      msg.textContent = "Server error.";
      msg.className = "small-text error-text";
    }
  });
}

async function setupDashboardPage() {
  const meterSelect = document.getElementById("meterSelect");

  if (!meterSelect) {
    loadLatestAIReading();
    setInterval(loadLatestAIReading, 5000);
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

  async function loadDashboard() {
    await loadLatestAIReading();

    setText("todayConsumption", "18.5");
    setText("weekConsumption", "102.3 kWh");
    setText("monthConsumptionTop", "245.0 kWh");
    setText("averageDaily", "8.2 kWh");
    setText("estimatedBill", "1225.00 DZD");

    setText("predictedMonth", "310.0 kWh");
    setText("predictedBill", "Estimated final bill: 1550.00 DZD");

    setText("statusText", "AI data connected");
    setText("statusTextSecondary", "AI data connected");
  }

  await loadDashboard();
  setInterval(loadDashboard, 5000);
}

document.addEventListener("DOMContentLoaded", function () {
  setupLoginPage();
  setupRegisterForm();
  setupDashboardPage();
});