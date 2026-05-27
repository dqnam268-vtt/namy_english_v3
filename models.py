from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text, JSON
from sqlalchemy.orm import declarative_base, relationship

# Khởi tạo lớp cơ sở cho các mô hình ORM
Base = declarative_base()

# ==========================================
# 1. MÔ HÌNH TÀI KHOẢN (USERS)
# ==========================================
class User(Base):
    __tablename__ = "users"
    
    user_id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="student")  # admin hoặc student
    
    # Liên kết quan hệ dòng chảy dữ liệu
    progresses = relationship("Progress", back_populates="user", cascade="all, delete-orphan")
    feedbacks = relationship("Feedback", back_populates="user", cascade="all, delete-orphan")


# ==========================================
# 2. MÔ HÌNH TUẦN HỌC (WEEKS)
# ==========================================
class Week(Base):
    __tablename__ = "weeks"
    
    week_id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False)  # Ví dụ: WEEK 1, WEEK 2...
    order_num = Column(Integer, nullable=False, unique=True)  # Số thứ tự tuần (1 đến 40)
    
    exercises = relationship("Exercise", back_populates="week", cascade="all, delete-orphan")


# ==========================================
# 3. MÔ HÌNH NHÓM BÀI TẬP / CHỦ ĐỀ (EXERCISES)
# ==========================================
class Exercise(Base):
    __tablename__ = "exercises"
    
    exercise_id = Column(Integer, primary_key=True, index=True)
    week_id = Column(Integer, ForeignKey("weeks.week_id"))
    title = Column(String(100), nullable=False)  # Ví dụ: Welcome Video, Let's Practise
    order_num = Column(Integer, nullable=False, default=1)
    
    # ĐIỂM CỐT LÕI V3: Phân loại danh mục hiển thị
    # Giá trị nhận vào: "learning" (Nội dung học) hoặc "practice" (Rèn luyện thực hành)
    module_type = Column(String(50), nullable=False, default="learning")
    
    week = relationship("Week", back_populates="exercises")
    activities = relationship("Activity", back_populates="exercise", cascade="all, delete-orphan")


# ==========================================
# 4. MÔ HÌNH HOẠT ĐỘNG CHI TIẾT (ACTIVITIES)
# ==========================================
class Activity(Base):
    __tablename__ = "activities"
    
    activity_id = Column(Integer, primary_key=True, index=True)
    exercise_id = Column(Integer, ForeignKey("exercises.exercise_id"))
    activity_type = Column(String(100), nullable=False)  # Loại công cụ (Vocabulary, Grammar, Reading, Phonetics)
    content = Column(JSON, nullable=False)  # Lưu trữ câu hỏi, đáp án hoặc link dưới dạng JSON
    order_num = Column(Integer, nullable=False, default=1)
    
    exercise = relationship("Exercise", back_populates="activities")
    progresses = relationship("Progress", back_populates="activity", cascade="all, delete-orphan")


# ==========================================
# 5. MÔ HÌNH TIẾN ĐỘ HỌC TẬP (PROGRESS)
# ==========================================
class Progress(Base):
    __tablename__ = "progress"
    
    progress_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"))
    activity_id = Column(Integer, ForeignKey("activities.activity_id"))
    score = Column(Integer, default=0)  # Điểm số đạt được
    is_completed = Column(Boolean, default=False)  # Trạng thái hoàn thành để tính % tiến độ
    
    user = relationship("User", back_populates="progresses")
    activity = relationship("Activity", back_populates="progresses")


# ==========================================
# 6. MÔ HÌNH HÒM THƯ PHẢN HỒI (FEEDBACKS)
# ==========================================
class Feedback(Base):
    __tablename__ = "feedbacks"
    
    feedback_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"))
    message = Column(Text, nullable=False)  # Nội dung thắc mắc
    location = Column(String(100))  # Vị trí gửi tin nhắn trên hệ thống
    
    user = relationship("User", back_populates="feedbacks")