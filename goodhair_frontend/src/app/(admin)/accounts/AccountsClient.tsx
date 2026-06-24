'use client';

import { useState, useEffect, useCallback } from 'react';
import { Pagination } from 'antd';
import FilterBar from '@/components/ui/FilterBar';
import FilterSelect from '@/components/ui/FilterSelect';
import AdminTable, { ColumnDef } from '@/components/ui/AdminTable';
import { fetchAccounts, approveAccount, rejectAccount } from '@/services/auth.api';
import type { Account, AccountStatus } from '@/types/account.type';
import { useAuth } from '@/contexts/AuthContext';
import { useBadge } from '@/contexts/BadgeContext';

const STATUS_TABS: { label: string; value: AccountStatus | '' }[] = [
  { label: 'Tất cả', value: '' },
  { label: 'Chờ duyệt', value: 'pending' },
  { label: 'Đã duyệt', value: 'approved' },
  { label: 'Từ chối', value: 'rejected' },
];

const STATUS_BADGE: Record<AccountStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Chờ duyệt', color: '#E7B25C', bg: 'rgba(238,138,51,.15)' },
  approved: { label: 'Đã duyệt', color: '#5FD49A', bg: 'rgba(63,191,127,.15)' },
  rejected: { label: 'Từ chối', color: '#E59A9A', bg: 'rgba(214,120,120,.15)' },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  const z = (n: number) => String(n).padStart(2, '0');
  return `${z(d.getDate())}/${z(d.getMonth() + 1)} ${z(d.getHours())}:${z(d.getMinutes())}`;
}

export default function AccountsClient() {
  const { can } = useAuth();
  const canApproveReject = can('roles', 'edit');
  const { refreshBadges } = useBadge();

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<AccountStatus | ''>('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAccounts({ status: tab || undefined, page, size: pageSize, sortBy, sortOrder });
      setAccounts(data.items);
      setTotal(data.total);
    } catch {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [tab, page, pageSize, sortBy, sortOrder]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleApprove = async (id: string) => {
    setActioning(id);
    try {
      await approveAccount(id);
      await refresh();
      refreshBadges();
    } finally {
      setActioning(null);
    }
  };

  const handleReject = async (id: string) => {
    setActioning(id);
    try {
      await rejectAccount(id);
      await refresh();
      refreshBadges();
    } finally {
      setActioning(null);
    }
  };

  const handleSort = (field: string, order: 'asc' | 'desc') => {
    setSortBy(field);
    setSortOrder(order);
    setPage(1);
  };

  const filtered = accounts.filter(acc => {
    const q = search.toLowerCase();
    return acc.name.toLowerCase().includes(q) || acc.email.toLowerCase().includes(q);
  });

  const columns: ColumnDef<Account>[] = [
    {
      key: 'account',
      header: 'Tài khoản',
      width: '1.4fr',
      sortable: true,
      sortField: 'name',
      render: acc => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          {acc.avatarUrl ? (
            <img src={acc.avatarUrl} alt={acc.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#16110C', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EE8A33', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
              {acc.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span style={{ fontSize: 13.5, fontWeight: 600, color: '#F1ECE1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{acc.name}</span>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      width: '1.4fr',
      sortable: true,
      sortField: 'email',
      render: acc => <span style={{ fontSize: 13, color: 'rgba(241,236,225,0.55)' }}>{acc.email}</span>,
    },
    {
      key: 'time',
      header: 'Thời gian yêu cầu',
      width: '150px',
      sortable: true,
      sortField: 'requested_at',
      render: acc => <span style={{ fontSize: 13, color: 'rgba(241,236,225,0.55)' }}>{formatDate(acc.requestedAt)}</span>,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '120px',
      sortable: true,
      sortField: 'status',
      render: acc => {
        const badge = STATUS_BADGE[acc.status];
        return <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 11px', borderRadius: 20, background: badge.bg, color: badge.color }}>{badge.label}</span>;
      },
    },
    {
      key: 'actions',
      header: 'Hành động',
      width: '180px',
      render: acc => acc.status === 'pending' && canApproveReject ? (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => handleApprove(acc.id)}
            disabled={actioning === acc.id}
            style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#10b981', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: actioning === acc.id ? 0.6 : 1 }}
          >
            Duyệt
          </button>
          <button
            onClick={() => handleReject(acc.id)}
            disabled={actioning === acc.id}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: actioning === acc.id ? 0.6 : 1 }}
          >
            Từ chối
          </button>
        </div>
      ) : null,
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0 }}>Tài khoản</h1>
          <p style={{ fontSize: 13, color: '#64748b', margin: '4px 0 0' }}>{total} tài khoản</p>
        </div>
      </div>

      {/* Search + filters */}
      <FilterBar onSearch={setSearch} placeholder="Tìm tài khoản" marginBottom={20}>
        <FilterSelect
          value={tab}
          onChange={(v) => { setTab(v as AccountStatus | ''); setPage(1); }}
          options={STATUS_TABS.map(t => ({ value: t.value, label: t.label }))}
        />
      </FilterBar>

      {/* Table */}
      <AdminTable
        columns={columns}
        data={filtered}
        rowKey={acc => acc.id}
        loading={loading}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        emptyText="Không có tài khoản."
        minWidth={800}
        pagination={
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            pageSizeOptions={[10, 20, 50]}
            showTotal={(t, [s, e]) => `${s}–${e} / ${t} tài khoản`}
            onChange={(p, ps) => { setPageSize(ps); setPage(ps !== pageSize ? 1 : p); }}
          />
        }
      />
    </div>
  );
}
