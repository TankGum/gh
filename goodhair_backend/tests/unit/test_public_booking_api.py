"""API-level tests for POST /api/v1/public/bookings.

Patches repository methods so no real PostgreSQL is required.
"""

from __future__ import annotations

import datetime
import uuid
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories.booking import BookingRepository
from app.db.repositories.booking_service_item import BookingServiceItemRepository
from app.db.repositories.customer import CustomerRepository
from app.db.session import get_db_session
from app.main import app


# ---------------------------------------------------------------------------
# DB session override
# ---------------------------------------------------------------------------

async def _fake_session():
    yield AsyncMock(spec=AsyncSession)


@pytest.fixture(autouse=True)
def db_override():
    app.dependency_overrides[get_db_session] = _fake_session
    yield
    app.dependency_overrides.pop(get_db_session, None)


# ---------------------------------------------------------------------------
# Fake booking factory
# ---------------------------------------------------------------------------

def _fake_booking(**kwargs: Any) -> MagicMock:
    b = MagicMock()
    b.id = kwargs.get("id", uuid.uuid4())
    b.code = kwargs.get("code", "GH-0001")
    b.customer_name = kwargs.get("customer_name", "Nguyen Van A")
    b.customer_phone = kwargs.get("customer_phone", "0901234567")
    b.date = kwargs.get("date", datetime.date.today())
    b.start_time = kwargs.get("start_time", datetime.time(9, 0))
    b.total = kwargs.get("total", 100000)
    b.status = "pending"
    return b


def _fake_customer(**kwargs: Any) -> MagicMock:
    c = MagicMock()
    c.id = uuid.uuid4()
    c.name = kwargs.get("name", "Nguyen Van A")
    c.phone = kwargs.get("phone", "0901234567")
    return c


# ---------------------------------------------------------------------------
# Payload factory
# ---------------------------------------------------------------------------

_DEFAULT_EMP_ID = str(uuid.uuid4())
_DEFAULT_BRANCH_ID = str(uuid.uuid4())
_DEFAULT_SVC_ID = str(uuid.uuid4())


def payload(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "customerName": "Nguyen Van A",
        "customerPhone": "0901234567",
        "employeeId": _DEFAULT_EMP_ID,
        "branchId": _DEFAULT_BRANCH_ID,
        "date": datetime.date.today().isoformat(),
        "startTime": "09:00:00",
        "durationMinutes": 30,
        "total": 100000,
        "serviceIds": [_DEFAULT_SVC_ID],
    }
    base.update(overrides)
    return base


# ---------------------------------------------------------------------------
# Context manager: patch all repos for a happy-path booking creation
# ---------------------------------------------------------------------------

from contextlib import contextmanager


@contextmanager
def happy_path_patches(overlap: MagicMock | None = None):
    booking = _fake_booking()
    customer = _fake_customer()
    with (
        patch.object(BookingRepository, "check_overlap", new_callable=AsyncMock) as mock_overlap,
        patch.object(BookingRepository, "get_next_code", new_callable=AsyncMock) as mock_code,
        patch.object(BookingRepository, "create", new_callable=AsyncMock) as mock_create,
        patch.object(BookingServiceItemRepository, "set_services", new_callable=AsyncMock),
        patch.object(CustomerRepository, "get_by_phone", new_callable=AsyncMock) as mock_phone,
        patch.object(CustomerRepository, "create", new_callable=AsyncMock) as mock_cust_create,
        patch.object(CustomerRepository, "update", new_callable=AsyncMock),
    ):
        mock_overlap.return_value = overlap
        mock_code.return_value = "GH-0001"
        mock_create.return_value = booking
        mock_phone.return_value = None  # new customer
        mock_cust_create.return_value = customer
        yield {
            "overlap": mock_overlap,
            "code": mock_code,
            "create": mock_create,
            "phone": mock_phone,
        }


# ---------------------------------------------------------------------------
# Happy path tests
# ---------------------------------------------------------------------------

class TestPublicBookingHappyPath:
    async def test_creates_booking_returns_201(self, client: AsyncClient) -> None:
        with happy_path_patches():
            resp = await client.post("/api/v1/public/bookings", json=payload())
        assert resp.status_code == 201

    async def test_response_contains_required_fields(self, client: AsyncClient) -> None:
        with happy_path_patches():
            resp = await client.post("/api/v1/public/bookings", json=payload())
        assert resp.status_code == 201
        body = resp.json()
        for field in ("code", "customerName", "date", "startTime", "total"):
            assert field in body, f"Missing field: {field}"

    async def test_code_from_repo_returned_in_response(self, client: AsyncClient) -> None:
        with happy_path_patches():
            resp = await client.post("/api/v1/public/bookings", json=payload())
        assert resp.json()["code"] == "GH-0001"

    async def test_with_employee_calls_overlap_check(self, client: AsyncClient) -> None:
        emp_id = str(uuid.uuid4())
        with happy_path_patches() as mocks:
            resp = await client.post(
                "/api/v1/public/bookings",
                json=payload(employeeId=emp_id, durationMinutes=30),
            )
        assert resp.status_code == 201
        mocks["overlap"].assert_called_once()

    async def test_customer_auto_created_when_new(self, client: AsyncClient) -> None:
        with happy_path_patches() as mocks:
            resp = await client.post("/api/v1/public/bookings", json=payload())
        assert resp.status_code == 201
        mocks["phone"].assert_called_once()

    async def test_existing_customer_updated_not_created(self, client: AsyncClient) -> None:
        existing = _fake_customer()
        with (
            patch.object(BookingRepository, "check_overlap", new_callable=AsyncMock, return_value=None),
            patch.object(BookingRepository, "get_next_code", new_callable=AsyncMock, return_value="GH-0001"),
            patch.object(BookingRepository, "create", new_callable=AsyncMock, return_value=_fake_booking()),
            patch.object(BookingServiceItemRepository, "set_services", new_callable=AsyncMock),
            patch.object(CustomerRepository, "get_by_phone", new_callable=AsyncMock, return_value=existing),
            patch.object(CustomerRepository, "create", new_callable=AsyncMock) as mock_new_cust,
            patch.object(CustomerRepository, "update", new_callable=AsyncMock) as mock_update,
        ):
            resp = await client.post("/api/v1/public/bookings", json=payload())
        assert resp.status_code == 201
        mock_new_cust.assert_not_called()
        mock_update.assert_called_once()


# ---------------------------------------------------------------------------
# Conflict tests
# ---------------------------------------------------------------------------

class TestPublicBookingConflict:
    async def test_overlap_returns_409(self, client: AsyncClient) -> None:
        conflicting = _fake_booking()
        with happy_path_patches(overlap=conflicting):
            resp = await client.post(
                "/api/v1/public/bookings",
                json=payload(employeeId=str(uuid.uuid4()), durationMinutes=30),
            )
        assert resp.status_code == 409

    async def test_overlap_error_has_detail(self, client: AsyncClient) -> None:
        conflicting = _fake_booking()
        with happy_path_patches(overlap=conflicting):
            resp = await client.post(
                "/api/v1/public/bookings",
                json=payload(employeeId=str(uuid.uuid4()), durationMinutes=30),
            )
        assert resp.status_code == 409
        assert "detail" in resp.json()

    async def test_booking_not_saved_when_conflict(self, client: AsyncClient) -> None:
        conflicting = _fake_booking()
        with happy_path_patches(overlap=conflicting) as mocks:
            await client.post(
                "/api/v1/public/bookings",
                json=payload(employeeId=str(uuid.uuid4()), durationMinutes=30),
            )
        mocks["create"].assert_not_called()


# ---------------------------------------------------------------------------
# Validation tests
# ---------------------------------------------------------------------------

class TestPublicBookingValidation:
    @pytest.mark.parametrize("missing_field", [
        "customerName",
        "customerPhone",
        "date",
        "startTime",
        "employeeId",
        "branchId",
        "serviceIds",
    ])
    async def test_missing_required_field_returns_422(
        self, client: AsyncClient, missing_field: str
    ) -> None:
        p = payload()
        del p[missing_field]
        resp = await client.post("/api/v1/public/bookings", json=p)
        assert resp.status_code == 422

    async def test_empty_service_ids_returns_422(self, client: AsyncClient) -> None:
        resp = await client.post("/api/v1/public/bookings", json=payload(serviceIds=[]))
        assert resp.status_code == 422

    async def test_zero_duration_returns_422(self, client: AsyncClient) -> None:
        resp = await client.post("/api/v1/public/bookings", json=payload(durationMinutes=0))
        assert resp.status_code == 422

    async def test_invalid_date_format_returns_422(self, client: AsyncClient) -> None:
        resp = await client.post("/api/v1/public/bookings", json=payload(date="not-a-date"))
        assert resp.status_code == 422

    async def test_invalid_employee_uuid_returns_422(self, client: AsyncClient) -> None:
        resp = await client.post("/api/v1/public/bookings", json=payload(employeeId="bad-uuid"))
        assert resp.status_code == 422

    async def test_empty_body_returns_422(self, client: AsyncClient) -> None:
        resp = await client.post("/api/v1/public/bookings", json={})
        assert resp.status_code == 422

    async def test_invalid_start_time_returns_422(self, client: AsyncClient) -> None:
        resp = await client.post("/api/v1/public/bookings", json=payload(startTime="25:99:00"))
        assert resp.status_code == 422
