'use client';

import { useState, KeyboardEvent } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  placeholder?: string;
  onSearch: (value: string) => void;
  width?: number | string;
}

export default function SearchBar({ placeholder = 'Tìm kiếm', onSearch, width = '100%' }: SearchBarProps) {
  const [value, setValue] = useState('');

  const commit = () => onSearch(value);

  const clear = () => {
    setValue('');
    onSearch('');
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') commit();
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', height: 36, width }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: '#0f1e2b',
        border: '1px solid #1e293b',
        borderRight: 'none',
        borderRadius: '6px 0 0 6px',
        padding: '0 12px',
        height: '100%',
        flex: 1,
        minWidth: 0,
      }}>
        <Search size={14} style={{ color: '#64748b', flexShrink: 0 }} />
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#fff',
            fontSize: 13,
            minWidth: 0,
          }}
        />
        <button
          onClick={clear}
          style={{
            background: 'none',
            border: 'none',
            padding: 2,
            display: 'flex',
            alignItems: 'center',
            color: '#64748b',
            cursor: 'pointer',
            flexShrink: 0,
            visibility: value ? 'visible' : 'hidden',
          }}
        >
          <X size={13} />
        </button>
      </div>
      <button
        onClick={commit}
        style={{
          height: '100%',
          padding: '0 14px',
          background: '#EE8A33',
          border: 'none',
          borderRadius: '0 6px 6px 0',
          color: '#0B1620',
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        Tìm
      </button>
    </div>
  );
}
