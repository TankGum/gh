from functools import lru_cache
from zoneinfo import ZoneInfo

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.constants import AppEnv


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "GoodHair Backend"
    app_env: AppEnv = AppEnv.LOCAL
    debug: bool = False
    api_v1_prefix: str = "/api/v1"

    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/goodhair",
    )

    google_client_id: str = ""

    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    local_timezone: str = "Asia/Ho_Chi_Minh"

    # Danh sách origin được phép gọi API (CORS), phân tách bằng dấu phẩy.
    cors_origins: str = "http://localhost:3002"

    # Lưu file upload (ảnh chi nhánh...) trên đĩa, serve qua StaticFiles.
    upload_dir: str = "uploads"
    static_url_path: str = "/static"
    # Base URL công khai để dựng URL tuyệt đối cho file tĩnh (prod đổi sang domain API).
    public_base_url: str = "http://localhost:8002"

    # Kỳ lương: 0 = trọn tháng dương lịch (mặc định, 1 -> ngày cuối tháng).
    # Đặt 1-28 nếu chốt lương giữa tháng — khi đó "lương tháng X" sẽ tính từ
    # (N+1) tháng trước đến N tháng X (vd N=25 -> kỳ 26/5 -> 25/6).
    payroll_cutoff_day: int = 0
    # Chỉ để hiển thị (ngày dự kiến chi trả lương, tháng sau khi kỳ lương kết
    # thúc) — không ảnh hưởng cách tính hoa hồng/lương cứng.
    payroll_payday: int = 5

    # Cặp khoá dùng để ký lệnh in QZ Tray (in hoá đơn ra máy in nhiệt tại
    # quầy) — tạo bằng scripts/generate_qz_cert.py. Không cấu hình thì tính
    # năng in tự tắt (frontend không gọi được /print/sign).
    qz_private_key_path: str = ""
    qz_certificate_path: str = ""

    @property
    def timezone(self) -> ZoneInfo:
        return ZoneInfo(self.local_timezone)

    @property
    def cors_origin_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
