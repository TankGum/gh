'use client';

import { useState, useCallback, useEffect } from 'react';
import type { CSSProperties } from 'react';
import { Select, App, Pagination } from 'antd';
import AdminTable, { ColumnDef } from '@/components/ui/AdminTable';
import { Plus, Pencil, Trash2, Upload, Scissors, Star } from 'lucide-react';
import FilterBar from '@/components/ui/FilterBar';
import Modal from '@/components/ui/Modal';
import { HairService, ServiceCreatePayload, ServiceUpdatePayload, ServiceStatus } from '@/types/service.type';
import { createService, fetchServices, updateService, deleteService, uploadServiceImage, reorderServices } from '@/services/services.api';
import { fetchBranches, type Branch } from '@/services/branches.api';
import { useAuth } from '@/contexts/AuthContext';

const priceFormatter = new Intl.NumberFormat('vi-VN');

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
  };
}

export default function ServiceClient() {
  const { message } = App.useApp();
  const { can } = useAuth();
  const canCreate = can('services', 'create');
  const canEdit = can('services', 'edit');
  const canDelete = can('services', 'delete');

  const [query, setQuery] = useState('');
  const [services, setServices] = useState<HairService[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<HairService | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [formDuration, setFormDuration] = useState(30);
  const [formPrice, setFormPrice] = useState(0);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formIsFeatured, setFormIsFeatured] = useState(false);
  const [formIsAllBranches, setFormIsAllBranches] = useState(true);
  const [formBranchIds, setFormBranchIds] = useState<string[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const [deletingService, setDeletingService] = useState<HairService | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);

  // Chế độ thứ tự thủ công (mặc định, chưa sort theo cột): tải tối đa 100 dịch
  // vụ để kéo-thả sắp xếp toàn danh sách, ẩn phân trang.
  const manualOrder = !sortBy;
  const dragEnabled = manualOrder && !query && canEdit;

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = manualOrder
        ? await fetchServices({ q: query || undefined, page: 1, size: 100 })
        : await fetchServices({ q: query || undefined, page, size: pageSize, sortBy, sortOrder });
      setServices(data.items);
      setTotal(data.total);
    } catch {
      setError('Không tải được danh sách dịch vụ.');
    } finally {
      setLoading(false);
    }
  }, [query, page, pageSize, sortBy, sortOrder, manualOrder]);

  const handleReorder = async (orderedIds: string[]) => {
    const prev = services;
    const byId = new Map(services.map(s => [s.id, s]));
    const reordered = orderedIds.map(id => byId.get(id)).filter((s): s is HairService => !!s);
    setServices(reordered);
    try {
      await reorderServices(orderedIds);
    } catch {
      setServices(prev);
      message.error('Sắp xếp lại thất bại');
    }
  };

  const handleToggleFeatured = async (svc: HairService) => {
    setTogglingId(svc.id);
    try {
      await updateService(svc.id, { isFeatured: !svc.isFeatured });
      setServices(list => list.map(s => (s.id === svc.id ? { ...s, isFeatured: !s.isFeatured } : s)));
    } catch {
      message.error('Cập nhật phổ biến thất bại');
    } finally {
      setTogglingId(null);
    }
  };

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    setBranchesLoading(true);
    fetchBranches({ size: 100 })
      .then(res => setBranches(res.items))
      .catch(() => {})
      .finally(() => setBranchesLoading(false));
  }, []);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const url = await uploadServiceImage(file);
      setFormImageUrl(url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload ảnh thất bại.');
    } finally {
      setUploading(false);
    }
  };

  const openCreate = () => {
    setEditingService(null);
    setFormName('');
    setFormDescription('');
    setFormImageUrl('');
    setUploadError(null);
    setFormDuration(30);
    setFormPrice(0);
    setFormIsActive(true);
    setFormIsFeatured(false);
    setFormIsAllBranches(true);
    setFormBranchIds([]);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (svc: HairService) => {
    setEditingService(svc);
    setFormName(svc.name);
    setFormDescription(svc.description ?? '');
    setFormImageUrl(svc.imageUrl ?? '');
    setUploadError(null);
    setFormDuration(svc.durationMinutes);
    setFormPrice(svc.price);
    setFormIsActive(svc.status === 'active');
    setFormIsFeatured(svc.isFeatured);
    setFormIsAllBranches(svc.isAllBranches);
    setFormBranchIds(svc.branchIds ?? []);
    setFormErrors({});
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const errs: Record<string, string> = {};
    if (!formName.trim()) errs.name = 'Vui lòng nhập tên dịch vụ';
    if (!formDuration || formDuration < 1) errs.durationMinutes = 'Thời lượng phải ít nhất 1 phút';
    if (formPrice < 0) errs.price = 'Giá không được âm';
    if (!formIsAllBranches && formBranchIds.length === 0) errs.branchIds = 'Vui lòng chọn ít nhất một cửa hàng';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const status: ServiceStatus = formIsActive ? 'active' : 'hidden';
    setSubmitting(true);
    setError(null);
    try {
      if (editingService) {
        const payload: ServiceUpdatePayload = {};
        if (formName !== editingService.name) payload.name = formName;
        if (formDescription !== (editingService.description ?? '')) payload.description = formDescription || null;
        if (formImageUrl !== (editingService.imageUrl ?? '')) payload.imageUrl = formImageUrl || null;
        if (formDuration !== editingService.durationMinutes) payload.durationMinutes = formDuration;
        if (formPrice !== editingService.price) payload.price = formPrice;
        if (status !== editingService.status) payload.status = status;
        if (formIsFeatured !== editingService.isFeatured) payload.isFeatured = formIsFeatured;
        if (formIsAllBranches !== editingService.isAllBranches) payload.isAllBranches = formIsAllBranches;
        if (!formIsAllBranches && formBranchIds.length) payload.branchIds = formBranchIds;
        await updateService(editingService.id, payload);
        message.success('Cập nhật dịch vụ thành công');
      } else {
        const payload: ServiceCreatePayload = {
          name: formName,
          description: formDescription || null,
          imageUrl: formImageUrl || null,
          durationMinutes: formDuration,
          price: formPrice,
          status,
          isFeatured: formIsFeatured,
          isAllBranches: formIsAllBranches,
          branchIds: formIsAllBranches ? undefined : formBranchIds,
        };
        await createService(payload);
        message.success('Tạo dịch vụ thành công');
      }
      setModalOpen(false);
      await refresh();
    } catch (e) {
      if (e instanceof Error) setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingService) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteService(deletingService.id);
      message.success('Xóa dịch vụ thành công');
      setDeletingService(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Xóa dịch vụ thất bại.');
    } finally {
      setDeleting(false);
    }
  };

  const handleSort = (field: string, order: 'asc' | 'desc') => {
    setSortBy(field);
    setSortOrder(order);
    setPage(1);
  };

  const columns: ColumnDef<HairService>[] = [
    {
      key: 'name',
      header: 'Dịch vụ',
      width: '1.6fr',
      sortable: true,
      sortField: 'name',
      render: svc => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: 6, background: '#0B1620', border: '1px solid rgba(238,138,51,.16)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {svc.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={svc.imageUrl} alt={svc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Scissors size={14} style={{ color: 'rgba(241,236,225,0.2)' }} />
            )}
          </div>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#F1ECE1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{svc.name}</span>
          {svc.isFeatured && <Star size={13} fill="#EE8A33" color="#EE8A33" style={{ flexShrink: 0 }} />}
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Mô tả',
      width: '1fr',
      render: svc => <span style={{ fontSize: 13, color: 'rgba(241,236,225,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{svc.description || '—'}</span>,
    },
    {
      key: 'duration',
      header: 'Thời lượng',
      width: '110px',
      sortable: true,
      sortField: 'duration_minutes',
      render: svc => <span style={{ fontSize: 13, color: '#F1ECE1' }}>{svc.durationMinutes} phút</span>,
    },
    {
      key: 'price',
      header: 'Giá',
      width: '130px',
      sortable: true,
      sortField: 'price',
      render: svc => <span style={{ fontSize: 13, fontWeight: 700, color: '#EE8A33' }}>{priceFormatter.format(svc.price)} VND</span>,
    },
    {
      key: 'branches',
      header: 'Cửa hàng',
      width: '160px',
      render: svc => (
        <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: svc.isAllBranches ? 'rgba(63,191,127,0.15)' : 'rgba(238,138,51,0.15)', color: svc.isAllBranches ? '#5FD49A' : '#EE8A33' }}>
          {svc.isAllBranches ? 'Tất cả cửa hàng' : `${svc.branchCount}/${svc.totalBranches} cửa hàng`}
        </span>
      ),
    },
    {
      key: 'featured',
      header: 'Phổ biến',
      width: '90px',
      align: 'center',
      render: svc => (
        <button
          onClick={() => canEdit && handleToggleFeatured(svc)}
          disabled={!canEdit || togglingId === svc.id}
          title={svc.isFeatured ? 'Bỏ đánh dấu phổ biến' : 'Đánh dấu phổ biến'}
          style={{ background: 'none', border: 'none', cursor: canEdit ? 'pointer' : 'default', padding: 4, display: 'inline-flex', opacity: togglingId === svc.id ? 0.5 : 1 }}
        >
          <Star size={16} fill={svc.isFeatured ? '#EE8A33' : 'none'} color={svc.isFeatured ? '#EE8A33' : 'rgba(241,236,225,0.3)'} />
        </button>
      ),
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '110px',
      align: 'center',
      sortable: true,
      sortField: 'status',
      render: svc => (
        <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 11px', borderRadius: 20, background: svc.status === 'active' ? 'rgba(63,191,127,0.15)' : 'rgba(100,116,139,0.15)', color: svc.status === 'active' ? '#5FD49A' : '#94a3b8' }}>
          {svc.status === 'active' ? 'Đang bán' : 'Tạm ẩn'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Thao tác',
      width: '80px',
      align: 'right',
      render: svc => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          {canEdit && (
            <button onClick={() => openEdit(svc)} title="Sửa" className="w-7 h-7 flex items-center justify-center rounded border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
              <Pencil size={13} />
            </button>
          )}
          {canDelete && (
            <button onClick={() => setDeletingService(svc)} title="Xóa" className="w-7 h-7 flex items-center justify-center rounded border border-white/10 bg-white/5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-colors cursor-pointer">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, borderBottom: '1px solid #1e293b', paddingBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0, marginBottom: 4 }}>Dịch vụ</h1>
        </div>
        {canCreate && (
          <button
            onClick={openCreate}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#EE8A33', border: 'none', color: '#0B1620', padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
          >
            <Plus size={15} />
            Thêm mới
          </button>
        )}
      </div>

      {/* Search */}
      <FilterBar onSearch={(v) => { setQuery(v); setPage(1); }} placeholder="Tìm dịch vụ" marginBottom={dragEnabled ? 12 : 24} />

      {dragEnabled && (
        <p style={{ margin: '0 0 16px', fontSize: 12.5, color: 'rgba(241,236,225,.45)' }}>
          Kéo biểu tượng ⣿ để sắp xếp thứ tự hiển thị dịch vụ cho khách. Bấm ngôi sao để đánh dấu dịch vụ phổ biến.
        </p>
      )}
      {!manualOrder && (
        <div style={{ margin: '0 0 16px' }}>
          <button
            onClick={() => { setSortBy(undefined); setPage(1); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'transparent', border: '1px solid rgba(238,138,51,.3)', color: '#EE8A33', padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >
            ↕ Về thứ tự thủ công (kéo-thả)
          </button>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 16, padding: '8px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#f87171', fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Table */}
      <AdminTable
        columns={columns}
        data={services}
        rowKey={svc => svc.id}
        loading={loading}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        draggable={dragEnabled}
        onReorder={handleReorder}
        emptyText="Chưa có dịch vụ nào."
        minWidth={1000}
        pagination={
          manualOrder ? undefined : (
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            pageSizeOptions={[10, 20, 50]}
            showTotal={(t, [s, e]) => `${s}–${e} / ${t} dịch vụ`}
            onChange={(p, ps) => { setPageSize(ps); setPage(ps !== pageSize ? 1 : p); }}
          />
          )
        }
      />

      {/* Create / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingService ? 'Chỉnh sửa dịch vụ' : 'Thêm dịch vụ mới'}
      >
        <div style={{ padding: '8px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Image upload */}
            <div>
              <label style={labelStyle}>Ảnh dịch vụ</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 80, height: 80, borderRadius: 8, background: '#0B1620', border: '1px solid rgba(238,138,51,.16)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {formImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={formImageUrl} alt="service" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <Scissors size={26} style={{ color: 'rgba(241,236,225,0.2)' }} />
                  )}
                </div>
                <div>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: 'pointer', background: 'transparent', border: '1px solid rgba(238,138,51,.3)', color: '#EE8A33', padding: '8px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, fontFamily: "'Hanken Grotesk',sans-serif" }}>
                    <Upload size={14} />
                    {uploading ? 'Đang tải...' : 'Chọn ảnh'}
                    <input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files?.[0])} />
                  </label>
                  {formImageUrl && (
                    <button type="button" onClick={() => setFormImageUrl('')} style={{ marginLeft: 8, background: 'none', border: 'none', color: '#EF4444', fontSize: 12, cursor: 'pointer', fontFamily: "'Hanken Grotesk',sans-serif" }}>
                      Xóa ảnh
                    </button>
                  )}
                  {uploadError && <span style={errStyle}>{uploadError}</span>}
                </div>
              </div>
            </div>

            <div>
              <label style={labelStyle}>Tên dịch vụ *</label>
              <input
                type="text"
                value={formName}
                onChange={e => { setFormName(e.target.value); setFormErrors(p => ({ ...p, name: '' })); }}
                style={fieldStyle(!!formErrors.name)}
                placeholder="VD: Cắt tóc nam"
              />
              {formErrors.name && <span style={errStyle}>{formErrors.name}</span>}
            </div>

            <div>
              <label style={labelStyle}>Mô tả</label>
              <textarea
                value={formDescription}
                onChange={e => setFormDescription(e.target.value)}
                rows={3}
                style={{ ...fieldStyle(false), resize: 'vertical' }}
                placeholder="Mô tả ngắn về dịch vụ..."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Thời lượng (phút) *</label>
                <input
                  type="number"
                  min={1}
                  value={formDuration}
                  onChange={e => { setFormDuration(Number(e.target.value)); setFormErrors(p => ({ ...p, durationMinutes: '' })); }}
                  style={fieldStyle(!!formErrors.durationMinutes)}
                />
                {formErrors.durationMinutes && <span style={errStyle}>{formErrors.durationMinutes}</span>}
              </div>
              <div>
                <label style={labelStyle}>Giá (VNĐ) *</label>
                <input
                  type="number"
                  min={0}
                  value={formPrice}
                  onChange={e => { setFormPrice(Number(e.target.value)); setFormErrors(p => ({ ...p, price: '' })); }}
                  style={fieldStyle(!!formErrors.price)}
                />
                {formErrors.price && <span style={errStyle}>{formErrors.price}</span>}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                onClick={() => setFormIsActive(v => !v)}
                style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: formIsActive ? '#EE8A33' : 'rgba(241,236,225,.15)', position: 'relative', flexShrink: 0, transition: 'background .2s' }}
              >
                <span style={{ position: 'absolute', top: 3, left: formIsActive ? 20 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
              </button>
              <span style={{ fontSize: 13, color: 'rgba(241,236,225,.8)', fontWeight: 600 }}>
                {formIsActive ? 'Đang bán' : 'Tạm ẩn'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                onClick={() => setFormIsFeatured(v => !v)}
                style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: formIsFeatured ? '#EE8A33' : 'rgba(241,236,225,.15)', position: 'relative', flexShrink: 0, transition: 'background .2s' }}
              >
                <span style={{ position: 'absolute', top: 3, left: formIsFeatured ? 20 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
              </button>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'rgba(241,236,225,.8)', fontWeight: 600 }}>
                <Star size={14} fill={formIsFeatured ? '#EE8A33' : 'none'} color={formIsFeatured ? '#EE8A33' : 'rgba(241,236,225,0.5)'} />
                Dịch vụ phổ biến
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                onClick={() => setFormIsAllBranches(v => !v)}
                style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: formIsAllBranches ? '#EE8A33' : 'rgba(241,236,225,.15)', position: 'relative', flexShrink: 0, transition: 'background .2s' }}
              >
                <span style={{ position: 'absolute', top: 3, left: formIsAllBranches ? 20 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s' }} />
              </button>
              <span style={{ fontSize: 13, color: 'rgba(241,236,225,.8)', fontWeight: 600 }}>Áp dụng cho tất cả cửa hàng</span>
            </div>

            {!formIsAllBranches && (
              <div>
                <label style={labelStyle}>Chọn cửa hàng *</label>
                <div style={{ border: `1px solid ${formErrors.branchIds ? '#EF4444' : 'rgba(238,138,51,.25)'}`, borderRadius: 6 }}>
                  <Select
                    mode="multiple"
                    size="large"
                    variant="borderless"
                    value={formBranchIds}
                    onChange={(ids: string[]) => { setFormBranchIds(ids); setFormErrors(p => ({ ...p, branchIds: '' })); }}
                    style={{ width: '100%' }}
                    placeholder="Chọn cửa hàng..."
                    loading={branchesLoading}
                    options={branches.map(b => ({ label: b.name, value: b.id }))}
                    filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                  />
                </div>
                {formErrors.branchIds && <span style={errStyle}>{formErrors.branchIds}</span>}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, paddingTop: 4 }}>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{ flex: 1, background: 'transparent', border: '1px solid rgba(238,138,51,.3)', color: 'rgba(241,236,225,.8)', padding: 12, borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || uploading}
                style={{ flex: 1, background: '#EE8A33', color: '#0B1620', border: 'none', padding: 12, borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (submitting || uploading) ? 0.5 : 1 }}
              >
                {submitting ? 'Đang lưu...' : (editingService ? 'Lưu thay đổi' : 'Tạo dịch vụ')}
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deletingService} onClose={() => setDeletingService(null)} title="Xác nhận xoá">
        {deletingService && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(168,150,120,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C6B7A0" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/></svg>
            </div>
            <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 21, fontWeight: 700, marginTop: 18, color: '#F1ECE1' }}>Xác nhận xoá</h3>
            <p style={{ fontSize: 14, color: 'rgba(241,236,225,.6)', marginTop: 10, lineHeight: 1.55 }}>
              Bạn có chắc muốn xoá dịch vụ <b style={{ color: '#F1ECE1' }}>{deletingService.name}</b>? Hành động này không thể hoàn tác.
            </p>
            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button onClick={() => setDeletingService(null)} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(238,138,51,.3)', color: 'rgba(241,236,225,.8)', padding: 12, borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Huỷ</button>
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
