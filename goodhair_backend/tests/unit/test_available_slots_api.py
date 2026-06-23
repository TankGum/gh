"""API-level tests for GET /api/v1/public/available-slots.

Patches BookingRepository.get_booked_windows so no real DB is needed.
"""

from __future__ import annotations

import datetime
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories.booking import BookingRepository
from app.db.session import get_db_session
from app.main import app


# ---------------------------------------------------------------------------
# DB session override (provides a no-op async session)
# ---------------------------------------------------------------------------

async def _fake_session():
    yield AsyncMock(spec=AsyncSession)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _setup_override() -> None:
    app.dependency_overrides[get_db_session] = _fake_session


def _teardown_override() -> None:
    app.dependency_overrides.pop(get_db_session, None)


@pytest.fixture(autouse=True)
def db_override() -> None:
    _setup_override()
    yield
    _teardown_override()


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

class TestGetAvailableSlots:
    async def test_no_bookings_returns_empty_list(self, client: AsyncClient) -> None:
        with patch.object(BookingRepository, "get_booked_windows", new_callable=AsyncMock) as mock:
            mock.return_value = []
            resp = await client.get(
                "/api/v1/public/available-slots",
                params={"employeeId": str(uuid.uuid4()), "date": datetime.date.today().isoformat()},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "bookedWindows" in data
        assert data["bookedWindows"] == []

    async def test_returns_correct_windows(self, client: AsyncClient) -> None:
        windows = [(540, 60), (660, 30)]  # 09:00 for 60 min, 11:00 for 30 min
        with patch.object(BookingRepository, "get_booked_windows", new_callable=AsyncMock) as mock:
            mock.return_value = windows
            resp = await client.get(
                "/api/v1/public/available-slots",
                params={"employeeId": str(uuid.uuid4()), "date": datetime.date.today().isoformat()},
            )
        assert resp.status_code == 200
        result = resp.json()["bookedWindows"]
        assert len(result) == 2
        starts = {w["startMinutes"] for w in result}
        assert 540 in starts
        assert 660 in starts

    async def test_response_shape(self, client: AsyncClient) -> None:
        with patch.object(BookingRepository, "get_booked_windows", new_callable=AsyncMock) as mock:
            mock.return_value = [(540, 60)]
            resp = await client.get(
                "/api/v1/public/available-slots",
                params={"employeeId": str(uuid.uuid4()), "date": "2026-07-01"},
            )
        assert resp.status_code == 200
        body = resp.json()
        assert set(body.keys()) == {"bookedWindows"}
        for w in body["bookedWindows"]:
            assert set(w.keys()) == {"startMinutes", "durationMinutes"}
            assert isinstance(w["startMinutes"], int)
            assert isinstance(w["durationMinutes"], int)

    async def test_missing_employee_id_returns_422(self, client: AsyncClient) -> None:
        resp = await client.get(
            "/api/v1/public/available-slots",
            params={"date": "2026-07-01"},
        )
        assert resp.status_code == 422

    async def test_missing_date_returns_422(self, client: AsyncClient) -> None:
        resp = await client.get(
            "/api/v1/public/available-slots",
            params={"employeeId": str(uuid.uuid4())},
        )
        assert resp.status_code == 422

    async def test_invalid_employee_id_returns_422(self, client: AsyncClient) -> None:
        resp = await client.get(
            "/api/v1/public/available-slots",
            params={"employeeId": "not-a-uuid", "date": "2026-07-01"},
        )
        assert resp.status_code == 422

    async def test_invalid_date_returns_422(self, client: AsyncClient) -> None:
        resp = await client.get(
            "/api/v1/public/available-slots",
            params={"employeeId": str(uuid.uuid4()), "date": "not-a-date"},
        )
        assert resp.status_code == 422

    async def test_multiple_windows_all_returned(self, client: AsyncClient) -> None:
        # Full morning: 09:00, 10:00, 11:00 each 60 min
        windows = [(540, 60), (600, 60), (660, 60)]
        with patch.object(BookingRepository, "get_booked_windows", new_callable=AsyncMock) as mock:
            mock.return_value = windows
            resp = await client.get(
                "/api/v1/public/available-slots",
                params={"employeeId": str(uuid.uuid4()), "date": "2026-07-15"},
            )
        assert resp.status_code == 200
        assert len(resp.json()["bookedWindows"]) == 3

    async def test_repository_called_with_correct_params(self, client: AsyncClient) -> None:
        emp_id = uuid.uuid4()
        with patch.object(BookingRepository, "get_booked_windows", new_callable=AsyncMock) as mock:
            mock.return_value = []
            await client.get(
                "/api/v1/public/available-slots",
                params={"employeeId": str(emp_id), "date": "2026-08-01"},
            )
        mock.assert_called_once()
        call_kwargs = mock.call_args.kwargs
        assert call_kwargs["employee_id"] == emp_id
        assert call_kwargs["booking_date"] == datetime.date(2026, 8, 1)
