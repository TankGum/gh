from datetime import datetime, time
from uuid import UUID

from pydantic import Field

from app.core.constants import BranchStatus
from app.schemas.base import AppSchema


class BranchBase(AppSchema):
    name: str = Field(min_length=1, max_length=255)
    code: str | None = Field(default=None, max_length=50)
    address: str | None = Field(default=None, max_length=500)
    image_url: str | None = Field(default=None, max_length=1000)
    opening_time: time | None = None
    closing_time: time | None = None
    rating: float = Field(default=0, ge=0, le=5)
    seat_count: int = Field(default=0, ge=0)
    status: BranchStatus = BranchStatus.OPEN


class BranchCreate(BranchBase):
    pass


class BranchUpdate(AppSchema):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    code: str | None = Field(default=None, max_length=50)
    address: str | None = Field(default=None, max_length=500)
    image_url: str | None = Field(default=None, max_length=1000)
    opening_time: time | None = None
    closing_time: time | None = None
    rating: float | None = Field(default=None, ge=0, le=5)
    seat_count: int | None = Field(default=None, ge=0)
    status: BranchStatus | None = None


class BranchRead(BranchBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    barber_count: int = 0
    monthly_revenue: float = 0


class BranchImageUploadResult(AppSchema):
    image_url: str
