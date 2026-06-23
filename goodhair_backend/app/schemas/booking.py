import datetime
from uuid import UUID

from app.core.constants import BookingStatus
from app.schemas.base import AppSchema, PageParams


class BookingRead(AppSchema):
    id: UUID
    code: str
    customer_name: str
    customer_phone: str
    employee_id: UUID | None = None
    branch_id: UUID | None = None
    date: datetime.date
    start_time: datetime.time
    duration_minutes: int = 0
    total: int = 0
    status: BookingStatus = BookingStatus.PENDING
    service_ids: list[UUID] = []


class BookingCreate(AppSchema):
    customer_name: str
    customer_phone: str
    employee_id: UUID | None = None
    branch_id: UUID | None = None
    date: datetime.date
    start_time: datetime.time
    duration_minutes: int = 0
    total: int = 0
    status: BookingStatus = BookingStatus.PENDING
    service_ids: list[UUID] = []


class BookingUpdate(AppSchema):
    customer_name: str | None = None
    customer_phone: str | None = None
    employee_id: UUID | None = None
    branch_id: UUID | None = None
    date: datetime.date | None = None
    start_time: datetime.time | None = None
    duration_minutes: int | None = None
    total: int | None = None
    status: BookingStatus | None = None
    service_ids: list[UUID] | None = None


class BookingListParams(PageParams):
    date: datetime.date | None = None
    start_date: datetime.date | None = None
    end_date: datetime.date | None = None
    branch_id: UUID | None = None
    employee_id: UUID | None = None
    status: BookingStatus | None = None
