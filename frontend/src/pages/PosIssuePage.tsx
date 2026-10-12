import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { inventoryApi, issueApi, masterApi } from '../api';
import type { Employee, Equipment, InventoryStockItem, Site } from '../types';
import { SignaturePad } from '../components/common';
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
  PenTool,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';

import {
  isDumpTruckEquipment,
  isHeavyEquipment,
  isDumpTruckMechanic,
  isHeavyEquipmentMechanic,
  getWarehouseCategory,
  getUserFleetCategory,
} from '../utils/fleetCategory';
export {
  isDumpTruckEquipment,
  isHeavyEquipment,
  isDumpTruckMechanic,
  isHeavyEquipmentMechanic,
  getWarehouseCategory,
  getUserFleetCategory,
};

export const PosIssuePage: React.FC = () => {
  const { activeWarehouse, activeWarehouseInfo, user } = useAuth();
  const canCreateIssue = user?.role_id === 'SUPER_ADMIN' || user?.permissions.includes('issue.create');

  // Master data
  const [availableStock, setAvailableStock] = useState<InventoryStockItem[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [mechanicList, setMechanicList] = useState<Employee[]>([]);
  const [siteList, setSiteList] = useState<Site[]>([]);
  const [searchPart, setSearchPart] = useState('');

  // Fleet Category Filter (HE vs DT vs ALL)
  const userDivision = getUserFleetCategory(user);
  const warehouseCategory =
    userDivision !== 'ALL'
      ? userDivision
      : getWarehouseCategory(activeWarehouse, activeWarehouseInfo?.category);
  const [fleetCategoryFilter, setFleetCategoryFilter] = useState<'HE' | 'DT' | 'ALL'>(warehouseCategory);

  // Auto-sync category filter when warehouse or user changes
  useEffect(() => {
    const targetCat =
      userDivision !== 'ALL'
        ? userDivision
        : getWarehouseCategory(activeWarehouse, activeWarehouseInfo?.category);
    setFleetCategoryFilter(targetCat);
  }, [activeWarehouse, activeWarehouseInfo?.category, userDivision]);

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

  // Mechanic Signature & Verification
  const [signatureType, setSignatureType] = useState<'DIGITAL' | 'PHYSICAL'>('DIGITAL');
  const [mechanicSignatureUrl, setMechanicSignatureUrl] = useState<string | null>(null);
  const [physicalSignConfirmed, setPhysicalSignConfirmed] = useState(false);
  const [signedReceiptPhotoUrl, setSignedReceiptPhotoUrl] = useState<string | null>(null);
  const signedReceiptPhotoInputRef = useRef<HTMLInputElement>(null);
  const [showUnprintedWarning, setShowUnprintedWarning] = useState(false);

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

  // Handle category filter change with auto-clearing incompatible selection
  const handleCategoryFilterChange = (newCat: 'HE' | 'DT' | 'ALL') => {
    setFleetCategoryFilter(newCat);
    if (selectedUnitId) {
      const currentEq = equipmentList.find((e) => e.id === selectedUnitId);
      if (currentEq) {
        const isDt = isDumpTruckEquipment(currentEq);
        if (newCat === 'HE' && isDt) {
          setSelectedUnitId('');
          setUnitNumber('');
          setUnitName('');
          setCtNumber('');
          setHmKm(undefined);
        } else if (newCat === 'DT' && !isDt) {
          setSelectedUnitId('');
          setUnitNumber('');
          setUnitName('');
          setCtNumber('');
          setHmKm(undefined);
        }
      }
    }
    if (mechanicName) {
      const currentM = mechanicList.find((m) => m.name === mechanicName);
      if (currentM) {
        const isDt = isDumpTruckMechanic(currentM);
        if (newCat === 'HE' && isDt) {
          setMechanicName('');
        } else if (newCat === 'DT' && !isDt) {
          setMechanicName('');
        }
      }
    }
  };

  // Filtered Equipment & Mechanic based on HE/DT filter
  const filteredEquipmentList = useMemo(() => {
    if (fleetCategoryFilter === 'DT') {
      return equipmentList.filter(isDumpTruckEquipment);
    }
    if (fleetCategoryFilter === 'HE') {
      return equipmentList.filter((eq) => isHeavyEquipment(eq) || !isDumpTruckEquipment(eq));
    }
    return equipmentList;
  }, [equipmentList, fleetCategoryFilter]);

  const filteredMechanicList = useMemo(() => {
    if (fleetCategoryFilter === 'DT') {
      return mechanicList.filter(isDumpTruckMechanic);
    }
    if (fleetCategoryFilter === 'HE') {
      return mechanicList.filter((m) => isHeavyEquipmentMechanic(m) || !isDumpTruckMechanic(m));
    }
    return mechanicList;
  }, [mechanicList, fleetCategoryFilter]);

  const heEquipmentCount = useMemo(
    () => equipmentList.filter((eq) => isHeavyEquipment(eq) || !isDumpTruckEquipment(eq)).length,
    [equipmentList]
  );
  const dtEquipmentCount = useMemo(
    () => equipmentList.filter(isDumpTruckEquipment).length,
    [equipmentList]
  );

  // Handle modal openers with smart pre-selection
  const handleOpenAddUnitModal = () => {
    if (fleetCategoryFilter === 'DT') {
      setNewUnitType('DUMP_TRUCK');
    } else {
      setNewUnitType('HEAVY_EQUIPMENT');
    }
    setShowAddUnitModal(true);
  };

  const handleOpenAddMechanicModal = () => {
    if (fleetCategoryFilter === 'DT') {
      setNewMechanicPosition('Dump Truck Senior Mechanic');
    } else {
      setNewMechanicPosition('Senior Heavy Equipment Mechanic');
    }
    setShowAddMechanicModal(true);
  };

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

      const eqId = (created as any).id || (created as any).equipment_id || newUnitNumber.trim().toUpperCase();
      const newEquipment: Equipment = {
        id: eqId,
        unit_number: newUnitNumber.trim().toUpperCase(),
        name: newUnitName.trim(),
        equipment_type_id: newUnitType,
        serial_number: newUnitSerial.trim() || undefined,
        current_hm_km: newUnitHmKm ?? 0,
        is_active: true,
      };

      setEquipmentList([newEquipment, ...equipmentList]);
      setSelectedUnitId(eqId);
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
      const targetDept = fleetCategoryFilter === 'DT' ? 'DEPT-MECH-DT' : 'DEPT-MECH-HE';
      const targetPos =
        newMechanicPosition.trim() ||
        (fleetCategoryFilter === 'DT' ? 'Dump Truck Senior Mechanic' : 'Senior Heavy Equipment Mechanic');

      const created = await masterApi.createEmployee({
        name: newMechanicName.trim(),
        department_id: targetDept,
        position: targetPos,
        is_mechanic: true,
      });

      const empId = (created as any).id || (created as any).employee_id || `EMP-${newMechanicName.trim()}`;
      const newEmp: Employee = {
        id: empId,
        name: newMechanicName.trim(),
        department_id: targetDept,
        position: targetPos,
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

    if (signatureType === 'DIGITAL' && !mechanicSignatureUrl) {
      alert(`SOP Wajib: Mekanik penanggung jawab (${mechanicName}) wajib membubuhkan tanda tangan digital di layar terlebih dahulu!`);
      return;
    }

    if (signatureType === 'PHYSICAL' && !physicalSignConfirmed) {
      alert(`SOP Wajib: Harap centang konfirmasi bahwa struk fisik wajib dicetak dan ditandatangani basah oleh mekanik (${mechanicName})!`);
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
      mechanic_signature_url: mechanicSignatureUrl || undefined,
      signature_type: signatureType,
      receipt_printed: false,
      signed_receipt_photo_url: signedReceiptPhotoUrl || undefined,
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
        signature_type: signatureType,
        mechanic_signature_url: mechanicSignatureUrl,
        has_printed: false,
        date: new Date().toLocaleString('id-ID'),
        warehouse_name: activeWarehouseInfo?.name,
        admin_name: user?.full_name || user?.username,
      });

      // Reset form & signature
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
      setMechanicSignatureUrl(null);
      setPhysicalSignConfirmed(false);
      setSignedReceiptPhotoUrl(null);

      // Refresh stock
      const freshStocks = await inventoryApi.getStock(activeWarehouse);
      setAvailableStock(freshStocks);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal memproses pengeluaran');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintReceipt = async () => {
    if (!successReceipt) return;
    try {
      if (successReceipt.issue_id) {
        await issueApi.recordReceiptPrinted(successReceipt.issue_id, signedReceiptPhotoUrl || undefined);
      }
    } catch (err) {
      console.error('Gagal mencatat status struk dicetak di server', err);
    }
    setSuccessReceipt((prev: any) => (prev ? { ...prev, has_printed: true } : null));
    window.print();
  };

  const handleCloseReceiptModal = () => {
    if (!successReceipt) return;
    if (!successReceipt.has_printed) {
      setShowUnprintedWarning(true);
      return;
    }
    setSuccessReceipt(null);
    setShowUnprintedWarning(false);
  };

  const handleSignedReceiptPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDimension = 1200;
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

        const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
        setSignedReceiptPhotoUrl(dataUrl);
        if (successReceipt?.issue_id) {
          issueApi.recordReceiptPrinted(successReceipt.issue_id, dataUrl).catch(console.error);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
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

              {/* Fleet Category Filter (HE vs DT) */}
              <div className="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800 shadow-inner space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 font-semibold flex items-center gap-1.5">
                    <Truck className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Kategori Armada & Mekanik:</span>
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold border flex items-center gap-1 ${
                      warehouseCategory === 'HE'
                        ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40'
                        : warehouseCategory === 'DT'
                        ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    <span>Divisi:</span>
                    <span>{warehouseCategory === 'HE' ? 'HE (Alat Berat)' : warehouseCategory === 'DT' ? 'DT (Dump Truck)' : 'Semua Armada'}</span>
                  </span>
                </div>

                {userDivision === 'ALL' ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCategoryFilterChange('HE')}
                      className={`px-2 py-1.5 text-xs rounded-lg font-medium transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        fleetCategoryFilter === 'HE'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-sm shadow-cyan-950 font-bold'
                          : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
                      }`}
                    >
                      <span>🚜 HE (Alat Berat)</span>
                      <span className="text-[10px] opacity-75 font-mono">({heEquipmentCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCategoryFilterChange('DT')}
                      className={`px-2 py-1.5 text-xs rounded-lg font-medium transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        fleetCategoryFilter === 'DT'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-sm shadow-amber-950 font-bold'
                          : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
                      }`}
                    >
                      <span>🚚 DT (Dump Truck)</span>
                      <span className="text-[10px] opacity-75 font-mono">({dtEquipmentCount})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCategoryFilterChange('ALL')}
                      className={`px-2 py-1.5 text-xs rounded-lg font-medium transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        fleetCategoryFilter === 'ALL'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50 shadow-sm shadow-purple-950 font-bold'
                          : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700/60'
                      }`}
                    >
                      <span>Semua</span>
                      <span className="text-[10px] opacity-75 font-mono">({equipmentList.length})</span>
                    </button>
                  </div>
                ) : (
                  <div
                    className={`px-3 py-1.5 text-xs rounded-lg font-bold flex items-center justify-between border ${
                      userDivision === 'HE'
                        ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    <span>
                      {userDivision === 'HE'
                        ? '🚜 Khusus Unit & Mekanik Heavy Equipment (HE)'
                        : '🚚 Khusus Unit & Mekanik Dump Truck (DT)'}
                    </span>
                    <span className="text-[10px] font-mono">
                      ({filteredEquipmentList.length} Unit)
                    </span>
                  </div>
                )}
              </div>

              {/* Unit Equipment Selection & Quick Add */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] text-slate-400">
                    Pilih Unit Equipment *{' '}
                    <span className="text-[10px] text-cyan-400 font-mono">
                      ({filteredEquipmentList.length} Unit {fleetCategoryFilter === 'ALL' ? 'Total' : fleetCategoryFilter})
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={handleOpenAddUnitModal}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold cursor-pointer"
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
                  <option value="">
                    -- Pilih Unit Terdaftar ({filteredEquipmentList.length} Unit {fleetCategoryFilter === 'ALL' ? '' : fleetCategoryFilter}) --
                  </option>
                  {filteredEquipmentList.map((eq) => {
                    const cat = isDumpTruckEquipment(eq) ? 'DT' : 'HE';
                    return (
                      <option key={eq.id} value={eq.id}>
                        [{cat}] {eq.unit_number} - {eq.name} ({eq.equipment_type_id || 'UNIT'})
                      </option>
                    );
                  })}
                </select>
                {filteredEquipmentList.length === 0 && (
                  <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Tidak ada unit terdaftar untuk filter {fleetCategoryFilter}. Klik "Tambah Unit Baru" atau pilih "Semua".
                  </p>
                )}
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
                  <label className="block text-[11px] text-slate-400">
                    Mekanik Penanggung Jawab *{' '}
                    <span className="text-[10px] text-cyan-400 font-mono">
                      ({filteredMechanicList.length} Mekanik {fleetCategoryFilter === 'ALL' ? 'Total' : fleetCategoryFilter})
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={handleOpenAddMechanicModal}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold cursor-pointer"
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
                  <option value="">
                    -- Pilih Mekanik ({filteredMechanicList.length} Mekanik {fleetCategoryFilter === 'ALL' ? '' : fleetCategoryFilter}) --
                  </option>
                  {filteredMechanicList.map((m) => {
                    const cat = isDumpTruckMechanic(m) ? 'DT' : 'HE';
                    return (
                      <option key={m.id} value={m.name}>
                        [{cat}] {m.name} ({m.position || (cat === 'DT' ? 'Mekanik Dump Truck' : 'Mekanik Alat Berat')})
                      </option>
                    );
                  })}
                </select>
                {filteredMechanicList.length === 0 && (
                  <p className="text-[10px] text-amber-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Tidak ada mekanik terdaftar untuk filter {fleetCategoryFilter}. Klik "Tambah Mekanik Baru" atau pilih "Semua".
                  </p>
                )}
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

              <hr className="border-slate-800" />

              {/* Section Verifikasi & Tanda Tangan Mekanik (Wajib SOP Serah Terima) */}
              <div className="space-y-2.5 p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80 shadow-inner">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                    <PenTool className="w-3.5 h-3.5" />
                    <span>Tanda Tangan Mekanik (Wajib SOP)</span>
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    SOP Serah Terima
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Admin Container wajib meminta tanda tangan mekanik penanggung jawab{' '}
                  <strong className="text-cyan-300">{mechanicName ? `(${mechanicName})` : '(Pilih Mekanik Terlebih Dahulu)'}</strong>{' '}
                  sebelum spare part diserahkan.
                </p>

                {/* Switcher Mode: Digital Layar vs Fisik di Struk */}
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-950/80 rounded-lg border border-slate-800 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setSignatureType('DIGITAL')}
                    className={`py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                      signatureType === 'DIGITAL'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    <span>Digital di Layar HP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignatureType('PHYSICAL')}
                    className={`py-1.5 px-2 rounded-md flex items-center justify-center gap-1.5 transition-all ${
                      signatureType === 'PHYSICAL'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Basah di Struk Fisik</span>
                  </button>
                </div>

                {signatureType === 'DIGITAL' ? (
                  <div className="mt-2 pt-1">
                    {!mechanicName ? (
                      <div className="p-3 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs text-center flex items-center justify-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>Harap pilih <strong>Mekanik Penanggung Jawab</strong> di atas terlebih dahulu untuk membuka pad tanda tangan digital.</span>
                      </div>
                    ) : (
                      <SignaturePad
                        value={mechanicSignatureUrl}
                        onChange={setMechanicSignatureUrl}
                        signerName={mechanicName}
                        roleLabel="Mekanik Penanggung Jawab"
                      />
                    )}
                  </div>
                ) : (
                  <div className="mt-2 space-y-2.5 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-[11px] leading-relaxed">
                        Mekanik akan membubuhkan tanda tangan basah langsung pada lembar struk cetak fisik.
                        Admin Container <strong>WAJIB mencetak struk fisik</strong> dan memastikan tanda tangan mekanik ({mechanicName || 'Mekanik'}) telah dibubuhkan sebelum barang diserahkan.
                      </p>
                    </div>

                    <label className="flex items-start gap-2 pt-2 border-t border-amber-500/20 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={physicalSignConfirmed}
                        onChange={(e) => setPhysicalSignConfirmed(e.target.checked)}
                        className="mt-0.5 rounded border-amber-500 text-cyan-500 focus:ring-0"
                      />
                      <span className="text-[11px] text-amber-100 font-medium">
                        Saya (Admin Kontainer) menyatakan bahwa struk pengeluaran fisik WAJIB dicetak dan ditandatangani basah oleh Mekanik {mechanicName ? `(${mechanicName})` : ''}.
                      </span>
                    </label>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={() => executeSubmit(false)}
                disabled={submitting || cart.length === 0 || !canCreateIssue}
                className="w-full mt-4 py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all disabled:opacity-50"
              >
                {!canCreateIssue
                  ? 'Tidak Memiliki Izin Input POS'
                  : submitting
                  ? 'Memproses Transaksi...'
                  : 'Konfirmasi & Potong Stok'}
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
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] flex items-center justify-between text-slate-300">
                <span>Filter Aktif Saat Ini:</span>
                <span className="font-semibold text-cyan-300">
                  {fleetCategoryFilter === 'DT' ? 'Dump Truck (DT)' : fleetCategoryFilter === 'HE' ? 'Heavy Equipment (HE)' : 'Umum / Semua'}
                </span>
              </div>

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
                    {fleetCategoryFilter !== 'DT' && (
                      <>
                        <option value="HEAVY_EQUIPMENT">Heavy Equipment</option>
                        <option value="EXCAVATOR">Excavator</option>
                        <option value="DOZER">Bulldozer</option>
                        <option value="LIGHT_VEHICLE">Light Vehicle</option>
                        <option value="SUPPORT_EQUIPMENT">Support Equipment</option>
                      </>
                    )}
                    {fleetCategoryFilter !== 'HE' && (
                      <option value="DUMP_TRUCK">Dump Truck</option>
                    )}
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
              <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] flex items-center justify-between text-slate-300">
                <span>Departemen Penugasan:</span>
                <span className="font-semibold text-cyan-300">
                  {fleetCategoryFilter === 'DT' ? 'Dump Truck (DEPT-MECH-DT)' : 'Heavy Equipment (DEPT-MECH-HE)'}
                </span>
              </div>

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

      {/* Struk Sukses Modal (Store Issue Voucher & Wajib Cetak) */}
      {successReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto">
          <div className="glass-panel w-full max-w-2xl rounded-2xl border border-cyan-500/40 p-4 sm:p-6 shadow-2xl space-y-4 my-auto">
            {/* Header Dialog */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-cyan-400">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Transaksi POS Pengeluaran Berhasil Diproses
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseReceiptModal}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="Tutup dialog"
              >
                ✕
              </button>
            </div>

            {/* SOP Mandatory Notice Banner */}
            <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-amber-300">
                    KETENTUAN SOP: ADMIN CONTAINER WAJIB MENCETAK STRUK
                  </p>
                  <p className="text-[11px] text-amber-200/80 leading-relaxed">
                    Sesuai instruksi operasional, struk pengeluaran fisik wajib dicetak dan ditandatangani mekanik (digital di layar atau basah pada lembar struk) sebagai bukti serah terima sah barang.
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                {successReceipt.has_printed ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 rounded-full">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>SUDAH DICETAK</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-500/20 border border-amber-500/40 px-2.5 py-1 rounded-full animate-pulse">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>BELUM DICETAK (WAJIB)</span>
                  </span>
                )}
              </div>
            </div>

            {/* Area Printable Formal Slip Struk POS */}
            <div
              id="pos-receipt-print-area"
              className="p-4 sm:p-5 rounded-xl bg-white text-slate-900 border border-slate-300 font-sans shadow-md text-xs space-y-3 print:border-none print:shadow-none print:p-0"
            >
              {/* Header KOP Struk */}
              <div className="border-b-2 border-slate-900 pb-2 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-slate-950 uppercase">
                    PT SINERGI JAYA SENTOSA (SJS)
                  </h1>
                  <p className="text-[10px] text-slate-600 font-medium">
                    Sistem Manajemen Logistik Pergudangan Kontainer Tambang (LogistikQu)
                  </p>
                  <p className="text-[9px] text-slate-500 uppercase tracking-wider font-semibold">
                    BUKTI PENGELUARAN BARANG / STORE ISSUE VOUCHER (POS)
                  </p>
                </div>
                <div className="text-right font-mono self-end sm:self-auto">
                  <div className="text-[10px] text-slate-500">NO. TRANSAKSI</div>
                  <div className="text-xs sm:text-sm font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-300">
                    {successReceipt.transaction_number}
                  </div>
                </div>
              </div>

              {/* Metadata 2-Kolom */}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 inline-block w-24">Tanggal / Jam:</span>
                  <span className="font-semibold">{successReceipt.date}</span>
                </div>
                <div>
                  <span className="text-slate-500 inline-block w-24">Gudang / POS:</span>
                  <span className="font-semibold">{successReceipt.warehouse_name} ({successReceipt.warehouse_id})</span>
                </div>
                <div>
                  <span className="text-slate-500 inline-block w-24">Site Tambang:</span>
                  <span className="font-semibold">{successReceipt.site_id}</span>
                </div>
                <div>
                  <span className="text-slate-500 inline-block w-24">Unit Lambung:</span>
                  <span className="font-bold text-slate-950 font-mono">{successReceipt.unit_number} ({successReceipt.unit_name})</span>
                </div>
                <div>
                  <span className="text-slate-500 inline-block w-24">HM / KM Unit:</span>
                  <span className="font-semibold font-mono">{successReceipt.hm_km ? `${successReceipt.hm_km} HM/KM` : '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 inline-block w-24">Tipe Alat:</span>
                  <span className="font-semibold">{successReceipt.unit_type}</span>
                </div>
                <div>
                  <span className="text-slate-500 inline-block w-24">No. Work Order:</span>
                  <span className="font-semibold font-mono">{successReceipt.work_order_number || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-500 inline-block w-24">Tipe Service:</span>
                  <span className="font-semibold">{successReceipt.maintenance_type}</span>
                </div>
                <div>
                  <span className="text-slate-500 inline-block w-24">Penerima Barang:</span>
                  <span className="font-semibold">{successReceipt.receiver_name}</span>
                </div>
                <div>
                  <span className="text-slate-500 inline-block w-24">Mekanik:</span>
                  <span className="font-bold text-slate-950">{successReceipt.mechanic_name}</span>
                </div>
              </div>

              {/* Tabel Suku Cadang */}
              <div>
                <table className="w-full text-left text-[11px] border-collapse border border-slate-300">
                  <thead>
                    <tr className="bg-slate-200 text-slate-800 text-[10px] uppercase">
                      <th className="border border-slate-300 px-2 py-1 text-center w-8">No</th>
                      <th className="border border-slate-300 px-2 py-1">Part Number</th>
                      <th className="border border-slate-300 px-2 py-1">Nama Suku Cadang</th>
                      <th className="border border-slate-300 px-2 py-1 text-right w-16">Jumlah</th>
                      <th className="border border-slate-300 px-2 py-1 text-center w-16">Satuan</th>
                      <th className="border border-slate-300 px-2 py-1 text-center w-28">Ketentuan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {successReceipt.items.map((it: any, idx: number) => {
                      const partObj = availableStock.find((p) => p.spare_part_id === it.spare_part_id);
                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="border border-slate-300 px-2 py-1 text-center font-mono">{idx + 1}</td>
                          <td className="border border-slate-300 px-2 py-1 font-mono font-bold">{it.spare_part_id}</td>
                          <td className="border border-slate-300 px-2 py-1">{partObj?.part_name || it.part_name || '-'}</td>
                          <td className="border border-slate-300 px-2 py-1 text-right font-mono font-bold">{it.qty}</td>
                          <td className="border border-slate-300 px-2 py-1 text-center font-mono text-[10px]">{it.unit_of_measure}</td>
                          <td className="border border-slate-300 px-2 py-1 text-center text-[10px]">
                            {partObj?.requires_core_return || successReceipt.has_core_return ? (
                              <span className="font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                                Wajib Retur Bekas
                              </span>
                            ) : (
                              <span className="text-slate-500">Reguler</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Core Return Alert box on slip */}
              {successReceipt.has_core_return && (
                <div className="p-2 rounded bg-amber-50 border border-amber-300 text-[10px] text-amber-900 leading-snug">
                  <strong>PERINGATAN RETUR CORE PART:</strong> Transaksi ini mengandung suku cadang bernilai tinggi/remanufaktur. Part bekas wajib diserahkan kembali ke Gudang Kontainer maksimal 1x24 jam setelah penggantian selesai. Penanggung jawab fisik awal: <strong>Mekanik ({successReceipt.mechanic_name})</strong>.
                </div>
              )}

              {/* Kolom Tanda Tangan Resmi */}
              <div className="pt-3 border-t-2 border-slate-300">
                <div className="text-[10px] font-bold text-slate-700 mb-2 uppercase text-center tracking-wider">
                  LEMBAR PENGESAHAN & SERAH TERIMA SPARE PART
                </div>
                <div className="grid grid-cols-3 gap-3 text-center text-[11px]">
                  {/* Tanda Tangan 1: Admin Container */}
                  <div className="border border-slate-300 rounded p-2 flex flex-col justify-between h-36 bg-slate-50/50">
                    <div className="font-semibold text-slate-700 text-[10px]">
                      Diserahkan Oleh:
                      <div className="text-[9px] text-slate-500 font-normal">Admin Gudang Kontainer</div>
                    </div>
                    <div className="my-auto py-1">
                      <div className="text-[9px] text-slate-400 font-mono italic">
                        [ Terverifikasi Sistem ]
                      </div>
                    </div>
                    <div className="border-t border-slate-400 pt-1">
                      <div className="font-bold text-slate-900 truncate">
                        ( {user?.full_name || user?.username || 'Admin Kontainer'} )
                      </div>
                      <div className="text-[9px] text-slate-500">Petugas Gudang</div>
                    </div>
                  </div>

                  {/* Tanda Tangan 2: Penerima Barang */}
                  <div className="border border-slate-300 rounded p-2 flex flex-col justify-between h-36 bg-slate-50/50">
                    <div className="font-semibold text-slate-700 text-[10px]">
                      Diterima Oleh:
                      <div className="text-[9px] text-slate-500 font-normal">Pengambil Suku Cadang</div>
                    </div>
                    <div className="my-auto py-1">
                      <div className="w-24 border-b border-dashed border-slate-400 mx-auto"></div>
                    </div>
                    <div className="border-t border-slate-400 pt-1">
                      <div className="font-bold text-slate-900 truncate">
                        ( {successReceipt.receiver_name} )
                      </div>
                      <div className="text-[9px] text-slate-500">Penerima Barang</div>
                    </div>
                  </div>

                  {/* Tanda Tangan 3: Mekanik Penanggung Jawab */}
                  <div className="border-2 border-slate-900 rounded p-2 flex flex-col justify-between h-36 bg-white shadow-sm">
                    <div className="font-bold text-slate-900 text-[10px]">
                      Mekanik Penanggung Jawab:
                      <div className="text-[9px] text-slate-600 font-normal">
                        {successReceipt.signature_type === 'DIGITAL' ? 'Tanda Tangan Digital Layar' : 'Tanda Tangan Basah di Struk'}
                      </div>
                    </div>

                    <div className="my-auto py-0.5 flex flex-col items-center justify-center">
                      {successReceipt.signature_type === 'DIGITAL' && successReceipt.mechanic_signature_url ? (
                        <div className="flex flex-col items-center">
                          <img
                            src={successReceipt.mechanic_signature_url}
                            alt="Tanda Tangan Mekanik"
                            className="max-h-14 max-w-[140px] object-contain"
                          />
                          <span className="text-[8px] font-mono text-emerald-700 font-bold bg-emerald-50 px-1 rounded border border-emerald-300">
                            ✓ VERIFIED DIGITAL SIGN
                          </span>
                        </div>
                      ) : (
                        <div className="w-full">
                          <div className="h-10"></div>
                          <div className="text-[9px] text-slate-400 italic">
                            (Bubuhkan tanda tangan basah di sini)
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-slate-900 pt-1">
                      <div className="font-bold text-slate-950 truncate">
                        ( {successReceipt.mechanic_name} )
                      </div>
                      <div className="text-[9px] text-slate-600">
                        {successReceipt.signature_type === 'DIGITAL' ? 'Terverifikasi Digital' : 'Tanda Tangan Basah'}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Struk */}
              <div className="pt-2 text-[9px] text-slate-500 flex justify-between items-center border-t border-slate-200">
                <span>Dicetak otomatis melalui LogistikQu • PT Sinergi Jaya Sentosa</span>
                <span className="font-mono">{successReceipt.transaction_number}</span>
              </div>
            </div>

            {/* Aksi Tambahan untuk Mode Fisik: Upload Foto Struk Bertandatangan */}
            {successReceipt.signature_type === 'PHYSICAL' && (
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Upload Foto Struk Fisik Bertandatangan (Arsip Digital)</span>
                  </span>
                  {signedReceiptPhotoUrl && (
                    <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Foto Struk Tersimpan
                    </span>
                  )}
                </div>
                <input
                  type="file"
                  ref={signedReceiptPhotoInputRef}
                  accept="image/*"
                  capture="environment"
                  onChange={handleSignedReceiptPhotoSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => signedReceiptPhotoInputRef.current?.click()}
                  className="w-full py-2 px-3 rounded-lg border border-dashed border-slate-700 hover:border-cyan-500 bg-slate-950 text-slate-300 text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <Camera className="w-4 h-4 text-cyan-400" />
                  <span>{signedReceiptPhotoUrl ? 'Ganti Foto Struk Bertandatangan' : 'Foto Struk Fisik yang Sudah Ditandatangani Mekanik'}</span>
                </button>
              </div>
            )}

            {/* Tombol Aksi Modal */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <div className="text-xs text-slate-400 flex items-center gap-2">
                {successReceipt.has_printed ? (
                  <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                    <CheckCircle className="w-4 h-4" /> Struk telah dicetak & tercatat di sistem
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" /> Wajib cetak struk sebelum menyelesaikan transaksi
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handlePrintReceipt}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Struk Sekarang (Wajib)</span>
                </button>
                <button
                  type="button"
                  onClick={handleCloseReceiptModal}
                  className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    successReceipt.has_printed
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      : 'bg-slate-800/60 hover:bg-slate-700 text-slate-400'
                  }`}
                >
                  Selesai & Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warning Dialog Jika Menutup Sebelum Cetak Struk */}
      {showUnprintedWarning && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-amber-500/60 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-sm font-bold text-white">Peringatan SOP: Struk Belum Dicetak!</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Sesuai SOP Container Logistik SJS, <strong>Admin Kontainer WAJIB mencetak struk fisik</strong> dan memastikan mekanik membubuhkan tanda tangan sebagai bukti serah terima sah barang inventaris.
            </p>
            <p className="text-xs text-amber-300/90 font-medium">
              Apakah Anda ingin kembali dan mencetak struk sekarang?
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowUnprintedWarning(false);
                  setSuccessReceipt(null);
                }}
                className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-400"
              >
                Tetap Keluar
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowUnprintedWarning(false);
                  handlePrintReceipt();
                }}
                className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-xs font-bold text-slate-950 flex items-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Batal & Cetak Struk Sekarang</span>
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
