'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useLang } from '@/hooks/useLang';
import { Playfair_Display, Hanken_Grotesk } from 'next/font/google';
import {
  fetchPublicBranches,
  fetchPublicServices,
  fetchPublicEmployees,
  fetchAvailableSlots,
  createPublicBooking,
  ApiError,
  type PublicBranch,
  type PublicService,
  type PublicEmployee,
  type BookedWindow,
} from '@/services/public.api';

const playfair = Playfair_Display({ subsets: ['latin'], weight: ['500', '600', '700', '800'] });
const hanken = Hanken_Grotesk({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700', '800'] });

const f = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + ' VND';
const fk = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + ' VND';

const toTimeStr = (t: string | null) => {
  if (!t) return '';
  return t.slice(0, 5);
};
const formatHours = (open: string | null, close: string | null) => {
  if (!open || !close) return '';
  return toTimeStr(open) + '–' + toTimeStr(close);
};

const dows   = ['CN',  'T2',  'T3',  'T4',  'T5',  'T6',  'T7'];
const dowsEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

export default function BookingsClient() {
  const searchParams = useSearchParams();
  const initialStep = Math.min(Math.max(Number(searchParams.get('step')) || 1, 1), 5);
  const [step, setStep] = useState(initialStep);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, [step]);
  const [branches, setBranches] = useState<PublicBranch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [branchId, setBranchId] = useState<string | null>(searchParams.get('branchId') ?? null);
  const [barberId, setBarberId] = useState<string | null>(searchParams.get('barberId') ?? null);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [spinning, setSpinning] = useState(false);
  const [spinDisplay, setSpinDisplay] = useState<PublicEmployee | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingResult, setBookingResult] = useState<{ code: string; customerName: string; date: string; startTime: string; total: number } | null>(null);
  const { lang, setLang } = useLang();
  const [toast, setToast] = useState<string | null>(null);

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

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  // Fetch booked windows whenever a specific barber + date is selected
  useEffect(() => {
    if (!barberId || !date) {
      setBookedWindows([]);
      return;
    }
    setSlotsLoading(true);
    fetchAvailableSlots(barberId, date)
      .then(setBookedWindows)
      .catch(() => setBookedWindows([]))
      .finally(() => setSlotsLoading(false));
  }, [barberId, date]);

  const t = (vi: string, en: string) => lang === 'vi' ? vi : en;

  const branch = branches.find(b => b.id === branchId);
  const selServices = services.filter(s => serviceIds.includes(s.id));
  const total = selServices.reduce((a, s) => a + s.price, 0);
  const durMin = selServices.reduce((a, s) => a + s.durationMinutes, 0);
  const selBarber = employees.find(b => b.id === barberId);
  const barberName = selBarber?.displayName || selBarber?.name || '—';

  const durLabel = durMin
    ? (durMin >= 60
      ? Math.floor(durMin / 60) + 'h' + (durMin % 60 ? ' ' + (durMin % 60) + t('p', 'm') : '')
      : durMin + t(' phút', ' min'))
    : '';

  const base = new Date();
  const dayItems = Array.from({ length: 10 }).map((_, i) => {
    const dt = new Date(base);
    dt.setDate(base.getDate() + i);
    const key = dt.toISOString().slice(0, 10);
    const dow = lang === 'vi' ? dows[dt.getDay()] : dowsEn[dt.getDay()];
    return { key, dow, day: dt.getDate(), month: dt.getMonth() + 1, dt };
  });

  const dayObj = dayItems.find(d => d.key === date);
  const sDateTime = (dayObj && time)
    ? lang === 'vi'
      ? (dayObj.dow + ' ' + dayObj.day + '/' + dayObj.month + ' · ' + time)
      : (dayObj.dow + ' ' + dayObj.month + '/' + dayObj.day + ' · ' + time)
    : '—';

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

  const nextLabel = step === 5 ? t('Xác nhận đặt lịch', 'Confirm booking') : t('Tiếp tục →', 'Continue →');

  const goStep = (n: number) => { setStep(n); };

  const handleAnyBarber = () => {
    if (!employees.length) return;
    setTime(null);
    setBarberId(null);
    setSpinning(true);
    let i = 0;
    const total = 20;
    const tick = () => {
      const emp = employees[Math.floor(Math.random() * employees.length)];
      setSpinDisplay(emp);
      i++;
      if (i < total) {
        const delay = 55 + Math.pow(i / total, 2.5) * 420;
        setTimeout(tick, delay);
      } else {
        setBarberId(emp.id);
        setSpinDisplay(null);
        setSpinning(false);
      }
    };
    setTimeout(tick, 55);
  };

  const onNext = async () => {
    if (!canNext) return;
    if (step < 5) { goStep(step + 1); return; }
    setSubmitting(true);
    try {
      const result = await createPublicBooking({
        customerName: name,
        customerPhone: phone,
        employeeId: barberId!,
        branchId: branchId!,
        date: date!,
        startTime: time!,
        durationMinutes: durMin,
        total,
        serviceIds,
      }, lang);
      setBookingResult(result);
      setConfirmed(true);
    } catch (err) {
      const fallback = t('Đặt lịch thất bại. Vui lòng thử lại.', 'Booking failed. Please try again.');
      setToast(err instanceof ApiError ? (err.detail ?? fallback) : fallback);
    } finally {
      setSubmitting(false);
    }
  };

  const sServices = useMemo(() => selServices.map(s => ({ name: s.name, price: f(s.price) })), [selServices]);

  const stepNames = lang === 'vi'
    ? ['Chi nhánh', 'Barber', 'Dịch vụ', 'Ngày & giờ', 'Xác nhận']
    : ['Branch',    'Barber', 'Services', 'Date & Time', 'Confirm'];
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
          <h2 style={{ fontFamily: playfair.style.fontFamily, fontSize: 34, fontWeight: 700, marginTop: 28 }}>{t('Đặt lịch thành công!', 'Booking confirmed!')}</h2>
          <p style={{ color: 'rgba(241,236,225,.6)', fontSize: 15, marginTop: 12, lineHeight: 1.6 }}>{t(`Cảm ơn ${name || 'bạn'}. Lịch hẹn đã được xác nhận. Chúng tôi sẽ rất mong sẽ được phục vụ bạn`, `Thank you ${name || 'you'}. Your appointment is confirmed. We look forward to seeing you.`)}</p>
          <div style={{ marginTop: 34, background: styles.cardBg, border: `1px solid ${styles.borderLight}`, borderRadius: 6, padding: 26, textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 16, borderBottom: '1px solid rgba(238,138,51,.14)' }}>
              <span style={{ fontSize: 12, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(241,236,225,.45)' }}>{t('Mã đặt lịch', 'Booking code')}</span>
              <span style={{ fontFamily: playfair.style.fontFamily, fontSize: 20, fontWeight: 700, color: styles.accent, letterSpacing: '.08em' }}>{code}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'rgba(241,236,225,.5)', fontSize: 13.5 }}>{t('Chi nhánh', 'Branch')}</span><span style={{ fontWeight: 600, fontSize: 13.5 }}>{branch?.name.replace('GOODHAIR ', '') || '—'}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'rgba(241,236,225,.5)', fontSize: 13.5 }}>Barber</span><span style={{ fontWeight: 600, fontSize: 13.5 }}>{barberName}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'rgba(241,236,225,.5)', fontSize: 13.5 }}>{t('Thời gian', 'Time')}</span><span style={{ fontWeight: 600, fontSize: 13.5 }}>{sDateTime}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'rgba(241,236,225,.5)', fontSize: 13.5 }}>{t('Tổng cộng', 'Total')}</span><span style={{ fontWeight: 700, fontSize: 13.5, color: styles.accent }}>{total ? f(total) : '0 VND'}</span></div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 30, flexWrap: 'wrap' }}>
            <a href="/" style={{ textDecoration: 'none', border: `1px solid rgba(238,138,51,.3)`, color: styles.text, padding: '14px 28px', borderRadius: 3, fontSize: 13, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>{t('Về trang chủ', 'Back to home')}</a>
            <button onClick={() => { setStep(1); setBranchId(null); setBarberId(null); setServiceIds([]); setDate(null); setTime(null); setName(''); setPhone(''); setConfirmed(false); setBookingResult(null); }} style={{ background: styles.accent, color: '#0B1620', border: 'none', padding: '14px 28px', borderRadius: 3, fontSize: 13, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer', fontFamily: hanken.style.fontFamily }}>{t('Đặt lịch khác', 'Book again')}</button>
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
          <span style={{ fontSize: 12, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(241,236,225,.5)' }}>{t('Đặt lịch online', 'Book appointment')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <button onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')} style={{ background: 'transparent', border: 'none', color: 'rgba(241,236,225,.45)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <span style={{ fontFamily: hanken.style.fontFamily, fontSize: 11, fontWeight: 600, letterSpacing: '.08em' }}>{lang === 'vi' ? 'EN' : 'VI'}</span>
            </button>
            <a href="/" style={{ textDecoration: 'none', color: 'rgba(241,236,225,.6)', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>✕ {t('Đóng', 'Close')}</a>
          </div>
        </div>
      </header>

      {/* STEPPER */}
      <div style={styles.stepper}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 0 }}>
          {stepItems.map((st, i) => {
            const clickable = st.done || (st.n === step + 1 && canNext);
            return (
              <div
                key={i}
                className="bk-step-item"
                onClick={clickable ? () => goStep(st.n) : undefined}
                style={{ display: 'flex', alignItems: 'center', flex: 1, cursor: clickable ? 'pointer' : 'default', transition: 'opacity .2s' }}
                onMouseEnter={clickable ? e => { e.currentTarget.style.opacity = '0.7'; } : undefined}
                onMouseLeave={clickable ? e => { e.currentTarget.style.opacity = '1'; } : undefined}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{
                    width: 34, height: 34, borderRadius: '50%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0,
                    ...((st.active || st.done)
                      ? { background: styles.accent, color: '#0B1620' }
                      : { background: 'transparent', color: 'rgba(241,236,225,.45)', border: '1px solid rgba(238,138,51,.3)' }),
                  }}>{st.badge}</span>
                  <div className="bk-step-text">
                    <div style={{ fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(241,236,225,.4)' }}>{t('Bước', 'Step')} {st.n}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: (st.active || st.done) ? styles.text : 'rgba(241,236,225,.45)' }}>{st.label}</div>
                  </div>
                </div>
                {i < 4 && (
                  <span className="bk-step-connector" style={{ flex: 1, height: 1, margin: '0 14px', background: st.done ? 'rgba(238,138,51,.5)' : 'rgba(238,138,51,.15)' }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* BODY GRID */}
      <div id="bk-grid" style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 24px 60px', display: 'grid', gridTemplateColumns: '1fr 360px', gap: 36, alignItems: 'start' }}>
        {/* STEP PANEL */}
        <div style={{ minHeight: 420, minWidth: 0 }}>
          {/* STEP 1: BRANCH */}
          {step === 1 && (
            <div>
              <h2 style={{ fontFamily: playfair.style.fontFamily, fontSize: 28, fontWeight: 700 }}>{t('Chọn chi nhánh', 'Choose branch')}</h2>
              <p style={{ color: styles.muted, fontSize: 14, marginTop: 6 }}>{t('Chọn cơ sở GOODHAIR thuận tiện nhất với bạn.', 'Choose the most convenient GOODHAIR location.')}</p>
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
                        <div key={b.id} onClick={() => { setBranchId(b.id); setBarberId(null); }} style={{ borderRadius: 6, overflow: 'hidden', cursor: 'pointer', background: sel ? styles.selectedBg : styles.cardBg, border: sel ? `1px solid ${styles.accent}` : `1px solid rgba(238,138,51,.16)` }}>
                          <div style={{ width: '100%', height: 128, background: 'linear-gradient(150deg,#16110C,#2a211a)', borderBottom: '1px solid rgba(238,138,51,.14)', position: 'relative', overflow: 'hidden' }}>
                            {b.imageUrl && <img src={b.imageUrl} alt={b.name} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
                          </div>
                          <div style={{ padding: '18px 20px' }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                              <h3 style={{ fontFamily: playfair.style.fontFamily, fontSize: 18, fontWeight: 700, color: styles.text, margin: 0 }}>{b.name}</h3>
                              <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, ...(sel ? { background: styles.accent, color: '#0B1620' } : { border: '1px solid rgba(238,138,51,.3)' }) }}>{sel ? '✓' : ''}</span>
                            </div>
                            <p style={{ fontSize: 13, color: styles.muted, marginTop: 8, lineHeight: 1.5 }}>{b.address}</p>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                              <span style={{ fontSize: 11.5, color: styles.accent }}>{formatHours(b.openingTime, b.closingTime)}</span>
                              {b.rating > 0 && (
                                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#f5c842' }}>
                                  ★ <span style={{ color: styles.text }}>{b.rating.toFixed(1)}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
              </div>
            </div>
          )}

          {/* STEP 2: BARBER */}
          {step === 2 && (
            <div>
              <h2 style={{ fontFamily: playfair.style.fontFamily, fontSize: 28, fontWeight: 700 }}>{t('Chọn barber', 'Choose barber')}</h2>
              <p style={{ color: styles.muted, fontSize: 14, marginTop: 6 }}>{t('Barber tại', 'Barbers at')} {branch?.name || '...'}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(230px,1fr))', gap: 14, marginTop: 24 }}>
                {employeesLoading && Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} style={{ borderRadius: 4, background: styles.cardBg, border: '1px solid rgba(238,138,51,.16)', padding: 18, display: 'flex', gap: 14, alignItems: 'center' }}>
                    <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#16110C', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ width: '60%', height: 15, background: 'rgba(241,236,225,.1)', borderRadius: 2 }} />
                      <div style={{ width: '40%', height: 12, background: 'rgba(241,236,225,.06)', borderRadius: 2, marginTop: 8 }} />
                    </div>
                  </div>
                ))}
                {!employeesLoading && employees.length === 0 && (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '48px 20px', color: 'rgba(241,236,225,.45)', fontSize: 14 }}>
                    {t('Chi nhánh này chưa có barber', 'No barbers at this location yet')}
                  </div>
                )}
                {!employeesLoading && employees.length > 0 && (
                  <div className={spinning ? 'bk-slot-spin' : ''} style={{ borderRadius: 4, border: spinning ? '2px solid #EE8A33' : '1px dashed rgba(238,138,51,.45)', background: spinning ? '#13283a' : styles.cardBg, overflow: 'hidden' }}>
                    {spinning ? (
                      <div style={{ padding: 18, display: 'flex', gap: 14, alignItems: 'center' }}>
                        {spinDisplay?.avatarUrl ? (
                          <img src={spinDisplay.avatarUrl} alt={spinDisplay.name} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `2px solid ${styles.accent}` }} />
                        ) : (
                          <span style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: styles.accent, color: '#0B1620', fontFamily: playfair.style.fontFamily, fontWeight: 700, fontSize: 17 }}>
                            {spinDisplay ? spinDisplay.name.split(' ').map((s: string) => s[0]).join('').slice(0, 2).toUpperCase() : '?'}
                          </span>
                        )}
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: styles.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{spinDisplay?.displayName || spinDisplay?.name || '...'}</div>
                          <div style={{ fontSize: 12, color: styles.accent, marginTop: 2 }}>{t('Đang chọn ngẫu nhiên...', 'Picking randomly...')}</div>
                        </div>
                      </div>
                    ) : (
                      <button onClick={handleAnyBarber} style={{ display: 'flex', gap: 14, alignItems: 'center', width: '100%', padding: 18, cursor: 'pointer', background: 'transparent', border: 'none', textAlign: 'left', fontFamily: hanken.style.fontFamily }}>
                        <span style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#16110C', color: styles.accent, fontFamily: playfair.style.fontFamily, fontWeight: 700, fontSize: 22 }}>★</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 700, color: styles.text }}>{t('Bất kỳ barber nào', 'Any barber')}</div>
                          <div style={{ fontSize: 12, color: 'rgba(241,236,225,.5)', marginTop: 2 }}>{t('Hệ thống chọn random barber', 'System picks a random barber')}</div>
                        </div>
                      </button>
                    )}
                  </div>
                )}
                {!employeesLoading && employees.map(bb => {
                  const sel = bb.id === barberId && !spinning;
                  const initials = bb.name.split(' ').map((s: string) => s[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <button key={bb.id} disabled={spinning} onClick={() => { setBarberId(bb.id); setTime(null); }} style={{ textAlign: 'left', cursor: spinning ? 'default' : 'pointer', padding: 18, borderRadius: 4, fontFamily: hanken.style.fontFamily, display: 'flex', gap: 14, alignItems: 'center', width: '100%', opacity: spinning ? 0.4 : 1, transition: 'opacity .15s, background .15s', border: sel ? `1px solid ${styles.accent}` : '1px solid rgba(238,138,51,.16)', background: sel ? styles.selectedBg : styles.cardBg }}>
                      {bb.avatarUrl ? (
                        <img src={bb.avatarUrl} alt={bb.name} style={{ width: 52, height: 52, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <span style={{ width: 52, height: 52, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: playfair.style.fontFamily, fontWeight: 700, fontSize: 18, ...(sel ? { background: styles.accent, color: '#0B1620' } : { background: '#16110C', color: styles.accent }) }}>{initials}</span>
                      )}
                      <div style={{ flex: 1 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, color: styles.text, margin: 0 }}>{bb.displayName || bb.name}</h3>
                        {bb.roleName && <p style={{ fontSize: 12, color: 'rgba(241,236,225,.5)', marginTop: 2 }}>{bb.roleName}</p>}
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
              <h2 style={{ fontFamily: playfair.style.fontFamily, fontSize: 28, fontWeight: 700 }}>{t('Chọn dịch vụ', 'Choose services')}</h2>
              <p style={{ color: styles.muted, fontSize: 14, marginTop: 6 }}>{t('Có thể chọn nhiều dịch vụ. Combo đã gồm gội massage.', 'Select multiple services. Combos include scalp massage.')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 24 }}>
                {servicesLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} style={{ padding: '18px 20px', borderRadius: 4, background: styles.cardBg, border: '1px solid rgba(238,138,51,.16)' }}>
                        <div style={{ width: '40%', height: 16, background: 'rgba(241,236,225,.1)', borderRadius: 2 }} />
                        <div style={{ width: '60%', height: 12, background: 'rgba(241,236,225,.06)', borderRadius: 2, marginTop: 8 }} />
                      </div>
                    ))
                  : services.length === 0
                  ? (
                      <div style={{ textAlign: 'center', padding: '48px 20px', color: 'rgba(241,236,225,.45)', fontSize: 14 }}>
                        {t('Chi nhánh này chưa có dịch vụ', 'No services at this location yet')}
                      </div>
                    )
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
                        <div style={{ fontSize: 11, color: 'rgba(241,236,225,.45)' }}>{sv.durationMinutes} {t('phút', 'min')}</div>
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
              <h2 style={{ fontFamily: playfair.style.fontFamily, fontSize: 28, fontWeight: 700 }}>{t('Chọn ngày & giờ', 'Choose date & time')}</h2>
              <p style={{ color: styles.muted, fontSize: 14, marginTop: 6 }}>{t('Khung giờ trống được cập nhật theo thời gian thực.', 'Available slots are updated in real time.')}</p>
              <div style={{ display: 'flex', gap: 10, marginTop: 24, overflowX: 'auto', paddingBottom: 6 }}>
                {dayItems.map(d => {
                  const sel = d.key === date;
                  return (
                    <button key={d.key} onClick={() => { setDate(d.key); setTime(null); }} style={{ cursor: 'pointer', flexShrink: 0, width: 64, padding: '14px 0', borderRadius: 6, textAlign: 'center', fontFamily: hanken.style.fontFamily, border: 'none', ...(sel ? { background: styles.accent, color: '#0B1620' } : { background: styles.cardBg, color: styles.text, border: '1px solid rgba(238,138,51,.16)' }) }}>
                      <div style={{ fontSize: 11, letterSpacing: '.04em', opacity: 0.7 }}>{d.dow}</div>
                      <div style={{ fontFamily: playfair.style.fontFamily, fontSize: 22, fontWeight: 700, margin: '2px 0' }}>{d.day}</div>
                      <div style={{ fontSize: 10, opacity: 0.6 }}>{lang === 'vi' ? 'Th' + d.month : '/' + d.month}</div>
                    </button>
                  );
                })}
              </div>
              <h3 style={{ fontSize: 13, letterSpacing: '.1em', textTransform: 'uppercase', color: styles.accent, margin: '28px 0 14px' }}>
                {!date ? t('Chọn ngày để xem khung giờ', 'Select a date to see slots') : slotsLoading ? t('Đang tải khung giờ…', 'Loading slots…') : t('Khung giờ trống', 'Available slots')}
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
              <h2 style={{ fontFamily: playfair.style.fontFamily, fontSize: 28, fontWeight: 700 }}>{t('Xác nhận & thông tin', 'Confirm & details')}</h2>
              <p style={{ color: styles.muted, fontSize: 14, marginTop: 6 }}>{t('Nhập thông tin để chúng tôi xác nhận lịch hẹn.', 'Enter your details to confirm the appointment.')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginTop: 26, maxWidth: 480 }}>
                <div>
                  <label style={{ fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(241,236,225,.5)', display: 'block', marginBottom: 8 }}>{t('Họ và tên', 'Full name')}</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder={t('Nguyễn Văn A', 'John Doe')} style={{ width: '100%', background: styles.cardBg, border: '1px solid rgba(238,138,51,.25)', color: styles.text, padding: '14px 16px', borderRadius: 4, fontFamily: hanken.style.fontFamily, fontSize: 15, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(241,236,225,.5)', display: 'block', marginBottom: 8 }}>{t('Số điện thoại', 'Phone number')}</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="09xx xxx xxx" style={{ width: '100%', background: styles.cardBg, border: '1px solid rgba(238,138,51,.25)', color: styles.text, padding: '14px 16px', borderRadius: 4, fontFamily: hanken.style.fontFamily, fontSize: 15, outline: 'none' }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SUMMARY SIDEBAR */}
        <div id="bk-summary" style={{ position: 'sticky', top: 96, background: styles.cardBg, border: `1px solid ${styles.borderLight}`, borderRadius: 6, overflow: 'hidden' }}>
          <div style={{ padding: '20px 22px', borderBottom: '1px solid rgba(238,138,51,.14)' }}>
            <h3 style={{ fontFamily: playfair.style.fontFamily, fontSize: 18, fontWeight: 700, color: styles.text, margin: 0 }}>{t('Tóm tắt lịch hẹn', 'Booking summary')}</h3>
          </div>
          <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
              <span style={{ fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(241,236,225,.45)' }}>{t('Chi nhánh', 'Branch')}</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: styles.text, textAlign: 'right' }}>{branch?.name.replace('GOODHAIR ', '') || '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
              <span style={{ fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(241,236,225,.45)' }}>Barber</span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: styles.text, textAlign: 'right' }}>{barberName}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14 }}>
              <span style={{ fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(241,236,225,.45)' }}>{t('Thời gian', 'Time')}</span>
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
              <span style={{ fontSize: 13, color: 'rgba(241,236,225,.6)' }}>{t('Tổng cộng', 'Total')}</span>
              <span style={{ fontFamily: playfair.style.fontFamily, fontSize: 26, fontWeight: 700, color: styles.text }}>{total ? f(total) : '0 VND'}</span>
            </div>
            <div style={{ textAlign: 'right', fontSize: 11.5, color: 'rgba(241,236,225,.4)', marginBottom: 16 }}>{durLabel ? t('Thời lượng ~', 'Duration ~') + durLabel : t('Chưa chọn dịch vụ', 'No services selected')}</div>
            <button onClick={onNext} disabled={!canNext || submitting} style={{ width: '100%', padding: 15, borderRadius: 3, fontFamily: hanken.style.fontFamily, fontSize: 14, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', border: 'none', cursor: canNext && !submitting ? 'pointer' : 'not-allowed', ...(canNext && !submitting ? { background: styles.accent, color: '#0B1620' } : { background: 'rgba(168,150,120,.32)', color: 'rgba(255,255,255,.5)' }) }}>
              {nextLabel}
            </button>
            {step > 1 && (
              <button onClick={() => goStep(step - 1)} style={{ width: '100%', marginTop: 10, padding: 13, borderRadius: 3, background: 'transparent', border: '1px solid rgba(238,138,51,.3)', color: 'rgba(241,236,225,.75)', fontFamily: hanken.style.fontFamily, fontSize: 13, fontWeight: 600, letterSpacing: '.04em', cursor: 'pointer' }}>
                {t('← Quay lại', '← Back')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div style={{ position: 'fixed', top: 24, right: 24, zIndex: 1000, width: 'min(380px,90vw)', animation: 'toast-in .38s cubic-bezier(.22,.61,.36,1) both', pointerEvents: 'auto' }}>
          <div style={{ background: '#130E0E', border: '1px solid rgba(220,60,60,.35)', borderLeft: '3px solid #E05050', borderRadius: 6, padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: 12, boxShadow: '0 16px 48px rgba(0,0,0,.55)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E05050" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span style={{ flex: 1, fontSize: 14, lineHeight: 1.5, color: '#F1ECE1' }}>{toast}</span>
            <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', color: 'rgba(241,236,225,.4)', cursor: 'pointer', padding: '0 2px', fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slot-glow {
          0%   { box-shadow: 0 0 0 2px rgba(238,138,51,.3), 0 0 12px rgba(238,138,51,.2); border-color: #EE8A33; }
          50%  { box-shadow: 0 0 0 3px rgba(245,200,66,.5), 0 0 22px rgba(245,200,66,.35); border-color: #f5c842; }
          100% { box-shadow: 0 0 0 2px rgba(238,138,51,.3), 0 0 12px rgba(238,138,51,.2); border-color: #EE8A33; }
        }
        .bk-slot-spin { animation: slot-glow 0.35s ease-in-out infinite; }
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 768px) {
          #bk-grid { grid-template-columns: 1fr !important; padding: 24px 16px 48px !important; }
          #bk-summary { position: static !important; }
        }
        @media (max-width: 600px) {
          .bk-step-text { display: none !important; }
          .bk-step-connector { display: none !important; }
          .bk-step-item { justify-content: center !important; }
        }
        @media (max-width: 480px) {
          header > div { padding: 12px 16px !important; }
          header span[style*="letter-spacing"] { display: none !important; }
        }
      `}</style>
    </div>
  );
}
