export interface PayrollEmployeeSummary {
  employeeId: string;
  employeeName: string;
  avatarUrl: string | null;
  roleName: string | null;
  branchName: string | null;
  baseSalary: number;
  commissionTotal: number;
  totalSalary: number;
  bookingCount: number;
}

export interface PayrollServiceBreakdown {
  serviceId: string | null;
  serviceName: string;
  count: number;
  commissionAmount: number;
}

export interface PayrollDetail extends PayrollEmployeeSummary {
  breakdown: PayrollServiceBreakdown[];
}

export interface PayrollLockStatus {
  locked: boolean;
  lockedAt: string | null;
  lockedByName: string | null;
}

export interface PayrollPeriodInfo {
  startDate: string;
  endDate: string;
  payday: string;
}
