import type { EmployeeShift, ShiftBulkUpsertPayload } from '@/types/shift.type';

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

export async function fetchShifts(params?: {
  employeeIds?: string[];
  startDate?: string;
  endDate?: string;
}): Promise<EmployeeShift[]> {
  const q = new URLSearchParams();
  if (params?.employeeIds?.length) {
    params.employeeIds.forEach(id => q.append('employee_ids', id));
  }
  if (params?.startDate) q.set('start_date', params.startDate);
  if (params?.endDate) q.set('end_date', params.endDate);
  return apiFetch<EmployeeShift[]>(`/shifts?${q}`);
}

export async function bulkUpsertShifts(payload: ShiftBulkUpsertPayload): Promise<void> {
  await apiFetch('/shifts/bulk', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
