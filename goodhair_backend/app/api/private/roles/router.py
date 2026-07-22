from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_permission
from app.core.constants import PermissionAction, PermissionModule
from app.db.session import get_db_session
from app.schemas.base import PageParams, PaginatedResponse
from app.schemas.role import RoleCreate, RoleRead, RoleUpdate
from app.services.roles.service import RoleService

router = APIRouter()


def get_role_service(
    session: AsyncSession = Depends(get_db_session),
) -> RoleService:
    return RoleService(session=session)


@router.get("", response_model=PaginatedResponse[RoleRead])
async def list_roles(
    params: PageParams = Depends(),
    service: RoleService = Depends(get_role_service),
    _: None = Depends(
        require_permission(PermissionModule.ROLES, PermissionAction.VIEW)
    ),
) -> PaginatedResponse[RoleRead]:
    items, total = await service.list_roles(page=params)
    items = await service.enrich_with_employee_count(items)
    reads = [service.to_read(r) for r in items]
    return PaginatedResponse.create(items=reads, total=total, page=params)


@router.post("", response_model=RoleRead, status_code=status.HTTP_201_CREATED)
async def create_role(
    payload: RoleCreate,
    service: RoleService = Depends(get_role_service),
    _: None = Depends(
        require_permission(PermissionModule.ROLES, PermissionAction.CREATE)
    ),
) -> RoleRead:
    role = await service.create(payload)
    return service.to_read(role)


@router.patch("/{role_id}", response_model=RoleRead)
async def update_role(
    role_id: UUID,
    payload: RoleUpdate,
    service: RoleService = Depends(get_role_service),
    _: None = Depends(
        require_permission(PermissionModule.ROLES, PermissionAction.EDIT)
    ),
) -> RoleRead:
    role = await service.update(role_id, payload)
    return service.to_read(role)


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: UUID,
    service: RoleService = Depends(get_role_service),
    _: None = Depends(
        require_permission(PermissionModule.ROLES, PermissionAction.DELETE)
    ),
) -> None:
    await service.delete(role_id)
