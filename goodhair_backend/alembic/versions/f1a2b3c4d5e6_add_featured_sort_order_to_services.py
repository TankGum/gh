"""add is_featured and sort_order to services

Revision ID: f1a2b3c4d5e6
Revises: c4d8e91f2a37
Create Date: 2026-07-21 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'f1a2b3c4d5e6'
down_revision: str | None = 'c4d8e91f2a37'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'services',
        sa.Column(
            'is_featured',
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )
    op.add_column(
        'services',
        sa.Column(
            'sort_order',
            sa.Integer(),
            nullable=False,
            server_default='0',
        ),
    )
    # Khởi tạo sort_order theo thứ tự tạo (mới nhất lên đầu) để giữ nguyên
    # thứ tự hiển thị hiện có trước khi admin kéo-thả sắp xếp lại.
    op.execute(
        """
        WITH ordered AS (
            SELECT id, ROW_NUMBER() OVER (ORDER BY created_at DESC) - 1 AS rn
            FROM services
            WHERE deleted_at IS NULL
        )
        UPDATE services s
        SET sort_order = ordered.rn
        FROM ordered
        WHERE s.id = ordered.id
        """
    )


def downgrade() -> None:
    op.drop_column('services', 'sort_order')
    op.drop_column('services', 'is_featured')
