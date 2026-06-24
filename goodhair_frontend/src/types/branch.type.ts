export type BranchStatus = 'open' | 'closed' | 'coming_soon';

export interface Branch {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  imageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  openingTime: string | null; // "HH:MM:SS"
  closingTime: string | null;
  monthlyRevenue: number; // triệu đồng
  rating: number;
  barberCount: number;
  seatCount: number;
  status: BranchStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BranchCreatePayload {
  name: string;
  code?: string | null;
  address?: string | null;
  imageUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  openingTime?: string | null;
  closingTime?: string | null;
  rating?: number;
  seatCount?: number;
  status?: BranchStatus;
}

export type BranchUpdatePayload = Partial<BranchCreatePayload>;
