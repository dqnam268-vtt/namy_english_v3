// ==========================================
// NAMY V3: PORTAL MODULE (STUDENT INTERFACE + PROGRESS ENGINE)
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    try {
        if (window.location.pathname.includes("/portal")) {
            if (typeof checkAuth === "function") checkAuth("student");
            
            const studentName = localStorage.getItem("username") || "Em";
            const nameEl = document.getElementById("student-name");
            if (nameEl) nameEl.innerText = "Xin chào, " + studentName + "!";
            
            loadStudentSyllabus();
        }
    } catch (err) {
        console.error("Lỗi khởi tạo:", err);
        const container = document.getElementById("syllabus-container");
        if (container) container.innerHTML = `<p style="color:red; text-align:center; font-weight:bold;">Lỗi giao diện: ${err.message}</p>`;
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
            container.innerHTML = `<p style="color:red; text-align:center;">Lỗi kết nối API: ${res.status}</p>`;
        }
    } catch (error) {
        console.error("Lỗi tải dữ liệu:", error);
        container.innerHTML = `<p style="color:red; text-align:center;">Mất kết nối máy chủ hoặc lỗi xử lý: ${error.message}</p>`;
    }
}

function renderSyllabus(syllabusData, container) {
    if (!syllabusData || syllabusData.length === 0) {
        container.innerHTML = `<p style="text-align:center; color: #64748b; font-size: 1.2rem;">Thầy chưa mở khóa bài học nào.</p>`;
        return;
    }

    let html = "";
    syllabusData.forEach(topic => {
        html += `<div class="topic-card">
            <h2 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-top:0;">⭐ ${topic.title}</h2>
            <div style="display: flex; flex-wrap: wrap; margin-top: 15px;">`;
        
        if (topic.exercises && topic.exercises.length > 0) {
            
            // SẮP XẾP CHUẨN LỘ TRÌNH
            topic.exercises.sort((a, b) => {
                if (a.module_type !== b.module_type) {
                    return a.module_type === 'learning' ? -1 : 1; 
                }
                return a.title.localeCompare(b.title, undefined, {numeric: true, sensitivity: 'base'}); 
            });

            const uniqueExercises = [];
            const titlesSeen = new Set();
            for (let exe of topic.exercises) {
                if (!titlesSeen.has(exe.title)) {
                    titlesSeen.add(exe.title);
                    uniqueExercises.push(exe);
                }
            }

            uniqueExercises.forEach(exe => {
                const btnClass = exe.module_type === "learning" ? "exe-learning" : "exe-practice";
                const exeDataStr = encodeURIComponent(JSON.stringify(exe)).replace(/'/g, "%27");
                
                let progressPercent = 0;
                let progressText = "Chưa học";
                let barClass = "progress-learning-bar";

                // ĐO TIẾN ĐỘ PHẦN LÝ THUYẾT (LEARNING)
                if (exe.module_type === "learning") {
                    const isCompleted = localStorage.getItem(`namy_theory_${exe.id}`);
                    if (isCompleted === "completed") {
                        progressPercent = 100;
                        progressText = "🚀 Đã học xong (100%)";
                    } else {
                        progressPercent = 0;
                        progressText = "⏳ Chưa hoàn thành";
                    }
                    barClass = "progress-learning-bar";
                } 
                // ĐO TIẾN ĐỘ PHẦN BÀI TẬP (PRACTICE)
                else {
                    barClass = "progress-practice-bar";
                    const savedProgress = localStorage.getItem(`namy_progress_${exe.id}`);
                    if (savedProgress) {
                        const parsed = JSON.parse(savedProgress);
                        const totalQ = parsed.total || (exe.activities ? exe.activities.length : 1);
                        
                        // Tính toán tỉ lệ hoàn thành dựa trên số câu đã làm qua
                        progressPercent = Math.round((parsed.qIndex / totalQ) * 100);
                        if (progressPercent > 100) progressPercent = 100;

                        if (parsed.isCompleted) {
                            progressText = `✅ Đúng: ${parsed.score}/${totalQ} câu (100%)`;
                        } else {
                            progressText = `📝 Đang làm: Câu ${parsed.qIndex}/${totalQ} (${progressPercent}%)`;
                        }
                    } else {
                        const totalQ = exe.activities ? exe.activities.length : 0;
                        progressText = `✍️ Làm Bài tập (${totalQ} câu)`;
                    }
                }
                
                html += `
                    <div class="exe-btn ${btnClass}" onclick="openExercise('${exeDataStr}')">
                        <span style="font-size: 1.05rem; color: #1e293b; display: inline-block; min-height: 44px; line-height: 1.4;">${exe.title}</span>
                        
                        <div class="mini-progress-container">
                            <div class="mini-progress-bar ${barClass}" style="width: ${progressPercent}%;"></div>
                        </div>
                        <span class="mini-progress-text">${progressText}</span>
                    </div>
                `;
            });
        } else {
            html += `<p style="color: #94a3b8; font-style: italic; padding-left: 8px;">Chuyên đề này đang được biên soạn...</p>`;
        }
        html += `</div></div>`;
    });
    
    container.innerHTML = html;
}

// BIẾN TOÀN CỤC CHO BÀI TẬP VÀ TIẾN ĐỘ
let currentPracticeActs = [];
let currentQIndex = 0;
let currentScore = 0;
let currentExeId = null; 

window.openExercise = function(encodedData) {
    try {
        const exe = JSON.parse(decodeURIComponent(encodedData));
        currentExeId = exe.id; 
        
        if (exe.module_type === "learning") {
            document.getElementById("learning-title").innerText = exe.title;
            const contentDiv = document.getElementById("learning-content");
            contentDiv.innerHTML = ""; 

            let hasContent = false;
            exe.activities.forEach(act => {
                const type = act.type || act.activity_type; 
                if (type === "Học Từ Vựng (Vocabulary)" || (act.content && act.content.word)) {
                    hasContent = true;
                    contentDiv.innerHTML += `
                        <div class="theory-card">
                            <div class="theory-title">📌 ${act.content.word || ""}</div>
                            <div class="theory-desc">${act.content.meaning || ""}</div>
                        </div>
                    `;
                }
            });

            if (!hasContent) contentDiv.innerHTML = `<p style="text-align:center;">Nội dung lý thuyết đang được cập nhật.</p>`;
            
            // Cài đặt sự kiện hoàn thành bài học lý thuyết
            const finishBtn = document.getElementById("btn-finish-theory");
            if (finishBtn) {
                finishBtn.onclick = () => {
                    localStorage.setItem(`namy_theory_${currentExeId}`, "completed");
                    document.getElementById("learning-modal").style.display = "none";
                    loadStudentSyllabus(); // Tải lại cây thư mục để cập nhật thanh tiến độ lập tức
                };
            }

            document.getElementById("learning-modal").style.display = "flex";
            
        } else {
            currentPracticeActs = exe.activities;
            
            // KHÔI PHỤC TIẾN ĐỘ ĐANG LÀM DỞ TỪ LOCALSTORAGE
            const savedProgress = localStorage.getItem(`namy_progress_${currentExeId}`);
            if (savedProgress) {
                const parsed = JSON.parse(savedProgress);
                currentQIndex = parsed.qIndex;
                currentScore = parsed.score;
            } else {
                currentQIndex = 0;
                currentScore = 0;
            }

            document.getElementById("practice-title").innerHTML = `${exe.title} <button onclick="restartExercise()" style="float:right; font-size:0.9rem; padding: 6px 12px; cursor:pointer; border-radius:8px; border:1px solid #cbd5e1; background:#f1f5f9; color:#475569; font-weight:bold; transition: 0.2s;">🔄 Làm lại từ đầu</button>`;
            document.getElementById("practice-modal").style.display = "flex";
            renderCurrentQuestion();
        }
    } catch (error) {
        alert("⚠️ Lỗi phân tích dữ liệu bài học. Mã lỗi: " + error.message);
    }
};

// HÀM GHI ĐÈ KHI LÀM LẠI BÀI TẬP (RESET TIẾN ĐỘ VỀ 0)
window.restartExercise = function() {
    if (confirm("Em có chắc chắn muốn làm lại từ đầu không? Điểm số cũ sẽ được ghi đè bằng kết quả mới.")) {
        currentQIndex = 0;
        currentScore = 0;
        
        // Lưu đè dữ liệu rỗng lên thay vì xóa hẳn để giữ trạng thái bắt đầu lại
        localStorage.setItem(`namy_progress_${currentExeId}`, JSON.stringify({
            qIndex: 0,
            score: 0,
            total: currentPracticeActs.length,
            isCompleted: false
        }));
        
        renderCurrentQuestion();
    }
};

function renderCurrentQuestion() {
    const container = document.getElementById("practice-content");
    const feedback = document.getElementById("practice-feedback");
    const btnCheck = document.getElementById("btn-check-q");
    const btnNext = document.getElementById("btn-next-q");

    feedback.innerHTML = "";
    btnNext.style.display = "none";
    
    if (currentQIndex >= currentPracticeActs.length) {
        container.innerHTML = `<div style="text-align:center; padding: 20px;">
            <h3 style="color:#059669; font-size: 1.8rem;">🎉 Chúc mừng em đã hoàn thành!</h3>
            <p style="font-size:1.3rem;">Điểm số cuối cùng: <b style="color:#dc2626;">${currentScore} / ${currentPracticeActs.length}</b></p>
            <button class="btn btn-primary" onclick="restartExercise()" style="margin-top:20px; font-size: 1.1rem; padding: 10px 20px;">🔄 Làm Lại Bài Này</button>
            </div>`;
        btnCheck.style.display = "none";
        
        // GHI ĐÈ VÀ LƯU VĨNH VIỄN ĐIỂM SỐ CHÍNH XÁC KHI HOÀN THÀNH
        if (currentExeId) {
            localStorage.setItem(`namy_progress_${currentExeId}`, JSON.stringify({
                qIndex: currentPracticeActs.length,
                score: currentScore,
                total: currentPracticeActs.length,
                isCompleted: true
            }));
        }
        
        loadStudentSyllabus(); // Cập nhật thanh tiến độ đồ họa ngoài giao diện
        return;
    }

    btnCheck.style.display = "block";
    btnCheck.disabled = false;

    const act = currentPracticeActs[currentQIndex];
    const content = act.content || {};
    const type = act.type || act.activity_type || "Bài tập";

    let html = `<div style="margin-bottom: 15px;">
        <span style="background:#e0f2fe; color:#0284c7; padding: 5px 12px; border-radius: 12px; font-size: 0.85rem; font-weight:bold;">Câu ${currentQIndex + 1} / ${currentPracticeActs.length} - ${type}</span>
    </div>`;

    if (content.options && Array.isArray(content.options)) {
        html += `<div style="font-size: 1.15rem; font-weight: 600; margin-bottom: 20px; color:#1e293b; line-height: 1.5;">${content.question || ""}</div>`;
        html += `<div style="display:flex; flex-direction:column; gap: 10px;">`;
        content.options.forEach((opt) => {
            html += `<label class="opt-label" style="padding: 12px 15px; border: 1px solid #cbd5e1; border-radius: 8px; cursor: pointer; transition: 0.2s;">
                <input type="radio" name="q_opt" value="${opt.replace(/"/g, '&quot;')}" style="margin-right: 10px;"> ${opt}
            </label>`;
        });
        html += `</div>`;
    } else {
        let promptText = content.question || content.original || "";
        let hintHtml = content.keyword ? `<div style="margin-top:10px; font-weight:bold; color:#dc2626;">TỪ KHÓA BẮT BUỘC: [ ${content.keyword} ]</div>` : "";
        
        html += `<div style="font-size: 1.15rem; font-weight: 600; margin-bottom: 10px; color:#1e293b; line-height: 1.5;">${promptText}</div>`;
        html += hintHtml;
        html += `<div style="margin-top: 20px;">
            <input type="text" id="q_text_input" placeholder="Nhập câu trả lời của em vào đây..." style="width:100%; padding: 15px; border: 2px solid #94a3b8; border-radius: 8px; font-size: 1.1rem;">
        </div>`;
    }

    container.innerHTML = html;
}

window.checkAnswer = function() {
    const act = currentPracticeActs[currentQIndex];
    const content = act.content || {};
    const feedback = document.getElementById("practice-feedback");
    const btnCheck = document.getElementById("btn-check-q");
    const btnNext = document.getElementById("btn-next-q");

    let userAnswer = "";
    
    if (content.options && Array.isArray(content.options)) {
        const selected = document.querySelector('input[name="q_opt"]:checked');
        if (!selected) {
            alert("Em chưa chọn đáp án nào!");
            return;
        }
        userAnswer = selected.value;
    } else {
        const inputEl = document.getElementById("q_text_input");
        if (!inputEl) return;
        if (!inputEl.value.trim()) {
            alert("Em chưa nhập câu trả lời!");
            return;
        }
        userAnswer = inputEl.value.trim();
    }

    const isCorrect = userAnswer.toLowerCase().trim() === (content.answer || "").toLowerCase().trim();

    if (isCorrect) {
        feedback.innerHTML = `<span style="color:#16a34a;">✅ Chính xác! Giỏi lắm!</span>`;
        currentScore++;
    } else {
        feedback.innerHTML = `<span style="color:#dc2626;">❌ Sai rồi. Đáp án đúng là:<br><span style="color:#1e3a8a; font-weight:normal;">${content.answer || ""}</span></span>`;
    }

    btnCheck.style.display = "none";
    btnNext.style.display = "block";
};

window.nextQuestion = function() {
    currentQIndex++;
    
    // GHI NHỚ TIẾN ĐỘ TẠM THỜI QUA TỪNG CÂU HỎI
    if (currentExeId) {
        localStorage.setItem(`namy_progress_${currentExeId}`, JSON.stringify({
            qIndex: currentQIndex,
            score: currentScore,
            total: currentPracticeActs.length,
            isCompleted: false
        }));
    }
    
    renderCurrentQuestion();
};