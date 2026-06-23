'use client';

import { ReactNode } from 'react';
import { Spin } from 'antd';

export interface ColumnDef<T> {
  key: string;
  header: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
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
}: AdminTableProps<T>) {
  const gridCols = columns.map(c => c.width ?? '1fr').join(' ');

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
                <span key={col.key} style={{ textAlign: col.align ?? 'left' }}>{col.header}</span>
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
