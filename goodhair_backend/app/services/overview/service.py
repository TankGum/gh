import datetime
from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories.customer import CustomerRepository
from app.models.booking import Booking
from app.models.booking_service_item import BookingServiceItem
from app.models.employee import Employee
from app.models.service import Service
from app.schemas.overview import (
    KpiCard,
    OverviewResponse,
    OverviewRevenueItem,
    TodayBooking,
    TopBarber,
)

STATUS_BADGE: dict[str, tuple[str, str]] = {
    "pending": ("rgba(217,190,132,.15)", "#D9BE84"),
    "confirmed": ("rgba(143,180,204,.15)", "#8FB4CC"),
    "completed": ("rgba(95,212,154,.15)", "#5FD49A"),
    "cancelled": ("rgba(198,183,160,.15)", "#C6B7A0"),
}

STATUS_LABEL: dict[str, str] = {
    "pending": "Chờ XN",
    "confirmed": "Đã XN",
    "completed": "Hoàn tất",
    "cancelled": "Đã huỷ",
}


class OverviewService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get_overview(self) -> OverviewResponse:
        today = datetime.date.today()
        week_start = today - datetime.timedelta(days=6)
        prev_week_start = week_start - datetime.timedelta(days=7)
        prev_week_end = week_start - datetime.timedelta(days=1)

        # ── KPIs ──
        # This week completed
        week_completed = await self._fetch_completed(week_start, today)
        week_revenue = sum(b.total for b in week_completed)
        week_count = len(week_completed)

        # Previous week completed
        prev_completed = await self._fetch_completed(prev_week_start, prev_week_end)
        prev_revenue = sum(b.total for b in prev_completed)
        prev_count = len(prev_completed)

        delta_rev = week_revenue - prev_revenue
        delta_bk = week_count - prev_count

        # Active barbers
        barber_count = await self.session.scalar(
            select(func.count()).select_from(Employee).where(
                Employee.status == "active",
                Employee.role_id.isnot(None),
                Employee.deleted_at.is_(None),
            )
        )

        # Total customers
        customer_count = await CustomerRepository(self.session).count()

        kpis = [
            KpiCard(
                label="Doanh thu",
                value=self._fmt_compact(week_revenue),
                delta=self._fmt_delta(delta_rev),
                delta_positive=delta_rev >= 0,
                sub="7 ngày qua",
            ),
            KpiCard(
                label="Lịch hẹn",
                value=str(week_count),
                delta=self._fmt_delta(delta_bk),
                delta_positive=delta_bk >= 0,
                sub="7 ngày qua",
            ),
            KpiCard(
                label="Barber",
                value=str(barber_count or 0),
                delta="",
                delta_positive=True,
                sub="Đang hoạt động",
            ),
            KpiCard(
                label="Khách hàng",
                value=str(customer_count),
                delta="",
                delta_positive=True,
                sub="Tổng số",
            ),
        ]

        # ── Revenue 7 days ──
        raw_daily = await self._fetch_daily_revenue(week_start, today)
        daily_map = {r.date: r for r in raw_daily}
        max_rev = max((r.revenue for r in raw_daily), default=1)
        revenue_7_days = []
        dow_vn = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"]
        cur = week_start
        while cur <= today:
            r = daily_map.get(cur)
            rev = r.revenue if r else 0
            pct = round(rev / max_rev * 100, 1) if max_rev else 0
            revenue_7_days.append(OverviewRevenueItem(
                date=cur.strftime("%d/%m"),
                amount=self._fmt_compact(rev),
                pct=pct,
            ))
            cur += datetime.timedelta(days=1)

        # ── Top barbers ──
        top_barbers = await self._fetch_top_barbers(week_start, today)

        # ── Today's bookings ──
        today_bookings = await self._fetch_today_bookings(today)

        return OverviewResponse(
            kpis=kpis,
            revenue_7_days=revenue_7_days,
            top_barbers=top_barbers,
            today_bookings=today_bookings,
        )

    async def _fetch_completed(
        self, start: datetime.date, end: datetime.date,
    ) -> Sequence[Booking]:
        result = await self.session.scalars(
            select(Booking).where(
                Booking.deleted_at.is_(None),
                Booking.status == "completed",
                Booking.date >= start,
                Booking.date <= end,
            )
        )
        return result.all()

    async def _fetch_daily_revenue(
        self, start: datetime.date, end: datetime.date,
    ) -> Sequence:
        result = await self.session.execute(
            select(
                Booking.date,
                func.coalesce(func.sum(Booking.total), 0).label("revenue"),
            )
            .where(
                Booking.deleted_at.is_(None),
                Booking.status == "completed",
                Booking.date >= start,
                Booking.date <= end,
            )
            .group_by(Booking.date)
            .order_by(Booking.date)
        )
        return result.all()

    async def _fetch_top_barbers(
        self, start: datetime.date, end: datetime.date,
    ) -> list[TopBarber]:
        q = (
            select(
                Booking.employee_id,
                func.count(Booking.id).label("cnt"),
            )
            .where(
                Booking.deleted_at.is_(None),
                Booking.status == "completed",
                Booking.date >= start,
                Booking.date <= end,
                Booking.employee_id.isnot(None),
            )
            .group_by(Booking.employee_id)
            .order_by(func.count(Booking.id).desc())
            .limit(4)
        )
        rows = (await self.session.execute(q)).all()
        total_cnt = sum(r.cnt for r in rows) or 1
        emp_ids = [r.employee_id for r in rows]
        emp_map: dict[UUID, Employee] = {}
        if emp_ids:
            emps = await self.session.scalars(
                select(Employee).where(Employee.id.in_(emp_ids))
            )
            for e in emps:
                emp_map[e.id] = e
        items = []
        for r in rows:
            e = emp_map.get(r.employee_id)
            name = e.name if e else "N/A"
            initials = "".join(p[0] for p in name.split()).upper()[:2] if name else "??"
            items.append(TopBarber(
                id=r.employee_id,
                name=name,
                initials=initials or "??",
                avatar_url=e.avatar_url if e else None,
                count=r.cnt,
                pct=round(r.cnt / total_cnt * 100, 1),
            ))
        return items

    async def _fetch_today_bookings(self, today: datetime.date) -> list[TodayBooking]:
        result = await self.session.execute(
            select(Booking)
            .where(
                Booking.deleted_at.is_(None),
                Booking.date == today,
            )
            .order_by(Booking.start_time)
        )
        bookings = result.scalars().all()

        # load employee names
        emp_ids = {b.employee_id for b in bookings if b.employee_id}
        emp_map: dict[UUID, str] = {}
        if emp_ids:
            emps = await self.session.scalars(
                select(Employee).where(Employee.id.in_(emp_ids))
            )
            for e in emps:
                emp_map[e.id] = e.name

        # load service names
        booking_ids = [b.id for b in bookings]
        svc_map: dict[UUID, list[str]] = {}
        if booking_ids:
            items = await self.session.execute(
                select(BookingServiceItem.booking_id, Service.name)
                .join(Service, Service.id == BookingServiceItem.service_id)
                .where(BookingServiceItem.booking_id.in_(booking_ids))
            )
            for row in items:
                svc_map.setdefault(row.booking_id, []).append(row.name)

        items = []
        for b in bookings:
            svc_names = svc_map.get(b.id, ["—"])
            svc_label = svc_names[0] + (f" +{len(svc_names) - 1}" if len(svc_names) > 1 else "")
            badge_bg, badge_color = STATUS_BADGE.get(b.status.value, ("rgba(100,100,100,.15)", "#888"))
            barber_name = emp_map.get(b.employee_id) or "—"
            items.append(TodayBooking(
                time=b.start_time.strftime("%H:%M"),
                customer=b.customer_name,
                service=svc_label,
                barber=barber_name,
                status=STATUS_LABEL.get(b.status.value, b.status.value),
                badge_style=f"background:{badge_bg};color:{badge_color}",
            ))
        return items

    @staticmethod
    def _fmt_compact(value) -> str:
        return f"{int(value):,}".replace(",", ".") + " VND"

    @staticmethod
    def _fmt_delta(delta: int) -> str:
        if delta > 0:
            return f"+{delta}"
        if delta < 0:
            return str(delta)
        return "0"
