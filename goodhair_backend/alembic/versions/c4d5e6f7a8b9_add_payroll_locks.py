"""add payroll_locks and payroll_lock_entries

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-07-22 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'c4d5e6f7a8b9'
down_revision: str | None = 'b3c4d5e6f7a8'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'payroll_locks',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('month', sa.String(length=7), nullable=False, unique=True),
        sa.Column(
            'locked_by_account_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('accounts.id', ondelete='SET NULL'),
            nullable=True,
        ),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            onupdate=sa.func.now(),
        ),
    )
    op.create_table(
        'payroll_lock_entries',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            'lock_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('payroll_locks.id', ondelete='CASCADE'),
            nullable=False,
        ),
        sa.Column('employee_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('employee_name', sa.String(length=256), nullable=False),
        sa.Column('role_name', sa.String(length=128), nullable=True),
        sa.Column('branch_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('branch_name', sa.String(length=255), nullable=True),
        sa.Column('base_salary', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('commission_total', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('total_salary', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('booking_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('breakdown', sa.JSON(), nullable=False, server_default='[]'),
    )
    op.create_index(
        'ix_payroll_lock_entries_lock_id', 'payroll_lock_entries', ['lock_id']
    )
    op.create_index(
        'ix_payroll_lock_entries_employee_id', 'payroll_lock_entries', ['employee_id']
    )


def downgrade() -> None:
    op.drop_index('ix_payroll_lock_entries_employee_id', table_name='payroll_lock_entries')
    op.drop_index('ix_payroll_lock_entries_lock_id', table_name='payroll_lock_entries')
    op.drop_table('payroll_lock_entries')
    op.drop_table('payroll_locks')
