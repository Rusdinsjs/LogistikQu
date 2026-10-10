import React, { useEffect, useState } from 'react';
import { masterApi } from '../api';
import { useAuth } from '../context/AuthContext';
import type { SparePart, Equipment, Employee, Site, WarehouseInfo } from '../types';
import {
  Boxes,
  Truck,
  Users,
  MapPin,
  Search,
  CheckCircle,
  AlertOctagon,
  Building2,
  RotateCcw,
  Plus,
  X,
  UserPlus,
  Edit2,
  Trash2,
  Power,
  PowerOff,
  Info,
} from 'lucide-react';

export const MasterPage: React.FC = () => {
  const { user } = useAuth();
  const canManageMaster =
    user?.role_id === 'SUPER_ADMIN' ||
    user?.role_id === 'MANAGER' ||
    user?.permissions?.includes('master.manage') ||
    user?.permissions?.includes('users.manage');

  const [activeTab, setActiveTab] = useState<'parts' | 'equipment' | 'employees' | 'sites' | 'warehouses'>('parts');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseInfo[]>([]);

  // Toggle Core Return state
  const [updatingPartId, setUpdatingPartId] = useState<string | null>(null);

  // Add Equipment Modal
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [newUnitNumber, setNewUnitNumber] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitType, setNewUnitType] = useState('HEAVY_EQUIPMENT');
  const [newUnitSerial, setNewUnitSerial] = useState('');
  const [newUnitHmKm, setNewUnitHmKm] = useState<number | undefined>(undefined);
  const [savingUnit, setSavingUnit] = useState(false);

  // Add Employee Modal
  const [showAddEmpModal, setShowAddEmpModal] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpPosition, setNewEmpPosition] = useState('Mekanik Alat Berat');
  const [newEmpIsMechanic, setNewEmpIsMechanic] = useState(true);
  const [savingEmp, setSavingEmp] = useState(false);

  // Site Modal (Add / Edit)
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [siteModalMode, setSiteModalMode] = useState<'create' | 'edit'>('create');
  const [siteFormId, setSiteFormId] = useState('');
  const [siteFormName, setSiteFormName] = useState('');
  const [siteFormDesc, setSiteFormDesc] = useState('');
  const [siteFormActive, setSiteFormActive] = useState(true);
  const [savingSite, setSavingSite] = useState(false);

  // Warehouse Modal (Add / Edit)
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [warehouseModalMode, setWarehouseModalMode] = useState<'create' | 'edit'>('create');
  const [warehouseFormId, setWarehouseFormId] = useState('');
  const [warehouseFormName, setWarehouseFormName] = useState('');
  const [warehouseFormType, setWarehouseFormType] = useState<'MAIN' | 'CONTAINER'>('CONTAINER');
  const [warehouseFormCategory, setWarehouseFormCategory] = useState<'HEAVY_EQUIPMENT' | 'DUMP_TRUCK' | 'GENERAL'>('HEAVY_EQUIPMENT');
  const [warehouseFormDesc, setWarehouseFormDesc] = useState('');
  const [warehouseFormActive, setWarehouseFormActive] = useState(true);
  const [savingWarehouse, setSavingWarehouse] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'parts') {
        const data = await masterApi.getSpareParts(search || undefined);
        setSpareParts(data);
      } else if (activeTab === 'equipment') {
        const data = await masterApi.getEquipment(search || undefined);
        setEquipmentList(data);
      } else if (activeTab === 'employees') {
        const data = await masterApi.getEmployees();
        setEmployees(data);
      } else if (activeTab === 'sites') {
        const data = await masterApi.getSites();
        setSites(data);
      } else if (activeTab === 'warehouses') {
        const data = await masterApi.getWarehouses();
        setWarehouses(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, search]);

  const handleToggleCoreReturn = async (part: SparePart) => {
    setUpdatingPartId(part.id);
    const newStatus = !part.requires_core_return;
    try {
      await masterApi.updateSparePart(part.id, {
        requires_core_return: newStatus,
      });
      setSpareParts(
        spareParts.map((p) =>
          p.id === part.id ? { ...p, requires_core_return: newStatus } : p
        )
      );
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal mengubah status retur part');
    } finally {
      setUpdatingPartId(null);
    }
  };

  const handleCreateEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitNumber.trim() || !newUnitName.trim()) {
      alert('Nomor Lambung dan Nama Unit wajib diisi!');
      return;
    }

    setSavingUnit(true);
    try {
      const created = await masterApi.createEquipment({
        unit_number: newUnitNumber.trim().toUpperCase(),
        name: newUnitName.trim(),
        equipment_type_id: newUnitType,
        serial_number: newUnitSerial.trim() || undefined,
        current_hm_km: newUnitHmKm,
      });

      const newEq: Equipment = {
        id: created.equipment_id,
        unit_number: newUnitNumber.trim().toUpperCase(),
        name: newUnitName.trim(),
        equipment_type_id: newUnitType,
        serial_number: newUnitSerial.trim() || undefined,
        current_hm_km: newUnitHmKm ?? 0,
        is_active: true,
      };

      setEquipmentList([newEq, ...equipmentList]);
      setNewUnitNumber('');
      setNewUnitName('');
      setNewUnitSerial('');
      setNewUnitHmKm(undefined);
      setShowAddUnitModal(false);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal menambahkan unit alat berat');
    } finally {
      setSavingUnit(false);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim()) {
      alert('Nama karyawan wajib diisi!');
      return;
    }

    setSavingEmp(true);
    try {
      const created = await masterApi.createEmployee({
        name: newEmpName.trim(),
        position: newEmpPosition.trim() || 'Staff',
        is_mechanic: newEmpIsMechanic,
      });

      const newEmployee: Employee = {
        id: created.employee_id,
        name: newEmpName.trim(),
        position: newEmpPosition.trim() || 'Staff',
        is_mechanic: newEmpIsMechanic,
        is_active: true,
      };

      setEmployees([newEmployee, ...employees]);
      setNewEmpName('');
      setShowAddEmpModal(false);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal menambahkan karyawan/mekanik');
    } finally {
      setSavingEmp(false);
    }
  };

  // --- SITE CRUD HANDLERS ---
  const openCreateSiteModal = () => {
    setSiteModalMode('create');
    setSiteFormId('');
    setSiteFormName('');
    setSiteFormDesc('');
    setSiteFormActive(true);
    setShowSiteModal(true);
  };

  const openEditSiteModal = (site: Site) => {
    setSiteModalMode('edit');
    setSiteFormId(site.id);
    setSiteFormName(site.name);
    setSiteFormDesc(site.description || '');
    setSiteFormActive(site.is_active);
    setShowSiteModal(true);
  };

  const handleSaveSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteFormName.trim()) {
      alert('Nama Titik Site wajib diisi!');
      return;
    }

    setSavingSite(true);
    try {
      if (siteModalMode === 'create') {
        const res = await masterApi.createSite({
          id: siteFormId.trim() || undefined,
          name: siteFormName.trim(),
          description: siteFormDesc.trim() || undefined,
          is_active: siteFormActive,
        });
        alert(res.message || 'Titik Site berhasil disimpan');
      } else {
        const res = await masterApi.updateSite(siteFormId, {
          name: siteFormName.trim(),
          description: siteFormDesc.trim() || undefined,
          is_active: siteFormActive,
        });
        alert(res.message || 'Titik Site berhasil diperbarui');
      }
      setShowSiteModal(false);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal menyimpan Titik Site');
    } finally {
      setSavingSite(false);
    }
  };

  const handleToggleSiteStatus = async (site: Site) => {
    const nextStatus = !site.is_active;
    const confirmMsg = nextStatus
      ? `Aktifkan kembali Titik Site "${site.name}"?`
      : `Nonaktifkan Titik Site "${site.name}"?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await masterApi.updateSite(site.id, { is_active: nextStatus });
      setSites(sites.map((s) => (s.id === site.id ? { ...s, is_active: nextStatus } : s)));
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal mengubah status site');
    }
  };

  const handleDeleteSite = async (site: Site) => {
    if (!window.confirm(`Hapus Titik Site "${site.name}" (${site.id})? Jika site memiliki riwayat unit/transaksi, statusnya akan dialihkan ke Non-Aktif.`)) {
      return;
    }

    try {
      const res = await masterApi.deleteSite(site.id);
      alert(res.message);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal menghapus Titik Site');
    }
  };

  // --- WAREHOUSE CRUD HANDLERS ---
  const openCreateWarehouseModal = () => {
    setWarehouseModalMode('create');
    setWarehouseFormId('');
    setWarehouseFormName('');
    setWarehouseFormType('CONTAINER');
    setWarehouseFormCategory('HEAVY_EQUIPMENT');
    setWarehouseFormDesc('');
    setWarehouseFormActive(true);
    setShowWarehouseModal(true);
  };

  const openEditWarehouseModal = (wh: WarehouseInfo) => {
    setWarehouseModalMode('edit');
    setWarehouseFormId(wh.id);
    setWarehouseFormName(wh.name);
    setWarehouseFormType(wh.warehouse_type);
    setWarehouseFormCategory((wh.category as any) || 'HEAVY_EQUIPMENT');
    setWarehouseFormDesc(wh.description || '');
    setWarehouseFormActive(wh.is_active ?? true);
    setShowWarehouseModal(true);
  };

  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseFormName.trim()) {
      alert('Nama Gudang wajib diisi!');
      return;
    }

    setSavingWarehouse(true);
    try {
      if (warehouseModalMode === 'create') {
        const res = await masterApi.createWarehouse({
          id: warehouseFormId.trim() || undefined,
          name: warehouseFormName.trim(),
          warehouse_type: warehouseFormType,
          category: warehouseFormCategory,
          description: warehouseFormDesc.trim() || undefined,
          is_active: warehouseFormActive,
        });
        alert(res.message || 'Gudang berhasil disimpan');
      } else {
        const res = await masterApi.updateWarehouse(warehouseFormId, {
          name: warehouseFormName.trim(),
          warehouse_type: warehouseFormType,
          category: warehouseFormCategory,
          description: warehouseFormDesc.trim() || undefined,
          is_active: warehouseFormActive,
        });
        alert(res.message || 'Gudang berhasil diperbarui');
      }
      setShowWarehouseModal(false);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal menyimpan Gudang');
    } finally {
      setSavingWarehouse(false);
    }
  };

  const handleToggleWarehouseStatus = async (wh: WarehouseInfo) => {
    const currentActive = wh.is_active ?? true;
    const nextStatus = !currentActive;
    const confirmMsg = nextStatus
      ? `Aktifkan kembali Gudang "${wh.name}"?`
      : `Nonaktifkan Gudang "${wh.name}"?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      await masterApi.updateWarehouse(wh.id, { is_active: nextStatus });
      setWarehouses(warehouses.map((w) => (w.id === wh.id ? { ...w, is_active: nextStatus } : w)));
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal mengubah status gudang');
    }
  };

  const handleDeleteWarehouse = async (wh: WarehouseInfo) => {
    if (!window.confirm(`Hapus Gudang "${wh.name}" (${wh.id})? Jika gudang memiliki riwayat stok/transaksi, statusnya akan dialihkan ke Non-Aktif.`)) {
      return;
    }

    try {
      const res = await masterApi.deleteWarehouse(wh.id);
      alert(res.message);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal menghapus Gudang');
    }
  };

  // Filtered lists for Sites and Warehouses
  const filteredSites = sites.filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase()) ||
      (s.description && s.description.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredWarehouses = warehouses.filter(
    (w) =>
      !search ||
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.id.toLowerCase().includes(search.toLowerCase()) ||
      w.warehouse_type.toLowerCase().includes(search.toLowerCase()) ||
      w.category.toLowerCase().includes(search.toLowerCase()) ||
      (w.description && w.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
          <Boxes className="w-7 h-7 text-cyan-400" />
          Master Data Operasional Tambang
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Katalog referensi suku cadang (aturan Core Return), armada alat berat, personil mekanik, titik site penambangan, dan konfigurasi gudang PT Vale.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setActiveTab('parts');
              setSearch('');
            }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              activeTab === 'parts'
                ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Boxes className="w-4 h-4" /> Suku Cadang ({spareParts.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('equipment');
              setSearch('');
            }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              activeTab === 'equipment'
                ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Truck className="w-4 h-4" /> Unit Alat Berat ({equipmentList.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('employees');
              setSearch('');
            }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              activeTab === 'employees'
                ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" /> Karyawan & Mekanik ({employees.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('sites');
              setSearch('');
            }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              activeTab === 'sites'
                ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MapPin className="w-4 h-4" /> Titik Site ({sites.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('warehouses');
              setSearch('');
            }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              activeTab === 'warehouses'
                ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4" /> Daftar Gudang ({warehouses.length})
          </button>
        </div>

        {/* Action Buttons for Tabs */}
        <div>
          {activeTab === 'equipment' && (
            <button
              onClick={() => setShowAddUnitModal(true)}
              className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Unit Alat Berat</span>
            </button>
          )}

          {activeTab === 'employees' && (
            <button
              onClick={() => setShowAddEmpModal(true)}
              className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Tambah Karyawan / Mekanik</span>
            </button>
          )}

          {activeTab === 'sites' && canManageMaster && (
            <button
              onClick={openCreateSiteModal}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Titik Site</span>
            </button>
          )}

          {activeTab === 'warehouses' && canManageMaster && (
            <button
              onClick={openCreateWarehouseModal}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Gudang Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-card p-4 rounded-xl flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            activeTab === 'parts'
              ? 'Cari nama suku cadang, part number...'
              : activeTab === 'equipment'
              ? 'Cari kode unit (e.g. EX-201, DT-501)...'
              : activeTab === 'employees'
              ? 'Cari nama karyawan atau posisi...'
              : activeTab === 'sites'
              ? 'Cari nama titik site, kode site...'
              : 'Cari nama gudang, kode gudang, kategori...'
          }
          className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-xs text-slate-400 hover:text-white">
            Hapus
          </button>
        )}
      </div>

      {/* TAB CONTENT: PARTS */}
      {activeTab === 'parts' && (
        <div className="glass-card rounded-2xl overflow-hidden border border-slate-800/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Part Number</th>
                  <th className="px-5 py-3.5">Deskripsi Suku Cadang</th>
                  <th className="px-5 py-3.5">Kategori</th>
                  <th className="px-5 py-3.5">Satuan</th>
                  <th className="px-5 py-3.5 text-center">Wajib Retur (Core)</th>
                  <th className="px-5 py-3.5 text-center">Critical Part</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                      Memuat katalog suku cadang...
                    </td>
                  </tr>
                ) : spareParts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                      Tidak ada suku cadang ditemukan
                    </td>
                  </tr>
                ) : (
                  spareParts.map((part) => (
                    <tr key={part.id} className="hover:bg-slate-800/30 transition">
                      <td className="px-5 py-4 font-mono font-bold text-cyan-400">{part.id}</td>
                      <td className="px-5 py-4 font-semibold text-slate-200">{part.part_name}</td>
                      <td className="px-5 py-4 text-xs">
                        <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                          {part.category || part.equipment_category || 'General'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs font-mono text-slate-300">
                        {part.unit_of_measure}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleCoreReturn(part)}
                          disabled={updatingPartId === part.id}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                            part.requires_core_return
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 shadow-sm'
                              : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
                          }`}
                          title="Klik untuk mengubah aturan kewajiban retur part bekas"
                        >
                          <RotateCcw className={`w-3 h-3 ${updatingPartId === part.id ? 'animate-spin' : ''}`} />
                          <span>{part.requires_core_return ? 'Wajib Retur' : 'Tidak Wajib'}</span>
                        </button>
                      </td>
                      <td className="px-5 py-4 text-center">
                        {part.critical_level === 'CRITICAL' || part.requires_issue_approval ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            <AlertOctagon className="w-3 h-3" /> Critical
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400">
                            Normal
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: EQUIPMENT */}
      {activeTab === 'equipment' && (
        <div className="glass-card rounded-2xl overflow-hidden border border-slate-800/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Nomor Unit (Unit ID)</th>
                  <th className="px-5 py-3.5">Model / Tipe</th>
                  <th className="px-5 py-3.5">Kategori Armada</th>
                  <th className="px-5 py-3.5 text-right">Hour Meter (HM)</th>
                  <th className="px-5 py-3.5 text-right">Kilometer (KM)</th>
                  <th className="px-5 py-3.5 text-center">Status Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                      Memuat daftar alat berat...
                    </td>
                  </tr>
                ) : equipmentList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                      Tidak ada unit alat berat ditemukan
                    </td>
                  </tr>
                ) : (
                  equipmentList.map((eq) => (
                    <tr key={eq.id} className="hover:bg-slate-800/30 transition">
                      <td className="px-5 py-4 font-mono font-bold text-cyan-400">{eq.unit_number || eq.id}</td>
                      <td className="px-5 py-4 font-semibold text-slate-200">{eq.name}</td>
                      <td className="px-5 py-4 text-xs text-slate-300">{eq.equipment_type_id || 'Alat Berat'}</td>
                      <td className="px-5 py-4 text-right font-mono text-cyan-300">
                        {eq.current_hm_km ?? 0} HM
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-slate-300">
                        {eq.current_hm_km ?? 0} KM
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle className="w-3 h-3" /> {eq.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: EMPLOYEES */}
      {activeTab === 'employees' && (
        <div className="glass-card rounded-2xl overflow-hidden border border-slate-800/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">ID Karyawan</th>
                  <th className="px-5 py-3.5">Nama Lengkap</th>
                  <th className="px-5 py-3.5">Departemen</th>
                  <th className="px-5 py-3.5">Jabatan / Role</th>
                  <th className="px-5 py-3.5 text-center">Kategori</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-5 py-4 font-mono font-semibold text-cyan-400">{emp.id}</td>
                    <td className="px-5 py-4 font-semibold text-slate-200">{emp.name}</td>
                    <td className="px-5 py-4 text-xs text-slate-400">{emp.department_id || (emp.is_mechanic ? 'Maintenance & Repair' : 'Logistics')}</td>
                    <td className="px-5 py-4 text-xs">
                      <span className="px-2.5 py-1 rounded-md bg-slate-800 text-cyan-300 border border-slate-700">
                        {emp.position || (emp.is_mechanic ? 'Mekanik / Teknisi' : 'Staff Operasional')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {emp.is_mechanic ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          Mekanik
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                          Staff
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: SITES */}
      {activeTab === 'sites' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-bold text-white">Daftar Titik Site Penambangan Vale</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                {filteredSites.length} Titik Lokasi
              </span>
            </div>
            {!canManageMaster && (
              <span className="text-xs text-slate-400 italic flex items-center gap-1">
                <Info className="w-3.5 h-3.5" /> Hanya Super Admin / Manager yang dapat menambah atau mengubah site
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSites.map((st) => (
              <div
                key={st.id}
                className="glass-card p-5 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/50">
                        {st.id}
                      </span>
                      <h3 className="text-base font-bold text-slate-100 mt-2">{st.name}</h3>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border flex items-center gap-1 ${
                        st.is_active
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {st.is_active ? <CheckCircle className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                      {st.is_active ? 'Aktif' : 'Non-Aktif'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                    {st.description || 'Area penambangan operasional PT Vale Indonesia'}
                  </p>
                </div>

                {canManageMaster && (
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => handleToggleSiteStatus(st)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border transition ${
                        st.is_active
                          ? 'text-amber-300 border-amber-500/30 hover:bg-amber-500/15'
                          : 'text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/15'
                      }`}
                      title={st.is_active ? 'Nonaktifkan site ini' : 'Aktifkan site ini'}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{st.is_active ? 'Nonaktifkan' : 'Aktifkan'}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditSiteModal(st)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                        title="Edit detail site"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSite(st)}
                        className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-200 border border-rose-800/40 transition"
                        title="Hapus / Nonaktifkan site"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {filteredSites.length === 0 && (
            <div className="glass-card p-12 text-center text-slate-400 rounded-2xl border border-slate-800">
              Tidak ada titik site yang sesuai dengan kriteria pencarian.
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: WAREHOUSES */}
      {activeTab === 'warehouses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-bold text-white">Daftar Gudang Logistik (Utama & Kontainer)</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                {filteredWarehouses.length} Gudang
              </span>
            </div>
            {!canManageMaster && (
              <span className="text-xs text-slate-400 italic flex items-center gap-1">
                <Info className="w-3.5 h-3.5" /> Hanya Super Admin / Manager yang dapat menambah atau mengubah gudang
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            {filteredWarehouses.map((wh) => (
              <div
                key={wh.id}
                className="glass-card p-5 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/50">
                          {wh.id}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                            wh.warehouse_type === 'MAIN'
                              ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {wh.warehouse_type === 'MAIN' ? '🏢 GUDANG UTAMA' : '📦 GUDANG KONTAINER'}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {wh.category === 'HEAVY_EQUIPMENT'
                            ? 'Alat Berat'
                            : wh.category === 'DUMP_TRUCK'
                            ? 'Dump Truck'
                            : wh.category}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-100 mt-2">{wh.name}</h3>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border flex items-center gap-1 shrink-0 ${
                        (wh.is_active ?? true)
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {(wh.is_active ?? true) ? <CheckCircle className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                      {(wh.is_active ?? true) ? 'Aktif' : 'Non-Aktif'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mt-2">
                    {wh.description || 'Gudang operasional inventori suku cadang pertambangan PT Vale.'}
                  </p>
                </div>

                {canManageMaster && (
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => handleToggleWarehouseStatus(wh)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border transition ${
                        (wh.is_active ?? true)
                          ? 'text-amber-300 border-amber-500/30 hover:bg-amber-500/15'
                          : 'text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/15'
                      }`}
                      title={(wh.is_active ?? true) ? 'Nonaktifkan gudang ini' : 'Aktifkan gudang ini'}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{(wh.is_active ?? true) ? 'Nonaktifkan' : 'Aktifkan'}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditWarehouseModal(wh)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1"
                        title="Edit data gudang"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteWarehouse(wh)}
                        className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-200 border border-rose-800/40 transition"
                        title="Hapus / Nonaktifkan gudang"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {filteredWarehouses.length === 0 && (
            <div className="glass-card p-12 text-center text-slate-400 rounded-2xl border border-slate-800">
              Tidak ada gudang yang sesuai dengan kriteria pencarian.
            </div>
          )}
        </div>
      )}

      {/* MODAL ADD EQUIPMENT */}
      {showAddUnitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-cyan-500/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-cyan-400">
                <Truck className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">Tambah Unit Alat Berat Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUnitModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEquipment} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Nomor Lambung *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: DT-214 atau EX-108"
                  value={newUnitNumber}
                  onChange={(e) => setNewUnitNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono uppercase focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Nama / Tipe Unit *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Dump Truck Hino 500 FM 260 Ti"
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Kategori Alat</label>
                  <select
                    value={newUnitType}
                    onChange={(e) => setNewUnitType(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="HEAVY_EQUIPMENT">Heavy Equipment</option>
                    <option value="DUMP_TRUCK">Dump Truck</option>
                    <option value="EXCAVATOR">Excavator</option>
                    <option value="DOZER">Bulldozer</option>
                    <option value="LIGHT_VEHICLE">Light Vehicle</option>
                    <option value="SUPPORT_EQUIPMENT">Support Equipment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">HM / KM Awal</label>
                  <input
                    type="number"
                    placeholder="Contoh: 12500"
                    value={newUnitHmKm || ''}
                    onChange={(e) => setNewUnitHmKm(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Serial Number (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: SN-HN500-9841"
                  value={newUnitSerial}
                  onChange={(e) => setNewUnitSerial(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddUnitModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingUnit}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold disabled:opacity-50"
                >
                  {savingUnit ? 'Menyimpan...' : 'Simpan Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ADD EMPLOYEE */}
      {showAddEmpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-cyan-500/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-cyan-400">
                <UserPlus className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">Tambah Karyawan / Mekanik Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddEmpModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Bambang Sugiharto"
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Posisi / Jabatan</label>
                <input
                  type="text"
                  placeholder="Contoh: Senior Heavy Equipment Mechanic"
                  value={newEmpPosition}
                  onChange={(e) => setNewEmpPosition(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is_mechanic_checkbox"
                  checked={newEmpIsMechanic}
                  onChange={(e) => setNewEmpIsMechanic(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <label htmlFor="is_mechanic_checkbox" className="text-slate-300 cursor-pointer">
                  Karyawan ini adalah Mekanik Lapangan (dapat dipilih di POS)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddEmpModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingEmp}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold disabled:opacity-50"
                >
                  {savingEmp ? 'Menyimpan...' : 'Simpan Karyawan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SITE (CREATE / EDIT) */}
      {showSiteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-cyan-500/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-cyan-400">
                <MapPin className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">
                  {siteModalMode === 'create' ? 'Tambah Titik Site Baru' : 'Edit Titik Site Operasional'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSiteModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSite} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">
                  Kode / ID Site {siteModalMode === 'create' ? '(Opsional, misal: SITE-VALE-D)' : '(ID Permanen)'}
                </label>
                <input
                  type="text"
                  disabled={siteModalMode === 'edit'}
                  placeholder="Auto-generate jika dikosongkan"
                  value={siteFormId}
                  onChange={(e) => setSiteFormId(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono uppercase focus:border-cyan-500 focus:outline-none disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Nama Titik Site *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Site Sorowako Blok D"
                  value={siteFormName}
                  onChange={(e) => setSiteFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Deskripsi / Detail Lokasi</label>
                <textarea
                  rows={3}
                  placeholder="Area tambang operasional Blok D PT Vale Indonesia..."
                  value={siteFormDesc}
                  onChange={(e) => setSiteFormDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="site_active_checkbox"
                  checked={siteFormActive}
                  onChange={(e) => setSiteFormActive(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <label htmlFor="site_active_checkbox" className="text-slate-300 cursor-pointer">
                  Status Titik Site Aktif (dapat dipilih pada transaksi POS dan unit)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSiteModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingSite}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold disabled:opacity-50"
                >
                  {savingSite ? 'Menyimpan...' : siteModalMode === 'create' ? 'Simpan Site' : 'Perbarui Site'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL WAREHOUSE (CREATE / EDIT) */}
      {showWarehouseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-cyan-500/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-cyan-400">
                <Building2 className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">
                  {warehouseModalMode === 'create' ? 'Tambah Gudang Logistik Baru' : 'Edit Konfigurasi Gudang'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWarehouseModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWarehouse} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">
                  ID Gudang {warehouseModalMode === 'create' ? '(Opsional, misal: WH-CONT-03 / WH-MAIN-AUX)' : '(ID Permanen)'}
                </label>
                <input
                  type="text"
                  disabled={warehouseModalMode === 'edit'}
                  placeholder="Auto-generate jika dikosongkan"
                  value={warehouseFormId}
                  onChange={(e) => setWarehouseFormId(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono uppercase focus:border-cyan-500 focus:outline-none disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Nama Gudang *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Gudang Kontainer Site C Petea"
                  value={warehouseFormName}
                  onChange={(e) => setWarehouseFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Tipe Gudang *</label>
                  <select
                    value={warehouseFormType}
                    onChange={(e) => setWarehouseFormType(e.target.value as any)}
                    className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="CONTAINER">Gudang Kontainer</option>
                    <option value="MAIN">Gudang Utama</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Kategori Armada *</label>
                  <select
                    value={warehouseFormCategory}
                    onChange={(e) => setWarehouseFormCategory(e.target.value as any)}
                    className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="HEAVY_EQUIPMENT">Alat Berat (Heavy Equipment)</option>
                    <option value="DUMP_TRUCK">Dump Truck</option>
                    <option value="GENERAL">Umum / Fasilitas Penunjang</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Deskripsi / Keterangan</label>
                <textarea
                  rows={3}
                  placeholder="Gudang kontainer operasional penyedia suku cadang cepat tanggap..."
                  value={warehouseFormDesc}
                  onChange={(e) => setWarehouseFormDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="warehouse_active_checkbox"
                  checked={warehouseFormActive}
                  onChange={(e) => setWarehouseFormActive(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <label htmlFor="warehouse_active_checkbox" className="text-slate-300 cursor-pointer">
                  Status Gudang Aktif (dapat digunakan untuk penyimpanan stok & transaksi)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowWarehouseModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingWarehouse}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold disabled:opacity-50"
                >
                  {savingWarehouse ? 'Menyimpan...' : warehouseModalMode === 'create' ? 'Simpan Gudang' : 'Perbarui Gudang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
