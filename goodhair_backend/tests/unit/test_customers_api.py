"""Tests for /api/v1/customers private endpoints."""
import datetime
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.services.customers.service import CustomerService

_CUSTOMER_FIELDS = ["id", "name", "phone", "total_visits", "total_spent", "last_visit_date"]


def _make_customer() -> MagicMock:
    c = MagicMock(spec=_CUSTOMER_FIELDS)
    c.id = uuid.uuid4()
    c.name = "Alice"
    c.phone = "0901234567"
    c.total_visits = 5
    c.total_spent = 500
    c.last_visit_date = datetime.date.today()
    return c


async def test_list_customers_200(authed_client: AsyncClient) -> None:
    customer = _make_customer()
    with patch.object(CustomerService, "list_customers", new_callable=AsyncMock) as mock:
        mock.return_value = ([customer], 1)
        resp = await authed_client.get("/api/v1/customers")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data
    assert data["total"] == 1


async def test_list_customers_with_q_200(authed_client: AsyncClient) -> None:
    customer = _make_customer()
    with patch.object(CustomerService, "list_customers", new_callable=AsyncMock) as mock:
        mock.return_value = ([customer], 1)
        resp = await authed_client.get("/api/v1/customers?q=Alice")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
