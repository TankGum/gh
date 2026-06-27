'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Select, App, Pagination } from 'antd';
import { Trash2, Pencil, Upload } from 'lucide-react';
import FilterBar from '@/components/ui/FilterBar';
import { fetchEmployees, updateEmployee, deleteEmployee, uploadEmployeeImage } from '@/services/employees.api';
import { fetchBranches } from '@/services/branches.api';
import { fetchRoles } from '@/services/roles.api';
import type { Employee, EmploymentStatus } from '@/types/employee.type';
import type { Role } from '@/types/role.type';
import type { Branch } from '@/types/branch.type';
import Modal from '@/components/ui/Modal';
import AdminTable, { ColumnDef } from '@/components/ui/AdminTable';
import { useAuth } from '@/contexts/AuthContext';

const statusLabels: Record<EmploymentStatus, { label: string; color: string; bg: string }> = {
  active: { label: 'Đang làm', color: '#5FD49A', bg: 'rgba(63,191,127,0.15)' },
  inactive: { label: 'Đã nghỉ', color: '#F87171', bg: 'rgba(248,113,113,0.15)' },
};

export default function EmployeesClient() {
  const { message } = App.useApp();
  const { can } = useAuth();
  const canEdit = can('staff', 'edit');
  const canDelete = can('staff', 'delete');

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);
  const [editTarget, setEditTarget] = useState<Employee | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortBy, setSortBy] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Load branches and roles once on mount
  useEffect(() => {
    Promise.all([
      fetchBranches({ size: 100 }).catch(() => ({ items: [] as Branch[], total: 0, page: 1, size: 100 })),
      fetchRoles({ size: 100 }).catch(() => ({ items: [] as Role[], total: 0, page: 1, size: 100 })),
    ]).then(([branchData, roleData]) => {
      setBranches(branchData.items);
      setRoles(roleData.items);
    });
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const empData = await fetchEmployees({ page, size: pageSize, sortBy, sortOrder });
      setEmployees(empData.items);
      setTotal(empData.total);
    } catch {
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, sortBy, sortOrder]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await deleteEmployee(deleteTarget.id);
      message.success('Xoá nhân viên thành công');
      setDeleteTarget(null);
      await refresh();
    } catch {
      message.error('Xoá thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleEdit = async () => {
    if (!editTarget) return;
    setSubmitting(true);
    try {
      await updateEmployee(editTarget.id, {
        branchId: editTarget.branchId,
        roleId: editTarget.roleId,
        status: editTarget.status,
        avatarUrl: editTarget.avatarUrl,
      });
      message.success('Cập nhật nhân viên thành công');
      setEditTarget(null);
      await refresh();
    } catch {
      message.error('Cập nhật thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editTarget) return;
    setUploading(true);
    try {
      const { imageUrl } = await uploadEmployeeImage(file);
      setEditTarget({ ...editTarget, avatarUrl: imageUrl });
      message.success('Tải ảnh lên thành công');
    } catch {
      message.error('Tải ảnh thất bại');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('vi-VN').format(value) + ' VND';

  const visible = employees.filter(e => {
    const q = search.toLowerCase();
    return e.name.toLowerCase().includes(q) || (e.email ?? '').toLowerCase().includes(q);
  });

  const handleSort = (field: string, order: 'asc' | 'desc') => {
    setSortBy(field);
    setSortOrder(order);
    setPage(1);
  };

  const empColumns: ColumnDef<Employee>[] = [
    {
      key: 'name',
      header: 'Nhân viên',
      width: '1.4fr',
      sortable: true,
      sortField: 'name',
      render: emp => {
        const initials = emp.name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase();
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {emp.avatarUrl ? (
              <img src={emp.avatarUrl} alt={emp.name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <span style={{ width: 36, height: 36, borderRadius: '50%', background: '#16110C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display',serif", fontWeight: 700, color: '#EE8A33', fontSize: 12, flexShrink: 0 }}>
                {initials || '?'}
              </span>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#F1ECE1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(241,236,225,0.55)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{emp.email}</div>
            </div>
          </div>
        );
      },
    },
    {
      key: 'branch',
      header: 'Chi nhánh',
      width: '1fr',
      render: emp => <span style={{ fontSize: 13, color: '#F1ECE1' }}>{branches.find(b => b.id === emp.branchId)?.name ?? '-'}</span>,
    },
    {
      key: 'role',
      header: 'Vai trò',
      width: '1fr',
      render: emp => <span style={{ fontSize: 13, color: '#F1ECE1' }}>{roles.find(r => r.id === emp.roleId)?.name ?? '-'}</span>,
    },
    {
      key: 'bookings',
      header: 'Lượt booking',
      width: '100px',
      align: 'right',
      sortable: true,
      sortField: 'total_bookings',
      render: emp => <span style={{ fontSize: 13, color: '#F1ECE1' }}>{emp.totalBookings}</span>,
    },
    {
      key: 'revenue',
      header: 'Doanh thu',
      width: '120px',
      align: 'right',
      sortable: true,
      sortField: 'total_revenue',
      render: emp => <span style={{ fontSize: 13, fontWeight: 600, color: '#F1ECE1' }}>{formatCurrency(emp.totalRevenue)}</span>,
    },
    {
      key: 'status',
      header: 'Trạng thái',
      width: '100px',
      align: 'center',
      sortable: true,
      sortField: 'status',
      render: emp => {
        const st = statusLabels[emp.status];
        return <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 11px', borderRadius: 20, background: st.bg, color: st.color }}>{st.label}</span>;
      },
    },
    {
      key: 'actions',
      header: 'Thao tác',
      width: '60px',
      align: 'right',
      render: emp => (
        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
          {canEdit && (
            <button onClick={() => setEditTarget({ ...emp })} title="Sửa" className="w-7 h-7 flex items-center justify-center rounded border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
              <Pencil size={13} />
            </button>
          )}
          {canDelete && (
            <button onClick={() => setDeleteTarget(emp)} title="Xóa" className="w-7 h-7 flex items-center justify-center rounded border border-white/10 bg-white/5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-colors cursor-pointer">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid #1e293b', paddingBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0, marginBottom: 4 }}>Nhân viên</h1>
        </div>
      </div>
      <FilterBar onSearch={setSearch} placeholder="Tìm nhân viên" marginBottom={16} />

      <AdminTable
        columns={empColumns}
        data={visible}
        rowKey={emp => emp.id}
        loading={loading}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={handleSort}
        emptyText={employees.length === 0 ? 'Chưa có nhân viên nào. Khi admin duyệt tài khoản mới, nhân viên sẽ được tạo tự động.' : 'Không tìm thấy nhân viên phù hợp.'}
        minWidth={960}
        pagination={
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            pageSizeOptions={[10, 20, 50]}
            showTotal={(t, [s, e]) => `${s}–${e} / ${t} nhân viên`}
            onChange={(p, ps) => { setPageSize(ps); setPage(ps !== pageSize ? 1 : p); }}
          />
        }
      />

      {/* Edit modal */}
      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Chỉnh sửa nhân viên">
        <style>{`@media (max-width: 560px) { .gh-emp-upload-btn { width: 100% !important; justify-content: center; } }`}</style>
        {editTarget && (
          <div style={{ padding: '8px 0' }}>
            {/* Avatar upload */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: 16, background: 'rgba(238,138,51,0.06)', borderRadius: 10, flexWrap: 'wrap', rowGap: 12 }}>
              <div style={{ position: 'relative' }}>
                {editTarget.avatarUrl ? (
                  <img src={editTarget.avatarUrl} alt={editTarget.name} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ width: 56, height: 56, borderRadius: '50%', background: '#16110C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Playfair Display',serif", fontWeight: 700, color: '#EE8A33', fontSize: 16 }}>
                    {editTarget.name.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#F1ECE1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{editTarget.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(241,236,225,0.55)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{editTarget.email}</div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleUpload} style={{ display: 'none' }} />
              <button
                className="gh-emp-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                style={{ background: 'transparent', border: '1px solid rgba(238,138,51,0.4)', color: '#EE8A33', padding: '8px 14px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Hanken Grotesk',sans-serif" }}
              >
                <Upload size={14} />
                {uploading ? 'Đang tải...' : 'Đổi ảnh'}
              </button>
            </div>

            {/* Readonly stats */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div style={{ padding: '12px 14px', background: 'rgba(241,236,225,0.04)', borderRadius: 6, border: '1px solid rgba(238,138,51,0.1)' }}>
                <div style={{ fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(241,236,225,0.5)' }}>Lượt booking</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#F1ECE1', marginTop: 4 }}>{editTarget.totalBookings}</div>
              </div>
              <div style={{ padding: '12px 14px', background: 'rgba(241,236,225,0.04)', borderRadius: 6, border: '1px solid rgba(238,138,51,0.1)' }}>
                <div style={{ fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'rgba(241,236,225,0.5)' }}>Doanh thu</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#EE8A33', marginTop: 4 }}>{formatCurrency(editTarget.totalRevenue)}</div>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(241,236,225,.55)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Chi nhánh</label>
              <Select
                value={editTarget.branchId}
                onChange={(val) => setEditTarget({ ...editTarget, branchId: val })}
                style={{ width: '100%' }}
                placeholder="Chọn chi nhánh"
                allowClear
                options={branches.map(b => ({ label: b.name, value: b.id }))}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(241,236,225,.55)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Vai trò</label>
              <Select
                value={editTarget.roleId}
                onChange={(val) => setEditTarget({ ...editTarget, roleId: val })}
                style={{ width: '100%' }}
                placeholder="Chọn vai trò"
                allowClear
                options={roles.map(r => ({ label: r.name, value: r.id }))}
              />
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'rgba(241,236,225,.55)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '.06em' }}>Trạng thái</label>
              <Select
                value={editTarget.status}
                onChange={(val) => setEditTarget({ ...editTarget, status: val })}
                style={{ width: '100%' }}
                options={[
                  { label: 'Đang làm', value: 'active' },
                  { label: 'Đã nghỉ', value: 'inactive' },
                ]}
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
              <button
                onClick={() => setEditTarget(null)}
                style={{ flex: 1, background: 'transparent', border: '1px solid rgba(238,138,51,0.3)', color: 'rgba(241,236,225,0.8)', padding: 12, borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Huỷ
              </button>
              <button
                onClick={handleEdit}
                disabled={submitting}
                style={{ flex: 1, background: '#EE8A33', color: '#0B1620', border: 'none', padding: 12, borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: submitting ? 0.5 : 1 }}
              >
                {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Xác nhận xoá">
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(168,150,120,0.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#C6B7A0" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/></svg>
          </div>
          <h3 style={{ fontFamily: "'Playfair Display',serif", fontSize: 21, fontWeight: 700, marginTop: 18, color: '#F1ECE1' }}>Xác nhận xoá</h3>
          <p style={{ fontSize: 14, color: 'rgba(241,236,225,0.6)', marginTop: 10, lineHeight: 1.55 }}>
            Bạn có chắc muốn xoá <b style={{ color: '#F1ECE1' }}>{deleteTarget?.name}</b>? Hành động này không thể hoàn tác.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button onClick={() => setDeleteTarget(null)} style={{ flex: 1, background: 'transparent', border: '1px solid rgba(238,138,51,0.3)', color: 'rgba(241,236,225,0.8)', padding: 12, borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Huỷ</button>
            <button onClick={handleDelete} disabled={submitting} style={{ flex: 1, background: '#46505C', color: '#fff', border: 'none', padding: 12, borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: submitting ? 0.5 : 1 }}>
              {submitting ? 'Đang xoá...' : 'Xoá'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
