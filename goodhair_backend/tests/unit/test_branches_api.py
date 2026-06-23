"""Tests for /api/v1/branches private endpoints."""
import datetime
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.core.constants import BranchStatus
from app.core.exceptions import NotFoundError
from app.schemas.branch import BranchRead
from app.services.branches.service import BranchService


def _make_branch() -> BranchRead:
    return BranchRead(
        id=uuid.uuid4(),
        name="Test Branch",
        code="BR001",
        address="123 Main St",
        image_url=None,
        opening_time=None,
        closing_time=None,
        rating=0.0,
        barber_count=0,
        monthly_revenue=0.0,
        seat_count=0,
        status=BranchStatus.OPEN,
        created_at=datetime.datetime.now(datetime.timezone.utc),
        updated_at=datetime.datetime.now(datetime.timezone.utc),
    )


async def test_list_branches_200(authed_client: AsyncClient) -> None:
    branch = _make_branch()
    with patch.object(BranchService, "list_branches", new_callable=AsyncMock) as mock:
        mock.return_value = ([branch], 1)
        resp = await authed_client.get("/api/v1/branches")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] == 1


async def test_create_branch_201(authed_client: AsyncClient) -> None:
    branch = _make_branch()
    with patch.object(BranchService, "create_branch", new_callable=AsyncMock) as mock:
        mock.return_value = branch
        resp = await authed_client.post(
            "/api/v1/branches",
            json={"name": "New Branch", "status": "open"},
        )
    assert resp.status_code == 201


async def test_get_branch_200(authed_client: AsyncClient) -> None:
    branch = _make_branch()
    with patch.object(BranchService, "get_branch", new_callable=AsyncMock) as mock:
        mock.return_value = branch
        resp = await authed_client.get(f"/api/v1/branches/{branch.id}")
    assert resp.status_code == 200


async def test_update_branch_200(authed_client: AsyncClient) -> None:
    branch = _make_branch()
    with patch.object(BranchService, "update_branch", new_callable=AsyncMock) as mock:
        mock.return_value = branch
        resp = await authed_client.patch(
            f"/api/v1/branches/{branch.id}",
            json={"name": "Updated Branch"},
        )
    assert resp.status_code == 200


async def test_delete_branch_204(authed_client: AsyncClient) -> None:
    branch_id = uuid.uuid4()
    with patch.object(BranchService, "delete_branch", new_callable=AsyncMock) as mock:
        mock.return_value = None
        resp = await authed_client.delete(f"/api/v1/branches/{branch_id}")
    assert resp.status_code == 204


async def test_get_branch_not_found_404(authed_client: AsyncClient) -> None:
    branch_id = uuid.uuid4()
    with patch.object(BranchService, "get_branch", new_callable=AsyncMock) as mock:
        mock.side_effect = NotFoundError()
        resp = await authed_client.get(f"/api/v1/branches/{branch_id}")
    assert resp.status_code == 404


async def test_update_branch_not_found_404(authed_client: AsyncClient) -> None:
    branch_id = uuid.uuid4()
    with patch.object(BranchService, "update_branch", new_callable=AsyncMock) as mock:
        mock.side_effect = NotFoundError()
        resp = await authed_client.patch(
            f"/api/v1/branches/{branch_id}",
            json={"name": "Updated"},
        )
    assert resp.status_code == 404


async def test_create_branch_validation_empty_name_422(authed_client: AsyncClient) -> None:
    resp = await authed_client.post(
        "/api/v1/branches",
        json={"name": "", "status": "open"},
    )
    assert resp.status_code == 422


async def test_create_branch_validation_rating_too_high_422(authed_client: AsyncClient) -> None:
    resp = await authed_client.post(
        "/api/v1/branches",
        json={"name": "Branch", "rating": 10, "status": "open"},
    )
    assert resp.status_code == 422
