# Thiết kế: Phân quyền theo module (Module Permissions)

- Ngày: 2026-06-22
- Trạng thái: Đã duyệt thiết kế, chờ viết implementation plan
- Phạm vi: Backend (`goodhair_backend`) + Frontend (`goodhair_frontend`)

## 1. Mục tiêu

Áp dụng phân quyền (authorization) theo từng **module** cho hệ thống quản trị GoodHair.
Mỗi vai trò (Role) đã có sẵn cấu hình quyền dạng `{module: {view, create, edit, delete}}`.
Việc còn thiếu là **enforce** quyền này:

- Backend chặn thật ở mọi endpoint private (nguồn chân lý bảo mật).
- Frontend ẩn menu/nút và chặn route theo quyền (UX).

Màn quản lý vai trò và việc gán vai trò trong màn nhân viên **đã có sẵn**, không nằm
trong phạm vi xây mới (chỉ tận dụng).

## 2. Hiện trạng (đã có)

- `app/models/role.py`: `Role.permissions: dict` (JSON), `is_system: bool`, `key` unique.
- `app/models/employee.py`: `Employee.role_id` FK → roles; `account_id` unique FK → accounts.
- `app/core/constants.py`: `PermissionModule` (11 module), `PermissionAction` (view/create/edit/delete).
- `app/schemas/role.py`: `PermissionMap {view, create, edit, delete}`.
- `app/auth/dependencies.py`: `get_current_account_id` — chỉ xác thực đăng nhập, **chưa** check quyền.
- `app/services/auth/service.py`: user **đầu tiên** được tạo Employee và gán role qua
  `role_repo.get_by_key("admin")` — nhưng **chưa có role `admin` nào được seed** → hiện trả None.
- Frontend: `AuthContext` chỉ lưu `account` (không có permissions); `Sidebar` hiện đủ 12 mục;
  `AdminAuthGuard` chỉ kiểm tra đã đăng nhập; màn `roles` và gán role ở màn `employees` đã có.

### Liên kết quyền (data flow)

```
Account → Employee (account_id unique) → Role → permissions: {module: PermissionMap}
```

Quyền được **resolve từ DB mỗi request** (không nhúng vào JWT) để admin đổi role/quyền là
có hiệu lực ngay ở request kế tiếp.

## 3. Danh sách module (khớp UI role hiện tại)

`overview, bookings, revenue, staff, shifts, customers, branches, services, recruit, roles, logs`

Màn **"Tài khoản" (accounts)** không có module quyền riêng → gom vào quyền module `roles`
(đều là chức năng quản trị). Đây là quy ước có thể thay đổi sau.

## 4. Backend

### 4.1 Seed system role `admin`

Migration Alembic mới chèn 1 role:

- `key = "admin"`, `name = "Quản trị viên"` (hoặc tương đương), `is_system = True`.
- `permissions` = full (`view/create/edit/delete = true`) cho **tất cả 11 module**.
- Idempotent: chỉ insert nếu chưa tồn tại role `key='admin'`.
- `downgrade`: xóa role `key='admin'`.

Sau seed, user đầu tiên (logic đã có ở `login_with_google`) sẽ tự được gán role admin →
có toàn quyền. Không cần code bypass đặc biệt.

### 4.2 Dependency phân quyền (`app/auth/dependencies.py`)

- `get_current_permissions(account_id, session) -> dict[str, PermissionMap]`
  - Query Employee theo `account_id` (join Role).
  - Không có Employee hoặc `role_id` None → trả `{}` (không quyền).
  - Trả `role.permissions` (đã là `{module: {view,create,edit,delete}}`).
- `require_permission(module: PermissionModule, action: PermissionAction)` — factory:
  - Trả về một dependency FastAPI.
  - Resolve permissions; nếu `permissions[module][action]` không True → raise `ForbiddenError`
    (`message_key="errors.auth.forbidden"`, detail gồm module + action).
  - Ngầm yêu cầu đã đăng nhập (dùng `get_current_account_id`).

Lưu ý kiến trúc (theo ARCHITECTURE.md): logic resolve quyền là điều phối ở ranh giới
Route/auth — đặt ở tầng `auth/dependencies.py`, truy vấn qua repository hiện có
(`EmployeeRepository`/`RoleRepository`), không viết query trực tiếp trong route.

### 4.3 Áp dụng vào router

Thay `Depends(get_current_account_id)` bằng `Depends(require_permission(module, action))`
ở từng endpoint theo bảng map (giữ nguyên hành vi nghiệp vụ, chỉ thêm gate quyền):

| Router | Module | GET (view) | POST (create) | PATCH (edit) | DELETE (delete) |
|---|---|---|---|---|---|
| services | `services` | ✓ | ✓ (gồm cả upload image) | ✓ | ✓ |
| branches | `branches` | ✓ | ✓ (gồm cả upload image) | ✓ | ✓ |
| employees | `staff` | ✓ | — | ✓ | ✓ |
| roles | `roles` | ✓ | ✓ | ✓ | ✓ |
| accounts | `roles` | ✓ | — | ✓ (approve/reject) | ✓ |

Endpoint không khớp HTTP method mặc định (vd `accounts/approve` là PATCH = edit,
`POST /image` = create) sẽ map **tường minh** theo bảng trên, không suy ra tự động từ method.

### 4.4 Mở rộng `/auth/me`

- Schema mới `MeRead` (kế thừa `AccountRead`) bổ sung:
  - `role: {id, name, key} | null`
  - `permissions: dict[str, PermissionMap]`
- Endpoint `GET /auth/me` resolve Employee+Role của account và trả `MeRead`.
- Account chưa có employee/role → `role = null`, `permissions = {}`.

## 5. Frontend

### 5.1 AuthContext

- `getMe()` trả về thêm `role` + `permissions`; lưu vào context.
- Thêm type `Me` (Account + role + permissions).
- Helpers:
  - `can(module, action): boolean`
  - `canView(module): boolean` (= `can(module, 'view')`)
- `permissions` rỗng coi như không có quyền nào.

### 5.2 Mapping route → module (file dùng chung)

Một map dùng chung cho cả Sidebar và guard:

```
/dashboard → overview
/manage-bookings → bookings
/revenue → revenue
/employees → staff
/shifts → shifts
/customers → customers
/branches → branches
/services → services
/recruitment → recruit
/accounts → roles
/roles → roles
/audit-log → logs
```

### 5.3 Sidebar

Lọc `menuItems` chỉ hiển thị mục có `canView(module)` tương ứng. Trong lúc `loading` →
hiển thị trạng thái chờ (không nhấp nháy đủ menu rồi mới ẩn).

### 5.4 Route guard

Mở rộng `AdminAuthGuard` (hoặc thêm `PermissionGuard` bọc bên trong):

- Sau khi đã đăng nhập: lấy module của route hiện tại từ map.
- Không có `canView(module)` → redirect về **trang đầu tiên** user có quyền view
  (admin full → `/dashboard`).
- Không có quyền view ở **bất kỳ** module nào → hiển thị trang/thông báo
  "Chưa được cấp quyền, vui lòng liên hệ quản trị viên".

### 5.5 Nút thao tác trong từng màn

Ẩn (hoặc disable) các nút **Thêm / Sửa / Xóa** theo `can(module, action)` ở các màn đã có
API enforce: services, branches, employees(staff), roles, accounts. Các màn chưa có API
chỉ cần gate ở mức hiển thị menu/route.

> Lưu ý frontend: dự án dùng bản Next.js có breaking changes — đọc
> `node_modules/next/dist/docs/` trước khi viết code FE (theo `goodhair_frontend/AGENTS.md`).

## 6. Testing

### Backend (pytest)
- Unit `require_permission`: có đủ quyền (pass), thiếu quyền (403), account không có
  employee/role (403), module/action không tồn tại trong permissions (403).
- Unit `get_current_permissions`: trả đúng dict; rỗng khi không có role.
- Integration: 1–2 endpoint đại diện (vd `GET /roles`, `DELETE /branches/{id}`) — 403 khi
  thiếu quyền, 2xx khi đủ.
- Migration seed: sau upgrade tồn tại role `key='admin'` full quyền; idempotent.

### Frontend
- Chủ yếu kiểm thử thủ công: sidebar lọc đúng theo quyền; redirect khi vào URL không có
  quyền; ẩn nút Thêm/Sửa/Xóa đúng theo quyền; user không có quyền nào thấy trang thông báo.

## 7. Ngoài phạm vi (Out of scope)

- Xây mới màn quản lý vai trò hoặc UI gán role (đã có).
- API cho các module chưa tồn tại (overview, bookings, revenue, shifts, customers, recruit, logs).
- Phân quyền theo bản ghi/branch-level (chỉ làm cấp module).
- Caching permissions / nhúng vào JWT (cố tình resolve DB mỗi request để cập nhật tức thời).

## 8. Rủi ro & giả định

- **Giả định**: luôn tồn tại ít nhất 1 admin (user đầu tiên) sau khi seed.
- **Rủi ro**: nếu xóa hết role admin hoặc gỡ role của admin cuối cùng → mất quyền quản trị.
  (Không xử lý "chặn xóa admin cuối" trong phạm vi này — ghi nhận để cân nhắc sau.)
- **Giả định**: gom màn "Tài khoản" vào quyền `roles` là chấp nhận được; có thể tách module
  riêng sau nếu cần.
