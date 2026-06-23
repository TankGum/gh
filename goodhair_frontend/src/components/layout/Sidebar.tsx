'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Layout, Menu } from 'antd';
import { useSidebar } from '@/contexts/SidebarContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBadge } from '@/contexts/BadgeContext';
import {
  LayoutDashboard,
  CalendarDays,
  BarChart3,
  Users,
  Clock,
  UserCheck,
  Store,
  Scissors,
  Briefcase,
  UserCog,
  ShieldCheck,
  History,
  LogOut,
} from 'lucide-react';
import type { ReactNode } from 'react';

const { Sider } = Layout;

const menuItems = [
  { key: '/dashboard', module: 'overview', icon: <LayoutDashboard size={18} />, label: 'Tổng quan' },
  { key: '/manage-bookings', module: 'bookings', icon: <CalendarDays size={18} />, label: 'Đặt lịch' },
  { key: '/revenue', module: 'revenue', icon: <BarChart3 size={18} />, label: 'Doanh thu' },
  { key: '/employees', module: 'staff', icon: <Users size={18} />, label: 'Nhân viên' },
  { key: '/shifts', module: 'shifts', icon: <Clock size={18} />, label: 'Ca làm việc' },
  { key: '/customers', module: 'customers', icon: <UserCheck size={18} />, label: 'Khách hàng' },
  { key: '/branches', module: 'branches', icon: <Store size={18} />, label: 'Chi nhánh' },
  { key: '/services', module: 'services', icon: <Scissors size={18} />, label: 'Dịch vụ' },
  { key: '/recruitment', module: 'recruit', icon: <Briefcase size={18} />, label: 'Tuyển dụng' },
  { key: '/accounts', module: 'roles', icon: <UserCog size={18} />, label: 'Tài khoản' },
  { key: '/roles', module: 'roles', icon: <ShieldCheck size={18} />, label: 'Quản lý vai trò' },
  { key: '/audit-log', module: 'logs', icon: <History size={18} />, label: 'Nhật ký hoạt động' },
];

function MenuLabel({ label, badge }: { label: string; badge?: number }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      {label}
      {badge ? (
        <span style={{ background: '#ee8a33', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 10, lineHeight: '16px' }}>
          {badge}
        </span>
      ) : null}
    </span>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, setCollapsed } = useSidebar();
  const { account, logout, canView } = useAuth();
  const { pendingBookings, pendingAccounts } = useBadge();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <Sider
      width={256}
      collapsedWidth={64}
      theme="dark"
      collapsible
      collapsed={collapsed}
      onCollapse={setCollapsed}
      trigger={null}
      style={{
        background: '#0f1e2b',
        borderRight: '1px solid #1e293b',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        zIndex: 40,
        overflow: 'auto',
      }}
    >
      {/* Logo */}
      <div onClick={() => router.push('/')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 64, gap: 10, cursor: 'pointer' }}>
        <img
          src="/logo/logo.jpg"
          alt="GoodHair"
          style={{
            height: collapsed ? 28 : 36,
            width: collapsed ? 28 : 36,
            objectFit: 'cover',
            borderRadius: 8,
            flexShrink: 0,
          }}
        />
        <span style={{
          fontSize: 18,
          fontWeight: 700,
          color: '#fff',
          letterSpacing: '2px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          transition: 'all 0.2s',
          maxWidth: collapsed ? 0 : 160,
          opacity: collapsed ? 0 : 1,
        }}>
          GOOD<span style={{ color: '#ee8a33' }}>HAIR</span>
        </span>
      </div>

      <Menu
        theme="dark"
        mode="inline"
        inlineCollapsed={collapsed}
        selectedKeys={[pathname]}
        items={menuItems.filter((item) => canView(item.module)).map((item) => ({
          key: item.key,
          icon: item.icon,
          label: (
            <MenuLabel
              label={item.label}
              badge={
                item.key === '/manage-bookings' ? pendingBookings :
                item.key === '/accounts' ? pendingAccounts :
                undefined
              }
            />
          ),
          onClick: () => router.push(item.key),
        }))}
        style={{ background: 'transparent', borderInlineEnd: 'none', marginTop: 8 }}
      />

      {/* Collapse button */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          cursor: 'pointer',
          textAlign: 'center',
          padding: '12px 0',
          color: '#94a3b8',
          fontSize: 13,
          borderTop: '1px solid #1e293b',
          margin: '0 16px',
          marginTop: 'auto',
        }}
      >
        {collapsed ? '>' : '< Thu gọn'}
      </div>

      {/* User profile */}
      <div style={{ padding: collapsed ? 8 : 16, borderTop: '1px solid #1e293b' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: '#161e31', padding: collapsed ? 8 : 12,
          borderRadius: 8, border: '1px solid #1e293b',
          justifyContent: collapsed ? 'center' : 'flex-start',
        }}>
          {account?.avatarUrl ? (
            <img
              src={account.avatarUrl}
              alt={account.name}
              style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: '#7c2d12', color: '#ee8a33',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 13, flexShrink: 0,
            }}>
              {account?.name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
          )}
          {!collapsed && (
            <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {account?.name ?? '...'}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {account?.email ?? ''}
              </div>
            </div>
          )}
          {!collapsed && (
            <button
              onClick={handleLogout}
              title="Đăng xuất"
              style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4, flexShrink: 0, display: 'flex', alignItems: 'center' }}
            >
              <LogOut size={15} />
            </button>
          )}
        </div>
      </div>
    </Sider>
  );
}
