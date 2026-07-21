from datetime import datetime
from uuid import UUID

from pydantic import Field, model_validator

from app.core.constants import ServiceStatus
from app.schemas.base import AppSchema


class ServiceBase(AppSchema):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=500)
    image_url: str | None = Field(default=None, max_length=1000)
    duration_minutes: int = Field(ge=1)
    price: int = Field(ge=0)
    status: ServiceStatus = ServiceStatus.ACTIVE
    is_all_branches: bool = True
    is_featured: bool = False


class ServiceCreate(ServiceBase):
    branch_ids: list[UUID] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_branches(self) -> "ServiceCreate":
        if not self.is_all_branches and not self.branch_ids:
            raise ValueError("branchIds is required when isAllBranches is false")
        return self


class ServiceUpdate(AppSchema):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=500)
    image_url: str | None = Field(default=None, max_length=1000)
    duration_minutes: int | None = Field(default=None, ge=1)
    price: int | None = Field(default=None, ge=0)
    status: ServiceStatus | None = None
    is_all_branches: bool | None = None
    is_featured: bool | None = None
    branch_ids: list[UUID] | None = None


class ServiceRead(ServiceBase):
    id: UUID
    sort_order: int
    branch_ids: list[UUID] = Field(default_factory=list)
    branch_count: int
    total_branches: int
    created_at: datetime
    updated_at: datetime


class ServiceReorder(AppSchema):
    ids: list[UUID] = Field(min_length=1)


class ServiceImageUploadResult(AppSchema):
    image_url: str
