"""Tests for /api/v1/employees private endpoints."""
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.core.constants import EmploymentStatus
from app.core.exceptions import NotFoundError
from app.services.employees.service import EmployeeService

_EMPLOYEE_FIELDS = [
    "id", "account_id", "name", "email", "avatar_url",
    "branch_id", "role_id", "total_bookings", "total_revenue", "status",
]


def _make_employee() -> MagicMock:
    e = MagicMock(spec=_EMPLOYEE_FIELDS)
    e.id = uuid.uuid4()
    e.account_id = uuid.uuid4()
    e.name = "John Barber"
    e.email = "john@example.com"
    e.avatar_url = None
    e.branch_id = uuid.uuid4()
    e.role_id = uuid.uuid4()
    e.total_bookings = 0
    e.total_revenue = 0
    e.status = EmploymentStatus.ACTIVE
    return e


async def test_list_employees_200(authed_client: AsyncClient) -> None:
    emp = _make_employee()
    with patch.object(EmployeeService, "list_employees", new_callable=AsyncMock) as mock:
        mock.return_value = ([emp], 1)
        resp = await authed_client.get("/api/v1/employees")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


async def test_update_employee_200(authed_client: AsyncClient) -> None:
    emp = _make_employee()
    with patch.object(EmployeeService, "update", new_callable=AsyncMock) as mock:
        mock.return_value = emp
        resp = await authed_client.patch(
            f"/api/v1/employees/{emp.id}",
            json={"status": "active"},
        )
    assert resp.status_code == 200


async def test_delete_employee_204(authed_client: AsyncClient) -> None:
    emp_id = uuid.uuid4()
    with patch.object(EmployeeService, "delete", new_callable=AsyncMock) as mock:
        mock.return_value = None
        resp = await authed_client.delete(f"/api/v1/employees/{emp_id}")
    assert resp.status_code == 204


async def test_update_employee_not_found_404(authed_client: AsyncClient) -> None:
    emp_id = uuid.uuid4()
    with patch.object(EmployeeService, "update", new_callable=AsyncMock) as mock:
        mock.side_effect = NotFoundError()
        resp = await authed_client.patch(
            f"/api/v1/employees/{emp_id}",
            json={"status": "active"},
        )
    assert resp.status_code == 404
