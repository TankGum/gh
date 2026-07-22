'use client';

import { useState, useEffect, useCallback } from 'react';
import { DatePicker, Spin, App } from 'antd';
import { Lock, Unlock } from 'lucide-react';
import dayjs from 'dayjs';
import FilterSelect from '@/components/ui/FilterSelect';
import AdminTable, { ColumnDef } from '@/components/ui/AdminTable';
import Modal from '@/components/ui/Modal';
import {
  fetchPayrollSummary,
  fetchPayrollDetail,
  fetchPayrollLockStatus,
  fetchPayrollPeriodInfo,
  lockPayrollMonth,
  unlockPayrollMonth,
} from '@/services/payroll.api';
import { fetchBranches, type Branch } from '@/services/branches.api';
import type { PayrollEmployeeSummary, PayrollDetail, PayrollLockStatus, PayrollPeriodInfo } from '@/types/payroll.type';
import { useAuth } from '@/contexts/AuthContext';

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + ' VND';

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${z(d.getDate())}/${z(d.getMonth() + 1)}/${d.getFullYear()} ${z(d.getHours())}:${z(d.getMinutes())}`;
}

function fmtDateShort(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const z = (n: number) => String(n).padStart(2, '0');
  return `${z(d.getDate())}/${z(d.getMonth() + 1)}`;
}

function PayrollDetailBody({ detail }: { detail: PayrollDetail }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
        <div style={{ background: '#0B1620', border: '1px solid rgba(238,138,51,.16)', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: 'rgba(241,236,225,.45)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Lương cứng</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F1ECE1' }}>{fmtVnd(detail.baseSalary)}</div>
        </div>
        <div style={{ background: '#0B1620', border: '1px solid rgba(238,138,51,.16)', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: 'rgba(241,236,225,.45)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Hoa hồng</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#F1ECE1' }}>{fmtVnd(detail.commissionTotal)}</div>
        </div>
        <div style={{ background: 'linear-gradient(135deg, rgba(238,138,51,.16) 0%, rgba(238,138,51,.05) 100%)', border: '1px solid rgba(238,138,51,.35)', borderRadius: 8, padding: '14px 16px' }}>
          <div style={{ fontSize: 11, color: 'rgba(241,236,225,.6)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>Tổng lương</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#EE8A33' }}>{fmtVnd(detail.totalSalary)}</div>
        </div>
      </div>

      <div style={{ fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'rgba(241,236,225,.45)', fontWeight: 700, marginBottom: 10 }}>
        Hoa hồng theo dịch vụ · {detail.bookingCount} lịch hẹn hoàn thành
      </div>
      {detail.breakdown.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(241,236,225,.4)', fontSize: 13 }}>Chưa có hoa hồng trong tháng này.</div>
      ) : (
        <div style={{ border: '1px solid rgba(238,138,51,.12)', borderRadius: 8, overflow: 'hidden' }}>
          {detail.breakdown.map((b, i) => (
            <div key={b.serviceId ?? i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 16px', borderBottom: i < detail.breakdown.length - 1 ? '1px solid rgba(238,138,51,.08)' : 'none' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#F1ECE1' }}>{b.serviceName}</div>
                <div style={{ fontSize: 11.5, color: 'rgba(241,236,225,.45)' }}>{b.count} lượt</div>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#EE8A33' }}>{fmtVnd(b.commissionAmount)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PayrollClient() {
  const { message } = App.useApp();
  const { can } = useAuth();
  const canViewAll = can('payroll', 'view');
  const canLock = canViewAll && can('payroll', 'edit');
  const canUnlock = canViewAll && can('payroll', 'delete');

  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [branchFilter, setBranchFilter] = useState('all');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [summary, setSummary] = useState<PayrollEmployeeSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const [periodInfo, setPeriodInfo] = useState<PayrollPeriodInfo | null>(null);
  const [lockStatus, setLockStatus] = useState<PayrollLockStatus | null>(null);
  const [lockActionOpen, setLockActionOpen] = useState<'lock' | 'unlock' | null>(null);
  const [lockActionLoading, setLockActionLoading] = useState(false);

  const [detailTarget, setDetailTarget] = useState<PayrollEmployeeSummary | null>(null);
  const [detail, setDetail] = useState<PayrollDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!canViewAll) return;
    fetchBranches({ size: 100 }).then(res => setBranches(res.items)).catch(() => {});
  }, [canViewAll]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPayrollSummary({
        month,
        branchId: canViewAll && branchFilter !== 'all' ? branchFilter : undefined,
      });
      setSummary(data);
    } catch {
      setSummary([]);
      message.error('Không tải được bảng lương');
    } finally {
      setLoading(false);
    }
  }, [month, branchFilter, canViewAll, message]);

  const refreshLockStatus = useCallback(async () => {
    try {
      const status = await fetchPayrollLockStatus(month);
      setLockStatus(status);
    } catch {
      setLockStatus(null);
    }
  }, [month]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    refreshLockStatus();
  }, [refreshLockStatus]);

  useEffect(() => {
    fetchPayrollPeriodInfo(month).then(setPeriodInfo).catch(() => setPeriodInfo(null));
  }, [month]);

  const openDetail = useCallback(async (row: PayrollEmployeeSummary) => {
    setDetailTarget(row);
    setDetail(null);
    setDetailLoading(true);
    try {
      const d = await fetchPayrollDetail(row.employeeId, month);
      setDetail(d);
    } catch {
      message.error('Không tải được chi tiết bảng lương');
    } finally {
      setDetailLoading(false);
    }
  }, [month, message]);

  // Xem của chính mình: tự tải chi tiết luôn (không cần bấm), hiển thị như 1 thẻ.
  useEffect(() => {
    if (canViewAll || summary.length === 0) return;
    openDetail(summary[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canViewAll, summary]);

  const handleLockAction = async () => {
    if (!lockActionOpen) return;
    setLockActionLoading(true);
    try {
      if (lockActionOpen === 'lock') {
        await lockPayrollMonth(month);
        message.success(`Đã chốt lương tháng ${month}`);
      } else {
        await unlockPayrollMonth(month);
        message.success(`Đã mở khoá lương tháng ${month}`);
      }
      setLockActionOpen(null);
      await Promise.all([refresh(), refreshLockStatus()]);
      if (detailTarget) await openDetail(detailTarget);
    } catch {
      message.error(lockActionOpen === 'lock' ? 'Chốt lương thất bại' : 'Mở khoá thất bại');
    } finally {
      setLockActionLoading(false);
    }
  };

  const branchOpts = [{ value: 'all', label: 'Tất cả chi nhánh' }, ...branches.map(b => ({ value: b.id, label: b.name }))];

  const columns: ColumnDef<PayrollEmployeeSummary>[] = [
    {
      key: 'employee',
      header: 'Nhân viên',
      width: '1.6fr',
      render: row => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {row.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={row.avatarUrl} alt={row.employeeName} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#16110C', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EE8A33', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
              {row.employeeName.charAt(0).toUpperCase()}
            </span>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: '#F1ECE1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.employeeName}</div>
            <div style={{ fontSize: 11, color: 'rgba(241,236,225,.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {row.roleName ?? '—'}{row.branchName ? ` · ${row.branchName}` : ''}
            </div>
          </div>
        </div>
      ),
    },
    { key: 'base', header: 'Lương cứng', width: '140px', render: row => <span style={{ fontSize: 13, color: '#F1ECE1' }}>{fmtVnd(row.baseSalary)}</span> },
    { key: 'commission', header: 'Hoa hồng', width: '140px', render: row => <span style={{ fontSize: 13, color: '#F1ECE1' }}>{fmtVnd(row.commissionTotal)}</span> },
    { key: 'total', header: 'Tổng lương', width: '150px', render: row => <span style={{ fontSize: 13.5, fontWeight: 700, color: '#EE8A33' }}>{fmtVnd(row.totalSalary)}</span> },
    { key: 'bookings', header: 'Lịch hoàn thành', width: '120px', align: 'center', render: row => <span style={{ fontSize: 13, color: 'rgba(241,236,225,.7)' }}>{row.bookingCount}</span> },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid #1e293b', paddingBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0, marginBottom: 4 }}>Bảng lương</h1>
          <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>
            {canViewAll ? 'Lương cứng + hoa hồng của toàn bộ nhân viên theo tháng' : 'Lương cứng + hoa hồng của bạn theo tháng'}
          </p>
          {periodInfo && Number(periodInfo.startDate.slice(-2)) !== 1 && (
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#EE8A33' }}>
              Kỳ lương: {fmtDateShort(periodInfo.startDate)} – {fmtDateShort(periodInfo.endDate)} · Dự kiến trả lương {fmtDateShort(periodInfo.payday)}
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <DatePicker
            picker="month"
            value={dayjs(month)}
            allowClear={false}
            onChange={d => setMonth(d ? d.format('YYYY-MM') : dayjs().format('YYYY-MM'))}
            style={{ height: 36, background: '#0f1e2b', borderColor: 'rgba(238,138,51,.25)' }}
          />
          {canViewAll && <FilterSelect value={branchFilter} onChange={setBranchFilter} options={branchOpts} />}
          {canLock && !lockStatus?.locked && (
            <button
              onClick={() => setLockActionOpen('lock')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#EE8A33', border: 'none', color: '#0B1620', padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              <Lock size={14} />
              Chốt lương tháng này
            </button>
          )}
          {canUnlock && lockStatus?.locked && (
            <button
              onClick={() => setLockActionOpen('unlock')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid rgba(238,138,51,.4)', color: '#EE8A33', padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
            >
              <Unlock size={14} />
              Mở khoá
            </button>
          )}
        </div>
      </div>

      {lockStatus?.locked && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 16px', background: 'rgba(238,138,51,.08)', border: '1px solid rgba(238,138,51,.25)', borderRadius: 8, fontSize: 12.5, color: 'rgba(241,236,225,.75)' }}>
          <Lock size={14} color="#EE8A33" style={{ flexShrink: 0 }} />
          <span>
            Tháng {month} đã được <b style={{ color: '#EE8A33' }}>chốt</b>
            {lockStatus.lockedAt && ` lúc ${fmtDateTime(lockStatus.lockedAt)}`}
            {lockStatus.lockedByName && ` bởi ${lockStatus.lockedByName}`}.
            {' '}Số liệu đã được khoá — thay đổi giá dịch vụ/% hoa hồng/lương cứng sau đó sẽ không ảnh hưởng tháng này.
          </span>
        </div>
      )}

      {canViewAll ? (
        <AdminTable
          columns={columns}
          data={summary}
          rowKey={row => row.employeeId}
          loading={loading}
          onRowClick={openDetail}
          emptyText="Chưa có dữ liệu lương trong tháng này."
          minWidth={760}
        />
      ) : loading || detailLoading || !detail ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
      ) : (
        <div style={{ background: '#0f1e2b', border: '1px solid rgba(238,138,51,0.16)', borderRadius: 8, padding: 22 }}>
          <PayrollDetailBody detail={detail} />
        </div>
      )}

      {canViewAll && (
        <Modal
          open={!!detailTarget}
          onClose={() => setDetailTarget(null)}
          title={detailTarget ? `Bảng lương · ${detailTarget.employeeName}` : ''}
          style={{ maxWidth: 520 }}
        >
          {detailLoading || !detail ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
          ) : (
            <PayrollDetailBody detail={detail} />
          )}
        </Modal>
      )}

      {/* Xác nhận chốt / mở khoá */}
      <Modal
        open={!!lockActionOpen}
        onClose={() => setLockActionOpen(null)}
        title={lockActionOpen === 'lock' ? 'Xác nhận chốt lương' : 'Xác nhận mở khoá'}
      >
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(238,138,51,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
            {lockActionOpen === 'lock' ? <Lock size={24} color="#EE8A33" /> : <Unlock size={24} color="#EE8A33" />}
          </div>
          <p style={{ fontSize: 14, color: 'rgba(241,236,225,.7)', marginTop: 18, lineHeight: 1.6 }}>
            {lockActionOpen === 'lock' ? (
              <>Chốt lương tháng <b style={{ color: '#F1ECE1' }}>{month}</b> sẽ đóng băng lương cứng, hoa hồng của <b style={{ color: '#F1ECE1' }}>toàn bộ nhân viên</b> tại thời điểm hiện tại. Các thay đổi sau này về giá dịch vụ, % hoa hồng, lương cứng sẽ không ảnh hưởng tới số liệu tháng này nữa.</>
            ) : (
              <>Mở khoá sẽ huỷ số liệu đã chốt của tháng <b style={{ color: '#F1ECE1' }}>{month}</b> — bảng lương tháng này sẽ tính lại theo số liệu hiện tại (có thể khác số đã chốt trước đó).</>
            )}
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button onClick={() => setLockActionOpen(null)} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(238,138,51,.3)', color: 'rgba(241,236,225,.8)', padding: 12, borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Huỷ</button>
            <button onClick={handleLockAction} disabled={lockActionLoading} style={{ flex: 1, background: '#EE8A33', color: '#0B1620', border: 'none', padding: 12, borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: lockActionLoading ? 0.5 : 1 }}>
              {lockActionLoading ? 'Đang xử lý...' : lockActionOpen === 'lock' ? 'Chốt lương' : 'Mở khoá'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
