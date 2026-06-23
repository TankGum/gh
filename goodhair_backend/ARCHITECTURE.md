# Blueprint kiến trúc Backend (FastAPI + SQLAlchemy)

Tài liệu này mô tả **một cách tổng quát** cấu trúc thư mục, cách phân tầng, công nghệ
và coding style của một backend FastAPI quy mô vừa/lớn. Mục đích là làm **khuôn mẫu
tham khảo**

---

## 1. Triết lý kiến trúc

Dự án theo **kiến trúc phân tầng (layered architecture)** với luồng dữ liệu một chiều:

```
HTTP Request
   │
   ▼
[Route]      ──>  điều phối HTTP, validate input/output, kiểm tra quyền
   │
   ▼
[Service]    ──>  business logic, tính toán, đồng bộ, orchestration
   │
   ▼
[Repository] ──>  truy cập dữ liệu (query/insert/update), không chứa nghiệp vụ
   │
   ▼
[Model]      ──>  định nghĩa bảng (ORM)

[Schema] (DTO) nằm ở ranh giới vào/ra giữa Route và bên ngoài
```

**Nguyên tắc cốt lõi:**
- Mỗi tầng chỉ gọi tầng ngay dưới nó, không "nhảy cóc".
- Route mỏng — không chứa business logic, không viết query trực tiếp.
- Service không biết về HTTP (không nhận `Request`, không trả `Response`).
- Repository không chứa nghiệp vụ — chỉ thao tác dữ liệu.
- Models (ORM) và Schemas (DTO) là hai thứ tách biệt, không dùng lẫn.

---

## 2. Tech Stack

| Nhóm | Lựa chọn |
|------|----------|
| Web framework | **FastAPI** + Uvicorn |
| ORM / DB | **SQLAlchemy 2.0** + PostgreSQL, **Alembic** cho migration |
| Validation / DTO | **Pydantic v2** + pydantic-settings (đọc config từ env) |
| Auth | OAuth 2.0 + **JWT** (access token ngắn hạn + refresh token dài hạn) |
| Logging | Loguru (hoặc structlog) |
| Scheduler | APScheduler (cho cron job nền) |
| Quản lý package | **Poetry** |
| Lint / Format | **Ruff** |
| Type check | mypy hoặc `ty` |
| Test | **pytest** + testcontainers (DB thật trong Docker) |
| CI / Quality | pre-commit, SonarQube |
| Container / Runtime | **Docker** + Docker Compose cho local/dev runtime |

> Stack này có thể thay linh hoạt — điểm quan trọng là **mỗi mối quan tâm có một
> công cụ chuyên trách** (validation, migration, logging, test...).

---

## 3. Cấu trúc thư mục chuẩn

```
app/
├── main.py            # Entry point (chỉ vài dòng: khởi tạo & chạy app)
├── app_factory.py     # create_app(): tách riêng cấu hình logging/exception/middleware/router
│
├── api/               # TẦNG ROUTE — chỉ điều phối HTTP
│   ├── private/       #   API cho giao diện quản trị nội bộ
│   ├── internal/      #   API service-to-service (webhook/callback nội bộ)
│   └── public/        #   API công khai (health check, endpoint public)
│       └── <domain>/  #   nhóm route theo domain nghiệp vụ
│
├── services/          # TẦNG BUSINESS LOGIC
│   └── <domain>/      #   mỗi nghiệp vụ một thư mục con
│
├── db/                # TẦNG TRUY CẬP DỮ LIỆU
│   ├── engine.py      #   tạo engine + connection pool
│   ├── session.py     #   session dependency cho FastAPI
│   └── repositories/  #   Repository pattern — mỗi domain một repo
│       └── base.py    #   BaseRepository với CRUD dùng chung
│
├── models/            # SQLAlchemy ORM models (chia theo domain)
│   └── base.py        #   Base + các Mixin (timestamp, audit, ...)
│
├── schemas/           # Pydantic DTO request/response
│   └── base.py        #   Base schema (camelCase, pagination, timezone...)
│
├── auth/              # JWT service, OAuth flow, auth dependencies
├── middlewares/       # access log, audit log, kiểm tra quyền
├── core/              # settings, constants (enum), logger, exceptions
├── scheduler/         # cron jobs nền (nếu có)
├── clients/           # HTTP client gọi hệ thống bên ngoài
├── utils/             # hàm tiện ích dùng chung
├── templates/         # template (email, ...)
├── alembic/           # migration scripts
└── tests/             # unit / integration / benchmark

Dockerfile             # image chạy FastAPI bằng Poetry
docker-compose.yml     # API + PostgreSQL cho local/dev
.dockerignore          # loại file không cần copy vào image
.env.example           # mẫu biến môi trường
```

**Quy ước chia nhóm:**
- `api/` chia theo **đối tượng tiêu thụ**: `private` (UI nội bộ), `internal`
  (service-to-service), `public` (bên ngoài). Trong mỗi nhóm lại chia theo **domain**.
- `services/`, `models/`, `db/repositories/` đều **chia theo cùng một bộ domain** để
  dễ định vị (vd domain `payout` xuất hiện ở cả 3 nơi).

---

## 4. Các pattern nền tảng nên áp dụng

### a) App Factory
`create_app()` khởi tạo app và tách từng phần cấu hình thành hàm riêng
(`configure_logging`, `configure_middleware`, `configure_exception_handler`,
`configure_router`). Giúp dễ test và dễ đọc.

### b) Repository Pattern + Base class
Một `BaseRepository` generic cung cấp sẵn CRUD (`get_by_id`, `list`, `create`,
`update`, `soft_delete`, `count`, phân trang). Repo cụ thể kế thừa và chỉ thêm
query riêng của domain. Tập trung logic dữ liệu, tránh lặp.

### c) Base Schema chuẩn hoá
- Toàn bộ DTO dùng một config chung: **API giao tiếp camelCase, code Python dùng
  snake_case** (qua `alias_generator`).
- Có sẵn `Pagination` chuẩn cho mọi danh sách.
- Có model base xử lý **timezone** tự động (request → UTC, response → local).

### d) Base Model + Mixins
- `TimestampMixin` (created_at/updated_at), base UUID primary key,
  `AuditMixin` (created_by/updated_by) — gắn vào model qua kế thừa.
- Hỗ trợ **soft delete** (cờ `deleted_at` hoặc `status`) thay vì xoá cứng.

### e) Session management qua Dependency
Session DB được cấp qua FastAPI `Depends`: yield session, **handler tự gọi `commit()`**,
tự `rollback` khi có exception, luôn `close`. Transaction biên rõ ràng ở tầng route.

### f) Phân quyền bằng Dependency
Kiểm tra quyền khai báo ngay trong signature route, vd:
`Depends(require_permission([(Module, Action)]))`. Dùng enum cho module/action.

### g) Exception + i18n chuẩn hoá (Tiếng Việt, Tiếng Anh)
Định nghĩa exception nghiệp vụ (NotFound, BadRequest, ...) với **error code / i18n key**
thay vì hard-code message; một exception handler tập trung chuyển thành HTTP response.

### h) Config qua Pydantic Settings
Mọi cấu hình đọc từ biến môi trường qua một class `Settings` (pydantic-settings),
truy cập qua `get_settings()`. Không hard-code secret/URL trong code.

### i) Docker-first local runtime
Dự án chạy local/dev bằng Docker Compose để đồng bộ môi trường giữa các máy:
- `api` build từ `Dockerfile`, chạy Uvicorn, mount source code để reload khi sửa file.
- `postgres` dùng image PostgreSQL chính thức, có healthcheck và volume riêng.
- `DATABASE_URL` trong container trỏ tới host service `postgres`, không dùng `localhost`.
- Các lệnh migration, test, lint, type-check chạy qua `docker compose run --rm api ...`.

---

## 5. Coding style & quy ước

- **Cấm import tương đối** — luôn import tuyệt đối từ package gốc.
- **Cấm import bên trong hàm** (trừ trường hợp đặc biệt có chú thích).
- Format thống nhất bằng Ruff: line-length 88, double quotes, isort tự sắp xếp import.
- Đặt tên route, permission, status... bằng **Enum** trong `core/constants`.
- Route theo khuôn: gọi repo/service → `commit()` → trả về schema response;
  bọc `try/except`, log lỗi rồi raise exception chuẩn.
- Logging qua một logger tập trung (không dùng `print`).

---

## 6. Tổ chức testing

- Chia rõ:
  - `tests/unit/` — nhanh, không cần DB.
  - `tests/integration/` — dùng **testcontainers** spin DB thật + chạy migration.
  - `tests/benchmark/` — test hiệu năng, mặc định bị skip, chỉ chạy khi cần.
- **Cấu trúc thư mục test mirror cấu trúc source** để dễ định vị.
- Fixtures chính: container DB, session transactional (rollback sau mỗi test),
  test client kèm auth thật.

---

## 7. Checklist khởi tạo dự án mới theo blueprint này

- [ ] Khởi tạo Poetry + cấu hình Ruff/type-checker/pre-commit trong `pyproject.toml`.
- [ ] Khởi tạo Dockerfile + docker-compose.yml cho API và PostgreSQL.
- [ ] Dựng khung thư mục `app/` như mục 3 (bắt đầu với 1 domain mẫu).
- [ ] Viết `core/settings.py` (Pydantic Settings) + `core/constants.py` (enums).
- [ ] Viết `db/engine.py`, `db/session.py`, `db/repositories/base.py`.
- [ ] Viết `models/base.py` (Base + Mixins) và `schemas/base.py` (DTO base).
- [ ] Thiết lập `app_factory.py` + `main.py`.
- [ ] Thiết lập Alembic cho migration.
- [ ] Thiết lập auth (JWT/OAuth) + middleware phân quyền + audit log.
- [ ] Dựng khung `tests/` (unit + integration với testcontainers).
- [ ] Hoàn thiện một **vertical slice** mẫu (route → service → repo → model → schema)
      để các domain sau copy theo.
```
