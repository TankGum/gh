'use client';

import { useState, useCallback, useEffect } from 'react';
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

function BranchForm({
  form,
  onChange,
  onSubmit,
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

  const inputCls = (key: string) =>
    `w-full bg-[#161e31] border ${errors?.[key] ? 'border-red-500' : 'border-slate-700/50'} rounded-md px-3 py-2 text-white text-sm focus:outline-none focus:border-orange-500`;

  const change = (key: string, patch: Partial<BranchFormState>) => {
    onClearError?.(key);
    onChange(patch);
  };

  const Err = ({ k }: { k: string }) =>
    errors?.[k] ? <p className="text-xs text-red-400 mt-1">{errors[k]}</p> : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-4"
    >
      {/* Image upload */}
      <div>
        <label className="block text-sm text-slate-400 mb-1">Ảnh chi nhánh</label>
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-md bg-[#161e31] border border-slate-700/50 overflow-hidden flex items-center justify-center shrink-0">
            {form.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.imageUrl} alt="branch" className="w-full h-full object-cover" />
            ) : (
              <Store size={28} className="text-slate-600" />
            )}
          </div>
          <div className="flex-1">
            <label className="inline-flex items-center gap-2 cursor-pointer bg-[#161e31] border border-slate-700/50 hover:bg-slate-800 text-slate-300 px-3 py-2 rounded-md text-sm transition-colors">
              <Upload size={16} />
              {uploading ? 'Đang tải...' : 'Chọn ảnh'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
            </label>
            {form.imageUrl && (
              <button
                type="button"
                onClick={() => onChange({ imageUrl: '' })}
                className="ml-2 text-xs text-red-400 hover:text-red-300"
              >
                Xóa ảnh
              </button>
            )}
            {uploadError && <p className="text-xs text-red-400 mt-1">{uploadError}</p>}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-1">Tên chi nhánh *</label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => change('name', { name: e.target.value })}
          className={inputCls('name')}
          placeholder="VD: Saigon Centre"
        />
        <Err k="name" />
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-1">Địa chỉ *</label>
        <input
          type="text"
          value={form.address}
          onChange={(e) => change('address', { address: e.target.value })}
          className={inputCls('address')}
          placeholder="VD: 65 Lê Lợi, Quận 1"
        />
        <Err k="address" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Vĩ độ (latitude) *</label>
          <input
            type="number"
            step="any"
            value={form.latitude}
            onChange={(e) => change('latitude', { latitude: e.target.value })}
            className={inputCls('latitude')}
            placeholder="VD: 10.7769"
          />
          <Err k="latitude" />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Kinh độ (longitude) *</label>
          <input
            type="number"
            step="any"
            value={form.longitude}
            onChange={(e) => change('longitude', { longitude: e.target.value })}
            className={inputCls('longitude')}
            placeholder="VD: 106.7009"
          />
          <Err k="longitude" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Giờ mở cửa *</label>
          <input
            type="time"
            value={form.openingTime}
            onChange={(e) => change('openingTime', { openingTime: e.target.value })}
            className={inputCls('openingTime')}
          />
          <Err k="openingTime" />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Giờ đóng cửa *</label>
          <input
            type="time"
            value={form.closingTime}
            onChange={(e) => change('closingTime', { closingTime: e.target.value })}
            className={inputCls('closingTime')}
          />
          <Err k="closingTime" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-slate-400 mb-1">Đánh giá (0-5)</label>
          <input
            type="number"
            min={0}
            max={5}
            step="0.1"
            value={form.rating}
            onChange={(e) => change('rating', { rating: e.target.value })}
            className={inputCls('rating')}
          />
          <Err k="rating" />
        </div>
        <div>
          <label className="block text-sm text-slate-400 mb-1">Số ghế *</label>
          <input
            type="number"
            min={0}
            value={form.seatCount}
            onChange={(e) => change('seatCount', { seatCount: e.target.value })}
            className={inputCls('seatCount')}
          />
          <Err k="seatCount" />
        </div>
      </div>

      {(readonlyBarberCount !== undefined || readonlyMonthlyRevenue !== undefined) && (
        <div className="grid grid-cols-2 gap-4 rounded-md bg-[#0d1424] border border-slate-700/50 p-3">
          {readonlyBarberCount !== undefined && (
            <div>
              <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                <Scissors size={12} /> Số barber (tự động)
              </div>
              <div className="text-white font-medium">{readonlyBarberCount}</div>
            </div>
          )}
          {readonlyMonthlyRevenue !== undefined && (
            <div>
              <div className="text-xs text-slate-500 mb-1">Doanh thu tháng (tự động)</div>
              <div className="font-medium" style={{ color: '#ee8a33' }}>
                {readonlyMonthlyRevenue.toLocaleString('vi-VN')} ₫
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <label className="block text-sm text-slate-400 mb-1">Trạng thái hoạt động</label>
        <select
          value={form.status}
          onChange={(e) => onChange({ status: e.target.value as BranchStatus })}
          className={inputCls}
        >
          <option value="open">Đang mở</option>
          <option value="coming_soon">Sắp mở</option>
          <option value="closed">Đóng cửa</option>
        </select>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={submitting || uploading}
           style={{ background: '#ee8a33' }}
           className="text-white px-5 py-2 rounded-md text-sm font-medium transition-colors"
        >
          {submitting ? 'Đang xử lý...' : submitLabel}
        </button>
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
              {branch.monthlyRevenue >= 1_000_000
                ? `${(branch.monthlyRevenue / 1_000_000).toFixed(1)}tr`
                : branch.monthlyRevenue >= 1_000
                  ? `${(branch.monthlyRevenue / 1_000).toFixed(0)}k`
                  : branch.monthlyRevenue.toLocaleString('vi-VN')}
              ₫
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
        <div className="mb-6 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
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
      <Modal
        open={!!deletingBranch}
        onClose={() => setDeletingBranch(null)}
        title="Xác nhận xóa"
      >
        {deletingBranch && (
          <div className="space-y-4">
            <p className="text-sm text-slate-300">
              Bạn có chắc muốn xóa chi nhánh{' '}
              <span className="font-bold text-white">{deletingBranch.name}</span>?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeletingBranch(null)}
                className="px-4 py-2 rounded-md text-sm font-medium text-slate-300 bg-[#161e31] border border-slate-700/50 hover:bg-slate-800 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {deleting ? 'Đang xóa...' : 'Xóa'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
