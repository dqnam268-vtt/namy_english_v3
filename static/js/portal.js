// ==========================================
// NAMY V3: PORTAL MODULE (STUDENT INTERFACE)
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    if (window.location.pathname.includes("/portal")) {
        checkAuth("student");
        
        const studentName = localStorage.getItem("username") || "Em";
        document.getElementById("student-name").innerText = "Xin chào, " + studentName + "!";
        
        loadStudentSyllabus();
    }
});

async function loadStudentSyllabus() {
    const container = document.getElementById("syllabus-container");
    
    try {
        const res = await fetch("/api/get_syllabus");
        if (res.ok) {
            const data = await res.json();
            renderSyllabus(data, container);
        } else {
            container.innerHTML = `<p style="color:red; text-align:center;">Không thể tải lộ trình. Vui lòng báo cáo Thầy Nam!</p>`;
        }
    } catch (error) {
        container.innerHTML = `<p style="color:red; text-align:center;">Lỗi kết nối máy chủ!</p>`;
    }
}

function renderSyllabus(syllabusData, container) {
    if (!syllabusData || syllabusData.length === 0) {
        container.innerHTML = `<p style="text-align:center; color: #64748b; font-size: 1.2rem;">Thầy Nam chưa mở khóa bài học nào.</p>`;
        return;
    }

    let html = "";
    syllabusData.forEach(topic => {
        html += `
            <div class="topic-card">
                <h2 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-top:0;">⭐ ${topic.title}</h2>
                <div style="margin-top: 15px;">
        `;
        
        if (topic.exercises && topic.exercises.length > 0) {
            topic.exercises.forEach(exe => {
                // Phân loại nhãn dán: Lý thuyết (Xanh) - Luyện tập (Cam)
                const badge = exe.module_type === "learning" ? "📖 Học Lý thuyết" : "✍️ Làm Bài tập";
                const btnClass = exe.module_type === "learning" ? "exe-learning" : "exe-practice";
                
                // Mã hóa toàn bộ dữ liệu bài học để nhúng vào nút bấm
                const exeDataStr = encodeURIComponent(JSON.stringify(exe));
                
                html += `
                    <div class="exe-btn ${btnClass}" onclick="openExercise('${exeDataStr}')">
                        <span style="color: #64748b; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.5px;">${badge}</span><br>
                        <span style="font-size: 1.1rem; color: #1e293b; display: inline-block; margin-top: 5px;">${exe.title}</span>
                    </div>
                `;
            });
        } else {
            html += `<p style="color: #94a3b8; font-style: italic;">Chuyên đề này đang được Thầy biên soạn...</p>`;
        }
        
        html += `</div></div>`;
    });
    
    container.innerHTML = html;
}

// HÀM MỞ KHÔNG GIAN HỌC/LUYỆN TẬP
window.openExercise = function(encodedData) {
    const exe = JSON.parse(decodeURIComponent(encodedData));
    
    if (exe.module_type === "learning") {
        // --- CHẾ ĐỘ 1: HIỂN THỊ LÝ THUYẾT (FLASHCARDS) ---
        document.getElementById("learning-title").innerText = exe.title;
        const contentDiv = document.getElementById("learning-content");
        contentDiv.innerHTML = ""; // Xóa dữ liệu cũ

        let hasContent = false;
        
        exe.activities.forEach(act => {
            // Nhận diện thẻ từ vựng/lý thuyết
            const type = act.type || act.activity_type; 
            if (type === "Học Từ Vựng (Vocabulary)") {
                hasContent = true;
                const word = act.content.word || "";
                const meaning = act.content.meaning || "";

                // Bơm thẻ HTML
                contentDiv.innerHTML += `
                    <div class="theory-card">
                        <div class="theory-title">📌 ${word}</div>
                        <div class="theory-desc">${meaning}</div>
                    </div>
                `;
            }
        });

        if (!hasContent) {
            contentDiv.innerHTML = `<p style="text-align:center; color:#64748b; font-style: italic; margin-top: 20px;">Nội dung lý thuyết đang được cập nhật.</p>`;
        }

        // Bật lớp phủ Modal lên
        document.getElementById("learning-modal").style.display = "flex";
        
    } else {
        // --- CHẾ ĐỘ 2: ĐẤU TRƯỜNG LUYỆN TẬP ---
        alert("🛠️ Tính năng Đấu Trường Luyện Tập (Trắc nghiệm, Viết lại câu) đang được Thầy Nam xây dựng UI chấm điểm! Sẽ có mặt trong phiên bản tiếp theo.");
    }
};