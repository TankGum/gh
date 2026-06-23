export type EmploymentStatus = 'active' | 'inactive';

export interface Employee {
  id: string;
  accountId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  branchId: string | null;
  roleId: string | null;
  totalBookings: number;
  totalRevenue: number;
  status: EmploymentStatus;
}

export interface EmployeeUpdatePayload {
  branchId?: string | null;
  roleId?: string | null;
  status?: EmploymentStatus;
  avatarUrl?: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}
