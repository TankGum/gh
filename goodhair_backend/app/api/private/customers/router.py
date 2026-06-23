from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import require_permission
from app.core.constants import PermissionAction, PermissionModule
from app.db.session import get_db_session
from app.schemas.base import PageParams, PaginatedResponse
from app.schemas.customer import CustomerRead
from app.services.customers.service import CustomerService

router = APIRouter()


def get_customer_service(session: AsyncSession = Depends(get_db_session)) -> CustomerService:
    return CustomerService(session=session)


@router.get("", response_model=PaginatedResponse[CustomerRead])
async def list_customers(
    q: str | None = Query(default=None),
    page: PageParams = Depends(),
    service: CustomerService = Depends(get_customer_service),
    _: None = Depends(require_permission(PermissionModule.CUSTOMERS, PermissionAction.VIEW)),
) -> PaginatedResponse[CustomerRead]:
    items, total = await service.list_customers(q=q, page=page)
    return PaginatedResponse.create(
        items=[CustomerRead.model_validate(c) for c in items],
        total=total,
        page=page,
    )
