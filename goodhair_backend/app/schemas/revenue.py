import datetime
from uuid import UUID

from app.schemas.base import AppSchema


class RevenueSummary(AppSchema):
    total_revenue: int
    total_bookings: int
    avg_booking_value: int
    delta_revenue: int
    delta_bookings: int


class RevenueDailyItem(AppSchema):
    date: datetime.date
    revenue: int
    count: int


class RevenueByBranch(AppSchema):
    branch_id: UUID
    branch_name: str
    revenue: int
    count: int
    pct: float


class RevenueByService(AppSchema):
    service_id: UUID
    service_name: str
    revenue: int
    count: int
    pct: float


class RevenueByEmployee(AppSchema):
    employee_id: UUID
    employee_name: str
    branch_name: str | None = None
    avatar_url: str | None = None
    revenue: int
    count: int
    pct: float
