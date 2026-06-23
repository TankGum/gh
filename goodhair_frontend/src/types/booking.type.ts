export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';

export interface Booking {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  employeeId: string | null;
  branchId: string | null;
  date: string;
  startTime: string;
  durationMinutes: number;
  total: number;
  status: BookingStatus;
  serviceIds: string[];
}

export interface BookingCreatePayload {
  customerName: string;
  customerPhone: string;
  employeeId?: string | null;
  branchId?: string | null;
  date: string;
  startTime: string;
  durationMinutes?: number;
  total?: number;
  status?: BookingStatus;
  serviceIds?: string[];
}

export interface BookingUpdatePayload {
  customerName?: string;
  customerPhone?: string;
  employeeId?: string | null;
  branchId?: string | null;
  date?: string;
  startTime?: string;
  durationMinutes?: number;
  total?: number;
  status?: BookingStatus;
  serviceIds?: string[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}
