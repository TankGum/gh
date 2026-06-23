"""Tests for /api/v1/revenue private endpoints."""
import datetime
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.services.revenue.service import RevenueService

_SUMMARY_FIELDS = [
    "total_revenue", "total_bookings", "avg_booking_value",
    "delta_revenue", "delta_bookings",
]
_DAILY_FIELDS = ["date", "revenue", "count"]
_BRANCH_FIELDS = ["branch_id", "branch_name", "revenue", "count", "pct"]
_SERVICE_FIELDS = ["service_id", "service_name", "revenue", "count", "pct"]
_EMPLOYEE_FIELDS = [
    "employee_id", "employee_name", "branch_name", "avatar_url", "revenue", "count", "pct",
]


def _make_summary() -> MagicMock:
    s = MagicMock(spec=_SUMMARY_FIELDS)
    s.total_revenue = 10000
    s.total_bookings = 50
    s.avg_booking_value = 200
    s.delta_revenue = 500
    s.delta_bookings = 5
    return s


def _make_daily_item() -> MagicMock:
    d = MagicMock(spec=_DAILY_FIELDS)
    d.date = datetime.date.today()
    d.revenue = 1000
    d.count = 5
    return d


def _make_by_branch() -> MagicMock:
    b = MagicMock(spec=_BRANCH_FIELDS)
    b.branch_id = uuid.uuid4()
    b.branch_name = "Main Branch"
    b.revenue = 5000
    b.count = 25
    b.pct = 50.0
    return b


def _make_by_service() -> MagicMock:
    s = MagicMock(spec=_SERVICE_FIELDS)
    s.service_id = uuid.uuid4()
    s.service_name = "Haircut"
    s.revenue = 3000
    s.count = 30
    s.pct = 60.0
    return s


def _make_by_employee() -> MagicMock:
    e = MagicMock(spec=_EMPLOYEE_FIELDS)
    e.employee_id = uuid.uuid4()
    e.employee_name = "John"
    e.branch_name = "Main Branch"
    e.avatar_url = None
    e.revenue = 2000
    e.count = 10
    e.pct = 40.0
    return e


DATE_PARAMS = "?startDate=2026-01-01&endDate=2026-12-31"


async def test_revenue_summary_200(authed_client: AsyncClient) -> None:
    summary = _make_summary()
    with patch.object(RevenueService, "get_summary", new_callable=AsyncMock) as mock:
        mock.return_value = summary
        resp = await authed_client.get(f"/api/v1/revenue/summary{DATE_PARAMS}")
    assert resp.status_code == 200


async def test_revenue_daily_200(authed_client: AsyncClient) -> None:
    item = _make_daily_item()
    with patch.object(RevenueService, "get_daily", new_callable=AsyncMock) as mock:
        mock.return_value = [item]
        resp = await authed_client.get(f"/api/v1/revenue/daily{DATE_PARAMS}")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_revenue_by_branch_200(authed_client: AsyncClient) -> None:
    item = _make_by_branch()
    with patch.object(RevenueService, "get_by_branch", new_callable=AsyncMock) as mock:
        mock.return_value = [item]
        resp = await authed_client.get(f"/api/v1/revenue/by-branch{DATE_PARAMS}")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_revenue_by_service_200(authed_client: AsyncClient) -> None:
    item = _make_by_service()
    with patch.object(RevenueService, "get_by_service", new_callable=AsyncMock) as mock:
        mock.return_value = [item]
        resp = await authed_client.get(f"/api/v1/revenue/by-service{DATE_PARAMS}")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_revenue_by_employee_200(authed_client: AsyncClient) -> None:
    item = _make_by_employee()
    with patch.object(RevenueService, "get_by_employee", new_callable=AsyncMock) as mock:
        mock.return_value = [item]
        resp = await authed_client.get(f"/api/v1/revenue/by-employee{DATE_PARAMS}")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_revenue_summary_missing_dates_422(authed_client: AsyncClient) -> None:
    resp = await authed_client.get("/api/v1/revenue/summary")
    assert resp.status_code == 422


async def test_revenue_daily_missing_dates_422(authed_client: AsyncClient) -> None:
    resp = await authed_client.get("/api/v1/revenue/daily")
    assert resp.status_code == 422


async def test_revenue_by_branch_missing_dates_422(authed_client: AsyncClient) -> None:
    resp = await authed_client.get("/api/v1/revenue/by-branch")
    assert resp.status_code == 422


async def test_revenue_by_service_missing_dates_422(authed_client: AsyncClient) -> None:
    resp = await authed_client.get("/api/v1/revenue/by-service")
    assert resp.status_code == 422


async def test_revenue_by_employee_missing_dates_422(authed_client: AsyncClient) -> None:
    resp = await authed_client.get("/api/v1/revenue/by-employee")
    assert resp.status_code == 422
