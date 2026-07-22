"""add base_salary and commission_rates to roles

Revision ID: a2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-07-21 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'a2b3c4d5e6f7'
down_revision: str | None = 'f1a2b3c4d5e6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'roles',
        sa.Column('base_salary', sa.BigInteger(), nullable=False, server_default='0'),
    )
    op.add_column(
        'roles',
        sa.Column(
            'commission_rates',
            sa.JSON(),
            nullable=False,
            server_default='{}',
        ),
    )


def downgrade() -> None:
    op.drop_column('roles', 'commission_rates')
    op.drop_column('roles', 'base_salary')
