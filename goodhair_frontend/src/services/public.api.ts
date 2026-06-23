// Client gọi các API public (không cần auth) — dùng cho homepage & bookings.
import type { PaginatedResponse } from '@/types/service.type';
import type {
  PublicBranch,
  PublicEmployee,
  PublicService,
} from '@/types/public.type';

export type { PublicBranch, PublicEmployee, PublicService };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002/api/v1';

async function publicFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Public API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function fetchPublicBranches(
  params: { size?: number; q?: string } = {},
): Promise<PaginatedResponse<PublicBranch>> {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.size) search.set('size', String(params.size));
  const query = search.toString();
  return publicFetch(`/public/branches${query ? `?${query}` : ''}`);
}

export function fetchPublicServices(
  params: { size?: number; q?: string; branchId?: string } = {},
): Promise<PaginatedResponse<PublicService>> {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.branchId) search.set('branchId', params.branchId);
  if (params.size) search.set('size', String(params.size));
  const query = search.toString();
  return publicFetch(`/public/services${query ? `?${query}` : ''}`);
}

export function fetchPublicEmployees(
  params: { size?: number; branchId?: string } = {},
): Promise<PaginatedResponse<PublicEmployee>> {
  const search = new URLSearchParams();
  if (params.branchId) search.set('branchId', params.branchId);
  if (params.size) search.set('size', String(params.size));
  const query = search.toString();
  return publicFetch(`/public/employees${query ? `?${query}` : ''}`);
}

export interface BookedWindow {
  startMinutes: number;
  durationMinutes: number;
}

export async function fetchAvailableSlots(
  employeeId: string,
  date: string,
): Promise<BookedWindow[]> {
  const search = new URLSearchParams({ employeeId, date });
  const res = await fetch(`${API_URL}/public/available-slots?${search}`, {
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { bookedWindows: BookedWindow[] };
  return data.bookedWindows ?? [];
}

export async function createPublicBooking(payload: {
  customerName: string;
  customerPhone: string;
  employeeId?: string | null;
  branchId?: string | null;
  date: string;
  startTime: string;
  durationMinutes?: number;
  total?: number;
  serviceIds?: string[];
}): Promise<{ code: string; customerName: string; date: string; startTime: string; total: number }> {
  const res = await fetch(`${API_URL}/public/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.message ?? `Booking error: ${res.status}`);
  }
  return res.json();
}
