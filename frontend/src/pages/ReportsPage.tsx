import React, { useEffect, useState } from 'react';
import { reportsApi } from '../api';
import type { UnitReport, SiteReport, MechanicReport } from '../types';
import {
  BarChart3,
  Truck,
  MapPin,
  Wrench,
  RotateCcw,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'unit' | 'site' | 'mechanic'>('unit');
  const [loading, setLoading] = useState(false);

  const [unitReports, setUnitReports] = useState<UnitReport[]>([]);
  const [siteReports, setSiteReports] = useState<SiteReport[]>([]);
  const [mechanicReports, setMechanicReports] = useState<MechanicReport[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'unit') {
        const data = await reportsApi.byUnit();
        setUnitReports(data);
      } else if (activeTab === 'site') {
        const data = await reportsApi.bySite();
        setSiteReports(data);
      } else if (activeTab === 'mechanic') {
        const data = await reportsApi.byMechanic();
        setMechanicReports(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-cyan-400" />
            Laporan Analitik & Konsumsi Suku Cadang
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Transparansi pemakaian suku cadang per armada alat berat, titik site penambangan, dan instalasi teknisi.
          </p>
        </div>

        <button
          onClick={loadData}
          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-2 self-start sm:self-auto transition"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Segarkan
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('unit')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'unit'
              ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30 shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Truck className="w-4 h-4" /> Pemakaian per Unit Alat Berat
        </button>
        <button
          onClick={() => setActiveTab('site')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'site'
              ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30 shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <MapPin className="w-4 h-4" /> Pemakaian per Site
        </button>
        <button
          onClick={() => setActiveTab('mechanic')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
            activeTab === 'mechanic'
              ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30 shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Wrench className="w-4 h-4" /> Pemakaian per Mekanik
        </button>
      </div>

      {/* TAB CONTENT: UNIT */}
      {activeTab === 'unit' && (
        <div className="glass-card rounded-2xl overflow-hidden border border-slate-800/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Nomor Unit</th>
                  <th className="px-5 py-3.5">Model / Nama Unit</th>
                  <th className="px-5 py-3.5">Tipe Armada</th>
                  <th className="px-5 py-3.5 text-right">Frekuensi Transaksi</th>
                  <th className="px-5 py-3.5 text-right font-bold text-cyan-400">Total Part Dikonsumsi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-400">
                      Memuat laporan konsumsi per unit...
                    </td>
                  </tr>
                ) : unitReports.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-slate-500">
                      Belum ada histori pengeluaran suku cadang pada unit
                    </td>
                  </tr>
                ) : (
                  unitReports.map((r) => (
                    <tr key={r.unit_number} className="hover:bg-slate-800/30 transition">
                      <td className="px-5 py-4 font-mono font-bold text-cyan-400">{r.unit_number}</td>
                      <td className="px-5 py-4 font-semibold text-slate-200">{r.unit_name}</td>
                      <td className="px-5 py-4 text-xs text-slate-400">{r.unit_type}</td>
                      <td className="px-5 py-4 text-right font-mono text-slate-300">
                        {r.total_transactions} kali
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-bold text-cyan-400">
                        {r.total_parts_consumed} Item
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: SITE */}
      {activeTab === 'site' && (
        <div className="glass-card rounded-2xl overflow-hidden border border-slate-800/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Kode Site</th>
                  <th className="px-5 py-3.5">Nama Site Tambang</th>
                  <th className="px-5 py-3.5 text-right">Frekuensi Transaksi</th>
                  <th className="px-5 py-3.5 text-right font-bold text-cyan-400">Total Part Dikonsumsi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-400">
                      Memuat laporan konsumsi per site...
                    </td>
                  </tr>
                ) : siteReports.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-500">
                      Belum ada transaksi konsumsi per site
                    </td>
                  </tr>
                ) : (
                  siteReports.map((s) => (
                    <tr key={s.site_id} className="hover:bg-slate-800/30 transition">
                      <td className="px-5 py-4 font-mono font-bold text-cyan-400">{s.site_id}</td>
                      <td className="px-5 py-4 font-semibold text-slate-200">{s.site_name}</td>
                      <td className="px-5 py-4 text-right font-mono text-slate-300">
                        {s.total_transactions} kali
                      </td>
                      <td className="px-5 py-4 text-right font-mono font-bold text-cyan-400">
                        {s.total_parts_consumed} Item
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: MECHANIC */}
      {activeTab === 'mechanic' && (
        <div className="glass-card rounded-2xl overflow-hidden border border-slate-800/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Nama Teknisi / Mekanik</th>
                  <th className="px-5 py-3.5 text-right">Total Pekerjaan (Jobs)</th>
                  <th className="px-5 py-3.5 text-right font-bold text-cyan-400">Total Part Dipasang</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-slate-400">
                      Memuat laporan per teknisi...
                    </td>
                  </tr>
                ) : mechanicReports.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-slate-500">
                      Belum ada transaksi instalasi mekanik
                    </td>
                  </tr>
                ) : (
                  mechanicReports.map((m) => (
                    <tr key={m.mechanic_name} className="hover:bg-slate-800/30 transition">
                      <td className="px-5 py-4 font-semibold text-slate-200">{m.mechanic_name}</td>
                      <td className="px-5 py-4 text-right font-mono text-slate-300">{m.total_jobs} SPK</td>
                      <td className="px-5 py-4 text-right font-mono font-bold text-cyan-400">
                        {m.total_parts_installed} Item
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
