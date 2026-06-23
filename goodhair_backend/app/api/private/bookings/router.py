from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_permission
from app.core.constants import PermissionAction, PermissionModule
from app.db.session import get_db_session
from app.schemas.base import PaginatedResponse
from app.schemas.booking import BookingCreate, BookingListParams, BookingRead, BookingUpdate
from app.services.bookings.service import BookingService

router = APIRouter()


def get_booking_service(
    session: AsyncSession = Depends(get_db_session),
) -> BookingService:
    return BookingService(session=session)


@router.get("", response_model=PaginatedResponse[BookingRead])
async def list_bookings(
    params: BookingListParams = Depends(),
    service: BookingService = Depends(get_booking_service),
    _: None = Depends(
        require_permission(PermissionModule.BOOKINGS, PermissionAction.VIEW)
    ),
) -> PaginatedResponse[BookingRead]:
    items, total = await service.list_bookings(
        date_filter=params.date,
        start_date=params.start_date,
        end_date=params.end_date,
        branch_id=params.branch_id,
        employee_id=params.employee_id,
        status=params.status,
        page=params,
    )
    results = []
    for b in items:
        r = BookingRead.model_validate(b)
        r.service_ids = await service.load_service_ids(b)
        results.append(r)
    return PaginatedResponse.create(items=results, total=total, page=params)


@router.post("", response_model=BookingRead, status_code=status.HTTP_201_CREATED)
async def create_booking(
    payload: BookingCreate,
    service: BookingService = Depends(get_booking_service),
    _: None = Depends(
        require_permission(PermissionModule.BOOKINGS, PermissionAction.CREATE)
    ),
) -> BookingRead:
    booking = await service.create(payload)
    r = BookingRead.model_validate(booking)
    r.service_ids = await service.load_service_ids(booking)
    return r


@router.get("/{booking_id}", response_model=BookingRead)
async def get_booking(
    booking_id: UUID,
    service: BookingService = Depends(get_booking_service),
    _: None = Depends(
        require_permission(PermissionModule.BOOKINGS, PermissionAction.VIEW)
    ),
) -> BookingRead:
    booking = await service.get_by_id(booking_id)
    r = BookingRead.model_validate(booking)
    r.service_ids = await service.load_service_ids(booking)
    return r


@router.patch("/{booking_id}", response_model=BookingRead)
async def update_booking(
    booking_id: UUID,
    payload: BookingUpdate,
    service: BookingService = Depends(get_booking_service),
    _: None = Depends(
        require_permission(PermissionModule.BOOKINGS, PermissionAction.EDIT)
    ),
) -> BookingRead:
    booking = await service.update(booking_id, payload)
    r = BookingRead.model_validate(booking)
    r.service_ids = await service.load_service_ids(booking)
    return r


@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_booking(
    booking_id: UUID,
    service: BookingService = Depends(get_booking_service),
    _: None = Depends(
        require_permission(PermissionModule.BOOKINGS, PermissionAction.DELETE)
    ),
) -> None:
    await service.delete(booking_id)
