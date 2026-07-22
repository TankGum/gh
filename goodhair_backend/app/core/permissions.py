from app.core.constants import PermissionAction, PermissionModule

PermissionTree = dict[str, dict[str, bool]]

# Một số màn cần đọc dữ liệu tham chiếu (chỉ xem) từ module khác để hiển thị
# — vd màn "Đặt lịch" cần tên barber/chi nhánh/dịch vụ/ca làm để vẽ bảng lịch.
# Nếu bắt cấp thêm quyền VIEW riêng cho từng module phụ đó thì vô lý (role chỉ
# cần xem lịch hẹn không nên phải có quyền quản lý nhân viên/chi nhánh...).
# Vì vậy: có VIEW ở module bên trái thì coi như cũng có VIEW ở các module bên
# phải — chỉ áp dụng cho action VIEW, không áp dụng cho create/edit/delete.
VIEW_DEPENDENCIES: dict[PermissionModule, tuple[PermissionModule, ...]] = {
    PermissionModule.BOOKINGS: (
        PermissionModule.STAFF,
        PermissionModule.BRANCHES,
        PermissionModule.SERVICES,
        PermissionModule.SHIFTS,
        PermissionModule.ROLES,
    ),
}


def has_permission(
    permissions: PermissionTree,
    module: PermissionModule,
    action: PermissionAction,
) -> bool:
    """True nếu permissions cấp trực tiếp `action` trên `module`, hoặc (khi
    action là VIEW) người dùng có VIEW ở 1 module "cha" kéo theo module này."""
    module_perms = permissions.get(module)
    if module_perms and module_perms.get(action, False):
        return True
    if action != PermissionAction.VIEW:
        return False
    for parent, dependents in VIEW_DEPENDENCIES.items():
        if module not in dependents:
            continue
        parent_perms = permissions.get(parent)
        if parent_perms and parent_perms.get(PermissionAction.VIEW, False):
            return True
    return False


def all_permissions_granted() -> PermissionTree:
    """Full permission tree: every action allowed on every module."""
    return {
        module.value: {action.value: True for action in PermissionAction}
        for module in PermissionModule
    }


def effective_permissions(is_system: bool, stored: PermissionTree | None) -> PermissionTree:
    """Role hệ thống (Admin) luôn có toàn quyền trên mọi module — kể cả module
    mới thêm sau này — thay vì phụ thuộc bản ghi permissions đã lưu trong DB
    (vốn chỉ được seed 1 lần và không tự cập nhật khi có module quyền mới)."""
    if is_system:
        return all_permissions_granted()
    return stored or {}
