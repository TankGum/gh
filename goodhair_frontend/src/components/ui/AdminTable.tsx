'use client';

import { ReactNode } from 'react';
import { Spin } from 'antd';
import { ChevronUp, ChevronDown } from 'lucide-react';

export interface ColumnDef<T> {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
  sortField?: string;
  render: (row: T) => ReactNode;
}

interface AdminTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyText?: string;
  minWidth?: number;
  pagination?: ReactNode;
  onRowClick?: (row: T) => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string, order: 'asc' | 'desc') => void;
}

function SortIcon({ active, direction }: { active: boolean; direction?: 'asc' | 'desc' }) {
  return (
    <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1, marginLeft: 4, opacity: active ? 1 : 0.3 }}>
      <ChevronUp size={10} style={{ color: active && direction === 'asc' ? '#EE8A33' : 'rgba(241,236,225,0.45)', marginBottom: -2 }} />
      <ChevronDown size={10} style={{ color: active && direction === 'desc' ? '#EE8A33' : 'rgba(241,236,225,0.45)', marginTop: -2 }} />
    </span>
  );
}

export default function AdminTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  emptyText = 'Không có dữ liệu.',
  minWidth = 720,
  pagination,
  onRowClick,
  sortBy,
  sortOrder = 'desc',
  onSort,
}: AdminTableProps<T>) {
  const gridCols = columns.map(c => c.width ?? '1fr').join(' ');

  const handleHeaderClick = (col: ColumnDef<T>) => {
    if (!col.sortable || !onSort) return;
    const field = col.sortField ?? col.key;
    const isActive = sortBy === field;
    const nextOrder = isActive && sortOrder === 'desc' ? 'asc' : 'desc';
    onSort(field, nextOrder);
  };

  return (
    <div style={{ background: '#0f1e2b', border: '1px solid rgba(238,138,51,0.16)', borderRadius: 8, overflow: 'hidden' }}>
      {loading ? (
        <div style={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: gridCols,
              gap: 12,
              padding: '13px 22px',
              borderBottom: '1px solid rgba(238,138,51,0.16)',
              fontSize: 11,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'rgba(241,236,225,0.45)',
              fontWeight: 700,
            }}>
              {columns.map(col => (
                <span
                  key={col.key}
                  onClick={() => handleHeaderClick(col)}
                  style={{
                    textAlign: col.align ?? 'left',
                    cursor: col.sortable ? 'pointer' : undefined,
                    userSelect: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start',
                  }}
                >
                  {col.header}
                  {col.sortable && <SortIcon active={sortBy === col.key} direction={sortBy === col.key ? sortOrder : undefined} />}
                </span>
              ))}
            </div>

            {data.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>{emptyText}</div>
            ) : data.map(row => (
              <div
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={{
                  display: 'grid',
                  gridTemplateColumns: gridCols,
                  gap: 12,
                  padding: '14px 22px',
                  alignItems: 'center',
                  borderBottom: '1px solid rgba(238,138,51,0.07)',
                  cursor: onRowClick ? 'pointer' : undefined,
                }}
                onMouseEnter={onRowClick ? e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(238,138,51,0.05)'; } : undefined}
                onMouseLeave={onRowClick ? e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; } : undefined}
              >
                {columns.map(col => (
                  <div key={col.key} style={{ textAlign: col.align ?? 'left', minWidth: 0, overflow: 'hidden' }}>
                    {col.render(row)}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {pagination && (
        <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(238,138,51,0.12)', display: 'flex', justifyContent: 'flex-end' }}>
          {pagination}
        </div>
      )}
    </div>
  );
}
