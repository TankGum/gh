"""add commission snapshot columns to booking_service_items

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
Create Date: 2026-07-21 00:00:00.000001
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'b3c4d5e6f7a8'
down_revision: str | None = 'a2b3c4d5e6f7'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'booking_service_items',
        sa.Column('unit_price', sa.BigInteger(), nullable=False, server_default='0'),
    )
    op.add_column(
        'booking_service_items',
        sa.Column('commission_percent', sa.Float(), nullable=False, server_default='0'),
    )
    op.add_column(
        'booking_service_items',
        sa.Column('commission_amount', sa.BigInteger(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_column('booking_service_items', 'commission_amount')
    op.drop_column('booking_service_items', 'commission_percent')
    op.drop_column('booking_service_items', 'unit_price')
