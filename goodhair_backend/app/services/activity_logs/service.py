from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.actor_context import get_actor
from app.core.constants import ActivityAction
from app.db.repositories.account import AccountRepository
from app.db.repositories.activity_log import ActivityLogRepository
from app.db.repositories.employee import EmployeeRepository
from app.db.repositories.role import RoleRepository
from app.models.activity_log import ActivityLog
from app.schemas.activity_log import ActivityLogListParams


class ActivityLogService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = ActivityLogRepository(session)

    async def log(
        self,
        action: ActivityAction,
        module: str,
        *,
        target_label: str,
        entity_type: str | None = None,
        entity_id: UUID | None = None,
        changes: list[dict[str, Any]] | None = None,
        actor_account_id: UUID | None = None,
        actor_name: str | None = None,
        actor_role: str | None = None,
        ip_address: str | None = None,
    ) -> ActivityLog:
        """Ghi 1 dòng nhật ký. Actor lấy từ context nếu không truyền tường minh.

        Insert nằm cùng transaction với mutation gốc (commit ở cuối request).
        """
        actor = get_actor()
        if actor_account_id is None:
            actor_account_id = actor.account_id
        if ip_address is None:
            ip_address = actor.ip_address
        if actor_name is None:
            actor_name, actor_role = await self._resolve_actor(actor_account_id)

        log = ActivityLog(
            actor_account_id=actor_account_id,
            actor_name=actor_name[:256],
            actor_role=actor_role[:128] if actor_role else None,
            action=action,
            module=module,
            entity_type=entity_type,
            entity_id=entity_id,
            target_label=target_label[:512],
            changes=changes or [],
            ip_address=ip_address[:64] if ip_address else None,
        )
        self.session.add(log)
        await self.session.flush()
        return log

    async def _resolve_actor(
        self, account_id: UUID | None
    ) -> tuple[str, str | None]:
        if account_id is None:
            return "Hệ thống", None
        account = await AccountRepository(self.session).get_active_by_id(account_id)
        name = account.name if account else "Không rõ"
        role_name: str | None = None
        employee = await EmployeeRepository(self.session).get_by_account_id(
            account_id
        )
        if employee is not None:
            if employee.name:
                name = employee.name
            if employee.role_id is not None:
                role = await RoleRepository(self.session).get_by_id(
                    employee.role_id
                )
                if role is not None:
                    role_name = role.name
        return name, role_name

    async def get_log(self, log_id: UUID) -> ActivityLog | None:
        return await self.repo.get_by_id(log_id)

    async def list_logs(
        self, params: ActivityLogListParams
    ) -> tuple[list[ActivityLog], int]:
        items = await self.repo.list_logs(
            action=params.action,
            module=params.module,
            q=params.q,
            date_from=params.date_from,
            date_to=params.date_to,
            offset=params.offset,
            limit=params.size,
        )
        total = await self.repo.count_logs(
            action=params.action,
            module=params.module,
            q=params.q,
            date_from=params.date_from,
            date_to=params.date_to,
        )
        return list(items), total
