import type { PermissionMap } from './role.type';

export type AccountStatus = 'pending' | 'approved' | 'rejected';

export interface Account {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  status: AccountStatus;
  requestedAt: string;
  createdAt: string;
}

export interface PaginatedAccounts {
  items: Account[];
  total: number;
  page: number;
  size: number;
}

export interface RoleSummary {
  id: string;
  name: string;
}

export interface Me extends Account {
  role: RoleSummary | null;
  permissions: Record<string, PermissionMap>;
}
