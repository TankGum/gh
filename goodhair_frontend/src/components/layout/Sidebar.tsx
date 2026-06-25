'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Layout, App } from 'antd';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBadge } from '@/contexts/BadgeContext';
import { useIsMobile } from '@/hooks/useIsMobile';
import {
  LayoutDashboard,
  CalendarDays,
  BarChart3,
  Users,
  Clock,
  UserCheck,
  Store,
  Scissors,
  UserCog,
  ShieldCheck,
  History,
  LogOut,
  ChevronLeft,
} from 'lucide-react';
import type { ReactNode } from 'react';

const { Sider } = Layout;

type MenuItem = { key: string; module: string; icon: ReactNode; label: string };

const menuGroups: { label?: string; items: MenuItem[] }[] = [
  {
    items: [
      { key: '/dashboard',       module: 'overview',  icon: <LayoutDashboard size={17} />, label: 'Tổng quan' },
      { key: '/revenue',         module: 'revenue',   icon: <BarChart3 size={17} />,       label: 'Doanh thu' },
      { key: '/manage-bookings', module: 'bookings',  icon: <CalendarDays size={17} />,    label: 'Đặt lịch' },
    ],
  },
  {
    items: [
      { key: '/employees', module: 'staff',     icon: <Users size={17} />,     label: 'Nhân viên' },
      { key: '/shifts',    module: 'shifts',    icon: <Clock size={17} />,     label: 'Ca làm việc' },
      { key: '/customers', module: 'customers', icon: <UserCheck size={17} />, label: 'Khách hàng' },
      { key: '/branches',  module: 'branches',  icon: <Store size={17} />,     label: 'Chi nhánh' },
      { key: '/services',  module: 'services',  icon: <Scissors size={17} />,  label: 'Dịch vụ' },
    ],
  },
  {
    items: [
      { key: '/accounts',  module: 'roles', icon: <UserCog size={17} />,    label: 'Tài khoản' },
      { key: '/roles',     module: 'roles', icon: <ShieldCheck size={17} />, label: 'Vai trò' },
      { key: '/audit-log', module: 'logs',  icon: <History size={17} />,     label: 'Nhật ký hoạt động' },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useSidebar();
  const { account, logout, canView } = useAuth();
  const { modal } = App.useApp();
  const { pendingBookings, pendingAccounts, pendingBookingsList, pendingAccountsList } = useBadge();
  const [hovered, setHovered] = useState<string | null>(null);
  const [badgeHovered, setBadgeHovered] = useState<string | null>(null);
  const [badgePos, setBadgePos] = useState({ x: 0, y: 0 });
  const isMobile = useIsMobile();

  const handleLogout = () => {
    modal.confirm({
      title: 'Xác nhận đăng xuất',
      content: 'Bạn có chắc chắn muốn đăng xuất?',
      okText: 'Đăng xuất',
      cancelText: 'Hủy',
      centered: true,
      okButtonProps: { danger: true },
      onOk: async () => {
        await logout();
        router.push('/login');
      },
    });
  };

  const handleNav = (key: string) => {
    router.push(key);
    if (isMobile) setMobileOpen(false);
  };

  const effectiveCollapsed = isMobile ? false : collapsed;

  return (
    <>
      {/* Mobile backdrop */}
      {isMobile && mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 39, backdropFilter: 'blur(2px)' }}
        />
      )}

      <Sider
        width={256}
        collapsedWidth={64}
        theme="dark"
        collapsible
        collapsed={effectiveCollapsed}
        onCollapse={setCollapsed}
        trigger={null}
        style={{
          background: '#0b1620',
          borderRight: '1px solid rgba(255,255,255,.06)',
          height: '100vh',
          position: 'fixed',
          top: 0,
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          overflow: isMobile ? 'visible' : 'hidden',
          left: isMobile ? (mobileOpen ? '0' : '-256px') : 0,
          transition: isMobile ? 'left .25s ease' : undefined,
          boxShadow: isMobile && mobileOpen ? '4px 0 32px rgba(0,0,0,.6)' : 'none',
        }}
      >
        {/* Logo */}
        <div
          onClick={() => handleNav('/')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
            height: 64,
            gap: effectiveCollapsed ? 0 : 10,
            cursor: 'pointer',
            padding: effectiveCollapsed ? 0 : '0 20px',
            borderBottom: '1px solid rgba(255,255,255,.06)',
            flexShrink: 0,
          }}
        >
          <img
            src="/logo/logo.jpg"
            alt="GoodHair"
            style={{ height: 32, width: 32, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }}
          />
          <span style={{
            fontSize: 17,
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '2.5px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            transition: 'max-width .2s, opacity .2s',
            maxWidth: effectiveCollapsed ? 0 : 160,
            opacity: effectiveCollapsed ? 0 : 1,
          }}>
            GOOD<span style={{ color: '#ee8a33' }}>HAIR</span>
          </span>
        </div>

        {/* Middle: nav + collapse + profile */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Nav */}
          <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 0' }}>
            {menuGroups.map((group, gi) => {
              const visible = group.items.filter(item => canView(item.module));
              if (!visible.length) return null;
              return (
                <div key={gi}>
                  {gi > 0 && (
                    <div style={{ height: 1, background: 'rgba(255,255,255,.06)', margin: '8px 14px' }} />
                  )}
                  {visible.map(item => {
                    const isActive = pathname === item.key;
                    const isHovered = hovered === item.key;
                    const badge =
                      item.key === '/manage-bookings' ? pendingBookings :
                      item.key === '/accounts' ? pendingAccounts :
                      undefined;

                    return (
                      <div
                        key={item.key}
                        onClick={() => handleNav(item.key)}
                        onMouseEnter={() => setHovered(item.key)}
                        onMouseLeave={() => setHovered(null)}
                        title={effectiveCollapsed ? item.label : undefined}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          margin: '1px 8px',
                          padding: effectiveCollapsed ? '10px 0' : '9px 12px',
                          justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
                          borderRadius: 8,
                          cursor: 'pointer',
                          position: 'relative',
                          background: isActive
                            ? 'rgba(238,138,51,.13)'
                            : isHovered
                            ? 'rgba(255,255,255,.05)'
                            : 'transparent',
                          boxShadow: isActive ? 'inset 3px 0 0 #EE8A33' : 'none',
                          transition: 'background .15s',
                        }}
                      >
                        <span style={{
                          color: isActive ? '#EE8A33' : isHovered ? 'rgba(255,255,255,.8)' : 'rgba(255,255,255,.42)',
                          flexShrink: 0,
                          transition: 'color .15s',
                          display: 'flex',
                        }}>
                          {item.icon}
                        </span>

                        {!effectiveCollapsed && (
                          <span style={{
                            fontSize: 13.5,
                            fontWeight: isActive ? 600 : 400,
                            color: isActive ? '#fff' : isHovered ? 'rgba(255,255,255,.85)' : 'rgba(255,255,255,.55)',
                            flex: 1,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            transition: 'color .15s',
                          }}>
                            {item.label}
                          </span>
                        )}

                        {badge && effectiveCollapsed ? (
                          <span style={{ position: 'absolute', top: 7, right: 8, width: 7, height: 7, borderRadius: '50%', background: '#ee8a33', boxShadow: '0 0 0 2px #0b1620' }} />
                        ) : badge ? (
                          <div
                            style={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}
                            onMouseEnter={(e) => { setBadgePos({ x: e.clientX, y: e.clientY }); setBadgeHovered(item.key); }}
                            onMouseLeave={() => setBadgeHovered(null)}
                          >
                            <span style={{ background: '#ee8a33', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, lineHeight: '16px', flexShrink: 0 }}>
                              {badge}
                            </span>
                            {(() => {
                              const showBookings = badgeHovered === '/manage-bookings' && !effectiveCollapsed && item.key === '/manage-bookings' && pendingBookingsList.length > 0;
                              const showAccounts = badgeHovered === '/accounts' && !effectiveCollapsed && item.key === '/accounts' && pendingAccountsList.length > 0;
                              if (!showBookings && !showAccounts) return null;
                              const list = showBookings ? pendingBookingsList : pendingAccountsList;
                              const label = showBookings ? 'lịch chờ xác nhận' : 'tài khoản chờ duyệt';
                              const above = badgePos.y > 280;
                              return (
                                <div style={{
                                  position: 'fixed', left: badgePos.x - 130,
                                  top: above ? badgePos.y - 12 : badgePos.y + 12,
                                  transform: above ? 'translateY(-100%)' : 'translateY(0)',
                                  background: '#0B1620', border: '1px solid rgba(238,138,51,.25)', borderRadius: 8,
                                  padding: '10px 0', minWidth: 260, zIndex: 9999,
                                  boxShadow: '0 8px 32px rgba(0,0,0,.5)',
                                }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(241,236,225,.45)', textTransform: 'uppercase', letterSpacing: '.06em', padding: '0 14px 8px', borderBottom: '1px solid rgba(238,138,51,.1)' }}>
                                    {list.length} {label}
                                  </div>
                                  {list.map((item: any) => {
                                    const isBooking = showBookings;
                                    const name = isBooking ? (item as any).customerName : (item as any).name;
                                    const sub = isBooking
                                      ? `${(item as any).customerPhone} · ${(item as any).date} · ${(item as any).startTime?.slice(0, 5)}`
                                      : (item as any).email;
                                    return (
                                      <div key={item.id} style={{ padding: '8px 14px', borderBottom: '1px solid rgba(238,138,51,.06)' }}
                                        onClick={() => { setBadgeHovered(null); router.push(isBooking ? '/manage-bookings' : '/accounts'); }}
                                      >
                                        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#F1ECE1' }}>{name}</div>
                                        <div style={{ fontSize: 11, color: 'rgba(241,236,225,.5)', marginTop: 2 }}>{sub}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Collapse button — hidden on mobile */}
          {!isMobile && (
            <div
              onClick={() => setCollapsed(!collapsed)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
                padding: effectiveCollapsed ? '10px 0' : '10px 14px',
                justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
                color: 'rgba(255,255,255,.35)',
                fontSize: 13,
                margin: '0 8px 4px',
                borderRadius: 8,
                flexShrink: 0,
                transition: 'background .15s, color .15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.05)'; e.currentTarget.style.color = 'rgba(255,255,255,.7)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,.35)'; }}
            >
              <ChevronLeft
                size={16}
                style={{ transform: effectiveCollapsed ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }}
              />
              <span style={{ transition: 'max-width .2s, opacity .2s', maxWidth: effectiveCollapsed ? 0 : 160, opacity: effectiveCollapsed ? 0 : 1, overflow: 'hidden', whiteSpace: 'nowrap' }}>
                Thu gọn
              </span>
            </div>
          )}

          {/* User profile */}
          <div style={{ padding: effectiveCollapsed ? '8px 8px 4px' : '8px 10px 4px', flexShrink: 0 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: effectiveCollapsed ? 0 : 10,
              background: 'rgba(255,255,255,.04)',
              padding: effectiveCollapsed ? '8px 0' : '10px 10px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,.06)',
              justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
            }}>
              {account?.avatarUrl ? (
                <img src={account.avatarUrl} alt={account.name} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
              ) : (
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(238,138,51,.2)', color: '#ee8a33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                  {account?.name?.charAt(0)?.toUpperCase() ?? '?'}
                </div>
              )}
              <div style={{ overflow: 'hidden', flex: 1, transition: 'max-width .2s, opacity .2s', maxWidth: effectiveCollapsed ? 0 : 160, opacity: effectiveCollapsed ? 0 : 1, whiteSpace: 'nowrap' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {account?.name ?? '...'}
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
                  {account?.email ?? ''}
                </div>
                {account?.role?.name && (
                  <div style={{ fontSize: 10, color: '#EE8A33', fontWeight: 600, marginTop: 2, textTransform: 'uppercase', letterSpacing: '.04em', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {account.role.name}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Logout — at the very bottom of sidebar */}
        <div
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            padding: effectiveCollapsed ? '10px 0' : '10px 14px',
            justifyContent: effectiveCollapsed ? 'center' : 'flex-start',
            color: 'rgba(255,255,255,.35)',
            fontSize: 13,
            borderTop: '1px solid rgba(255,255,255,.06)',
            flexShrink: 0,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.05)'; e.currentTarget.style.color = '#ef4444'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,.35)'; }}
        >
          <LogOut size={16} style={{ flexShrink: 0 }} />
          <span style={{ transition: 'max-width .2s, opacity .2s', maxWidth: effectiveCollapsed ? 0 : 160, opacity: effectiveCollapsed ? 0 : 1, overflow: 'hidden', whiteSpace: 'nowrap' }}>
            Đăng xuất
          </span>
        </div>
      </Sider>
    </>
  );
}
