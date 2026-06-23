"""Tests for /api/v1/bookings private endpoints."""
import datetime
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.core.constants import BookingStatus
from app.core.exceptions import ConflictError, NotFoundError
from app.services.bookings.service import BookingService

_BOOKING_FIELDS = [
    "id", "code", "customer_name", "customer_phone", "employee_id",
    "branch_id", "date", "start_time", "duration_minutes", "total",
    "status", "service_ids",
]


def _make_booking() -> MagicMock:
    b = MagicMock(spec=_BOOKING_FIELDS)
    b.id = uuid.uuid4()
    b.code = "BK001"
    b.customer_name = "John Doe"
    b.customer_phone = "0901234567"
    b.employee_id = uuid.uuid4()
    b.branch_id = uuid.uuid4()
    b.date = datetime.date.today()
    b.start_time = datetime.time(9, 0)
    b.duration_minutes = 30
    b.total = 100
    b.status = BookingStatus.PENDING
    b.service_ids = []
    return b


async def test_list_bookings_200(authed_client: AsyncClient) -> None:
    booking = _make_booking()
    with (
        patch.object(BookingService, "list_bookings", new_callable=AsyncMock) as mock_list,
        patch.object(BookingService, "load_service_ids", new_callable=AsyncMock) as mock_sids,
    ):
        mock_list.return_value = ([booking], 1)
        mock_sids.return_value = []
        resp = await authed_client.get("/api/v1/bookings")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


async def test_create_booking_201(authed_client: AsyncClient) -> None:
    booking = _make_booking()
    with (
        patch.object(BookingService, "create", new_callable=AsyncMock) as mock_create,
        patch.object(BookingService, "load_service_ids", new_callable=AsyncMock) as mock_sids,
    ):
        mock_create.return_value = booking
        mock_sids.return_value = []
        resp = await authed_client.post(
            "/api/v1/bookings",
            json={
                "customerName": "John Doe",
                "customerPhone": "0901234567",
                "date": "2026-06-22",
                "startTime": "09:00:00",
            },
        )
    assert resp.status_code == 201


async def test_get_booking_200(authed_client: AsyncClient) -> None:
    booking = _make_booking()
    with (
        patch.object(BookingService, "get_by_id", new_callable=AsyncMock) as mock_get,
        patch.object(BookingService, "load_service_ids", new_callable=AsyncMock) as mock_sids,
    ):
        mock_get.return_value = booking
        mock_sids.return_value = []
        resp = await authed_client.get(f"/api/v1/bookings/{booking.id}")
    assert resp.status_code == 200


async def test_update_booking_200(authed_client: AsyncClient) -> None:
    booking = _make_booking()
    with (
        patch.object(BookingService, "update", new_callable=AsyncMock) as mock_update,
        patch.object(BookingService, "load_service_ids", new_callable=AsyncMock) as mock_sids,
    ):
        mock_update.return_value = booking
        mock_sids.return_value = []
        resp = await authed_client.patch(
            f"/api/v1/bookings/{booking.id}",
            json={"customerName": "Jane Doe"},
        )
    assert resp.status_code == 200


async def test_delete_booking_204(authed_client: AsyncClient) -> None:
    booking_id = uuid.uuid4()
    with patch.object(BookingService, "delete", new_callable=AsyncMock) as mock:
        mock.return_value = None
        resp = await authed_client.delete(f"/api/v1/bookings/{booking_id}")
    assert resp.status_code == 204


async def test_get_booking_not_found_404(authed_client: AsyncClient) -> None:
    booking_id = uuid.uuid4()
    with patch.object(BookingService, "get_by_id", new_callable=AsyncMock) as mock:
        mock.side_effect = NotFoundError()
        resp = await authed_client.get(f"/api/v1/bookings/{booking_id}")
    assert resp.status_code == 404


async def test_create_booking_conflict_409(authed_client: AsyncClient) -> None:
    with patch.object(BookingService, "create", new_callable=AsyncMock) as mock:
        mock.side_effect = ConflictError()
        resp = await authed_client.post(
            "/api/v1/bookings",
            json={
                "customerName": "John Doe",
                "customerPhone": "0901234567",
                "date": "2026-06-22",
                "startTime": "09:00:00",
            },
        )
    assert resp.status_code == 409


async def test_create_booking_missing_required_fields_422(authed_client: AsyncClient) -> None:
    resp = await authed_client.post(
        "/api/v1/bookings",
        json={},
    )
    assert resp.status_code == 422
