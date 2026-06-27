from datetime import datetime, timedelta, timezone
from uuid import UUID

from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import (
    create_access_token,
    create_refresh_token,
    decode_token,
    refresh_token_expires_seconds,
)
from app.core.constants import AccountStatus, ActivityAction
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.core.settings import get_settings
from app.db.repositories.account import AccountRepository
from app.db.repositories.employee import EmployeeRepository
from app.db.repositories.refresh_token import RefreshTokenRepository
from app.db.repositories.role import RoleRepository
from app.models.account import Account
from app.services.activity_logs.service import ActivityLogService
from app.services.auth.google import verify_google_id_token


class AuthService:
    def __init__(self, session: AsyncSession) -> None:
        self.account_repo = AccountRepository(session)
        self.employee_repo = EmployeeRepository(session)
        self.refresh_token_repo = RefreshTokenRepository(session)
        self.role_repo = RoleRepository(session)
        self.activity = ActivityLogService(session)

    async def login_with_google(
        self, id_token_str: str, *, ip_address: str | None = None
    ) -> tuple[Account, str, str]:
        google_info = verify_google_id_token(id_token_str)
        account = await self.account_repo.get_by_google_id(google_info["google_id"])

        if account is None:
            deleted = await self.account_repo.get_deleted_by_google_id(google_info["google_id"])
            if deleted is not None:
                await self.account_repo.restore(deleted)
                await self.account_repo.update_status(deleted, AccountStatus.PENDING)
                employee = await self.employee_repo.get_deleted_by_account_id(deleted.id)
                if employee is not None:
                    await self.employee_repo.restore(employee)
                await self.account_repo.session.commit()
                account = deleted
            else:
                total = await self.account_repo.count_total()
                status = AccountStatus.APPROVED if total == 0 else AccountStatus.PENDING
                account = await self.account_repo.create(
                    {**google_info, "status": status, "requested_at": datetime.now(timezone.utc)}
                )
                if status == AccountStatus.APPROVED:
                    admin_role = await self.role_repo.get_system_role()
                    await self.employee_repo.create(
                        {
                            "account_id": account.id,
                            "name": account.name,
                            "display_name": account.name,
                            "email": account.email,
                            "avatar_url": account.avatar_url,
                            "role_id": admin_role.id if admin_role else None,
                        }
                    )
                else:
                    await self.account_repo.session.commit()
                    raise ForbiddenError(
                        message_key="errors.auth.pending",
                        detail={"status": "pending"},
                    )

        if account.status == AccountStatus.PENDING:
            raise ForbiddenError(
                message_key="errors.auth.pending",
                detail={"status": "pending"},
            )
        if account.status == AccountStatus.REJECTED:
            raise ForbiddenError(
                message_key="errors.auth.rejected",
                detail={"status": "rejected"},
            )

        access_token, raw_refresh = await self._issue_tokens(account)
        await self.activity.log(
            ActivityAction.LOGIN,
            "system",
            entity_type="account",
            entity_id=account.id,
            target_label=f"Đăng nhập · {account.email}",
            actor_account_id=account.id,
            ip_address=ip_address,
        )
        return account, access_token, raw_refresh

    async def refresh(self, raw_refresh_token: str) -> tuple[Account, str, str]:
        token = await self.refresh_token_repo.get_valid_by_raw(raw_refresh_token)
        if token is None:
            raise UnauthorizedError(message_key="errors.auth.invalid_refresh_token")
        try:
            payload = decode_token(raw_refresh_token)
        except JWTError:
            raise UnauthorizedError(message_key="errors.auth.invalid_refresh_token")
        if payload.get("type") != "refresh":
            raise UnauthorizedError(message_key="errors.auth.invalid_refresh_token")

        account = await self.account_repo.get_active_by_id(token.account_id)
        if account is None or account.status != AccountStatus.APPROVED:
            raise UnauthorizedError(message_key="errors.auth.not_approved")

        await self.refresh_token_repo.revoke(token)
        access_token, raw_refresh = await self._issue_tokens(account)
        return account, access_token, raw_refresh

    async def logout(self, raw_refresh_token: str) -> None:
        token = await self.refresh_token_repo.get_valid_by_raw(raw_refresh_token)
        if token is not None:
            await self.refresh_token_repo.revoke(token)

    async def _issue_tokens(self, account: Account) -> tuple[str, str]:
        access_token = create_access_token(
            subject=str(account.id),
            claims={"email": account.email, "status": account.status.value},
        )
        raw_refresh, token_hash = create_refresh_token(subject=str(account.id))
        settings = get_settings()
        expires_at = datetime.now(timezone.utc) + timedelta(
            days=settings.refresh_token_expire_days
        )
        await self.refresh_token_repo.create(
            {
                "account_id": account.id,
                "token_hash": token_hash,
                "expires_at": expires_at,
            }
        )
        return access_token, raw_refresh
