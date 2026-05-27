// ==========================================
// NAMY V3: STUDENT SYLLABUS RENDER MODULE
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    if (window.location.pathname.includes("/syllabus")) {
        checkAuth("student");
        initSyllabusPage();
        setupFeedback();
    }
});

async function initSyllabusPage() {
    // 1. Phân tích URL để biết đang ở chế độ nào
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode') || 'learning'; // Mặc định là learning nếu mất params
    
    // 2. Đổi giao diện UI dựa theo Mode
    const pageTitle = document.getElementById("syllabus-page-title");
    const bodyTag = document.body;
    
    if (mode === "learning") {
        if(pageTitle) pageTitle.innerHTML = "📚 Không Gian Học Tập (Lý Thuyết & Từ Vựng)";
        bodyTag.classList.add("theme-learning");
    } else {
        if(pageTitle) pageTitle.innerHTML = "✍️ Đấu Trường Luyện Tập (Thực Hành & Nâng Cao)";
        bodyTag.classList.add("theme-practice");
    }

    // 3. Gọi API lấy dữ liệu đã được Backend lọc sẵn
    const container = document.getElementById("course-content-area");
    if(!container) return;
    
    container.innerHTML = '<p style="text-align:center;">Đang tải lộ trình học tập...</p>';
    
    const res = await apiFetch(`/get_syllabus?mode=${mode}`);
    if (res.ok) {
        renderSyllabusHTML(res.data, container);
    } else {
        container.innerHTML = '<p style="color:red; text-align:center;">Không thể tải dữ liệu. Vui lòng thử lại sau.</p>';
    }
}

function renderSyllabusHTML(weeksData, container) {
    if (weeksData.length === 0) {
        container.innerHTML = "<div class='empty-state'>Chưa có bài học nào được thiết lập cho phân hệ này.</div>";
        return;
    }
    
    container.innerHTML = "";
    weeksData.forEach(week => {
        const sec = document.createElement("div");
        sec.className = "week-card";
        sec.innerHTML = `<div class="week-header">⭐ ${week.title}</div>`;
        
        const exeList = document.createElement("div");
        exeList.className = "exercise-list";

        week.exercises.forEach(exe => {
            const btn = document.createElement("button");
            btn.className = "exercise-btn";
            btn.innerHTML = `<span>${exe.title}</span> <span class="badge">${exe.activities.length} tasks</span>`;
            
            btn.onclick = () => {
                let actList = exe.activities.map(a => `- ${a.type}`).join("\n");
                alert(`📖 Mở Bài: ${exe.title}\n\nNhiệm vụ của em:\n${actList || "Chưa có nhiệm vụ"}`);
            };
            exeList.appendChild(btn);
        });

        sec.appendChild(exeList);
        container.appendChild(sec);
    });
}

function setupFeedback() {
    const feedbackBtn = document.getElementById("feedback-btn");
    if (feedbackBtn) {
        feedbackBtn.addEventListener("click", async () => {
            const userMsg = prompt("🎓 Em có thắc mắc gì? Hãy nhập câu hỏi để gửi Thầy:");
            if (userMsg && userMsg.trim() !== "") {
                const userId = localStorage.getItem("user_id") || 0;
                const urlParams = new URLSearchParams(window.location.search);
                const modeName = urlParams.get('mode') === "learning" ? "Phân hệ Học Tập" : "Phân hệ Luyện Tập";

                const res = await apiFetch("/send_feedback", "POST", {
                    message: userMsg,
                    location: modeName,
                    user_id: parseInt(userId)
                });

                if (res.ok) alert("🎉 Đã gửi thắc mắc thành công!");
                else alert("Lỗi khi gửi, vui lòng thử lại!");
            }
        });
    }
}