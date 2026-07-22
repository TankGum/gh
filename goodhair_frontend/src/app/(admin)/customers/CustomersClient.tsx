'use client';

import { useState, useEffect, useCallback } from 'react';
import { Pagination } from 'antd';
import { Eye } from 'lucide-react';
import FilterBar from '@/components/ui/FilterBar';
import AdminTable from '@/components/ui/AdminTable';
import Modal from '@/components/ui/Modal';
import { fetchCustomers } from '@/services/customers.api';
import type { Customer } from '@/types/customer.type';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value) + ' VND';
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  const date = new Date(d + 'T00:00:00');
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function CustomersClient() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [detailTarget, setDetailTarget] = useState<Customer | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCustomers({ q: query || undefined, page, size: pageSize, sortBy, sortOrder });
      setCustomers(data.items);
      setTotal(data.total);
    } catch {
      setCustomers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [query, page, pageSize, sortBy, sortOrder]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSort = (field: string, order: 'asc' | 'desc') => {
    setSortBy(field);
    setSortOrder(order);
    setPage(1);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid #1e293b', paddingBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0, marginBottom: 4 }}>Khách hàng</h1>
        </div>
      </div>

<FilterBar onSearch={(v) => { setQuery(v); setPage(1); }} placeholder="Tìm khách hàng" marginBottom={16} />

      <AdminTable<Customer>
        columns={[
          {
            key: 'name',
            header: 'Khách hàng',
            width: '1.6fr',
            sortable: true,
            sortField: 'name',
            render: c => {
              const initials = c.name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                  <span style={{ width: 36, height: 36, borderRadius: '50%', background: '#16110C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display',serif", fontWeight: 700, color: '#EE8A33', fontSize: 12, flexShrink: 0 }}>
                    {initials || '?'}
                  </span>
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: '#F1ECE1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                </div>
              );
            },
          },
          { key: 'phone', header: 'SĐT', width: '1.2fr', sortable: true, sortField: 'phone', render: c => <span style={{ fontSize: 13, color: 'rgba(241,236,225,0.6)' }}>{c.phone}</span> },
          { key: 'visits', header: 'Lượt đến', width: '90px', sortable: true, sortField: 'total_visits', render: c => <span style={{ fontSize: 13.5, fontWeight: 600, color: '#F1ECE1' }}>{c.totalVisits}</span> },
          { key: 'spent', header: 'Chi tiêu', width: '130px', sortable: true, sortField: 'total_spent', render: c => <span style={{ fontSize: 13.5, fontWeight: 700, color: '#EE8A33' }}>{formatCurrency(c.totalSpent)}</span> },
          {
            key: 'services',
            header: 'Dịch vụ đã dùng',
            width: '110px',
            align: 'center',
            render: c => {
              if (c.serviceBreakdown.length === 0) {
                return <span style={{ fontSize: 12, color: 'rgba(241,236,225,0.35)' }}>—</span>;
              }
              return (
                <button
                  onClick={e => { e.stopPropagation(); setDetailTarget(c); }}
                  title="Xem dịch vụ đã dùng"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 6, background: 'rgba(238,138,51,0.1)', border: 'none', color: '#EE8A33', cursor: 'pointer' }}
                >
                  <Eye size={15} />
                </button>
              );
            },
          },
          { key: 'last', header: 'Lần cuối', width: '120px', sortable: true, sortField: 'last_visit_date', render: c => <span style={{ fontSize: 12.5, color: 'rgba(241,236,225,0.5)' }}>{formatDate(c.lastVisitDate)}</span> },
        ]}
        data={customers}
        rowKey={c => c.id}
        loading={loading}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        emptyText="Chưa có khách hàng nào."
        minWidth={860}
        pagination={
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            pageSizeOptions={[10, 20, 50]}
            showTotal={(t, [s, e]) => `${s}–${e} / ${t} khách hàng`}
            onChange={(p, ps) => { setPageSize(ps); setPage(ps !== pageSize ? 1 : p); }}
          />
        }
      />

      <Modal
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        title={detailTarget ? `Dịch vụ đã dùng · ${detailTarget.name}` : ''}
        style={{ maxWidth: 480 }}
      >
        {detailTarget && (
          <div style={{ padding: '4px 0' }}>
            <div style={{ border: '1px solid rgba(238,138,51,0.12)', borderRadius: 8, overflow: 'hidden', maxHeight: 360, overflowY: 'auto' }}>
              {detailTarget.serviceBreakdown.map((b, i) => (
                <div
                  key={b.serviceId ?? i}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: i < detailTarget.serviceBreakdown.length - 1 ? '1px solid rgba(238,138,51,0.08)' : 'none' }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: '#F1ECE1' }}>{b.serviceName}</div>
                    {b.serviceDescription && (
                      <div style={{ fontSize: 11.5, color: 'rgba(241,236,225,0.45)', marginTop: 2 }}>{b.serviceDescription}</div>
                    )}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#EE8A33', flexShrink: 0 }}>×{b.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
