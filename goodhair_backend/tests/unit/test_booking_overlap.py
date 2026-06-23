"""Unit tests for the booking overlap / slot-blocking logic.

The core overlap condition (from BookingRepository.check_overlap) is:
    slot_start < booked_end  AND  slot_end > booked_start
i.e. two intervals [A, A+dA) and [B, B+dB) overlap iff A < B+dB and A+dA > B.

We extract that predicate as a pure helper and test all edge cases here,
independent of any database.
"""

import datetime


# --- pure helpers mirroring the repo/frontend logic ---

def intervals_overlap(a_start: int, a_dur: int, b_start: int, b_dur: int) -> bool:
    """Return True if [a_start, a_start+a_dur) overlaps [b_start, b_start+b_dur)."""
    return a_start < b_start + b_dur and a_start + a_dur > b_start


def is_slot_blocked(
    slot_start_minutes: int,
    booking_duration: int,
    booked_windows: list[tuple[int, int]],  # (start_minutes, duration_minutes)
) -> bool:
    """Return True if placing a booking at slot_start for booking_duration would clash."""
    return any(
        intervals_overlap(slot_start_minutes, booking_duration, b_start, b_dur)
        for b_start, b_dur in booked_windows
    )


def time_to_minutes(t: str) -> int:
    h, m = t.split(":")
    return int(h) * 60 + int(m)


# --- tests ---

class TestIntervalsOverlap:
    def test_exact_same_slot(self) -> None:
        assert intervals_overlap(540, 60, 540, 60) is True

    def test_partial_overlap_start(self) -> None:
        # [540, 600) vs [510, 570) — overlap [540, 570)
        assert intervals_overlap(540, 60, 510, 60) is True

    def test_partial_overlap_end(self) -> None:
        # [540, 600) vs [570, 630) — overlap [570, 600)
        assert intervals_overlap(540, 60, 570, 60) is True

    def test_contained_inside(self) -> None:
        # [545, 555) inside [540, 600)
        assert intervals_overlap(545, 10, 540, 60) is True

    def test_contains_other(self) -> None:
        # [540, 600) contains [550, 560)
        assert intervals_overlap(540, 60, 550, 10) is True

    def test_adjacent_no_overlap_after(self) -> None:
        # [540, 600) then [600, 660) — touching but NOT overlapping
        assert intervals_overlap(540, 60, 600, 60) is False

    def test_adjacent_no_overlap_before(self) -> None:
        # [480, 540) then [540, 600)
        assert intervals_overlap(540, 60, 480, 60) is False

    def test_completely_before(self) -> None:
        assert intervals_overlap(540, 60, 360, 60) is False

    def test_completely_after(self) -> None:
        assert intervals_overlap(540, 60, 660, 60) is False

    def test_zero_duration_never_overlaps(self) -> None:
        # A booking with 0-min duration is treated as a point — the half-open
        # interval [540, 540) is empty, so it overlaps nothing.
        assert intervals_overlap(540, 0, 540, 60) is False

    def test_single_minute_inside(self) -> None:
        assert intervals_overlap(541, 1, 540, 60) is True


class TestIsSlotBlocked:
    def test_no_bookings_never_blocked(self) -> None:
        assert is_slot_blocked(540, 30, []) is False

    def test_blocked_when_exact_match(self) -> None:
        assert is_slot_blocked(540, 30, [(540, 60)]) is True

    def test_blocked_when_overlaps_start(self) -> None:
        # slot 09:30–10:00, booking 09:00–10:00
        assert is_slot_blocked(570, 30, [(540, 60)]) is True

    def test_not_blocked_when_after(self) -> None:
        # slot 10:00–10:30, booking 09:00–10:00 (ends exactly at 10:00)
        assert is_slot_blocked(600, 30, [(540, 60)]) is False

    def test_not_blocked_when_before(self) -> None:
        # slot 08:30–09:00, booking 09:00–10:00
        assert is_slot_blocked(510, 30, [(540, 60)]) is False

    def test_blocked_by_one_of_many(self) -> None:
        windows = [(480, 30), (570, 30), (660, 30)]  # 08:00, 09:30, 11:00
        # slot 09:30 should be blocked by window (570, 30)
        assert is_slot_blocked(570, 30, windows) is True
        # slot 09:00 should not be blocked
        assert is_slot_blocked(540, 30, windows) is False

    def test_long_service_blocks_multiple_slots(self) -> None:
        # booking exists 09:00–11:00 (start=540, dur=120) → occupies [540, 660)
        windows = [(540, 120)]
        # 08:30 slot with 30 min: [510, 540) → 510 < 660 AND 540 > 540 → FALSE → free
        assert is_slot_blocked(510, 30, windows) is False
        # 08:31 slot with 30 min: [511, 541) → 511 < 660 AND 541 > 540 → BOTH TRUE → blocked
        assert is_slot_blocked(511, 30, windows) is True
        # 10:30 slot with 30 min: [630, 660) → 630 < 660 AND 660 > 540 → BOTH TRUE → blocked
        assert is_slot_blocked(630, 30, windows) is True
        # 11:00 slot with 30 min: [660, 690) → 660 < 660? FALSE → free
        assert is_slot_blocked(660, 30, windows) is False

    def test_user_duration_affects_blocking(self) -> None:
        # booking 10:00–10:30 (30 min)
        windows = [(600, 30)]
        # slot 09:30 with 30 min service: ends 10:00 → NOT overlapping
        assert is_slot_blocked(570, 30, windows) is False
        # slot 09:30 with 60 min service: ends 10:30 → overlaps [10:00,10:30)
        assert is_slot_blocked(570, 60, windows) is True


class TestTimeToMinutes:
    def test_zero(self) -> None:
        assert time_to_minutes("00:00") == 0

    def test_nine_am(self) -> None:
        assert time_to_minutes("09:00") == 540

    def test_half_past(self) -> None:
        assert time_to_minutes("09:30") == 570

    def test_noon(self) -> None:
        assert time_to_minutes("12:00") == 720

    def test_evening(self) -> None:
        assert time_to_minutes("21:00") == 1260


class TestOverlapWithRealTimes:
    """Scenario-level tests using HH:MM strings for readability."""

    def _blocked(self, slot: str, dur: int, bookings: list[tuple[str, int]]) -> bool:
        windows = [(time_to_minutes(t), d) for t, d in bookings]
        return is_slot_blocked(time_to_minutes(slot), dur, windows)

    def test_scenario_barber_full_morning(self) -> None:
        # Barber booked 09:00–12:00 in three back-to-back sessions
        bookings = [("09:00", 60), ("10:00", 60), ("11:00", 60)]
        assert self._blocked("09:00", 30, bookings) is True
        assert self._blocked("09:30", 30, bookings) is True
        assert self._blocked("11:30", 30, bookings) is True
        # 12:00 is free
        assert self._blocked("12:00", 30, bookings) is False

    def test_scenario_lunch_gap(self) -> None:
        # Booked 09:00–12:00, then again 13:00–15:00
        bookings = [("09:00", 180), ("13:00", 120)]
        # Lunch gap 12:00–13:00 is free
        assert self._blocked("12:00", 30, bookings) is False
        assert self._blocked("12:30", 30, bookings) is False
        # Exactly at 13:00 is booked
        assert self._blocked("13:00", 30, bookings) is True

    def test_scenario_no_bookings(self) -> None:
        for slot in ["09:00", "10:30", "14:00", "18:00", "20:30"]:
            assert self._blocked(slot, 30, []) is False
