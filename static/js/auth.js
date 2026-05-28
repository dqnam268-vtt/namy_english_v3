// ==========================================
// NAMY V3: AUTHENTICATION & ROUTING MODULE (FIXED)
// ==========================================

function checkAuth(requiredRole) {
    // Quét cả 2 định dạng tên biến để tránh lỗi đồng bộ
    const role = localStorage.getItem("user_role") || localStorage.getItem("role");
    const userId = localStorage.getItem("user_id");

    // Chặn lỗi chuỗi "undefined" hoặc "null"
    if (!userId || !role || role === "undefined" || role === "null") {
        alert("⚠️ Phiên đăng nhập không hợp lệ hoặc đã hết hạn! Vui lòng đăng nhập lại.");
        localStorage.clear();
        window.location.href = "/";
        return;
    }

    // Chặn sai quyền (VD: Học sinh cố vào trang Admin)
    if (requiredRole && role !== requiredRole) {
        alert("⚠️ Vui lòng đăng nhập đúng quyền tài khoản để truy cập khu vực này!");
        window.location.href = "/";
        return;
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

    // Tự động chuyển hướng nếu đã đăng nhập chuẩn
    const savedRole = localStorage.getItem("user_role") || localStorage.getItem("role");
    if (savedRole === "admin") window.location.href = "/admin";
    else if (savedRole === "student") window.location.href = "/portal";

    if (loginBtn) {
        loginBtn.addEventListener("click", async () => {
            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();

            if (!username || !password) {
                if (errorMsg) {
                    errorMsg.innerText = "⚠️ Vui lòng nhập đầy đủ tài khoản và mật khẩu!";
                    errorMsg.style.display = "block";
                }
                return;
            }

            loginBtn.innerText = "Đang xác thực...";
            loginBtn.disabled = true;

            try {
                // Gọi thẳng API thay vì dùng apiFetch để dễ bắt lỗi
                const res = await fetch("/api/login", {
                    method: "POST",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({ username, password })
                });
                const data = await res.json();

                if (res.ok && data.status === "success") {
                    // Lưu đồng thời cả 2 tên biến cho chắc chắn
                    localStorage.setItem("user_id", data.user_id);
                    localStorage.setItem("role", data.role);
                    localStorage.setItem("user_role", data.role);
                    localStorage.setItem("username", data.username);

                    // Chuyển hướng
                    window.location.href = data.role === "admin" ? "/admin" : "/portal";
                } else {
                    if (errorMsg) {
                        errorMsg.innerText = "❌ " + (data.detail || "Sai thông tin đăng nhập!");
                        errorMsg.style.display = "block";
                    }
                    loginBtn.innerText = "Vào Lớp Học";
                    loginBtn.disabled = false;
                }
            } catch (err) {
                if (errorMsg) {
                    errorMsg.innerText = "❌ Không thể kết nối tới máy chủ!";
                    errorMsg.style.display = "block";
                }
                loginBtn.innerText = "Vào Lớp Học";
                loginBtn.disabled = false;
            }
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const currentPath = window.location.pathname;
    if (currentPath === "/" || currentPath === "/index.html") initLoginPage();
    setupLogoutButton();
});