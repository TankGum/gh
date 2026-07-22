import type { PayrollDetail, PayrollEmployeeSummary, PayrollLockStatus, PayrollPeriodInfo } from '@/types/payroll.type';

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
      detail: body?.detail as Record<string, unknown> | undefined,
    });
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// Không có quyền `payroll.view` -> backend tự khoá về đúng bảng lương của
// chính người gọi, bỏ qua branchId/employeeId truyền lên.
export async function fetchPayrollSummary(params: {
  month: string;
  branchId?: string;
  employeeId?: string;
}): Promise<PayrollEmployeeSummary[]> {
  const q = new URLSearchParams({ month: params.month });
  if (params.branchId) q.set('branchId', params.branchId);
  if (params.employeeId) q.set('employeeId', params.employeeId);
  return apiFetch<PayrollEmployeeSummary[]>(`/payroll?${q}`);
}

export async function fetchPayrollDetail(employeeId: string, month: string): Promise<PayrollDetail> {
  const q = new URLSearchParams({ month });
  return apiFetch<PayrollDetail>(`/payroll/${employeeId}?${q}`);
}

export async function fetchPayrollPeriodInfo(month: string): Promise<PayrollPeriodInfo> {
  const q = new URLSearchParams({ month });
  return apiFetch<PayrollPeriodInfo>(`/payroll/period-info?${q}`);
}

export async function fetchPayrollLockStatus(month: string): Promise<PayrollLockStatus> {
  const q = new URLSearchParams({ month });
  return apiFetch<PayrollLockStatus>(`/payroll/lock-status?${q}`);
}

// Snapshot cứng lương toàn bộ nhân viên tháng này — sửa giá dịch vụ/% hoa
// hồng/lương cứng sau đó sẽ không ảnh hưởng số liệu tháng đã chốt.
export async function lockPayrollMonth(month: string): Promise<void> {
  await apiFetch<void>('/payroll/lock', {
    method: 'POST',
    body: JSON.stringify({ month }),
  });
}

export async function unlockPayrollMonth(month: string): Promise<void> {
  const q = new URLSearchParams({ month });
  await apiFetch<void>(`/payroll/lock?${q}`, { method: 'DELETE' });
}
