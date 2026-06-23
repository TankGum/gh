export interface PermissionMap {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  isBookable: boolean;
  employeeCount: number;
  permissions: Record<string, PermissionMap>;
}

export interface RoleCreatePayload {
  name: string;
  description?: string | null;
  isBookable?: boolean;
  permissions: Record<string, PermissionMap>;
}

export interface RoleUpdatePayload {
  name?: string;
  description?: string | null;
  isBookable?: boolean;
  permissions?: Record<string, PermissionMap>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}
