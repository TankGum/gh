from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import (
    ActivityAction,
    EmploymentStatus,
    PermissionModule,
)
from app.core.exceptions import ForbiddenError, NotFoundError
from app.db.repositories.branch import BranchRepository
from app.db.repositories.account import AccountRepository
from app.db.repositories.employee import EmployeeRepository
from app.db.repositories.role import RoleRepository
from app.models.employee import Employee
from app.schemas.base import PageParams
from app.schemas.employee import EmployeeUpdate
from app.services.activity_logs.service import ActivityLogService
from app.utils.image_storage import delete_cloudinary_image


class EmployeeService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = EmployeeRepository(session)
        self.role_repo = RoleRepository(session)
        self.branch_repo = BranchRepository(session)
        self.account_repo = AccountRepository(session)
        self.activity = ActivityLogService(session)

    async def list_employees(
        self,
        *,
        branch_id: UUID | None,
        role_id: UUID | None,
        status: EmploymentStatus | None,
        page: PageParams,
        bookable_only: bool = False,
    ) -> tuple[list[Employee], int]:
        items = await self.repo.list_employees(
            branch_id=branch_id,
            role_id=role_id,
            status=status,
            bookable_only=bookable_only,
            offset=page.offset,
            limit=page.size,
            sort_by=page.sort_by,
            sort_order=page.sort_order,
        )
        total = await self.repo.count_employees(
            branch_id=branch_id,
            role_id=role_id,
            status=status,
            bookable_only=bookable_only,
        )
        return list(items), total

    async def update(
        self,
        employee_id: UUID,
        data: EmployeeUpdate,
        *,
        current_account_id: UUID,
    ) -> Employee:
        employee = await self._get_or_404(employee_id)
        payload = {}
        for k, v in data.model_dump(exclude_unset=True).items():
            if v is not None or k == "avatar_url":
                payload[k] = v
        if not payload:
            return employee
        if "role_id" in payload:
            await self._guard_self_admin_role_change(
                employee, payload["role_id"], current_account_id
            )
        old_avatar_url = employee.avatar_url if "avatar_url" in payload else None
        changes = await self._build_changes(employee, payload)
        await self.repo.update(employee, payload)
        await self.activity.log(
            ActivityAction.UPDATE,
            PermissionModule.STAFF,
            entity_type="employee",
            entity_id=employee.id,
            target_label=employee.name,
            changes=changes,
        )
        if old_avatar_url and old_avatar_url != payload.get("avatar_url"):
            await delete_cloudinary_image(old_avatar_url)
        return employee

    async def _build_changes(
        self, employee: Employee, payload: dict
    ) -> list[dict[str, str]]:
        changes: list[dict[str, str]] = []
        if "display_name" in payload and payload["display_name"] != employee.display_name:
            changes.append(
                {
                    "label": "Tên hiển thị",
                    "from": employee.display_name or employee.name,
                    "to": payload["display_name"] or "",
                }
            )
        if "status" in payload and payload["status"] != employee.status:
            changes.append(
                {
                    "label": "Trạng thái",
                    "from": str(employee.status),
                    "to": str(payload["status"]),
                }
            )
        if "role_id" in payload and payload["role_id"] != employee.role_id:
            changes.append(
                {
                    "label": "Chức danh",
                    "from": await self._role_name(employee.role_id),
                    "to": await self._role_name(payload["role_id"]),
                }
            )
        if "branch_id" in payload and payload["branch_id"] != employee.branch_id:
            changes.append(
                {
                    "label": "Chi nhánh",
                    "from": await self._branch_name(employee.branch_id),
                    "to": await self._branch_name(payload["branch_id"]),
                }
            )
        return changes

    async def _role_name(self, role_id: UUID | None) -> str:
        if role_id is None:
            return "∅"
        role = await self.role_repo.get_by_id(role_id)
        return role.name if role else "∅"

    async def _branch_name(self, branch_id: UUID | None) -> str:
        if branch_id is None:
            return "∅"
        branch = await self.branch_repo.get_by_id(branch_id)
        return branch.name if branch else "∅"

    async def _guard_self_admin_role_change(
        self,
        employee: Employee,
        new_role_id: UUID | None,
        current_account_id: UUID,
    ) -> None:
        """Admin không được tự đổi role của chính mình sang role khác."""
        if employee.account_id != current_account_id:
            return
        if new_role_id == employee.role_id:
            return
        if employee.role_id is None:
            return
        current_role = await self.role_repo.get_by_id(employee.role_id)
        if current_role is not None and current_role.is_system:
            raise ForbiddenError(
                message_key="errors.employee.cannot_change_own_admin_role"
            )

    async def delete(self, employee_id: UUID) -> None:
        employee = await self._get_or_404(employee_id)
        avatar_url = employee.avatar_url
        await self.repo.soft_delete(employee)
        account = await self.account_repo.get_by_id(employee.account_id)
        if account and account.deleted_at is None:
            await self.account_repo.soft_delete(account)
        await self.activity.log(
            ActivityAction.DELETE,
            PermissionModule.STAFF,
            entity_type="employee",
            entity_id=employee.id,
            target_label=employee.name,
        )
        await delete_cloudinary_image(avatar_url)

    async def _get_or_404(self, employee_id: UUID) -> Employee:
        employee = await self.repo.get_by_id(employee_id)
        if employee is None or employee.deleted_at is not None:
            raise NotFoundError(detail={"resource": "employee", "id": str(employee_id)})
        return employee
