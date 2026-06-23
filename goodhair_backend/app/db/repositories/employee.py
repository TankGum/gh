from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select

from app.core.constants import EmploymentStatus
from app.db.repositories.base import BaseRepository
from app.models.employee import Employee
from app.models.role import Role


class EmployeeRepository(BaseRepository[Employee]):
    model = Employee

    async def get_by_account_id(self, account_id: UUID) -> Employee | None:
        return await self.session.scalar(
            select(Employee).where(
                Employee.account_id == account_id,
                Employee.deleted_at.is_(None),
            )
        )

    async def list_employees(
        self,
        *,
        branch_id: UUID | None = None,
        role_id: UUID | None = None,
        status: EmploymentStatus | None = None,
        bookable_only: bool = False,
        offset: int = 0,
        limit: int = 20,
    ) -> Sequence[Employee]:
        q = select(Employee).where(Employee.deleted_at.is_(None))
        if bookable_only:
            q = q.join(Role, Employee.role_id == Role.id).where(
                Role.is_bookable.is_(True), Role.deleted_at.is_(None)
            )
        if branch_id is not None:
            q = q.where(Employee.branch_id == branch_id)
        if role_id is not None:
            q = q.where(Employee.role_id == role_id)
        if status is not None:
            q = q.where(Employee.status == status)
        q = q.order_by(Employee.created_at.desc()).offset(offset).limit(limit)
        result = await self.session.scalars(q)
        return result.all()

    async def count_employees(
        self,
        *,
        branch_id: UUID | None = None,
        role_id: UUID | None = None,
        status: EmploymentStatus | None = None,
        bookable_only: bool = False,
    ) -> int:
        q = select(func.count()).select_from(Employee).where(Employee.deleted_at.is_(None))
        if bookable_only:
            q = q.join(Role, Employee.role_id == Role.id).where(
                Role.is_bookable.is_(True), Role.deleted_at.is_(None)
            )
        if branch_id is not None:
            q = q.where(Employee.branch_id == branch_id)
        if role_id is not None:
            q = q.where(Employee.role_id == role_id)
        if status is not None:
            q = q.where(Employee.status == status)
        result = await self.session.scalar(q)
        return int(result or 0)
