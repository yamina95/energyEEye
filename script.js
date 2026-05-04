const API_BASE = "https://energyeye.onrender.com";
const AI_API_BASE = "https://energy-eye-server-7uxs.onrender.com";

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function forgotPassword() {
  alert("Password reset is not available yet.");
}

// ================= LOGIN =================
function setupLoginPage() {
  const form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value.trim();
    const msg = document.getElementById("loginMessage");

    msg.textContent = "";

    try {
      const res = await fetch(`${API_BASE}/api/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();

      if (!res.ok || data.status !== "success") {
        msg.textContent = data.message || "Login failed";
        return;
      }

      localStorage.setItem("energyeye_token", data.data.token);
      localStorage.setItem("energyeye_user_name", data.data.user_name || username);

      window.location.href = "dashboard.html";

    } catch (err) {
      msg.textContent = "Server error";
      console.error(err);
    }
  });
}

// ================= DASHBOARD =================
function setupDashboardPage() {
  const token = localStorage.getItem("energyeye_token");
  if (!token) return;

  const user = localStorage.getItem("energyeye_user_name") || "User";
  setText("welcomeName", `Welcome, ${user}`);

  async function loadData() {
    try {
      const res = await fetch(`${API_BASE}/api/meters`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      console.log("Meters:", data);

    } catch (err) {
      console.error("Dashboard error:", err);
    }
  }

  loadData();
  setInterval(loadData, 5000);
}

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {
  setupLoginPage();
  setupDashboardPage();
});
