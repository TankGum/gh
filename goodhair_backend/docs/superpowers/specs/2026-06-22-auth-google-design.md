# Auth — Google Sign-In + JWT (httpOnly Cookie)

**Date:** 2026-06-22  
**Scope:** Đăng nhập qua Google, quản lý tài khoản chờ duyệt, bảo vệ API private bằng JWT cookie.

---

## 1. Data Models

### `accounts`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| google_id | varchar unique | `sub` từ Google ID token |
| email | varchar unique | |
| name | varchar | |
| avatar_url | varchar nullable | `picture` từ Google |
| status | enum | `pending` / `approved` / `rejected` |
| requested_at | timestamptz | thời điểm xin vào hệ thống |
| TimestampMixin | created_at, updated_at | |
| SoftDeleteMixin | deleted_at | |

### `employees` (minimal, tạo khi account được duyệt)
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| account_id | UUID unique FK → accounts | |
| name | varchar | copy từ Google |
| email | varchar | copy từ Google |
| avatar_url | varchar nullable | copy từ Google |
| branch_id | UUID nullable FK → branches | gán sau |
| TimestampMixin | created_at, updated_at | |
| SoftDeleteMixin | deleted_at | |

### `refresh_tokens`
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| account_id | UUID FK → accounts (cascade) | |
| token_hash | varchar unique | SHA-256 của raw token |
| expires_at | timestamptz | |
| revoked_at | timestamptz nullable | logout hoặc rotate |
| created_at | timestamptz | |

---

## 2. Auth Flow

```
POST /auth/google  ← { idToken } từ Google GIS
  │
  ├── Verify ID token với Google API (google-auth library)
  │   → lấy: sub, email, name, picture
  │
  ├── Account chưa tồn tại
  │     → Tổng số accounts = 0?
  │         → Có: tạo account (status=approved, requested_at=now()) + tạo employee + issue tokens
  │         → Không: tạo account (status=pending, requested_at=now()) → 403 pending
  │
  ├── Account tồn tại + approved → issue tokens (access + refresh)
  ├── Account tồn tại + pending  → 403 "Đang chờ duyệt"
  └── Account tồn tại + rejected → 403 "Bị từ chối"
```

**Tokens (httpOnly cookies):**
- `access_token`: JWT, TTL = 15 phút, httpOnly, SameSite=Lax
- `refresh_token`: JWT (jti=uuid), TTL = 30 ngày, httpOnly, SameSite=Lax
- `secure=True` khi app_env != LOCAL

**JWT access token payload:** `{ sub: account_id, email, status, type: "access" }`  
**JWT refresh token payload:** `{ sub: account_id, jti: uuid, type: "refresh" }`

---

## 3. API Endpoints

### Public
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/google` | Verify Google ID token, set cookies |
| POST | `/api/v1/auth/refresh` | Đổi refresh_token cookie → access_token mới |
| POST | `/api/v1/auth/logout` | Revoke refresh token, xóa cookies |
| GET | `/api/v1/auth/me` | Thông tin account hiện tại |

### Private (yêu cầu access_token cookie hợp lệ)
| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/accounts` | Danh sách accounts, filter status, phân trang |
| GET | `/api/v1/accounts/{id}` | Chi tiết account |
| PATCH | `/api/v1/accounts/{id}/approve` | Duyệt → approved + tạo employee |
| PATCH | `/api/v1/accounts/{id}/reject` | Từ chối |
| DELETE | `/api/v1/accounts/{id}` | Soft delete |

---

## 4. Dependency Update

`get_current_user_id` đổi từ `OAuth2PasswordBearer` sang đọc `access_token` cookie:
```python
async def get_current_account(access_token: str | None = Cookie(default=None)) -> AccountRead:
    # decode JWT, verify type="access", verify status=approved
    # raise 401 nếu invalid/expired
```

---

## 5. Frontend

**Packages:** `@react-oauth/google`

**Env vars:**
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (public)

**Trang `/login`** (route mới):
- `<GoogleOAuthProvider>` + `<GoogleLogin>` button
- Gọi `POST /auth/google` với `credentials: 'include'`
- approved → redirect `/services`
- pending/rejected → hiện thông báo

**`(admin)` layout protection:**
- Gọi `GET /auth/me` server-side (hoặc client-side check)
- 401 → thử `/auth/refresh` → fail → redirect `/login`

**Màn `/accounts`:**
- Bảng: avatar, tên, email, requested_at, status badge
- Tab filter: Tất cả / Chờ duyệt / Đã duyệt / Từ chối
- Nút Duyệt / Từ chối trên dòng pending

**Sidebar:**
- User profile section: dùng data từ `/auth/me` thay hardcode "Anh Tuấn"
- Thêm nút Đăng xuất → `POST /auth/logout` → redirect `/login`

**Landing page:**
- Nút "Tiếp tục với Google" → redirect `/login` (không dùng modal mock nữa)

---

## 6. Packages cần thêm

**Backend:** `google-auth`, `requests`  
**Frontend:** `@react-oauth/google`
