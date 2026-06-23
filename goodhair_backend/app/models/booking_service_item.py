from uuid import UUID

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PgUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, UUIDPrimaryKeyMixin


class BookingServiceItem(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "booking_service_items"

    booking_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        sa.ForeignKey("bookings.id", ondelete="CASCADE"),
        nullable=False,
    )
    service_id: Mapped[UUID] = mapped_column(
        PgUUID(as_uuid=True),
        sa.ForeignKey("services.id", ondelete="SET NULL"),
        nullable=True,
    )
