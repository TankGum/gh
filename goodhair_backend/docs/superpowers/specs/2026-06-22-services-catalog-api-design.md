# Thiết kế API — Màn hình "Dịch vụ & bảng giá"

- Ngày: 2026-06-22
- Phạm vi: Backend API cho màn hình quản lý danh mục dịch vụ (`/dich-vu`) và cung cấp
  dữ liệu dịch vụ cho popup Đặt lịch.
- Tuân theo: `ARCHITECTURE.md` (layered architecture, camelCase API / snake_case Python,
  UUID PK, soft-delete, `PageParams`/`PaginatedResponse`, Service→Repository→Model).

---

## 1. Quyết định đã chốt

| Quyết định | Lựa chọn |
|---|---|
| Mô hình giá | **1 giá chung** cho mọi cửa hàng (1 cột `price`, 1 `duration_minutes`) |
| Quan hệ dịch vụ ↔ cửa hàng | **Link table** `service_branches` + entity `Branch` (bản tối thiểu) |
| Endpoint cho popup Đặt lịch | **Dùng chung** `GET /services` (lọc `status=active`) |
| Bảng `branches` | Tạo **bản tối thiểu** trong task này để có FK cho link table |
| Đổi trạng thái Đang bán/Tạm ẩn | **Gộp vào** `PATCH /services/{id}` (field `status`) |

---

## 2. Data model

### Bảng `services`
| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | UUID PK | `UUIDPrimaryKeyMixin` |
| `name` | varchar(255), index | tên dịch vụ (search) |
| `description` | varchar(500) nullable | "Mô tả" |
| `duration_minutes` | int | "Thời lượng" (phút), ≥ 1 |
| `price` | int | "Giá" — VND số nguyên, ≥ 0 |
| `status` | enum `ServiceStatus` (`active`/`hidden`) | "Đang bán" / "Tạm ẩn" |
| `is_all_branches` | bool, default true | true = "Tất cả cửa hàng" |
| `created_at` / `updated_at` | timestamptz | `TimestampMixin` |
| `created_by` / `updated_by` | UUID nullable | `AuditMixin` — móc sẵn cho logs history |
| `deleted_at` | timestamptz nullable | `SoftDeleteMixin` (xóa mềm) |

### Bảng `branches` (bản tối thiểu — module "Chi nhánh" sẽ mở rộng sau)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | UUID PK | |
| `name` | varchar(255) | "Saigon Centre"… |
| `code` | varchar(50) unique nullable | mã ngắn |
| `created_at` / `updated_at` | timestamptz | `TimestampMixin` |
| `deleted_at` | timestamptz nullable | `SoftDeleteMixin` |

### Bảng nối `service_branches` (many-to-many)
- `service_id` (FK → `services.id`, ON DELETE CASCADE), `branch_id` (FK → `branches.id`), **PK kép**.
- Quy ước: `is_all_branches = true` → bảng nối **rỗng** (áp dụng mọi cửa hàng).
  `false` → liệt kê cụ thể các `branch_id`.
- Nhãn "N/6 cửa hàng" = (số dòng nối) / (tổng số branch chưa xóa).

---

## 3. Endpoints — prefix `/api/v1/services`

| Method | Path | Mục đích | Status code |
|---|---|---|---|
| `GET` | `/services` | List + search + filter + phân trang. Phục vụ cả popup Đặt lịch | 200 |
| `POST` | `/services` | Thêm dịch vụ | 201 |
| `GET` | `/services/{id}` | Chi tiết (kèm danh sách cửa hàng) | 200 |
| `PATCH` | `/services/{id}` | Sửa: giá/thời lượng/mô tả, gán cửa hàng, đổi `status` | 200 |
| `DELETE` | `/services/{id}` | Xóa mềm | 204 |

### Query params của `GET /services`
- `q`: tìm theo tên (icontains, không phân biệt hoa thường).
- `branchId`: lọc dịch vụ available ở cửa hàng đó (khớp nếu `is_all_branches=true`
  HOẶC có dòng nối tới `branchId`).
- `status`: `active` | `hidden`. (Popup Đặt lịch truyền `active`.)
- `page`, `size`: theo `PageParams` (`size` mặc định 20, tối đa 100).

---

## 4. Schemas (camelCase ra ngoài)

### `ServiceRead` (dùng cho cả list quản trị & popup Đặt lịch)
```jsonc
{
  "id": "uuid",
  "name": "Royal Combo",
  "description": "Cắt + gội + cạo + massage",
  "durationMinutes": 90,
  "price": 380000,
  "status": "active",            // active | hidden
  "isAllBranches": false,
  "branchIds": ["uuid", "uuid"], // rỗng khi isAllBranches=true
  "branchCount": 4,              // số cửa hàng áp dụng
  "totalBranches": 6,            // tổng cửa hàng -> FE render "4/6 cửa hàng"
  "createdAt": "...",
  "updatedAt": "..."
}
```
> FE tự dựng nhãn cột "Cửa hàng": `isAllBranches=true` → "Tất cả cửa hàng";
> ngược lại → `"{branchCount}/{totalBranches} cửa hàng"`.
> Popup Đặt lịch chỉ dùng `id`, `name`, `price`, `durationMinutes`.

### `ServiceCreate`
```jsonc
{
  "name": "Royal Combo",
  "description": "Cắt + gội + cạo + massage",
  "durationMinutes": 90,
  "price": 380000,
  "status": "active",
  "isAllBranches": false,
  "branchIds": ["uuid", "uuid"]   // bắt buộc ≥1 khi isAllBranches=false; bỏ qua khi true
}
```

### `ServiceUpdate`
- Mọi field optional, `model_dump(exclude_unset=True)` — chỉ cập nhật field được gửi.
- Gửi riêng `status` để đổi Đang bán ↔ Tạm ẩn.
- Gửi `isAllBranches` + `branchIds` để gán lại cửa hàng (thay thế toàn bộ link).

### Validation
- `price ≥ 0`, `durationMinutes ≥ 1`, `name` 1–255 ký tự, `description` ≤ 500.
- `isAllBranches=false` ⇒ `branchIds` phải có ≥ 1 phần tử và **mọi id phải tồn tại**
  (branch chưa xóa); nếu sai → `BadRequestError` (`SERVICE_INVALID_BRANCH`).
- `isAllBranches=true` ⇒ bỏ qua `branchIds` (xóa hết link hiện có).
- Không tìm thấy service → `NotFoundError`.

---

## 5. Phân tầng & file (theo cấu trúc sẵn có)

| Tầng | File mới |
|---|---|
| Models | `app/models/service.py`, `app/models/branch.py` (+ bảng nối `service_branches`) |
| Schemas | `app/schemas/service.py` |
| Repository | `app/db/repositories/service.py`, `app/db/repositories/branch.py` |
| Service (business) | `app/services/services_catalog/service.py` |
| Route | `app/api/private/services/router.py` (private = UI quản trị nội bộ) → đăng ký trong `app/api/router.py` |
| Constants | `app/core/constants.py`: thêm `ServiceStatus` enum + `PermissionModule.SERVICE` |
| Migration | 1 Alembic migration tạo `services`, `branches`, `service_branches` |

**Business logic chính (service layer):**
- `list_services(q, branch_id, status, page)` — build query filter ở repository, trả
  `(items, total)`; tính `branch_count` (per service) và `total_branches` (1 lần) để map sang `ServiceRead`.
- `create_service(payload)` — validate branch, tạo service + link rows.
- `update_service(id, payload)` — validate branch nếu gán lại; replace link rows.
- `delete_service(id)` — soft delete (link rows giữ nguyên, bị bỏ qua khi đọc).

---

## 6. Future work — TODO (KHÔNG implement trong task này)

> Đã chừa móc nối sẵn để các task sau gắn vào mà không phải refactor model/route.

### TODO-1: Phân quyền (authorization)
- Thêm `PermissionModule.SERVICE` + dùng `PermissionAction` (`READ/CREATE/UPDATE/DELETE`)
  sẵn có trong `core/constants.py`.
- Gắn dependency kiểm tra quyền vào từng route, ví dụ:
  `Depends(require_permission([(PermissionModule.SERVICE, PermissionAction.CREATE)]))`
  (theo pattern mục 4.f của `ARCHITECTURE.md`).
- Hiện tại các route để **public** (chưa chặn quyền) — chỉ thêm enum, chưa enforce.

### TODO-2: Logs history (audit / activity log)
- Model đã kế thừa `AuditMixin` (`created_by`/`updated_by`) — sẽ được điền khi có auth context.
- Sau này: ghi bản ghi lịch sử thay đổi (ai sửa gì, lúc nào) cho mục "Nhật ký hoạt động"
  trong sidebar — qua middleware audit-log hoặc bảng `activity_logs` riêng.
- Service layer sẽ nhận `actor_id` để set `created_by`/`updated_by` khi đã có phân quyền.

---

## 7. Ngoài phạm vi (out of scope)
- Giá riêng theo từng cửa hàng (đã chốt: 1 giá chung).
- CRUD đầy đủ cho `branches` (chỉ tạo bảng tối thiểu; module "Chi nhánh" làm sau).
- Endpoint `/services/options` riêng cho popup (đã chốt: dùng chung `GET /services`).

> Ghi chú: sau khi làm xong, FE gọi `GET /api/v1/services` sẽ lấy data thật thay vì
> mock (xem `goodhair_frontend/src/services/dich-vu.service.ts`).
