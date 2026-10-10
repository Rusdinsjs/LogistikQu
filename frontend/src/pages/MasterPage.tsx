import React, { useEffect, useState } from 'react';
import { masterApi } from '../api';
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
} from 'lucide-react';

export const MasterPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'parts' | 'equipment' | 'employees' | 'sites'>('parts');
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
        const [sitesData, whData] = await Promise.all([
          masterApi.getSites(),
          masterApi.getWarehouses(),
        ]);
        setSites(sitesData);
        setWarehouses(whData);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
          <Boxes className="w-7 h-7 text-cyan-400" />
          Master Data Operasional Tambang
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Katalog referensi suku cadang (termasuk aturan Core Return), armada alat berat, daftar mekanik, dan titik site PT Vale.
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
            <MapPin className="w-4 h-4" /> Site & Gudang
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
        </div>
      </div>

      {/* Search Bar */}
      {(activeTab === 'parts' || activeTab === 'equipment') && (
        <div className="glass-card p-4 rounded-xl flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              activeTab === 'parts'
                ? 'Cari nama suku cadang, part number...'
                : 'Cari kode unit (e.g. EX-201, DT-501)...'
            }
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-xs text-slate-400 hover:text-white">
              Hapus
            </button>
          )}
        </div>
      )}

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

      {/* TAB CONTENT: SITES & WAREHOUSES */}
      {activeTab === 'sites' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sites */}
          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan-400" />
              Titik Site Operasional Tambang
            </h3>
            <div className="space-y-3">
              {sites.map((st) => (
                <div key={st.id} className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{st.name}</span>
                    <span className="font-mono text-xs text-cyan-400">{st.id}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">{st.description || 'Area Penambangan Vale'}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Warehouses */}
          <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-cyan-400" />
              Daftar Gudang (Utama & Kontainer)
            </h3>
            <div className="space-y-3">
              {warehouses.map((wh) => (
                <div key={wh.id} className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-200">{wh.name}</span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-cyan-300 border border-slate-700">
                      {wh.warehouse_type}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">{wh.description || ('Kategori: ' + wh.category)}</div>
                  <div className="font-mono text-[11px] text-slate-500 mt-1">ID: {wh.id}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Equipment */}
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

      {/* Modal Add Employee */}
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
    </div>
  );
};
