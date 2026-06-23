import pytest
from pydantic import ValidationError

from app.core.constants import BranchStatus
from app.core.exceptions import BadRequestError
from app.schemas.branch import BranchCreate
from app.utils.image_storage import upload_branch_image


def test_branch_create_defaults() -> None:
    branch = BranchCreate(name="Saigon Centre")

    assert branch.status is BranchStatus.OPEN
    assert branch.rating == 0
    assert branch.image_url is None


def test_branch_create_rejects_rating_above_five() -> None:
    with pytest.raises(ValidationError):
        BranchCreate(name="Bad", rating=9)


def test_branch_create_rejects_negative_rating() -> None:
    with pytest.raises(ValidationError):
        BranchCreate(name="Bad", rating=-1)


@pytest.mark.asyncio
async def test_upload_branch_image_rejects_invalid_content_type() -> None:
    with pytest.raises(BadRequestError) as exc:
        await upload_branch_image(data=b"not an image", content_type="text/plain")

    assert exc.value.error_code == "INVALID_IMAGE_TYPE"


@pytest.mark.asyncio
async def test_upload_branch_image_rejects_too_large() -> None:
    big = b"\x00" * (5 * 1024 * 1024 + 1)
    with pytest.raises(BadRequestError) as exc:
        await upload_branch_image(data=big, content_type="image/png")

    assert exc.value.error_code == "IMAGE_TOO_LARGE"
