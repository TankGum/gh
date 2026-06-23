from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import ActivityAction, BranchStatus, PermissionModule
from app.core.diff import compute_changes
from app.core.exceptions import NotFoundError
from app.db.repositories.branch import BranchRepository
from app.models.branch import Branch
from app.schemas.base import PageParams
from app.schemas.branch import BranchCreate, BranchRead, BranchUpdate
from app.services.activity_logs.labels import BRANCH_LABELS
from app.services.activity_logs.service import ActivityLogService
from app.utils.image_storage import delete_cloudinary_image


class BranchService:
    def __init__(self, session: AsyncSession) -> None:
        self.branch_repository = BranchRepository(session)
        self.activity = ActivityLogService(session)

    async def list_branches(
        self,
        *,
        q: str | None,
        status: BranchStatus | None,
        page: PageParams,
    ) -> tuple[list[BranchRead], int]:
        branches = await self.branch_repository.list_branches(
            q=q,
            status=status,
            offset=page.offset,
            limit=page.size,
        )
        total = await self.branch_repository.count_branches(q=q, status=status)
        return await self._enrich(list(branches)), total

    async def get_branch(self, branch_id: UUID) -> BranchRead:
        branch = await self._get_or_404(branch_id)
        enriched = await self._enrich([branch])
        return enriched[0]

    async def create_branch(self, payload: BranchCreate) -> BranchRead:
        branch = await self.branch_repository.create(payload.model_dump())
        await self.activity.log(
            ActivityAction.CREATE,
            PermissionModule.BRANCHES,
            entity_type="branch",
            entity_id=branch.id,
            target_label=branch.name,
        )
        enriched = await self._enrich([branch])
        return enriched[0]

    async def update_branch(
        self,
        *,
        branch_id: UUID,
        payload: BranchUpdate,
    ) -> BranchRead:
        branch = await self._get_or_404(branch_id)
        data = payload.model_dump(exclude_unset=True)
        old_image_url = branch.image_url if "image_url" in data else None
        before = {k: getattr(branch, k) for k in data}
        updated = await self.branch_repository.update(branch, data)
        changes = compute_changes(before, data, BRANCH_LABELS)
        await self.activity.log(
            ActivityAction.UPDATE,
            PermissionModule.BRANCHES,
            entity_type="branch",
            entity_id=updated.id,
            target_label=updated.name,
            changes=changes,
        )
        if old_image_url and old_image_url != data.get("image_url"):
            await delete_cloudinary_image(old_image_url)
        enriched = await self._enrich([updated])
        return enriched[0]

    async def delete_branch(self, branch_id: UUID) -> None:
        branch = await self._get_or_404(branch_id)
        image_url = branch.image_url
        await self.branch_repository.soft_delete(branch)
        await self.activity.log(
            ActivityAction.DELETE,
            PermissionModule.BRANCHES,
            entity_type="branch",
            entity_id=branch.id,
            target_label=branch.name,
        )
        await delete_cloudinary_image(image_url)

    async def _enrich(self, branches: list[Branch]) -> list[BranchRead]:
        branch_ids = [b.id for b in branches]
        barber_counts = await self.branch_repository.fetch_barber_counts(branch_ids)
        monthly_revenues = await self.branch_repository.fetch_monthly_revenues(branch_ids)
        return [
            BranchRead.model_validate(b).model_copy(update={
                "barber_count": barber_counts.get(b.id, 0),
                "monthly_revenue": monthly_revenues.get(b.id, 0.0),
            })
            for b in branches
        ]

    async def _get_or_404(self, branch_id: UUID) -> Branch:
        branch = await self.branch_repository.get_active_by_id(branch_id)
        if branch is None:
            raise NotFoundError(detail={"resource": "branch", "id": str(branch_id)})
        return branch
