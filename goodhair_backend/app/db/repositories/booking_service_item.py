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

    async def snapshot_commission(
        self,
        booking_id: UUID,
        price_map: dict[UUID, int],
        rate_map: dict[UUID, float],
    ) -> None:
        result = await self.session.scalars(
            select(BookingServiceItem).where(
                BookingServiceItem.booking_id == booking_id,
            )
        )
        for item in result.all():
            if item.service_id is None:
                continue
            price = price_map.get(item.service_id, 0)
            rate = rate_map.get(item.service_id, 0.0)
            item.unit_price = price
            item.commission_percent = rate
            item.commission_amount = round(price * rate / 100)
        await self.session.flush()
