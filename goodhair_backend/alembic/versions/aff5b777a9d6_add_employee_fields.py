"""add_employee_fields (total_bookings, total_revenue, status)

Revision ID: aff5b777a9d6
Revises: d54e534fbb91
Create Date: 2026-06-22 11:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "aff5b777a9d6"
down_revision: str | None = "d54e534fbb91"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE TYPE employment_status AS ENUM ('active', 'inactive')")
    op.add_column("employees", sa.Column("total_bookings", sa.Integer(), nullable=False, server_default=sa.text("0")))
    op.add_column("employees", sa.Column("total_revenue", sa.BigInteger(), nullable=False, server_default=sa.text("0")))
    op.add_column("employees", sa.Column("status", sa.Enum("active", "inactive", name="employment_status"), nullable=False, server_default="active"))


def downgrade() -> None:
    op.drop_column("employees", "status")
    op.drop_column("employees", "total_revenue")
    op.drop_column("employees", "total_bookings")
    op.execute("DROP TYPE IF EXISTS employment_status")
