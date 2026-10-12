import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast, confirmDialog } from '../context/ToastContext';
import { binApi } from '../api';
import type { WarehouseBinItem } from '../types';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  CheckCircle2,
  Boxes,
  Info,
  X,
  MoveRight,
  PlusCircle,
} from 'lucide-react';

// Preset default untuk zona dan level rak
const DEFAULT_ZONES = [
  { value: 'BAY-LEFT', label: 'Bay Kiri (BAY-LEFT)' },
  { value: 'BAY-RIGHT', label: 'Bay Kanan (BAY-RIGHT)' },
  { value: 'BAY-CENTER', label: 'Bay Tengah (BAY-CENTER)' },
  { value: 'FLOOR-BAY', label: 'Area Lantai / Drum (FLOOR-BAY)' },
  { value: 'BAY-GENERAL', label: 'Rak Umum (BAY-GENERAL)' },
];

const DEFAULT_LEVELS = [
  { value: 'LEVEL-1', label: 'Level 1 (Bawah)' },
  { value: 'LEVEL-2', label: 'Level 2 (Tengah)' },
  { value: 'LEVEL-3', label: 'Level 3 (Atas)' },
  { value: 'LEVEL-4', label: 'Level 4 (Paling Atas)' },
  { value: 'FLOOR', label: 'Floor (Lantai)' },
];

export const WarehouseBinsPage: React.FC = () => {
  const { activeWarehouse, activeWarehouseInfo, user } = useAuth();
  const canManageBins =
    user?.role_id === 'SUPER_ADMIN' ||
    user?.permissions?.includes('bins.manage') ||
    user?.permissions?.includes('master.manage');

  const [bins, setBins] = useState<WarehouseBinItem[]>([]);
  const [zoneFilter, setZoneFilter] = useState<string>('ALL');
  const [binLoading, setBinLoading] = useState(false);

  // Add / Edit Bin Modal State
  const [showBinModal, setShowBinModal] = useState(false);
  const [binModalMode, setBinModalMode] = useState<'create' | 'edit'>('create');
  const [binModalId, setBinModalId] = useState('');
  const [binFormCode, setBinFormCode] = useState('');
  const [binFormZone, setBinFormZone] = useState('BAY-LEFT');
  const [customZoneInput, setCustomZoneInput] = useState('');
  const [binFormLevel, setBinFormLevel] = useState('LEVEL-1');
  const [customLevelInput, setCustomLevelInput] = useState('');
  const [binFormCapacity, setBinFormCapacity] = useState(10);
  const [binFormDesc, setBinFormDesc] = useState('');
  const [savingBin, setSavingBin] = useState(false);

  // Relocate Modal State
  const [showRelocateModal, setShowRelocateModal] = useState(false);
  const [relocatePartId, setRelocatePartId] = useState('');
  const [relocatePartName, setRelocatePartName] = useState('');
  const [relocateCurrentBin, setRelocateCurrentBin] = useState('');
  const [relocateTargetBin, setRelocateTargetBin] = useState('');
  const [relocating, setRelocating] = useState(false);

  const fetchBins = async () => {
    setBinLoading(true);
    try {
      const data = await binApi.getWarehouseBins(activeWarehouse);
      setBins(data);
    } catch (err) {
      console.error('Failed to fetch warehouse bins:', err);
    } finally {
      setBinLoading(false);
    }
  };

  useEffect(() => {
    fetchBins();
  }, [activeWarehouse]);

  // Kumpulan seluruh zona unik yang terdaftar pada gudang ini + default preset
  const availableZones = useMemo(() => {
    const set = new Set<string>();
    DEFAULT_ZONES.forEach((z) => set.add(z.value));
    bins.forEach((b) => {
      if (b.zone) set.add(b.zone);
    });
    return Array.from(set);
  }, [bins]);

  // Kumpulan seluruh level unik yang terdaftar pada gudang ini + default preset
  const availableLevels = useMemo(() => {
    const set = new Set<string>();
    DEFAULT_LEVELS.forEach((l) => set.add(l.value));
    bins.forEach((b) => {
      if (b.shelf_level) set.add(b.shelf_level);
    });
    return Array.from(set);
  }, [bins]);

  // --- BIN CRUD HANDLERS ---
  const openCreateBinModal = () => {
    setBinModalMode('create');
    setBinModalId('');
    setBinFormCode('');
    setBinFormZone('BAY-LEFT');
    setCustomZoneInput('');
    setBinFormLevel('LEVEL-1');
    setCustomLevelInput('');
    setBinFormCapacity(10);
    setBinFormDesc('');
    setShowBinModal(true);
  };

  const openEditBinModal = (b: WarehouseBinItem) => {
    setBinModalMode('edit');
    setBinModalId(b.id);
    setBinFormCode(b.bin_code);

    // Cek apakah zone ada di preset atau merupakan custom
    if (availableZones.includes(b.zone)) {
      setBinFormZone(b.zone);
      setCustomZoneInput('');
    } else {
      setBinFormZone('__CUSTOM__');
      setCustomZoneInput(b.zone);
    }

    // Cek apakah level ada di preset atau merupakan custom
    if (availableLevels.includes(b.shelf_level)) {
      setBinFormLevel(b.shelf_level);
      setCustomLevelInput('');
    } else {
      setBinFormLevel('__CUSTOM__');
      setCustomLevelInput(b.shelf_level);
    }

    setBinFormCapacity(b.capacity_parts);
    setBinFormDesc(b.description || '');
    setShowBinModal(true);
  };

  const handleSaveBin = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCode = binFormCode.trim().toUpperCase();
    if (!finalCode) {
      toast.warning('Kode Bin wajib diisi!');
      return;
    }

    // Tentukan zona final (jika custom, ambil dari input custom)
    const finalZone =
      binFormZone === '__CUSTOM__'
        ? customZoneInput.trim().toUpperCase().replace(/\s+/g, '-')
        : binFormZone.trim().toUpperCase();

    if (!finalZone) {
      toast.warning('Nama Zona Kontainer wajib diisi!');
      return;
    }

    // Tentukan level final (jika custom, ambil dari input custom)
    const finalLevel =
      binFormLevel === '__CUSTOM__'
        ? customLevelInput.trim().toUpperCase().replace(/\s+/g, '-')
        : binFormLevel.trim().toUpperCase();

    if (!finalLevel) {
      toast.warning('Nama Level Rak wajib diisi!');
      return;
    }

    setSavingBin(true);
    try {
      if (binModalMode === 'create') {
        const res = await binApi.createBin(activeWarehouse, {
          bin_code: finalCode,
          zone: finalZone,
          shelf_level: finalLevel,
          capacity_parts: Number(binFormCapacity) || 10,
          description: binFormDesc.trim() || undefined,
        });
        toast.success(res.message);
      } else {
        const res = await binApi.updateBin(activeWarehouse, binModalId, {
          bin_code: finalCode,
          zone: finalZone,
          shelf_level: finalLevel,
          capacity_parts: Number(binFormCapacity) || 10,
          description: binFormDesc.trim() || undefined,
        });
        toast.success(res.message);
      }
      setShowBinModal(false);
      fetchBins();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || 'Gagal menyimpan data bin');
    } finally {
      setSavingBin(false);
    }
  };

  const handleDeleteBin = async (b: WarehouseBinItem) => {
    const ok = await confirmDialog({
      title: 'Hapus / Nonaktifkan Bin Rak',
      message: `Hapus atau nonaktifkan Bin "${b.bin_code}"?`,
      confirmText: 'Ya, Hapus Bin',
      variant: 'danger',
    });
    if (!ok) return;

    try {
      const res = await binApi.deleteBin(activeWarehouse, b.id);
      toast.success(res.message);
      fetchBins();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || 'Gagal menghapus bin');
    }
  };

  // --- RELOCATE PART TO BIN HANDLERS ---
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
      toast.success(res.message);
      setShowRelocateModal(false);
      fetchBins();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err?.response?.data?.message || 'Gagal memindahkan lokasi bin');
    } finally {
      setRelocating(false);
    }
  };

  const filteredBins = bins.filter((b) => {
    if (zoneFilter === 'ALL') return true;
    return b.zone === zoneFilter;
  });

  // Calculate Bin Statistics
  const totalBinsCount = bins.length;
  const occupiedBinsCount = bins.filter((b) => (b.current_items_count || 0) > 0).length;
  const totalPartsStored = bins.reduce((acc, b) => acc + (b.current_items_count || 0), 0);
  const occupancyPercentage = totalBinsCount > 0 ? Math.round((occupiedBinsCount / totalBinsCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-cyan-400" />
            <span>Layout & Denah Bin Rak Gudang Kontainer</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Gudang Terpilih:{' '}
            <span className="font-semibold text-cyan-300">{activeWarehouseInfo?.name}</span> ({activeWarehouse})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {canManageBins && (
            <button
              onClick={openCreateBinModal}
              className="px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Bin / Rak Baru</span>
            </button>
          )}
          <button
            onClick={fetchBins}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="Refresh Denah Bin"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

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
          <div className="p-2.5 rounded-xl bg-blue-950/50 text-blue-400 border border-blue-800/40">
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

      {/* Zone Filter Pill Chips (Dinamis: Semua Zona yang ada di gudang ini) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <span className="text-xs text-slate-500 shrink-0">Filter Zona Rak:</span>
        <button
          onClick={() => setZoneFilter('ALL')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all ${
            zoneFilter === 'ALL'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
          }`}
        >
          Semua Zona ({bins.length})
        </button>

        {availableZones.map((z) => {
          const countInZone = bins.filter((b) => b.zone === z).length;
          return (
            <button
              key={z}
              onClick={() => setZoneFilter(z)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition-all flex items-center gap-1.5 ${
                zoneFilter === z
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>{z}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                zoneFilter === z ? 'bg-slate-950 text-cyan-300' : 'bg-slate-800 text-slate-400'
              }`}>
                {countInZone}
              </span>
            </button>
          );
        })}
      </div>

      {/* Visual Bin Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {binLoading ? (
          <div className="col-span-full py-16 text-center text-slate-400 text-xs">
            Memuat denah dan tata letak bin kontainer...
          </div>
        ) : filteredBins.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-500 text-xs glass-card rounded-2xl border border-slate-800">
            Belum ada bin yang terdaftar pada zona ini. Klik &quot;+ Tambah Bin / Rak Baru&quot; untuk mulai mengatur denah.
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-cyan-300 bg-cyan-950/60 px-2.5 py-1 rounded border border-cyan-800/60">
                          {b.bin_code}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                          {b.zone}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
                        <span>
                          Level: <b className="text-slate-200">{b.shelf_level}</b>
                        </span>
                        <span>•</span>
                        <span className="line-clamp-1">{b.description || 'Rak Kompartemen'}</span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
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
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <span className="font-mono font-bold text-white">
                                  {p.qty_on_hand}{' '}
                                  <span className="text-[9px] font-normal text-slate-400">{p.unit_of_measure}</span>
                                </span>
                              </div>
                              {canManageBins && (
                                <button
                                  type="button"
                                  onClick={() => openRelocateModal(p.spare_part_id, p.part_name, b.bin_code)}
                                  title="Pindahkan part ini ke Bin lain"
                                  className="p-1 rounded bg-slate-800 hover:bg-cyan-500 hover:text-slate-950 text-slate-400 transition"
                                >
                                  <MoveRight className="w-3.5 h-3.5" />
                                </button>
                              )}
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

      {/* MODAL ADD / EDIT BIN (DENGAN CUSTOM ZONA & CUSTOM LEVEL) */}
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

            <form onSubmit={handleSaveBin} className="space-y-3.5 text-xs">
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

              {/* Pilihan Zona Kontainer (Preset + Custom) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-400 font-medium">Zona Kontainer *</label>
                  {binFormZone === '__CUSTOM__' && (
                    <span className="text-[10px] text-cyan-400 font-semibold flex items-center gap-0.5">
                      <PlusCircle className="w-3 h-3" /> Mode Custom
                    </span>
                  )}
                </div>

                <select
                  value={binFormZone}
                  onChange={(e) => setBinFormZone(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-cyan-500 focus:outline-none"
                >
                  <optgroup label="Zona Default / Terdaftar">
                    {availableZones.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Kustomisasi">
                    <option value="__CUSTOM__">➕ Tambah Zona Baru (Custom)...</option>
                  </optgroup>
                </select>

                {binFormZone === '__CUSTOM__' && (
                  <div className="pt-1">
                    <input
                      type="text"
                      required
                      placeholder="Ketik Nama Zona Baru (misal: MEZZANINE-A, BAY-FRONT)..."
                      value={customZoneInput}
                      onChange={(e) => setCustomZoneInput(e.target.value.toUpperCase())}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-cyan-500/50 rounded-lg text-cyan-200 font-mono uppercase text-xs focus:border-cyan-400 focus:outline-none"
                      autoFocus
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Zona baru ini akan otomatis tersimpan dan menjadi filter zona di denah.
                    </p>
                  </div>
                )}
              </div>

              {/* Pilihan Level Rak (Preset + Custom) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-400 font-medium">Level / Tingkat Rak *</label>
                  {binFormLevel === '__CUSTOM__' && (
                    <span className="text-[10px] text-cyan-400 font-semibold flex items-center gap-0.5">
                      <PlusCircle className="w-3 h-3" /> Mode Custom
                    </span>
                  )}
                </div>

                <select
                  value={binFormLevel}
                  onChange={(e) => setBinFormLevel(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-cyan-500 focus:outline-none"
                >
                  <optgroup label="Level Default / Terdaftar">
                    {availableLevels.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Kustomisasi">
                    <option value="__CUSTOM__">➕ Tambah Level Baru (Custom)...</option>
                  </optgroup>
                </select>

                {binFormLevel === '__CUSTOM__' && (
                  <div className="pt-1">
                    <input
                      type="text"
                      required
                      placeholder="Ketik Nama Level Baru (misal: LEVEL-5, DRAWER-BOTTOM)..."
                      value={customLevelInput}
                      onChange={(e) => setCustomLevelInput(e.target.value.toUpperCase())}
                      className="w-full px-3 py-1.5 bg-slate-950 border border-cyan-500/50 rounded-lg text-cyan-200 font-mono uppercase text-xs focus:border-cyan-400 focus:outline-none"
                      autoFocus
                    />
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Level kustom memungkinkan penataan bertingkat bebas sesuai fisik kontainer.
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Kapasitas Maksimal Jenis Part</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={binFormCapacity}
                  onChange={(e) => setBinFormCapacity(Number(e.target.value) || 10)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Keterangan / Deskripsi Bin</label>
                <textarea
                  rows={2}
                  placeholder="Misal: Rak Kompartemen O-Ring & Seal Kit Hidraulik..."
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
                <label className="block text-slate-400 mb-1">Pilih Lokasi Bin Baru *</label>
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
    </div>
  );
};
export default WarehouseBinsPage;
