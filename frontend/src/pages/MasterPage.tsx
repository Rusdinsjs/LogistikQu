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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
          <Boxes className="w-7 h-7 text-cyan-400" />
          Master Data Operasional Tambang
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Katalog referensi suku cadang, armada alat berat/dump truck, mekanik, dan titik lokasi site PT Vale.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
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
                  <th className="px-5 py-3.5 text-right">Lead Time</th>
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
                      <td className="px-5 py-4 text-right text-xs text-slate-400">
                        {part.lead_time_days} Hari
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
    </div>
  );
};
