from datetime import date
from uuid import UUID

from app.schemas.base import AppSchema


class CustomerServiceBreakdown(AppSchema):
    service_id: UUID | None
    service_name: str
    service_description: str | None = None
    count: int


class CustomerRead(AppSchema):
    id: UUID
    name: str
    phone: str
    total_visits: int = 0
    total_spent: int = 0
    last_visit_date: date | None = None
    service_breakdown: list[CustomerServiceBreakdown] = []
