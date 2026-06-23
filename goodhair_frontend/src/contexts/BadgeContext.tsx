'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchPendingBookingsCount } from '@/services/bookings.api';
import { fetchPendingAccountsCount } from '@/services/auth.api';

interface BadgeContextValue {
  pendingBookings: number;
  pendingAccounts: number;
  refreshBadges: () => void;
}

const BadgeContext = createContext<BadgeContextValue>({
  pendingBookings: 0,
  pendingAccounts: 0,
  refreshBadges: () => {},
});

export function BadgeProvider({ children }: { children: ReactNode }) {
  const [pendingBookings, setPendingBookings] = useState(0);
  const [pendingAccounts, setPendingAccounts] = useState(0);

  const refreshBadges = useCallback(() => {
    fetchPendingBookingsCount().then(setPendingBookings).catch(() => {});
    fetchPendingAccountsCount().then(setPendingAccounts).catch(() => {});
  }, []);

  useEffect(() => {
    refreshBadges();
  }, [refreshBadges]);

  return (
    <BadgeContext.Provider value={{ pendingBookings, pendingAccounts, refreshBadges }}>
      {children}
    </BadgeContext.Provider>
  );
}

export function useBadge() {
  return useContext(BadgeContext);
}
