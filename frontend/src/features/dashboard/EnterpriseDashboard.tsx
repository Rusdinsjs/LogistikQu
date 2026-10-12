import React, { useState, useEffect } from 'react';
import {
  Coins,
  TrendingDown,
  Clock,
  AlertTriangle,
  Layers,
  Activity,
  Calendar,
  RefreshCw,
} from 'lucide-react';
import { dashboardApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  canViewFinancials,
  type EnterpriseKpiSummary,
  type FastSlowMovingPartItem,
  type StockAgingSummary,
} from '../../types';
import type { TabId } from '../../components/Sidebar';
import { StatCard, Badge, EmptyState, TableSkeleton } from '../../components/common';

interface EnterpriseDashboardProps {
  onNavigate: (tab: TabId) => void;
  warehouseId?: string;
}

export const EnterpriseDashboard: React.FC<EnterpriseDashboardProps> = ({
  onNavigate,
  warehouseId,
}) => {
  const { user } = useAuth();
  const hasFinancialAccess = canViewFinancials(user);

  const [kpi, setKpi] = useState<EnterpriseKpiSummary | null>(null);
  const [velocityItems, setVelocityItems] = useState<FastSlowMovingPartItem[]>([]);
  const [aging, setAging] = useState<StockAgingSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [velocityFilter, setVelocityFilter] = useState<'ALL' | 'FAST' | 'SLOW' | 'NON_MOVING'>('ALL');

  const loadData = async () => {
    setLoading(true);
    try {
      const [kpiData, velocityData, agingData] = await Promise.all([
        dashboardApi.getEnterpriseKpis(),
        dashboardApi.getStockVelocity(),
        dashboardApi.getStockAging(),
      ]);
      setKpi(kpiData);
      setVelocityItems(velocityData);
      setAging(agingData);
    } catch (err) {
      console.error('Gagal mengambil data Enterprise KPI', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [warehouseId]);

  const formatRupiah = (num?: number) => {
    if (num === undefined || num === null) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(num);
  };

  const filteredVelocityItems = velocityItems.filter((item) => {
    if (velocityFilter === 'FAST') return item.turnover_velocity === 'FAST_MOVING';
    if (velocityFilter === 'SLOW') return item.turnover_velocity === 'SLOW_MOVING';
    if (velocityFilter === 'NON_MOVING') return item.turnover_velocity === 'NON_MOVING';
    return true;
  });

  // Calculate Aging Percentages
  const totalAgingVal =
    (aging?.age_under_30_days_value || 0) +
    (aging?.age_31_to_90_days_value || 0) +
    (aging?.age_91_to_180_days_value || 0) +
    (aging?.age_over_180_days_value || 0);

  const totalAgingBatchCount =
    (aging?.age_under_30_days_count || 0) +
    (aging?.age_31_to_90_days_count || 0) +
    (aging?.age_91_to_180_days_count || 0) +
    (aging?.age_over_180_days_count || 0);

  const getAgingPercent = (val?: number, count?: number) => {
    if (hasFinancialAccess) {
      if (!totalAgingVal || !val) return 0;
      return Math.round((val / totalAgingVal) * 100);
    }
    if (!totalAgingBatchCount || !count) return 0;
    return Math.round((count / totalAgingBatchCount) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Enterprise KPI Row */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-cyan-400" />
            <span>Enterprise Warehouse Performance Metrics</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Konsolidasi valuasi persediaan, perputaran barang, dan mitigasi risiko logistik tambang.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Segarkan</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Stock Value / Total SKU Item */}
        {hasFinancialAccess ? (
          <StatCard
            title="Total Nilai Valuasi Stok"
            value={formatRupiah(kpi?.total_stock_value)}
            icon={Coins}
            colorScheme="cyan"
            subtext={`${kpi?.total_inventory_items || 0} part item di ${kpi?.total_warehouses || 0} gudang`}
            loading={loading}
          />
        ) : (
          <StatCard
            title="Total SKU Terpantau"
            value={`${kpi?.total_inventory_items || 0}`}
            unit="Item Part"
            icon={Layers}
            colorScheme="cyan"
            subtext={`Tersebar di ${kpi?.total_warehouses || 0} gudang aktif`}
            loading={loading}
          />
        )}

        {/* 30-Day Movement Balance */}
        <StatCard
          title="Mutasi Stok (30 Hari)"
          value={`${kpi?.stock_out_last_30d || 0}`}
          unit="PCS Keluar"
          icon={TrendingDown}
          colorScheme="purple"
          subtext={`Pemasukan: +${kpi?.stock_in_last_30d || 0} PCS | In-Transit: ${kpi?.total_in_transit_qty || 0}`}
          loading={loading}
        />

        {/* Pending Approvals */}
        <StatCard
          title="Menunggu Persetujuan"
          value={kpi?.pending_approvals_count || 0}
          unit="Dokumen"
          icon={Clock}
          colorScheme="amber"
          subtext="Permohonan replenishment & transfer pending"
          onClick={() => onNavigate('replenishment')}
          loading={loading}
        />

        {/* Low Stock Alerts */}
        <StatCard
          title="Peringatan Stok Kritis"
          value={kpi?.low_stock_items_count || 0}
          unit="Item"
          icon={AlertTriangle}
          colorScheme="rose"
          subtext="Di bawah ambang batas stok minimum"
          onClick={() => onNavigate('inventory')}
          loading={loading}
        />
      </div>

      {/* Stock Aging Analysis Section */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-cyan-400" />
              <span>Analisa Usia Simpan Stok (Stock Aging Distribution)</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Distribusi modal kerja berdasarkan durasi penyimpanan sejak mutasi penerimaan terakhir.
            </p>
          </div>
          <div className="text-xs font-mono text-cyan-300">
            {hasFinancialAccess
              ? `Total Valuasi: ${formatRupiah(totalAgingVal)}`
              : `Total Terpantau: ${totalAgingBatchCount} Batch`}
          </div>
        </div>

        {/* Aging Progress Stack Bar */}
        <div className="h-3 w-full rounded-full bg-slate-800/80 overflow-hidden flex mb-6">
          <div
            style={{ width: `${getAgingPercent(aging?.age_under_30_days_value, aging?.age_under_30_days_count)}%` }}
            className="bg-emerald-500 transition-all"
            title={`< 30 Hari: ${getAgingPercent(aging?.age_under_30_days_value, aging?.age_under_30_days_count)}%`}
          />
          <div
            style={{ width: `${getAgingPercent(aging?.age_31_to_90_days_value, aging?.age_31_to_90_days_count)}%` }}
            className="bg-cyan-500 transition-all"
            title={`31 - 90 Hari: ${getAgingPercent(aging?.age_31_to_90_days_value, aging?.age_31_to_90_days_count)}%`}
          />
          <div
            style={{ width: `${getAgingPercent(aging?.age_91_to_180_days_value, aging?.age_91_to_180_days_count)}%` }}
            className="bg-amber-500 transition-all"
            title={`91 - 180 Hari: ${getAgingPercent(aging?.age_91_to_180_days_value, aging?.age_91_to_180_days_count)}%`}
          />
          <div
            style={{ width: `${getAgingPercent(aging?.age_over_180_days_value, aging?.age_over_180_days_count)}%` }}
            className="bg-rose-500 transition-all"
            title={`> 180 Hari: ${getAgingPercent(aging?.age_over_180_days_value, aging?.age_over_180_days_count)}%`}
          />
        </div>

        {/* 4 Bucket Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* < 30 Days */}
          <div className="p-4 rounded-xl border border-emerald-900/30 bg-emerald-950/10">
            <div className="flex items-center justify-between text-xs text-emerald-400 mb-1 font-semibold">
              <span>&lt; 30 Hari (Aktif)</span>
              <span>{getAgingPercent(aging?.age_under_30_days_value, aging?.age_under_30_days_count)}%</span>
            </div>
            <div className="text-lg font-bold text-white">
              {hasFinancialAccess
                ? formatRupiah(aging?.age_under_30_days_value)
                : `${aging?.age_under_30_days_count || 0} Batch`}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {hasFinancialAccess
                ? `${aging?.age_under_30_days_count || 0} batch suku cadang`
                : 'Durasi simpan aktif'}
            </p>
          </div>

          {/* 31 - 90 Days */}
          <div className="p-4 rounded-xl border border-cyan-900/30 bg-cyan-950/10">
            <div className="flex items-center justify-between text-xs text-cyan-400 mb-1 font-semibold">
              <span>31 - 90 Hari (Normal)</span>
              <span>{getAgingPercent(aging?.age_31_to_90_days_value, aging?.age_31_to_90_days_count)}%</span>
            </div>
            <div className="text-lg font-bold text-white">
              {hasFinancialAccess
                ? formatRupiah(aging?.age_31_to_90_days_value)
                : `${aging?.age_31_to_90_days_count || 0} Batch`}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {hasFinancialAccess
                ? `${aging?.age_31_to_90_days_count || 0} batch suku cadang`
                : 'Durasi simpan normal'}
            </p>
          </div>

          {/* 91 - 180 Days */}
          <div className="p-4 rounded-xl border border-amber-900/30 bg-amber-950/10">
            <div className="flex items-center justify-between text-xs text-amber-400 mb-1 font-semibold">
              <span>91 - 180 Hari (Slow)</span>
              <span>{getAgingPercent(aging?.age_91_to_180_days_value, aging?.age_91_to_180_days_count)}%</span>
            </div>
            <div className="text-lg font-bold text-white">
              {hasFinancialAccess
                ? formatRupiah(aging?.age_91_to_180_days_value)
                : `${aging?.age_91_to_180_days_count || 0} Batch`}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {hasFinancialAccess
                ? `${aging?.age_91_to_180_days_count || 0} batch suku cadang`
                : 'Perputaran lambat'}
            </p>
          </div>

          {/* > 180 Days */}
          <div className="p-4 rounded-xl border border-rose-900/30 bg-rose-950/10">
            <div className="flex items-center justify-between text-xs text-rose-400 mb-1 font-semibold">
              <span>&gt; 180 Hari (Dead Stock)</span>
              <span>{getAgingPercent(aging?.age_over_180_days_value, aging?.age_over_180_days_count)}%</span>
            </div>
            <div className="text-lg font-bold text-white">
              {hasFinancialAccess
                ? formatRupiah(aging?.age_over_180_days_value)
                : `${aging?.age_over_180_days_count || 0} Batch`}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">
              {hasFinancialAccess
                ? `${aging?.age_over_180_days_count || 0} batch suku cadang`
                : 'Potensi dead stock'}
            </p>
          </div>
        </div>
      </div>

      {/* Stock Velocity Matrix (Fast vs Slow Moving Parts) */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div>
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Matriks Perputaran Suku Cadang (Fast & Slow Moving Analytics)</span>
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Evaluasi konsumsi 30 hari terakhir untuk mengoptimalkan kuota buffer dan meminimalisir dead-stock.
            </p>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setVelocityFilter('ALL')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                velocityFilter === 'ALL'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Semua ({velocityItems.length})
            </button>
            <button
              onClick={() => setVelocityFilter('FAST')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                velocityFilter === 'FAST'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Fast Moving
            </button>
            <button
              onClick={() => setVelocityFilter('SLOW')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                velocityFilter === 'SLOW'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Slow Moving
            </button>
            <button
              onClick={() => setVelocityFilter('NON_MOVING')}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                velocityFilter === 'NON_MOVING'
                  ? 'bg-slate-700/60 text-slate-200 border border-slate-600'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Non-Moving (Idle)
            </button>
          </div>
        </div>

        {/* Velocity Table */}
        {loading ? (
          <TableSkeleton rows={5} cols={hasFinancialAccess ? 8 : 6} />
        ) : filteredVelocityItems.length === 0 ? (
          <EmptyState
            title="Tidak Ada Data Perputaran"
            description="Tidak ditemukan suku cadang dengan kriteria filter kecepatan yang dipilih."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-3 font-semibold">Part Number</th>
                  <th className="pb-3 font-semibold">Nama Suku Cadang</th>
                  <th className="pb-3 font-semibold">Kategori</th>
                  <th className="pb-3 font-semibold text-right">Stok Fisik</th>
                  {hasFinancialAccess && <th className="pb-3 font-semibold text-right">Harga Satuan</th>}
                  {hasFinancialAccess && <th className="pb-3 font-semibold text-right">Nilai Total</th>}
                  <th className="pb-3 font-semibold text-center">Mutasi 30D</th>
                  <th className="pb-3 font-semibold text-center">Kecepatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredVelocityItems.map((item) => (
                  <tr key={item.spare_part_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 font-mono font-semibold text-cyan-300">
                      {item.spare_part_id}
                    </td>
                    <td className="py-3 text-slate-200">
                      <div className="font-medium">{item.part_name}</div>
                    </td>
                    <td className="py-3 text-slate-400">{item.category_name}</td>
                    <td className="py-3 text-right font-mono font-bold text-white">
                      {item.current_stock}{' '}
                      <span className="text-[10px] text-slate-400 font-normal">
                        {item.unit_of_measure}
                      </span>
                    </td>
                    {hasFinancialAccess && (
                      <td className="py-3 text-right font-mono text-slate-300">
                        {formatRupiah(item.unit_cost)}
                      </td>
                    )}
                    {hasFinancialAccess && (
                      <td className="py-3 text-right font-mono font-semibold text-white">
                        {formatRupiah(item.total_value)}
                      </td>
                    )}
                    <td className="py-3 text-center font-mono">
                      <span className="text-slate-300">{item.total_issued_30d}</span>
                      <span className="text-[10px] text-slate-500 ml-1">
                        ({item.issue_frequency}x)
                      </span>
                    </td>
                    <td className="py-3 text-center">
                      <Badge status={item.turnover_velocity} size="sm" withDot>
                        {item.turnover_velocity === 'FAST_MOVING'
                          ? 'Fast Moving'
                          : item.turnover_velocity === 'MODERATE'
                          ? 'Moderate'
                          : item.turnover_velocity === 'SLOW_MOVING'
                          ? 'Slow Moving'
                          : 'Non-Moving'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
