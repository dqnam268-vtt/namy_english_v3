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
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode') || 'learning'; 
    
    const pageTitle = document.getElementById("syllabus-page-title");
    const bodyTag = document.body;
    
    if (mode === "learning") {
        if(pageTitle) pageTitle.innerHTML = "📚 Không Gian Học Tập (Lý Thuyết & Từ Vựng)";
        bodyTag.classList.add("theme-learning");
    } else {
        if(pageTitle) pageTitle.innerHTML = "✍️ Đấu Trường Luyện Tập (Thực Hành & Nâng Cao)";
        bodyTag.classList.add("theme-practice");
    }

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

function renderSyllabusHTML(topicsData, container) {
    if (topicsData.length === 0) {
        container.innerHTML = "<div class='empty-state'>Chưa có bài học nào được thiết lập cho phân hệ này.</div>";
        return;
    }
    
    container.innerHTML = "";
    topicsData.forEach(topic => {
        const sec = document.createElement("div");
        // CSS đã được đổi thành topic thay vì week
        sec.className = "topic-card"; 
        sec.innerHTML = `<div class="topic-header">⭐ ${topic.title}</div>`; 
        
        const exeList = document.createElement("div");
        exeList.className = "exercise-list";

        topic.exercises.forEach(exe => {
            const btn = document.createElement("button");
            btn.className = "exercise-btn";
            btn.innerHTML = `<span>${exe.title}</span> <span class="badge">${exe.activities.length} nhiệm vụ</span>`;
            
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

// Hàm Feedback giữ nguyên 100% logic
function setupFeedback() {
    const feedbackBtn = document.getElementById("feedback-btn");
    if (feedbackBtn) {
        feedbackBtn.addEventListener("click", async () => {
            const userMsg = prompt("🎓 Em có thắc mắc gì? Hãy nhập câu hỏi để gửi Thầy Nam:");
            if (userMsg && userMsg.trim() !== "") {
                const userId = localStorage.getItem("user_id") || 0;
                const urlParams = new URLSearchParams(window.location.search);
                // Hệ thống tự nhận diện học sinh đang hỏi từ phân hệ nào
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