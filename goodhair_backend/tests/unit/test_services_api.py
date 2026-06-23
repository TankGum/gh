"""Tests for /api/v1/services private endpoints."""
import datetime
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.core.constants import ServiceStatus
from app.core.exceptions import NotFoundError
from app.services.services_catalog.service import ServiceCatalogService

_SVC_FIELDS = [
    "name", "description", "duration_minutes", "price", "status",
    "is_all_branches", "id", "branch_ids", "branch_count", "total_branches",
    "created_at", "updated_at",
]


def _make_service() -> MagicMock:
    s = MagicMock(spec=_SVC_FIELDS)
    s.id = uuid.uuid4()
    s.name = "Test Service"
    s.description = "A test service"
    s.duration_minutes = 30
    s.price = 100
    s.status = ServiceStatus.ACTIVE
    s.is_all_branches = True
    s.branch_ids = []
    s.branch_count = 0
    s.total_branches = 1
    s.created_at = datetime.datetime.now(datetime.timezone.utc)
    s.updated_at = datetime.datetime.now(datetime.timezone.utc)
    return s


async def test_list_services_200(authed_client: AsyncClient) -> None:
    svc = _make_service()
    with patch.object(
        ServiceCatalogService, "list_services", new_callable=AsyncMock
    ) as mock:
        mock.return_value = ([svc], 1)
        resp = await authed_client.get("/api/v1/services")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


async def test_create_service_201(authed_client: AsyncClient) -> None:
    svc = _make_service()
    with patch.object(
        ServiceCatalogService, "create_service", new_callable=AsyncMock
    ) as mock:
        mock.return_value = svc
        resp = await authed_client.post(
            "/api/v1/services",
            json={
                "name": "Haircut",
                "durationMinutes": 30,
                "price": 100,
                "isAllBranches": True,
            },
        )
    assert resp.status_code == 201


async def test_get_service_200(authed_client: AsyncClient) -> None:
    svc = _make_service()
    with patch.object(
        ServiceCatalogService, "get_service", new_callable=AsyncMock
    ) as mock:
        mock.return_value = svc
        resp = await authed_client.get(f"/api/v1/services/{svc.id}")
    assert resp.status_code == 200


async def test_update_service_200(authed_client: AsyncClient) -> None:
    svc = _make_service()
    with patch.object(
        ServiceCatalogService, "update_service", new_callable=AsyncMock
    ) as mock:
        mock.return_value = svc
        resp = await authed_client.patch(
            f"/api/v1/services/{svc.id}",
            json={"name": "Updated Service"},
        )
    assert resp.status_code == 200


async def test_delete_service_204(authed_client: AsyncClient) -> None:
    svc_id = uuid.uuid4()
    with patch.object(
        ServiceCatalogService, "delete_service", new_callable=AsyncMock
    ) as mock:
        mock.return_value = None
        resp = await authed_client.delete(f"/api/v1/services/{svc_id}")
    assert resp.status_code == 204


async def test_get_service_not_found_404(authed_client: AsyncClient) -> None:
    svc_id = uuid.uuid4()
    with patch.object(
        ServiceCatalogService, "get_service", new_callable=AsyncMock
    ) as mock:
        mock.side_effect = NotFoundError()
        resp = await authed_client.get(f"/api/v1/services/{svc_id}")
    assert resp.status_code == 404


async def test_create_service_validation_duration_zero_422(authed_client: AsyncClient) -> None:
    resp = await authed_client.post(
        "/api/v1/services",
        json={
            "name": "Haircut",
            "durationMinutes": 0,
            "price": 100,
            "isAllBranches": True,
        },
    )
    assert resp.status_code == 422


async def test_create_service_validation_negative_price_422(authed_client: AsyncClient) -> None:
    resp = await authed_client.post(
        "/api/v1/services",
        json={
            "name": "Haircut",
            "durationMinutes": 30,
            "price": -1,
            "isAllBranches": True,
        },
    )
    assert resp.status_code == 422


async def test_create_service_validation_not_all_branches_no_branch_ids_422(
    authed_client: AsyncClient,
) -> None:
    resp = await authed_client.post(
        "/api/v1/services",
        json={
            "name": "Haircut",
            "durationMinutes": 30,
            "price": 100,
            "isAllBranches": False,
            "branchIds": [],
        },
    )
    assert resp.status_code == 422
