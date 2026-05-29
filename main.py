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

os.makedirs("static", exist_ok=True)
os.makedirs("static/css", exist_ok=True)
os.makedirs("static/js", exist_ok=True)

for html_file in ["index.html", "portal.html", "syllabus.html", "admin.html"]:
    file_path = os.path.join("static", html_file)
    if not os.path.exists(file_path):
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(f"<h2>NamY V3 - Hệ thống đang chạy! Thiếu file giao diện: {html_file}</h2>")

try:
    models.Base.metadata.create_all(bind=engine)
    print("🚀 NAMY V3 STATUS: KẾT NỐI VÀ KHỞI TẠO DATABASE THÀNH CÔNG!")
except Exception as e:
    print(f"❌ LỖI NGHIÊM TRỌNG: KHÔNG THỂ KẾT NỐI DATABASE! {e}")

app = FastAPI(title="NamY English App V3 - Portal Architecture")
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/", response_class=HTMLResponse)
async def login_page(): return FileResponse("static/index.html")

@app.get("/portal", response_class=HTMLResponse)
async def portal_page(): return FileResponse("static/portal.html")

@app.get("/syllabus", response_class=HTMLResponse)
async def syllabus_page(): return FileResponse("static/syllabus.html")

@app.get("/admin", response_class=HTMLResponse)
async def admin_page(): return FileResponse("static/admin.html")

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

# CHÉP ĐÈ HÀM LOGIN NÀY VÀO MAIN.PY
@app.post("/api/login")
def login(user_data: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == user_data.username).first()
    if not user or not verify_password(user_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Tên đăng nhập hoặc mật khẩu không chính xác")
    
    # Trả về trực tiếp Dictionary để đảm bảo role được gửi qua
    return {
        "status": "success", 
        "message": "Đăng nhập thành công", 
        "user_id": user.user_id, 
        "role": user.role, 
        "username": user.username
    }

@app.post("/api/register")
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    if db.query(models.User).filter(models.User.username == user.username).first():
        raise HTTPException(status_code=400, detail="Tên đăng nhập này đã tồn tại!")
    db.add(models.User(username=user.username, password_hash=hash_password(user.password), role=user.role))
    db.commit()
    return {"status": "success", "message": "Đã tạo tài khoản thành công"}

@app.get("/api/get_syllabus")
def get_syllabus(mode: Optional[str] = None, db: Session = Depends(get_db)):
    topics = db.query(models.Topic).order_by(models.Topic.order_num).all()
    result = []
    
    for topic in topics:
        topic_data = {
            "topic_id": topic.topic_id,
            "title": topic.title,
            "order_num": topic.order_num,
            "exercises": []
        }
        
        query_ex = db.query(models.Exercise).filter(models.Exercise.topic_id == topic.topic_id)
        if mode in ["learning", "practice"]:
            query_ex = query_ex.filter(models.Exercise.module_type == mode)
            
        exercises = query_ex.order_by(models.Exercise.order_num).all()
        for exc in exercises:
            act_list = [{"id": a.activity_id, "type": a.activity_type, "content": a.content, "order_num": a.order_num} for a in exc.activities]
            topic_data["exercises"].append({"id": exc.exercise_id, "title": exc.title, "module_type": exc.module_type, "activities": act_list})
            
        if mode and len(topic_data["exercises"]) == 0:
            continue
            
        result.append(topic_data)
    return result

@app.post("/api/add_exercise")
def add_exercise(exe: schemas.ExerciseCreate, db: Session = Depends(get_db)):
    topic = db.query(models.Topic).filter(models.Topic.order_num == exe.topic_order).first()
    if not topic:
        topic = models.Topic(title=f"UNIT {exe.topic_order}", order_num=exe.topic_order)
        db.add(topic)
        db.commit()
        db.refresh(topic)
        
    new_exe = models.Exercise(title=exe.title, topic_id=topic.topic_id, order_num=exe.order_num, module_type=exe.module_type)
    db.add(new_exe)
    db.commit()
    return {"status": "success", "message": f"Đã ghim bài tập vào Chuyên đề {exe.topic_order}"}

@app.post("/api/add_activity")
def add_activity(act: schemas.ActivityCreate, db: Session = Depends(get_db)):
    new_act = models.Activity(exercise_id=act.exercise_id, activity_type=act.activity_type, content=act.content, order_num=act.order_num)
    db.add(new_act)
    db.commit()
    return {"status": "success", "message": "Đã đẩy hoạt động vào hệ thống!"}

# --- API NẠP JSON NÂNG CẤP (TỰ ĐỘNG XÓA TRÙNG LẶP VÀ GHI ĐÈ) ---
@app.post("/api/upload_json")
def upload_json(data: schemas.BulkExerciseUpload, db: Session = Depends(get_db)):
    topic = db.query(models.Topic).filter(models.Topic.order_num == data.topic_order).first()
    if not topic:
        topic = models.Topic(title=f"UNIT {data.topic_order}", order_num=data.topic_order)
        db.add(topic)
        db.commit()
        db.refresh(topic)
        
    # TÍNH NĂNG MỚI: Dọn dẹp các bài tập bị trùng lặp (Cùng Chủ đề & Cùng Tên)
    existing_exes = db.query(models.Exercise).filter(
        models.Exercise.topic_id == topic.topic_id,
        models.Exercise.title == data.exercise_title
    ).all()
    
    # Nếu tìm thấy bản cũ, xóa toàn bộ hoạt động bên trong và xóa bài tập đó
    for old_exe in existing_exes:
        db.query(models.Activity).filter(models.Activity.exercise_id == old_exe.exercise_id).delete()
        db.delete(old_exe)
    db.commit() # Chốt lệnh xóa
    
    # Bắt đầu tạo mới duy nhất 1 bản chuẩn
    new_exe = models.Exercise(
        title=data.exercise_title,
        topic_id=topic.topic_id,
        module_type=data.module_type
    )
    db.add(new_exe)
    db.commit()
    db.refresh(new_exe)
    
    created_count = 0
    for act in data.activities:
        new_act = models.Activity(
            exercise_id=new_exe.exercise_id,
            activity_type=act.type,
            content=act.content,
            order_num=created_count + 1
        )
        db.add(new_act)
        created_count += 1
        
    db.commit()
    return {
        "status": "success", 
        "message": f"Tuyệt vời! Đã dọn dẹp trùng lặp và nạp chuẩn {created_count} câu hỏi vào '{data.exercise_title}'"
    }

@app.post("/api/send_feedback")
def receive_feedback(feedback: schemas.FeedbackCreate, db: Session = Depends(get_db)):
    db.add(models.Feedback(user_id=feedback.user_id, message=feedback.message, location=feedback.location))
    db.commit()
    return {"status": "success", "message": "Đã gửi thắc mắc!"}

@app.get("/api/get_feedbacks")
def get_feedbacks(db: Session = Depends(get_db)):
    feedbacks = db.query(models.Feedback, models.User.username).join(models.User, models.Feedback.user_id == models.User.user_id).all()
    return [{"id": fb.feedback_id, "username": uname, "message": fb.message, "location": fb.location} for fb, uname in feedbacks]

@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    return {
        "total_students": db.query(models.User).filter(models.User.role == "student").count(),
        "total_topics": db.query(models.Topic).count(),
        "total_feedbacks": db.query(models.Feedback).count()
    }

@app.get("/api/users")
def get_users(db: Session = Depends(get_db)):
    users = db.query(models.User).filter(models.User.role == "student").all()
    result = []
    for u in users:
        done_count = db.query(models.Progress).filter(models.Progress.user_id == u.user_id, models.Progress.is_completed == True).count()
        result.append({"id": u.user_id, "username": u.username, "role": u.role, "done_count": done_count})
    return result

@app.post("/api/register_bulk")
def register_bulk(users_data: List[schemas.UserCreate], db: Session = Depends(get_db)):
    created_count = 0
    for user in users_data:
        if not db.query(models.User).filter(models.User.username == user.username).first():
            db.add(models.User(username=user.username, password_hash=hash_password(user.password), role="student"))
            created_count += 1
    db.commit()
    return {"status": "success", "message": f"Hệ thống đã nạp {created_count} tài khoản thành công!"}

@app.get("/api/seed_data")
def seed_data(db: Session = Depends(get_db)):
    if db.query(models.Topic).first():
        return {"message": "Dữ liệu 15 chuyên đề đã tồn tại!"}
    
    hashed_pw = hash_password("123456")
    db.add_all([
        models.User(username="admin", password_hash=hashed_pw, role="admin"),
        models.User(username="namy_student", password_hash=hashed_pw, role="student")
    ])
    
    cpe_topics = [
        "1. Tenses", "2. Modal Verbs", "3. Infinitive / Gerund", "4. Passive Voice", 
        "5. Reported Speech", "6. Adjectives / Adverbs / Comparisons", "7. Conditionals", 
        "8. Wishes / Unreal Past", "9. Relatives", "10. Nouns", "11. Articles", 
        "12. Causative Form", "13. Clauses", "14. Inversion", 
        "15. Conjunctions / Punctuation"
    ]
    
    for i, title in enumerate(cpe_topics, 1):
        db.add(models.Topic(title=f"UNIT {title}", order_num=i))
    
    db.commit()
    return {"message": "Hệ thống đã bơm 15 Chuyên đề CPE thành công!"}

# --- API TẠO 2 TÀI KHOẢN ĐỘC LẬP BỔ SUNG ---
@app.get("/api/init_users")
def init_users(db: Session = Depends(get_db)):
    # 1. Khởi tạo tài khoản Quản trị (Admin)
    admin_user = db.query(models.User).filter(models.User.username == "admin").first()
    if not admin_user:
        new_admin = models.User(
            username="admin",
            password_hash=hash_password("123456"),
            role="admin"
        )
        db.add(new_admin)
        
    # 2. Khởi tạo tài khoản Học sinh (Student demo)
    student_user = db.query(models.User).filter(models.User.username == "namy_student").first()
    if not student_user:
        new_student = models.User(
            username="namy_student",
            password_hash=hash_password("123456"),
            role="student"
        )
        db.add(new_student)
        
    db.commit()
    return {"message": "✅ Tuyệt vời! Đã nạp thành công 2 tài khoản: admin và namy_student"}

# --- API DỌN DẸP SẠCH DỮ LIỆU CỦA 1 UNIT ---
@app.delete("/api/clear_topic/{topic_order}")
def clear_topic(topic_order: int, db: Session = Depends(get_db)):
    topic = db.query(models.Topic).filter(models.Topic.order_num == topic_order).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Không tìm thấy Unit này trong hệ thống!")
    
    # Tìm toàn bộ bài tập thuộc Unit này
    exercises = db.query(models.Exercise).filter(models.Exercise.topic_id == topic.topic_id).all()
    
    deleted_count = 0
    for exe in exercises:
        # Xóa sạch các câu hỏi/thẻ từ vựng con bên trong bài tập
        db.query(models.Activity).filter(models.Activity.exercise_id == exe.exercise_id).delete()
        # Xóa khung bài tập
        db.delete(exe)
        deleted_count += 1
        
    db.commit()
    return {"status": "success", "message": f"Đã dọn dẹp sạch sẽ {deleted_count} nhóm bài tập của UNIT {topic_order}!"}