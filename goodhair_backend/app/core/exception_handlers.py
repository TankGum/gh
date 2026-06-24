from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from loguru import logger

from app.core.exceptions import AppError

_MESSAGES: dict[str, dict[str, str]] = {
    "errors.conflict": {
        "vi": "Barber đã có lịch trong khung giờ này",
        "en": "The barber already has a booking in this time slot",
    },
    "errors.not_found": {
        "vi": "Không tìm thấy dữ liệu",
        "en": "Resource not found",
    },
    "errors.bad_request": {
        "vi": "Yêu cầu không hợp lệ",
        "en": "Invalid request",
    },
    "errors.unauthorized": {
        "vi": "Không có quyền truy cập",
        "en": "Unauthorized",
    },
    "errors.forbidden": {
        "vi": "Bạn không có quyền thực hiện hành động này",
        "en": "You do not have permission to perform this action",
    },
}


def _resolve_lang(request: Request) -> str:
    header = request.headers.get("Accept-Language", "vi")
    lang = header.split(",")[0].split("-")[0].strip().lower()
    return lang if lang in ("vi", "en") else "vi"


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
        lang = _resolve_lang(request)
        detail: dict[str, object] = {}
        translations = _MESSAGES.get(exc.message_key)
        if translations:
            detail["message"] = translations.get(lang) or translations.get("vi", "")
        detail.update(exc.detail)
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "errorCode": exc.error_code,
                "messageKey": exc.message_key,
                "detail": detail,
            },
        )
