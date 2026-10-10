import React, { useEffect, useState } from 'react';
import { userApi } from '../api';
import type { UserManagementItem, RoleItem, CreateUserPayload, UpdateUserPayload } from '../types';
import {
  Users,
  UserPlus,
  Warehouse,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  X,
  AlertCircle,
  KeyRound,
  RotateCcw,
} from 'lucide-react';

const WAREHOUSE_OPTIONS = [
  { id: 'WH-MAIN-HE', name: 'Gudang Utama Alat Berat', category: 'HEAVY_EQUIPMENT', type: 'MAIN' },
  { id: 'WH-MAIN-DT', name: 'Gudang Utama Dump Truck', category: 'DUMP_TRUCK', type: 'MAIN' },
  { id: 'WH-CONT-HE', name: 'Gudang Kontainer Alat Berat', category: 'HEAVY_EQUIPMENT', type: 'CONTAINER' },
  { id: 'WH-CONT-DT', name: 'Gudang Kontainer Dump Truck', category: 'DUMP_TRUCK', type: 'CONTAINER' },
];

export const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<UserManagementItem[]>([]);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserManagementItem | null>(null);

  // Form states - Create
  const [createForm, setCreateForm] = useState<CreateUserPayload>({
    username: '',
    password: '',
    full_name: '',
    role_id: 'CONTAINER_ADMIN_HE',
    warehouse_ids: ['WH-CONT-HE'],
  });

  // Form states - Edit
  const [editForm, setEditForm] = useState<UpdateUserPayload>({
    full_name: '',
    password: '',
    role_id: '',
    is_active: true,
    warehouse_ids: [],
  });

  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [uData, rData] = await Promise.all([
        userApi.listUsers(),
        userApi.listRoles(),
      ]);
      setUsers(uData);
      setRoles(rData);
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.error || 'Gagal memuat daftar pengguna.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleOpenCreate = () => {
    setCreateForm({
      username: '',
      password: '',
      full_name: '',
      role_id: roles[0]?.id || 'CONTAINER_ADMIN_HE',
      warehouse_ids: ['WH-CONT-HE'],
    });
    setShowCreateModal(true);
  };

  const handleOpenEdit = (u: UserManagementItem) => {
    setEditingUser(u);
    setEditForm({
      full_name: u.full_name,
      password: '',
      role_id: u.role_id,
      is_active: u.is_active,
      warehouse_ids: u.warehouses.map((w) => w.id),
    });
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createForm.warehouse_ids.length === 0) {
      setError('Pengguna minimal harus memiliki 1 gudang yang ditugaskan.');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await userApi.createUser(createForm);
      setSuccessMsg(`Pengguna '${createForm.username}' berhasil ditambahkan!`);
      setShowCreateModal(false);
      loadData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Gagal membuat pengguna baru.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (editForm.warehouse_ids && editForm.warehouse_ids.length === 0) {
      setError('Pengguna minimal harus memiliki 1 gudang yang ditugaskan.');
      return;
    }
    try {
      setSubmitting(true);
      setError(null);
      await userApi.updateUser(editingUser.id, editForm);
      setSuccessMsg(`Pengguna '${editingUser.username}' berhasil diperbarui!`);
      setEditingUser(null);
      loadData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Gagal memperbarui pengguna.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCreateWarehouse = (whId: string) => {
    setCreateForm((prev) => {
      const exists = prev.warehouse_ids.includes(whId);
      return {
        ...prev,
        warehouse_ids: exists
          ? prev.warehouse_ids.filter((id) => id !== whId)
          : [...prev.warehouse_ids, whId],
      };
    });
  };

  const toggleEditWarehouse = (whId: string) => {
    setEditForm((prev) => {
      const current = prev.warehouse_ids || [];
      const exists = current.includes(whId);
      return {
        ...prev,
        warehouse_ids: exists
          ? current.filter((id) => id !== whId)
          : [...current, whId],
      };
    });
  };

  const applyPresetCreate = (preset: 'ALL' | 'HE' | 'DT') => {
    if (preset === 'ALL') {
      setCreateForm((prev) => ({ ...prev, warehouse_ids: WAREHOUSE_OPTIONS.map((w) => w.id) }));
    } else if (preset === 'HE') {
      setCreateForm((prev) => ({ ...prev, warehouse_ids: ['WH-MAIN-HE', 'WH-CONT-HE'] }));
    } else if (preset === 'DT') {
      setCreateForm((prev) => ({ ...prev, warehouse_ids: ['WH-MAIN-DT', 'WH-CONT-DT'] }));
    }
  };

  const applyPresetEdit = (preset: 'ALL' | 'HE' | 'DT') => {
    if (preset === 'ALL') {
      setEditForm((prev) => ({ ...prev, warehouse_ids: WAREHOUSE_OPTIONS.map((w) => w.id) }));
    } else if (preset === 'HE') {
      setEditForm((prev) => ({ ...prev, warehouse_ids: ['WH-MAIN-HE', 'WH-CONT-HE'] }));
    } else if (preset === 'DT') {
      setEditForm((prev) => ({ ...prev, warehouse_ids: ['WH-MAIN-DT', 'WH-CONT-DT'] }));
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    const matchSearch =
      u.username.toLowerCase().includes(q) ||
      u.full_name.toLowerCase().includes(q) ||
      u.role_name.toLowerCase().includes(q);
    const matchRole = !roleFilter || u.role_id === roleFilter;
    return matchSearch && matchRole;
  });

  const getRoleBadgeClass = (roleId: string) => {
    switch (roleId) {
      case 'SUPER_ADMIN':
        return 'bg-red-500/15 text-red-400 border-red-500/30';
      case 'MANAGER':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      case 'SUPERVISOR_HE':
      case 'SUPERVISOR':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'SUPERVISOR_DT':
        return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
      case 'MAIN_ADMIN_HE':
      case 'MAIN_ADMIN_DT':
      case 'ADMIN_MAIN':
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
      case 'CONTAINER_ADMIN_HE':
      case 'CONTAINER_ADMIN_DT':
      case 'ADMIN_CONTAINER':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      default:
        return 'bg-slate-500/15 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-cyan-400" />
            Manajemen Pengguna & Otorisasi Gudang
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Pengelolaan pengguna operasional, pembagian peran pengawas gudang, dan hak akses multi-warehouse.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Segarkan
          </button>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition"
          >
            <UserPlus className="w-4 h-4" /> Tambah Pengguna
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <div className="text-xs text-slate-400 font-medium">Total Akun Pengguna</div>
          <div className="text-2xl font-bold text-white mt-1">{users.length}</div>
          <div className="text-[11px] text-cyan-400 mt-1">Terdaftar di sistem</div>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <div className="text-xs text-slate-400 font-medium">Pengguna Aktif</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {users.filter((u) => u.is_active).length}
          </div>
          <div className="text-[11px] text-emerald-400/80 mt-1">Status aktif login</div>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <div className="text-xs text-slate-400 font-medium">Executive & Manager</div>
          <div className="text-2xl font-bold text-purple-400 mt-1">
            {users.filter((u) => u.role_id === 'MANAGER' || u.role_id === 'SUPER_ADMIN').length}
          </div>
          <div className="text-[11px] text-purple-400/80 mt-1">Akses lintas gudang</div>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <div className="text-xs text-slate-400 font-medium">Supervisor Terisolasi</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {users.filter((u) => u.role_id === 'SUPERVISOR_HE' || u.role_id === 'SUPERVISOR_DT').length}
          </div>
          <div className="text-[11px] text-amber-400/80 mt-1">Scoping HE / DT ketat</div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 rounded-xl flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari berdasarkan nama, username, peran..."
            className="w-full bg-slate-900/60 border border-slate-750 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
        <div className="w-full sm:w-64">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full bg-slate-900/60 border border-slate-750 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="">Semua Peran (Roles)</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="glass-panel rounded-xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50 text-slate-400">
                <th className="py-3 px-4 font-semibold">Pengguna</th>
                <th className="py-3 px-4 font-semibold">Peran (Role)</th>
                <th className="py-3 px-4 font-semibold">Hak Gudang Operasional</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Memuat data pengguna...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    Tidak ada pengguna yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">{u.full_name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">@{u.username}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold border ${getRoleBadgeClass(
                          u.role_id
                        )}`}
                      >
                        {u.role_name}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1.5 max-w-md">
                        {u.warehouses.length === 0 ? (
                          <span className="text-slate-500 text-[11px] italic">Tidak ada akses gudang</span>
                        ) : (
                          u.warehouses.map((wh) => (
                            <span
                              key={wh.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 border border-slate-700 text-slate-300"
                            >
                              <Warehouse className="w-2.5 h-2.5 text-cyan-400" />
                              {wh.id}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {u.is_active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Aktif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          <XCircle className="w-3 h-3" /> Nonaktif
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(u)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-cyan-500/50 inline-flex items-center gap-1.5 transition text-[11px]"
                      >
                        <Edit2 className="w-3 h-3 text-cyan-400" /> Edit / Otorisasi
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Tambah Pengguna */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-750 p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Tambah Pengguna Baru</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={createForm.username}
                  onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                  placeholder="Contoh: hendra_wh, supervisor_he"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={createForm.password}
                  onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                  placeholder="Minimal 6 karakter"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                  placeholder="Contoh: Hendra Gunawan"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Peran (Role)</label>
                <select
                  value={createForm.role_id}
                  onChange={(e) => {
                    const r = e.target.value;
                    setCreateForm({ ...createForm, role_id: r });
                    if (r === 'SUPERVISOR_HE') applyPresetCreate('HE');
                    if (r === 'SUPERVISOR_DT') applyPresetCreate('DT');
                    if (r === 'MANAGER' || r === 'SUPER_ADMIN') applyPresetCreate('ALL');
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} - {r.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-slate-300 font-medium">Otorisasi Gudang Operasional</label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyPresetCreate('ALL')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-cyan-400 border border-slate-700"
                    >
                      Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetCreate('HE')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-amber-400 border border-slate-700"
                    >
                      Alat Berat
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetCreate('DT')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-orange-400 border border-slate-700"
                    >
                      Dump Truck
                    </button>
                  </div>
                </div>

                <div className="space-y-2 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  {WAREHOUSE_OPTIONS.map((wh) => {
                    const isChecked = createForm.warehouse_ids.includes(wh.id);
                    return (
                      <label
                        key={wh.id}
                        className="flex items-center gap-2.5 p-1.5 rounded hover:bg-slate-800/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleCreateWarehouse(wh.id)}
                          className="rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0"
                        />
                        <div className="flex-1">
                          <span className="font-semibold text-slate-200">{wh.id}</span>
                          <span className="text-slate-400 ml-2">({wh.name})</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Pengguna'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Pengguna */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-750 p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  Edit Pengguna: <span className="text-cyan-400 font-mono">@{editingUser.username}</span>
                </h3>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="mt-4 space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={editForm.full_name}
                  onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                  Ganti Password (Opsional)
                </label>
                <input
                  type="password"
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  placeholder="Kosongkan bila tidak ingin mengubah password"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Peran (Role)</label>
                <select
                  value={editForm.role_id}
                  onChange={(e) => {
                    const r = e.target.value;
                    setEditForm({ ...editForm, role_id: r });
                    if (r === 'SUPERVISOR_HE') applyPresetEdit('HE');
                    if (r === 'SUPERVISOR_DT') applyPresetEdit('DT');
                    if (r === 'MANAGER' || r === 'SUPER_ADMIN') applyPresetEdit('ALL');
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} - {r.description}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Status Akun</label>
                <div className="flex gap-4 p-2 bg-slate-900/60 rounded-lg border border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="isActive"
                      checked={editForm.is_active === true}
                      onChange={() => setEditForm({ ...editForm, is_active: true })}
                      className="text-cyan-500 focus:ring-0"
                    />
                    <span className="text-emerald-400 font-medium">Aktif</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="isActive"
                      checked={editForm.is_active === false}
                      onChange={() => setEditForm({ ...editForm, is_active: false })}
                      className="text-rose-500 focus:ring-0"
                    />
                    <span className="text-rose-400 font-medium">Nonaktif (Suspend)</span>
                  </label>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-slate-300 font-medium">Otorisasi Gudang Operasional</label>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyPresetEdit('ALL')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-cyan-400 border border-slate-700"
                    >
                      Semua
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetEdit('HE')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-amber-400 border border-slate-700"
                    >
                      Alat Berat
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPresetEdit('DT')}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-orange-400 border border-slate-700"
                    >
                      Dump Truck
                    </button>
                  </div>
                </div>

                <div className="space-y-2 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
                  {WAREHOUSE_OPTIONS.map((wh) => {
                    const isChecked = (editForm.warehouse_ids || []).includes(wh.id);
                    return (
                      <label
                        key={wh.id}
                        className="flex items-center gap-2.5 p-1.5 rounded hover:bg-slate-800/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleEditWarehouse(wh.id)}
                          className="rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0"
                        />
                        <div className="flex-1">
                          <span className="font-semibold text-slate-200">{wh.id}</span>
                          <span className="text-slate-400 ml-2">({wh.name})</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Perbarui Pengguna'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
