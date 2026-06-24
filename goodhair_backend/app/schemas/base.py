from datetime import datetime, timezone
from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field, field_serializer


def to_camel(value: str) -> str:
    words = value.split("_")
    return words[0] + "".join(word.capitalize() for word in words[1:])


class AppSchema(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        from_attributes=True,
        populate_by_name=True,
    )

    @field_serializer("*", when_used="json")
    def serialize_datetime(self, value: object) -> object:
        if isinstance(value, datetime):
            return value.astimezone(timezone.utc).isoformat()
        return value


class PageParams(AppSchema):
    page: int = Field(default=1, ge=1)
    size: int = Field(default=20, ge=1, le=100)
    sort_by: str | None = None
    sort_order: Literal["asc", "desc"] = "desc"

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.size


ItemT = TypeVar("ItemT")


class PaginatedResponse(AppSchema, Generic[ItemT]):
    items: list[ItemT]
    total: int
    page: int
    size: int

    @classmethod
    def create(
        cls,
        *,
        items: list[ItemT],
        total: int,
        page: PageParams,
    ) -> "PaginatedResponse[ItemT]":
        return cls(items=items, total=total, page=page.page, size=page.size)
