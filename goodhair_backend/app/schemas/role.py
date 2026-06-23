from uuid import UUID

from app.schemas.base import AppSchema, PageParams


class PermissionMap(AppSchema):
    view: bool = False
    create: bool = False
    edit: bool = False
    delete: bool = False


class RoleRead(AppSchema):
    id: UUID
    name: str
    description: str | None
    is_system: bool
    is_bookable: bool
    employee_count: int = 0
    permissions: dict[str, PermissionMap]


class RoleListParams(PageParams):
    pass


class RoleCreate(AppSchema):
    name: str
    description: str | None = None
    is_bookable: bool = False
    permissions: dict[str, PermissionMap] = {}


class RoleUpdate(AppSchema):
    name: str | None = None
    description: str | None = None
    is_bookable: bool | None = None
    permissions: dict[str, PermissionMap] | None = None
