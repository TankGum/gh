import uuid
from collections.abc import AsyncIterator
from unittest.mock import AsyncMock

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_account_id, get_current_permissions
from app.core.constants import PermissionAction, PermissionModule
from app.db.session import get_db_session
from app.main import app

FAKE_ACCOUNT_ID = uuid.uuid4()

ALL_PERMISSIONS = {
    module.value: {action.value: True for action in PermissionAction}
    for module in PermissionModule
}


async def _fake_db_session() -> AsyncIterator[AsyncMock]:
    yield AsyncMock(spec=AsyncSession)


@pytest.fixture
async def client() -> AsyncIterator[AsyncClient]:
    async with AsyncClient(app=app, base_url="http://test") as test_client:
        yield test_client


@pytest.fixture
async def authed_client() -> AsyncIterator[AsyncClient]:
    app.dependency_overrides[get_current_permissions] = lambda: ALL_PERMISSIONS
    app.dependency_overrides[get_current_account_id] = lambda: FAKE_ACCOUNT_ID
    app.dependency_overrides[get_db_session] = _fake_db_session

    async with AsyncClient(app=app, base_url="http://test") as test_client:
        yield test_client

    app.dependency_overrides.pop(get_current_permissions, None)
    app.dependency_overrides.pop(get_current_account_id, None)
    app.dependency_overrides.pop(get_db_session, None)
