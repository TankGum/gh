from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_permission
from app.core.constants import PermissionAction, PermissionModule
from app.db.session import get_db_session
from app.schemas.employee_shift import ShiftBulkUpsert, ShiftQueryParams, ShiftRead
from app.services.employee_shifts.service import EmployeeShiftService

router = APIRouter()


def get_shift_service(
    session: AsyncSession = Depends(get_db_session),
) -> EmployeeShiftService:
    return EmployeeShiftService(session=session)


@router.get("", response_model=list[ShiftRead])
async def list_shifts(
    params: ShiftQueryParams = Depends(),
    service: EmployeeShiftService = Depends(get_shift_service),
    _: None = Depends(
        require_permission(PermissionModule.SHIFTS, PermissionAction.VIEW)
    ),
) -> list[ShiftRead]:
    shifts = await service.list_shifts(
        employee_ids=params.employee_ids,
        start_date=params.start_date,
        end_date=params.end_date,
    )
    return [ShiftRead.model_validate(s) for s in shifts]


@router.put("/bulk", status_code=204)
async def bulk_upsert_shifts(
    payload: ShiftBulkUpsert,
    service: EmployeeShiftService = Depends(get_shift_service),
    _: None = Depends(
        require_permission(PermissionModule.SHIFTS, PermissionAction.EDIT)
    ),
) -> None:
    await service.bulk_upsert(payload.shifts)
