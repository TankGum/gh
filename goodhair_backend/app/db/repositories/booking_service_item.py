from uuid import UUID

from sqlalchemy import delete, select

from app.db.repositories.base import BaseRepository
from app.models.booking_service_item import BookingServiceItem


class BookingServiceItemRepository(BaseRepository[BookingServiceItem]):
    model = BookingServiceItem

    async def get_service_ids(self, booking_id: UUID) -> list[UUID]:
        result = await self.session.scalars(
            select(BookingServiceItem.service_id).where(
                BookingServiceItem.booking_id == booking_id,
            )
        )
        return list(result.all())

    async def set_services(self, booking_id: UUID, service_ids: list[UUID]) -> None:
        await self.session.execute(
            delete(BookingServiceItem).where(
                BookingServiceItem.booking_id == booking_id,
            )
        )
        for sid in service_ids:
            self.session.add(BookingServiceItem(booking_id=booking_id, service_id=sid))
        await self.session.flush()
