from collections.abc import Sequence
from datetime import date, time
from hashlib import md5
from uuid import UUID

from sqlalchemy import select, func, text

from app.core.constants import BookingStatus
from app.db.repositories.base import BaseRepository
from app.models.booking import Booking


class BookingRepository(BaseRepository[Booking]):
    model = Booking

    async def list_bookings(
        self,
        *,
        date_filter: date | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        branch_id: UUID | None = None,
        employee_id: UUID | None = None,
        status: BookingStatus | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> Sequence[Booking]:
        q = select(Booking).where(Booking.deleted_at.is_(None))
        if date_filter is not None:
            q = q.where(Booking.date == date_filter)
        if start_date is not None:
            q = q.where(Booking.date >= start_date)
        if end_date is not None:
            q = q.where(Booking.date <= end_date)
        if branch_id is not None:
            q = q.where(Booking.branch_id == branch_id)
        if employee_id is not None:
            q = q.where(Booking.employee_id == employee_id)
        if status is not None:
            q = q.where(Booking.status == status)
        q = q.order_by(Booking.date, Booking.start_time).offset(offset).limit(limit)
        result = await self.session.scalars(q)
        return result.all()

    async def count_bookings(
        self,
        *,
        date_filter: date | None = None,
        start_date: date | None = None,
        end_date: date | None = None,
        branch_id: UUID | None = None,
        employee_id: UUID | None = None,
        status: BookingStatus | None = None,
    ) -> int:
        q = select(func.count()).select_from(Booking).where(Booking.deleted_at.is_(None))
        if date_filter is not None:
            q = q.where(Booking.date == date_filter)
        if start_date is not None:
            q = q.where(Booking.date >= start_date)
        if end_date is not None:
            q = q.where(Booking.date <= end_date)
        if branch_id is not None:
            q = q.where(Booking.branch_id == branch_id)
        if employee_id is not None:
            q = q.where(Booking.employee_id == employee_id)
        if status is not None:
            q = q.where(Booking.status == status)
        result = await self.session.scalar(q)
        return int(result or 0)

    async def get_by_code(self, code: str) -> Booking | None:
        return await self.session.scalar(
            select(Booking).where(Booking.code == code)
        )

    async def get_next_code(self) -> str:
        result = await self.session.scalar(
            select(func.max(Booking.code))
        )
        if result is None:
            return "GH-0001"
        num = int(result.replace("GH-", ""))
        return f"GH-{num + 1:04d}"

    async def get_booked_windows(
        self,
        *,
        employee_id: UUID,
        booking_date: date,
    ) -> list[tuple[int, int]]:
        """Return (start_minutes, duration_minutes) for all active bookings of employee on date."""
        q = select(Booking).where(
            Booking.deleted_at.is_(None),
            Booking.employee_id == employee_id,
            Booking.date == booking_date,
            Booking.status != BookingStatus.CANCELLED,
        )
        result = await self.session.scalars(q)
        windows = []
        for b in result.all():
            start_min = b.start_time.hour * 60 + b.start_time.minute
            windows.append((start_min, b.duration_minutes))
        return windows

    async def check_overlap(
        self,
        *,
        employee_id: UUID,
        booking_date: date,
        start_time: time,
        duration_minutes: int,
        exclude_id: UUID | None = None,
    ) -> Booking | None:
        key_bytes = str(employee_id).encode() + str(booking_date).encode()
        lock_id = int.from_bytes(md5(key_bytes).digest()[:8], 'big', signed=True)
        await self.session.execute(
            text("SELECT pg_advisory_xact_lock(:lock_id)"),
            {"lock_id": lock_id},
        )
        start_minutes = start_time.hour * 60 + start_time.minute
        end_minutes = start_minutes + duration_minutes
        q = select(Booking).where(
            Booking.deleted_at.is_(None),
            Booking.employee_id == employee_id,
            Booking.date == booking_date,
            Booking.status != BookingStatus.CANCELLED,
        )
        if exclude_id is not None:
            q = q.where(Booking.id != exclude_id)
        q = q.with_for_update()
        existing = await self.session.scalars(q)
        for b in existing:
            b_start = b.start_time.hour * 60 + b.start_time.minute
            b_end = b_start + b.duration_minutes
            if start_minutes < b_end and end_minutes > b_start:
                return b
        return None
