from collections.abc import Awaitable, Callable
from uuid import UUID

from fastapi import Cookie, Depends, Request
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import decode_token
from app.core.actor_context import set_actor
from app.core.constants import AccountStatus, PermissionAction, PermissionModule
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.permissions import PermissionTree, effective_permissions, has_permission
from app.db.repositories.employee import EmployeeRepository
from app.db.repositories.role import RoleRepository
from app.db.session import get_db_session


async def bind_actor(
    request: Request,
    access_token: str | None = Cookie(default=None),
) -> None:
    """Best-effort: gắn actor (account_id + IP) vào context cho request hiện tại.

    Không raise nếu thiếu/invalid token — chỉ phục vụ ghi log; việc bảo vệ
    endpoint vẫn do require_permission/get_current_account_id đảm nhận.
    """
    account_id: UUID | None = None
    if access_token:
        try:
            payload = decode_token(access_token)
            if payload.get("type") == "access":
                account_id = UUID(payload["sub"])
        except (JWTError, KeyError, ValueError):
            account_id = None
    client_ip = request.client.host if request.client else None
    set_actor(account_id, client_ip)


async def get_current_account_id(
    access_token: str | None = Cookie(default=None),
) -> UUID:
    if not access_token:
        raise UnauthorizedError(message_key="errors.auth.no_token")
    try:
        payload = decode_token(access_token)
    except JWTError:
        raise UnauthorizedError(message_key="errors.auth.invalid_token") from None
    if payload.get("type") != "access":
        raise UnauthorizedError(message_key="errors.auth.invalid_token")
    if payload.get("status") != AccountStatus.APPROVED.value:
        raise UnauthorizedError(message_key="errors.auth.not_approved")
    return UUID(payload["sub"])


async def get_current_permissions(
    account_id: UUID = Depends(get_current_account_id),
    session: AsyncSession = Depends(get_db_session),
) -> PermissionTree:
    """Resolve the current account's permission tree via Employee -> Role."""
    employee = await EmployeeRepository(session).get_by_account_id(account_id)
    if employee is None or employee.role_id is None:
        return {}
    role = await RoleRepository(session).get_by_id(employee.role_id)
    if role is None or role.deleted_at is not None:
        return {}
    return effective_permissions(role.is_system, role.permissions)


def require_permission(
    module: PermissionModule, action: PermissionAction
) -> Callable[..., Awaitable[None]]:
    """Return a FastAPI dependency that enforces `action` on `module`."""

    async def _checker(
        permissions: PermissionTree = Depends(get_current_permissions),
    ) -> None:
        if not has_permission(permissions, module, action):
            raise ForbiddenError(
                message_key="errors.auth.forbidden",
                detail={"module": str(module), "action": str(action)},
            )

    return _checker
