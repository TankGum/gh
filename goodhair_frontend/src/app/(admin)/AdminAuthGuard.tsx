'use client';

import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { firstAllowedRoute, moduleForPath } from '@/lib/permissions';

const LOADING = (
  <div
    style={{
      display: 'flex',
      height: '100vh',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#0a131d',
    }}
  >
    <span style={{ color: '#EE8A33', fontSize: 14 }}>Đang tải...</span>
  </div>
);

export default function AdminAuthGuard({ children }: { children: ReactNode }) {
  const { account, loading, canView } = useAuth();
  const router = useRouter();
  const pathname = usePathname() ?? '';

  const permModule = moduleForPath(pathname);
  const allowed = permModule ? canView(permModule) : true;
  const fallback = account ? firstAllowedRoute(account.permissions) : null;

  useEffect(() => {
    if (loading) return;
    if (!account) {
      router.replace('/login');
      return;
    }
    if (!allowed && fallback && pathname !== fallback) {
      router.replace(fallback);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, account, allowed, fallback, pathname]);

  if (loading) return LOADING;
  if (!account) return null;

  if (!allowed) {
    if (fallback) return LOADING; // redirecting to first allowed route
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          height: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a131d',
          color: '#F1ECE1',
          textAlign: 'center',
          padding: 24,
        }}
      >
        <span style={{ color: '#EE8A33', fontSize: 18, fontWeight: 700 }}>
          Chưa được cấp quyền
        </span>
        <span style={{ fontSize: 14, opacity: 0.8 }}>
          Tài khoản của bạn chưa được gán vai trò có quyền truy cập. Vui lòng liên hệ quản trị viên.
        </span>
      </div>
    );
  }

  return <>{children}</>;
}
