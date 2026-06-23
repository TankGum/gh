from datetime import date
from uuid import UUID

from app.schemas.base import AppSchema


class CustomerRead(AppSchema):
    id: UUID
    name: str
    phone: str
    total_visits: int = 0
    total_spent: int = 0
    last_visit_date: date | None = None
