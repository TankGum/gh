import datetime
from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.repositories.booking import BookingRepository
from app.db.repositories.booking_service_item import BookingServiceItemRepository
from app.models.booking import Booking
from app.models.booking_service_item import BookingServiceItem
from app.models.employee import Employee
from app.models.service import Service
from app.schemas.revenue import (
    RevenueByBranch,
    RevenueByEmployee,
    RevenueByService,
    RevenueDailyItem,
    RevenueSummary,
)


class RevenueService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.repo = BookingRepository(session)
        self.svc_item_repo = BookingServiceItemRepository(session)

    async def get_summary(
        self,
        start_date: datetime.date,
        end_date: datetime.date,
    ) -> RevenueSummary:
        bookings = await self.repo.list_bookings(
            date_filter=None,
            start_date=start_date,
            end_date=end_date,
            status=None,
        )
        completed = [b for b in bookings if b.status.value == "completed"]
        total_revenue = sum(b.total for b in completed)
        total_bookings = len(completed)
        avg_booking_value = total_revenue // total_bookings if total_bookings else 0

        prev_end = start_date - datetime.timedelta(days=1)
        prev_start = prev_end - (end_date - start_date)
        prev = await self.repo.list_bookings(
            date_filter=None,
            start_date=prev_start,
            end_date=prev_end,
            status=None,
        )
        prev_completed = [b for b in prev if b.status.value == "completed"]
        prev_revenue = sum(b.total for b in prev_completed)
        prev_count = len(prev_completed)

        return RevenueSummary(
            total_revenue=total_revenue,
            total_bookings=total_bookings,
            avg_booking_value=avg_booking_value,
            delta_revenue=total_revenue - prev_revenue,
            delta_bookings=total_bookings - prev_count,
        )

    async def get_daily(
        self,
        start_date: datetime.date,
        end_date: datetime.date,
    ) -> list[RevenueDailyItem]:
        q = (
            select(
                Booking.date,
                func.coalesce(func.sum(Booking.total), 0).label("revenue"),
                func.count(Booking.id).label("count"),
            )
            .where(
                Booking.deleted_at.is_(None),
                Booking.status == "completed",
                Booking.date >= start_date,
                Booking.date <= end_date,
            )
            .group_by(Booking.date)
            .order_by(Booking.date)
        )
        result = await self.session.execute(q)
        rows = result.all()
        mapped = {r.date: r for r in rows}
        items = []
        cur = start_date
        while cur <= end_date:
            r = mapped.get(cur)
            items.append(
                RevenueDailyItem(
                    date=cur,
                    revenue=r.revenue if r else 0,
                    count=r.count if r else 0,
                )
            )
            cur += datetime.timedelta(days=1)
        return items

    async def get_by_branch(
        self,
        start_date: datetime.date,
        end_date: datetime.date,
    ) -> list[RevenueByBranch]:
        q = (
            select(
                Booking.branch_id,
                func.coalesce(func.sum(Booking.total), 0).label("revenue"),
                func.count(Booking.id).label("count"),
            )
            .where(
                Booking.deleted_at.is_(None),
                Booking.status == "completed",
                Booking.date >= start_date,
                Booking.date <= end_date,
                Booking.branch_id.isnot(None),
            )
            .group_by(Booking.branch_id)
            .order_by(func.sum(Booking.total).desc())
        )
        result = await self.session.execute(q)
        rows = result.all()
        total_rev = sum(r.revenue for r in rows) or 1
        from app.db.repositories.branch import BranchRepository
        branch_repo = BranchRepository(self.session)
        branches = await branch_repo.list_branches(offset=0, limit=100)
        branch_map = {b.id: b.name for b in branches}
        return [
            RevenueByBranch(
                branch_id=r.branch_id,
                branch_name=branch_map.get(r.branch_id, "N/A"),
                revenue=r.revenue,
                count=r.count,
                pct=round(r.revenue / total_rev * 100, 1),
            )
            for r in rows
        ]

    async def get_by_service(
        self,
        start_date: datetime.date,
        end_date: datetime.date,
    ) -> list[RevenueByService]:
        q = (
            select(
                BookingServiceItem.service_id,
                func.coalesce(func.sum(Service.price), 0).label("revenue"),
                func.count(BookingServiceItem.id).label("count"),
            )
            .join(Booking, Booking.id == BookingServiceItem.booking_id)
            .join(Service, Service.id == BookingServiceItem.service_id)
            .where(
                Booking.deleted_at.is_(None),
                Booking.status == "completed",
                Booking.date >= start_date,
                Booking.date <= end_date,
                BookingServiceItem.service_id.isnot(None),
            )
            .group_by(BookingServiceItem.service_id)
            .order_by(func.sum(Service.price).desc())
        )
        result = await self.session.execute(q)
        rows = result.all()
        total_rev = sum(r.revenue for r in rows) or 1
        svc_ids = [r.service_id for r in rows if r.service_id]
        svc_map = {}
        if svc_ids:
            svcs = await self.session.scalars(
                select(Service).where(Service.id.in_(svc_ids))
            )
            svc_map = {s.id: s.name for s in svcs}
        return [
            RevenueByService(
                service_id=r.service_id,
                service_name=svc_map.get(r.service_id, "N/A"),
                revenue=r.revenue,
                count=r.count,
                pct=round(r.revenue / total_rev * 100, 1),
            )
            for r in rows
        ]

    async def get_by_employee(
        self,
        start_date: datetime.date,
        end_date: datetime.date,
    ) -> list[RevenueByEmployee]:
        q = (
            select(
                Booking.employee_id,
                func.coalesce(func.sum(Booking.total), 0).label("revenue"),
                func.count(Booking.id).label("count"),
            )
            .where(
                Booking.deleted_at.is_(None),
                Booking.status == "completed",
                Booking.date >= start_date,
                Booking.date <= end_date,
                Booking.employee_id.isnot(None),
            )
            .group_by(Booking.employee_id)
            .order_by(func.sum(Booking.total).desc())
        )
        result = await self.session.execute(q)
        rows = result.all()
        total_rev = sum(r.revenue for r in rows) or 1
        emp_ids = [r.employee_id for r in rows if r.employee_id]
        emp_map = {}
        branch_map = {}
        if emp_ids:
            emps = await self.session.scalars(
                select(Employee).where(Employee.id.in_(emp_ids))
            )
            for e in emps:
                emp_map[e.id] = e
                if e.branch_id:
                    from app.db.repositories.branch import BranchRepository
                    branch_repo = BranchRepository(self.session)
                    b = await branch_repo.get_by_id(e.branch_id)
                    branch_map[e.id] = b.name if b else None
        return [
            RevenueByEmployee(
                employee_id=r.employee_id,
                employee_name=emp_map.get(r.employee_id).name if emp_map.get(r.employee_id) else "N/A",
                branch_name=branch_map.get(r.employee_id),
                avatar_url=emp_map.get(r.employee_id).avatar_url if emp_map.get(r.employee_id) else None,
                revenue=r.revenue,
                count=r.count,
                pct=round(r.revenue / total_rev * 100, 1),
            )
            for r in rows
        ]
