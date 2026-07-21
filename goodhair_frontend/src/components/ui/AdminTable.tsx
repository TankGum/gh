'use client';

import { ReactNode, useState } from 'react';
import { Spin } from 'antd';
import { ChevronUp, ChevronDown, GripVertical } from 'lucide-react';

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
  /** Bật kéo-thả để sắp xếp lại thứ tự các hàng. */
  draggable?: boolean;
  /** Gọi khi thả xong, trả về danh sách rowKey theo thứ tự mới. */
  onReorder?: (orderedKeys: string[]) => void;
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
  draggable = false,
  onReorder,
}: AdminTableProps<T>) {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const gridCols = (draggable ? '32px ' : '') + columns.map(c => c.width ?? '1fr').join(' ');

  const handleDrop = (targetKey: string) => {
    if (!dragKey || !onReorder || dragKey === targetKey) {
      setDragKey(null);
      setOverKey(null);
      return;
    }
    const keys = data.map(rowKey);
    const from = keys.indexOf(dragKey);
    const to = keys.indexOf(targetKey);
    if (from === -1 || to === -1) {
      setDragKey(null);
      setOverKey(null);
      return;
    }
    keys.splice(from, 1);
    keys.splice(to, 0, dragKey);
    onReorder(keys);
    setDragKey(null);
    setOverKey(null);
  };

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
              {draggable && <span />}
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
            ) : data.map(row => {
              const key = rowKey(row);
              const isOver = draggable && overKey === key && dragKey !== null && dragKey !== key;
              return (
              <div
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onDragOver={draggable ? e => { e.preventDefault(); if (overKey !== key) setOverKey(key); } : undefined}
                onDrop={draggable ? e => { e.preventDefault(); handleDrop(key); } : undefined}
                style={{
                  display: 'grid',
                  gridTemplateColumns: gridCols,
                  gap: 12,
                  padding: '14px 22px',
                  alignItems: 'center',
                  borderBottom: '1px solid rgba(238,138,51,0.07)',
                  borderTop: isOver ? '2px solid #EE8A33' : '2px solid transparent',
                  cursor: onRowClick ? 'pointer' : undefined,
                  opacity: draggable && dragKey === key ? 0.4 : 1,
                  background: isOver ? 'rgba(238,138,51,0.06)' : undefined,
                }}
                onMouseEnter={onRowClick ? e => { (e.currentTarget as HTMLDivElement).style.background = 'rgba(238,138,51,0.05)'; } : undefined}
                onMouseLeave={onRowClick ? e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; } : undefined}
              >
                {draggable && (
                  <span
                    draggable
                    onDragStart={() => setDragKey(key)}
                    onDragEnd={() => { setDragKey(null); setOverKey(null); }}
                    onClick={e => e.stopPropagation()}
                    title="Kéo để sắp xếp"
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'grab', color: 'rgba(241,236,225,0.35)' }}
                  >
                    <GripVertical size={15} />
                  </span>
                )}
                {columns.map(col => (
                  <div key={col.key} style={{ textAlign: col.align ?? 'left', minWidth: 0, overflow: 'hidden' }}>
                    {col.render(row)}
                  </div>
                ))}
              </div>
              );
            })}
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
