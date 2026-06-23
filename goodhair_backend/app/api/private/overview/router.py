from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_permission
from app.core.constants import PermissionAction, PermissionModule
from app.db.session import get_db_session
from app.schemas.overview import OverviewResponse
from app.services.overview.service import OverviewService

router = APIRouter()


@router.get("", response_model=OverviewResponse)
async def get_overview(
    session: AsyncSession = Depends(get_db_session),
    _: None = Depends(require_permission(PermissionModule.OVERVIEW, PermissionAction.VIEW)),
) -> OverviewResponse:
    service = OverviewService(session)
    return await service.get_overview()
