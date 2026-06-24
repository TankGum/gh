'use client';

interface FilterClearButtonProps {
  onClick: () => void;
  label?: string;
}

/** Standardized "clear all filters" button for FilterBar rows. */
export default function FilterClearButton({ onClick, label = 'Xoá lọc' }: FilterClearButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        border: '1px solid rgba(238,138,51,0.25)',
        color: 'rgba(241,236,225,0.7)',
        padding: '0 14px',
        height: 36,
        borderRadius: 6,
        fontFamily: "'Hanken Grotesk',sans-serif",
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}
