from datetime import date
from uuid import UUID

from app.core.constants import ShiftType
from app.schemas.base import AppSchema


class ShiftRead(AppSchema):
    employee_id: UUID
    date: date
    shift_type: ShiftType


class ShiftUpsertItem(AppSchema):
    employee_id: UUID
    date: date
    shift_type: ShiftType


class ShiftBulkUpsert(AppSchema):
    shifts: list[ShiftUpsertItem]


class ShiftQueryParams(AppSchema):
    employee_ids: list[UUID] | None = None
    start_date: date | None = None
    end_date: date | None = None
