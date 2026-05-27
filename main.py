import os
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import bcrypt

import models
import schemas
from database import engine, get_db

# ==========================================
# ÁO GIÁP 1: TỰ ĐỘNG KHỞI TẠO & KIỂM TRA FILE
# ==========================================
os.makedirs("static", exist_ok=True)
os.makedirs("static/css", exist_ok=True)
os.makedirs("static/js", exist_ok=True)

# Đăng ký 4 file giao diện chiến lược của bản V3
for html_file in ["index.html", "portal.html", "syllabus.html", "admin.html"]:
    file_path = os.path.join("static", html_file)
    if not os.path.exists(file_path):
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(f"<h2>NamY V3 - Hệ thống đang chạy! Thiếu file giao diện: {html_file}</h2>")

# ==========================================
# ÁO GIÁP 2: BẢO VỆ KẾT NỐI DATABASE
# ==========================================
try:
    models.Base.metadata.create_all(bind=engine)
    print("🚀 NAMY V3 STATUS: KẾT NỐI VÀ KHỞI TẠO DATABASE THÀNH CÔNG!")
except Exception as e:
    print("========================================")
    print("❌ LỖI NGHIÊM TRỌNG: KHÔNG THỂ KẾT NỐI DATABASE!")
    print(f"👉 Mã lỗi kỹ thuật: {e}")
    print("========================================")

# Khởi tạo Server Trung tâm
app = FastAPI(title="NamY English App V3 - Portal Architecture")

# Phục vụ tài nguyên tĩnh (CSS, JS, Images)
app.mount("/static", StaticFiles(directory="static"), name="static")

# ==========================================
# CÁC ROUTE ĐIỀU HƯỚNG TRANG WEB HTML V3
# ==========================================
@app.get("/", response_class=HTMLResponse)
async def login_page():
    return FileResponse("static/index.html")

@app.get("/portal", response_class=HTMLResponse)
async def portal_page():
    return FileResponse("static/portal.html")

@app.get("/syllabus", response_class=HTMLResponse)
async def syllabus_page():
    return FileResponse("static/syllabus.html")

@app.get("/admin", response_class=HTMLResponse)
async def admin_page():
    return FileResponse("static/admin.html")

# ==========================================
# HỆ THỐNG MÃ HÓA BẢO MẬT & ĐĂNG NHẬP
# ==========================================
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

@app.post("/api/login", response_model=schemas.LoginResponse)
def login(user_data: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == user_data.username).first()
    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Tên đăng nhập hoặc mật khẩu không chính xác")
    return {
        "status": "success",
        "message": "Đăng nhập thành công",
        "user_id": user.user_id,
        "role": user.role,
        "username": user.username
    }

@app.post("/api/register")
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.User).filter(models.User.username == user.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Tên đăng nhập này đã tồn tại!")
    new_user = models.User(username=user.username, password_hash=hash_password(user.password), role=user.role)
    db.add(new_user)
    db.commit()
    return {"status": "success", "message": "Đã tạo tài khoản thành công"}

# ==========================================
# CORE API CMS V3: QUẢN LÝ LỘ TRÌNH PHÂN LUỒNG
# ==========================================
@app.get("/api/get_syllabus")
def get_syllabus(mode: Optional[str] = None, db: Session = Depends(get_db)):
    """Lấy dữ liệu lộ trình bài học. Tự động lọc dựa trên tham số 'mode' từ Portal"""
    weeks = db.query(models.Week).order_by(models.Week.order_num).all()
    result = []
    
    for week in weeks:
        week_data = {
            "week_id": week.week_id,
            "title": week.title,
            "order_num": week.order_num,
            "exercises": []
        }
        
        # Tạo câu truy vấn lọc nhóm bài tập con
        query_ex = db.query(models.Exercise).filter(models.Exercise.week_id == week.week_id)
        
        # Nếu truyền mode (learning hoặc practice), tiến hành lọc rạch ròi
        if mode in ["learning", "practice"]:
            query_ex = query_ex.filter(models.Exercise.module_type == mode)
            
        exercises = query_ex.order_by(models.Exercise.order_num).all()
        
        for exc in exercises:
            act_list = []
            for a in exc.activities:
                act_list.append({
                    "id": a.activity_id,
                    "type": a.activity_type,
                    "content": a.content,
                    "order_num": a.order_num
                })
            week_data["exercises"].append({
                "id": exc.exercise_id,
                "title": exc.title,
                "module_type": exc.module_type,
                "activities": act_list
            })
            
        # Ở phía giao diện học sinh, nếu tuần trống (không có nội dung thuộc phân hệ đang chọn) thì không hiển thị
        if mode and len(week_data["exercises"]) == 0:
            continue
            
        result.append(week_data)
    return result

@app.post("/api/add_exercise")
def add_exercise(exe: schemas.ExerciseCreate, db: Session = Depends(get_db)):
    """BƯỚC 1 CMS V3: Cơ chế TỰ ĐỘNG SINH TUẦN (Lazy Creation) khi ghim bài tập"""
    week = db.query(models.Week).filter(models.Week.order_num == exe.week_order).first()
    
    # Nếu tuần học số thứ tự này chưa từng được khởi tạo, tự tạo ngầm
    if not week:
        week = models.Week(title=f"WEEK {exe.week_order}", order_num=exe.week_order)
        db.add(week)
        db.commit()
        db.refresh(week)
        
    new_exe = models.Exercise(
        title=exe.title,
        week_id=week.week_id,
        order_num=exe.order_num,
        module_type=exe.module_type
    )
    db.add(new_exe)
    db.commit()
    
    display_mode = "Không gian Học Tập" if exe.module_type == "learning" else "Đấu trường Luyện Tập"
    return {
        "status": "success",
        "message": f"Đã ghim thành công chủ đề '{exe.title}' vào WEEK {exe.week_order} ({display_mode})"
    }

@app.post("/api/add_activity")
def add_activity(act: schemas.ActivityCreate, db: Session = Depends(get_db)):
    """BƯỚC 2 CMS V3: Thêm hoạt động/công cụ chi tiết vào nhóm bài tập đích"""
    new_act = models.Activity(
        exercise_id=act.exercise_id,
        activity_type=act.activity_type,
        content=act.content,
        order_num=act.order_num
    )
    db.add(new_act)
    db.commit()
    return {"status": "success", "message": "Đã đẩy hoạt động vào hệ thống thành công!"}

# ==========================================
# HÒM THƯ TRỰC TUYẾN (FEEDBACK MECHANISM)
# ==========================================
@app.post("/api/send_feedback")
def receive_feedback(feedback: schemas.FeedbackCreate, db: Session = Depends(get_db)):
    new_feedback = models.Feedback(
        user_id=feedback.user_id,
        message=feedback.message,
        location=feedback.location
    )
    db.add(new_feedback)
    db.commit()
    return {"status": "success", "message": "Đã gửi thắc mắc của em đến hệ thống Thầy!"}

@app.get("/api/get_feedbacks")
def get_feedbacks(db: Session = Depends(get_db)):
    feedbacks = db.query(models.Feedback, models.User.username)\
                  .join(models.User, models.Feedback.user_id == models.User.user_id)\
                  .all()
    return [
        {
            "id": fb.feedback_id,
            "username": uname,
            "message": fb.message,
            "location": fb.location
        } for fb, uname in feedbacks
    ]

# ==========================================
# API THỐNG KÊ & THEO DÕI HỌC SINH (ADMIN)
# ==========================================
@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    total_students = db.query(models.User).filter(models.User.role == "student").count()
    total_weeks = db.query(models.Week).count()
    total_feedbacks = db.query(models.Feedback).count()
    return {
        "total_students": total_students,
        "total_weeks": total_weeks,
        "total_feedbacks": total_feedbacks
    }

@app.get("/api/users")
def get_users(db: Session = Depends(get_db)):
    """Bảng báo cáo và theo dõi hoạt động chi tiết của lớp học"""
    users = db.query(models.User).filter(models.User.role == "student").all()
    result = []
    for u in users:
        done_count = db.query(models.Progress).filter(
            models.Progress.user_id == u.user_id,
            models.Progress.is_completed == True
        ).count()
        result.append({
            "id": u.user_id,
            "username": u.username,
            "role": u.role,
            "done_count": done_count
        })
    return result

@app.post("/api/register_bulk")
def register_bulk(users_data: List[schemas.UserCreate], db: Session = Depends(get_db)):
    """Cấp tài khoản số lượng lớn từ Excel sao chép thẳng vào hệ thống"""
    created_count = 0
    for user in users_data:
        existing = db.query(models.User).filter(models.User.username == user.username).first()
        if not existing:
            hashed_pw = hash_password(user.password)
            db.add(models.User(username=user.username, password_hash=hashed_pw, role="student"))
            created_count += 1
    db.commit()
    return {"status": "success", "message": f"Hệ thống đã nạp nhanh {created_count} tài khoản học sinh thành công!"}

# ==========================================
# KHỞI TẠO DỮ LIỆU PHÂN LUỒNG MẪU (SEED)
# ==========================================
@app.get("/api/seed_data")
def seed_data(db: Session = Depends(get_db)):
    if db.query(models.Week).first():
        return {"message": "Dữ liệu cấu trúc tuần mẫu đã tồn tại!"}
    
    hashed_pw = hash_password("123456")
    admin = models.User(username="admin", password_hash=hashed_pw, role="admin")
    student = models.User(username="namy_student", password_hash=hashed_pw, role="student")
    db.add_all([admin, student])
    db.commit()

    # Tạo tuần học số 1 mẫu
    w1 = models.Week(title="WEEK 1: MY NEW SCHOOL", order_num=1)
    db.add(w1)
    db.commit()

    # 1. Tạo bài thuộc phân hệ Học tập (learning mode)
    e1_learn = models.Exercise(title="Welcome Video", week_id=w1.week_id, order_num=1, module_type="learning")
    db.add(e1_learn)
    db.commit()
    a1 = models.Activity(exercise_id=e1_learn.exercise_id, activity_type="Phát Âm & Nghe (Phonetics)", content={"url": "https://www.youtube.com/watch?v=sample1"}, order_num=1)
    db.add(a1)

    # 2. Tạo bài thuộc phân hệ Luyện tập thực hành (practice mode)
    e1_prac = models.Exercise(title="Let's Practise - W1", week_id=w1.week_id, order_num=1, module_type="practice")
    db.add(e1_prac)
    db.commit()
    a2 = models.Activity(exercise_id=e1_prac.exercise_id, activity_type="Luyện Ngữ Pháp (Grammar)", content={"question": "He ___ to school by bus.", "options": ["go", "goes"], "answer": "goes"}, order_num=1)
    db.add(a2)
    
    db.commit()
    return {"message": "Hệ thống đã bơm dữ liệu mẫu phân tách luồng (Học tập & Luyện tập) thành công!"}