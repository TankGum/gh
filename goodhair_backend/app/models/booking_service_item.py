from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import BigInteger, Float
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPrimaryKeyMixin


class BookingServiceItem(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "booking_service_items"

    booking_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        sa.ForeignKey("bookings.id", ondelete="CASCADE"),
        nullable=False,
    )
    service_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        sa.ForeignKey("services.id", ondelete="SET NULL"),
        nullable=True,
    )
    # Snapshot hoa hồng tại thời điểm booking chuyển sang "completed" — khoá
    # lại để không đổi khi sau này sửa giá dịch vụ hoặc % hoa hồng của vai trò.
    unit_price: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=0, server_default="0"
    )
    commission_percent: Mapped[float] = mapped_column(
        Float, nullable=False, default=0, server_default="0"
    )
    commission_amount: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=0, server_default="0"
    )
