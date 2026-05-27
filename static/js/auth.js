// ==========================================
// NAMY V3: AUTHENTICATION & ROUTING MODULE
// ==========================================

function checkAuth(requiredRole) {
    const role = localStorage.getItem("user_role");
    const userId = localStorage.getItem("user_id");

    if (!userId || !role || (requiredRole && role !== requiredRole)) {
        alert("⚠️ Vui lòng đăng nhập đúng quyền tài khoản để truy cập khu vực này!");
        window.location.href = "/";
    }
}

function setupLogoutButton() {
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.clear();
            window.location.href = "/";
        });
    }
}

function initLoginPage() {
    const loginBtn = document.getElementById("login-btn");
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const errorMsg = document.getElementById("login-error");

    // Tự động chuyển hướng nếu đã đăng nhập từ trước
    const savedRole = localStorage.getItem("user_role");
    if (savedRole === "admin") window.location.href = "/admin";
    if (savedRole === "student") window.location.href = "/portal";

    if (loginBtn) {
        loginBtn.addEventListener("click", async () => {
            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();

            if (!username || !password) {
                showStatus(errorMsg, "Vui lòng nhập đầy đủ tài khoản và mật khẩu!", "error");
                return;
            }

            loginBtn.innerText = "Đang kết nối...";
            loginBtn.disabled = true;

            const res = await apiFetch("/login", "POST", { username, password });

            if (res.ok && res.data.status === "success") {
                localStorage.setItem("user_id", res.data.user_id);
                localStorage.setItem("user_role", res.data.role);
                localStorage.setItem("username", res.data.username);

                // Chuyển hướng phân luồng V3
                window.location.href = res.data.role === "admin" ? "/admin" : "/portal";
            } else {
                showStatus(errorMsg, res.data.detail || "Sai thông tin đăng nhập!", "error");
                loginBtn.innerText = "Vào Học";
                loginBtn.disabled = false;
            }
        });
    }
}

// Lắng nghe URL để kích hoạt logic tương ứng
document.addEventListener("DOMContentLoaded", () => {
    const currentPath = window.location.pathname;
    if (currentPath === "/" || currentPath === "/index.html") initLoginPage();
    setupLogoutButton();
});