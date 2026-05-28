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
# 3. DỮ LIỆU TẠO LỘ TRÌNH (CMS V3 - 15 CHUYÊN ĐỀ)
# ==========================================
class ExerciseCreate(BaseModel):
    title: str
    topic_order: int  # Gửi số thứ tự chuyên đề (1 đến 15)
    order_num: int = 1
    module_type: str = "learning" 

class ActivityCreate(BaseModel):
    exercise_id: int
    activity_type: str
    content: Dict[str, Any]
    order_num: int = 1