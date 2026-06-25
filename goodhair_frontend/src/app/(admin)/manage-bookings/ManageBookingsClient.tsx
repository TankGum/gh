'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dayjs from 'dayjs';
import { DatePicker, Select, Spin, App } from 'antd';
import FilterBar from '@/components/ui/FilterBar';
import FilterSelect from '@/components/ui/FilterSelect';
import { useIsMobile } from '@/hooks/useIsMobile';
import { fetchBookings, createBooking, updateBooking, deleteBooking } from '@/services/bookings.api';
import { fetchEmployees } from '@/services/employees.api';
import { fetchBranches } from '@/services/branches.api';
import { fetchServices } from '@/services/services.api';
import { fetchShifts } from '@/services/shifts.api';
import { useAuth } from '@/contexts/AuthContext';
import { useBadge } from '@/contexts/BadgeContext';
import Modal from '@/components/ui/Modal';
import type { Booking, BookingStatus, BookingCreatePayload, BookingUpdatePayload } from '@/types/booking.type';
import type { Employee } from '@/types/employee.type';
import type { Branch } from '@/types/branch.type';
import type { HairService } from '@/types/service.type';
import type { EmployeeShift, ShiftType } from '@/types/shift.type';

const STATUS_META: Record<BookingStatus, { label: string; dot: string }> = {
  pending: { label: 'Chờ xác nhận', dot: '#D9BE84' },
  confirmed: { label: 'Đã xác nhận', dot: '#8FB4CC' },
  completed: { label: 'Hoàn thành', dot: '#5FD49A' },
  cancelled: { label: 'Đã huỷ', dot: '#C6B7A0' },
};

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

function minOf(time: string): number {
  const p = time.split(':');
  return parseInt(p[0]) * 60 + parseInt(p[1] || '0');
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value) + ' VND';
}

function formatShort(value: number): string {
  return new Intl.NumberFormat('vi-VN').format(value) + ' VND';
}

export default function ManageBookingsClient() {
  const { message } = App.useApp();
  const { can } = useAuth();
  const { refreshBadges } = useBadge();
  const canCreate = can('bookings', 'create');
  const canEdit = can('bookings', 'edit');
  const canDelete = can('bookings', 'delete');

  const today = toISODate(new Date());
  const maxDate = addDays(today, 10);
  const [search, setSearch] = useState('');
  const [selectedDate, setSelectedDate] = useState(today);
  const [branchFilter, setBranchFilter] = useState<string>('all');

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [services, setServices] = useState<HairService[]>([]);
  const [shifts, setShifts] = useState<EmployeeShift[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [modalData, setModalData] = useState<Partial<Booking> | null>(null);
  const [originalStatus, setOriginalStatus] = useState<BookingStatus | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Booking | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isMobile = useIsMobile();
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [tooltipData, setTooltipData] = useState<{ b: Booking; timeRange: string; svcNames: string; x: number; y: number } | null>(null);

  const todayDate = new Date();
  const weekDates = Array.from({ length: 61 }, (_, i) => addDays(toISODate(new Date(todayDate.getTime() - 30 * 86400000)), i));

  // Filter barbers (employees with role name "barber")
  const barbers = useMemo(() => {
    return employees;
  }, [employees]);

  const filteredBarbers = useMemo(() => {
    let list = branchFilter === 'all' ? barbers : barbers.filter(e => e.branchId === branchFilter);
    if (search.trim()) list = list.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [barbers, branchFilter, search]);

  // Build hours range from branches
  const hoursRange = useMemo(() => {
    let openMin = 540, closeMin = 1260;
    if (branchFilter === 'all') {
      const open = branches.filter(b => b.status === 'open');
      if (open.length) {
        openMin = Math.min(...open.map(b => minOf(b.openingTime || '09:00')));
        closeMin = Math.max(...open.map(b => minOf(b.closingTime || '21:00')));
      }
    } else {
      const br = branches.find(b => b.id === branchFilter);
      if (br) {
        openMin = minOf(br.openingTime || '09:00');
        closeMin = minOf(br.closingTime || '21:00');
      }
    }
    const startHour = Math.floor(openMin / 60);
    const endHour = Math.ceil(closeMin / 60);
    const gridMin = startHour * 60;
    const hours: number[] = [];
    for (let h = startHour; h < endHour; h++) hours.push(h);
    const slots: number[] = [];
    for (let h = startHour; h < endHour; h++) {
      slots.push(h);
      slots.push(h + 0.5);
    }
    if (slots.length > 0 && slots[slots.length - 1] >= endHour) slots.pop();
    const slotHeight = 39;
    return { hours, slots, startHour, openMin, closeMin, gridMin, pxPerMin: slotHeight / 30, slotHeight, label: `${pad2(startHour)}:00 – ${pad2(endHour)}:00` };
  }, [branches, branchFilter]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [bookingData, empData, branchData, svcData, shiftData] = await Promise.all([
        fetchBookings({ date: selectedDate, size: 100 }),
        fetchEmployees({ size: 100 }),
        fetchBranches({ size: 100 }).catch(() => ({ items: [] as Branch[], total: 0, page: 1, size: 100 })),
        fetchServices({ size: 100 }).catch(() => ({ items: [] as HairService[], total: 0, page: 1, size: 100 })),
        fetchShifts({ startDate: selectedDate, endDate: selectedDate }).catch(() => [] as EmployeeShift[]),
      ]);
      setBookings(bookingData.items);
      setEmployees(empData.items);
      setBranches(branchData.items);
      setServices(svcData.items);
      setShifts(shiftData);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const bookingsByEmployee = useMemo(() => {
    const map = new Map<string, Booking[]>();
    filteredBarbers.forEach(e => map.set(e.id, []));
    bookings.forEach(b => {
      if (b.employeeId && map.has(b.employeeId)) {
        map.get(b.employeeId)!.push(b);
      }
    });
    return map;
  }, [bookings, filteredBarbers]);

  const shiftMap = useMemo(() => {
    const m = new Map<string, ShiftType>();
    shifts.forEach(s => {
      if (s.date === selectedDate) m.set(s.employeeId, s.shiftType);
    });
    return m;
  }, [shifts, selectedDate]);

  const canWorkAt = (employeeId: string, minutes: number): boolean => {
    const st = shiftMap.get(employeeId);
    if (!st || st === 'full_day' || st === 'off') return true;
    if (st === 'morning') return minutes < 720;
    if (st === 'afternoon') return minutes >= 720;
    return true;
  };

  const openAdd = (employeeId?: string, branchId?: string, date?: string, startTime?: string) => {
    setFormErrors({});
    setModalData({
      employeeId: employeeId || null,
      branchId: branchId || (branchFilter !== 'all' ? branchFilter : null),
      date: date || selectedDate,
      startTime: startTime || '09:00',
      customerName: '',
      customerPhone: '',
      durationMinutes: 0,
      total: 0,
      status: 'pending',
      serviceIds: [],
    });
    setModalMode('add');
  };

  const openEdit = (booking: Booking) => {
    setFormErrors({});
    setModalData({ ...booking });
    setOriginalStatus(booking.status);
    setModalMode('edit');
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!modalData?.customerName?.trim()) errs.customerName = 'Vui lòng nhập tên khách hàng';
    if (!modalData?.customerPhone?.trim()) errs.customerPhone = 'Vui lòng nhập số điện thoại';
    else if (modalData.customerPhone.trim().length < 8) errs.customerPhone = 'Số điện thoại không hợp lệ';
    if (!modalData?.branchId) errs.branchId = 'Vui lòng chọn chi nhánh';
    if (!modalData?.employeeId) errs.employeeId = 'Vui lòng chọn barber';
    if (!modalData?.date) errs.date = 'Vui lòng chọn ngày';
    if (!modalData?.startTime) errs.startTime = 'Vui lòng chọn giờ';
    if (!modalData?.serviceIds?.length) errs.serviceIds = 'Vui lòng chọn ít nhất một dịch vụ';
    if (!modalData?.total || modalData.total <= 0) errs.total = 'Tổng tiền phải lớn hơn 0';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!modalData) return;
    if (!validate()) return;
    setSubmitting(true);
    try {
      if (modalMode === 'add') {
        await createBooking(modalData as BookingCreatePayload);
        message.success('Tạo lịch hẹn thành công');
      } else {
        const { id, ...rest } = modalData;
        await updateBooking(id!, rest as BookingUpdatePayload);
        message.success('Cập nhật lịch hẹn thành công');
      }
      setModalMode(null);
      setModalData(null);
      setFormErrors({});
      await refresh();
      refreshBadges();
    } catch (e) {
      const err = e as { detail?: { message?: string }; message?: string };
      message.error(err?.detail?.message || err?.message || (modalMode === 'add' ? 'Tạo thất bại' : 'Cập nhật thất bại'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await deleteBooking(deleteTarget.id);
      message.success('Xoá lịch hẹn thành công');
      setDeleteTarget(null);
      await refresh();
      refreshBadges();
    } catch {
      message.error('Xoá thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const statusOpts = (Object.keys(STATUS_META) as BookingStatus[]).map(k => ({
    value: k,
    label: STATUS_META[k].label,
  }));

  const branchOpts = [{ value: 'all', label: 'Tất cả cửa hàng' }, ...branches.map(b => ({ value: b.id, label: b.name }))];

  const slotOpts: { value: string; label: string }[] = [];
  for (let h = 7; h <= 21; h++) {
    slotOpts.push({ value: `${pad2(h)}:00`, label: `${pad2(h)}:00` });
    if (h < 21) slotOpts.push({ value: `${pad2(h)}:30`, label: `${pad2(h)}:30` });
  }

  const barberOpts = filteredBarbers.map(e => ({ value: e.id, label: e.name }));
  // When branch changes in modal, filter barbers
  const modalBarberOpts = modalData?.branchId
    ? employees.filter(e => e.branchId === modalData.branchId).map(e => ({ value: e.id, label: e.name }))
    : barberOpts;

  const serviceOpts = services.map(s => ({ value: s.id, label: `${s.name} (${formatShort(s.price)})` }));

  const modalSlotOpts = useMemo(() => {
    if (!modalData?.employeeId || !modalData?.date) return slotOpts;
    const empBookings = bookingsByEmployee.get(modalData.employeeId) || [];
    return slotOpts.filter(o => {
      const mins = minOf(o.value);
      if (!canWorkAt(modalData.employeeId!, mins)) return false;
      if (mins < hoursRange.openMin || mins + 30 > hoursRange.closeMin) return false;
      const overlap = empBookings.some(b => {
        if (b.status === 'cancelled') return false;
        if (modalMode === 'edit' && b.id === modalData.id) return false;
        const bs = minOf(b.startTime);
        const be = bs + b.durationMinutes;
        return mins < be && mins + 30 > bs;
      });
      return !overlap;
    });
  }, [modalData?.employeeId, modalData?.date, modalData?.id, modalMode, bookingsByEmployee, slotOpts, canWorkAt, hoursRange]);

  const employeeMap = useMemo(() => {
    const m = new Map<string, Employee>();
    employees.forEach(e => m.set(e.id, e));
    return m;
  }, [employees]);

  const branchMap = useMemo(() => {
    const m = new Map<string, Branch>();
    branches.forEach(b => m.set(b.id, b));
    return m;
  }, [branches]);

  const serviceMap = useMemo(() => {
    const m = new Map<string, HairService>();
    services.forEach(s => m.set(s.id, s));
    return m;
  }, [services]);

    return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid #1e293b', paddingBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0, marginBottom: 4 }}>Đặt lịch</h1>
          <p style={{ margin: 0, fontSize: 14, color: '#64748b' }}>{bookings.length} lịch hẹn hôm nay</p>
        </div>
        {canCreate && (
          <button
            onClick={() => openAdd()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#EE8A33', border: 'none', color: '#0B1620', padding: '10px 20px', borderRadius: 8, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M12 5v14M5 12h14"/></svg>
            Tạo lịch hẹn
          </button>
        )}
      </div>

      {/* Status legend */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        {(Object.keys(STATUS_META) as BookingStatus[]).map(k => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: STATUS_META[k].dot }} />
            <span style={{ fontSize: 11.5, color: 'rgba(241,236,225,.55)' }}>{STATUS_META[k].label}</span>
          </div>
        ))}
      </div>

      {/* Row 2: Search + date + branch */}
      <FilterBar onSearch={setSearch} placeholder="Tìm barber">
        <DatePicker
          value={selectedDate ? dayjs(selectedDate) : null}
          onChange={(d) => setSelectedDate(d ? d.format('YYYY-MM-DD') : today)}
          allowClear={false}
          style={{ height: 36, background: '#0f1e2b', borderColor: 'rgba(238,138,51,.25)' }}
        />
        <FilterSelect value={branchFilter} onChange={setBranchFilter} options={branchOpts} />
      </FilterBar>

      {/* Board */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, background: '#0F1E2B', border: '1px solid rgba(238,138,51,.16)', borderRadius: 10, overflow: 'auto' }}>
          {filteredBarbers.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: 14 }}>
              Không có barber phù hợp
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 760 }}>
              {/* Sticky header row */}
              <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 2, borderBottom: '1px solid rgba(238,138,51,.14)', background: '#0F1E2B' }}>
                <div style={{ width: 58, flexShrink: 0, background: '#0F1E2B' }} />
                {filteredBarbers.map(emp => {
                  const branch = branchMap.get(emp.branchId || '');
                  const empBookings = bookingsByEmployee.get(emp.id) || [];
                  const initials = emp.name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
                  return (
                    <div key={emp.id} style={{ flex: 1, minWidth: 178, borderRight: '1px solid rgba(238,138,51,.08)', display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 66, background: '#0B1620' }}>
                      {emp.avatarUrl ? (
                        <img src={emp.avatarUrl} alt={emp.name} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                      ) : (
                        <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#16110C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display',serif", fontWeight: 700, color: '#EE8A33', fontSize: 12, flexShrink: 0 }}>
                          {initials}
                        </span>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#F1ECE1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</div>
                        <div style={{ fontSize: 10.5, color: 'rgba(241,236,225,.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {branch?.name || ''} · {empBookings.length} lịch
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {/* Time slots body — scrolls vertically under sticky header */}
              <div style={{ display: 'flex' }}>
                <div style={{ width: 58, flexShrink: 0, borderRight: '1px solid rgba(238,138,51,.1)' }}>
                  {hoursRange.slots.map(s => {
                    const isWhole = s === Math.floor(s);
                    const mm = isWhole ? '00' : '30';
                    return (
                      <div key={s} style={{ height: hoursRange.slotHeight, position: 'relative', borderBottom: isWhole ? '1px solid rgba(238,138,51,.14)' : '1px solid rgba(238,138,51,.05)' }}>
                        {isWhole && <span style={{ position: 'absolute', top: 2, right: 8, fontSize: 11, color: 'rgba(241,236,225,.4)', fontVariantNumeric: 'tabular-nums' }}>{pad2(s)}:00</span>}
                        {!isWhole && <span style={{ position: 'absolute', top: 2, right: 8, fontSize: 9, color: 'rgba(241,236,225,.2)', fontVariantNumeric: 'tabular-nums' }}>{pad2(Math.floor(s))}:{mm}</span>}
                      </div>
                    );
                  })}
                </div>
                {filteredBarbers.map(emp => {
                  const empBookings = bookingsByEmployee.get(emp.id) || [];
                  return (
                    <div key={emp.id} style={{ flex: 1, minWidth: 178, borderRight: '1px solid rgba(238,138,51,.08)' }}>
                      <div style={{ position: 'relative', height: hoursRange.slots.length * hoursRange.slotHeight }}>
                        {hoursRange.slots.map(s => {
                          const m = s === Math.floor(s) ? 0 : 30;
                          const mins = Math.floor(s) * 60 + m;
                          const available = canWorkAt(emp.id, mins) && mins >= hoursRange.openMin && mins + 30 <= hoursRange.closeMin;
                          const booked = empBookings.some(b => {
                            if (b.status === 'cancelled') return false;
                            const bs = minOf(b.startTime);
                            const be = bs + b.durationMinutes;
                            return mins < be && mins + 30 > bs;
                          });
                          const canClick = available && !booked && canCreate;
                          return (
                            <div
                              key={s}
                              onClick={() => canClick && openAdd(emp.id, emp.branchId || undefined, selectedDate, `${pad2(Math.floor(s))}:${pad2(m)}`)}
                              style={{ height: hoursRange.slotHeight, borderBottom: '1px solid rgba(238,138,51,.06)', cursor: canClick ? 'pointer' : 'default', background: !available ? 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,.015) 3px, rgba(255,255,255,.015) 6px)' : booked ? 'rgba(238,138,51,.06)' : 'transparent' }}
                            />
                          );
                        })}
                        {empBookings.map(b => {
                          const top = (minOf(b.startTime) - hoursRange.gridMin) * hoursRange.pxPerMin;
                          const h = Math.max(b.durationMinutes * hoursRange.pxPerMin - 5, 34);
                          const accent = STATUS_META[b.status]?.dot || '#888';
                          const faded = b.status === 'cancelled';
                          const svcNames = b.serviceIds.map(sid => serviceMap.get(sid)?.name).filter(Boolean).join(', ');
                          const completed = b.status === 'completed';
                          const endMin = minOf(b.startTime) + b.durationMinutes;
                          const timeRange = `${b.startTime.slice(0, 5)}–${pad2(Math.floor(endMin / 60))}:${pad2(endMin % 60)}`;
                          return (
                            <div
                              key={b.id}
                              onMouseEnter={(e) => setTooltipData({ b, timeRange, svcNames, x: e.clientX, y: e.clientY })}
                              onMouseMove={(e) => setTooltipData(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                              onMouseLeave={() => setTooltipData(null)}
                              onClick={() => openEdit(b)}
                              style={{ position: 'absolute', left: 6, right: 6, overflow: 'hidden', cursor: completed ? 'default' : 'pointer', borderRadius: 6, padding: '7px 9px', top, height: h, background: completed ? '#1a2a38' : '#15293b', borderLeft: `3px solid ${accent}`, boxShadow: '0 4px 12px rgba(0,0,0,.3)', opacity: faded ? 0.55 : 1 }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                <span style={{ fontSize: 10.5, fontWeight: 700, color: 'rgba(241,236,225,.85)', fontVariantNumeric: 'tabular-nums' }}>{timeRange}</span>
                                {canDelete && !completed && (
                                  <button
                                    onClick={e => { e.stopPropagation(); setDeleteTarget(b); }}
                                    style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.25)', border: 'none', borderRadius: 4, cursor: 'pointer', color: 'rgba(241,236,225,.7)', fontSize: 11, flexShrink: 0, padding: 0 }}
                                  >✕</button>
                                )}
                              </div>
                              <div style={{ fontSize: 12.5, fontWeight: 600, color: '#fff', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={`${b.customerName} · ${b.customerPhone}`}>{b.customerName} <span style={{ fontWeight: 400, color: 'rgba(241,236,225,.55)', fontSize: 11 }}>{b.customerPhone}</span></div>
                              <div style={{ fontSize: 10.5, color: 'rgba(241,236,225,.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{svcNames || '—'} · {formatShort(b.total)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          </div>
      )}

      {/* Add/Edit modal */}
      <Modal
        open={!!modalMode}
        onClose={() => { setModalMode(null); setModalData(null); setOriginalStatus(null); setFormErrors({}); }}
        title={modalMode === 'add' ? 'Tạo lịch hẹn' : 'Sửa lịch hẹn'}
        style={{ maxWidth: 580 }}
      >
        {modalData && (() => {
          const readonly = originalStatus === 'completed';
          return (
          <div style={{ padding: '8px 0' }}>
            {/* Customer info row */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(241,236,225,.55)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Tên khách hàng</label>
                <input
                  value={modalData.customerName || ''}
                  disabled={readonly}
                  onChange={e => { setFormErrors(prev => ({ ...prev, customerName: '' })); setModalData({ ...modalData, customerName: e.target.value }); }}
                  style={{ width: '100%', background: readonly ? '#0a151f' : '#0B1620', border: `1px solid ${formErrors.customerName ? '#EF4444' : 'rgba(238,138,51,.25)'}`, color: '#F1ECE1', padding: '10px 12px', borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, outline: 'none', cursor: readonly ? 'default' : undefined }}
                />
                {formErrors.customerName && <span style={{ fontSize: 11, color: '#EF4444', marginTop: 4, display: 'block' }}>{formErrors.customerName}</span>}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(241,236,225,.55)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Số điện thoại</label>
                <input
                  value={modalData.customerPhone || ''}
                  disabled={readonly}
                  onChange={e => { setFormErrors(prev => ({ ...prev, customerPhone: '' })); setModalData({ ...modalData, customerPhone: e.target.value }); }}
                  style={{ width: '100%', background: readonly ? '#0a151f' : '#0B1620', border: `1px solid ${formErrors.customerPhone ? '#EF4444' : 'rgba(238,138,51,.25)'}`, color: '#F1ECE1', padding: '10px 12px', borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, outline: 'none', cursor: readonly ? 'default' : undefined }}
                />
                {formErrors.customerPhone && <span style={{ fontSize: 11, color: '#EF4444', marginTop: 4, display: 'block' }}>{formErrors.customerPhone}</span>}
              </div>
            </div>

            {/* Services */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(241,236,225,.55)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Dịch vụ</label>
              <div style={{ border: `1px solid ${formErrors.serviceIds ? '#EF4444' : 'rgba(238,138,51,.25)'}`, borderRadius: 6 }}>
                <Select
                  mode="multiple"
                  size="large"
                  variant="borderless"
                  value={modalData.serviceIds || []}
                  disabled={readonly}
                  onChange={(ids: string[]) => {
                    setFormErrors(prev => ({ ...prev, serviceIds: '' }));
                    const total = ids.reduce((sum, sid) => sum + (serviceMap.get(sid)?.price || 0), 0);
                    const dur = ids.reduce((sum, sid) => sum + (serviceMap.get(sid)?.durationMinutes || 0), 0);
                    setModalData({ ...modalData, serviceIds: ids, total, durationMinutes: dur });
                  }}
                  style={{ width: '100%' }}
                  placeholder="Chọn dịch vụ"
                  options={serviceOpts}
                />
              </div>
              {formErrors.serviceIds && <span style={{ fontSize: 11, color: '#EF4444', marginTop: 4, display: 'block' }}>{formErrors.serviceIds}</span>}
            </div>
            {/* Branch / Barber */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(241,236,225,.55)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Chi nhánh</label>
                <div style={{ border: `1px solid ${formErrors.branchId ? '#EF4444' : 'rgba(238,138,51,.25)'}`, borderRadius: 6 }}>
                  <Select
                    value={modalData.branchId || undefined}
                    disabled={readonly}
                    onChange={(val: string | undefined) => { setFormErrors(prev => ({ ...prev, branchId: '' })); setModalData({ ...modalData, branchId: val || null, employeeId: null }); }}
                    style={{ width: '100%' }}
                    variant="borderless"
                    placeholder="Chọn chi nhánh"
                    allowClear
                    options={branches.map(b => ({ label: b.name, value: b.id }))}
                  />
                </div>
                {formErrors.branchId && <span style={{ fontSize: 11, color: '#EF4444', marginTop: 4, display: 'block' }}>{formErrors.branchId}</span>}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(241,236,225,.55)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Barber</label>
                <div style={{ border: `1px solid ${formErrors.employeeId ? '#EF4444' : 'rgba(238,138,51,.25)'}`, borderRadius: 6 }}>
                  <Select
                    value={modalData.employeeId || undefined}
                    disabled={readonly}
                    onChange={(val: string | undefined) => { setFormErrors(prev => ({ ...prev, employeeId: '' })); setModalData({ ...modalData, employeeId: val || null }); }}
                    style={{ width: '100%' }}
                    variant="borderless"
                    placeholder="Chọn barber"
                    allowClear
                    options={modalBarberOpts}
                  />
                </div>
                {formErrors.employeeId && <span style={{ fontSize: 11, color: '#EF4444', marginTop: 4, display: 'block' }}>{formErrors.employeeId}</span>}
              </div>
            </div>

            {/* Date / Time / Status / Total */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(241,236,225,.55)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Ngày</label>
                <input
                  type="date"
                  value={modalData.date || ''}
                  disabled={readonly}
                  min={today}
                  max={maxDate}
                  onChange={e => {
                    setFormErrors(prev => ({ ...prev, date: '' }));
                    const val = e.target.value;
                    if (val < today) return setModalData({ ...modalData, date: today });
                    if (val > maxDate) return setModalData({ ...modalData, date: maxDate });
                    setModalData({ ...modalData, date: val });
                  }}
                  style={{ width: '100%', background: readonly ? '#0a151f' : '#0B1620', border: `1px solid ${formErrors.date ? '#EF4444' : 'rgba(238,138,51,.25)'}`, color: '#F1ECE1', padding: '10px 12px', borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, outline: 'none', colorScheme: 'dark', cursor: readonly ? 'default' : undefined }}
                />
                {formErrors.date && <span style={{ fontSize: 11, color: '#EF4444', marginTop: 4, display: 'block' }}>{formErrors.date}</span>}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(241,236,225,.55)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Giờ bắt đầu</label>
                <div style={{ border: `1px solid ${formErrors.startTime ? '#EF4444' : 'rgba(238,138,51,.25)'}`, borderRadius: 6 }}>
                  <Select
                    value={modalData.startTime || '09:00'}
                    disabled={readonly}
                    onChange={(val: string) => { setFormErrors(prev => ({ ...prev, startTime: '' })); setModalData({ ...modalData, startTime: val }); }}
                    style={{ width: '100%' }}
                    variant="borderless"
                    options={modalSlotOpts}
                  />
                </div>
                {formErrors.startTime && <span style={{ fontSize: 11, color: '#EF4444', marginTop: 4, display: 'block' }}>{formErrors.startTime}</span>}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(241,236,225,.55)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Trạng thái</label>
                <div style={{ border: '1px solid rgba(238,138,51,.25)', borderRadius: 6 }}>
                  <Select
                    value={modalData.status || 'pending'}
                    disabled={readonly}
                    onChange={(val: BookingStatus) => setModalData({ ...modalData, status: val })}
                    style={{ width: '100%' }}
                    variant="borderless"
                    options={statusOpts}
                  />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(241,236,225,.55)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Tổng (₫)</label>
                <input
                  type="text"
                  readOnly
                  value={formatCurrency(modalData.total || 0)}
                  style={{ width: '100%', background: '#0a151f', border: '1px solid rgba(238,138,51,.15)', color: '#EE8A33', padding: '10px 12px', borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 600, outline: 'none', cursor: 'not-allowed' }}
                />
              </div>
            </div>

            {/* Buttons */}
            {readonly ? (
              <button
                onClick={() => { setModalMode(null); setModalData(null); setFormErrors({}); }}
                style={{ width: '100%', background: 'transparent', border: '1px solid rgba(238,138,51,.3)', color: 'rgba(241,236,225,.8)', padding: 12, borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Đóng
              </button>
            ) : (
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                onClick={() => { setModalMode(null); setModalData(null); setOriginalStatus(null); setFormErrors({}); }}
                style={{ flex: 1, background: 'transparent', border: '1px solid rgba(238,138,51,.3)', color: 'rgba(241,236,225,.8)', padding: 12, borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'background .15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(238,138,51,.08)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Huỷ
              </button>
              <button
                onClick={handleSave}
                disabled={submitting}
                style={{ flex: 1, background: '#EE8A33', color: '#0B1620', border: 'none', padding: 12, borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: submitting ? 0.5 : 1, transition: 'opacity .15s' }}
              >
                {submitting ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
            )}
          </div>
          );
        })()}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Xác nhận xoá">
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(168,150,120,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C6B7A0" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/></svg>
          </div>
          <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 21, fontWeight: 700, marginTop: 18, color: '#F1ECE1' }}>Xác nhận xoá</h3>
          <p style={{ fontSize: 14, color: 'rgba(241,236,225,.6)', marginTop: 10, lineHeight: 1.55 }}>
            Bạn có chắc muốn xoá lịch hẹn của <b style={{ color: '#F1ECE1' }}>{deleteTarget?.customerName}</b>? Hành động này không thể hoàn tác.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(238,138,51,.3)', color: 'rgba(241,236,225,.8)', padding: 12, borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Huỷ</button>
            <button onClick={handleDelete} disabled={submitting} style={{ flex: 1, background: '#46505C', color: '#fff', border: 'none', padding: 12, borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: submitting ? 0.5 : 1 }}>
              {submitting ? 'Đang xoá...' : 'Xoá'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Tooltip */}
      {tooltipData && (
        <div style={{
          position: 'fixed', left: tooltipData.x + 12, top: tooltipData.y - 10,
          transform: 'translateY(-100%)', zIndex: 9999,
          background: '#0B1620', border: '1px solid rgba(238,138,51,.25)', borderRadius: 8,
          padding: '10px 14px', minWidth: 220,
          pointerEvents: 'none', boxShadow: '0 8px 32px rgba(0,0,0,.5)',
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#F1ECE1', marginBottom: 4 }}>{tooltipData.b.customerName}</div>
          <div style={{ fontSize: 11, color: 'rgba(241,236,225,.5)', marginBottom: 2 }}>{tooltipData.b.customerPhone}</div>
          <div style={{ fontSize: 11, color: 'rgba(241,236,225,.5)', marginBottom: 2 }}>{tooltipData.b.date} · {tooltipData.timeRange}</div>
          {tooltipData.svcNames && <div style={{ fontSize: 11, color: 'rgba(241,236,225,.5)' }}>{tooltipData.svcNames}</div>}
          <div style={{ fontSize: 11, color: '#EE8A33', marginTop: 4, fontWeight: 600 }}>{formatShort(tooltipData.b.total)}</div>
        </div>
      )}
    </div>
  );
}
