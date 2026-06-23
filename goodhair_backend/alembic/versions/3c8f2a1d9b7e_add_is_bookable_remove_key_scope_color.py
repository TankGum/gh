"""add is_bookable remove key scope color from roles

Revision ID: 3c8f2a1d9b7e
Revises: f896a4d51529
Create Date: 2026-06-23 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "3c8f2a1d9b7e"
down_revision: str | None = "b7a1c9e34d20"
branch_labels: str | Sequence[str] | None = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "roles",
        sa.Column("is_bookable", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    # Tự động đánh dấu các role có tên chứa "barber" là bookable
    op.get_bind().execute(
        sa.text("UPDATE roles SET is_bookable = true WHERE LOWER(name) LIKE '%barber%'")
    )
    op.drop_constraint("roles_key_key", "roles", type_="unique")
    op.drop_column("roles", "key")
    op.drop_column("roles", "scope")
    op.drop_column("roles", "color")


def downgrade() -> None:
    op.add_column("roles", sa.Column("color", sa.String(length=7), nullable=True))
    op.add_column("roles", sa.Column("scope", sa.String(length=128), nullable=True))
    op.add_column("roles", sa.Column("key", sa.String(length=64), nullable=True))
    op.drop_column("roles", "is_bookable")
