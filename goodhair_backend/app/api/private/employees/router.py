from uuid import UUID

from fastapi import APIRouter, Depends, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_account_id, require_permission
from app.core.constants import PermissionAction, PermissionModule
from app.db.session import get_db_session
from app.schemas.base import PaginatedResponse
from app.schemas.employee import EmployeeImageUploadResult, EmployeeListParams, EmployeeRead, EmployeeUpdate
from app.services.employees.service import EmployeeService
from app.utils.image_storage import upload_employee_image as cloudinary_upload_employee

router = APIRouter()


def get_employee_service(
    session: AsyncSession = Depends(get_db_session),
) -> EmployeeService:
    return EmployeeService(session=session)


@router.get("", response_model=PaginatedResponse[EmployeeRead])
async def list_employees(
    params: EmployeeListParams = Depends(),
    service: EmployeeService = Depends(get_employee_service),
    _: None = Depends(
        require_permission(PermissionModule.STAFF, PermissionAction.VIEW)
    ),
) -> PaginatedResponse[EmployeeRead]:
    items, total = await service.list_employees(
        branch_id=params.branch_id,
        role_id=params.role_id,
        status=params.status,
        page=params,
    )
    return PaginatedResponse.create(items=items, total=total, page=params)


@router.post("/image", response_model=EmployeeImageUploadResult)
async def upload_employee_image(
    file: UploadFile,
    _: None = Depends(
        require_permission(PermissionModule.STAFF, PermissionAction.EDIT)
    ),
) -> EmployeeImageUploadResult:
    data = await file.read()
    image_url = await cloudinary_upload_employee(data=data, content_type=file.content_type)
    return EmployeeImageUploadResult(image_url=image_url)


@router.patch("/{employee_id}", response_model=EmployeeRead)
async def update_employee(
    employee_id: UUID,
    payload: EmployeeUpdate,
    service: EmployeeService = Depends(get_employee_service),
    current_account_id: UUID = Depends(get_current_account_id),
    _: None = Depends(
        require_permission(PermissionModule.STAFF, PermissionAction.EDIT)
    ),
) -> EmployeeRead:
    employee = await service.update(
        employee_id, payload, current_account_id=current_account_id
    )
    return EmployeeRead.model_validate(employee)


@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_employee(
    employee_id: UUID,
    service: EmployeeService = Depends(get_employee_service),
    _: None = Depends(
        require_permission(PermissionModule.STAFF, PermissionAction.DELETE)
    ),
) -> None:
    await service.delete(employee_id)
