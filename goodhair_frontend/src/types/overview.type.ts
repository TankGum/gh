export interface KpiCard {
  label: string;
  value: string;
  delta: string;
  deltaPositive: boolean;
  sub: string;
}

export interface OverviewRevenueItem {
  date: string;
  amount: string;
  pct: number;
}

export interface TopBarber {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
  count: number;
  pct: number;
}

export interface TodayBooking {
  time: string;
  customer: string;
  service: string;
  barber: string;
  status: string;
  badgeStyle: string;
}

export interface OverviewResponse {
  kpis: KpiCard[];
  revenue7Days: OverviewRevenueItem[];
  topBarbers: TopBarber[];
  todayBookings: TodayBooking[];
}
