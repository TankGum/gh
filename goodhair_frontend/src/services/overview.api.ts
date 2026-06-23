import { OverviewResponse } from '@/types/overview.type';

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

export async function fetchOverview(): Promise<OverviewResponse> {
  return clientFetch('/overview');
}
