from pydantic import BaseModel
from typing import Dict, Any

# ==========================================
# 1. DỮ LIỆU ĐĂNG NHẬP VÀ TÀI KHOẢN (AUTH)
# ==========================================
class UserLogin(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    status: str
    message: str
    user_id: int
    role: str
    username: str

class UserCreate(BaseModel):
    username: str
    password: str
    role: str = "student"

# ==========================================
# 2. DỮ LIỆU HÒM THƯ (FEEDBACK)
# ==========================================
class FeedbackCreate(BaseModel):
    message: str
    location: str
    user_id: int

# ==========================================
# 3. DỮ LIỆU TẠO LỘ TRÌNH (CMS V3)
# ==========================================
# LƯU Ý: Không còn WeekCreate vì NamY V3 áp dụng cơ chế "Tạo lười" (Lazy Creation).
# Tuần sẽ tự động được sinh ra khi giáo viên thêm bài tập vào số thứ tự tuần đó.

class ExerciseCreate(BaseModel):
    title: str
    week_order: int  # Bản V3: Gửi số tuần (1 đến 40) thay vì mã week_id
    order_num: int = 1
    
    # ĐIỂM CỐT LÕI V3: Phân loại để đưa vào màn hình tương ứng
    # Giá trị: "learning" (Nội Dung Học) hoặc "practice" (Rèn Luyện Thực Hành)
    module_type: str = "learning" 

class ActivityCreate(BaseModel):
    exercise_id: int
    activity_type: str
    content: Dict[str, Any]
    order_num: int = 1