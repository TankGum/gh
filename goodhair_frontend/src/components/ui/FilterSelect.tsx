'use client';

export interface FilterSelectOption {
  value: string;
  label: string;
}

interface FilterSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: FilterSelectOption[];
  /** Min width of the control in px. */
  minWidth?: number;
}

/**
 * Themed dropdown used inside FilterBar so every screen shares the same
 * filter styling (dark fill, orange border, custom caret).
 */
export default function FilterSelect({ value, onChange, options, minWidth }: FilterSelectProps) {
  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          appearance: 'none',
          background: '#0f1e2b',
          border: '1px solid rgba(238,138,51,.25)',
          color: '#F1ECE1',
          padding: '0 34px 0 14px',
          height: 36,
          minWidth,
          borderRadius: 6,
          fontFamily: "'Hanken Grotesk',sans-serif",
          fontSize: 13,
          fontWeight: 600,
          outline: 'none',
          cursor: 'pointer',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <span style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#EE8A33', fontSize: 10 }}>▾</span>
    </div>
  );
}
