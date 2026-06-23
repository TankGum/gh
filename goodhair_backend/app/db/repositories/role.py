from collections.abc import Sequence
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import joinedload

from app.db.repositories.base import BaseRepository
from app.models.employee import Employee
from app.models.role import Role


class RoleRepository(BaseRepository[Role]):
    model = Role

    async def list_roles(self, offset: int = 0, limit: int = 20) -> Sequence[Role]:
        q = (
            select(Role)
            .where(Role.deleted_at.is_(None))
            .order_by(Role.created_at.asc())
            .offset(offset)
            .limit(limit)
        )
        result = await self.session.scalars(q)
        return result.all()

    async def count_roles(self) -> int:
        result = await self.session.scalar(
            select(func.count()).select_from(Role).where(Role.deleted_at.is_(None))
        )
        return int(result or 0)

    async def get_system_role(self) -> Role | None:
        result = await self.session.scalar(
            select(Role).where(Role.is_system.is_(True), Role.deleted_at.is_(None))
        )
        return result

    async def get_employee_count(self, role_id: UUID) -> int:
        result = await self.session.scalar(
            select(func.count())
            .select_from(Employee)
            .where(Employee.role_id == role_id, Employee.deleted_at.is_(None))
        )
        return int(result or 0)
