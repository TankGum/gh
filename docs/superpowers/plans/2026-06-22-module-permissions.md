# Module Permissions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce per-module authorization (view/create/edit/delete) across the GoodHair admin backend API and frontend UI, driven by each user's assigned Role.

**Architecture:** Permissions are resolved from the database on every request via `Account → Employee → Role.permissions`. The backend gates each private endpoint with a `require_permission(module, action)` FastAPI dependency; the frontend reads the current user's permissions from `/auth/me` and gates the sidebar, routes, and action buttons. A seeded system role `admin` (full permissions) bootstraps the first user.

**Tech Stack:** FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, pytest (asyncio_mode=auto), Next.js (App Router) + React + Ant Design.

---

## Important environment notes

- **Neither `goodhair_backend` nor `goodhair_frontend` is a git repository.** The "Commit" steps below are written as **optional checkpoints**. If you want version control, run `git init` in the subproject first; otherwise treat each commit step as a "stop, verify, continue" checkpoint and skip the `git` commands.
- All backend paths are relative to `goodhair_backend/`. All frontend paths are relative to `goodhair_frontend/`.
- Backend tests run with `poetry run pytest`. `asyncio_mode = "auto"` — async test functions need **no** decorator.
- Ruff line-length is 88.
- **Frontend caveat (`goodhair_frontend/AGENTS.md`):** this Next.js build has breaking changes vs. training data — read `node_modules/next/dist/docs/` before writing frontend code.
- There is **no PostgreSQL testcontainer / DB fixture** wired up (see `tests/integration/test_placeholder.py`, which is skipped). Backend tests in this plan therefore target **pure, DB-free logic**. DB-dependent dependencies, the migration, and all frontend work are implemented and verified manually (steps provided).

## Module / action reference (the source of truth)

11 permission modules (must match `app/core/constants.py::PermissionModule` and the frontend role UI):
`overview, bookings, revenue, staff, shifts, customers, branches, services, recruit, roles, logs`

4 actions (`PermissionAction`): `view, create, edit, delete`.

The "Tài khoản" (accounts) screen has no dedicated module → it is gated under the `roles` module.

---

## Task 1: Pure permission helpers (`app/core/permissions.py`)

A small, dependency-free module holding the permission-check logic and the full-grant builder. This is the TDD core reused by the dependency, the `/me` endpoint, and the seed.

**Files:**
- Create: `app/core/permissions.py`
- Test: `tests/unit/test_permissions.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/test_permissions.py`:

```python
from app.core.constants import PermissionAction, PermissionModule
from app.core.permissions import all_permissions_granted, has_permission


def test_has_permission_true_when_granted() -> None:
    perms = {"branches": {"view": True, "create": False}}
    assert has_permission(perms, PermissionModule.BRANCHES, PermissionAction.VIEW) is True


def test_has_permission_false_when_action_denied() -> None:
    perms = {"branches": {"view": True, "create": False}}
    assert has_permission(perms, PermissionModule.BRANCHES, PermissionAction.CREATE) is False


def test_has_permission_false_when_module_missing() -> None:
    assert has_permission({}, PermissionModule.ROLES, PermissionAction.VIEW) is False


def test_has_permission_false_when_action_key_absent() -> None:
    perms = {"roles": {"view": True}}
    assert has_permission(perms, PermissionModule.ROLES, PermissionAction.DELETE) is False


def test_has_permission_handles_none_module_value() -> None:
    perms = {"roles": None}
    assert has_permission(perms, PermissionModule.ROLES, PermissionAction.VIEW) is False


def test_all_permissions_granted_covers_every_module_and_action() -> None:
    granted = all_permissions_granted()
    assert set(granted.keys()) == {m.value for m in PermissionModule}
    for module in PermissionModule:
        for action in PermissionAction:
            assert granted[module.value][action.value] is True
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `poetry run pytest tests/unit/test_permissions.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app.core.permissions'`.

- [ ] **Step 3: Implement `app/core/permissions.py`**

```python
from app.core.constants import PermissionAction, PermissionModule

PermissionTree = dict[str, dict[str, bool]]


def has_permission(
    permissions: dict,
    module: PermissionModule | str,
    action: PermissionAction | str,
) -> bool:
    """True only if permissions explicitly grant `action` on `module`."""
    module_perms = permissions.get(str(module))
    if not module_perms:
        return False
    return bool(module_perms.get(str(action), False))


def all_permissions_granted() -> PermissionTree:
    """Full permission tree: every action allowed on every module."""
    return {
        module.value: {action.value: True for action in PermissionAction}
        for module in PermissionModule
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `poetry run pytest tests/unit/test_permissions.py -v`
Expected: PASS (6 passed).

- [ ] **Step 5: Lint**

Run: `poetry run ruff check app/core/permissions.py tests/unit/test_permissions.py`
Expected: no errors.

- [ ] **Step 6: Checkpoint (optional commit)**

```bash
git add app/core/permissions.py tests/unit/test_permissions.py
git commit -m "feat(auth): add pure permission helpers"
```

---

## Task 2: Permission dependencies (`app/auth/dependencies.py`)

Add `get_current_permissions` (DB resolution) and the `require_permission(module, action)` factory. The factory's inner checker takes `permissions` as a sub-dependency, so it is unit-testable without a DB by calling it with an explicit `permissions=` kwarg.

**Files:**
- Modify: `app/auth/dependencies.py`
- Test: `tests/unit/test_require_permission.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/test_require_permission.py`:

```python
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `poetry run pytest tests/unit/test_require_permission.py -v`
Expected: FAIL — `ImportError: cannot import name 'require_permission'`.

- [ ] **Step 3: Implement the dependencies**

Replace the entire contents of `app/auth/dependencies.py` with:

```python
from uuid import UUID

from fastapi import Cookie, Depends
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import decode_token
from app.core.constants import AccountStatus, PermissionAction, PermissionModule
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.permissions import has_permission
from app.db.repositories.employee import EmployeeRepository
from app.db.repositories.role import RoleRepository
from app.db.session import get_db_session


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
    if payload.get("status") != AccountStatus.APPROVED.value:
        raise UnauthorizedError(message_key="errors.auth.not_approved")
    return UUID(payload["sub"])


async def get_current_permissions(
    account_id: UUID = Depends(get_current_account_id),
    session: AsyncSession = Depends(get_db_session),
) -> dict:
    """Resolve the current account's permission tree via Employee -> Role."""
    employee = await EmployeeRepository(session).get_by_account_id(account_id)
    if employee is None or employee.role_id is None:
        return {}
    role = await RoleRepository(session).get_by_id(employee.role_id)
    if role is None or role.deleted_at is not None:
        return {}
    return role.permissions or {}


def require_permission(module: PermissionModule, action: PermissionAction):
    """Return a FastAPI dependency that enforces `action` on `module`."""

    async def _checker(
        permissions: dict = Depends(get_current_permissions),
    ) -> None:
        if not has_permission(permissions, module, action):
            raise ForbiddenError(
                message_key="errors.auth.forbidden",
                detail={"module": str(module), "action": str(action)},
            )

    return _checker
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `poetry run pytest tests/unit/test_require_permission.py -v`
Expected: PASS (3 passed).

- [ ] **Step 5: Lint + full unit suite**

Run: `poetry run ruff check app/auth/dependencies.py tests/unit/test_require_permission.py && poetry run pytest tests/unit -v`
Expected: no lint errors; all unit tests pass.

- [ ] **Step 6: Checkpoint (optional commit)**

```bash
git add app/auth/dependencies.py tests/unit/test_require_permission.py
git commit -m "feat(auth): add get_current_permissions and require_permission"
```

---

## Task 3: Seed the `admin` system role (Alembic migration)

The login flow already assigns the role with `key='admin'` to the first user, but no such role exists yet. Seed it with full permissions.

**Files:**
- Create: `alembic/versions/<generated>_seed_admin_role.py`

- [ ] **Step 1: Generate a migration file**

Run: `poetry run alembic revision -m "seed admin role"`
This creates `alembic/versions/<hash>_seed_admin_role.py`. Note the generated revision hash.

- [ ] **Step 2: Replace the migration body**

Open the generated file and replace its contents with the following. Keep the auto-generated `revision` value that Alembic put in the file; set `down_revision` to the current head `"aff5b777a9d6"`.

```python
"""seed admin role

Revision ID: <KEEP THE GENERATED VALUE>
Revises: aff5b777a9d6
"""
import json
import uuid
from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op

revision = "<KEEP THE GENERATED VALUE>"
down_revision = "aff5b777a9d6"
branch_labels = None
depends_on = None

_MODULES = [
    "overview", "bookings", "revenue", "staff", "shifts", "customers",
    "branches", "services", "recruit", "roles", "logs",
]
_ACTIONS = ["view", "create", "edit", "delete"]


def _full_permissions() -> dict:
    return {m: {a: True for a in _ACTIONS} for m in _MODULES}


def upgrade() -> None:
    bind = op.get_bind()
    existing = bind.execute(
        sa.text("SELECT id FROM roles WHERE key = 'admin' AND deleted_at IS NULL")
    ).first()
    if existing is not None:
        return
    now = datetime.now(timezone.utc)
    bind.execute(
        sa.text(
            "INSERT INTO roles "
            "(id, name, key, description, scope, color, permissions, "
            " is_system, created_at, updated_at) "
            "VALUES (:id, :name, :key, :description, :scope, :color, "
            " CAST(:permissions AS JSON), :is_system, :created_at, :updated_at)"
        ),
        {
            "id": str(uuid.uuid4()),
            "name": "Quản trị viên",
            "key": "admin",
            "description": "Toàn quyền hệ thống",
            "scope": None,
            "color": "#EE8A33",
            "permissions": json.dumps(_full_permissions()),
            "is_system": True,
            "created_at": now,
            "updated_at": now,
        },
    )


def downgrade() -> None:
    op.get_bind().execute(sa.text("DELETE FROM roles WHERE key = 'admin'"))
```

> Note: the migration intentionally inlines the module/action literals (self-contained, no app imports) so it stays stable if the enums change later. This duplicates the list in `PermissionModule` — that is the accepted trade-off for migration safety.

- [ ] **Step 3: Apply the migration**

Run: `poetry run alembic upgrade head`
Expected: completes without error.

- [ ] **Step 4: Verify the seeded row**

Connect to the dev DB (e.g. `docker compose exec db psql -U <user> <dbname>` or your psql client) and run:
`SELECT key, is_system, permissions->'roles'->>'delete' AS roles_delete FROM roles WHERE key='admin';`
Expected: exactly one row, `is_system = t`, `roles_delete = true`.

- [ ] **Step 5: Verify idempotency + downgrade**

Run: `poetry run alembic downgrade -1 && poetry run alembic upgrade head`
Expected: downgrade removes the admin role, upgrade re-adds exactly one. Re-running `upgrade` after it already exists must not create a duplicate (guarded by the SELECT check).

- [ ] **Step 6: Checkpoint (optional commit)**

```bash
git add alembic/versions/
git commit -m "feat(roles): seed admin system role with full permissions"
```

---

## Task 4: Gate all private endpoints with `require_permission`

Replace each endpoint's auth dependency (or add one where missing) with `require_permission(module, action)` per the mapping. The dependency's return value is unused, so use the parameter name `_`.

### 4a. Branches router (module `branches`) — currently has **no** auth

**Files:** Modify: `app/api/private/branches/router.py`

- [ ] **Step 1: Add the import**

After the existing `from app.core.constants import BranchStatus` line, add:

```python
from app.auth.dependencies import require_permission
from app.core.constants import PermissionAction, PermissionModule
```

- [ ] **Step 2: Add a dependency param to each endpoint**

Add the matching line as the **last parameter** of each route function:

- `list_branches` (GET ""):
  ```python
  _: None = Depends(require_permission(PermissionModule.BRANCHES, PermissionAction.VIEW)),
  ```
- `upload_branch_image` (POST "/image"):
  ```python
  _: None = Depends(require_permission(PermissionModule.BRANCHES, PermissionAction.CREATE)),
  ```
- `create_branch` (POST ""):
  ```python
  _: None = Depends(require_permission(PermissionModule.BRANCHES, PermissionAction.CREATE)),
  ```
- `get_branch` (GET "/{branch_id}"):
  ```python
  _: None = Depends(require_permission(PermissionModule.BRANCHES, PermissionAction.VIEW)),
  ```
- `update_branch` (PATCH "/{branch_id}"):
  ```python
  _: None = Depends(require_permission(PermissionModule.BRANCHES, PermissionAction.EDIT)),
  ```
- `delete_branch` (DELETE "/{branch_id}"):
  ```python
  _: None = Depends(require_permission(PermissionModule.BRANCHES, PermissionAction.DELETE)),
  ```

> `upload_branch_image` currently has only `file: UploadFile`. Add the dependency param after it.

### 4b. Services router (module `services`) — currently has **no** auth

**Files:** Modify: `app/api/private/services/router.py`

- [ ] **Step 3: Add import + per-endpoint dependency**

Add the same two imports (`require_permission`; `PermissionAction, PermissionModule`). Then add as the last param of each route:

- `list_services` (GET ""): VIEW
- `create_service` (POST ""): CREATE
- `get_service` (GET "/{service_id}"): VIEW
- `update_service` (PATCH "/{service_id}"): EDIT
- `delete_service` (DELETE "/{service_id}"): DELETE

Each line is `_: None = Depends(require_permission(PermissionModule.SERVICES, PermissionAction.<X>)),`.

### 4c. Employees router (module `staff`) — replace existing dep

**Files:** Modify: `app/api/private/employees/router.py`

- [ ] **Step 4: Swap the dependency**

Replace the import `from app.auth.dependencies import get_current_account_id` with:

```python
from app.auth.dependencies import require_permission
from app.core.constants import PermissionAction, PermissionModule
```

Replace each existing `_: UUID = Depends(get_current_account_id),` line:

- `list_employees`: `_: None = Depends(require_permission(PermissionModule.STAFF, PermissionAction.VIEW)),`
- `update_employee`: `_: None = Depends(require_permission(PermissionModule.STAFF, PermissionAction.EDIT)),`
- `delete_employee`: `_: None = Depends(require_permission(PermissionModule.STAFF, PermissionAction.DELETE)),`

Remove the now-unused `from uuid import UUID` import **only if** `UUID` is no longer referenced elsewhere in the file (the path params still use `UUID` — keep it).

### 4d. Roles router (module `roles`) — replace existing dep

**Files:** Modify: `app/api/private/roles/router.py`

- [ ] **Step 5: Swap the dependency**

Replace the `get_current_account_id` import with the `require_permission` + constants imports (as in 4c). Map each endpoint:

- list (GET): VIEW
- create (POST): CREATE
- update (PATCH): EDIT
- delete (DELETE): DELETE

Each line: `_: None = Depends(require_permission(PermissionModule.ROLES, PermissionAction.<X>)),`.

### 4e. Accounts router (module `roles`) — replace existing dep

**Files:** Modify: `app/api/private/accounts/router.py`

- [ ] **Step 6: Swap the dependency**

Replace the `get_current_account_id` import with the `require_permission` + constants imports. Map:

- `list_accounts` (GET ""): `require_permission(PermissionModule.ROLES, PermissionAction.VIEW)`
- `approve_account` (PATCH "/{account_id}/approve"): `...PermissionAction.EDIT`
- `reject_account` (PATCH "/{account_id}/reject"): `...PermissionAction.EDIT`
- `delete_account` (DELETE "/{account_id}"): `...PermissionAction.DELETE`

Each line: `_: None = Depends(require_permission(PermissionModule.ROLES, PermissionAction.<X>)),`.

- [ ] **Step 7: Verify the app imports & routes load**

Run: `poetry run python -c "from app.main import app; print(len(app.routes), 'routes loaded')"`
Expected: prints a route count with no import errors.

- [ ] **Step 8: Lint**

Run: `poetry run ruff check app/api/private`
Expected: no errors (in particular, no unused-import warnings — remove `get_current_account_id` imports you replaced).

- [ ] **Step 9: Manual smoke test (DB required)**

Start the app (`docker compose up` or the project's run command). With a logged-in **admin** cookie, `GET /api/v1/branches` returns 200. Create a second role with `branches.view=false`, assign it to a test employee/account, log in as that account, and confirm `GET /api/v1/branches` returns **403** with body `{"errorCode":"FORBIDDEN","messageKey":"errors.auth.forbidden","detail":{"module":"branches","action":"view"}}`.

- [ ] **Step 10: Checkpoint (optional commit)**

```bash
git add app/api/private
git commit -m "feat(auth): enforce module permissions on all private endpoints"
```

---

## Task 5: Expose role + permissions from `/auth/me`

**Files:**
- Modify: `app/schemas/account.py`
- Modify: `app/api/public/auth/router.py`

- [ ] **Step 1: Add `RoleSummary` and `MeRead` schemas**

In `app/schemas/account.py`, add the import and schemas (append after `AccountRead`):

```python
from app.schemas.role import PermissionMap  # add near the top with other imports


class RoleSummary(AppSchema):
    id: UUID
    name: str
    key: str


class MeRead(AccountRead):
    role: RoleSummary | None = None
    permissions: dict[str, PermissionMap] = {}
```

- [ ] **Step 2: Update the `/me` endpoint**

In `app/api/public/auth/router.py`:

1. Extend imports:
   ```python
   from app.db.repositories.employee import EmployeeRepository
   from app.db.repositories.role import RoleRepository
   from app.schemas.account import AccountRead, MeRead, RoleSummary
   ```
2. Replace the `get_me` function with:
   ```python
   @router.get("/me", response_model=MeRead)
   async def get_me(
       account_id: UUID = Depends(get_current_account_id),
       session: AsyncSession = Depends(get_db_session),
   ) -> MeRead:
       account = await AccountRepository(session).get_active_by_id(account_id)
       if account is None:
           raise UnauthorizedError(message_key="errors.auth.not_found")

       me = MeRead.model_validate(account)
       employee = await EmployeeRepository(session).get_by_account_id(account_id)
       if employee is not None and employee.role_id is not None:
           role = await RoleRepository(session).get_by_id(employee.role_id)
           if role is not None and role.deleted_at is None:
               me.role = RoleSummary(id=role.id, name=role.name, key=role.key)
               me.permissions = role.permissions or {}
       return me
   ```

- [ ] **Step 3: Verify import + schema**

Run: `poetry run python -c "from app.api.public.auth.router import router; from app.schemas.account import MeRead; print('ok')"`
Expected: prints `ok` with no errors.

- [ ] **Step 4: Lint**

Run: `poetry run ruff check app/schemas/account.py app/api/public/auth/router.py`
Expected: no errors.

- [ ] **Step 5: Manual check (DB required)**

Logged in as admin, `GET /api/v1/auth/me` returns JSON containing `role: {id,name,key:"admin"}` and `permissions` with every module fully `true`.

- [ ] **Step 6: Checkpoint (optional commit)**

```bash
git add app/schemas/account.py app/api/public/auth/router.py
git commit -m "feat(auth): return role and permissions from /auth/me"
```

---

## Task 6: Frontend — types, API, and route→module map

**Files:**
- Modify: `src/types/account.type.ts`
- Modify: `src/services/auth.api.ts`
- Create: `src/lib/permissions.ts`

- [ ] **Step 1: Read the Next.js docs note**

Skim `node_modules/next/dist/docs/` for any App-Router/client-component changes before editing. (Per `AGENTS.md`.)

- [ ] **Step 2: Add permission types**

In `src/types/account.type.ts`, append:

```typescript
import type { PermissionMap } from './role.type';

export interface RoleSummary {
  id: string;
  name: string;
  key: string;
}

export interface Me extends Account {
  role: RoleSummary | null;
  permissions: Record<string, PermissionMap>;
}
```

- [ ] **Step 3: Type `getMe`/`refreshToken` as `Me`**

In `src/services/auth.api.ts`:
- Change the import `import type { Account, PaginatedAccounts } from '@/types/account.type';` to also include `Me`.
- Change `getMe` return type to `Promise<Me>` and the fetch generic to `apiFetch<Me>('/auth/me')`.
- **Leave `refreshToken` unchanged** (`Promise<Account>`). Backend `/auth/refresh` returns `AccountRead` (no permissions); the context (Task 7) calls `getMe` after a successful refresh to load permissions, and never reads `refreshToken`'s return value.

- [ ] **Step 4: Create the route→module map + constants**

Create `src/lib/permissions.ts`:

```typescript
import type { PermissionMap } from '@/types/role.type';

export type PermAction = 'view' | 'create' | 'edit' | 'delete';

/** Maps an admin route prefix to its permission module. */
export const ROUTE_MODULE: Record<string, string> = {
  '/dashboard': 'overview',
  '/manage-bookings': 'bookings',
  '/revenue': 'revenue',
  '/employees': 'staff',
  '/shifts': 'shifts',
  '/customers': 'customers',
  '/branches': 'branches',
  '/services': 'services',
  '/recruitment': 'recruit',
  '/accounts': 'roles',
  '/roles': 'roles',
  '/audit-log': 'logs',
};

export function hasPermission(
  permissions: Record<string, PermissionMap> | undefined,
  module: string,
  action: PermAction,
): boolean {
  return Boolean(permissions?.[module]?.[action]);
}

/** First route the user is allowed to view, or null if none. */
export function firstAllowedRoute(
  permissions: Record<string, PermissionMap> | undefined,
): string | null {
  for (const [route, module] of Object.entries(ROUTE_MODULE)) {
    if (hasPermission(permissions, module, 'view')) return route;
  }
  return null;
}

/** Module for a given pathname (longest matching prefix), or null. */
export function moduleForPath(pathname: string): string | null {
  let match: { len: number; module: string } | null = null;
  for (const [route, module] of Object.entries(ROUTE_MODULE)) {
    if (pathname === route || pathname.startsWith(route + '/')) {
      if (!match || route.length > match.len) match = { len: route.length, module };
    }
  }
  return match?.module ?? null;
}
```

- [ ] **Step 5: Type-check the frontend**

Run: `cd goodhair_frontend && npx tsc --noEmit`
Expected: no type errors from the changed files.

- [ ] **Step 6: Checkpoint (optional commit)**

```bash
git add src/types/account.type.ts src/services/auth.api.ts src/lib/permissions.ts
git commit -m "feat(fe): add Me type, permission helpers and route-module map"
```

---

## Task 7: Frontend — expose permissions + `can()` from AuthContext

**Files:**
- Modify: `src/contexts/AuthContext.tsx`

- [ ] **Step 1: Update the context value and provider**

Replace the contents of `src/contexts/AuthContext.tsx` with:

```typescript
'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { getMe, logout as apiLogout, refreshToken } from '@/services/auth.api';
import type { Me } from '@/types/account.type';
import { hasPermission, type PermAction } from '@/lib/permissions';

interface AuthContextValue {
  account: Me | null;
  loading: boolean;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
  can: (module: string, action: PermAction) => boolean;
  canView: (module: string) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  account: null,
  loading: true,
  logout: async () => {},
  refetch: async () => {},
  can: () => false,
  canView: () => false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const me = await getMe();
      setAccount(me);
    } catch (err: unknown) {
      const status = (err as { status?: number }).status;
      if (status === 401) {
        try {
          await refreshToken();
          const me = await getMe();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    fetchMe();
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setAccount(null);
  }, []);

  const can = useCallback(
    (module: string, action: PermAction) => hasPermission(account?.permissions, module, action),
    [account],
  );
  const canView = useCallback((module: string) => can(module, 'view'), [can]);

  return (
    <AuthContext.Provider
      value={{ account, loading, logout, refetch: fetchMe, can, canView }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

> Behaviour change: on a 401 we now `refreshToken()` then re-fetch `getMe()` so permissions are always sourced from `/me` (which includes them), not from the refresh response.

- [ ] **Step 2: Type-check**

Run: `cd goodhair_frontend && npx tsc --noEmit`
Expected: no new type errors. (Note: components consuming `account.requestedAt` etc. still work because `Me extends Account`.)

- [ ] **Step 3: Checkpoint (optional commit)**

```bash
git add src/contexts/AuthContext.tsx
git commit -m "feat(fe): expose permissions and can()/canView() from AuthContext"
```

---

## Task 8: Frontend — filter the Sidebar by `canView`

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add module keys to menu items**

In `src/components/layout/Sidebar.tsx`, add a `module` field to each entry of `menuItems`, using the mapping from `ROUTE_MODULE`:

```typescript
const menuItems = [
  { key: '/dashboard', module: 'overview', icon: <LayoutDashboard size={18} />, label: 'Tổng quan' },
  { key: '/manage-bookings', module: 'bookings', icon: <CalendarDays size={18} />, label: 'Đặt lịch', badge: 5 },
  { key: '/revenue', module: 'revenue', icon: <BarChart3 size={18} />, label: 'Doanh thu' },
  { key: '/employees', module: 'staff', icon: <Users size={18} />, label: 'Nhân viên' },
  { key: '/shifts', module: 'shifts', icon: <Clock size={18} />, label: 'Ca làm việc' },
  { key: '/customers', module: 'customers', icon: <UserCheck size={18} />, label: 'Khách hàng' },
  { key: '/branches', module: 'branches', icon: <Store size={18} />, label: 'Chi nhánh' },
  { key: '/services', module: 'services', icon: <Scissors size={18} />, label: 'Dịch vụ' },
  { key: '/recruitment', module: 'recruit', icon: <Briefcase size={18} />, label: 'Tuyển dụng' },
  { key: '/accounts', module: 'roles', icon: <UserCog size={18} />, label: 'Tài khoản' },
  { key: '/roles', module: 'roles', icon: <ShieldCheck size={18} />, label: 'Quản lý vai trò' },
  { key: '/audit-log', module: 'logs', icon: <History size={18} />, label: 'Nhật ký hoạt động' },
];
```

- [ ] **Step 2: Filter the rendered items by permission**

In the `Sidebar` component, pull `canView` from `useAuth()` (it currently destructures `{ account, logout }` → change to `{ account, logout, canView }`). Where `menuItems` is mapped into the Ant `Menu` `items`, filter first:

```typescript
const visibleItems = menuItems.filter((item) => canView(item.module));
```

Use `visibleItems` instead of `menuItems` when building the `Menu` `items` prop. Leave the logout entry untouched.

- [ ] **Step 3: Verify visually (dev server)**

Run the frontend (`npm run dev`). As admin, all 12 items show. Create a limited role (e.g. only `branches.view`), assign it to a test account, log in: only "Chi nhánh" appears.

- [ ] **Step 4: Checkpoint (optional commit)**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(fe): filter sidebar items by view permission"
```

---

## Task 9: Frontend — route guard + "no access" handling

Block direct URL access to modules the user cannot view, and show a fallback when the user has no permissions at all.

**Files:**
- Modify: `src/app/(admin)/AdminAuthGuard.tsx`

- [ ] **Step 1: Extend the guard with permission logic**

Replace the contents of `src/app/(admin)/AdminAuthGuard.tsx` with:

```typescript
'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { firstAllowedRoute, moduleForPath } from '@/lib/permissions';

const LOADING = (
  <div
    style={{
      display: 'flex',
      height: '100vh',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a131d',
    }}
  >
    <span style={{ color: '#EE8A33', fontSize: 14 }}>Đang tải...</span>
  </div>
);

export default function AdminAuthGuard({ children }: { children: ReactNode }) {
  const { account, loading, canView } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const module = moduleForPath(pathname);
  const allowed = module ? canView(module) : true;
  const fallback = account ? firstAllowedRoute(account.permissions) : null;

  useEffect(() => {
    if (loading) return;
    if (!account) {
      router.replace('/login');
      return;
    }
    if (!allowed && fallback && pathname !== fallback) {
      router.replace(fallback);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, account, allowed, fallback, pathname]);

  if (loading) return LOADING;
  if (!account) return null;

  if (!allowed) {
    if (fallback) return LOADING; // redirecting to first allowed route
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a131d',
          color: '#F1ECE1',
          textAlign: 'center',
          padding: 24,
        }}
      >
        <span style={{ color: '#EE8A33', fontSize: 18, fontWeight: 700 }}>
          Chưa được cấp quyền
        </span>
        <span style={{ fontSize: 14, opacity: 0.8 }}>
          Tài khoản của bạn chưa được gán vai trò có quyền truy cập. Vui lòng liên hệ quản trị viên.
        </span>
      </div>
    );
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Verify**

Run dev server. As a limited-role user (only `branches.view`): navigating directly to `/roles` redirects to `/branches`. A user whose role grants no `view` on any module sees the "Chưa được cấp quyền" screen.

- [ ] **Step 3: Type-check**

Run: `cd goodhair_frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Checkpoint (optional commit)**

```bash
git add "src/app/(admin)/AdminAuthGuard.tsx"
git commit -m "feat(fe): gate admin routes by module view permission"
```

---

## Task 10: Frontend — gate action buttons by permission

Hide create/edit/delete controls the user cannot perform. The pattern is identical everywhere: pull `can` from `useAuth()` and conditionally render the control. Apply per file with the module shown.

**Pattern (copy/paste, change only the module + action):**

```tsx
const { can } = useAuth();
// ...
{can('branches', 'create') && (
  <Button type="primary" icon={<Plus size={18} />} onClick={...}>
    Thêm chi nhánh
  </Button>
)}
```

- [ ] **Step 1: Branches — `src/app/(admin)/branches/BranchClient.tsx`** (module `branches`)

Import/destructure `useAuth` and `can`. Wrap:
- the "Thêm chi nhánh" `Button` (around line 486) → `can('branches','create')`
- the "Sửa" button (around line 344) → `can('branches','edit')`
- the "Xóa" button (around line 351) → `can('branches','delete')`

- [ ] **Step 2: Services — `src/app/(admin)/services/ServiceClient.tsx`** (module `services`)

Wrap the add-service button → `can('services','create')`; edit control → `can('services','edit')`; delete control → `can('services','delete')`. (Search the file for the "Thêm", "Sửa", "Xóa" buttons.)

- [ ] **Step 3: Employees — `src/app/(admin)/employees/EmployeesClient.tsx`** (module `staff`)

This screen edits employees (assign role/branch/status) and deletes. Wrap the row "Sửa"/edit trigger → `can('staff','edit')`; the delete control → `can('staff','delete')`. (No create button exists here.)

- [ ] **Step 4: Roles — `src/app/(admin)/roles/RolesClient.tsx`** (module `roles`)

Wrap the create-role button → `can('roles','create')`; the save/edit permission controls → `can('roles','edit')`; the delete-role control → `can('roles','delete')`.

- [ ] **Step 5: Accounts — `src/app/(admin)/accounts/AccountsClient.tsx`** (module `roles`)

Wrap the Approve/Reject controls → `can('roles','edit')`; the delete control → `can('roles','delete')`.

- [ ] **Step 6: Type-check + lint**

Run: `cd goodhair_frontend && npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 7: Verify**

As a user with `branches.view` only (no create/edit/delete): the Branches screen loads but shows no Add/Edit/Delete buttons. As admin: all controls visible.

- [ ] **Step 8: Checkpoint (optional commit)**

```bash
git add "src/app/(admin)"
git commit -m "feat(fe): hide action buttons without permission"
```

---

## Final verification

- [ ] Backend unit suite green: `cd goodhair_backend && poetry run pytest -v`
- [ ] Backend lint clean: `poetry run ruff check app tests`
- [ ] Frontend type-check + lint clean: `cd goodhair_frontend && npx tsc --noEmit && npm run lint`
- [ ] End-to-end manual matrix (DB + both servers running):
  - Admin (seeded role): sees all menu items; all API calls 200; all buttons visible.
  - Limited role (only `branches.view`): sidebar shows only Chi nhánh; `/roles` URL redirects to `/branches`; no Add/Edit/Delete on Branches; `DELETE /api/v1/branches/{id}` returns 403.
  - No-role approved account: sees "Chưa được cấp quyền"; every private API returns 403.

---

## Spec coverage check

| Spec section | Covered by |
|---|---|
| Seed `admin` role | Task 3 |
| `get_current_permissions` + `require_permission` | Task 2 |
| Apply enforcement to routers (services/branches/staff/roles/accounts) | Task 4 |
| `/auth/me` returns role + permissions (`MeRead`) | Task 5 |
| AuthContext `can()`/`canView()` | Task 7 |
| Route→module map | Task 6 |
| Sidebar filtering | Task 8 |
| Route guard redirect + "no access" page | Task 9 |
| Action-button gating | Task 10 |
| Modules without API gated FE-only | Tasks 6/8/9 (map + sidebar + guard; no Task 4 entry) |
| Testing strategy (pure-logic unit tests; manual for DB/FE) | Tasks 1, 2 + manual steps throughout |
