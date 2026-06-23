from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ActivityAction, PermissionModule
from app.core.diff import compute_changes
from app.core.exceptions import BadRequestError, NotFoundError
from app.db.repositories.role import RoleRepository
from app.models.role import Role
from app.schemas.base import PageParams
from app.schemas.role import RoleCreate, RoleUpdate
from app.services.activity_logs.labels import ROLE_LABELS
from app.services.activity_logs.service import ActivityLogService


class RoleService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = RoleRepository(session)
        self.activity = ActivityLogService(session)

    async def list_roles(self, page: PageParams) -> tuple[list[Role], int]:
        items = await self.repo.list_roles(offset=page.offset, limit=page.size)
        total = await self.repo.count_roles()
        return list(items), total

    async def create(self, data: RoleCreate) -> Role:
        payload = data.model_dump()
        payload["permissions"] = self._apply_default_view(payload["permissions"])
        role = await self.repo.create(payload)
        await self.activity.log(
            ActivityAction.CREATE,
            PermissionModule.ROLES,
            entity_type="role",
            entity_id=role.id,
            target_label=role.name,
        )
        return role

    @staticmethod
    def _apply_default_view(
        permissions: dict[str, dict[str, bool]],
    ) -> dict[str, dict[str, bool]]:
        """Mọi role mới đều mặc định có quyền view ở tất cả module."""
        result: dict[str, dict[str, bool]] = {}
        for module in PermissionModule:
            perm = dict(permissions.get(module.value, {}))
            perm.setdefault("create", False)
            perm.setdefault("edit", False)
            perm.setdefault("delete", False)
            perm["view"] = True
            result[module.value] = perm
        return result

    async def update(self, role_id: UUID, data: RoleUpdate) -> Role:
        role = await self._get_or_404(role_id)
        if role.is_system:
            raise BadRequestError(detail={"message": "Cannot edit system role"})
        payload = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
        if not payload:
            return role
        before = {k: getattr(role, k) for k in payload if k != "permissions"}
        await self.repo.update(role, payload)
        changes = compute_changes(before, payload, ROLE_LABELS)
        if "permissions" in payload:
            changes.append(
                {"label": "Phân quyền", "from": "—", "to": "Đã cập nhật"}
            )
        await self.activity.log(
            ActivityAction.UPDATE,
            PermissionModule.ROLES,
            entity_type="role",
            entity_id=role.id,
            target_label=role.name,
            changes=changes,
        )
        return role

    async def delete(self, role_id: UUID) -> None:
        role = await self._get_or_404(role_id)
        if role.is_system:
            raise BadRequestError(detail={"message": "Cannot delete system role"})
        await self.repo.soft_delete(role)
        await self.activity.log(
            ActivityAction.DELETE,
            PermissionModule.ROLES,
            entity_type="role",
            entity_id=role.id,
            target_label=role.name,
        )

    async def _get_or_404(self, role_id: UUID) -> Role:
        role = await self.repo.get_by_id(role_id)
        if role is None or role.deleted_at is not None:
            raise NotFoundError(detail={"resource": "role", "id": str(role_id)})
        return role

    async def enrich_with_employee_count(self, roles: list[Role]) -> list[Role]:
        for role in roles:
            role.employee_count = await self.repo.get_employee_count(role.id)
        return roles
