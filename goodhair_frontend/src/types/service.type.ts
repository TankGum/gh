export type ServiceStatus = 'active' | 'hidden';

export interface HairService {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  durationMinutes: number;
  price: number;
  status: ServiceStatus;
  isAllBranches: boolean;
  isFeatured: boolean;
  sortOrder: number;
  branchIds: string[];
  branchCount: number;
  totalBranches: number;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceCreatePayload {
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  durationMinutes: number;
  price: number;
  status?: ServiceStatus;
  isAllBranches?: boolean;
  isFeatured?: boolean;
  branchIds?: string[];
}

export interface ServiceUpdatePayload {
  name?: string;
  description?: string | null;
  imageUrl?: string | null;
  durationMinutes?: number;
  price?: number;
  status?: ServiceStatus;
  isAllBranches?: boolean;
  isFeatured?: boolean;
  branchIds?: string[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}
