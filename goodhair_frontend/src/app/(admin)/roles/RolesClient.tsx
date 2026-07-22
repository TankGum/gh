'use client';

import { useState, useEffect, useCallback } from 'react';
import { App, Spin, Input } from 'antd';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import FilterBar from '@/components/ui/FilterBar';
import { fetchRoles, createRole, updateRole, deleteRole } from '@/services/roles.api';
import { fetchServices } from '@/services/services.api';
import type { Role, PermissionMap, RoleCreatePayload, RoleUpdatePayload } from '@/types/role.type';
import type { HairService } from '@/types/service.type';
import Modal from '@/components/ui/Modal';
import { useAuth } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/useIsMobile';

type PermActionKey = 'view' | 'create' | 'edit' | 'delete';

// `actions` liệt kê đúng những action mà màn hình đó THỰC SỰ có (khớp với
// các endpoint backend yêu cầu quyền tương ứng) — action không có trong danh
// sách sẽ không hiển thị ô tick, tránh cấp quyền cho chức năng không tồn tại.
const PERM_MODULES: { key: string; label: string; actions: PermActionKey[] }[] = [
  { key: 'overview',  label: 'Tổng quan',          actions: ['view'] },
  { key: 'bookings',  label: 'Đặt lịch',           actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'revenue',   label: 'Doanh thu',          actions: ['view'] },
  { key: 'staff',     label: 'Nhân viên',          actions: ['view', 'edit', 'delete'] },
  { key: 'shifts',    label: 'Ca làm việc',        actions: ['view', 'edit'] },
  { key: 'customers', label: 'Khách hàng',         actions: ['view'] },
  { key: 'branches',  label: 'Chi nhánh',          actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'services',  label: 'Dịch vụ',            actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'roles',     label: 'Quản lý vai trò',    actions: ['view', 'create', 'edit', 'delete'] },
  { key: 'logs',      label: 'Nhật ký hoạt động',  actions: ['view'] },
  { key: 'payroll',   label: 'Toàn bộ bảng lương', actions: ['view', 'edit', 'delete'] },
];

const fmtVnd = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + ' đ';

const PERM_ACTIONS = [
  { key: 'view', label: 'Xem' },
  { key: 'create', label: 'Thêm' },
  { key: 'edit', label: 'Sửa' },
  { key: 'delete', label: 'Xoá' },
];

function moduleActions(moduleKey: string): PermActionKey[] {
  return PERM_MODULES.find(m => m.key === moduleKey)?.actions ?? [];
}

function emptyPerms(): Record<string, PermissionMap> {
  const o: Record<string, PermissionMap> = {};
  PERM_MODULES.forEach(m => { o[m.key] = { view: false, create: false, edit: false, delete: false }; });
  return o;
}

function clonePerms(p: Record<string, PermissionMap>): Record<string, PermissionMap> {
  return JSON.parse(JSON.stringify(p));
}

function countGranted(perms: Record<string, PermissionMap>): number {
  return PERM_MODULES.filter(m => perms[m.key]?.view).length;
}

// Chỉ giữ lại đúng các module còn tồn tại + ép về false mọi action không áp
// dụng cho module đó, trước khi gửi lên API — dọn rác dữ liệu quyền cũ (vd
// module đã bị bỏ, hoặc action không còn tồn tại cho màn đó).
function sanitizePerms(perms: Record<string, PermissionMap>): Record<string, PermissionMap> {
  const out: Record<string, PermissionMap> = {};
  PERM_MODULES.forEach(m => {
    const cell = perms[m.key];
    out[m.key] = {
      view: m.actions.includes('view') ? !!cell?.view : false,
      create: m.actions.includes('create') ? !!cell?.create : false,
      edit: m.actions.includes('edit') ? !!cell?.edit : false,
      delete: m.actions.includes('delete') ? !!cell?.delete : false,
    };
  });
  return out;
}

export default function RolesClient() {
  const { message } = App.useApp();
  const { can } = useAuth();
  const canCreate = can('roles', 'create');
  const canEdit = can('roles', 'edit');
  const canDelete = can('roles', 'delete');

  const [search, setSearch] = useState('');
  const [roles, setRoles] = useState<Role[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const [services, setServices] = useState<HairService[]>([]);

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [editRole, setEditRole] = useState<Role | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editIsBookable, setEditIsBookable] = useState(false);
  const [editPerms, setEditPerms] = useState<Record<string, PermissionMap>>({});
  const [editBaseSalary, setEditBaseSalary] = useState(0);
  const [editCommission, setEditCommission] = useState<Record<string, number>>({});

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createIsBookable, setCreateIsBookable] = useState(false);
  const [createPerms, setCreatePerms] = useState<Record<string, PermissionMap>>(emptyPerms());
  const [createBaseSalary, setCreateBaseSalary] = useState(0);
  const [createCommission, setCreateCommission] = useState<Record<string, number>>({});

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<Role | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const isMobile = useIsMobile();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRoles({ size: 100 });
      setRoles(data.items);
      setTotal(data.total);
    } catch {
      setError('Không tải được danh sách vai trò.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (roles.length > 0 && !selectedRole) {
      setSelectedRole(roles[0]);
    }
  }, [roles, selectedRole]);

  useEffect(() => {
    fetchServices({ size: 100 }).then(res => setServices(res.items)).catch(() => {});
  }, []);

  const openCreate = () => {
    setCreateName('');
    setCreateDesc('');
    setCreateIsBookable(false);
    setCreatePerms(emptyPerms());
    setCreateBaseSalary(0);
    setCreateCommission({});
    setCreateOpen(true);
  };

  const openEdit = (r: Role) => {
    setEditRole(r);
    setEditName(r.name);
    setEditDesc(r.description ?? '');
    setEditIsBookable(r.isBookable);
    setEditPerms(clonePerms(r.permissions));
    setEditBaseSalary(r.baseSalary);
    setEditCommission({ ...r.commissionRates });
    setEditOpen(true);
  };

  const confirmDelete = (r: Role) => {
    setDeleteTarget(r);
  };

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setSubmitting(true);
    try {
      const payload: RoleCreatePayload = {
        name: createName.trim(),
        description: createDesc.trim() || null,
        isBookable: createIsBookable,
        permissions: sanitizePerms(createPerms),
        baseSalary: createBaseSalary,
        commissionRates: createCommission,
      };
      await createRole(payload);
      message.success('Tạo vai trò thành công');
      setCreateOpen(false);
      await refresh();
    } catch (e: any) {
      message.error(e.message || 'Tạo vai trò thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editRole || !editName.trim()) return;
    setSubmitting(true);
    try {
      const payload: RoleUpdatePayload = { name: editName.trim() };
      if (editDesc !== (editRole.description ?? '')) payload.description = editDesc.trim() || null;
      if (editIsBookable !== editRole.isBookable) payload.isBookable = editIsBookable;
      payload.permissions = sanitizePerms(editPerms);
      payload.baseSalary = editBaseSalary;
      payload.commissionRates = editCommission;
      const updated = await updateRole(editRole.id, payload);
      setEditOpen(false);
      message.success('Cập nhật vai trò thành công');
      setSelectedRole(updated);
      await refresh();
    } catch (e: any) {
      message.error(e.message || 'Cập nhật thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSubmitting(true);
    try {
      await deleteRole(deleteTarget.id);
      message.success('Xoá vai trò thành công');
      setDeleteTarget(null);
      if (selectedRole?.id === deleteTarget.id) setSelectedRole(null);
      await refresh();
    } catch (e: any) {
      message.error(e.message || 'Xoá thất bại');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAllPerm = (
    perms: Record<string, PermissionMap>,
    setter: (p: Record<string, PermissionMap>) => void,
    moduleKey: string,
  ) => {
    const actions = moduleActions(moduleKey);
    const copy = clonePerms(perms);
    const cell = copy[moduleKey] ?? { view: false, create: false, edit: false, delete: false };
    const allGranted = actions.every(a => cell[a]);
    const next: PermissionMap = { view: false, create: false, edit: false, delete: false };
    actions.forEach(a => { next[a] = !allGranted; });
    copy[moduleKey] = next;
    setter(copy);
  };

  const togglePerm = (
    perms: Record<string, PermissionMap>,
    setter: (p: Record<string, PermissionMap>) => void,
    moduleKey: string,
    action: string,
  ) => {
    const copy = clonePerms(perms);
    const cell = copy[moduleKey] ?? { view: false, create: false, edit: false, delete: false };
    const act = action as keyof PermissionMap;
    cell[act] = !cell[act];
    if (act === 'view' && !cell.view) { cell.create = false; cell.edit = false; cell.delete = false; }
    if (act !== 'view' && cell[act]) { cell.view = true; }
    copy[moduleKey] = cell;
    setter(copy);
  };

  const selectedPerms = selectedRole?.permissions ?? {};

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #1e293b', paddingBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0, marginBottom: 4 }}>Quản lý vai trò</h1>
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
      <FilterBar onSearch={setSearch} placeholder="Tìm vai trò" marginBottom={20} />

      {error && (
        <div style={{ marginBottom: 16, padding: '8px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, color: '#f87171', fontSize: 14 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '340px 1fr', gap: 20, alignItems: 'start' }}>
          {/* Left: Role list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(241,236,225,0.45)', fontWeight: 700, marginBottom: 2 }}>
              Danh sách vai trò ({total})
            </div>
            {roles.filter(r => r.name.toLowerCase().includes(search.toLowerCase())).map(r => {
              const isSelected = selectedRole?.id === r.id;
              const granted = countGranted(r.permissions);
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedRole(r)}
                  style={{
                    textAlign: 'left', borderRadius: 9, padding: '16px 17px',
                    cursor: 'pointer', fontFamily: "'Hanken Grotesk',sans-serif",
                    background: isSelected ? '#0f1e2b' : 'transparent',
                    border: isSelected ? '1px solid rgba(238,138,51,0.4)' : '1px solid rgba(238,138,51,0.08)',
                    color: '#F1ECE1', width: '100%',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: '#EE8A33' }} />
                    <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700, flex: 1 }}>
                      {r.name}
                    </span>
                    {!r.isSystem && canEdit && (
                      <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} title="Sửa" className="w-7 h-7 flex items-center justify-center rounded border border-white/10 bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer">
                        <Pencil size={13} />
                      </button>
                    )}
                    {!r.isSystem && canDelete && (
                      <button onClick={(e) => { e.stopPropagation(); confirmDelete(r); }} title="Xóa" className="w-7 h-7 flex items-center justify-center rounded border border-white/10 bg-white/5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-colors cursor-pointer">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'rgba(241,236,225,0.55)', marginTop: 9, lineHeight: 1.5 }}>
                    {r.description}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11.5, color: 'rgba(241,236,225,0.45)' }}>
                      {r.employeeCount} người · {granted}/{PERM_MODULES.length} quyền
                    </span>
                    {r.isBookable && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#5FD49A', background: 'rgba(63,191,127,0.12)', padding: '1px 8px', borderRadius: 8 }}>
                        Đặt lịch
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right: Permission grid */}
          {selectedRole && (
            <div style={{ background: '#0f1e2b', border: '1px solid rgba(238,138,51,0.16)', borderRadius: 8, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14, padding: '18px 22px', borderBottom: '1px solid rgba(238,138,51,0.16)', background: '#13283a' }}>
                <div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 19, fontWeight: 700, color: '#F1ECE1' }}>
                    Quyền của: {selectedRole.name}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'rgba(241,236,225,0.5)', marginTop: 3 }}>
                    {selectedRole.isSystem ? 'Quản trị viên luôn có toàn quyền — không thể chỉnh.' : 'Bảng chỉ xem. Bấm "Sửa vai trò" để đổi tên, mô tả và quyền.'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700, color: '#EE8A33' }}>
                    {countGranted(selectedPerms)}/{PERM_MODULES.length}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(241,236,225,0.45)' }}>màn được truy cập</div>
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 480 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.6fr repeat(4,1fr)', gap: 10, padding: '13px 22px', borderBottom: '1px solid rgba(238,138,51,0.16)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(241,236,225,0.45)', fontWeight: 700 }}>
                    <span>Màn hình / Chức năng</span>
                    {PERM_ACTIONS.map(a => <span key={a.key} style={{ textAlign: 'center' }}>{a.label}</span>)}
                  </div>
                  {PERM_MODULES.map(mod => {
                    const perms = selectedPerms[mod.key];
                    return (
                      <div key={mod.key} style={{ display: 'grid', gridTemplateColumns: '1.6fr repeat(4,1fr)', gap: 10, padding: '12px 22px', alignItems: 'center', borderBottom: '1px solid rgba(238,138,51,0.07)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 13.5, fontWeight: 600, color: '#F1ECE1' }}>{mod.label}</span>
                        </div>
                        {PERM_ACTIONS.map(a => {
                          if (!mod.actions.includes(a.key as PermActionKey)) {
                            return <div key={a.key} />;
                          }
                          const granted = perms?.[a.key as keyof PermissionMap] ?? false;
                          return (
                            <div key={a.key} style={{ display: 'flex', justifyContent: 'center' }}>
                              <span style={{ width: 20, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, border: granted ? 'none' : '1px solid rgba(241,236,225,0.2)', background: granted ? '#EE8A33' : 'transparent', color: granted ? '#0B1620' : 'transparent' }}>
                                {granted ? '✓' : ''}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Lương & hoa hồng — view-only */}
              <div style={{ borderTop: '1px solid rgba(238,138,51,0.16)', padding: '18px 22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(241,236,225,0.45)', fontWeight: 700 }}>Lương & hoa hồng</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#EE8A33' }}>{fmtVnd(selectedRole.baseSalary)}<span style={{ fontSize: 11, color: 'rgba(241,236,225,0.45)', fontWeight: 600 }}> /tháng (lương cứng)</span></div>
                </div>
                {services.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: 'rgba(241,236,225,0.4)' }}>Chưa có dịch vụ nào.</div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {services.map(svc => {
                      const pct = selectedRole.commissionRates[svc.id] ?? 0;
                      return (
                        <span key={svc.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '5px 10px', borderRadius: 20, background: pct > 0 ? 'rgba(238,138,51,0.12)' : 'rgba(241,236,225,0.05)', color: pct > 0 ? '#F1ECE1' : 'rgba(241,236,225,0.4)' }}>
                          {svc.name}
                          <b style={{ color: pct > 0 ? '#EE8A33' : 'inherit' }}>{pct}%</b>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Thêm vai trò mới">
        <div style={{ marginTop: 8 }}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(241,236,225,0.45)', fontWeight: 700, marginBottom: 7 }}>Tên vai trò</label>
            <div style={{ border: '1px solid rgba(238,138,51,.25)', borderRadius: 6 }}>
              <Input size="large" variant="borderless" value={createName} onChange={e => setCreateName(e.target.value)} placeholder="VD: Quản lý chi nhánh" />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(241,236,225,0.45)', fontWeight: 700, marginBottom: 7 }}>Mô tả</label>
            <div style={{ border: '1px solid rgba(238,138,51,.25)', borderRadius: 6 }}>
              <Input size="large" variant="borderless" value={createDesc} onChange={e => setCreateDesc(e.target.value)} placeholder="Mô tả ngắn về vai trò..." />
            </div>
          </div>
          <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => setCreateIsBookable(v => !v)}
              style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: createIsBookable ? '#EE8A33' : 'rgba(241,236,225,0.15)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}
            >
              <span style={{ position: 'absolute', top: 3, left: createIsBookable ? 20 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
            </button>
            <span style={{ fontSize: 13, color: 'rgba(241,236,225,0.8)', fontWeight: 600 }}>Cho phép đặt lịch (hiện ra trang booking)</span>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(241,236,225,0.45)', fontWeight: 700, marginBottom: 7 }}>Lương cứng (VNĐ/tháng)</label>
            <div style={{ border: '1px solid rgba(238,138,51,.25)', borderRadius: 6 }}>
              <Input size="large" variant="borderless" type="number" min={0} value={createBaseSalary} onChange={e => setCreateBaseSalary(Math.max(0, Number(e.target.value) || 0))} />
            </div>
          </div>
          <div style={{ fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(241,236,225,0.45)', fontWeight: 700, marginBottom: 8 }}>Hoa hồng theo dịch vụ (%)</div>
          <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 20, border: '1px solid rgba(238,138,51,0.1)', borderRadius: 6, padding: '4px 12px' }}>
            {services.length === 0 && <div style={{ fontSize: 12.5, color: 'rgba(241,236,225,0.4)', padding: '10px 0' }}>Chưa có dịch vụ nào.</div>}
            {services.map(svc => (
              <div key={svc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(238,138,51,0.07)' }}>
                <span style={{ fontSize: 13, color: '#F1ECE1' }}>{svc.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <input
                    type="number" min={0} max={100} step={0.5}
                    value={createCommission[svc.id] ?? 0}
                    onChange={e => setCreateCommission(prev => ({ ...prev, [svc.id]: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))}
                    style={{ width: 64, background: '#0B1620', border: '1px solid rgba(238,138,51,.25)', color: '#F1ECE1', borderRadius: 6, padding: '6px 8px', fontSize: 13, textAlign: 'right' }}
                  />
                  <span style={{ fontSize: 12, color: 'rgba(241,236,225,0.5)' }}>%</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(241,236,225,0.45)', fontWeight: 700, marginBottom: 8 }}>Quyền truy cập</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.6fr repeat(4,1fr)', gap: 10, padding: '8px 0 12px', borderBottom: '1px solid rgba(238,138,51,0.16)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(241,236,225,0.45)', fontWeight: 700 }}>
            <span>Màn hình</span>
            {PERM_ACTIONS.map(a => <span key={a.key} style={{ textAlign: 'center' }}>{a.label}</span>)}
          </div>
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            {PERM_MODULES.map(mod => {
              const perms = createPerms[mod.key] ?? { view: false, create: false, edit: false, delete: false };
              const allGranted = mod.actions.every(a => perms[a]);
              return (
                <div key={mod.key} style={{ display: 'grid', gridTemplateColumns: '1.6fr repeat(4,1fr)', gap: 10, padding: '11px 0', alignItems: 'center', borderBottom: '1px solid rgba(238,138,51,0.07)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={() => toggleAllPerm(createPerms, setCreatePerms, mod.key)}
                      style={{ width: 20, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, cursor: 'pointer', border: allGranted ? 'none' : '1px solid rgba(241,236,225,0.25)', background: allGranted ? '#EE8A33' : 'transparent', color: allGranted ? '#0B1620' : 'transparent', padding: 0 }}
                    >
                      {allGranted ? '✓' : ''}
                    </button>
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: '#F1ECE1' }}>{mod.label}</span>
                  </div>
                  {PERM_ACTIONS.map(a => {
                    if (!mod.actions.includes(a.key as PermActionKey)) {
                      return <div key={a.key} />;
                    }
                    const granted = perms[a.key as keyof PermissionMap];
                    return (
                      <div key={a.key} style={{ display: 'flex', justifyContent: 'center' }}>
                        <button
                          onClick={() => togglePerm(createPerms, setCreatePerms, mod.key, a.key)}
                          style={{ width: 20, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, cursor: 'pointer', border: granted ? 'none' : '1px solid rgba(241,236,225,0.25)', background: granted ? '#EE8A33' : 'transparent', color: granted ? '#0B1620' : 'transparent', padding: 0 }}
                        >
                          {granted ? '✓' : ''}
                        </button>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
          <button onClick={() => setCreateOpen(false)} style={{ background: 'transparent', border: '1px solid rgba(238,138,51,0.3)', color: 'rgba(241,236,225,0.8)', padding: '10px 22px', borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Huỷ</button>
          {canCreate && (
            <button onClick={handleCreate} disabled={!createName.trim() || submitting} style={{ background: '#EE8A33', color: '#0B1620', border: 'none', padding: '10px 26px', borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (!createName.trim() || submitting) ? 0.5 : 1 }}>
              {submitting ? 'Đang tạo...' : 'Tạo vai trò'}
            </button>
          )}
        </div>
      </Modal>

      {/* Edit Modal */}
      {editRole && (
        <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Sửa vai trò">
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 12.5, color: 'rgba(241,236,225,0.5)', marginBottom: 16 }}>
              Vai trò: <b style={{ color: '#EE8A33' }}>{editRole.name}</b> · {countGranted(editPerms)}/{PERM_MODULES.length} màn được truy cập
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(241,236,225,0.45)', fontWeight: 700, marginBottom: 7 }}>Tên vai trò</label>
              <div style={{ border: '1px solid rgba(238,138,51,.25)', borderRadius: 6 }}>
                <Input size="large" variant="borderless" value={editName} onChange={e => setEditName(e.target.value)} placeholder="VD: Quản lý chi nhánh" />
              </div>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(241,236,225,0.45)', fontWeight: 700, marginBottom: 7 }}>Mô tả</label>
              <div style={{ border: '1px solid rgba(238,138,51,.25)', borderRadius: 6 }}>
                <Input size="large" variant="borderless" value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Mô tả ngắn về vai trò..." />
              </div>
            </div>
            <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => setEditIsBookable(v => !v)}
                style={{ width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer', background: editIsBookable ? '#EE8A33' : 'rgba(241,236,225,0.15)', position: 'relative', flexShrink: 0, transition: 'background 0.2s' }}
              >
                <span style={{ position: 'absolute', top: 3, left: editIsBookable ? 20 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
              </button>
              <span style={{ fontSize: 13, color: 'rgba(241,236,225,0.8)', fontWeight: 600 }}>Cho phép đặt lịch (hiện ra trang booking)</span>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(241,236,225,0.45)', fontWeight: 700, marginBottom: 7 }}>Lương cứng (VNĐ/tháng)</label>
              <div style={{ border: '1px solid rgba(238,138,51,.25)', borderRadius: 6 }}>
                <Input size="large" variant="borderless" type="number" min={0} value={editBaseSalary} onChange={e => setEditBaseSalary(Math.max(0, Number(e.target.value) || 0))} />
              </div>
            </div>
            <div style={{ fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(241,236,225,0.45)', fontWeight: 700, marginBottom: 8 }}>Hoa hồng theo dịch vụ (%)</div>
            <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: 20, border: '1px solid rgba(238,138,51,0.1)', borderRadius: 6, padding: '4px 12px' }}>
              {services.length === 0 && <div style={{ fontSize: 12.5, color: 'rgba(241,236,225,0.4)', padding: '10px 0' }}>Chưa có dịch vụ nào.</div>}
              {services.map(svc => (
                <div key={svc.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 0', borderBottom: '1px solid rgba(238,138,51,0.07)' }}>
                  <span style={{ fontSize: 13, color: '#F1ECE1' }}>{svc.name}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <input
                      type="number" min={0} max={100} step={0.5}
                      value={editCommission[svc.id] ?? 0}
                      onChange={e => setEditCommission(prev => ({ ...prev, [svc.id]: Math.min(100, Math.max(0, Number(e.target.value) || 0)) }))}
                      style={{ width: 64, background: '#0B1620', border: '1px solid rgba(238,138,51,.25)', color: '#F1ECE1', borderRadius: 6, padding: '6px 8px', fontSize: 13, textAlign: 'right' }}
                    />
                    <span style={{ fontSize: 12, color: 'rgba(241,236,225,0.5)' }}>%</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 11, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'rgba(241,236,225,0.45)', fontWeight: 700, marginBottom: 8 }}>Quyền truy cập</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1.6fr repeat(4,1fr)', gap: 10, padding: '8px 0 12px', borderBottom: '1px solid rgba(238,138,51,0.16)', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(241,236,225,0.45)', fontWeight: 700 }}>
              <span>Màn hình</span>
              {PERM_ACTIONS.map(a => <span key={a.key} style={{ textAlign: 'center' }}>{a.label}</span>)}
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {PERM_MODULES.map(mod => {
                const perms = editPerms[mod.key] ?? { view: false, create: false, edit: false, delete: false };
                const allGranted = mod.actions.every(a => perms[a]);
                return (
                  <div key={mod.key} style={{ display: 'grid', gridTemplateColumns: '1.6fr repeat(4,1fr)', gap: 10, padding: '11px 0', alignItems: 'center', borderBottom: '1px solid rgba(238,138,51,0.07)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <button
                        onClick={() => toggleAllPerm(editPerms, setEditPerms, mod.key)}
                        style={{ width: 20, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, cursor: 'pointer', border: allGranted ? 'none' : '1px solid rgba(241,236,225,0.25)', background: allGranted ? '#EE8A33' : 'transparent', color: allGranted ? '#0B1620' : 'transparent', padding: 0 }}
                      >
                        {allGranted ? '✓' : ''}
                      </button>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: '#F1ECE1' }}>{mod.label}</span>
                    </div>
                    {PERM_ACTIONS.map(a => {
                      if (!mod.actions.includes(a.key as PermActionKey)) {
                        return <div key={a.key} />;
                      }
                      const granted = perms[a.key as keyof PermissionMap];
                      return (
                        <div key={a.key} style={{ display: 'flex', justifyContent: 'center' }}>
                          <button
                            onClick={() => togglePerm(editPerms, setEditPerms, mod.key, a.key)}
                            style={{ width: 20, height: 20, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, cursor: 'pointer', border: granted ? 'none' : '1px solid rgba(241,236,225,0.25)', background: granted ? '#EE8A33' : 'transparent', color: granted ? '#0B1620' : 'transparent', padding: 0 }}
                          >
                            {granted ? '✓' : ''}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
            <button onClick={() => setEditOpen(false)} style={{ background: 'transparent', border: '1px solid rgba(238,138,51,0.3)', color: 'rgba(241,236,225,0.8)', padding: '10px 22px', borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Huỷ</button>
            {canEdit && (
              <button onClick={handleEdit} disabled={!editName.trim() || submitting} style={{ background: '#EE8A33', color: '#0B1620', border: 'none', padding: '10px 26px', borderRadius: 6, fontFamily: "'Hanken Grotesk',sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (!editName.trim() || submitting) ? 0.5 : 1 }}>
                {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            )}
          </div>
        </Modal>
      )}

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
