'use client';

import { useState, useCallback, useEffect } from 'react';
import { Modal, Form, Input, InputNumber, Switch, Select, App, Space, Pagination } from 'antd';
import AdminTable, { ColumnDef } from '@/components/ui/AdminTable';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import FilterBar from '@/components/ui/FilterBar';
import { HairService, ServiceCreatePayload, ServiceUpdatePayload, ServiceStatus } from '@/types/service.type';
import { createService, fetchServices, updateService, deleteService } from '@/services/services.api';
import { fetchBranches, type Branch } from '@/services/branches.api';
import { useAuth } from '@/contexts/AuthContext';

const priceFormatter = new Intl.NumberFormat('vi-VN');

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

  // Create / Edit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<HairService | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // Delete modal
  const [deletingService, setDeletingService] = useState<HairService | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchServices({ q: query || undefined, page, size: pageSize, sortBy, sortOrder });
      setServices(data.items);
      setTotal(data.total);
    } catch {
      setError('Không tải được danh sách dịch vụ.');
    } finally {
      setLoading(false);
    }
  }, [query, page, pageSize, sortBy, sortOrder]);

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

  const openCreate = () => {
    setEditingService(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true, isAllBranches: true, durationMinutes: 30, price: 0 });
    setModalOpen(true);
  };

  const openEdit = (svc: HairService) => {
    setEditingService(svc);
    form.setFieldsValue({
      name: svc.name,
      description: svc.description,
      durationMinutes: svc.durationMinutes,
      price: svc.price,
      isActive: svc.status === 'active',
      isAllBranches: svc.isAllBranches,
      branchIds: svc.branchIds,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const status: ServiceStatus = values.isActive ? 'active' : 'hidden';
      setSubmitting(true);
      setError(null);

      if (editingService) {
        const payload: ServiceUpdatePayload = {};
        if (values.name !== editingService.name) payload.name = values.name;
        if (values.description !== (editingService.description ?? '')) payload.description = values.description || null;
        if (Number(values.durationMinutes) !== editingService.durationMinutes) payload.durationMinutes = values.durationMinutes;
        if (Number(values.price) !== editingService.price) payload.price = values.price;
        if (status !== editingService.status) payload.status = status;
        if (values.isAllBranches !== editingService.isAllBranches) payload.isAllBranches = values.isAllBranches;
        if (!values.isAllBranches && values.branchIds?.length) payload.branchIds = values.branchIds;
        await updateService(editingService.id, payload);
        message.success('Cập nhật dịch vụ thành công');
      } else {
        const payload: ServiceCreatePayload = {
          name: values.name,
          description: values.description || null,
          durationMinutes: values.durationMinutes,
          price: values.price,
          status,
          isAllBranches: values.isAllBranches,
          branchIds: values.isAllBranches ? undefined : values.branchIds,
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
      render: svc => <span style={{ fontSize: 13.5, fontWeight: 700, color: '#F1ECE1' }}>{svc.name}</span>,
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
      render: svc => <span style={{ fontSize: 13, fontWeight: 700, color: '#EE8A33' }}>{priceFormatter.format(svc.price)}đ</span>,
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
      <FilterBar onSearch={(v) => { setQuery(v); setPage(1); }} placeholder="Tìm dịch vụ" marginBottom={24} />

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
        emptyText="Chưa có dịch vụ nào."
        minWidth={860}
        pagination={
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            pageSizeOptions={[10, 20, 50]}
            showTotal={(t, [s, e]) => `${s}–${e} / ${t} dịch vụ`}
            onChange={(p, ps) => { setPageSize(ps); setPage(ps !== pageSize ? 1 : p); }}
          />
        }
      />

      {/* Create / Edit Modal */}
      <Modal
        title={editingService ? 'Chỉnh sửa dịch vụ' : 'Thêm dịch vụ mới'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        okText={editingService ? 'Lưu thay đổi' : 'Tạo dịch vụ'}
        cancelText="Hủy"
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Tên dịch vụ" rules={[{ required: true, message: 'Vui lòng nhập tên dịch vụ' }]}>
            <Input placeholder="VD: Cắt tóc nam" />
          </Form.Item>

          <Form.Item name="description" label="Mô tả">
            <Input.TextArea rows={3} placeholder="Mô tả ngắn về dịch vụ..." />
          </Form.Item>

          <Space style={{ width: '100%' }} size={16}>
            <Form.Item name="durationMinutes" label="Thời lượng (phút)" rules={[{ required: true }]} style={{ flex: 1 }}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="price" label="Giá (VNĐ)" rules={[{ required: true }]} style={{ flex: 1 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Space>

          <Form.Item name="isActive" label="Trạng thái" valuePropName="checked">
            <Switch checkedChildren="Đang bán" unCheckedChildren="Tạm ẩn" />
          </Form.Item>

          <Form.Item name="isAllBranches" label="Áp dụng cho tất cả cửa hàng" valuePropName="checked">
            <Switch checkedChildren="Có" unCheckedChildren="Không" />
          </Form.Item>

          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.isAllBranches !== cur.isAllBranches}>
            {({ getFieldValue }) =>
              !getFieldValue('isAllBranches') ? (
                <Form.Item name="branchIds" label="Chọn cửa hàng" rules={[{ required: true, message: 'Vui lòng chọn ít nhất một cửa hàng' }]}>
                  <Select
                    mode="multiple"
                    placeholder="Chọn cửa hàng..."
                    loading={branchesLoading}
                    options={branches.map(b => ({ label: b.name, value: b.id }))}
                    filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>

      {/* Delete confirmation */}
      <Modal
        title="Xác nhận xóa"
        open={!!deletingService}
        onCancel={() => setDeletingService(null)}
        onOk={handleDelete}
        confirmLoading={deleting}
        okText="Xóa"
        cancelText="Hủy"
        okButtonProps={{ danger: true }}
      >
        <p style={{ color: '#cbd5e1' }}>
          Bạn có chắc muốn xóa dịch vụ <strong style={{ color: '#fff' }}>{deletingService?.name}</strong>?
        </p>
      </Modal>
    </>
  );
}
