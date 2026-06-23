import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_permission
from app.core.constants import PermissionAction, PermissionModule
from app.db.session import get_db_session
from app.schemas.revenue import (
    RevenueByBranch,
    RevenueByEmployee,
    RevenueByService,
    RevenueDailyItem,
    RevenueSummary,
)
from app.services.revenue.service import RevenueService

router = APIRouter()


def get_revenue_service(
    session: AsyncSession = Depends(get_db_session),
) -> RevenueService:
    return RevenueService(session=session)


@router.get("/summary", response_model=RevenueSummary)
async def revenue_summary(
    start_date: datetime.date = Query(alias="startDate"),
    end_date: datetime.date = Query(alias="endDate"),
    service: RevenueService = Depends(get_revenue_service),
    _: None = Depends(
        require_permission(PermissionModule.REVENUE, PermissionAction.VIEW)
    ),
) -> RevenueSummary:
    return await service.get_summary(start_date, end_date)


@router.get("/daily", response_model=list[RevenueDailyItem])
async def revenue_daily(
    start_date: datetime.date = Query(alias="startDate"),
    end_date: datetime.date = Query(alias="endDate"),
    service: RevenueService = Depends(get_revenue_service),
    _: None = Depends(
        require_permission(PermissionModule.REVENUE, PermissionAction.VIEW)
    ),
) -> list[RevenueDailyItem]:
    return await service.get_daily(start_date, end_date)


@router.get("/by-branch", response_model=list[RevenueByBranch])
async def revenue_by_branch(
    start_date: datetime.date = Query(alias="startDate"),
    end_date: datetime.date = Query(alias="endDate"),
    service: RevenueService = Depends(get_revenue_service),
    _: None = Depends(
        require_permission(PermissionModule.REVENUE, PermissionAction.VIEW)
    ),
) -> list[RevenueByBranch]:
    return await service.get_by_branch(start_date, end_date)


@router.get("/by-service", response_model=list[RevenueByService])
async def revenue_by_service(
    start_date: datetime.date = Query(alias="startDate"),
    end_date: datetime.date = Query(alias="endDate"),
    service: RevenueService = Depends(get_revenue_service),
    _: None = Depends(
        require_permission(PermissionModule.REVENUE, PermissionAction.VIEW)
    ),
) -> list[RevenueByService]:
    return await service.get_by_service(start_date, end_date)


@router.get("/by-employee", response_model=list[RevenueByEmployee])
async def revenue_by_employee(
    start_date: datetime.date = Query(alias="startDate"),
    end_date: datetime.date = Query(alias="endDate"),
    service: RevenueService = Depends(get_revenue_service),
    _: None = Depends(
        require_permission(PermissionModule.REVENUE, PermissionAction.VIEW)
    ),
) -> list[RevenueByEmployee]:
    return await service.get_by_employee(start_date, end_date)
