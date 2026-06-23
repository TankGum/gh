from datetime import date as date_type, time as time_type
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import BigInteger, Date, Integer, String, Time
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import BookingStatus
from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Booking(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "bookings"

    code: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    customer_name: Mapped[str] = mapped_column(String(256), nullable=False)
    customer_phone: Mapped[str] = mapped_column(String(20), nullable=False)
    employee_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        sa.ForeignKey("employees.id", ondelete="SET NULL"),
        nullable=True,
    )
    branch_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        sa.ForeignKey("branches.id", ondelete="SET NULL"),
        nullable=True,
    )
    date: Mapped[date_type] = mapped_column(Date, nullable=False)
    start_time: Mapped[time_type] = mapped_column(Time, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    status: Mapped[BookingStatus] = mapped_column(
        sa.Enum(
            BookingStatus,
            name="booking_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=BookingStatus.PENDING,
        nullable=False,
    )
