from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ActivityAction, PermissionModule
from app.core.diff import compute_changes
from app.core.exceptions import BadRequestError, NotFoundError
from app.core.permissions import effective_permissions
from app.db.repositories.role import RoleRepository
from app.db.repositories.service import ServiceRepository
from app.models.role import Role
from app.schemas.base import PageParams
from app.schemas.role import RoleCreate, RoleRead, RoleUpdate
from app.services.activity_logs.labels import ROLE_LABELS
from app.services.activity_logs.service import ActivityLogService

PERM_ACTION_LABELS: dict[str, str] = {
    "view": "Xem",
    "create": "Thêm",
    "edit": "Sửa",
    "delete": "Xoá",
}

PERM_MODULE_LABELS: dict[str, str] = {
    "overview": "Tổng quan",
    "bookings": "Đặt lịch",
    "revenue": "Doanh thu",
    "staff": "Nhân viên",
    "shifts": "Ca làm việc",
    "customers": "Khách hàng",
    "branches": "Chi nhánh",
    "services": "Dịch vụ",
    "roles": "Quản lý vai trò",
    "logs": "Nhật ký hoạt động",
    "payroll": "Toàn bộ bảng lương",
}


def _fmt_perms(perms: dict[str, bool]) -> str:
    enabled = [PERM_ACTION_LABELS[a] for a in ("view", "create", "edit", "delete") if perms.get(a)]
    return ", ".join(enabled) if enabled else "Trống"


def _fmt_pct(value: float) -> str:
    return f"{value:g}%"


class RoleService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = RoleRepository(session)
        self.service_repo = ServiceRepository(session)
        self.activity = ActivityLogService(session)

    async def list_roles(self, page: PageParams) -> tuple[list[Role], int]:
        items = await self.repo.list_roles(offset=page.offset, limit=page.size)
        total = await self.repo.count_roles()
        return list(items), total

    async def create(self, data: RoleCreate) -> Role:
        payload = data.model_dump()
        role = await self.repo.create(payload)
        await self.activity.log(
            ActivityAction.CREATE,
            PermissionModule.ROLES,
            entity_type="role",
            entity_id=role.id,
            target_label=role.name,
        )
        return role

    async def update(self, role_id: UUID, data: RoleUpdate) -> Role:
        role = await self._get_or_404(role_id)
        if role.is_system:
            raise BadRequestError(detail={"message": "Cannot edit system role"})
        payload = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
        if not payload:
            return role
        old_perms = dict(role.permissions) if "permissions" in payload else None
        old_comm = dict(role.commission_rates or {}) if "commission_rates" in payload else None
        before = {
            k: getattr(role, k)
            for k in payload
            if k not in ("permissions", "commission_rates")
        }
        await self.repo.update(role, payload)
        changes = compute_changes(before, payload, ROLE_LABELS)
        if old_perms is not None:
            new_perms = payload["permissions"] or {}
            all_modules = set(list(old_perms.keys()) + list(new_perms.keys()))
            for mod_key in sorted(all_modules):
                old_actions = old_perms.get(mod_key, {})
                new_actions = new_perms.get(mod_key, {})
                old_fmt = _fmt_perms(old_actions)
                new_fmt = _fmt_perms(new_actions)
                if old_fmt != new_fmt:
                    mod_label = PERM_MODULE_LABELS.get(mod_key, mod_key)
                    changes.append({
                        "label": f"Phân quyền · {mod_label}",
                        "from": old_fmt,
                        "to": new_fmt,
                    })
        if old_comm is not None:
            new_comm = payload["commission_rates"] or {}
            changed_ids = {
                sid for sid in set(old_comm) | set(new_comm)
                if float(old_comm.get(sid, 0) or 0) != float(new_comm.get(sid, 0) or 0)
            }
            if changed_ids:
                svc_names = await self._service_names(changed_ids)
                for sid in sorted(changed_ids, key=lambda s: svc_names.get(s, s)):
                    changes.append({
                        "label": f"Hoa hồng · {svc_names.get(sid, sid)}",
                        "from": _fmt_pct(float(old_comm.get(sid, 0) or 0)),
                        "to": _fmt_pct(float(new_comm.get(sid, 0) or 0)),
                    })
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

    async def _service_names(self, service_ids: set[str]) -> dict[str, str]:
        valid_ids: list[UUID] = []
        for sid in service_ids:
            try:
                valid_ids.append(UUID(sid))
            except ValueError:
                continue
        if not valid_ids:
            return {}
        services = await self.service_repo.list_by_ids(valid_ids)
        return {str(s.id): s.name for s in services}

    async def _get_or_404(self, role_id: UUID) -> Role:
        role = await self.repo.get_by_id(role_id)
        if role is None or role.deleted_at is not None:
            raise NotFoundError(detail={"resource": "role", "id": str(role_id)})
        return role

    async def enrich_with_employee_count(self, roles: list[Role]) -> list[Role]:
        for role in roles:
            role.employee_count = await self.repo.get_employee_count(role.id)
        return roles

    def to_read(self, role: Role) -> RoleRead:
        """Vai trò hệ thống (Admin) luôn hiển thị toàn quyền — không lấy trực
        tiếp `role.permissions` đã lưu vì có thể thiếu module mới thêm sau."""
        return RoleRead(
            id=role.id,
            name=role.name,
            description=role.description,
            is_system=role.is_system,
            is_bookable=role.is_bookable,
            employee_count=getattr(role, "employee_count", 0),
            permissions=effective_permissions(role.is_system, role.permissions),
            base_salary=role.base_salary,
            commission_rates=role.commission_rates or {},
        )
