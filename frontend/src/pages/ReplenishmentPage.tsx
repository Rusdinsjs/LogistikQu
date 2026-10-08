import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { replenishmentApi, masterApi } from '../api';
import type { ReplenishmentRequest, ReplenishmentDetail, RecommendationItem, SparePart } from '../types';
import {
  RotateCcw,
  Plus,
  CheckCircle,
  Clock,
  Truck,
  CheckCheck,
  AlertCircle,
  FileText,
  Filter,
  Eye,
  XCircle,
  Send,
  Boxes,
} from 'lucide-react';

export const ReplenishmentPage: React.FC = () => {
  const { currentWarehouse, user } = useAuth();
  const [activeTab, setActiveTab] = useState<'requests' | 'recommendations'>('requests');
  const [requests, setRequests] = useState<ReplenishmentRequest[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendationItem[]>([]);
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  
  // Detail Modal
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [requestDetail, setRequestDetail] = useState<ReplenishmentDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  
  // Verification edits
  const [verifyItems, setVerifyItems] = useState<{ spare_part_id: string; verified_qty: number; notes?: string }[]>([]);
  const [adminNotes, setAdminNotes] = useState('');
  
  // Supervisor action
  const [supervisorNotes, setSupervisorNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<'admin' | 'container'>('admin');

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newRequestItems, setNewRequestItems] = useState<{ spare_part_id: string; part_name: string; requested_qty: number; recommended_qty: number; notes: string }[]>([]);
  const [newRequestNotes, setNewRequestNotes] = useState('');

  // Selected recommendations to bulk add
  const [selectedRecPartIds, setSelectedRecPartIds] = useState<string[]>([]);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await replenishmentApi.listRequests(currentWarehouse?.warehouse_type === 'CONTAINER' ? currentWarehouse.id : undefined, statusFilter || undefined);
      setRequests(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadRecommendations = async () => {
    if (!currentWarehouse) return;
    try {
      setLoading(true);
      const whId = currentWarehouse.warehouse_type === 'CONTAINER' ? currentWarehouse.id : 'WH-CONT-HE';
      const data = await replenishmentApi.getRecommendations(whId);
      setRecommendations(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadSpareParts = async () => {
    try {
      const data = await masterApi.getSpareParts();
      setSpareParts(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadRequests();
    loadRecommendations();
    loadSpareParts();
  }, [currentWarehouse, statusFilter]);

  const openDetail = async (id: string) => {
    try {
      setSelectedRequestId(id);
      setDetailLoading(true);
      const data = await replenishmentApi.getRequestDetail(id);
      setRequestDetail(data);
      // init verify items
      setVerifyItems(data.items.map(it => ({
        spare_part_id: it.spare_part_id,
        verified_qty: Number(it.verified_qty || it.requested_qty),
        notes: it.notes || '',
      })));
      setAdminNotes(data.request.admin_notes || '');
      setSupervisorNotes(data.request.supervisor_notes || '');
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!selectedRequestId) return;
    try {
      await replenishmentApi.verifyRequest(selectedRequestId, verifyItems, adminNotes);
      alert('Permohonan berhasil diverifikasi dan diteruskan ke Supervisor!');
      openDetail(selectedRequestId);
      loadRequests();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal memverifikasi');
    }
  };

  const handleApprove = async () => {
    if (!selectedRequestId) return;
    try {
      const res = await replenishmentApi.approveRequest(selectedRequestId, supervisorNotes);
      alert(res.message || 'Permohonan disetujui & STO diterbitkan!');
      openDetail(selectedRequestId);
      loadRequests();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menyetujui');
    }
  };

  const handleRejectConfirm = async () => {
    if (!selectedRequestId || !rejectReason.trim()) {
      alert('Mohon isi alasan penolakan/pengembalian');
      return;
    }
    try {
      if (rejectTarget === 'admin') {
        // Supervisor to Main Admin
        const res = await replenishmentApi.supervisorReject(selectedRequestId, rejectReason);
        alert(res.message);
      } else {
        // Main Admin to Container Admin
        const res = await replenishmentApi.returnToContainer(selectedRequestId, rejectReason);
        alert(res.message);
      }
      setShowRejectDialog(false);
      setRejectReason('');
      openDetail(selectedRequestId);
      loadRequests();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menolak permohonan');
    }
  };

  const handleReceive = async () => {
    if (!selectedRequestId) return;
    if (!confirm('Konfirmasi penerimaan barang drop dari Gudang Utama ke stok kontainer ini?')) return;
    try {
      const res = await replenishmentApi.receiveDrop(selectedRequestId);
      alert(res.message || 'Barang berhasil diterima!');
      openDetail(selectedRequestId);
      loadRequests();
      loadRecommendations();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal memproses penerimaan');
    }
  };

  const handleAddRecToCreate = () => {
    const selected = recommendations.filter(r => selectedRecPartIds.includes(r.spare_part_id));
    setNewRequestItems(selected.map(s => ({
      spare_part_id: s.spare_part_id,
      part_name: s.part_name,
      requested_qty: Math.max(1, Number(s.recommended_order_qty)),
      recommended_qty: Number(s.recommended_order_qty),
      notes: `Kebutuhan buffer: stok saat ini ${s.current_stock} ${s.unit_of_measure}`,
    })));
    setShowCreateModal(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWarehouse) return;
    if (newRequestItems.length === 0) {
      alert('Pilih minimal 1 suku cadang untuk permohonan');
      return;
    }
    try {
      const payloadItems = newRequestItems.map(it => ({
        spare_part_id: it.spare_part_id,
        requested_qty: it.requested_qty,
        recommended_qty: it.recommended_qty,
        notes: it.notes,
      }));
      await replenishmentApi.createRequest(currentWarehouse.id, payloadItems, newRequestNotes);
      alert('Permohonan berhasil diajukan ke Gudang Utama!');
      setShowCreateModal(false);
      setNewRequestItems([]);
      setNewRequestNotes('');
      setActiveTab('requests');
      loadRequests();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal membuat permohonan');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'REQUESTED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30"><Clock className="w-3 h-3" /> Diajukan (Menunggu Verifikasi)</span>;
      case 'VERIFIED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30"><FileText className="w-3 h-3" /> Diverifikasi (Menunggu Supervisor)</span>;
      case 'APPROVED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"><CheckCircle className="w-3 h-3" /> Disetujui</span>;
      case 'IN_TRANSIT':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-400 border border-purple-500/30"><Truck className="w-3 h-3" /> Dalam Pengiriman (STO)</span>;
      case 'COMPLETED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30"><CheckCheck className="w-3 h-3" /> Selesai Diterima</span>;
      case 'RETURNED_TO_MAIN_ADMIN':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30"><XCircle className="w-3 h-3" /> Ditolak Spv (Revisi Admin Utama)</span>;
      case 'RETURNED_TO_CONTAINER_ADMIN':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/30"><RotateCcw className="w-3 h-3" /> Dikembalikan ke Kontainer</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400">{status}</span>;
    }
  };

  const isMainAdmin = user?.role_id === 'ROLE_ADMIN_UTAMA' || user?.role_id === 'ADMIN_GUDANG_UTAMA' || user?.permissions?.includes('request.verify') || false;
  const isSupervisor = user?.role_id === 'ROLE_SUPERVISOR' || user?.role_id === 'SUPERVISOR' || user?.permissions?.includes('request.approve') || false;
  const isContainerAdmin = user?.role_id === 'ROLE_ADMIN_KONTAINER' || user?.role_id === 'ADMIN_KONTAINER' || user?.role_name?.includes('Kontainer') || false;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <RotateCcw className="w-7 h-7 text-cyan-400" />
            Pengadaan & Replenishment Suku Cadang (STO)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Alur otomatis: Rekomendasi ADU Buffer → Pengajuan Kontainer → Verifikasi Gudang Utama → Persetujuan Supervisor → Drop STO.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {currentWarehouse?.warehouse_type === 'CONTAINER' && (
            <button
              onClick={() => {
                setNewRequestItems([]);
                setShowCreateModal(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition"
            >
              <Plus className="w-4 h-4" />
              Buat Permohonan Baru
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
            activeTab === 'requests'
              ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30 shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Daftar Permohonan ({requests.length})
        </button>
        <button
          onClick={() => setActiveTab('recommendations')}
          className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
            activeTab === 'recommendations'
              ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30 shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Kalkulasi Rekomendasi (Reorder Suggestion)
        </button>
      </div>

      {/* Content Tab 1: Requests */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="glass-card p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                <option value="">Semua Status</option>
                <option value="REQUESTED">REQUESTED (Diajukan)</option>
                <option value="VERIFIED">VERIFIED (Diverifikasi)</option>
                <option value="IN_TRANSIT">IN_TRANSIT (Dalam Pengiriman)</option>
                <option value="COMPLETED">COMPLETED (Selesai Diterima)</option>
                <option value="RETURNED_TO_MAIN_ADMIN">RETURNED_TO_MAIN_ADMIN (Revisi Admin)</option>
                <option value="RETURNED_TO_CONTAINER_ADMIN">RETURNED_TO_CONTAINER_ADMIN</option>
              </select>
            </div>
            <button
              onClick={loadRequests}
              className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Segarkan
            </button>
          </div>

          {/* Table */}
          <div className="glass-card rounded-2xl overflow-hidden border border-slate-800/80">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-5 py-3.5">No. Permohonan</th>
                    <th className="px-5 py-3.5">Gudang Kontainer</th>
                    <th className="px-5 py-3.5">Gudang Utama</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Tanggal Dibuat</th>
                    <th className="px-5 py-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                        Memuat data permohonan...
                      </td>
                    </tr>
                  ) : requests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                        Belum ada permohonan replenishment untuk filter ini
                      </td>
                    </tr>
                  ) : (
                    requests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-800/30 transition">
                        <td className="px-5 py-4 font-mono font-semibold text-cyan-400">
                          {req.request_number}
                        </td>
                        <td className="px-5 py-4 font-medium text-slate-200">
                          {req.container_warehouse_id}
                        </td>
                        <td className="px-5 py-4 text-slate-400">{req.main_warehouse_id}</td>
                        <td className="px-5 py-4">{getStatusBadge(req.status)}</td>
                        <td className="px-5 py-4 text-slate-400 text-xs">
                          {new Date(req.created_at).toLocaleString('id-ID')}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            onClick={() => openDetail(req.id)}
                            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-medium border border-slate-700 inline-flex items-center gap-1.5 transition"
                          >
                            <Eye className="w-3.5 h-3.5" /> Buka Detail
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

      {/* Content Tab 2: Recommendations */}
      {activeTab === 'recommendations' && (
        <div className="space-y-4">
          <div className="glass-card p-4 rounded-xl flex flex-wrap items-center justify-between gap-4">
            <div className="text-sm text-slate-300">
              <span className="font-semibold text-cyan-400">Rumus Kalkulasi Otomatis:</span>{' '}
              <span className="text-slate-400 font-mono text-xs">
                Reorder Qty = (Rata-rata Konsumsi Harian × Lead Time) + Safety Stock − Saldo On-Hand
              </span>
            </div>

            {currentWarehouse?.warehouse_type === 'CONTAINER' && (
              <button
                disabled={selectedRecPartIds.length === 0}
                onClick={handleAddRecToCreate}
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 text-xs font-semibold flex items-center gap-2 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Buat Permohonan dari Pilihan ({selectedRecPartIds.length})
              </button>
            )}
          </div>

          <div className="glass-card rounded-2xl overflow-hidden border border-slate-800/80">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3.5 w-10">
                      <input
                        type="checkbox"
                        checked={
                          recommendations.length > 0 &&
                          selectedRecPartIds.length ===
                            recommendations.filter((r) => Number(r.recommended_order_qty) > 0).length
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRecPartIds(
                              recommendations
                                .filter((r) => Number(r.recommended_order_qty) > 0)
                                .map((r) => r.spare_part_id)
                            );
                          } else {
                            setSelectedRecPartIds([]);
                          }
                        }}
                        className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                      />
                    </th>
                    <th className="px-5 py-3.5">Part Number & Nama</th>
                    <th className="px-5 py-3.5 text-right">Stok Fisik</th>
                    <th className="px-5 py-3.5 text-right">Min / Max</th>
                    <th className="px-5 py-3.5 text-right">Safety Stock</th>
                    <th className="px-5 py-3.5 text-right">Lead Time</th>
                    <th className="px-5 py-3.5 text-right">Rata-rata Harian (30h)</th>
                    <th className="px-5 py-3.5 text-right font-bold text-cyan-400">Rekomendasi Pesan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-slate-400">
                        Mengkalkulasi rekomendasi kebutuhan stok...
                      </td>
                    </tr>
                  ) : recommendations.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-slate-500">
                        Tidak ada suku cadang terdaftar
                      </td>
                    </tr>
                  ) : (
                    recommendations.map((rec) => {
                      const recQty = Number(rec.recommended_order_qty);
                      const isNeeded = recQty > 0;
                      return (
                        <tr
                          key={rec.spare_part_id}
                          className={`transition ${isNeeded ? 'bg-amber-950/15 hover:bg-amber-950/25' : 'hover:bg-slate-800/20'}`}
                        >
                          <td className="px-4 py-4">
                            <input
                              type="checkbox"
                              disabled={!isNeeded}
                              checked={selectedRecPartIds.includes(rec.spare_part_id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRecPartIds((prev) => [...prev, rec.spare_part_id]);
                                } else {
                                  setSelectedRecPartIds((prev) =>
                                    prev.filter((id) => id !== rec.spare_part_id)
                                  );
                                }
                              }}
                              className="rounded border-slate-700 text-cyan-500 focus:ring-0 disabled:opacity-30"
                            />
                          </td>
                          <td className="px-5 py-4">
                            <div className="font-semibold text-slate-200">{rec.part_name}</div>
                            <div className="text-xs font-mono text-cyan-400">{rec.spare_part_id}</div>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <span
                              className={`font-semibold ${
                                Number(rec.current_stock) <= Number(rec.min_stock)
                                  ? 'text-rose-400'
                                  : 'text-slate-200'
                              }`}
                            >
                              {rec.current_stock}
                            </span>{' '}
                            <span className="text-xs text-slate-500">{rec.unit_of_measure}</span>
                          </td>
                          <td className="px-5 py-4 text-right text-xs text-slate-400">
                            {rec.min_stock} / {rec.max_stock}
                          </td>
                          <td className="px-5 py-4 text-right text-xs text-slate-400">
                            {rec.safety_stock}
                          </td>
                          <td className="px-5 py-4 text-right text-xs text-slate-400">
                            {rec.lead_time_days} Hari
                          </td>
                          <td className="px-5 py-4 text-right text-xs font-mono text-slate-300">
                            {rec.avg_daily_usage} /hari
                          </td>
                          <td className="px-5 py-4 text-right font-bold">
                            {recQty > 0 ? (
                              <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 text-xs border border-amber-500/30">
                                +{recQty} {rec.unit_of_measure}
                              </span>
                            ) : (
                              <span className="text-xs text-emerald-400 font-normal">Aman (0)</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedRequestId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-card max-w-4xl w-full max-h-[90vh] flex flex-col rounded-2xl border border-slate-700/80 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-white font-mono">
                    {requestDetail?.request.request_number || 'Memuat...'}
                  </h3>
                  {requestDetail && getStatusBadge(requestDetail.request.status)}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Kontainer: <strong className="text-slate-200">{requestDetail?.request.container_warehouse_id}</strong> → Gudang Utama: <strong className="text-slate-200">{requestDetail?.request.main_warehouse_id}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedRequestId(null)}
                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-sm text-slate-300">
              {detailLoading ? (
                <div className="py-12 text-center text-slate-400">Memuat detail permohonan...</div>
              ) : requestDetail ? (
                <>
                  {/* Workflow Timeline Status */}
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                    <h4 className="text-xs uppercase font-semibold text-slate-400 mb-3 tracking-wider">
                      Alur Status Verifikasi & Approval
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/50">
                        <div className="text-slate-400">1. Pengajuan Kontainer</div>
                        <div className="font-semibold text-slate-200 mt-0.5">Oleh Admin Kontainer</div>
                        <div className="text-[11px] text-slate-500 mt-1 font-mono">
                          {new Date(requestDetail.request.created_at).toLocaleString('id-ID')}
                        </div>
                      </div>

                      <div className={`p-2.5 rounded-lg border ${
                        requestDetail.request.verified_at ? 'bg-blue-950/30 border-blue-800/50' : 'bg-slate-800/20 border-slate-800'
                      }`}>
                        <div className="text-slate-400">2. Verifikasi Gudang Utama</div>
                        <div className="font-semibold text-slate-200 mt-0.5">
                          {requestDetail.request.verified_at ? 'Terverifikasi' : 'Menunggu Verifikasi'}
                        </div>
                        {requestDetail.request.admin_notes && (
                          <div className="text-[11px] text-blue-400 mt-1 italic">
                            "{requestDetail.request.admin_notes}"
                          </div>
                        )}
                      </div>

                      <div className={`p-2.5 rounded-lg border ${
                        requestDetail.request.approved_at ? 'bg-emerald-950/30 border-emerald-800/50' : 'bg-slate-800/20 border-slate-800'
                      }`}>
                        <div className="text-slate-400">3. Persetujuan Supervisor</div>
                        <div className="font-semibold text-slate-200 mt-0.5">
                          {requestDetail.request.status === 'RETURNED_TO_MAIN_ADMIN' ? (
                            <span className="text-rose-400">Ditolak (Perlu Revisi)</span>
                          ) : requestDetail.request.approved_at ? (
                            'Disetujui'
                          ) : (
                            'Menunggu Approval'
                          )}
                        </div>
                        {requestDetail.request.supervisor_notes && (
                          <div className="text-[11px] text-amber-400 mt-1 italic">
                            "{requestDetail.request.supervisor_notes}"
                          </div>
                        )}
                      </div>

                      <div className={`p-2.5 rounded-lg border ${
                        requestDetail.request.status === 'COMPLETED' ? 'bg-cyan-950/30 border-cyan-800/50' : 'bg-slate-800/20 border-slate-800'
                      }`}>
                        <div className="text-slate-400">4. Drop & Penerimaan Fisik</div>
                        <div className="font-semibold text-slate-200 mt-0.5">
                          {requestDetail.request.status === 'COMPLETED' ? 'Selesai Masuk Stok' : requestDetail.request.status === 'IN_TRANSIT' ? 'Barang Dalam Perjalanan' : 'Belum Dikirim'}
                        </div>
                        {requestDetail.request.received_at && (
                          <div className="text-[11px] text-cyan-400 mt-1 font-mono">
                            {new Date(requestDetail.request.received_at).toLocaleString('id-ID')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Items List Table */}
                  <div>
                    <h4 className="text-xs uppercase font-semibold text-slate-400 mb-2 tracking-wider">
                      Daftar Suku Cadang yang Diajukan
                    </h4>
                    <div className="rounded-xl overflow-hidden border border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900/80 uppercase text-slate-400 font-semibold border-b border-slate-800">
                          <tr>
                            <th className="px-4 py-3">Part Number & Nama</th>
                            <th className="px-4 py-3 text-right">Qty Rekomendasi</th>
                            <th className="px-4 py-3 text-right">Qty Diajukan</th>
                            <th className="px-4 py-3 text-right font-bold text-cyan-400">
                              Qty Disetujui (Admin)
                            </th>
                            <th className="px-4 py-3 text-right">Qty Diterima</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                          {requestDetail.items.map((item, idx) => {
                            const canEditVerified =
                              isMainAdmin &&
                              (requestDetail.request.status === 'REQUESTED' ||
                                requestDetail.request.status === 'RETURNED_TO_MAIN_ADMIN');

                            return (
                              <tr key={item.id}>
                                <td className="px-4 py-3">
                                  <div className="font-semibold text-slate-200">{item.part_name}</div>
                                  <div className="font-mono text-cyan-400">{item.spare_part_id}</div>
                                </td>
                                <td className="px-4 py-3 text-right font-mono text-slate-400">
                                  {item.recommended_qty || 0} {item.unit_of_measure}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-slate-200">
                                  {item.requested_qty} {item.unit_of_measure}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {canEditVerified ? (
                                    <input
                                      type="number"
                                      min="0"
                                      value={verifyItems[idx]?.verified_qty ?? item.verified_qty}
                                      onChange={(e) => {
                                        const val = Number(e.target.value);
                                        setVerifyItems((prev) => {
                                          const next = [...prev];
                                          next[idx].verified_qty = val;
                                          return next;
                                        });
                                      }}
                                      className="w-20 px-2 py-1 bg-slate-950 border border-cyan-500/50 rounded text-right font-bold text-cyan-400 focus:outline-none"
                                    />
                                  ) : (
                                    <span className="font-bold text-cyan-400">
                                      {item.verified_qty ?? item.requested_qty} {item.unit_of_measure}
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-emerald-400">
                                  {item.received_qty ?? 0} {item.unit_of_measure}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Notes / Action Forms */}
                  {isMainAdmin &&
                    (requestDetail.request.status === 'REQUESTED' ||
                      requestDetail.request.status === 'RETURNED_TO_MAIN_ADMIN') && (
                      <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-900/50 space-y-3">
                        <label className="block text-xs font-semibold text-blue-300">
                          Catatan Admin Gudang Utama (Kesiapan Stok / Packaging):
                        </label>
                        <textarea
                          rows={2}
                          value={adminNotes}
                          onChange={(e) => setAdminNotes(e.target.value)}
                          placeholder="Masukkan catatan jika ada penyesuaian quantity atau ketersediaan gudang pusat..."
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                        />
                      </div>
                    )}

                  {isSupervisor && requestDetail.request.status === 'VERIFIED' && (
                    <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/50 space-y-3">
                      <label className="block text-xs font-semibold text-amber-300">
                        Catatan Supervisor (Alasan Persetujuan / Catatan Operasional):
                      </label>
                      <textarea
                        rows={2}
                        value={supervisorNotes}
                        onChange={(e) => setSupervisorNotes(e.target.value)}
                        placeholder="Catatan approval..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                      />
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Footer Actions */}
            {requestDetail && (
              <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={() => setSelectedRequestId(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
                >
                  Tutup
                </button>

                <div className="flex items-center gap-2">
                  {/* Action: Admin Gudang Utama Verify or Return to Container */}
                  {isMainAdmin &&
                    (requestDetail.request.status === 'REQUESTED' ||
                      requestDetail.request.status === 'RETURNED_TO_MAIN_ADMIN') && (
                      <>
                        <button
                          onClick={() => {
                            setRejectTarget('container');
                            setShowRejectDialog(true);
                          }}
                          className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold flex items-center gap-1.5 transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Kembalikan ke Kontainer
                        </button>
                        <button
                          onClick={handleVerify}
                          className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold shadow-lg shadow-cyan-500/20 flex items-center gap-1.5 transition"
                        >
                          <Send className="w-3.5 h-3.5" /> Verifikasi & Ajukan ke Supervisor
                        </button>
                      </>
                    )}

                  {/* Action: Supervisor Approve or Reject back to Main Admin */}
                  {isSupervisor && requestDetail.request.status === 'VERIFIED' && (
                    <>
                      <button
                        onClick={() => {
                          setRejectTarget('admin');
                          setShowRejectDialog(true);
                        }}
                        className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold flex items-center gap-1.5 transition"
                      >
                        <XCircle className="w-3.5 h-3.5" /> Tolak (Kembalikan ke Admin Utama)
                      </button>
                      <button
                        onClick={handleApprove}
                        className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 transition"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Setujui Permohonan (Terbitkan STO)
                      </button>
                    </>
                  )}

                  {/* Action: Container Admin Confirm Receipt */}
                  {requestDetail.request.status === 'IN_TRANSIT' &&
                    (isContainerAdmin || isSupervisor) && (
                      <button
                        onClick={handleReceive}
                        className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-semibold shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition"
                      >
                        <CheckCheck className="w-4 h-4" /> Konfirmasi Penerimaan Barang Drop
                      </button>
                    )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* REJECT / RETURN DIALOG */}
      {showRejectDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-card max-w-md w-full p-6 rounded-2xl border border-rose-500/40 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-400" />
              {rejectTarget === 'admin'
                ? 'Tolak & Kembalikan ke Admin Gudang Utama'
                : 'Kembalikan Permohonan ke Admin Kontainer'}
            </h3>
            <p className="text-xs text-slate-300">
              {rejectTarget === 'admin'
                ? 'Permohonan akan dikembalikan dengan status RETURNED_TO_MAIN_ADMIN agar Admin Gudang Utama dapat merevisi jumlah/alasan.'
                : 'Permohonan akan dikembalikan dengan status RETURNED_TO_CONTAINER_ADMIN untuk diperbaiki oleh Admin Kontainer.'}
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Alasan Pengembalian / Penolakan <span className="text-rose-400">*</span>:
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Contoh: Stok Gudang Pusat terbatas, mohon kurangi kuota..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-rose-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowRejectDialog(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs"
              >
                Batal
              </button>
              <button
                onClick={handleRejectConfirm}
                className="px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-400 text-white font-semibold text-xs transition"
              >
                Konfirmasi Kembalikan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-card max-w-2xl w-full p-6 rounded-2xl border border-cyan-500/40 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Boxes className="w-5 h-5 text-cyan-400" />
                Buat Permohonan Pengadaan Suku Cadang (STO)
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="mt-4 space-y-4 flex-1 overflow-y-auto pr-1">
              {/* Part selector */}
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Tambah Suku Cadang:
                </label>
                <div className="flex gap-2">
                  <select
                    id="partSelect"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:border-cyan-500"
                    onChange={(e) => {
                      const sp = spareParts.find((p) => p.id === e.target.value);
                      if (sp && !newRequestItems.some((i) => i.spare_part_id === sp.id)) {
                        setNewRequestItems((prev) => [
                          ...prev,
                          {
                            spare_part_id: sp.id,
                            part_name: sp.part_name,
                            requested_qty: 1,
                            recommended_qty: 0,
                            notes: '',
                          },
                        ]);
                      }
                      e.target.value = '';
                    }}
                  >
                    <option value="">-- Pilih Part dari Master Suku Cadang --</option>
                    {spareParts.map((sp) => (
                      <option key={sp.id} value={sp.id}>
                        {sp.id} - {sp.part_name} ({sp.unit_of_measure})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Items List */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-400">
                  Item Permohonan ({newRequestItems.length}):
                </label>
                {newRequestItems.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-center text-xs text-slate-500">
                    Belum ada item dipilih. Tambahkan suku cadang dari dropdown di atas atau dari tab Rekomendasi.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {newRequestItems.map((item, idx) => (
                      <div
                        key={item.spare_part_id}
                        className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex-1">
                          <div className="font-semibold text-slate-200">{item.part_name}</div>
                          <div className="font-mono text-cyan-400 text-[11px]">{item.spare_part_id}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <label className="text-slate-400 text-[11px]">Qty:</label>
                          <input
                            type="number"
                            min="1"
                            value={item.requested_qty}
                            onChange={(e) => {
                              const val = Math.max(1, Number(e.target.value));
                              setNewRequestItems((prev) => {
                                const next = [...prev];
                                next[idx].requested_qty = val;
                                return next;
                              });
                            }}
                            className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 rounded text-right font-bold text-cyan-400 focus:outline-none"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setNewRequestItems((prev) => prev.filter((_, i) => i !== idx));
                          }}
                          className="text-rose-400 hover:text-rose-300 p-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Catatan Kebutuhan:
                </label>
                <textarea
                  rows={2}
                  value={newRequestNotes}
                  onChange={(e) => setNewRequestNotes(e.target.value)}
                  placeholder="Contoh: Kebutuhan darurat / persiapan periodic maintenance unit..."
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-medium"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={newRequestItems.length === 0}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 text-xs font-semibold shadow-lg shadow-cyan-500/20"
                >
                  Ajukan Permohonan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
