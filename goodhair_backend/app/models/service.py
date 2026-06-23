from sqlalchemy import Column, Enum, ForeignKey, Integer, String, Table
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.constants import ServiceStatus
from app.models.base import (
    AuditMixin,
    Base,
    SoftDeleteMixin,
    TimestampMixin,
    UUIDPrimaryKeyMixin,
)
from app.models.branch import Branch

# Bảng nối many-to-many giữa dịch vụ và cửa hàng.
# Quy ước: is_all_branches=true -> bảng nối rỗng (áp dụng mọi cửa hàng).
service_branches = Table(
    "service_branches",
    Base.metadata,
    Column(
        "service_id",
        PgUUID(as_uuid=True),
        ForeignKey("services.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "branch_id",
        PgUUID(as_uuid=True),
        ForeignKey("branches.id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Service(
    UUIDPrimaryKeyMixin,
    TimestampMixin,
    AuditMixin,
    SoftDeleteMixin,
    Base,
):
    __tablename__ = "services"

    name: Mapped[str] = mapped_column(String(255), index=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    duration_minutes: Mapped[int] = mapped_column(Integer)
    price: Mapped[int] = mapped_column(Integer)
    status: Mapped[ServiceStatus] = mapped_column(
        Enum(
            ServiceStatus,
            name="service_status",
            values_callable=lambda enum: [member.value for member in enum],
        ),
        default=ServiceStatus.ACTIVE,
        server_default=ServiceStatus.ACTIVE.value,
    )
    is_all_branches: Mapped[bool] = mapped_column(default=True)

    branches: Mapped[list[Branch]] = relationship(
        secondary=service_branches,
        lazy="selectin",
    )
