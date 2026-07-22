import calendar
import datetime
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ActivityAction, PermissionModule
from app.core.exceptions import NotFoundError
from app.core.settings import get_settings
from app.db.repositories.branch import BranchRepository
from app.db.repositories.employee import EmployeeRepository
from app.models.booking import Booking
from app.models.booking_service_item import BookingServiceItem
from app.models.employee import Employee
from app.models.payroll_lock import PayrollLock, PayrollLockEntry
from app.models.role import Role
from app.models.service import Service
from app.schemas.payroll import (
    PayrollDetail,
    PayrollEmployeeSummary,
    PayrollLockStatus,
    PayrollPeriodInfo,
    PayrollServiceBreakdown,
)
from app.services.activity_logs.service import ActivityLogService


def month_range(month: str) -> tuple[datetime.date, datetime.date]:
    """'YYYY-MM' -> (ngày đầu, ngày cuối) của kỳ lương ứng với nhãn tháng này.

    Mặc định (PAYROLL_CUTOFF_DAY=0) = trọn tháng dương lịch, như trước giờ.
    Nếu cấu hình PAYROLL_CUTOFF_DAY=N (1-28) — vd chốt lương giữa tháng ngày
    25 — kỳ lương "tháng X" sẽ là (N+1) tháng trước đến N tháng X, không phải
    1 -> cuối tháng nữa. Đổi biến này không ảnh hưởng các tháng đã chốt
    (PayrollLockEntry đã snapshot cứng), chỉ áp dụng cho tháng tính live.
    """
    year, mon = int(month[:4]), int(month[5:7])
    cutoff = get_settings().payroll_cutoff_day
    if not cutoff:
        last_day = calendar.monthrange(year, mon)[1]
        return datetime.date(year, mon, 1), datetime.date(year, mon, last_day)

    end_day = min(cutoff, calendar.monthrange(year, mon)[1])
    end = datetime.date(year, mon, end_day)
    prev_year, prev_mon = (year - 1, 12) if mon == 1 else (year, mon - 1)
    start_day = min(cutoff + 1, calendar.monthrange(prev_year, prev_mon)[1])
    start = datetime.date(prev_year, prev_mon, start_day)
    return start, end


def compute_payday(period_end: datetime.date) -> datetime.date:
    """Ngày dự kiến chi trả — PAYROLL_PAYDAY của tháng liền sau khi kỳ lương
    kết thúc (thuần hiển thị, không ảnh hưởng cách tính)."""
    settings = get_settings()
    next_year, next_mon = (
        (period_end.year + 1, 1) if period_end.month == 12 else (period_end.year, period_end.month + 1)
    )
    day = min(settings.payroll_payday, calendar.monthrange(next_year, next_mon)[1])
    return datetime.date(next_year, next_mon, day)


class PayrollService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.emp_repo = EmployeeRepository(session)
        self.branch_repo = BranchRepository(session)
        self.activity = ActivityLogService(session)

    # ------------------------------------------------------------------
    # Đọc bảng lương — ưu tiên snapshot đã chốt, nếu chưa chốt thì tính live.
    # ------------------------------------------------------------------

    async def get_summary(
        self,
        *,
        month: str,
        branch_id: UUID | None,
        employee_id: UUID | None,
    ) -> list[PayrollEmployeeSummary]:
        lock = await self._get_lock(month)
        if lock is not None:
            return await self._read_locked_summary(
                lock.id, branch_id=branch_id, employee_id=employee_id
            )
        return await self._compute_summary(
            month=month, branch_id=branch_id, employee_id=employee_id
        )

    async def get_detail(self, *, employee_id: UUID, month: str) -> PayrollDetail:
        lock = await self._get_lock(month)
        if lock is not None:
            detail = await self._read_locked_detail(lock.id, employee_id)
            if detail is None:
                raise NotFoundError(
                    detail={"resource": "payroll", "id": str(employee_id)}
                )
            return detail
        return await self._compute_detail(employee_id=employee_id, month=month)

    # ------------------------------------------------------------------
    # Chốt / mở khoá
    # ------------------------------------------------------------------

    def get_period_info(self, month: str) -> PayrollPeriodInfo:
        start, end = month_range(month)
        return PayrollPeriodInfo(start_date=start, end_date=end, payday=compute_payday(end))

    async def get_lock_status(self, month: str) -> PayrollLockStatus:
        lock = await self._get_lock(month)
        if lock is None:
            return PayrollLockStatus(locked=False)
        locked_by_name = None
        if lock.locked_by_account_id:
            emp = await self.emp_repo.get_by_account_id(lock.locked_by_account_id)
            if emp is not None:
                locked_by_name = emp.display_name or emp.name
        return PayrollLockStatus(
            locked=True, locked_at=lock.created_at, locked_by_name=locked_by_name
        )

    async def lock_month(self, month: str, account_id: UUID) -> None:
        """Snapshot cứng lương của mọi nhân viên (mọi chi nhánh) trong tháng
        — từ giờ sửa giá dịch vụ/% hoa hồng/lương cứng sẽ không ảnh hưởng số
        liệu đã chốt. Gọi lại (chốt lại) sẽ ghi đè bằng số liệu hiện tại."""
        start, end = month_range(month)
        rows = await self._gather_rows(month=month, branch_id=None, employee_id=None)

        existing = await self._get_lock(month)
        is_relock = existing is not None
        if existing is not None:
            await self.session.execute(
                delete(PayrollLockEntry).where(PayrollLockEntry.lock_id == existing.id)
            )
            existing.locked_by_account_id = account_id
            lock = existing
        else:
            lock = PayrollLock(month=month, locked_by_account_id=account_id)
            self.session.add(lock)
            await self.session.flush()

        for emp, role, branch_name, comm_row in rows:
            summary = self._to_summary(emp, role, branch_name, comm_row)
            breakdown = await self._compute_breakdown(
                employee_id=emp.id, start=start, end=end
            )
            self.session.add(
                PayrollLockEntry(
                    lock_id=lock.id,
                    employee_id=emp.id,
                    employee_name=summary.employee_name,
                    role_name=summary.role_name,
                    branch_id=emp.branch_id,
                    branch_name=branch_name,
                    base_salary=summary.base_salary,
                    commission_total=summary.commission_total,
                    total_salary=summary.total_salary,
                    booking_count=summary.booking_count,
                    breakdown=[b.model_dump(mode="json") for b in breakdown],
                )
            )
        await self.session.flush()
        await self.activity.log(
            ActivityAction.UPDATE if is_relock else ActivityAction.CREATE,
            PermissionModule.PAYROLL,
            entity_type="payroll_lock",
            entity_id=lock.id,
            target_label=f"{'Chốt lại' if is_relock else 'Chốt'} lương tháng {month} ({len(rows)} nhân viên)",
        )

    async def unlock_month(self, month: str) -> None:
        lock = await self._get_lock(month)
        if lock is None:
            raise NotFoundError(detail={"resource": "payroll_lock", "id": month})
        lock_id = lock.id
        await self.session.delete(lock)
        await self.session.flush()
        await self.activity.log(
            ActivityAction.DELETE,
            PermissionModule.PAYROLL,
            entity_type="payroll_lock",
            entity_id=lock_id,
            target_label=f"Mở khoá lương tháng {month}",
        )

    # ------------------------------------------------------------------
    # Đọc từ snapshot đã chốt
    # ------------------------------------------------------------------

    async def _get_lock(self, month: str) -> PayrollLock | None:
        return await self.session.scalar(
            select(PayrollLock).where(PayrollLock.month == month)
        )

    async def _read_locked_summary(
        self,
        lock_id: UUID,
        *,
        branch_id: UUID | None,
        employee_id: UUID | None,
    ) -> list[PayrollEmployeeSummary]:
        q = select(PayrollLockEntry).where(PayrollLockEntry.lock_id == lock_id)
        if branch_id is not None:
            q = q.where(PayrollLockEntry.branch_id == branch_id)
        if employee_id is not None:
            q = q.where(PayrollLockEntry.employee_id == employee_id)
        entries = list((await self.session.scalars(q)).all())
        avatar_map = await self._avatar_map([e.employee_id for e in entries])
        results = [
            PayrollEmployeeSummary(
                employee_id=e.employee_id,
                employee_name=e.employee_name,
                avatar_url=avatar_map.get(e.employee_id),
                role_name=e.role_name,
                branch_name=e.branch_name,
                base_salary=e.base_salary,
                commission_total=e.commission_total,
                total_salary=e.total_salary,
                booking_count=e.booking_count,
            )
            for e in entries
        ]
        results.sort(key=lambda r: r.total_salary, reverse=True)
        return results

    async def _read_locked_detail(
        self, lock_id: UUID, employee_id: UUID
    ) -> PayrollDetail | None:
        entry = await self.session.scalar(
            select(PayrollLockEntry).where(
                PayrollLockEntry.lock_id == lock_id,
                PayrollLockEntry.employee_id == employee_id,
            )
        )
        if entry is None:
            return None
        avatar_map = await self._avatar_map([employee_id])
        breakdown = [
            PayrollServiceBreakdown(**item) for item in (entry.breakdown or [])
        ]
        return PayrollDetail(
            employee_id=entry.employee_id,
            employee_name=entry.employee_name,
            avatar_url=avatar_map.get(employee_id),
            role_name=entry.role_name,
            branch_name=entry.branch_name,
            base_salary=entry.base_salary,
            commission_total=entry.commission_total,
            total_salary=entry.total_salary,
            booking_count=entry.booking_count,
            breakdown=breakdown,
        )

    # ------------------------------------------------------------------
    # Tính live (dùng khi tháng chưa chốt, và để tính snapshot lúc chốt)
    # ------------------------------------------------------------------

    async def _gather_rows(
        self,
        *,
        month: str,
        branch_id: UUID | None,
        employee_id: UUID | None,
    ) -> list[tuple[Employee, Role | None, str | None, object]]:
        start, end = month_range(month)
        emp_q = select(Employee).where(Employee.deleted_at.is_(None))
        if branch_id is not None:
            emp_q = emp_q.where(Employee.branch_id == branch_id)
        if employee_id is not None:
            emp_q = emp_q.where(Employee.id == employee_id)
        employees = list((await self.session.scalars(emp_q)).all())
        if not employees:
            return []
        emp_ids = [e.id for e in employees]

        comm_q = (
            select(
                Booking.employee_id,
                func.coalesce(
                    func.sum(BookingServiceItem.commission_amount), 0
                ).label("commission"),
                func.count(func.distinct(Booking.id)).label("booking_count"),
            )
            .join(BookingServiceItem, BookingServiceItem.booking_id == Booking.id)
            .where(
                Booking.deleted_at.is_(None),
                Booking.status == "completed",
                Booking.date >= start,
                Booking.date <= end,
                Booking.employee_id.in_(emp_ids),
            )
            .group_by(Booking.employee_id)
        )
        comm_rows = (await self.session.execute(comm_q)).all()
        comm_map = {r.employee_id: r for r in comm_rows}

        role_map = await self._load_roles(employees)
        branch_map = await self._load_branch_names(employees)

        return [
            (emp, role_map.get(emp.role_id), branch_map.get(emp.branch_id), comm_map.get(emp.id))
            for emp in employees
        ]

    async def _compute_summary(
        self,
        *,
        month: str,
        branch_id: UUID | None,
        employee_id: UUID | None,
    ) -> list[PayrollEmployeeSummary]:
        rows = await self._gather_rows(
            month=month, branch_id=branch_id, employee_id=employee_id
        )
        results = [
            self._to_summary(emp, role, branch_name, comm_row)
            for emp, role, branch_name, comm_row in rows
        ]
        results.sort(key=lambda r: r.total_salary, reverse=True)
        return results

    async def _compute_detail(self, *, employee_id: UUID, month: str) -> PayrollDetail:
        start, end = month_range(month)
        emp = await self.emp_repo.get_by_id(employee_id)
        if emp is None or emp.deleted_at is not None:
            raise NotFoundError(
                detail={"resource": "employee", "id": str(employee_id)}
            )

        role = await self.session.get(Role, emp.role_id) if emp.role_id else None
        branch_name = None
        if emp.branch_id:
            branch = await self.branch_repo.get_by_id(emp.branch_id)
            branch_name = branch.name if branch else None

        breakdown = await self._compute_breakdown(
            employee_id=employee_id, start=start, end=end
        )
        commission_total = sum(b.commission_amount for b in breakdown)

        booking_count = await self.session.scalar(
            select(func.count(func.distinct(Booking.id))).where(
                Booking.deleted_at.is_(None),
                Booking.status == "completed",
                Booking.employee_id == employee_id,
                Booking.date >= start,
                Booking.date <= end,
            )
        ) or 0

        base_salary = role.base_salary if role else 0
        return PayrollDetail(
            employee_id=emp.id,
            employee_name=emp.display_name or emp.name,
            avatar_url=emp.avatar_url,
            role_name=role.name if role else None,
            branch_name=branch_name,
            base_salary=base_salary,
            commission_total=commission_total,
            total_salary=base_salary + commission_total,
            booking_count=booking_count,
            breakdown=breakdown,
        )

    async def _compute_breakdown(
        self, *, employee_id: UUID, start: datetime.date, end: datetime.date
    ) -> list[PayrollServiceBreakdown]:
        q = (
            select(
                BookingServiceItem.service_id,
                func.coalesce(
                    func.sum(BookingServiceItem.commission_amount), 0
                ).label("commission"),
                func.count(BookingServiceItem.id).label("count"),
            )
            .join(Booking, Booking.id == BookingServiceItem.booking_id)
            .where(
                Booking.deleted_at.is_(None),
                Booking.status == "completed",
                Booking.employee_id == employee_id,
                Booking.date >= start,
                Booking.date <= end,
            )
            .group_by(BookingServiceItem.service_id)
        )
        rows = (await self.session.execute(q)).all()

        svc_ids = [r.service_id for r in rows if r.service_id]
        svc_map: dict[UUID, str] = {}
        if svc_ids:
            svcs = await self.session.scalars(
                select(Service).where(Service.id.in_(svc_ids))
            )
            svc_map = {s.id: s.name for s in svcs}

        return [
            PayrollServiceBreakdown(
                service_id=r.service_id,
                service_name=svc_map.get(r.service_id, "N/A") if r.service_id else "N/A",
                count=int(r.count),
                commission_amount=int(r.commission),
            )
            for r in rows
        ]

    async def _avatar_map(self, employee_ids: list[UUID]) -> dict[UUID, str | None]:
        if not employee_ids:
            return {}
        rows = await self.session.scalars(
            select(Employee).where(Employee.id.in_(employee_ids))
        )
        return {e.id: e.avatar_url for e in rows}

    async def _load_roles(self, employees: list[Employee]) -> dict[UUID, Role]:
        role_ids = {e.role_id for e in employees if e.role_id is not None}
        if not role_ids:
            return {}
        roles = await self.session.scalars(select(Role).where(Role.id.in_(role_ids)))
        return {r.id: r for r in roles}

    async def _load_branch_names(self, employees: list[Employee]) -> dict[UUID, str]:
        branch_ids = {e.branch_id for e in employees if e.branch_id is not None}
        if not branch_ids:
            return {}
        branches = await self.branch_repo.list_by_ids(list(branch_ids))
        return {b.id: b.name for b in branches}

    def _to_summary(
        self,
        emp: Employee,
        role: Role | None,
        branch_name: str | None,
        comm_row,
    ) -> PayrollEmployeeSummary:
        base_salary = role.base_salary if role else 0
        commission_total = int(comm_row.commission) if comm_row else 0
        booking_count = int(comm_row.booking_count) if comm_row else 0
        return PayrollEmployeeSummary(
            employee_id=emp.id,
            employee_name=emp.display_name or emp.name,
            avatar_url=emp.avatar_url,
            role_name=role.name if role else None,
            branch_name=branch_name,
            base_salary=base_salary,
            commission_total=commission_total,
            total_salary=base_salary + commission_total,
            booking_count=booking_count,
        )
