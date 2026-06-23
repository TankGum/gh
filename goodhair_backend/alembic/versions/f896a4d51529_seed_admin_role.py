"""seed admin role

Revision ID: f896a4d51529
Revises: aff5b777a9d6
Create Date: 2026-06-22 17:42:57.630765
"""

import json
import uuid
from datetime import UTC, datetime

import sqlalchemy as sa

from alembic import op

revision: str = "f896a4d51529"
down_revision: str | None = "aff5b777a9d6"
branch_labels = None
depends_on = None

_MODULES = [
    "overview", "bookings", "revenue", "staff", "shifts", "customers",
    "branches", "services", "recruit", "roles", "logs",
]
_ACTIONS = ["view", "create", "edit", "delete"]


def _full_permissions() -> dict:
    return {m: {a: True for a in _ACTIONS} for m in _MODULES}


def upgrade() -> None:
    bind = op.get_bind()
    existing = bind.execute(
        sa.text("SELECT id FROM roles WHERE key = 'admin' AND deleted_at IS NULL")
    ).first()
    if existing is not None:
        return
    now = datetime.now(UTC)
    bind.execute(
        sa.text(
            "INSERT INTO roles "
            "(id, name, key, description, scope, color, permissions, "
            " is_system, created_at, updated_at) "
            "VALUES (:id, :name, :key, :description, :scope, :color, "
            " CAST(:permissions AS JSON), :is_system, :created_at, :updated_at)"
        ),
        {
            "id": str(uuid.uuid4()),
            "name": "Quản trị viên",
            "key": "admin",
            "description": "Toàn quyền hệ thống",
            "scope": None,
            "color": "#EE8A33",
            "permissions": json.dumps(_full_permissions()),
            "is_system": True,
            "created_at": now,
            "updated_at": now,
        },
    )


def downgrade() -> None:
    op.get_bind().execute(sa.text("DELETE FROM roles WHERE key = 'admin'"))
