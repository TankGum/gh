from collections.abc import Sequence
from datetime import date
from uuid import UUID

from sqlalchemy import delete, select, func

from app.db.repositories.base import BaseRepository
from app.models.employee_shift import EmployeeShift


class EmployeeShiftRepository(BaseRepository[EmployeeShift]):
    model = EmployeeShift

    async def list_shifts(
        self,
        *,
        employee_ids: list[UUID] | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> Sequence[EmployeeShift]:
        q = select(EmployeeShift)
        if employee_ids:
            q = q.where(EmployeeShift.employee_id.in_(employee_ids))
        if start_date:
            q = q.where(EmployeeShift.date >= start_date)
        if end_date:
            q = q.where(EmployeeShift.date <= end_date)
        q = q.order_by(EmployeeShift.date, EmployeeShift.employee_id)
        result = await self.session.scalars(q)
        return result.all()

    async def get_by_employee_and_date(
        self, employee_id: UUID, date_val: date
    ) -> EmployeeShift | None:
        return await self.session.scalar(
            select(EmployeeShift).where(
                EmployeeShift.employee_id == employee_id,
                EmployeeShift.date == date_val,
            )
        )

    async def upsert(self, employee_id: UUID, date_val: date, shift_type: str) -> EmployeeShift:
        stmt = select(EmployeeShift).where(
            EmployeeShift.employee_id == employee_id,
            EmployeeShift.date == date_val,
        )
        existing = await self.session.scalar(stmt)
        if existing:
            existing.shift_type = shift_type
            await self.session.flush()
            await self.session.refresh(existing)
            return existing
        return await self.create({
            "employee_id": employee_id,
            "date": date_val,
            "shift_type": shift_type,
        })

    async def bulk_upsert(self, shifts: list[tuple[UUID, date, str]]) -> None:
        for employee_id, date_val, shift_type in shifts:
            await self.upsert(employee_id, date_val, shift_type)

    async def delete_by_employee_and_date(self, employee_id: UUID, date_val: date) -> None:
        await self.session.execute(
            delete(EmployeeShift).where(
                EmployeeShift.employee_id == employee_id,
                EmployeeShift.date == date_val,
            )
        )
        await self.session.flush()
