from datetime import time

from sqlalchemy import Enum, Float, Integer, String, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import BranchStatus
from app.models.base import (
    AuditMixin,
    Base,
    SoftDeleteMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
)


class Branch(
    UUIDPrimaryKeyMixin,
    TimestampMixin,
    AuditMixin,
    SoftDeleteMixin,
    Base,
):
    """Cửa hàng / chi nhánh GoodHair."""

    __tablename__ = "branches"

    name: Mapped[str] = mapped_column(String(255))
    code: Mapped[str | None] = mapped_column(String(50), unique=True, nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)

    opening_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    closing_time: Mapped[time | None] = mapped_column(Time, nullable=True)

    # Số liệu hiển thị trên thẻ chi nhánh (nhập tay).
    monthly_revenue: Mapped[float] = mapped_column(Float, default=0, server_default="0")
    rating: Mapped[float] = mapped_column(Float, default=0, server_default="0")
    barber_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    seat_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    status: Mapped[BranchStatus] = mapped_column(
        Enum(
            BranchStatus,
            name="branch_status",
            values_callable=lambda enum: [member.value for member in enum],
        ),
        default=BranchStatus.OPEN,
        server_default=BranchStatus.OPEN.value,
    )
