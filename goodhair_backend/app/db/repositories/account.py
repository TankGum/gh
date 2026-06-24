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

    async def get_deleted_by_google_id(self, google_id: str) -> Account | None:
        return await self.session.scalar(
            select(Account).where(
                Account.google_id == google_id,
                Account.deleted_at.is_not(None),
            )
        )

    async def restore(self, account: Account) -> None:
        account.mark_restored()
        await self.session.flush()

    async def update_status(self, account: Account, status: AccountStatus) -> None:
        account.status = status
        await self.session.flush()

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
        sort_by: str | None = None,
        sort_order: str = "desc",
    ) -> Sequence[Account]:
        _SORTABLE = frozenset({"name", "email", "status", "requested_at", "created_at"})
        q = select(Account).where(Account.deleted_at.is_(None))
        if status is not None:
            q = q.where(Account.status == status)
        if sort_by and sort_by in _SORTABLE:
            col = getattr(Account, sort_by)
            q = q.order_by(col.desc() if sort_order == "desc" else col.asc())
        else:
            q = q.order_by(Account.requested_at.desc())
        q = q.offset(offset).limit(limit)
        result = await self.session.scalars(q)
        return result.all()

    async def count_accounts(self, *, status: AccountStatus | None) -> int:
        q = select(func.count()).select_from(Account).where(Account.deleted_at.is_(None))
        if status is not None:
            q = q.where(Account.status == status)
        result = await self.session.scalar(q)
        return int(result or 0)
