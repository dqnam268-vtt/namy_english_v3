from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Text, JSON
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

# ==========================================
# 1. MÔ HÌNH TÀI KHOẢN (USERS)
# ==========================================
class User(Base):
    __tablename__ = "users"
    
    user_id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="student") 
    
    progresses = relationship("Progress", back_populates="user", cascade="all, delete-orphan")
    feedbacks = relationship("Feedback", back_populates="user", cascade="all, delete-orphan")

# ==========================================
# 2. MÔ HÌNH CHỦ ĐỀ NGỮ PHÁP (TOPICS)
# ==========================================
class Topic(Base):
    __tablename__ = "topics"
    
    topic_id = Column(Integer, primary_key=True, index=True)
    title = Column(String(100), nullable=False) 
    order_num = Column(Integer, nullable=False, unique=True)  
    
    exercises = relationship("Exercise", back_populates="topic", cascade="all, delete-orphan")

# ==========================================
# 3. MÔ HÌNH NHÓM BÀI TẬP (EXERCISES)
# ==========================================
class Exercise(Base):
    __tablename__ = "exercises"
    
    exercise_id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("topics.topic_id")) 
    title = Column(String(100), nullable=False) 
    order_num = Column(Integer, nullable=False, default=1)
    
    module_type = Column(String(50), nullable=False, default="learning")
    
    # DÒNG MỚI ĐƯỢC THÊM VÀO ĐỂ LƯU TRẠNG THÁI GIAO BÀI
    is_published = Column(Boolean, default=True)
    
    topic = relationship("Topic", back_populates="exercises")
    activities = relationship("Activity", back_populates="exercise", cascade="all, delete-orphan")
    progresses = relationship("Progress", back_populates="exercise", cascade="all, delete-orphan")

# ==========================================
# 4. MÔ HÌNH HOẠT ĐỘNG CHI TIẾT (ACTIVITIES)
# ==========================================
class Activity(Base):
    __tablename__ = "activities"
    
    activity_id = Column(Integer, primary_key=True, index=True)
    exercise_id = Column(Integer, ForeignKey("exercises.exercise_id"))
    activity_type = Column(String(100), nullable=False)  
    content = Column(JSON, nullable=False)  
    order_num = Column(Integer, nullable=False, default=1)
    
    exercise = relationship("Exercise", back_populates="activities")

# ==========================================
# 5. MÔ HÌNH TIẾN ĐỘ HỌC TẬP (PROGRESS)
# ==========================================
class Progress(Base):
    __tablename__ = "progress"
    
    progress_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"))
    exercise_id = Column(Integer, ForeignKey("exercises.exercise_id"))
    score = Column(Integer, default=0)  
    is_completed = Column(Boolean, default=False)  
    
    user = relationship("User", back_populates="progresses")
    exercise = relationship("Exercise", back_populates="progresses")

# ==========================================
# 6. MÔ HÌNH HÒM THƯ PHẢN HỒI (FEEDBACKS)
# ==========================================
class Feedback(Base):
    __tablename__ = "feedbacks"
    
    feedback_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id"))
    message = Column(Text, nullable=False)  
    location = Column(String(100))  
    
    user = relationship("User", back_populates="feedbacks")