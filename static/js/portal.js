// ==========================================
// NAMY V3: PORTAL NAVIGATION MODULE
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    if (window.location.pathname.includes("/portal")) {
        checkAuth("student");
        
        const studentName = document.getElementById("portal-student-name");
        if (studentName) studentName.innerText = localStorage.getItem("username") || "Học sinh";

        const btnLearning = document.getElementById("card-learning");
        const btnPractice = document.getElementById("card-practice");

        // Gắn tham số ?mode=... vào URL khi chuyển sang trang syllabus
        if (btnLearning) {
            btnLearning.addEventListener("click", () => {
                window.location.href = "/syllabus?mode=learning";
            });
        }

        if (btnPractice) {
            btnPractice.addEventListener("click", () => {
                window.location.href = "/syllabus?mode=practice";
            });
        }
    }
});