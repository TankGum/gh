"""Extended tests for public catalog endpoints not covered elsewhere:
  GET /api/v1/public/stats
  GET /api/v1/public/top-customers
"""
import datetime
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db_session
from app.main import app
from app.services.customers.service import CustomerService


# ---------------------------------------------------------------------------
# DB session that returns integers from scalar() (needed for /stats)
# ---------------------------------------------------------------------------

def _make_stats_session(count: int = 3) -> AsyncMock:
    mock = AsyncMock(spec=AsyncSession)
    mock.scalar = AsyncMock(return_value=count)
    return mock


async def _fake_stats_session():
    yield _make_stats_session()


@pytest.fixture(autouse=True)
def db_override():
    app.dependency_overrides[get_db_session] = _fake_stats_session
    yield
    app.dependency_overrides.pop(get_db_session, None)


# ---------------------------------------------------------------------------
# Factories
# ---------------------------------------------------------------------------

_CUSTOMER_FIELDS = ["id", "name", "total_visits", "last_visit_date"]


def _make_customer() -> MagicMock:
    c = MagicMock(spec=_CUSTOMER_FIELDS)
    c.id = uuid.uuid4()
    c.name = "Nguyen Van A"
    c.total_visits = 10
    c.last_visit_date = datetime.date.today()
    return c


# ---------------------------------------------------------------------------
# /public/stats
# ---------------------------------------------------------------------------

class TestPublicStats:
    async def test_stats_200(self, client: AsyncClient) -> None:
        resp = await client.get("/api/v1/public/stats")
        assert resp.status_code == 200

    async def test_stats_response_fields(self, client: AsyncClient) -> None:
        resp = await client.get("/api/v1/public/stats")
        body = resp.json()
        for field in ("branches", "services", "barbers", "customers", "yearsInBusiness", "contactPhone"):
            assert field in body, f"Missing field: {field}"

    async def test_stats_numeric_fields_are_integers(self, client: AsyncClient) -> None:
        resp = await client.get("/api/v1/public/stats")
        body = resp.json()
        assert isinstance(body["branches"], int)
        assert isinstance(body["services"], int)
        assert isinstance(body["barbers"], int)
        assert isinstance(body["customers"], int)
        assert isinstance(body["yearsInBusiness"], int)

    async def test_stats_years_in_business_positive(self, client: AsyncClient) -> None:
        resp = await client.get("/api/v1/public/stats")
        assert resp.json()["yearsInBusiness"] >= 1

    async def test_stats_contact_phone_is_string(self, client: AsyncClient) -> None:
        resp = await client.get("/api/v1/public/stats")
        assert isinstance(resp.json()["contactPhone"], str)
        assert len(resp.json()["contactPhone"]) > 0

    async def test_stats_db_counts_reflected(self, client: AsyncClient) -> None:
        async def _session_returning_7():
            yield _make_stats_session(count=7)

        app.dependency_overrides[get_db_session] = _session_returning_7
        resp = await client.get("/api/v1/public/stats")
        app.dependency_overrides[get_db_session] = _fake_stats_session
        body = resp.json()
        assert body["branches"] == 7
        assert body["services"] == 7
        assert body["barbers"] == 7

    async def test_stats_no_auth_required(self, client: AsyncClient) -> None:
        resp = await client.get("/api/v1/public/stats")
        assert resp.status_code != 401

    async def test_stats_zero_counts_valid(self, client: AsyncClient) -> None:
        async def _zero_session():
            yield _make_stats_session(count=0)

        app.dependency_overrides[get_db_session] = _zero_session
        resp = await client.get("/api/v1/public/stats")
        app.dependency_overrides[get_db_session] = _fake_stats_session
        assert resp.status_code == 200
        body = resp.json()
        assert body["branches"] == 0
        assert body["services"] == 0
        assert body["barbers"] == 0


# ---------------------------------------------------------------------------
# /public/top-customers
# ---------------------------------------------------------------------------

class TestPublicTopCustomers:
    async def test_top_customers_200(self, client: AsyncClient) -> None:
        with patch.object(CustomerService, "list_top_customers", new_callable=AsyncMock) as mock:
            mock.return_value = []
            resp = await client.get("/api/v1/public/top-customers")
        assert resp.status_code == 200

    async def test_top_customers_returns_list(self, client: AsyncClient) -> None:
        with patch.object(CustomerService, "list_top_customers", new_callable=AsyncMock) as mock:
            mock.return_value = []
            resp = await client.get("/api/v1/public/top-customers")
        assert isinstance(resp.json(), list)

    async def test_top_customers_items_have_correct_fields(self, client: AsyncClient) -> None:
        c = _make_customer()
        with patch.object(CustomerService, "list_top_customers", new_callable=AsyncMock) as mock:
            mock.return_value = [c]
            resp = await client.get("/api/v1/public/top-customers")
        items = resp.json()
        assert len(items) == 1
        item = items[0]
        assert "id" in item
        assert "name" in item
        assert "totalVisits" in item

    async def test_top_customers_no_revenue_exposed(self, client: AsyncClient) -> None:
        c = _make_customer()
        with patch.object(CustomerService, "list_top_customers", new_callable=AsyncMock) as mock:
            mock.return_value = [c]
            resp = await client.get("/api/v1/public/top-customers")
        item = resp.json()[0]
        assert "totalSpent" not in item
        assert "phone" not in item

    async def test_top_customers_default_limit_12(self, client: AsyncClient) -> None:
        with patch.object(CustomerService, "list_top_customers", new_callable=AsyncMock) as mock:
            mock.return_value = []
            await client.get("/api/v1/public/top-customers")
        mock.assert_called_once_with(limit=12)

    async def test_top_customers_custom_limit(self, client: AsyncClient) -> None:
        with patch.object(CustomerService, "list_top_customers", new_callable=AsyncMock) as mock:
            mock.return_value = []
            await client.get("/api/v1/public/top-customers?limit=5")
        mock.assert_called_once_with(limit=5)

    async def test_top_customers_limit_too_high_422(self, client: AsyncClient) -> None:
        resp = await client.get("/api/v1/public/top-customers?limit=51")
        assert resp.status_code == 422

    async def test_top_customers_limit_zero_422(self, client: AsyncClient) -> None:
        resp = await client.get("/api/v1/public/top-customers?limit=0")
        assert resp.status_code == 422

    async def test_top_customers_limit_negative_422(self, client: AsyncClient) -> None:
        resp = await client.get("/api/v1/public/top-customers?limit=-1")
        assert resp.status_code == 422

    async def test_top_customers_limit_boundary_max(self, client: AsyncClient) -> None:
        with patch.object(CustomerService, "list_top_customers", new_callable=AsyncMock) as mock:
            mock.return_value = []
            resp = await client.get("/api/v1/public/top-customers?limit=50")
        assert resp.status_code == 200

    async def test_top_customers_limit_boundary_min(self, client: AsyncClient) -> None:
        with patch.object(CustomerService, "list_top_customers", new_callable=AsyncMock) as mock:
            mock.return_value = []
            resp = await client.get("/api/v1/public/top-customers?limit=1")
        assert resp.status_code == 200

    async def test_top_customers_no_auth_required(self, client: AsyncClient) -> None:
        with patch.object(CustomerService, "list_top_customers", new_callable=AsyncMock) as mock:
            mock.return_value = []
            resp = await client.get("/api/v1/public/top-customers")
        assert resp.status_code != 401
