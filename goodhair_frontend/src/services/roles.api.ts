import type { Role, RoleCreatePayload, RoleUpdatePayload, PaginatedResponse } from '@/types/role.type';

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
  return res.json() as Promise<T>;
}

export async function fetchRoles(params?: {
  page?: number;
  size?: number;
}): Promise<PaginatedResponse<Role>> {
  const q = new URLSearchParams();
  if (params?.page) q.set('page', String(params.page));
  if (params?.size) q.set('size', String(params.size));
  return apiFetch<PaginatedResponse<Role>>(`/roles?${q}`);
}

export async function createRole(payload: RoleCreatePayload): Promise<Role> {
  return apiFetch<Role>('/roles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateRole(id: string, payload: RoleUpdatePayload): Promise<Role> {
  return apiFetch<Role>(`/roles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteRole(id: string): Promise<void> {
  await apiFetch(`/roles/${id}`, { method: 'DELETE' });
}
