'use client';

import { useState, useEffect, useCallback } from 'react';
import { Pagination, Spin } from 'antd';
import { X } from 'lucide-react';
import SearchBar from '@/components/ui/SearchBar';
import AdminTable, { ColumnDef } from '@/components/ui/AdminTable';
import { fetchLogs, fetchLogDetail } from '@/services/logs.api';
import type {
  ActivityAction,
  ActivityLogListItem,
  ActivityLogDetail,
} from '@/types/activity-log.type';

const ACTION_META: Record<
  ActivityAction,
  { label: string; bg: string; color: string; dot: string }
> = {
  create: { label: 'Tạo mới', bg: 'rgba(63,191,127,0.14)', color: '#7FD9A8', dot: '#3FBF7F' },
  update: { label: 'Cập nhật', bg: 'rgba(238,138,51,0.14)', color: '#EE8A33', dot: '#EE8A33' },
  delete: { label: 'Xoá', bg: 'rgba(214,120,120,0.14)', color: '#E0A9A9', dot: '#D67878' },
  login: { label: 'Đăng nhập', bg: 'rgba(120,160,214,0.14)', color: '#A9C2E0', dot: '#7896D6' },
};

const MODULE_LABELS: Record<string, string> = {
  bookings: 'Đặt lịch',
  customers: 'Khách hàng',
  services: 'Dịch vụ',
  branches: 'Chi nhánh',
  staff: 'Nhân viên',
  shifts: 'Ca làm việc',
  roles: 'Phân quyền',
  system: 'Hệ thống',
};

const moduleLabel = (m: string) => MODULE_LABELS[m] ?? m;

function formatTime(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function initialsOf(name: string): string {
  return name.split(' ').map((s) => s[0]).join('').slice(0, 2).toUpperCase() || '?';
}

const selectStyle: React.CSSProperties = {
  background: '#0F1E2B',
  border: '1px solid rgba(238,138,51,0.18)',
  borderRadius: 8,
  padding: '10px 14px',
  color: '#F1ECE1',
  fontFamily: "'Hanken Grotesk',sans-serif",
  fontSize: 13,
  cursor: 'pointer',
  outline: 'none',
};

export default function AuditLogClient() {
  const [logs, setLogs] = useState<ActivityLogListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<ActivityAction | ''>('');
  const [module, setModule] = useState('');
  const [query, setQuery] = useState('');
  const [searchKey, setSearchKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [detail, setDetail] = useState<ActivityLogDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchLogs({
        action: action || undefined,
        module: module || undefined,
        q: query || undefined,
        page,
        size: pageSize,
      });
      setLogs(data.items);
      setTotal(data.total);
    } catch {
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [action, module, query, page, pageSize]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const data = await fetchLogDetail(id);
      setDetail(data);
    } catch {
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    setDetail(null);
    setDetailLoading(false);
  };


  return (
    <div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid #1e293b', paddingBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0, marginBottom: 4 }}>Nhật ký hoạt động</h1>
          <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>Lịch sử mọi thay đổi trên toàn hệ thống · {total} bản ghi</p>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        <SearchBar key={searchKey} placeholder="Tìm theo người thao tác hoặc đối tượng..." onSearch={(v) => { setQuery(v); setPage(1); }} width={360} />
        <select value={action} onChange={(e) => { setAction(e.target.value as ActivityAction | ''); setPage(1); }} style={selectStyle}>
          <option value="">Mọi hành động</option>
          <option value="create">Tạo mới</option>
          <option value="update">Cập nhật</option>
          <option value="delete">Xoá</option>
          <option value="login">Đăng nhập</option>
        </select>
        <select value={module} onChange={(e) => { setModule(e.target.value); setPage(1); }} style={selectStyle}>
          <option value="">Mọi module</option>
          {Object.entries(MODULE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        {(query || action || module) && (
          <button
            type="button"
            onClick={() => { setQuery(''); setSearchKey(k => k + 1); setAction(''); setModule(''); setPage(1); }}
            style={{ background: 'transparent', border: '1px solid rgba(238,138,51,0.25)', color: 'rgba(241,236,225,0.7)', padding: '0 14px', height: 36, borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Xoá lọc
          </button>
        )}
      </div>

      <AdminTable<ActivityLogListItem>
        columns={[
          {
            key: 'time',
            header: 'Thời gian',
            width: '110px',
            render: log => <span style={{ fontSize: 12.5, color: 'rgba(241,236,225,0.5)' }}>{formatTime(log.createdAt)}</span>,
          },
          {
            key: 'actor',
            header: 'Người thao tác',
            width: '1.6fr',
            render: log => (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{ width: 32, height: 32, borderRadius: '50%', background: '#16110C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display',serif", fontWeight: 700, color: '#EE8A33', fontSize: 11, flexShrink: 0 }}>
                  {initialsOf(log.actorName)}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#F1ECE1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{log.actorName}</div>
                  <div style={{ fontSize: 11.5, color: 'rgba(241,236,225,0.4)' }}>{log.actorRole ?? '—'}</div>
                </div>
              </div>
            ),
          },
          {
            key: 'action',
            header: 'Hành động',
            width: '110px',
            render: log => {
              const meta = ACTION_META[log.action];
              return (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, padding: '4px 11px', borderRadius: 20, background: meta.bg, color: meta.color }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot }} />
                  {meta.label}
                </span>
              );
            },
          },
          {
            key: 'module',
            header: 'Module',
            width: '120px',
            render: log => <span style={{ fontSize: 13, color: 'rgba(241,236,225,0.7)' }}>{moduleLabel(log.module)}</span>,
          },
          {
            key: 'target',
            header: 'Đối tượng',
            width: '1.8fr',
            render: log => <span style={{ fontSize: 13, color: '#F1ECE1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>{log.targetLabel}</span>,
          },
        ]}
        data={logs}
        rowKey={log => log.id}
        loading={loading}
        emptyText="Chưa có hoạt động nào."
        minWidth={820}
        onRowClick={log => openDetail(log.id)}
        pagination={
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            pageSizeOptions={[10, 20, 50, 100]}
            showTotal={(t, [s, e]) => `${s}–${e} / ${t} bản ghi`}
            onChange={(p, ps) => { setPageSize(ps); setPage(ps !== pageSize ? 1 : p); }}
          />
        }
      />

      {/* Detail popup */}
      {(detail || detailLoading) && (
        <div onClick={closeDetail} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(5,10,16,0.74)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 520, maxHeight: '88vh', overflowY: 'auto', background: '#0F1E2B', border: '1px solid rgba(238,138,51,0.25)', borderRadius: 10, boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
            {detailLoading || !detail ? (
              <div style={{ padding: 60, textAlign: 'center' }}><Spin /></div>
            ) : (
              <>
                <div style={{ padding: '22px 26px', borderBottom: '1px solid rgba(238,138,51,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 700, color: '#F1ECE1', margin: 0 }}>Chi tiết hoạt động</h3>
                    <div style={{ fontSize: 12, color: 'rgba(241,236,225,0.45)', marginTop: 3 }}>{formatTime(detail.createdAt)} · {detail.actorName}</div>
                  </div>
                  <button onClick={closeDetail} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: '1px solid rgba(238,138,51,0.25)', borderRadius: 6, cursor: 'pointer', color: 'rgba(241,236,225,0.7)' }}>
                    <X size={15} />
                  </button>
                </div>
                <div style={{ padding: '22px 26px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px 18px', marginBottom: 20 }}>
                    <Field label="Người thao tác" value={`${detail.actorName}${detail.actorRole ? ' · ' + detail.actorRole : ''}`} />
                    <div>
                      <FieldLabel>Hành động</FieldLabel>
                      <div style={{ marginTop: 5 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 700, padding: '4px 11px', borderRadius: 20, background: ACTION_META[detail.action].bg, color: ACTION_META[detail.action].color }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: ACTION_META[detail.action].dot }} />
                          {ACTION_META[detail.action].label}
                        </span>
                      </div>
                    </div>
                    <Field label="Module" value={moduleLabel(detail.module)} />
                    <Field label="Đối tượng" value={detail.targetLabel} />
                    {detail.ipAddress && <Field label="IP" value={detail.ipAddress} />}
                  </div>
                  <FieldLabel>Chi tiết thay đổi (cũ → mới)</FieldLabel>
                  {detail.changes.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                      {detail.changes.map((c, i) => (
                        <div key={i} style={{ background: '#0B1620', border: '1px solid rgba(238,138,51,0.12)', borderRadius: 8, padding: '13px 15px' }}>
                          <div style={{ fontSize: 11.5, color: 'rgba(241,236,225,0.5)', marginBottom: 8, fontWeight: 600 }}>{c.label}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                            <span style={{ background: 'rgba(214,120,120,0.12)', color: '#E0A9A9', padding: '5px 12px', borderRadius: 6, fontSize: 13, textDecoration: 'line-through', textDecorationColor: 'rgba(224,169,169,0.5)' }}>{c.from}</span>
                            <span style={{ color: '#EE8A33', fontWeight: 700, fontSize: 15 }}>→</span>
                            <span style={{ background: 'rgba(63,191,127,0.14)', color: '#7FD9A8', padding: '5px 12px', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>{c.to}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ background: '#0B1620', border: '1px solid rgba(238,138,51,0.12)', borderRadius: 8, padding: 16, textAlign: 'center', fontSize: 13, color: 'rgba(241,236,225,0.45)', fontStyle: 'italic', marginTop: 12 }}>
                      Không có thay đổi chi tiết cho hoạt động này.
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(241,236,225,0.4)', fontWeight: 600 }}>{children}</div>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <FieldLabel>{label}</FieldLabel>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#F1ECE1', marginTop: 4 }}>{value}</div>
    </div>
  );
}
