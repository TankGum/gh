from collections.abc import Sequence
from datetime import date
from uuid import UUID

from sqlalchemy import Select, func, or_, select

from app.core.constants import BookingStatus, BranchStatus
from app.db.repositories.base import BaseRepository
from app.models.booking import Booking
from app.models.branch import Branch
from app.models.employee import Employee


class BranchRepository(BaseRepository[Branch]):
    model = Branch

    def _filtered_query(
        self,
        *,
        q: str | None,
        status: BranchStatus | None,
    ) -> Select[tuple[Branch]]:
        stmt = select(Branch).where(Branch.deleted_at.is_(None))
        if q:
            stmt = stmt.where(
                or_(
                    Branch.name.ilike(f"%{q}%"),
                    Branch.address.ilike(f"%{q}%"),
                ),
            )
        if status is not None:
            stmt = stmt.where(Branch.status == status)
        return stmt

    async def list_branches(
        self,
        *,
        q: str | None = None,
        status: BranchStatus | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> Sequence[Branch]:
        stmt = (
            self._filtered_query(q=q, status=status)
            .order_by(Branch.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.scalars(stmt)
        return result.all()

    async def count_branches(
        self,
        *,
        q: str | None = None,
        status: BranchStatus | None = None,
    ) -> int:
        stmt = self._filtered_query(q=q, status=status)
        result = await self.session.scalar(
            select(func.count()).select_from(stmt.subquery()),
        )
        return int(result or 0)

    async def get_active_by_id(self, branch_id: UUID) -> Branch | None:
        result = await self.session.scalars(
            select(Branch).where(
                Branch.id == branch_id,
                Branch.deleted_at.is_(None),
            ),
        )
        return result.first()

    async def list_by_ids(self, ids: Sequence[UUID]) -> Sequence[Branch]:
        if not ids:
            return []
        result = await self.session.scalars(
            select(Branch).where(
                Branch.id.in_(ids),
                Branch.deleted_at.is_(None),
            ),
        )
        return result.all()

    async def count_active(self) -> int:
        result = await self.session.scalar(
            select(func.count())
            .select_from(Branch)
            .where(Branch.deleted_at.is_(None)),
        )
        return int(result or 0)

    async def fetch_barber_counts(self, branch_ids: list[UUID]) -> dict[UUID, int]:
        if not branch_ids:
            return {}
        stmt = (
            select(Employee.branch_id, func.count().label("cnt"))
            .where(
                Employee.branch_id.in_(branch_ids),
                Employee.deleted_at.is_(None),
            )
            .group_by(Employee.branch_id)
        )
        rows = await self.session.execute(stmt)
        return {row.branch_id: row.cnt for row in rows}

    async def fetch_monthly_revenues(self, branch_ids: list[UUID]) -> dict[UUID, float]:
        if not branch_ids:
            return {}
        today = date.today()
        first_day = date(today.year, today.month, 1)
        stmt = (
            select(Booking.branch_id, func.sum(Booking.total).label("revenue"))
            .where(
                Booking.branch_id.in_(branch_ids),
                Booking.status == BookingStatus.COMPLETED,
                Booking.date >= first_day,
                Booking.deleted_at.is_(None),
            )
            .group_by(Booking.branch_id)
        )
        rows = await self.session.execute(stmt)
        return {row.branch_id: float(row.revenue or 0) for row in rows}
