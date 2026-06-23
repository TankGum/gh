export interface RevenueSummary {
  totalRevenue: number;
  totalBookings: number;
  avgBookingValue: number;
  deltaRevenue: number;
  deltaBookings: number;
}

export interface RevenueDailyItem {
  date: string;
  revenue: number;
  count: number;
}

export interface RevenueByBranch {
  branchId: string;
  branchName: string;
  revenue: number;
  count: number;
  pct: number;
}

export interface RevenueByService {
  serviceId: string;
  serviceName: string;
  revenue: number;
  count: number;
  pct: number;
}

export interface RevenueByEmployee {
  employeeId: string;
  employeeName: string;
  branchName: string | null;
  avatarUrl: string | null;
  revenue: number;
  count: number;
  pct: number;
}
