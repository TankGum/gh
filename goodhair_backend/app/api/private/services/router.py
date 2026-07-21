from uuid import UUID

from fastapi import APIRouter, Depends, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_permission
from app.core.constants import PermissionAction, PermissionModule, ServiceStatus
from app.db.session import get_db_session
from app.schemas.base import PageParams, PaginatedResponse
from app.schemas.service import (
    ServiceCreate,
    ServiceImageUploadResult,
    ServiceRead,
    ServiceUpdate,
)
from app.services.services_catalog.service import ServiceCatalogService
from app.utils.image_storage import upload_service_image as cloudinary_upload_service

router = APIRouter()


def get_service_catalog_service(
    session: AsyncSession = Depends(get_db_session),
) -> ServiceCatalogService:
    return ServiceCatalogService(session=session)


@router.get("", response_model=PaginatedResponse[ServiceRead])
async def list_services(
    q: str | None = Query(default=None, description="Tìm theo tên dịch vụ"),
    branch_id: UUID | None = Query(default=None, alias="branchId"),
    status_filter: ServiceStatus | None = Query(default=None, alias="status"),
    page: PageParams = Depends(),
    service: ServiceCatalogService = Depends(get_service_catalog_service),
    _: None = Depends(
        require_permission(PermissionModule.SERVICES, PermissionAction.VIEW)
    ),
) -> PaginatedResponse[ServiceRead]:
    items, total = await service.list_services(
        q=q,
        branch_id=branch_id,
        status=status_filter,
        page=page,
    )
    return PaginatedResponse.create(items=items, total=total, page=page)


@router.post("/image", response_model=ServiceImageUploadResult)
async def upload_service_image(
    file: UploadFile,
    _: None = Depends(
        require_permission(PermissionModule.SERVICES, PermissionAction.CREATE)
    ),
) -> ServiceImageUploadResult:
    data = await file.read()
    image_url = await cloudinary_upload_service(data=data, content_type=file.content_type)
    return ServiceImageUploadResult(image_url=image_url)


@router.post("", response_model=ServiceRead, status_code=status.HTTP_201_CREATED)
async def create_service(
    payload: ServiceCreate,
    service: ServiceCatalogService = Depends(get_service_catalog_service),
    _: None = Depends(
        require_permission(PermissionModule.SERVICES, PermissionAction.CREATE)
    ),
) -> ServiceRead:
    return await service.create_service(payload)


@router.get("/{service_id}", response_model=ServiceRead)
async def get_service(
    service_id: UUID,
    service: ServiceCatalogService = Depends(get_service_catalog_service),
    _: None = Depends(
        require_permission(PermissionModule.SERVICES, PermissionAction.VIEW)
    ),
) -> ServiceRead:
    return await service.get_service(service_id)


@router.patch("/{service_id}", response_model=ServiceRead)
async def update_service(
    service_id: UUID,
    payload: ServiceUpdate,
    service: ServiceCatalogService = Depends(get_service_catalog_service),
    _: None = Depends(
        require_permission(PermissionModule.SERVICES, PermissionAction.EDIT)
    ),
) -> ServiceRead:
    return await service.update_service(service_id=service_id, payload=payload)


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_service(
    service_id: UUID,
    service: ServiceCatalogService = Depends(get_service_catalog_service),
    _: None = Depends(
        require_permission(PermissionModule.SERVICES, PermissionAction.DELETE)
    ),
) -> None:
    await service.delete_service(service_id)
