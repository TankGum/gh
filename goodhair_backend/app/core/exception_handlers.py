from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from loguru import logger

from app.core.exceptions import AppError


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(
        request: Request,
        exc: AppError,
    ) -> JSONResponse:
        logger.warning(
            "Handled application error: {} {} {}",
            request.method,
            request.url.path,
            exc.error_code,
        )
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "errorCode": exc.error_code,
                "messageKey": exc.message_key,
                "detail": exc.detail,
            },
        )
