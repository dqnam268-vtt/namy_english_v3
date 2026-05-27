// ==========================================
// NAMY V3: API COMMUNICATION MODULE
// ==========================================
const API_BASE_URL = window.location.origin + "/api";

// Hàm Fetch đa năng (Tự động bắt lỗi)
async function apiFetch(endpoint, method = "GET", body = null) {
    const options = { 
        method, 
        headers: { "Content-Type": "application/json" } 
    };
    if (body) options.body = JSON.stringify(body);
    
    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
        const data = await response.json();
        return { ok: response.ok, status: response.status, data };
    } catch (error) {
        console.error(`Lỗi API tại ${endpoint}:`, error);
        return { ok: false, data: { detail: "Mất kết nối với máy chủ NamY!" } };
    }
}

// Hàm hiển thị thông báo dùng chung cho toàn hệ thống
function showStatus(element, text, type) {
    if (!element) return;
    element.innerText = text;
    element.className = `message ${type}`;
    element.style.display = "block";
    
    // Tự động ẩn sau 4 giây
    setTimeout(() => { element.style.display = "none"; }, 4000);
}