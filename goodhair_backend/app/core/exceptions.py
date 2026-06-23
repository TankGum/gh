from http import HTTPStatus


class AppError(Exception):
    status_code: int = HTTPStatus.BAD_REQUEST
    error_code: str = "APP_ERROR"
    message_key: str = "errors.app"

    def __init__(
        self,
        *,
        message_key: str | None = None,
        error_code: str | None = None,
        status_code: int | None = None,
        detail: dict[str, object] | None = None,
    ) -> None:
        self.message_key = message_key or self.message_key
        self.error_code = error_code or self.error_code
        self.status_code = status_code or self.status_code
        self.detail = detail or {}
        super().__init__(self.message_key)


class NotFoundError(AppError):
    status_code = HTTPStatus.NOT_FOUND
    error_code = "NOT_FOUND"
    message_key = "errors.not_found"


class BadRequestError(AppError):
    status_code = HTTPStatus.BAD_REQUEST
    error_code = "BAD_REQUEST"
    message_key = "errors.bad_request"


class UnauthorizedError(AppError):
    status_code = HTTPStatus.UNAUTHORIZED
    error_code = "UNAUTHORIZED"
    message_key = "errors.unauthorized"


class ForbiddenError(AppError):
    status_code = HTTPStatus.FORBIDDEN
    error_code = "FORBIDDEN"
    message_key = "errors.forbidden"


class ConflictError(AppError):
    status_code = HTTPStatus.CONFLICT
    error_code = "CONFLICT"
    message_key = "errors.conflict"
