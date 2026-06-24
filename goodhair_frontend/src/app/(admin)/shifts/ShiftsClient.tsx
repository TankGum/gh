'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Spin, App } from 'antd';
import FilterBar from '@/components/ui/FilterBar';
import FilterSelect from '@/components/ui/FilterSelect';
import { fetchEmployees } from '@/services/employees.api';
import { fetchBranches } from '@/services/branches.api';
import { fetchShifts, bulkUpsertShifts } from '@/services/shifts.api';
import { useAuth } from '@/contexts/AuthContext';
import type { Employee } from '@/types/employee.type';
import type { Branch } from '@/types/branch.type';
import type { EmployeeShift, ShiftType } from '@/types/shift.type';

const SHIFT_META: Record<ShiftType, { label: string; bg: string; color: string }> = {
  morning: { label: 'Sáng', bg: 'rgba(238,138,51,.18)', color: '#D9BE84' },
  afternoon: { label: 'Chiều', bg: 'rgba(94,129,151,.22)', color: '#8FB4CC' },
  full_day: { label: 'Cả ngày', bg: 'rgba(63,191,127,.16)', color: '#5FD49A' },
  off: { label: 'Nghỉ', bg: 'rgba(241,236,225,.05)', color: 'rgba(241,236,225,.38)' },
};

const SHIFT_CYCLE: ShiftType[] = ['morning', 'afternoon', 'full_day', 'off'];

const DOWS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

function getMonday(d: Date): Date {
  const day = d.getDay();
  const diff = d.getDate() - ((day + 6) % 7);
  const m = new Date(d);
  m.setDate(diff);
  return m;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

const legendItems = (Object.keys(SHIFT_META) as ShiftType[]).map(k => ({
  label: SHIFT_META[k].label,
  bg: SHIFT_META[k].bg,
  color: SHIFT_META[k].color,
}));

export default function ShiftsClient() {
  const { message } = App.useApp();
  const { can } = useAuth();
  const canEdit = can('shifts', 'edit');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [shifts, setShifts] = useState<Map<string, ShiftType>>(new Map());
  const [draftShifts, setDraftShifts] = useState<Map<string, ShiftType>>(new Map());
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const monday = toISODate(getMonday(new Date()));
  const [startDate, setStartDate] = useState(monday);
  const endDate = addDays(startDate, 6);

  const today = toISODate(new Date());

  const shiftDates = useMemo(() => {
    const dates: string[] = [];
    let cur = startDate;
    let guard = 0;
    while (cur <= endDate && guard < 400) {
      dates.push(cur);
      cur = addDays(cur, 1);
      guard++;
    }
    return dates;
  }, [startDate, endDate]);

  const shiftCols = useMemo(() => shiftDates.map(iso => {
    const d = new Date(iso + 'T00:00:00');
    const di = (d.getDay() + 6) % 7;
    const p = iso.split('-');
    const isToday = iso === today;
    const isWeekend = di >= 5;
    return {
      dow: DOWS[di],
      dd: `${parseInt(p[2])}/${parseInt(p[1])}`,
      headStyle: isToday ? '#EE8A33' : isWeekend ? 'rgba(238,138,51,.6)' : 'rgba(241,236,225,.55)',
    };
  }), [shiftDates, today]);

  const filteredEmployees = useMemo(() => {
    let list = branchFilter === 'all' ? employees : employees.filter(e => e.branchId === branchFilter);
    if (search.trim()) list = list.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [employees, branchFilter, search]);

  const getShift = useCallback((employeeId: string, date: string): ShiftType => {
    if (editing) {
      const key = `${employeeId}_${date}`;
      const d = draftShifts.get(key);
      if (d) return d;
    }
    const key = `${employeeId}_${date}`;
    return shifts.get(key) || 'off';
  }, [editing, shifts, draftShifts]);

  const cycleShift = useCallback((employeeId: string, date: string) => {
    if (!editing) return;
    const cur = getShift(employeeId, date);
    const idx = SHIFT_CYCLE.indexOf(cur);
    const next = SHIFT_CYCLE[(idx + 1) % SHIFT_CYCLE.length];
    setDraftShifts(prev => {
      const nextMap = new Map(prev);
      nextMap.set(`${employeeId}_${date}`, next);
      return nextMap;
    });
  }, [editing, getShift]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [empData, branchData] = await Promise.all([
        fetchEmployees({ size: 100 }),
        fetchBranches({ size: 100 }).catch(() => ({ items: [] as Branch[], total: 0, page: 1, size: 100 })),
      ]);
      setEmployees(empData.items);
      setBranches(branchData.items);

      const shiftData = await fetchShifts({ startDate, endDate });
      const shiftMap = new Map<string, ShiftType>();
      shiftData.forEach(s => {
        shiftMap.set(`${s.employeeId}_${s.date}`, s.shiftType);
      });
      setShifts(shiftMap);
      setDraftShifts(new Map());
    } catch {
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const startEdit = () => {
    setDraftShifts(new Map());
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraftShifts(new Map());
    setEditing(false);
  };

  const handleSave = async () => {
    if (draftShifts.size === 0) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const items: { employeeId: string; date: string; shiftType: ShiftType }[] = [];
      draftShifts.forEach((shiftType, key) => {
        const [employeeId, date] = key.split('_');
        items.push({ employeeId, date, shiftType });
      });
      await bulkUpsertShifts({ shifts: items });
      message.success('Đã lưu lịch ca làm việc');
      setEditing(false);
      setShifts(new Map([...shifts, ...draftShifts]));
      setDraftShifts(new Map());
    } catch {
      message.error('Lưu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const kpis = useMemo(() => {
    const totalStaff = filteredEmployees.length;
    const workingToday = filteredEmployees.filter(e => getShift(e.id, today) !== 'off').length;
    let cntWork = 0;
    let cntOff = 0;
    filteredEmployees.forEach(e => {
      shiftDates.forEach(iso => {
        if (getShift(e.id, iso) === 'off') cntOff++;
        else cntWork++;
      });
    });
    return [
      { label: 'Nhân viên trong lịch', value: String(totalStaff), sub: branchFilter === 'all' ? 'Toàn hệ thống' : (branches.find(b => b.id === branchFilter)?.name || branchFilter) },
      { label: 'Đang làm hôm nay', value: String(workingToday), sub: DOWS[(new Date().getDay() + 6) % 7] },
      { label: 'Tổng ca / kỳ', value: String(cntWork), sub: `${shiftDates.length} ngày · có người trực` },
      { label: 'Lượt nghỉ / kỳ', value: String(cntOff), sub: 'Ô đánh dấu nghỉ' },
    ];
  }, [filteredEmployees, shiftDates, getShift, today, branchFilter, branches]);

  const branchOpts = [{ value: 'all', label: 'Tất cả chi nhánh' }, ...branches.map(b => ({ value: b.id, label: b.name }))];

  return (
    <div>
      {/* Page header — same pattern as all other admin screens */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid #1e293b', paddingBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0, marginBottom: 4 }}>Ca làm việc</h1>
          <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>
            {shiftDates.length > 0 ? `${shiftDates[0]} – ${shiftDates[shiftDates.length - 1]}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          {editing ? (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={cancelEdit} style={{ background: 'transparent', border: '1px solid rgba(238,138,51,.3)', color: 'rgba(241,236,225,.8)', padding: '8px 16px', borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Huỷ</button>
              <button onClick={handleSave} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#3FBF7F', border: 'none', color: '#06210f', padding: '8px 18px', borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M5 13l4 4L19 7"/></svg>
                {saving ? 'Đang lưu...' : 'Lưu lịch ca'}
              </button>
            </div>
          ) : (
            canEdit && (
              <button onClick={startEdit} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#EE8A33', border: 'none', color: '#0B1620', padding: '10px 20px', borderRadius: 8, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z"/></svg>
                Sửa lịch ca
              </button>
            )
          )}
        </div>
      </div>

      {/* FilterBar — search left, date + branch select right */}
      <FilterBar onSearch={setSearch} placeholder="Tìm nhân viên">
        <input
          type="date"
          value={startDate}
          onChange={e => { setStartDate(e.target.value); setEditing(false); }}
          style={{ background: '#0f1e2b', border: '1px solid rgba(238,138,51,.25)', color: '#F1ECE1', padding: '0 12px', height: 36, borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, outline: 'none', colorScheme: 'dark', cursor: 'pointer' }}
        />
        <FilterSelect value={branchFilter} onChange={setBranchFilter} options={branchOpts} />
      </FilterBar>

      {/* Shift grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
      ) : (
        <div style={{ background: '#0f1e2b', border: '1px solid rgba(238,138,51,.16)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: Math.max(720, 150 + shiftDates.length * 54) }}>
              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: `150px repeat(${shiftDates.length}, minmax(48px, 1fr))`, gap: 6, padding: '12px 22px', borderBottom: '1px solid rgba(238,138,51,.12)', fontSize: 11, letterSpacing: '.04em', textTransform: 'uppercase', color: 'rgba(241,236,225,.45)', fontWeight: 700 }}>
                <span>Nhân viên</span>
                {shiftCols.map((col, i) => (
                  <span key={i} style={{ textAlign: 'center', color: col.headStyle }}>
                    {col.dow}<br /><span style={{ fontSize: 10, fontWeight: 600 }}>{col.dd}</span>
                  </span>
                ))}
              </div>

              {/* Employee rows */}
              {filteredEmployees.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#64748b' }}>Không có nhân viên phù hợp.</div>
              ) : (
                filteredEmployees.map(emp => {
                  const initials = emp.name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
                  const branch = branches.find(b => b.id === emp.branchId);
                  return (
                    <div key={emp.id} style={{ display: 'grid', gridTemplateColumns: `150px repeat(${shiftDates.length}, minmax(48px, 1fr))`, gap: 6, padding: '7px 22px', alignItems: 'center', borderBottom: '1px solid rgba(238,138,51,.05)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        {emp.avatarUrl ? (
                          <img src={emp.avatarUrl} alt={emp.name} style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <span style={{ width: 30, height: 30, borderRadius: '50%', background: '#16110C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display',serif", fontWeight: 700, color: '#EE8A33', fontSize: 11, flexShrink: 0 }}>
                            {initials || '?'}
                          </span>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: '#F1ECE1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</div>
                          <div style={{ fontSize: 10.5, color: 'rgba(241,236,225,.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{branch?.name ?? ''}</div>
                        </div>
                      </div>
                      {shiftDates.map(iso => {
                        const code = getShift(emp.id, iso);
                        const meta = SHIFT_META[code];
                        return (
                          <button
                            key={iso}
                            onClick={() => cycleShift(emp.id, iso)}
                            style={{ height: 36, border: 'none', borderRadius: 5, cursor: editing ? 'pointer' : 'default', fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 11, fontWeight: 700, background: meta.bg, color: meta.color, opacity: editing ? 1 : 0.92 }}
                          >
                            {meta.label}
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
