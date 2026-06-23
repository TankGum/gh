// Type cho dữ liệu trả về từ các API public (/public/*).
// Chỉ gồm field cơ bản, đã ẩn các field nhạy cảm (doanh thu, email...).

import type { BranchStatus } from './branch.type';

export interface PublicBranch {
  id: string;
  name: string;
  address: string | null;
  imageUrl: string | null;
  openingTime: string | null; // "HH:MM:SS"
  closingTime: string | null;
  rating: number;
  barberCount: number;
  seatCount: number;
  status: BranchStatus;
}

export interface PublicService {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  price: number;
  isAllBranches: boolean;
  branchIds: string[];
}

export interface PublicEmployee {
  id: string;
  name: string;
  avatarUrl: string | null;
  branchId: string | null;
  roleName: string | null;
}
