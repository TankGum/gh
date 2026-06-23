import type { RevenueSummary, RevenueDailyItem, RevenueByBranch, RevenueByService, RevenueByEmployee } from '@/types/revenue.type';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002/api/v1';

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, { credentials: 'include' });
  if (!res.ok) throw new Error(String(res.status));
  return res.json() as Promise<T>;
}

export async function fetchRevenueSummary(startDate: string, endDate: string): Promise<RevenueSummary> {
  return apiFetch<RevenueSummary>(`/revenue/summary?startDate=${startDate}&endDate=${endDate}`);
}

export async function fetchRevenueDaily(startDate: string, endDate: string): Promise<RevenueDailyItem[]> {
  return apiFetch<RevenueDailyItem[]>(`/revenue/daily?startDate=${startDate}&endDate=${endDate}`);
}

export async function fetchRevenueByBranch(startDate: string, endDate: string): Promise<RevenueByBranch[]> {
  return apiFetch<RevenueByBranch[]>(`/revenue/by-branch?startDate=${startDate}&endDate=${endDate}`);
}

export async function fetchRevenueByService(startDate: string, endDate: string): Promise<RevenueByService[]> {
  return apiFetch<RevenueByService[]>(`/revenue/by-service?startDate=${startDate}&endDate=${endDate}`);
}
