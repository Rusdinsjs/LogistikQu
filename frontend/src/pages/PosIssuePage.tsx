import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { inventoryApi, issueApi, masterApi } from '../api';
import type { Employee, Equipment, InventoryStockItem, Site } from '../types';
import {
  ShoppingCart,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Printer,
  Search,
} from 'lucide-react';

export const PosIssuePage: React.FC = () => {
  const { activeWarehouse, activeWarehouseInfo } = useAuth();

  // Master data
  const [availableStock, setAvailableStock] = useState<InventoryStockItem[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [mechanicList, setMechanicList] = useState<Employee[]>([]);
  const [siteList, setSiteList] = useState<Site[]>([]);
  const [searchPart, setSearchPart] = useState('');

  // Cart
  interface CartItem {
    part: InventoryStockItem;
    qty: number;
  }
  const [cart, setCart] = useState<CartItem[]>([]);

  // Form Traceability
  const [siteId, setSiteId] = useState('SITE-VALE-A');
  const [receiverName, setReceiverName] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [unitName, setUnitName] = useState('');
  const [unitType, setUnitType] = useState('');
  const [ctNumber, setCtNumber] = useState('');
  const [hmKm, setHmKm] = useState<number | undefined>(undefined);
  const [mechanicName, setMechanicName] = useState('');
  const [workOrder, setWorkOrder] = useState('');
  const [maintenanceType, setMaintenanceType] = useState('PREVENTIVE');
  const [notes, setNotes] = useState('');

  // UI States
  const [submitting, setSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<any | null>(null);

  useEffect(() => {
    const loadMasters = async () => {
      try {
        const [stocks, eq, emp, sites] = await Promise.all([
          inventoryApi.getStock(activeWarehouse),
          masterApi.getEquipment(),
          masterApi.getEmployees(),
          masterApi.getSites(),
        ]);
        setAvailableStock(stocks);
        setEquipmentList(eq);
        setMechanicList(emp.filter((e) => e.is_mechanic));
        setSiteList(sites);
      } catch (err) {
        console.error(err);
      }
    };
    loadMasters();
  }, [activeWarehouse]);

  // Handle Equipment selection auto-fill
  const handleSelectEquipment = (unitId: string) => {
    setSelectedUnitId(unitId);
    const eq = equipmentList.find((e) => e.id === unitId);
    if (eq) {
      setUnitNumber(eq.unit_number);
      setUnitName(eq.name);
      setUnitType(eq.equipment_type_id || 'HEAVY_EQUIPMENT');
      setCtNumber(eq.ct_number || '');
      setHmKm(Number(eq.current_hm_km));
    }
  };

  const handleAddToCart = (part: InventoryStockItem) => {
    const existing = cart.find((c) => c.part.spare_part_id === part.spare_part_id);
    if (existing) {
      if (existing.qty + 1 > part.qty_on_hand) {
        alert('Kuantitas melebihi sisa stok di kontainer!');
        return;
      }
      setCart(cart.map((c) => (c.part.spare_part_id === part.spare_part_id ? { ...c, qty: c.qty + 1 } : c)));
    } else {
      if (part.qty_on_hand <= 0) {
        alert('Stok part ini habis!');
        return;
      }
      setCart([...cart, { part, qty: 1 }]);
    }
  };

  const handleRemoveFromCart = (spare_part_id: string) => {
    setCart(cart.filter((c) => c.part.spare_part_id !== spare_part_id));
  };

  const handleQtyChange = (spare_part_id: string, qty: number) => {
    if (qty <= 0) return;
    setCart(
      cart.map((c) => {
        if (c.part.spare_part_id === spare_part_id) {
          if (qty > c.part.qty_on_hand) {
            alert('Kuantitas melebihi sisa stok tersedia');
            return c;
          }
          return { ...c, qty };
        }
        return c;
      })
    );
  };

  const executeSubmit = async (force: boolean = false) => {
    if (cart.length === 0) {
      alert('Pilih minimal 1 suku cadang!');
      return;
    }
    if (!receiverName || !unitNumber || !mechanicName) {
      alert('Mohon lengkapi Nama Pengambil, Identitas Unit, dan Mekanik!');
      return;
    }

    setSubmitting(true);
    setDuplicateWarning(null);

    const payload = {
      warehouse_id: activeWarehouse,
      site_id: siteId,
      receiver_name: receiverName,
      unit_number: unitNumber,
      unit_name: unitName,
      unit_type: unitType,
      ct_number: ctNumber || undefined,
      hm_km: hmKm,
      mechanic_name: mechanicName,
      work_order_number: workOrder || undefined,
      maintenance_type: maintenanceType,
      notes: notes || undefined,
      items: cart.map((c) => ({
        spare_part_id: c.part.spare_part_id,
        qty: c.qty,
        unit_of_measure: c.part.unit_of_measure,
      })),
    };

    try {
      const res = await issueApi.createIssue(payload, force);
      if (res.duplicate_warning) {
        setDuplicateWarning(res.message || 'Peringatan duplikasi pengambilan suku cadang!');
        return;
      }

      setSuccessReceipt({
        ...res,
        ...payload,
        date: new Date().toLocaleString('id-ID'),
        warehouse_name: activeWarehouseInfo?.name,
      });

      // Reset form
      setCart([]);
      setReceiverName('');
      setSelectedUnitId('');
      setUnitNumber('');
      setUnitName('');
      setCtNumber('');
      setHmKm(undefined);
      setWorkOrder('');
      setNotes('');

      // Refresh stock
      const freshStocks = await inventoryApi.getStock(activeWarehouse);
      setAvailableStock(freshStocks);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal memproses pengeluaran');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredParts = availableStock.filter(
    (p) =>
      p.spare_part_id.toLowerCase().includes(searchPart.toLowerCase()) ||
      p.part_name.toLowerCase().includes(searchPart.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass-panel rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-cyan-400" />
            POS Pengeluaran Spare Part (Full Traceability)
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Setiap pengeluaran wajib mencatat identitas unit, mekanik, pengambil, dan site kerja.
          </p>
        </div>
        <div className="text-xs text-right">
          <span className="text-slate-400">Gudang Aktif:</span>
          <span className="ml-2 font-mono font-bold text-cyan-300">{activeWarehouseInfo?.name}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Spare Part Catalog (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-panel rounded-2xl p-4 border border-slate-800">
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Scan barcode atau cari part number / nama suku cadang..."
                value={searchPart}
                onChange={(e) => setSearchPart(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900/90 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
              {filteredParts.map((item) => {
                const inCart = cart.find((c) => c.part.spare_part_id === item.spare_part_id);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleAddToCart(item)}
                    className="glass-card glass-card-hover rounded-xl p-3 border border-slate-800 cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-mono text-xs font-bold text-cyan-300">
                          {item.spare_part_id}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                            item.status === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-400'
                              : item.status === 'WARNING'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          {item.qty_on_hand} {item.unit_of_measure}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-200 line-clamp-2">{item.part_name}</p>
                      <p className="text-[10px] text-slate-500 mt-1">{item.rack_location || 'Rak -'}</p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                      {item.requires_issue_approval ? (
                        <span className="text-rose-400 font-semibold text-[10px]">Wajib Approval</span>
                      ) : (
                        <span className="text-slate-500 text-[10px]">Langsung Release</span>
                      )}
                      <button className="flex items-center gap-1 text-cyan-400 font-semibold hover:text-cyan-300">
                        <Plus className="w-3.5 h-3.5" />
                        <span>{inCart ? `+1 (${inCart.qty})` : 'Pilih'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Cart & Traceability Form (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center justify-between">
              <span>Item Dipilih ({cart.length})</span>
              {cart.length > 0 && (
                <button
                  onClick={() => setCart([])}
                  className="text-[11px] text-rose-400 hover:text-rose-300 font-normal"
                >
                  Kosongkan Keranjang
                </button>
              )}
            </h3>

            {cart.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                Belum ada suku cadang yang dipilih.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={item.part.spare_part_id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-mono font-bold text-cyan-300 text-[11px]">
                        {item.part.spare_part_id}
                      </p>
                      <p className="text-[11px] text-slate-300 truncate">{item.part.part_name}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        type="number"
                        min={1}
                        max={item.part.qty_on_hand}
                        value={item.qty}
                        onChange={(e) => handleQtyChange(item.part.spare_part_id, Number(e.target.value))}
                        className="w-14 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-center text-xs text-white font-mono"
                      />
                      <span className="text-[10px] text-slate-400">{item.part.unit_of_measure}</span>
                      <button
                        onClick={() => handleRemoveFromCart(item.part.spare_part_id)}
                        className="text-rose-400 hover:text-rose-300 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <hr className="border-slate-800" />

            {/* Traceability Form */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                Informasi Penggunaan Akhir (Traceability)
              </h4>

              {/* Site Selection */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Site Pengguna *</label>
                <select
                  value={siteId}
                  onChange={(e) => setSiteId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                >
                  {siteList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Receiver Name */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Nama Pengambil Barang *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Ahmad Dani"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white"
                />
              </div>

              {/* Unit Equipment Selection */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Pilih Unit Equipment *</label>
                <select
                  value={selectedUnitId}
                  onChange={(e) => handleSelectEquipment(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                >
                  <option value="">-- Pilih Unit Terdaftar --</option>
                  {equipmentList.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.unit_number} - {eq.name} ({eq.equipment_type_id})
                    </option>
                  ))}
                </select>
              </div>

              {/* Unit Details Auto-filled */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] text-slate-500">Nomor Lambung</label>
                  <input
                    type="text"
                    value={unitNumber}
                    onChange={(e) => setUnitNumber(e.target.value)}
                    className="w-full px-2 py-1 text-xs bg-slate-900/60 border border-slate-800 rounded font-mono text-cyan-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500">HM / KM Unit</label>
                  <input
                    type="number"
                    value={hmKm || ''}
                    onChange={(e) => setHmKm(Number(e.target.value))}
                    placeholder="Contoh: 14250"
                    className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-white font-mono"
                  />
                </div>
              </div>

              {/* Mechanic Selection */}
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Mekanik Penanggung Jawab *</label>
                <select
                  value={mechanicName}
                  onChange={(e) => setMechanicName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200"
                >
                  <option value="">-- Pilih Mekanik --</option>
                  {mechanicList.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name} ({m.position})
                    </option>
                  ))}
                </select>
              </div>

              {/* Work Order & Maintenance Type */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] text-slate-500">Work Order (WO)</label>
                  <input
                    type="text"
                    placeholder="WO-2026-001"
                    value={workOrder}
                    onChange={(e) => setWorkOrder(e.target.value)}
                    className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500">Tipe Maintenance</label>
                  <select
                    value={maintenanceType}
                    onChange={(e) => setMaintenanceType(e.target.value)}
                    className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200"
                  >
                    <option value="PREVENTIVE">Preventive</option>
                    <option value="CORRECTIVE">Corrective</option>
                    <option value="BREAKDOWN">Breakdown Urgent</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] text-slate-500">Catatan Pekerjaan</label>
                <input
                  type="text"
                  placeholder="Keterangan keluhan/servis..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-white"
                />
              </div>

              <button
                type="button"
                onClick={() => executeSubmit(false)}
                disabled={submitting || cart.length === 0}
                className="w-full mt-3 py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
              >
                {submitting ? 'Memproses Transaksi...' : 'Konfirmasi & Potong Stok'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Duplicate Warning Dialog */}
      {duplicateWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-amber-600/60 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold text-white">Konfirmasi Duplikasi Pengambilan</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{duplicateWarning}</p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDuplicateWarning(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
              >
                Batalkan
              </button>
              <button
                onClick={() => executeSubmit(true)}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-bold text-slate-950"
              >
                Tetap Lanjutkan Transaksi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Struk Sukses Modal */}
      {successReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-emerald-500/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">Transaksi Pengeluaran Berhasil</h3>
              </div>
              <button
                onClick={() => setSuccessReceipt(null)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-xs space-y-2">
              <div className="flex justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">No Transaksi:</span>
                <span className="font-bold text-cyan-300">{successReceipt.transaction_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Waktu:</span>
                <span className="text-slate-200">{successReceipt.date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Gudang:</span>
                <span className="text-slate-200">{successReceipt.warehouse_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Unit:</span>
                <span className="text-slate-200">{successReceipt.unit_number} ({successReceipt.unit_name})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Mekanik:</span>
                <span className="text-slate-200">{successReceipt.mechanic_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Pengambil:</span>
                <span className="text-slate-200">{successReceipt.receiver_name}</span>
              </div>

              <div className="border-t border-slate-800 pt-2 mt-2">
                <div className="text-slate-400 mb-1">Daftar Suku Cadang:</div>
                {successReceipt.items.map((it: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-slate-300">
                    <span>{it.spare_part_id}</span>
                    <span>{it.qty} {it.unit_of_measure}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-cyan-300"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Bukti</span>
              </button>
              <button
                onClick={() => setSuccessReceipt(null)}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-slate-950"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
