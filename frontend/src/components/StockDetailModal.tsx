import React, { useState, useRef, useEffect } from 'react';
import type { InventoryStockItem, StockMovement, WarehouseBinItem } from '../types';
import { canViewFinancials } from '../types';
import { useAuth } from '../context/AuthContext';
import { inventoryApi } from '../api';
import { QrCodeView } from './common/QrCodeView';
import {
  X,
  Camera,
  Upload,
  Link,
  History,
  Layers,
  ShieldAlert,
  Package,
  CheckCircle2,
  AlertTriangle,
  ZoomIn,
  Trash2,
  DollarSign,
  ExternalLink,
  Save,
} from 'lucide-react';

interface StockDetailModalProps {
  item: InventoryStockItem;
  bins?: WarehouseBinItem[];
  onClose: () => void;
  onOpenMovements: (item: InventoryStockItem) => void;
  onOpenRelocate: (partId: string, partName: string, currentBin?: string) => void;
  onPhotoUpdated?: () => void;
}

export const StockDetailModal: React.FC<StockDetailModalProps> = ({
  item: initialItem,
  bins: _bins = [],
  onClose,
  onOpenMovements,
  onOpenRelocate,
  onPhotoUpdated,
}) => {
  const { user } = useAuth();
  const hasFinancial = canViewFinancials(user);

  const [item, setItem] = useState<InventoryStockItem>(initialItem);
  const [recentMovements, setRecentMovements] = useState<StockMovement[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);

  // Photo editing state
  const [showPhotoEditor, setShowPhotoEditor] = useState(false);
  const [photoInputMode, setPhotoInputMode] = useState<'upload' | 'url'>('upload');
  const [tempPhotoUrl, setTempPhotoUrl] = useState<string>(initialItem.photo_url || '');
  const [urlInput, setUrlInput] = useState<string>('');
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Full-size image preview modal
  const [showFullImage, setShowFullImage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch recent movements for the mini ledger
  useEffect(() => {
    let isMounted = true;
    const fetchMovements = async () => {
      setLoadingMovements(true);
      try {
        const movs = await inventoryApi.getMovements(item.warehouse_id, item.spare_part_id);
        if (isMounted) {
          setRecentMovements(movs.slice(0, 5));
        }
      } catch (err) {
        console.error('Failed to load recent movements:', err);
      } finally {
        if (isMounted) setLoadingMovements(false);
      }
    };

    fetchMovements();
    return () => {
      isMounted = false;
    };
  }, [item.warehouse_id, item.spare_part_id]);

  // Handle Photo selection from local computer/device camera
  const handlePhotoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDimension = 900;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
        setTempPhotoUrl(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Save updated photo to backend
  const handleSavePhoto = async () => {
    setSavingPhoto(true);
    setPhotoMessage(null);
    try {
      const targetPhoto = photoInputMode === 'url' ? (urlInput.trim() || null) : (tempPhotoUrl || null);
      const res = await inventoryApi.updateStockPhoto(item.warehouse_id, item.spare_part_id, targetPhoto);

      setItem((prev) => ({ ...prev, photo_url: res.photo_url || undefined }));
      setPhotoMessage({ type: 'success', text: res.message || 'Foto stok berhasil disimpan!' });
      setShowPhotoEditor(false);
      onPhotoUpdated?.();
    } catch (err: any) {
      setPhotoMessage({
        type: 'error',
        text: err?.response?.data?.error || err.message || 'Gagal menyimpan foto stok',
      });
    } finally {
      setSavingPhoto(false);
    }
  };

  // Remove photo
  const handleRemovePhoto = async () => {
    if (!window.confirm('Hapus foto suku cadang ini?')) return;
    setSavingPhoto(true);
    setPhotoMessage(null);
    try {
      const res = await inventoryApi.updateStockPhoto(item.warehouse_id, item.spare_part_id, null);
      setItem((prev) => ({ ...prev, photo_url: undefined }));
      setTempPhotoUrl('');
      setUrlInput('');
      setPhotoMessage({ type: 'success', text: res.message || 'Foto berhasil dihapus' });
      setShowPhotoEditor(false);
      onPhotoUpdated?.();
    } catch (err: any) {
      setPhotoMessage({
        type: 'error',
        text: err?.response?.data?.error || err.message || 'Gagal menghapus foto',
      });
    } finally {
      setSavingPhoto(false);
    }
  };

  // Calculate stock gauge percentage
  const maxStockVal = item.max_stock > 0 ? item.max_stock : 100;
  const stockPercent = Math.min(Math.round((item.qty_on_hand / maxStockVal) * 100), 100);

  // Total valuation
  const unitCost = item.unit_cost || 0;
  const totalValuation = item.qty_on_hand * unitCost;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="glass-panel w-full max-w-4xl rounded-3xl border border-cyan-500/30 p-6 sm:p-7 shadow-2xl space-y-6 relative max-h-[92vh] overflow-y-auto my-auto text-slate-200">
        
        {/* MODAL HEADER */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-extrabold text-cyan-300 bg-slate-900 px-2.5 py-0.5 rounded-md border border-slate-800">
                  {item.spare_part_id}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    item.status === 'CRITICAL'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : item.status === 'WARNING'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}
                >
                  {item.status === 'CRITICAL' && '🔴 Kritis'}
                  {item.status === 'WARNING' && '🟡 Menipis'}
                  {item.status === 'NORMAL' && '🟢 Aman'}
                </span>
              </div>
              <h2 className="text-lg font-bold text-white mt-1">{item.part_name}</h2>
              <p className="text-xs text-slate-400">
                Gudang: <span className="text-cyan-300 font-semibold">{item.warehouse_name}</span> ({item.warehouse_id})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {photoMessage && (
          <div
            className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
              photoMessage.type === 'success'
                ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/60 border border-rose-500/40 text-rose-300'
            }`}
          >
            {photoMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{photoMessage.text}</span>
          </div>
        )}

        {/* MODAL MAIN CONTENT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT COLUMN: FOTO STOCK & QR CODE (5 cols) */}
          <div className="lg:col-span-5 space-y-5">
            
            {/* 1. FOTO STOCK CARD */}
            <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-cyan-400" />
                  Foto Suku Cadang
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    setShowPhotoEditor(!showPhotoEditor);
                    setTempPhotoUrl(item.photo_url || '');
                    setUrlInput(item.photo_url || '');
                  }}
                  className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition flex items-center gap-1"
                >
                  {showPhotoEditor ? 'Batal' : item.photo_url ? 'Ubah Foto' : '+ Tambah Foto'}
                </button>
              </div>

              {/* Photo Display / Placeholder */}
              <div className="relative group rounded-xl overflow-hidden bg-slate-950 border border-slate-800/80 aspect-4/3 flex items-center justify-center">
                {item.photo_url ? (
                  <>
                    <img
                      src={item.photo_url}
                      alt={item.part_name}
                      className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-105"
                      onClick={() => setShowFullImage(true)}
                      onError={(e) => {
                        // Fallback on broken image
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <div
                      onClick={() => setShowFullImage(true)}
                      className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                    >
                      <span className="px-3 py-1.5 rounded-lg bg-black/70 backdrop-blur-md text-white text-xs font-medium flex items-center gap-1.5 border border-white/20">
                        <ZoomIn className="w-4 h-4" /> Perbesar Foto
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-slate-500 text-center">
                    <Package className="w-12 h-12 stroke-[1.2] mb-2 text-slate-600" />
                    <span className="text-xs font-medium text-slate-400">Belum ada foto suku cadang</span>
                    <button
                      onClick={() => {
                        setShowPhotoEditor(true);
                        setPhotoInputMode('upload');
                      }}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold border border-slate-700 transition flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" /> Upload Foto Sekarang
                    </button>
                  </div>
                )}
              </div>

              {/* Photo Editor Panel (Expandable) */}
              {showPhotoEditor && (
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-cyan-500/40 space-y-3 transition-all animate-in fade-in duration-200">
                  <div className="flex gap-2 border-b border-slate-800 pb-2">
                    <button
                      type="button"
                      onClick={() => setPhotoInputMode('upload')}
                      className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                        photoInputMode === 'upload'
                          ? 'bg-cyan-500 text-slate-950'
                          : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Upload className="w-3 h-3" /> Upload File / Kamera
                    </button>
                    <button
                      type="button"
                      onClick={() => setPhotoInputMode('url')}
                      className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition ${
                        photoInputMode === 'url'
                          ? 'bg-cyan-500 text-slate-950'
                          : 'bg-slate-900 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Link className="w-3 h-3" /> URL Gambar
                    </button>
                  </div>

                  {photoInputMode === 'upload' ? (
                    <div className="space-y-2">
                      <input
                        type="file"
                        accept="image/*"
                        ref={fileInputRef}
                        className="hidden"
                        onChange={handlePhotoFileSelect}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-2.5 px-3 rounded-lg border border-dashed border-cyan-500/50 hover:border-cyan-400 bg-cyan-950/20 text-cyan-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 transition"
                      >
                        <Camera className="w-4 h-4" />
                        <span>Pilih Foto dari Perangkat / Kamera</span>
                      </button>
                      {tempPhotoUrl && (
                        <div className="flex items-center gap-2 text-[11px] text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Foto berhasil dimuat, siap disimpan</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="https://domain.com/photo.jpg"
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                      />
                    </div>
                  )}

                  {/* Actions to save/remove */}
                  <div className="flex items-center justify-between pt-1">
                    {item.photo_url ? (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        disabled={savingPhoto}
                        className="px-2.5 py-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40 text-xs font-semibold transition flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Hapus
                      </button>
                    ) : <span />}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowPhotoEditor(false)}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleSavePhoto}
                        disabled={savingPhoto || (photoInputMode === 'upload' && !tempPhotoUrl) || (photoInputMode === 'url' && !urlInput.trim())}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{savingPhoto ? 'Menyimpan...' : 'Simpan Foto'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. QR CODE SECTION */}
            <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Package className="w-4 h-4 text-cyan-400" />
                QR Code & Tag Identitas
              </h3>

              <div className="flex justify-center py-2">
                <QrCodeView
                  value={item.qr_code || `QR-PART-${item.spare_part_id}`}
                  size={160}
                  title={item.spare_part_id}
                  subtitle={item.part_name}
                  partName={item.part_name}
                  warehouseName={item.warehouse_name}
                  rackLocation={item.rack_location || 'Belum diatur'}
                  showActions={true}
                />
              </div>
            </div>

          </div>

          {/* RIGHT COLUMN: DETAIL DATA, SALDO, DAN RIWAYAT MUTASI (7 cols) */}
          <div className="lg:col-span-7 space-y-5">
            
            {/* SPESIFIKASI SUKU CADANG */}
            <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Informasi & Spesifikasi Suku Cadang
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase font-medium">Brand / Merk</span>
                  <span className="font-semibold text-slate-200">{item.brand || 'Standar Pabrikan'}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase font-medium">Kategori</span>
                  <span className="font-semibold text-slate-200">{item.category_name || 'General Parts'}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase font-medium">Satuan (UoM)</span>
                  <span className="font-semibold font-mono text-cyan-300">{item.unit_of_measure}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-500 block uppercase font-medium">Lokasi Bin / Rak</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="font-mono font-bold text-cyan-300">{item.rack_location || 'Belum Diatur'}</span>
                    <button
                      type="button"
                      onClick={() => onOpenRelocate(item.spare_part_id, item.part_name, item.rack_location)}
                      className="text-[10px] text-cyan-400 hover:underline flex items-center gap-0.5"
                    >
                      <Layers className="w-3 h-3" /> Pindah
                    </button>
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase font-medium">Tipe Kritikal</span>
                  <span
                    className={`font-semibold ${
                      item.critical_level === 'CRITICAL' ? 'text-rose-400' : 'text-slate-300'
                    }`}
                  >
                    {item.critical_level === 'CRITICAL' ? 'Kritis (Unit Stop)' : 'Normal'}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <span className="text-[10px] text-slate-500 block uppercase font-medium">Wajib Retur (Core)</span>
                  <span
                    className={`font-semibold ${
                      item.requires_core_return ? 'text-amber-400' : 'text-slate-400'
                    }`}
                  >
                    {item.requires_core_return ? 'Wajib Part Bekas' : 'Tidak Wajib'}
                  </span>
                </div>
              </div>

              {item.requires_issue_approval && (
                <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>Suku cadang ini memerlukan otorisasi/approval supervisor saat pengeluaran (Issue POS).</span>
                </div>
              )}
            </div>

            {/* SALDO & PARAMETER PERSEDIAAN */}
            <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Saldo & Kapasitas Persediaan
              </h3>

              {/* Big Qty Display */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/80 border border-cyan-500/30 text-center">
                  <span className="text-[10px] uppercase font-bold text-cyan-400 block">Saldo On-Hand</span>
                  <div className="text-2xl font-black font-mono text-white mt-0.5">
                    {item.qty_on_hand}
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{item.unit_of_measure}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-medium text-slate-500 block">Min Stock</span>
                  <div className="text-xl font-bold font-mono text-slate-300 mt-1">
                    {item.min_stock}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Batas Order</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-medium text-slate-500 block">Max Stock</span>
                  <div className="text-xl font-bold font-mono text-slate-300 mt-1">
                    {item.max_stock}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Kapasitas Rak</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                  <span className="text-[10px] uppercase font-medium text-slate-500 block">Safety Stock</span>
                  <div className="text-xl font-bold font-mono text-slate-300 mt-1">
                    {item.safety_stock}
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">Buffer Cadangan</span>
                </div>
              </div>

              {/* Stock Capacity Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-medium text-slate-400">
                  <span>Kapasitas Stok Relatif terhadap Max Stock</span>
                  <span className="font-mono font-bold text-white">{stockPercent}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      item.status === 'CRITICAL'
                        ? 'bg-rose-500'
                        : item.status === 'WARNING'
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                    style={{ width: `${stockPercent}%` }}
                  />
                </div>
              </div>

              {/* Financial Valuation (if permitted) */}
              {hasFinancial && (
                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="text-slate-400 block text-[11px]">Harga Satuan (Cost):</span>
                      <span className="font-mono font-bold text-emerald-300">
                        {unitCost > 0
                          ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(unitCost)
                          : 'Rp 0'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 block text-[11px]">Total Nilai Persediaan:</span>
                    <span className="font-mono font-extrabold text-sm text-emerald-400">
                      {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(totalValuation)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* RIWAYAT MUTASI TERKINI (MINI KARTU STOK) */}
            <div className="bg-slate-900/90 rounded-2xl p-4 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-cyan-400" />
                  Riwayat Mutasi Terkini
                </h3>
                <button
                  type="button"
                  onClick={() => onOpenMovements(item)}
                  className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
                >
                  <span>Buku Besar Lengkap</span>
                  <ExternalLink className="w-3 h-3" />
                </button>
              </div>

              {loadingMovements ? (
                <div className="py-4 text-center text-xs text-slate-500">Memuat mutasi persediaan...</div>
              ) : recentMovements.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-500">Belum ada riwayat transaksi mutasi.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-800/80 text-[11px]">
                        <th className="pb-2 font-medium">Tanggal</th>
                        <th className="pb-2 font-medium">Tipe Mutasi</th>
                        <th className="pb-2 font-medium text-right">Jumlah</th>
                        <th className="pb-2 font-medium text-right">Saldo Akhir</th>
                        <th className="pb-2 font-medium">Referensi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/40">
                      {recentMovements.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-800/20">
                          <td className="py-2 font-mono text-[11px] text-slate-400">
                            {new Date(m.created_at).toLocaleDateString('id-ID', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="py-2">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                m.movement_type.includes('OUT')
                                  ? 'bg-rose-500/10 text-rose-400'
                                  : 'bg-emerald-500/10 text-emerald-400'
                              }`}
                            >
                              {m.movement_type}
                            </span>
                          </td>
                          <td className="py-2 text-right font-mono font-bold text-white">
                            {m.movement_type.includes('OUT') ? `-${m.qty}` : `+${m.qty}`}
                          </td>
                          <td className="py-2 text-right font-mono text-cyan-300 font-semibold">
                            {m.balance_after}
                          </td>
                          <td className="py-2 font-mono text-[10px] text-slate-400 truncate max-w-[120px]">
                            {m.reference_number || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="border-t border-slate-800 pt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenMovements(item)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-xs font-semibold transition"
            >
              <History className="w-4 h-4" />
              <span>Kartu Stok Lengkap</span>
            </button>
            <button
              onClick={() => onOpenRelocate(item.spare_part_id, item.part_name, item.rack_location)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition"
            >
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Pindah Lokasi Bin</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-xs transition"
          >
            Tutup
          </button>
        </div>

      </div>

      {/* FULL-SIZE PHOTO PREVIEW MODAL */}
      {showFullImage && item.photo_url && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/95 backdrop-blur-lg animate-in fade-in"
          onClick={() => setShowFullImage(false)}
        >
          <div className="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setShowFullImage(false)}
              className="absolute -top-12 right-0 p-2 rounded-full bg-slate-800/80 text-white hover:bg-slate-700 transition"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={item.photo_url}
              alt={item.part_name}
              className="max-w-full max-h-[82vh] object-contain rounded-2xl shadow-2xl border border-slate-700"
            />
            <div className="mt-3 text-center">
              <span className="font-mono font-bold text-cyan-300">{item.spare_part_id}</span>
              <span className="mx-2 text-slate-500">•</span>
              <span className="font-semibold text-white">{item.part_name}</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
