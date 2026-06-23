import asyncio
import io
from functools import lru_cache

import cloudinary
import cloudinary.uploader
from loguru import logger

from app.core.exceptions import BadRequestError
from app.core.settings import get_settings

ALLOWED_CONTENT_TYPES: set[str] = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5MB


@lru_cache
def _configure_cloudinary() -> None:
    s = get_settings()
    cloudinary.config(
        cloud_name=s.cloudinary_cloud_name,
        api_key=s.cloudinary_api_key,
        api_secret=s.cloudinary_api_secret,
        secure=True,
    )


def _extract_public_id(url: str) -> str | None:
    """Trích public_id từ Cloudinary URL để xóa ảnh.

    Ví dụ:
      https://res.cloudinary.com/demo/image/upload/v1234567890/goodhair/branches/abc.jpg
      → goodhair/branches/abc
    """
    try:
        marker = "/upload/"
        idx = url.find(marker)
        if idx == -1:
            return None
        after_upload = url[idx + len(marker):]
        # Bỏ version prefix "v1234567890/"
        if after_upload.startswith("v") and "/" in after_upload:
            version_part, rest = after_upload.split("/", 1)
            if version_part[1:].isdigit():
                after_upload = rest
        # Bỏ phần mở rộng
        dot_idx = after_upload.rfind(".")
        if dot_idx != -1:
            after_upload = after_upload[:dot_idx]
        return after_upload or None
    except Exception:
        return None


def _is_cloudinary_url(url: str | None) -> bool:
    return bool(url and "res.cloudinary.com" in url)


async def upload_image(*, data: bytes, content_type: str | None, folder: str) -> str:
    """Upload ảnh lên Cloudinary, trả về secure URL."""
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise BadRequestError(
            error_code="INVALID_IMAGE_TYPE",
            message_key="errors.image.invalid_type",
            detail={"allowed": sorted(ALLOWED_CONTENT_TYPES)},
        )
    if len(data) > MAX_IMAGE_BYTES:
        raise BadRequestError(
            error_code="IMAGE_TOO_LARGE",
            message_key="errors.image.too_large",
            detail={"maxBytes": MAX_IMAGE_BYTES},
        )

    _configure_cloudinary()

    def _upload() -> str:
        try:
            result = cloudinary.uploader.upload(
                io.BytesIO(data),
                folder=folder,
                resource_type="image",
            )
        except Exception as e:
            raise BadRequestError(
                error_code="IMAGE_UPLOAD_FAILED",
                message_key="errors.image.upload_failed",
                detail={"reason": str(e)},
            ) from e
        return result["secure_url"]

    return await asyncio.to_thread(_upload)


async def delete_cloudinary_image(url: str | None) -> None:
    """Xóa ảnh trên Cloudinary. Không raise nếu xóa thất bại."""
    if not _is_cloudinary_url(url):
        return
    public_id = _extract_public_id(url)  # type: ignore[arg-type]
    if not public_id:
        return

    _configure_cloudinary()

    def _destroy() -> None:
        cloudinary.uploader.destroy(public_id)

    try:
        await asyncio.to_thread(_destroy)
    except Exception as e:
        logger.warning("Cloudinary delete failed for {}: {}", public_id, e)


async def upload_branch_image(*, data: bytes, content_type: str | None) -> str:
    return await upload_image(data=data, content_type=content_type, folder="goodhair/branches")


async def upload_employee_image(*, data: bytes, content_type: str | None) -> str:
    return await upload_image(data=data, content_type=content_type, folder="goodhair/employees")
