"""Test that all private endpoints return 401 when no auth cookie is present."""
import pytest
from httpx import AsyncClient


PRIVATE_ENDPOINTS = [
    # branches
    ("get", "/branches"),
    ("post", "/branches"),
    ("post", "/branches/image"),
    ("get", "/branches/00000000-0000-0000-0000-000000000001"),
    ("patch", "/branches/00000000-0000-0000-0000-000000000001"),
    ("delete", "/branches/00000000-0000-0000-0000-000000000001"),
    # services
    ("get", "/services"),
    ("post", "/services"),
    ("get", "/services/00000000-0000-0000-0000-000000000001"),
    ("patch", "/services/00000000-0000-0000-0000-000000000001"),
    ("delete", "/services/00000000-0000-0000-0000-000000000001"),
    # bookings
    ("get", "/bookings"),
    ("post", "/bookings"),
    ("get", "/bookings/00000000-0000-0000-0000-000000000001"),
    ("patch", "/bookings/00000000-0000-0000-0000-000000000001"),
    ("delete", "/bookings/00000000-0000-0000-0000-000000000001"),
    # customers
    ("get", "/customers"),
    # roles
    ("get", "/roles"),
    ("post", "/roles"),
    ("patch", "/roles/00000000-0000-0000-0000-000000000001"),
    ("delete", "/roles/00000000-0000-0000-0000-000000000001"),
    # accounts
    ("get", "/accounts"),
    ("patch", "/accounts/00000000-0000-0000-0000-000000000001/approve"),
    ("patch", "/accounts/00000000-0000-0000-0000-000000000001/reject"),
    ("delete", "/accounts/00000000-0000-0000-0000-000000000001"),
    # employees
    ("get", "/employees"),
    ("post", "/employees/image"),
    ("patch", "/employees/00000000-0000-0000-0000-000000000001"),
    ("delete", "/employees/00000000-0000-0000-0000-000000000001"),
    # shifts
    ("get", "/shifts"),
    ("put", "/shifts/bulk"),
    # revenue
    ("get", "/revenue/summary"),
    ("get", "/revenue/daily"),
    ("get", "/revenue/by-branch"),
    ("get", "/revenue/by-service"),
    ("get", "/revenue/by-employee"),
    # logs
    ("get", "/logs"),
    ("get", "/logs/00000000-0000-0000-0000-000000000001"),
]


@pytest.mark.parametrize("method,path", PRIVATE_ENDPOINTS)
async def test_private_endpoint_returns_401_without_cookie(
    client: AsyncClient, method: str, path: str
) -> None:
    resp = await getattr(client, method)("/api/v1" + path)
    assert resp.status_code == 401, (
        f"{method.upper()} /api/v1{path} expected 401, got {resp.status_code}"
    )
