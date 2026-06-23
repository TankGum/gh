from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import String, Integer, BigInteger
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import EmploymentStatus
from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Employee(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "employees"

    account_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        sa.ForeignKey("accounts.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    email: Mapped[str] = mapped_column(String(256), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    branch_id: Mapped[UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        sa.ForeignKey("branches.id", ondelete="SET NULL"),
        nullable=True,
    )
    role_id: Mapped[UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        sa.ForeignKey("roles.id", ondelete="SET NULL"),
        nullable=True,
    )
    total_bookings: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_revenue: Mapped[int] = mapped_column(BigInteger, default=0, nullable=False)
    status: Mapped[EmploymentStatus] = mapped_column(
        sa.Enum(
            EmploymentStatus,
            name="employment_status",
            values_callable=lambda x: [e.value for e in x],
        ),
        default=EmploymentStatus.ACTIVE,
        nullable=False,
    )
