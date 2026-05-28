// ==========================================
// NAMY V3: ADMIN CMS MODULE (15 TOPICS)
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
            const rows = document.querySelectorAll("#users-table tr");
            let csv = [];
            for (let i = 0; i < rows.length; i++) {
                let row = [], cols = rows[i].querySelectorAll("td, th");
                for (let j = 0; j < cols.length; j++) row.push('"' + cols[j].innerText + '"');
                csv.push(row.join(","));
            }
            const csvFile = new Blob(["\uFEFF" + csv.join("\n")], { type: "text/csv;charset=utf-8;" });
            const a = document.createElement("a");
            a.download = "Bao_Cao_Lop_Hoc.csv";
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

async function fetchStats() {
    const sRes = await apiFetch("/stats");
    if (sRes.ok) {
        document.getElementById("stat-students").innerText = sRes.data.total_students;
        
        // Lưu ý: Cần đổi id trong file admin.html từ stat-weeks thành stat-topics
        const statTopics = document.getElementById("stat-topics") || document.getElementById("stat-weeks");
        if(statTopics) statTopics.innerText = sRes.data.total_topics;
        
        document.getElementById("stat-feedbacks").innerText = sRes.data.total_feedbacks;
    }

    const uRes = await apiFetch("/users");
    if (uRes.ok) {
        const body = document.getElementById("users-list-body");
        if(body) {
            body.innerHTML = uRes.data.map(u => `<tr><td style="padding:8px; border-bottom:1px solid #eee;">${u.username}</td><td style="padding:8px; border-bottom:1px solid #eee;">${u.done_count} Nhiệm vụ</td></tr>`).join("");
        }
    }
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
}

async function loadCmsComboboxes() {
    const selectId = document.getElementById("cms-topic-select") ? "cms-topic-select" : "cms-week-select";
    const topicSelect = document.getElementById(selectId);
    
    if (topicSelect && topicSelect.options.length === 0) {
        let optionsHtml = "";
        // 15 Chủ đề CPE thay cho 40 tuần
        for(let i = 1; i <= 15; i++) optionsHtml += `<option value="${i}">UNIT ${i}</option>`;
        topicSelect.innerHTML = optionsHtml;
        topicSelect.addEventListener("change", () => populateExerciseCombobox(parseInt(topicSelect.value)));
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