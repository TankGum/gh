from sqlalchemy import JSON, BigInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Role(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    permissions: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    is_system: Mapped[bool] = mapped_column(default=False)
    is_bookable: Mapped[bool] = mapped_column(default=False)
    # Lương cứng hàng tháng (VND) — không snapshot theo tháng, luôn lấy mức
    # hiện tại của vai trò khi tính bảng lương.
    base_salary: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=0, server_default="0"
    )
    # Hoa hồng theo dịch vụ: {service_id (str): percent (0-100)}. Dịch vụ
    # không có trong map coi như 0%.
    commission_rates: Mapped[dict] = mapped_column(
        JSON, nullable=False, default=dict, server_default="{}"
    )
