'use client';

import { useState, useEffect, useCallback } from 'react';
import { Spin, DatePicker } from 'antd';
import dayjs from 'dayjs';
import { fetchRevenueSummary, fetchRevenueDaily, fetchRevenueByBranch, fetchRevenueByService } from '@/services/revenue.api';
import type { RevenueSummary, RevenueDailyItem, RevenueByBranch, RevenueByService } from '@/types/revenue.type';

function pad2(n: number) { return String(n).padStart(2, '0'); }

function fmt(v: number): string {
  return new Intl.NumberFormat('vi-VN').format(v) + ' VND';
}

const { RangePicker } = DatePicker;

export default function RevenueClient() {
  const today = dayjs();
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([today.startOf('month'), today.endOf('month')]);
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [daily, setDaily] = useState<RevenueDailyItem[]>([]);
  const [byBranch, setByBranch] = useState<RevenueByBranch[]>([]);
  const [byService, setByService] = useState<RevenueByService[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const start = range[0].format('YYYY-MM-DD');
    const end = range[1].format('YYYY-MM-DD');
    try {
      const [s, d, b, sv] = await Promise.all([
        fetchRevenueSummary(start, end),
        fetchRevenueDaily(start, end),
        fetchRevenueByBranch(start, end),
        fetchRevenueByService(start, end),
      ]);
      setSummary(s);
      setDaily(d);
      setByBranch(b);
      setByService(sv);
    } catch {
      setSummary(null);
      setDaily([]);
      setByBranch([]);
      setByService([]);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const maxRev = Math.max(...daily.map(d => d.revenue), 1);

  return (
    <div>
      {/* Date range */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <label style={{ display: 'block', fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: 'rgba(241,236,225,.5)', marginBottom: 7, fontWeight: 600 }}>Khoảng thời gian</label>
          <RangePicker
            value={range}
            onChange={v => { if (v?.[0] && v?.[1]) setRange([v[0], v[1]]); }}
            allowClear={false}
            style={{ background: '#0F1E2B', border: '1px solid rgba(238,138,51,.25)', borderRadius: 6 }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
      ) : (
        <div>
          {/* KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 16 }}>
            {[
              { label: 'Tổng doanh thu', value: summary ? fmt(summary.totalRevenue) : '0', delta: summary ? (summary.deltaRevenue >= 0 ? '+' : '') + fmt(summary.deltaRevenue) : '0', up: (summary?.deltaRevenue ?? 0) >= 0 },
              { label: 'Tổng lịch hẹn', value: summary ? String(summary.totalBookings) : '0', delta: summary ? (summary.deltaBookings >= 0 ? '+' : '') + String(summary.deltaBookings) : '0', up: (summary?.deltaBookings ?? 0) >= 0 },
              { label: 'Trung bình / lịch', value: summary ? fmt(summary.avgBookingValue) : '0', delta: '', up: true },
            ].map(k => (
              <div key={k.label} style={{ background: '#0F1E2B', border: '1px solid rgba(238,138,51,.16)', borderRadius: 8, padding: 22 }}>
                <span style={{ fontSize: 12, color: 'rgba(241,236,225,.5)' }}>{k.label}</span>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 30, fontWeight: 700, marginTop: 10, color: '#F1ECE1' }}>{k.value}</div>
                {k.delta && (
                  <div style={{ fontSize: 11.5, marginTop: 5, color: k.up ? '#5FD49A' : '#C6B7A0' }}>
                    {k.delta} so với kỳ trước
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Chart */}
          <div style={{ background: '#0F1E2B', border: '1px solid rgba(238,138,51,.16)', borderRadius: 8, padding: 24, marginTop: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 26 }}>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700 }}>Biểu đồ doanh thu</h3>
              <span style={{ fontSize: 12, color: 'rgba(241,236,225,.5)' }}>Đơn vị: VNĐ</span>
            </div>
            <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 230, minWidth: Math.min(daily.length, 30) * 48 }}>
                {daily.slice(0, 365).map(d => {
                  const pct = d.revenue / maxRev;
                  return (
                    <div key={d.date} style={{ flex: 1, minWidth: 38, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
                      <div style={{ fontSize: 10.5, color: 'rgba(241,236,225,.55)', fontWeight: 600 }}>{fmt(d.revenue)}</div>
                      <div style={{ width: '100%', borderRadius: '4px 4px 0 0', height: Math.max(pct * 200, 4), background: 'linear-gradient(180deg, #EE8A33, rgba(238,138,51,.5))' }} />
                      <div style={{ fontSize: 10.5, color: 'rgba(241,236,225,.45)' }}>{dayjs(d.date).format('D/M')}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* By branch + By service */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 20, marginTop: 20 }}>
            <div style={{ background: '#0F1E2B', border: '1px solid rgba(238,138,51,.16)', borderRadius: 8, padding: 24 }}>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, marginBottom: 18 }}>Theo chi nhánh</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {byBranch.map(b => (
                  <div key={b.branchId}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
                      <span style={{ color: 'rgba(241,236,225,.75)' }}>{b.branchName}</span>
                      <span style={{ color: '#EE8A33', fontWeight: 600 }}>{fmt(b.revenue)}</span>
                    </div>
                    <div style={{ height: 7, background: '#16110C', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${b.pct}%`, background: 'linear-gradient(90deg, #EE8A33, #9A4F12)' }} />
                    </div>
                  </div>
                ))}
                {byBranch.length === 0 && <span style={{ fontSize: 13, color: 'rgba(241,236,225,.4)' }}>Chưa có dữ liệu</span>}
              </div>
            </div>
            <div style={{ background: '#0F1E2B', border: '1px solid rgba(238,138,51,.16)', borderRadius: 8, padding: 24 }}>
              <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, marginBottom: 18 }}>Theo dịch vụ</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {byService.map(s => (
                  <div key={s.serviceId}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
                      <span style={{ color: 'rgba(241,236,225,.75)' }}>{s.serviceName}</span>
                      <span style={{ color: '#EE8A33', fontWeight: 600 }}>{fmt(s.revenue)}</span>
                    </div>
                    <div style={{ height: 7, background: '#16110C', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${s.pct}%`, background: 'linear-gradient(90deg, #EE8A33, #9A4F12)' }} />
                    </div>
                  </div>
                ))}
                {byService.length === 0 && <span style={{ fontSize: 13, color: 'rgba(241,236,225,.4)' }}>Chưa có dữ liệu</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
