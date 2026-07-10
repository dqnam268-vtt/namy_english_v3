// ==========================================
// NAMY V3: PORTAL MODULE (BẢN ĐỒNG BỘ KÉP DATABASE & LOCALSTORAGE)
// ==========================================

document.addEventListener("DOMContentLoaded", async () => {
    try {
        if (window.location.pathname.includes("/portal")) {
            if (typeof checkAuth === "function") checkAuth("student");
            
            const studentName = localStorage.getItem("username") || "Em";
            const nameEl = document.getElementById("student-name");
            if (nameEl) nameEl.innerText = "Welcome, " + studentName + "!";
            
            // 1. KÉO dữ liệu từ Database Server về máy ngay khi vừa đăng nhập
            await restoreProgressFromServer();
            
            // 2. Tải danh sách bài tập ra màn hình
            await loadStudentSyllabus();
            
            // 3. Đắp màu thanh tiến độ cho các bài đã làm
            setTimeout(() => { updateProgressUIFromLocal(); }, 500);
        }
    } catch (err) {
        console.error("Lỗi khởi tạo:", err);
    }
});

async function restoreProgressFromServer() {
    const username = localStorage.getItem("username");
    if (!username) return;
    
    try {
        console.log("⏳ [Đang tải...] Kéo dữ liệu từ Database...");
        const response = await fetch("/api/get_student_detail", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: username })
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data && data.progress) {
                let progList = Array.isArray(data.progress) ? data.progress : Object.values(data.progress);
                progList.forEach(p => {
                    if (p.module_type === "learning") {
                        if (p.is_completed) localStorage.setItem(`namy_theory_${p.exercise_id}`, "completed");
                    } else {
                        localStorage.setItem(`namy_progress_${p.exercise_id}`, JSON.stringify({
    				qIndex: p.is_completed ? 999 : 0, 
    				score: p.is_completed ? (p.score || 0) : 0, // Đã fix: Nếu chưa xong thì reset điểm về 0
    				total: p.total || 0, 
    				isCompleted: p.is_completed
			}));
                    }
                });
            }
            if (data && data.surveys) {
                let surveyList = Array.isArray(data.surveys) ? data.surveys : Object.values(data.surveys);
                surveyList.forEach(s => {
                    let tid = typeof s === 'object' ? s.topic_id : s;
                    localStorage.setItem(`namy_survey_done_${tid}`, "true");
                });
            }
        }
    } catch (error) {
        console.log("❌ [Lỗi phục hồi]:", error);
    }
}

async function syncProgressToServer(exeId, moduleType, score, isCompleted) {
    const username = localStorage.getItem("username");
    if (!username) return;
    try {
        const response = await fetch("/api/update_progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                username: username, 
                exercise_id: parseInt(exeId), 
                module_type: moduleType, 
                score: parseInt(score), 
                is_completed: isCompleted 
            })
        });
        if (response.ok) {
            localStorage.setItem(`namy_synced_${exeId}_${score}`, "true");
            console.log(`✅ Lưu Database thành công bài: ${exeId}`);
        } else {
            console.error("❌ Máy chủ Backend từ chối lưu dữ liệu!");
        }
    } catch (error) { 
        console.log("❌ Lỗi mạng khi lưu:", error); 
    }
}

function updateProgressUIFromLocal() {
    document.querySelectorAll('.exe-btn').forEach(btn => {
        const str = btn.getAttribute("onclick");
        if(str) {
            const match = str.match(/"id":\s*(\d+)/);
            if(match && match[1]) {
                const exeId = match[1];
                const progressData = localStorage.getItem(`namy_progress_${exeId}`);
                if (progressData) {
                    const parsed = JSON.parse(progressData);
                    const bar = btn.querySelector('.mini-progress-bar');
                    const text = btn.querySelector('.mini-progress-text');
                    if (bar && text) {
                        let total = parsed.total > 0 ? parsed.total : 10;
			// Đã fix: Chặn đứng điểm ảo, nếu điểm cao hơn tổng số câu thì ép về bằng tổng số câu
			let safeScore = parsed.score > total ? total : parsed.score; 
			let percent = Math.round((safeScore / total) * 100);
			if (percent > 100) percent = 100;
			bar.style.width = percent + "%";
			text.innerText = parsed.isCompleted ? `✅ Hoàn thành: Đúng ${safeScore}/${total} điểm` : `📝 Đang làm: Đúng ${safeScore}/${total} điểm (${percent}%)`;
                        if (parsed.isCompleted) {
                            bar.classList.remove('progress-learning-bar');
                            bar.classList.add('progress-practice-bar');
                        }
                    }
                }
            }
        }
    });
}

async function loadStudentSyllabus() {
    const container = document.getElementById("syllabus-container");
    try {
        const res = await fetch("/api/get_syllabus");
        if (res.ok) {
            const data = await res.json();
            renderSyllabus(data, container);
        } else {
            container.innerHTML = `<p style="color:red; text-align:center;">Lỗi API: ${res.status}</p>`;
        }
    } catch (error) {
        container.innerHTML = `<p style="color:red; text-align:center;">Mất kết nối: ${error.message}</p>`;
    }
}

let pendingSurveyTopicId = null;
let pendingSurveyTopicTitle = "";
let currentExeData = null; 

function renderSyllabus(syllabusData, container) {
    if (!syllabusData || syllabusData.length === 0) {
        container.innerHTML = `<p style="text-align:center; color: #64748b;">Thầy chưa mở khóa bài học nào.</p>`;
        return;
    }

    let html = "";
    pendingSurveyTopicId = null;

    syllabusData.forEach(topic => {
        html += `<div class="topic-card">
            <h2 style="color: #0f172a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-top:0;">⭐ ${topic.title}</h2>
            <div style="display: flex; flex-wrap: wrap; margin-top: 15px;">`;
        
        let activeExercises = [];
        if (topic.exercises && topic.exercises.length > 0) {
            activeExercises = topic.exercises.filter(exe => exe.is_published === true);
        }

        let isTopicCompleted = true; 
        let hasExercises = activeExercises.length > 0;

        if (!hasExercises) isTopicCompleted = false;

        if (hasExercises) {
            activeExercises.sort((a, b) => {
                if (a.module_type !== b.module_type) return a.module_type === 'learning' ? -1 : 1; 
                return a.title.localeCompare(b.title, undefined, {numeric: true, sensitivity: 'base'}); 
            });

            activeExercises.forEach(exe => {
                const btnClass = exe.module_type === "learning" ? "exe-learning" : "exe-practice";
                const exeDataStr = encodeURIComponent(JSON.stringify(exe)).replace(/'/g, "%27");
                
                let progressPercent = 0; let progressText = "Chưa học"; let barClass = "progress-learning-bar";
                let tempTotal = 0;
                
                if (exe.activities) {
                    exe.activities.forEach(a => {
                        let aAns = (a.content && a.content.answer) ? a.content.answer : "";
                        if (aAns && aAns.includes(";")) tempTotal += aAns.split(";").length;
                        else tempTotal += 1;
                    });
                }

                if (exe.module_type === "learning") {
                    const isCompleted = localStorage.getItem(`namy_theory_${exe.id}`);
                    if (isCompleted === "completed") {
                        progressPercent = 100; progressText = "🚀 Đã ghi nhớ (100%)";
                        syncProgressToServer(exe.id, "learning", 100, true);
                    } else { 
                        progressText = "⏳ Chưa xem"; 
                        isTopicCompleted = false; 
                    }
                    barClass = "progress-learning-bar";
                } else {
                    barClass = "progress-practice-bar";
                    const savedProgress = localStorage.getItem(`namy_progress_${exe.id}`);
                    if (savedProgress) {
                        const parsed = JSON.parse(savedProgress);
                        const totalQ = parsed.total || tempTotal || 1;
                        progressPercent = Math.round((parsed.score / totalQ) * 100);
                        if (progressPercent > 100) progressPercent = 100;

                        if (parsed.isCompleted) {
                            progressText = `✅ Hoàn thành: Đúng ${parsed.score}/${totalQ} điểm`;
                            syncProgressToServer(exe.id, "practice", parsed.score, true);
                        } else {
                            progressText = `📝 Đang làm: Đúng ${parsed.score}/${totalQ} điểm (${progressPercent}%)`;
                            syncProgressToServer(exe.id, "practice", parsed.score, false);
                            isTopicCompleted = false; 
                        }
                    } else {
                        progressText = `✍️ Làm Bài tập (0/${tempTotal} điểm)`;
                        isTopicCompleted = false; 
                    }
                }
                
                html += `
                    <div class="exe-btn ${btnClass}" onclick="openExercise('${exeDataStr}')">
                        <span style="font-size: 1.05rem; color: #1e293b; display: inline-block; min-height: 44px; line-height: 1.4;">${exe.title}</span>
                        <div class="mini-progress-container">
                            <div class="mini-progress-bar ${barClass}" style="width: ${progressPercent}%;"></div>
                        </div>
                        <span class="mini-progress-text">${progressText}</span>
                    </div>`;
            });
        } else {
            html += `<p style="color: #94a3b8; font-style: italic; padding-left: 8px;">Bài học đang bị khóa hoặc chưa được giao.</p>`;
        }
        
        const isSurveyDone = localStorage.getItem(`namy_survey_done_${topic.topic_id}`);
        let btnSurveyHtml = "";

        if (hasExercises && isTopicCompleted && !isSurveyDone) {
            btnSurveyHtml = `<button onclick="showSurvey(${topic.topic_id}, '${topic.title.replace(/'/g, "\\'")}')" style="background: #ef4444; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 1rem; box-shadow: 0 4px 6px rgba(239, 68, 68, 0.4);">⚠️ Bắt buộc: Đánh giá Unit này</button>`;
            if (!pendingSurveyTopicId) {
                pendingSurveyTopicId = topic.topic_id;
                pendingSurveyTopicTitle = topic.title;
            }
        } else if (hasExercises && isTopicCompleted && isSurveyDone) {
            btnSurveyHtml = `<button disabled style="background: #10b981; color: white; border: none; padding: 8px 15px; border-radius: 8px; cursor: not-allowed; font-weight: bold; font-size: 0.95rem;">✅ Đã hoàn thành đánh giá</button>`;
        } else if (hasExercises) {
            btnSurveyHtml = `<button disabled style="background: #e2e8f0; color: #94a3b8; border: none; padding: 8px 15px; border-radius: 8px; cursor: not-allowed; font-weight: bold; font-size: 0.95rem;">🔒 Hoàn thành bài để Đánh giá</button>`;
        }

        html += `<div style="width: 100%; text-align: right; margin-top: 15px; padding-top: 15px; border-top: 1px dashed #cbd5e1;">${btnSurveyHtml}</div></div></div>`;
    });
    
    container.innerHTML = html;

    if (pendingSurveyTopicId) {
        setTimeout(() => { showSurvey(pendingSurveyTopicId, pendingSurveyTopicTitle); }, 800);
    }
}

window.closeLearningModal = function() { document.getElementById('learning-modal').style.display = 'none'; loadStudentSyllabus(); };
window.closePracticeModal = function() { document.getElementById('practice-modal').style.display = 'none'; loadStudentSyllabus(); };

let currentPracticeActs = [];
let currentQIndex = 0;
let currentScore = 0;
let currentExeId = null; 
let currentCalculatedTotal = 0; 

window.openExercise = function(encodedData) {
    try {
        const exe = JSON.parse(decodeURIComponent(encodedData));
        currentExeId = exe.id; 
        currentExeData = exe;
        
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
            
            const finishBtn = document.getElementById("btn-finish-theory");
            if (finishBtn) {
                finishBtn.onclick = () => {
                    localStorage.setItem(`namy_theory_${currentExeId}`, "completed");
                    syncProgressToServer(currentExeId, "learning", 100, true);
                    closeLearningModal(); 
                };
            }
            document.getElementById("learning-modal").style.display = "flex";
            
        } else {
            currentPracticeActs = exe.activities;
            currentCalculatedTotal = 0;
            currentPracticeActs.forEach(act => {
                let ans = (act.content && act.content.answer) ? act.content.answer : "";
                if (ans && ans.includes(";")) currentCalculatedTotal += ans.split(";").length;
                else currentCalculatedTotal += 1;
            });

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
    } catch (error) { alert("⚠️ Lỗi phân tích dữ liệu bài học. Mã lỗi: " + error.message); }
};

window.restartExercise = function() {
    if (confirm("Em có chắc chắn muốn làm lại từ đầu không? Điểm số cũ sẽ được ghi đè bằng kết quả mới.")) {
        currentQIndex = 0; currentScore = 0;
        localStorage.setItem(`namy_progress_${currentExeId}`, JSON.stringify({ qIndex: 0, score: 0, total: currentCalculatedTotal, isCompleted: false }));
        renderCurrentQuestion();
    }
};

window.selectOption = function(val) {
    const inlineInputs = document.querySelectorAll(".q_multi_input_inline");
    if (inlineInputs.length > 0) {
        for (let i = 0; i < inlineInputs.length; i++) {
            if (!inlineInputs[i].value) {
                inlineInputs[i].value = val;
                let tempWidth = val.length * 10 + 30; 
                if (tempWidth > 100) inlineInputs[i].style.width = tempWidth + "px";
                return; 
            }
        }
        let lastInput = inlineInputs[inlineInputs.length - 1];
        lastInput.value = val;
        let tempWidth = val.length * 10 + 30; 
        if (tempWidth > 100) lastInput.style.width = tempWidth + "px";
        return;
    }

    const inputEl = document.getElementById("q_text_input");
    if (inputEl) inputEl.value = val;
};

function renderCurrentQuestion() {
    const container = document.getElementById("practice-content");
    const feedback = document.getElementById("practice-feedback");
    const btnCheck = document.getElementById("btn-check-q");
    const btnNext = document.getElementById("btn-next-q");

    feedback.innerHTML = ""; btnNext.style.display = "none";
    
    if (currentQIndex >= currentPracticeActs.length) {
        let noteHtml = "";
        
        if (currentPracticeActs.length > 0 && currentPracticeActs[0].content.final_notes_html) {
            noteHtml = currentPracticeActs[0].content.final_notes_html;
        } else if (currentExeData && currentExeData.notes) {
            noteHtml = `
            <div style="text-align:left; background:#f1f5f9; padding:15px; border-radius:8px; font-size: 0.95rem; margin-top:20px; border-left: 5px solid #3b82f6;">
                <h4 style="margin-top:0; color:#1e293b; border-bottom:1px solid #cbd5e1; padding-bottom:8px;">📌 Ghi chú (Notes):</h4>
                <p style="white-space: pre-line; line-height: 1.6; color:#334155;">${currentExeData.notes.replace(/\|/g, '\n')}</p>
            </div>`;
        }

        container.innerHTML = `
            <div style="text-align:center; padding: 20px;">
                <h3 style="color:#059669; font-size: 1.8rem;">🎉 Chúc mừng em đã hoàn thành!</h3>
                <p style="font-size:1.3rem;">Điểm số cuối cùng: <b style="color:#dc2626;">${currentScore} / ${currentCalculatedTotal}</b></p>
                ${noteHtml}
                <button class="btn btn-primary" onclick="restartExercise()" style="margin-top:25px; font-size: 1.1rem; padding: 10px 20px;">🔄 Làm Lại Bài Này</button>
            </div>`;
        btnCheck.style.display = "none";
        
        localStorage.setItem(`namy_progress_${currentExeId}`, JSON.stringify({ qIndex: currentPracticeActs.length, score: currentScore, total: currentCalculatedTotal, isCompleted: true }));
        syncProgressToServer(currentExeId, "practice", currentScore, true);
        loadStudentSyllabus(); 
        return;
    }

    btnCheck.style.display = "block"; btnCheck.disabled = false;
    const act = currentPracticeActs[currentQIndex];
    const content = act.content || {};
    const type = act.type || act.activity_type || "Bài tập";

    let html = `<div style="margin-bottom: 15px;"><span style="background:#e0f2fe; color:#0284c7; padding: 5px 12px; border-radius: 12px; font-size: 0.85rem; font-weight:bold;">Câu ${currentQIndex + 1} / ${currentPracticeActs.length} - ${type}</span></div>`;
    let promptText = content.question || content.original || "";
    let hintHtml = content.keyword ? `<div style="margin-top:10px; font-weight:bold; color:#dc2626; font-size: 0.95rem;">TỪ KHÓA BẮT BUỘC: [ ${content.keyword} ]</div>` : "";
    
    let currentOptions = content.options || (currentExeData && currentExeData.options) || null;

    if (promptText.includes("___")) {
        let inputIndex = 0;
        promptText = promptText.replace(/___/g, function() {
            let inpHtml = `<input type="text" class="q_multi_input_inline" data-index="${inputIndex}" placeholder="_____" style="width: 100px; padding: 2px 5px; border: none; border-bottom: 2px solid #3b82f6; border-radius: 0; font-size: 1.1rem; text-align: center; color: #1d4ed8; font-weight: bold; background: transparent; outline: none; margin: 0 4px; transition: 0.3s; font-family: inherit;">`;
            inputIndex++;
            return inpHtml;
        });
        
        if (currentOptions && Array.isArray(currentOptions)) {
            html += `<div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:15px; background:#f8fafc; padding:15px; border-radius:10px; border:1px dashed #cbd5e1;">`;
            currentOptions.forEach(opt => {
                html += `<button onclick="selectOption('${opt.replace(/'/g, "\\'")}')" style="padding:8px 12px; border:1px solid #3b82f6; border-radius:20px; background:#eff6ff; color:#1d4ed8; cursor:pointer; font-weight:bold; transition:0.2s; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">${opt}</button>`;
            });
            html += `</div>`;
            html += `<p style="font-size:0.85rem; color:#64748b; margin-top:-5px; margin-bottom:15px; font-style:italic;">* Chạm vào từ phía trên để tự động điền vào chỗ trống, hoặc gõ trực tiếp.</p>`;
        }

        html += `<div style="font-size: 1.15rem; font-weight: normal; margin-bottom: 20px; color:#1e293b; line-height: 2.0; text-align: left; padding: 15px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); box-sizing: border-box; word-wrap: break-word;">${promptText}</div>`;
        html += hintHtml;
    } 
    else if (content.options && Array.isArray(content.options)) {
        html += `<div style="font-size: 1.15rem; font-weight: 600; margin-bottom: 20px; color:#1e293b; line-height: 1.5;">${promptText}</div>`;
        html += `<div style="display:flex; flex-direction:column; gap: 10px;">`;
        content.options.forEach((opt) => {
            html += `<label class="opt-label" style="padding: 12px 15px; border: 1px solid #cbd5e1; border-radius: 8px; cursor: pointer; transition: 0.2s;"><input type="radio" name="q_opt" value="${opt.replace(/"/g, '&quot;')}" style="margin-right: 10px;"> ${opt}</label>`;
        });
        html += `</div>`;
    } 
    else {
        html += `<div style="font-size: 1.15rem; font-weight: 600; margin-bottom: 10px; color:#1e293b; line-height: 1.5;">${promptText}</div>`;
        html += hintHtml;
        
        if (currentOptions && Array.isArray(currentOptions)) {
            html += `<div style="display:flex; flex-wrap:wrap; gap:10px; margin-bottom:20px; background:#f8fafc; padding:15px; border-radius:10px; border:1px dashed #cbd5e1;">`;
            currentOptions.forEach(opt => {
                html += `<button onclick="selectOption('${opt.replace(/'/g, "\\'")}')" style="padding:8px 12px; border:1px solid #3b82f6; border-radius:20px; background:#eff6ff; color:#1d4ed8; cursor:pointer; font-weight:bold; transition:0.2s;">${opt}</button>`;
            });
            html += `</div>`;
            html += `<div><input type="text" id="q_text_input" placeholder="Chạm vào nút phía trên để chọn từ..." readonly style="width:100%; padding: 15px; border: 2px solid #3b82f6; border-radius: 8px; font-size: 1.1rem; box-sizing: border-box; background:#fff;"></div>`;
        } else {
            html += `<div style="margin-top: 20px;"><input type="text" id="q_text_input" placeholder="Nhập câu trả lời của em vào đây..." style="width:100%; padding: 15px; border: 2px solid #94a3b8; border-radius: 8px; font-size: 1.1rem; box-sizing: border-box;"></div>`;
        }
    }
    container.innerHTML = html;
}

window.checkAnswer = function() {
    const act = currentPracticeActs[currentQIndex];
    const content = act.content || {};
    const feedback = document.getElementById("practice-feedback");
    const btnCheck = document.getElementById("btn-check-q");
    const btnNext = document.getElementById("btn-next-q");
    const inlineInputs = document.querySelectorAll(".q_multi_input_inline");

    if (inlineInputs.length > 0) {
        let isEmpty = true;
        inlineInputs.forEach(inp => {
            if (inp.value.trim() !== "") isEmpty = false;
        });

        if (isEmpty) {
            alert("⚠️ Em chưa nhập câu trả lời! Hãy chọn hoặc gõ đáp án trước khi kiểm tra nhé.");
            return;
        }

        let blanks = (content.answer || "").split(";");
        let blanksCorrect = 0;
        
        inlineInputs.forEach((inp, idx) => {
            let blankAns = blanks[idx] ? blanks[idx].trim() : "";
            let displayBlank = blankAns;
            let gradingBlank = blankAns;
            
            if (blankAns.includes("||")) {
                let parts = blankAns.split("||");
                displayBlank = parts[0].trim();
                gradingBlank = parts[0] + " / " + parts[1];
            }

            let userVal = inp.value.trim().toLowerCase().replace(/\s+/g, " ");
            let correctAnswers = gradingBlank.split("/").map(s => s.trim().toLowerCase().replace(/\s+/g, " "));
            let displayOptions = displayBlank.split("/").map(s => s.trim());
            
            if (userVal !== "" && correctAnswers.includes(userVal)) {
                blanksCorrect++;
                inp.style.borderBottomColor = "transparent"; inp.style.backgroundColor = "#dcfce3"; inp.style.color = "#16a34a"; inp.style.borderRadius = "6px"; inp.style.padding = "2px 8px";
            } else {
                inp.style.borderBottomColor = "transparent"; inp.style.backgroundColor = "#fee2e2"; inp.style.color = "#dc2626"; inp.style.borderRadius = "6px"; inp.style.padding = "2px 8px";
                if (displayOptions.length > 0) {
                    inp.value = userVal ? `${userVal} (Sửa: ${displayOptions[0]})` : `(Đáp án: ${displayOptions[0]})`;
                }
                let tempWidth = inp.value.length * 9 + 30; 
                if (tempWidth > 140) inp.style.width = tempWidth + "px";
            }
            inp.disabled = true;
        });
        
        currentScore += blanksCorrect;
        feedback.innerHTML = `<div style="margin-top: 15px; padding: 12px; background: #e0f2fe; color: #0284c7; border-radius: 8px; font-weight: bold; font-size: 1.15rem; text-align: center; border: 1px solid #bae6fd;">✅ Em đã làm đúng ${blanksCorrect} / ${inlineInputs.length} chỗ trống!</div>`;
        btnCheck.style.display = "none"; btnNext.style.display = "block";
        return;
    }

    let userAnswer = "";
    if (content.options && Array.isArray(content.options) && !content.question.includes("___")) {
        const selected = document.querySelector('input[name="q_opt"]:checked');
        if (!selected) { alert("⚠️ Em chưa chọn đáp án nào!"); return; }
        userAnswer = selected.value;
    } else {
        const inputEl = document.getElementById("q_text_input");
        if (!inputEl) return;
        if (!inputEl.value.trim()) { alert("⚠️ Em chưa nhập câu trả lời!"); return; }
        userAnswer = inputEl.value.trim();
    }

    let rawAnswer = content.answer || "";
    let displayPart = rawAnswer;
    let gradingPart = rawAnswer;

    if (rawAnswer.includes("||")) {
        let parts = rawAnswer.split("||");
        displayPart = parts[0].trim();
        gradingPart = parts[0] + " / " + parts[1];
    }

    let normalizedUser = userAnswer.toLowerCase().replace(/\s+/g, " ").replace(/\s*;\s*/g, ";").trim();
    let possibleAnswers = gradingPart.toLowerCase().replace(/\s+/g, " ").replace(/\s*;\s*/g, ";").trim().split("/").map(s => s.trim());
    const isCorrect = possibleAnswers.includes(normalizedUser);

    if (isCorrect) {
        feedback.innerHTML = `<span style="color:#16a34a;">✅ Chính xác! Giỏi lắm!</span>`;
        currentScore++;
    } else {
        let displayOptions = displayPart.split("/").map(s => `<span style="color:#1e3a8a; font-weight:bold;">${s.trim()}</span>`);
        feedback.innerHTML = `<span style="color:#dc2626;">❌ Sai rồi. Đáp án đúng là:<br>${displayOptions[0]}</span>`;
    }
    btnCheck.style.display = "none"; btnNext.style.display = "block";
};

window.nextQuestion = function() {
    currentQIndex++;
    localStorage.setItem(`namy_progress_${currentExeId}`, JSON.stringify({ qIndex: currentQIndex, score: currentScore, total: currentCalculatedTotal, isCompleted: false }));
    renderCurrentQuestion();
};

let currentSurveyTopicId = null;
let currentSurveyTopicTitle = "";

window.showSurvey = function(topicId, topicTitle) {
    currentSurveyTopicId = topicId;
    currentSurveyTopicTitle = topicTitle;
    const modal = document.getElementById("survey-modal");
    if(modal) modal.style.display = "flex";
    const titleEl = modal.querySelector("h2");
    if(titleEl) titleEl.innerHTML = `📊 Đánh giá: ${topicTitle}`;
}

window.submitSurvey = async function() {
    const q1 = document.querySelector('input[name="q1"]:checked');
    const q2 = document.querySelector('input[name="q2"]:checked');
    const q3 = document.querySelector('input[name="q3"]:checked');
    const textFeedback = document.getElementById("survey-feedback").value;

    if (!q1 || !q2 || !q3) {
        alert("⚠️ Em vui lòng tick đủ 3 câu hỏi bằng Emoji nhé!");
        return;
    }

    const username = localStorage.getItem("username");
    if (!username) return;

    try {
        const res = await fetch("/api/submit_survey", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                username: username,
                topic_id: parseInt(currentSurveyTopicId),
                topic_title: currentSurveyTopicTitle,
                grammar: parseInt(q1.value),
                vocab: parseInt(q2.value),
                overall: parseInt(q3.value),
                suggestion: textFeedback
            })
        });

        if (res.ok) {
            alert("Cảm ơn em đã gửi đánh giá! Hệ thống đã ghi nhận. 💖");
            document.getElementById("survey-modal").style.display = "none";
            document.getElementById("unit-survey-form").reset(); 
            localStorage.setItem(`namy_survey_done_${currentSurveyTopicId}`, "true");
            loadStudentSyllabus(); 
        }
    } catch (error) {
        alert("Lỗi kết nối máy chủ! Vui lòng thử lại sau.");
    }
}

window.submitFeedback = async function() {
    const text = document.getElementById("feedback-text").value.trim();
    if (!text) {
        alert("⚠️ Em chưa nhập nội dung góp ý!");
        return;
    }
    const username = localStorage.getItem("username") || "Unknown";
    try {
        await fetch("/api/submit_feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: username, content: text, time: new Date().toISOString() })
        });
        alert("Cảm ơn em! Góp ý của em đã được gửi đến thầy Nam. 💖");
        document.getElementById('feedback-modal').style.display = 'none';
        document.getElementById("feedback-text").value = "";
    } catch (err) {
        alert("Lỗi kết nối. Em thử lại sau nhé!");
    }
}

window.deleteSingleExercise = function(username, exerciseId) {
    if (confirm(`Thầy có chắc chắn muốn reset lại bài tập ID: ${exerciseId} của học sinh ${username} không?`)) {
        fetch("/api/delete_single_progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: username, exercise_id: parseInt(exerciseId) })
        })
        .then(res => {
            if (res.ok) {
                alert("Đã xóa dữ liệu bài tập thành công!");
            } else {
                alert("Lỗi khi xóa!");
            }
        });
    }
}