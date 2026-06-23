'use client';

import { useState, useEffect, useCallback } from 'react';
import { Spin } from 'antd';
import { useRouter } from 'next/navigation';
import { fetchOverview } from '@/services/overview.api';
import type { OverviewResponse } from '@/types/overview.type';

function deltaStyle(delta: string, positive: boolean): React.CSSProperties {
  if (!delta || delta === '0') return { color: 'rgba(241,236,225,.4)' };
  return { color: positive ? '#5FD49A' : '#F87171' };
}

export default function DashboardClient() {
  const router = useRouter();
  const [data, setData] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchOverview();
      setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  }

  if (!data) {
    return <div style={{ textAlign: 'center', padding: 80, color: '#64748b' }}>Không thể tải dữ liệu</div>;
  }

  return (
    <div>
      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
        {data.kpis.map((k, i) => (
          <div key={i} style={{ background: '#0F1E2B', border: '1px solid rgba(238,138,51,.16)', borderRadius: 8, padding: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, letterSpacing: '.04em', color: 'rgba(241,236,225,.5)' }}>{k.label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, ...deltaStyle(k.delta, k.deltaPositive) }}>{k.delta}</span>
            </div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 32, fontWeight: 700, color: '#F1ECE1', marginTop: 12 }}>{k.value}</div>
            <div style={{ fontSize: 11.5, color: 'rgba(241,236,225,.4)', marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20, marginTop: 20 }}>
        {/* Revenue 7-day chart */}
        <div style={{ background: '#0F1E2B', border: '1px solid rgba(238,138,51,.16)', borderRadius: 8, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700, color: '#F1ECE1', margin: 0 }}>Doanh thu 7 ngày</h3>
            <span style={{ fontSize: 12, color: '#EE8A33' }}>
              Tuần này · {data.kpis[0]?.value || '0'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 180 }}>
            {data.revenue7Days.map((r, i) => (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ fontSize: 10.5, color: 'rgba(241,236,225,.5)' }}>{r.amount}</div>
                <div style={{ width: '100%', borderRadius: '4px 4px 0 0', height: `${Math.max(r.pct, 1)}%`, background: 'linear-gradient(180deg,#EE8A33,#9A4F12)' }} />
                <div style={{ fontSize: 11, color: 'rgba(241,236,225,.45)' }}>{r.date}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Top barbers */}
        <div style={{ background: '#0F1E2B', border: '1px solid rgba(238,138,51,.16)', borderRadius: 8, padding: 24 }}>
          <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700, color: '#F1ECE1', margin: 0, marginBottom: 20 }}>Barber nổi bật</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {data.topBarbers.map((tb, i) => (
              <div key={tb.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {tb.avatarUrl ? (
                  <img src={tb.avatarUrl} alt={tb.name} style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                ) : (
                  <span style={{ width: 38, height: 38, borderRadius: '50%', background: '#16110C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display',serif", fontWeight: 700, color: '#EE8A33', fontSize: 13, flexShrink: 0 }}>
                    {tb.initials}
                  </span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: '#F1ECE1' }}>{tb.name}</div>
                  <div style={{ height: 5, background: '#16110C', borderRadius: 3, marginTop: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: '#EE8A33', borderRadius: 3, width: `${tb.pct}%` }} />
                  </div>
                </div>
                <span style={{ fontSize: 12.5, color: '#EE8A33', whiteSpace: 'nowrap' }}>{tb.count}</span>
              </div>
            ))}
            {data.topBarbers.length === 0 && (
              <div style={{ fontSize: 13, color: 'rgba(241,236,225,.4)', textAlign: 'center', padding: 20 }}>
                Chưa có dữ liệu
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Today's bookings */}
      <div style={{ background: '#0F1E2B', border: '1px solid rgba(238,138,51,.16)', borderRadius: 8, padding: 24, marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 700, color: '#F1ECE1', margin: 0 }}>Lịch hẹn hôm nay</h3>
          <button
            onClick={() => router.push('/manage-bookings')}
            style={{ background: 'transparent', border: '1px solid rgba(238,138,51,.3)', color: 'rgba(241,236,225,.75)', padding: '8px 16px', borderRadius: 5, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: "'Hanken Grotesk',sans-serif" }}
          >
            Mở lịch board
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {data.todayBookings.length === 0 ? (
            <div style={{ fontSize: 13, color: 'rgba(241,236,225,.4)', textAlign: 'center', padding: 20 }}>
              Hôm nay chưa có lịch hẹn
            </div>
          ) : (
            data.todayBookings.map((t, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '70px 1.4fr 1.2fr 1fr 120px', gap: 14, alignItems: 'center', padding: '14px 10px', borderBottom: '1px solid rgba(238,138,51,.08)' }}>
                <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 700, color: '#EE8A33' }}>{t.time}</span>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: '#F1ECE1' }}>{t.customer}</span>
                <span style={{ fontSize: 13, color: 'rgba(241,236,225,.6)' }}>{t.service}</span>
                <span style={{ fontSize: 13, color: 'rgba(241,236,225,.6)' }}>{t.barber}</span>
                <span style={{ justifySelf: 'start', fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, ...parseBadge(t.badgeStyle) }}>
                  {t.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function parseBadge(style: string): React.CSSProperties {
  const obj: React.CSSProperties = {};
  style.split(';').forEach(pair => {
    const [k, v] = pair.split(':');
    if (k?.trim() === 'background') obj.background = v?.trim();
    if (k?.trim() === 'color') obj.color = v?.trim();
  });
  return obj;
}
