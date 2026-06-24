import type { Employee, EmployeeUpdatePayload, PaginatedResponse } from '@/types/employee.type';

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

export async function fetchEmployees(params?: {
  page?: number;
  size?: number;
  branchId?: string;
  roleId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<PaginatedResponse<Employee>> {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.size) q.set('size', String(params.size));
  if (params?.branchId) q.set('branch_id', params.branchId);
  if (params?.roleId) q.set('role_id', params.roleId);
  if (params?.sortBy) q.set('sortBy', params.sortBy);
  if (params?.sortOrder) q.set('sortOrder', params.sortOrder);
  return apiFetch<PaginatedResponse<Employee>>(`/employees?${q}`);
}

export async function updateEmployee(id: string, payload: EmployeeUpdatePayload): Promise<Employee> {
  return apiFetch<Employee>(`/employees/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteEmployee(id: string): Promise<void> {
  await apiFetch(`/employees/${id}`, { method: 'DELETE' });
}

export async function uploadEmployeeImage(file: File): Promise<{ imageUrl: string }> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/employees/image`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const err = new Error(body?.message ?? String(res.status));
    (err as any).status = res.status;
    throw err;
  }
  return res.json() as Promise<{ imageUrl: string }>;
}
