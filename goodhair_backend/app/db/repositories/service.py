from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import Select, func, or_, select

from app.core.constants import ServiceStatus
from app.db.repositories.base import BaseRepository
from app.models.service import Service, service_branches


class ServiceRepository(BaseRepository[Service]):
    model = Service

    def _filtered_query(
        self,
        *,
        q: str | None,
        branch_id: UUID | None,
        status: ServiceStatus | None,
    ) -> Select[tuple[Service]]:
        stmt = select(Service).where(Service.deleted_at.is_(None))

        if q:
            stmt = stmt.where(Service.name.ilike(f"%{q}%"))

        if status is not None:
            stmt = stmt.where(Service.status == status)

        if branch_id is not None:
            stmt = stmt.where(
                or_(
                    Service.is_all_branches.is_(True),
                    Service.id.in_(
                        select(service_branches.c.service_id).where(
                            service_branches.c.branch_id == branch_id,
                        ),
                    ),
                ),
            )

        return stmt

    async def list_services(
        self,
        *,
        q: str | None = None,
        branch_id: UUID | None = None,
        status: ServiceStatus | None = None,
        offset: int = 0,
        limit: int = 20,
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> Sequence[Service]:
        _SORTABLE = frozenset({"name", "price", "duration_minutes", "status", "created_at"})
        stmt = self._filtered_query(q=q, branch_id=branch_id, status=status)
        if sort_by and sort_by in _SORTABLE:
            col = getattr(Service, sort_by)
            stmt = stmt.order_by(col.desc() if sort_order == "desc" else col.asc())
        else:
            stmt = stmt.order_by(Service.created_at.desc())
        stmt = stmt.offset(offset).limit(limit)
        result = await self.session.scalars(stmt)
        return result.all()

    async def count_services(
        self,
        *,
        q: str | None = None,
        branch_id: UUID | None = None,
        status: ServiceStatus | None = None,
    ) -> int:
        stmt = self._filtered_query(q=q, branch_id=branch_id, status=status)
        result = await self.session.scalar(
            select(func.count()).select_from(stmt.subquery()),
        )
        return int(result or 0)

    async def get_active_by_id(self, service_id: UUID) -> Service | None:
        result = await self.session.scalars(
            select(Service).where(
                Service.id == service_id,
                Service.deleted_at.is_(None),
            ),
        )
        return result.first()
