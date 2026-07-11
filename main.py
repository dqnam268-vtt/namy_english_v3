import os
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
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
    print("🚀 HỆ THỐNG ĐÃ SẴN SÀNG!")
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

@app.post("/api/login")
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
            # 🟢 SỬA LỖI Ở ĐÂY: Ép hệ thống phải sắp xếp các thẻ (activities) theo đúng số thứ tự (order_num) tăng dần
            sorted_acts = sorted(exc.activities, key=lambda x: getattr(x, 'order_num', 0))
            
            act_list = [{"id": a.activity_id, "type": a.activity_type, "content": a.content, "order_num": a.order_num} for a in sorted_acts]
            topic_data["exercises"].append({
                "id": exc.exercise_id, 
                "title": exc.title, 
                "module_type": exc.module_type, 
                "is_published": getattr(exc, 'is_published', True),
                "activities": act_list
            })
            
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

@app.post("/api/upload_json")
def upload_json(data: schemas.BulkExerciseUpload, db: Session = Depends(get_db)):
    topic = db.query(models.Topic).filter(models.Topic.order_num == data.topic_order).first()
    if not topic:
        topic = models.Topic(title=f"UNIT {data.topic_order}", order_num=data.topic_order)
        db.add(topic)
        db.commit()
        db.refresh(topic)
        
    existing_exes = db.query(models.Exercise).filter(
        models.Exercise.topic_id == topic.topic_id,
        models.Exercise.title == data.exercise_title
    ).all()
    
    for old_exe in existing_exes:
        db.query(models.Activity).filter(models.Activity.exercise_id == old_exe.exercise_id).delete()
        db.delete(old_exe)
    db.commit() 
    
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
    
    total_learning = db.query(models.Exercise).filter(models.Exercise.module_type == "learning").count()
    total_practice = db.query(models.Exercise).filter(models.Exercise.module_type == "practice").count()
    
    all_acts = db.query(models.Activity.exercise_id, models.Activity.content).all()
    act_map = {}
    for exe_id, content in all_acts:
        if exe_id not in act_map:
            act_map[exe_id] = 0
            
        ans = content.get("answer", "") if isinstance(content, dict) else ""
        if ans and ";" in ans:
            act_map[exe_id] += len(ans.split(";"))
        else:
            act_map[exe_id] += 1

    result = []
    for u in users:
        progresses = db.query(models.Progress, models.Exercise)\
            .join(models.Exercise, models.Progress.exercise_id == models.Exercise.exercise_id)\
            .filter(models.Progress.user_id == u.user_id).all()
            
        learning_done = 0
        practice_done = 0
        practice_scores = []
        details = []
        
        for prog, exe in progresses:
            total_qs = act_map.get(exe.exercise_id, 1) 
            
            if exe.module_type == "learning":
                if prog.is_completed:
                    learning_done += 1
                details.append({
                    "exercise_name": exe.title,
                    "type": "learning",
                    "score": "Đã ghi nhớ", 
                    "status": "Hoàn thành" if prog.is_completed else "Chưa xong"
                })
            else:
                if prog.is_completed:
                    practice_done += 1
                    
                # [MỚI THÊM] Chặn hiển thị điểm ảo trên bảng Admin
                safe_score = prog.score if prog.score <= total_qs else total_qs
                score_str = f"{safe_score}/{total_qs}"
                
                short_title = exe.title.split(":")[0] if ":" in exe.title else exe.title
                practice_scores.append(f"{short_title} ({score_str})")
                
                details.append({
                    "exercise_name": exe.title,
                    "type": "practice",
                    "score": f"Đúng {score_str} câu",
                    "status": "Hoàn thành" if prog.is_completed else "Đang làm"
                })
        
        theory_pct = round((learning_done / total_learning * 100)) if total_learning > 0 else 0
        practice_pct = round((practice_done / total_practice * 100)) if total_practice > 0 else 0
        
        result.append({
            "id": u.user_id,
            "username": u.username,
            "role": u.role,
            "theory_pct": theory_pct,
            "theory_text": f"{learning_done}/{total_learning} bài",
            "practice_pct": practice_pct,
            "practice_text": f"{practice_done}/{total_practice} bài",
            "practice_scores": practice_scores,
            "details": details
        })
        
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

@app.get("/api/init_users")
def init_users(db: Session = Depends(get_db)):
    admin_user = db.query(models.User).filter(models.User.username == "admin").first()
    if not admin_user:
        db.add(models.User(username="admin", password_hash=hash_password("123456"), role="admin"))
        
    student_user = db.query(models.User).filter(models.User.username == "namy_student").first()
    if not student_user:
        db.add(models.User(username="namy_student", password_hash=hash_password("123456"), role="student"))
        
    db.commit()
    return {"message": "✅ Tuyệt vời! Đã nạp thành công 2 tài khoản: admin và namy_student"}

@app.delete("/api/clear_topic/{topic_order}")
def clear_topic(topic_order: int, db: Session = Depends(get_db)):
    topic = db.query(models.Topic).filter(models.Topic.order_num == topic_order).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Không tìm thấy Unit này trong hệ thống!")
    
    exercises = db.query(models.Exercise).filter(models.Exercise.topic_id == topic.topic_id).all()
    
    deleted_count = 0
    for exe in exercises:
        db.query(models.Activity).filter(models.Activity.exercise_id == exe.exercise_id).delete()
        db.query(models.Progress).filter(models.Progress.exercise_id == exe.exercise_id).delete()
        db.delete(exe)
        deleted_count += 1
        
    db.commit()
    return {"status": "success", "message": f"Đã dọn dẹp sạch sẽ {deleted_count} nhóm bài tập của UNIT {topic_order}!"}

class ProgressUpdate(BaseModel):
    username: str
    exercise_id: int
    module_type: str
    score: int
    is_completed: bool

@app.post("/api/update_progress")
def update_progress(prog: ProgressUpdate, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == prog.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy học sinh")
        
    existing_prog = db.query(models.Progress).filter(
        models.Progress.user_id == user.user_id,
        models.Progress.exercise_id == prog.exercise_id
    ).first()
    
    if existing_prog:
        existing_prog.score = prog.score
        existing_prog.is_completed = prog.is_completed
    else:
        new_prog = models.Progress(
            user_id=user.user_id,
            exercise_id=prog.exercise_id,
            score=prog.score,
            is_completed=prog.is_completed
        )
        db.add(new_prog)
        
    db.commit()
    return {"status": "success", "message": "Đã đồng bộ tiến độ lên máy chủ thành công!"}

# ==============================================================
# HÀM MỚI BỔ SUNG: TRẢ DỮ LIỆU CŨ CHO PORTAL KHI HỌC SINH LOGIN LẠI
# ==============================================================
class StudentDetailRequest(BaseModel):
    username: str

@app.post("/api/get_student_detail")
def get_student_detail(req: StudentDetailRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == req.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy học sinh")
        
    progress_records = db.query(models.Progress).filter(models.Progress.user_id == user.user_id).all()
    
    prog_list = []
    for p in progress_records:
        exe = db.query(models.Exercise).filter(models.Exercise.exercise_id == p.exercise_id).first()
        if exe:
            # Tự động đếm lại tổng số câu hỏi từ các hoạt động
            acts = db.query(models.Activity).filter(models.Activity.exercise_id == exe.exercise_id).all()
            total = 0
            for a in acts:
                ans = a.content.get("answer", "") if isinstance(a.content, dict) else ""
                if ans and ";" in ans:
                    total += len(ans.split(";"))
                else:
                    total += 1
                    
            prog_list.append({
                "exercise_id": p.exercise_id,
                "module_type": exe.module_type,
                "score": getattr(p, "score", 0),
                "total": total if total > 0 else 10,
                "is_completed": getattr(p, "is_completed", False)
            })
            
    # Lấy danh sách ID các unit đã làm khảo sát
    surveys = db.query(models.Feedback).filter(
        models.Feedback.user_id == user.user_id,
        models.Feedback.location.like("Khảo sát:%")
    ).all()
    survey_tids = []
    for s in surveys:
        t_title = s.location.replace("Khảo sát: ", "")
        topic = db.query(models.Topic).filter(models.Topic.title == t_title).first()
        if topic:
            survey_tids.append(topic.topic_id)
            
    return {"progress": prog_list, "surveys": survey_tids}

import io
import csv
import re
from fastapi.responses import StreamingResponse

@app.get("/api/export_progress")
def export_progress(db: Session = Depends(get_db)):
    users = db.query(models.User).filter(models.User.role == "student").all()
    
    all_exercises = db.query(models.Exercise).all()
    total_learning = len([e for e in all_exercises if e.module_type == "learning"])
    total_practice = len([e for e in all_exercises if e.module_type == "practice"])
    
    # Quét tất cả các Unit hiện có để tạo cột động
    unit_set = set()
    for exe in all_exercises:
        if exe.module_type == "practice":
            match = re.search(r"Unit\s+(\d+)", exe.title, re.IGNORECASE)
            if match:
                unit_set.add(int(match.group(1)))
    sorted_units = sorted(list(unit_set))
    
    all_acts = db.query(models.Activity.exercise_id, models.Activity.content).all()
    act_map = {}
    for exe_id, content in all_acts:
        if exe_id not in act_map: 
            act_map[exe_id] = 0
        ans = content.get("answer", "") if isinstance(content, dict) else ""
        if ans and ";" in ans:
            act_map[exe_id] += len(ans.split(";"))
        else:
            act_map[exe_id] += 1

    result = []
    for u in users:
        progresses = db.query(models.Progress, models.Exercise)\
            .join(models.Exercise, models.Progress.exercise_id == models.Exercise.exercise_id)\
            .filter(models.Progress.user_id == u.user_id).all()
            
        learning_done = 0
        practice_done = 0
        grand_total = 0
        total_attempts = 0
        unit_scores = {uNum: 0 for uNum in sorted_units}
        
        for prog, exe in progresses:
            total_qs = act_map.get(exe.exercise_id, 1)
            if exe.module_type == "learning":
                if prog.is_completed: 
                    learning_done += 1
            else:
                total_attempts += 1
                if prog.is_completed: 
                    practice_done += 1
                
                safe_score = prog.score if prog.score <= total_qs else total_qs
                grand_total += safe_score
                
                match = re.search(r"Unit\s+(\d+)", exe.title, re.IGNORECASE)
                if match:
                    uNum = int(match.group(1))
                    unit_scores[uNum] += safe_score
        
        theory_pct = round((learning_done / total_learning * 100)) if total_learning > 0 else 0
        practice_pct = round((practice_done / total_practice * 100)) if total_practice > 0 else 0
        
        result.append({
            "username": u.username,
            "theory_text": f"{theory_pct}% ({learning_done}/{total_learning})",
            "practice_text": f"{practice_pct}% ({practice_done}/{total_practice})",
            "unit_scores": unit_scores,
            "grand_total": grand_total,
            "total_attempts": total_attempts
        })
        
    # Sort: Điểm giảm dần, số lần làm tăng dần
    result.sort(key=lambda x: (-x["grand_total"], x["total_attempts"]))
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Dựng cột Header y chang giao diện Admin
    headers = ["Hạng", "Tài Khoản", "📖 Lý Thuyết", "✍️ Bài Tập (%)"]
    for uNum in sorted_units:
        headers.append(f"🏆 Tổng Unit {uNum}")
    headers.append("🏅 Tổng Tích Lũy")
        
    writer.writerow(headers)
    
    for idx, u in enumerate(result):
        row = [idx + 1, u["username"], u["theory_text"], u["practice_text"]]
        for uNum in sorted_units:
            row.append(u["unit_scores"][uNum])
        row.append(u["grand_total"])
        writer.writerow(row)
        
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue().encode("utf-8-sig")]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=Bang_Xep_Hang_Tong_Quan.csv"}
    )

# API MỚI: XUẤT EXCEL CHI TIẾT THEO TỪNG HỌC SINH
@app.get("/api/export_student_detail/{username}")
def export_student_detail(username: str, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy học sinh")

    all_acts = db.query(models.Activity.exercise_id, models.Activity.content).all()
    act_map = {}
    for exe_id, content in all_acts:
        if exe_id not in act_map: act_map[exe_id] = 0
        ans = content.get("answer", "") if isinstance(content, dict) else ""
        if ans and ";" in ans:
            act_map[exe_id] += len(ans.split(";"))
        else:
            act_map[exe_id] += 1

    progresses = db.query(models.Progress, models.Exercise)\
        .join(models.Exercise, models.Progress.exercise_id == models.Exercise.exercise_id)\
        .filter(models.Progress.user_id == user.user_id).order_by(models.Exercise.topic_id, models.Exercise.order_num).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Tên Bài Học", "Phân Loại", "Kết Quả"])

    for prog, exe in progresses:
        total_qs = act_map.get(exe.exercise_id, 1)
        if exe.module_type == "learning":
            status = "Đã ghi nhớ" if prog.is_completed else "Chưa xong"
            writer.writerow([exe.title, "📖 Lý thuyết", status])
        else:
            safe_score = prog.score if prog.score <= total_qs else total_qs
            status = f"Đúng {safe_score}/{total_qs} câu"
            writer.writerow([exe.title, "✍️ Bài tập", status])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue().encode("utf-8-sig")]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=Chi_Tiet_Tien_Do_{username}.csv"}
    )

class SurveySubmit(BaseModel):
    username: str
    topic_id: int
    topic_title: str
    grammar: int
    vocab: int
    overall: int
    suggestion: str


@app.post("/api/submit_survey")
def submit_survey(survey: SurveySubmit, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == survey.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy học sinh")
        
    msg = f"Ngữ pháp: {survey.grammar}⭐ | Từ vựng: {survey.vocab}⭐ | Chung: {survey.overall}⭐"
    if survey.suggestion:
        msg += f" | Góp ý: {survey.suggestion}"
        
    new_fb = models.Feedback(user_id=user.user_id, message=msg, location=f"Khảo sát: {survey.topic_title}")
    db.add(new_fb)
    db.commit()
    
    return {"status": "success", "message": "Đã lưu đánh giá!"}

class FeedbackSubmit(BaseModel):
    username: str
    content: str
    time: str

@app.post("/api/submit_feedback")
def submit_general_feedback(feedback: FeedbackSubmit, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == feedback.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy học sinh")
    
    new_fb = models.Feedback(
        user_id=user.user_id, 
        message=feedback.content, 
        location=f"Góp ý tự do"
    )
    db.add(new_fb)
    db.commit()
    return {"status": "success", "message": "Góp ý đã được ghi nhận!"}

class TogglePublish(BaseModel):
    exercise_id: int
    is_published: bool

@app.post("/api/toggle_publish")
def toggle_publish(data: TogglePublish, db: Session = Depends(get_db)):
    exe = db.query(models.Exercise).filter(models.Exercise.exercise_id == data.exercise_id).first()
    if not exe:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài học")
    
    exe.is_published = data.is_published
    db.commit()
    return {"status": "success", "message": "Cập nhật trạng thái thành công!"}

@app.delete("/api/delete_exercise/{exercise_id}")
def delete_exercise(exercise_id: int, db: Session = Depends(get_db)):
    exe = db.query(models.Exercise).filter(models.Exercise.exercise_id == exercise_id).first()
    if not exe:
        raise HTTPException(status_code=404, detail="Không tìm thấy bài học")
    
    db.query(models.Activity).filter(models.Activity.exercise_id == exercise_id).delete()
    db.query(models.Progress).filter(models.Progress.exercise_id == exercise_id).delete()
    db.delete(exe)
    db.commit()
    return {"status": "success", "message": "Đã xóa bài tập thành công!"}

class DeleteProgress(BaseModel):
    username: str
    exercise_id: int

@app.post("/api/delete_single_progress")
def delete_single_progress(data: DeleteProgress, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == data.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy học sinh")
        
    prog = db.query(models.Progress).filter(
        models.Progress.user_id == user.user_id,
        models.Progress.exercise_id == data.exercise_id
    ).first()
    
    if prog:
        db.delete(prog)
        db.commit()
        return {"status": "success", "message": "Đã xóa điểm để học sinh làm lại!"}
    return {"status": "error", "message": "Không tìm thấy dữ liệu bài làm"}

import io
import csv
from fastapi.responses import StreamingResponse

@app.get("/api/export_surveys")
def export_surveys(db: Session = Depends(get_db)):
    # Lấy toàn bộ dữ liệu khảo sát từ Database
    surveys = db.query(models.Feedback, models.User.username)\
                .join(models.User, models.Feedback.user_id == models.User.user_id)\
                .filter(models.Feedback.location.like("Khảo sát:%")).all()

    output = io.StringIO()
    writer = csv.writer(output)
    
    # Viết tiêu đề cột cho file Excel
    writer.writerow(["Học Sinh", "Chuyên Đề", "Ngữ Pháp (Sao)", "Từ Vựng (Sao)", "Đánh Giá Chung (Sao)", "Góp Ý Chi Tiết"])

    for fb, uname in surveys:
        # Bóc tách tên chuyên đề
        topic = fb.location.replace("Khảo sát: ", "").strip()
        
        # Bóc tách từng số điểm từ chuỗi message (VD: "Ngữ pháp: 5⭐ | Từ vựng: 3⭐ | Chung: 1⭐")
        parts = fb.message.split(" | ")
        grammar = parts[0].replace("Ngữ pháp: ", "").replace("⭐", "").strip() if len(parts) > 0 else ""
        vocab = parts[1].replace("Từ vựng: ", "").replace("⭐", "").strip() if len(parts) > 1 else ""
        overall = parts[2].replace("Chung: ", "").replace("⭐", "").strip() if len(parts) > 2 else ""
        suggestion = parts[3].replace("Góp ý: ", "").strip() if len(parts) > 3 else ""

        # Ghi một dòng vào file
        writer.writerow([uname, topic, grammar, vocab, overall, suggestion])

    output.seek(0)
    
    # Mã hóa utf-8-sig để Excel hiển thị tiếng Việt không bị lỗi font
    return StreamingResponse(
        iter([output.getvalue().encode("utf-8-sig")]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=Ket_Qua_Khao_Sat_NamY.csv"}
    )