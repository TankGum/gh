"""Tests for GET /api/v1/overview — completely untested until now."""
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient

from app.schemas.overview import KpiCard, OverviewResponse, OverviewRevenueItem, TodayBooking, TopBarber
from app.services.overview.service import OverviewService


def _make_overview() -> OverviewResponse:
    return OverviewResponse(
        kpis=[
            KpiCard(label="Doanh thu", value="1.500.000 VND", delta="+200.000", delta_positive=True, sub="7 ngày qua"),
            KpiCard(label="Lịch hẹn", value="12", delta="+3", delta_positive=True, sub="7 ngày qua"),
            KpiCard(label="Barber", value="5", delta="", delta_positive=True, sub="Đang hoạt động"),
            KpiCard(label="Khách hàng", value="48", delta="", delta_positive=True, sub="Tổng số"),
        ],
        revenue_7_days=[
            OverviewRevenueItem(date="19/06", amount="0 VND", pct=0.0),
            OverviewRevenueItem(date="20/06", amount="500.000 VND", pct=33.3),
            OverviewRevenueItem(date="21/06", amount="1.500.000 VND", pct=100.0),
        ],
        top_barbers=[
            TopBarber(id=uuid.uuid4(), name="Nguyen Van A", initials="NA", avatar_url=None, count=5, pct=62.5),
            TopBarber(id=uuid.uuid4(), name="Tran Van B", initials="TB", avatar_url=None, count=3, pct=37.5),
        ],
        today_bookings=[
            TodayBooking(
                time="09:00",
                customer="Nguyen Van C",
                service="Cắt tóc",
                barber="Nguyen Van A",
                status="Chờ XN",
                badge_style="background:rgba(217,190,132,.15);color:#D9BE84",
            )
        ],
    )


class TestOverviewEndpoint:
    async def test_overview_200(self, authed_client: AsyncClient) -> None:
        with patch.object(OverviewService, "get_overview", new_callable=AsyncMock) as mock:
            mock.return_value = _make_overview()
            resp = await authed_client.get("/api/v1/overview")
        assert resp.status_code == 200

    async def test_overview_response_top_level_keys(self, authed_client: AsyncClient) -> None:
        with patch.object(OverviewService, "get_overview", new_callable=AsyncMock) as mock:
            mock.return_value = _make_overview()
            resp = await authed_client.get("/api/v1/overview")
        body = resp.json()
        assert "kpis" in body
        assert "revenue7Days" in body
        assert "topBarbers" in body
        assert "todayBookings" in body

    async def test_kpis_structure(self, authed_client: AsyncClient) -> None:
        with patch.object(OverviewService, "get_overview", new_callable=AsyncMock) as mock:
            mock.return_value = _make_overview()
            resp = await authed_client.get("/api/v1/overview")
        kpis = resp.json()["kpis"]
        assert isinstance(kpis, list)
        assert len(kpis) == 4
        for kpi in kpis:
            assert "label" in kpi
            assert "value" in kpi
            assert "delta" in kpi
            assert "deltaPositive" in kpi
            assert "sub" in kpi

    async def test_kpi_labels_match_expected(self, authed_client: AsyncClient) -> None:
        with patch.object(OverviewService, "get_overview", new_callable=AsyncMock) as mock:
            mock.return_value = _make_overview()
            resp = await authed_client.get("/api/v1/overview")
        labels = [k["label"] for k in resp.json()["kpis"]]
        assert "Doanh thu" in labels
        assert "Lịch hẹn" in labels
        assert "Barber" in labels
        assert "Khách hàng" in labels

    async def test_revenue_7_days_structure(self, authed_client: AsyncClient) -> None:
        with patch.object(OverviewService, "get_overview", new_callable=AsyncMock) as mock:
            mock.return_value = _make_overview()
            resp = await authed_client.get("/api/v1/overview")
        items = resp.json()["revenue7Days"]
        assert isinstance(items, list)
        for item in items:
            assert "date" in item
            assert "amount" in item
            assert "pct" in item
            assert isinstance(item["pct"], float | int)

    async def test_revenue_amount_not_scientific_notation(self, authed_client: AsyncClient) -> None:
        with patch.object(OverviewService, "get_overview", new_callable=AsyncMock) as mock:
            mock.return_value = _make_overview()
            resp = await authed_client.get("/api/v1/overview")
        for item in resp.json()["revenue7Days"]:
            assert "E+" not in item["amount"]
            assert "E-" not in item["amount"]

    async def test_top_barbers_structure(self, authed_client: AsyncClient) -> None:
        with patch.object(OverviewService, "get_overview", new_callable=AsyncMock) as mock:
            mock.return_value = _make_overview()
            resp = await authed_client.get("/api/v1/overview")
        barbers = resp.json()["topBarbers"]
        assert isinstance(barbers, list)
        for b in barbers:
            assert "id" in b
            assert "name" in b
            assert "initials" in b
            assert "count" in b
            assert "pct" in b

    async def test_today_bookings_structure(self, authed_client: AsyncClient) -> None:
        with patch.object(OverviewService, "get_overview", new_callable=AsyncMock) as mock:
            mock.return_value = _make_overview()
            resp = await authed_client.get("/api/v1/overview")
        bookings = resp.json()["todayBookings"]
        assert isinstance(bookings, list)
        for b in bookings:
            assert "time" in b
            assert "customer" in b
            assert "service" in b
            assert "barber" in b
            assert "status" in b
            assert "badgeStyle" in b

    async def test_overview_empty_state(self, authed_client: AsyncClient) -> None:
        empty = OverviewResponse(kpis=[], revenue_7_days=[], top_barbers=[], today_bookings=[])
        with patch.object(OverviewService, "get_overview", new_callable=AsyncMock) as mock:
            mock.return_value = empty
            resp = await authed_client.get("/api/v1/overview")
        assert resp.status_code == 200
        body = resp.json()
        assert body["kpis"] == []
        assert body["revenue7Days"] == []
        assert body["topBarbers"] == []
        assert body["todayBookings"] == []

    async def test_overview_service_called_once(self, authed_client: AsyncClient) -> None:
        with patch.object(OverviewService, "get_overview", new_callable=AsyncMock) as mock:
            mock.return_value = _make_overview()
            await authed_client.get("/api/v1/overview")
        mock.assert_called_once()


class TestOverviewFmtCompact:
    def test_fmt_compact_integer(self) -> None:
        result = OverviewService._fmt_compact(1470000)
        assert result == "1.470.000 VND"

    def test_fmt_compact_zero(self) -> None:
        result = OverviewService._fmt_compact(0)
        assert result == "0 VND"

    def test_fmt_compact_small(self) -> None:
        result = OverviewService._fmt_compact(900)
        assert result == "900 VND"

    def test_fmt_compact_no_scientific_notation(self) -> None:
        result = OverviewService._fmt_compact(1700000)
        assert "E+" not in result
        assert "E-" not in result

    def test_fmt_compact_decimal_input(self) -> None:
        from decimal import Decimal
        result = OverviewService._fmt_compact(Decimal("1470000"))
        assert result == "1.470.000 VND"

    def test_fmt_compact_float_input(self) -> None:
        result = OverviewService._fmt_compact(1170000.0)
        assert result == "1.170.000 VND"


class TestOverviewFmtDelta:
    def test_fmt_delta_positive(self) -> None:
        assert OverviewService._fmt_delta(500) == "+500"

    def test_fmt_delta_negative(self) -> None:
        assert OverviewService._fmt_delta(-200) == "-200"

    def test_fmt_delta_zero(self) -> None:
        assert OverviewService._fmt_delta(0) == "0"
