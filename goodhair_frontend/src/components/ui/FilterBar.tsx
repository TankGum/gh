'use client';

import type { ReactNode } from 'react';
import SearchBar from './SearchBar';

interface FilterBarProps {
  onSearch: (value: string) => void;
  placeholder?: string;
  /**
   * Bump this value (e.g. a counter) to reset the inner SearchBar input,
   * used when a "clear all filters" action lives outside the search box.
   */
  searchKey?: number | string;
  /** Width of the (short) search box on the left. */
  searchWidth?: number;
  /** Selection controls / info clusters, pushed to the right of the bar. */
  children?: ReactNode;
  /** Bottom margin of the whole toolbar block. */
  marginBottom?: number;
}

/**
 * Shared search + filter toolbar so every admin screen has the same layout:
 * a short search box on the left and the selection clusters pushed to the
 * right, wrapping onto a new line when the row runs out of space.
 */
export default function FilterBar({
  onSearch,
  placeholder,
  searchKey,
  searchWidth = 300,
  children,
  marginBottom = 18,
}: FilterBarProps) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 10, marginBottom }}>
      <div style={{ width: searchWidth, maxWidth: '100%', flex: '1 1 auto', minWidth: 0 }}>
        <SearchBar key={searchKey} onSearch={onSearch} placeholder={placeholder} />
      </div>
      {children && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {children}
        </div>
      )}
    </div>
  );
}
