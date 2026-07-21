"""add image_url to services

Revision ID: c4d8e91f2a37
Revises: a1ea2354e72b
Create Date: 2026-07-09 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa



revision: str = 'c4d8e91f2a37'
down_revision: str | None = 'a1ea2354e72b'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('services', sa.Column('image_url', sa.String(length=1000), nullable=True))


def downgrade() -> None:
    op.drop_column('services', 'image_url')
