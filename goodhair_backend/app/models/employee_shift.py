from datetime import date as date_type
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import Date, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import ShiftType
from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class EmployeeShift(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "employee_shifts"

    employee_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        sa.ForeignKey("employees.id", ondelete="CASCADE"),
        nullable=False,
    )
    date: Mapped[date_type] = mapped_column(Date, nullable=False)
    shift_type: Mapped[ShiftType] = mapped_column(
        sa.Enum(
            ShiftType,
            name="shift_type",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
    )

    __table_args__ = (
        UniqueConstraint("employee_id", "date", name="uq_employee_shift_date"),
    )
