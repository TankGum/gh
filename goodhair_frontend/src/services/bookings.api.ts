import type { Booking, BookingCreatePayload, BookingUpdatePayload, PaginatedResponse } from '@/types/booking.type';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002/api/v1';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const err = new Error(body?.message ?? String(res.status));
    (err as any).status = res.status;
    (err as any).detail = body?.detail;
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function fetchBookings(params?: {
  page?: number;
  size?: number;
  date?: string;
  startDate?: string;
  endDate?: string;
  branchId?: string;
  employeeId?: string;
  status?: string;
}): Promise<PaginatedResponse<Booking>> {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.size) q.set('size', String(params.size));
  if (params?.date) q.set('date', params.date);
  if (params?.startDate) q.set('start_date', params.startDate);
  if (params?.endDate) q.set('end_date', params.endDate);
  if (params?.branchId) q.set('branch_id', params.branchId);
  if (params?.employeeId) q.set('employee_id', params.employeeId);
  if (params?.status) q.set('status', params.status);
  return apiFetch<PaginatedResponse<Booking>>(`/bookings?${q}`);
}

export async function createBooking(payload: BookingCreatePayload): Promise<Booking> {
  return apiFetch<Booking>('/bookings', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getBooking(id: string): Promise<Booking> {
  return apiFetch<Booking>(`/bookings/${id}`);
}

export async function updateBooking(id: string, payload: BookingUpdatePayload): Promise<Booking> {
  return apiFetch<Booking>(`/bookings/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteBooking(id: string): Promise<void> {
  await apiFetch(`/bookings/${id}`, { method: 'DELETE' });
}

export async function fetchPendingBookingsCount(): Promise<number> {
  const data = await apiFetch<PaginatedResponse<Booking>>(`/bookings?status=pending&size=1`);
  return data.total;
}

export async function fetchPendingBookings(): Promise<Booking[]> {
  const data = await apiFetch<PaginatedResponse<Booking>>(`/bookings?status=pending&size=50&sort_by=date&sort_order=asc`);
  return data.items;
}
