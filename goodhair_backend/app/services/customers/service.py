from datetime import date as date_type

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories.customer import CustomerRepository
from app.models.booking import Booking
from app.models.booking_service_item import BookingServiceItem
from app.models.customer import Customer
from app.models.service import Service
from app.schemas.base import PageParams
from app.schemas.customer import CustomerServiceBreakdown


class CustomerService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = CustomerRepository(session)

    async def list_customers(
        self,
        *,
        q: str | None = None,
        page: PageParams,
    ) -> tuple[list[Customer], int]:
        items = list(await self.repo.list_customers(
            q=q, offset=page.offset, limit=page.size,
            sort_by=page.sort_by, sort_order=page.sort_order,
        ))
        total = await self.repo.count_customers(q=q)
        await self._attach_service_breakdown(items)
        return items, total

    async def _attach_service_breakdown(self, customers: list[Customer]) -> None:
        """Gộp 1 query cho cả trang thay vì hỏi từng khách hàng (tránh N+1)."""
        phones = [c.phone for c in customers]
        if not phones:
            return

        rows_q = (
            select(
                Booking.customer_phone,
                BookingServiceItem.service_id,
                func.count(BookingServiceItem.id).label("count"),
            )
            .join(Booking, Booking.id == BookingServiceItem.booking_id)
            .where(
                Booking.deleted_at.is_(None),
                Booking.status == "completed",
                Booking.customer_phone.in_(phones),
            )
            .group_by(Booking.customer_phone, BookingServiceItem.service_id)
        )
        rows = (await self.session.execute(rows_q)).all()

        service_ids = {r.service_id for r in rows if r.service_id}
        svc_map: dict = {}
        if service_ids:
            services = await self.session.scalars(
                select(Service).where(Service.id.in_(service_ids))
            )
            svc_map = {s.id: (s.name, s.description) for s in services}

        by_phone: dict[str, list[CustomerServiceBreakdown]] = {}
        for r in rows:
            name, description = svc_map.get(r.service_id, ("N/A", None))
            by_phone.setdefault(r.customer_phone, []).append(
                CustomerServiceBreakdown(
                    service_id=r.service_id,
                    service_name=name,
                    service_description=description,
                    count=int(r.count),
                )
            )
        for c in customers:
            breakdown = by_phone.get(c.phone, [])
            breakdown.sort(key=lambda b: b.count, reverse=True)
            # Gán field không map DB — chỉ để trả ra qua CustomerRead.model_validate.
            c.service_breakdown = breakdown

    async def list_top_customers(self, *, limit: int = 20) -> list:
        items = await self.repo.list_top_customers(limit=limit)
        return list(items)

    async def sync_after_booking(
        self,
        *,
        customer_name: str,
        customer_phone: str,
        total: int,
        booking_date: date_type,
    ) -> None:
        customer = await self.repo.get_by_phone(customer_phone)
        if customer is None:
            await self.repo.create({
                "name": customer_name,
                "phone": customer_phone,
                "total_visits": 1,
                "total_spent": total,
                "last_visit_date": booking_date,
            })
        else:
            await self.repo.update(customer, {
                "name": customer_name,
                "total_visits": customer.total_visits + 1,
                "total_spent": customer.total_spent + total,
                "last_visit_date": booking_date,
            })
