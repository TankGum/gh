from time import perf_counter

from loguru import logger
from starlette.types import ASGIApp, Receive, Scope, Send


class AccessLogMiddleware:
    """Pure ASGI middleware — không dùng BaseHTTPMiddleware để tránh xung đột với CORSMiddleware khi có exception."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        started_at = perf_counter()
        status_code = 0

        async def send_wrapper(message: dict) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        finally:
            duration_ms = (perf_counter() - started_at) * 1000
            method = scope.get("method", "")
            path = scope.get("path", "")
            logger.info("{} {} -> {} ({:.2f} ms)", method, path, status_code, duration_ms)
