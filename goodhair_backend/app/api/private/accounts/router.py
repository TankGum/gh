from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_permission
from app.core.constants import PermissionAction, PermissionModule
from app.db.session import get_db_session
from app.schemas.account import AccountListParams, AccountRead
from app.schemas.base import PaginatedResponse
from app.services.accounts.service import AccountService

router = APIRouter()


def get_account_service(
    session: AsyncSession = Depends(get_db_session),
) -> AccountService:
    return AccountService(session=session)


@router.get("", response_model=PaginatedResponse[AccountRead])
async def list_accounts(
    params: AccountListParams = Depends(),
    service: AccountService = Depends(get_account_service),
    _: None = Depends(
        require_permission(PermissionModule.ROLES, PermissionAction.VIEW)
    ),
) -> PaginatedResponse[AccountRead]:
    items, total = await service.list_accounts(status=params.status, page=params)
    return PaginatedResponse.create(items=items, total=total, page=params)


@router.patch("/{account_id}/approve", response_model=AccountRead)
async def approve_account(
    account_id: UUID,
    service: AccountService = Depends(get_account_service),
    _: None = Depends(
        require_permission(PermissionModule.ROLES, PermissionAction.EDIT)
    ),
) -> AccountRead:
    account = await service.approve(account_id)
    return AccountRead.model_validate(account)


@router.patch("/{account_id}/reject", response_model=AccountRead)
async def reject_account(
    account_id: UUID,
    service: AccountService = Depends(get_account_service),
    _: None = Depends(
        require_permission(PermissionModule.ROLES, PermissionAction.EDIT)
    ),
) -> AccountRead:
    account = await service.reject(account_id)
    return AccountRead.model_validate(account)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    account_id: UUID,
    service: AccountService = Depends(get_account_service),
    _: None = Depends(
        require_permission(PermissionModule.ROLES, PermissionAction.DELETE)
    ),
) -> None:
    await service.delete(account_id)
