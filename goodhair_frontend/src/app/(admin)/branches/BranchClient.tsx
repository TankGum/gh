'use client';

import { useState, useCallback, useEffect } from 'react';
import type { CSSProperties } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Store,
  Star,
  Scissors,
  Armchair,
  Clock,
  MapPin,
  Upload,
} from 'lucide-react';
import FilterBar from '@/components/ui/FilterBar';
import { useAuth } from '@/contexts/AuthContext';
import {
  Branch,
  BranchCreatePayload,
  BranchStatus,
  BranchUpdatePayload,
} from '@/types/branch.type';
import {
  createBranch,
  deleteBranch,
  fetchBranches,
  updateBranch,
  uploadBranchImage,
} from '@/services/branches.api';
import Modal from '@/components/ui/Modal';
import { Select } from 'antd';

const STATUS_META: Record<BranchStatus, { label: string; className: string }> = {
  open: { label: 'Đang mở', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  coming_soon: { label: 'Sắp mở', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  closed: { label: 'Đóng cửa', className: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
};

function timeToInput(value: string | null): string {
  return value ? value.slice(0, 5) : '';
}

function inputToTime(value: string): string | null {
  if (!value) return null;
  return value.length === 5 ? `${value}:00` : value;
}

function hoursLabel(b: Branch): string {
  if (!b.openingTime || !b.closingTime) return 'Chưa đặt giờ';
  return `${timeToInput(b.openingTime)} - ${timeToInput(b.closingTime)}`;
}

// ─── Form ─────────────────────────────────────────────────────────

interface BranchFormState {
  name: string;
  address: string;
  imageUrl: string;
  latitude: string;
  longitude: string;
  openingTime: string;
  closingTime: string;
  rating: string;
  seatCount: string;
  status: BranchStatus;
}

const emptyForm: BranchFormState = {
  name: '',
  address: '',
  imageUrl: '',
  latitude: '',
  longitude: '',
  openingTime: '09:00',
  closingTime: '22:00',
  rating: '0',
  seatCount: '0',
  status: 'open',
};

const labelStyle: CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: 'rgba(241,236,225,.55)',
  marginBottom: 5,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
};

const errStyle: CSSProperties = {
  fontSize: 11,
  color: '#EF4444',
  marginTop: 4,
  display: 'block',
};

function fieldStyle(hasError?: boolean): CSSProperties {
  return {
    width: '100%',
    background: '#0B1620',
    border: `1px solid ${hasError ? '#EF4444' : 'rgba(238,138,51,.25)'}`,
    color: '#F1ECE1',
    padding: '10px 12px',
    borderRadius: 6,
    fontSize: 13,
    outline: 'none',
    fontFamily: "'Hanken Grotesk',sans-serif",
    colorScheme: 'dark',
  };
}

function BranchForm({
  form,
  onChange,
  onSubmit,
  onCancel,
  submitting,
  submitLabel,
  readonlyBarberCount,
  readonlyMonthlyRevenue,
  errors,
  onClearError,
}: {
  form: BranchFormState;
  onChange: (patch: Partial<BranchFormState>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitting: boolean;
  submitLabel: string;
  readonlyBarberCount?: number;
  readonlyMonthlyRevenue?: number;
  errors?: Record<string, string>;
  onClearError?: (key: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadBranchImage(file);
      onChange({ imageUrl: url });
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload ảnh thất bại.');
    } finally {
      setUploading(false);
    }
  };

  const change = (key: string, patch: Partial<BranchFormState>) => {
    onClearError?.(key);
    onChange(patch);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Image upload */}
        <div>
          <label style={labelStyle}>Ảnh chi nhánh</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 80, height: 80, borderRadius: 8, background: '#0B1620', border: '1px solid rgba(238,138,51,.16)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {form.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.imageUrl} alt="branch" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <Store size={26} style={{ color: 'rgba(241,236,225,0.2)' }} />
              )}
            </div>
            <div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(238,138,51,.3)', color: '#EE8A33', padding: '8px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, fontFamily: "'Hanken Grotesk',sans-serif" }}>
                <Upload size={14} />
                {uploading ? 'Đang tải...' : 'Chọn ảnh'}
                <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files?.[0])} />
              </label>
              {form.imageUrl && (
                <button type="button" onClick={() => onChange({ imageUrl: '' })} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#EF4444', fontSize: 12, cursor: 'pointer', fontFamily: "'Hanken Grotesk',sans-serif" }}>
                  Xóa ảnh
                </button>
              )}
              {uploadError && <span style={errStyle}>{uploadError}</span>}
            </div>
          </div>
        </div>

        <div>
          <label style={labelStyle}>Tên chi nhánh *</label>
          <input type="text" value={form.name} onChange={(e) => change('name', { name: e.target.value })} style={fieldStyle(!!errors?.name)} placeholder="VD: Saigon Centre" />
          {errors?.name && <span style={errStyle}>{errors.name}</span>}
        </div>

        <div>
          <label style={labelStyle}>Địa chỉ *</label>
          <input type="text" value={form.address} onChange={(e) => change('address', { address: e.target.value })} style={fieldStyle(!!errors?.address)} placeholder="VD: 65 Lê Lợi, Quận 1" />
          {errors?.address && <span style={errStyle}>{errors.address}</span>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Vĩ độ *</label>
            <input type="number" step="any" value={form.latitude} onChange={(e) => change('latitude', { latitude: e.target.value })} style={fieldStyle(!!errors?.latitude)} placeholder="10.7769" />
            {errors?.latitude && <span style={errStyle}>{errors.latitude}</span>}
          </div>
          <div>
            <label style={labelStyle}>Kinh độ *</label>
            <input type="number" step="any" value={form.longitude} onChange={(e) => change('longitude', { longitude: e.target.value })} style={fieldStyle(!!errors?.longitude)} placeholder="106.7009" />
            {errors?.longitude && <span style={errStyle}>{errors.longitude}</span>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Giờ mở cửa *</label>
            <input type="time" value={form.openingTime} onChange={(e) => change('openingTime', { openingTime: e.target.value })} style={fieldStyle(!!errors?.openingTime)} />
            {errors?.openingTime && <span style={errStyle}>{errors.openingTime}</span>}
          </div>
          <div>
            <label style={labelStyle}>Giờ đóng cửa *</label>
            <input type="time" value={form.closingTime} onChange={(e) => change('closingTime', { closingTime: e.target.value })} style={fieldStyle(!!errors?.closingTime)} />
            {errors?.closingTime && <span style={errStyle}>{errors.closingTime}</span>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>Đánh giá (0–5)</label>
            <input type="number" min={0} max={5} step="0.1" value={form.rating} onChange={(e) => change('rating', { rating: e.target.value })} style={fieldStyle(!!errors?.rating)} />
            {errors?.rating && <span style={errStyle}>{errors.rating}</span>}
          </div>
          <div>
            <label style={labelStyle}>Số ghế *</label>
            <input type="number" min={0} value={form.seatCount} onChange={(e) => change('seatCount', { seatCount: e.target.value })} style={fieldStyle(!!errors?.seatCount)} />
            {errors?.seatCount && <span style={errStyle}>{errors.seatCount}</span>}
          </div>
        </div>

        {(readonlyBarberCount !== undefined || readonlyMonthlyRevenue !== undefined) && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'rgba(241,236,225,.04)', border: '1px solid rgba(238,138,51,.1)', borderRadius: 6, padding: '12px 14px' }}>
            {readonlyBarberCount !== undefined && (
              <div>
                <div style={{ fontSize: 11, color: 'rgba(241,236,225,.5)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Scissors size={12} /> Số barber (tự động)
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#F1ECE1' }}>{readonlyBarberCount}</div>
              </div>
            )}
            {readonlyMonthlyRevenue !== undefined && (
              <div>
                <div style={{ fontSize: 11, color: 'rgba(241,236,225,.5)', marginBottom: 4 }}>Doanh thu tháng (tự động)</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#EE8A33' }}>{new Intl.NumberFormat('vi-VN').format(readonlyMonthlyRevenue)} VND</div>
              </div>
            )}
          </div>
        )}

        <div>
          <label style={labelStyle}>Trạng thái hoạt động</label>
          <div style={{ border: '1px solid rgba(238,138,51,.25)', borderRadius: 6 }}>
            <Select
              value={form.status}
              onChange={(val: BranchStatus) => onChange({ status: val })}
              style={{ width: '100%' }}
              variant="borderless"
              options={[
                { label: 'Đang mở', value: 'open' },
                { label: 'Sắp mở', value: 'coming_soon' },
                { label: 'Đóng cửa', value: 'closed' },
              ]}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, paddingTop: 4 }}>
          <button type="button" onClick={onCancel} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(238,138,51,.3)', color: 'rgba(241,236,225,.8)', padding: 12, borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Huỷ
          </button>
          <button type="submit" disabled={submitting || uploading} style={{ flex: 1, background: '#EE8A33', color: '#0B1620', border: 'none', padding: 12, borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (submitting || uploading) ? 0.5 : 1 }}>
            {submitting ? 'Đang xử lý...' : submitLabel}
          </button>
        </div>
      </div>
    </form>
  );
}

// ─── Card ─────────────────────────────────────────────────────────

function BranchCard({
  branch,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: {
  branch: Branch;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const status = STATUS_META[branch.status];
  return (
    <div className="bg-[#0d1424] border border-slate-800 rounded-lg overflow-hidden flex flex-col">
      <div className="relative h-32 bg-[#161e31] flex items-center justify-center">
        {branch.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={branch.imageUrl} alt={branch.name} className="w-full h-full object-cover" />
        ) : (
          <Store size={36} className="text-slate-700" />
        )}
        <span
          className={`absolute top-2 right-2 text-[11px] px-2 py-0.5 rounded-full border ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      <div className="p-4 flex flex-col gap-3 flex-1">
        <div>
          <h3 className="font-bold text-white">{branch.name}</h3>
          <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
            <MapPin size={12} className="shrink-0" />
            <span className="truncate">{branch.address ?? 'Chưa có địa chỉ'}</span>
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold" style={{ color: '#ee8a33' }}>
              {new Intl.NumberFormat('vi-VN').format(branch.monthlyRevenue)} VND
            </div>
            <div className="text-[11px] text-slate-500">Doanh thu tháng này</div>
          </div>
          <div className="flex items-center gap-1 text-amber-400 text-sm font-medium">
            <Star size={14} className="fill-amber-400" />
            {branch.rating.toFixed(1)}
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-slate-400 border-t border-slate-800 pt-3">
          <span className="flex items-center gap-1">
            <Scissors size={13} /> {branch.barberCount} barber
          </span>
          <span className="flex items-center gap-1">
            <Armchair size={13} /> {branch.seatCount} ghế
          </span>
        </div>

        <div className="flex items-center justify-between mt-auto pt-1">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Clock size={13} /> {hoursLabel(branch)}
          </span>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={onEdit}
                title="Sửa"
                className="w-7 h-7 flex items-center justify-center rounded border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <Pencil size={13} />
              </button>
            )}
            {canDelete && (
              <button
                onClick={onDelete}
                title="Xóa"
                className="w-7 h-7 flex items-center justify-center rounded border border-white/10 bg-white/5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-colors cursor-pointer"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────

export default function BranchClient() {
  const { can } = useAuth();
  const canCreate = can('branches', 'create');
  const canEdit = can('branches', 'edit');
  const canDelete = can('branches', 'delete');

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchBranches({ q: query || undefined });
      setBranches(data.items);
    } catch {
      setError('Không tải được danh sách chi nhánh.');
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<BranchFormState>(emptyForm);
  const [creating, setCreating] = useState(false);
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

  const [editing, setEditing] = useState<Branch | null>(null);
  const [editForm, setEditForm] = useState<BranchFormState>(emptyForm);
  const [updating, setUpdating] = useState(false);
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});

  const [deletingBranch, setDeletingBranch] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);

  const buildPayload = (form: BranchFormState): BranchCreatePayload => ({
    name: form.name,
    address: form.address || null,
    imageUrl: form.imageUrl || null,
    latitude: form.latitude ? Number(form.latitude) : null,
    longitude: form.longitude ? Number(form.longitude) : null,
    openingTime: inputToTime(form.openingTime),
    closingTime: inputToTime(form.closingTime),
    rating: Number(form.rating),
    seatCount: Number(form.seatCount),
    status: form.status,
  });

  const openEdit = (b: Branch) => {
    setEditErrors({});
    setEditing(b);
    setEditForm({
      name: b.name,
      address: b.address ?? '',
      imageUrl: b.imageUrl ?? '',
      latitude: b.latitude ? String(b.latitude) : '',
      longitude: b.longitude ? String(b.longitude) : '',
      openingTime: timeToInput(b.openingTime) || '09:00',
      closingTime: timeToInput(b.closingTime) || '22:00',
      rating: String(b.rating),
      seatCount: String(b.seatCount),
      status: b.status,
    });
  };

  const validateBranch = (form: BranchFormState): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (!form.name.trim()) errs.name = 'Vui lòng nhập tên chi nhánh';
    if (!form.address.trim()) errs.address = 'Vui lòng nhập địa chỉ';
    if (!form.latitude.trim()) errs.latitude = 'Vui lòng nhập vĩ độ';
    if (!form.longitude.trim()) errs.longitude = 'Vui lòng nhập kinh độ';
    if (!form.openingTime) errs.openingTime = 'Vui lòng nhập giờ mở cửa';
    if (!form.closingTime) errs.closingTime = 'Vui lòng nhập giờ đóng cửa';
    if (!form.seatCount || Number(form.seatCount) <= 0) errs.seatCount = 'Số ghế phải lớn hơn 0';
    if (form.rating && (Number(form.rating) < 0 || Number(form.rating) > 5)) errs.rating = 'Đánh giá từ 0-5';
    return errs;
  };

  const handleCreate = async () => {
    const errs = validateBranch(createForm);
    setCreateErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setCreating(true);
    setError(null);
    try {
      await createBranch(buildPayload(createForm));
      setShowCreate(false);
      setCreateForm(emptyForm);
      setCreateErrors({});
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tạo chi nhánh thất bại.');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async () => {
    if (!editing) return;
    const errs = validateBranch(editForm);
    setEditErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setUpdating(true);
    setError(null);
    try {
      const payload: BranchUpdatePayload = buildPayload(editForm);
      await updateBranch(editing.id, payload);
      setEditing(null);
      setEditErrors({});
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cập nhật chi nhánh thất bại.');
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingBranch) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteBranch(deletingBranch.id);
      setDeletingBranch(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xóa chi nhánh thất bại.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Chi nhánh</h1>
        </div>
        {canCreate && (
          <button
            onClick={() => { setCreateForm(emptyForm); setCreateErrors({}); setShowCreate(true); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#EE8A33', border: 'none', color: '#0B1620', padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            <Plus size={15} />
            Thêm mới
          </button>
        )}
      </div>

      {/* Search */}
      <FilterBar onSearch={setQuery} placeholder="Tìm chi nhánh" marginBottom={24} />

      {error && (
        <div style={{ marginBottom: 16, padding: '8px 16px', background: 'rgba(239,68,68,.1)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 6, color: '#f87171', fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <p className="text-slate-500 text-sm py-10 text-center">Đang tải...</p>
      ) : branches.length === 0 ? (
        <p className="text-slate-500 text-sm py-10 text-center">Chưa có chi nhánh nào.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {branches.map((b) => (
            <BranchCard
              key={b.id}
              branch={b}
              onEdit={() => openEdit(b)}
              onDelete={() => setDeletingBranch(b)}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); setCreateErrors({}); }} title="Thêm chi nhánh">
        <BranchForm
          form={createForm}
          onChange={(patch) => setCreateForm((prev) => ({ ...prev, ...patch }))}
          onSubmit={handleCreate}
          onCancel={() => { setShowCreate(false); setCreateErrors({}); }}
          submitting={creating}
          submitLabel="Thêm mới"
          errors={createErrors}
          onClearError={(key) => setCreateErrors(prev => ({ ...prev, [key]: '' }))}
        />
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editing} onClose={() => { setEditing(null); setEditErrors({}); }} title="Chỉnh sửa chi nhánh">
        {editing && (
          <BranchForm
            form={editForm}
            onChange={(patch) => setEditForm((prev) => ({ ...prev, ...patch }))}
            onSubmit={handleUpdate}
            onCancel={() => { setEditing(null); setEditErrors({}); }}
            submitting={updating}
            submitLabel="Lưu thay đổi"
            readonlyBarberCount={editing.barberCount}
            readonlyMonthlyRevenue={editing.monthlyRevenue}
            errors={editErrors}
            onClearError={(key) => setEditErrors(prev => ({ ...prev, [key]: '' }))}
          />
        )}
      </Modal>

      {/* Delete Confirmation */}
      <Modal open={!!deletingBranch} onClose={() => setDeletingBranch(null)} title="Xác nhận xoá">
        {deletingBranch && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(168,150,120,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C6B7A0" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/></svg>
            </div>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 21, fontWeight: 700, marginTop: 18, color: '#F1ECE1' }}>Xác nhận xoá</h3>
            <p style={{ fontSize: 14, color: 'rgba(241,236,225,.6)', marginTop: 10, lineHeight: 1.55 }}>
              Bạn có chắc muốn xoá chi nhánh <b style={{ color: '#F1ECE1' }}>{deletingBranch.name}</b>? Hành động này không thể hoàn tác.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={() => setDeletingBranch(null)} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(238,138,51,.3)', color: 'rgba(241,236,225,.8)', padding: 12, borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Huỷ</button>
              <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, background: '#46505C', color: '#fff', border: 'none', padding: 12, borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: deleting ? 0.5 : 1 }}>
                {deleting ? 'Đang xoá...' : 'Xoá'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
