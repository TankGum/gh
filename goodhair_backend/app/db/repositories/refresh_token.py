import hashlib
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select

from app.db.repositories.base import BaseRepository
from app.models.refresh_token import RefreshToken


class RefreshTokenRepository(BaseRepository[RefreshToken]):
    model = RefreshToken

    @staticmethod
    def hash_token(raw: str) -> str:
        return hashlib.sha256(raw.encode()).hexdigest()

    async def get_valid_by_raw(self, raw_token: str) -> RefreshToken | None:
        token_hash = self.hash_token(raw_token)
        return await self.session.scalar(
            select(RefreshToken).where(
                RefreshToken.token_hash == token_hash,
                RefreshToken.revoked_at.is_(None),
                RefreshToken.expires_at > datetime.now(timezone.utc),
            )
        )

    async def revoke(self, token: RefreshToken) -> None:
        token.revoked_at = datetime.now(timezone.utc)
        await self.session.flush()

    async def revoke_all_for_account(self, account_id: UUID) -> None:
        tokens = await self.session.scalars(
            select(RefreshToken).where(
                RefreshToken.account_id == account_id,
                RefreshToken.revoked_at.is_(None),
            )
        )
        now = datetime.now(timezone.utc)
        for token in tokens.all():
            token.revoked_at = now
        await self.session.flush()
