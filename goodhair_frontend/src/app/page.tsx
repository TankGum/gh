'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useLang } from '@/hooks/useLang';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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
import { FOUNDING_YEAR, HAPPY_CLIENTS, FACEBOOK_URL, MESSENGER_URL, CONTACT_EMAIL, CONTACT_PHONE } from '@/constants';
import BranchMap from '@/components/ui/BranchMap';

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

type TabKey = 'home' | 'branches' | 'barbers' | 'services' | 'contact';

interface Slide {
  key: string;
  kicker: string;
  title: string;
  desc: string;
  image: string | null;
  fallback: string;
  initials: string;
  cardSub: string;
  meta: string | null;
  href: string;
  cta: string;
  rating: number | null;
  reviewHref: string | null;
  isOverview?: boolean;
  isContact?: boolean;
  priceTag?: string | null;
  durationTag?: string | null;
}

// Nền gradient thương hiệu dùng khi slide không có ảnh (dịch vụ, barber thiếu avatar...)
const FALLBACK_BGS = [
  'radial-gradient(120% 100% at 75% 10%, rgba(238,138,51,.22) 0%, transparent 45%), linear-gradient(135deg,#14293C 0%,#0B1620 58%,#1E1006 100%)',
  'radial-gradient(110% 100% at 20% 90%, rgba(238,138,51,.16) 0%, transparent 50%), linear-gradient(155deg,#2A160A 0%,#0B1620 52%,#10222F 100%)',
  'radial-gradient(130% 90% at 85% 85%, rgba(238,138,51,.18) 0%, transparent 48%), linear-gradient(160deg,#0F2233 0%,#081019 55%,#241407 100%)',
  'radial-gradient(100% 110% at 15% 15%, rgba(238,138,51,.2) 0%, transparent 46%), linear-gradient(140deg,#1C2F42 0%,#0A1420 60%,#170C05 100%)',
];

const formatPrice = (price: number) =>
  new Intl.NumberFormat('vi-VN').format(price) + ' VND';

const shortPrice = (price: number) =>
  price >= 1000 ? `${Math.round(price / 1000)}K` : String(price);

const fmtCoord = (lat: number, lng: number) =>
  `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`;

const trimStr = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

const getInitials = (name: string) =>
  name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();

// Ảnh demo tạm cho barber chưa có avatar — xoay vòng theo thứ tự
const BARBER_DEMO_IMAGES = ['/barber_demo/b1.jpg', '/barber_demo/b2.jpg', '/barber_demo/b3.jpg'];

// Ảnh demo fallback cho dịch vụ chưa upload ảnh — chọn theo từ khóa trong tên/mô tả
const serviceDemoImage = (name: string, description: string | null) => {
  const s = `${name} ${description ?? ''}`.toLowerCase();
  if (/nhuộm|nhuom|color|bleach|blecnt/.test(s)) return '/service_demo/color.jpg';
  if (/cạo|shave|beard|râu/.test(s)) return '/service_demo/shave.jpg';
  if (/gội|goi dau|wash|massage/.test(s)) return '/service_demo/wash.jpg';
  if (/uốn|perm|tạo kiểu|styling|sấy/.test(s)) return '/service_demo/style.jpg';
  if (/cắt|\bcut\b/.test(s)) return '/service_demo/cut.jpg';
  return '/service_demo/default.jpg';
};

// Nút CTA dạng "vuốt để đặt lịch": phải kéo nút tròn (mũi tên) từ đầu đến cuối
// thanh trượt thì mới điều hướng — bấm/nhả giữa chừng sẽ tự trượt về lại vị trí đầu.
function SwipeToBookCTA({ href, label }: { href: string; label: string }) {
  const router = useRouter();
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, startX: 0 });
  const [trackWidth, setTrackWidth] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [completed, setCompleted] = useState(false);

  const THUMB = 42;
  const PAD = 8;
  const limit = Math.max(trackWidth - THUMB - PAD * 2, 0);

  // Đo bề rộng thanh trượt (đổi khi resize) để tính giới hạn kéo — đọc ref
  // trong effect, không phải lúc render.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const update = () => setTrackWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (completed) return;
    drag.current = { down: true, startX: e.clientX - dragX };
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!drag.current.down || completed) return;
    setDragX(Math.min(Math.max(e.clientX - drag.current.startX, 0), limit));
  };

  const finishDrag = () => {
    if (!drag.current.down) return;
    drag.current.down = false;
    setDragging(false);
    if (limit > 0 && dragX >= limit * 0.82) {
      setDragX(limit);
      setCompleted(true);
      window.setTimeout(() => router.push(href), 240);
    } else {
      setDragX(0);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (completed) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setCompleted(true);
      router.push(href);
    }
  };

  const progress = limit > 0 ? dragX / limit : 0;

  return (
    <div
      ref={trackRef}
      role="button"
      tabIndex={0}
      aria-label={label}
      onKeyDown={onKeyDown}
      className="ghx-cta"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: 300,
        maxWidth: '100%',
        height: THUMB + PAD * 2,
        background: '#EE8A33',
        borderRadius: 999,
        padding: PAD,
        boxSizing: 'border-box',
        boxShadow: '0 12px 34px rgba(238,138,51,.35)',
        overflow: 'hidden',
        userSelect: 'none',
        transition: 'filter .2s ease, box-shadow .2s ease',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          left: THUMB + PAD + 14,
          right: 16,
          top: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          color: '#0B1620',
          fontSize: 12.5,
          fontWeight: 800,
          letterSpacing: '.14em',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          opacity: Math.max(1 - progress * 1.8, 0),
          transition: dragging ? 'none' : 'opacity .25s ease',
          pointerEvents: 'none',
        }}
      >
        {label}
      </span>
      <span
        className="ghx-cta-arrow"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
        style={{
          position: 'relative',
          zIndex: 1,
          width: THUMB,
          height: THUMB,
          borderRadius: '50%',
          background: '#0B1620',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          transform: `translateX(${dragX}px)`,
          transition: dragging ? 'none' : 'transform .3s cubic-bezier(.22,.61,.36,1)',
          cursor: completed ? 'default' : 'grab',
          touchAction: 'none',
        }}
      >
        <span
          className={!dragging && !completed ? 'ghx-cta-hint' : undefined}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EE8A33" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </span>
      </span>
    </div>
  );
}

export default function HomePage() {
  const { lang, setLang } = useLang();
  const [tab, setTab] = useState<TabKey>('home');
  const [index, setIndex] = useState(0);
  const [branchesList, setBranchesList] = useState<PublicBranch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [employeesList, setEmployeesList] = useState<PublicEmployee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(true);
  const [servicesList, setServicesList] = useState<PublicService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [nearestBranchId, setNearestBranchId] = useState<string | null>(null);
  const [nearestDistance, setNearestDistance] = useState<number | null>(null);
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Deep-link tab qua query param (?tab=barbers|services)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('tab');
    if (p === 'home' || p === 'branches' || p === 'barbers' || p === 'services' || p === 'contact') setTab(p);
  }, []);

  // Fetch dữ liệu public
  useEffect(() => {
    fetchPublicBranches({ size: 20 })
      .then(res => setBranchesList(res.items))
      .catch(() => {})
      .finally(() => setBranchesLoading(false));
    fetchPublicEmployees({ size: 20 })
      .then(res => setEmployeesList(res.items))
      .catch(() => {})
      .finally(() => setEmployeesLoading(false));
    fetchPublicServices({ size: 20 })
      .then(res => setServicesList(res.items))
      .catch(() => {})
      .finally(() => setServicesLoading(false));
    fetchPublicStats()
      .then(setStats)
      .catch(() => {});
    getMe()
      .then(user => setMe(user))
      .catch(() => setMe(null))
      .finally(() => setAuthChecked(true));
  }, []);

  // Vị trí người dùng → tìm chi nhánh gần nhất
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  useEffect(() => {
    if (!userLocation || branchesList.length === 0) return;
    const withCoords = branchesList.filter(b => b.latitude != null && b.longitude != null);
    if (withCoords.length === 0) return;

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

    let nearest = withCoords[0];
    let minDist = haversine(userLocation.lat, userLocation.lng, nearest.latitude!, nearest.longitude!);
    for (let i = 1; i < withCoords.length; i++) {
      const b = withCoords[i];
      const d = haversine(userLocation.lat, userLocation.lng, b.latitude!, b.longitude!);
      if (d < minDist) { minDist = d; nearest = b; }
    }
    setNearestBranchId(nearest.id);
    setNearestDistance(Math.round(minDist * 10) / 10);
  }, [userLocation, branchesList]);

  const t = useCallback(
    (vi: string, en: string) => (lang === 'vi' ? vi : en),
    [lang]
  );

  const branchById = useMemo(
    () => new Map(branchesList.map(b => [b.id, b])),
    [branchesList]
  );

  // Deck slide theo tab đang chọn
  const slides: Slide[] = useMemo(() => {
    if (tab === 'home' || tab === 'contact') return [];
    if (tab === 'branches') {
      return branchesList.map((b, i) => {
        const isNearest = b.id === nearestBranchId;
        const open = b.openingTime?.slice(0, 5);
        const close = b.closingTime?.slice(0, 5);
        return {
          key: `branch-${b.id}`,
          kicker: isNearest && nearestDistance != null
            ? t(`Gần bạn nhất · ${nearestDistance} km`, `Nearest to you · ${nearestDistance} km`)
            : (b.address ? trimStr(b.address, 44) : t('Chi nhánh GOODHAIR', 'GOODHAIR location')),
          title: b.name,
          desc: t(
            `Không gian GOODHAIR tại ${b.address ?? 'trung tâm thành phố'}.${open && close ? ` Mở cửa ${open} – ${close},` : ''} ${b.seatCount} ghế${b.barberCount > 0 ? ` cùng ${b.barberCount} barber` : ''} sẵn sàng cho diện mạo mới của bạn.`,
            `The GOODHAIR space at ${b.address ?? 'the heart of the city'}.${open && close ? ` Open ${open} – ${close},` : ''} ${b.seatCount} chairs${b.barberCount > 0 ? ` and ${b.barberCount} barbers` : ''} ready for your next look.`,
          ),
          image: b.imageUrl,
          fallback: FALLBACK_BGS[i % FALLBACK_BGS.length],
          initials: getInitials(b.name),
          cardSub: b.rating > 0
            ? `★ ${b.rating.toFixed(1)} · ${b.seatCount} ${t('ghế', 'chairs')}`
            : (b.address ? trimStr(b.address, 26) : 'GOODHAIR'),
          meta: b.latitude != null && b.longitude != null
            ? fmtCoord(b.latitude, b.longitude)
            : (b.address ? trimStr(b.address, 52) : null),
          href: `/bookings?branchId=${b.id}&step=2`,
          cta: t('Đặt lịch tại đây', 'Book this location'),
          rating: b.rating,
          reviewHref: b.latitude != null && b.longitude != null
            ? `https://www.google.com/maps/search/${encodeURIComponent(`GOODHAIR ${b.name} ${b.address || ''}`)}/@${b.latitude},${b.longitude},17z`
            : null,
        };
      });
    }
    if (tab === 'barbers') {
      return employeesList.map((emp, i) => {
        const branch = emp.branchId ? branchById.get(emp.branchId) : undefined;
        const name = emp.displayName || emp.name;
        return {
          key: `barber-${emp.id}`,
          kicker: [emp.roleName, branch?.name].filter(Boolean).join(' · ') || t('Đội ngũ GOODHAIR', 'GOODHAIR team'),
          title: name,
          desc: t(
            `${name} — barber tại ${branch?.name ?? 'GOODHAIR'}. Tay nghề được tuyển chọn kỹ lưỡng và đào tạo liên tục, sẵn sàng cho kiểu tóc chuẩn từng chi tiết.`,
            `${name} — barber at ${branch?.name ?? 'GOODHAIR'}. Hand-picked, continuously trained, and ready to nail your cut down to the detail.`,
          ),
          image: emp.avatarUrl || BARBER_DEMO_IMAGES[i % BARBER_DEMO_IMAGES.length],
          fallback: FALLBACK_BGS[i % FALLBACK_BGS.length],
          initials: getInitials(name),
          cardSub: emp.roleName || 'BARBER',
          meta: branch?.address ? trimStr(branch.address, 52) : (branch?.name ?? null),
          href: emp.branchId
            ? `/bookings?branchId=${emp.branchId}&barberId=${emp.id}&step=3`
            : '/bookings',
          cta: t('Đặt lịch với barber', 'Book this barber'),
          rating: null,
          reviewHref: null,
        };
      });
    }
    return servicesList.map((svc, i) => ({
      key: `service-${svc.id}`,
      kicker: t('Dịch vụ GOODHAIR', 'GOODHAIR service'),
      title: svc.name,
      desc: svc.description || t(
        `${svc.durationMinutes} phút được chăm chút bởi barber bậc thầy — giá minh bạch, không phát sinh, đặt lịch chỉ trong 30 giây.`,
        `${svc.durationMinutes} minutes in the hands of a master barber — transparent pricing, no surprises, booked in 30 seconds.`,
      ),
      image: svc.imageUrl || serviceDemoImage(svc.name, svc.description),
      fallback: FALLBACK_BGS[i % FALLBACK_BGS.length],
      initials: getInitials(svc.name),
      cardSub: `${svc.durationMinutes}P · ${shortPrice(svc.price)}`,
      meta: null,
      href: '/bookings',
      cta: t('Đặt dịch vụ này', 'Book this service'),
      rating: null,
      reviewHref: null,
      priceTag: formatPrice(svc.price),
      durationTag: `${svc.durationMinutes} ${t('phút', 'min')}`,
    }));
  }, [tab, branchesList, employeesList, servicesList, branchById, nearestBranchId, nearestDistance, t]);

  const deckLoading = tab === 'home' || tab === 'contact' ? false : tab === 'branches' ? branchesLoading : tab === 'barbers' ? employeesLoading : servicesLoading;

  // Slide "Trang chủ" — giới thiệu thương hiệu + số liệu từ API; cũng dùng làm fallback khi 1 tab rỗng
  const overviewSlide: Slide = useMemo(() => ({
    key: 'overview',
    kicker: t(`Barbershop cao cấp · Est. ${FOUNDING_YEAR}`, `Premium barbershop · Est. ${FOUNDING_YEAR}`),
    title: 'Good hair, good mood.',
    desc: t(
      'Nghệ thuật chăm sóc tóc nam đẳng cấp. Đội ngũ barber bậc thầy, không gian tinh tế, đặt lịch chỉ trong 30 giây.',
      'The art of premium men\'s grooming. Master barbers, a refined space, and a booking that takes 30 seconds.',
    ),
    image: '/hero_image/hero.jpg',
    fallback: FALLBACK_BGS[0],
    initials: 'GH',
    cardSub: 'GOODHAIR',
    meta: null,
    href: '/bookings',
    cta: t('Đặt lịch ngay', 'Book now'),
    rating: null,
    reviewHref: null,
    isOverview: true,
  }), [t]);

  // Slide "Liên hệ" — thông tin liên lạc dạng chip bấm được
  const contactSlide: Slide = useMemo(() => ({
    key: 'contact',
    kicker: t('Liên hệ & hỗ trợ', 'Contact & support'),
    title: t('Hẹn gặp bạn tại GOODHAIR.', 'See you at GOODHAIR.'),
    desc: t(
      'Gọi điện, gửi email hoặc nhắn Messenger — đội ngũ GOODHAIR luôn sẵn sàng tư vấn kiểu tóc và giữ ghế cho bạn.',
      'Call, email or drop us a Messenger note — the GOODHAIR team is always ready to talk hair and hold a chair for you.',
    ),
    image: '/service_demo/default.jpg',
    fallback: FALLBACK_BGS[2],
    initials: 'GH',
    cardSub: 'GOODHAIR',
    meta: null,
    href: '/bookings',
    cta: t('Đặt lịch ngay', 'Book now'),
    rating: null,
    reviewHref: null,
    isContact: true,
  }), [t]);

  // Tab "Trang chủ"/"Liên hệ" chỉ có đúng 1 slide; các tab khác hiển thị danh sách thật (fallback về slide giới thiệu nếu rỗng)
  const deck: Slide[] = useMemo(() => {
    if (tab === 'home') return [overviewSlide];
    if (tab === 'contact') return [contactSlide];
    return slides.length > 0 ? slides : [overviewSlide];
  }, [tab, slides, overviewSlide, contactSlide]);

  const safeIndex = Math.min(index, deck.length - 1);
  const active = deck[safeIndex];

  // Giữ index hợp lệ khi đổi tab / dữ liệu về
  useEffect(() => {
    if (index >= deck.length) setIndex(0);
  }, [deck.length, index]);

  const go = useCallback(
    (dir: 1 | -1) => setIndex(i => (i + dir + deck.length) % deck.length),
    [deck.length]
  );

  // Điều hướng bằng phím mũi tên
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

  // Tự chuyển slide, timer reset sau mỗi lần điều hướng thủ công.
  // Bỏ qua tick khi tab ẩn hoặc đang mở overlay (map/sidebar) — tránh mount ảnh nền + animation vô ích.
  useEffect(() => {
    if (deck.length < 2) return;
    const id = setInterval(() => {
      if (document.hidden || mapOpen || mobileNavOpen) return;
      go(1);
    }, 9000);
    return () => clearInterval(id);
  }, [go, safeIndex, deck.length, mapOpen, mobileNavOpen]);

  // Preload ảnh của deck hiện tại để crossfade mượt (mỗi URL chỉ preload một lần)
  const preloadedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    slides.forEach(s => {
      if (s.image && !preloadedRef.current.has(s.image)) {
        preloadedRef.current.add(s.image);
        const im = new window.Image();
        im.src = s.image;
      }
    });
  }, [slides]);

  // Layer nền trước đó để crossfade
  const prevRef = useRef<Slide | null>(null);
  const prevSlide = prevRef.current;
  useEffect(() => { prevRef.current = active; });

  const rail = deck.length > 1
    ? [...deck.slice(safeIndex + 1), ...deck.slice(0, safeIndex)].slice(0, 6)
    : [];

  // Kéo ngang dải card bằng chuột (touch đã có scroll native của trình duyệt)
  const railRef = useRef<HTMLDivElement | null>(null);
  const railDrag = useRef({ down: false, startX: 0, scrollLeft: 0, moved: false });

  const onRailPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    const el = railRef.current;
    if (!el) return;
    railDrag.current = { down: true, startX: e.clientX, scrollLeft: el.scrollLeft, moved: false };
  };
  const onRailPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const st = railDrag.current;
    const el = railRef.current;
    if (!st.down || !el) return;
    const dx = e.clientX - st.startX;
    if (!st.moved && Math.abs(dx) > 6) {
      st.moved = true;
      el.setPointerCapture(e.pointerId);
    }
    if (st.moved) el.scrollLeft = st.scrollLeft - dx;
  };
  const onRailPointerUp = () => { railDrag.current.down = false; };

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'branches', label: t('Chi nhánh', 'Locations') },
    { key: 'barbers',  label: t('Barber',    'Barbers') },
    { key: 'services', label: t('Dịch vụ',   'Services') },
    { key: 'contact',  label: t('Liên hệ',   'Contact') },
  ];

  const showMapBtn = tab === 'branches' && branchesList.some(b => b.latitude != null && b.longitude != null);

  const renderBg = (s: Slide) => (
    s.image ? (
      <img src={s.image} alt={s.title} decoding="async" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
    ) : (
      <div style={{ position: 'absolute', inset: 0, background: s.fallback }}>
        <span style={{ position: 'absolute', right: '-2vw', bottom: '-6vw', fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 800, fontSize: '38vw', lineHeight: 1, color: 'rgba(241,236,225,.05)', userSelect: 'none' }}>
          {s.initials[0] ?? 'G'}
        </span>
      </div>
    )
  );

  return (
    <div
      className={`${playfairDisplay.variable} ${hankenGrotesk.variable}`}
      style={{ position: 'relative', height: '100dvh', overflow: 'hidden', background: '#0B1620', color: '#F1ECE1', fontFamily: "'Hanken Grotesk', sans-serif" }}
    >
      {/* ===== NỀN: prev (tĩnh) + active (fade in) + scrim ===== */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        {prevSlide && prevSlide.key !== active.key && (
          <div style={{ position: 'absolute', inset: 0 }}>{renderBg(prevSlide)}</div>
        )}
        <div key={active.key} className="ghx-bg-in" style={{ position: 'absolute', inset: 0 }}>
          {renderBg(active)}
        </div>
        {/* Scrim trái + dưới cho chữ và điều khiển */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(6,12,19,.84) 0%, rgba(6,12,19,.55) 34%, rgba(6,12,19,.16) 58%, rgba(6,12,19,.42) 100%)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(6,12,19,.52) 0%, transparent 22%, transparent 60%, rgba(6,12,19,.74) 100%)' }} />
      </div>

      {/* ===== PILL NAV (desktop: viên thuốc giữa · mobile: thanh full-width, logo trái/hamburger phải) ===== */}
      <header className="ghx-pill" style={{ position: 'absolute', top: 22, left: '50%', transform: 'translateX(-50%)', width: 'max-content', zIndex: 40, display: 'flex', alignItems: 'center', gap: 2, background: 'rgba(244,240,232,.94)', borderRadius: 999, padding: '6px 8px 6px 6px', boxShadow: '0 14px 44px rgba(0,0,0,.4)', backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' }}>
        <button
          onClick={() => { setTab('home'); setIndex(0); }}
          aria-label="home"
          className="ghx-logo-btn"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, marginRight: 6, flexShrink: 0, borderRadius: '50%', boxShadow: tab === 'home' ? '0 0 0 2px #EE8A33' : 'none', transition: 'box-shadow .2s ease' }}
        >
          <img src="/logo/logo.jpg" alt="GOODHAIR" style={{ display: 'block', width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
        </button>
        <div className="ghx-pill-desktop" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {tabs.map(item => (
            <button
              key={item.key}
              onClick={() => { setTab(item.key); setIndex(0); }}
              style={{
                border: 'none', cursor: 'pointer', borderRadius: 999, padding: '9px 15px',
                fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 12.5, fontWeight: 700, letterSpacing: '.02em', whiteSpace: 'nowrap',
                background: tab === item.key ? '#10202E' : 'transparent',
                color: tab === item.key ? '#F1ECE1' : '#22303C',
                transition: 'background .25s ease, color .25s ease',
              }}
            >
              {item.label}
            </button>
          ))}
          <span style={{ width: 1, height: 22, background: 'rgba(16,32,46,.15)', margin: '0 6px', flexShrink: 0 }} />
          <button
            onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#22303C', padding: '8px 8px', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <span style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 11, fontWeight: 800, letterSpacing: '.08em' }}>{lang === 'vi' ? 'EN' : 'VI'}</span>
          </button>
          <Link href="/bookings" style={{ textDecoration: 'none', background: '#EE8A33', color: '#0B1620', padding: '9px 16px', borderRadius: 999, fontSize: 11.5, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase', whiteSpace: 'nowrap', marginLeft: 4, flexShrink: 0 }}>
            {t('Đặt lịch', 'Book now')}
          </Link>
          {me ? (
            <Link href="/services" title={me.name} style={{ display: 'flex', marginLeft: 6, flexShrink: 0 }}>
              {me.avatarUrl ? (
                <img src={me.avatarUrl} alt={me.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                <span style={{ width: 36, height: 36, borderRadius: '50%', background: '#10202E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#F1ECE1' }}>
                  {getInitials(me.name)}
                </span>
              )}
            </Link>
          ) : authChecked && (
            <Link href="/login" style={{ textDecoration: 'none', border: '1px solid rgba(16,32,46,.25)', color: '#22303C', padding: '8px 14px', borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', marginLeft: 6, flexShrink: 0 }}>
              {t('Đăng nhập', 'Sign in')}
            </Link>
          )}
        </div>
        <button
          className="ghx-hamburger"
          onClick={() => setMobileNavOpen(true)}
          aria-label="menu"
          style={{ display: 'none', alignItems: 'center', justifyContent: 'center', width: 38, height: 38, borderRadius: '50%', border: 'none', background: 'transparent', cursor: 'pointer', color: '#22303C', marginLeft: 'auto', flexShrink: 0 }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
      </header>

      {/* ===== SIDEBAR MOBILE: trượt vào từ bên phải ===== */}
      <div
        onClick={() => setMobileNavOpen(false)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)', zIndex: 98, opacity: mobileNavOpen ? 1 : 0, pointerEvents: mobileNavOpen ? 'auto' : 'none', transition: 'opacity .38s ease' }}
      />
      <div
        className={mobileNavOpen ? 'ghx-sb-open' : ''}
        style={{ position: 'fixed', top: 0, right: 0, width: 'min(320px, 86vw)', height: '100dvh', background: 'rgba(244,240,232,.94)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderRadius: '24px 0 0 24px', boxShadow: '-8px 0 40px rgba(0,0,0,.25)', zIndex: 99, transform: mobileNavOpen ? 'translateX(0)' : 'translateX(100%)', transition: 'transform .44s cubic-bezier(.32,.72,0,1)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 20px 14px', flexShrink: 0 }}>
          <button
            onClick={() => { setTab('home'); setIndex(0); setMobileNavOpen(false); }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, border: 'none', background: 'transparent', cursor: 'pointer', padding: 0 }}
          >
            <img src="/logo/logo.jpg" alt="GOODHAIR" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
            <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: 17, letterSpacing: '.03em' }}>
              <span style={{ color: '#15110C' }}>GOOD</span><span style={{ color: '#EE8A33' }}>HAIR</span>
            </span>
          </button>
          <button
            onClick={() => setMobileNavOpen(false)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, background: 'rgba(16,32,46,.06)', border: 'none', borderRadius: '50%', cursor: 'pointer', color: '#22303C', flexShrink: 0 }}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <line x1="1" y1="1" x2="15" y2="15"/><line x1="15" y1="1" x2="1" y2="15"/>
            </svg>
          </button>
        </div>

        <div style={{ height: 1, background: 'rgba(16,32,46,.08)', margin: '0 20px', flexShrink: 0 }} />

        <nav style={{ flex: 1, padding: '14px 14px 0' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(16,32,46,.4)', padding: '0 8px 10px' }}>
            {t('Khám phá', 'Explore')}
          </div>
          {tabs.map(item => (
            <button
              key={item.key}
              onClick={() => { setTab(item.key); setIndex(0); setMobileNavOpen(false); }}
              className="ghx-sb-item"
              style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', marginBottom: 6, borderRadius: 14, background: tab === item.key ? '#10202E' : 'transparent', color: tab === item.key ? '#F1ECE1' : '#22303C', fontSize: 14.5, fontWeight: 700, letterSpacing: '.01em', border: 'none', cursor: 'pointer' }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: tab === item.key ? '#EE8A33' : 'rgba(16,32,46,.22)', flexShrink: 0, transition: 'background .2s ease' }} />
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: '18px 20px 22px', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
          <div style={{ height: 1, background: 'rgba(16,32,46,.08)', marginBottom: 6 }} />
          {me ? (
            <Link href="/services" onClick={() => setMobileNavOpen(false)} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', color: '#22303C', fontSize: 14, fontWeight: 700, background: 'rgba(16,32,46,.05)', borderRadius: 14 }}>
              {me.avatarUrl ? (
                <img src={me.avatarUrl} alt={me.name} style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <span style={{ width: 28, height: 28, borderRadius: '50%', background: '#10202E', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#F1ECE1', flexShrink: 0 }}>
                  {getInitials(me.name)}
                </span>
              )}
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{me.name}</span>
            </Link>
          ) : authChecked && (
            <Link href="/login" onClick={() => setMobileNavOpen(false)} style={{ textDecoration: 'none', background: 'rgba(16,32,46,.05)', color: '#22303C', fontSize: 13, fontWeight: 700, padding: '13px', textAlign: 'center', borderRadius: 14, display: 'block' }}>
              {t('Đăng nhập', 'Sign in')}
            </Link>
          )}
          <Link href="/bookings" onClick={() => setMobileNavOpen(false)} style={{ textDecoration: 'none', background: '#EE8A33', color: '#0B1620', textAlign: 'center', padding: '14px', borderRadius: 14, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', fontSize: 13, display: 'block', boxShadow: '0 6px 20px rgba(238,138,51,.35)' }}>
            {t('Đặt lịch ngay', 'Book now')}
          </Link>
          <button
            onClick={() => setLang(lang === 'vi' ? 'en' : 'vi')}
            style={{ background: 'transparent', border: 'none', color: 'rgba(16,32,46,.55)', padding: '8px 2px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            <span style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.06em' }}>
              {lang === 'vi' ? 'Switch to English' : 'Chuyển sang Tiếng Việt'}
            </span>
          </button>
        </div>
      </div>

      {/* ===== KHỐI CHỮ BÊN TRÁI ===== */}
      {deckLoading && slides.length === 0 ? (
        <div className="ghx-left" style={{ position: 'absolute', zIndex: 30, left: 'clamp(24px,6vw,96px)', top: '50%', transform: 'translateY(-50%)', width: 'min(44vw,540px)' }}>
          <div style={{ width: 180, height: 12, background: 'rgba(241,236,225,.12)', borderRadius: 3, animation: 'ghPulse 1.4s ease infinite' }} />
          <div style={{ width: '85%', height: 64, background: 'rgba(241,236,225,.1)', borderRadius: 6, marginTop: 22, animation: 'ghPulse 1.4s ease .15s infinite' }} />
          <div style={{ width: '70%', height: 46, background: 'rgba(241,236,225,.08)', borderRadius: 6, marginTop: 26, animation: 'ghPulse 1.4s ease .3s infinite' }} />
        </div>
      ) : (
        <div className="ghx-left" key={active.key} style={{ position: 'absolute', zIndex: 30, left: 'clamp(24px,6vw,96px)', top: '50%', transform: 'translateY(-50%)', width: 'min(44vw,540px)' }}>
          <div className="ghx-a1" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ width: 34, height: 1, background: '#EE8A33', flexShrink: 0 }} />
            <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.3em', textTransform: 'uppercase', color: 'rgba(255,255,255,.85)' }}>{active.kicker}</span>
          </div>
          <h1 className="ghx-a2 ghx-title" style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontWeight: 800, fontSize: active.isOverview ? 'clamp(38px,5.4vw,76px)' : 'clamp(40px,6vw,88px)', lineHeight: .98, letterSpacing: '-.01em', textTransform: 'uppercase', color: '#fff', margin: '20px 0 0', textShadow: '0 4px 44px rgba(0,0,0,.4)', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
            {active.isOverview ? (
              <>
                <span style={{ whiteSpace: 'nowrap' }}>
                  {'GOOD '}
                  <span className="ghx-word-hair" style={{ background: 'linear-gradient(105deg, #FFC98F 0%, #EE8A33 45%, #E0701A 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent', textShadow: 'none', filter: 'drop-shadow(0 4px 24px rgba(238,138,51,.35))' }}>
                    HAIR
                  </span>
                  {','}
                </span>
                <br />
                <span style={{ whiteSpace: 'nowrap' }}>
                  {'GOOD '}
                  <span className="ghx-word-mood" style={{ color: 'transparent', WebkitTextStroke: 'clamp(1.5px, .16vw, 2.5px) #F1ECE1', textShadow: 'none' }}>
                    MOOD
                  </span>
                  <span style={{ color: '#EE8A33' }}>.</span>
                </span>
              </>
            ) : active.title}
          </h1>
          <p className="ghx-a3 ghx-desc" style={{ marginTop: 24, fontSize: 15.5, lineHeight: 1.7, color: 'rgba(255,255,255,.78)', fontWeight: 300, maxWidth: 460 }}>
            {active.desc}
          </p>
          {(active.priceTag || active.durationTag) && (
            <div className="ghx-a3" style={{ display: 'inline-flex', alignItems: 'center', gap: 16, marginTop: 24, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.16)', borderRadius: 14, padding: '13px 22px', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
              {active.priceTag && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EE8A33" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                    <line x1="7" y1="7" x2="7.01" y2="7"/>
                  </svg>
                  <span style={{ color: '#FFB36B', fontSize: 16, fontWeight: 800, letterSpacing: '.02em' }}>{active.priceTag}</span>
                </span>
              )}
              {active.priceTag && active.durationTag && (
                <span style={{ width: 1, height: 18, background: 'rgba(255,255,255,.2)', flexShrink: 0 }} />
              )}
              {active.durationTag && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.65)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  <span style={{ color: 'rgba(255,255,255,.85)', fontSize: 14.5, fontWeight: 700, letterSpacing: '.02em' }}>{active.durationTag}</span>
                </span>
              )}
            </div>
          )}
          {active.isContact && (
            <div className="ghx-a3" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 24, maxWidth: 480 }}>
              {[
                {
                  href: `tel:${CONTACT_PHONE.replace(/\s/g, '')}`, label: CONTACT_PHONE, external: false,
                  icon: <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>,
                },
                {
                  href: `mailto:${CONTACT_EMAIL}`, label: CONTACT_EMAIL, external: false,
                  icon: <><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></>,
                },
                {
                  href: FACEBOOK_URL, label: 'Facebook', external: true,
                  icon: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>,
                },
                {
                  href: MESSENGER_URL, label: 'Messenger', external: true,
                  icon: <><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></>,
                },
              ].map(c => (
                <a key={c.label} href={c.href} {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="ghx-contact-chip"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 9, textDecoration: 'none', background: 'rgba(255,255,255,.08)', border: '1px solid rgba(255,255,255,.28)', color: 'rgba(255,255,255,.92)', borderRadius: 12, padding: '11px 17px', fontSize: 14, fontWeight: 700, letterSpacing: '.02em', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', transition: 'background .2s ease, border-color .2s ease, color .2s ease' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EE8A33" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    {c.icon}
                  </svg>
                  {c.label}
                </a>
              ))}
            </div>
          )}
          <div className="ghx-a4" style={{ marginTop: 34 }}>
            <SwipeToBookCTA key={active.href} href={active.href} label={active.cta} />
          </div>
          {active.meta && (
            <div className="ghx-a4 ghx-meta" style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 42, fontSize: 12, letterSpacing: '.16em', color: 'rgba(255,255,255,.55)' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                {tab === 'services' ? (
                  <>
                    <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
                    <line x1="7" y1="7" x2="7.01" y2="7"/>
                  </>
                ) : (
                  <>
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                  </>
                )}
              </svg>
              {active.meta}
            </div>
          )}
          {active.reviewHref && (
            <a href={active.reviewHref} target="_blank" rel="noopener noreferrer" className="ghx-a4"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 18, textDecoration: 'none', color: '#fff', fontSize: 12.5, fontWeight: 700, letterSpacing: '.04em', border: '1px solid rgba(255,255,255,.35)', borderRadius: 999, padding: '9px 16px', transition: 'background .2s ease, border-color .2s ease' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.1)'; e.currentTarget.style.borderColor = '#fff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,.35)'; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={active.rating && active.rating > 0 ? '#f5c842' : 'none'} stroke="#f5c842" strokeWidth="1.5">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              {active.rating && active.rating > 0
                ? `${active.rating.toFixed(1)} · ${t('Xem đánh giá', 'See reviews')}`
                : t('Xem trên Google Maps', 'View on Google Maps')}
            </a>
          )}
          {active.isOverview && stats && (
            <div className="ghx-a4 ghx-stats-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '18px 28px', marginTop: 40, borderTop: '1px solid rgba(255,255,255,.18)', paddingTop: 26 }}>
              {[
                { value: String(stats.branches), label: t('Chi nhánh', 'Locations') },
                { value: String(stats.barbers), label: t('Barber', 'Barbers') },
                { value: String(stats.services), label: t('Dịch vụ', 'Services') },
                { value: `${HAPPY_CLIENTS >= 1000 ? Math.round(HAPPY_CLIENTS / 1000) + 'K' : HAPPY_CLIENTS}+`, label: t('Khách hàng', 'Happy clients') },
              ].map(s => (
                <div key={s.label}>
                  <div style={{ fontFamily: "'Hanken Grotesk', sans-serif", fontWeight: 800, fontSize: 30, color: '#fff' }}>{s.value}</div>
                  <div style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)', marginTop: 4 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== DẢI CARD BÊN PHẢI ===== */}
      <div
        className="ghx-rail"
        key={`rail-${tab}-${safeIndex}`}
        ref={railRef}
        onPointerDown={onRailPointerDown}
        onPointerMove={onRailPointerMove}
        onPointerUp={onRailPointerUp}
        onPointerCancel={onRailPointerUp}
        onDragStart={e => e.preventDefault()}
        style={{ position: 'absolute', zIndex: 30, left: '52%', right: 0, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 20, overflowX: 'auto', overflowY: 'hidden', padding: '14px 20px 14px 8px', scrollbarWidth: 'none', userSelect: 'none', touchAction: 'pan-x' }}
      >
        {deckLoading && slides.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="ghx-card-shell" style={{ width: 192, height: 312, borderRadius: 18, background: 'rgba(241,236,225,.07)', flexShrink: 0, animation: `ghPulse 1.4s ease ${i * .12}s infinite` }} />
            ))
          : rail.map(s => (
              <button
                key={s.key}
                onClick={() => { if (railDrag.current.moved) return; setIndex(deck.indexOf(s)); }}
                className="ghx-card"
                style={{ position: 'relative', width: 192, height: 312, borderRadius: 18, overflow: 'hidden', border: '1px solid rgba(255,255,255,.32)', padding: 0, cursor: 'pointer', flexShrink: 0, background: '#101C28', boxShadow: '0 6px 18px rgba(0,0,0,.45), 0 24px 60px rgba(0,0,0,.6)', textAlign: 'left' }}
              >
                {s.image ? (
                  <img src={s.image} alt={s.title} loading="lazy" decoding="async" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ position: 'absolute', inset: 0, background: s.fallback, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontSize: 64, fontWeight: 800, color: 'rgba(241,236,225,.14)' }}>{s.initials}</span>
                  </div>
                )}
                <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(6,12,19,.62) 0%, transparent 30%, transparent 55%, rgba(6,12,19,.78) 100%)' }} />
                <span style={{ position: 'absolute', top: 14, left: 14, right: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#EE8A33', flexShrink: 0 }} />
                  <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(255,255,255,.88)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.cardSub}</span>
                </span>
                <span className="ghx-card-title" style={{ position: 'absolute', left: 14, right: 12, bottom: 14, fontFamily: "'Hanken Grotesk', sans-serif", fontSize: 16.5, fontWeight: 800, lineHeight: 1.15, textTransform: 'uppercase', letterSpacing: '.01em', color: '#fff' }}>
                  {s.title}
                </span>
              </button>
            ))}
      </div>

      {/* ===== ĐIỀU KHIỂN DƯỚI (ẩn ở home — deck chỉ có 1 slide) ===== */}
      {deck.length > 1 && (
        <>
          <div className="ghx-nav" style={{ position: 'absolute', zIndex: 35, left: 'clamp(24px,6vw,96px)', bottom: 34, display: 'flex', gap: 12 }}>
            {([['prev', -1], ['next', 1]] as const).map(([name, dir]) => (
              <button key={name} onClick={() => go(dir)} className="ghx-ctl" aria-label={name}
                style={{ width: 46, height: 46, borderRadius: '50%', border: '1px solid rgba(255,255,255,.4)', background: 'rgba(10,16,24,.3)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .25s ease, border-color .25s ease' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transform: dir === -1 ? 'rotate(180deg)' : 'none' }}>
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </button>
            ))}
            {showMapBtn && (
              <button onClick={() => setMapOpen(true)} className="ghx-ctl" aria-label="map"
                style={{ width: 46, height: 46, borderRadius: '50%', border: '1px solid rgba(255,255,255,.4)', background: 'rgba(10,16,24,.3)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .25s ease, border-color .25s ease' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4z"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/>
                </svg>
              </button>
            )}
          </div>
          <div className={`ghx-progress${showMapBtn ? ' ghx-progress-map' : ''}`} style={{ position: 'absolute', zIndex: 35, left: `calc(clamp(24px,6vw,96px) + ${showMapBtn ? 186 : 128}px)`, right: 'clamp(140px,16vw,240px)', bottom: 56, height: 2, background: 'rgba(255,255,255,.22)', borderRadius: 2 }}>
            <div style={{ height: '100%', width: `${((safeIndex + 1) / deck.length) * 100}%`, background: '#fff', borderRadius: 2, transition: 'width .5s cubic-bezier(.22,.61,.36,1)' }} />
          </div>
        </>
      )}
      {deck.length > 1 && (
        <div className="ghx-num" style={{ position: 'absolute', zIndex: 34, right: 'clamp(20px,4vw,48px)', bottom: -10, fontFamily: "'Hanken Grotesk', sans-serif", fontWeight: 800, fontSize: 'clamp(72px,10vw,144px)', lineHeight: 1, letterSpacing: '-.02em', color: 'rgba(255,255,255,.92)', textShadow: '0 6px 44px rgba(0,0,0,.4)', pointerEvents: 'none' }}>
          {String(safeIndex + 1).padStart(2, '0')}
        </div>
      )}

      {/* ===== FOOTER (chỉ hiện ở tab tĩnh — Trang chủ / Liên hệ) ===== */}
      {deck.length === 1 && (
        <footer className="ghx-footer" style={{ position: 'absolute', zIndex: 30, left: 'clamp(24px,6vw,96px)', right: 'clamp(24px,6vw,96px)', bottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, borderTop: '1px solid rgba(255,255,255,.16)', paddingTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontWeight: 800, fontSize: 14, letterSpacing: '.04em', whiteSpace: 'nowrap' }}>
              <span style={{ color: '#F1ECE1' }}>GOOD</span><span style={{ color: '#EE8A33' }}>HAIR</span>
            </span>
            <span className="ghx-footer-copy" style={{ fontSize: 11.5, color: 'rgba(255,255,255,.42)', letterSpacing: '.04em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              © {new Date().getFullYear()} · {t('Tóc nam cao cấp', 'Premium barbershop')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <a href={`tel:${CONTACT_PHONE.replace(/\s/g, '')}`} className="ghx-soc ghx-footer-phone" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, textDecoration: 'none', color: 'rgba(255,255,255,.65)', fontSize: 12, fontWeight: 700, letterSpacing: '.06em', border: '1px solid rgba(255,255,255,.25)', borderRadius: 999, padding: '8px 14px', transition: 'color .2s ease, border-color .2s ease, background .2s ease' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
              </svg>
              {CONTACT_PHONE}
            </a>
            <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="ghx-soc" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(255,255,255,.25)', color: 'rgba(255,255,255,.65)', textDecoration: 'none', transition: 'color .2s ease, border-color .2s ease, background .2s ease' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>
            <a href={MESSENGER_URL} target="_blank" rel="noopener noreferrer" aria-label="Messenger" className="ghx-soc" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(255,255,255,.25)', color: 'rgba(255,255,255,.65)', textDecoration: 'none', transition: 'color .2s ease, border-color .2s ease, background .2s ease' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 4.975 0 11.111c0 3.497 1.745 6.616 4.472 8.652V24l4.086-2.242c1.09.301 2.246.464 3.442.464 6.627 0 12-4.974 12-11.111C24 4.975 18.627 0 12 0zm1.193 14.963l-3.056-3.259-5.963 3.259L10.732 8.2l3.131 3.259L19.752 8.2l-6.559 6.763z"/></svg>
            </a>
          </div>
        </footer>
      )}

      {/* ===== MODAL BẢN ĐỒ CHI NHÁNH (theme sáng đồng bộ pill nav / sidebar) ===== */}
      {mapOpen && (
        <div
          onClick={() => setMapOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="ghx-map-panel"
            style={{ width: 'min(920px, 100%)', maxHeight: 'calc(100dvh - 32px)', background: 'rgba(244,240,232,.97)', backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)', borderRadius: 24, boxShadow: '0 32px 90px rgba(0,0,0,.45)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '18px 20px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <img src="/logo/logo.jpg" alt="GOODHAIR" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: '#15110C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('Chi nhánh GOODHAIR', 'GOODHAIR locations')}</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(16,32,46,.5)', marginTop: 1 }}>
                    {t(`${branchesList.length} chi nhánh · chấm to là nơi gần bạn nhất`, `${branchesList.length} locations · the big pin is nearest to you`)}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setMapOpen(false)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 34, background: 'rgba(16,32,46,.06)', border: 'none', borderRadius: '50%', cursor: 'pointer', color: '#22303C', flexShrink: 0 }}
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <line x1="1" y1="1" x2="15" y2="15"/><line x1="15" y1="1" x2="1" y2="15"/>
                </svg>
              </button>
            </div>
            <div style={{ margin: '0 14px 14px', height: 'min(58vh, 520px)', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(16,32,46,.12)' }}>
              <BranchMap branches={branchesList} t={t} nearestId={nearestBranchId} />
            </div>
          </div>
        </div>
      )}

      {/* ===== ANIMATION + RESPONSIVE ===== */}
      <style>{`
        @keyframes ghFadeUp {
          from { opacity: 0; transform: translateY(26px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ghBgIn {
          from { opacity: 0; transform: scale(1.05); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes ghCardIn {
          from { opacity: 0; transform: translateX(52px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes ghPulse {
          0%, 100% { opacity: .45; }
          50%      { opacity: 1; }
        }
        .ghx-bg-in { animation: ghBgIn 1.1s cubic-bezier(.22,.61,.36,1) both; }
        .ghx-a1 { animation: ghFadeUp .6s cubic-bezier(.22,.61,.36,1) .05s both; }
        .ghx-a2 { animation: ghFadeUp .75s cubic-bezier(.22,.61,.36,1) .16s both; }
        .ghx-a3 { animation: ghFadeUp .75s cubic-bezier(.22,.61,.36,1) .3s both; }
        .ghx-a4 { animation: ghFadeUp .7s cubic-bezier(.22,.61,.36,1) .44s both; }
        .ghx-card { animation: ghCardIn .6s cubic-bezier(.22,.61,.36,1) both; transition: transform .35s cubic-bezier(.22,.61,.36,1), box-shadow .35s ease; }
        .ghx-card:nth-child(1) { animation-delay: .08s; }
        .ghx-card:nth-child(2) { animation-delay: .16s; }
        .ghx-card:nth-child(3) { animation-delay: .24s; }
        .ghx-card:nth-child(4) { animation-delay: .32s; }
        .ghx-card:nth-child(5) { animation-delay: .4s; }
        .ghx-card:nth-child(6) { animation-delay: .48s; }
        .ghx-card:hover { transform: translateY(-10px); box-shadow: 0 28px 64px rgba(0,0,0,.55); }
        .ghx-ctl:hover { background: rgba(255,255,255,.16) !important; border-color: #fff !important; }
        .ghx-contact-chip:hover { background: rgba(238,138,51,.16) !important; border-color: rgba(238,138,51,.6) !important; color: #FFB36B !important; }
        .ghx-soc:hover { background: rgba(238,138,51,.15) !important; border-color: #EE8A33 !important; color: #EE8A33 !important; }
        .ghx-cta:hover { filter: brightness(1.12); box-shadow: 0 14px 38px rgba(238,138,51,.55) !important; }
        @keyframes ghCtaHint { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(5px); } }
        .ghx-cta-hint { animation: ghCtaHint 1.6s ease-in-out infinite; }
        .ghx-pill::-webkit-scrollbar { display: none; }
        .ghx-rail { cursor: grab; }
        .ghx-rail:active { cursor: grabbing; }
        .ghx-rail::-webkit-scrollbar { display: none; }

        .ghx-sb-item {
          opacity: 0;
          transform: translateX(14px);
          transition: opacity .32s ease, transform .32s ease, background .2s ease;
        }
        .ghx-sb-open .ghx-sb-item { opacity: 1; transform: translateX(0); }
        .ghx-sb-open .ghx-sb-item:nth-child(2) { transition-delay: .08s; }
        .ghx-sb-open .ghx-sb-item:nth-child(3) { transition-delay: .14s; }
        .ghx-sb-open .ghx-sb-item:nth-child(4) { transition-delay: .2s; }
        .ghx-sb-open .ghx-sb-item:nth-child(5) { transition-delay: .26s; }

        @media (max-width: 1100px) {
          .ghx-left { width: 48vw !important; }
          .ghx-rail { left: 56% !important; }
        }
        @media (max-width: 920px) {
          .ghx-pill { top: 16px !important; left: 16px !important; right: 16px !important; transform: none !important; width: auto !important; justify-content: space-between !important; background: transparent !important; box-shadow: none !important; backdrop-filter: none !important; -webkit-backdrop-filter: none !important; padding: 0 !important; }
          .ghx-logo-btn img { filter: drop-shadow(0 2px 10px rgba(0,0,0,.55)); }
          .ghx-hamburger { color: #fff !important; filter: drop-shadow(0 2px 8px rgba(0,0,0,.6)); }
          .ghx-pill-desktop { display: none !important; }
          .ghx-hamburger { display: flex !important; }
          .ghx-left { left: 20px !important; right: 20px !important; top: 17% !important; transform: none !important; width: auto !important; }
          .ghx-title { font-size: clamp(36px, 10.5vw, 60px) !important; }
          .ghx-desc { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
          .ghx-meta { display: none !important; }
          .ghx-rail { left: 20px !important; right: 0 !important; top: auto !important; bottom: 112px !important; transform: none !important; overflow-x: auto !important; padding-bottom: 6px; scrollbar-width: none; }
          .ghx-rail::-webkit-scrollbar { display: none; }
          .ghx-card, .ghx-card-shell { width: 128px !important; height: 192px !important; border-radius: 14px !important; }
          .ghx-card-title { font-size: 12.5px !important; }
          .ghx-nav { bottom: 22px !important; left: 20px !important; }
          .ghx-progress { left: 132px !important; right: 104px !important; bottom: 43px !important; }
          .ghx-progress.ghx-progress-map { left: 190px !important; }
          .ghx-num { font-size: 60px !important; right: 14px !important; bottom: -4px !important; }
          .ghx-footer { left: 20px !important; right: 20px !important; bottom: 16px !important; }
          .ghx-footer-copy { display: none !important; }
          .ghx-footer-phone { padding: 8px 11px !important; }
        }
      `}</style>
    </div>
  );
}
