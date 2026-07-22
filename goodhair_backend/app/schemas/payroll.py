from datetime import date, datetime
from uuid import UUID

from pydantic import Field

from app.schemas.base import AppSchema


class PayrollLockStatus(AppSchema):
    locked: bool
    locked_at: datetime | None = None
    locked_by_name: str | None = None


class PayrollLockRequest(AppSchema):
    month: str = Field(pattern=r"^\d{4}-\d{2}$")


class PayrollPeriodInfo(AppSchema):
    """Khoảng ngày thực tế của kỳ lương (theo PAYROLL_CUTOFF_DAY) + ngày dự
    kiến chi trả (PAYROLL_PAYDAY) — chỉ để hiển thị."""

    start_date: date
    end_date: date
    payday: date


class PayrollServiceBreakdown(AppSchema):
    service_id: UUID | None
    service_name: str
    count: int
    commission_amount: int


class PayrollEmployeeSummary(AppSchema):
    employee_id: UUID
    employee_name: str
    avatar_url: str | None
    role_name: str | None
    branch_name: str | None
    base_salary: int
    commission_total: int
    total_salary: int
    booking_count: int


class PayrollDetail(PayrollEmployeeSummary):
    breakdown: list[PayrollServiceBreakdown]
