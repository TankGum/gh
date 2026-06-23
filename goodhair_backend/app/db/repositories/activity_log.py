from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import func, or_, select

from app.core.constants import ActivityAction
from app.db.repositories.base import BaseRepository
from app.models.activity_log import ActivityLog


class ActivityLogRepository(BaseRepository[ActivityLog]):
    model = ActivityLog

    def _filtered(
        self,
        *,
        action: ActivityAction | None,
        module: str | None,
        q: str | None,
        date_from: datetime | None,
        date_to: datetime | None,
    ):
        stmt = select(ActivityLog)
        if action is not None:
            stmt = stmt.where(ActivityLog.action == action)
        if module is not None:
            stmt = stmt.where(ActivityLog.module == module)
        if date_from is not None:
            stmt = stmt.where(ActivityLog.created_at >= date_from)
        if date_to is not None:
            stmt = stmt.where(ActivityLog.created_at <= date_to)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(
                or_(
                    ActivityLog.actor_name.ilike(like),
                    ActivityLog.target_label.ilike(like),
                )
            )
        return stmt

    async def list_logs(
        self,
        *,
        action: ActivityAction | None = None,
        module: str | None = None,
        q: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
        offset: int = 0,
        limit: int = 20,
    ) -> Sequence[ActivityLog]:
        stmt = (
            self._filtered(
                action=action,
                module=module,
                q=q,
                date_from=date_from,
                date_to=date_to,
            )
            .order_by(ActivityLog.created_at.desc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.scalars(stmt)
        return result.all()

    async def count_logs(
        self,
        *,
        action: ActivityAction | None = None,
        module: str | None = None,
        q: str | None = None,
        date_from: datetime | None = None,
        date_to: datetime | None = None,
    ) -> int:
        subq = self._filtered(
            action=action,
            module=module,
            q=q,
            date_from=date_from,
            date_to=date_to,
        ).subquery()
        result = await self.session.scalar(
            select(func.count()).select_from(subq)
        )
        return int(result or 0)
