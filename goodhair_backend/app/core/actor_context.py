"""Lưu thông tin người thao tác (actor) theo từng request qua contextvar.

Được set bởi dependency `bind_actor` (chạy trong task của endpoint nên
contextvar lan tới tầng service), giúp ActivityLogService biết ai đang thao tác
mà không phải đổi chữ ký mọi method service.
"""

import contextvars
from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class ActorInfo:
    account_id: UUID | None = None
    ip_address: str | None = None


_actor_ctx: contextvars.ContextVar[ActorInfo] = contextvars.ContextVar(
    "actor_ctx", default=ActorInfo()
)


def set_actor(account_id: UUID | None, ip_address: str | None = None) -> None:
    _actor_ctx.set(ActorInfo(account_id=account_id, ip_address=ip_address))


def get_actor() -> ActorInfo:
    return _actor_ctx.get()
