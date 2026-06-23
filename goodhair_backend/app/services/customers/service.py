from datetime import date as date_type

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories.customer import CustomerRepository
from app.schemas.base import PageParams


class CustomerService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = CustomerRepository(session)

    async def list_customers(
        self,
        *,
        q: str | None = None,
        page: PageParams,
    ) -> tuple[list, int]:
        items = await self.repo.list_customers(
            q=q, offset=page.offset, limit=page.size
        )
        total = await self.repo.count_customers(q=q)
        return list(items), total

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
