import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# ==========================================
# CẤU HÌNH KẾT NỐI DATABASE V3
# ==========================================

# 1. Lấy đường dẫn Database từ máy chủ (Render/Neon). 
# Nếu chạy ở máy tính cá nhân (không có biến môi trường), tự động dùng SQLite.
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./namy_v3.db")

# 2. Xử lý lỗi kinh điển của máy chủ Render: 
# Render thường cấp URL bắt đầu bằng "postgres://", nhưng SQLAlchemy bản mới yêu cầu "postgresql://"
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

# 3. Khởi tạo Engine (Bộ máy kết nối)
if "sqlite" in SQLALCHEMY_DATABASE_URL:
    # Cấu hình riêng cho SQLite để tránh lỗi đa luồng (Multi-threading)
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    # Cấu hình chuẩn cho PostgreSQL (Neon)
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

# 4. Khởi tạo Phiên làm việc (Session)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 5. Hàm phụ trợ để cấp phát kết nối DB cho các API
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()