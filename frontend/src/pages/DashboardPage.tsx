import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { inventoryApi } from '../api';
import type { DashboardSummary, InventoryStockItem } from '../types';
import type { TabId } from '../components/Sidebar';
import {
  Boxes,
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  Warehouse,
  RotateCcw,
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (tab: TabId) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { activeWarehouse, activeWarehouseInfo } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [criticalItems, setCriticalItems] = useState<InventoryStockItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [sumData, stockData] = await Promise.all([
          inventoryApi.getDashboardSummary(activeWarehouse),
          inventoryApi.getStock(activeWarehouse),
        ]);
        setSummary(sumData);
        // filter critical items
        const crit = stockData.filter((i) => i.status === 'CRITICAL' || i.status === 'WARNING');
        setCriticalItems(crit);
      } catch (err) {
        console.error('Gagal mengambil data dashboard', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [activeWarehouse]);

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <Warehouse className="w-4 h-4" />
            <span>Pusat Kendali Persediaan & Traceability</span>
          </div>
          <h2 className="text-xl font-bold text-white">
            {activeWarehouseInfo?.name || 'Gudang Kontainer'}
          </h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xl">
            Sistem pengawasan persediaan kontainer terdistribusi, kontrol mutasi suku cadang harian,
            serta tata kelola suplai pasokan untuk mendukung armada tambang.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onNavigate('pos')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs shadow-lg shadow-cyan-500/20 transition-all"
          >
            <span>Input POS Issue</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onNavigate('returns')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 font-semibold text-xs transition-all shadow-sm shadow-amber-500/10"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>Retur Part Bekas</span>
          </button>
          <button
            onClick={() => onNavigate('replenishment')}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-all"
          >
            <span>Pengajuan Replenishment</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Stock */}
        <div className="glass-card rounded-xl p-4.5 border border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-medium">Total Item Dimonitor</span>
            <Boxes className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white">
            {loading ? '...' : summary?.total_parts_monitored || 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Suku cadang aktif terdaftar</p>
        </div>

        {/* Critical Stock */}
        <div className="glass-card rounded-xl p-4.5 border border-rose-900/30 bg-rose-950/10">
          <div className="flex items-center justify-between text-rose-300 mb-2">
            <span className="text-xs font-medium">Stok Kritis (≤ Min)</span>
            <AlertCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-400">
            {loading ? '...' : summary?.total_critical_items || 0}
          </div>
          <p className="text-[11px] text-rose-300/70 mt-1">Perlu replenishment segera</p>
        </div>

        {/* Warning Stock */}
        <div className="glass-card rounded-xl p-4.5 border border-amber-900/30 bg-amber-950/10">
          <div className="flex items-center justify-between text-amber-300 mb-2">
            <span className="text-xs font-medium">Mendekati Minimum</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400">
            {loading ? '...' : summary?.total_warning_items || 0}
          </div>
          <p className="text-[11px] text-amber-300/70 mt-1">Perlu pemantauan pasokan</p>
        </div>

        {/* Today Issues */}
        <div className="glass-card rounded-xl p-4.5 border border-emerald-900/30 bg-emerald-950/10">
          <div className="flex items-center justify-between text-emerald-300 mb-2">
            <span className="text-xs font-medium">Pengeluaran Hari Ini</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400">
            {loading ? '...' : summary?.today_issues_count || 0}{' '}
            <span className="text-xs font-normal text-emerald-300/70">transaksi</span>
          </div>
          <p className="text-[11px] text-emerald-300/70 mt-1">
            {summary?.today_items_released || 0} unit suku cadang
          </p>
        </div>
      </div>

      {/* Critical Stock Alert Table */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              Peringatan Kebutuhan Pasokan Segera
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Daftar suku cadang yang berada di bawah atau mendekati ambang batas minimum.
            </p>
          </div>
          <button
            onClick={() => onNavigate('inventory')}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
          >
            Lihat Semua Stok <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-3 font-semibold">Part Number</th>
                <th className="pb-3 font-semibold">Nama Spare Part</th>
                <th className="pb-3 font-semibold text-center">Status</th>
                <th className="pb-3 font-semibold text-right">Stok Fisik</th>
                <th className="pb-3 font-semibold text-right">Min Stok</th>
                <th className="pb-3 font-semibold">Lokasi Rak</th>
                <th className="pb-3 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {criticalItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    Semua stok berada pada level aman normal (🟢).
                  </td>
                </tr>
              ) : (
                criticalItems.slice(0, 5).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30">
                    <td className="py-3 font-mono font-semibold text-cyan-300">
                      {item.spare_part_id}
                    </td>
                    <td className="py-3 text-slate-200">
                      <div>{item.part_name}</div>
                      <div className="text-[10px] text-slate-500">{item.brand || '-'}</div>
                    </td>
                    <td className="py-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                          item.status === 'CRITICAL'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {item.status === 'CRITICAL' ? '🔴 Kritis' : '🟡 Menipis'}
                      </span>
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-white">
                      {item.qty_on_hand} <span className="text-[10px] text-slate-400 font-normal">{item.unit_of_measure}</span>
                    </td>
                    <td className="py-3 text-right font-mono text-slate-400">
                      {item.min_stock} {item.unit_of_measure}
                    </td>
                    <td className="py-3 text-slate-300 font-mono text-[11px]">
                      {item.rack_location || '-'}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => onNavigate('replenishment')}
                        className="px-2.5 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[11px] font-medium transition-colors"
                      >
                        Minta Suplai
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
  );
};
