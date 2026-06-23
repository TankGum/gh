import { PaginatedResponse } from '@/types/employee.type';
import type { Customer } from '@/types/customer.type';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002/api/v1';

async function clientFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const msg = (body as { detail?: string })?.detail ?? `API error: ${res.status}`;
    throw new Error(msg);
  }
  return res.json();
}

export interface FetchCustomersParams {
  q?: string;
  page?: number;
  size?: number;
}

export async function fetchCustomers(
  params: FetchCustomersParams = {},
): Promise<PaginatedResponse<Customer>> {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.page) search.set('page', String(params.page));
  if (params.size) search.set('size', String(params.size));
  const query = search.toString();
  return clientFetch(`/customers${query ? `?${query}` : ''}`);
}
