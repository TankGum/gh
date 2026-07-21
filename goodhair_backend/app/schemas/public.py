"""Schemas cho các API public (homepage, bookings).

Chỉ expose các field cơ bản để hiển thị cho khách; ẩn các field nhạy cảm
như doanh thu (monthly_revenue / total_revenue), email, account_id...
"""

import datetime
from uuid import UUID

from pydantic import Field

from app.core.constants import BranchStatus
from app.schemas.base import AppSchema


class PublicBranchRead(AppSchema):
    id: UUID
    name: str
    address: str | None = None
    image_url: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    opening_time: datetime.time | None = None
    closing_time: datetime.time | None = None
    rating: float = 0
    barber_count: int = 0
    seat_count: int = 0
    status: BranchStatus = BranchStatus.OPEN


class PublicServiceRead(AppSchema):
    id: UUID
    name: str
    description: str | None = None
    image_url: str | None = None
    duration_minutes: int
    price: int
    is_all_branches: bool = True
    branch_ids: list[UUID] = []


class PublicEmployeeRead(AppSchema):
    id: UUID
    name: str
    display_name: str | None = None
    avatar_url: str | None = None
    branch_id: UUID | None = None
    role_name: str | None = None


class PublicBookingCreate(AppSchema):
    customer_name: str = Field(..., min_length=2)
    customer_phone: str = Field(..., min_length=8)
    employee_id: UUID
    branch_id: UUID
    date: datetime.date
    start_time: datetime.time
    duration_minutes: int = Field(..., gt=0)
    total: int = Field(..., ge=0)
    service_ids: list[UUID] = Field(..., min_length=1)


class PublicStatsResponse(AppSchema):
    branches: int
    services: int
    barbers: int


class PublicBookingRead(AppSchema):
    code: str
    customer_name: str
    date: datetime.date
    start_time: datetime.time
    total: int = 0


class PublicBookedWindow(AppSchema):
    start_minutes: int
    duration_minutes: int


class PublicCustomerRead(AppSchema):
    id: UUID
    name: str
    total_visits: int = 0
    last_visit_date: datetime.date | None = None


class PublicAvailableSlotsResponse(AppSchema):
    booked_windows: list[PublicBookedWindow]
