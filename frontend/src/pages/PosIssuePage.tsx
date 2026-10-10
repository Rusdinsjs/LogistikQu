import React, { useEffect, useState, useRef } from 'react';
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
  LayoutGrid,
  List,
  Camera,
  FileText,
  Upload,
  X,
  RotateCcw,
  UserPlus,
  Truck,
} from 'lucide-react';

export const PosIssuePage: React.FC = () => {
  const { activeWarehouse, activeWarehouseInfo } = useAuth();

  // Master data
  const [availableStock, setAvailableStock] = useState<InventoryStockItem[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [mechanicList, setMechanicList] = useState<Employee[]>([]);
  const [siteList, setSiteList] = useState<Site[]>([]);
  const [searchPart, setSearchPart] = useState('');

  // View Mode: 'kanban' | 'list'
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

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
  const [unitType, setUnitType] = useState('HEAVY_EQUIPMENT');
  const [ctNumber, setCtNumber] = useState('');
  const [hmKm, setHmKm] = useState<number | undefined>(undefined);
  const [mechanicName, setMechanicName] = useState('');
  const [workOrder, setWorkOrder] = useState('');
  const [maintenanceType, setMaintenanceType] = useState('PREVENTIVE');
  const [notes, setNotes] = useState('');

  // Attachments
  const [evidencePhotoUrl, setEvidencePhotoUrl] = useState<string | null>(null);
  const [documentUrl, setDocumentUrl] = useState<string | null>(null);
  const [documentFileName, setDocumentFileName] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  // Quick Add Modals
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [newUnitNumber, setNewUnitNumber] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitType, setNewUnitType] = useState('HEAVY_EQUIPMENT');
  const [newUnitSerial, setNewUnitSerial] = useState('');
  const [newUnitHmKm, setNewUnitHmKm] = useState<number | undefined>(undefined);
  const [savingUnit, setSavingUnit] = useState(false);

  const [showAddMechanicModal, setShowAddMechanicModal] = useState(false);
  const [newMechanicName, setNewMechanicName] = useState('');
  const [newMechanicPosition, setNewMechanicPosition] = useState('Mekanik Alat Berat');
  const [savingMechanic, setSavingMechanic] = useState(false);

  // UI States
  const [submitting, setSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<any | null>(null);
  const [previewPhotoModal, setPreviewPhotoModal] = useState<string | null>(null);

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
      setHmKm(eq.current_hm_km ? Number(eq.current_hm_km) : undefined);
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

  // Image Upload with Canvas compression
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
        setEvidencePhotoUrl(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Document Upload
  const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran file dokumen maksimal 5 MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setDocumentUrl(ev.target?.result as string);
      setDocumentFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  // Quick Add Unit Equipment
  const handleQuickAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitNumber.trim() || !newUnitName.trim()) {
      alert('Nomor Lambung dan Nama Unit wajib diisi!');
      return;
    }

    setSavingUnit(true);
    try {
      const created = await masterApi.createEquipment({
        unit_number: newUnitNumber.trim().toUpperCase(),
        name: newUnitName.trim(),
        equipment_type_id: newUnitType,
        serial_number: newUnitSerial.trim() || undefined,
        current_hm_km: newUnitHmKm,
      });

      const newEquipment: Equipment = {
        id: created.equipment_id,
        unit_number: newUnitNumber.trim().toUpperCase(),
        name: newUnitName.trim(),
        equipment_type_id: newUnitType,
        serial_number: newUnitSerial.trim() || undefined,
        current_hm_km: newUnitHmKm ?? 0,
        is_active: true,
      };

      setEquipmentList([newEquipment, ...equipmentList]);
      setSelectedUnitId(created.equipment_id);
      setUnitNumber(newEquipment.unit_number);
      setUnitName(newEquipment.name);
      setUnitType(newEquipment.equipment_type_id || 'HEAVY_EQUIPMENT');
      setHmKm(newUnitHmKm);

      // Reset modal fields
      setNewUnitNumber('');
      setNewUnitName('');
      setNewUnitSerial('');
      setNewUnitHmKm(undefined);
      setShowAddUnitModal(false);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal menambahkan unit equipment');
    } finally {
      setSavingUnit(false);
    }
  };

  // Quick Add Mechanic
  const handleQuickAddMechanic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMechanicName.trim()) {
      alert('Nama mekanik wajib diisi!');
      return;
    }

    setSavingMechanic(true);
    try {
      const created = await masterApi.createEmployee({
        name: newMechanicName.trim(),
        position: newMechanicPosition.trim() || 'Mekanik',
        is_mechanic: true,
      });

      const newEmp: Employee = {
        id: created.employee_id,
        name: newMechanicName.trim(),
        position: newMechanicPosition.trim() || 'Mekanik',
        is_mechanic: true,
        is_active: true,
      };

      setMechanicList([newEmp, ...mechanicList]);
      setMechanicName(newEmp.name);

      setNewMechanicName('');
      setShowAddMechanicModal(false);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal menambahkan mekanik');
    } finally {
      setSavingMechanic(false);
    }
  };

  // Check if cart contains parts requiring core return
  const hasCoreReturnItems = cart.some((c) => c.part.requires_core_return);

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
      evidence_photo_url: evidencePhotoUrl || undefined,
      document_url: documentUrl || undefined,
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
        has_core_return: hasCoreReturnItems,
        evidence_photo_url: evidencePhotoUrl,
        document_file_name: documentFileName,
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
      setEvidencePhotoUrl(null);
      setDocumentUrl(null);
      setDocumentFileName(null);

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
            Setiap pengeluaran mencatat unit alat berat, mekanik, bukti foto fisik & dokumen pengajuan, serta pelacakan retur suku cadang bekas.
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
          <div className="glass-panel rounded-2xl p-4 border border-slate-800 space-y-3">
            {/* Search and View Mode Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Scan barcode atau cari part number / nama suku cadang..."
                  value={searchPart}
                  onChange={(e) => setSearchPart(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-900/90 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              {/* Toggle Kanban vs List */}
              <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 shrink-0 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={() => setViewMode('kanban')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    viewMode === 'kanban'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Tampilan Kartu Kanban Grid"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Kanban</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    viewMode === 'list'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Tampilan Tabel List Ringkas"
                >
                  <List className="w-3.5 h-3.5" />
                  <span>List</span>
                </button>
              </div>
            </div>

            {/* Catalog Content: Kanban View vs List View */}
            {viewMode === 'kanban' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[540px] overflow-y-auto pr-1">
                {filteredParts.length === 0 ? (
                  <div className="col-span-2 py-12 text-center text-slate-500 text-xs">
                    Tidak ada suku cadang yang sesuai pencarian.
                  </div>
                ) : (
                  filteredParts.map((item) => {
                    const inCart = cart.find((c) => c.part.spare_part_id === item.spare_part_id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => handleAddToCart(item)}
                        className="glass-card glass-card-hover rounded-xl p-3 border border-slate-800 cursor-pointer flex flex-col justify-between transition-all hover:border-cyan-500/40"
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
                          <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                            <span>{item.rack_location || 'Rak -'}</span>
                            {item.brand && <span>{item.brand}</span>}
                          </div>
                        </div>

                        <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-1">
                            {item.requires_core_return ? (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                <RotateCcw className="w-2.5 h-2.5" /> Wajib Retur Bekas
                              </span>
                            ) : (
                              <span className="text-[9px] text-slate-500">Non-Retur</span>
                            )}

                            {item.requires_issue_approval && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                Wajib Approval
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-end text-[11px] pt-1">
                            <button
                              type="button"
                              className="flex items-center gap-1 text-cyan-400 font-semibold hover:text-cyan-300"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>{inCart ? `+1 (${inCart.qty})` : 'Pilih'}</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              /* List Table View */
              <div className="max-h-[540px] overflow-y-auto border border-slate-800/80 rounded-xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/90 text-slate-400 sticky top-0 border-b border-slate-800 text-[11px]">
                    <tr>
                      <th className="py-2.5 px-3">Part Number</th>
                      <th className="py-2.5 px-3">Nama Suku Cadang</th>
                      <th className="py-2.5 px-3">Rak</th>
                      <th className="py-2.5 px-3">Sisa Stok</th>
                      <th className="py-2.5 px-3">Ketentuan</th>
                      <th className="py-2.5 px-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredParts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-slate-500">
                          Tidak ada suku cadang yang sesuai pencarian.
                        </td>
                      </tr>
                    ) : (
                      filteredParts.map((item) => {
                        const inCart = cart.find((c) => c.part.spare_part_id === item.spare_part_id);
                        return (
                          <tr
                            key={item.id}
                            onClick={() => handleAddToCart(item)}
                            className="hover:bg-slate-800/40 cursor-pointer transition-colors"
                          >
                            <td className="py-2 px-3 font-mono font-bold text-cyan-300">
                              {item.spare_part_id}
                            </td>
                            <td className="py-2 px-3 text-slate-200 font-medium">
                              {item.part_name}
                            </td>
                            <td className="py-2 px-3 text-slate-400 text-[11px]">
                              {item.rack_location || '-'}
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                                  item.status === 'CRITICAL'
                                    ? 'bg-rose-500/20 text-rose-400'
                                    : item.status === 'WARNING'
                                    ? 'bg-amber-500/20 text-amber-400'
                                    : 'bg-emerald-500/20 text-emerald-400'
                                }`}
                              >
                                {item.qty_on_hand} {item.unit_of_measure}
                              </span>
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex flex-wrap items-center gap-1">
                                {item.requires_core_return && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-0.5">
                                    <RotateCcw className="w-2.5 h-2.5" /> Retur Bekas
                                  </span>
                                )}
                                {item.requires_issue_approval && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                    Approval
                                  </span>
                                )}
                                {!item.requires_core_return && !item.requires_issue_approval && (
                                  <span className="text-[10px] text-slate-500">Standar</span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-3 text-right">
                              <button
                                type="button"
                                className="px-2 py-1 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold text-[11px] inline-flex items-center gap-1"
                              >
                                <Plus className="w-3 h-3" />
                                <span>{inCart ? `+1 (${inCart.qty})` : 'Pilih'}</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Cart, Traceability Form, and Attachments (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center justify-between">
              <span>Item Dipilih ({cart.length})</span>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCart([])}
                  className="text-[11px] text-rose-400 hover:text-rose-300 font-normal"
                >
                  Kosongkan Keranjang
                </button>
              )}
            </h3>

            {cart.length === 0 ? (
              <div className="py-6 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                Belum ada suku cadang yang dipilih dari katalog.
              </div>
            ) : (
              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={item.part.spare_part_id}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-xs"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-cyan-300 text-[11px]">
                          {item.part.spare_part_id}
                        </span>
                        {item.part.requires_core_return && (
                          <span className="text-[8px] font-bold px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Wajib Retur
                          </span>
                        )}
                      </div>
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
                        type="button"
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

            {/* Core Return Warning Banner if applicable */}
            {hasCoreReturnItems && (
              <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2.5">
                <RotateCcw className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                <div>
                  <p className="font-bold">Wajib Pengembalian Suku Cadang Bekas (Core Return)</p>
                  <p className="text-[11px] text-amber-200/80 mt-0.5 leading-relaxed">
                    Sistem akan otomatis menerbitkan Dokumen Pelacakan Retur Part Bekas. Penanggung jawab awal fisik adalah Mekanik ({mechanicName || 'Harap Pilih Mekanik'}).
                  </p>
                </div>
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
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-cyan-500 focus:outline-none"
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
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              {/* Unit Equipment Selection & Quick Add */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] text-slate-400">Pilih Unit Equipment *</label>
                  <button
                    type="button"
                    onClick={() => setShowAddUnitModal(true)}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tambah Unit Baru</span>
                  </button>
                </div>
                <select
                  value={selectedUnitId}
                  onChange={(e) => handleSelectEquipment(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="">-- Pilih Unit Terdaftar --</option>
                  {equipmentList.map((eq) => (
                    <option key={eq.id} value={eq.id}>
                      {eq.unit_number} - {eq.name} ({eq.equipment_type_id || 'UNIT'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Unit Details Auto-filled */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Nomor Lambung</label>
                  <input
                    type="text"
                    value={unitNumber}
                    onChange={(e) => setUnitNumber(e.target.value)}
                    className="w-full px-2 py-1 text-xs bg-slate-900/60 border border-slate-800 rounded font-mono text-cyan-300"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">HM / KM Unit</label>
                  <input
                    type="number"
                    value={hmKm || ''}
                    onChange={(e) => setHmKm(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="Contoh: 14250"
                    className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-white font-mono"
                  />
                </div>
              </div>

              {/* Mechanic Selection & Quick Add */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] text-slate-400">Mekanik Penanggung Jawab *</label>
                  <button
                    type="button"
                    onClick={() => setShowAddMechanicModal(true)}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Tambah Mekanik Baru</span>
                  </button>
                </div>
                <select
                  value={mechanicName}
                  onChange={(e) => setMechanicName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-cyan-500 focus:outline-none"
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
                  <label className="block text-[10px] text-slate-500 mb-0.5">Work Order (WO)</label>
                  <input
                    type="text"
                    placeholder="WO-2026-001"
                    value={workOrder}
                    onChange={(e) => setWorkOrder(e.target.value)}
                    className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Tipe Maintenance</label>
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

              {/* Catatan Pekerjaan */}
              <div>
                <label className="block text-[10px] text-slate-500 mb-0.5">Catatan Pekerjaan</label>
                <input
                  type="text"
                  placeholder="Keterangan keluhan/servis..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-white"
                />
              </div>

              <hr className="border-slate-800" />

              {/* Attachments Section: Foto Bukti Fisik & Dokumen Pengajuan */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Lampiran & Bukti Fisik (Opsional)</span>
                </h4>

                {/* Foto Bukti Fisik (Kamera Ponsel / File Laptop) */}
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    Foto Bukti Fisik Pengambilan / Kondisi Part
                  </label>
                  <input
                    type="file"
                    ref={photoInputRef}
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                  {evidencePhotoUrl ? (
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="flex items-center gap-2">
                        <img
                          src={evidencePhotoUrl}
                          alt="Bukti Pengambilan"
                          className="w-10 h-10 object-cover rounded border border-slate-700 cursor-pointer"
                          onClick={() => setPreviewPhotoModal(evidencePhotoUrl)}
                        />
                        <div className="text-[11px]">
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" /> Foto Terlampir
                          </span>
                          <button
                            type="button"
                            onClick={() => setPreviewPhotoModal(evidencePhotoUrl)}
                            className="text-cyan-400 hover:underline text-[10px] block"
                          >
                            Lihat Foto Penuh
                          </button>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setEvidencePhotoUrl(null);
                          if (photoInputRef.current) photoInputRef.current.value = '';
                        }}
                        className="text-rose-400 hover:text-rose-300 p-1"
                        title="Hapus Foto"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="w-full py-2 px-3 rounded-lg border border-dashed border-slate-700 hover:border-cyan-500 bg-slate-900/60 text-slate-300 text-xs flex items-center justify-center gap-2 transition-colors"
                    >
                      <Camera className="w-4 h-4 text-cyan-400" />
                      <span>Ambil Foto / Upload Gambar</span>
                    </button>
                  )}
                </div>

                {/* Dokumen Pengajuan (SPK / WO Scan / PDF) */}
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">
                    Dokumen Pengajuan (SPK / WO / Formulir Permintaan)
                  </label>
                  <input
                    type="file"
                    ref={docInputRef}
                    accept=".pdf,.doc,.docx,image/*"
                    onChange={handleDocumentSelect}
                    className="hidden"
                  />
                  {documentUrl ? (
                    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-5 h-5 text-cyan-400 shrink-0" />
                        <span className="text-xs text-slate-200 truncate">
                          {documentFileName || 'Dokumen Terlampir'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setDocumentUrl(null);
                          setDocumentFileName(null);
                          if (docInputRef.current) docInputRef.current.value = '';
                        }}
                        className="text-rose-400 hover:text-rose-300 p-1 shrink-0"
                        title="Hapus Dokumen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => docInputRef.current?.click()}
                      className="w-full py-2 px-3 rounded-lg border border-dashed border-slate-700 hover:border-cyan-500 bg-slate-900/60 text-slate-300 text-xs flex items-center justify-center gap-2 transition-colors"
                    >
                      <FileText className="w-4 h-4 text-cyan-400" />
                      <span>Lampirkan Dokumen SPK / Formulir (PDF / Foto)</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={() => executeSubmit(false)}
                disabled={submitting || cart.length === 0}
                className="w-full mt-4 py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
              >
                {submitting ? 'Memproses Transaksi...' : 'Konfirmasi & Potong Stok'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Add Unit Equipment Modal */}
      {showAddUnitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-cyan-500/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-cyan-400">
                <Truck className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">Tambah Unit Equipment Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUnitModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAddUnit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Nomor Lambung *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: DT-214 atau EX-108"
                  value={newUnitNumber}
                  onChange={(e) => setNewUnitNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono uppercase focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Nama / Tipe Unit *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Dump Truck Hino 500 FM 260 Ti"
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Kategori Alat</label>
                  <select
                    value={newUnitType}
                    onChange={(e) => setNewUnitType(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="HEAVY_EQUIPMENT">Heavy Equipment</option>
                    <option value="DUMP_TRUCK">Dump Truck</option>
                    <option value="EXCAVATOR">Excavator</option>
                    <option value="DOZER">Bulldozer</option>
                    <option value="LIGHT_VEHICLE">Light Vehicle</option>
                    <option value="SUPPORT_EQUIPMENT">Support Equipment</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">HM / KM Awal</label>
                  <input
                    type="number"
                    placeholder="Contoh: 12500"
                    value={newUnitHmKm || ''}
                    onChange={(e) => setNewUnitHmKm(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Serial Number (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: SN-HN500-9841"
                  value={newUnitSerial}
                  onChange={(e) => setNewUnitSerial(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddUnitModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingUnit}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold disabled:opacity-50"
                >
                  {savingUnit ? 'Menyimpan...' : 'Simpan & Pilih Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Mechanic Modal */}
      {showAddMechanicModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-cyan-500/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-cyan-400">
                <UserPlus className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">Tambah Mekanik Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddMechanicModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAddMechanic} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Nama Lengkap Mekanik *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Bambang Sugiharto"
                  value={newMechanicName}
                  onChange={(e) => setNewMechanicName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Posisi / Spesialisasi</label>
                <input
                  type="text"
                  placeholder="Contoh: Senior Heavy Equipment Mechanic"
                  value={newMechanicPosition}
                  onChange={(e) => setNewMechanicPosition(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddMechanicModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingMechanic}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold disabled:opacity-50"
                >
                  {savingMechanic ? 'Menyimpan...' : 'Simpan & Pilih Mekanik'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                type="button"
                onClick={() => setDuplicateWarning(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
              >
                Batalkan
              </button>
              <button
                type="button"
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
                type="button"
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

              {successReceipt.has_core_return && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-2 rounded text-amber-300 text-[11px] font-sans">
                  <span className="font-bold flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" /> Wajib Retur Part Bekas Aktif
                  </span>
                  Part bekas dicatat di pelacakan retur dengan penanggung jawab awal Mekanik ({successReceipt.mechanic_name}).
                </div>
              )}

              {successReceipt.evidence_photo_url && (
                <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                  <span className="text-slate-400 text-[10px]">Bukti Fisik:</span>
                  <img
                    src={successReceipt.evidence_photo_url}
                    alt="Bukti Pengambilan"
                    className="w-8 h-8 object-cover rounded border border-slate-700"
                  />
                  <span className="text-emerald-400 text-[10px]">Tersimpan</span>
                </div>
              )}

              {successReceipt.document_file_name && (
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-slate-400">Dokumen SPK:</span>
                  <span className="text-cyan-300">{successReceipt.document_file_name}</span>
                </div>
              )}

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
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-cyan-300"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Bukti</span>
              </button>
              <button
                type="button"
                onClick={() => setSuccessReceipt(null)}
                className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-slate-950"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Photo Preview Modal */}
      {previewPhotoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
          onClick={() => setPreviewPhotoModal(null)}
        >
          <div className="relative max-w-2xl max-h-[85vh] p-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewPhotoModal(null)}
              className="absolute -top-3 -right-3 p-1.5 bg-slate-800 text-white rounded-full hover:bg-slate-700 shadow-lg"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={previewPhotoModal}
              alt="Bukti Foto Penuh"
              className="rounded-xl max-w-full max-h-[80vh] object-contain border border-slate-700 shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
