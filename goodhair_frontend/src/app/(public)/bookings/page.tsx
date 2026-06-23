'use client';

import { useState, useEffect, useMemo } from 'react';
import { Playfair_Display, Hanken_Grotesk } from 'next/font/google';
import {
  fetchPublicBranches,
  fetchPublicServices,
  fetchPublicEmployees,
  fetchAvailableSlots,
  createPublicBooking,
  type PublicBranch,
  type PublicService,
  type PublicEmployee,
  type BookedWindow,
} from '@/services/public.api';

const playfair = Playfair_Display({ subsets: ['latin'], weight: ['500', '600', '700', '800'] });
const hanken = Hanken_Grotesk({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700', '800'] });

const f = (n: number) => n.toLocaleString('vi-VN') + 'đ';
const fk = (n: number) => Math.round(n / 1000) + 'K';

const toTimeStr = (t: string | null) => {
  if (!t) return '';
  return t.slice(0, 5);
};
const formatHours = (open: string | null, close: string | null) => {
  if (!open || !close) return '';
  return toTimeStr(open) + '–' + toTimeStr(close);
};

const dows = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function genSlots(open: string, close: string) {
  const toMin = (t: string) => { const p = t.split(':'); return parseInt(p[0]) * 60 + parseInt(p[1]); };
  const o = toMin(open || '09:00'), c = toMin(close || '21:00');
  const out: string[] = [];
  for (let m = o; m <= c - 30; m += 30) {
    const h = Math.floor(m / 60), mi = m % 60;
    if (h !== 12) out.push((h < 10 ? '0' + h : h) + ':' + (mi === 0 ? '00' : '30'));
  }
  return out;
}

const styles = {
  container: { background: '#0B1620', color: '#F1ECE1', minHeight: '100vh', fontFamily: hanken.style.fontFamily },
  header: { position: 'sticky' as const, top: 0, zIndex: 30, background: 'rgba(11,22,32,.92)', backdropFilter: 'blur(14px)', borderBottom: '1px solid rgba(238,138,51,.18)' },
  stepper: { borderBottom: '1px solid rgba(238,138,51,.12)', background: '#0A131D' },
  cardBg: '#0F1E2B' as const,
  accent: '#EE8A33' as const,
  text: '#F1ECE1' as const,
  muted: 'rgba(241,236,225,.55)' as const,
  borderLight: 'rgba(238,138,51,.2)' as const,
  selectedBg: '#13283a' as const,
};

export default function HomePage() {
  const [step, setStep] = useState(1);
  const [branches, setBranches] = useState<PublicBranch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [remind, setRemind] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<{ code: string; customerName: string; date: string; startTime: string; total: number } | null>(null);

  const [services, setServices] = useState<PublicService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);

  const [employees, setEmployees] = useState<PublicEmployee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [bookedWindows, setBookedWindows] = useState<BookedWindow[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  useEffect(() => {
    fetchPublicBranches({ size: 20 })
      .then(res => setBranches(res.items))
      .catch(() => {})
      .finally(() => setBranchesLoading(false));
  }, []);

  useEffect(() => {
    fetchPublicServices({ size: 20 })
      .then(res => setServices(res.items))
      .catch(() => {})
      .finally(() => setServicesLoading(false));
  }, []);

  useEffect(() => {
    if (!branchId) return;
    setEmployeesLoading(true);
    fetchPublicEmployees({ branchId, size: 50 })
      .then(res => setEmployees(res.items))
      .catch(() => setEmployees([]))
      .finally(() => setEmployeesLoading(false));
  }, [branchId]);

  // Fetch booked windows whenever a specific barber + date is selected
  useEffect(() => {
    if (!barberId || barberId === 'any' || !date) {
      setBookedWindows([]);
      return;
    }
    setSlotsLoading(true);
    fetchAvailableSlots(barberId, date)
      .then(setBookedWindows)
      .catch(() => setBookedWindows([]))
      .finally(() => setSlotsLoading(false));
  }, [barberId, date]);

  const branch = branches.find(b => b.id === branchId);
  const selServices = services.filter(s => serviceIds.includes(s.id));
  const total = selServices.reduce((a, s) => a + s.price, 0);
  const durMin = selServices.reduce((a, s) => a + s.durationMinutes, 0);
  const selBarber = barberId === 'any' ? null : employees.find(b => b.id === barberId);
  const barberName = barberId === 'any' ? 'Bất kỳ barber nào' : (selBarber?.name || '—');

  const durLabel = durMin
    ? (durMin >= 60
      ? Math.floor(durMin / 60) + 'h' + (durMin % 60 ? ' ' + (durMin % 60) + 'p' : '')
      : durMin + ' phút')
    : '';

  const base = new Date();
  const dayItems = Array.from({ length: 10 }).map((_, i) => {
    const dt = new Date(base);
    dt.setDate(base.getDate() + i);
    const key = dt.toISOString().slice(0, 10);
    return { key, dow: dows[dt.getDay()], day: dt.getDate(), month: dt.getMonth() + 1, dt };
  });

  const dayObj = dayItems.find(d => d.key === date);
  const sDateTime = (dayObj && time) ? (dayObj.dow + ' ' + dayObj.day + '/' + dayObj.month + ' · ' + time) : '—';

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const currentMin = now.getHours() * 60 + now.getMinutes();

  const openTime = branch?.openingTime || '09:00';
  const closeTime = branch?.closingTime || '21:00';
  const daySlots = genSlots(openTime, closeTime);

  const canNext =
    (step === 1 && !!branchId) ||
    (step === 2 && !!barberId) ||
    (step === 3 && serviceIds.length > 0) ||
    (step === 4 && !!(date && time)) ||
    (step === 5 && name.trim().length > 1 && phone.trim().length >= 8);

  const nextLabel = step === 5 ? 'Xác nhận đặt lịch' : 'Tiếp tục →';

  const goStep = (n: number) => { setStep(n); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const onNext = async () => {
    if (!canNext) return;
    if (step < 5) { goStep(step + 1); return; }
    setSubmitting(true);
    try {
      const result = await createPublicBooking({
        customerName: name,
        customerPhone: phone,
        employeeId: barberId === 'any' ? null : barberId,
        branchId,
        date: date!,
        startTime: time!,
        durationMinutes: durMin,
        total,
        serviceIds,
      });
      setBookingResult(result);
      setConfirmed(true);
    } catch {
      alert('Đặt lịch thất bại. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  const sServices = useMemo(() => selServices.map(s => ({ name: s.name, price: f(s.price) })), [selServices]);

  const stepNames = ['Chi nhánh', 'Barber', 'Dịch vụ', 'Ngày & giờ', 'Xác nhận'];
  const stepItems = stepNames.map((label, i) => {
    const n = i + 1;
    const done = n < step;
    const active = n === step;
    return { n, label, done, active, badge: done ? '✓' : String(n) };
  });

  if (confirmed) {
    const code = bookingResult?.code || '—';
    return (
      <div style={{ ...styles.container }}>
        <div style={{ maxWidth: 620, margin: '0 auto', padding: '70px 24px 90px', textAlign: 'center' }}>
          <div style={{ width: 84, height: 84, borderRadius: '50%', background: 'rgba(31,138,91,.16)', border: '1px solid rgba(31,138,91,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', fontSize: 38, color: '#3FBF7F' }}>✓</div>
          <h2 style={{ fontFamily: playfair.style.fontFamily, fontSize: 34, fontWeight: 700, marginTop: 28 }}>Đặt lịch thành công!</h2>
          <p style={{ color: 'rgba(241,236,225,.6)', fontSize: 15, marginTop: 12, lineHeight: 1.6 }}>Cảm ơn {name || 'bạn'}. Lịch hẹn của bạn đã được xác nhận. Chúng tôi sẽ gửi nhắc lịch qua SMS & Zalo.</p>
          <div style={{ marginTop: 34, background: styles.cardBg, border: `1px solid ${styles.borderLight}`, borderRadius: 6, padding: 26, textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid rgba(238,138,51,.14)' }}>
              <span style={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(241,236,225,.45)' }}>Mã đặt lịch</span>
              <span style={{ fontFamily: playfair.style.fontFamily, fontSize: 20, fontWeight: 700, color: styles.accent, letterSpacing: '.08em' }}>{code}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'rgba(241,236,225,.5)', fontSize: 13.5 }}>Chi nhánh</span><span style={{ fontWeight: 600, fontSize: 13.5 }}>{branch?.name.replace('GOODHAIR ', '') || '—'}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'rgba(241,236,225,.5)', fontSize: 13.5 }}>Barber</span><span style={{ fontWeight: 600, fontSize: 13.5 }}>{barberName}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'rgba(241,236,225,.5)', fontSize: 13.5 }}>Thời gian</span><span style={{ fontWeight: 600, fontSize: 13.5 }}>{sDateTime}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'rgba(241,236,225,.5)', fontSize: 13.5 }}>Tổng cộng</span><span style={{ fontWeight: 700, fontSize: 13.5, color: styles.accent }}>{total ? f(total) : '0đ'}</span></div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 30, flexWrap: 'wrap' }}>
            <a href="/" style={{ textDecoration: 'none', border: `1px solid rgba(238,138,51,.3)`, color: styles.text, padding: '14px 28px', borderRadius: 3, fontSize: 13, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>Về trang chủ</a>
            <button onClick={() => { setStep(1); setBranchId(null); setBarberId(null); setServiceIds([]); setDate(null); setTime(null); setName(''); setPhone(''); setRemind(true); setConfirmed(false); setBookingResult(null); }} style={{ background: styles.accent, color: '#0B1620', border: 'none', padding: '14px 28px', borderRadius: 3, fontSize: 13, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: hanken.style.fontFamily }}>Đặt lịch khác</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/logo/logo.jpg" alt="GOODHAIR" style={{ width: 34, height: 34, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }} />
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
              <span style={{ fontFamily: playfair.style.fontFamily, fontWeight: 800, fontSize: 21, color: styles.text }}>GOOD</span>
              <span style={{ fontFamily: playfair.style.fontFamily, fontWeight: 800, fontSize: 21, color: styles.accent }}>HAIR</span>
            </span>
          </a>
          <span style={{ fontSize: 12, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(241,236,225,.5)' }}>Đặt lịch online</span>
          <a href="/" style={{ textDecoration: 'none', color: 'rgba(241,236,225,.6)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>✕ Đóng</a>
        </div>
      </header>

      {/* STEPPER */}
      <div style={styles.stepper}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 0 }}>
          {stepItems.map((st, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0,
                  ...((st.active || st.done)
                    ? { background: styles.accent, color: '#0B1620' }
                    : { background: 'transparent', color: 'rgba(241,236,225,.45)', border: '1px solid rgba(238,138,51,.3)' }),
                }}>{st.badge}</span>
                <div>
                  <div style={{ fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(241,236,225,.4)' }}>Bước {st.n}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: (st.active || st.done) ? styles.text : 'rgba(241,236,225,.45)' }}>{st.label}</div>
                </div>
              </div>
              {i < 4 && (
                <span style={{ flex: 1, height: 1, margin: '0 14px', background: st.done ? 'rgba(238,138,51,.5)' : 'rgba(238,138,51,.15)' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* BODY GRID */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 24px 60px', display: 'grid', gridTemplateColumns: '1fr 360px', gap: 36, alignItems: 'start' }}>
        {/* STEP PANEL */}
        <div style={{ minHeight: 420 }}>
          {/* STEP 1: BRANCH */}
          {step === 1 && (
            <div>
              <h2 style={{ fontFamily: playfair.style.fontFamily, fontSize: 28, fontWeight: 700 }}>Chọn chi nhánh</h2>
              <p style={{ color: styles.muted, fontSize: 14, marginTop: 6 }}>Chọn cơ sở GOODHAIR thuận tiện nhất với bạn.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))', gap: 14, marginTop: 24 }}>
                {branchesLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} style={{ borderRadius: 6, overflow: 'hidden', background: styles.cardBg, border: `1px solid rgba(238,138,51,.16)` }}>
                        <div style={{ width: '100%', height: 128, background: 'linear-gradient(150deg,#16110C,#2a211a)', borderBottom: '1px solid rgba(238,138,51,.14)' }} />
                        <div style={{ padding: '18px 20px' }}>
                          <div style={{ width: '70%', height: 18, background: 'rgba(241,236,225,.1)', borderRadius: 2 }} />
                          <div style={{ width: '80%', height: 13, background: 'rgba(241,236,225,.06)', borderRadius: 2, marginTop: 10 }} />
                          <div style={{ width: '45%', height: 11, background: 'rgba(238,138,51,.15)', borderRadius: 2, marginTop: 12 }} />
                        </div>
                      </div>
                    ))
                  : branches.map(b => {
                      const sel = b.id === branchId;
                      return (
                        <div key={b.id} style={{ borderRadius: 6, overflow: 'hidden', background: sel ? styles.selectedBg : styles.cardBg, border: sel ? `1px solid ${styles.accent}` : `1px solid rgba(238,138,51,.16)` }}>
                          <div style={{ width: '100%', height: 128, background: 'linear-gradient(150deg,#16110C,#2a211a)', borderBottom: '1px solid rgba(238,138,51,.14)', position: 'relative', overflow: 'hidden' }}>
                            {b.imageUrl && <img src={b.imageUrl} alt={b.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                          </div>
                          <button onClick={() => { setBranchId(b.id); setBarberId(null); }} style={{ display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer', padding: '18px 20px', border: 'none', background: 'transparent', fontFamily: hanken.style.fontFamily }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                              <h3 style={{ fontFamily: playfair.style.fontFamily, fontSize: 18, fontWeight: 700, color: styles.text, margin: 0 }}>{b.name}</h3>
                              <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, ...(sel ? { background: styles.accent, color: '#0B1620' } : { border: '1px solid rgba(238,138,51,.3)' }) }}>{sel ? '✓' : ''}</span>
                            </div>
                            <p style={{ fontSize: 13, color: styles.muted, marginTop: 8, lineHeight: 1.5 }}>{b.address}</p>
                            <div style={{ display: 'flex', gap: 14, marginTop: 12, fontSize: 11.5, color: styles.accent }}>
                              <span>{formatHours(b.openingTime, b.closingTime)}</span>
                            </div>
                          </button>
                        </div>
                      );
                    })}
              </div>
            </div>
          )}

          {/* STEP 2: BARBER */}
          {step === 2 && (
            <div>
              <h2 style={{ fontFamily: playfair.style.fontFamily, fontSize: 28, fontWeight: 700 }}>Chọn barber</h2>
              <p style={{ color: styles.muted, fontSize: 14, marginTop: 6 }}>Barber tại {branch?.name || '...'}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 14, marginTop: 24 }}>
                {employeesLoading
                  ? Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} style={{ borderRadius: 4, background: styles.cardBg, border: '1px solid rgba(238,138,51,.16)', padding: 18, display: 'flex', gap: 14, alignItems: 'center' }}>
                        <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#16110C', flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ width: '60%', height: 15, background: 'rgba(241,236,225,.1)', borderRadius: 2 }} />
                          <div style={{ width: '40%', height: 12, background: 'rgba(241,236,225,.06)', borderRadius: 2, marginTop: 8 }} />
                        </div>
                      </div>
                    ))
                  : [{ id: 'any' as const, name: 'Bất kỳ barber nào', roleName: 'Hệ thống tự sắp xếp barber trống', avatarUrl: null }, ...employees].map(bb => {
                      const sel = bb.id === barberId;
                      const initials = bb.id === 'any' ? '★' : bb.name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
                      return (
                        <button key={bb.id} onClick={() => { setBarberId(bb.id); setTime(null); }} style={{ textAlign: 'left', cursor: 'pointer', padding: 18, borderRadius: 4, fontFamily: hanken.style.fontFamily, display: 'flex', gap: 14, alignItems: 'center', width: '100%', border: sel ? `1px solid ${styles.accent}` : '1px solid rgba(238,138,51,.16)', background: sel ? styles.selectedBg : styles.cardBg }}>
                          {bb.avatarUrl ? (
                            <img src={bb.avatarUrl} alt={bb.name} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                          ) : (
                            <span style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: playfair.style.fontFamily, fontWeight: 700, fontSize: 18, ...(sel ? { background: styles.accent, color: '#0B1620' } : { background: '#16110C', color: styles.accent }) }}>{initials}</span>
                          )}
                          <div style={{ flex: 1 }}>
                            <h3 style={{ fontSize: 15, fontWeight: 700, color: styles.text, margin: 0 }}>{bb.name}</h3>
                            {bb.roleName && (
                              <p style={{ fontSize: 12, color: 'rgba(241,236,225,.5)', marginTop: 2 }}>{bb.roleName}</p>
                            )}
                          </div>
                        </button>
                      );
                    })}
              </div>
            </div>
          )}

          {/* STEP 3: SERVICES */}
          {step === 3 && (
            <div>
              <h2 style={{ fontFamily: playfair.style.fontFamily, fontSize: 28, fontWeight: 700 }}>Chọn dịch vụ</h2>
              <p style={{ color: styles.muted, fontSize: 14, marginTop: 6 }}>Có thể chọn nhiều dịch vụ. Combo đã gồm gội massage.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
                {servicesLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} style={{ padding: '18px 20px', borderRadius: 4, background: styles.cardBg, border: '1px solid rgba(238,138,51,.16)' }}>
                        <div style={{ width: '40%', height: 16, background: 'rgba(241,236,225,.1)', borderRadius: 2 }} />
                        <div style={{ width: '60%', height: 12, background: 'rgba(241,236,225,.06)', borderRadius: 2, marginTop: 8 }} />
                      </div>
                    ))
                  : services.map(sv => {
                  const sel = serviceIds.includes(sv.id);
                  return (
                    <button key={sv.id} onClick={() => setServiceIds(sel ? serviceIds.filter(x => x !== sv.id) : [...serviceIds, sv.id])} style={{ textAlign: 'left', cursor: 'pointer', padding: '18px 20px', borderRadius: 4, fontFamily: hanken.style.fontFamily, display: 'flex', alignItems: 'center', gap: 16, width: '100%', border: sel ? `1px solid ${styles.accent}` : '1px solid rgba(238,138,51,.16)', background: sel ? styles.selectedBg : styles.cardBg }}>
                      <span style={{ width: 24, height: 24, borderRadius: 5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, ...(sel ? { background: styles.accent, color: '#0B1620' } : { border: '1px solid rgba(238,138,51,.3)' }) }}>{sel ? '✓' : ''}</span>
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: 16, fontWeight: 700, color: styles.text, margin: 0 }}>{sv.name}</h3>
                        <p style={{ fontSize: 12.5, color: 'rgba(241,236,225,.5)', marginTop: 3 }}>{sv.description}</p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: playfair.style.fontFamily, fontSize: 18, fontWeight: 700, color: styles.accent }}>{fk(sv.price)}</div>
                        <div style={{ fontSize: 11, color: 'rgba(241,236,225,.45)' }}>{sv.durationMinutes} phút</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 4: DATE & TIME */}
          {step === 4 && (
            <div>
              <h2 style={{ fontFamily: playfair.style.fontFamily, fontSize: 28, fontWeight: 700 }}>Chọn ngày & giờ</h2>
              <p style={{ color: styles.muted, fontSize: 14, marginTop: 6 }}>Khung giờ trống được cập nhật theo thời gian thực.</p>
              <div style={{ display: 'flex', gap: 10, marginTop: 24, overflowX: 'auto', paddingBottom: 6 }}>
                {dayItems.map(d => {
                  const sel = d.key === date;
                  return (
                    <button key={d.key} onClick={() => { setDate(d.key); setTime(null); }} style={{ cursor: 'pointer', flexShrink: 0, width: 64, padding: '14px 0', borderRadius: 6, textAlign: 'center', fontFamily: hanken.style.fontFamily, border: 'none', ...(sel ? { background: styles.accent, color: '#0B1620' } : { background: styles.cardBg, color: styles.text, border: '1px solid rgba(238,138,51,.16)' }) }}>
                      <div style={{ fontSize: 11, letterSpacing: '.04em', opacity: 0.7 }}>{d.dow}</div>
                      <div style={{ fontFamily: playfair.style.fontFamily, fontSize: 22, fontWeight: 700, margin: '2px 0' }}>{d.day}</div>
                      <div style={{ fontSize: 10, opacity: 0.6 }}>Th{d.month}</div>
                    </button>
                  );
                })}
              </div>
              <h3 style={{ fontSize: 13, letterSpacing: '.1em', textTransform: 'uppercase', color: styles.accent, margin: '28px 0 14px' }}>
                {!date ? 'Chọn ngày để xem khung giờ' : slotsLoading ? 'Đang tải khung giờ…' : 'Khung giờ trống'}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(86px,1fr))', gap: 10 }}>
                {daySlots.map((label, i) => {
                  const slotH = parseInt(label.split(':')[0]);
                  const slotM = parseInt(label.split(':')[1]);
                  const slotMin = slotH * 60 + slotM;
                  const isPast = date ? (date === todayKey && slotMin <= currentMin) : false;
                  const effectiveDur = durMin > 0 ? durMin : 30;
                  const isBooked = bookedWindows.some(w =>
                    slotMin < w.startMinutes + w.durationMinutes && slotMin + effectiveDur > w.startMinutes
                  );
                  const avail = !isPast && !isBooked;
                  const sel = label === time;
                  let btnStyle: React.CSSProperties;
                  if (!avail) btnStyle = { background: 'transparent', color: 'rgba(241,236,225,.22)', border: '1px solid rgba(238,138,51,.08)', cursor: 'not-allowed', textDecoration: 'line-through' };
                  else if (sel) btnStyle = { background: styles.accent, color: '#0B1620', border: `1px solid ${styles.accent}`, cursor: 'pointer' };
                  else btnStyle = { background: styles.cardBg, color: styles.text, border: '1px solid rgba(238,138,51,.18)', cursor: 'pointer' };
                  return (
                    <button key={i} disabled={!avail} onClick={() => avail && setTime(label)} style={{ padding: '12px 0', borderRadius: 4, fontFamily: hanken.style.fontFamily, fontSize: 14, fontWeight: 600, ...btnStyle }}>
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 5: CONFIRM */}
          {step === 5 && (
            <div>
              <h2 style={{ fontFamily: playfair.style.fontFamily, fontSize: 28, fontWeight: 700 }}>Xác nhận & thông tin</h2>
              <p style={{ color: styles.muted, fontSize: 14, marginTop: 6 }}>Nhập thông tin để chúng tôi xác nhận lịch hẹn.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 26, maxWidth: 480 }}>
                <div>
                  <label style={{ fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(241,236,225,.5)', display: 'block', marginBottom: 8 }}>Họ và tên</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Nguyễn Văn A" style={{ width: '100%', background: styles.cardBg, border: '1px solid rgba(238,138,51,.25)', color: styles.text, padding: '14px 16px', borderRadius: 4, fontFamily: hanken.style.fontFamily, fontSize: 15, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(241,236,225,.5)', display: 'block', marginBottom: 8 }}>Số điện thoại</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="09xx xxx xxx" style={{ width: '100%', background: styles.cardBg, border: '1px solid rgba(238,138,51,.25)', color: styles.text, padding: '14px 16px', borderRadius: 4, fontFamily: hanken.style.fontFamily, fontSize: 15, outline: 'none' }} />
                </div>
                <button onClick={() => setRemind(!remind)} style={{ cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 14, background: styles.cardBg, border: '1px solid rgba(238,138,51,.2)', padding: 16, borderRadius: 4, fontFamily: hanken.style.fontFamily }}>
                  <span style={{ width: 24, height: 24, borderRadius: 5, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, ...(remind ? { background: styles.accent, color: '#0B1620' } : { border: '1px solid rgba(238,138,51,.3)' }) }}>{remind ? '✓' : ''}</span>
                  <div>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: styles.text }}>Nhắc lịch qua SMS & Zalo</div>
                    <div style={{ fontSize: 12, color: 'rgba(241,236,225,.5)', marginTop: 2 }}>Gửi nhắc trước buổi hẹn 1 giờ</div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* SUMMARY SIDEBAR */}
        <div style={{ position: 'sticky', top: 96, background: styles.cardBg, border: `1px solid ${styles.borderLight}`, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ padding: '20px 22px', borderBottom: '1px solid rgba(238,138,51,.14)' }}>
            <h3 style={{ fontFamily: playfair.style.fontFamily, fontSize: 18, fontWeight: 700, color: styles.text, margin: 0 }}>Tóm tắt lịch hẹn</h3>
          </div>
          <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
              <span style={{ fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(241,236,225,.45)' }}>Chi nhánh</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: styles.text, textAlign: 'right' }}>{branch?.name.replace('GOODHAIR ', '') || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
              <span style={{ fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(241,236,225,.45)' }}>Barber</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: styles.text, textAlign: 'right' }}>{barberName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
              <span style={{ fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(241,236,225,.45)' }}>Thời gian</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: styles.text, textAlign: 'right' }}>{sDateTime}</span>
            </div>
            {sServices.length > 0 && (
              <div style={{ borderTop: '1px solid rgba(238,138,51,.14)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {sServices.map((ss, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span style={{ fontSize: 13, color: 'rgba(241,236,225,.75)' }}>{ss.name}</span>
                    <span style={{ fontSize: 13, color: styles.accent, whiteSpace: 'nowrap' }}>{ss.price}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ padding: '18px 22px', borderTop: '1px solid rgba(238,138,51,.18)', background: '#0B1620' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: 'rgba(241,236,225,.6)' }}>Tổng cộng</span>
              <span style={{ fontFamily: playfair.style.fontFamily, fontSize: 26, fontWeight: 700, color: styles.text }}>{total ? f(total) : '0đ'}</span>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11.5, color: 'rgba(241,236,225,.4)', marginBottom: 16 }}>{durLabel ? 'Thời lượng ~' + durLabel : 'Chưa chọn dịch vụ'}</div>
            <button onClick={onNext} disabled={!canNext || submitting} style={{ width: '100%', padding: 15, borderRadius: 3, fontFamily: hanken.style.fontFamily, fontSize: 14, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', border: 'none', cursor: canNext && !submitting ? 'pointer' : 'not-allowed', ...(canNext && !submitting ? { background: styles.accent, color: '#0B1620' } : { background: 'rgba(168,150,120,.32)', color: 'rgba(255,255,255,.5)' }) }}>
              {nextLabel}
            </button>
            {step > 1 && (
              <button onClick={() => goStep(step - 1)} style={{ width: '100%', marginTop: 10, padding: 13, borderRadius: 3, background: 'transparent', border: '1px solid rgba(238,138,51,.3)', color: 'rgba(241,236,225,.75)', fontFamily: hanken.style.fontFamily, fontSize: 13, fontWeight: 600, letterSpacing: '.04em', cursor: 'pointer' }}>
                ← Quay lại
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
