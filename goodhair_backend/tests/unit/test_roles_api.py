"""Tests for /api/v1/roles private endpoints."""
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.core.exceptions import NotFoundError
from app.services.roles.service import RoleService

_ROLE_FIELDS = [
    "id", "name", "description", "is_system", "is_bookable",
    "employee_count", "permissions",
]


def _make_role() -> MagicMock:
    r = MagicMock(spec=_ROLE_FIELDS)
    r.id = uuid.uuid4()
    r.name = "Barber"
    r.description = "A barber role"
    r.is_system = False
    r.is_bookable = False
    r.employee_count = 0
    r.permissions = {}
    return r


async def test_list_roles_200(authed_client: AsyncClient) -> None:
    role = _make_role()
    with (
        patch.object(RoleService, "list_roles", new_callable=AsyncMock) as mock_list,
        patch.object(
            RoleService, "enrich_with_employee_count", new_callable=AsyncMock
        ) as mock_enrich,
    ):
        mock_list.return_value = ([role], 1)
        mock_enrich.return_value = [role]
        resp = await authed_client.get("/api/v1/roles")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


async def test_create_role_201(authed_client: AsyncClient) -> None:
    role = _make_role()
    with patch.object(RoleService, "create", new_callable=AsyncMock) as mock:
        mock.return_value = role
        resp = await authed_client.post(
            "/api/v1/roles",
            json={"name": "Barber", "key": "barber"},
        )
    assert resp.status_code == 201


async def test_update_role_200(authed_client: AsyncClient) -> None:
    role = _make_role()
    with patch.object(RoleService, "update", new_callable=AsyncMock) as mock:
        mock.return_value = role
        resp = await authed_client.patch(
            f"/api/v1/roles/{role.id}",
            json={"name": "Senior Barber"},
        )
    assert resp.status_code == 200


async def test_delete_role_204(authed_client: AsyncClient) -> None:
    role_id = uuid.uuid4()
    with patch.object(RoleService, "delete", new_callable=AsyncMock) as mock:
        mock.return_value = None
        resp = await authed_client.delete(f"/api/v1/roles/{role_id}")
    assert resp.status_code == 204


async def test_update_role_not_found_404(authed_client: AsyncClient) -> None:
    role_id = uuid.uuid4()
    with patch.object(RoleService, "update", new_callable=AsyncMock) as mock:
        mock.side_effect = NotFoundError()
        resp = await authed_client.patch(
            f"/api/v1/roles/{role_id}",
            json={"name": "Updated"},
        )
    assert resp.status_code == 404


async def test_create_role_missing_name_422(authed_client: AsyncClient) -> None:
    resp = await authed_client.post(
        "/api/v1/roles",
        json={},
    )
    assert resp.status_code == 422
