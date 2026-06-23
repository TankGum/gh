'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Playfair_Display, Hanken_Grotesk } from 'next/font/google';
import {
  fetchPublicServices,
  fetchPublicBranches,
  fetchPublicEmployees,
  type PublicService,
  type PublicBranch,
  type PublicEmployee,
} from '@/services/public.api';
import { getMe } from '@/services/auth.api';
import type { Me } from '@/types/account.type';


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
  const [lang, setLang] = useState<'vi' | 'en'>('vi');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [servicesList, setServicesList] = useState<PublicService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [branchesList, setBranchesList] = useState<PublicBranch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [employeesList, setEmployeesList] = useState<PublicEmployee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
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

  // Check auth
  useEffect(() => {
    getMe()
      .then(user => setMe(user))
      .catch(() => setMe(null))
      .finally(() => setAuthChecked(true));
  }, []);

  const formatPrice = (price: number) => {
    if (price >= 1000000) return (price / 1000000).toFixed(price % 1000000 === 0 ? 0 : 1) + 'M';
    if (price >= 1000) return (price / 1000).toFixed(price % 1000 === 0 ? 0 : 0) + 'K';
    return String(price);
  };

  const t = useCallback(
    (vi: string, en: string) => {
      return lang === 'vi' ? vi : en;
    },
    [lang]
  );

  return (
    <div
      className={`${playfairDisplay.variable} ${hankenGrotesk.variable}`}
      style={{ background: '#0B1620', color: '#F1ECE1', fontFamily: "'Hanken Grotesk', sans-serif", overflowX: 'hidden', position: 'relative' }}
    >
      {/* HEADER */}
      <header
        ref={headerRef}
        style={{
          position: 'fixed', top: '10px', left: 0, right: 0, zIndex: 50,
          transition: 'background .35s ease, border-color .35s ease, backdrop-filter .35s ease',
          borderBottom: scrolled ? '1px solid rgba(238,138,51,0.22)' : '1px solid rgba(238,138,51,0)',
          background: scrolled ? 'rgba(11,22,32,0.92)' : 'transparent',
          backdropFilter: scrolled ? 'blur(14px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(14px)' : 'none',
        }}
      >
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24 }}>
          <a href="#top" style={{ textDecoration: 'none', display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: 24, letterSpacing: '.02em', color: '#F1ECE1' }}>GOOD</span>
            <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: 24, letterSpacing: '.02em', color: '#EE8A33' }}>HAIR</span>
          </a>
          <nav style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
            <a href="#about" style={{ textDecoration: 'none', color: 'rgba(241,236,225,.78)', fontSize: 13.5, fontWeight: 500, letterSpacing: '.02em', whiteSpace: 'nowrap' }}>{t('Giới thiệu', 'About')}</a>
            <a href="#services" style={{ textDecoration: 'none', color: 'rgba(241,236,225,.78)', fontSize: 13.5, fontWeight: 500, letterSpacing: '.02em', whiteSpace: 'nowrap' }}>{t('Dịch vụ', 'Services')}</a>
            <a href="#barbers" style={{ textDecoration: 'none', color: 'rgba(241,236,225,.78)', fontSize: 13.5, fontWeight: 500, letterSpacing: '.02em', whiteSpace: 'nowrap' }}>{t('Barber', 'Barbers')}</a>
            <a href="#branches" style={{ textDecoration: 'none', color: 'rgba(241,236,225,.78)', fontSize: 13.5, fontWeight: 500, letterSpacing: '.02em', whiteSpace: 'nowrap' }}>{t('Chi nhánh', 'Locations')}</a>
            <a href="#careers" style={{ textDecoration: 'none', color: 'rgba(241,236,225,.78)', fontSize: 13.5, fontWeight: 500, letterSpacing: '.02em', whiteSpace: 'nowrap' }}>{t('Tuyển dụng', 'Careers')}</a>
          </nav>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <button
              onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
              style={{ background: 'transparent', border: '1px solid rgba(238,138,51,.4)', color: '#EE8A33', padding: '7px 12px', borderRadius: 2, fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '.08em', cursor: 'pointer' }}
            >
              {lang === 'vi' ? 'EN' : 'VI'}
            </button>
            {me ? (
              <Link
                href="/services"
                style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', background: 'transparent', border: '1px solid rgba(238,138,51,.4)', color: '#F1ECE1', padding: '6px 14px 6px 6px', borderRadius: 30, fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                {me.avatarUrl ? (
                  <img src={me.avatarUrl} alt={me.name} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#EE8A33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#0B1620' }}>
                    {me.name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                )}
                {me.name}
              </Link>
            ) : authChecked && (
              <Link
                href="/login"
                style={{ textDecoration: 'none', background: 'transparent', border: '1px solid rgba(238,138,51,.4)', color: '#F1ECE1', padding: '10px 18px', borderRadius: 2, fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: '.04em', whiteSpace: 'nowrap' }}
              >
                {t('Đăng nhập', 'Sign in')}
              </Link>
            )}
            <Link
              href="/bookings"
              style={{ textDecoration: 'none', background: '#EE8A33', color: '#0B1620', padding: '11px 22px', borderRadius: 2, fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}
            >
              {t('Đặt lịch', 'Book now')}
            </Link>
          </div>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            style={{ display: 'none', alignItems: 'center', justifyContent: 'center', width: 42, height: 42, background: 'transparent', border: '1px solid rgba(238,138,51,.4)', borderRadius: 2, cursor: 'pointer', flexDirection: 'column', gap: 5 }}
          >
            <span style={{ width: 18, height: 1.5, background: '#EE8A33', display: 'block' }} />
            <span style={{ width: 18, height: 1.5, background: '#EE8A33', display: 'block' }} />
            <span style={{ width: 18, height: 1.5, background: '#EE8A33', display: 'block' }} />
          </button>
        </div>
        {mobileOpen && (
          <div style={{ background: 'rgba(11,22,32,.98)', borderTop: '1px solid rgba(238,138,51,.18)', padding: '18px 28px 26px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { href: '#about', label: t('Giới thiệu', 'About') },
              { href: '#services', label: t('Dịch vụ', 'Services') },
              { href: '#barbers', label: t('Barber', 'Barbers') },
              { href: '#branches', label: t('Chi nhánh', 'Locations') },
              { href: '#careers', label: t('Tuyển dụng', 'Careers') },
            ].map(item => (
              <a key={item.href} href={item.href} onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', color: '#F1ECE1', fontSize: 16, fontWeight: 500, padding: '11px 0', borderBottom: '1px solid rgba(238,138,51,.12)' }}>
                {item.label}
              </a>
            ))}
            {me ? (
              <Link href="/services" onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', color: '#F1ECE1', fontSize: 16, fontWeight: 500, padding: '11px 0', borderBottom: '1px solid rgba(238,138,51,.12)', display: 'flex', alignItems: 'center', gap: 10 }}>
                {me.avatarUrl ? (
                  <img src={me.avatarUrl} alt={me.name} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#EE8A33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#0B1620', flexShrink: 0 }}>
                    {me.name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                )}
                {t('Bảng điều khiển', 'Dashboard')}
              </Link>
            ) : (
              <Link href="/login" onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', color: '#F1ECE1', fontSize: 16, fontWeight: 500, padding: '11px 0', borderBottom: '1px solid rgba(238,138,51,.12)', display: 'block' }}>
                {t('Đăng nhập', 'Sign in')}
              </Link>
            )}
            <Link href="/bookings" onClick={() => setMobileOpen(false)} style={{ textDecoration: 'none', background: '#EE8A33', color: '#0B1620', textAlign: 'center', padding: 14, borderRadius: 2, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', marginTop: 12 }}>
              {t('Đặt lịch', 'Book now')}
            </Link>
          </div>
        )}
      </header>

      {/* HERO */}
      <section id="top" style={{ position: 'relative', padding: '150px 28px 90px', background: 'radial-gradient(120% 90% at 80% 0%,#102536 0%,#0B1620 55%)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.15fr .85fr', gap: 56, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 26 }}>
              <span style={{ width: 38, height: 1, background: '#EE8A33' }} />
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.26em', textTransform: 'uppercase', color: '#EE8A33' }}>{t('Barbershop Cao Cấp · Est. 2024', 'Premium Barbershop · Est. 2024')}</span>
            </div>
            <h1 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: 'clamp(48px,7.4vw,104px)', lineHeight: .96, letterSpacing: '-.01em', color: '#F1ECE1' }}>
              Good hair,<br /><span style={{ fontStyle: 'italic', fontWeight: 600, color: '#EE8A33' }}>good mood.</span>
            </h1>
            <p style={{ marginTop: 28, maxWidth: 480, fontSize: 17, lineHeight: 1.65, color: 'rgba(241,236,225,.66)', fontWeight: 300 }}>
              {t('Nghệ thuật chăm sóc tóc nam đẳng cấp. Đội ngũ barber bậc thầy, không gian tinh tế, đặt lịch chỉ trong 30 giây — để bạn luôn bước ra với phiên bản hoàn hảo nhất.', 'The art of premium men\'s grooming. Master barbers, a refined space, and a booking that takes 30 seconds — so you always walk out at your best.')}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 38 }}>
              <Link href="/bookings" style={{ textDecoration: 'none', background: '#EE8A33', color: '#0B1620', padding: '17px 34px', borderRadius: 2, fontSize: 14, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                {t('Đặt lịch ngay', 'Book an appointment')}
              </Link>
              <a href="#services" style={{ textDecoration: 'none', border: '1px solid rgba(238,138,51,.45)', color: '#F1ECE1', padding: '17px 34px', borderRadius: 2, fontSize: 14, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                {t('Xem dịch vụ', 'View services')}
              </a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginTop: 64, borderTop: '1px solid rgba(238,138,51,.18)', paddingTop: 30 }}>
              {[
                { value: `2${t('+', '+')}`, label: t('Năm kinh nghiệm', 'Years of craft') },
                { value: '6', label: t('Chi nhánh', 'Locations') },
                { value: `40${t('+', '+')}`, label: t('Barber', 'Master barbers') },
                { value: `120K${t('+', '+')}`, label: t('Khách hàng', 'Happy clients') },
              ].map(stat => (
                <div key={stat.label}>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 700, color: '#F1ECE1' }} dangerouslySetInnerHTML={{ __html: stat.value }} />
                  <div style={{ fontSize: 12, letterSpacing: '.06em', color: 'rgba(241,236,225,.5)', marginTop: 4 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{ position: 'relative', aspectRatio: '3/4', border: '1px solid rgba(238,138,51,.3)', background: '#1C1C1C', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src="/logo/logo.jpg" alt="GOODHAIR — Haircuts & Shaves" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }} />
              <span style={{ position: 'absolute', top: 0, right: 0, width: 22, height: 22, borderTop: '1px solid #EE8A33', borderRight: '1px solid #EE8A33', margin: 14 }} />
              <span style={{ position: 'absolute', bottom: 0, left: 0, width: 22, height: 22, borderBottom: '1px solid #EE8A33', borderLeft: '1px solid #EE8A33', margin: 14 }} />
            </div>
            <div style={{ position: 'absolute', left: -26, bottom: 36, background: '#F1ECE1', color: '#15110C', padding: '16px 20px', borderRadius: 2, boxShadow: '0 24px 60px rgba(0,0,0,.45)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: '#EE8A33', fontSize: 18, letterSpacing: 2 }}>★★★★★</span>
              </div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 22, marginTop: 4 }}>4.9<span style={{ fontSize: 13, color: 'rgba(21,17,12,.5)', fontFamily: "'Hanken Grotesk', sans-serif", fontWeight: 500 }}> / 5.0</span></div>
              <div style={{ fontSize: 11, letterSpacing: '.04em', color: 'rgba(21,17,12,.55)' }}>{t('12.000+ đánh giá', '12,000+ reviews')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div style={{ borderTop: '1px solid rgba(238,138,51,.16)', borderBottom: '1px solid rgba(238,138,51,.16)', overflow: 'hidden', background: '#0A131D' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 48, padding: '18px 28px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {[
            t('Cắt cổ điển', 'Classic Cut'),
            t('Cạo khăn nóng', 'Hot Towel Shave'),
            t('Tạo kiểu râu', 'Beard Sculpting'),
            t('Gội massage', 'Scalp Massage'),
            t('Tạo kiểu', 'Hair Styling'),
          ].map((text, i) => (
            <span key={text}>
              <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: 19, color: 'rgba(241,236,225,.4)' }}>{text}</span>
              {i < 5 - 1 && <span style={{ color: '#EE8A33', marginLeft: 48 }}>✦</span>}
            </span>
          ))}
        </div>
      </div>

      {/* ABOUT */}
      <section id="about" style={{ background: '#F1ECE1', color: '#15110C', padding: 'clamp(72px,9vw,128px) 28px' }}>
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
              <div key={item.num} style={{ padding: `36px ${i === 0 ? '28px 36px 0' : i === 3 ? '0 0 36px 28px' : '28px'}`, borderRight: i < 3 ? '1px solid rgba(21,17,12,.1)' : 'none' }}>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 13, fontWeight: 700, color: '#C26A1A', letterSpacing: '.1em' }}>{item.num}</div>
                <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, margin: '18px 0 12px' }}>{item.title}</h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.65, color: 'rgba(21,17,12,.6)', fontWeight: 300 }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SERVICES & PRICING */}
      <section id="services" style={{ background: '#0B1620', padding: 'clamp(72px,9vw,128px) 28px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 32, alignItems: 'end', marginBottom: 56 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
                <span style={{ width: 38, height: 1, background: '#EE8A33' }} />
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.26em', textTransform: 'uppercase', color: '#EE8A33' }}>{t('Dịch vụ & Bảng giá', 'Services & Pricing')}</span>
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
          <div style={{ marginTop: 48, display: 'flex', flexWrap: 'wrap', gap: 18, alignItems: 'center', justifyContent: 'space-between', background: '#0F1E2B', border: '1px solid rgba(238,138,51,.2)', padding: '26px 32px', borderRadius: 3 }}>
            <p style={{ fontSize: 15, color: 'rgba(241,236,225,.78)', fontWeight: 300 }}>{t('Có gói thành viên — tiết kiệm tới 20% mỗi lần ghé.', 'Membership available — save up to 20% on every visit.')}</p>
            <Link href="/bookings" style={{ textDecoration: 'none', background: '#EE8A33', color: '#0B1620', padding: '14px 28px', borderRadius: 2, fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              {t('Đặt dịch vụ', 'Book a service')}
            </Link>
          </div>
        </div>
      </section>

      {/* BARBERS */}
      <section id="barbers" style={{ background: '#F1ECE1', color: '#15110C', padding: 'clamp(72px,9vw,128px) 28px' }}>
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
                        <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 19, fontWeight: 700 }}>{emp.name}</h3>
                        {emp.roleName && (
                          <p style={{ fontSize: 13, color: 'rgba(21,17,12,.55)', marginTop: 4, fontWeight: 300 }}>{emp.roleName}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
          </div>
          <div style={{ textAlign: 'center', marginTop: 44 }}>
            <Link href="/bookings" style={{ textDecoration: 'none', border: '1px solid rgba(21,17,12,.25)', color: '#15110C', padding: '15px 32px', borderRadius: 2, fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', display: 'inline-block' }}>
              {t('Đặt lịch với barber', 'Book with a barber')}
            </Link>
          </div>
        </div>
      </section>

      {/* BRANCHES */}
      <section id="branches" style={{ background: '#0B1620', padding: 'clamp(72px,9vw,128px) 28px' }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: '.9fr 1.1fr', gap: 36 }}>
            <div style={{ position: 'sticky', top: 100, alignSelf: 'start', minHeight: 480, border: '1px solid rgba(238,138,51,.25)', background: 'linear-gradient(150deg,#0F2233 0%,#0A131D 100%)', overflow: 'hidden', borderRadius: 3 }}>
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(238,138,51,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(238,138,51,.06) 1px,transparent 1px)', backgroundSize: '44px 44px' }} />
              <div style={{ position: 'absolute', top: '30%', left: '28%' }}><span style={{ display: 'block', width: 14, height: 14, background: '#EE8A33', borderRadius: '50%', boxShadow: '0 0 0 6px rgba(238,138,51,.25)' }} /></div>
              <div style={{ position: 'absolute', top: '52%', left: '58%' }}><span style={{ display: 'block', width: 14, height: 14, background: '#EE8A33', borderRadius: '50%', boxShadow: '0 0 0 6px rgba(238,138,51,.25)' }} /></div>
              <div style={{ position: 'absolute', top: '64%', left: '38%' }}><span style={{ display: 'block', width: 14, height: 14, background: '#EE8A33', borderRadius: '50%', boxShadow: '0 0 0 6px rgba(238,138,51,.2)' }} /></div>
              <div style={{ position: 'absolute', top: '24%', left: '70%' }}><span style={{ display: 'block', width: 14, height: 14, background: '#EE8A33', borderRadius: '50%', boxShadow: '0 0 0 6px rgba(238,138,51,.2)' }} /></div>
              <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '18px 20px', background: 'linear-gradient(transparent,rgba(8,16,24,.9))', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: '#EE8A33', fontSize: 13 }}>◉</span>
                <span style={{ fontSize: 12.5, color: 'rgba(241,236,225,.6)', letterSpacing: '.04em' }}>{t('Bản đồ tương tác · 6 chi nhánh toàn quốc', 'Interactive map · 6 branches nationwide')}</span>
              </div>
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
                : branchesList.map(branch => (
                    <div key={branch.id} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '18px 20px', background: '#0F1E2B', border: '1px solid rgba(238,138,51,.16)', borderRadius: 3 }}>
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
                        <p style={{ fontSize: 12, color: '#EE8A33', margin: '6px 0 0' }}>
                          {branch.openingTime && branch.closingTime
                            ? t(`Mở cửa ${branch.openingTime.slice(0, 5)} – ${branch.closingTime.slice(0, 5)} · ${branch.seatCount} ghế`, `Open ${branch.openingTime.slice(0, 5)} – ${branch.closingTime.slice(0, 5)} · ${branch.seatCount} chairs`)
                            : ''}
                        </p>
                      </div>
                      <Link href="/bookings" style={{ textDecoration: 'none', border: '1px solid rgba(238,138,51,.4)', color: '#F1ECE1', padding: '10px 18px', borderRadius: 2, fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {t('Đặt', 'Book')}
                      </Link>
                    </div>
                  ))}
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section style={{ background: '#F1ECE1', color: '#15110C', padding: 'clamp(72px,9vw,120px) 28px' }}>
        <div style={{ maxWidth: 920, margin: '0 auto', textAlign: 'center' }}>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 80, color: '#EE8A33', lineHeight: 0, display: 'block', height: 40 }}>{"\u201C"}</span>
          <p style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: 'clamp(22px,3vw,34px)', lineHeight: 1.4, fontWeight: 500, marginTop: 20 }}>
            {t('Đường fade sạch nhất mình từng cắt trong nhiều năm. Cả trải nghiệm — từ tư vấn, khăn nóng đến hoàn thiện — đều thực sự đẳng cấp. Mình sẽ không đi đâu khác.', 'Cleanest fade I\'ve had in years. The whole experience — the consultation, the hot towel, the finish — feels genuinely premium. I won\'t go anywhere else.')}
          </p>
          <div style={{ marginTop: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
            <span style={{ width: 44, height: 44, borderRadius: '50%', background: '#16110C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display', serif", color: '#EE8A33', fontWeight: 700 }}>MH</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>Minh Hoàng</div>
              <div style={{ fontSize: 12.5, color: 'rgba(21,17,12,.55)' }}>{t('Khách quen · Saigon Centre', 'Regular client · Saigon Centre')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* CAREERS */}
      <section id="careers" style={{ background: '#0B1620', padding: 'clamp(72px,9vw,128px) 28px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(80% 120% at 100% 0%,#16110C 0%,transparent 60%)' }} />
        <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 48, alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
              <span style={{ width: 38, height: 1, background: '#EE8A33' }} />
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.26em', textTransform: 'uppercase', color: '#EE8A33' }}>{t('Tuyển dụng', 'Careers')}</span>
            </div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 'clamp(32px,4.6vw,54px)', lineHeight: 1.05, color: '#F1ECE1' }}>{t('Phát triển tay nghề cùng GOODHAIR.', 'Build your craft at GOODHAIR.')}</h2>
            <p style={{ marginTop: 22, maxWidth: 520, fontSize: 16, lineHeight: 1.7, color: 'rgba(241,236,225,.62)', fontWeight: 300 }}>
              {t('Chúng tôi đang tuyển master barber, barber junior và lễ tân cho tất cả chi nhánh. Lương cạnh tranh, đào tạo bài bản, và một đội ngũ thực sự nghiêm túc với nghề.', 'We\'re hiring master barbers, junior barbers and front-desk staff across all branches. Competitive pay, real training, and a team that takes the craft seriously.')}
            </p>
            <a href="#" style={{ textDecoration: 'none', display: 'inline-block', marginTop: 32, background: '#EE8A33', color: '#0B1620', padding: '16px 32px', borderRadius: 2, fontSize: 13, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              {t('Xem vị trí tuyển dụng', 'View open roles')}
            </a>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {[
              { title: 'Master Barber', time: t('Toàn thời gian · HCM & Hà Nội', 'Full-time · HCM & Hà Nội'), count: t('3 vị trí', '3 openings') },
              { title: 'Junior Barber', time: t('Toàn thời gian · Đà Nẵng', 'Full-time · Đà Nẵng'), count: t('2 vị trí', '2 openings') },
              { title: 'Lễ tân / Front Desk', time: t('Bán thời gian · Thảo Điền', 'Part-time · Thảo Điền'), count: t('1 vị trí', '1 opening') },
            ].map(job => (
              <div key={job.title} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '20px 24px', background: '#0F1E2B', border: '1px solid rgba(238,138,51,.16)', borderRadius: 3 }}>
                <div>
                  <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, fontWeight: 700, color: '#F1ECE1' }}>{job.title}</h3>
                  <p style={{ fontSize: 12.5, color: 'rgba(241,236,225,.55)', marginTop: 3 }}>{job.time}</p>
                </div>
                <span style={{ fontSize: 12, color: '#EE8A33', whiteSpace: 'nowrap' }}>{job.count}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BOOKING CTA */}
      <section style={{ background: 'linear-gradient(160deg,#13283a 0%,#0B1620 100%)', borderTop: '1px solid rgba(238,138,51,.25)', borderBottom: '1px solid rgba(238,138,51,.25)', padding: 'clamp(64px,8vw,110px) 28px', textAlign: 'center' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.26em', textTransform: 'uppercase', color: '#EE8A33' }}>{t('Sẵn sàng khi bạn muốn', 'Ready when you are')}</span>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: 'clamp(34px,5vw,62px)', lineHeight: 1.04, color: '#fff', marginTop: 18 }}>{t('Đặt ghế của bạn trong 30 giây.', 'Book your chair in 30 seconds.')}</h2>
          <p style={{ marginTop: 20, fontSize: 16, lineHeight: 1.6, color: 'rgba(255,255,255,.82)', fontWeight: 300 }}>
            {t('Chọn chi nhánh, barber, dịch vụ và khung giờ phù hợp. Chúng tôi sẽ gửi nhắc lịch qua SMS & Zalo trước buổi hẹn.', 'Choose a branch, your barber, services and a time that fits. We\'ll send an SMS & Zalo reminder before your appointment.')}
          </p>
          <Link href="/bookings" style={{ textDecoration: 'none', display: 'inline-block', marginTop: 34, background: '#0B1620', color: '#fff', padding: '18px 44px', borderRadius: 2, fontSize: 14, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            {t('Bắt đầu đặt lịch', 'Start booking')}
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#080F17', padding: '72px 28px 36px', borderTop: '1px solid rgba(238,138,51,.16)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.4fr', gap: 40 }}>
          <div>
            <div style={{ marginBottom: 18 }}><img src="/logo/logo.jpg" alt="GOODHAIR" style={{ width: 128, height: 128, objectFit: 'cover', borderRadius: 8, border: '1px solid rgba(238,138,51,.25)' }} /></div>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'rgba(241,236,225,.5)', maxWidth: 260, fontWeight: 300 }}>{t('Good hair, good mood. Chăm sóc tóc nam cao cấp từ 2024.', 'Good hair, good mood. Premium men\'s grooming since 2024.')}</p>
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <span style={{ width: 38, height: 38, border: '1px solid rgba(238,138,51,.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EE8A33', fontSize: 13, fontWeight: 700 }}>f</span>
              <span style={{ width: 38, height: 38, border: '1px solid rgba(238,138,51,.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EE8A33', fontSize: 13, fontWeight: 700 }}>ig</span>
              <span style={{ width: 38, height: 38, border: '1px solid rgba(238,138,51,.3)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EE8A33', fontSize: 12, fontWeight: 700 }}>tik</span>
            </div>
          </div>
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: '#EE8A33', marginBottom: 18 }}>{t('Khám phá', 'Explore')}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { href: '#about', label: t('Giới thiệu', 'About') },
                { href: '#services', label: t('Dịch vụ', 'Services') },
                { href: '#barbers', label: t('Barber', 'Barbers') },
                { href: '#branches', label: t('Chi nhánh', 'Locations') },
              ].map(item => (
                <a key={item.href} href={item.href} style={{ textDecoration: 'none', color: 'rgba(241,236,225,.62)', fontSize: 14 }}>{item.label}</a>
              ))}
            </div>
          </div>
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: '#EE8A33', marginBottom: 18 }}>{t('Công ty', 'Company')}</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <a href="#careers" style={{ textDecoration: 'none', color: 'rgba(241,236,225,.62)', fontSize: 14 }}>{t('Tuyển dụng', 'Careers')}</a>
              <Link href="/services" style={{ textDecoration: 'none', color: 'rgba(241,236,225,.62)', fontSize: 14 }}>{t('Quản trị hệ thống', 'Admin dashboard')}</Link>
              <a href="#" style={{ textDecoration: 'none', color: 'rgba(241,236,225,.62)', fontSize: 14 }}>{t('Thành viên', 'Membership')}</a>
              <a href="#" style={{ textDecoration: 'none', color: 'rgba(241,236,225,.62)', fontSize: 14 }}>{t('Thẻ quà tặng', 'Gift cards')}</a>
              <a href="#" style={{ textDecoration: 'none', color: 'rgba(241,236,225,.62)', fontSize: 14 }}>{t('Liên hệ', 'Contact')}</a>
            </div>
          </div>
          <div>
            <h4 style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: '#EE8A33', marginBottom: 18 }}>{t('Nhận tin mới', 'Get the latest')}</h4>
            <p style={{ fontSize: 13.5, color: 'rgba(241,236,225,.5)', marginBottom: 14, fontWeight: 300 }}>{t('Ưu đãi, chi nhánh mới và mẹo chăm tóc.', 'Offers, new branches and grooming tips.')}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input placeholder={lang === 'vi' ? 'Email của bạn' : 'Your email'} style={{ flex: 1, background: '#0F1E2B', border: '1px solid rgba(238,138,51,.25)', color: '#F1ECE1', padding: '12px 14px', borderRadius: 2, fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 13, outline: 'none' }} />
              <button style={{ background: '#EE8A33', color: '#0B1620', border: 'none', padding: '0 18px', borderRadius: 2, fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', cursor: 'pointer' }}>
                {t('Đăng ký', 'Join')}
              </button>
            </div>
          </div>
        </div>
        <div style={{ maxWidth: 1280, margin: '48px auto 0', paddingTop: 24, borderTop: '1px solid rgba(238,138,51,.12)', display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12.5, color: 'rgba(241,236,225,.4)' }}>© 2026 GOODHAIR Barbershop. All rights reserved.</span>
          <div style={{ display: 'flex', gap: 24 }}>
            <a href="#" style={{ textDecoration: 'none', color: 'rgba(241,236,225,.4)', fontSize: 12.5 }}>{t('Bảo mật', 'Privacy')}</a>
            <a href="#" style={{ textDecoration: 'none', color: 'rgba(241,236,225,.4)', fontSize: 12.5 }}>{t('Điều khoản', 'Terms')}</a>
          </div>
        </div>
      </footer>

      <style>{`
        @media (max-width: 920px) {
          header nav { display: none !important; }
          header > div > div:has(a[href="/bookings"]) { display: none !important; }
          header button:last-of-type { display: flex !important; }
          #gh-hero-grid { grid-template-columns: 1fr !important; }
          #gh-hero-media { display: none !important; }
          #gh-branch-grid { grid-template-columns: 1fr !important; }
          #gh-branch-map { position: relative !important; top: 0 !important; min-height: 300px !important; }
          #gh-foot-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 560px) {
          #gh-foot-grid { grid-template-columns: 1fr !important; }
          #gh-stats { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  );
}
