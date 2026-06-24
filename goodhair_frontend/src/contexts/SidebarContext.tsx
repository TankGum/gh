'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
  setCollapsed: (v: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (v: boolean) => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  toggle: () => {},
  setCollapsed: () => {},
  mobileOpen: false,
  setMobileOpen: () => {},
});

function getInitialState(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const stored = localStorage.getItem('sidebar_collapsed');
    return stored === 'true';
  } catch { return false; }
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(getInitialState);
  const [mobileOpen, setMobileOpen] = useState(false);

  const persist = useCallback((v: boolean) => {
    setCollapsed(v);
    try { localStorage.setItem('sidebar_collapsed', String(v)); } catch {}
  }, []);

  const toggle = useCallback(() => setCollapsed((prev) => {
    const next = !prev;
    try { localStorage.setItem('sidebar_collapsed', String(next)); } catch {}
    return next;
  }), []);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle, setCollapsed: persist, mobileOpen, setMobileOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
