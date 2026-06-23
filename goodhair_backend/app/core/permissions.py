from app.core.constants import PermissionAction, PermissionModule

PermissionTree = dict[str, dict[str, bool]]


def has_permission(
    permissions: PermissionTree,
    module: PermissionModule,
    action: PermissionAction,
) -> bool:
    """True only if permissions explicitly grant `action` on `module`."""
    module_perms = permissions.get(module)
    if not module_perms:
        return False
    return bool(module_perms.get(action, False))


def all_permissions_granted() -> PermissionTree:
    """Full permission tree: every action allowed on every module."""
    return {
        module.value: {action.value: True for action in PermissionAction}
        for module in PermissionModule
    }
