"""Tests that private endpoints return 403 when the user lacks the required permission.

Each test creates a client whose permission dict has only the tested module/action
set to False (all others True), then verifies the endpoint returns 403.
"""
from __future__ import annotations

import uuid
from collections.abc import AsyncIterator
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_account_id, get_current_permissions
from app.core.constants import PermissionAction, PermissionModule
from app.db.session import get_db_session
from app.main import app

FAKE_ACCOUNT_ID = uuid.uuid4()
FAKE_ID = "00000000-0000-0000-0000-000000000001"


async def _fake_db() -> AsyncIterator[AsyncMock]:
    yield AsyncMock(spec=AsyncSession)


def _perms_without(module: PermissionModule, action: PermissionAction) -> dict:
    """All permissions True except the specified module+action."""
    perms = {
        m.value: {a.value: True for a in PermissionAction}
        for m in PermissionModule
    }
    perms[module.value][action.value] = False
    return perms


def _perms_all_false_for(module: PermissionModule) -> dict:
    """All permissions True except all actions in the specified module."""
    perms = {
        m.value: {a.value: True for a in PermissionAction}
        for m in PermissionModule
    }
    perms[module.value] = {a.value: False for a in PermissionAction}
    return perms


@pytest.fixture
async def client_without_bookings_create() -> AsyncIterator[AsyncClient]:
    app.dependency_overrides[get_current_permissions] = lambda: _perms_without(PermissionModule.BOOKINGS, PermissionAction.CREATE)
    app.dependency_overrides[get_current_account_id] = lambda: FAKE_ACCOUNT_ID
    app.dependency_overrides[get_db_session] = _fake_db
    async with AsyncClient(app=app, base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_current_permissions, None)
    app.dependency_overrides.pop(get_current_account_id, None)
    app.dependency_overrides.pop(get_db_session, None)


@pytest.fixture
async def client_without_bookings_delete() -> AsyncIterator[AsyncClient]:
    app.dependency_overrides[get_current_permissions] = lambda: _perms_without(PermissionModule.BOOKINGS, PermissionAction.DELETE)
    app.dependency_overrides[get_current_account_id] = lambda: FAKE_ACCOUNT_ID
    app.dependency_overrides[get_db_session] = _fake_db
    async with AsyncClient(app=app, base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_current_permissions, None)
    app.dependency_overrides.pop(get_current_account_id, None)
    app.dependency_overrides.pop(get_db_session, None)


@pytest.fixture
async def client_without_bookings_edit() -> AsyncIterator[AsyncClient]:
    app.dependency_overrides[get_current_permissions] = lambda: _perms_without(PermissionModule.BOOKINGS, PermissionAction.EDIT)
    app.dependency_overrides[get_current_account_id] = lambda: FAKE_ACCOUNT_ID
    app.dependency_overrides[get_db_session] = _fake_db
    async with AsyncClient(app=app, base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_current_permissions, None)
    app.dependency_overrides.pop(get_current_account_id, None)
    app.dependency_overrides.pop(get_db_session, None)


@pytest.fixture
async def client_without_branches_create() -> AsyncIterator[AsyncClient]:
    app.dependency_overrides[get_current_permissions] = lambda: _perms_without(PermissionModule.BRANCHES, PermissionAction.CREATE)
    app.dependency_overrides[get_current_account_id] = lambda: FAKE_ACCOUNT_ID
    app.dependency_overrides[get_db_session] = _fake_db
    async with AsyncClient(app=app, base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_current_permissions, None)
    app.dependency_overrides.pop(get_current_account_id, None)
    app.dependency_overrides.pop(get_db_session, None)


@pytest.fixture
async def client_without_services_delete() -> AsyncIterator[AsyncClient]:
    app.dependency_overrides[get_current_permissions] = lambda: _perms_without(PermissionModule.SERVICES, PermissionAction.DELETE)
    app.dependency_overrides[get_current_account_id] = lambda: FAKE_ACCOUNT_ID
    app.dependency_overrides[get_db_session] = _fake_db
    async with AsyncClient(app=app, base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_current_permissions, None)
    app.dependency_overrides.pop(get_current_account_id, None)
    app.dependency_overrides.pop(get_db_session, None)


@pytest.fixture
async def client_without_roles_create() -> AsyncIterator[AsyncClient]:
    app.dependency_overrides[get_current_permissions] = lambda: _perms_without(PermissionModule.ROLES, PermissionAction.CREATE)
    app.dependency_overrides[get_current_account_id] = lambda: FAKE_ACCOUNT_ID
    app.dependency_overrides[get_db_session] = _fake_db
    async with AsyncClient(app=app, base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_current_permissions, None)
    app.dependency_overrides.pop(get_current_account_id, None)
    app.dependency_overrides.pop(get_db_session, None)


@pytest.fixture
async def client_without_staff_edit() -> AsyncIterator[AsyncClient]:
    app.dependency_overrides[get_current_permissions] = lambda: _perms_without(PermissionModule.STAFF, PermissionAction.EDIT)
    app.dependency_overrides[get_current_account_id] = lambda: FAKE_ACCOUNT_ID
    app.dependency_overrides[get_db_session] = _fake_db
    async with AsyncClient(app=app, base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_current_permissions, None)
    app.dependency_overrides.pop(get_current_account_id, None)
    app.dependency_overrides.pop(get_db_session, None)


@pytest.fixture
async def client_without_revenue_view() -> AsyncIterator[AsyncClient]:
    app.dependency_overrides[get_current_permissions] = lambda: _perms_without(PermissionModule.REVENUE, PermissionAction.VIEW)
    app.dependency_overrides[get_current_account_id] = lambda: FAKE_ACCOUNT_ID
    app.dependency_overrides[get_db_session] = _fake_db
    async with AsyncClient(app=app, base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_current_permissions, None)
    app.dependency_overrides.pop(get_current_account_id, None)
    app.dependency_overrides.pop(get_db_session, None)


@pytest.fixture
async def client_without_logs_view() -> AsyncIterator[AsyncClient]:
    app.dependency_overrides[get_current_permissions] = lambda: _perms_without(PermissionModule.LOGS, PermissionAction.VIEW)
    app.dependency_overrides[get_current_account_id] = lambda: FAKE_ACCOUNT_ID
    app.dependency_overrides[get_db_session] = _fake_db
    async with AsyncClient(app=app, base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_current_permissions, None)
    app.dependency_overrides.pop(get_current_account_id, None)
    app.dependency_overrides.pop(get_db_session, None)


@pytest.fixture
async def client_without_overview_view() -> AsyncIterator[AsyncClient]:
    app.dependency_overrides[get_current_permissions] = lambda: _perms_without(PermissionModule.OVERVIEW, PermissionAction.VIEW)
    app.dependency_overrides[get_current_account_id] = lambda: FAKE_ACCOUNT_ID
    app.dependency_overrides[get_db_session] = _fake_db
    async with AsyncClient(app=app, base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_current_permissions, None)
    app.dependency_overrides.pop(get_current_account_id, None)
    app.dependency_overrides.pop(get_db_session, None)


@pytest.fixture
async def client_without_shifts_edit() -> AsyncIterator[AsyncClient]:
    app.dependency_overrides[get_current_permissions] = lambda: _perms_without(PermissionModule.SHIFTS, PermissionAction.EDIT)
    app.dependency_overrides[get_current_account_id] = lambda: FAKE_ACCOUNT_ID
    app.dependency_overrides[get_db_session] = _fake_db
    async with AsyncClient(app=app, base_url="http://test") as c:
        yield c
    app.dependency_overrides.pop(get_current_permissions, None)
    app.dependency_overrides.pop(get_current_account_id, None)
    app.dependency_overrides.pop(get_db_session, None)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestBookingPermissions:
    async def test_create_booking_forbidden_without_create_perm(
        self, client_without_bookings_create: AsyncClient
    ) -> None:
        resp = await client_without_bookings_create.post(
            "/api/v1/bookings",
            json={"customerName": "X", "customerPhone": "0901234567", "date": "2026-07-01", "startTime": "09:00:00"},
        )
        assert resp.status_code == 403

    async def test_delete_booking_forbidden_without_delete_perm(
        self, client_without_bookings_delete: AsyncClient
    ) -> None:
        resp = await client_without_bookings_delete.delete(f"/api/v1/bookings/{FAKE_ID}")
        assert resp.status_code == 403

    async def test_update_booking_forbidden_without_edit_perm(
        self, client_without_bookings_edit: AsyncClient
    ) -> None:
        resp = await client_without_bookings_edit.patch(
            f"/api/v1/bookings/{FAKE_ID}",
            json={"customerName": "Y"},
        )
        assert resp.status_code == 403


class TestBranchPermissions:
    async def test_create_branch_forbidden_without_create_perm(
        self, client_without_branches_create: AsyncClient
    ) -> None:
        resp = await client_without_branches_create.post(
            "/api/v1/branches",
            json={"name": "New Branch", "status": "open"},
        )
        assert resp.status_code == 403


class TestServicePermissions:
    async def test_delete_service_forbidden_without_delete_perm(
        self, client_without_services_delete: AsyncClient
    ) -> None:
        resp = await client_without_services_delete.delete(f"/api/v1/services/{FAKE_ID}")
        assert resp.status_code == 403


class TestRolePermissions:
    async def test_create_role_forbidden_without_create_perm(
        self, client_without_roles_create: AsyncClient
    ) -> None:
        resp = await client_without_roles_create.post(
            "/api/v1/roles",
            json={"name": "New Role"},
        )
        assert resp.status_code == 403


class TestStaffPermissions:
    async def test_update_employee_forbidden_without_edit_perm(
        self, client_without_staff_edit: AsyncClient
    ) -> None:
        resp = await client_without_staff_edit.patch(
            f"/api/v1/employees/{FAKE_ID}",
            json={"status": "active"},
        )
        assert resp.status_code == 403


class TestRevenuePermissions:
    async def test_summary_forbidden_without_revenue_view(
        self, client_without_revenue_view: AsyncClient
    ) -> None:
        resp = await client_without_revenue_view.get(
            "/api/v1/revenue/summary?startDate=2026-01-01&endDate=2026-12-31"
        )
        assert resp.status_code == 403

    async def test_daily_forbidden_without_revenue_view(
        self, client_without_revenue_view: AsyncClient
    ) -> None:
        resp = await client_without_revenue_view.get(
            "/api/v1/revenue/daily?startDate=2026-01-01&endDate=2026-12-31"
        )
        assert resp.status_code == 403


class TestLogsPermissions:
    async def test_list_logs_forbidden_without_logs_view(
        self, client_without_logs_view: AsyncClient
    ) -> None:
        resp = await client_without_logs_view.get("/api/v1/logs")
        assert resp.status_code == 403

    async def test_get_log_forbidden_without_logs_view(
        self, client_without_logs_view: AsyncClient
    ) -> None:
        resp = await client_without_logs_view.get(f"/api/v1/logs/{FAKE_ID}")
        assert resp.status_code == 403


class TestOverviewPermissions:
    async def test_overview_forbidden_without_overview_view(
        self, client_without_overview_view: AsyncClient
    ) -> None:
        resp = await client_without_overview_view.get("/api/v1/overview")
        assert resp.status_code == 403


class TestShiftPermissions:
    async def test_bulk_upsert_shifts_forbidden_without_edit_perm(
        self, client_without_shifts_edit: AsyncClient
    ) -> None:
        resp = await client_without_shifts_edit.put(
            "/api/v1/shifts/bulk",
            json={"shifts": [{"employeeId": FAKE_ID, "date": "2026-07-01", "shiftType": "morning"}]},
        )
        assert resp.status_code == 403
