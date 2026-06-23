import datetime
from uuid import UUID

from app.schemas.base import AppSchema


class KpiCard(AppSchema):
    label: str
    value: str
    delta: str
    delta_positive: bool
    sub: str


class OverviewRevenueItem(AppSchema):
    date: str
    amount: str
    pct: float


class TopBarber(AppSchema):
    id: UUID
    name: str
    initials: str
    avatar_url: str | None = None
    count: int
    pct: float


class TodayBooking(AppSchema):
    time: str
    customer: str
    service: str
    barber: str
    status: str
    badge_style: str


class OverviewResponse(AppSchema):
    kpis: list[KpiCard]
    revenue_7_days: list[OverviewRevenueItem]
    top_barbers: list[TopBarber]
    today_bookings: list[TodayBooking]
