from datetime import datetime
from typing import Any
from uuid import UUID

from app.core.constants import ActivityAction
from app.schemas.base import AppSchema, PageParams


class ActivityLogListItem(AppSchema):
    """Bản ghi cho API list — không kèm diff (changes) để payload nhẹ."""

    id: UUID
    created_at: datetime
    actor_name: str
    actor_role: str | None = None
    action: ActivityAction
    module: str
    entity_type: str | None = None
    target_label: str
    has_changes: bool = False


class ActivityLogRead(ActivityLogListItem):
    """Bản ghi chi tiết — kèm diff (gọi khi bấm xem chi tiết)."""

    entity_id: UUID | None = None
    # Mỗi phần tử là {"label": str, "from": str, "to": str}.
    changes: list[dict[str, Any]] = []


class ActivityLogListParams(PageParams):
    action: ActivityAction | None = None
    module: str | None = None
    q: str | None = None
    date_from: datetime | None = None
    date_to: datetime | None = None
