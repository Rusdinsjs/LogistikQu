import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { returnsApi, masterApi } from '../api';
import type { UsedPartReturn, WarehouseInfo } from '../types';
import {
  getUserFleetCategory,
  isUnitNumberInCategory,
  isWarehouseInCategory,
} from '../utils/fleetCategory';
import {
  RotateCcw,
  CheckCircle,
  Clock,
  ArrowRight,
  Search,
  Building2,
  User,
  Truck,
  Camera,
  Layers,
  X,
  Eye,
  RefreshCw,
  Archive,
  FileCheck,
  UserCheck,
  Users,
  Filter,
  SlidersHorizontal,
} from 'lucide-react';

export const UsedPartReturnsPage: React.FC = () => {
  const { user } = useAuth();
  const userDivision = getUserFleetCategory(user);

  const canReceiveReturn =
    user?.role_id === 'SUPER_ADMIN' ||
    user?.permissions?.includes('returns.receive') ||
    user?.permissions?.includes('issue.create');

  const canTransferReturn =
    user?.role_id === 'SUPER_ADMIN' ||
    user?.permissions?.includes('returns.transfer') ||
    user?.permissions?.includes('request.verify') ||
    user?.permissions?.includes('sto.ship');

  const canCompleteReturn =
    user?.role_id === 'SUPER_ADMIN' ||
    user?.permissions?.includes('returns.complete') ||
    user?.permissions?.includes('issue.approve') ||
    user?.permissions?.includes('request.approve');

  const [returns, setReturns] = useState<UsedPartReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState<string>('');
  const [warehouseList, setWarehouseList] = useState<WarehouseInfo[]>([]);

  // Filter Penanggung Jawab (PJ)
  const [selectedHolderType, setSelectedHolderType] = useState<string>('ALL');
  const [selectedHolderName, setSelectedHolderName] = useState<string>('');
  const [showHolderSummaryModal, setShowHolderSummaryModal] = useState(false);

  // Modals for actions
  const [selectedReturn, setSelectedReturn] = useState<UsedPartReturn | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Receive Container Modal
  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveNotes, setReceiveNotes] = useState('');
  const [receivePhotoUrl, setReceivePhotoUrl] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const receivePhotoRef = useRef<HTMLInputElement>(null);

  // Transfer Main Modal
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [mainWarehouseId, setMainWarehouseId] = useState(
    userDivision === 'DT' ? 'WH-MAIN-DT' : 'WH-MAIN-HE'
  );
  const [transferNotes, setTransferNotes] = useState('');

  // Complete Return Modal
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [disposition, setDisposition] = useState('SCRAP');
  const [finalNotes, setFinalNotes] = useState('');

  // Preview Image Modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const loadReturns = async () => {
    try {
      setLoading(true);
      const data = await returnsApi.getReturns({
        warehouse_id: filterWarehouse || undefined,
        search: search || undefined,
      });
      const scoped = data.filter(
        (r) =>
          isWarehouseInCategory(r.warehouse_id, undefined, userDivision) &&
          isUnitNumberInCategory(r.unit_number, undefined, undefined, userDivision)
      );
      setReturns(scoped);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        const whs = await masterApi.getWarehouses();
        const scopedWhs = whs.filter((w) =>
          isWarehouseInCategory(w.id, w.category, userDivision)
        );
        setWarehouseList(scopedWhs);
      } catch (err) {
        console.error(err);
      }
    };
    fetchWarehouses();
  }, [userDivision]);

  useEffect(() => {
    loadReturns();
  }, [filterWarehouse, userDivision]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadReturns();
  };

  // Image Upload with canvas compression for container receipt
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDimension = 1000;
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

        const dataUrl = canvas.toDataURL('image/jpeg', 0.72);
        setReceivePhotoUrl(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Handle Receive at Container
  const handleConfirmReceive = async () => {
    if (!selectedReturn) return;
    setSubmittingAction(true);
    try {
      await returnsApi.receiveAtContainer(selectedReturn.id, {
        container_notes: receiveNotes || undefined,
        container_photo_url: receivePhotoUrl || undefined,
      });
      setShowReceiveModal(false);
      setReceiveNotes('');
      setReceivePhotoUrl(null);
      setSelectedReturn(null);
      await loadReturns();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal menerima part bekas di gudang kontainer');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle Transfer to Main Warehouse
  const handleConfirmTransfer = async () => {
    if (!selectedReturn) return;
    setSubmittingAction(true);
    try {
      await returnsApi.transferToMain(selectedReturn.id, {
        main_warehouse_id: mainWarehouseId || undefined,
        main_notes: transferNotes || undefined,
      });
      setShowTransferModal(false);
      setTransferNotes('');
      setSelectedReturn(null);
      await loadReturns();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal menyerahkan part bekas ke gudang utama');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Handle Complete Return
  const handleConfirmComplete = async () => {
    if (!selectedReturn) return;
    setSubmittingAction(true);
    try {
      await returnsApi.completeReturn(selectedReturn.id, {
        disposition: disposition || undefined,
        final_notes: finalNotes || undefined,
      });
      setShowCompleteModal(false);
      setFinalNotes('');
      setSelectedReturn(null);
      await loadReturns();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal menyelesaikan disposisi part bekas');
    } finally {
      setSubmittingAction(false);
    }
  };

  const isMechanic = user?.role_id === 'MECHANIC';

  // Rekapitulasi per Penanggung Jawab (PJ)
  const holderSummary = useMemo(() => {
    if (isMechanic) {
      // Pada Menu Tanggungan Core Retur, hanya memperlihatkan list PJ atas nama User saja
      const userName = user?.full_name || user?.username || 'Mekanik Penanggung Jawab';
      const userItems = returns.filter((r) => r.status === 'PENDING_RETURN');
      return [
        {
          name: userName,
          type: 'MECHANIC',
          count: userItems.length,
          items: userItems,
        },
      ];
    }

    const map = new Map<
      string,
      {
        name: string;
        type: string;
        count: number;
        items: UsedPartReturn[];
      }
    >();

    returns.forEach((r) => {
      const key = r.current_holder_name;
      const existing = map.get(key) || {
        name: key,
        type: r.current_holder_type,
        count: 0,
        items: [],
      };
      existing.count += 1;
      existing.items.push(r);
      map.set(key, existing);
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [returns, isMechanic, user]);

  // Counts by Holder Type
  const countByType = useMemo(() => {
    return {
      ALL: returns.length,
      MECHANIC: returns.filter((r) => r.current_holder_type === 'MECHANIC').length,
      CONTAINER_ADMIN: returns.filter((r) => r.current_holder_type === 'CONTAINER_ADMIN').length,
      MAIN_ADMIN: returns.filter((r) => r.current_holder_type === 'MAIN_ADMIN').length,
      COMPLETED: returns.filter((r) => r.current_holder_type === 'COMPLETED').length,
    };
  }, [returns]);

  // Filter returns based on PJ filters
  const filteredReturns = useMemo(() => {
    return returns.filter((r) => {
      if (isMechanic) {
        if (selectedHolderType === 'MECHANIC') {
          return r.status === 'PENDING_RETURN';
        }
        if (selectedHolderType === 'CONTAINER_ADMIN') {
          return r.status !== 'PENDING_RETURN';
        }
        return true;
      }
      if (selectedHolderType !== 'ALL' && r.current_holder_type !== selectedHolderType) {
        return false;
      }
      if (selectedHolderName && r.current_holder_name !== selectedHolderName) {
        return false;
      }
      return true;
    });
  }, [returns, selectedHolderType, selectedHolderName, isMechanic]);

  // Group filtered returns for the 4 Kanban columns
  const pendingMechanic = filteredReturns.filter((r) => r.status === 'PENDING_RETURN');
  const atContainer = filteredReturns.filter((r) => r.status === 'RECEIVED_AT_CONTAINER');
  const atMain = filteredReturns.filter((r) => r.status === 'TRANSFERRED_TO_MAIN');
  const completed = filteredReturns.filter((r) => r.status === 'COMPLETED');

  const mainWarehouses = warehouseList.filter((w) => w.warehouse_type === 'MAIN');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-amber-400" />
            {isMechanic
              ? 'Tanggungan Core Retur Saya (BR-004)'
              : 'Pelacakan Retur Spare Part Bekas (Core Return Tracking)'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {isMechanic
              ? `Monitoring fisik komponen bekas yang menjadi tanggungan Anda (${user?.full_name || user?.username}). Wajib diserahkan ke loket kontainer maksimal 1x24 jam.`
              : 'Monitoring fisik part rusak yang wajib dikembalikan saat servis, dengan penanggung jawab real-time berjenjang (Mekanik → Admin Kontainer → Admin Gudang Utama).'}
          </p>
        </div>
        <div className="flex items-center gap-2 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setShowHolderSummaryModal(true)}
            className="p-2 px-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-cyan-300 text-xs flex items-center gap-1.5 transition-colors border border-cyan-500/30 shadow-sm cursor-pointer"
            title="Lihat Daftar & Rekap Part per Penanggung Jawab"
          >
            <Users className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {isMechanic
                ? `Tanggungan PJ Saya (${pendingMechanic.length} Part)`
                : `Rekapitulasi per PJ (${holderSummary.length})`}
            </span>
          </button>
          <button
            type="button"
            onClick={loadReturns}
            className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1.5 transition-colors border border-slate-700"
            title="Muat Ulang Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Banner Kontrol Khusus Mekanik */}
      {user?.role_id === 'MECHANIC' && (
        <div className="glass-panel rounded-2xl p-4 border border-amber-500/30 bg-amber-500/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
              <RotateCcw className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Kontrol Tanggungan Part Bekas Anda (Aturan BR-004)
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Setiap komponen bekas (Filter, Alternator, Turbo, Starter) wajib diserahkan fisik ke Admin Kontainer maksimal 1x24 jam setelah penggantian.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="px-3 py-2 rounded-xl bg-slate-900 border border-amber-500/40 text-center flex-1 md:flex-initial">
              <div className="text-[10px] text-amber-400 uppercase font-semibold">Belum Diserahkan</div>
              <div className="text-base font-bold text-amber-300 font-mono">{pendingMechanic.length} Part</div>
            </div>
            <div className="px-3 py-2 rounded-xl bg-slate-900 border border-emerald-500/40 text-center flex-1 md:flex-initial">
              <div className="text-[10px] text-emerald-400 uppercase font-semibold">Sudah Diserahkan</div>
              <div className="text-base font-bold text-emerald-300 font-mono">
                {atContainer.length + atMain.length + completed.length} Part
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-3">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-3">
          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari nomor retur, kode part, nama PJ/mekanik, atau unit lambung..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
            />
          </form>

          {/* Filter Dropdown Penanggung Jawab Spesifik */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <UserCheck className="w-4 h-4 text-amber-400 shrink-0" />
            {isMechanic ? (
              <div className="w-full lg:w-64 px-2.5 py-2 text-xs bg-slate-900 border border-amber-500/40 rounded-lg text-amber-300 flex items-center gap-1.5 shadow-sm">
                <span className="text-[10px] uppercase font-bold text-slate-400">PJ:</span>
                <span className="font-semibold truncate">👨‍🔧 {user?.full_name || user?.username} (Saya)</span>
              </div>
            ) : (
              <select
                value={selectedHolderName}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedHolderName(val);
                  if (val) {
                    const match = holderSummary.find((h) => h.name === val);
                    if (match) setSelectedHolderType(match.type);
                  }
                }}
                className="w-full lg:w-60 px-2.5 py-2 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="">Semua Personil PJ ({holderSummary.length} orang)</option>
                {holderSummary.map((h) => (
                  <option key={h.name} value={h.name}>
                    {h.type === 'MECHANIC'
                      ? '👨‍🔧 [Mekanik] '
                      : h.type === 'CONTAINER_ADMIN'
                      ? '📦 [Kontainer] '
                      : h.type === 'MAIN_ADMIN'
                      ? '🏢 [Utama] '
                      : '✅ [Selesai] '}
                    {h.name} ({h.count} part)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Filter Dropdown Gudang */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
            <select
              value={filterWarehouse}
              onChange={(e) => setFilterWarehouse(e.target.value)}
              className="w-full lg:w-52 px-2.5 py-2 text-xs bg-slate-900 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="">Semua Gudang Asal</option>
              {warehouseList.map((w: WarehouseInfo) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.warehouse_type})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Filter Pill Chips by Penanggung Jawab (PJ) */}
        {isMechanic ? (
          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              <span>Status Tanggungan:</span>
            </span>

            <button
              type="button"
              onClick={() => {
                setSelectedHolderType('ALL');
                setSelectedHolderName('');
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedHolderType === 'ALL'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>Semua Riwayat</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 font-mono text-cyan-300">
                {returns.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedHolderType('MECHANIC');
                setSelectedHolderName('');
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedHolderType === 'MECHANIC'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>⚠️ Belum Diserahkan (Tanggungan Aktif)</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 font-mono text-amber-300">
                {pendingMechanic.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedHolderType('CONTAINER_ADMIN');
                setSelectedHolderName('');
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedHolderType === 'CONTAINER_ADMIN'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>✓ Sudah Diserahkan ke Kontainer</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 font-mono text-emerald-300">
                {atContainer.length + atMain.length + completed.length}
              </span>
            </button>
          </div>
        ) : (
          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-400 mr-1 flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              <span>Kategori PJ:</span>
            </span>

            <button
              type="button"
              onClick={() => {
                setSelectedHolderType('ALL');
                setSelectedHolderName('');
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedHolderType === 'ALL' && !selectedHolderName
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>Semua PJ</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-800 font-mono text-cyan-300">
                {countByType.ALL}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedHolderType('MECHANIC');
                setSelectedHolderName('');
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedHolderType === 'MECHANIC' && !selectedHolderName
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>👨‍🔧 Di Mekanik</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500/20 font-mono text-amber-300">
                {countByType.MECHANIC}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedHolderType('CONTAINER_ADMIN');
                setSelectedHolderName('');
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedHolderType === 'CONTAINER_ADMIN' && !selectedHolderName
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>📦 Di Admin Kontainer</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-500/20 font-mono text-cyan-300">
                {countByType.CONTAINER_ADMIN}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedHolderType('MAIN_ADMIN');
                setSelectedHolderName('');
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedHolderType === 'MAIN_ADMIN' && !selectedHolderName
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>🏢 Di Gudang Utama</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-500/20 font-mono text-blue-300">
                {countByType.MAIN_ADMIN}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedHolderType('COMPLETED');
                setSelectedHolderName('');
              }}
              className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                selectedHolderType === 'COMPLETED' && !selectedHolderName
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <span>✅ Selesai (Scrap)</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-500/20 font-mono text-emerald-300">
                {countByType.COMPLETED}
              </span>
            </button>
          </div>
        )}

        {/* Active Filter Notification Bar */}
        {(selectedHolderType !== 'ALL' || selectedHolderName) && (
          <div className="flex items-center justify-between p-2.5 px-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
            <div className="flex items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                {isMechanic ? (
                  <>
                    Memfilter status:
                    <strong className="text-white ml-1 font-semibold">
                      {selectedHolderType === 'MECHANIC'
                        ? 'Belum Diserahkan (Tanggungan Aktif)'
                        : 'Sudah Diserahkan ke Kontainer'}
                    </strong>
                    <span className="ml-2 font-mono text-cyan-300 font-bold">
                      ({filteredReturns.length} part)
                    </span>
                  </>
                ) : (
                  <>
                    Memfilter suku cadang pada PJ:
                    <strong className="text-white ml-1 font-semibold">
                      {selectedHolderName
                        ? selectedHolderName
                        : selectedHolderType === 'MECHANIC'
                        ? 'Mekanik Lapangan'
                        : selectedHolderType === 'CONTAINER_ADMIN'
                        ? 'Admin Gudang Kontainer'
                        : selectedHolderType === 'MAIN_ADMIN'
                        ? 'Admin Gudang Utama'
                        : 'Selesai/Disposisi'}
                    </strong>
                    <span className="ml-2 font-mono text-cyan-300 font-bold">
                      ({filteredReturns.length} part ditemukan)
                    </span>
                  </>
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedHolderType('ALL');
                setSelectedHolderName('');
              }}
              className="text-xs text-amber-400 hover:text-white underline font-semibold flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          </div>
        )}
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass-panel rounded-xl p-3 border border-amber-500/30 bg-amber-500/5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-400">Di Tangan Mekanik</span>
            <Clock className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-xl font-bold font-mono text-white mt-1">{pendingMechanic.length}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Wajib diserahkan ke kontainer</p>
        </div>

        <div className="glass-panel rounded-xl p-3 border border-cyan-500/30 bg-cyan-500/5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-cyan-400">Di Gudang Kontainer</span>
            <Layers className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-xl font-bold font-mono text-white mt-1">{atContainer.length}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Telah diterima admin kontainer</p>
        </div>

        <div className="glass-panel rounded-xl p-3 border border-blue-500/30 bg-blue-500/5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-blue-400">Di Gudang Utama</span>
            <Building2 className="w-4 h-4 text-blue-400" />
          </div>
          <p className="text-xl font-bold font-mono text-white mt-1">{atMain.length}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Menunggu disposisi/inspeksi</p>
        </div>

        <div className="glass-panel rounded-xl p-3 border border-emerald-500/30 bg-emerald-500/5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-400">Selesai / Scrap</span>
            <CheckCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-xl font-bold font-mono text-white mt-1">{completed.length}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">Tuntas (Scrap/Refurbish)</p>
        </div>
      </div>

      {/* 4-Column Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
        {/* Column 1: Di Tangan Mekanik */}
        <div className="glass-panel rounded-2xl p-4 border border-amber-500/20 bg-slate-900/40 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                1. Di Tangan Mekanik ({pendingMechanic.length})
              </h3>
            </div>
          </div>

          <div className="space-y-3 min-h-[300px]">
            {pendingMechanic.length === 0 ? (
              <p className="text-center text-slate-500 text-xs py-10">Tidak ada part pada kriteria filter ini.</p>
            ) : (
              pendingMechanic.map((item) => (
                <div
                  key={item.id}
                  className="glass-card rounded-xl p-3 border border-amber-500/30 hover:border-amber-400/60 transition-all space-y-2 bg-slate-900/80"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-bold text-amber-300">{item.return_number}</span>
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">
                      Pending
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-white line-clamp-1">
                      {item.spare_part_id} - {item.part_name || 'Part'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Jumlah: <span className="font-mono text-slate-200 font-bold">{item.qty} {item.unit_of_measure}</span>
                    </p>
                  </div>

                  <div className="bg-slate-950/60 p-2 rounded-lg text-[10px] space-y-1 font-mono text-slate-300 border border-slate-800">
                    <div className="flex items-center gap-1.5 text-amber-200">
                      <User className="w-3 h-3 text-amber-400 shrink-0" />
                      <span className="font-semibold truncate">
                        P.J: {isMechanic ? `${user?.full_name || user?.username || item.current_holder_name} (Saya)` : `Mekanik ${item.current_holder_name}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Truck className="w-3 h-3 shrink-0" />
                      <span>Unit: {item.unit_number}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Building2 className="w-3 h-3 shrink-0" />
                      <span>Gudang: {item.warehouse_name || item.warehouse_id}</span>
                    </div>
                  </div>

                  {user?.role_id === 'MECHANIC' && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-semibold">
                      <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>Tanggungan Anda (Wajib serahkan ke loket kontainer)</span>
                    </div>
                  )}

                  <div className="pt-1 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReturn(item);
                        setShowDetailModal(true);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-[11px]"
                      title="Lihat Detail"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {canReceiveReturn && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedReturn(item);
                          setShowReceiveModal(true);
                        }}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold text-[11px] border border-cyan-500/40 flex items-center justify-center gap-1 transition-colors"
                      >
                        <CheckCircle className="w-3 h-3" />
                        <span>Terima di Kontainer</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Di Gudang Kontainer */}
        <div className="glass-panel rounded-2xl p-4 border border-cyan-500/20 bg-slate-900/40 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                2. Di Gudang Kontainer ({atContainer.length})
              </h3>
            </div>
          </div>

          <div className="space-y-3 min-h-[300px]">
            {atContainer.length === 0 ? (
              <p className="text-center text-slate-500 text-xs py-10">Tidak ada part pada kriteria filter ini.</p>
            ) : (
              atContainer.map((item) => (
                <div
                  key={item.id}
                  className="glass-card rounded-xl p-3 border border-cyan-500/30 hover:border-cyan-400/60 transition-all space-y-2 bg-slate-900/80"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-bold text-cyan-300">{item.return_number}</span>
                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-[10px] font-bold">
                      Di Kontainer
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-white line-clamp-1">
                      {item.spare_part_id} - {item.part_name || 'Part'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Jumlah: <span className="font-mono text-slate-200 font-bold">{item.qty} {item.unit_of_measure}</span>
                    </p>
                  </div>

                  <div className="bg-slate-950/60 p-2 rounded-lg text-[10px] space-y-1 font-mono text-slate-300 border border-slate-800">
                    <div className="flex items-center gap-1.5 text-cyan-200">
                      <User className="w-3 h-3 text-cyan-400 shrink-0" />
                      <span className="font-semibold truncate">
                        {isMechanic
                          ? `PJ Asal: ${user?.full_name || user?.username || item.mechanic_name} (Diserahkan ke Kontainer)`
                          : `P.J: ${item.current_holder_name}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>
                        Diterima: {item.container_received_at ? new Date(item.container_received_at).toLocaleDateString('id-ID') : '-'}
                      </span>
                    </div>
                    {item.container_photo_url && (
                      <div className="pt-1 flex items-center gap-1.5">
                        <Camera className="w-3 h-3 text-emerald-400 shrink-0" />
                        <button
                          type="button"
                          onClick={() => setPreviewImage(item.container_photo_url || null)}
                          className="text-cyan-400 hover:underline text-[10px]"
                        >
                          Lihat Foto Fisik
                        </button>
                      </div>
                    )}
                  </div>

                  {user?.role_id === 'MECHANIC' && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] font-semibold">
                      <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span>Sudah Diterima Admin Kontainer ✓</span>
                    </div>
                  )}

                  <div className="pt-1 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReturn(item);
                        setShowDetailModal(true);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-[11px]"
                      title="Lihat Detail"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {canTransferReturn && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedReturn(item);
                          if (item.warehouse_id?.includes('DT')) {
                            setMainWarehouseId('WH-MAIN-DT');
                          } else if (item.warehouse_id?.includes('HE')) {
                            setMainWarehouseId('WH-MAIN-HE');
                          }
                          setShowTransferModal(true);
                        }}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 font-bold text-[11px] border border-blue-500/40 flex items-center justify-center gap-1 transition-colors"
                      >
                        <ArrowRight className="w-3 h-3" />
                        <span>Kirim ke Gudang Utama</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 3: Di Gudang Utama */}
        <div className="glass-panel rounded-2xl p-4 border border-blue-500/20 bg-slate-900/40 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400"></span>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                3. Di Gudang Utama ({atMain.length})
              </h3>
            </div>
          </div>

          <div className="space-y-3 min-h-[300px]">
            {atMain.length === 0 ? (
              <p className="text-center text-slate-500 text-xs py-10">Tidak ada part pada kriteria filter ini.</p>
            ) : (
              atMain.map((item) => (
                <div
                  key={item.id}
                  className="glass-card rounded-xl p-3 border border-blue-500/30 hover:border-blue-400/60 transition-all space-y-2 bg-slate-900/80"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-bold text-blue-300">{item.return_number}</span>
                    <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold">
                      Gudang Utama
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-white line-clamp-1">
                      {item.spare_part_id} - {item.part_name || 'Part'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Jumlah: <span className="font-mono text-slate-200 font-bold">{item.qty} {item.unit_of_measure}</span>
                    </p>
                  </div>

                  <div className="bg-slate-950/60 p-2 rounded-lg text-[10px] space-y-1 font-mono text-slate-300 border border-slate-800">
                    <div className="flex items-center gap-1.5 text-blue-200">
                      <User className="w-3 h-3 text-blue-400 shrink-0" />
                      <span className="font-semibold truncate">
                        {isMechanic
                          ? `PJ Asal: ${user?.full_name || user?.username || item.mechanic_name} (Di Gudang Utama)`
                          : `P.J: ${item.current_holder_name}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <Building2 className="w-3 h-3 shrink-0" />
                      <span>Lokasi: {item.main_warehouse_id || 'Gudang Utama'}</span>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReturn(item);
                        setShowDetailModal(true);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-[11px]"
                      title="Lihat Detail"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {canCompleteReturn && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedReturn(item);
                          setShowCompleteModal(true);
                        }}
                        className="flex-1 py-1.5 px-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold text-[11px] border border-emerald-500/40 flex items-center justify-center gap-1 transition-colors"
                      >
                        <Archive className="w-3 h-3" />
                        <span>Selesaikan / Disposisi</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 4: Selesai / Disposisi */}
        <div className="glass-panel rounded-2xl p-4 border border-emerald-500/20 bg-slate-900/40 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                4. Selesai / Disposisi ({completed.length})
              </h3>
            </div>
          </div>

          <div className="space-y-3 min-h-[300px]">
            {completed.length === 0 ? (
              <p className="text-center text-slate-500 text-xs py-10">Tidak ada part pada kriteria filter ini.</p>
            ) : (
              completed.map((item) => (
                <div
                  key={item.id}
                  className="glass-card rounded-xl p-3 border border-emerald-500/20 space-y-2 bg-slate-900/60 opacity-90"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-bold text-emerald-300">{item.return_number}</span>
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                      Tuntas
                    </span>
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-200 line-clamp-1">
                      {item.spare_part_id} - {item.part_name || 'Part'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Jumlah: <span className="font-mono text-slate-300 font-bold">{item.qty} {item.unit_of_measure}</span>
                    </p>
                  </div>

                  <div className="bg-slate-950/60 p-2 rounded-lg text-[10px] space-y-1 font-mono text-slate-400 border border-slate-800">
                    <div className="flex items-center gap-1.5 text-emerald-300">
                      <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                      <span className="truncate">
                        {isMechanic
                          ? `PJ Asal: ${user?.full_name || user?.username || item.mechanic_name} (Selesai/Scrap)`
                          : item.current_holder_name}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedReturn(item);
                        setShowDetailModal(true);
                      }}
                      className="py-1 px-2.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white text-[11px] flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Detail Riwayat</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Modal: Rekapitulasi per Penanggung Jawab (PJ) */}
      {showHolderSummaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-2xl max-h-[85vh] rounded-2xl border border-cyan-500/40 p-6 shadow-2xl flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-cyan-400">
                <Users className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">
                  {isMechanic
                    ? `Rekapitulasi Tanggungan Core Retur — ${user?.full_name || user?.username}`
                    : `Rekapitulasi Suku Cadang per Penanggung Jawab (${holderSummary.length} Personil)`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHolderSummaryModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              {isMechanic
                ? 'Daftar suku cadang bekas yang saat ini berstatus tanggungan aktif atas nama Anda dan wajib diserahkan fisik ke loket Admin Kontainer.'
                : 'Daftar penanggung jawab fisik suku cadang bekas saat ini. Klik tombol Filter Part PJ Ini untuk langsung melihat item terkait pada Kanban Board.'}
            </p>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {holderSummary.length === 0 || (isMechanic && pendingMechanic.length === 0) ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  {isMechanic
                    ? 'Tidak ada part bekas yang menjadi tanggungan Anda saat ini. Semua part telah diserahkan ke kontainer.'
                    : 'Belum ada data penanggung jawab fisik.'}
                </div>
              ) : (
                holderSummary.map((h) => {
                  const isMechanicType = h.type === 'MECHANIC';
                  const isContainer = h.type === 'CONTAINER_ADMIN';
                  const isMain = h.type === 'MAIN_ADMIN';

                  return (
                    <div
                      key={h.name}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isMechanic
                          ? 'bg-amber-500/10 border-amber-500/50'
                          : selectedHolderName === h.name
                          ? 'bg-amber-500/10 border-amber-500/60'
                          : 'bg-slate-900/70 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                isMechanic
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : isMechanicType
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  : isContainer
                                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                  : isMain
                                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              }`}
                            >
                              {isMechanic
                                ? '👨‍🔧 PENANGGUNG JAWAB (USER)'
                                : isMechanicType
                                ? '👨‍🔧 MEKANIK'
                                : isContainer
                                ? '📦 ADMIN KONTAINER'
                                : isMain
                                ? '🏢 ADMIN GUDANG UTAMA'
                                : '✅ SELESAI'}
                            </span>
                            <span className="font-bold text-white text-xs">{h.name}</span>
                          </div>
                          <p className="text-[11px] text-slate-300">
                            {isMechanic
                              ? <>Menanggung <span className="font-mono text-amber-300 font-bold">{h.count} unit part fisik</span> yang belum diserahkan ke loket.</>
                              : <>Menanggung <span className="font-mono text-cyan-300 font-bold">{h.count} unit part</span></>
                            }
                          </p>
                        </div>

                        {!isMechanic && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedHolderName(h.name);
                                setSelectedHolderType(h.type);
                                setShowHolderSummaryModal(false);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold text-xs border border-cyan-500/40 transition-colors"
                            >
                              Filter Part PJ Ini &rarr;
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Item details list preview */}
                      <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                        {h.items.map((it) => (
                          <span
                            key={it.id}
                            className={`text-[10px] px-2 py-0.5 rounded font-mono ${
                              isMechanic
                                ? 'bg-slate-950/80 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-950/80 text-slate-300 border border-slate-800'
                            }`}
                          >
                            {it.return_number} ({it.spare_part_id} - Unit {it.unit_number})
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowHolderSummaryModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 1: Terima di Gudang Kontainer */}
      {showReceiveModal && selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-cyan-500/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-cyan-400">
                <CheckCircle className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">Terima Part Bekas di Kontainer</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReceiveModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">No Retur:</span>
                <span className="text-cyan-300 font-bold">{selectedReturn.return_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Part:</span>
                <span className="text-white">{selectedReturn.spare_part_id} ({selectedReturn.qty} {selectedReturn.unit_of_measure})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Mekanik Penyerah:</span>
                <span className="text-amber-300">{selectedReturn.mechanic_name}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Catatan Kondisi Fisik Part (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: Bodi turbo retak dan bearing pecah..."
                  value={receiveNotes}
                  onChange={(e) => setReceiveNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Foto Bukti Fisik Part Bekas (Opsional)</label>
                <input
                  type="file"
                  ref={receivePhotoRef}
                  accept="image/*"
                  capture="environment"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
                {receivePhotoUrl ? (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <img
                      src={receivePhotoUrl}
                      alt="Bukti Fisik Part Bekas"
                      className="w-12 h-12 object-cover rounded border border-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => setReceivePhotoUrl(null)}
                      className="text-rose-400 hover:text-rose-300 text-xs"
                    >
                      Hapus Foto
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => receivePhotoRef.current?.click()}
                    className="w-full py-2.5 px-3 rounded-lg border border-dashed border-slate-700 hover:border-cyan-500 bg-slate-900/60 text-slate-300 text-xs flex items-center justify-center gap-2"
                  >
                    <Camera className="w-4 h-4 text-cyan-400" />
                    <span>Ambil Foto Kondisi Part Bekas</span>
                  </button>
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Setelah dikonfirmasi, penanggung jawab fisik akan otomatis berpindah dari Mekanik ke <span className="text-cyan-300 font-bold">Admin Kontainer ({user?.full_name})</span>.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowReceiveModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmReceive}
                disabled={submittingAction}
                className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs disabled:opacity-50"
              >
                {submittingAction ? 'Memproses...' : 'Konfirmasi Penerimaan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Transfer ke Gudang Utama */}
      {showTransferModal && selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-blue-500/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-blue-400">
                <ArrowRight className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">Serah Terima ke Gudang Utama</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">No Retur:</span>
                <span className="text-blue-300 font-bold">{selectedReturn.return_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Part:</span>
                <span className="text-white">{selectedReturn.spare_part_id}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Gudang Utama Tujuan *</label>
                <select
                  value={mainWarehouseId}
                  onChange={(e) => setMainWarehouseId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-blue-500 focus:outline-none"
                >
                  {mainWarehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.id})
                    </option>
                  ))}
                  {mainWarehouses.length === 0 && (
                    <option value={userDivision === 'DT' ? 'WH-MAIN-DT' : 'WH-MAIN-HE'}>
                      {userDivision === 'DT' ? 'Gudang Utama Dump Truck (WH-MAIN-DT)' : 'Gudang Utama Alat Berat (WH-MAIN-HE)'}
                    </option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Catatan Serah Terima (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: Dikirim bersama rombongan logistik..."
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Penanggung jawab fisik akan dipindahkan ke <span className="text-blue-300 font-bold">Admin Gudang Utama</span>.
            </p>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowTransferModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmTransfer}
                disabled={submittingAction}
                className="px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-400 text-slate-950 font-bold text-xs disabled:opacity-50"
              >
                {submittingAction ? 'Memproses...' : 'Konfirmasi Serah Terima'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Selesaikan Disposisi (Scrap / Refurbish) */}
      {showCompleteModal && selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-emerald-500/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400">
                <Archive className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">Selesaikan Disposisi Part Bekas</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCompleteModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">No Retur:</span>
                <span className="text-emerald-300 font-bold">{selectedReturn.return_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Part:</span>
                <span className="text-white">{selectedReturn.spare_part_id}</span>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Keputusan Disposisi Akhir *</label>
                <select
                  value={disposition}
                  onChange={(e) => setDisposition(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-emerald-500 focus:outline-none"
                >
                  <option value="SCRAP">Scrap (Limbah Logam / Besi Tua)</option>
                  <option value="REFURBISH">Refurbish (Fabrikasi / Perbaikan Komponen)</option>
                  <option value="CORE_EXCHANGE">Core Exchange (Tukar Tambah dengan Vendor)</option>
                  <option value="INSPECTION_STORED">Simpan di Gudang Scrap/Karantina</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Catatan Akhir Disposisi</label>
                <input
                  type="text"
                  placeholder="Keterangan berita acara scrap / nomor BAP..."
                  value={finalNotes}
                  onChange={(e) => setFinalNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCompleteModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmComplete}
                disabled={submittingAction}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs disabled:opacity-50"
              >
                {submittingAction ? 'Menyimpan...' : 'Selesaikan Retur'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Detail & Audit Trail */}
      {showDetailModal && selectedReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-700 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-cyan-400">
                <FileCheck className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">Audit Trail Pelacakan Part Bekas</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 font-mono text-xs space-y-2">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Nomor Retur:</span>
                <span className="text-cyan-300 font-bold">{selectedReturn.return_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Suku Cadang:</span>
                <span className="text-white">{selectedReturn.spare_part_id} - {selectedReturn.part_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Jumlah:</span>
                <span className="text-white">{selectedReturn.qty} {selectedReturn.unit_of_measure}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Unit Terkait:</span>
                <span className="text-white">{selectedReturn.unit_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Penanggung Jawab Sekarang:</span>
                <span className="text-amber-300 font-bold">{selectedReturn.current_holder_name} ({selectedReturn.current_holder_type})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status Fisik:</span>
                <span className="text-emerald-300">{selectedReturn.status}</span>
              </div>

              {/* Timeline Serah Terima */}
              <div className="pt-3 border-t border-slate-800 space-y-2 font-sans">
                <p className="text-[11px] font-bold text-slate-300">Riwayat Berjenjang:</p>

                <div className="space-y-1.5 text-[11px]">
                  <div className="flex items-start gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 mt-1 shrink-0"></span>
                    <div>
                      <p className="font-semibold text-slate-200">1. Dikeluarkan dari POS ke Mekanik</p>
                      <p className="text-slate-400 text-[10px]">
                        Mekanik: {selectedReturn.mechanic_name} | {new Date(selectedReturn.created_at).toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>

                  {selectedReturn.container_received_at && (
                    <div className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 mt-1 shrink-0"></span>
                      <div>
                        <p className="font-semibold text-slate-200">2. Diterima di Gudang Kontainer</p>
                        <p className="text-slate-400 text-[10px]">
                          Oleh: {selectedReturn.container_received_by_name || 'Admin'} | {new Date(selectedReturn.container_received_at).toLocaleString('id-ID')}
                        </p>
                        {selectedReturn.container_notes && (
                          <p className="text-cyan-300 text-[10px] italic">"{selectedReturn.container_notes}"</p>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedReturn.main_received_at && (
                    <div className="flex items-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400 mt-1 shrink-0"></span>
                      <div>
                        <p className="font-semibold text-slate-200">3. Diterima di Gudang Utama</p>
                        <p className="text-slate-400 text-[10px]">
                          Oleh: {selectedReturn.main_received_by_name || 'Admin'} | Lokasi: {selectedReturn.main_warehouse_id} | {new Date(selectedReturn.main_received_at).toLocaleString('id-ID')}
                        </p>
                        {selectedReturn.main_notes && (
                          <p className="text-blue-300 text-[10px] italic">"{selectedReturn.main_notes}"</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Photo preview in detail */}
              {selectedReturn.container_photo_url && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-slate-400 text-[10px] block mb-1">Foto Bukti Fisik di Kontainer:</span>
                  <img
                    src={selectedReturn.container_photo_url}
                    alt="Foto Part Bekas"
                    className="w-28 h-28 object-cover rounded border border-slate-700 cursor-pointer"
                    onClick={() => setPreviewImage(selectedReturn.container_photo_url || null)}
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-2xl max-h-[85vh] p-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="absolute -top-3 -right-3 p-1.5 bg-slate-800 text-white rounded-full hover:bg-slate-700 shadow-lg"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewImage}
              alt="Foto Penuh"
              className="rounded-xl max-w-full max-h-[80vh] object-contain border border-slate-700 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
