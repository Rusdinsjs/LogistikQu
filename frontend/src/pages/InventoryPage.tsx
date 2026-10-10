import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { inventoryApi, binApi } from '../api';
import type { InventoryStockItem, StockMovement, WarehouseBinItem } from '../types';
import * as XLSX from 'xlsx';
import {
  Search,
  History,
  FileSpreadsheet,
  X,
  RotateCcw,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Trash2,
  Table,
  Layers,
  Plus,
  Edit2,
  MoveRight,
  Boxes,
  Info,
} from 'lucide-react';

export const InventoryPage: React.FC = () => {
  const { activeWarehouse, activeWarehouseInfo, user } = useAuth();
  const canManageBins =
    user?.role_id === 'SUPER_ADMIN' ||
    user?.role_id === 'MANAGER' ||
    user?.role_id?.startsWith('SUPERVISOR') ||
    user?.role_id?.startsWith('CONTAINER_ADMIN') ||
    user?.permissions?.includes('master.manage');

  // Main View Switcher: 'stock' | 'bins'
  const [viewMode, setViewMode] = useState<'stock' | 'bins'>('stock');

  const [stocks, setStocks] = useState<InventoryStockItem[]>([]);
  const [bins, setBins] = useState<WarehouseBinItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NORMAL' | 'WARNING' | 'CRITICAL'>('ALL');
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [binLoading, setBinLoading] = useState(false);

  // Stock Movement Modal
  const [selectedPart, setSelectedPart] = useState<InventoryStockItem | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementLoading, setMovementLoading] = useState(false);

  // Import Modal & States
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importMode, setImportMode] = useState<'excel' | 'json'>('excel');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [parsedRows, setParsedRows] = useState<any[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);

  // Fallback JSON text
  const [importJson, setImportJson] = useState(`[
  { "spare_part_id": "FLT-001", "qty_on_hand": 50, "min_stock": 15, "max_stock": 80, "rack_location": "RACK-HE-A1" },
  { "spare_part_id": "ENG-001", "qty_on_hand": 30, "min_stock": 10, "max_stock": 60, "rack_location": "RACK-HE-B2" }
]`);

  // Relocate Modal
  const [showRelocateModal, setShowRelocateModal] = useState(false);
  const [relocatePartId, setRelocatePartId] = useState('');
  const [relocatePartName, setRelocatePartName] = useState('');
  const [relocateCurrentBin, setRelocateCurrentBin] = useState('');
  const [relocateTargetBin, setRelocateTargetBin] = useState('');
  const [relocating, setRelocating] = useState(false);

  // Add / Edit Bin Modal
  const [showBinModal, setShowBinModal] = useState(false);
  const [binModalMode, setBinModalMode] = useState<'create' | 'edit'>('create');
  const [binModalId, setBinModalId] = useState('');
  const [binFormCode, setBinFormCode] = useState('');
  const [binFormZone, setBinFormZone] = useState('BAY-LEFT');
  const [binFormLevel, setBinFormLevel] = useState('LEVEL-1');
  const [binFormCapacity, setBinFormCapacity] = useState(10);
  const [binFormDesc, setBinFormDesc] = useState('');
  const [savingBin, setSavingBin] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchStock = async () => {
    setLoading(true);
    try {
      const data = await inventoryApi.getStock(activeWarehouse, search);
      setStocks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBins = async () => {
    setBinLoading(true);
    try {
      const data = await binApi.getWarehouseBins(activeWarehouse);
      setBins(data);
    } catch (err) {
      console.error(err);
    } finally {
      setBinLoading(false);
    }
  };

  useEffect(() => {
    fetchStock();
    fetchBins();
  }, [activeWarehouse, search]);

  const handleOpenMovements = async (item: InventoryStockItem) => {
    setSelectedPart(item);
    setMovementLoading(true);
    try {
      const movs = await inventoryApi.getMovements(item.warehouse_id, item.spare_part_id);
      setMovements(movs);
    } catch (err) {
      console.error(err);
    } finally {
      setMovementLoading(false);
    }
  };

  // --- DOWNLOAD TEMPLATE EXCEL ---
  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Part Number (Wajib)': 'FLT-001',
        'Nama Suku Cadang (Referensi)': 'Oil Filter Element Excavator',
        'Jumlah Saldo Fisik (Wajib)': 50,
        'Minimum Stock': 15,
        'Maximum Stock': 80,
        'Safety Stock': 5,
        'Lokasi Rak / Bin': 'RACK-HE-A1',
      },
      {
        'Part Number (Wajib)': 'ENG-001',
        'Nama Suku Cadang (Referensi)': 'Fuel Filter Water Separator',
        'Jumlah Saldo Fisik (Wajib)': 30,
        'Minimum Stock': 10,
        'Maximum Stock': 60,
        'Safety Stock': 5,
        'Lokasi Rak / Bin': 'RACK-HE-B2',
      },
      {
        'Part Number (Wajib)': 'HOS-001',
        'Nama Suku Cadang (Referensi)': 'Hydraulic Hose High Pressure 1/2"',
        'Jumlah Saldo Fisik (Wajib)': 25,
        'Minimum Stock': 10,
        'Maximum Stock': 50,
        'Safety Stock': 5,
        'Lokasi Rak / Bin': 'RACK-HE-B1',
      },
      {
        'Part Number (Wajib)': 'TUR-001',
        'Nama Suku Cadang (Referensi)': 'Turbocharger Assy HE',
        'Jumlah Saldo Fisik (Wajib)': 4,
        'Minimum Stock': 2,
        'Maximum Stock': 8,
        'Safety Stock': 1,
        'Lokasi Rak / Bin': 'RACK-HE-C1',
      },
      {
        'Part Number (Wajib)': 'LUB-001',
        'Nama Suku Cadang (Referensi)': 'Engine Oil 15W-40 Drum 200L',
        'Jumlah Saldo Fisik (Wajib)': 450,
        'Minimum Stock': 100,
        'Maximum Stock': 800,
        'Safety Stock': 50,
        'Lokasi Rak / Bin': 'DRUM-BAY-01',
      },
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);

    ws['!cols'] = [
      { wch: 22 },
      { wch: 36 },
      { wch: 25 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 20 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Saldo Awal Stok');
    XLSX.writeFile(wb, `Template_Import_Saldo_Awal_${activeWarehouse}.xlsx`);
  };

  // --- HANDLE UPLOAD FILE EXCEL ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    setParseError(null);
    setImportMessage(null);
    setImportSuccess(false);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rawData = XLSX.utils.sheet_to_json<any>(ws);

        if (!rawData || rawData.length === 0) {
          setParseError('File Excel tidak memiliki baris data atau kosong!');
          setParsedRows([]);
          return;
        }

        const rows: any[] = [];
        for (let i = 0; i < rawData.length; i++) {
          const r = rawData[i];
          const sparePartId =
            r['Part Number (Wajib)'] ||
            r['Part Number'] ||
            r['spare_part_id'] ||
            r['Kode Part'] ||
            r['Part ID'] ||
            r['PART_NUMBER'] ||
            '';

          const qtyRaw =
            r['Jumlah Saldo Fisik (Wajib)'] ??
            r['Jumlah Saldo Fisik'] ??
            r['qty_on_hand'] ??
            r['Qty Fisik'] ??
            r['Saldo Fisik'] ??
            r['Qty'] ??
            r['QTY_ON_HAND'] ??
            0;

          const qtyOnHand = Number(qtyRaw);

          const minStock = r['Minimum Stock'] ?? r['min_stock'] ?? r['Min Stock'] ?? r['MIN_STOCK'];
          const maxStock = r['Maximum Stock'] ?? r['max_stock'] ?? r['Max Stock'] ?? r['MAX_STOCK'];
          const safetyStock = r['Safety Stock'] ?? r['safety_stock'] ?? r['SAFETY_STOCK'];
          const rackLocation = r['Lokasi Rak / Bin'] ?? r['Lokasi Rak'] ?? r['rack_location'] ?? r['Rak'] ?? r['RACK_LOCATION'];
          const partName = r['Nama Suku Cadang (Referensi)'] ?? r['Nama Suku Cadang'] ?? r['Nama Part'] ?? '';

          if (sparePartId) {
            rows.push({
              rowNum: i + 2,
              spare_part_id: String(sparePartId).trim().toUpperCase(),
              part_name: partName ? String(partName).trim() : undefined,
              qty_on_hand: isNaN(qtyOnHand) ? 0 : qtyOnHand,
              min_stock: minStock !== undefined && !isNaN(Number(minStock)) ? Number(minStock) : 10,
              max_stock: maxStock !== undefined && !isNaN(Number(maxStock)) ? Number(maxStock) : 100,
              safety_stock: safetyStock !== undefined && !isNaN(Number(safetyStock)) ? Number(safetyStock) : 5,
              rack_location: rackLocation ? String(rackLocation).trim().toUpperCase() : undefined,
              isValid: !isNaN(qtyOnHand) && qtyOnHand >= 0,
            });
          }
        }

        if (rows.length === 0) {
          setParseError('Tidak ditemukan kolom "Part Number (Wajib)" atau "spare_part_id" yang valid di file Excel!');
          setParsedRows([]);
        } else {
          setParseError(null);
          setParsedRows(rows);
        }
      } catch (err: any) {
        setParseError('Gagal memproses file Excel: ' + (err.message || 'Format file tidak didukung'));
        setParsedRows([]);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleResetUpload = () => {
    setUploadedFileName(null);
    setParsedRows([]);
    setParseError(null);
    setImportMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // --- SUBMIT IMPORT DATA ---
  const handleExecuteImport = async () => {
    setImportLoading(true);
    setImportMessage(null);
    setImportSuccess(false);

    try {
      let rowsToSubmit: any[] = [];
      if (importMode === 'excel') {
        if (parsedRows.length === 0) {
          throw new Error('Tidak ada data baris dari file Excel untuk diimpor!');
        }
        rowsToSubmit = parsedRows.map((r) => ({
          spare_part_id: r.spare_part_id,
          qty_on_hand: r.qty_on_hand,
          min_stock: r.min_stock,
          max_stock: r.max_stock,
          safety_stock: r.safety_stock,
          rack_location: r.rack_location,
        }));
      } else {
        rowsToSubmit = JSON.parse(importJson);
      }

      const res = await inventoryApi.importInitialStock(activeWarehouse, rowsToSubmit);
      setImportMessage(res.message);
      setImportSuccess(true);
      fetchStock();
      fetchBins();
    } catch (err: any) {
      setImportMessage(err?.response?.data?.error || err.message || 'Gagal mengimpor saldo awal');
      setImportSuccess(false);
    } finally {
      setImportLoading(false);
    }
  };

  // --- RELOCATE PART TO BIN ---
  const openRelocateModal = (partId: string, partName: string, currentBin?: string) => {
    setRelocatePartId(partId);
    setRelocatePartName(partName);
    setRelocateCurrentBin(currentBin || '');
    setRelocateTargetBin(currentBin || (bins[0]?.bin_code || ''));
    setShowRelocateModal(true);
  };

  const handleExecuteRelocate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!relocatePartId) return;

    setRelocating(true);
    try {
      const res = await binApi.relocateStockBin(activeWarehouse, relocatePartId, relocateTargetBin || undefined);
      alert(res.message);
      setShowRelocateModal(false);
      fetchStock();
      fetchBins();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal memindahkan lokasi bin');
    } finally {
      setRelocating(false);
    }
  };

  // --- BIN CRUD HANDLERS ---
  const openCreateBinModal = () => {
    setBinModalMode('create');
    setBinModalId('');
    setBinFormCode('');
    setBinFormZone('BAY-LEFT');
    setBinFormLevel('LEVEL-1');
    setBinFormCapacity(10);
    setBinFormDesc('');
    setShowBinModal(true);
  };

  const openEditBinModal = (b: WarehouseBinItem) => {
    setBinModalMode('edit');
    setBinModalId(b.id);
    setBinFormCode(b.bin_code);
    setBinFormZone(b.zone);
    setBinFormLevel(b.shelf_level);
    setBinFormCapacity(b.capacity_parts);
    setBinFormDesc(b.description || '');
    setShowBinModal(true);
  };

  const handleSaveBin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!binFormCode.trim()) {
      alert('Kode Bin wajib diisi!');
      return;
    }

    setSavingBin(true);
    try {
      if (binModalMode === 'create') {
        const res = await binApi.createBin(activeWarehouse, {
          bin_code: binFormCode.trim().toUpperCase(),
          zone: binFormZone,
          shelf_level: binFormLevel,
          capacity_parts: Number(binFormCapacity) || 10,
          description: binFormDesc.trim() || undefined,
        });
        alert(res.message);
      } else {
        const res = await binApi.updateBin(activeWarehouse, binModalId, {
          bin_code: binFormCode.trim().toUpperCase(),
          zone: binFormZone,
          shelf_level: binFormLevel,
          capacity_parts: Number(binFormCapacity) || 10,
          description: binFormDesc.trim() || undefined,
        });
        alert(res.message);
      }
      setShowBinModal(false);
      fetchBins();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal menyimpan data bin');
    } finally {
      setSavingBin(false);
    }
  };

  const handleDeleteBin = async (b: WarehouseBinItem) => {
    if (!window.confirm(`Hapus atau nonaktifkan Bin "${b.bin_code}"?`)) return;

    try {
      const res = await binApi.deleteBin(activeWarehouse, b.id);
      alert(res.message);
      fetchBins();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal menghapus bin');
    }
  };

  const filtered = stocks.filter((s) => {
    if (statusFilter === 'ALL') return true;
    return s.status === statusFilter;
  });

  const filteredBins = bins.filter((b) => {
    if (zoneFilter === 'ALL') return true;
    return b.zone === zoneFilter;
  });

  // Calculate Bin Statistics
  const totalBinsCount = bins.length;
  const occupiedBinsCount = bins.filter((b) => (b.current_items_count ?? 0) > 0).length;
  const totalPartsStored = bins.reduce((acc, b) => acc + (b.current_items_count ?? 0), 0);
  const occupancyPercentage = totalBinsCount > 0 ? Math.round((occupiedBinsCount / totalBinsCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            Monitoring Persediaan & Tata Letak Bin Gudang Kontainer
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Gudang: <span className="font-semibold text-cyan-300">{activeWarehouseInfo?.name}</span> ({activeWarehouse})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              setIsImportModalOpen(true);
              setImportMessage(null);
              setImportSuccess(false);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Import Excel Saldo Awal</span>
          </button>
          <button
            onClick={() => {
              fetchStock();
              fetchBins();
            }}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            title="Refresh Stok & Denah Bin"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs (Tabel Stok vs Denah & Bin Kontainer) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('stock')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
              viewMode === 'stock'
                ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Table className="w-4 h-4" />
            <span>Tabel Saldo Persediaan ({stocks.length} Part)</span>
          </button>
          <button
            onClick={() => setViewMode('bins')}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
              viewMode === 'bins'
                ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Layout & Denah Bin Rak ({bins.length} Bin)</span>
          </button>
        </div>

        {viewMode === 'bins' && canManageBins && (
          <button
            onClick={openCreateBinModal}
            className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            <span>+ Tambah Bin / Rak Baru</span>
          </button>
        )}
      </div>

      {/* VIEW 1: MAIN STOCK TABLE */}
      {viewMode === 'stock' && (
        <div className="space-y-4">
          {/* Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari part number atau nama suku cadang..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900/80 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <span className="text-xs text-slate-500 shrink-0">Filter Status:</span>
              {(['ALL', 'CRITICAL', 'WARNING', 'NORMAL'] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all ${
                    statusFilter === st
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                      : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {st === 'ALL' && 'Semua'}
                  {st === 'CRITICAL' && '🔴 Kritis'}
                  {st === 'WARNING' && '🟡 Menipis'}
                  {st === 'NORMAL' && '🟢 Aman'}
                </button>
              ))}
            </div>
          </div>

          {/* Main Stock Table */}
          <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">Part Number</th>
                    <th className="py-3.5 px-4 font-semibold">Nama Spare Part</th>
                    <th className="py-3.5 px-4 font-semibold text-center">Status</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Saldo On-Hand</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Min / Max</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Safety</th>
                    <th className="py-3.5 px-4 font-semibold">Lokasi Bin / Rak</th>
                    <th className="py-3.5 px-4 font-semibold text-center">Tipe Kritikal</th>
                    <th className="py-3.5 px-4 font-semibold text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500">
                        Memuat data persediaan kontainer...
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500">
                        Tidak ada suku cadang yang cocok dengan kriteria pencarian.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-cyan-300">
                          {item.spare_part_id}
                        </td>
                        <td className="py-3 px-4 text-slate-200">
                          <div className="font-medium">{item.part_name}</div>
                          <div className="text-[10px] text-slate-500 flex gap-2">
                            <span>{item.brand || 'No Brand'}</span>
                            {item.category_name && <span>• {item.category_name}</span>}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              item.status === 'CRITICAL'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                                : item.status === 'WARNING'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {item.status === 'CRITICAL' && '🔴 Kritis'}
                            {item.status === 'WARNING' && '🟡 Warning'}
                            {item.status === 'NORMAL' && '🟢 Normal'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-sm text-white">
                          {item.qty_on_hand}{' '}
                          <span className="text-[10px] font-normal text-slate-400">{item.unit_of_measure}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-400">
                          {item.min_stock} / {item.max_stock}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-400">
                          {item.safety_stock}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => openRelocateModal(item.spare_part_id, item.part_name, item.rack_location)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-700 hover:border-cyan-500/60 font-mono text-[11px] text-cyan-300 hover:text-white transition group"
                            title="Klik untuk memindahkan lokasi bin part ini"
                          >
                            <Layers className="w-3 h-3 text-cyan-400" />
                            <span>{item.rack_location || 'Atur Bin'}</span>
                            <MoveRight className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100 transition" />
                          </button>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {item.requires_issue_approval ? (
                            <span className="text-[10px] font-semibold text-rose-400 bg-rose-950/40 border border-rose-800/40 px-2 py-0.5 rounded">
                              Wajib Approval
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">Reguler</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => handleOpenMovements(item)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[11px] font-medium transition-colors"
                            title="Lihat Buku Besar Mutasi"
                          >
                            <History className="w-3.5 h-3.5" />
                            <span>Kartu Stok</span>
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

      {/* VIEW 2: CONTAINER BINS & RACKS LAYOUT */}
      {viewMode === 'bins' && (
        <div className="space-y-6">
          {/* KPI Metrics Banner */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card p-4 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400">Total Bin / Rak</span>
                <div className="text-xl font-bold font-mono text-white mt-0.5">{totalBinsCount} Bin</div>
              </div>
              <div className="p-2.5 rounded-xl bg-cyan-950/50 text-cyan-400 border border-cyan-800/40">
                <Layers className="w-5 h-5" />
              </div>
            </div>

            <div className="glass-card p-4 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400">Bin Terisi</span>
                <div className="text-xl font-bold font-mono text-emerald-400 mt-0.5">{occupiedBinsCount} Bin</div>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-950/50 text-emerald-400 border border-emerald-800/40">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="glass-card p-4 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400">Part Terpetakan</span>
                <div className="text-xl font-bold font-mono text-cyan-300 mt-0.5">{totalPartsStored} Item</div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-800 text-cyan-300 border border-slate-700">
                <Boxes className="w-5 h-5" />
              </div>
            </div>

            <div className="glass-card p-4 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-400">Tingkat Okupansi</span>
                <div className="text-xl font-bold font-mono text-amber-400 mt-0.5">{occupancyPercentage}%</div>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-950/50 text-amber-400 border border-amber-800/40">
                <Info className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Zone Filter Pill Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs text-slate-500 shrink-0">Filter Zona Rak:</span>
            {['ALL', 'BAY-LEFT', 'BAY-RIGHT', 'FLOOR-BAY', 'BAY-GENERAL'].map((z) => (
              <button
                key={z}
                onClick={() => setZoneFilter(z)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all ${
                  zoneFilter === z
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                    : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {z === 'ALL' && 'Semua Zona'}
                {z === 'BAY-LEFT' && '⬅️ Bay Kiri'}
                {z === 'BAY-RIGHT' && '➡️ Bay Kanan'}
                {z === 'FLOOR-BAY' && '🛢️ Area Drum / Lantai'}
                {z === 'BAY-GENERAL' && '📦 Rak Umum'}
              </button>
            ))}
          </div>

          {/* Visual Bin Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {binLoading ? (
              <div className="col-span-full py-12 text-center text-slate-400 text-xs">
                Memuat denah dan lokasi bin kontainer...
              </div>
            ) : filteredBins.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-500 text-xs glass-card rounded-2xl border border-slate-800">
                Belum ada bin yang terdaftar pada zona ini.
              </div>
            ) : (
              filteredBins.map((b) => {
                const parts = Array.isArray(b.parts) ? b.parts : [];
                const isOccupied = parts.length > 0;
                const capacity = b.capacity_parts || 10;
                const percent = Math.min(100, Math.round((parts.length / capacity) * 100));

                return (
                  <div
                    key={b.id}
                    className="glass-card rounded-2xl p-5 border border-slate-800/80 hover:border-slate-700 transition flex flex-col justify-between space-y-4"
                  >
                    <div>
                      {/* Bin Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm text-cyan-300 bg-cyan-950/60 px-2.5 py-1 rounded border border-cyan-800/60">
                              {b.bin_code}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {b.zone}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
                            <span>Level: <b className="text-slate-200">{b.shelf_level}</b></span>
                            <span>•</span>
                            <span className="line-clamp-1">{b.description || 'Rak Kompartemen'}</span>
                          </div>
                        </div>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isOccupied
                              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                          }`}
                        >
                          {isOccupied ? 'Terisi' : 'Kosong'}
                        </span>
                      </div>

                      {/* Capacity Bar */}
                      <div className="mt-3 space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>Kapasitas Bin</span>
                          <span className="font-mono text-slate-200">
                            {parts.length} / {capacity} Part ({percent}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              percent >= 100
                                ? 'bg-rose-500'
                                : percent >= 75
                                ? 'bg-amber-400'
                                : 'bg-cyan-400'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      {/* Parts Stored List */}
                      <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2">
                        <div className="text-[11px] font-semibold text-slate-300 flex items-center justify-between">
                          <span>Part di Bin Ini:</span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            Total: {Number(b.total_qty || 0)} Pcs
                          </span>
                        </div>

                        {parts.length === 0 ? (
                          <div className="text-[11px] text-slate-500 italic py-2">
                            Bin ini masih kosong (siap dialokasikan).
                          </div>
                        ) : (
                          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                            {parts.map((p: any, idx: number) => (
                              <div
                                key={idx}
                                className="p-2 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between text-[11px]"
                              >
                                <div>
                                  <span className="font-mono font-bold text-cyan-300">{p.spare_part_id}</span>
                                  <p className="text-[10px] text-slate-400 line-clamp-1">{p.part_name}</p>
                                </div>
                                <div className="text-right">
                                  <span className="font-mono font-bold text-white">
                                    {p.qty_on_hand} <span className="text-[9px] font-normal text-slate-400">{p.unit_of_measure}</span>
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bin Actions */}
                    {canManageBins && (
                      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                        <button
                          type="button"
                          onClick={() => openEditBinModal(b)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1 text-[11px]"
                        >
                          <Edit2 className="w-3 h-3" />
                          <span>Edit Bin</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteBin(b)}
                          className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-200 border border-rose-800/40 transition"
                          title="Hapus / Nonaktifkan Bin"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* MODAL PINDAH LOKASI BIN (RELOCATE) */}
      {showRelocateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-cyan-500/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-cyan-400">
                <MoveRight className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">Relokasi / Pindah Lokasi Bin</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRelocateModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleExecuteRelocate} className="space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                <div className="text-slate-400">Suku Cadang yang Dipindahkan:</div>
                <div className="font-mono font-bold text-cyan-300 text-sm">{relocatePartId}</div>
                <div className="text-slate-200 font-semibold">{relocatePartName}</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Lokasi Bin Saat Ini: <span className="font-mono text-slate-300">{relocateCurrentBin || 'Belum Ditentukan'}</span>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Pilih Lokasi Bin Baru di Gudang ({activeWarehouse}) *
                </label>
                <select
                  value={relocateTargetBin}
                  onChange={(e) => setRelocateTargetBin(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:border-cyan-500 focus:outline-none"
                >
                  <option value="">-- Kosongkan (Unassign Lokasi) --</option>
                  {bins.map((b) => (
                    <option key={b.id} value={b.bin_code}>
                      {b.bin_code} — {b.zone} ({b.shelf_level}) [{b.current_items_count || 0}/{b.capacity_parts} Part]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Atau Ketik Kode Bin Manual</label>
                <input
                  type="text"
                  placeholder="Contoh: RACK-HE-C2"
                  value={relocateTargetBin}
                  onChange={(e) => setRelocateTargetBin(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono uppercase focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowRelocateModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={relocating}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold disabled:opacity-50 flex items-center gap-1.5"
                >
                  {relocating ? 'Memindahkan...' : 'Konfirmasi Pindah Bin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ADD / EDIT BIN */}
      {showBinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-cyan-500/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-cyan-400">
                <Layers className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">
                  {binModalMode === 'create' ? 'Tambah Bin / Rak Baru' : 'Edit Data Bin'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBinModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBin} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Kode Bin / Rak *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: RACK-HE-A4 atau BIN-B1-02"
                  value={binFormCode}
                  onChange={(e) => setBinFormCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono uppercase focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Zona Kontainer *</label>
                  <select
                    value={binFormZone}
                    onChange={(e) => setBinFormZone(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="BAY-LEFT">Bay Kiri (BAY-LEFT)</option>
                    <option value="BAY-RIGHT">Bay Kanan (BAY-RIGHT)</option>
                    <option value="FLOOR-BAY">Area Lantai / Drum</option>
                    <option value="BAY-CENTER">Tengah (BAY-CENTER)</option>
                    <option value="BAY-GENERAL">Umum (BAY-GENERAL)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Level Rak *</label>
                  <select
                    value={binFormLevel}
                    onChange={(e) => setBinFormLevel(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="LEVEL-1">Level 1 (Bawah)</option>
                    <option value="LEVEL-2">Level 2 (Tengah)</option>
                    <option value="LEVEL-3">Level 3 (Atas)</option>
                    <option value="LEVEL-4">Level 4 (Paling Atas)</option>
                    <option value="FLOOR">Floor (Lantai)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Kapasitas Maksimal Jenis Part</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={binFormCapacity}
                  onChange={(e) => setBinFormCapacity(Number(e.target.value) || 10)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Keterangan / Kategori Part yang Disimpan</label>
                <textarea
                  rows={2}
                  placeholder="Misal: Khusus Fast Moving O-Ring & Seal Kit..."
                  value={binFormDesc}
                  onChange={(e) => setBinFormDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowBinModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingBin}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold disabled:opacity-50"
                >
                  {savingBin ? 'Menyimpan...' : binModalMode === 'create' ? 'Simpan Bin' : 'Perbarui Bin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Kartu Stok / Ledger Movements */}
      {selectedPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-3xl rounded-2xl border border-slate-700 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-cyan-400" />
                  Buku Besar Mutasi Stok ({selectedPart.spare_part_id})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedPart.part_name} — Saldo Sekarang: <span className="text-cyan-300 font-bold font-mono">{selectedPart.qty_on_hand} {selectedPart.unit_of_measure}</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedPart(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {movementLoading ? (
                <div className="py-8 text-center text-slate-500 text-xs">Memuat mutasi...</div>
              ) : movements.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs">Belum ada riwayat mutasi stok.</div>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Waktu</th>
                      <th className="py-2.5 px-3 font-semibold">Jenis Mutasi</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Kuantitas</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Saldo Sesudah</th>
                      <th className="py-2.5 px-3 font-semibold">Referensi</th>
                      <th className="py-2.5 px-3 font-semibold">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {movements.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-3 text-[11px] text-slate-400">
                          {new Date(m.created_at).toLocaleString('id-ID')}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded ${
                              m.movement_type === 'INITIAL_IMPORT'
                                ? 'bg-blue-500/10 text-blue-400'
                                : m.movement_type === 'DROP_IN' || m.movement_type === 'ADJUSTMENT_IN'
                                ? 'bg-emerald-500/10 text-emerald-400'
                                : 'bg-rose-500/10 text-rose-400'
                            }`}
                          >
                            {m.movement_type === 'INITIAL_IMPORT' && 'Saldo Awal'}
                            {m.movement_type === 'DROP_IN' && 'Suplai Drop In'}
                            {m.movement_type === 'ISSUE_OUT' && 'Pengeluaran POS'}
                            {m.movement_type === 'ADJUSTMENT_IN' && 'Koreksi Tambah'}
                            {m.movement_type === 'ADJUSTMENT_OUT' && 'Koreksi Kurang'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-white">
                          {m.qty}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-cyan-300">
                          {m.balance_after}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                          {m.reference_number || '-'}
                        </td>
                        <td className="py-2.5 px-3 font-sans text-slate-300 text-[11px]">
                          {m.notes || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedPart(null)}
                className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL IMPORT EXCEL SALDO AWAL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-2xl rounded-2xl border border-slate-700 p-6 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
            {/* Header Modal */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  Import Saldo Awal Gudang ({activeWarehouse})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Tujuan: <span className="text-cyan-300 font-semibold">{activeWarehouseInfo?.name}</span>
                </p>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switcher */}
            <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2 shrink-0">
              <button
                type="button"
                onClick={() => setImportMode('excel')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  importMode === 'excel'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Upload File Excel (.xlsx / .csv)</span>
              </button>
              <button
                type="button"
                onClick={() => setImportMode('json')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  importMode === 'json'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Format Teks JSON</span>
              </button>
            </div>

            {/* Feedback Notifications */}
            {importMessage && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 shrink-0 ${
                  importSuccess
                    ? 'bg-emerald-950/40 border-emerald-800/50 text-emerald-300'
                    : 'bg-rose-950/40 border-rose-800/50 text-rose-300'
                }`}
              >
                {importSuccess ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                )}
                <span>{importMessage}</span>
              </div>
            )}

            {parseError && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 text-rose-300 text-xs flex items-center gap-2 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{parseError}</span>
              </div>
            )}

            {/* Content Area */}
            <div className="overflow-y-auto space-y-4 flex-1 pr-1">
              {importMode === 'excel' ? (
                <>
                  {/* Step 1: Download Template */}
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Download className="w-3.5 h-3.5 text-cyan-400" />
                        1. Unduh Template Excel Resmi
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Format file Excel (.xlsx) dengan kolom standar PT Vale dan contoh data suku cadang.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Template .xlsx</span>
                    </button>
                  </div>

                  {/* Step 2: Upload File Dropzone */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-emerald-400" />
                      2. Unggah File Excel yang Telah Diisi
                    </label>

                    {!uploadedFileName ? (
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-slate-700 hover:border-emerald-500/60 rounded-xl p-6 text-center cursor-pointer bg-slate-900/40 hover:bg-emerald-950/10 transition group"
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".xlsx, .xls, .csv"
                          onChange={handleFileUpload}
                          className="hidden"
                        />
                        <FileSpreadsheet className="w-8 h-8 text-slate-500 group-hover:text-emerald-400 mx-auto transition" />
                        <p className="text-xs font-semibold text-slate-200 mt-2">
                          Klik untuk memilih file Excel atau seret file ke sini
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Mendukung ekstensi: <span className="font-mono text-cyan-300">.xlsx</span>, <span className="font-mono text-cyan-300">.xls</span>, <span className="font-mono text-cyan-300">.csv</span>
                        </p>
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <FileCheck className="w-5 h-5 text-emerald-400" />
                          <div>
                            <span className="text-xs font-bold text-white">{uploadedFileName}</span>
                            <span className="text-[11px] text-emerald-400 ml-2">
                              ({parsedRows.length} item terdeteksi)
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={handleResetUpload}
                          className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 px-2 py-1 rounded bg-rose-950/30 border border-rose-800/40"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Ganti File</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Step 3: Data Preview Table */}
                  {parsedRows.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <Table className="w-3.5 h-3.5 text-cyan-400" />
                          Preview Baris Data yang Akan Diimpor ({parsedRows.length} Baris):
                        </h4>
                      </div>

                      <div className="max-h-56 overflow-y-auto border border-slate-800 rounded-xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-900 text-slate-400 sticky top-0 text-[11px]">
                            <tr>
                              <th className="py-2 px-3">No</th>
                              <th className="py-2 px-3">Part Number</th>
                              <th className="py-2 px-3">Nama Suku Cadang</th>
                              <th className="py-2 px-3 text-right">Saldo Fisik</th>
                              <th className="py-2 px-3 text-right">Min / Max</th>
                              <th className="py-2 px-3">Rak / Bin</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                            {parsedRows.map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-800/40">
                                <td className="py-2 px-3 text-slate-500">{idx + 1}</td>
                                <td className="py-2 px-3 font-bold text-cyan-400">{row.spare_part_id}</td>
                                <td className="py-2 px-3 font-sans text-slate-300">
                                  {row.part_name || '-'}
                                </td>
                                <td className="py-2 px-3 text-right font-bold text-white">
                                  {row.qty_on_hand}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-400">
                                  {row.min_stock} / {row.max_stock}
                                </td>
                                <td className="py-2 px-3 text-slate-300">{row.rack_location || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Fallback JSON Text Mode */
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-300">
                    Format Data JSON Saldo Awal
                  </label>
                  <textarea
                    rows={8}
                    value={importJson}
                    onChange={(e) => setImportJson(e.target.value)}
                    className="w-full p-3 font-mono text-xs bg-slate-900 border border-slate-700 rounded-lg text-cyan-200 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              )}
            </div>

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800 shrink-0">
              <span className="text-[11px] text-slate-500">
                {importMode === 'excel' && parsedRows.length > 0 && `${parsedRows.length} item siap disimpan`}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300 font-semibold hover:bg-slate-700 transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  disabled={importLoading || (importMode === 'excel' && parsedRows.length === 0)}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-slate-950 disabled:opacity-50 transition flex items-center gap-1.5"
                >
                  {importLoading ? (
                    'Memproses Import...'
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        Simpan Saldo Awal {importMode === 'excel' && parsedRows.length > 0 ? `(${parsedRows.length} Item)` : ''}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
