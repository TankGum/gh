from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_permission
from app.core.constants import PermissionAction, PermissionModule
from app.core.exceptions import NotFoundError
from app.db.session import get_db_session
from app.schemas.activity_log import (
    ActivityLogListItem,
    ActivityLogListParams,
    ActivityLogRead,
)
from app.schemas.base import PaginatedResponse
from app.services.activity_logs.service import ActivityLogService

router = APIRouter()


@router.get("", response_model=PaginatedResponse[ActivityLogListItem])
async def list_logs(
    params: ActivityLogListParams = Depends(),
    session: AsyncSession = Depends(get_db_session),
    _: None = Depends(
        require_permission(PermissionModule.LOGS, PermissionAction.VIEW)
    ),
) -> PaginatedResponse[ActivityLogListItem]:
    items, total = await ActivityLogService(session).list_logs(params)
    return PaginatedResponse.create(items=items, total=total, page=params)


@router.get("/{log_id}", response_model=ActivityLogRead)
async def get_log(
    log_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    _: None = Depends(
        require_permission(PermissionModule.LOGS, PermissionAction.VIEW)
    ),
) -> ActivityLogRead:
    log = await ActivityLogService(session).get_log(log_id)
    if log is None:
        raise NotFoundError(detail={"resource": "activity_log", "id": str(log_id)})
    return ActivityLogRead.model_validate(log)
