from app.core.constants import PermissionAction, PermissionModule
from app.core.permissions import all_permissions_granted, has_permission


def test_has_permission_true_when_granted() -> None:
    perms = {"branches": {"view": True, "create": False}}
    result = has_permission(perms, PermissionModule.BRANCHES, PermissionAction.VIEW)
    assert result is True


def test_has_permission_false_when_action_denied() -> None:
    perms = {"branches": {"view": True, "create": False}}
    result = has_permission(perms, PermissionModule.BRANCHES, PermissionAction.CREATE)
    assert result is False


def test_has_permission_false_when_module_missing() -> None:
    assert has_permission({}, PermissionModule.ROLES, PermissionAction.VIEW) is False


def test_has_permission_false_when_action_key_absent() -> None:
    perms = {"roles": {"view": True}}
    result = has_permission(perms, PermissionModule.ROLES, PermissionAction.DELETE)
    assert result is False


def test_has_permission_handles_none_module_value() -> None:
    perms = {"roles": None}
    assert has_permission(perms, PermissionModule.ROLES, PermissionAction.VIEW) is False


def test_all_permissions_granted_covers_every_module_and_action() -> None:
    granted = all_permissions_granted()
    assert set(granted.keys()) == {m.value for m in PermissionModule}
    for module in PermissionModule:
        for action in PermissionAction:
            assert granted[module.value][action.value] is True
