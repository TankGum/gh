'use client';

import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { useLang } from '@/hooks/useLang';
import Link from 'next/link';
import { Playfair_Display, Hanken_Grotesk } from 'next/font/google';
import {
  fetchPublicServices,
  fetchPublicBranches,
  fetchPublicEmployees,
  fetchPublicStats,
  type PublicBranch,
  type PublicEmployee,
  type PublicService,
  type PublicStats,
} from '@/services/public.api';
import { getMe } from '@/services/auth.api';
import type { Me } from '@/types/account.type';
import BranchMap from '@/components/ui/BranchMap';
import { FACEBOOK_URL, MESSENGER_URL, CONTACT_EMAIL, CONTACT_PHONE, FOUNDING_YEAR, HAPPY_CLIENTS, HERO_RATING, HERO_RATING_MAX, HERO_REVIEW_COUNT } from '@/constants';


const playfairDisplay = Playfair_Display({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700', '800', '900'],
  display: 'swap',
  variable: '--font-playfair',
});

const hankenGrotesk = Hanken_Grotesk({
  subsets: ['latin', 'vietnamese'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-hanken',
});


export default function HomePage() {
  const { lang, setLang } = useLang();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [servicesList, setServicesList] = useState<PublicService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [branchesList, setBranchesList] = useState<PublicBranch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [employeesList, setEmployeesList] = useState<PublicEmployee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [nearestBranchId, setNearestBranchId] = useState<string | null>(null);
  const [nearestDistance, setNearestDistance] = useState<number | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const headerRef = useRef<HTMLElement>(null);

  // Scroll listener for sticky header
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Fetch services
  useEffect(() => {
    fetchPublicServices({ size: 20 })
      .then(res => setServicesList(res.items))
      .catch(() => {})
      .finally(() => setServicesLoading(false));
  }, []);

  // Get user location
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation không được hỗ trợ');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => setLocationError(err.message),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  // Find nearest branch when location & branches are ready
  useEffect(() => {
    if (!userLocation || branchesList.length === 0) return;
    const branchesWithCoords = branchesList.filter(b => b.latitude != null && b.longitude != null);
    if (branchesWithCoords.length === 0) return;

    const deg2rad = (d: number) => d * Math.PI / 180;
    const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371;
      const dLat = deg2rad(lat2 - lat1);
      const dLng = deg2rad(lng2 - lng1);
      const a = Math.sin(dLat / 2) ** 2
              + Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2))
              * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    };

    let nearest = branchesWithCoords[0];
    let minDist = haversine(userLocation.lat, userLocation.lng, nearest.latitude!, nearest.longitude!);
    for (let i = 1; i < branchesWithCoords.length; i++) {
      const b = branchesWithCoords[i];
      const d = haversine(userLocation.lat, userLocation.lng, b.latitude!, b.longitude!);
      if (d < minDist) { minDist = d; nearest = b; }
    }
    setNearestBranchId(nearest.id);
    setNearestDistance(Math.round(minDist * 10) / 10);
  }, [userLocation, branchesList]);

  // Fetch branches
  useEffect(() => {
    fetchPublicBranches({ size: 20 })
      .then(res => setBranchesList(res.items))
      .catch(() => {})
      .finally(() => setBranchesLoading(false));
  }, []);

  // Fetch employees
  useEffect(() => {
    fetchPublicEmployees({ size: 20 })
      .then(res => setEmployeesList(res.items))
      .catch(() => {})
      .finally(() => setEmployeesLoading(false));
  }, []);

  // Fetch public stats
  useEffect(() => {
    fetchPublicStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  // Check auth
  useEffect(() => {
    getMe()
      .then(user => setMe(user))
      .catch(() => setMe(null))
      .finally(() => setAuthChecked(true));
  }, []);

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('vi-VN').format(price) + ' VND';

  const t = useCallback(
    (vi: string, en: string) => {
      return lang === 'vi' ? vi : en;
    },
    [lang]
  );

  function AnimatedSection({ children, delay }: { children: ReactNode; delay: number }) {
    return (
      <div style={{ animation: `ghFadeUp .7s cubic-bezier(.25,.46,.45,.94) ${delay}s both` }}>
        {children}
      </div>
    );
  }

  return (
    <div
      className={`${playfairDisplay.variable} ${hankenGrotesk.variable}`}
      style={{ background: '#0B1620', color: '#F1ECE1', fontFamily: "'Hanken Grotesk', sans-serif", overflowX: 'hidden', position: 'relative' }}
    >
      {/* HEADER */}
      <header
        ref={headerRef}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50,
          transition: 'background .45s ease, border-color .45s ease, box-shadow .45s ease',
          background: scrolled ? 'rgba(7,14,22,0.92)' : 'transparent',
          borderBottom: `1px solid ${scrolled ? 'rgba(238,138,51,.16)' : 'transparent'}`,
          backdropFilter: scrolled ? 'blur(24px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(24px)' : 'none',
          boxShadow: scrolled ? '0 1px 0 rgba(238,138,51,.06), 0 12px 40px rgba(0,0,0,.3)' : 'none',
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 32px', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

          {/* Logo */}
          <a href="#top" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <img src="/logo/logo.jpg" alt="GOODHAIR" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover' }} />
            <div style={{ display: 'flex' }}>
              <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: 22, letterSpacing: '.04em', color: '#F1ECE1' }}>GOOD</span><span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: 22, letterSpacing: '.04em', color: '#EE8A33' }}>HAIR</span>
            </div>
          </a>

          {/* Desktop nav */}
          <nav id="gh-nav" style={{ display: 'flex', alignItems: 'center', gap: 30 }}>
            {([
              { href: '#about',    label: t('Giới thiệu', 'About') },
              { href: '#services', label: t('Dịch vụ',    'Services') },
              { href: '#barbers',  label: t('Barber',     'Barbers') },
              { href: '#branches', label: t('Chi nhánh',  'Locations') },
            ] as const).map(item => (
              <a key={item.href} href={item.href} className="gh-nav-link"
                style={{ textDecoration: 'none', color: 'rgba(241,236,225,.68)', fontSize: 13.5, fontWeight: 500, letterSpacing: '.025em', position: 'relative', padding: '4px 0', whiteSpace: 'nowrap' }}>
                {item.label}
              </a>
            ))}
          </nav>

          {/* Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {/* Desktop-only controls */}
            <div className="gh-hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
                style={{ background: 'transparent', border: 'none', color: 'rgba(241,236,225,.55)', padding: '4px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
                <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '.08em' }}>{lang === 'vi' ? 'EN' : 'VI'}</span>
              </button>
              {me ? (
                <Link href="/services"
                  style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', border: '1px solid rgba(238,138,51,.3)', color: '#F1ECE1', padding: '5px 12px 5px 5px', borderRadius: 30, fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  {me.avatarUrl ? (
                    <img src={me.avatarUrl} alt={me.name} style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#EE8A33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#0B1620', flexShrink: 0 }}>
                      {me.name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  )}
                  {me.name}
                </Link>
              ) : authChecked && (
                <Link href="/login"
                  style={{ textDecoration: 'none', border: '1px solid rgba(238,138,51,.3)', color: 'rgba(241,236,225,.8)', padding: '9px 16px', borderRadius: 2, fontSize: 13, fontWeight: 500, letterSpacing: '.03em', whiteSpace: 'nowrap' }}>
                  {t('Đăng nhập', 'Sign in')}
                </Link>
              )}
              <Link href="/bookings"
                style={{ textDecoration: 'none', background: '#EE8A33', color: '#0B1620', padding: '10px 20px', borderRadius: 2, fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                {t('Đặt lịch', 'Book now')}
              </Link>
            </div>

            {/* Hamburger — hidden on desktop, shown on mobile via CSS */}
            <button
              className="gh-hamburger"
              onClick={() => setMobileOpen(!mobileOpen)}
              style={{ display: 'none', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, color: '#EE8A33', marginRight: -8 }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar backdrop */}
      <div
        onClick={() => setMobileOpen(false)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 98, opacity: mobileOpen ? 1 : 0, pointerEvents: mobileOpen ? 'auto' : 'none', transition: 'opacity .38s ease' }}
      />

      {/* Sidebar — slides from right */}
      <div
        className={mobileOpen ? 'gh-sb-open' : ''}
        style={{ position: 'fixed', top: 0, right: 0, width: 'min(320px, 88vw)', height: '100vh', background: 'linear-gradient(150deg,#0D1E2E 0%,#080D14 100%)', borderLeft: '1px solid rgba(238,138,51,.2)', zIndex: 99, transform: mobileOpen ? 'translateX(0)' : 'translateX(100%)', transition: 'transform .44s cubic-bezier(.32,.72,0,1)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}
      >
        {/* Sidebar header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 24px', borderBottom: '1px solid rgba(238,138,51,.1)', flexShrink: 0 }}>
          <a href="#top" onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline' }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: 20, color: '#F1ECE1', letterSpacing: '.04em' }}>GOOD</span>
            <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: 20, color: '#EE8A33', letterSpacing: '.04em' }}>HAIR</span>
          </a>
          <button
            onClick={() => setMobileOpen(false)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, background: 'transparent', border: 'none', cursor: 'pointer', color: 'rgba(241,236,225,.55)', flexShrink: 0 }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <line x1="1" y1="1" x2="15" y2="15"/><line x1="15" y1="1" x2="1" y2="15"/>
            </svg>
          </button>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '12px 0' }}>
          {([
            { href: '#about',    label: t('Giới thiệu', 'About') },
            { href: '#services', label: t('Dịch vụ',    'Services') },
            { href: '#barbers',  label: t('Barber',     'Barbers') },
            { href: '#branches', label: t('Chi nhánh',  'Locations') },
          ] as const).map(item => (
            <a key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
              className="gh-sb-item"
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 24px', color: 'rgba(241,236,225,.75)', fontSize: 15, fontWeight: 500, letterSpacing: '.02em', borderBottom: '1px solid rgba(238,138,51,.06)' }}>
              <span>{item.label}</span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="rgba(238,138,51,.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="2" y1="7" x2="12" y2="7"/><polyline points="8,3 12,7 8,11"/>
              </svg>
            </a>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div style={{ padding: '20px 24px', borderTop: '1px solid rgba(238,138,51,.12)', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
          {/* Lang toggle */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 2 }}>
            <button
              onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
              style={{ background: 'transparent', border: 'none', color: 'rgba(241,236,225,.45)', padding: '4px 2px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '.08em' }}>{lang === 'vi' ? 'EN' : 'VI'}</span>
            </button>
          </div>
          {me ? (
            <Link href="/services" onClick={() => setMobileOpen(false)}
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', color: '#F1ECE1', fontSize: 14, fontWeight: 600, border: '1px solid rgba(238,138,51,.18)', borderRadius: 2 }}>
              {me.avatarUrl ? (
                <img src={me.avatarUrl} alt={me.name} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#EE8A33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#0B1620', flexShrink: 0 }}>
                  {me.name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()}
                </span>
              )}
              {t('Bảng điều khiển', 'Dashboard')}
            </Link>
          ) : (
            <Link href="/login" onClick={() => setMobileOpen(false)}
              style={{ textDecoration: 'none', border: '1px solid rgba(238,138,51,.3)', color: 'rgba(241,236,225,.8)', fontSize: 13, fontWeight: 500, padding: '12px', textAlign: 'center', borderRadius: 2, display: 'block', letterSpacing: '.04em' }}>
              {t('Đăng nhập', 'Sign in')}
            </Link>
          )}
          <Link href="/bookings" onClick={() => setMobileOpen(false)}
            style={{ textDecoration: 'none', background: '#EE8A33', color: '#0B1620', textAlign: 'center', padding: '14px', borderRadius: 2, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', fontSize: 13, display: 'block' }}>
            {t('Đặt lịch ngay', 'Book now')}
          </Link>
        </div>
      </div>

      {/* HERO */}
      <section id="top" style={{ position: 'relative', padding: '150px 28px 90px', background: 'radial-gradient(120% 90% at 80% 0%,#102536 0%,#0B1620 55%)' }}>
        <div id="gh-hero-grid" style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.15fr .85fr', gap: 56, alignItems: 'center' }}>
          <div>
            <div className="gh-hero-badge" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 26 }}>
              <span className="gh-hero-line" style={{ width: 38, height: 1, background: '#EE8A33' }} />
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.26em', textTransform: 'uppercase', color: '#EE8A33' }}>{t('Barbershop Cao Cấp · Est. 2024', 'Premium Barbershop · Est. 2024')}</span>
            </div>
            <h1 className="gh-hero-h1" style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: 'clamp(48px,7.4vw,104px)', lineHeight: .96, letterSpacing: '-.01em', color: '#F1ECE1' }}>
              Good hair,<br /><span style={{ fontStyle: 'italic', fontWeight: 600, color: '#EE8A33' }}>good mood.</span>
            </h1>
            <p className="gh-hero-p" style={{ marginTop: 28, maxWidth: 480, fontSize: 17, lineHeight: 1.65, color: 'rgba(241,236,225,.66)', fontWeight: 300 }}>
              {t('Nghệ thuật chăm sóc tóc nam đẳng cấp. Đội ngũ barber bậc thầy, không gian tinh tế, đặt lịch chỉ trong 30 giây — để bạn luôn bước ra với phiên bản hoàn hảo nhất.', 'The art of premium men\'s grooming. Master barbers, a refined space, and a booking that takes 30 seconds — so you always walk out at your best.')}
            </p>
            <div className="gh-hero-cta" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 38 }}>
              <Link href="/bookings" style={{ textDecoration: 'none', background: '#EE8A33', color: '#0B1620', padding: '17px 34px', borderRadius: 2, fontSize: 14, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                {t('Đặt lịch ngay', 'Book an appointment')}
              </Link>
              <a href="#services" style={{ textDecoration: 'none', border: '1px solid rgba(238,138,51,.45)', color: '#F1ECE1', padding: '17px 34px', borderRadius: 2, fontSize: 14, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                {t('Xem dịch vụ', 'View services')}
              </a>
            </div>
            <div id="gh-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 64, borderTop: '1px solid rgba(238,138,51,.18)', paddingTop: 30 }}>
              {stats
                ? [
                    { value: `${Math.max(1, new Date().getFullYear() - FOUNDING_YEAR)}+`, label: t('Năm kinh nghiệm', 'Years of craft') },
                    { value: String(stats.branches), label: t('Chi nhánh', 'Locations') },
                    { value: `${stats.barbers}+`, label: t('Barber', 'Master barbers') },
                    { value: `${HAPPY_CLIENTS >= 1000 ? Math.round(HAPPY_CLIENTS / 1000) + 'K' : HAPPY_CLIENTS}+`, label: t('Khách hàng', 'Happy clients') },
                  ].map(stat => (
                    <div key={stat.label}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 700, color: '#F1ECE1' }}>{stat.value}</div>
                      <div style={{ fontSize: 12, letterSpacing: '.06em', color: 'rgba(241,236,225,.5)', marginTop: 4 }}>{stat.label}</div>
                    </div>
                  ))
                : [1, 2, 3, 4].map(i => (
                    <div key={i}>
                      <div style={{ width: '60%', height: 36, background: 'rgba(241,236,225,.08)', borderRadius: 2 }} />
                      <div style={{ width: '80%', height: 12, background: 'rgba(241,236,225,.04)', borderRadius: 2, marginTop: 8 }} />
                    </div>
                  ))}
            </div>
          </div>
          <div id="gh-hero-media" style={{ position: 'relative' }}>
            <div className="gh-hero-imgbox" style={{ position: 'relative', aspectRatio: '3/4', border: '1px solid rgba(238,138,51,.3)', background: '#1C1C1C', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img className="gh-hero-img-inner" src="/hero_image/hero.jpg" alt="GOODHAIR — Haircuts & Shaves" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
              <span style={{ position: 'absolute', top: 0, right: 0, width: 22, height: 22, borderTop: '1px solid #EE8A33', borderRight: '1px solid #EE8A33', margin: 14 }} />
              <span style={{ position: 'absolute', bottom: 0, left: 0, width: 22, height: 22, borderBottom: '1px solid #EE8A33', borderLeft: '1px solid #EE8A33', margin: 14 }} />
            </div>
            <div className="gh-hero-rating" style={{ position: 'absolute', left: -26, bottom: 36, background: '#F1ECE1', color: '#15110C', padding: '16px 20px', borderRadius: 2, boxShadow: '0 24px 60px rgba(0,0,0,.45)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#EE8A33', fontSize: 18, letterSpacing: 2 }}>★★★★★</span>
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 22, marginTop: 4 }}>{HERO_RATING}<span style={{ fontSize: 13, color: 'rgba(21,17,12,.5)', fontFamily: "'Hanken Grotesk', sans-serif", fontWeight: 500 }}> / {HERO_RATING_MAX}</span></div>
              <div style={{ fontSize: 11, letterSpacing: '.04em', color: 'rgba(21,17,12,.55)' }}>{t(`${HERO_REVIEW_COUNT} đánh giá`, `${HERO_REVIEW_COUNT} reviews`)}</div>
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <style>{`
        @keyframes gh-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes ghFadeUp {
          from { opacity: 0; transform: translateY(48px); }
          to { opacity: 1; transform: translateY(0); }
        }
        /* Header nav link hover underline */
        .gh-nav-link::after {
          content: '';
          position: absolute;
          bottom: -1px; left: 0;
          width: 0; height: 1px;
          background: #EE8A33;
          transition: width .28s cubic-bezier(.22,.61,.36,1);
        }
        .gh-nav-link:hover { color: #F1ECE1 !important; }
        .gh-nav-link:hover::after { width: 100%; }

        /* Sidebar item enter animation + hover */
        .gh-sb-item {
          opacity: 0;
          transform: translateX(14px);
          transition: opacity .32s ease, transform .32s ease, color .2s ease, background .2s ease, padding-left .2s ease;
        }
        .gh-sb-open .gh-sb-item { opacity: 1; transform: translateX(0); }
        .gh-sb-open .gh-sb-item:nth-child(1) { transition-delay: .06s; }
        .gh-sb-open .gh-sb-item:nth-child(2) { transition-delay: .11s; }
        .gh-sb-open .gh-sb-item:nth-child(3) { transition-delay: .16s; }
        .gh-sb-open .gh-sb-item:nth-child(4) { transition-delay: .21s; }
        .gh-sb-open .gh-sb-item:nth-child(5) { transition-delay: .26s; }
        .gh-sb-item:hover { color: #EE8A33 !important; background: rgba(238,138,51,.06) !important; padding-left: 30px !important; }
        .gh-sb-item:hover svg { stroke: rgba(238,138,51,.9) !important; transform: translateX(3px); transition: transform .2s ease; }

        @keyframes gh-line-grow {
          from { width: 0; opacity: 0; }
          to   { width: 38px; opacity: 1; }
        }
        @keyframes gh-blur-up {
          from { opacity: 0; transform: translateY(24px); filter: blur(8px); }
          to   { opacity: 1; transform: translateY(0);    filter: blur(0); }
        }
        @keyframes gh-h1-in {
          0%   { opacity: 0; transform: translateY(16px); filter: blur(14px); letter-spacing: .06em; }
          100% { opacity: 1; transform: translateY(0);    filter: blur(0);    letter-spacing: -.01em; }
        }
        @keyframes gh-curtain {
          from { clip-path: inset(0 0 100% 0); }
          to   { clip-path: inset(0 0 0%   0); }
        }
        @keyframes gh-img-dezoom {
          from { transform: scale(1.1); }
          to   { transform: scale(1); }
        }
        @keyframes gh-rating-spring {
          0%   { opacity: 0; transform: translateY(-32px) rotate(7deg); }
          55%  { opacity: 1; transform: translateY(6px) rotate(-1.5deg); }
          80%  { transform: translateY(-3px) rotate(.5deg); }
          100% { transform: translateY(0) rotate(0deg); }
        }
        @keyframes gh-stat-pop {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .gh-hero-line            { animation: gh-line-grow    .55s cubic-bezier(.22,.61,.36,1) .05s both; }
        .gh-hero-badge span:last-child { animation: gh-blur-up .6s  cubic-bezier(.22,.61,.36,1) .2s  both; }
        .gh-hero-h1              { animation: gh-h1-in       1.15s cubic-bezier(.22,.61,.36,1) .32s both; }
        .gh-hero-p               { animation: gh-blur-up      .75s cubic-bezier(.22,.61,.36,1) .54s both; }
        .gh-hero-cta             { animation: gh-blur-up      .7s  cubic-bezier(.22,.61,.36,1) .7s  both; }
        .gh-hero-imgbox          { animation: gh-curtain      1.2s cubic-bezier(.22,.61,.36,1) .22s both; }
        .gh-hero-img-inner       { animation: gh-img-dezoom   1.7s cubic-bezier(.22,.61,.36,1) .22s both; }
        .gh-hero-rating          { animation: gh-rating-spring .95s cubic-bezier(.34,1.56,.64,1) 1.0s both; }
        #gh-stats > div          { animation: gh-stat-pop      .55s cubic-bezier(.22,.61,.36,1) both; }
        #gh-stats > div:nth-child(1) { animation-delay: .88s; }
        #gh-stats > div:nth-child(2) { animation-delay: 1.02s; }
        #gh-stats > div:nth-child(3) { animation-delay: 1.16s; }
        #gh-stats > div:nth-child(4) { animation-delay: 1.3s; }
      `}</style>
      <div style={{ borderTop: '1px solid rgba(238,138,51,.16)', borderBottom: '1px solid rgba(238,138,51,.16)', overflow: 'hidden', background: '#0A131D' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 48, padding: '18px 0', whiteSpace: 'nowrap', animation: 'gh-marquee 30s linear infinite', width: 'fit-content' }}>
          {[...Array(2)].flatMap(() => [
            t('Cắt cổ điển', 'Classic Cut'),
            t('Cạo khăn nóng', 'Hot Towel Shave'),
            t('Tạo kiểu râu', 'Beard Sculpting'),
            t('Gội massage', 'Scalp Massage'),
            t('Tạo kiểu', 'Hair Styling'),
          ]).map((text, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 48 }}>
              <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: 19, color: 'rgba(241,236,225,.4)' }}>{text}</span>
              <span style={{ color: '#EE8A33' }}>✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ABOUT */}
      <AnimatedSection delay={0.1}><section id="about" style={{ background: '#F1ECE1', color: '#15110C', padding: 'clamp(72px,9vw,128px) 28px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 48, alignItems: 'end', marginBottom: 64 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                <span style={{ width: 38, height: 1, background: '#C26A1A' }} />
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.26em', textTransform: 'uppercase', color: '#C26A1A' }}>{t('Vì sao chọn GOODHAIR', 'Why GOODHAIR')}</span>
              </div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 'clamp(32px,4.6vw,56px)', lineHeight: 1.05, letterSpacing: '-.01em' }}>
                {t('Hơn cả một lần cắt tóc — một chuẩn mực bạn cảm nhận được.', 'More than a haircut — a standard you can feel.')}
              </h2>
            </div>
            <p style={{ fontSize: 16, lineHeight: 1.7, color: 'rgba(21,17,12,.62)', fontWeight: 300 }}>
              {t('Mỗi chiếc ghế tại GOODHAIR đều do một barber bậc thầy đảm nhiệm. Chúng tôi chăm chút từng chi tiết mà nơi khác bỏ qua — từ buổi tư vấn, cách hoàn thiện, đến cảm giác của bạn khi bước ra.', 'Every GOODHAIR chair is run by a certified master barber. We obsess over the details others skip — the consultation, the finish, the way you feel walking out.')}
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 0, borderTop: '1px solid rgba(21,17,12,.14)' }}>
            {[
              { num: '01', title: t('Barber tay nghề cao', 'Master barbers'), desc: t('Được tuyển chọn kỹ lưỡng, có chứng chỉ và liên tục đào tạo kỹ thuật mới nhất.', 'Hand-picked, certified, and continuously trained on the latest techniques.') },
              { num: '02', title: t('Không gian tinh tế', 'Refined space'), desc: t('Da, đồng thau và ánh sáng ấm — một nơi để chậm lại và thư giãn thật sự.', 'Leather, brass and warm light — a place built to slow down and unwind.') },
              { num: '03', title: t('Sản phẩm cao cấp', 'Premium products'), desc: t('Pomade, tonic và sản phẩm chăm sóc nhập khẩu, chọn lọc cho hiệu quả thật.', 'Imported pomades, tonics and skincare selected for real results.') },
              { num: '04', title: t('Đặt lịch 30 giây', 'Book in 30 seconds'), desc: t('Chọn chi nhánh, barber và giờ. Nhận nhắc lịch qua SMS & Zalo. Xong.', 'Pick a branch, barber and time. Get an SMS & Zalo reminder. Done.') },
            ].map((item, i) => (
              <div key={item.num} style={{ padding: i === 0 ? '36px 28px 36px 0' : i === 3 ? '36px 0 36px 28px' : '36px 28px', borderRight: i < 3 ? '1px solid rgba(21,17,12,.1)' : 'none' }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 700, color: '#C26A1A', letterSpacing: '.1em' }}>{item.num}</div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, margin: '18px 0 12px' }}>{item.title}</h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.65, color: 'rgba(21,17,12,.6)', fontWeight: 300 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section></AnimatedSection>

      {/* SERVICES & PRICING */}
      <AnimatedSection delay={0.2}><section id="services" style={{ background: '#0B1620', padding: 'clamp(72px,9vw,128px) 28px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 32, alignItems: 'end', marginBottom: 56 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                <span style={{ width: 38, height: 1, background: '#EE8A33' }} />
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.26em', textTransform: 'uppercase', color: '#EE8A33' }}>{t('Dịch vụ', 'Services & Pricing')}</span>
              </div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 'clamp(32px,4.6vw,56px)', lineHeight: 1.05, color: '#F1ECE1' }}>{t('Chọn dịch vụ của bạn.', 'Choose your service.')}</h2>
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: 'rgba(241,236,225,.6)', fontWeight: 300 }}>
              {t('Giá minh bạch, không phát sinh. Các combo tiết kiệm hơn và đã bao gồm gội massage thư giãn.', 'Transparent pricing, no surprises. Combos save more and include a complimentary scalp massage.')}
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(330px,1fr))', gap: '28px 56px' }}>
            {servicesLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 18, paddingBottom: 24, borderBottom: '1px solid rgba(238,138,51,.16)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ width: '60%', height: 21, background: 'rgba(241,236,225,.1)', borderRadius: 2 }} />
                      <div style={{ width: '40%', height: 14, background: 'rgba(241,236,225,.06)', borderRadius: 2, marginTop: 8 }} />
                    </div>
                    <div style={{ width: 50, height: 21, background: 'rgba(238,138,51,.2)', borderRadius: 2 }} />
                  </div>
                ))
              : servicesList.map((svc, idx) => (
                  <div key={svc.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 18, paddingBottom: 24, borderBottom: '1px solid rgba(238,138,51,.16)' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 21, fontWeight: 700, color: '#F1ECE1' }}>{svc.name}</h3>
                      <p style={{ fontSize: 13.5, color: 'rgba(241,236,225,.55)', marginTop: 5, fontWeight: 300 }}>
                        {svc.description || `${svc.durationMinutes} phút`}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 21, fontWeight: 700, color: '#EE8A33' }}>{formatPrice(svc.price)}</div>
                    </div>
                  </div>
                ))}
          </div>
        </div>
      </section></AnimatedSection>

      {/* BARBERS */}
      <AnimatedSection delay={0.3}><section id="barbers" style={{ background: '#F1ECE1', color: '#15110C', padding: 'clamp(72px,9vw,128px) 28px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 20 }}>
              <span style={{ width: 30, height: 1, background: '#C26A1A' }} />
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.26em', textTransform: 'uppercase', color: '#C26A1A' }}>{t('Đội ngũ', 'The Team')}</span>
              <span style={{ width: 30, height: 1, background: '#C26A1A' }} />
            </div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 'clamp(32px,4.6vw,56px)', lineHeight: 1.05 }}>{t('Gặp gỡ các barber.', 'Meet your barbers.')}</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 24 }}>
            {employeesLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} style={{ background: '#fff', border: '1px solid rgba(21,17,12,.08)' }}>
                    <div style={{ aspectRatio: '4/5', background: 'linear-gradient(160deg,#16110C 0%,#2a211a 100%)' }} />
                    <div style={{ padding: 20 }}>
                      <div style={{ width: '70%', height: 19, background: 'rgba(21,17,12,.08)', borderRadius: 2 }} />
                      <div style={{ width: '50%', height: 13, background: 'rgba(21,17,12,.05)', borderRadius: 2, marginTop: 10 }} />
                    </div>
                  </div>
                ))
              : employeesList.map(emp => {
                  const initials = emp.name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <div key={emp.id} style={{ background: '#fff', border: '1px solid rgba(21,17,12,.08)' }}>
                      <div style={{ aspectRatio: '4/5', background: 'linear-gradient(160deg,#16110C 0%,#2a211a 100%)', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {emp.avatarUrl ? (
                          <img src={emp.avatarUrl} alt={emp.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 52, fontWeight: 800, color: 'rgba(241,236,225,.18)' }}>{initials}</span>
                        )}
                      </div>
                      <div style={{ padding: 20 }}>
                        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 700 }}>{emp.displayName || emp.name}</h3>
                        {emp.roleName && (
                          <p style={{ fontSize: 13, color: 'rgba(21,17,12,.55)', marginTop: 4, fontWeight: 300 }}>{emp.roleName}</p>
                        )}
                        <Link href={`/bookings?branchId=${emp.branchId}&barberId=${emp.id}&step=3`} style={{ display: 'inline-block', marginTop: 14, textDecoration: 'none', border: '1px solid #C26A1A', color: '#C26A1A', padding: '8px 18px', borderRadius: 2, fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                          {t('Đặt', 'Book')}
                        </Link>
                      </div>
                    </div>
                  );
                })}
          </div>
        </div>
      </section></AnimatedSection>

      {/* BRANCHES */}
      <AnimatedSection delay={0.4}><section id="branches" style={{ background: '#0B1620', padding: 'clamp(72px,9vw,128px) 28px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20, marginBottom: 48 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                <span style={{ width: 38, height: 1, background: '#EE8A33' }} />
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.26em', textTransform: 'uppercase', color: '#EE8A33' }}>{t('Hệ thống chi nhánh', 'Locations')}</span>
              </div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 'clamp(32px,4.6vw,56px)', lineHeight: 1.05, color: '#F1ECE1' }}>{t('Tìm GOODHAIR gần bạn.', 'Find your nearest GOODHAIR.')}</h2>
            </div>
          </div>
          <div id="gh-branch-grid" style={{ display: 'grid', gridTemplateColumns: '.9fr 1.1fr', gap: 36 }}>
            <div id="gh-branch-map" style={{ position: 'sticky', top: 100, alignSelf: 'start', minHeight: 480, border: '1px solid rgba(238,138,51,.25)', borderRadius: 3, overflow: 'hidden' }}>
              <BranchMap branches={branchesList} t={t} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {branchesLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '18px 20px', background: '#0F1E2B', border: '1px solid rgba(238,138,51,.16)', borderRadius: 3 }}>
                      <div style={{ width: 72, height: 72, flexShrink: 0, borderRadius: 4, background: 'rgba(241,236,225,.07)' }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ width: '55%', height: 20, background: 'rgba(241,236,225,.1)', borderRadius: 2 }} />
                        <div style={{ width: '70%', height: 14, background: 'rgba(241,236,225,.06)', borderRadius: 2, marginTop: 8 }} />
                        <div style={{ width: '35%', height: 12, background: 'rgba(238,138,51,.15)', borderRadius: 2, marginTop: 8 }} />
                      </div>
                      <div style={{ width: 52, height: 34, background: 'rgba(241,236,225,.08)', borderRadius: 2, flexShrink: 0 }} />
                    </div>
                  ))
                : branchesList.map(branch => {
                    const isNearest = nearestBranchId === branch.id;
                    return (
                      <div key={branch.id} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 18, padding: '18px 20px', background: isNearest ? 'rgba(238,138,51,.08)' : '#0F1E2B', border: `1px solid ${isNearest ? 'rgba(238,138,51,.5)' : 'rgba(238,138,51,.16)'}`, borderRadius: 3 }}>
                      {isNearest && (
                        <div style={{ position: 'absolute', top: -1, left: 14, fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#EE8A33', background: '#0F1E2B', padding: '2px 8px' }}>
                          {t(`Gần bạn nhất · ${nearestDistance} km`, `Nearest · ${nearestDistance} km`)}
                        </div>
                      )}
                      {/* Ảnh chi nhánh */}
                      <div style={{ width: 72, height: 72, flexShrink: 0, borderRadius: 4, overflow: 'hidden', background: 'rgba(238,138,51,.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {branch.imageUrl
                          ? <img src={branch.imageUrl} alt={branch.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(238,138,51,.4)" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 700, color: '#F1ECE1', margin: 0 }}>{branch.name}</h3>
                        <p style={{ fontSize: 13.5, color: 'rgba(241,236,225,.55)', marginTop: 4, fontWeight: 300, margin: '4px 0 0' }}>{branch.address}</p>
                        {branch.rating > 0 && (
                          <p style={{ fontSize: 12, color: '#f5c842', margin: '4px 0 0', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span>★</span>
                            <span style={{ color: 'rgba(241,236,225,.6)' }}>{branch.rating.toFixed(1)}</span>
                          </p>
                        )}
                        <p style={{ fontSize: 12, color: '#EE8A33', margin: '6px 0 0' }}>
                          {branch.openingTime && branch.closingTime
                            ? t(`Mở cửa ${branch.openingTime.slice(0, 5)} – ${branch.closingTime.slice(0, 5)} · ${branch.seatCount} ghế`, `Open ${branch.openingTime.slice(0, 5)} – ${branch.closingTime.slice(0, 5)} · ${branch.seatCount} chairs`)
                            : ''}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        <Link href={`/bookings?branchId=${branch.id}&step=2`} style={{ textDecoration: 'none', background: '#EE8A33', color: '#0B1620', padding: '10px 22px', borderRadius: 4, fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', whiteSpace: 'nowrap', transition: 'all .2s', boxShadow: '0 2px 12px rgba(238,138,51,.25)' }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#f59e42'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(238,138,51,.4)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = '#EE8A33'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(238,138,51,.25)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                        >
                          {t('Đặt lịch', 'Book')}
                        </Link>
                        <a href={`https://www.google.com/maps/search/${encodeURIComponent(`GOODHAIR ${branch.name} ${branch.address || ''}`)}/@${branch.latitude},${branch.longitude},17z`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', border: '1px solid rgba(238,138,51,.3)', color: 'rgba(241,236,225,.6)', padding: '10px 14px', borderRadius: 4, fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, transition: 'all .2s' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(238,138,51,.12)'; e.currentTarget.style.borderColor = '#EE8A33'; e.currentTarget.style.color = '#EE8A33'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(238,138,51,.3)'; e.currentTarget.style.color = 'rgba(241,236,225,.6)'; }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24z"/></svg>
                        </a>
                      </div>
                    </div>
                    );
                  })}
            </div>
          </div>
        </div>
      </section></AnimatedSection>

      {/* TESTIMONIALS + GALLERY */}
      <AnimatedSection delay={0.5}><section style={{ background: '#F1ECE1', color: '#15110C', padding: 'clamp(72px,9vw,120px) 28px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(70% 60% at 50% 30%,rgba(212,168,67,.06) 0%,transparent 60%)', pointerEvents: 'none' }} />
        <div style={{ maxWidth: 960, margin: '0 auto', position: 'relative' }}>

          {/* ─── TESTIMONIALS ─── */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 20 }}>
              <span style={{ width: 30, height: 1, background: '#C26A1A' }} />
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.26em', textTransform: 'uppercase', color: '#C26A1A' }}>{t('Khách hàng nói gì', 'Testimonials')}</span>
              <span style={{ width: 30, height: 1, background: '#C26A1A' }} />
            </div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 'clamp(28px,4.2vw,48px)', lineHeight: 1.05 }}>
              {t('Khách hàng của chúng tôi.', 'What our customers say.')}
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 20, marginBottom: 72 }}>
            {[
              { name: 'Minh Anh', tag: t('Khách hàng thân thiết', 'Regular'), stars: 5, text: t('Tóc mình làm ở đây rất ưng ý, thợ lành nghề và thái độ phục vụ tốt. Không gian sạch sẽ, thoải mái.', 'Love my hair here — skilled stylists and great service. Clean and comfortable space.') },
              { name: 'Hoàng Nam', tag: t('Khách hàng thường xuyên', 'Frequent'), stars: 5, text: t('Không gian thoải mái, nhân viên nhiệt tình. Đã đi nhiều tiệm nhưng đây là chỗ ưng ý nhất.', 'Relaxing atmosphere, friendly staff. Been to many but this is my favorite.') },
              { name: 'Thu Hà', tag: t('Khách hàng mới', 'New client'), stars: 4, text: t('Đặt lịch online dễ dàng, đúng giờ, không phải chờ lâu. Lần đầu đến nhưng rất hài lòng!', 'Easy online booking, on time, no waiting. First visit and very satisfied!') },
              { name: 'Quốc Anh', tag: t('Khách hàng VIP', 'VIP'), stars: 5, text: t('Là khách quen từ hồi mới mở, chất lượng lúc nào cũng ổn định. Đội ngũ stylist chuyên nghiệp.', 'Been a regular since day one — consistent quality. Professional stylist team.') },
            ].map((r, i) => (
              <div key={i} style={{
                background: i === 0 || i === 3 ? '#fff' : 'rgba(255,255,255,.6)',
                borderRadius: 16, padding: '28px 24px',
                border: i === 0 || i === 3 ? '1px solid rgba(212,168,67,.15)' : '1px solid rgba(21,17,12,.06)',
                boxShadow: i === 0 || i === 3 ? '0 4px 20px rgba(212,168,67,.08)' : 'none',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: `linear-gradient(135deg,#D4A843,#D4A843dd)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontWeight: 700, fontSize: 16,
                    fontFamily: "'Playfair Display', serif", flexShrink: 0,
                  }}>
                    {r.name.split(' ').map(s => s[0]).join('')}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#15110C' }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: 'rgba(21,17,12,.4)', marginTop: 1 }}>{r.tag}</div>
                  </div>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 2 }}>
                    {Array.from({ length: 5 }).map((_, si) => (
                      <svg key={si} width="13" height="13" viewBox="0 0 24 24" fill={si < r.stars ? '#D4A843' : 'rgba(21,17,12,.1)'}>
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                    ))}
                  </div>
                </div>
                <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'rgba(21,17,12,.65)', margin: 0, fontStyle: 'italic' }}>
                  "{r.text}"
                </p>
              </div>
            ))}
          </div>
        </div>
      </section></AnimatedSection>

      {/* BOOKING CTA */}
      <AnimatedSection delay={0.7}><section style={{ background: 'linear-gradient(150deg,#0F2233 0%,#0A131D 100%)', borderTop: '1px solid rgba(238,138,51,.2)', borderBottom: '1px solid rgba(238,138,51,.2)', padding: 'clamp(72px,10vw,130px) 28px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(50% 80% at 50% 0%,rgba(238,138,51,.08) 0%,transparent 60%)' }} />
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '100%', height: '100%', background: 'radial-gradient(ellipse at center,rgba(238,138,51,.03) 0%,transparent 50%)' }} />
        <div style={{ maxWidth: 760, margin: '0 auto', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, marginBottom: 24 }}>
            <span style={{ width: 30, height: 1, background: 'rgba(238,138,51,.4)' }} />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.26em', textTransform: 'uppercase', color: '#EE8A33' }}>{t('Sẵn sàng khi bạn muốn', 'Ready when you are')}</span>
            <span style={{ width: 30, height: 1, background: 'rgba(238,138,51,.4)' }} />
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 'clamp(36px,5.5vw,68px)', lineHeight: 1.04, color: '#fff', margin: 0, letterSpacing: '-.02em' }}>{t('Đặt ghế của bạn', 'Book your chair')} <span style={{ color: '#EE8A33' }}>{t('trong 30 giây.', 'in 30 seconds.')}</span></h2>
          <p style={{ marginTop: 22, fontSize: 16, lineHeight: 1.7, color: 'rgba(241,236,225,.65)', fontWeight: 300, maxWidth: 580, marginLeft: 'auto', marginRight: 'auto' }}>
            {t('Chọn chi nhánh, barber, dịch vụ và khung giờ phù hợp. Chúng tôi sẽ gửi nhắc lịch qua SMS & Zalo trước buổi hẹn.', 'Choose a branch, your barber, services and a time that fits. We\'ll send an SMS & Zalo reminder before your appointment.')}
          </p>
          <Link href="/bookings" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 10, marginTop: 36, background: '#EE8A33', color: '#0B1620', padding: '16px 40px', borderRadius: 2, fontSize: 14, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', transition: 'all .2s' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#f59e42'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(238,138,51,.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#EE8A33'; e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            {t('Bắt đầu đặt lịch', 'Start booking')}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </Link>
        </div>
      </section></AnimatedSection>

      {/* FOOTER */}
      <footer style={{ background: '#080F17', padding: '64px 28px 28px', borderTop: '1px solid rgba(238,138,51,.1)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(70% 60% at 50% 30%,rgba(238,138,51,.05) 0%,transparent 60%)' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(238,138,51,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(238,138,51,.03) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
        <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 40, alignItems: 'start' }}>
            {/* Brand */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                <img src="/logo/logo.jpg" alt="GOODHAIR" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 10, border: '1px solid rgba(238,138,51,.2)' }} />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '2px' }}>GOOD<span style={{ color: '#ee8a33' }}>HAIR</span></div>
                  <div style={{ fontSize: 11, color: 'rgba(241,236,225,.3)', letterSpacing: '.15em', textTransform: 'uppercase', marginTop: 1 }}>{t('Tóc nam cao cấp', 'Premium Barbershop')}</div>
                </div>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: 'rgba(241,236,225,.4)', maxWidth: 300, fontWeight: 300, margin: 0 }}>{t('Good hair, good mood. Trải nghiệm cắt tóc và chăm sóc tóc nam cao cấp từ 2024.', 'Good hair, good mood. Premium men\'s grooming and haircuts since 2024.')}</p>
            </div>
            {/* Contact */}
            <div>
              <h4 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(238,138,51,.6)', margin: '0 0 16px' }}>{t('Liên hệ', 'Contact')}</h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <span style={{ fontSize: 13, color: 'rgba(241,236,225,.45)', fontWeight: 300, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(238,138,51,.4)" strokeWidth="1.5"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
                  {CONTACT_PHONE}
                </span>
              </div>
            </div>
            {/* Social */}
            <div>
              <h4 style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: 'rgba(238,138,51,.6)', margin: '0 0 16px' }}>{t('Kết nối', 'Connect')}</h4>
              <div style={{ display: 'flex', gap: 10 }}>
                <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(238,138,51,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(241,236,225,.5)', textDecoration: 'none', transition: 'all .2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(238,138,51,.15)'; e.currentTarget.style.borderColor = '#EE8A33'; e.currentTarget.style.color = '#EE8A33'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(238,138,51,.2)'; e.currentTarget.style.color = 'rgba(241,236,225,.5)'; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </a>
                <a href={MESSENGER_URL} target="_blank" rel="noopener noreferrer" style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(238,138,51,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(241,236,225,.5)', textDecoration: 'none', transition: 'all .2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(238,138,51,.15)'; e.currentTarget.style.borderColor = '#EE8A33'; e.currentTarget.style.color = '#EE8A33'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(238,138,51,.2)'; e.currentTarget.style.color = 'rgba(241,236,225,.5)'; }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 4.975 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.464 3.442.464 6.627 0 12-4.974 12-11.111C24 4.975 18.627 0 12 0zm1.193 14.963l-3.056-3.259-5.963 3.259L10.732 8.2l3.131 3.259L19.752 8.2l-6.559 6.763z"/></svg>
                </a>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(241,236,225,.35)', marginTop: 14, fontWeight: 300, display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(238,138,51,.4)" strokeWidth="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                {CONTACT_EMAIL}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 40, paddingTop: 18, borderTop: '1px solid rgba(238,138,51,.06)', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11.5, color: 'rgba(241,236,225,.25)' }}>&copy; 2026 GOODHAIR Barbershop</span>

          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 920px) {
          #gh-nav { display: none !important; }
          .gh-hide-mobile { display: none !important; }
          .gh-hamburger { display: flex !important; }
          #gh-hero-grid { grid-template-columns: 1fr !important; gap: 32px !important; }
          #gh-hero-media { display: none !important; }
          #gh-stats { grid-template-columns: 1fr 1fr !important; gap: 20px !important; }
          #gh-branch-grid { grid-template-columns: 1fr !important; }
          #gh-branch-grid > div > div { flex-wrap: wrap !important; }
          #gh-branch-grid > div > div > div:last-child { width: 100% !important; justify-content: flex-end !important; padding-top: 4px !important; }
          #gh-branch-map { position: relative !important; top: 0 !important; min-height: 260px !important; }
        }
        @media (max-width: 560px) {
          #gh-stats { grid-template-columns: 1fr 1fr !important; }
          section { padding-left: 16px !important; padding-right: 16px !important; }
          footer { padding-left: 16px !important; padding-right: 16px !important; }
        }
      `}</style>
    </div>
  );
}
