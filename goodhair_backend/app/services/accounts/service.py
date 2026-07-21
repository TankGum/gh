from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import (
    AccountStatus,
    ActivityAction,
    EmploymentStatus,
    PermissionModule,
)
from app.core.exceptions import BadRequestError, ForbiddenError, NotFoundError
from app.db.repositories.account import AccountRepository
from app.db.repositories.employee import EmployeeRepository
from app.db.repositories.role import RoleRepository
from app.models.account import Account
from app.schemas.base import PageParams
from app.services.activity_logs.service import ActivityLogService


_STATUS_LABELS = {
    AccountStatus.PENDING: "Chờ duyệt",
    AccountStatus.APPROVED: "Đã duyệt",
    AccountStatus.REJECTED: "Đã từ chối",
}


class AccountService:
    def __init__(self, session: AsyncSession) -> None:
        self.account_repo = AccountRepository(session)
        self.employee_repo = EmployeeRepository(session)
        self.role_repo = RoleRepository(session)
        self.activity = ActivityLogService(session)

    async def list_accounts(
        self,
        *,
        status: AccountStatus | None,
        page: PageParams,
    ) -> tuple[list[Account], int]:
        items = await self.account_repo.list_accounts(
            status=status, offset=page.offset, limit=page.size,
            sort_by=page.sort_by, sort_order=page.sort_order,
        )
        total = await self.account_repo.count_accounts(status=status)
        return list(items), total

    async def approve(self, account_id: UUID) -> Account:
        account = await self._get_or_404(account_id)
        if account.status == AccountStatus.APPROVED:
            raise BadRequestError(message_key="errors.account.already_approved")
        from_label = _STATUS_LABELS[account.status]
        await self.account_repo.update(account, {"status": AccountStatus.APPROVED})
        existing = await self.employee_repo.get_by_account_id(account_id)
        if existing is None:
            await self.employee_repo.create(
                {
                    "account_id": account.id,
                    "name": account.name,
                    "email": account.email,
                    "avatar_url": account.avatar_url,
                }
            )
        elif existing.status != EmploymentStatus.ACTIVE:
            await self.employee_repo.update(
                existing, {"status": EmploymentStatus.ACTIVE}
            )
        await self.activity.log(
            ActivityAction.UPDATE,
            PermissionModule.ROLES,
            entity_type="account",
            entity_id=account.id,
            target_label=f"{account.name} · duyệt truy cập",
            changes=[
                {"label": "Trạng thái", "from": from_label, "to": "Đã duyệt"}
            ],
        )
        return account

    async def reject(self, account_id: UUID) -> Account:
        account = await self._get_or_404(account_id)
        if account.status == AccountStatus.REJECTED:
            raise BadRequestError(message_key="errors.account.already_rejected")
        await self._guard_admin_protected(account_id)
        from_label = _STATUS_LABELS[account.status]
        await self.account_repo.update(account, {"status": AccountStatus.REJECTED})
        employee = await self.employee_repo.get_by_account_id(account_id)
        if employee is not None and employee.status != EmploymentStatus.INACTIVE:
            await self.employee_repo.update(
                employee, {"status": EmploymentStatus.INACTIVE}
            )
        await self.activity.log(
            ActivityAction.UPDATE,
            PermissionModule.ROLES,
            entity_type="account",
            entity_id=account.id,
            target_label=f"{account.name} · từ chối truy cập",
            changes=[
                {"label": "Trạng thái", "from": from_label, "to": "Đã từ chối"}
            ],
        )
        return account

    async def delete(self, account_id: UUID) -> None:
        account = await self._get_or_404(account_id)
        await self._guard_admin_protected(account_id)
        await self.account_repo.soft_delete(account)
        await self.activity.log(
            ActivityAction.DELETE,
            PermissionModule.ROLES,
            entity_type="account",
            entity_id=account.id,
            target_label=account.name,
        )

    async def _guard_admin_protected(self, account_id: UUID) -> None:
        """Không cho phép từ chối/xoá tài khoản mang role quản trị viên (system)."""
        employee = await self.employee_repo.get_by_account_id(account_id)
        if employee is None or employee.role_id is None:
            return
        role = await self.role_repo.get_by_id(employee.role_id)
        if role is not None and role.is_system:
            raise ForbiddenError(
                detail={
                    "message": "Không thể từ chối hoặc xoá tài khoản quản trị viên"
                },
            )

    async def _get_or_404(self, account_id: UUID) -> Account:
        account = await self.account_repo.get_active_by_id(account_id)
        if account is None:
            raise NotFoundError(detail={"resource": "account", "id": str(account_id)})
        return account
