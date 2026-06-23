from datetime import datetime
from uuid import UUID

from app.core.constants import AccountStatus
from app.schemas.base import AppSchema, PageParams
from app.schemas.role import PermissionMap


class AccountRead(AppSchema):
    id: UUID
    email: str
    name: str
    avatar_url: str | None
    status: AccountStatus
    requested_at: datetime
    created_at: datetime


class RoleSummary(AppSchema):
    id: UUID
    name: str


class MeRead(AccountRead):
    role: RoleSummary | None = None
    permissions: dict[str, PermissionMap] = {}


class AccountListParams(PageParams):
    status: AccountStatus | None = None
