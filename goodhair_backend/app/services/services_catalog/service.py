from collections.abc import Sequence
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ActivityAction, PermissionModule, ServiceStatus
from app.core.diff import compute_changes
from app.core.exceptions import BadRequestError, NotFoundError
from app.db.repositories.branch import BranchRepository
from app.db.repositories.service import ServiceRepository
from app.models.branch import Branch
from app.models.service import Service
from app.schemas.base import PageParams
from app.schemas.service import ServiceCreate, ServiceRead, ServiceUpdate
from app.services.activity_logs.labels import SERVICE_LABELS
from app.services.activity_logs.service import ActivityLogService


class ServiceCatalogService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.service_repository = ServiceRepository(session)
        self.branch_repository = BranchRepository(session)
        self.activity = ActivityLogService(session)

    async def list_services(
        self,
        *,
        q: str | None,
        branch_id: UUID | None,
        status: ServiceStatus | None,
        page: PageParams,
    ) -> tuple[list[ServiceRead], int]:
        services = await self.service_repository.list_services(
            q=q,
            branch_id=branch_id,
            status=status,
            offset=page.offset,
            limit=page.size,
        )
        total = await self.service_repository.count_services(
            q=q,
            branch_id=branch_id,
            status=status,
        )
        total_branches = await self.branch_repository.count_active()
        items = [self._to_read(service, total_branches) for service in services]
        return items, total

    async def get_service(self, service_id: UUID) -> ServiceRead:
        service = await self._get_or_404(service_id)
        total_branches = await self.branch_repository.count_active()
        return self._to_read(service, total_branches)

    async def create_service(self, payload: ServiceCreate) -> ServiceRead:
        branches = await self._resolve_branches(
            is_all_branches=payload.is_all_branches,
            branch_ids=payload.branch_ids,
        )
        service = Service(
            name=payload.name,
            description=payload.description,
            duration_minutes=payload.duration_minutes,
            price=payload.price,
            status=payload.status,
            is_all_branches=payload.is_all_branches,
        )
        service.branches = list(branches)
        self.session.add(service)
        await self.session.flush()
        await self.session.refresh(service)

        await self.activity.log(
            ActivityAction.CREATE,
            PermissionModule.SERVICES,
            entity_type="service",
            entity_id=service.id,
            target_label=service.name,
        )
        total_branches = await self.branch_repository.count_active()
        return self._to_read(service, total_branches)

    async def update_service(
        self,
        *,
        service_id: UUID,
        payload: ServiceUpdate,
    ) -> ServiceRead:
        service = await self._get_or_404(service_id)

        scalar_data = payload.model_dump(
            exclude_unset=True,
            exclude={"is_all_branches", "branch_ids"},
        )
        before = {k: getattr(service, k) for k in scalar_data}
        for field, value in scalar_data.items():
            setattr(service, field, value)

        fields_set = payload.model_fields_set
        if "is_all_branches" in fields_set:
            is_all = bool(payload.is_all_branches)
            service.is_all_branches = is_all
            branch_ids = payload.branch_ids or []
            service.branches = list(
                await self._resolve_branches(
                    is_all_branches=is_all,
                    branch_ids=branch_ids,
                ),
            )
        elif "branch_ids" in fields_set:
            service.is_all_branches = False
            service.branches = list(
                await self._resolve_branches(
                    is_all_branches=False,
                    branch_ids=payload.branch_ids or [],
                ),
            )

        await self.session.flush()
        await self.session.refresh(service)

        changes = compute_changes(before, scalar_data, SERVICE_LABELS)
        await self.activity.log(
            ActivityAction.UPDATE,
            PermissionModule.SERVICES,
            entity_type="service",
            entity_id=service.id,
            target_label=service.name,
            changes=changes,
        )
        total_branches = await self.branch_repository.count_active()
        return self._to_read(service, total_branches)

    async def delete_service(self, service_id: UUID) -> None:
        service = await self._get_or_404(service_id)
        await self.service_repository.soft_delete(service)
        await self.activity.log(
            ActivityAction.DELETE,
            PermissionModule.SERVICES,
            entity_type="service",
            entity_id=service.id,
            target_label=service.name,
        )

    async def _get_or_404(self, service_id: UUID) -> Service:
        service = await self.service_repository.get_active_by_id(service_id)
        if service is None:
            raise NotFoundError(
                detail={"resource": "service", "id": str(service_id)},
            )
        return service

    async def _resolve_branches(
        self,
        *,
        is_all_branches: bool,
        branch_ids: Sequence[UUID],
    ) -> Sequence[Branch]:
        if is_all_branches:
            return []

        unique_ids = list(dict.fromkeys(branch_ids))
        if not unique_ids:
            raise BadRequestError(
                error_code="SERVICE_INVALID_BRANCH",
                message_key="errors.service.invalid_branch",
            )

        branches = await self.branch_repository.list_by_ids(unique_ids)
        if len(branches) != len(unique_ids):
            raise BadRequestError(
                error_code="SERVICE_INVALID_BRANCH",
                message_key="errors.service.invalid_branch",
            )
        return branches

    def _to_read(self, service: Service, total_branches: int) -> ServiceRead:
        active_branches = [
            branch for branch in service.branches if branch.deleted_at is None
        ]
        if service.is_all_branches:
            branch_ids: list[UUID] = []
            branch_count = total_branches
        else:
            branch_ids = [branch.id for branch in active_branches]
            branch_count = len(branch_ids)

        return ServiceRead(
            id=service.id,
            name=service.name,
            description=service.description,
            duration_minutes=service.duration_minutes,
            price=service.price,
            status=service.status,
            is_all_branches=service.is_all_branches,
            branch_ids=branch_ids,
            branch_count=branch_count,
            total_branches=total_branches,
            created_at=service.created_at,
            updated_at=service.updated_at,
        )
