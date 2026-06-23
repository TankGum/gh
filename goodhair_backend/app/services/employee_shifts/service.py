from collections.abc import Sequence
from datetime import date
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ActivityAction, PermissionModule, ShiftType
from app.db.repositories.employee import EmployeeRepository
from app.db.repositories.employee_shift import EmployeeShiftRepository
from app.models.employee_shift import EmployeeShift
from app.schemas.employee_shift import ShiftUpsertItem
from app.services.activity_logs.service import ActivityLogService

_SHIFT_LABEL: dict[str, str] = {
    ShiftType.MORNING: "Ca sáng",
    ShiftType.AFTERNOON: "Ca chiều",
    ShiftType.FULL_DAY: "Cả ngày",
    ShiftType.OFF: "Nghỉ",
}


def _shift_label(value: str | None) -> str:
    if value is None:
        return "—"
    return _SHIFT_LABEL.get(value, value)  # type: ignore[arg-type]


class EmployeeShiftService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = EmployeeShiftRepository(session)
        self.emp_repo = EmployeeRepository(session)
        self.activity = ActivityLogService(session)

    async def list_shifts(
        self,
        *,
        employee_ids: list[UUID] | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> Sequence[EmployeeShift]:
        return await self.repo.list_shifts(
            employee_ids=employee_ids,
            start_date=start_date,
            end_date=end_date,
        )

    async def bulk_upsert(self, items: list[ShiftUpsertItem]) -> None:
        changes: list[dict[str, str]] = []

        for item in items:
            # Snapshot trạng thái cũ trước khi upsert
            existing = await self.repo.get_by_employee_and_date(item.employee_id, item.date)
            old_type: str | None = existing.shift_type if existing else None
            new_type: str = item.shift_type.value if hasattr(item.shift_type, "value") else str(item.shift_type)

            await self.repo.upsert(
                employee_id=item.employee_id,
                date_val=item.date,
                shift_type=item.shift_type,
            )

            # Bỏ qua nếu không có thay đổi thực sự
            if old_type == new_type:
                continue

            emp = await self.emp_repo.get_by_id(item.employee_id)
            emp_name = emp.name if emp else str(item.employee_id)
            date_str = item.date.strftime("%d/%m/%Y")

            changes.append({
                "label": f"{emp_name} · {date_str}",
                "from": _shift_label(old_type),
                "to": _shift_label(new_type),
            })

        if changes:
            count = len(changes)
            await self.activity.log(
                ActivityAction.UPDATE,
                PermissionModule.SHIFTS,
                entity_type="employee_shift",
                target_label=f"Cập nhật {count} ca làm việc",
                changes=changes,
            )
