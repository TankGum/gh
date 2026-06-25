"""Tests for business logic edge cases that return 400 Bad Request.

Covers:
- Booking: update a completed booking
- Role: update/delete a system role
- Account: approve already-approved, reject already-rejected
- Account: delete not found, reject not found
- Employee: delete not found
"""
import datetime
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.core.constants import AccountStatus, BookingStatus, EmploymentStatus
from app.core.exceptions import BadRequestError, NotFoundError
from app.services.accounts.service import AccountService
from app.services.bookings.service import BookingService
from app.services.employees.service import EmployeeService
from app.services.roles.service import RoleService

FAKE_ID = uuid.uuid4()


# ---------------------------------------------------------------------------
# Factories
# ---------------------------------------------------------------------------

_BOOKING_FIELDS = [
    "id", "code", "customer_name", "customer_phone", "employee_id",
    "branch_id", "date", "start_time", "duration_minutes", "total",
    "status", "service_ids", "deleted_at",
]


def _booking(status: BookingStatus = BookingStatus.PENDING) -> MagicMock:
    b = MagicMock(spec=_BOOKING_FIELDS)
    b.id = FAKE_ID
    b.code = "BK001"
    b.customer_name = "John"
    b.customer_phone = "0901234567"
    b.employee_id = uuid.uuid4()
    b.branch_id = uuid.uuid4()
    b.date = datetime.date.today()
    b.start_time = datetime.time(9, 0)
    b.duration_minutes = 30
    b.total = 100_000
    b.status = status
    b.service_ids = []
    b.deleted_at = None
    return b


def _role(is_system: bool = False) -> MagicMock:
    r = MagicMock()
    r.id = FAKE_ID
    r.name = "System" if is_system else "Barber"
    r.description = None
    r.is_system = is_system
    r.is_bookable = False
    r.employee_count = 0
    r.permissions = {}
    r.deleted_at = None
    return r


_ACCOUNT_FIELDS = ["id", "email", "name", "avatar_url", "status", "requested_at", "created_at", "deleted_at"]
_EMPLOYEE_FIELDS = [
    "id", "account_id", "name", "email", "avatar_url",
    "branch_id", "role_id", "total_bookings", "total_revenue", "status",
]


def _account(status: AccountStatus = AccountStatus.PENDING) -> MagicMock:
    a = MagicMock(spec=_ACCOUNT_FIELDS)
    a.id = FAKE_ID
    a.email = "test@example.com"
    a.name = "Test User"
    a.avatar_url = None
    a.status = status
    a.requested_at = datetime.datetime.now(datetime.timezone.utc)
    a.created_at = datetime.datetime.now(datetime.timezone.utc)
    a.deleted_at = None
    return a


# ---------------------------------------------------------------------------
# Booking business rules
# ---------------------------------------------------------------------------

class TestBookingBusinessRules:
    async def test_update_completed_booking_returns_400(
        self, authed_client: AsyncClient
    ) -> None:
        with patch.object(BookingService, "update", new_callable=AsyncMock) as mock:
            mock.side_effect = BadRequestError(
                message_key="errors.booking.completed",
                detail={"message": "Không thể cập nhật lịch hẹn đã hoàn thành"},
            )
            resp = await authed_client.patch(
                f"/api/v1/bookings/{FAKE_ID}",
                json={"status": "confirmed"},
            )
        assert resp.status_code == 400

    async def test_update_completed_booking_has_error_detail(
        self, authed_client: AsyncClient
    ) -> None:
        with patch.object(BookingService, "update", new_callable=AsyncMock) as mock:
            mock.side_effect = BadRequestError(
                message_key="errors.booking.completed",
                detail={"message": "Không thể cập nhật"},
            )
            resp = await authed_client.patch(
                f"/api/v1/bookings/{FAKE_ID}",
                json={"status": "confirmed"},
            )
        assert "detail" in resp.json()

    async def test_delete_booking_not_found_404(
        self, authed_client: AsyncClient
    ) -> None:
        with patch.object(BookingService, "delete", new_callable=AsyncMock) as mock:
            mock.side_effect = NotFoundError()
            resp = await authed_client.delete(f"/api/v1/bookings/{FAKE_ID}")
        assert resp.status_code == 404

    async def test_update_booking_conflict_409(
        self, authed_client: AsyncClient
    ) -> None:
        from app.core.exceptions import ConflictError
        with patch.object(BookingService, "update", new_callable=AsyncMock) as mock:
            mock.side_effect = ConflictError()
            resp = await authed_client.patch(
                f"/api/v1/bookings/{FAKE_ID}",
                json={"startTime": "10:00:00"},
            )
        assert resp.status_code == 409

    async def test_get_deleted_booking_returns_404(
        self, authed_client: AsyncClient
    ) -> None:
        with patch.object(BookingService, "get_by_id", new_callable=AsyncMock) as mock:
            mock.side_effect = NotFoundError()
            resp = await authed_client.get(f"/api/v1/bookings/{FAKE_ID}")
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Role business rules
# ---------------------------------------------------------------------------

class TestRoleBusinessRules:
    async def test_update_system_role_returns_400(
        self, authed_client: AsyncClient
    ) -> None:
        with patch.object(RoleService, "update", new_callable=AsyncMock) as mock:
            mock.side_effect = BadRequestError(detail={"message": "Cannot edit system role"})
            resp = await authed_client.patch(
                f"/api/v1/roles/{FAKE_ID}",
                json={"name": "Hacked"},
            )
        assert resp.status_code == 400

    async def test_delete_system_role_returns_400(
        self, authed_client: AsyncClient
    ) -> None:
        with patch.object(RoleService, "delete", new_callable=AsyncMock) as mock:
            mock.side_effect = BadRequestError(detail={"message": "Cannot delete system role"})
            resp = await authed_client.delete(f"/api/v1/roles/{FAKE_ID}")
        assert resp.status_code == 400

    async def test_delete_role_not_found_404(
        self, authed_client: AsyncClient
    ) -> None:
        with patch.object(RoleService, "delete", new_callable=AsyncMock) as mock:
            mock.side_effect = NotFoundError()
            resp = await authed_client.delete(f"/api/v1/roles/{FAKE_ID}")
        assert resp.status_code == 404

    async def test_create_role_returns_201_with_permissions_payload(
        self, authed_client: AsyncClient
    ) -> None:
        role = _role()
        with patch.object(RoleService, "create", new_callable=AsyncMock) as mock:
            mock.return_value = role
            resp = await authed_client.post(
                "/api/v1/roles",
                json={
                    "name": "Receptionist",
                    "description": "Front desk",
                    "isBookable": False,
                    "permissions": {
                        "bookings": {"view": True, "create": False, "edit": False, "delete": False}
                    },
                },
            )
        assert resp.status_code == 201


# ---------------------------------------------------------------------------
# Account business rules
# ---------------------------------------------------------------------------

class TestAccountBusinessRules:
    async def test_approve_already_approved_returns_400(
        self, authed_client: AsyncClient
    ) -> None:
        with patch.object(AccountService, "approve", new_callable=AsyncMock) as mock:
            mock.side_effect = BadRequestError(message_key="errors.account.already_approved")
            resp = await authed_client.patch(f"/api/v1/accounts/{FAKE_ID}/approve")
        assert resp.status_code == 400

    async def test_reject_already_rejected_returns_400(
        self, authed_client: AsyncClient
    ) -> None:
        with patch.object(AccountService, "reject", new_callable=AsyncMock) as mock:
            mock.side_effect = BadRequestError(message_key="errors.account.already_rejected")
            resp = await authed_client.patch(f"/api/v1/accounts/{FAKE_ID}/reject")
        assert resp.status_code == 400

    async def test_reject_account_not_found_404(
        self, authed_client: AsyncClient
    ) -> None:
        with patch.object(AccountService, "reject", new_callable=AsyncMock) as mock:
            mock.side_effect = NotFoundError()
            resp = await authed_client.patch(f"/api/v1/accounts/{FAKE_ID}/reject")
        assert resp.status_code == 404

    async def test_delete_account_not_found_404(
        self, authed_client: AsyncClient
    ) -> None:
        with patch.object(AccountService, "delete", new_callable=AsyncMock) as mock:
            mock.side_effect = NotFoundError()
            resp = await authed_client.delete(f"/api/v1/accounts/{FAKE_ID}")
        assert resp.status_code == 404

    async def test_list_accounts_with_status_filter(
        self, authed_client: AsyncClient
    ) -> None:
        acc = _account(AccountStatus.PENDING)
        with patch.object(AccountService, "list_accounts", new_callable=AsyncMock) as mock:
            mock.return_value = ([acc], 1)
            resp = await authed_client.get("/api/v1/accounts?status=pending")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1

    async def test_list_accounts_invalid_status_422(
        self, authed_client: AsyncClient
    ) -> None:
        resp = await authed_client.get("/api/v1/accounts?status=unknown_status")
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Employee business rules
# ---------------------------------------------------------------------------

class TestEmployeeBusinessRules:
    async def test_delete_employee_not_found_404(
        self, authed_client: AsyncClient
    ) -> None:
        with patch.object(EmployeeService, "delete", new_callable=AsyncMock) as mock:
            mock.side_effect = NotFoundError()
            resp = await authed_client.delete(f"/api/v1/employees/{FAKE_ID}")
        assert resp.status_code == 404

    async def test_update_employee_invalid_status_422(
        self, authed_client: AsyncClient
    ) -> None:
        resp = await authed_client.patch(
            f"/api/v1/employees/{FAKE_ID}",
            json={"status": "flying"},
        )
        assert resp.status_code == 422

    async def test_list_employees_filter_by_status(
        self, authed_client: AsyncClient
    ) -> None:
        emp = MagicMock(spec=_EMPLOYEE_FIELDS)
        emp.id = uuid.uuid4()
        emp.account_id = uuid.uuid4()
        emp.name = "Active Barber"
        emp.email = "barber@example.com"
        emp.avatar_url = None
        emp.branch_id = uuid.uuid4()
        emp.role_id = uuid.uuid4()
        emp.total_bookings = 0
        emp.total_revenue = 0
        emp.status = EmploymentStatus.ACTIVE
        with patch.object(EmployeeService, "list_employees", new_callable=AsyncMock) as mock:
            mock.return_value = ([emp], 1)
            resp = await authed_client.get("/api/v1/employees?status=active")
        assert resp.status_code == 200
