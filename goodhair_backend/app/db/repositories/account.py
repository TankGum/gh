from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select

from app.core.constants import AccountStatus
from app.db.repositories.base import BaseRepository
from app.models.account import Account


class AccountRepository(BaseRepository[Account]):
    model = Account

    async def get_by_google_id(self, google_id: str) -> Account | None:
        return await self.session.scalar(
            select(Account).where(
                Account.google_id == google_id,
                Account.deleted_at.is_(None),
            )
        )

    async def get_active_by_id(self, id_: UUID) -> Account | None:
        return await self.session.scalar(
            select(Account).where(
                Account.id == id_,
                Account.deleted_at.is_(None),
            )
        )

    async def count_total(self) -> int:
        result = await self.session.scalar(
            select(func.count()).select_from(Account).where(Account.deleted_at.is_(None))
        )
        return int(result or 0)

    async def list_accounts(
        self,
        *,
        status: AccountStatus | None,
        offset: int,
        limit: int,
    ) -> Sequence[Account]:
        q = select(Account).where(Account.deleted_at.is_(None))
        if status is not None:
            q = q.where(Account.status == status)
        q = q.order_by(Account.requested_at.desc()).offset(offset).limit(limit)
        result = await self.session.scalars(q)
        return result.all()

    async def count_accounts(self, *, status: AccountStatus | None) -> int:
        q = select(func.count()).select_from(Account).where(Account.deleted_at.is_(None))
        if status is not None:
            q = q.where(Account.status == status)
        result = await self.session.scalar(q)
        return int(result or 0)
