"""Tests for /api/v1/accounts private endpoints."""
import datetime
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.core.constants import AccountStatus
from app.core.exceptions import NotFoundError
from app.services.accounts.service import AccountService

_ACCOUNT_FIELDS = ["id", "email", "name", "avatar_url", "status", "requested_at", "created_at"]


def _make_account() -> MagicMock:
    a = MagicMock(spec=_ACCOUNT_FIELDS)
    a.id = uuid.uuid4()
    a.email = "test@example.com"
    a.name = "Test User"
    a.avatar_url = None
    a.status = AccountStatus.PENDING
    a.requested_at = datetime.datetime.now(datetime.timezone.utc)
    a.created_at = datetime.datetime.now(datetime.timezone.utc)
    return a


async def test_list_accounts_200(authed_client: AsyncClient) -> None:
    account = _make_account()
    with patch.object(AccountService, "list_accounts", new_callable=AsyncMock) as mock:
        mock.return_value = ([account], 1)
        resp = await authed_client.get("/api/v1/accounts")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


async def test_approve_account_200(authed_client: AsyncClient) -> None:
    account = _make_account()
    account.status = AccountStatus.APPROVED
    with patch.object(AccountService, "approve", new_callable=AsyncMock) as mock:
        mock.return_value = account
        resp = await authed_client.patch(f"/api/v1/accounts/{account.id}/approve")
    assert resp.status_code == 200


async def test_reject_account_200(authed_client: AsyncClient) -> None:
    account = _make_account()
    account.status = AccountStatus.REJECTED
    with patch.object(AccountService, "reject", new_callable=AsyncMock) as mock:
        mock.return_value = account
        resp = await authed_client.patch(f"/api/v1/accounts/{account.id}/reject")
    assert resp.status_code == 200


async def test_delete_account_204(authed_client: AsyncClient) -> None:
    account_id = uuid.uuid4()
    with patch.object(AccountService, "delete", new_callable=AsyncMock) as mock:
        mock.return_value = None
        resp = await authed_client.delete(f"/api/v1/accounts/{account_id}")
    assert resp.status_code == 204


async def test_approve_account_not_found_404(authed_client: AsyncClient) -> None:
    account_id = uuid.uuid4()
    with patch.object(AccountService, "approve", new_callable=AsyncMock) as mock:
        mock.side_effect = NotFoundError()
        resp = await authed_client.patch(f"/api/v1/accounts/{account_id}/approve")
    assert resp.status_code == 404
