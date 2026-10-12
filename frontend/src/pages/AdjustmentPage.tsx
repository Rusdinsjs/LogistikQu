import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { adjustmentApi, masterApi, inventoryApi } from '../api';
import type { StockAdjustment, SparePart, InventoryStockItem } from '../types';
import {
  SlidersHorizontal,
  Plus,
  CheckCircle2,
  Clock,
  RotateCcw,
  AlertTriangle,
  FileCheck,
} from 'lucide-react';

export const AdjustmentPage: React.FC = () => {
  const { currentWarehouse, user } = useAuth();
  const [adjustments, setAdjustments] = useState<StockAdjustment[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form states
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [currentStocks, setCurrentStocks] = useState<InventoryStockItem[]>([]);
  const [selectedPartId, setSelectedPartId] = useState('');
  const [physicalQty, setPhysicalQty] = useState<number>(0);
  const [reason, setReason] = useState('Stock Opname Rutin');
  const [notes, setNotes] = useState('');

  const isSupervisor =
    user?.role_id === 'SUPER_ADMIN' ||
    user?.permissions?.includes('adjustment.approve') ||
    false;

  const canCreateAdjustment =
    user?.role_id === 'SUPER_ADMIN' ||
    user?.permissions?.includes('adjustment.create') ||
    false;

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await adjustmentApi.listAdjustments();
      setAdjustments(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMaster = async () => {
    try {
      const parts = await masterApi.getSpareParts();
      setSpareParts(parts);
      if (currentWarehouse) {
        const stocks = await inventoryApi.getStock(currentWarehouse.id);
        setCurrentStocks(stocks);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
    loadMaster();
  }, [currentWarehouse]);

  const handleCreateAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWarehouse) return;
    if (!selectedPartId) {
      alert('Pilih suku cadang yang akan disesuaikan');
      return;
    }

    try {
      const payload = {
        warehouse_id: currentWarehouse.id,
        reason,
        notes,
        items: [
          {
            spare_part_id: selectedPartId,
            qty_physical: physicalQty,
          },
        ],
      };

      const res = await adjustmentApi.createAdjustment(
        payload.warehouse_id,
        payload.reason,
        payload.items,
        payload.notes
      );
      alert(res.message || 'Pengajuan Stock Opname berhasil diajukan!');
      setShowCreateModal(false);
      setSelectedPartId('');
      setPhysicalQty(0);
      setNotes('');
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal mengajukan penyesuaian');
    }
  };

  const handleApprove = async (id: string, adjNumber: string) => {
    if (!confirm(`Setujui pengajuan penyesuaian ${adjNumber}? Saldo sistem akan diselaraskan dengan hasil opname fisik.`)) return;
    try {
      const res = await adjustmentApi.approveAdjustment(id);
      alert(res.message || 'Penyesuaian stok berhasil disetujui');
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menyetujui');
    }
  };

  const currentSystemQty = currentStocks.find((s) => s.spare_part_id === selectedPartId)?.qty_on_hand ?? 0;
  const difference = physicalQty - Number(currentSystemQty);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <SlidersHorizontal className="w-7 h-7 text-cyan-400" />
            Stock Opname & Penyesuaian Saldo
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Penyesuaian selisih stok fisik wajib melalui persetujuan Supervisor sebelum mengubah saldo sistem (BR-021, BR-022).
          </p>
        </div>

        {canCreateAdjustment && (
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition"
            >
              <Plus className="w-4 h-4" />
              Pengajuan Opname Baru
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl overflow-hidden border border-slate-800/80">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
            Daftar Dokumen Penyesuaian / Stock Opname
          </div>
          <button onClick={loadData} className="text-xs text-cyan-400 hover:underline flex items-center gap-1">
            <RotateCcw className="w-3.5 h-3.5" /> Segarkan
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">No. Dokumen</th>
                <th className="px-5 py-3.5">Gudang</th>
                <th className="px-5 py-3.5">Alasan Penyesuaian</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Waktu Pengajuan</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    Memuat data penyesuaian...
                  </td>
                </tr>
              ) : adjustments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                    Belum ada pengajuan stock opname
                  </td>
                </tr>
              ) : (
                adjustments.map((adj) => (
                  <tr key={adj.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-5 py-4 font-mono font-semibold text-cyan-400">
                      {adj.adjustment_number}
                    </td>
                    <td className="px-5 py-4 font-medium text-slate-200">{adj.warehouse_id}</td>
                    <td className="px-5 py-4 text-slate-300">{adj.reason}</td>
                    <td className="px-5 py-4">
                      {adj.status === 'APPROVED' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3 h-3" /> Disetujui (Saldo Diupdate)
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          <Clock className="w-3 h-3" /> Menunggu Persetujuan Supervisor
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-xs text-slate-400">
                      {new Date(adj.created_at).toLocaleString('id-ID')}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {adj.status === 'PENDING_APPROVAL' && isSupervisor ? (
                        <button
                          onClick={() => handleApprove(adj.id, adj.adjustment_number)}
                          className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs shadow-md shadow-emerald-500/20 inline-flex items-center gap-1.5 transition"
                        >
                          <FileCheck className="w-3.5 h-3.5" /> Setujui Dokumen
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500 font-mono">
                          {adj.status === 'APPROVED' ? 'Selesai' : 'Pending Spv'}
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

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-card max-w-lg w-full p-6 rounded-2xl border border-cyan-500/40 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-cyan-400" />
                Formulir Stock Opname / Penyesuaian
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAdjustment} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1">Gudang:</label>
                <input
                  type="text"
                  disabled
                  value={currentWarehouse?.name || currentWarehouse?.id}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-slate-400 font-semibold"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Pilih Suku Cadang <span className="text-rose-400">*</span>:
                </label>
                <select
                  value={selectedPartId}
                  onChange={(e) => setSelectedPartId(e.target.value)}
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:border-cyan-500"
                >
                  <option value="">-- Pilih Suku Cadang --</option>
                  {spareParts.map((sp) => (
                    <option key={sp.id} value={sp.id}>
                      {sp.id} - {sp.part_name}
                    </option>
                  ))}
                </select>
              </div>

              {selectedPartId && (
                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400">Saldo On-Hand Saat Ini (Sistem):</span>
                  <span className="font-mono font-bold text-slate-200">{currentSystemQty}</span>
                </div>
              )}

              <div>
                <label className="block text-slate-400 font-medium mb-1">
                  Hasil Hitung Fisik (Physical Count) <span className="text-rose-400">*</span>:
                </label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={physicalQty}
                  onChange={(e) => setPhysicalQty(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 font-bold focus:border-cyan-500"
                />
              </div>

              {selectedPartId && (
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                    difference === 0
                      ? 'bg-slate-900 border-slate-800 text-slate-400'
                      : difference > 0
                      ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-400'
                      : 'bg-rose-950/30 border-rose-800/50 text-rose-400'
                  }`}
                >
                  <span className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" /> Selisih (Fisik - Sistem):
                  </span>
                  <span className="font-mono font-bold text-sm">
                    {difference > 0 ? `+${difference}` : difference}
                  </span>
                </div>
              )}

              <div>
                <label className="block text-slate-400 font-medium mb-1">Alasan Penyesuaian:</label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:border-cyan-500"
                >
                  <option value="Stock Opname Rutin">Stock Opname Rutin Bulanan</option>
                  <option value="Selisih Penghitungan Fisik">Selisih Penghitungan Fisik Lapangan</option>
                  <option value="Kerusakan / Rusak saat Penyimpanan">Kerusakan / Rusak saat Penyimpanan</option>
                  <option value="Koreksi Salah Input Transaksi">Koreksi Salah Input Transaksi</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1">Catatan Tambahan:</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Detail temuan fisik..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:border-cyan-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold shadow-lg shadow-cyan-500/20"
                >
                  Ajukan ke Supervisor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
