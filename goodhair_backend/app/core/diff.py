"""Sinh danh sách thay đổi field (cũ → mới) cho nhật ký hoạt động."""

from collections.abc import Callable
from typing import Any


def _default_fmt(value: Any) -> str:
    if isinstance(value, bool):
        return "Có" if value else "Không"
    if value is None or value == "":
        return "∅"
    return str(value)


def compute_changes(
    old: dict[str, Any],
    new: dict[str, Any],
    labels: dict[str, str],
    formatters: dict[str, Callable[[Any], str]] | None = None,
) -> list[dict[str, str]]:
    """So sánh các field trong `new` với `old`, trả về [{label, from, to}].

    Chỉ xét các key có trong `new` (hỗ trợ cập nhật một phần). Field không có
    trong `labels` sẽ bị bỏ qua để tránh lộ field nội bộ.
    """
    formatters = formatters or {}
    changes: list[dict[str, str]] = []
    for key, new_val in new.items():
        if key not in labels:
            continue
        old_val = old.get(key)
        if str(old_val) == str(new_val):
            continue
        fmt = formatters.get(key, _default_fmt)
        changes.append(
            {
                "label": labels[key],
                "from": fmt(old_val),
                "to": fmt(new_val),
            }
        )
    return changes
