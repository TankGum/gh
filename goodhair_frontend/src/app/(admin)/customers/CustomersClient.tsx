'use client';

import { useState, useEffect, useCallback } from 'react';
import { Pagination } from 'antd';
import SearchBar from '@/components/ui/SearchBar';
import AdminTable, { ColumnDef } from '@/components/ui/AdminTable';
import { fetchCustomers } from '@/services/customers.api';
import type { Customer } from '@/types/customer.type';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
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
  const [searchKey, setSearchKey] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchCustomers({ q: query || undefined, page, size: pageSize });
      setCustomers(data.items);
      setTotal(data.total);
    } catch {
      setCustomers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [query, page, pageSize]);

  useEffect(() => {
    refresh();
  }, [refresh]);


  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid #1e293b', paddingBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0, marginBottom: 4 }}>Khách hàng</h1>
          <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>{total} khách hàng</p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16, background: 'rgba(238,138,51,0.08)', border: '1px solid rgba(238,138,51,0.2)', borderRadius: 8, padding: '11px 16px' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#EE8A33" strokeWidth="2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
        <span style={{ fontSize: 12.5, color: 'rgba(241,236,225,0.7)' }}>
          Chỉ đọc — hồ sơ khách hàng tự tạo khi có booking qua hệ thống, định danh theo <b style={{ color: '#EE8A33' }}>số điện thoại</b>. Trùng số sẽ cộng dồn lượt đến thay vì tạo mới.
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
        <SearchBar key={searchKey} placeholder="Tìm theo tên hoặc SĐT..." onSearch={(v) => { setQuery(v); setPage(1); }} width={380} />
        {query && (
          <button
            onClick={() => { setQuery(''); setSearchKey(k => k + 1); setPage(1); }}
            style={{ background: 'transparent', border: '1px solid rgba(238,138,51,0.25)', color: 'rgba(241,236,225,0.7)', padding: '0 16px', height: 36, borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            Xoá lọc
          </button>
        )}
      </div>

      <AdminTable<Customer>
        columns={[
          {
            key: 'name',
            header: 'Khách hàng',
            width: '1.6fr',
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
          { key: 'phone', header: 'SĐT', width: '1.2fr', render: c => <span style={{ fontSize: 13, color: 'rgba(241,236,225,0.6)' }}>{c.phone}</span> },
          { key: 'visits', header: 'Lượt đến', width: '90px', render: c => <span style={{ fontSize: 13.5, fontWeight: 600, color: '#F1ECE1' }}>{c.totalVisits}</span> },
          { key: 'spent', header: 'Chi tiêu', width: '130px', render: c => <span style={{ fontSize: 13.5, fontWeight: 700, color: '#EE8A33' }}>{formatCurrency(c.totalSpent)}</span> },
          { key: 'last', header: 'Lần cuối', width: '120px', render: c => <span style={{ fontSize: 12.5, color: 'rgba(241,236,225,0.5)' }}>{formatDate(c.lastVisitDate)}</span> },
        ]}
        data={customers}
        rowKey={c => c.id}
        loading={loading}
        emptyText="Chưa có khách hàng nào."
        minWidth={760}
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
    </div>
  );
}
