from typing import cast
from uuid import UUID

from fastapi import APIRouter, Cookie, Depends, Request, Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_account_id
from app.auth.jwt import refresh_token_expires_seconds
from app.core.constants import AppEnv
from app.core.exceptions import UnauthorizedError
from app.core.settings import get_settings
from app.db.repositories.account import AccountRepository
from app.db.repositories.employee import EmployeeRepository
from app.db.repositories.role import RoleRepository
from app.db.session import get_db_session
from app.schemas.account import AccountRead, MeRead, RoleSummary
from app.schemas.role import PermissionMap
from app.services.auth.service import AuthService

router = APIRouter()


def get_auth_service(session: AsyncSession = Depends(get_db_session)) -> AuthService:
    return AuthService(session=session)


def _set_auth_cookies(
    response: Response, access_token: str, refresh_token: str
) -> None:
    settings = get_settings()
    secure = settings.app_env != AppEnv.LOCAL
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=settings.access_token_expire_minutes * 60,
        samesite="lax",
        secure=secure,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=refresh_token_expires_seconds(),
        samesite="lax",
        secure=secure,
    )


def _clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")


class GoogleLoginRequest(BaseModel):
    id_token: str


@router.post("/google", response_model=AccountRead)
async def login_google(
    payload: GoogleLoginRequest,
    request: Request,
    response: Response,
    service: AuthService = Depends(get_auth_service),
) -> AccountRead:
    client_ip = request.client.host if request.client else None
    account, access_token, raw_refresh = await service.login_with_google(
        payload.id_token, ip_address=client_ip
    )
    _set_auth_cookies(response, access_token, raw_refresh)
    return AccountRead.model_validate(account)


@router.post("/refresh", response_model=AccountRead)
async def refresh(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    service: AuthService = Depends(get_auth_service),
) -> AccountRead:
    if not refresh_token:
        raise UnauthorizedError(message_key="errors.auth.no_token")
    account, access_token, new_refresh = await service.refresh(refresh_token)
    _set_auth_cookies(response, access_token, new_refresh)
    return AccountRead.model_validate(account)


@router.post("/logout")
async def logout(
    response: Response,
    refresh_token: str | None = Cookie(default=None),
    service: AuthService = Depends(get_auth_service),
) -> dict[str, bool]:
    if refresh_token:
        await service.logout(refresh_token)
    _clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me", response_model=MeRead)
async def get_me(
    account_id: UUID = Depends(get_current_account_id),
    session: AsyncSession = Depends(get_db_session),
) -> MeRead:
    account = await AccountRepository(session).get_active_by_id(account_id)
    if account is None:
        raise UnauthorizedError(message_key="errors.auth.not_found")

    me = MeRead.model_validate(account)
    employee = await EmployeeRepository(session).get_by_account_id(account_id)
    if employee is not None and employee.role_id is not None:
        role = await RoleRepository(session).get_by_id(employee.role_id)
        if role is not None and role.deleted_at is None:
            me.role = RoleSummary(id=role.id, name=role.name)
            me.permissions = cast(
                dict[str, PermissionMap], role.permissions or {}
            )
    return me
