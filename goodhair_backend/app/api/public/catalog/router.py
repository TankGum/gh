"""API public (không cần auth) cho homepage & màn bookings.

Chỉ trả các chi nhánh đang mở / dịch vụ & nhân viên đang hoạt động, với các
field cơ bản. Mọi field nhạy cảm (doanh thu, email, account_id...) đều bị ẩn
qua các schema Public* riêng.
"""

import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import BranchStatus, EmploymentStatus, ServiceStatus
from app.core.exceptions import ConflictError
from app.db.repositories.booking import BookingRepository
from app.db.repositories.booking_service_item import BookingServiceItemRepository
from app.db.repositories.customer import CustomerRepository
from app.db.repositories.role import RoleRepository
from app.db.session import get_db_session
from app.models.branch import Branch
from app.models.customer import Customer
from app.models.employee import Employee
from app.models.service import Service
from app.schemas.base import PageParams, PaginatedResponse
from app.schemas.public import (
    PublicAvailableSlotsResponse,
    PublicBookedWindow,
    PublicBookingCreate,
    PublicBookingRead,
    PublicBranchRead,
    PublicCustomerRead,
    PublicEmployeeRead,
    PublicServiceRead,
    PublicStatsResponse,
)
from app.services.branches.service import BranchService
from app.services.customers.service import CustomerService
from app.services.employees.service import EmployeeService
from app.services.services_catalog.service import ServiceCatalogService

router = APIRouter()


@router.get("/branches", response_model=PaginatedResponse[PublicBranchRead])
async def list_public_branches(
    q: str | None = Query(default=None),
    page: PageParams = Depends(),
    session: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[PublicBranchRead]:
    branches, total = await BranchService(session).list_branches(
        q=q, status=BranchStatus.OPEN, page=page
    )
    items = [PublicBranchRead.model_validate(b) for b in branches]
    return PaginatedResponse.create(items=items, total=total, page=page)


@router.get("/services", response_model=PaginatedResponse[PublicServiceRead])
async def list_public_services(
    q: str | None = Query(default=None),
    branch_id: UUID | None = Query(default=None, alias="branchId"),
    page: PageParams = Depends(),
    session: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[PublicServiceRead]:
    services, total = await ServiceCatalogService(session).list_services(
        q=q, branch_id=branch_id, status=ServiceStatus.ACTIVE, page=page
    )
    items = [PublicServiceRead.model_validate(s) for s in services]
    return PaginatedResponse.create(items=items, total=total, page=page)


@router.get("/top-customers", response_model=list[PublicCustomerRead])
async def list_top_customers(
    limit: int = Query(default=12, ge=1, le=50),
    session: AsyncSession = Depends(get_db_session),
) -> list[PublicCustomerRead]:
    items = await CustomerService(session).list_top_customers(limit=limit)
    return [PublicCustomerRead.model_validate(c) for c in items]


@router.get("/employees", response_model=PaginatedResponse[PublicEmployeeRead])
async def list_public_employees(
    branch_id: UUID | None = Query(default=None, alias="branchId"),
    page: PageParams = Depends(),
    session: AsyncSession = Depends(get_db_session),
) -> PaginatedResponse[PublicEmployeeRead]:
    employees, total = await EmployeeService(session).list_employees(
        branch_id=branch_id,
        role_id=None,
        status=EmploymentStatus.ACTIVE,
        page=page,
        bookable_only=True,
    )
    role_ids = {e.role_id for e in employees if e.role_id is not None}
    role_name_map: dict = {}
    if role_ids:
        all_roles = await RoleRepository(session).list_roles(offset=0, limit=200)
        role_name_map = {r.id: r.name for r in all_roles}
    items = [
        PublicEmployeeRead(
            id=e.id,
            name=e.name,
            display_name=e.display_name,
            avatar_url=e.avatar_url,
            branch_id=e.branch_id,
            role_name=role_name_map.get(e.role_id) if e.role_id else None,
        )
        for e in employees
    ]
    return PaginatedResponse.create(items=items, total=total, page=page)


@router.get("/available-slots", response_model=PublicAvailableSlotsResponse)
async def get_available_slots(
    employee_id: UUID = Query(..., alias="employeeId"),
    date: datetime.date = Query(...),
    session: AsyncSession = Depends(get_db_session),
) -> PublicAvailableSlotsResponse:
    windows = await BookingRepository(session).get_booked_windows(
        employee_id=employee_id, booking_date=date
    )
    return PublicAvailableSlotsResponse(
        booked_windows=[
            PublicBookedWindow(start_minutes=s, duration_minutes=d) for s, d in windows
        ]
    )


@router.post("/bookings", response_model=PublicBookingRead, status_code=201)
async def create_public_booking(
    payload: PublicBookingCreate,
    session: AsyncSession = Depends(get_db_session),
) -> PublicBookingRead:
    repo = BookingRepository(session)
    svc_item_repo = BookingServiceItemRepository(session)
    if payload.employee_id and payload.duration_minutes > 0:
        overlap = await repo.check_overlap(
            employee_id=payload.employee_id,
            booking_date=payload.date,
            start_time=payload.start_time,
            duration_minutes=payload.duration_minutes,
        )
        if overlap:
            raise ConflictError()
    code = await repo.get_next_code()
    data = payload.model_dump(exclude={"service_ids"})
    data["code"] = code
    data["status"] = "pending"
    booking = await repo.create(data)
    if payload.service_ids:
        await svc_item_repo.set_services(booking.id, payload.service_ids)
    customer_repo = CustomerRepository(session)
    customer = await customer_repo.get_by_phone(booking.customer_phone)
    if customer is None:
        await customer_repo.create({
            "name": booking.customer_name,
            "phone": booking.customer_phone,
            "last_visit_date": booking.date,
        })
    else:
        await customer_repo.update(customer, {
            "name": booking.customer_name,
            "last_visit_date": booking.date,
        })
    return PublicBookingRead(
        code=booking.code,
        customer_name=booking.customer_name,
        date=booking.date,
        start_time=booking.start_time,
        total=booking.total,
    )


@router.get("/stats", response_model=PublicStatsResponse)
async def get_public_stats(
    session: AsyncSession = Depends(get_db_session),
) -> PublicStatsResponse:
    branches = await session.scalar(
        select(func.count()).select_from(Branch).where(
            Branch.status == BranchStatus.OPEN,
            Branch.deleted_at.is_(None),
        )
    ) or 0

    services = await session.scalar(
        select(func.count()).select_from(Service).where(
            Service.status == ServiceStatus.ACTIVE,
            Service.deleted_at.is_(None),
        )
    ) or 0

    barbers = await session.scalar(
        select(func.count()).select_from(Employee).where(
            Employee.status == EmploymentStatus.ACTIVE,
            Employee.deleted_at.is_(None),
        )
    ) or 0

    return PublicStatsResponse(
        branches=branches,
        services=services,
        barbers=barbers,
    )
