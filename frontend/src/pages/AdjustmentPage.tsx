import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { confirmDialog, promptDialog } from '../context/ToastContext';
import { adjustmentApi, masterApi, inventoryApi } from '../api';
import type { StockAdjustmentEntry, SparePart, InventoryStockItem } from '../types';
import {
  SlidersHorizontal,
  Plus,
  CheckCircle2,
  Clock,
  RotateCcw,
  FileCheck,
  Search,
  Eye,
  Printer,
  Zap,
  Trash2,
  XCircle,
  Filter,
  ArrowDownRight,
  ArrowUpRight,
  Layers,
} from 'lucide-react';

interface DraftOpnameItem {
  spare_part_id: string;
  part_name: string;
  unit_of_measure: string;
  qty_system: number;
  qty_physical: number;
}

export const AdjustmentPage: React.FC = () => {
  const { currentWarehouse, user } = useAuth();
  const [entries, setEntries] = useState<StockAdjustmentEntry[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED'>('ALL');

  // Master Data
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [currentStocks, setCurrentStocks] = useState<InventoryStockItem[]>([]);

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formReason, setFormReason] = useState('Stock Opname Rutin Bulanan');
  const [formNotes, setFormNotes] = useState('');
  const [draftItems, setDraftItems] = useState<DraftOpnameItem[]>([]);
  const [selectedPartToAdd, setSelectedPartToAdd] = useState('');
  const [draftFilterVarianceOnly, setDraftFilterVarianceOnly] = useState(false);
  const [draftSearch, setDraftSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Detail Modal State
  const [selectedDetail, setSelectedDetail] = useState<StockAdjustmentEntry | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailFilterVarianceOnly, setDetailFilterVarianceOnly] = useState(false);
  const [detailSearch, setDetailSearch] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

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
      // Handle both raw array of entries or fallback structure
      if (Array.isArray(data)) {
        setEntries(data);
      } else {
        setEntries([]);
      }
    } catch (err) {
      console.error('Gagal memuat data penyesuaian stock opname:', err);
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
      console.error('Gagal memuat master suku cadang & stok:', err);
    }
  };

  useEffect(() => {
    loadData();
    loadMaster();
  }, [currentWarehouse]);

  // --- DRAFT FORM ACTIONS ---
  const handleOpenCreateModal = () => {
    setFormReason('Stock Opname Rutin Bulanan');
    setFormNotes('');
    setDraftItems([]);
    setSelectedPartToAdd('');
    setDraftFilterVarianceOnly(false);
    setDraftSearch('');
    setShowCreateModal(true);
  };

  const handleLoadAllCurrentStocks = () => {
    if (!currentStocks || currentStocks.length === 0) {
      alert('Tidak ada saldo stok aktif yang terdata di gudang ini saat ini.');
      return;
    }

    const loaded: DraftOpnameItem[] = currentStocks.map((stk) => {
      const part = spareParts.find((p) => p.id === stk.spare_part_id);
      return {
        spare_part_id: stk.spare_part_id,
        part_name: stk.part_name || part?.part_name || stk.spare_part_id,
        unit_of_measure: stk.unit_of_measure || part?.unit_of_measure || 'PCS',
        qty_system: Number(stk.qty_on_hand),
        qty_physical: Number(stk.qty_on_hand), // Default sama dengan sistem
      };
    });

    setDraftItems(loaded);
  };

  const handleAddSinglePart = () => {
    if (!selectedPartToAdd) return;
    if (draftItems.some((d) => d.spare_part_id === selectedPartToAdd)) {
      alert('Suku cadang ini sudah ada di dalam lembar opname.');
      return;
    }

    const part = spareParts.find((p) => p.id === selectedPartToAdd);
    const stock = currentStocks.find((s) => s.spare_part_id === selectedPartToAdd);
    const sysQty = stock ? Number(stock.qty_on_hand) : 0;

    const newItem: DraftOpnameItem = {
      spare_part_id: selectedPartToAdd,
      part_name: part?.part_name || selectedPartToAdd,
      unit_of_measure: part?.unit_of_measure || 'PCS',
      qty_system: sysQty,
      qty_physical: sysQty,
    };

    setDraftItems((prev) => [newItem, ...prev]);
    setSelectedPartToAdd('');
  };

  const handleUpdatePhysicalQty = (partId: string, val: number) => {
    setDraftItems((prev) =>
      prev.map((item) =>
        item.spare_part_id === partId ? { ...item, qty_physical: Math.max(0, val) } : item
      )
    );
  };

  const handleRemoveDraftItem = (partId: string) => {
    setDraftItems((prev) => prev.filter((item) => item.spare_part_id !== partId));
  };

  const handleClearAllDraftItems = async () => {
    if (await confirmDialog('Kosongkan semua daftar suku cadang dari lembar opname?')) {
      setDraftItems([]);
    }
  };

  const handleSubmitOpname = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWarehouse) {
      alert('Gudang aktif belum dipilih.');
      return;
    }
    if (draftItems.length === 0) {
      alert('Tambahkan minimal 1 suku cadang ke dalam lembar Stock Opname.');
      return;
    }

    try {
      setSubmitting(true);
      const payloadItems = draftItems.map((itm) => ({
        spare_part_id: itm.spare_part_id,
        qty_physical: itm.qty_physical,
      }));

      const res = await adjustmentApi.createAdjustment(
        currentWarehouse.id,
        formReason,
        payloadItems,
        formNotes
      );

      alert(res.message || 'Pengajuan Stock Opname berhasil dikirim ke Supervisor!');
      setShowCreateModal(false);
      setDraftItems([]);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal mengajukan Stock Opname');
    } finally {
      setSubmitting(false);
    }
  };

  // --- SUPERVISOR ACTIONS ---
  const handleApprove = async (id: string, adjNumber: string) => {
    if (
      !(await confirmDialog({
        title: `Setujui Stock Opname ${adjNumber}`,
        message: `Setujui pengajuan Stock Opname ${adjNumber}?\n\nSaldo fisik sistem di gudang akan otomatis diperbarui dan dicatat di kartu stok.`,
        confirmText: 'Ya, Setujui Opname',
        variant: 'success',
      }))
    ) {
      return;
    }

    try {
      setActionLoading(true);
      const res = await adjustmentApi.approveAdjustment(id);
      alert(res.message || 'Stock Opname berhasil disetujui');
      setShowDetailModal(false);
      setSelectedDetail(null);
      loadData();
      loadMaster();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menyetujui pengajuan');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: string, adjNumber: string) => {
    const reason = await promptDialog({
      title: `Tolak Stock Opname ${adjNumber}`,
      message: `Masukkan alasan penolakan untuk dokumen Stock Opname ${adjNumber}:`,
      placeholder: 'Contoh: Hitungan fisik rak A2 perlu dihitung ulang bersama mekanik...',
      confirmText: 'Tolak Pengajuan',
    });
    if (reason === null) return;
    if (!reason.trim()) {
      alert('Alasan penolakan wajib diisi.');
      return;
    }

    try {
      setActionLoading(true);
      const res = await adjustmentApi.rejectAdjustment(id, reason.trim());
      alert(res.message || 'Pengajuan Stock Opname ditolak');
      setShowDetailModal(false);
      setSelectedDetail(null);
      loadData();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal menolak pengajuan');
    } finally {
      setActionLoading(false);
    }
  };

  // --- PRINT BERITA ACARA OPNAME ---
  const handlePrintOpname = (entry: StockAdjustmentEntry) => {
    const adj = entry.adjustment;
    const items = entry.items || [];
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Pop-up browser diblokir. Izinkan pop-up untuk mencetak Berita Acara.');
      return;
    }

    const totalItems = items.length;
    const matchCount = items.filter((i) => Number(i.difference) === 0).length;
    const diffCount = totalItems - matchCount;
    const accuracy = totalItems > 0 ? Math.round((matchCount / totalItems) * 100) : 100;

    const rowsHtml = items
      .map(
        (itm, idx) => `
        <tr style="border-bottom: 1px solid #cbd5e1; font-size: 11px;">
          <td style="padding: 6px 8px; text-align: center;">${idx + 1}</td>
          <td style="padding: 6px 8px; font-family: monospace; font-weight: bold;">${itm.spare_part_id}</td>
          <td style="padding: 6px 8px;">${itm.part_name}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace;">${Number(itm.qty_system)}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: bold;">${Number(itm.qty_physical)}</td>
          <td style="padding: 6px 8px; text-align: right; font-family: monospace; font-weight: bold; color: ${
            Number(itm.difference) === 0 ? '#10b981' : Number(itm.difference) > 0 ? '#0284c7' : '#ef4444'
          };">
            ${Number(itm.difference) > 0 ? '+' : ''}${Number(itm.difference)}
          </td>
          <td style="padding: 6px 8px; font-size: 10px;">
            ${Number(itm.difference) === 0 ? 'Sesuai' : Number(itm.difference) > 0 ? 'Surplus / Lebih Fisik' : 'Shortage / Kurang Fisik'}
          </td>
        </tr>
      `
      )
      .join('');

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Berita Acara Stock Opname - ${adj.adjustment_number}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; line-height: 1.4; }
          .header-table { width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px; }
          .title { font-size: 18px; font-weight: bold; text-transform: uppercase; margin: 0; }
          .subtitle { font-size: 11px; color: #475569; margin-top: 2px; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px; margin-bottom: 16px; background: #f8fafc; padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; }
          .items-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          .items-table th { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 8px; font-size: 10px; text-transform: uppercase; }
          .items-table td { border: 1px solid #e2e8f0; }
          .summary-box { margin-top: 16px; display: flex; gap: 12px; font-size: 11px; font-weight: bold; }
          .sign-table { width: 100%; margin-top: 40px; text-align: center; font-size: 11px; }
          .sign-line { border-bottom: 1px solid #000; width: 160px; margin: 60px auto 4px auto; }
          @media print {
            body { margin: 10mm; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <table class="header-table">
          <tr>
            <td>
              <h1 class="title">BERITA ACARA STOCK OPNAME & PENYESUAIAN STOK</h1>
              <div class="subtitle">PT SINERGI JAYA SENTOSA — SISTEM LOGISTIK CONTAINER QU</div>
            </td>
            <td style="text-align: right; font-size: 12px; font-family: monospace;">
              <b>NO. DOKUMEN:</b><br/>${adj.adjustment_number}
            </td>
          </tr>
        </table>

        <div class="meta-grid">
          <div><b>Gudang / Lokasi:</b> ${adj.warehouse_id}</div>
          <div><b>Tanggal Sesi:</b> ${new Date(adj.created_at).toLocaleDateString('id-ID', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}</div>
          <div><b>Alasan / Kategori:</b> ${adj.reason}</div>
          <div><b>Status Approval:</b> ${adj.status}</div>
          <div><b>Catatan Lapangan:</b> ${adj.notes || '-'}</div>
          <div><b>Tingkat Akurasi (IRA):</b> ${accuracy}% (${matchCount} Cocok / ${diffCount} Selisih)</div>
        </div>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 30px;">No</th>
              <th style="width: 110px;">Part Number</th>
              <th>Nama Suku Cadang</th>
              <th style="width: 70px;">Saldo Sistem</th>
              <th style="width: 70px;">Fisik Riil</th>
              <th style="width: 70px;">Selisih</th>
              <th style="width: 140px;">Keterangan Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="summary-box">
          <div>Total Item Dihitung: <u>${totalItems} Item</u></div>
          <div style="color: #10b981;">Total Item Cocok: <u>${matchCount} Item</u></div>
          <div style="color: #ef4444;">Total Item Selisih: <u>${diffCount} Item</u></div>
        </div>

        <table class="sign-table">
          <tr>
            <td style="width: 33%;">
              Petugas Hitung / Checker<br/>
              <div class="sign-line"></div>
              ( .................................................. )
            </td>
            <td style="width: 33%;">
              Admin Gudang Kontainer<br/>
              <div class="sign-line"></div>
              ( .................................................. )
            </td>
            <td style="width: 33%;">
              Supervisor Logistik Utama<br/>
              <div class="sign-line"></div>
              ( .................................................. )
            </td>
          </tr>
        </table>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // --- STATS & COMPUTED VALUES ---
  const filteredEntries = useMemo(() => {
    return entries.filter((ent) => {
      const adj = ent.adjustment;
      if (!adj) return false;

      // Status Filter
      if (statusFilter !== 'ALL' && adj.status !== statusFilter) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNum = adj.adjustment_number?.toLowerCase().includes(q);
        const matchReason = adj.reason?.toLowerCase().includes(q);
        const matchWh = adj.warehouse_id?.toLowerCase().includes(q);
        const matchItem = ent.items?.some(
          (itm) =>
            itm.spare_part_id?.toLowerCase().includes(q) ||
            itm.part_name?.toLowerCase().includes(q)
        );
        if (!matchNum && !matchReason && !matchWh && !matchItem) return false;
      }

      return true;
    });
  }, [entries, statusFilter, searchQuery]);

  const summaryKpis = useMemo(() => {
    const total = entries.length;
    const pending = entries.filter((e) => e.adjustment?.status === 'PENDING_APPROVAL').length;
    const approved = entries.filter((e) => e.adjustment?.status === 'APPROVED').length;
    const rejected = entries.filter((e) => e.adjustment?.status === 'REJECTED').length;
    return { total, pending, approved, rejected };
  }, [entries]);

  // Draft calculations
  const draftMetrics = useMemo(() => {
    const total = draftItems.length;
    const match = draftItems.filter((i) => i.qty_physical === i.qty_system).length;
    const surplus = draftItems.filter((i) => i.qty_physical > i.qty_system).length;
    const shortage = draftItems.filter((i) => i.qty_physical < i.qty_system).length;
    const accuracy = total > 0 ? Math.round((match / total) * 100) : 100;
    return { total, match, surplus, shortage, accuracy };
  }, [draftItems]);

  const displayedDraftItems = useMemo(() => {
    return draftItems.filter((itm) => {
      if (draftFilterVarianceOnly && itm.qty_physical === itm.qty_system) {
        return false;
      }
      if (draftSearch.trim()) {
        const q = draftSearch.toLowerCase();
        const matchPart =
          itm.spare_part_id.toLowerCase().includes(q) || itm.part_name.toLowerCase().includes(q);
        if (!matchPart) return false;
      }
      return true;
    });
  }, [draftItems, draftFilterVarianceOnly, draftSearch]);

  // Detail Modal items
  const displayedDetailItems = useMemo(() => {
    if (!selectedDetail?.items) return [];
    return selectedDetail.items.filter((itm) => {
      const diff = Number(itm.difference);
      if (detailFilterVarianceOnly && diff === 0) return false;
      if (detailSearch.trim()) {
        const q = detailSearch.toLowerCase();
        const matchPart =
          itm.spare_part_id?.toLowerCase().includes(q) || itm.part_name?.toLowerCase().includes(q);
        if (!matchPart) return false;
      }
      return true;
    });
  }, [selectedDetail, detailFilterVarianceOnly, detailSearch]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
            <SlidersHorizontal className="w-7 h-7 text-cyan-400" />
            Stock Opname & Penyesuaian Saldo Multi-Item
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Hitung fisik batch multi-item terpadu. Verifikasi & approval Supervisor secara kolektif
            dalam 1 dokumen sesi (BR-021, BR-022).
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 font-semibold text-xs flex items-center gap-1.5 transition shadow"
            title="Segarkan data opname"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Segarkan</span>
          </button>

          {canCreateAdjustment && (
            <button
              onClick={handleOpenCreateModal}
              className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Sesi Opname Baru (Multi-Item)</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Sesi Opname</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-black text-white mt-1 font-mono">{summaryKpis.total}</p>
          <span className="text-[11px] text-slate-500">Seluruh dokumen tercatat</span>
        </div>

        <div className="glass-card p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-300">Menunggu Approval</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-amber-300 mt-1 font-mono">{summaryKpis.pending}</p>
          <span className="text-[11px] text-amber-400/80">Memerlukan review Supervisor</span>
        </div>

        <div className="glass-card p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-300">Telah Disetujui</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-black text-emerald-300 mt-1 font-mono">{summaryKpis.approved}</p>
          <span className="text-[11px] text-emerald-400/80">Saldo fisik telah diselaraskan</span>
        </div>

        <div className="glass-card p-4 rounded-xl border border-rose-500/30 bg-rose-500/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-300">Ditolak</span>
            <XCircle className="w-4 h-4 text-rose-400" />
          </div>
          <p className="text-2xl font-black text-rose-300 mt-1 font-mono">{summaryKpis.rejected}</p>
          <span className="text-[11px] text-rose-400/80">Perlu rekonsiliasi ulang</span>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="glass-card rounded-2xl overflow-hidden border border-slate-800/80">
        {/* Table Filter Toolbar */}
        <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'ALL'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Semua ({summaryKpis.total})
            </button>
            <button
              onClick={() => setStatusFilter('PENDING_APPROVAL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'PENDING_APPROVAL'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-900 text-amber-400/80 hover:text-amber-300 border border-slate-800'
              }`}
            >
              Menunggu Approval ({summaryKpis.pending})
            </button>
            <button
              onClick={() => setStatusFilter('APPROVED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'APPROVED'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                  : 'bg-slate-900 text-emerald-400/80 hover:text-emerald-300 border border-slate-800'
              }`}
            >
              Disetujui ({summaryKpis.approved})
            </button>
            <button
              onClick={() => setStatusFilter('REJECTED')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                statusFilter === 'REJECTED'
                  ? 'bg-rose-500 text-slate-950 shadow-md shadow-rose-500/20'
                  : 'bg-slate-900 text-rose-400/80 hover:text-rose-300 border border-slate-800'
              }`}
            >
              Ditolak ({summaryKpis.rejected})
            </button>
          </div>

          <div className="relative min-w-[260px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Cari no. dokumen, alasan, part..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900/80 text-[11px] uppercase font-bold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">No. Dokumen</th>
                <th className="px-5 py-3.5">Gudang</th>
                <th className="px-5 py-3.5">Alasan / Judul Sesi</th>
                <th className="px-5 py-3.5">Cakupan Item</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Waktu Pengajuan</th>
                <th className="px-5 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <RotateCcw className="w-6 h-6 animate-spin text-cyan-400" />
                      <span>Memuat data riwayat stock opname...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <SlidersHorizontal className="w-8 h-8 text-slate-600 mb-1" />
                      <p className="text-sm font-semibold text-slate-400">
                        Belum ada dokumen Stock Opname
                      </p>
                      <p className="text-xs text-slate-500">
                        Klik tombol &quot;Sesi Opname Baru&quot; untuk mengajukan opname multi-item.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => {
                  const adj = entry.adjustment;
                  const items = entry.items || [];
                  const totalItems = items.length;
                  const matchCount = items.filter((i) => Number(i.difference) === 0).length;
                  const diffCount = totalItems - matchCount;

                  return (
                    <tr key={adj.id} className="hover:bg-slate-800/40 transition">
                      <td className="px-5 py-4">
                        <div className="font-mono font-bold text-cyan-400 flex items-center gap-1.5">
                          <span>{adj.adjustment_number}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-semibold text-slate-200 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 font-mono">
                          {adj.warehouse_id}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-white">{adj.reason}</p>
                        {adj.notes && (
                          <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                            {adj.notes}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <span className="font-semibold text-slate-300">
                            {totalItems} Item Dihitung
                          </span>
                          <div className="flex items-center gap-1.5 text-[10px]">
                            <span className="text-emerald-400 font-mono">{matchCount} Cocok</span>
                            <span className="text-slate-600">•</span>
                            <span
                              className={`font-mono font-bold ${
                                diffCount > 0 ? 'text-amber-400' : 'text-slate-400'
                              }`}
                            >
                              {diffCount} Selisih
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {adj.status === 'APPROVED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Disetujui
                          </span>
                        ) : adj.status === 'REJECTED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            <XCircle className="w-3.5 h-3.5" /> Ditolak
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            <Clock className="w-3.5 h-3.5" /> Menunggu Approval
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-[11px] text-slate-400">
                        {new Date(adj.created_at).toLocaleString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedDetail(entry);
                              setShowDetailModal(true);
                              setDetailFilterVarianceOnly(false);
                              setDetailSearch('');
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 font-semibold text-xs flex items-center gap-1 border border-slate-700 transition"
                            title="Buka rincian seluruh item opname"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Rincian</span>
                          </button>

                          {adj.status === 'PENDING_APPROVAL' && isSupervisor && (
                            <button
                              onClick={() => {
                                setSelectedDetail(entry);
                                setShowDetailModal(true);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 shadow shadow-emerald-500/20 transition"
                              title="Tinjau dan setujui dokumen"
                            >
                              <FileCheck className="w-3.5 h-3.5" />
                              <span>Review</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CREATE MODAL (MULTI-ITEM STOCK OPNAME FORM) */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-4xl p-6 rounded-2xl border border-cyan-500/40 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal className="w-6 h-6 text-cyan-400" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    Formulir Sesi Stock Opname Baru (Multi-Item)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Input hasil hitung fisik beberapa item sekaligus dalam 1 paket dokumen pengajuan.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitOpname} className="flex flex-col flex-1 overflow-hidden space-y-4">
              {/* Form Metadata */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-slate-900/60 p-3.5 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Gudang Target:</label>
                  <input
                    type="text"
                    disabled
                    value={currentWarehouse ? `${currentWarehouse.id} - ${currentWarehouse.name}` : '-'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-300 font-semibold font-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Alasan / Tipe Opname:</label>
                  <select
                    value={formReason}
                    onChange={(e) => setFormReason(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="Stock Opname Rutin Bulanan">Stock Opname Rutin Bulanan</option>
                    <option value="Siklus Harian (Cycle Count)">Siklus Harian (Cycle Count)</option>
                    <option value="Selisih Penghitungan Fisik Lapangan">
                      Selisih Penghitungan Fisik Lapangan
                    </option>
                    <option value="Koreksi Salah Input Transaksi">Koreksi Salah Input Transaksi</option>
                    <option value="Kerusakan / Rusak saat Penyimpanan">
                      Kerusakan / Rusak saat Penyimpanan
                    </option>
                    <option value="Audit Khusus / Serah Terima Shift">Audit Khusus / Serah Terima Shift</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Catatan Dokumen:</label>
                  <input
                    type="text"
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="Contoh: Opname Rak A1 & Filter Fleet Sorowako"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Toolbar Item Entry */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleLoadAllCurrentStocks}
                    className="px-3 py-1.5 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/80 text-cyan-300 border border-cyan-800/60 font-bold text-xs flex items-center gap-1.5 shadow-sm transition"
                    title="Otomatis mengisi tabel dengan seluruh suku cadang yang tercatat di gudang ini"
                  >
                    <Zap className="w-3.5 h-3.5 text-cyan-400" />
                    <span>⚡ Muat Semua Stok Gudang ({currentStocks.length})</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <select
                      value={selectedPartToAdd}
                      onChange={(e) => setSelectedPartToAdd(e.target.value)}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 max-w-[260px] focus:border-cyan-500 focus:outline-none"
                    >
                      <option value="">-- Pilih Part Manual --</option>
                      {spareParts.map((sp) => (
                        <option key={sp.id} value={sp.id}>
                          {sp.id} - {sp.part_name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={handleAddSinglePart}
                      disabled={!selectedPartToAdd}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs disabled:opacity-50 transition"
                    >
                      + Tambah
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Filter tabel..."
                      value={draftSearch}
                      onChange={(e) => setDraftSearch(e.target.value)}
                      className="bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none w-36"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setDraftFilterVarianceOnly(!draftFilterVarianceOnly)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 border transition ${
                      draftFilterVarianceOnly
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    <Filter className="w-3 h-3" />
                    <span>Hanya Selisih ({draftMetrics.surplus + draftMetrics.shortage})</span>
                  </button>

                  {draftItems.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllDraftItems}
                      className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition"
                      title="Kosongkan Lembar Opname"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Items Table Container */}
              <div className="flex-1 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/40 min-h-[220px]">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-900/90 text-[11px] uppercase font-bold text-slate-400 sticky top-0 border-b border-slate-800">
                    <tr>
                      <th className="px-3.5 py-2.5 w-10 text-center">#</th>
                      <th className="px-3.5 py-2.5 w-36">Part Number</th>
                      <th className="px-3.5 py-2.5">Nama Suku Cadang</th>
                      <th className="px-3.5 py-2.5 w-28 text-right">Saldo Sistem</th>
                      <th className="px-3.5 py-2.5 w-36 text-center">Hitung Fisik</th>
                      <th className="px-3.5 py-2.5 w-32 text-center">Selisih</th>
                      <th className="px-3.5 py-2.5 w-12 text-center">Hapus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {displayedDraftItems.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                          {draftItems.length === 0 ? (
                            <div className="space-y-1">
                              <p className="font-semibold text-slate-400">Lembar Opname Masih Kosong</p>
                              <p className="text-[11px]">
                                Klik tombol &quot;⚡ Muat Semua Stok Gudang&quot; untuk menarik semua
                                saldo otomatis, atau tambahkan suku cadang tertentu secara manual.
                              </p>
                            </div>
                          ) : (
                            <p>Tidak ada item yang sesuai dengan filter pencarian.</p>
                          )}
                        </td>
                      </tr>
                    ) : (
                      displayedDraftItems.map((itm, idx) => {
                        const diff = itm.qty_physical - itm.qty_system;
                        return (
                          <tr key={itm.spare_part_id} className="hover:bg-slate-900/60 transition">
                            <td className="px-3.5 py-2.5 text-center text-slate-500 font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="px-3.5 py-2.5 font-mono font-bold text-cyan-400">
                              {itm.spare_part_id}
                            </td>
                            <td className="px-3.5 py-2.5 font-medium text-slate-200">
                              {itm.part_name}
                            </td>
                            <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-slate-300">
                              {itm.qty_system} <span className="text-[10px] text-slate-500">{itm.unit_of_measure}</span>
                            </td>
                            <td className="px-3.5 py-2.5 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="any"
                                  required
                                  value={itm.qty_physical}
                                  onChange={(e) =>
                                    handleUpdatePhysicalQty(itm.spare_part_id, parseFloat(e.target.value) || 0)
                                  }
                                  className="w-24 bg-slate-900 border border-slate-700 focus:border-cyan-500 rounded-lg px-2.5 py-1 text-center font-mono font-bold text-white text-xs focus:outline-none"
                                />
                                <span className="text-[10px] text-slate-500">{itm.unit_of_measure}</span>
                              </div>
                            </td>
                            <td className="px-3.5 py-2.5 text-center">
                              {diff === 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                  ✓ Sesuai (0)
                                </span>
                              ) : diff > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-mono">
                                  <ArrowUpRight className="w-3 h-3" />+{diff}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 font-mono">
                                  <ArrowDownRight className="w-3 h-3" />{diff}
                                </span>
                              )}
                            </td>
                            <td className="px-3.5 py-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveDraftItem(itm.spare_part_id)}
                                className="p-1 text-slate-500 hover:text-rose-400 transition"
                                title="Hapus dari lembar"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Draft Summary Footer */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800 text-xs">
                <div className="flex items-center gap-4 text-slate-400 flex-wrap">
                  <div>
                    Total Item: <span className="font-bold text-white font-mono">{draftMetrics.total}</span>
                  </div>
                  <div className="text-emerald-400">
                    Sesuai: <span className="font-bold font-mono">{draftMetrics.match}</span>
                  </div>
                  <div className="text-rose-400">
                    Kurang (-): <span className="font-bold font-mono">{draftMetrics.shortage}</span>
                  </div>
                  <div className="text-cyan-400">
                    Lebih (+): <span className="font-bold font-mono">{draftMetrics.surplus}</span>
                  </div>
                  <div>
                    Akurasi Stok:{' '}
                    <span className="font-bold text-white font-mono">{draftMetrics.accuracy}%</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-semibold text-xs transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || draftItems.length === 0}
                    className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 disabled:opacity-50 transition"
                  >
                    {submitting ? 'Mengajukan...' : `Ajukan Dokumen Opname (${draftItems.length} Item)`}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DETAIL & SUPERVISOR REVIEW MODAL */}
      {/* ========================================================================= */}
      {showDetailModal && selectedDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-4xl p-6 rounded-2xl border border-cyan-500/40 shadow-2xl space-y-4 max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <SlidersHorizontal className="w-6 h-6 text-cyan-400" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-white">
                      Rincian Stock Opname: {selectedDetail.adjustment.adjustment_number}
                    </h3>
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] bg-slate-800 text-cyan-400 border border-slate-700">
                      {selectedDetail.adjustment.warehouse_id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Alasan: <span className="text-slate-200 font-semibold">{selectedDetail.adjustment.reason}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintOpname(selectedDetail)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 border border-slate-700 transition"
                  title="Cetak Berita Acara Stock Opname"
                >
                  <Printer className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Cetak Dokumen</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedDetail(null);
                  }}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Meta Information & Status Badge */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Status Dokumen</span>
                <span className="mt-0.5 inline-block font-semibold">
                  {selectedDetail.adjustment.status === 'APPROVED' ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Disetujui (Saldo Diupdate)
                    </span>
                  ) : selectedDetail.adjustment.status === 'REJECTED' ? (
                    <span className="text-rose-400 flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" /> Ditolak Supervisor
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Menunggu Approval
                    </span>
                  )}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Waktu Diajukan</span>
                <span className="mt-0.5 inline-block text-slate-300 font-medium">
                  {new Date(selectedDetail.adjustment.created_at).toLocaleString('id-ID')}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Total Item</span>
                <span className="mt-0.5 inline-block text-slate-300 font-bold font-mono">
                  {selectedDetail.items?.length || 0} Item Terdata
                </span>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-bold">Catatan Dokumen</span>
                <span className="mt-0.5 inline-block text-slate-300 line-clamp-1">
                  {selectedDetail.adjustment.notes || '-'}
                </span>
              </div>
            </div>

            {/* Detail Filter Toolbar */}
            <div className="flex items-center justify-between gap-2 pt-1 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setDetailFilterVarianceOnly(false)}
                  className={`px-3 py-1 rounded-lg font-semibold transition ${
                    !detailFilterVarianceOnly
                      ? 'bg-cyan-500 text-slate-950 shadow'
                      : 'bg-slate-900 text-slate-400 border border-slate-800'
                  }`}
                >
                  Semua Item ({selectedDetail.items?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setDetailFilterVarianceOnly(true)}
                  className={`px-3 py-1 rounded-lg font-semibold transition ${
                    detailFilterVarianceOnly
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'bg-slate-900 text-amber-400 border border-slate-800'
                  }`}
                >
                  Hanya Item Selisih (
                  {
                    (selectedDetail.items || []).filter((i) => Number(i.difference) !== 0).length
                  }
                  )
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Cari item di rincian..."
                  value={detailSearch}
                  onChange={(e) => setDetailSearch(e.target.value)}
                  className="bg-slate-900 border border-slate-800 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none w-44"
                />
              </div>
            </div>

            {/* Detail Items Table */}
            <div className="flex-1 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/40 min-h-[220px]">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-900/90 text-[11px] uppercase font-bold text-slate-400 sticky top-0 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-2.5 w-10 text-center">#</th>
                    <th className="px-4 py-2.5 w-36">Part Number</th>
                    <th className="px-4 py-2.5">Nama Suku Cadang</th>
                    <th className="px-4 py-2.5 w-28 text-right">Saldo Sistem</th>
                    <th className="px-4 py-2.5 w-28 text-right">Hitung Fisik</th>
                    <th className="px-4 py-2.5 w-32 text-center">Selisih (Variance)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {displayedDetailItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                        Tidak ada item yang sesuai dengan filter rincian.
                      </td>
                    </tr>
                  ) : (
                    displayedDetailItems.map((itm, idx) => {
                      const diff = Number(itm.difference);
                      return (
                        <tr key={itm.id} className="hover:bg-slate-900/60 transition">
                          <td className="px-4 py-2.5 text-center text-slate-500 font-mono text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-2.5 font-mono font-bold text-cyan-400">
                            {itm.spare_part_id}
                          </td>
                          <td className="px-4 py-2.5 font-medium text-slate-200">
                            {itm.part_name}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-300">
                            {Number(itm.qty_system)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-white">
                            {Number(itm.qty_physical)}
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            {diff === 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                ✓ Sesuai (0)
                              </span>
                            ) : diff > 0 ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-mono">
                                <ArrowUpRight className="w-3 h-3" />+{diff}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 font-mono">
                                <ArrowDownRight className="w-3 h-3" />{diff}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Supervisor Action Footer */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-800 text-xs">
              <div className="text-slate-400">
                Persetujuan dokumen ini akan otomatis menyelaraskan saldo fisik gudang dan mencatat riwayat mutasi stok.
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDetailModal(false);
                    setSelectedDetail(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
                >
                  Tutup
                </button>

                {selectedDetail.adjustment.status === 'PENDING_APPROVAL' && isSupervisor && (
                  <>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() =>
                        handleReject(
                          selectedDetail.adjustment.id,
                          selectedDetail.adjustment.adjustment_number
                        )
                      }
                      className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4 text-rose-400" />
                      <span>Tolak Dokumen</span>
                    </button>

                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() =>
                        handleApprove(
                          selectedDetail.adjustment.id,
                          selectedDetail.adjustment.adjustment_number
                        )
                      }
                      className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
                    >
                      <FileCheck className="w-4 h-4" />
                      <span>{actionLoading ? 'Memproses...' : 'Setujui Dokumen (Update Saldo)'}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
