from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import JSON, BigInteger, Integer, String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class PayrollLock(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """Đánh dấu 1 tháng lương đã được "chốt" — mỗi tháng chỉ có 1 bản ghi.

    Khi tồn tại, PayrollService đọc số liệu từ PayrollLockEntry (đã đóng
    băng) thay vì tính lại từ Role.base_salary / booking hiện tại — nên sửa
    giá dịch vụ, % hoa hồng, lương cứng sau đó không ảnh hưởng tháng đã chốt.
    """

    __tablename__ = "payroll_locks"

    month: Mapped[str] = mapped_column(String(7), unique=True, nullable=False)
    locked_by_account_id: Mapped[UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        sa.ForeignKey("accounts.id", ondelete="SET NULL"),
        nullable=True,
    )


class PayrollLockEntry(UUIDPrimaryKeyMixin, Base):
    """Số liệu lương đã đóng băng của 1 nhân viên trong 1 tháng đã chốt."""

    __tablename__ = "payroll_lock_entries"

    lock_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        sa.ForeignKey("payroll_locks.id", ondelete="CASCADE"),
        nullable=False,
    )
    employee_id: Mapped[UUID] = mapped_column(PgUUID(as_uuid=True), nullable=False)
    # Nhãn hiển thị snapshot tại thời điểm chốt — nhân viên/vai trò/chi nhánh
    # có thể đổi tên hoặc bị xoá sau đó, tháng đã chốt vẫn hiển thị đúng như
    # lúc chốt.
    employee_name: Mapped[str] = mapped_column(String(256), nullable=False)
    role_name: Mapped[str | None] = mapped_column(String(128), nullable=True)
    branch_id: Mapped[UUID | None] = mapped_column(PgUUID(as_uuid=True), nullable=True)
    branch_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    base_salary: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    commission_total: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    total_salary: Mapped[int] = mapped_column(BigInteger, nullable=False, default=0)
    booking_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # [{serviceId, serviceName, count, commissionAmount}]
    breakdown: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
