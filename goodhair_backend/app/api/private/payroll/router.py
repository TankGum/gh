from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import (
    get_current_account_id,
    get_current_permissions,
    require_permission,
)
from app.core.constants import PermissionAction, PermissionModule
from app.core.exceptions import ForbiddenError, NotFoundError
from app.core.permissions import PermissionTree, has_permission
from app.db.repositories.employee import EmployeeRepository
from app.db.session import get_db_session
from app.schemas.payroll import (
    PayrollDetail,
    PayrollEmployeeSummary,
    PayrollLockRequest,
    PayrollLockStatus,
    PayrollPeriodInfo,
)
from app.services.payroll.service import PayrollService

router = APIRouter()


def get_payroll_service(
    session: AsyncSession = Depends(get_db_session),
) -> PayrollService:
    return PayrollService(session=session)


async def _own_employee_id(account_id: UUID, session: AsyncSession) -> UUID:
    employee = await EmployeeRepository(session).get_by_account_id(account_id)
    if employee is None:
        raise NotFoundError(detail={"resource": "employee", "id": str(account_id)})
    return employee.id


@router.get("", response_model=list[PayrollEmployeeSummary])
async def list_payroll(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    branch_id: UUID | None = Query(default=None, alias="branchId"),
    employee_id: UUID | None = Query(default=None, alias="employeeId"),
    account_id: UUID = Depends(get_current_account_id),
    permissions: PermissionTree = Depends(get_current_permissions),
    session: AsyncSession = Depends(get_db_session),
    service: PayrollService = Depends(get_payroll_service),
) -> list[PayrollEmployeeSummary]:
    """Không có quyền `payroll.view` -> chỉ trả về bảng lương của chính mình,
    bỏ qua mọi filter được truyền lên."""
    can_view_all = has_permission(
        permissions, PermissionModule.PAYROLL, PermissionAction.VIEW
    )
    if not can_view_all:
        branch_id = None
        employee_id = await _own_employee_id(account_id, session)
    return await service.get_summary(
        month=month, branch_id=branch_id, employee_id=employee_id
    )


@router.get("/period-info", response_model=PayrollPeriodInfo)
async def get_period_info(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    _: UUID = Depends(get_current_account_id),
    service: PayrollService = Depends(get_payroll_service),
) -> PayrollPeriodInfo:
    return service.get_period_info(month)


@router.get("/lock-status", response_model=PayrollLockStatus)
async def get_lock_status(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    _: UUID = Depends(get_current_account_id),
    service: PayrollService = Depends(get_payroll_service),
) -> PayrollLockStatus:
    return await service.get_lock_status(month)


@router.post("/lock", status_code=status.HTTP_204_NO_CONTENT)
async def lock_payroll(
    payload: PayrollLockRequest,
    account_id: UUID = Depends(get_current_account_id),
    service: PayrollService = Depends(get_payroll_service),
    _: None = Depends(
        require_permission(PermissionModule.PAYROLL, PermissionAction.EDIT)
    ),
) -> None:
    await service.lock_month(payload.month, account_id)


@router.delete("/lock", status_code=status.HTTP_204_NO_CONTENT)
async def unlock_payroll(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    service: PayrollService = Depends(get_payroll_service),
    _: None = Depends(
        require_permission(PermissionModule.PAYROLL, PermissionAction.DELETE)
    ),
) -> None:
    await service.unlock_month(month)


@router.get("/{employee_id}", response_model=PayrollDetail)
async def get_payroll_detail(
    employee_id: UUID,
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    account_id: UUID = Depends(get_current_account_id),
    permissions: PermissionTree = Depends(get_current_permissions),
    session: AsyncSession = Depends(get_db_session),
    service: PayrollService = Depends(get_payroll_service),
) -> PayrollDetail:
    can_view_all = has_permission(
        permissions, PermissionModule.PAYROLL, PermissionAction.VIEW
    )
    if not can_view_all:
        own_id = await _own_employee_id(account_id, session)
        if own_id != employee_id:
            raise ForbiddenError(message_key="errors.auth.forbidden")
    return await service.get_detail(employee_id=employee_id, month=month)
