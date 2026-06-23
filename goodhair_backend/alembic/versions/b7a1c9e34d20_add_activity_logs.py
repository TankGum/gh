"""add activity_logs table

Revision ID: b7a1c9e34d20
Revises: 5d9eb69ad531
Create Date: 2026-06-22 12:10:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "b7a1c9e34d20"
down_revision: str | None = "5d9eb69ad531"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "activity_logs",
        sa.Column("actor_account_id", sa.UUID(), nullable=True),
        sa.Column("actor_name", sa.String(length=256), nullable=False),
        sa.Column("actor_role", sa.String(length=128), nullable=True),
        sa.Column(
            "action",
            sa.Enum(
                "create", "update", "delete", "login", name="activity_action"
            ),
            nullable=False,
        ),
        sa.Column("module", sa.String(length=64), nullable=False),
        sa.Column("entity_type", sa.String(length=64), nullable=True),
        sa.Column("entity_id", sa.UUID(), nullable=True),
        sa.Column("target_label", sa.String(length=512), nullable=False),
        sa.Column(
            "changes",
            postgresql.JSONB(astext_type=sa.Text()),
            server_default="[]",
            nullable=False,
        ),
        sa.Column("ip_address", sa.String(length=64), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_activity_logs_actor_account_id", "activity_logs", ["actor_account_id"]
    )
    op.create_index("ix_activity_logs_action", "activity_logs", ["action"])
    op.create_index("ix_activity_logs_module", "activity_logs", ["module"])
    op.create_index("ix_activity_logs_created_at", "activity_logs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_activity_logs_created_at", table_name="activity_logs")
    op.drop_index("ix_activity_logs_module", table_name="activity_logs")
    op.drop_index("ix_activity_logs_action", table_name="activity_logs")
    op.drop_index(
        "ix_activity_logs_actor_account_id", table_name="activity_logs"
    )
    op.drop_table("activity_logs")
    op.execute("DROP TYPE IF EXISTS activity_action")
