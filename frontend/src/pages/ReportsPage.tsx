import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { reportsApi } from '../api';
import {
  canViewFinancials,
  type StockBalanceReportItem,
  type StockValuationReportItem,
  type StockAgingReportItem,
  type IssueHistoryReportItem,
  type ConsumptionTrendReportItem,
  type EquipmentConsumptionReportItem,
  type WarehousePerformanceReportItem,
  type ReplenishmentEfficiencyReportItem,
  type SiteReport,
  type MechanicReport,
} from '../types';
import {
  BarChart3,
  Boxes,
  Truck,
  FileSpreadsheet,
  Printer,
  RotateCcw,
  Activity,
  Sparkles,
  Eye,
  Table as TableIcon,
  Coins,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Wrench,
  MapPin,
  TrendingUp,
  Layers,
} from 'lucide-react';
import { Badge, TableSkeleton } from '../components/common';
import { exportToExcel } from '../utils/exportExcel';
import { printOrExportPdf } from '../utils/exportPdf';
import {
  getUserFleetCategory,
  isUnitNumberInCategory,
  isWarehouseInCategory,
  isDumpTruckUnitRaw,
} from '../utils/fleetCategory';
import {
  ReportKpiCard,
  HorizontalBarChart,
  DonutChart,
  AreaTrendChart,
  LeaderboardCard,
  ReportRecommendationsModal,
  formatRupiah,
  formatNumber,
  type BarItem,
  type DonutItem,
  type TrendPoint,
  type LeaderboardItem,
} from '../features/reports/components/ReportVisuals';

type ReportCategory = 'INVENTORY' | 'OPERATION' | 'MANAGEMENT';
type ReportType =
  | 'stock_balance'
  | 'stock_valuation'
  | 'stock_aging'
  | 'issue_history'
  | 'consumption_trend'
  | 'equipment_consumption'
  | 'site_consumption'
  | 'mechanic_consumption'
  | 'warehouse_performance'
  | 'replenishment_efficiency';

type ViewMode = 'both' | 'charts' | 'table';

export const ReportsPage: React.FC = () => {
  const { user, activeWarehouse } = useAuth();
  const hasFinancialAccess = canViewFinancials(user);
  const userDivision = getUserFleetCategory(user);
  const [category, setCategory] = useState<ReportCategory>('INVENTORY');
  const [reportType, setReportType] = useState<ReportType>('stock_balance');
  const [viewMode, setViewMode] = useState<ViewMode>('both');
  const [loading, setLoading] = useState(false);
  const [useActiveWarehouseOnly, setUseActiveWarehouseOnly] = useState(false);
  const [showRecommendationsModal, setShowRecommendationsModal] = useState(false);

  // Data states
  const [stockBalance, setStockBalance] = useState<StockBalanceReportItem[]>([]);
  const [stockValuation, setStockValuation] = useState<StockValuationReportItem[]>([]);
  const [stockAging, setStockAging] = useState<StockAgingReportItem[]>([]);
  const [issueHistory, setIssueHistory] = useState<IssueHistoryReportItem[]>([]);
  const [consumptionTrend, setConsumptionTrend] = useState<ConsumptionTrendReportItem[]>([]);
  const [equipmentConsumption, setEquipmentConsumption] = useState<EquipmentConsumptionReportItem[]>([]);
  const [siteReports, setSiteReports] = useState<SiteReport[]>([]);
  const [mechanicReports, setMechanicReports] = useState<MechanicReport[]>([]);
  const [warehousePerformance, setWarehousePerformance] = useState<WarehousePerformanceReportItem[]>([]);
  const [replenishmentEfficiency, setReplenishmentEfficiency] = useState<ReplenishmentEfficiencyReportItem[]>([]);

  const whFilter = useActiveWarehouseOnly ? activeWarehouse : undefined;

  const loadData = async () => {
    setLoading(true);
    try {
      if (reportType === 'stock_balance') {
        const data = await reportsApi.getStockBalance(whFilter);
        setStockBalance(data.filter((d) => isWarehouseInCategory(d.warehouse_id, d.warehouse_name, userDivision)));
      } else if (reportType === 'stock_valuation') {
        if (!hasFinancialAccess) {
          setReportType('stock_balance');
          return;
        }
        const data = await reportsApi.getStockValuation(whFilter);
        setStockValuation(data.filter((d) => isWarehouseInCategory(d.warehouse_id, d.warehouse_name, userDivision)));
      } else if (reportType === 'stock_aging') {
        const data = await reportsApi.getStockAging(whFilter);
        setStockAging(data.filter((d) => isWarehouseInCategory(d.warehouse_id, d.warehouse_name, userDivision)));
      } else if (reportType === 'issue_history') {
        const data = await reportsApi.getIssueHistory({ warehouse_id: whFilter, limit: 100 });
        setIssueHistory(data.filter((d) => isUnitNumberInCategory(d.unit_number, undefined, undefined, userDivision)));
      } else if (reportType === 'consumption_trend') {
        const data = await reportsApi.getConsumptionTrend(whFilter);
        setConsumptionTrend(data);
      } else if (reportType === 'equipment_consumption') {
        const data = await reportsApi.getEquipmentConsumption();
        setEquipmentConsumption(
          data.filter((d) => isUnitNumberInCategory(d.equipment_number, d.equipment_type, d.model, userDivision))
        );
      } else if (reportType === 'site_consumption') {
        const data = await reportsApi.bySite();
        setSiteReports(data);
      } else if (reportType === 'mechanic_consumption') {
        const data = await reportsApi.byMechanic();
        setMechanicReports(data);
      } else if (reportType === 'warehouse_performance') {
        const data = await reportsApi.getWarehousePerformance();
        setWarehousePerformance(data.filter((d) => isWarehouseInCategory(d.warehouse_id, d.warehouse_name, userDivision)));
      } else if (reportType === 'replenishment_efficiency') {
        const data = await reportsApi.getReplenishmentEfficiency(whFilter);
        setReplenishmentEfficiency(
          data.filter((d) =>
            isWarehouseInCategory(d.container_warehouse_id, d.container_warehouse_name, userDivision)
          )
        );
      }
    } catch (err) {
      console.error('Gagal mengambil data laporan:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [reportType, useActiveWarehouseOnly, activeWarehouse]);

  // Set default report type when category switches
  const handleCategoryChange = (cat: ReportCategory) => {
    setCategory(cat);
    if (cat === 'INVENTORY') setReportType('stock_balance');
    if (cat === 'OPERATION') setReportType('issue_history');
    if (cat === 'MANAGEMENT') setReportType('warehouse_performance');
  };

  // --- Handlers for Export ---
  const handleExportExcel = () => {
    const filename = `LogisticQu_${reportType}`;
    if (reportType === 'stock_balance') {
      exportToExcel(stockBalance, filename, 'Saldo Stok');
    } else if (reportType === 'stock_valuation') {
      if (hasFinancialAccess) exportToExcel(stockValuation, filename, 'Valuasi Stok');
    } else if (reportType === 'stock_aging') {
      const sanitized = hasFinancialAccess
        ? stockAging
        : stockAging.map(({ unit_cost, total_value, ...rest }) => rest);
      exportToExcel(sanitized, filename, 'Usia Simpan');
    } else if (reportType === 'issue_history') {
      const sanitized = hasFinancialAccess
        ? issueHistory
        : issueHistory.map(({ unit_price, total_price, ...rest }) => rest);
      exportToExcel(sanitized, filename, 'Histori Issue');
    } else if (reportType === 'consumption_trend') {
      const sanitized = hasFinancialAccess
        ? consumptionTrend
        : consumptionTrend.map(({ total_value, ...rest }) => rest);
      exportToExcel(sanitized, filename, 'Tren Konsumsi');
    } else if (reportType === 'equipment_consumption') {
      const sanitized = hasFinancialAccess
        ? equipmentConsumption
        : equipmentConsumption.map(({ total_cost, cost_per_hm, ...rest }) => rest);
      exportToExcel(sanitized, filename, 'Konsumsi Armada');
    } else if (reportType === 'site_consumption') {
      exportToExcel(siteReports, filename, 'Konsumsi per Site');
    } else if (reportType === 'mechanic_consumption') {
      exportToExcel(mechanicReports, filename, 'Aktivitas Mekanik');
    } else if (reportType === 'warehouse_performance') {
      const sanitized = hasFinancialAccess
        ? warehousePerformance
        : warehousePerformance.map(({ total_valuation, ...rest }) => rest);
      exportToExcel(sanitized, filename, 'Kinerja Gudang');
    } else if (reportType === 'replenishment_efficiency') {
      exportToExcel(replenishmentEfficiency, filename, 'Efisiensi Pengadaan');
    }
  };

  const handlePrintPdf = () => {
    const generatedBy = user?.full_name || 'Admin Logistik';

    if (reportType === 'stock_balance') {
      printOrExportPdf({
        title: 'LAPORAN SALDO STOK FISIK PERSEDIAAN',
        subtitle: `Data inventaris gudang - Status per ${new Date().toLocaleDateString('id-ID')}`,
        generatedBy,
        columns: [
          { header: 'Part Number', key: 'spare_part_id' },
          { header: 'Nama Spare Part', key: 'part_name' },
          { header: 'Gudang', key: 'warehouse_name' },
          { header: 'Rak', key: 'rack_location' },
          { header: 'Stok Fisik', key: 'qty_on_hand' },
          { header: 'Satuan', key: 'unit_of_measure' },
          { header: 'Min Stok', key: 'min_stock' },
          { header: 'Status', key: 'status' },
        ],
        data: stockBalance,
      });
    } else if (reportType === 'stock_valuation') {
      if (!hasFinancialAccess) return;
      printOrExportPdf({
        title: 'LAPORAN VALUASI MODAL KERJA & PERSEDIAAN',
        subtitle: 'Distribusi nilai kapital per suku cadang',
        generatedBy,
        columns: [
          { header: 'Part Number', key: 'spare_part_id' },
          { header: 'Nama Spare Part', key: 'part_name' },
          { header: 'Gudang', key: 'warehouse_name' },
          { header: 'Stok Fisik', key: 'qty_on_hand' },
          { header: 'Harga Satuan', key: 'unit_cost', format: (v) => formatRupiah(v) },
          { header: 'Total Nilai', key: 'total_value', format: (v) => formatRupiah(v) },
          { header: 'Pangsa (%)', key: 'share_percentage', format: (v) => `${v}%` },
        ],
        data: stockValuation,
      });
    } else if (reportType === 'stock_aging') {
      const columns = [
        { header: 'Part Number', key: 'spare_part_id' as const },
        { header: 'Nama Spare Part', key: 'part_name' as const },
        { header: 'Gudang', key: 'warehouse_name' as const },
        { header: 'Stok Fisik', key: 'qty' as const },
        ...(hasFinancialAccess
          ? [{ header: 'Total Nilai', key: 'total_value' as const, format: (v: any) => formatRupiah(v) }]
          : []),
        { header: 'Hari Simpan', key: 'days_in_inventory' as const, format: (v: any) => `${v} hari` },
        { header: 'Kategori Aging', key: 'aging_bucket' as const },
      ];
      printOrExportPdf({
        title: 'LAPORAN USIA SIMPAN STOK (AGING)',
        subtitle: 'Analisa durasi simpan suku cadang',
        generatedBy,
        columns,
        data: stockAging,
      });
    } else if (reportType === 'issue_history') {
      const columns = [
        { header: 'No. Transaksi', key: 'transaction_number' as const },
        { header: 'Tanggal', key: 'issued_at' as const, format: (v: any) => new Date(v).toLocaleDateString('id-ID') },
        { header: 'No. Unit', key: 'unit_number' as const },
        { header: 'Part Number', key: 'spare_part_id' as const },
        { header: 'Qty', key: 'qty' as const },
        { header: 'Penerima', key: 'receiver_name' as const },
        { header: 'Mekanik', key: 'mechanic_name' as const },
        ...(hasFinancialAccess
          ? [{ header: 'Total Harga', key: 'total_price' as const, format: (v: any) => formatRupiah(v) }]
          : []),
      ];
      printOrExportPdf({
        title: 'LAPORAN HISTORI TRANSAKSI PENGELUARAN (POS ISSUE)',
        subtitle: 'Log transaksi pemakaian suku cadang dengan traceability armada',
        generatedBy,
        columns,
        data: issueHistory,
      });
    } else if (reportType === 'consumption_trend') {
      const columns = [
        { header: 'Periode (Bulan)', key: 'period' as const },
        { header: 'Kategori Suku Cadang', key: 'category_name' as const },
        { header: 'Jumlah Transaksi', key: 'total_transactions' as const },
        { header: 'Total Qty Dikeluarkan', key: 'total_qty' as const },
        ...(hasFinancialAccess
          ? [{ header: 'Total Nilai Pemakaian', key: 'total_value' as const, format: (v: any) => formatRupiah(v) }]
          : []),
      ];
      printOrExportPdf({
        title: 'LAPORAN TREN KONSUMSI SUKU CADANG BULANAN',
        subtitle: 'Analisis pergerakan volume dan nilai konsumsi material',
        generatedBy,
        columns,
        data: consumptionTrend,
      });
    } else if (reportType === 'equipment_consumption') {
      const columns = [
        { header: 'No. Unit', key: 'equipment_number' as const },
        { header: 'Tipe & Model', key: 'equipment_type' as const },
        { header: 'Site', key: 'site' as const },
        { header: 'Hour Meter (HM)', key: 'current_hm' as const },
        { header: 'Total Transaksi', key: 'total_transactions' as const },
        ...(hasFinancialAccess
          ? [
              { header: 'Total Biaya', key: 'total_cost' as const, format: (v: any) => formatRupiah(v) },
              { header: 'Biaya / HM', key: 'cost_per_hm' as const, format: (v: any) => formatRupiah(v) },
            ]
          : []),
      ];
      printOrExportPdf({
        title: 'LAPORAN KONSUMSI SUKU CADANG PER ARMADA UNIT',
        subtitle: 'Evaluasi biaya pemeliharaan armada dan efisiensi Cost per HM',
        generatedBy,
        columns,
        data: equipmentConsumption,
      });
    } else if (reportType === 'site_consumption') {
      printOrExportPdf({
        title: 'LAPORAN KONSUMSI SUKU CADANG PER SITE',
        subtitle: 'Distribusi pemakaian persediaan per lokasi operasional',
        generatedBy,
        columns: [
          { header: 'ID Site', key: 'site_id' },
          { header: 'Nama Site', key: 'site_name' },
          { header: 'Total Transaksi', key: 'total_transactions' },
          { header: 'Total Part Terpakai', key: 'total_parts_consumed' },
        ],
        data: siteReports,
      });
    } else if (reportType === 'mechanic_consumption') {
      printOrExportPdf({
        title: 'LAPORAN AKTIVITAS & PEMAKAIAN PART OLEH MEKANIK',
        subtitle: 'Akuntabilitas penanganan unit dan pemasangan suku cadang',
        generatedBy,
        columns: [
          { header: 'Nama Mekanik', key: 'mechanic_name' },
          { header: 'Total Pekerjaan / Work Order', key: 'total_jobs' },
          { header: 'Total Part Dipasang', key: 'total_parts_installed' },
        ],
        data: mechanicReports,
      });
    } else if (reportType === 'warehouse_performance') {
      const columns = [
        { header: 'ID Gudang', key: 'warehouse_id' as const },
        { header: 'Nama Gudang', key: 'warehouse_name' as const },
        { header: 'Tipe', key: 'warehouse_type' as const },
        { header: 'Total SKU', key: 'total_skus' as const },
        ...(hasFinancialAccess
          ? [{ header: 'Total Valuasi', key: 'total_valuation' as const, format: (v: any) => formatRupiah(v) }]
          : []),
        { header: 'Issue 30D', key: 'total_issues_30d' as const },
        { header: 'Drop STO 30D', key: 'total_drops_30d' as const },
        { header: 'Turnover Ratio', key: 'turnover_ratio' as const },
        { header: 'Stok Kritis', key: 'low_stock_count' as const },
      ];
      printOrExportPdf({
        title: 'LAPORAN KINERJA PERGUDANGAN (WAREHOUSE PERFORMANCE)',
        subtitle: 'Evaluasi operasional, valuasi, dan perputaran persediaan per gudang',
        generatedBy,
        columns,
        data: warehousePerformance,
      });
    } else if (reportType === 'replenishment_efficiency') {
      printOrExportPdf({
        title: 'LAPORAN EFISIENSI PENGADAAN & LEAD TIME REPLENISHMENT',
        subtitle: 'Akurasi pemenuhan stok kontainer dan durasi pengadaan',
        generatedBy,
        columns: [
          { header: 'No. Permohonan', key: 'request_number' },
          { header: 'Gudang Pemohon', key: 'container_warehouse_name' },
          { header: 'Status', key: 'status' },
          { header: 'Lead Time (Jam)', key: 'lead_time_hours', format: (v) => (v ? `${v} jam` : '-') },
          { header: 'Qty Minta', key: 'total_qty_requested' },
          { header: 'Qty Terima', key: 'total_qty_received' },
          { header: 'Akurasi (%)', key: 'fulfillment_accuracy_percent', format: (v) => `${v}%` },
        ],
        data: replenishmentEfficiency,
      });
    }
  };

  // --- Rendering Visual Analytics Section for Current Report ---
  const renderVisualAnalytics = () => {
    if (loading) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-900/60 border border-slate-800" />
          ))}
        </div>
      );
    }

    // 1. Stock Balance Visuals
    if (reportType === 'stock_balance') {
      const totalSKUs = stockBalance.length;
      const normalCount = stockBalance.filter((i) => i.status === 'NORMAL').length;
      const warningCount = stockBalance.filter((i) => i.status === 'WARNING').length;
      const criticalCount = stockBalance.filter((i) => i.status === 'CRITICAL').length;
      const healthPercent = totalSKUs > 0 ? Math.round((normalCount / totalSKUs) * 100) : 100;

      const donutData: DonutItem[] = [
        {
          id: 'normal',
          label: 'Stok Normal (Aman)',
          value: normalCount,
          color: '#10b981',
          sublabel: 'Di atas ambang minimum',
        },
        {
          id: 'warning',
          label: 'Stok Peringatan (Buffer)',
          value: warningCount,
          color: '#f59e0b',
          sublabel: 'Mendekati safety stock',
        },
        {
          id: 'critical',
          label: 'Stok Kritis (Out-of-Stock)',
          value: criticalCount,
          color: '#f43f5e',
          sublabel: 'Segera lakukan drop STO',
        },
      ];

      const topStockItems: BarItem[] = stockBalance
        .slice()
        .sort((a, b) => b.qty_on_hand - a.qty_on_hand)
        .slice(0, 8)
        .map((item) => ({
          id: item.spare_part_id,
          label: item.part_name,
          sublabel: `${item.spare_part_id} • Min: ${item.min_stock} ${item.unit_of_measure}`,
          value: item.qty_on_hand,
          formattedValue: `${formatNumber(item.qty_on_hand)} ${item.unit_of_measure}`,
          color: item.status === 'CRITICAL' ? '#f43f5e' : item.status === 'WARNING' ? '#f59e0b' : '#06b6d4',
          tag: item.warehouse_name,
        }));

      return (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ReportKpiCard
              title="Total SKU Terpantau"
              value={formatNumber(totalSKUs)}
              subtext="Suku cadang aktif dalam inventaris"
              icon={Boxes}
              colorScheme="cyan"
              badge="Semua Gudang"
            />
            <ReportKpiCard
              title="Stok Normal & Sehat"
              value={formatNumber(normalCount)}
              subtext={`${healthPercent}% persediaan beroperasi aman`}
              icon={CheckCircle2}
              colorScheme="emerald"
              badge={`${healthPercent}%`}
            />
            <ReportKpiCard
              title="Stok Peringatan (Warning)"
              value={formatNumber(warningCount)}
              subtext="Mendekati reorder point"
              icon={Clock}
              colorScheme="amber"
            />
            <ReportKpiCard
              title="Stok Kritis (Critical)"
              value={formatNumber(criticalCount)}
              subtext="Di bawah ambang batas minimum"
              icon={AlertTriangle}
              colorScheme="rose"
              badge={criticalCount > 0 ? 'Tindakan Segera' : 'Nol Kritis'}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5">
              <DonutChart
                title="Status Kesehatan Persediaan (Buffer Health)"
                subtitle="Komposisi suku cadang berdasarkan kriteria ketersediaan on-hand"
                items={donutData}
                centerLabel="Indeks Sehat"
                centerValue={`${healthPercent}%`}
              />
            </div>
            <div className="lg:col-span-7">
              <HorizontalBarChart
                title="Top 8 Suku Cadang Stok Terbanyak"
                subtitle="Volume fisik suku cadang on-hand tertinggi dalam gudang"
                items={topStockItems}
              />
            </div>
          </div>
        </div>
      );
    }

    // 2. Stock Valuation Visuals
    if (reportType === 'stock_valuation' && hasFinancialAccess) {
      const totalValuation = stockValuation.reduce((acc, curr) => acc + curr.total_value, 0);
      const totalQuantity = stockValuation.reduce((acc, curr) => acc + curr.qty_on_hand, 0);
      const avgValuePerSku = stockValuation.length > 0 ? totalValuation / stockValuation.length : 0;
      const highestValuedPart = stockValuation.slice().sort((a, b) => b.total_value - a.total_value)[0];

      // Valuation per warehouse
      const warehouseMap = new Map<string, number>();
      stockValuation.forEach((item) => {
        warehouseMap.set(item.warehouse_name, (warehouseMap.get(item.warehouse_name) || 0) + item.total_value);
      });
      const warehouseColors = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'];
      const warehouseDonut: DonutItem[] = Array.from(warehouseMap.entries()).map(([whName, val], idx) => ({
        id: whName,
        label: whName,
        value: val,
        formattedValue: formatRupiah(val),
        color: warehouseColors[idx % warehouseColors.length],
      }));

      const topInvestments: BarItem[] = stockValuation
        .slice()
        .sort((a, b) => b.total_value - a.total_value)
        .slice(0, 8)
        .map((item) => ({
          id: item.spare_part_id,
          label: item.part_name,
          sublabel: `${item.spare_part_id} • ${item.qty_on_hand} PCS @ ${formatRupiah(item.unit_cost)}`,
          value: item.total_value,
          formattedValue: formatRupiah(item.total_value),
          color: '#06b6d4',
          tag: `${item.share_percentage}% modal`,
        }));

      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ReportKpiCard
              title="Total Nilai Kapital Persediaan"
              value={formatRupiah(totalValuation)}
              subtext="Konsolidasi modal kerja on-hand"
              icon={Coins}
              colorScheme="cyan"
              badge="Modal Kerja"
            />
            <ReportKpiCard
              title="Rata-rata Nilai per SKU"
              value={formatRupiah(avgValuePerSku)}
              subtext={`Dari ${stockValuation.length} item katalog terdaftar`}
              icon={Layers}
              colorScheme="violet"
            />
            <ReportKpiCard
              title="SKU Investasi Tertinggi"
              value={highestValuedPart ? formatRupiah(highestValuedPart.total_value) : 'Rp 0'}
              subtext={highestValuedPart ? highestValuedPart.part_name : '-'}
              icon={TrendingUp}
              colorScheme="emerald"
            />
            <ReportKpiCard
              title="Total Kuantitas Fisik"
              value={`${formatNumber(totalQuantity)} PCS`}
              subtext="Akumulasi seluruh suku cadang"
              icon={Boxes}
              colorScheme="sky"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5">
              <DonutChart
                title="Pangsa Modal Kerja per Gudang"
                subtitle="Distribusi alokasi kapital persediaan antara Gudang Utama dan Kontainer"
                items={warehouseDonut}
                centerLabel="Total Kapital"
                centerValue={formatRupiah(totalValuation)}
              />
            </div>
            <div className="lg:col-span-7">
              <HorizontalBarChart
                title="Top 8 Investasi Nilai Modal Suku Cadang Terbesar"
                subtitle="Suku cadang bernilai modal tinggi (Kelas A Pareto)"
                items={topInvestments}
              />
            </div>
          </div>
        </div>
      );
    }

    // 3. Stock Aging Visuals
    if (reportType === 'stock_aging') {
      const under30 = stockAging.filter((i) => i.aging_bucket === '< 30 Hari');
      const d31to90 = stockAging.filter((i) => i.aging_bucket === '31-90 Hari');
      const d91to180 = stockAging.filter((i) => i.aging_bucket === '91-180 Hari');
      const over180 = stockAging.filter((i) => i.aging_bucket === '> 180 Hari');

      const valUnder30 = under30.reduce((acc, c) => acc + (c.total_value || 0), 0);
      const val31to90 = d31to90.reduce((acc, c) => acc + (c.total_value || 0), 0);
      const val91to180 = d91to180.reduce((acc, c) => acc + (c.total_value || 0), 0);
      const valOver180 = over180.reduce((acc, c) => acc + (c.total_value || 0), 0);
      const totalVal = valUnder30 + val31to90 + val91to180 + valOver180;

      const agingDonut: DonutItem[] = [
        {
          id: 'tier1',
          label: '< 30 Hari (Aktif)',
          value: hasFinancialAccess ? valUnder30 : under30.length,
          formattedValue: hasFinancialAccess ? formatRupiah(valUnder30) : `${under30.length} Batch`,
          color: '#10b981',
          sublabel: 'Turnover cepat',
        },
        {
          id: 'tier2',
          label: '31 - 90 Hari (Normal)',
          value: hasFinancialAccess ? val31to90 : d31to90.length,
          formattedValue: hasFinancialAccess ? formatRupiah(val31to90) : `${d31to90.length} Batch`,
          color: '#06b6d4',
          sublabel: 'Perputaran wajar',
        },
        {
          id: 'tier3',
          label: '91 - 180 Hari (Slow)',
          value: hasFinancialAccess ? val91to180 : d91to180.length,
          formattedValue: hasFinancialAccess ? formatRupiah(val91to180) : `${d91to180.length} Batch`,
          color: '#f59e0b',
          sublabel: 'Perlu review buffer',
        },
        {
          id: 'tier4',
          label: '> 180 Hari (Dead Stock)',
          value: hasFinancialAccess ? valOver180 : over180.length,
          formattedValue: hasFinancialAccess ? formatRupiah(valOver180) : `${over180.length} Batch`,
          color: '#f43f5e',
          sublabel: 'Risiko modal beku',
        },
      ];

      const oldestItems: BarItem[] = stockAging
        .slice()
        .sort((a, b) => b.days_in_inventory - a.days_in_inventory)
        .slice(0, 8)
        .map((item) => ({
          id: item.spare_part_id,
          label: item.part_name,
          sublabel: `${item.spare_part_id} • ${item.warehouse_name} • ${item.qty} PCS`,
          value: item.days_in_inventory,
          formattedValue: `${item.days_in_inventory} hari`,
          color:
            item.days_in_inventory > 180
              ? '#f43f5e'
              : item.days_in_inventory > 90
              ? '#f59e0b'
              : '#06b6d4',
          tag: item.aging_bucket,
        }));

      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ReportKpiCard
              title="< 30 Hari (Aktif)"
              value={hasFinancialAccess ? formatRupiah(valUnder30) : `${under30.length} Batch`}
              subtext="Perputaran stok aktif lancar"
              icon={CheckCircle2}
              colorScheme="emerald"
            />
            <ReportKpiCard
              title="31 - 90 Hari (Normal)"
              value={hasFinancialAccess ? formatRupiah(val31to90) : `${d31to90.length} Batch`}
              subtext="Durasi penyimpanan wajar"
              icon={Clock}
              colorScheme="cyan"
            />
            <ReportKpiCard
              title="91 - 180 Hari (Slow)"
              value={hasFinancialAccess ? formatRupiah(val91to180) : `${d91to180.length} Batch`}
              subtext="Suku cadang bergerak lambat"
              icon={AlertTriangle}
              colorScheme="amber"
            />
            <ReportKpiCard
              title="> 180 Hari (Dead Stock)"
              value={hasFinancialAccess ? formatRupiah(valOver180) : `${over180.length} Batch`}
              subtext="Risiko modal beku / usang"
              icon={Coins}
              colorScheme="rose"
              badge={over180.length > 0 ? 'Perlu Audit' : 'Aman'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5">
              <DonutChart
                title="Distribusi Usia Simpan Stok"
                subtitle="Persentase suku cadang berdasarkan rentang durasi hari di gudang"
                items={agingDonut}
                centerLabel={hasFinancialAccess ? 'Total Valuasi' : 'Total Batch'}
                centerValue={hasFinancialAccess ? formatRupiah(totalVal) : `${stockAging.length}`}
              />
            </div>
            <div className="lg:col-span-7">
              <HorizontalBarChart
                title="Top 8 Suku Cadang Mengendap Terlama (Aging Terpanjang)"
                subtitle="Identifikasi suku cadang yang paling lama tidak bergerak sejak penerimaan"
                items={oldestItems}
              />
            </div>
          </div>
        </div>
      );
    }

    // 4. Issue History Visuals
    if (reportType === 'issue_history') {
      const totalTx = issueHistory.length;
      const totalQty = issueHistory.reduce((acc, curr) => acc + curr.qty, 0);
      const totalCost = issueHistory.reduce((acc, curr) => acc + (curr.total_price || 0), 0);

      // Top units consuming parts
      const unitMap = new Map<string, { qty: number; count: number }>();
      issueHistory.forEach((item) => {
        const existing = unitMap.get(item.unit_number) || { qty: 0, count: 0 };
        unitMap.set(item.unit_number, {
          qty: existing.qty + item.qty,
          count: existing.count + 1,
        });
      });
      const topUnits: LeaderboardItem[] = Array.from(unitMap.entries())
        .sort((a, b) => b[1].qty - a[1].qty)
        .slice(0, 5)
        .map(([unitNum, data], idx) => ({
          id: unitNum,
          rank: idx + 1,
          title: `Unit ${unitNum}`,
          subtitle: `${data.count} kali transaksi pengeluaran`,
          metric: `${data.qty} PCS`,
          badge: isDumpTruckUnitRaw(unitNum) ? 'Dump Truck (DT)' : 'Heavy Equipment (HE)',
        }));

      // Top spare parts issued
      const partMap = new Map<string, { name: string; qty: number }>();
      issueHistory.forEach((item) => {
        const existing = partMap.get(item.spare_part_id) || { name: item.part_name, qty: 0 };
        partMap.set(item.spare_part_id, {
          name: item.part_name,
          qty: existing.qty + item.qty,
        });
      });
      const topParts: BarItem[] = Array.from(partMap.entries())
        .sort((a, b) => b[1].qty - a[1].qty)
        .slice(0, 8)
        .map(([partId, data]) => ({
          id: partId,
          label: data.name,
          sublabel: partId,
          value: data.qty,
          formattedValue: `${data.qty} PCS`,
          color: '#8b5cf6',
        }));

      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ReportKpiCard
              title="Total Transaksi Issue"
              value={formatNumber(totalTx)}
              subtext="Pengeluaran part terpilih"
              icon={Truck}
              colorScheme="cyan"
            />
            <ReportKpiCard
              title="Total Suku Cadang Keluar"
              value={`${formatNumber(totalQty)} PCS`}
              subtext="Volume pemakaian lapangan"
              icon={Boxes}
              colorScheme="emerald"
            />
            {hasFinancialAccess ? (
              <ReportKpiCard
                title="Total Nilai Pemakaian"
                value={formatRupiah(totalCost)}
                subtext="Biaya suku cadang dikeluarkan"
                icon={Coins}
                colorScheme="violet"
              />
            ) : (
              <ReportKpiCard
                title="Armada Terlayani"
                value={unitMap.size}
                subtext="Unit aktif mengambil part"
                icon={Wrench}
                colorScheme="violet"
              />
            )}
            <ReportKpiCard
              title="Rata-rata Part per Transaksi"
              value={totalTx > 0 ? (totalQty / totalTx).toFixed(1) : '0'}
              subtext="PCS suku cadang per order"
              icon={Layers}
              colorScheme="sky"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5">
              <LeaderboardCard
                title="Top 5 Armada Unit Teraktif Konsumsi Part"
                subtitle="Unit dengan akumulasi pengambilan suku cadang terbanyak"
                items={topUnits}
              />
            </div>
            <div className="lg:col-span-7">
              <HorizontalBarChart
                title="Top 8 Suku Cadang Paling Sering Dikeluarkan"
                subtitle="Frekuensi pemakaian komponen suku cadang di workshop & operasional"
                items={topParts}
              />
            </div>
          </div>
        </div>
      );
    }

    // 5. Consumption Trend Visuals
    if (reportType === 'consumption_trend') {
      const trendPoints: TrendPoint[] = consumptionTrend.map((item) => ({
        label: item.period,
        value: item.total_qty,
        secondaryValue: item.total_value,
      }));

      const categoryMap = new Map<string, number>();
      consumptionTrend.forEach((item) => {
        categoryMap.set(
          item.category_name,
          (categoryMap.get(item.category_name) || 0) + item.total_qty
        );
      });
      const categoryBars: BarItem[] = Array.from(categoryMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([cat, qty]) => ({
          id: cat,
          label: cat,
          value: qty,
          formattedValue: `${formatNumber(qty)} PCS`,
          color: '#06b6d4',
        }));

      const totalQty = consumptionTrend.reduce((acc, curr) => acc + curr.total_qty, 0);
      const totalVal = consumptionTrend.reduce((acc, curr) => acc + (curr.total_value || 0), 0);

      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ReportKpiCard
              title="Total Konsumsi Terpantau"
              value={`${formatNumber(totalQty)} PCS`}
              subtext="Akumulasi part keluar periode ini"
              icon={Boxes}
              colorScheme="cyan"
            />
            {hasFinancialAccess && (
              <ReportKpiCard
                title="Total Nilai Material Terpakai"
                value={formatRupiah(totalVal)}
                subtext="Biaya suku cadang terpasang"
                icon={Coins}
                colorScheme="emerald"
              />
            )}
            <ReportKpiCard
              title="Kategori Suku Cadang Terpantau"
              value={categoryMap.size}
              subtext="Klasifikasi komponen logistik"
              icon={Layers}
              colorScheme="violet"
            />
            <ReportKpiCard
              title="Periode Analisis"
              value={`${consumptionTrend.length} Bulan`}
              subtext="Historis mutasi operasional"
              icon={Clock}
              colorScheme="sky"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7">
              <AreaTrendChart
                title="Tren Fluktuasi Konsumsi Suku Cadang (Qty / Bulan)"
                subtitle="Pergerakan volume pengeluaran suku cadang dari waktu ke waktu"
                data={trendPoints}
                primaryLegend="Qty Dikeluarkan (PCS)"
              />
            </div>
            <div className="lg:col-span-5">
              <HorizontalBarChart
                title="Konsumsi Suku Cadang per Kategori"
                subtitle="Komparasi pemakaian material antar kategori suku cadang"
                items={categoryBars}
              />
            </div>
          </div>
        </div>
      );
    }

    // 6. Equipment Consumption Visuals
    if (reportType === 'equipment_consumption') {
      const topEquipmentCost: LeaderboardItem[] = equipmentConsumption
        .slice()
        .sort((a, b) => b.total_cost - a.total_cost)
        .slice(0, 5)
        .map((item, idx) => ({
          id: item.equipment_number,
          rank: idx + 1,
          title: `Unit ${item.equipment_number} (${item.equipment_type})`,
          subtitle: `${item.site} • ${item.current_hm} HM • ${item.total_parts_qty} PCS`,
          metric: hasFinancialAccess ? formatRupiah(item.total_cost) : `${item.total_parts_qty} PCS`,
          submetric: hasFinancialAccess ? `${formatRupiah(item.cost_per_hm)} / HM` : undefined,
          badge: item.model,
        }));

      const costPerHmBars: BarItem[] = equipmentConsumption
        .slice()
        .sort((a, b) => b.cost_per_hm - a.cost_per_hm)
        .slice(0, 8)
        .map((item) => ({
          id: item.equipment_number,
          label: `${item.equipment_number} (${item.equipment_type})`,
          sublabel: `${item.site} • HM: ${item.current_hm}`,
          value: item.cost_per_hm,
          formattedValue: `${formatRupiah(item.cost_per_hm)} / HM`,
          color: item.cost_per_hm > 100000 ? '#f43f5e' : item.cost_per_hm > 50000 ? '#f59e0b' : '#10b981',
          tag: item.model,
        }));

      const totalArmada = equipmentConsumption.length;
      const totalBiaya = equipmentConsumption.reduce((acc, curr) => acc + curr.total_cost, 0);
      const avgCostPerHm =
        totalArmada > 0
          ? equipmentConsumption.reduce((acc, curr) => acc + curr.cost_per_hm, 0) / totalArmada
          : 0;

      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ReportKpiCard
              title="Total Armada Terpantau"
              value={formatNumber(totalArmada)}
              subtext={
                userDivision === 'DT'
                  ? 'Divisi Dump Truck (DT)'
                  : userDivision === 'HE'
                  ? 'Divisi Heavy Equipment (HE)'
                  : 'Heavy Equipment & Dump Trucks'
              }
              icon={Truck}
              colorScheme="cyan"
            />
            {hasFinancialAccess && (
              <ReportKpiCard
                title="Total Biaya Pemeliharaan"
                value={formatRupiah(totalBiaya)}
                subtext="Akumulasi biaya part seluruh unit"
                icon={Coins}
                colorScheme="rose"
              />
            )}
            {hasFinancialAccess && (
              <ReportKpiCard
                title="Rata-rata Cost per HM"
                value={`${formatRupiah(avgCostPerHm)} / HM`}
                subtext="Biaya rata-rata per jam operasi"
                icon={TrendingUp}
                colorScheme="amber"
              />
            )}
            <ReportKpiCard
              title="Unit Terboros (Highest Cost)"
              value={equipmentConsumption[0]?.equipment_number || '-'}
              subtext={equipmentConsumption[0]?.equipment_type || '-'}
              icon={AlertTriangle}
              colorScheme="violet"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5">
              <LeaderboardCard
                title="Top 5 Armada Beban Biaya Tertinggi"
                subtitle="Unit dengan akumulasi konsumsi suku cadang paling signifikan"
                items={topEquipmentCost}
              />
            </div>
            <div className="lg:col-span-7">
              <HorizontalBarChart
                title="Indeks Efisiensi Suku Cadang (Cost per HM)"
                subtitle="Rasio beban biaya suku cadang terhadap jam operasional unit (Hour Meter)"
                items={costPerHmBars}
              />
            </div>
          </div>
        </div>
      );
    }

    // 7. Site Consumption Visuals
    if (reportType === 'site_consumption') {
      const totalTrans = siteReports.reduce((acc, curr) => acc + curr.total_transactions, 0);
      const totalConsumed = siteReports.reduce((acc, curr) => acc + curr.total_parts_consumed, 0);

      const siteDonutColors = ['#06b6d4', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899'];
      const siteDonut: DonutItem[] = siteReports.map((site, idx) => ({
        id: site.site_id,
        label: site.site_name,
        value: site.total_parts_consumed,
        formattedValue: `${formatNumber(site.total_parts_consumed)} PCS`,
        color: siteDonutColors[idx % siteDonutColors.length],
        sublabel: `${site.total_transactions} transaksi`,
      }));

      const siteBars: BarItem[] = siteReports.map((site) => ({
        id: site.site_id,
        label: site.site_name,
        sublabel: `ID: ${site.site_id} • ${site.total_transactions} transaksi`,
        value: site.total_parts_consumed,
        formattedValue: `${formatNumber(site.total_parts_consumed)} PCS`,
        color: '#06b6d4',
      }));

      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ReportKpiCard
              title="Total Site Aktif"
              value={siteReports.length}
              subtext="Lokasi pit & area operasional"
              icon={MapPin}
              colorScheme="cyan"
            />
            <ReportKpiCard
              title="Total Transaksi Pengeluaran"
              value={formatNumber(totalTrans)}
              subtext="Akumulasi pengambilan part lintas site"
              icon={Truck}
              colorScheme="emerald"
            />
            <ReportKpiCard
              title="Total Suku Cadang Terpasang"
              value={`${formatNumber(totalConsumed)} PCS`}
              subtext="Pemakaian persediaan operasional"
              icon={Boxes}
              colorScheme="violet"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5">
              <DonutChart
                title="Pangsa Konsumsi per Lokasi Site"
                subtitle="Proporsi alokasi pemakaian suku cadang antar pit / site"
                items={siteDonut}
                centerLabel="Total Konsumsi"
                centerValue={`${formatNumber(totalConsumed)} PCS`}
              />
            </div>
            <div className="lg:col-span-7">
              <HorizontalBarChart
                title="Perbandingan Pemakaian Suku Cadang per Site"
                subtitle="Volume suku cadang yang diserap masing-masing area kerja"
                items={siteBars}
              />
            </div>
          </div>
        </div>
      );
    }

    // 8. Mechanic Consumption Visuals
    if (reportType === 'mechanic_consumption') {
      const totalJobs = mechanicReports.reduce((acc, curr) => acc + curr.total_jobs, 0);
      const totalInstalled = mechanicReports.reduce((acc, curr) => acc + curr.total_parts_installed, 0);

      const topMechanics: LeaderboardItem[] = mechanicReports
        .slice()
        .sort((a, b) => b.total_jobs - a.total_jobs)
        .slice(0, 5)
        .map((m, idx) => ({
          id: m.mechanic_name,
          rank: idx + 1,
          title: m.mechanic_name,
          subtitle: `${m.total_parts_installed} suku cadang terpasang`,
          metric: `${m.total_jobs} Pekerjaan`,
          badge: idx === 0 ? 'Paling Aktif' : undefined,
        }));

      const mechanicBars: BarItem[] = mechanicReports
        .slice()
        .sort((a, b) => b.total_parts_installed - a.total_parts_installed)
        .slice(0, 8)
        .map((m) => ({
          id: m.mechanic_name,
          label: m.mechanic_name,
          sublabel: `${m.total_jobs} kali job maintenance`,
          value: m.total_parts_installed,
          formattedValue: `${m.total_parts_installed} PCS`,
          color: '#10b981',
        }));

      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ReportKpiCard
              title="Total Mekanik Terlibat"
              value={mechanicReports.length}
              subtext="Teknisi pemeliharaan armada"
              icon={Wrench}
              colorScheme="cyan"
            />
            <ReportKpiCard
              title="Total Penugasan Selesai"
              value={formatNumber(totalJobs)}
              subtext="Aktivitas perbaikan & servis"
              icon={CheckCircle2}
              colorScheme="emerald"
            />
            <ReportKpiCard
              title="Total Suku Cadang Terpasang"
              value={`${formatNumber(totalInstalled)} PCS`}
              subtext="Komponen dipasang ke armada"
              icon={Boxes}
              colorScheme="violet"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5">
              <LeaderboardCard
                title="Peringkat Produktivitas Mekanik"
                subtitle="Mekanik dengan penyelesaian pekerjaan pemeliharaan unit terbanyak"
                items={topMechanics}
              />
            </div>
            <div className="lg:col-span-7">
              <HorizontalBarChart
                title="Suku Cadang Terpasang per Mekanik"
                subtitle="Volume suku cadang yang dipertanggungjawabkan oleh masing-masing mekanik"
                items={mechanicBars}
              />
            </div>
          </div>
        </div>
      );
    }

    // 9. Warehouse Performance Visuals
    if (reportType === 'warehouse_performance') {
      const totalSkus = warehousePerformance.reduce((acc, curr) => acc + curr.total_skus, 0);
      const totalIssues = warehousePerformance.reduce((acc, curr) => acc + curr.total_issues_30d, 0);
      const totalDrops = warehousePerformance.reduce((acc, curr) => acc + curr.total_drops_30d, 0);
      const totalLowStock = warehousePerformance.reduce((acc, curr) => acc + curr.low_stock_count, 0);

      const turnoverBars: BarItem[] = warehousePerformance.map((wh) => ({
        id: wh.warehouse_id,
        label: wh.warehouse_name,
        sublabel: `${wh.warehouse_type} • ${wh.total_skus} SKU • Issues: ${wh.total_issues_30d}`,
        value: wh.turnover_ratio,
        formattedValue: `${wh.turnover_ratio}x ITR`,
        color: wh.warehouse_type === 'MAIN' ? '#8b5cf6' : '#06b6d4',
        tag: wh.warehouse_type,
      }));

      const skuBars: BarItem[] = warehousePerformance.map((wh) => ({
        id: wh.warehouse_id,
        label: wh.warehouse_name,
        sublabel: `${wh.warehouse_type} • Low stock: ${wh.low_stock_count} item`,
        value: wh.total_skus,
        formattedValue: `${wh.total_skus} SKU`,
        color: wh.low_stock_count > 0 ? '#f59e0b' : '#10b981',
      }));

      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ReportKpiCard
              title="Total Gudang Terpantau"
              value={warehousePerformance.length}
              subtext={`${warehousePerformance.length} Gudang • ${formatNumber(totalSkus)} Total SKU`}
              icon={Boxes}
              colorScheme="cyan"
            />
            <ReportKpiCard
              title="Throughput Issue (30 Hari)"
              value={`${formatNumber(totalIssues)} Tx`}
              subtext="Penyaluran part ke armada"
              icon={Truck}
              colorScheme="emerald"
            />
            <ReportKpiCard
              title="Drop STO Suplai (30 Hari)"
              value={`${formatNumber(totalDrops)} Drop`}
              subtext="Suplai dari Gudang Utama ke Kontainer"
              icon={TrendingUp}
              colorScheme="violet"
            />
            <ReportKpiCard
              title="Total SKU Stok Kritis"
              value={totalLowStock}
              subtext="Akumulasi butuh restock segera"
              icon={AlertTriangle}
              colorScheme="rose"
              badge={totalLowStock > 0 ? 'Peringatan' : 'Aman'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-6">
              <HorizontalBarChart
                title="Rasio Perputaran Persediaan (Inventory Turnover Ratio - ITR)"
                subtitle="Kecepatan siklus perputaran persediaan per gudang (kali / tahun)"
                items={turnoverBars}
              />
            </div>
            <div className="lg:col-span-6">
              <HorizontalBarChart
                title="Kepadatan SKU Katalog per Gudang"
                subtitle="Jumlah item varian suku cadang yang aktif disimpan di setiap gudang"
                items={skuBars}
              />
            </div>
          </div>
        </div>
      );
    }

    // 10. Replenishment Efficiency Visuals
    if (reportType === 'replenishment_efficiency') {
      const totalReq = replenishmentEfficiency.length;
      const completedCount = replenishmentEfficiency.filter((i) => i.status === 'COMPLETED').length;
      const avgAccuracy =
        totalReq > 0
          ? Math.round(
              replenishmentEfficiency.reduce((acc, c) => acc + c.fulfillment_accuracy_percent, 0) /
                totalReq
            )
          : 100;

      const leadTimes = replenishmentEfficiency
        .map((i) => i.lead_time_hours)
        .filter((v): v is number => v !== undefined && v !== null);
      const avgLeadTime =
        leadTimes.length > 0 ? (leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length).toFixed(1) : '-';

      const leadTimeBars: BarItem[] = replenishmentEfficiency
        .slice(0, 8)
        .map((item) => ({
          id: item.request_number,
          label: item.request_number,
          sublabel: `${item.container_warehouse_name} • Minta: ${item.total_qty_requested} | Terima: ${item.total_qty_received}`,
          value: item.lead_time_hours || 0,
          formattedValue: item.lead_time_hours ? `${item.lead_time_hours} jam` : 'In Progress',
          color:
            item.status === 'COMPLETED'
              ? '#10b981'
              : item.status === 'IN_TRANSIT'
              ? '#06b6d4'
              : '#f59e0b',
          tag: item.status,
        }));

      const statusMap = new Map<string, number>();
      replenishmentEfficiency.forEach((item) => {
        statusMap.set(item.status, (statusMap.get(item.status) || 0) + 1);
      });
      const statusDonut: DonutItem[] = Array.from(statusMap.entries()).map(([status, count]) => ({
        id: status,
        label: status,
        value: count,
        color:
          status === 'COMPLETED'
            ? '#10b981'
            : status === 'IN_TRANSIT'
            ? '#06b6d4'
            : status === 'APPROVED'
            ? '#8b5cf6'
            : '#f59e0b',
      }));

      return (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <ReportKpiCard
              title="Rata-rata Lead Time Pengadaan"
              value={avgLeadTime !== '-' ? `${avgLeadTime} Jam` : '-'}
              subtext="Siklus Permohonan s/d Penerimaan"
              icon={Clock}
              colorScheme="cyan"
              badge="SLA WMS"
            />
            <ReportKpiCard
              title="Akurasi Pemenuhan (OTIF %)"
              value={`${avgAccuracy}%`}
              subtext="Kesesuaian kuantitas diminta vs diterima"
              icon={CheckCircle2}
              colorScheme="emerald"
              badge="Target: >95%"
            />
            <ReportKpiCard
              title="Total Permohonan Pengadaan"
              value={totalReq}
              subtext="Permintaan replenishment tercatat"
              icon={Boxes}
              colorScheme="violet"
            />
            <ReportKpiCard
              title="Selesai Diterima di Kontainer"
              value={`${completedCount} / ${totalReq}`}
              subtext="Drop STO sukses terselesaikan"
              icon={Truck}
              colorScheme="sky"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5">
              <DonutChart
                title="Status Pipeline Pengadaan Stok"
                subtitle="Distribusi permohonan restock berdasarkan tahapan workflow"
                items={statusDonut}
                centerLabel="Akurasi Rata-rata"
                centerValue={`${avgAccuracy}%`}
              />
            </div>
            <div className="lg:col-span-7">
              <HorizontalBarChart
                title="Lead Time Durasi Pengadaan per Permohonan"
                subtitle="Waktu tempuh pemenuhan suku cadang dari Gudang Utama ke Kontainer"
                items={leadTimeBars}
              />
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              Enterprise Logistics Intelligence
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-cyan-400" />
            <span>Laporan & Analitik Visual WMS</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Pelaporan analitik terintegrasi untuk persediaan, operasional lapangan, evaluasi armada, dan kinerja manajemen.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowRecommendationsModal(true)}
            className="px-3.5 py-2 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/40 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-sm shadow-violet-500/10"
          >
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span>Rekomendasi Laporan Logistik</span>
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow-sm shadow-emerald-500/10"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Unduh Excel</span>
          </button>
          <button
            onClick={handlePrintPdf}
            className="px-3.5 py-2 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 text-xs font-semibold flex items-center gap-2 transition cursor-pointer shadow-sm shadow-cyan-500/10"
          >
            <Printer className="w-4 h-4 text-cyan-400" />
            <span>Cetak / PDF</span>
          </button>
        </div>
      </div>

      {/* Category Level 1 Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 overflow-x-auto">
        <button
          onClick={() => handleCategoryChange('INVENTORY')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 shrink-0 cursor-pointer ${
            category === 'INVENTORY'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>Laporan Persediaan (Inventory)</span>
        </button>
        <button
          onClick={() => handleCategoryChange('OPERATION')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 shrink-0 cursor-pointer ${
            category === 'OPERATION'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>Laporan Operasional (Operation)</span>
        </button>
        <button
          onClick={() => handleCategoryChange('MANAGEMENT')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 shrink-0 cursor-pointer ${
            category === 'MANAGEMENT'
              ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Laporan Manajemen (Management)</span>
        </button>
      </div>

      {/* Sub-Report Type Level 2 Pills & Mode Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {category === 'INVENTORY' && (
            <>
              <button
                onClick={() => setReportType('stock_balance')}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  reportType === 'stock_balance'
                    ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Saldo Stok Fisik
              </button>
              {hasFinancialAccess && (
                <button
                  onClick={() => setReportType('stock_valuation')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                    reportType === 'stock_valuation'
                      ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Valuasi Modal Kerja
                </button>
              )}
              <button
                onClick={() => setReportType('stock_aging')}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  reportType === 'stock_aging'
                    ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Usia Simpan (Stock Aging)
              </button>
            </>
          )}

          {category === 'OPERATION' && (
            <>
              <button
                onClick={() => setReportType('issue_history')}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  reportType === 'issue_history'
                    ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Histori Pengeluaran (Issue)
              </button>
              <button
                onClick={() => setReportType('consumption_trend')}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  reportType === 'consumption_trend'
                    ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Tren Konsumsi Bulanan
              </button>
              <button
                onClick={() => setReportType('equipment_consumption')}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  reportType === 'equipment_consumption'
                    ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Konsumsi per Armada Unit
              </button>
              <button
                onClick={() => setReportType('site_consumption')}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  reportType === 'site_consumption'
                    ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Konsumsi per Site
              </button>
              <button
                onClick={() => setReportType('mechanic_consumption')}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  reportType === 'mechanic_consumption'
                    ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Aktivitas Mekanik
              </button>
            </>
          )}

          {category === 'MANAGEMENT' && (
            <>
              <button
                onClick={() => setReportType('warehouse_performance')}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  reportType === 'warehouse_performance'
                    ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Kinerja Pergudangan (Performance)
              </button>
              <button
                onClick={() => setReportType('replenishment_efficiency')}
                className={`px-3 py-1.5 rounded-lg font-medium transition cursor-pointer ${
                  reportType === 'replenishment_efficiency'
                    ? 'bg-slate-800 text-white border border-slate-700 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Efisiensi Pengadaan & Lead Time
              </button>
            </>
          )}
        </div>

        {/* View Mode & Warehouse Filter */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-950/60 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              onClick={() => setViewMode('both')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'both'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Gabungan</span>
            </button>
            <button
              onClick={() => setViewMode('charts')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'charts'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-3 h-3" />
              <span>Grafik</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'table'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TableIcon className="w-3 h-3" />
              <span>Tabel</span>
            </button>
          </div>

          {/* Warehouse Filter Toggle */}
          <div className="flex items-center gap-2 text-xs">
            <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={useActiveWarehouseOnly}
                onChange={(e) => setUseActiveWarehouseOnly(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
              />
              <span>Hanya Gudang Aktif</span>
            </label>
          </div>
        </div>
      </div>

      {/* 1. VISUAL ANALYTICS & CHARTS SECTION */}
      {viewMode !== 'table' && renderVisualAnalytics()}

      {/* 2. TABULAR DATA SECTION */}
      {viewMode !== 'charts' && (
        <>
          {loading ? (
            <TableSkeleton rows={8} cols={7} />
          ) : (
            <div className="glass-panel rounded-2xl p-5 border border-slate-800">
              <div className="flex items-center justify-between mb-3 border-b border-slate-800/80 pb-2">
                <span className="text-xs font-bold text-slate-300 flex items-center gap-2">
                  <TableIcon className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Detail Data Tabel Laporan</span>
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Menampilkan data terverifikasi sistem
                </span>
              </div>

              {/* TAB 1: STOCK BALANCE */}
              {reportType === 'stock_balance' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">Part Number</th>
                        <th className="pb-3 font-semibold">Nama Spare Part</th>
                        <th className="pb-3 font-semibold">Kategori</th>
                        <th className="pb-3 font-semibold">Gudang</th>
                        <th className="pb-3 font-semibold">Rak</th>
                        <th className="pb-3 font-semibold text-right">Stok Fisik</th>
                        <th className="pb-3 font-semibold text-right">Min Stok</th>
                        <th className="pb-3 font-semibold text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {stockBalance.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-500">
                            Tidak ada data saldo stok.
                          </td>
                        </tr>
                      ) : (
                        stockBalance.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/30">
                            <td className="py-3 font-mono font-bold text-cyan-300">
                              {item.spare_part_id}
                            </td>
                            <td className="py-3 text-slate-200 font-medium">{item.part_name}</td>
                            <td className="py-3 text-slate-400">{item.category_name || '-'}</td>
                            <td className="py-3 text-slate-300">{item.warehouse_name}</td>
                            <td className="py-3 text-slate-400 font-mono">{item.rack_location || '-'}</td>
                            <td className="py-3 text-right font-mono font-bold text-white">
                              {item.qty_on_hand}{' '}
                              <span className="text-[10px] text-slate-400 font-normal">
                                {item.unit_of_measure}
                              </span>
                            </td>
                            <td className="py-3 text-right font-mono text-slate-400">{item.min_stock}</td>
                            <td className="py-3 text-center">
                              <Badge status={item.status} withDot>
                                {item.status}
                              </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 2: STOCK VALUATION */}
              {reportType === 'stock_valuation' && hasFinancialAccess && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">Part Number</th>
                        <th className="pb-3 font-semibold">Nama Spare Part</th>
                        <th className="pb-3 font-semibold">Gudang</th>
                        <th className="pb-3 font-semibold text-right">Stok Fisik</th>
                        <th className="pb-3 font-semibold text-right">Harga Satuan (Cost)</th>
                        <th className="pb-3 font-semibold text-right">Total Valuasi</th>
                        <th className="pb-3 font-semibold text-right">Pangsa (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {stockValuation.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="py-3 font-mono font-bold text-cyan-300">
                            {item.spare_part_id}
                          </td>
                          <td className="py-3 text-slate-200 font-medium">{item.part_name}</td>
                          <td className="py-3 text-slate-300">{item.warehouse_name}</td>
                          <td className="py-3 text-right font-mono text-white font-bold">{item.qty_on_hand}</td>
                          <td className="py-3 text-right font-mono text-slate-300">{formatRupiah(item.unit_cost)}</td>
                          <td className="py-3 text-right font-mono text-cyan-300 font-bold">{formatRupiah(item.total_value)}</td>
                          <td className="py-3 text-right font-mono text-slate-400">{item.share_percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 3: STOCK AGING */}
              {reportType === 'stock_aging' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">Part Number</th>
                        <th className="pb-3 font-semibold">Nama Spare Part</th>
                        <th className="pb-3 font-semibold">Gudang</th>
                        <th className="pb-3 font-semibold text-right">Stok Fisik</th>
                        {hasFinancialAccess && <th className="pb-3 font-semibold text-right">Total Nilai</th>}
                        <th className="pb-3 font-semibold text-center">Durasi Simpan</th>
                        <th className="pb-3 font-semibold text-center">Kategori Aging</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {stockAging.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="py-3 font-mono font-bold text-cyan-300">
                            {item.spare_part_id}
                          </td>
                          <td className="py-3 text-slate-200 font-medium">{item.part_name}</td>
                          <td className="py-3 text-slate-300">{item.warehouse_name}</td>
                          <td className="py-3 text-right font-mono text-white">{item.qty}</td>
                          {hasFinancialAccess && (
                            <td className="py-3 text-right font-mono text-cyan-300 font-semibold">{formatRupiah(item.total_value)}</td>
                          )}
                          <td className="py-3 text-center font-mono text-slate-300">{item.days_in_inventory} hari</td>
                          <td className="py-3 text-center">
                            <Badge
                              variant={
                                item.aging_bucket === '< 30 Hari'
                                  ? 'success'
                                  : item.aging_bucket === '31-90 Hari'
                                  ? 'info'
                                  : item.aging_bucket === '91-180 Hari'
                                  ? 'warning'
                                  : 'danger'
                              }
                              withDot
                            >
                              {item.aging_bucket}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 4: ISSUE HISTORY */}
              {reportType === 'issue_history' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">No. Transaksi</th>
                        <th className="pb-3 font-semibold">Tanggal</th>
                        <th className="pb-3 font-semibold">No. Unit</th>
                        <th className="pb-3 font-semibold">Part Number</th>
                        <th className="pb-3 font-semibold">Nama Spare Part</th>
                        <th className="pb-3 font-semibold text-right">Qty</th>
                        <th className="pb-3 font-semibold">Penerima & Mekanik</th>
                        {hasFinancialAccess && <th className="pb-3 font-semibold text-right">Total Harga</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {issueHistory.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="py-3 font-mono font-bold text-cyan-300">
                            {item.transaction_number}
                          </td>
                          <td className="py-3 text-slate-400">
                            {new Date(item.issued_at).toLocaleDateString('id-ID')}
                          </td>
                          <td className="py-3 font-mono font-semibold text-white">{item.unit_number}</td>
                          <td className="py-3 font-mono text-slate-300">{item.spare_part_id}</td>
                          <td className="py-3 text-slate-200">{item.part_name}</td>
                          <td className="py-3 text-right font-mono font-bold text-white">{item.qty}</td>
                          <td className="py-3 text-slate-300">
                            <div>{item.receiver_name}</div>
                            <div className="text-[10px] text-slate-500">Mekanik: {item.mechanic_name}</div>
                          </td>
                          {hasFinancialAccess && (
                            <td className="py-3 text-right font-mono text-cyan-400 font-semibold">{formatRupiah(item.total_price)}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 5: CONSUMPTION TREND */}
              {reportType === 'consumption_trend' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">Periode (Bulan)</th>
                        <th className="pb-3 font-semibold">Kategori Suku Cadang</th>
                        <th className="pb-3 font-semibold text-center">Jumlah Transaksi</th>
                        <th className="pb-3 font-semibold text-right">Total Qty Dikeluarkan</th>
                        {hasFinancialAccess && <th className="pb-3 font-semibold text-right">Total Nilai Pemakaian</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {consumptionTrend.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="py-3 font-mono font-bold text-cyan-300">{item.period}</td>
                          <td className="py-3 text-slate-200 font-medium">{item.category_name}</td>
                          <td className="py-3 text-center font-mono text-slate-300">{item.total_transactions} tx</td>
                          <td className="py-3 text-right font-mono text-white font-bold">{item.total_qty} PCS</td>
                          {hasFinancialAccess && (
                            <td className="py-3 text-right font-mono text-cyan-400 font-bold">{formatRupiah(item.total_value)}</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 6: EQUIPMENT CONSUMPTION */}
              {reportType === 'equipment_consumption' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">No. Unit</th>
                        <th className="pb-3 font-semibold">Tipe & Model</th>
                        <th className="pb-3 font-semibold">Site</th>
                        <th className="pb-3 font-semibold text-right">Hour Meter (HM)</th>
                        <th className="pb-3 font-semibold text-center">Total Transaksi</th>
                        {hasFinancialAccess && <th className="pb-3 font-semibold text-right">Total Biaya Suku Cadang</th>}
                        {hasFinancialAccess && <th className="pb-3 font-semibold text-right">Biaya per HM</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {equipmentConsumption.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="py-3 font-mono font-bold text-cyan-300">{item.equipment_number}</td>
                          <td className="py-3 text-slate-200">
                            <div>{item.equipment_type}</div>
                            <div className="text-[10px] text-slate-500">{item.model}</div>
                          </td>
                          <td className="py-3 text-slate-400">{item.site}</td>
                          <td className="py-3 text-right font-mono text-white">{item.current_hm} HM</td>
                          <td className="py-3 text-center font-mono text-slate-300">{item.total_transactions}x</td>
                          {hasFinancialAccess && (
                            <td className="py-3 text-right font-mono text-rose-400 font-bold">{formatRupiah(item.total_cost)}</td>
                          )}
                          {hasFinancialAccess && (
                            <td className="py-3 text-right font-mono text-amber-400 font-bold">{formatRupiah(item.cost_per_hm)} / HM</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 7: SITE CONSUMPTION */}
              {reportType === 'site_consumption' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">ID Site</th>
                        <th className="pb-3 font-semibold">Nama Site</th>
                        <th className="pb-3 font-semibold text-center">Total Transaksi Pengeluaran</th>
                        <th className="pb-3 font-semibold text-right">Total Part Terpakai</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {siteReports.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-8 text-center text-slate-500">
                            Tidak ada data konsumsi site.
                          </td>
                        </tr>
                      ) : (
                        siteReports.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/30">
                            <td className="py-3 font-mono font-bold text-cyan-300">{item.site_id}</td>
                            <td className="py-3 text-slate-200 font-semibold">{item.site_name}</td>
                            <td className="py-3 text-center font-mono text-slate-300">
                              {item.total_transactions} transaksi
                            </td>
                            <td className="py-3 text-right font-mono text-white font-bold">
                              {formatNumber(item.total_parts_consumed)} PCS
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 8: MECHANIC CONSUMPTION */}
              {reportType === 'mechanic_consumption' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">Nama Mekanik</th>
                        <th className="pb-3 font-semibold text-center">Total Pekerjaan / Work Order</th>
                        <th className="pb-3 font-semibold text-right">Total Part Dipasang</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {mechanicReports.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-8 text-center text-slate-500">
                            Tidak ada data aktivitas mekanik.
                          </td>
                        </tr>
                      ) : (
                        mechanicReports.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/30">
                            <td className="py-3 text-slate-200 font-semibold">{item.mechanic_name}</td>
                            <td className="py-3 text-center font-mono text-cyan-300 font-bold">
                              {item.total_jobs} pekerjaan
                            </td>
                            <td className="py-3 text-right font-mono text-emerald-400 font-bold">
                              {formatNumber(item.total_parts_installed)} PCS
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 9: WAREHOUSE PERFORMANCE */}
              {reportType === 'warehouse_performance' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">Gudang</th>
                        <th className="pb-3 font-semibold">Tipe</th>
                        <th className="pb-3 font-semibold text-center">Total SKU</th>
                        {hasFinancialAccess && <th className="pb-3 font-semibold text-right">Total Valuasi Stok</th>}
                        <th className="pb-3 font-semibold text-center">Issue 30D</th>
                        <th className="pb-3 font-semibold text-center">Drop STO 30D</th>
                        <th className="pb-3 font-semibold text-center">Turnover Ratio</th>
                        <th className="pb-3 font-semibold text-center">Stok Kritis</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {warehousePerformance.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="py-3 text-white font-medium">
                            <div>{item.warehouse_name}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{item.warehouse_id}</div>
                          </td>
                          <td className="py-3">
                            <Badge variant={item.warehouse_type === 'MAIN' ? 'purple' : 'info'}>
                              {item.warehouse_type}
                            </Badge>
                          </td>
                          <td className="py-3 text-center font-mono text-slate-200">{item.total_skus}</td>
                          {hasFinancialAccess && (
                            <td className="py-3 text-right font-mono text-cyan-300 font-bold">{formatRupiah(item.total_valuation)}</td>
                          )}
                          <td className="py-3 text-center font-mono text-emerald-400">{item.total_issues_30d} tx</td>
                          <td className="py-3 text-center font-mono text-sky-400">{item.total_drops_30d} drop</td>
                          <td className="py-3 text-center font-mono text-amber-300">{item.turnover_ratio}x</td>
                          <td className="py-3 text-center font-mono">
                            {item.low_stock_count > 0 ? (
                              <span className="text-rose-400 font-bold">{item.low_stock_count} item</span>
                            ) : (
                              <span className="text-emerald-400">0 aman</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 10: REPLENISHMENT EFFICIENCY */}
              {reportType === 'replenishment_efficiency' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-3 font-semibold">No. Permohonan</th>
                        <th className="pb-3 font-semibold">Gudang Pemohon</th>
                        <th className="pb-3 font-semibold text-center">Status</th>
                        <th className="pb-3 font-semibold text-center">Lead Time</th>
                        <th className="pb-3 font-semibold text-right">Qty Minta</th>
                        <th className="pb-3 font-semibold text-right">Qty Terima</th>
                        <th className="pb-3 font-semibold text-right">Akurasi Pemenuhan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {replenishmentEfficiency.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="py-3 font-mono font-bold text-cyan-300">{item.request_number}</td>
                          <td className="py-3 text-slate-200 font-medium">{item.container_warehouse_name}</td>
                          <td className="py-3 text-center">
                            <Badge status={item.status} withDot>
                              {item.status}
                            </Badge>
                          </td>
                          <td className="py-3 text-center font-mono text-slate-300">
                            {item.lead_time_hours !== null && item.lead_time_hours !== undefined
                              ? `${item.lead_time_hours} jam`
                              : '-'}
                          </td>
                          <td className="py-3 text-right font-mono text-slate-400">{item.total_qty_requested}</td>
                          <td className="py-3 text-right font-mono text-white font-bold">{item.total_qty_received}</td>
                          <td className="py-3 text-right font-mono text-emerald-400 font-bold">
                            {item.fulfillment_accuracy_percent}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Recommendations Modal */}
      <ReportRecommendationsModal
        isOpen={showRecommendationsModal}
        onClose={() => setShowRecommendationsModal(false)}
      />
    </div>
  );
};
