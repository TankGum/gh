from uuid import UUID

from app.core.constants import EmploymentStatus
from app.schemas.base import AppSchema, PageParams


class EmployeeRead(AppSchema):
    id: UUID
    account_id: UUID
    name: str
    display_name: str | None = None
    email: str
    avatar_url: str | None
    branch_id: UUID | None
    role_id: UUID | None
    total_bookings: int = 0
    total_revenue: int = 0
    status: EmploymentStatus = EmploymentStatus.ACTIVE


class EmployeeListParams(PageParams):
    branch_id: UUID | None = None
    role_id: UUID | None = None
    status: EmploymentStatus | None = None


class EmployeeUpdate(AppSchema):
    display_name: str | None = None
    branch_id: UUID | None = None
    role_id: UUID | None = None
    status: EmploymentStatus | None = None
    avatar_url: str | None = None


class EmployeeImageUploadResult(AppSchema):
    image_url: str
