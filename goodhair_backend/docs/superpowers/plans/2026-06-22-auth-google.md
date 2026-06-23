# Auth — Google Sign-In + JWT Cookie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xác thực người dùng qua Google ID token (GIS), cấp JWT bằng httpOnly cookie, quản lý tài khoản chờ duyệt, bảo vệ API private.

**Architecture:** Frontend gửi Google ID token → backend verify với Google → cấp access/refresh token qua httpOnly cookie. Account mới → pending → admin duyệt → tạo employee record. User đầu tiên tự động approved. API private đọc `access_token` cookie thay vì Authorization header.

**Tech Stack:** FastAPI, google-auth, python-jose, SQLAlchemy 2.0 async, Next.js 16, @react-oauth/google

---

## File Map

**Backend — New:**
- `app/models/account.py` — Account model
- `app/models/employee.py` — Employee model (minimal)
- `app/models/refresh_token.py` — RefreshToken model
- `app/schemas/account.py` — AccountRead, AccountListItem schemas
- `app/schemas/employee.py` — EmployeeRead schema
- `app/db/repositories/account.py` — AccountRepository
- `app/db/repositories/employee.py` — EmployeeRepository
- `app/db/repositories/refresh_token.py` — RefreshTokenRepository
- `app/services/auth/__init__.py`, `app/services/auth/service.py` — AuthService
- `app/services/auth/google.py` — verify_google_id_token
- `app/services/accounts/__init__.py`, `app/services/accounts/service.py` — AccountService
- `app/api/public/auth/__init__.py`, `app/api/public/auth/router.py` — Auth endpoints
- `app/api/private/accounts/__init__.py`, `app/api/private/accounts/router.py` — Accounts CRUD
- `alembic/versions/XXXX_add_accounts_employees.py` — Migration

**Backend — Modified:**
- `app/core/constants.py` — thêm AccountStatus
- `app/core/settings.py` — thêm google_client_id
- `app/models/__init__.py` — export models mới
- `app/auth/jwt.py` — thêm decode_token, create_refresh_token
- `app/auth/dependencies.py` — đọc cookie thay Bearer
- `app/api/router.py` — đăng ký routes mới
- `alembic/env.py` — import models mới
- `.env` và `.env.example` — thêm GOOGLE_CLIENT_ID
- `docker-compose.yml` — thêm NEXT_PUBLIC_GOOGLE_CLIENT_ID cho frontend

**Frontend — New:**
- `src/types/account.type.ts` — Account, AccountStatus types
- `src/services/auth.api.ts` — loginWithGoogle, logout, getMe, refreshToken
- `src/contexts/AuthContext.tsx` — AuthProvider, useAuth hook
- `src/app/(auth)/layout.tsx` — layout cho trang login
- `src/app/(auth)/login/page.tsx` — trang login với GoogleLogin button
- `src/app/(admin)/accounts/page.tsx` — metadata + render AccountsClient
- `src/app/(admin)/accounts/AccountsClient.tsx` — bảng quản lý tài khoản

**Frontend — Modified:**
- `src/app/(admin)/layout.tsx` — wrap AuthProvider + auth guard
- `src/app/layout.tsx` — thêm GoogleOAuthProvider
- `src/components/layout/Sidebar.tsx` — user thật + nút logout
- `src/app/page.tsx` — nút login → redirect /login

---

## Task 1: Thêm packages backend

**Files:**
- Modify: `goodhair_backend/pyproject.toml`

- [ ] **Thêm dependencies vào pyproject.toml**

```toml
google-auth = "^2.29.0"
requests = "^2.32.0"
```

Vào section `[tool.poetry.dependencies]`.

- [ ] **Cài packages trong container**

```bash
docker exec goodhair-backend-1 poetry add google-auth requests
```

Expected: `Package operations: 2 installs`

- [ ] **Verify**

```bash
docker exec goodhair-backend-1 python -c "from google.oauth2 import id_token; print('ok')"
```

Expected: `ok`

---

## Task 2: Thêm cấu hình

**Files:**
- Modify: `goodhair_backend/app/core/constants.py`
- Modify: `goodhair_backend/app/core/settings.py`
- Modify: `goodhair_backend/.env`
- Modify: `goodhair_backend/.env.example`

- [ ] **Thêm AccountStatus vào constants.py**

```python
class AccountStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
```

- [ ] **Thêm google_client_id vào settings.py**

```python
google_client_id: str = ""
```

- [ ] **Thêm vào .env**

```
GOOGLE_CLIENT_ID=<lấy từ Google Cloud Console — để trống nếu chưa có>
```

- [ ] **Thêm vào .env.example**

```
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

---

## Task 3: Account model

**Files:**
- Create: `goodhair_backend/app/models/account.py`
- Modify: `goodhair_backend/app/models/__init__.py`

- [ ] **Tạo app/models/account.py**

```python
from datetime import datetime

import sqlalchemy as sa
from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.constants import AccountStatus
from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Account(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "accounts"

    google_id: Mapped[str] = mapped_column(String(128), unique=True, nullable=False)
    email: Mapped[str] = mapped_column(String(256), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    status: Mapped[AccountStatus] = mapped_column(
        sa.Enum(
            AccountStatus,
            name="account_status",
            values_callable=lambda e: [m.value for m in e],
        ),
        server_default=AccountStatus.PENDING.value,
        nullable=False,
    )
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
```

- [ ] **Cập nhật app/models/__init__.py**

```python
from app.models.base import Base
from app.models.account import Account
from app.models.branch import Branch
from app.models.employee import Employee
from app.models.refresh_token import RefreshToken
from app.models.service import Service

__all__ = ["Base", "Account", "Branch", "Employee", "RefreshToken", "Service"]
```

---

## Task 4: Employee model

**Files:**
- Create: `goodhair_backend/app/models/employee.py`

- [ ] **Tạo app/models/employee.py**

```python
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


class Employee(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "employees"

    account_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        sa.ForeignKey("accounts.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    email: Mapped[str] = mapped_column(String(256), nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    branch_id: Mapped[UUID | None] = mapped_column(
        PgUUID(as_uuid=True),
        sa.ForeignKey("branches.id", ondelete="SET NULL"),
        nullable=True,
    )
```

---

## Task 5: RefreshToken model

**Files:**
- Create: `goodhair_backend/app/models/refresh_token.py`

- [ ] **Tạo app/models/refresh_token.py**

```python
from datetime import datetime
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import DateTime, String
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.models.base import Base, UUIDPrimaryKeyMixin


class RefreshToken(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "refresh_tokens"

    account_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        sa.ForeignKey("accounts.id", ondelete="CASCADE"),
        nullable=False,
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
```

---

## Task 6: Migration

**Files:**
- Modify: `goodhair_backend/alembic/env.py`
- Create: `goodhair_backend/alembic/versions/<rev>_add_accounts_employees.py`

- [ ] **Cập nhật alembic/env.py — thêm imports models mới**

```python
from app.models.account import Account
from app.models.employee import Employee
from app.models.refresh_token import RefreshToken
```

(thêm sau dòng `from app.models.service import Service`)

- [ ] **Generate migration**

```bash
docker exec goodhair-backend-1 alembic revision --autogenerate -m "add_accounts_employees"
```

- [ ] **Sửa migration — tạo enum thủ công trước add_column**

Mở file vừa tạo trong `alembic/versions/`, sửa hàm `upgrade()` thêm vào đầu:

```python
account_status = sa.Enum('pending', 'approved', 'rejected', name='account_status')

def upgrade() -> None:
    account_status.create(op.get_bind(), checkfirst=True)
    # ... phần autogenerate giữ nguyên ...
```

Và trong `downgrade()` thêm vào cuối:

```python
def downgrade() -> None:
    # ... drop tables autogenerate ...
    account_status.drop(op.get_bind(), checkfirst=True)
```

- [ ] **Chạy migration**

```bash
docker exec goodhair-backend-1 alembic upgrade head
```

Expected: `Running upgrade 03985722c08d -> <new_rev>, add_accounts_employees`

- [ ] **Verify bảng tồn tại**

```bash
docker exec goodhair-postgres-1 psql -U postgres -d goodhair -c "\dt"
```

Expected: có `accounts`, `employees`, `refresh_tokens`

---

## Task 7: Repositories

**Files:**
- Create: `goodhair_backend/app/db/repositories/account.py`
- Create: `goodhair_backend/app/db/repositories/employee.py`
- Create: `goodhair_backend/app/db/repositories/refresh_token.py`

- [ ] **Tạo app/db/repositories/account.py**

```python
from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select

from app.core.constants import AccountStatus
from app.db.repositories.base import BaseRepository
from app.models.account import Account


class AccountRepository(BaseRepository[Account]):
    model = Account

    async def get_by_google_id(self, google_id: str) -> Account | None:
        result = await self.session.scalar(
            select(Account).where(
                Account.google_id == google_id,
                Account.deleted_at.is_(None),
            )
        )
        return result

    async def get_active_by_id(self, id_: UUID) -> Account | None:
        result = await self.session.scalar(
            select(Account).where(
                Account.id == id_,
                Account.deleted_at.is_(None),
            )
        )
        return result

    async def count_total(self) -> int:
        result = await self.session.scalar(
            select(func.count()).select_from(Account).where(Account.deleted_at.is_(None))
        )
        return int(result or 0)

    async def list_accounts(
        self,
        *,
        status: AccountStatus | None,
        offset: int,
        limit: int,
    ) -> Sequence[Account]:
        q = select(Account).where(Account.deleted_at.is_(None))
        if status is not None:
            q = q.where(Account.status == status)
        q = q.order_by(Account.requested_at.desc()).offset(offset).limit(limit)
        result = await self.session.scalars(q)
        return result.all()

    async def count_accounts(self, *, status: AccountStatus | None) -> int:
        q = select(func.count()).select_from(Account).where(Account.deleted_at.is_(None))
        if status is not None:
            q = q.where(Account.status == status)
        result = await self.session.scalar(q)
        return int(result or 0)
```

- [ ] **Tạo app/db/repositories/employee.py**

```python
from uuid import UUID

from sqlalchemy import select

from app.db.repositories.base import BaseRepository
from app.models.employee import Employee


class EmployeeRepository(BaseRepository[Employee]):
    model = Employee

    async def get_by_account_id(self, account_id: UUID) -> Employee | None:
        result = await self.session.scalar(
            select(Employee).where(
                Employee.account_id == account_id,
                Employee.deleted_at.is_(None),
            )
        )
        return result
```

- [ ] **Tạo app/db/repositories/refresh_token.py**

```python
import hashlib
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select

from app.db.repositories.base import BaseRepository
from app.models.refresh_token import RefreshToken


class RefreshTokenRepository(BaseRepository[RefreshToken]):
    model = RefreshToken

    @staticmethod
    def hash_token(raw: str) -> str:
        return hashlib.sha256(raw.encode()).hexdigest()

    async def get_valid_by_raw(self, raw_token: str) -> RefreshToken | None:
        token_hash = self.hash_token(raw_token)
        result = await self.session.scalar(
            select(RefreshToken).where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.revoked_at.is_(None),
                RefreshToken.expires_at > datetime.now(timezone.utc),
            )
        )
        return result

    async def revoke(self, token: RefreshToken) -> None:
        token.revoked_at = datetime.now(timezone.utc)
        await self.session.flush()

    async def revoke_all_for_account(self, account_id: UUID) -> None:
        tokens = await self.session.scalars(
            select(RefreshToken).where(
                RefreshToken.account_id == account_id,
                RefreshToken.revoked_at.is_(None),
            )
        )
        now = datetime.now(timezone.utc)
        for token in tokens.all():
            token.revoked_at = now
        await self.session.flush()
```

---

## Task 8: Auth JWT utils

**Files:**
- Modify: `goodhair_backend/app/auth/jwt.py`

- [ ] **Thay toàn bộ nội dung app/auth/jwt.py**

```python
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from jose import JWTError, jwt

from app.core.settings import get_settings


def create_access_token(subject: str, claims: dict[str, Any] | None = None) -> str:
    settings = get_settings()
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes,
    )
    payload = {
        "sub": subject,
        "exp": expires_at,
        "type": "access",
        **(claims or {}),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(subject: str) -> tuple[str, str]:
    """Trả về (raw_token, token_hash)."""
    settings = get_settings()
    expires_at = datetime.now(timezone.utc) + timedelta(
        days=settings.refresh_token_expire_days,
    )
    payload = {
        "sub": subject,
        "jti": str(uuid4()),
        "exp": expires_at,
        "type": "refresh",
    }
    raw = jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    token_hash = hashlib.sha256(raw.encode()).hexdigest()
    return raw, token_hash


def decode_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])


def refresh_token_expires_seconds() -> int:
    return get_settings().refresh_token_expire_days * 86400
```

---

## Task 9: Auth dependencies

**Files:**
- Modify: `goodhair_backend/app/auth/dependencies.py`

- [ ] **Thay toàn bộ nội dung app/auth/dependencies.py**

```python
from uuid import UUID

from fastapi import Cookie
from jose import JWTError

from app.auth.jwt import decode_token
from app.core.constants import AccountStatus
from app.core.exceptions import UnauthorizedError


async def get_current_account_id(
    access_token: str | None = Cookie(default=None),
) -> UUID:
    if not access_token:
        raise UnauthorizedError(message_key="errors.auth.no_token")
    try:
        payload = decode_token(access_token)
    except JWTError:
        raise UnauthorizedError(message_key="errors.auth.invalid_token")
    if payload.get("type") != "access":
        raise UnauthorizedError(message_key="errors.auth.invalid_token")
    status = payload.get("status")
    if status != AccountStatus.APPROVED.value:
        raise UnauthorizedError(message_key="errors.auth.not_approved")
    return UUID(payload["sub"])
```

---

## Task 10: Google verify + AuthService

**Files:**
- Create: `goodhair_backend/app/services/auth/__init__.py`
- Create: `goodhair_backend/app/services/auth/google.py`
- Create: `goodhair_backend/app/services/auth/service.py`

- [ ] **Tạo app/services/auth/__init__.py** (rỗng)

- [ ] **Tạo app/services/auth/google.py**

```python
from google.auth.exceptions import GoogleAuthError
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token

from app.core.exceptions import UnauthorizedError
from app.core.settings import get_settings


def verify_google_id_token(token: str) -> dict[str, str | None]:
    settings = get_settings()
    try:
        idinfo = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            settings.google_client_id,
        )
    except (GoogleAuthError, ValueError) as exc:
        raise UnauthorizedError(message_key="errors.auth.invalid_google_token") from exc
    return {
        "google_id": idinfo["sub"],
        "email": idinfo["email"],
        "name": idinfo.get("name", idinfo["email"].split("@")[0]),
        "avatar_url": idinfo.get("picture"),
    }
```

- [ ] **Tạo app/services/auth/service.py**

```python
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
    refresh_token_expires_seconds,
)
from app.core.constants import AccountStatus
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.settings import get_settings
from app.db.repositories.account import AccountRepository
from app.db.repositories.employee import EmployeeRepository
from app.db.repositories.refresh_token import RefreshTokenRepository
from app.models.account import Account
from app.services.auth.google import verify_google_id_token
from jose import JWTError


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.account_repo = AccountRepository(session)
        self.employee_repo = EmployeeRepository(session)
        self.refresh_token_repo = RefreshTokenRepository(session)

    async def login_with_google(
        self, id_token_str: str
    ) -> tuple[Account, str, str]:
        google_info = verify_google_id_token(id_token_str)
        account = await self.account_repo.get_by_google_id(google_info["google_id"])

        if account is None:
            total = await self.account_repo.count_total()
            status = AccountStatus.APPROVED if total == 0 else AccountStatus.PENDING
            account = await self.account_repo.create(
                {**google_info, "status": status, "requested_at": datetime.now(timezone.utc)}
            )
            if status == AccountStatus.APPROVED:
                await self.employee_repo.create(
                    {
                        "account_id": account.id,
                        "name": account.name,
                        "email": account.email,
                        "avatar_url": account.avatar_url,
                    }
                )
            else:
                raise ForbiddenError(
                    message_key="errors.auth.pending",
                    detail={"status": "pending"},
                )

        if account.status == AccountStatus.PENDING:
            raise ForbiddenError(
                message_key="errors.auth.pending",
                detail={"status": "pending"},
            )
        if account.status == AccountStatus.REJECTED:
            raise ForbiddenError(
                message_key="errors.auth.rejected",
                detail={"status": "rejected"},
            )

        return account, *self._issue_tokens(account)

    def _issue_tokens(self, account: Account) -> tuple[str, str]:
        access_token = create_access_token(
            subject=str(account.id),
            claims={"email": account.email, "status": account.status.value},
        )
        return access_token, *self._create_refresh(account.id)

    def _create_refresh(self, account_id: UUID) -> tuple[str, str]:
        raw, token_hash = create_refresh_token(subject=str(account_id))
        return raw, token_hash

    async def _store_refresh(self, account_id: UUID, token_hash: str) -> None:
        settings = get_settings()
        expires_at = datetime.now(timezone.utc) + timedelta(
            days=settings.refresh_token_expire_days
        )
        await self.refresh_token_repo.create(
            {
                "account_id": account_id,
                "token_hash": token_hash,
                "expires_at": expires_at,
            }
        )

    async def issue_tokens_for_account(
        self, account: Account
    ) -> tuple[str, str]:
        access_token = create_access_token(
            subject=str(account.id),
            claims={"email": account.email, "status": account.status.value},
        )
        raw_refresh, token_hash = create_refresh_token(subject=str(account.id))
        await self._store_refresh(account.id, token_hash)
        return access_token, raw_refresh

    async def login_with_google_and_store(
        self, id_token_str: str
    ) -> tuple[Account, str, str]:
        google_info = verify_google_id_token(id_token_str)
        account = await self.account_repo.get_by_google_id(google_info["google_id"])

        if account is None:
            total = await self.account_repo.count_total()
            status = AccountStatus.APPROVED if total == 0 else AccountStatus.PENDING
            account = await self.account_repo.create(
                {**google_info, "status": status, "requested_at": datetime.now(timezone.utc)}
            )
            if status == AccountStatus.APPROVED:
                await self.employee_repo.create(
                    {
                        "account_id": account.id,
                        "name": account.name,
                        "email": account.email,
                        "avatar_url": account.avatar_url,
                    }
                )
            else:
                raise ForbiddenError(
                    message_key="errors.auth.pending",
                    detail={"status": "pending"},
                )

        if account.status == AccountStatus.PENDING:
            raise ForbiddenError(
                message_key="errors.auth.pending",
                detail={"status": "pending"},
            )
        if account.status == AccountStatus.REJECTED:
            raise ForbiddenError(
                message_key="errors.auth.rejected",
                detail={"status": "rejected"},
            )

        access_token, raw_refresh = await self.issue_tokens_for_account(account)
        return account, access_token, raw_refresh

    async def refresh(self, raw_refresh_token: str) -> tuple[Account, str, str]:
        token = await self.refresh_token_repo.get_valid_by_raw(raw_refresh_token)
        if token is None:
            raise UnauthorizedError(message_key="errors.auth.invalid_refresh_token")
        try:
            payload = decode_token(raw_refresh_token)
        except JWTError:
            raise UnauthorizedError(message_key="errors.auth.invalid_refresh_token")
        if payload.get("type") != "refresh":
            raise UnauthorizedError(message_key="errors.auth.invalid_refresh_token")

        account = await self.account_repo.get_active_by_id(token.account_id)
        if account is None or account.status != AccountStatus.APPROVED:
            raise UnauthorizedError(message_key="errors.auth.not_approved")

        await self.refresh_token_repo.revoke(token)
        access_token, raw_refresh = await self.issue_tokens_for_account(account)
        return account, access_token, raw_refresh

    async def logout(self, raw_refresh_token: str) -> None:
        token = await self.refresh_token_repo.get_valid_by_raw(raw_refresh_token)
        if token is not None:
            await self.refresh_token_repo.revoke(token)
```

---

## Task 11: Account schemas

**Files:**
- Create: `goodhair_backend/app/schemas/account.py`

- [ ] **Tạo app/schemas/account.py**

```python
from datetime import datetime
from uuid import UUID

from app.core.constants import AccountStatus
from app.schemas.base import AppSchema, PageParams


class AccountRead(AppSchema):
    id: UUID
    email: str
    name: str
    avatar_url: str | None
    status: AccountStatus
    requested_at: datetime
    created_at: datetime


class AccountListParams(PageParams):
    status: AccountStatus | None = None
```

---

## Task 12: Auth router

**Files:**
- Create: `goodhair_backend/app/api/public/auth/__init__.py`
- Create: `goodhair_backend/app/api/public/auth/router.py`

- [ ] **Tạo app/api/public/auth/__init__.py** (rỗng)

- [ ] **Tạo app/api/public/auth/router.py**

```python
from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_account_id
from app.auth.jwt import refresh_token_expires_seconds
from app.core.constants import AppEnv
from app.core.exceptions import UnauthorizedError
from app.core.settings import get_settings
from app.db.repositories.account import AccountRepository
from app.db.session import get_db_session
from app.schemas.account import AccountRead
from app.services.auth.service import AuthService

router = APIRouter()


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    settings = get_settings()
    secure = settings.app_env != AppEnv.LOCAL
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.access_token_expire_minutes * 60,
        samesite="lax",
        secure=secure,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=refresh_token_expires_seconds(),
        samesite="lax",
        secure=secure,
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")


def get_auth_service(session: AsyncSession = Depends(get_db_session)) -> AuthService:
    return AuthService(session=session)


class GoogleLoginRequest(BaseModel):
    id_token: str


from fastapi import Cookie


@router.post("/google", response_model=AccountRead)
async def login_google(
    payload: GoogleLoginRequest,
    response: Response,
    service: AuthService = Depends(get_auth_service),
) -> AccountRead:
    account, access_token, refresh_token = await service.login_with_google_and_store(
        payload.id_token
    )
    _set_auth_cookies(response, access_token, refresh_token)
    return AccountRead.model_validate(account)


@router.post("/refresh", response_model=AccountRead)
async def refresh_token(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    service: AuthService = Depends(get_auth_service),
) -> AccountRead:
    if not refresh_token:
        raise UnauthorizedError(message_key="errors.auth.no_token")
    account, access_token, new_refresh = await service.refresh(refresh_token)
    _set_auth_cookies(response, access_token, new_refresh)
    return AccountRead.model_validate(account)


@router.post("/logout")
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    service: AuthService = Depends(get_auth_service),
) -> dict:
    if refresh_token:
        await service.logout(refresh_token)
    _clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me", response_model=AccountRead)
async def get_me(
    account_id: str = Depends(get_current_account_id),
    session: AsyncSession = Depends(get_db_session),
) -> AccountRead:
    repo = AccountRepository(session)
    account = await repo.get_active_by_id(account_id)
    if account is None:
        raise UnauthorizedError(message_key="errors.auth.not_found")
    return AccountRead.model_validate(account)
```

---

## Task 13: AccountService + router

**Files:**
- Create: `goodhair_backend/app/services/accounts/__init__.py`
- Create: `goodhair_backend/app/services/accounts/service.py`
- Create: `goodhair_backend/app/api/private/accounts/__init__.py`
- Create: `goodhair_backend/app/api/private/accounts/router.py`

- [ ] **Tạo app/services/accounts/__init__.py** (rỗng)

- [ ] **Tạo app/services/accounts/service.py**

```python
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import AccountStatus
from app.core.exceptions import BadRequestError, NotFoundError
from app.db.repositories.account import AccountRepository
from app.db.repositories.employee import EmployeeRepository
from app.models.account import Account
from app.schemas.base import PageParams


class AccountService:
    def __init__(self, session: AsyncSession) -> None:
        self.account_repo = AccountRepository(session)
        self.employee_repo = EmployeeRepository(session)

    async def list_accounts(
        self,
        *,
        status: AccountStatus | None,
        page: PageParams,
    ) -> tuple[list[Account], int]:
        items = await self.account_repo.list_accounts(
            status=status, offset=page.offset, limit=page.size
        )
        total = await self.account_repo.count_accounts(status=status)
        return list(items), total

    async def approve(self, account_id: UUID) -> Account:
        account = await self._get_or_404(account_id)
        if account.status == AccountStatus.APPROVED:
            raise BadRequestError(message_key="errors.account.already_approved")
        await self.account_repo.update(account, {"status": AccountStatus.APPROVED})
        existing = await self.employee_repo.get_by_account_id(account_id)
        if existing is None:
            await self.employee_repo.create(
                {
                    "account_id": account.id,
                    "name": account.name,
                    "email": account.email,
                    "avatar_url": account.avatar_url,
                }
            )
        return account

    async def reject(self, account_id: UUID) -> Account:
        account = await self._get_or_404(account_id)
        if account.status == AccountStatus.REJECTED:
            raise BadRequestError(message_key="errors.account.already_rejected")
        await self.account_repo.update(account, {"status": AccountStatus.REJECTED})
        return account

    async def delete(self, account_id: UUID) -> None:
        account = await self._get_or_404(account_id)
        await self.account_repo.soft_delete(account)

    async def _get_or_404(self, account_id: UUID) -> Account:
        account = await self.account_repo.get_active_by_id(account_id)
        if account is None:
            raise NotFoundError(detail={"resource": "account", "id": str(account_id)})
        return account
```

- [ ] **Tạo app/api/private/accounts/__init__.py** (rỗng)

- [ ] **Tạo app/api/private/accounts/router.py**

```python
from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_account_id
from app.core.constants import AccountStatus
from app.db.session import get_db_session
from app.schemas.account import AccountListParams, AccountRead
from app.schemas.base import PaginatedResponse
from app.services.accounts.service import AccountService

router = APIRouter()


def get_account_service(
    session: AsyncSession = Depends(get_db_session),
) -> AccountService:
    return AccountService(session=session)


@router.get("", response_model=PaginatedResponse[AccountRead])
async def list_accounts(
    params: AccountListParams = Depends(),
    service: AccountService = Depends(get_account_service),
    _: UUID = Depends(get_current_account_id),
) -> PaginatedResponse[AccountRead]:
    items, total = await service.list_accounts(status=params.status, page=params)
    return PaginatedResponse.create(items=items, total=total, page=params)


@router.patch("/{account_id}/approve", response_model=AccountRead)
async def approve_account(
    account_id: UUID,
    service: AccountService = Depends(get_account_service),
    _: UUID = Depends(get_current_account_id),
) -> AccountRead:
    account = await service.approve(account_id)
    return AccountRead.model_validate(account)


@router.patch("/{account_id}/reject", response_model=AccountRead)
async def reject_account(
    account_id: UUID,
    service: AccountService = Depends(get_account_service),
    _: UUID = Depends(get_current_account_id),
) -> AccountRead:
    account = await service.reject(account_id)
    return AccountRead.model_validate(account)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: UUID,
    service: AccountService = Depends(get_account_service),
    _: UUID = Depends(get_current_account_id),
) -> None:
    await service.delete(account_id)
```

---

## Task 14: Đăng ký routes

**Files:**
- Modify: `goodhair_backend/app/api/router.py`

- [ ] **Cập nhật app/api/router.py**

```python
from fastapi import APIRouter

from app.api.private.accounts.router import router as accounts_router
from app.api.private.branches.router import router as branches_router
from app.api.private.services.router import router as services_router
from app.api.public.auth.router import router as auth_router
from app.api.public.health.router import router as health_router

api_router = APIRouter()
api_router.include_router(health_router, prefix="/health", tags=["Health"])
api_router.include_router(auth_router, prefix="/auth", tags=["Auth"])
api_router.include_router(services_router, prefix="/services", tags=["Services"])
api_router.include_router(branches_router, prefix="/branches", tags=["Branches"])
api_router.include_router(accounts_router, prefix="/accounts", tags=["Accounts"])
```

- [ ] **Kiểm tra backend khởi động không lỗi**

```bash
docker logs goodhair-backend-1 --tail 20
```

Expected: không có traceback, thấy `Application startup complete`

- [ ] **Test endpoint health**

```bash
curl -s http://localhost:8002/api/v1/health | python3 -m json.tool
```

Expected: `{"status": "ok"}` hoặc tương tự

---

## Task 15: Cài @react-oauth/google

**Files:**
- Modify: `goodhair_frontend/package.json`

- [ ] **Cài package trong container**

```bash
docker exec goodhair-frontend-1 npm install @react-oauth/google
```

Expected: `added 1 package`

- [ ] **Thêm NEXT_PUBLIC_GOOGLE_CLIENT_ID vào docker-compose.yml**

Trong service `frontend`, thêm vào `environment`:
```yaml
- NEXT_PUBLIC_GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-}
```

- [ ] **Verify package cài xong**

```bash
docker exec goodhair-frontend-1 node -e "require('@react-oauth/google'); console.log('ok')"
```

Expected: `ok`

---

## Task 16: Auth types + API service (Frontend)

**Files:**
- Create: `goodhair_frontend/src/types/account.type.ts`
- Create: `goodhair_frontend/src/services/auth.api.ts`

- [ ] **Tạo src/types/account.type.ts**

```typescript
export type AccountStatus = 'pending' | 'approved' | 'rejected';

export interface Account {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  status: AccountStatus;
  requestedAt: string;
  createdAt: string;
}

export interface PaginatedAccounts {
  items: Account[];
  total: number;
  page: number;
  size: number;
}
```

- [ ] **Tạo src/services/auth.api.ts**

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002/api/v1';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw Object.assign(new Error(body?.messageKey ?? String(res.status)), {
      status: res.status,
      messageKey: body?.messageKey,
      detail: body?.detail,
    });
  }
  return res.json() as Promise<T>;
}

export type { Account } from '@/types/account.type';
import type { Account, PaginatedAccounts } from '@/types/account.type';

export async function loginWithGoogle(idToken: string): Promise<Account> {
  return apiFetch<Account>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  });
}

export async function logout(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' });
}

export async function getMe(): Promise<Account> {
  return apiFetch<Account>('/auth/me');
}

export async function refreshToken(): Promise<Account> {
  return apiFetch<Account>('/auth/refresh', { method: 'POST' });
}

export async function fetchAccounts(params?: {
  status?: string;
  page?: number;
  size?: number;
}): Promise<PaginatedAccounts> {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.page) q.set('page', String(params.page));
  if (params?.size) q.set('size', String(params.size));
  return apiFetch<PaginatedAccounts>(`/accounts?${q}`);
}

export async function approveAccount(id: string): Promise<Account> {
  return apiFetch<Account>(`/accounts/${id}/approve`, { method: 'PATCH' });
}

export async function rejectAccount(id: string): Promise<Account> {
  return apiFetch<Account>(`/accounts/${id}/reject`, { method: 'PATCH' });
}
```

---

## Task 17: AuthContext

**Files:**
- Create: `goodhair_frontend/src/contexts/AuthContext.tsx`

- [ ] **Đọc Next.js docs để hiểu context pattern trước**

```bash
find /home/sotatek/workspace/goodhair/goodhair_frontend/node_modules/next/dist/docs -name "*.md" 2>/dev/null | head -5
```

- [ ] **Tạo src/contexts/AuthContext.tsx**

```typescript
'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getMe, logout as apiLogout, refreshToken } from '@/services/auth.api';
import type { Account } from '@/types/account.type';

interface AuthContextValue {
  account: Account | null;
  loading: boolean;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  account: null,
  loading: true,
  logout: async () => {},
  refetch: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const me = await getMe();
      setAccount(me);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 401) {
        try {
          const me = await refreshToken();
          setAccount(me);
        } catch {
          setAccount(null);
        }
      } else {
        setAccount(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setAccount(null);
  }, []);

  return (
    <AuthContext.Provider value={{ account, loading, logout, refetch: fetchMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

---

## Task 18: Trang login

**Files:**
- Create: `goodhair_frontend/src/app/(auth)/layout.tsx`
- Create: `goodhair_frontend/src/app/(auth)/login/page.tsx`
- Modify: `goodhair_frontend/src/app/layout.tsx`

- [ ] **Đọc Next.js docs về Route Groups và GoogleOAuthProvider**

```bash
grep -r "GoogleOAuthProvider\|use client\|layout" /home/sotatek/workspace/goodhair/goodhair_frontend/node_modules/@react-oauth/google/dist/ 2>/dev/null | head -10
```

- [ ] **Tạo src/app/(auth)/layout.tsx**

```typescript
import type { ReactNode } from 'react';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0B1620', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </div>
  );
}
```

- [ ] **Tạo src/app/(auth)/login/page.tsx**

```typescript
import type { Metadata } from 'next';
import LoginClient from './LoginClient';

export const metadata: Metadata = { title: 'Đăng nhập | GoodHair' };

export default function LoginPage() {
  return <LoginClient />;
}
```

- [ ] **Tạo src/app/(auth)/login/LoginClient.tsx**

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { GoogleLogin } from '@react-oauth/google';
import { loginWithGoogle } from '@/services/auth.api';
import { useState } from 'react';

export default function LoginClient() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ text: string; type: 'info' | 'error' } | null>(null);

  return (
    <div style={{
      width: '100%', maxWidth: 420,
      background: '#0F1E2B', border: '1px solid rgba(238,138,51,.25)',
      borderRadius: 14, padding: '36px 32px',
      boxShadow: '0 40px 90px rgba(0,0,0,.6)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 28 }}>
        <img src="/logo/logo.jpg" alt="GOODHAIR" style={{ width: 40, height: 40, borderRadius: 9, objectFit: 'cover' }} />
        <span style={{ fontWeight: 800, fontSize: 20, color: '#F1ECE1', letterSpacing: 1 }}>
          GOOD<span style={{ color: '#EE8A33' }}>HAIR</span>
        </span>
      </div>

      <h1 style={{ fontSize: 24, fontWeight: 700, color: '#F1ECE1', marginBottom: 8 }}>
        Đăng nhập hệ thống
      </h1>
      <p style={{ fontSize: 13.5, color: 'rgba(241,236,225,.55)', marginBottom: 28, lineHeight: 1.6 }}>
        Dành cho quản trị &amp; nhân viên. Chỉ tài khoản được cấp quyền mới truy cập được.
      </p>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <GoogleLogin
          onSuccess={async (res) => {
            if (!res.credential) return;
            try {
              await loginWithGoogle(res.credential);
              router.push('/services');
            } catch (err: unknown) {
              const e = err as { messageKey?: string; detail?: { status?: string } };
              const status = e.detail?.status;
              if (status === 'pending') {
                setMsg({ text: 'Tài khoản của bạn đang chờ quản trị viên duyệt.', type: 'info' });
              } else if (status === 'rejected') {
                setMsg({ text: 'Yêu cầu truy cập của bạn đã bị từ chối.', type: 'error' });
              } else {
                setMsg({ text: 'Đăng nhập thất bại. Vui lòng thử lại.', type: 'error' });
              }
            }
          }}
          onError={() => setMsg({ text: 'Google đăng nhập thất bại.', type: 'error' })}
          text="continue_with"
          shape="rectangular"
          theme="filled_blue"
          width="356"
        />
      </div>

      {msg && (
        <div style={{
          marginTop: 20, padding: '13px 15px', borderRadius: 8, fontSize: 13,
          background: msg.type === 'info' ? 'rgba(238,138,51,.12)' : 'rgba(214,120,120,.12)',
          border: `1px solid ${msg.type === 'info' ? 'rgba(238,138,51,.35)' : 'rgba(214,120,120,.35)'}`,
          color: msg.type === 'info' ? '#E7B25C' : '#E59A9A',
        }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Cập nhật src/app/layout.tsx — thêm GoogleOAuthProvider**

Tìm dòng import và wrap children với `GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''}`.

---

## Task 19: (admin) layout với auth guard

**Files:**
- Modify: `goodhair_frontend/src/app/(admin)/layout.tsx`

- [ ] **Cập nhật src/app/(admin)/layout.tsx**

```typescript
import Sidebar from '@/components/layout/Sidebar';
import MainContent from '@/components/layout/MainContent';
import { AuthProvider } from '@/contexts/AuthContext';
import AdminAuthGuard from './AdminAuthGuard';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AdminAuthGuard>
        <div style={{ display: 'flex', height: '100vh' }}>
          <Sidebar />
          <MainContent>{children}</MainContent>
        </div>
      </AdminAuthGuard>
    </AuthProvider>
  );
}
```

- [ ] **Tạo src/app/(admin)/AdminAuthGuard.tsx**

```typescript
'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';

export default function AdminAuthGuard({ children }: { children: ReactNode }) {
  const { account, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !account) {
      router.replace('/login');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, account]);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#0a131d' }}>
        <span style={{ color: '#EE8A33', fontSize: 14 }}>Đang tải...</span>
      </div>
    );
  }
  if (!account) return null;
  return <>{children}</>;
}
```

---

## Task 20: Màn /accounts

**Files:**
- Create: `goodhair_frontend/src/app/(admin)/accounts/page.tsx`
- Create: `goodhair_frontend/src/app/(admin)/accounts/AccountsClient.tsx`

- [ ] **Tạo src/app/(admin)/accounts/page.tsx**

```typescript
import type { Metadata } from 'next';
import AccountsClient from './AccountsClient';

export const metadata: Metadata = { title: 'Tài khoản | GoodHair' };

export default function AccountsPage() {
  return <div className="p-8"><AccountsClient /></div>;
}
```

- [ ] **Tạo src/app/(admin)/accounts/AccountsClient.tsx**

```typescript
'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchAccounts, approveAccount, rejectAccount } from '@/services/auth.api';
import type { Account, AccountStatus } from '@/types/account.type';

const STATUS_TABS: { label: string; value: AccountStatus | '' }[] = [
  { label: 'Tất cả', value: '' },
  { label: 'Chờ duyệt', value: 'pending' },
  { label: 'Đã duyệt', value: 'approved' },
  { label: 'Từ chối', value: 'rejected' },
];

const STATUS_BADGE: Record<AccountStatus, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Chờ duyệt', color: '#E7B25C', bg: 'rgba(238,138,51,.15)' },
  approved: { label: 'Đã duyệt',  color: '#5FD49A', bg: 'rgba(63,191,127,.15)' },
  rejected: { label: 'Từ chối',   color: '#E59A9A', bg: 'rgba(214,120,120,.15)' },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${z(d.getDate())}/${z(d.getMonth() + 1)} ${z(d.getHours())}:${z(d.getMinutes())}`;
}

export default function AccountsClient() {
  const [tab, setTab] = useState<AccountStatus | ''>('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAccounts({ status: tab || undefined, size: 50 });
      setAccounts(data.items);
      setTotal(data.total);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    refresh();
  }, [tab]);

  const handleApprove = async (id: string) => {
    setActioning(id);
    try { await approveAccount(id); await refresh(); } finally { setActioning(null); }
  };

  const handleReject = async (id: string) => {
    setActioning(id);
    try { await rejectAccount(id); await refresh(); } finally { setActioning(null); }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0 }}>Tài khoản</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>
            {total} tài khoản
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {STATUS_TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            style={{
              padding: '7px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              border: tab === t.value ? '1px solid #EE8A33' : '1px solid #1e293b',
              background: tab === t.value ? 'rgba(238,138,51,.15)' : '#0f1e2b',
              color: tab === t.value ? '#EE8A33' : '#94a3b8',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#0f1e2b', border: '1px solid #1e293b', borderRadius: 8, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#0a131d' }}>
              {['Tài khoản', 'Email', 'Thời gian yêu cầu', 'Trạng thái', 'Hành động'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#64748b', letterSpacing: '.04em', textTransform: 'uppercase', borderBottom: '1px solid #1e293b' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>Đang tải...</td></tr>
            ) : accounts.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>Không có tài khoản</td></tr>
            ) : accounts.map(acc => {
              const badge = STATUS_BADGE[acc.status];
              return (
                <tr key={acc.id} style={{ borderBottom: '1px solid #1e293b' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {acc.avatarUrl
                        ? <img src={acc.avatarUrl} alt={acc.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                        : <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EE8A33', fontWeight: 700, fontSize: 13 }}>
                            {acc.name.charAt(0).toUpperCase()}
                          </div>
                      }
                      <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{acc.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: 13 }}>{acc.email}</td>
                  <td style={{ padding: '14px 16px', color: '#64748b', fontSize: 13 }}>{formatDate(acc.requestedAt)}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 10, fontSize: 12, fontWeight: 600, background: badge.bg, color: badge.color }}>
                      {badge.label}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {acc.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={() => handleApprove(acc.id)}
                          disabled={actioning === acc.id}
                          style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#10b981', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: actioning === acc.id ? 0.6 : 1 }}
                        >
                          Duyệt
                        </button>
                        <button
                          onClick={() => handleReject(acc.id)}
                          disabled={actioning === acc.id}
                          style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: actioning === acc.id ? 0.6 : 1 }}
                        >
                          Từ chối
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## Task 21: Sidebar — user thật + logout

**Files:**
- Modify: `goodhair_frontend/src/components/layout/Sidebar.tsx`

- [ ] **Cập nhật phần User profile cuối Sidebar — dùng useAuth()**

Thêm imports:
```typescript
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
```

Trong component `Sidebar`, thêm:
```typescript
const { account, logout } = useAuth();
const router = useRouter();

const handleLogout = async () => {
  await logout();
  router.push('/login');
};
```

Thay phần "User profile" hardcode thành:
```typescript
<div style={{ padding: collapsed ? 8 : 16, borderTop: '1px solid #1e293b' }}>
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12,
    background: '#161e31', padding: collapsed ? 8 : 12,
    borderRadius: 8, border: '1px solid #1e293b',
    justifyContent: collapsed ? 'center' : 'flex-start',
  }}>
    {account?.avatarUrl
      ? <img src={account.avatarUrl} alt={account.name} style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
      : <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#7c2d12', color: '#ee8a33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
          {account?.name?.charAt(0)?.toUpperCase() ?? '?'}
        </div>
    }
    {!collapsed && (
      <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis' }}>{account?.name ?? '...'}</div>
        <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis' }}>{account?.email ?? ''}</div>
      </div>
    )}
    {!collapsed && (
      <button
        onClick={handleLogout}
        title="Đăng xuất"
        style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 16, padding: 4, flexShrink: 0 }}
      >
        ⏻
      </button>
    )}
  </div>
</div>
```

---

## Task 22: Landing page — nút login

**Files:**
- Modify: `goodhair_frontend/src/app/page.tsx`

- [ ] **Thay nút "Đăng nhập" và modal mở ra thành Link đến /login**

Tìm đoạn nút `<button onClick={openLogin}...>` trong header → thay bằng:
```typescript
<Link
  href="/login"
  style={{ background: 'transparent', border: '1px solid rgba(238,138,51,.4)', color: '#F1ECE1', padding: '10px 18px', borderRadius: 2, fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: '.04em', textDecoration: 'none', whiteSpace: 'nowrap' }}
>
  {t('Đăng nhập', 'Sign in')}
</Link>
```

Xóa toàn bộ state và logic liên quan đến modal login (`loginOpen`, `loginView`, `loginMsg`, `loginError`, `successEmail`, `successName`, `otherEmail`, `users`, `saveUsers`, `openLogin`, `closeLogin`, `resolveLogin`, `msgColors`, `nameFromEmail`, `initialsOf`, `defaultUsers`, `stamp`, `SUPER_EMAIL`).

Xóa block `{/* LOGIN MODAL */}` cuối file.

---

## Task 23: Thêm GoogleOAuthProvider vào root layout

**Files:**
- Modify: `goodhair_frontend/src/app/layout.tsx`

- [ ] **Đọc file layout.tsx hiện tại trước**

```bash
cat /home/sotatek/workspace/goodhair/goodhair_frontend/src/app/layout.tsx
```

- [ ] **Wrap children với GoogleOAuthProvider**

Thêm:
```typescript
import { GoogleOAuthProvider } from '@react-oauth/google';
```

Wrap `{children}` (hoặc AntdProvider/SidebarProvider) với:
```typescript
<GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? ''}>
  {/* existing children wrapper */}
</GoogleOAuthProvider>
```

---

## Task 24: Verify toàn bộ

- [ ] **TypeScript check**

```bash
docker exec goodhair-frontend-1 npx tsc --noEmit 2>&1 | head -40
```

Expected: không có lỗi

- [ ] **ESLint check**

```bash
docker exec goodhair-frontend-1 npx next lint 2>&1 | tail -20
```

Expected: `✔ No ESLint warnings or errors`

- [ ] **Test login flow**

```bash
curl -s -X POST http://localhost:8002/api/v1/auth/google \
  -H "Content-Type: application/json" \
  -d '{"idToken":"fake-token"}' | python3 -m json.tool
```

Expected: `{"errorCode": "UNAUTHORIZED", "messageKey": "errors.auth.invalid_google_token", ...}` (không phải 500)

- [ ] **Test /auth/me không có cookie**

```bash
curl -s http://localhost:8002/api/v1/auth/me | python3 -m json.tool
```

Expected: `{"errorCode": "UNAUTHORIZED", ...}`

- [ ] **Test trang login render**

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/login
```

Expected: `200`

- [ ] **Test trang /accounts redirect về /login khi chưa auth**

Mở browser tại `http://localhost:3002/accounts` — phải redirect về `/login`.
