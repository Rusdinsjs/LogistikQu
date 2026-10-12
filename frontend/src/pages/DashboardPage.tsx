import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { inventoryApi } from '../api';
import type { InventoryStockItem } from '../types';
import { isTabAccessible, type TabId } from '../components/Sidebar';
import { EnterpriseDashboard } from '../features/dashboard/EnterpriseDashboard';
import { Badge } from '../components/common/Badge';
import {
  ArrowRight,
  Warehouse,
  RotateCcw,
} from 'lucide-react';

interface DashboardPageProps {
  onNavigate: (tab: TabId) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { user, activeWarehouse, activeWarehouseInfo } = useAuth();
  const [criticalItems, setCriticalItems] = useState<InventoryStockItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const stockData = await inventoryApi.getStock(activeWarehouse);
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
            serta tata kelola suplai pasokan untuk mendukung armada.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {isTabAccessible('pos', user?.permissions, user?.role_id) && (
            <button
              onClick={() => onNavigate('pos')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <span>Input POS Issue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          {isTabAccessible('returns', user?.permissions, user?.role_id) && (
            <button
              onClick={() => onNavigate('returns')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 font-semibold text-xs transition-all shadow-sm shadow-amber-500/10 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Retur Part Bekas</span>
            </button>
          )}
          {isTabAccessible('replenishment', user?.permissions, user?.role_id) && (
            <button
              onClick={() => onNavigate('replenishment')}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-all cursor-pointer"
            >
              <span>Pengajuan Replenishment</span>
            </button>
          )}
        </div>
      </div>

      {/* Enterprise KPI & Analytics Dashboard Engine */}
      <EnterpriseDashboard onNavigate={onNavigate} warehouseId={activeWarehouse} />

      {/* Critical Stock Alert Table */}
      <div className="glass-panel rounded-2xl p-5 border border-slate-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
              Peringatan Kebutuhan Pasokan Segera ({activeWarehouseInfo?.name || activeWarehouse})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Daftar suku cadang yang berada di bawah atau mendekati ambang batas minimum pada gudang aktif.
            </p>
          </div>
          <button
            onClick={() => onNavigate('inventory')}
            className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium cursor-pointer"
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
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    Memuat data stok kritis...
                  </td>
                </tr>
              ) : criticalItems.length === 0 ? (
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
                      <Badge
                        status={item.status}
                        variant={item.status === 'CRITICAL' ? 'danger' : 'warning'}
                        withDot
                        pulse={item.status === 'CRITICAL'}
                      >
                        {item.status === 'CRITICAL' ? 'Kritis' : 'Menipis'}
                      </Badge>
                    </td>
                    <td className="py-3 text-right font-mono font-bold text-white">
                      {item.qty_on_hand}{' '}
                      <span className="text-[10px] text-slate-400 font-normal">
                        {item.unit_of_measure}
                      </span>
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
                        className="px-2.5 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[11px] font-medium transition-colors cursor-pointer"
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
