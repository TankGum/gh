import {
  HairService,
  PaginatedResponse,
  ServiceCreatePayload,
  ServiceStatus,
  ServiceUpdatePayload,
} from '@/types/service.type';
export type { HairService, PaginatedResponse, ServiceCreatePayload, ServiceStatus, ServiceUpdatePayload };

// Tất cả API gọi từ client-side (browser) qua cổng publish.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002/api/v1';

export interface FetchServicesParams {
  q?: string;
  branchId?: string;
  status?: ServiceStatus;
  page?: number;
  size?: number;
}

export async function fetchServices(
  params: FetchServicesParams = {},
): Promise<PaginatedResponse<HairService>> {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.branchId) search.set('branchId', params.branchId);
  if (params.status) search.set('status', params.status);
  if (params.page) search.set('page', String(params.page));
  if (params.size) search.set('size', String(params.size));

  const query = search.toString();
  const url = `${API_URL}/services${query ? `?${query}` : ''}`;

  // Admin screen -> luôn lấy dữ liệu mới (không cache).
  const res = await fetch(url, { cache: 'no-store', credentials: 'include' });

  if (!res.ok) {
    throw new Error(`Failed to fetch services: ${res.status} ${res.statusText}`);
  }

  return res.json();
}

// ─── CLIENT-SIDE CRUD ────────────────────────────────────────────

async function clientFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `API error: ${res.status} ${res.statusText}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function createService(payload: ServiceCreatePayload): Promise<HairService> {
  return clientFetch('/services', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getService(id: string): Promise<HairService> {
  return clientFetch(`/services/${id}`);
}

export async function updateService(
  id: string,
  payload: ServiceUpdatePayload,
): Promise<HairService> {
  return clientFetch(`/services/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteService(id: string): Promise<void> {
  await clientFetch(`/services/${id}`, { method: 'DELETE' });
}
