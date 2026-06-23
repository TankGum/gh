import pytest

from app.auth.dependencies import require_permission
from app.core.constants import PermissionAction, PermissionModule
from app.core.exceptions import ForbiddenError


async def test_require_permission_passes_when_granted() -> None:
    checker = require_permission(PermissionModule.BRANCHES, PermissionAction.VIEW)
    perms = {"branches": {"view": True}}
    assert await checker(permissions=perms) is None


async def test_require_permission_raises_when_denied() -> None:
    checker = require_permission(PermissionModule.BRANCHES, PermissionAction.DELETE)
    with pytest.raises(ForbiddenError) as exc:
        await checker(permissions={"branches": {"view": True}})
    assert exc.value.status_code == 403
    assert exc.value.detail == {"module": "branches", "action": "delete"}


async def test_require_permission_raises_when_no_permissions() -> None:
    checker = require_permission(PermissionModule.ROLES, PermissionAction.VIEW)
    with pytest.raises(ForbiddenError):
        await checker(permissions={})
