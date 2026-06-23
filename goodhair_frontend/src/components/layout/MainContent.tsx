'use client';

import { useSidebar } from '@/contexts/SidebarContext';
import type { ReactNode } from 'react';

export default function MainContent({ children }: { children: ReactNode }) {
  const { collapsed } = useSidebar();
  return (
    <div
      style={{
        flex: 1,
        marginLeft: collapsed ? 64 : 256,
        overflow: 'auto',
        transition: 'margin-left 0.2s',
      }}
    >
      {children}
    </div>
  );
}
