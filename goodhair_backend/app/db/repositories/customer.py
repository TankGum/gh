from collections.abc import Sequence

from sqlalchemy import func, or_, select

from app.db.repositories.base import BaseRepository
from app.models.customer import Customer


class CustomerRepository(BaseRepository[Customer]):
    model = Customer

    async def get_by_phone(self, phone: str) -> Customer | None:
        result = await self.session.scalar(
            select(Customer).where(Customer.phone == phone)
        )
        return result

    async def list_customers(
        self,
        *,
        q: str | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> Sequence[Customer]:
        stmt = select(Customer)
        if q:
            stmt = stmt.where(
                or_(
                    Customer.name.ilike(f"%{q}%"),
                    Customer.phone.ilike(f"%{q}%"),
                )
            )
        stmt = stmt.order_by(Customer.last_visit_date.desc().nullslast()).offset(offset).limit(limit)
        result = await self.session.scalars(stmt)
        return result.all()

    async def count_customers(self, *, q: str | None = None) -> int:
        stmt = select(func.count()).select_from(Customer)
        if q:
            stmt = stmt.where(
                or_(
                    Customer.name.ilike(f"%{q}%"),
                    Customer.phone.ilike(f"%{q}%"),
                )
            )
        result = await self.session.scalar(stmt)
        return int(result or 0)
