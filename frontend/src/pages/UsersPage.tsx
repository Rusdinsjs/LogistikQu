import React, { useEffect, useState, useMemo } from 'react';
import { userApi } from '../api';
import type {
  UserManagementItem,
  RoleItem,
  CreateUserPayload,
  UpdateUserPayload,
} from '../types';
import {
  Users,
  UserPlus,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  X,
  AlertCircle,
  KeyRound,
  Shield,
  ShieldCheck,
  Boxes,
  ShoppingCart,
  GitPullRequest,
  Scale,
  Database,
  BarChart3,
  Lock,
  Sparkles,
  Info,
  DollarSign,
  Table,
  SlidersHorizontal,
  Check,
  RotateCcw,
  Save,
  Minus,
} from 'lucide-react';

const WAREHOUSE_OPTIONS = [
  { id: 'WH-MAIN-HE', name: 'Gudang Utama Alat Berat', category: 'HEAVY_EQUIPMENT', type: 'MAIN' },
  { id: 'WH-MAIN-DT', name: 'Gudang Utama Dump Truck', category: 'DUMP_TRUCK', type: 'MAIN' },
  { id: 'WH-CONT-HE', name: 'Gudang Kontainer Alat Berat', category: 'HEAVY_EQUIPMENT', type: 'CONTAINER' },
  { id: 'WH-CONT-DT', name: 'Gudang Kontainer Dump Truck', category: 'DUMP_TRUCK', type: 'CONTAINER' },
];

export interface PermissionGroup {
  category: string;
  title: string;
  icon: React.FC<{ className?: string }>;
  color: string;
  items: { id: string; label: string; desc: string }[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    category: 'ADMIN',
    title: 'Administrasi & Hak Akses',
    icon: ShieldCheck,
    color: 'purple',
    items: [
      { id: 'users.manage', label: 'Manajemen Pengguna & Hak Akses (Menu)', desc: 'Mengatur akun, peran, dan konfigurasi hak akses menu' },
    ],
  },
  {
    category: 'MASTER',
    title: 'Master Data & Unit',
    icon: Database,
    color: 'indigo',
    items: [
      { id: 'master.view', label: 'Monitoring Master Data & Unit (Menu)', desc: 'Melihat katalog suku cadang, unit, mekanik, site, dan gudang' },
      { id: 'master.manage', label: 'Kelola Master Data (CRUD Penuh)', desc: 'Menambah, mengubah, dan menonaktifkan master data sistem' },
    ],
  },
  {
    category: 'INVENTORY',
    title: 'Persediaan & Denah Bin Rak',
    icon: Boxes,
    color: 'emerald',
    items: [
      { id: 'inventory.view', label: 'Monitoring Stok (Menu Sidebar)', desc: 'Melihat persediaan on-hand dan kartu pergerakan stok' },
      { id: 'stock.import', label: 'Import Excel Saldo Awal', desc: 'Mengunggah file Excel / JSON saldo awal persediaan kontainer' },
      { id: 'bins.view', label: 'Layout & Denah Bin Rak (Menu Sidebar)', desc: 'Melihat denah visual bin dan kapasitas rak kontainer' },
      { id: 'bins.manage', label: 'Manajemen & Relokasi Bin Rak', desc: 'Menambah, mengedit rak kontainer dan merelokasi penempatan part' },
    ],
  },
  {
    category: 'TRANSACTION',
    title: 'POS Issue & Retur Part Bekas',
    icon: ShoppingCart,
    color: 'cyan',
    items: [
      { id: 'issue.view', label: 'Melihat Riwayat POS Issue', desc: 'Melihat riwayat transaksi pengeluaran suku cadang' },
      { id: 'issue.create', label: 'Input POS Issue (Menu Sidebar)', desc: 'Membuat transaksi pengeluaran part ke unit & mekanik' },
      { id: 'issue.approve', label: 'Approval Part Kritikal', desc: 'Menyetujui pengeluaran part dengan status kritikal' },
      { id: 'returns.view', label: 'Retur Part Bekas (Menu Sidebar)', desc: 'Melihat alur dan monitoring core return suku cadang bekas' },
      { id: 'returns.receive', label: 'Penerimaan Retur di Kontainer', desc: 'Konfirmasi penerimaan fisik part bekas dari mekanik di kontainer' },
      { id: 'returns.transfer', label: 'Pengiriman Retur ke Gudang Utama', desc: 'Menyerahkan dan mencatat transfer ke Gudang Utama' },
      { id: 'returns.complete', label: 'Penyelesaian / Disposisi Retur', desc: 'Penyelesaian akhir (restock atau scrap/afkir)' },
    ],
  },
  {
    category: 'REPLENISHMENT',
    title: 'Alur Permohonan Stok (STO) & Drop',
    icon: GitPullRequest,
    color: 'blue',
    items: [
      { id: 'request.view', label: 'Alur Permohonan Stok (Menu Sidebar)', desc: 'Melihat permohonan pengadaan stok antar gudang' },
      { id: 'request.create', label: 'Buat Permohonan Baru (Kontainer)', desc: 'Mengajukan replenishment kontainer ke gudang utama' },
      { id: 'request.verify', label: 'Verifikasi Gudang Utama', desc: 'Memverifikasi dan menerbitkan STO dari Gudang Utama' },
      { id: 'request.approve', label: 'Persetujuan / Approval Supervisor', desc: 'Menyetujui atau menolak permohonan stok divisi' },
      { id: 'sto.ship', label: 'Eksekusi Drop Supply (Gudang Utama)', desc: 'Mengirim drop barang dari gudang utama' },
      { id: 'sto.receive', label: 'Konfirmasi Penerimaan Drop', desc: 'Menerima dan menambah saldo fisik kontainer' },
      { id: 'drops.view', label: 'Drop Gudang Utama (Menu Sidebar)', desc: 'Melihat riwayat dokumen drop STO' },
    ],
  },
  {
    category: 'ADJUSTMENT',
    title: 'Stock Opname & Koreksi Saldo',
    icon: Scale,
    color: 'amber',
    items: [
      { id: 'adjustment.view', label: 'Stock Opname (Menu Sidebar)', desc: 'Melihat riwayat penyesuaian selisih stok fisik vs sistem' },
      { id: 'adjustment.create', label: 'Ajukan Opname / Penyesuaian', desc: 'Menginput selisih fisik vs sistem' },
      { id: 'adjustment.approve', label: 'Approval Selisih Stok (Supervisor)', desc: 'Menyetujui koreksi saldo oleh Supervisor / Manager' },
    ],
  },
  {
    category: 'REPORTS_AUDIT',
    title: 'Laporan Analitik & Jejak Audit',
    icon: BarChart3,
    color: 'teal',
    items: [
      { id: 'reports.view', label: 'Laporan & Konsumsi (Menu Sidebar)', desc: 'Melihat laporan pemakaian unit, site, mekanik, dan KPI' },
      { id: 'audit.view', label: 'Jejak Audit Sistem (Menu Sidebar)', desc: 'Melihat log aktivitas dan jejak audit perubahan data' },
    ],
  },
  {
    category: 'FINANCE',
    title: 'Keuangan & Valuasi Stok',
    icon: DollarSign,
    color: 'rose',
    items: [
      { id: 'financial.view', label: 'Akses Harga Satuan, Biaya & Valuasi', desc: 'Melihat harga satuan part, valuasi total, dan biaya unit (Super Admin & Manager)' },
    ],
  },
];

export const DEFAULT_PRD_MATRIX: Record<string, string[]> = {
  SUPER_ADMIN: [
    'users.manage', 'master.view', 'master.manage', 'inventory.view', 'stock.import',
    'bins.view', 'bins.manage', 'issue.view', 'issue.create', 'issue.approve',
    'returns.view', 'returns.receive', 'returns.transfer', 'returns.complete',
    'request.view', 'request.create', 'request.verify', 'request.approve',
    'sto.ship', 'sto.receive', 'drops.view',
    'adjustment.view', 'adjustment.create', 'adjustment.approve',
    'reports.view', 'audit.view', 'financial.view',
  ],
  MANAGER: [
    'users.manage', 'master.view', 'master.manage', 'inventory.view', 'stock.import',
    'bins.view', 'bins.manage', 'issue.view', 'issue.create', 'issue.approve',
    'returns.view', 'returns.receive', 'returns.transfer', 'returns.complete',
    'request.view', 'request.create', 'request.verify', 'request.approve',
    'sto.ship', 'sto.receive', 'drops.view',
    'adjustment.view', 'adjustment.create', 'adjustment.approve',
    'reports.view', 'audit.view', 'financial.view',
  ],
  SUPERVISOR_HE: [
    'master.view', 'bins.view', 'inventory.view', 'issue.view', 'issue.approve',
    'returns.view', 'returns.complete', 'request.view', 'request.approve',
    'drops.view', 'adjustment.view', 'adjustment.approve', 'reports.view', 'audit.view',
  ],
  SUPERVISOR_DT: [
    'master.view', 'bins.view', 'inventory.view', 'issue.view', 'issue.approve',
    'returns.view', 'returns.complete', 'request.view', 'request.approve',
    'drops.view', 'adjustment.view', 'adjustment.approve', 'reports.view', 'audit.view',
  ],
  MAIN_ADMIN_HE: [
    'master.view', 'bins.view', 'inventory.view', 'drops.view', 'sto.ship',
    'returns.view', 'returns.transfer', 'returns.complete', 'request.view',
    'request.verify', 'reports.view',
  ],
  MAIN_ADMIN_DT: [
    'master.view', 'bins.view', 'inventory.view', 'drops.view', 'sto.ship',
    'returns.view', 'returns.transfer', 'returns.complete', 'request.view',
    'request.verify', 'reports.view',
  ],
  CONTAINER_ADMIN_HE: [
    'master.view', 'bins.view', 'bins.manage', 'inventory.view', 'stock.import',
    'issue.view', 'issue.create', 'returns.view', 'returns.receive', 'request.view',
    'request.create', 'sto.receive', 'adjustment.view', 'adjustment.create', 'reports.view',
  ],
  CONTAINER_ADMIN_DT: [
    'master.view', 'bins.view', 'bins.manage', 'inventory.view', 'stock.import',
    'issue.view', 'issue.create', 'returns.view', 'returns.receive', 'request.view',
    'request.create', 'sto.receive', 'adjustment.view', 'adjustment.create', 'reports.view',
  ],
};

export const UsersPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'matrix'>('users');
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

  // Form states - Create User
  const [createForm, setCreateForm] = useState<CreateUserPayload>({
    username: '',
    password: '',
    full_name: '',
    role_id: 'CONTAINER_ADMIN_HE',
    warehouse_ids: ['WH-CONT-HE'],
    custom_permissions_enabled: false,
    custom_permissions: [],
  });

  // Form states - Edit User
  const [editForm, setEditForm] = useState<UpdateUserPayload>({
    full_name: '',
    password: '',
    role_id: '',
    is_active: true,
    warehouse_ids: [],
    custom_permissions_enabled: false,
    custom_permissions: [],
  });

  // Role Permissions Matrix State
  const [matrixViewMode, setMatrixViewMode] = useState<'grid' | 'single'>('grid');
  const [selectedRoleForMatrix, setSelectedRoleForMatrix] = useState<string>('CONTAINER_ADMIN_HE');
  const [roleMatrixPermissions, setRoleMatrixPermissions] = useState<string[]>([]);
  const [roleMatrixMap, setRoleMatrixMap] = useState<Record<string, string[]>>({});
  const [matrixSearch, setMatrixSearch] = useState<string>('');
  const [matrixCategoryFilter, setMatrixCategoryFilter] = useState<string>('ALL');
  const [savingRoleMatrix, setSavingRoleMatrix] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // Standard Role Order
  const ORDERED_ROLE_IDS = useMemo(
    () => [
      'SUPER_ADMIN',
      'MANAGER',
      'SUPERVISOR_HE',
      'SUPERVISOR_DT',
      'MAIN_ADMIN_HE',
      'MAIN_ADMIN_DT',
      'CONTAINER_ADMIN_HE',
      'CONTAINER_ADMIN_DT',
    ],
    []
  );

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

      // Build initial roleMatrixMap
      const map: Record<string, string[]> = {};
      rData.forEach((r) => {
        map[r.id] = [...(r.permissions || [])];
      });
      setRoleMatrixMap(map);

      // Initialize Matrix selection for single role inspector
      const initialRole = rData.find((r) => r.id === selectedRoleForMatrix) || rData[0];
      if (initialRole) {
        setSelectedRoleForMatrix(initialRole.id);
        setRoleMatrixPermissions(initialRole.permissions || []);
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.error || 'Gagal memuat data pengguna dan hak akses.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const sortedRoles = useMemo(() => {
    return [...roles].sort((a, b) => {
      const idxA = ORDERED_ROLE_IDS.indexOf(a.id);
      const idxB = ORDERED_ROLE_IDS.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [roles, ORDERED_ROLE_IDS]);

  const isRoleDirty = (roleId: string) => {
    const original = roles.find((r) => r.id === roleId)?.permissions || [];
    const current = roleMatrixMap[roleId] || [];
    if (original.length !== current.length) return true;
    return !original.every((p) => current.includes(p));
  };

  const dirtyRoleCount = useMemo(() => {
    return roles.filter((r) => isRoleDirty(r.id)).length;
  }, [roles, roleMatrixMap]);

  // Matrix Grid interactive handlers
  const handleToggleGridCell = (roleId: string, permId: string) => {
    if (roleId === 'SUPER_ADMIN') return;
    setRoleMatrixMap((prev) => {
      const current = prev[roleId] || [];
      const next = current.includes(permId)
        ? current.filter((p) => p !== permId)
        : [...current, permId];
      return { ...prev, [roleId]: next };
    });
  };

  const handleToggleColumnRole = (roleId: string, selectAll: boolean) => {
    if (roleId === 'SUPER_ADMIN') return;
    const allPermIds = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.id));
    setRoleMatrixMap((prev) => ({
      ...prev,
      [roleId]: selectAll ? allPermIds : [],
    }));
  };

  const handleToggleRowPerm = (permId: string, selectAll: boolean) => {
    setRoleMatrixMap((prev) => {
      const next = { ...prev };
      ORDERED_ROLE_IDS.forEach((roleId) => {
        if (roleId === 'SUPER_ADMIN') return;
        const current = next[roleId] || [];
        if (selectAll && !current.includes(permId)) {
          next[roleId] = [...current, permId];
        } else if (!selectAll && current.includes(permId)) {
          next[roleId] = current.filter((p) => p !== permId);
        }
      });
      return next;
    });
  };

  const handleResetToPrdStandard = () => {
    const updatedMap: Record<string, string[]> = {};
    roles.forEach((r) => {
      if (DEFAULT_PRD_MATRIX[r.id]) {
        updatedMap[r.id] = [...DEFAULT_PRD_MATRIX[r.id]];
      } else {
        updatedMap[r.id] = [...(r.permissions || [])];
      }
    });
    setRoleMatrixMap(updatedMap);
    setSuccessMsg('Matriks hak akses dikembalikan ke konfigurasi standar PRD & BR-040.');
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleDiscardMatrixChanges = () => {
    const map: Record<string, string[]> = {};
    roles.forEach((r) => {
      map[r.id] = [...(r.permissions || [])];
    });
    setRoleMatrixMap(map);
  };

  const handleSaveEntireMatrix = async () => {
    try {
      setSavingRoleMatrix(true);
      setError(null);
      const dirtyRolesList = roles.filter((r) => isRoleDirty(r.id));
      if (dirtyRolesList.length === 0) {
        setSuccessMsg('Tidak ada perubahan matriks yang perlu disimpan.');
        setTimeout(() => setSuccessMsg(null), 3000);
        return;
      }
      for (const r of dirtyRolesList) {
        await userApi.updateRolePermissions(r.id, roleMatrixMap[r.id] || []);
      }
      setSuccessMsg(`Berhasil memperbarui hak akses untuk ${dirtyRolesList.length} peran!`);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Gagal menyimpan konfigurasi matriks.');
    } finally {
      setSavingRoleMatrix(false);
    }
  };

  // Single Role Inspector handlers
  const handleSelectRoleMatrix = (roleId: string) => {
    setSelectedRoleForMatrix(roleId);
    const r = roles.find((item) => item.id === roleId);
    setRoleMatrixPermissions(r?.permissions || []);
  };

  const handleToggleMatrixPerm = (permId: string) => {
    setRoleMatrixPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const handleSelectAllMatrix = () => {
    const all = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.id));
    setRoleMatrixPermissions(all);
  };

  const handleClearAllMatrix = () => {
    setRoleMatrixPermissions([]);
  };

  const handleSaveRoleMatrix = async () => {
    try {
      setSavingRoleMatrix(true);
      setError(null);
      await userApi.updateRolePermissions(selectedRoleForMatrix, roleMatrixPermissions);
      setSuccessMsg(`Hak akses peran '${selectedRoleForMatrix}' berhasil diperbarui!`);
      await loadData();
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Gagal memperbarui hak akses peran.');
    } finally {
      setSavingRoleMatrix(false);
    }
  };

  // --- USER CREATE / EDIT ACTIONS ---
  const handleOpenCreate = () => {
    const defaultRoleId = roles[0]?.id || 'CONTAINER_ADMIN_HE';
    const roleObj = roles.find((r) => r.id === defaultRoleId);
    setCreateForm({
      username: '',
      password: '',
      full_name: '',
      role_id: defaultRoleId,
      warehouse_ids: ['WH-CONT-HE'],
      custom_permissions_enabled: false,
      custom_permissions: roleObj?.permissions || [],
    });
    setShowCreateModal(true);
  };

  const handleOpenEdit = (u: UserManagementItem) => {
    const roleObj = roles.find((r) => r.id === u.role_id);
    const defaultPerms = roleObj?.permissions || [];
    setEditingUser(u);
    setEditForm({
      full_name: u.full_name,
      password: '',
      role_id: u.role_id,
      is_active: u.is_active,
      warehouse_ids: u.warehouses.map((w) => w.id),
      custom_permissions_enabled: u.custom_permissions_enabled ?? false,
      custom_permissions: (u.custom_permissions_enabled && u.permissions) ? u.permissions : defaultPerms,
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

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = search.toLowerCase();
      const matchSearch =
        u.username.toLowerCase().includes(q) ||
        u.full_name.toLowerCase().includes(q) ||
        u.role_name.toLowerCase().includes(q);
      const matchRole = !roleFilter || u.role_id === roleFilter;
      return matchSearch && matchRole;
    });
  }, [users, search, roleFilter]);

  const getRoleBadgeClass = (roleId: string) => {
    switch (roleId) {
      case 'SUPER_ADMIN':
        return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
      case 'MANAGER':
        return 'bg-purple-500/15 text-purple-300 border-purple-500/30';
      case 'SUPERVISOR':
      case 'SUPERVISOR_HE':
      case 'SUPERVISOR_DT':
        return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
      case 'MAIN_ADMIN_HE':
      case 'MAIN_ADMIN_DT':
        return 'bg-blue-500/15 text-blue-300 border-blue-500/30';
      default:
        return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
    }
  };

  const selectedRoleObj = roles.find((r) => r.id === selectedRoleForMatrix);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-cyan-400" />
            Manajemen Pengguna & Konfigurasi Hak Akses Menu
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Pengaturan batasan akses menu sidebar, otorisasi fitur, dan matriks peran operasional (Superadmin Control).
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'users' && (
            <button
              onClick={handleOpenCreate}
              className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>Tambah Pengguna</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'users'
              ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30 shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Daftar Pengguna & Akses Khusus ({users.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('matrix')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'matrix'
              ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30 shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Matriks Hak Akses Peran ({roles.length} Peran)</span>
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between animate-fade-in">
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
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* TAB 1: USERS LIST VIEW */}
      {activeTab === 'users' && (
        <div className="space-y-4">
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
              <div className="text-xs text-slate-400 font-medium">Hak Akses Kustom</div>
              <div className="text-2xl font-bold text-amber-400 mt-1">
                {users.filter((u) => u.custom_permissions_enabled).length}
              </div>
              <div className="text-[11px] text-amber-400/80 mt-1">Disesuaikan khusus per user</div>
            </div>
            <div className="glass-panel p-4 rounded-xl border border-slate-800">
              <div className="text-xs text-slate-400 font-medium">Hak Akses Bawaan Role</div>
              <div className="text-2xl font-bold text-purple-400 mt-1">
                {users.filter((u) => !u.custom_permissions_enabled).length}
              </div>
              <div className="text-[11px] text-purple-400/80 mt-1">Mewarisi izin peran</div>
            </div>
          </div>

          {/* Filters */}
          <div className="glass-card p-3 rounded-xl flex flex-col sm:flex-row items-center gap-3">
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
                    <th className="py-3 px-4 font-semibold">Hak Akses Menu</th>
                    <th className="py-3 px-4 font-semibold">Gudang Operasional</th>
                    <th className="py-3 px-4 font-semibold text-center">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Memuat data pengguna...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Tidak ada pengguna yang sesuai dengan filter.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-white">{u.full_name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">@{u.username}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getRoleBadgeClass(
                              u.role_id
                            )}`}
                          >
                            {u.role_name}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {u.custom_permissions_enabled ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                              <Sparkles className="w-3 h-3 text-amber-400" />
                              Kustom ({u.permissions?.length || 0} Izin)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                              <Shield className="w-3 h-3 text-cyan-400" />
                              Bawaan Role ({u.permissions?.length || 0} Izin)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {u.warehouses.length === 0 ? (
                              <span className="text-slate-500 text-[10px]">Belum ditugaskan</span>
                            ) : (
                              u.warehouses.map((w) => (
                                <span
                                  key={w.id}
                                  className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/80 text-[10px] font-medium text-slate-300"
                                >
                                  {w.name}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
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
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-cyan-500/50 inline-flex items-center gap-1.5 transition text-[11px]"
                          >
                            <Edit2 className="w-3 h-3 text-cyan-400" /> Edit & Hak Akses
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: ROLE PERMISSION MATRIX */}
      {activeTab === 'matrix' && (
        <div className="space-y-6 animate-fade-in">
          {/* Sub-view Navigation Bar & Global Matrix Actions */}
          <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-cyan-400" />
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    Matriks Hak Akses & Konfigurasi Peran (Enterprise RBAC)
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Otorisasi granular lintas 8 peran operasional dan 27 izin modul pergudangan (Sesuai Spesifikasi PRD & BR-040).
                  </p>
                </div>
              </div>
            </div>

            {/* View Mode Toggle & Quick Actions */}
            <div className="flex flex-wrap items-center gap-2 self-stretch lg:self-auto justify-end">
              <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setMatrixViewMode('grid')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    matrixViewMode === 'grid'
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>Tabel Matriks Grid (8 Peran)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMatrixViewMode('single')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    matrixViewMode === 'single'
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>Inspeksi Per Peran</span>
                </button>
              </div>

              {matrixViewMode === 'grid' && (
                <>
                  <button
                    type="button"
                    onClick={handleResetToPrdStandard}
                    className="px-3 py-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-amber-400 border border-slate-800 hover:border-amber-500/30 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
                    title="Kembalikan seluruh hak akses peran ke standar default PRD"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Standar PRD</span>
                  </button>

                  <button
                    type="button"
                    disabled={savingRoleMatrix || dirtyRoleCount === 0}
                    onClick={handleSaveEntireMatrix}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>
                      {savingRoleMatrix
                        ? 'Menyimpan...'
                        : dirtyRoleCount > 0
                        ? `Simpan Matriks (${dirtyRoleCount} Diubah)`
                        : 'Simpan Matriks'}
                    </span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* VIEW MODE 1: MATRIX GRID TABLE (2D Side-by-side) */}
          {matrixViewMode === 'grid' && (
            <div className="space-y-4">
              {/* Matrix Filter & Search Toolbar */}
              <div className="glass-panel p-3.5 rounded-xl border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                {/* Search Permission */}
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={matrixSearch}
                    onChange={(e) => setMatrixSearch(e.target.value)}
                    placeholder="Cari izin / modul (misal: issue.create, stock.import, financial)..."
                    className="w-full bg-slate-900/80 border border-slate-750 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  {matrixSearch && (
                    <button
                      onClick={() => setMatrixSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Category Pills Filter */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                  <button
                    onClick={() => setMatrixCategoryFilter('ALL')}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
                      matrixCategoryFilter === 'ALL'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    Semua Modul (27)
                  </button>
                  {PERMISSION_GROUPS.map((g) => (
                    <button
                      key={g.category}
                      onClick={() => setMatrixCategoryFilter(g.category)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition cursor-pointer ${
                        matrixCategoryFilter === g.category
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {g.title.split(' ')[0]} ({g.items.length})
                    </button>
                  ))}
                </div>
              </div>

              {/* The 2D Matrix Table */}
              <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto max-h-[72vh] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs select-none">
                    <thead className="sticky top-0 z-30">
                      <tr className="bg-slate-900 border-b border-slate-800 text-slate-300">
                        {/* Fixed Left Header Column */}
                        <th className="py-3 px-4 font-bold sticky left-0 z-40 bg-slate-900 min-w-[300px] border-r border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.5)]">
                          <div className="flex items-center justify-between">
                            <span className="uppercase tracking-wider text-[11px] text-slate-400 font-mono">
                              Modul & Fitur Sistem
                            </span>
                            <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20 font-mono">
                              27 Hak Akses
                            </span>
                          </div>
                        </th>

                        {/* 8 Role Columns Header */}
                        {sortedRoles.map((role) => {
                          const activeCount = (roleMatrixMap[role.id] || []).length;
                          const isDirty = isRoleDirty(role.id);
                          const isSuperAdmin = role.id === 'SUPER_ADMIN';

                          return (
                            <th
                              key={role.id}
                              className={`py-3 px-3 text-center min-w-[130px] max-w-[150px] border-r border-slate-800/80 transition ${
                                isDirty ? 'bg-amber-500/10' : 'bg-slate-900'
                              }`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center justify-center gap-1.5">
                                  <span className="font-bold text-white text-xs truncate max-w-[120px]" title={role.name}>
                                    {role.name.replace(/Gudang Utama |Gudang Kontainer /g, '')}
                                  </span>
                                  {isDirty && (
                                    <span
                                      className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0"
                                      title="Peran ini memiliki perubahan yang belum disimpan"
                                    />
                                  )}
                                </div>
                                <div className="text-[10px] font-mono text-cyan-400">
                                  {role.id}
                                </div>
                                <div className="flex items-center justify-center gap-1.5 pt-0.5">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                                      isSuperAdmin
                                        ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                        : activeCount > 0
                                        ? 'bg-slate-800 text-slate-200 border-slate-700'
                                        : 'bg-slate-900 text-slate-500 border-slate-800'
                                    }`}
                                  >
                                    {activeCount}/27 Izin
                                  </span>
                                </div>

                                {/* Column Action Buttons */}
                                {!isSuperAdmin && (
                                  <div className="flex items-center justify-center gap-1 pt-1 opacity-70 hover:opacity-100 transition">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleColumnRole(role.id, true)}
                                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-cyan-500/20 text-[9px] text-cyan-400 hover:text-cyan-300 border border-slate-700 cursor-pointer"
                                      title={`Pilih semua izin untuk ${role.name}`}
                                    >
                                      Semua
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleColumnRole(role.id, false)}
                                      className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-rose-500/20 text-[9px] text-rose-400 hover:text-rose-300 border border-slate-700 cursor-pointer"
                                      title={`Kosongkan semua izin untuk ${role.name}`}
                                    >
                                      Kosong
                                    </button>
                                  </div>
                                )}
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {PERMISSION_GROUPS.filter(
                        (g) => matrixCategoryFilter === 'ALL' || matrixCategoryFilter === g.category
                      ).map((group) => {
                        const GroupIcon = group.icon;
                        const filteredGroupItems = group.items.filter((item) => {
                          if (!matrixSearch) return true;
                          const q = matrixSearch.toLowerCase();
                          return (
                            item.label.toLowerCase().includes(q) ||
                            item.id.toLowerCase().includes(q) ||
                            item.desc.toLowerCase().includes(q)
                          );
                        });

                        if (filteredGroupItems.length === 0) return null;

                        return (
                          <React.Fragment key={group.category}>
                            {/* Category Separator Header Row */}
                            <tr className="bg-slate-900/90 border-t-2 border-slate-800">
                              <td
                                colSpan={sortedRoles.length + 1}
                                className="py-2.5 px-4 bg-slate-900/95 sticky left-0 z-20"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <GroupIcon className="w-4 h-4 text-cyan-400" />
                                    <span className="font-bold text-white text-xs uppercase tracking-wider">
                                      {group.title}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      ({filteredGroupItems.length} Izin)
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-mono text-slate-500 px-2 py-0.5 rounded bg-slate-800 border border-slate-700/60">
                                    {group.category}
                                  </span>
                                </div>
                              </td>
                            </tr>

                            {/* Permission Rows */}
                            {filteredGroupItems.map((perm) => {
                              return (
                                <tr
                                  key={perm.id}
                                  className="hover:bg-slate-800/40 transition group"
                                >
                                  {/* Sticky Left Column for Permission Info */}
                                  <td className="py-3 px-4 sticky left-0 z-20 bg-slate-950 group-hover:bg-slate-900/95 border-r border-slate-800 shadow-[2px_0_5px_rgba(0,0,0,0.5)]">
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <div className="font-semibold text-slate-100 text-xs flex items-center gap-1.5">
                                          <span>{perm.label}</span>
                                        </div>
                                        <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                                          {perm.desc}
                                        </p>
                                        <div className="mt-1">
                                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-cyan-400/90 border border-slate-800">
                                            {perm.id}
                                          </span>
                                        </div>
                                      </div>

                                      {/* Quick toggle across all roles */}
                                      <div className="opacity-0 group-hover:opacity-100 transition shrink-0 flex flex-col gap-1 items-end">
                                        <button
                                          type="button"
                                          onClick={() => handleToggleRowPerm(perm.id, true)}
                                          className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-cyan-500/20 text-cyan-400 border border-slate-700 cursor-pointer"
                                          title={`Berikan ${perm.id} ke semua peran`}
                                        >
                                          + Semua
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleRowPerm(perm.id, false)}
                                          className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-rose-500/20 text-rose-400 border border-slate-700 cursor-pointer"
                                          title={`Cabut ${perm.id} dari semua peran`}
                                        >
                                          - Semua
                                        </button>
                                      </div>
                                    </div>
                                  </td>

                                  {/* Role Toggle Cells */}
                                  {sortedRoles.map((role) => {
                                    const isSuperAdmin = role.id === 'SUPER_ADMIN';
                                    const rolePerms = roleMatrixMap[role.id] || [];
                                    const originalRolePerms = roles.find((r) => r.id === role.id)?.permissions || [];
                                    const isGranted = isSuperAdmin || rolePerms.includes(perm.id);
                                    const isCellDirty = !isSuperAdmin && (
                                      (isGranted && !originalRolePerms.includes(perm.id)) ||
                                      (!isGranted && originalRolePerms.includes(perm.id))
                                    );

                                    return (
                                      <td
                                        key={role.id}
                                        className={`py-2 px-3 text-center border-r border-slate-800/80 transition ${
                                          isCellDirty ? 'bg-amber-500/10' : ''
                                        }`}
                                      >
                                        {isSuperAdmin ? (
                                          <div
                                            className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold cursor-not-allowed"
                                            title="Super Admin memiliki akses penuh mutlak untuk seluruh modul sistem"
                                          >
                                            <Lock className="w-3 h-3 text-emerald-400" />
                                            <span>Penuh</span>
                                          </div>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() => handleToggleGridCell(role.id, perm.id)}
                                            className={`inline-flex items-center justify-center p-2 rounded-xl transition cursor-pointer ${
                                              isGranted
                                                ? isCellDirty
                                                  ? 'bg-amber-500/20 border-2 border-amber-400 text-amber-300 shadow-sm'
                                                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 shadow-sm shadow-emerald-500/10'
                                                : isCellDirty
                                                ? 'bg-rose-500/15 border-2 border-rose-400 text-rose-300 shadow-sm'
                                                : 'bg-slate-900/60 hover:bg-slate-800/80 border border-slate-800 text-slate-600 hover:text-slate-400'
                                            }`}
                                            title={`${isGranted ? 'Cabut izin' : 'Berikan izin'} ${perm.label} (${perm.id}) untuk ${role.name}`}
                                          >
                                            {isGranted ? (
                                              <Check className="w-4 h-4 stroke-[2.5]" />
                                            ) : (
                                              <Minus className="w-4 h-4" />
                                            )}
                                          </button>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Table Footer Legend */}
                <div className="p-3 bg-slate-900/90 border-t border-slate-800 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-emerald-500/30 border border-emerald-500/60 flex items-center justify-center text-emerald-300 text-[9px]">
                        ✓
                      </span>
                      <span>Izin Diberikan</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 text-[9px]">
                        -
                      </span>
                      <span>Izin Ditolak (403)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded bg-amber-500/30 border border-amber-400 flex items-center justify-center text-amber-300 text-[9px]">
                        •
                      </span>
                      <span>Modifikasi Belum Disimpan</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-emerald-400" />
                      <span>Super Admin (Root Proteksi Penuh)</span>
                    </div>
                  </div>

                  <div className="text-slate-500 font-mono">
                    Total: 27 Izin • 8 Peran • Role-Based Access Control Matrix
                  </div>
                </div>
              </div>

              {/* Floating Save Action Bar when Changes Exist */}
              {dirtyRoleCount > 0 && (
                <div className="sticky bottom-4 z-40 p-4 rounded-2xl bg-slate-900/95 border border-cyan-500/40 shadow-2xl backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
                  <div className="flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full bg-amber-400 animate-ping shrink-0" />
                    <div>
                      <div className="font-bold text-white text-xs">
                        Terdapat perubahan hak akses pada {dirtyRoleCount} peran!
                      </div>
                      <p className="text-[11px] text-slate-400">
                        Klik 'Simpan Perubahan Matriks' untuk menerapkan izin baru secara real-time ke sistem.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleDiscardMatrixChanges}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition cursor-pointer"
                    >
                      Batalkan
                    </button>
                    <button
                      type="button"
                      onClick={handleResetToPrdStandard}
                      className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-semibold border border-amber-500/30 transition cursor-pointer"
                    >
                      Reset Standar PRD
                    </button>
                    <button
                      type="button"
                      disabled={savingRoleMatrix}
                      onClick={handleSaveEntireMatrix}
                      className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/30 flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>{savingRoleMatrix ? 'Menyimpan...' : 'Simpan Perubahan Matriks'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW MODE 2: SINGLE ROLE INSPECTOR (Focused card view) */}
          {matrixViewMode === 'single' && (
            <div className="space-y-6">
              {/* Role selector panel */}
              <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-cyan-400" />
                    Pilih Peran untuk Inspeksi Mendalam
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Mode kartu per kategori untuk menelaah deskripsi rinci dan hak akses spesifik per peran.
                  </p>
                </div>

                {/* Role Pills */}
                <div className="flex flex-wrap gap-2 pt-1">
                  {sortedRoles.map((r) => {
                    const isSelected = selectedRoleForMatrix === r.id;
                    const permsCount = (roleMatrixPermissions || []).length;
                    return (
                      <button
                        key={r.id}
                        onClick={() => handleSelectRoleMatrix(r.id)}
                        className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500 shadow-md shadow-cyan-500/10'
                            : 'bg-slate-900/60 text-slate-400 hover:text-slate-200 border-slate-800'
                        }`}
                      >
                        <span>{r.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                          {isSelected ? `${permsCount}/27` : r.id}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {selectedRoleObj && (
                  <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 text-xs text-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-cyan-300 flex items-center gap-2">
                        <span>{selectedRoleObj.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 font-mono border border-cyan-500/20">
                          {selectedRoleObj.id}
                        </span>
                      </div>
                      <div className="text-slate-400 text-[11px] mt-0.5">{selectedRoleObj.description}</div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={handleSelectAllMatrix}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 text-xs font-medium cursor-pointer"
                      >
                        Pilih Semua
                      </button>
                      <button
                        type="button"
                        onClick={handleClearAllMatrix}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 text-xs font-medium cursor-pointer"
                      >
                        Kosongkan
                      </button>
                      <button
                        type="button"
                        disabled={savingRoleMatrix}
                        onClick={handleSaveRoleMatrix}
                        className="px-4 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 transition disabled:opacity-50 cursor-pointer"
                      >
                        {savingRoleMatrix ? 'Menyimpan...' : 'Simpan Hak Akses Peran'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Permission Categories Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {PERMISSION_GROUPS.map((group) => {
                  const GroupIcon = group.icon;
                  return (
                    <div
                      key={group.category}
                      className="glass-panel p-4 rounded-xl border border-slate-800 space-y-3"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <GroupIcon className="w-4 h-4 text-cyan-400" />
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                            {group.title}
                          </h4>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{group.category}</span>
                      </div>

                      <div className="space-y-2">
                        {group.items.map((perm) => {
                          const isChecked = roleMatrixPermissions.includes(perm.id);
                          return (
                            <label
                              key={perm.id}
                              className={`flex items-start gap-3 p-2.5 rounded-lg border transition cursor-pointer ${
                                isChecked
                                  ? 'bg-cyan-500/10 border-cyan-500/30 text-slate-200'
                                  : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/40'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleMatrixPerm(perm.id)}
                                className="mt-0.5 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0 cursor-pointer"
                              />
                              <div className="flex-1">
                                <div className="flex items-center justify-between">
                                  <span className={`text-xs font-semibold ${isChecked ? 'text-white' : 'text-slate-300'}`}>
                                    {perm.label}
                                  </span>
                                  <span className="text-[10px] font-mono text-slate-500">{perm.id}</span>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                                  {perm.desc}
                                </p>
                              </div>
                            </label>
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

      {/* MODAL: TAMBAH PENGGUNA BARU */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-2xl rounded-2xl border border-slate-750 p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-4">
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

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                    placeholder="Contoh: agus_wh"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    placeholder="Minimal 6 karakter"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  value={createForm.full_name}
                  onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                  placeholder="Contoh: Agus Sutrisno"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Peran (Role) *</label>
                <select
                  value={createForm.role_id}
                  onChange={(e) => {
                    const r = e.target.value;
                    const roleObj = roles.find((item) => item.id === r);
                    setCreateForm({
                      ...createForm,
                      role_id: r,
                      custom_permissions: createForm.custom_permissions_enabled ? createForm.custom_permissions : roleObj?.permissions || [],
                    });
                    if (r === 'SUPERVISOR_HE') applyPresetCreate('HE');
                    if (r === 'SUPERVISOR_DT') applyPresetCreate('DT');
                    if (r === 'MANAGER' || r === 'SUPER_ADMIN') applyPresetCreate('ALL');
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Warehouse Assignment */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-slate-300 font-medium">Otorisasi Gudang Operasional *</label>
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

                <div className="space-y-1.5 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
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

              {/* Custom Permission Overrides for User */}
              <div className="pt-2 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-slate-200 font-bold flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-cyan-400" />
                      Mode Pengaturan Hak Akses Menu
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Tentukan apakah pengguna ini menggunakan izin baku dari Perannya atau kustomisasi khusus.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setCreateForm({ ...createForm, custom_permissions_enabled: false })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        !createForm.custom_permissions_enabled
                          ? 'bg-cyan-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Bawaan Role
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const roleObj = roles.find((r) => r.id === createForm.role_id);
                        setCreateForm({
                          ...createForm,
                          custom_permissions_enabled: true,
                          custom_permissions: createForm.custom_permissions?.length ? createForm.custom_permissions : roleObj?.permissions || [],
                        });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        createForm.custom_permissions_enabled
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Kustomisasi Pengguna
                    </button>
                  </div>
                </div>

                {createForm.custom_permissions_enabled ? (
                  <div className="space-y-3 bg-slate-950/80 p-4 rounded-xl border border-amber-500/30">
                    <div className="flex items-center justify-between text-xs text-amber-300 font-semibold pb-2 border-b border-slate-800">
                      <span>Centang menu & izin yang boleh diakses oleh pengguna ini:</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const all = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.id));
                            setCreateForm({ ...createForm, custom_permissions: all });
                          }}
                          className="text-[11px] text-cyan-400 hover:underline"
                        >
                          Pilih Semua
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const roleObj = roles.find((r) => r.id === createForm.role_id);
                            setCreateForm({ ...createForm, custom_permissions: roleObj?.permissions || [] });
                          }}
                          className="text-[11px] text-slate-400 hover:underline"
                        >
                          Reset ke Role
                        </button>
                        <button
                          type="button"
                          onClick={() => setCreateForm({ ...createForm, custom_permissions: [] })}
                          className="text-[11px] text-rose-400 hover:underline"
                        >
                          Kosongkan
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                      {PERMISSION_GROUPS.map((group) => (
                        <div key={group.category} className="space-y-1 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                          <div className="text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                            {group.title}
                          </div>
                          {group.items.map((perm) => {
                            const isChecked = createForm.custom_permissions?.includes(perm.id);
                            return (
                              <label key={perm.id} className="flex items-center gap-2 text-[11px] text-slate-300 hover:bg-slate-800/50 p-1 rounded cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    const current = createForm.custom_permissions || [];
                                    const next = current.includes(perm.id)
                                      ? current.filter((p) => p !== perm.id)
                                      : [...current, perm.id];
                                    setCreateForm({ ...createForm, custom_permissions: next });
                                  }}
                                  className="rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0"
                                />
                                <span className={isChecked ? 'text-white font-medium' : 'text-slate-400'}>
                                  {perm.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                    <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>
                      Pengguna ini akan secara otomatis memiliki menu dan hak akses sesuai dengan peran <strong className="text-white">{roles.find(r => r.id === createForm.role_id)?.name}</strong>.
                    </span>
                  </div>
                )}
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

      {/* MODAL: EDIT PENGGUNA & HAK AKSES */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-2xl rounded-2xl border border-slate-750 p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">
                  Edit Pengguna & Hak Akses: <span className="text-cyan-400 font-mono">@{editingUser.username}</span>
                </h3>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Nama Lengkap *</label>
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
                    placeholder="Kosongkan jika tidak diubah"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">Peran (Role) *</label>
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
                        {r.name} ({r.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Status Akun</label>
                  <div className="flex items-center gap-4 pt-1.5">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="is_active"
                        checked={editForm.is_active === true}
                        onChange={() => setEditForm({ ...editForm, is_active: true })}
                        className="text-emerald-500 focus:ring-0"
                      />
                      <span className="text-emerald-400 font-semibold">Aktif</span>
                    </label>
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="is_active"
                        checked={editForm.is_active === false}
                        onChange={() => setEditForm({ ...editForm, is_active: false })}
                        className="text-rose-500 focus:ring-0"
                      />
                      <span className="text-rose-400 font-semibold">Nonaktif</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Warehouse Assignment */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-slate-300 font-medium">Otorisasi Gudang Operasional *</label>
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

                <div className="space-y-1.5 bg-slate-900/60 p-3 rounded-lg border border-slate-800">
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

              {/* Custom Permission Overrides for User */}
              <div className="pt-2 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-slate-200 font-bold flex items-center gap-1.5">
                      <Lock className="w-4 h-4 text-cyan-400" />
                      Mode Pengaturan Hak Akses Menu
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Pilih apakah akun ini mengikuti izin umum Role atau disesuaikan secara khusus.
                    </p>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-800">
                    <button
                      type="button"
                      onClick={() => setEditForm({ ...editForm, custom_permissions_enabled: false })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        !editForm.custom_permissions_enabled
                          ? 'bg-cyan-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Bawaan Role
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const roleObj = roles.find((r) => r.id === editForm.role_id);
                        setEditForm({
                          ...editForm,
                          custom_permissions_enabled: true,
                          custom_permissions: editForm.custom_permissions?.length ? editForm.custom_permissions : roleObj?.permissions || [],
                        });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        editForm.custom_permissions_enabled
                          ? 'bg-amber-500 text-slate-950 shadow'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Kustomisasi Pengguna
                    </button>
                  </div>
                </div>

                {editForm.custom_permissions_enabled ? (
                  <div className="space-y-3 bg-slate-950/80 p-4 rounded-xl border border-amber-500/30">
                    <div className="flex items-center justify-between text-xs text-amber-300 font-semibold pb-2 border-b border-slate-800">
                      <span>Centang menu & fitur yang boleh diakses pengguna ini:</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const all = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.id));
                            setEditForm({ ...editForm, custom_permissions: all });
                          }}
                          className="text-[11px] text-cyan-400 hover:underline"
                        >
                          Pilih Semua
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const roleObj = roles.find((r) => r.id === editForm.role_id);
                            setEditForm({ ...editForm, custom_permissions: roleObj?.permissions || [] });
                          }}
                          className="text-[11px] text-slate-400 hover:underline"
                        >
                          Reset ke Role
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditForm({ ...editForm, custom_permissions: [] })}
                          className="text-[11px] text-rose-400 hover:underline"
                        >
                          Kosongkan
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                      {PERMISSION_GROUPS.map((group) => (
                        <div key={group.category} className="space-y-1 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                          <div className="text-[11px] font-bold text-slate-300 mb-1 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                            {group.title}
                          </div>
                          {group.items.map((perm) => {
                            const isChecked = (editForm.custom_permissions || []).includes(perm.id);
                            return (
                              <label key={perm.id} className="flex items-center gap-2 text-[11px] text-slate-300 hover:bg-slate-800/50 p-1 rounded cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {
                                    const current = editForm.custom_permissions || [];
                                    const next = current.includes(perm.id)
                                      ? current.filter((p) => p !== perm.id)
                                      : [...current, perm.id];
                                    setEditForm({ ...editForm, custom_permissions: next });
                                  }}
                                  className="rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0"
                                />
                                <span className={isChecked ? 'text-white font-medium' : 'text-slate-400'}>
                                  {perm.label}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-slate-900/40 border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2">
                    <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                    <span>
                      Pengguna ini akan secara otomatis memiliki menu dan hak akses sesuai dengan peran <strong className="text-white">{roles.find(r => r.id === editForm.role_id)?.name}</strong>.
                    </span>
                  </div>
                )}
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
