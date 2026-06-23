from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.core.constants import ServiceStatus
from app.schemas.service import ServiceCreate


def test_service_create_all_branches_does_not_require_branch_ids() -> None:
    payload = ServiceCreate(
        name="Signature Cut",
        duration_minutes=45,
        price=180000,
        is_all_branches=True,
    )

    assert payload.is_all_branches is True
    assert payload.branch_ids == []
    assert payload.status is ServiceStatus.ACTIVE


def test_service_create_specific_branches_requires_branch_ids() -> None:
    with pytest.raises(ValidationError):
        ServiceCreate(
            name="Hair Color",
            duration_minutes=120,
            price=400000,
            is_all_branches=False,
        )


def test_service_create_with_branch_ids_is_valid() -> None:
    branch_id = uuid4()
    payload = ServiceCreate(
        name="Hair Color",
        duration_minutes=120,
        price=400000,
        is_all_branches=False,
        branch_ids=[branch_id],
    )

    assert payload.branch_ids == [branch_id]


def test_service_create_rejects_negative_price() -> None:
    with pytest.raises(ValidationError):
        ServiceCreate(
            name="Bad",
            duration_minutes=30,
            price=-1,
            is_all_branches=True,
        )


def test_service_create_rejects_zero_duration() -> None:
    with pytest.raises(ValidationError):
        ServiceCreate(
            name="Bad",
            duration_minutes=0,
            price=1000,
            is_all_branches=True,
        )
