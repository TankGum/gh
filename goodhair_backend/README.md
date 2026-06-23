# GoodHair Backend

Backend FastAPI theo kiến trúc phân tầng trong `ARCHITECTURE.md`.

## Chạy bằng Docker

```bash
cp .env.example .env
docker compose up --build
```

API chạy tại:

```text
http://localhost:8002/api/v1/health
```

## Migration

```bash
docker compose run --rm api alembic revision --autogenerate -m "init"
docker compose run --rm api alembic upgrade head
```

## Kiểm tra chất lượng

```bash
docker compose run --rm api ruff check .
docker compose run --rm api ruff format .
docker compose run --rm api mypy app
docker compose run --rm api pytest
```

## Cấu trúc chính

- `app/api`: route theo nhóm `public`, `private`, `internal`.
- `app/services`: business logic theo domain.
- `app/db/repositories`: truy cập dữ liệu qua repository pattern.
- `app/models`: SQLAlchemy ORM models.
- `app/schemas`: Pydantic DTO request/response.
- `alembic`: migration scripts.
- `tests`: unit, integration, benchmark.
