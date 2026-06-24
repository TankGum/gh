import type { Account, Me, PaginatedAccounts } from '@/types/account.type';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002/api/v1';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const err = Object.assign(new Error(body?.messageKey ?? String(res.status)), {
      status: res.status,
      messageKey: body?.messageKey as string | undefined,
      detail: body?.detail as Record<string, unknown> | undefined,
    });
    throw err;
  }
  return res.json() as Promise<T>;
}

export async function loginWithGoogle(idToken: string): Promise<Account> {
  return apiFetch<Account>('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ id_token: idToken }),
  });
}

export async function logout(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' });
}

export async function getMe(): Promise<Me> {
  return apiFetch<Me>('/auth/me');
}

export async function refreshToken(): Promise<Account> {
  return apiFetch<Account>('/auth/refresh', { method: 'POST' });
}

export async function fetchAccounts(params?: {
  status?: string;
  page?: number;
  size?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}): Promise<PaginatedAccounts> {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.page) q.set('page', String(params.page));
  if (params?.size) q.set('size', String(params.size));
  if (params?.sortBy) q.set('sortBy', params.sortBy);
  if (params?.sortOrder) q.set('sortOrder', params.sortOrder);
  return apiFetch<PaginatedAccounts>(`/accounts?${q}`);
}

export async function fetchPendingAccountsCount(): Promise<number> {
  const data = await apiFetch<PaginatedAccounts>(`/accounts?status=pending&size=1`);
  return data.total;
}

export async function fetchPendingAccounts(): Promise<Account[]> {
  const data = await apiFetch<PaginatedAccounts>(`/accounts?status=pending&size=50`);
  return data.items;
}

export async function approveAccount(id: string): Promise<Account> {
  return apiFetch<Account>(`/accounts/${id}/approve`, { method: 'PATCH' });
}

export async function rejectAccount(id: string): Promise<Account> {
  return apiFetch<Account>(`/accounts/${id}/reject`, { method: 'PATCH' });
}
