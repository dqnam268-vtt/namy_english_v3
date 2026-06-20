// ==========================================
// NAMY V3: ADMIN CMS MODULE (VISUAL BAR CHART & SPLIT PROGRESS)
// ==========================================

let currentSyllabusData = [];

document.addEventListener("DOMContentLoaded", () => {
    if (window.location.pathname.includes("/admin")) {
        checkAuth("admin");
        const adminNameSpan = document.getElementById("admin-name");
        if (adminNameSpan) adminNameSpan.innerText = "Thầy " + (localStorage.getItem("username") || "Nam");

        initAdminDashboard();
        initAdminCMS();
    }
});

window.switchTab = function(tabId) {
    document.querySelectorAll('.cms-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.target.classList.add('active');
    if(tabId === 'tab-preview') updateLivePreview();
};

async function initAdminDashboard() {
    fetchStats();
    fetchFeedbacks();

    const exportBtn = document.getElementById("btn-export-excel");
    if (exportBtn) {
        exportBtn.addEventListener("click", () => {
            const rows = document.querySelectorAll("table tr");
            let csv = [];
            for (let i = 0; i < rows.length; i++) {
                let row = [], cols = rows[i].querySelectorAll("td, th");
                let limit = cols.length >= 4 ? 3 : cols.length; 
                for (let j = 0; j < limit; j++) {
                    let cellText = cols[j].innerText.replace(/\n/g, ' | ').replace(/%/g, '% ');
                    row.push('"' + cellText + '"');
                }
                csv.push(row.join(","));
            }
            const csvFile = new Blob(["\uFEFF" + csv.join("\n")], { type: "text/csv;charset=utf-8;" });
            const a = document.createElement("a");
            a.download = "Bao_Cao_Tien_Do.csv";
            a.href = window.URL.createObjectURL(csvFile);
            a.click();
        });
    }
}

async function fetchStats() {
    const sRes = await apiFetch("/stats");
    if (sRes.ok) {
        document.getElementById("stat-students").innerText = sRes.data.total_students;
        const statTopics = document.getElementById("stat-topics") || document.getElementById("stat-weeks");
        if(statTopics) statTopics.innerText = sRes.data.total_topics;
        document.getElementById("stat-feedbacks").innerText = sRes.data.total_feedbacks;
    }

    const uRes = await apiFetch("/users");
    if (uRes.ok) {
        const thead = document.querySelector("table thead tr");
        if (thead) {
            thead.innerHTML = `
                <th style="padding: 12px; border-bottom: 2px solid #cbd5e1; text-align: left; width: 20%;">Tài Khoản</th>
                <th style="padding: 12px; border-bottom: 2px solid #cbd5e1; text-align: left; width: 25%;">📖 Lý Thuyết</th>
                <th style="padding: 12px; border-bottom: 2px solid #cbd5e1; text-align: left; width: 40%;">✍️ Bài Tập & Điểm</th>
                <th style="padding: 12px; border-bottom: 2px solid #cbd5e1; text-align: center;">Thao tác</th>
            `;
        }

        const body = document.querySelector("table tbody");
        if(body) {
            let html = "";
            uRes.data.forEach(u => {
                const detailsStr = encodeURIComponent(JSON.stringify(u.details || []));
                
                let scoresHtml = "";
                if (u.practice_scores && u.practice_scores.length > 0) {
                    scoresHtml = `<div style="margin-top: 8px;">` + 
                        u.practice_scores.map(s => `<span style="background: #fffbeb; color: #b45309; padding: 3px 8px; border-radius: 6px; border: 1px solid #fcd34d; margin-right: 6px; display: inline-block; margin-bottom: 6px; font-weight: 500; font-size: 0.85rem;">${s}</span>`).join("") +
                        `</div>`;
                } else {
                    scoresHtml = `<div style="margin-top: 8px; font-size: 0.85rem; color: #94a3b8; font-style: italic;">Chưa phát sinh điểm bài tập</div>`;
                }

                html += `<tr>
                    <td style="padding: 15px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b; vertical-align: top;">${u.username}</td>
                    
                    <td style="padding: 15px; border-bottom: 1px solid #e2e8f0; vertical-align: top;">
                        <div style="background: #e0f2fe; border-radius: 10px; width: 100%; height: 8px; margin-bottom: 5px; overflow: hidden;">
                            <div style="background: #0284c7; height: 100%; width: ${u.theory_pct}%;"></div>
                        </div>
                        <span style="color: #0284c7; font-weight: bold; font-size: 1.1rem;">${u.theory_pct}%</span> 
                        <span style="color: #64748b; font-size: 0.85rem;">(${u.theory_text})</span>
                    </td>
                    
                    <td style="padding: 15px; border-bottom: 1px solid #e2e8f0; vertical-align: top;">
                        <div style="background: #dcfce3; border-radius: 10px; width: 100%; height: 8px; margin-bottom: 5px; overflow: hidden;">
                            <div style="background: #16a34a; height: 100%; width: ${u.practice_pct}%;"></div>
                        </div>
                        <span style="color: #16a34a; font-weight: bold; font-size: 1.1rem;">${u.practice_pct}%</span>
                        <span style="color: #64748b; font-size: 0.85rem;">(${u.practice_text})</span>
                        ${scoresHtml}
                    </td>
                    
                    <td style="padding: 15px; border-bottom: 1px solid #e2e8f0; text-align: center; vertical-align: top;">
                        <button onclick="showStudentDetails('${u.username}', '${detailsStr}')" style="background: #3b82f6; color: white; border: none; padding: 8px 15px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; white-space: nowrap;">🔍 Xem biểu đồ</button>
                    </td>
                </tr>`;
            });
            body.innerHTML = html;
        }
    }
}

// ==========================================
// TÍNH NĂNG MỚI: VẼ BIỂU ĐỒ BAR CHART CSS
// ==========================================
window.showStudentDetails = function(username, detailsStr) {
    const modalName = document.getElementById("detail-student-name");
    const modalData = document.getElementById("detail-student-data");
    const modalBox = document.getElementById("student-detail-modal");
    
    if (!modalBox) {
        alert("Thiếu HTML Modal chi tiết trong file admin.html."); return;
    }

    modalName.innerHTML = `Biểu đồ Phân tích của: <b style="color:#dc2626;">${username}</b>`;
    const details = JSON.parse(decodeURIComponent(detailsStr));
    let html = "";

    if (!details || details.length === 0) {
        html = "<p style='color: #64748b; font-style: italic; text-align:center;'>Học sinh này chưa tham gia bài học nào.</p>";
    } else {
        // --- 1. CHÚ THÍCH MÀU SẮC (LEGEND) ---
        html += `
        <div style="display: flex; gap: 15px; margin-bottom: 20px; font-size: 0.85rem; justify-content: center; flex-wrap: wrap;">
            <span style="display:flex; align-items:center; gap:5px;"><div style="width:12px; height:12px; background:#94a3b8; border-radius:3px;"></div> Lý thuyết</span>
            <span style="display:flex; align-items:center; gap:5px;"><div style="width:12px; height:12px; background:#22c55e; border-radius:3px;"></div> Tốt (≥ 80%)</span>
            <span style="display:flex; align-items:center; gap:5px;"><div style="width:12px; height:12px; background:#f97316; border-radius:3px;"></div> Khá (50-79%)</span>
            <span style="display:flex; align-items:center; gap:5px;"><div style="width:12px; height:12px; background:#ef4444; border-radius:3px;"></div> Yếu (< 50%)</span>
        </div>`;

        // --- 2. KHUNG BIỂU ĐỒ (CHART CONTAINER) ---
        html += `
        <div style="position: relative; height: 220px; border-left: 2px solid #cbd5e1; border-bottom: 2px solid #cbd5e1; margin-bottom: 120px; margin-left: 30px; display: flex; align-items: flex-end; padding-left: 10px; gap: 15px; overflow-x: auto; padding-top: 20px;">
            
            <!-- Trục Y: Đường gạch đứt báo 50% và 100% -->
            <div style="position: absolute; bottom: 50%; left: 0; width: 100%; border-bottom: 1px dashed #cbd5e1; z-index: 1;">
                <span style="position: absolute; left: -35px; bottom: -8px; font-size: 11px; color: #64748b; font-weight:bold;">50%</span>
            </div>
            <div style="position: absolute; bottom: 100%; left: 0; width: 100%; border-bottom: 1px dashed #cbd5e1; z-index: 1;">
                <span style="position: absolute; left: -42px; bottom: -8px; font-size: 11px; color: #64748b; font-weight:bold;">100%</span>
            </div>
        `;

        // --- 3. VẼ TỪNG CỘT DỮ LIỆU ---
        details.forEach(d => {
            let pct = 0;
            
            // Thuật toán bóc tách điểm (ví dụ: "Đúng 1/8 câu" -> lấy 1 chia 8)
            if (d.type === 'learning') {
                pct = 100;
            } else {
                let match = d.score.match(/(\d+)\/(\d+)/);
                if (match) {
                    let correct = parseInt(match[1]);
                    let total = parseInt(match[2]);
                    pct = total > 0 ? Math.round((correct / total) * 100) : 0;
                }
            }

            // Đổi màu cột cảnh báo
            let barColor = "#94a3b8"; // Xám cho Lý thuyết
            if (d.type === 'practice') {
                if (pct < 50) barColor = "#ef4444"; // Đỏ (Yếu)
                else if (pct < 80) barColor = "#f97316"; // Cam (Khá)
                else barColor = "#22c55e"; // Xanh lá (Tốt)
            }

            // Cắt ngắn tên bài để khỏi dài
            let shortName = d.exercise_name.length > 25 ? d.exercise_name.substring(0, 25) + "..." : d.exercise_name;

            html += `
            <div style="width: 35px; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; position: relative; z-index: 2;">
                <span style="font-size: 11px; font-weight: 800; color: ${barColor}; margin-bottom: 5px;">${pct}%</span>
                
                <div title="${d.exercise_name}: ${pct}%" style="width: 100%; height: ${pct}%; background-color: ${barColor}; border-radius: 4px 4px 0 0; transition: 0.3s; box-shadow: 2px 0 5px rgba(0,0,0,0.1);"></div>
                
                <!-- Tên bài học xoay dọc bên dưới -->
                <div style="position: absolute; top: 100%; left: 50%; writing-mode: vertical-rl; transform: rotate(180deg) translateX(50%); padding-top: 8px; font-size: 11px; color: #475569; height: 110px; text-align: left; white-space: nowrap;">
                    ${shortName}
                </div>
            </div>`;
        });

        html += `</div>`; // Đóng khung biểu đồ

        // --- 4. BẢNG CHI TIẾT (Giữ lại để xem rõ "Đúng 1/8 câu") ---
        html += `<table style="width: 100%; border-collapse: collapse; text-align: left;">
            <tr style="background: #f8fafc;">
                <th style="padding: 12px; border-bottom: 2px solid #cbd5e1; color:#475569;">Tên Bài Học</th>
                <th style="padding: 12px; border-bottom: 2px solid #cbd5e1; color:#475569;">Phân Loại</th>
                <th style="padding: 12px; border-bottom: 2px solid #cbd5e1; color:#475569;">Kết Quả</th>
            </tr>`;
            
        details.forEach(d => {
            const badge = d.type === "learning" ? `<span style="background: #e0f2fe; color: #0284c7; padding: 4px 10px; border-radius: 8px; font-size: 0.85rem; font-weight: bold;">📖 Lý thuyết</span>` : `<span style="background: #dcfce3; color: #16a34a; padding: 4px 10px; border-radius: 8px; font-size: 0.85rem; font-weight: bold;">✍️ Bài tập</span>`;
            
            html += `<tr>
                <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 500;">${d.exercise_name}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${badge}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #ea580c;">${d.score}</td>
            </tr>`;
        });
        html += `</table>`;
    }

    modalData.innerHTML = html;
    modalBox.style.display = "flex";
}

// ... CÁC HÀM CMS BÊN DƯỚI GIỮ NGUYÊN NHƯ CŨ ...
async function fetchFeedbacks() {
    const fRes = await apiFetch("/get_feedbacks");
    const fbList = document.getElementById("feedback-list");
    if (fRes.ok && fbList) {
        fbList.innerHTML = fRes.data.map(f => `<div style="background:#f9f9f9; padding:10px; margin-bottom:8px; border-left:3px solid #2e7d32;"><b>${f.username}</b> <i>(${f.location})</i>: ${f.message}</div>`).join("");
    }
}

function initAdminCMS() {
    loadCmsComboboxes();

    const addExeBtn = document.getElementById("add-exe-btn");
    if (addExeBtn) {
        addExeBtn.addEventListener("click", async () => {
            const selectId = document.getElementById("cms-topic-select") ? "cms-topic-select" : "cms-week-select";
            const topic_order = parseInt(document.getElementById(selectId).value);
            const title = document.getElementById("exe-title").value.trim();
            const moduleType = document.getElementById("exe-module-type") ? document.getElementById("exe-module-type").value : "learning";
            const msg = document.getElementById("exe-message");

            if(!title) return showStatus(msg, "Vui lòng nhập tên bài tập!", "error");

            addExeBtn.disabled = true;
            const res = await apiFetch("/add_exercise", "POST", { title, topic_order: topic_order, order_num: 1, module_type: moduleType });
            
            if (res.ok) {
                showStatus(msg, `✅ ${res.data.message}`, "success");
                document.getElementById("exe-title").value = "";
                loadCmsComboboxes();
            }
            addExeBtn.disabled = false;
        });
    }

    const actTypeSelect = document.getElementById("act-type");
    if (actTypeSelect) {
        actTypeSelect.addEventListener("change", (e) => {
            const type = e.target.value;
            document.getElementById("form-vocab").style.display = type === "vocab" ? "block" : "none";
            document.getElementById("form-quiz").style.display = type === "quiz" ? "block" : "none";
            document.getElementById("form-video").style.display = type === "video" ? "block" : "none";
        });
    }

    const addActBtn = document.getElementById("add-act-btn");
    if (addActBtn) {
        addActBtn.addEventListener("click", async () => {
            const exercise_id = parseInt(document.getElementById("cms-exe-select").value);
            const actType = document.getElementById("act-type").value;
            const msg = document.getElementById("act-message");
            
            if(isNaN(exercise_id)) return showStatus(msg, "Vui lòng tạo/chọn Nhóm bài tập trước!", "error");

            let finalContent = {}; let displayType = "";
            if (actType === "vocab") {
                displayType = "Học Từ Vựng (Vocabulary)";
                finalContent = { word: document.getElementById("vocab-word").value.trim(), meaning: document.getElementById("vocab-meaning").value.trim() };
            } else if (actType === "quiz") {
                displayType = "Luyện Ngữ Pháp (Grammar)";
                finalContent = {
                    question: document.getElementById("quiz-q").value.trim(),
                    options: document.getElementById("quiz-opts").value.split(",").map(s => s.trim()),
                    answer: document.getElementById("quiz-ans").value.trim()
                };
            } else if (actType === "video") {
                displayType = "Phát Âm & Nghe (Phonetics)";
                finalContent = { url: document.getElementById("video-url").value.trim() };
            }

            addActBtn.disabled = true;
            const res = await apiFetch("/add_activity", "POST", { exercise_id, activity_type: displayType, content: finalContent, order_num: 1 });
            
            if (res.ok) { 
                showStatus(msg, "✅ Đã lưu hoạt động thành công!", "success");
                document.querySelectorAll("#dynamic-form-area input").forEach(inp => inp.value = "");
                loadCmsComboboxes();
            }
            addActBtn.disabled = false;
        });
    }

    const btnUploadJson = document.getElementById("btn-upload-json");
    if (btnUploadJson) {
        btnUploadJson.addEventListener("click", async () => {
            const fileInput = document.getElementById("json-upload-file");
            const msg = document.getElementById("json-message");
            
            if (fileInput.files.length === 0) return showStatus(msg, "Vui lòng chọn ít nhất 1 file JSON!", "error");

            btnUploadJson.disabled = true;
            btnUploadJson.innerText = `Đang xử lý ${fileInput.files.length} file...`;
            
            let successCount = 0; let errorCount = 0;

            for (let i = 0; i < fileInput.files.length; i++) {
                const file = fileInput.files[i];
                try {
                    const jsonData = await new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = e => resolve(JSON.parse(e.target.result));
                        reader.onerror = e => reject(e);
                        reader.readAsText(file);
                    });
                    
                    const res = await apiFetch("/upload_json", "POST", jsonData);
                    if (res.ok) successCount++; else errorCount++;
                } catch (error) { errorCount++; }
            }

            if (errorCount === 0) showStatus(msg, `✅ Đã nạp ${successCount} bài tập!`, "success");
            else showStatus(msg, `⚠️ ${successCount} thành công, ${errorCount} lỗi.`, "error");

            fileInput.value = ""; 
            loadCmsComboboxes();  
            btnUploadJson.disabled = false;
            btnUploadJson.innerText = "Tải Lên Hệ Thống";
        });
    }

    const btnDelTopic = document.getElementById("btn-delete-topic");
    if (btnDelTopic) {
        btnDelTopic.addEventListener("click", async () => {
            const delSelect = document.getElementById("delete-topic-select");
            if (!delSelect || !delSelect.value) return;
            
            const topicOrder = delSelect.value;
            const confirmDelete = confirm(`⚠️ THẦY CÓ CHẮC CHẮN MUỐN XÓA TOÀN BỘ DỮ LIỆU CỦA UNIT NÀY KHÔNG?`);
            if (!confirmDelete) return;

            btnDelTopic.disabled = true; btnDelTopic.innerText = "Đang xử lý...";
            try {
                const res = await fetch(`/api/clear_topic/${topicOrder}`, { method: "DELETE" });
                const data = await res.json();
                if (res.ok) { showStatus(document.getElementById("delete-message"), `✅ ${data.message}`, "success"); loadCmsComboboxes(); } 
                else showStatus(document.getElementById("delete-message"), `❌ Lỗi: ${data.detail}`, "error");
            } catch (error) { showStatus(document.getElementById("delete-message"), "❌ Lỗi kết nối", "error"); }
            btnDelTopic.disabled = false; btnDelTopic.innerText = "Xóa Sạch Dữ Liệu";
        });
    }
}

async function loadCmsComboboxes() {
    const selectId = document.getElementById("cms-topic-select") ? "cms-topic-select" : "cms-week-select";
    const topicSelect = document.getElementById(selectId);
    const delSelect = document.getElementById("delete-topic-select"); 
    
    const cpeTopics = ["1. Tenses", "2. Modal Verbs", "3. Infinitive / Gerund", "4. Passive Voice", "5. Reported Speech", "6. Adjectives / Adverbs / Comparisons", "7. Conditionals", "8. Wishes / Unreal Past", "9. Relatives", "10. Nouns", "11. Articles", "12. Causative Form", "13. Clauses", "14. Inversion", "15. Conjunctions / Punctuation"];
    let optionsHtml = "";
    cpeTopics.forEach((title, index) => { optionsHtml += `<option value="${index + 1}">UNIT ${title}</option>`; });

    if (topicSelect && topicSelect.options.length === 0) {
        topicSelect.innerHTML = optionsHtml;
        topicSelect.addEventListener("change", () => populateExerciseCombobox(parseInt(topicSelect.value)));
    }
    if (delSelect && delSelect.options.length === 0) delSelect.innerHTML = optionsHtml;

    const res = await apiFetch("/get_syllabus"); 
    if (res.ok) {
        currentSyllabusData = res.data;
        const selectedTopicOrder = topicSelect ? parseInt(topicSelect.value) : 1;
        populateExerciseCombobox(selectedTopicOrder);
        updateLivePreview();
    }
}

function populateExerciseCombobox(topicOrder) {
    const exeSelect = document.getElementById("cms-exe-select");
    if (!exeSelect) return;
    const targetTopic = currentSyllabusData.find(w => w.order_num === topicOrder);
    if (targetTopic && targetTopic.exercises && targetTopic.exercises.length > 0) {
        exeSelect.innerHTML = targetTopic.exercises.map(e => {
            const badge = e.module_type === "learning" ? "[Học]" : "[Luyện]";
            return `<option value="${e.id}">${badge} ${e.title}</option>`;
        }).join("");
        exeSelect.disabled = false;
    } else {
        exeSelect.innerHTML = `<option value="">-- Chuyên đề chưa có bài tập --</option>`;
        exeSelect.disabled = true;
    }
}

function updateLivePreview() {
    const box = document.getElementById("preview-course-content");
    if (!box) return;
    box.innerHTML = "<p><i>*Đây là toàn bộ cấu trúc bài học đang có trong DB*</i></p>";
    currentSyllabusData.forEach(topic => {
        const sec = document.createElement("div");
        sec.style.border = "1px solid #ccc"; sec.style.padding = "10px"; sec.style.margin = "10px 0";
        sec.innerHTML = `<strong>${topic.title}</strong><br>`;
        topic.exercises.forEach(exe => {
            const color = exe.module_type === "learning" ? "blue" : "orange";
            sec.innerHTML += `<div style="margin-left: 20px; color: ${color};">↳ [${exe.module_type}] ${exe.title} (${exe.activities.length} acts)</div>`;
        });
        box.appendChild(sec);
    });
}