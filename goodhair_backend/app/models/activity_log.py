from datetime import datetime
from typing import Any
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.constants import ActivityAction
from app.models.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ActivityLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "activity_logs"

    actor_account_id: Mapped[UUID | None] = mapped_column(
        PgUUID(as_uuid=True), nullable=True, index=True
    )
    actor_name: Mapped[str] = mapped_column(String(256), nullable=False)
    actor_role: Mapped[str | None] = mapped_column(String(128), nullable=True)
    action: Mapped[ActivityAction] = mapped_column(
        sa.Enum(
            ActivityAction,
            name="activity_action",
            values_callable=lambda x: [e.value for e in x],
        ),
        nullable=False,
        index=True,
    )
    # Key của PermissionModule (vd "bookings") hoặc "system" cho login.
    module: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    entity_type: Mapped[str | None] = mapped_column(String(64), nullable=True)
    entity_id: Mapped[UUID | None] = mapped_column(PgUUID(as_uuid=True), nullable=True)
    target_label: Mapped[str] = mapped_column(String(512), nullable=False)
    # Mảng [{"label": str, "from": str, "to": str}] — rỗng với create/delete/login.
    changes: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list, server_default="[]"
    )
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)

    @property
    def has_changes(self) -> bool:
        return bool(self.changes)
