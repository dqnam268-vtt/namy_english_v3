// ==========================================
// NAMY V3: ADMIN CMS MODULE (15 TOPICS + JSON + DETAILED PROGRESS)
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

    // TỐI ƯU HÓA TÍNH NĂNG XUẤT EXCEL (Bỏ qua cột Nút bấm, gộp dòng gọn gàng)
    const exportBtn = document.getElementById("btn-export-excel");
    if (exportBtn) {
        exportBtn.addEventListener("click", () => {
            const rows = document.querySelectorAll("#users-table tr, #users-list-table tr, table tr");
            let csv = [];
            for (let i = 0; i < rows.length; i++) {
                let row = [], cols = rows[i].querySelectorAll("td, th");
                // Chỉ xuất 2 cột đầu tiên (Tên và Tiến độ), bỏ cột Thao tác
                let limit = cols.length >= 3 ? 2 : cols.length; 
                for (let j = 0; j < limit; j++) {
                    let cellText = cols[j].innerText.replace(/\n/g, ' - '); // Thay dấu xuống dòng bằng dấu gạch ngang
                    row.push('"' + cellText + '"');
                }
                csv.push(row.join(","));
            }
            const csvFile = new Blob(["\uFEFF" + csv.join("\n")], { type: "text/csv;charset=utf-8;" });
            const a = document.createElement("a");
            a.download = "Bao_Cao_Tien_Do_Lop_Hoc.csv";
            a.href = window.URL.createObjectURL(csvFile);
            a.click();
        });
    }

    const bulkBtn = document.getElementById("btn-bulk-register");
    if (bulkBtn) {
        bulkBtn.addEventListener("click", async () => {
            const txt = document.getElementById("bulk-users-data").value.split("\n");
            let list = [];
            txt.forEach(line => {
                let parts = line.split(/[\t,]+/);
                if (parts.length >= 2) list.push({ username: parts[0].trim(), password: parts[1].trim() });
            });
            
            bulkBtn.disabled = true;
            const res = await apiFetch("/register_bulk", "POST", list);
            if(res.ok) {
                showStatus(document.getElementById("bulk-message"), res.data.message, "success");
                document.getElementById("bulk-users-data").value = "";
                fetchStats();
            }
            bulkBtn.disabled = false;
        });
    }
}

// CẬP NHẬT HÀM RENDER TIẾN ĐỘ HỌC SINH SIÊU CHI TIẾT
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
        const body = document.getElementById("users-list-body") || document.querySelector("tbody");
        if(body) {
            let html = "";
            uRes.data.forEach(u => {
                // Mã hóa dữ liệu chi tiết để truyền vào Nút bấm
                const detailsStr = encodeURIComponent(JSON.stringify(u.details || []));
                
                html += `<tr>
                    <td style="padding: 15px; border-bottom: 1px solid #e2e8f0; font-weight: 600; color: #1e293b;">${u.username}</td>
                    
                    <td style="padding: 15px; border-bottom: 1px solid #e2e8f0;">
                        <span style="color: #059669; font-weight: bold; font-size: 1.1rem;">${u.done_count} Nhiệm vụ</span><br>
                        <span style="color: #64748b; font-size: 0.9rem;">(Tổng điểm: <b style="color:#dc2626;">${u.total_score || 0}</b> đ)</span>
                    </td>
                    
                    <td style="padding: 15px; border-bottom: 1px solid #e2e8f0; text-align: center;">
                        <button onclick="showStudentDetails('${u.username}', '${detailsStr}')" style="background: #3b82f6; color: white; border: none; padding: 8px 15px; border-radius: 8px; cursor: pointer; font-weight: bold; transition: 0.2s; white-space: nowrap;">🔍 Xem chi tiết</button>
                    </td>
                </tr>`;
            });
            body.innerHTML = html;
        }
    }
}

// HÀM MỚI: HIỂN THỊ BẢNG POP-UP CHI TIẾT KẾT QUẢ TỪNG BÀI
window.showStudentDetails = function(username, detailsStr) {
    const modalName = document.getElementById("detail-student-name");
    const modalData = document.getElementById("detail-student-data");
    const modalBox = document.getElementById("student-detail-modal");
    
    if (!modalBox) {
        alert("Thầy cần thêm đoạn mã HTML của Modal vào file admin.html trước nhé!");
        return;
    }

    modalName.innerText = "Hồ sơ học tập: " + username;
    const details = JSON.parse(decodeURIComponent(detailsStr));
    let html = "";

    if (!details || details.length === 0) {
        html = "<p style='color: #64748b; font-style: italic; text-align:center;'>Học sinh này chưa tham gia bài học nào.</p>";
    } else {
        html += `<table style="width: 100%; border-collapse: collapse; text-align: left;">
            <tr style="background: #f8fafc;">
                <th style="padding: 12px; border-bottom: 2px solid #cbd5e1; color:#475569;">Tên Bài Học</th>
                <th style="padding: 12px; border-bottom: 2px solid #cbd5e1; color:#475569;">Phân Loại</th>
                <th style="padding: 12px; border-bottom: 2px solid #cbd5e1; color:#475569;">Kết Quả</th>
            </tr>`;
            
        details.forEach(d => {
            // Nhúng CSS trực tiếp để đảm bảo Modal luôn đẹp dù chưa cập nhật file style.css
            const badgeTheory = `<span style="background: #e0f2fe; color: #0284c7; padding: 4px 10px; border-radius: 8px; font-size: 0.85rem; font-weight: bold; display:inline-block; white-space:nowrap;">📖 Lý thuyết</span>`;
            const badgePractice = `<span style="background: #dcfce3; color: #16a34a; padding: 4px 10px; border-radius: 8px; font-size: 0.85rem; font-weight: bold; display:inline-block; white-space:nowrap;">✍️ Bài tập</span>`;
            
            const badge = d.type === "learning" ? badgeTheory : badgePractice;
            const scoreText = d.type === "learning" ? "Đã ghi nhớ" : `Đúng ${d.score} câu`;
            
            html += `<tr>
                <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-weight: 500;">${d.exercise_name}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;">${badge}</td>
                <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #ea580c;">${scoreText}</td>
            </tr>`;
        });
        html += `</table>`;
    }

    modalData.innerHTML = html;
    modalBox.style.display = "flex";
}

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
            const res = await apiFetch("/add_exercise", "POST", { 
                title, 
                topic_order: topic_order, 
                order_num: 1, 
                module_type: moduleType 
            });
            
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
            
            if (fileInput.files.length === 0) {
                return showStatus(msg, "Vui lòng chọn ít nhất 1 file JSON trước khi tải lên!", "error");
            }

            btnUploadJson.disabled = true;
            btnUploadJson.innerText = `Đang xử lý ${fileInput.files.length} file...`;
            
            let successCount = 0;
            let errorCount = 0;

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
                    if (res.ok) {
                        successCount++;
                    } else {
                        errorCount++;
                    }
                } catch (error) {
                    console.error("Lỗi đọc file: ", file.name);
                    errorCount++;
                }
            }

            if (errorCount === 0) {
                showStatus(msg, `✅ Tuyệt vời! Đã nạp thành công toàn bộ ${successCount} bài tập vào hệ thống!`, "success");
            } else {
                showStatus(msg, `⚠️ Hoàn tất: ${successCount} file thành công, ${errorCount} file bị lỗi.`, "error");
            }

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
            const topicName = delSelect.options[delSelect.selectedIndex].text;
            const msg = document.getElementById("delete-message");
            
            const confirmDelete = confirm(`⚠️ THẦY CÓ CHẮC CHẮN MUỐN XÓA TOÀN BỘ DỮ LIỆU CỦA ${topicName} KHÔNG?\n\nHành động này sẽ xóa sạch Lý thuyết và Bài tập của Unit này để làm lại từ đầu!`);
            
            if (!confirmDelete) return;

            btnDelTopic.disabled = true;
            btnDelTopic.innerText = "Đang xử lý...";
            
            try {
                const res = await fetch(`/api/clear_topic/${topicOrder}`, { method: "DELETE" });
                const data = await res.json();
                
                if (res.ok) {
                    showStatus(msg, `✅ ${data.message}`, "success");
                    loadCmsComboboxes(); 
                } else {
                    showStatus(msg, `❌ Lỗi: ${data.detail}`, "error");
                }
            } catch (error) {
                showStatus(msg, "❌ Không thể kết nối tới máy chủ!", "error");
            }
            
            btnDelTopic.disabled = false;
            btnDelTopic.innerText = "Xóa Sạch Dữ QUẢ";
        });
    }
}

async function loadCmsComboboxes() {
    const selectId = document.getElementById("cms-topic-select") ? "cms-topic-select" : "cms-week-select";
    const topicSelect = document.getElementById(selectId);
    const delSelect = document.getElementById("delete-topic-select"); 
    
    const cpeTopics = [
        "1. Tenses", "2. Modal Verbs", "3. Infinitive / Gerund", "4. Passive Voice", 
        "5. Reported Speech", "6. Adjectives / Adverbs / Comparisons", "7. Conditionals", 
        "8. Wishes / Unreal Past", "9. Relatives", "10. Nouns", "11. Articles", 
        "12. Causative Form", "13. Clauses", "14. Inversion", "15. Conjunctions / Punctuation"
    ];

    let optionsHtml = "";
    cpeTopics.forEach((title, index) => {
        optionsHtml += `<option value="${index + 1}">UNIT ${title}</option>`;
    });

    if (topicSelect && topicSelect.options.length === 0) {
        topicSelect.innerHTML = optionsHtml;
        topicSelect.addEventListener("change", () => populateExerciseCombobox(parseInt(topicSelect.value)));
    }
    
    if (delSelect && delSelect.options.length === 0) {
        delSelect.innerHTML = optionsHtml;
    }

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
        exeSelect.innerHTML = `<option value="">-- Chuyên đề này chưa có nhóm bài tập --</option>`;
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