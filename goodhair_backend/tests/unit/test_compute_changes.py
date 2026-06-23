"""Unit tests for app.core.diff.compute_changes."""

from app.core.diff import compute_changes


LABELS = {"name": "Tên", "price": "Giá", "status": "Trạng thái"}


class TestComputeChanges:
    def test_returns_empty_when_nothing_changed(self) -> None:
        result = compute_changes(
            {"name": "GOODHAIR Q1", "price": 100},
            {"name": "GOODHAIR Q1", "price": 100},
            LABELS,
        )
        assert result == []

    def test_detects_single_field_change(self) -> None:
        result = compute_changes(
            {"name": "Old Name"},
            {"name": "New Name"},
            LABELS,
        )
        assert len(result) == 1
        assert result[0]["label"] == "Tên"
        assert result[0]["from"] == "Old Name"
        assert result[0]["to"] == "New Name"

    def test_detects_multiple_changes(self) -> None:
        result = compute_changes(
            {"name": "Old", "price": 100},
            {"name": "New", "price": 200},
            LABELS,
        )
        labels_seen = {r["label"] for r in result}
        assert "Tên" in labels_seen
        assert "Giá" in labels_seen
        assert len(result) == 2

    def test_skips_fields_not_in_labels(self) -> None:
        # 'notes' is not in LABELS — should be silently ignored
        result = compute_changes(
            {"notes": "old note"},
            {"notes": "new note"},
            LABELS,
        )
        assert result == []

    def test_skips_fields_not_in_new_data(self) -> None:
        # If the field is in old but not in new, nothing to diff
        result = compute_changes(
            {"name": "A", "price": 100},
            {"name": "B"},
            LABELS,
        )
        assert len(result) == 1
        assert result[0]["label"] == "Tên"

    def test_none_to_value(self) -> None:
        result = compute_changes({"name": None}, {"name": "Set Now"}, LABELS)
        assert len(result) == 1
        assert result[0]["from"] == "∅"
        assert result[0]["to"] == "Set Now"

    def test_value_to_none(self) -> None:
        result = compute_changes({"name": "Had value"}, {"name": None}, LABELS)
        assert len(result) == 1
        assert result[0]["from"] == "Had value"
        assert result[0]["to"] == "∅"

    def test_none_to_none_no_change(self) -> None:
        result = compute_changes({"name": None}, {"name": None}, LABELS)
        assert result == []

    def test_integer_formatting(self) -> None:
        result = compute_changes({"price": 50000}, {"price": 100000}, LABELS)
        assert result[0]["from"] == "50000"
        assert result[0]["to"] == "100000"

    def test_custom_formatter(self) -> None:
        def fmt_price(v: object) -> str:
            return f"{v:,}đ" if isinstance(v, int) else str(v)

        result = compute_changes(
            {"price": 50000},
            {"price": 100000},
            LABELS,
            formatters={"price": fmt_price},
        )
        assert result[0]["from"] == "50,000đ"
        assert result[0]["to"] == "100,000đ"

    def test_boolean_values(self) -> None:
        result = compute_changes({"status": True}, {"status": False}, LABELS)
        assert len(result) == 1

    def test_empty_old_and_new(self) -> None:
        assert compute_changes({}, {}, LABELS) == []
