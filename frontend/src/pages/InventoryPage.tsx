import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { inventoryApi } from '../api';
import type { InventoryStockItem, StockMovement } from '../types';
import {
  Search,
  History,
  FileSpreadsheet,
  X,
  RotateCcw,
} from 'lucide-react';

export const InventoryPage: React.FC = () => {
  const { activeWarehouse, activeWarehouseInfo } = useAuth();
  const [stocks, setStocks] = useState<InventoryStockItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NORMAL' | 'WARNING' | 'CRITICAL'>('ALL');
  const [loading, setLoading] = useState(true);

  // Stock Movement Modal
  const [selectedPart, setSelectedPart] = useState<InventoryStockItem | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementLoading, setMovementLoading] = useState(false);

  // Import Modal
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importJson, setImportJson] = useState(`[
  { "spare_part_id": "FLT-001", "qty_on_hand": 50, "min_stock": 15, "max_stock": 80, "rack_location": "RACK-A1" },
  { "spare_part_id": "FLT-002", "qty_on_hand": 20, "min_stock": 10, "max_stock": 50, "rack_location": "RACK-A2" }
]`);
  const [importLoading, setImportLoading] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

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

  useEffect(() => {
    fetchStock();
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

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportLoading(true);
    setImportMessage(null);
    try {
      const parsed = JSON.parse(importJson);
      const res = await inventoryApi.importInitialStock(activeWarehouse, parsed);
      setImportMessage(res.message);
      fetchStock();
    } catch (err: any) {
      setImportMessage(err?.response?.data?.error || 'Format JSON tidak valid');
    } finally {
      setImportLoading(false);
    }
  };

  const filtered = stocks.filter((s) => {
    if (statusFilter === 'ALL') return true;
    return s.status === statusFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            Monitoring Saldo Persediaan Kontainer
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Gudang: <span className="font-semibold text-cyan-300">{activeWarehouseInfo?.name}</span> ({activeWarehouse})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-xs transition-all"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400" />
            <span>Import Saldo Awal</span>
          </button>
          <button
            onClick={fetchStock}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
            title="Refresh Stok"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

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
                <th className="py-3.5 px-4 font-semibold">Lokasi Rak</th>
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
                    <td className="py-3 px-4 font-mono text-slate-300 text-[11px]">
                      {item.rack_location || '-'}
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

      {/* Modal Import Saldo Awal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-xl rounded-2xl border border-slate-700 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
                Import Saldo Awal Gudang Kontainer
              </h3>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {importMessage && (
              <div className="p-3 rounded-lg bg-cyan-950/40 border border-cyan-800/40 text-cyan-300 text-xs">
                {importMessage}
              </div>
            )}

            <form onSubmit={handleImportSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Format Data JSON Saldo Awal
                </label>
                <textarea
                  rows={8}
                  value={importJson}
                  onChange={(e) => setImportJson(e.target.value)}
                  className="w-full p-3 font-mono text-xs bg-slate-900 border border-slate-700 rounded-lg text-cyan-200 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={importLoading}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-xs font-bold text-slate-950 disabled:opacity-50"
                >
                  {importLoading ? 'Memproses...' : 'Simpan Saldo Awal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
