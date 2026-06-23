"""Tests for /api/v1/shifts private endpoints."""
import datetime
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.core.constants import ShiftType
from app.services.employee_shifts.service import EmployeeShiftService

_SHIFT_FIELDS = ["employee_id", "date", "shift_type"]


def _make_shift() -> MagicMock:
    s = MagicMock(spec=_SHIFT_FIELDS)
    s.employee_id = uuid.uuid4()
    s.date = datetime.date.today()
    s.shift_type = ShiftType.MORNING
    return s


async def test_list_shifts_200(authed_client: AsyncClient) -> None:
    shift = _make_shift()
    with patch.object(EmployeeShiftService, "list_shifts", new_callable=AsyncMock) as mock:
        mock.return_value = [shift]
        resp = await authed_client.get("/api/v1/shifts")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


async def test_bulk_upsert_shifts_204(authed_client: AsyncClient) -> None:
    emp_id = uuid.uuid4()
    with patch.object(EmployeeShiftService, "bulk_upsert", new_callable=AsyncMock) as mock:
        mock.return_value = None
        resp = await authed_client.put(
            "/api/v1/shifts/bulk",
            json={
                "shifts": [
                    {
                        "employeeId": str(emp_id),
                        "date": "2026-06-22",
                        "shiftType": "morning",
                    }
                ]
            },
        )
    assert resp.status_code == 204


async def test_bulk_upsert_missing_required_fields_422(authed_client: AsyncClient) -> None:
    resp = await authed_client.put(
        "/api/v1/shifts/bulk",
        json={},
    )
    assert resp.status_code == 422
