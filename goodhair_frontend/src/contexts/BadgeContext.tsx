'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchPendingBookingsCount, fetchPendingBookings } from '@/services/bookings.api';
import { fetchPendingAccountsCount, fetchPendingAccounts } from '@/services/auth.api';
import type { Booking } from '@/types/booking.type';
import type { Account } from '@/types/account.type';

interface BadgeContextValue {
  pendingBookings: number;
  pendingAccounts: number;
  pendingBookingsList: Booking[];
  pendingAccountsList: Account[];
  refreshBadges: () => void;
}

const BadgeContext = createContext<BadgeContextValue>({
  pendingBookings: 0,
  pendingAccounts: 0,
  pendingBookingsList: [],
  pendingAccountsList: [],
  refreshBadges: () => {},
});

export function BadgeProvider({ children }: { children: ReactNode }) {
  const [pendingBookings, setPendingBookings] = useState(0);
  const [pendingAccounts, setPendingAccounts] = useState(0);
  const [pendingBookingsList, setPendingBookingsList] = useState<Booking[]>([]);
  const [pendingAccountsList, setPendingAccountsList] = useState<Account[]>([]);

  const refreshBadges = useCallback(() => {
    fetchPendingBookingsCount().then(setPendingBookings).catch(() => {});
    fetchPendingAccountsCount().then(setPendingAccounts).catch(() => {});
    fetchPendingBookings().then(setPendingBookingsList).catch(() => {});
    fetchPendingAccounts().then(setPendingAccountsList).catch(() => {});
  }, []);

  useEffect(() => {
    refreshBadges();
  }, [refreshBadges]);

  return (
    <BadgeContext.Provider value={{ pendingBookings, pendingAccounts, pendingBookingsList, pendingAccountsList, refreshBadges }}>
      {children}
    </BadgeContext.Provider>
  );
}

export function useBadge() {
  return useContext(BadgeContext);
}
