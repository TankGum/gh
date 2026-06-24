"""add latitude/longitude to branches

Revision ID: e8c5f2a1d9b8
Revises: 3c8f2a1d9b7e
Create Date: 2026-06-24 10:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "e8c5f2a1d9b8"
down_revision: str | None = "3c8f2a1d9b7e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("branches", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("branches", sa.Column("longitude", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("branches", "longitude")
    op.drop_column("branches", "latitude")
