"""Extended booking tests: filter params, pagination, response body correctness,
service_ids, and status transitions.
"""
import datetime
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.core.constants import BookingStatus
from app.services.bookings.service import BookingService

BRANCH_ID = uuid.uuid4()
EMPLOYEE_ID = uuid.uuid4()
SVC_ID_1 = uuid.uuid4()
SVC_ID_2 = uuid.uuid4()

_BOOKING_FIELDS = [
    "id", "code", "customer_name", "customer_phone", "employee_id",
    "branch_id", "date", "start_time", "duration_minutes", "total",
    "status", "service_ids",
]


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------

def _booking(
    status: BookingStatus = BookingStatus.PENDING,
    with_services: bool = False,
) -> MagicMock:
    b = MagicMock(spec=_BOOKING_FIELDS)
    b.id = uuid.uuid4()
    b.code = "BK-001"
    b.customer_name = "Nguyen Van A"
    b.customer_phone = "0901234567"
    b.employee_id = EMPLOYEE_ID
    b.branch_id = BRANCH_ID
    b.date = datetime.date(2026, 7, 1)
    b.start_time = datetime.time(9, 0)
    b.duration_minutes = 30
    b.total = 150_000
    b.status = status
    b.service_ids = [SVC_ID_1, SVC_ID_2] if with_services else []
    return b


# ---------------------------------------------------------------------------
# List bookings — filter params
# ---------------------------------------------------------------------------

class TestListBookingsFilters:
    async def test_list_with_date_filter(self, authed_client: AsyncClient) -> None:
        b = _booking()
        with (
            patch.object(BookingService, "list_bookings", new_callable=AsyncMock) as mock_list,
            patch.object(BookingService, "load_service_ids", new_callable=AsyncMock) as mock_sids,
        ):
            mock_list.return_value = ([b], 1)
            mock_sids.return_value = []
            resp = await authed_client.get("/api/v1/bookings?date=2026-07-01")
        assert resp.status_code == 200
        _, kwargs = mock_list.call_args
        assert kwargs["date_filter"] == datetime.date(2026, 7, 1)

    async def test_list_with_status_filter(self, authed_client: AsyncClient) -> None:
        b = _booking(status=BookingStatus.CONFIRMED)
        with (
            patch.object(BookingService, "list_bookings", new_callable=AsyncMock) as mock_list,
            patch.object(BookingService, "load_service_ids", new_callable=AsyncMock) as mock_sids,
        ):
            mock_list.return_value = ([b], 1)
            mock_sids.return_value = []
            resp = await authed_client.get("/api/v1/bookings?status=confirmed")
        assert resp.status_code == 200
        _, kwargs = mock_list.call_args
        assert kwargs["status"] == BookingStatus.CONFIRMED

    async def test_list_with_branch_filter(self, authed_client: AsyncClient) -> None:
        b = _booking()
        with (
            patch.object(BookingService, "list_bookings", new_callable=AsyncMock) as mock_list,
            patch.object(BookingService, "load_service_ids", new_callable=AsyncMock) as mock_sids,
        ):
            mock_list.return_value = ([b], 1)
            mock_sids.return_value = []
            resp = await authed_client.get(f"/api/v1/bookings?branchId={BRANCH_ID}")
        assert resp.status_code == 200
        _, kwargs = mock_list.call_args
        assert kwargs["branch_id"] == BRANCH_ID

    async def test_list_with_employee_filter(self, authed_client: AsyncClient) -> None:
        b = _booking()
        with (
            patch.object(BookingService, "list_bookings", new_callable=AsyncMock) as mock_list,
            patch.object(BookingService, "load_service_ids", new_callable=AsyncMock) as mock_sids,
        ):
            mock_list.return_value = ([b], 1)
            mock_sids.return_value = []
            resp = await authed_client.get(f"/api/v1/bookings?employeeId={EMPLOYEE_ID}")
        assert resp.status_code == 200
        _, kwargs = mock_list.call_args
        assert kwargs["employee_id"] == EMPLOYEE_ID

    async def test_list_with_date_range(self, authed_client: AsyncClient) -> None:
        b = _booking()
        with (
            patch.object(BookingService, "list_bookings", new_callable=AsyncMock) as mock_list,
            patch.object(BookingService, "load_service_ids", new_callable=AsyncMock) as mock_sids,
        ):
            mock_list.return_value = ([b], 1)
            mock_sids.return_value = []
            resp = await authed_client.get("/api/v1/bookings?startDate=2026-07-01&endDate=2026-07-31")
        assert resp.status_code == 200
        _, kwargs = mock_list.call_args
        assert kwargs["start_date"] == datetime.date(2026, 7, 1)
        assert kwargs["end_date"] == datetime.date(2026, 7, 31)

    async def test_list_invalid_status_422(self, authed_client: AsyncClient) -> None:
        resp = await authed_client.get("/api/v1/bookings?status=invalid_status")
        assert resp.status_code == 422

    async def test_list_invalid_date_422(self, authed_client: AsyncClient) -> None:
        resp = await authed_client.get("/api/v1/bookings?date=not-a-date")
        assert resp.status_code == 422

    async def test_list_invalid_branch_id_422(self, authed_client: AsyncClient) -> None:
        resp = await authed_client.get("/api/v1/bookings?branchId=not-a-uuid")
        assert resp.status_code == 422

    async def test_list_empty_result_200(self, authed_client: AsyncClient) -> None:
        with (
            patch.object(BookingService, "list_bookings", new_callable=AsyncMock) as mock_list,
            patch.object(BookingService, "load_service_ids", new_callable=AsyncMock) as mock_sids,
        ):
            mock_list.return_value = ([], 0)
            mock_sids.return_value = []
            resp = await authed_client.get("/api/v1/bookings")
        assert resp.status_code == 200
        assert resp.json()["total"] == 0
        assert resp.json()["items"] == []


# ---------------------------------------------------------------------------
# Response body correctness
# ---------------------------------------------------------------------------

class TestBookingResponseBody:
    async def test_create_response_contains_required_fields(
        self, authed_client: AsyncClient
    ) -> None:
        b = _booking()
        with (
            patch.object(BookingService, "create", new_callable=AsyncMock) as mock_create,
            patch.object(BookingService, "load_service_ids", new_callable=AsyncMock) as mock_sids,
        ):
            mock_create.return_value = b
            mock_sids.return_value = []
            resp = await authed_client.post(
                "/api/v1/bookings",
                json={
                    "customerName": "Nguyen Van A",
                    "customerPhone": "0901234567",
                    "date": "2026-07-01",
                    "startTime": "09:00:00",
                },
            )
        assert resp.status_code == 201
        body = resp.json()
        for field in ("id", "code", "customerName", "customerPhone", "date", "startTime", "status", "serviceIds"):
            assert field in body, f"Missing field: {field}"

    async def test_get_response_contains_service_ids(
        self, authed_client: AsyncClient
    ) -> None:
        b = _booking(with_services=True)
        with (
            patch.object(BookingService, "get_by_id", new_callable=AsyncMock) as mock_get,
            patch.object(BookingService, "load_service_ids", new_callable=AsyncMock) as mock_sids,
        ):
            mock_get.return_value = b
            mock_sids.return_value = [SVC_ID_1, SVC_ID_2]
            resp = await authed_client.get(f"/api/v1/bookings/{b.id}")
        body = resp.json()
        assert "serviceIds" in body
        assert len(body["serviceIds"]) == 2

    async def test_list_response_pagination_fields(
        self, authed_client: AsyncClient
    ) -> None:
        b = _booking()
        with (
            patch.object(BookingService, "list_bookings", new_callable=AsyncMock) as mock_list,
            patch.object(BookingService, "load_service_ids", new_callable=AsyncMock) as mock_sids,
        ):
            mock_list.return_value = ([b], 1)
            mock_sids.return_value = []
            resp = await authed_client.get("/api/v1/bookings")
        body = resp.json()
        assert "items" in body
        assert "total" in body
        assert "page" in body
        assert "size" in body

    async def test_create_with_service_ids_passes_them(
        self, authed_client: AsyncClient
    ) -> None:
        b = _booking(with_services=True)
        with (
            patch.object(BookingService, "create", new_callable=AsyncMock) as mock_create,
            patch.object(BookingService, "load_service_ids", new_callable=AsyncMock) as mock_sids,
        ):
            mock_create.return_value = b
            mock_sids.return_value = [SVC_ID_1, SVC_ID_2]
            resp = await authed_client.post(
                "/api/v1/bookings",
                json={
                    "customerName": "Nguyen Van A",
                    "customerPhone": "0901234567",
                    "date": "2026-07-01",
                    "startTime": "09:00:00",
                    "serviceIds": [str(SVC_ID_1), str(SVC_ID_2)],
                },
            )
        assert resp.status_code == 201
        create_payload = mock_create.call_args[0][0]
        assert len(create_payload.service_ids) == 2

    async def test_update_status_to_completed(
        self, authed_client: AsyncClient
    ) -> None:
        b = _booking(status=BookingStatus.COMPLETED)
        with (
            patch.object(BookingService, "update", new_callable=AsyncMock) as mock_update,
            patch.object(BookingService, "load_service_ids", new_callable=AsyncMock) as mock_sids,
        ):
            mock_update.return_value = b
            mock_sids.return_value = []
            resp = await authed_client.patch(
                f"/api/v1/bookings/{b.id}",
                json={"status": "completed"},
            )
        assert resp.status_code == 200
        assert resp.json()["status"] == "completed"

    async def test_update_status_to_cancelled(
        self, authed_client: AsyncClient
    ) -> None:
        b = _booking(status=BookingStatus.CANCELLED)
        with (
            patch.object(BookingService, "update", new_callable=AsyncMock) as mock_update,
            patch.object(BookingService, "load_service_ids", new_callable=AsyncMock) as mock_sids,
        ):
            mock_update.return_value = b
            mock_sids.return_value = []
            resp = await authed_client.patch(
                f"/api/v1/bookings/{b.id}",
                json={"status": "cancelled"},
            )
        assert resp.status_code == 200

    async def test_booking_status_invalid_422(
        self, authed_client: AsyncClient
    ) -> None:
        resp = await authed_client.patch(
            f"/api/v1/bookings/{uuid.uuid4()}",
            json={"status": "flying"},
        )
        assert resp.status_code == 422

    async def test_list_booking_item_has_all_fields(
        self, authed_client: AsyncClient
    ) -> None:
        b = _booking()
        with (
            patch.object(BookingService, "list_bookings", new_callable=AsyncMock) as mock_list,
            patch.object(BookingService, "load_service_ids", new_callable=AsyncMock) as mock_sids,
        ):
            mock_list.return_value = ([b], 1)
            mock_sids.return_value = []
            resp = await authed_client.get("/api/v1/bookings")
        item = resp.json()["items"][0]
        for field in ("id", "code", "customerName", "customerPhone", "date", "startTime", "status", "total", "durationMinutes"):
            assert field in item, f"Missing field: {field}"


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

class TestBookingPagination:
    async def test_custom_page_size(self, authed_client: AsyncClient) -> None:
        with (
            patch.object(BookingService, "list_bookings", new_callable=AsyncMock) as mock_list,
            patch.object(BookingService, "load_service_ids", new_callable=AsyncMock) as mock_sids,
        ):
            mock_list.return_value = ([], 0)
            mock_sids.return_value = []
            resp = await authed_client.get("/api/v1/bookings?page=1&size=5")
        assert resp.status_code == 200
        body = resp.json()
        assert body["size"] == 5

    async def test_page_2(self, authed_client: AsyncClient) -> None:
        with (
            patch.object(BookingService, "list_bookings", new_callable=AsyncMock) as mock_list,
            patch.object(BookingService, "load_service_ids", new_callable=AsyncMock) as mock_sids,
        ):
            mock_list.return_value = ([], 0)
            mock_sids.return_value = []
            resp = await authed_client.get("/api/v1/bookings?page=2&size=10")
        assert resp.status_code == 200
        assert resp.json()["page"] == 2

    async def test_create_invalid_uuid_in_service_ids_422(
        self, authed_client: AsyncClient
    ) -> None:
        resp = await authed_client.post(
            "/api/v1/bookings",
            json={
                "customerName": "A",
                "customerPhone": "0901234567",
                "date": "2026-07-01",
                "startTime": "09:00:00",
                "serviceIds": ["not-a-uuid"],
            },
        )
        assert resp.status_code == 422
