from datetime import date
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ActivityAction, BookingStatus, PermissionModule
from app.core.diff import compute_changes
from app.core.exceptions import BadRequestError, ConflictError, NotFoundError
from app.db.repositories.booking import BookingRepository
from app.db.repositories.booking_service_item import BookingServiceItemRepository
from app.db.repositories.customer import CustomerRepository
from app.db.repositories.employee import EmployeeRepository
from app.models.booking import Booking
from app.schemas.base import PageParams
from app.schemas.booking import BookingCreate, BookingUpdate
from app.services.activity_logs.labels import BOOKING_LABELS
from app.services.activity_logs.service import ActivityLogService


STATUS_LABEL: dict[str, str] = {
    "pending": "Chờ xác nhận",
    "confirmed": "Đã xác nhận",
    "completed": "Hoàn tất",
    "cancelled": "Đã huỷ",
}


class BookingService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = BookingRepository(session)
        self.svc_item_repo = BookingServiceItemRepository(session)
        self.customer_repo = CustomerRepository(session)
        self.emp_repo = EmployeeRepository(session)
        self.activity = ActivityLogService(session)

    def _booking_target(self, booking: Booking) -> str:
        return f"{booking.code} · {booking.customer_name}"

    async def list_bookings(
        self,
        *,
        date_filter: date | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        branch_id: UUID | None = None,
        employee_id: UUID | None = None,
        status: BookingStatus | None = None,
        page: PageParams,
    ) -> tuple[list[Booking], int]:
        items = await self.repo.list_bookings(
            date_filter=date_filter,
            start_date=start_date,
            end_date=end_date,
            branch_id=branch_id,
            employee_id=employee_id,
            status=status,
            offset=page.offset,
            limit=page.size,
        )
        total = await self.repo.count_bookings(
            date_filter=date_filter,
            start_date=start_date,
            end_date=end_date,
            branch_id=branch_id,
            employee_id=employee_id,
            status=status,
        )
        return list(items), total

    async def get_by_id(self, booking_id: UUID) -> Booking:
        booking = await self.repo.get_by_id(booking_id)
        if booking is None or booking.deleted_at is not None:
            raise NotFoundError(detail={"resource": "booking", "id": str(booking_id)})
        return booking

    async def create(self, data: BookingCreate) -> Booking:
        if data.employee_id and data.duration_minutes > 0:
            overlap = await self.repo.check_overlap(
                employee_id=data.employee_id,
                booking_date=data.date,
                start_time=data.start_time,
                duration_minutes=data.duration_minutes,
            )
            if overlap:
                raise ConflictError()
        code = await self.repo.get_next_code()
        payload = data.model_dump(exclude={"service_ids"})
        payload["code"] = code
        booking = await self.repo.create(payload)
        if data.service_ids:
            await self.svc_item_repo.set_services(booking.id, data.service_ids)
        await self._sync_customer(booking)
        await self.activity.log(
            ActivityAction.CREATE,
            PermissionModule.BOOKINGS,
            entity_type="booking",
            entity_id=booking.id,
            target_label=self._booking_target(booking),
        )
        return booking

    async def update(self, booking_id: UUID, data: BookingUpdate) -> Booking:
        booking = await self.get_by_id(booking_id)
        if booking.status == BookingStatus.COMPLETED:
            raise BadRequestError(
                message_key="errors.booking.completed",
                detail={"message": "Không thể cập nhật lịch hẹn đã hoàn thành"},
            )
        effective_employee_id = data.employee_id if data.employee_id is not None else booking.employee_id
        effective_date = data.date if data.date is not None else booking.date
        effective_start = data.start_time if data.start_time is not None else booking.start_time
        effective_duration = data.duration_minutes if data.duration_minutes is not None else booking.duration_minutes
        if effective_employee_id and effective_duration > 0:
            overlap = await self.repo.check_overlap(
                employee_id=effective_employee_id,
                booking_date=effective_date,
                start_time=effective_start,
                duration_minutes=effective_duration,
                exclude_id=booking_id,
            )
            if overlap:
                raise ConflictError()
        was_completed = booking.status == BookingStatus.COMPLETED
        payload = data.model_dump(exclude={"service_ids"}, exclude_unset=True)
        if payload:
            before = {k: getattr(booking, k) for k in payload}
            await self.repo.update(booking, payload)
            await self.activity.log(
                ActivityAction.UPDATE,
                PermissionModule.BOOKINGS,
                entity_type="booking",
                entity_id=booking.id,
                target_label=self._booking_target(booking),
                changes=compute_changes(before, payload, BOOKING_LABELS, formatters={
                    "status": lambda v: STATUS_LABEL.get(str(v), str(v)),
                }),
            )
        if data.service_ids is not None:
            await self.svc_item_repo.set_services(booking_id, data.service_ids)
        became_completed = (
            data.status == BookingStatus.COMPLETED
            and not was_completed
            and booking.employee_id is not None
        )
        if became_completed:
            emp = await self.emp_repo.get_by_id(booking.employee_id)
            if emp:
                await self.emp_repo.update(emp, {
                    "total_bookings": emp.total_bookings + 1,
                    "total_revenue": emp.total_revenue + booking.total,
                })
            await self._sync_customer(booking, add_stats=True)
        return booking

    async def delete(self, booking_id: UUID) -> None:
        booking = await self.get_by_id(booking_id)
        await self.repo.soft_delete(booking)
        await self.activity.log(
            ActivityAction.DELETE,
            PermissionModule.BOOKINGS,
            entity_type="booking",
            entity_id=booking.id,
            target_label=self._booking_target(booking),
        )

    async def load_service_ids(self, booking: Booking) -> list[UUID]:
        return await self.svc_item_repo.get_service_ids(booking.id)

    async def _sync_customer(self, booking: Booking, *, add_stats: bool = False) -> None:
        customer = await self.customer_repo.get_by_phone(booking.customer_phone)
        if customer is None:
            payload = {
                "name": booking.customer_name,
                "phone": booking.customer_phone,
                "last_visit_date": booking.date,
            }
            if add_stats:
                payload["total_visits"] = 1
                payload["total_spent"] = booking.total
            new_customer = await self.customer_repo.create(payload)
            await self.activity.log(
                ActivityAction.CREATE,
                PermissionModule.CUSTOMERS,
                entity_type="customer",
                entity_id=new_customer.id,
                target_label=f"{booking.customer_name} · {booking.customer_phone}",
                changes=[
                    {"label": "Nguồn", "from": "—", "to": "Tạo tự động từ booking"}
                ],
            )
        else:
            payload = {"name": booking.customer_name, "last_visit_date": booking.date}
            if add_stats:
                payload["total_visits"] = customer.total_visits + 1
                payload["total_spent"] = customer.total_spent + booking.total
            await self.customer_repo.update(customer, payload)
