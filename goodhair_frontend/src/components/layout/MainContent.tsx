'use client';

import { useSidebar } from '@/contexts/SidebarContext';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { ReactNode } from 'react';

export default function MainContent({ children }: { children: ReactNode }) {
  const { collapsed, setMobileOpen } = useSidebar();
  const isMobile = useIsMobile();

  return (
    <div
      style={{
        flex: 1,
        marginLeft: isMobile ? 0 : collapsed ? 64 : 256,
        overflow: 'auto',
        transition: 'margin-left 0.2s',
        minWidth: 0,
      }}
    >
      {/* Mobile top bar */}
      {isMobile && (
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          background: '#0b1620',
          borderBottom: '1px solid rgba(255,255,255,.06)',
          display: 'flex',
          alignItems: 'center',
          height: 52,
          padding: '0 16px',
          gap: 12,
        }}>
          <button
            onClick={() => setMobileOpen(true)}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.7)', cursor: 'pointer', padding: 6, display: 'flex', alignItems: 'center', borderRadius: 6 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '2px' }}>
            GOOD<span style={{ color: '#ee8a33' }}>HAIR</span>
          </span>
        </div>
      )}
      {children}
    </div>
  );
}
