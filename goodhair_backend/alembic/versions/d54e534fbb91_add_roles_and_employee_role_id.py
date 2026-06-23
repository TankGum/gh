"""add_roles_and_employee_role_id

Revision ID: d54e534fbb91
Revises: eb70f4c6323a
Create Date: 2026-06-22 10:30:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "d54e534fbb91"
down_revision: str | None = "eb70f4c6323a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "roles",
        sa.Column("name", sa.String(length=128), nullable=False),
        sa.Column("key", sa.String(length=64), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("scope", sa.String(length=128), nullable=True),
        sa.Column("color", sa.String(length=7), nullable=True),
        sa.Column("permissions", sa.JSON(), nullable=False, default=dict),
        sa.Column("is_system", sa.Boolean(), nullable=False, default=False),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("name"),
        sa.UniqueConstraint("key"),
    )

    op.add_column("employees", sa.Column("role_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "fk_employees_role_id",
        "employees",
        "roles",
        ["role_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_employees_role_id", "employees", type_="foreignkey")
    op.drop_column("employees", "role_id")
    op.drop_table("roles")
