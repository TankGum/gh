from uuid import UUID

from fastapi import APIRouter, Depends, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_permission
from app.core.constants import BranchStatus, PermissionAction, PermissionModule
from app.db.session import get_db_session
from app.schemas.base import PageParams, PaginatedResponse
from app.schemas.branch import (
    BranchCreate,
    BranchImageUploadResult,
    BranchRead,
    BranchUpdate,
)
from app.services.branches.service import BranchService
from app.utils.image_storage import upload_branch_image as cloudinary_upload_branch

router = APIRouter()


def get_branch_service(
    session: AsyncSession = Depends(get_db_session),
) -> BranchService:
    return BranchService(session=session)


@router.get("", response_model=PaginatedResponse[BranchRead])
async def list_branches(
    q: str | None = Query(default=None, description="Tìm theo tên / địa chỉ"),
    status_filter: BranchStatus | None = Query(default=None, alias="status"),
    page: PageParams = Depends(),
    service: BranchService = Depends(get_branch_service),
    _: None = Depends(
        require_permission(PermissionModule.BRANCHES, PermissionAction.VIEW)
    ),
) -> PaginatedResponse[BranchRead]:
    items, total = await service.list_branches(q=q, status=status_filter, page=page)
    return PaginatedResponse.create(items=items, total=total, page=page)


@router.post("/image", response_model=BranchImageUploadResult)
async def upload_branch_image(
    file: UploadFile,
    _: None = Depends(
        require_permission(PermissionModule.BRANCHES, PermissionAction.CREATE)
    ),
) -> BranchImageUploadResult:
    data = await file.read()
    image_url = await cloudinary_upload_branch(data=data, content_type=file.content_type)
    return BranchImageUploadResult(image_url=image_url)


@router.post("", response_model=BranchRead, status_code=status.HTTP_201_CREATED)
async def create_branch(
    payload: BranchCreate,
    service: BranchService = Depends(get_branch_service),
    _: None = Depends(
        require_permission(PermissionModule.BRANCHES, PermissionAction.CREATE)
    ),
) -> BranchRead:
    return await service.create_branch(payload)


@router.get("/{branch_id}", response_model=BranchRead)
async def get_branch(
    branch_id: UUID,
    service: BranchService = Depends(get_branch_service),
    _: None = Depends(
        require_permission(PermissionModule.BRANCHES, PermissionAction.VIEW)
    ),
) -> BranchRead:
    return await service.get_branch(branch_id)


@router.patch("/{branch_id}", response_model=BranchRead)
async def update_branch(
    branch_id: UUID,
    payload: BranchUpdate,
    service: BranchService = Depends(get_branch_service),
    _: None = Depends(
        require_permission(PermissionModule.BRANCHES, PermissionAction.EDIT)
    ),
) -> BranchRead:
    return await service.update_branch(branch_id=branch_id, payload=payload)


@router.delete("/{branch_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_branch(
    branch_id: UUID,
    service: BranchService = Depends(get_branch_service),
    _: None = Depends(
        require_permission(PermissionModule.BRANCHES, PermissionAction.DELETE)
    ),
) -> None:
    await service.delete_branch(branch_id)
