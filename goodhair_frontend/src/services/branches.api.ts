import {
  Branch,
  BranchCreatePayload,
  BranchStatus,
  BranchUpdatePayload,
} from '@/types/branch.type';
export type { Branch, BranchCreatePayload, BranchStatus, BranchUpdatePayload };
import { PaginatedResponse } from '@/types/service.type';

// Tất cả API gọi từ client-side (browser) qua cổng publish.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8002/api/v1';

function errorMessage(body: unknown, res: Response): string {
  const b = body as { messageKey?: string; detail?: unknown } | null;
  if (b?.messageKey) return b.messageKey;
  if (typeof b?.detail === 'string') return b.detail;
  return `API error: ${res.status} ${res.statusText}`;
}

async function clientFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(errorMessage(body, res));
  }
  if (res.status === 204) return null;
  return res.json();
}

export interface FetchBranchesParams {
  q?: string;
  status?: BranchStatus;
  page?: number;
  size?: number;
}

export async function fetchBranches(
  params: FetchBranchesParams = {},
): Promise<PaginatedResponse<Branch>> {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.status) search.set('status', params.status);
  if (params.page) search.set('page', String(params.page));
  if (params.size) search.set('size', String(params.size));

  const query = search.toString();
  return clientFetch(`/branches${query ? `?${query}` : ''}`);
}

export async function createBranch(payload: BranchCreatePayload): Promise<Branch> {
  return clientFetch('/branches', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateBranch(
  id: string,
  payload: BranchUpdatePayload,
): Promise<Branch> {
  return clientFetch(`/branches/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteBranch(id: string): Promise<void> {
  await clientFetch(`/branches/${id}`, { method: 'DELETE' });
}

// Upload ảnh: multipart -> để browser tự set Content-Type kèm boundary.
export async function uploadBranchImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_URL}/branches/image`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(errorMessage(body, res));
  }
  const data = (await res.json()) as { imageUrl: string };
  return data.imageUrl;
}
