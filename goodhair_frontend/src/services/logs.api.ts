import type { PaginatedResponse } from '@/types/employee.type';
import type {
  ActivityAction,
  ActivityLogDetail,
  ActivityLogListItem,
} from '@/types/activity-log.type';

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

export interface FetchLogsParams {
  action?: ActivityAction;
  module?: string;
  q?: string;
  page?: number;
  size?: number;
}

export async function fetchLogs(
  params: FetchLogsParams = {},
): Promise<PaginatedResponse<ActivityLogListItem>> {
  const search = new URLSearchParams();
  if (params.action) search.set('action', params.action);
  if (params.module) search.set('module', params.module);
  if (params.q) search.set('q', params.q);
  if (params.page) search.set('page', String(params.page));
  if (params.size) search.set('size', String(params.size));
  const query = search.toString();
  return clientFetch(`/logs${query ? `?${query}` : ''}`);
}

export async function fetchLogDetail(id: string): Promise<ActivityLogDetail> {
  return clientFetch(`/logs/${id}`);
}
