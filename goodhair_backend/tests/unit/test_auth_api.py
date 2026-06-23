"""Tests for auth and public endpoints."""
import datetime
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.db.repositories.booking import BookingRepository
from app.db.repositories.role import RoleRepository
from app.services.branches.service import BranchService
from app.services.employees.service import EmployeeService
from app.services.services_catalog.service import ServiceCatalogService


async def test_auth_me_no_cookie_401(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401


async def test_auth_logout_no_cookie_200(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/auth/logout")
    assert resp.status_code == 200
    assert resp.json() == {"ok": True}


async def test_auth_refresh_no_cookie_401(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/auth/refresh")
    assert resp.status_code == 401


async def test_health_200(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


async def test_public_branches_200(client: AsyncClient) -> None:
    with patch.object(BranchService, "list_branches", new_callable=AsyncMock) as mock:
        mock.return_value = ([], 0)
        resp = await client.get("/api/v1/public/branches")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert data["total"] == 0


async def test_public_services_200(client: AsyncClient) -> None:
    with patch.object(
        ServiceCatalogService, "list_services", new_callable=AsyncMock
    ) as mock:
        mock.return_value = ([], 0)
        resp = await client.get("/api/v1/public/services")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert data["total"] == 0


async def test_public_employees_200(client: AsyncClient) -> None:
    with (
        patch.object(EmployeeService, "list_employees", new_callable=AsyncMock) as mock_emp,
        patch.object(RoleRepository, "list_roles", new_callable=AsyncMock) as mock_roles,
    ):
        mock_emp.return_value = ([], 0)
        mock_roles.return_value = []
        resp = await client.get("/api/v1/public/employees")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data


async def test_public_available_slots_200(client: AsyncClient) -> None:
    emp_id = uuid.uuid4()
    with patch.object(
        BookingRepository, "get_booked_windows", new_callable=AsyncMock
    ) as mock:
        mock.return_value = []
        resp = await client.get(
            f"/api/v1/public/available-slots?employeeId={emp_id}&date=2026-06-22"
        )
    assert resp.status_code == 200
    data = resp.json()
    assert "bookedWindows" in data
