"""Unit tests for booking-related schemas (no DB required)."""

import datetime

import pytest
from pydantic import ValidationError

from app.schemas.booking import BookingCreate, BookingUpdate
from app.schemas.public import (
    PublicAvailableSlotsResponse,
    PublicBookedWindow,
    PublicBookingCreate,
    PublicBookingRead,
)


class TestPublicBookingCreate:
    def test_minimal_valid(self) -> None:
        b = PublicBookingCreate(
            customer_name="Nguyen Van A",
            customer_phone="0901234567",
            date=datetime.date(2026, 7, 1),
            start_time=datetime.time(9, 0),
        )
        assert b.duration_minutes == 0
        assert b.total == 0
        assert b.employee_id is None
        assert b.branch_id is None
        assert b.service_ids == []

    def test_full_valid(self) -> None:
        import uuid
        emp_id = uuid.uuid4()
        b = PublicBookingCreate(
            customer_name="Test",
            customer_phone="0912345678",
            employee_id=emp_id,
            date=datetime.date(2026, 8, 15),
            start_time=datetime.time(14, 30),
            duration_minutes=60,
            total=150000,
            service_ids=[uuid.uuid4()],
        )
        assert b.employee_id == emp_id
        assert b.duration_minutes == 60
        assert b.total == 150000
        assert len(b.service_ids) == 1

    def test_missing_customer_name_raises(self) -> None:
        with pytest.raises(ValidationError):
            PublicBookingCreate(  # type: ignore[call-arg]
                customer_phone="09x",
                date=datetime.date.today(),
                start_time=datetime.time(9, 0),
            )

    def test_missing_date_raises(self) -> None:
        with pytest.raises(ValidationError):
            PublicBookingCreate(  # type: ignore[call-arg]
                customer_name="A",
                customer_phone="09x",
                start_time=datetime.time(9, 0),
            )

    def test_invalid_date_format_raises(self) -> None:
        with pytest.raises(ValidationError):
            PublicBookingCreate(
                customer_name="A",
                customer_phone="09x",
                date="not-a-date",  # type: ignore[arg-type]
                start_time=datetime.time(9, 0),
            )


class TestPublicBookedWindow:
    def test_valid(self) -> None:
        w = PublicBookedWindow(start_minutes=540, duration_minutes=60)
        assert w.start_minutes == 540
        assert w.duration_minutes == 60

    def test_zero_duration_allowed(self) -> None:
        w = PublicBookedWindow(start_minutes=0, duration_minutes=0)
        assert w.duration_minutes == 0


class TestPublicAvailableSlotsResponse:
    def test_empty(self) -> None:
        r = PublicAvailableSlotsResponse(booked_windows=[])
        assert r.booked_windows == []

    def test_multiple_windows(self) -> None:
        r = PublicAvailableSlotsResponse(
            booked_windows=[
                PublicBookedWindow(start_minutes=540, duration_minutes=60),
                PublicBookedWindow(start_minutes=660, duration_minutes=30),
            ]
        )
        assert len(r.booked_windows) == 2
        assert r.booked_windows[0].start_minutes == 540

    def test_serialization_camel_case(self) -> None:
        r = PublicAvailableSlotsResponse(
            booked_windows=[PublicBookedWindow(start_minutes=540, duration_minutes=60)]
        )
        data = r.model_dump(by_alias=True)
        assert "bookedWindows" in data
        assert data["bookedWindows"][0]["startMinutes"] == 540
        assert data["bookedWindows"][0]["durationMinutes"] == 60


class TestBookingCreate:
    def test_valid_minimal(self) -> None:
        import uuid
        b = BookingCreate(
            customer_name="A",
            customer_phone="09x",
            date=datetime.date.today(),
            start_time=datetime.time(10, 0),
            duration_minutes=30,
            total=0,
        )
        assert b.employee_id is None
        assert b.service_ids == []

    def test_requires_date(self) -> None:
        with pytest.raises(ValidationError):
            BookingCreate(  # type: ignore[call-arg]
                customer_name="A",
                customer_phone="09",
                start_time=datetime.time(10, 0),
                duration_minutes=30,
                total=0,
            )


class TestBookingUpdate:
    def test_all_optional(self) -> None:
        # BookingUpdate should allow empty payload
        u = BookingUpdate()
        assert u.model_dump(exclude_unset=True) == {}

    def test_partial_update(self) -> None:
        import uuid
        u = BookingUpdate(employee_id=uuid.uuid4())
        dumped = u.model_dump(exclude_unset=True, exclude={"service_ids"})
        assert "employee_id" in dumped
        assert "date" not in dumped


class TestPublicBookingRead:
    def test_valid(self) -> None:
        r = PublicBookingRead(
            code="GH-0001",
            customer_name="Test",
            date=datetime.date(2026, 7, 1),
            start_time=datetime.time(9, 0),
        )
        assert r.code == "GH-0001"
        assert r.total == 0
