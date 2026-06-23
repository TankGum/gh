"""Tests for /api/v1/logs private endpoints."""
import datetime
import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient

from app.core.constants import ActivityAction
from app.services.activity_logs.service import ActivityLogService

_LOG_FIELDS = [
    "id", "created_at", "actor_name", "actor_role", "action", "module",
    "entity_type", "target_label", "has_changes",
    "entity_id", "ip_address", "changes",
]


def _make_log() -> MagicMock:
    log = MagicMock(spec=_LOG_FIELDS)
    log.id = uuid.uuid4()
    log.created_at = datetime.datetime.now(datetime.timezone.utc)
    log.actor_name = "Admin"
    log.actor_role = "admin"
    log.action = ActivityAction.CREATE
    log.module = "branches"
    log.entity_type = "branch"
    log.target_label = "Main Branch"
    log.has_changes = False
    log.entity_id = uuid.uuid4()
    log.ip_address = "127.0.0.1"
    log.changes = []
    return log


async def test_list_logs_200(authed_client: AsyncClient) -> None:
    log = _make_log()
    with patch.object(ActivityLogService, "list_logs", new_callable=AsyncMock) as mock:
        mock.return_value = ([log], 1)
        resp = await authed_client.get("/api/v1/logs")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert "total" in data


async def test_get_log_200(authed_client: AsyncClient) -> None:
    log = _make_log()
    with patch.object(ActivityLogService, "get_log", new_callable=AsyncMock) as mock:
        mock.return_value = log
        resp = await authed_client.get(f"/api/v1/logs/{log.id}")
    assert resp.status_code == 200


async def test_get_log_not_found_404(authed_client: AsyncClient) -> None:
    log_id = uuid.uuid4()
    with patch.object(ActivityLogService, "get_log", new_callable=AsyncMock) as mock:
        mock.return_value = None
        resp = await authed_client.get(f"/api/v1/logs/{log_id}")
    assert resp.status_code == 404
