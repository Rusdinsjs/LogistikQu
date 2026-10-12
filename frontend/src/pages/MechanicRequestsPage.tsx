import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  mechanicRequestApi,
  masterApi,
  inventoryApi,
} from '../api';
import type {
  MechanicRequest,
  MechanicRequestItem,
  MechanicRequestHistory,
  MechanicRequestSummary,
  MechanicRequestType,
  DamageCategory,
  ReturnReason,
  ItemCondition,
  Equipment,
  Employee,
  SparePart,
  Site,
  InventoryStockItem,
} from '../types';
import {
  getUserFleetCategory,
  getWarehouseCategory,
  filterEquipmentByCategory,
  filterMechanicsByCategory,
} from '../utils/fleetCategory';
import {
  Wrench,
  RotateCcw,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  FileText,
  Search,
  Camera,
  Plus,
  Trash2,
  Eye,
  Check,
  Edit3,
  Undo2,
  Package,
  Layers,
  AlertCircle,
  Send,
  Upload,
} from 'lucide-react';

export const MechanicRequestsPage: React.FC = () => {
  const { user } = useAuth();
  const userDivision = getUserFleetCategory(user);

  // State filtering & list
  const [requests, setRequests] = useState<MechanicRequest[]>([]);
  const [summary, setSummary] = useState<MechanicRequestSummary | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeWarehouse, setActiveWarehouse] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [onlyMine, setOnlyMine] = useState<boolean>(false);

  // Master data
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [mechanicsList, setMechanicsList] = useState<Employee[]>([]);
  const [sparePartsList, setSparePartsList] = useState<SparePart[]>([]);
  const [sitesList, setSitesList] = useState<Site[]>([]);
  const [stockList, setStockList] = useState<InventoryStockItem[]>([]);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);
  const [detailRequest, setDetailRequest] = useState<MechanicRequest | null>(null);
  const [detailItems, setDetailItems] = useState<MechanicRequestItem[]>([]);
  const [detailHistory, setDetailHistory] = useState<MechanicRequestHistory[]>([]);
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  // Action Modals
  const [actionType, setActionType] = useState<'APPROVE' | 'REVISION' | 'REJECT' | 'CANCEL' | 'FULFILL' | null>(null);
  const [actionNotes, setActionNotes] = useState<string>('');
  const [actionItemQty, setActionItemQty] = useState<Record<string, number>>({});
  const [isActionSubmitting, setIsActionSubmitting] = useState<boolean>(false);

  // Duplicate Warning Modal
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [pendingSubmitPayload, setPendingSubmitPayload] = useState<any | null>(null);

  // Form Create/Edit State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formType, setFormType] = useState<MechanicRequestType>('REPLACEMENT');
  const [formWarehouse, setFormWarehouse] = useState<string>('');
  const [formSite, setFormSite] = useState<string>('');
  const [formUnit, setFormUnit] = useState<string>('');
  const [formHmKm, setFormHmKm] = useState<string>('');
  const [formWorkOrder, setFormWorkOrder] = useState<string>('');
  const [formMaintType, setFormMaintType] = useState<string>('CORRECTIVE');
  const [formPriority, setFormPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'EMERGENCY'>('NORMAL');
  const [formMechanicId, setFormMechanicId] = useState<string>('');
  const [formMechanicName, setFormMechanicName] = useState<string>('');
  const [formDamageCat, setFormDamageCat] = useState<DamageCategory>('WEAR');
  const [formDamageDesc, setFormDamageDesc] = useState<string>('');
  const [formDamagePhoto, setFormDamagePhoto] = useState<string | null>(null);
  const [formOldPartPhoto, setFormOldPartPhoto] = useState<string | null>(null);
  const [formReturnReason, setFormReturnReason] = useState<ReturnReason>('UNUSED');
  const [formRefIssueNo, setFormRefIssueNo] = useState<string>('');
  const [formNotes, setFormNotes] = useState<string>('');
  const [formItems, setFormItems] = useState<Array<{
    spare_part_id: string;
    qty: number;
    item_condition?: ItemCondition;
    notes?: string;
  }>>([{ spare_part_id: '', qty: 1, item_condition: 'NEW' }]);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Quick Add Unit Modal State (Instruksi #4)
  const [showAddUnitModal, setShowAddUnitModal] = useState<boolean>(false);
  const [newUnitNumber, setNewUnitNumber] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitType, setNewUnitType] = useState(
    userDivision === 'DT' ? 'DUMP_TRUCK' : 'HEAVY_EQUIPMENT'
  );
  const [newUnitSerial, setNewUnitSerial] = useState('');
  const [newUnitHmKm, setNewUnitHmKm] = useState<number | undefined>(undefined);
  const [savingUnit, setSavingUnit] = useState(false);

  const effectiveDivision =
    userDivision !== 'ALL'
      ? userDivision
      : getWarehouseCategory(formWarehouse || activeWarehouse);
  const filteredEquipment = useMemo(
    () => filterEquipmentByCategory(equipmentList, effectiveDivision),
    [equipmentList, effectiveDivision]
  );
  const filteredMechanics = useMemo(
    () => filterMechanicsByCategory(mechanicsList, effectiveDivision),
    [mechanicsList, effectiveDivision]
  );

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
      const newEq: Equipment = {
        id: eqId,
        unit_number: newUnitNumber.trim().toUpperCase(),
        name: newUnitName.trim(),
        equipment_type_id: newUnitType,
        serial_number: newUnitSerial.trim() || undefined,
        current_hm_km: newUnitHmKm ?? 0,
        is_active: true,
      };
      setEquipmentList([newEq, ...equipmentList]);
      setFormUnit(newEq.unit_number);
      if (newUnitHmKm) setFormHmKm(String(newUnitHmKm));
      setNewUnitNumber('');
      setNewUnitName('');
      setNewUnitSerial('');
      setNewUnitHmKm(undefined);
      setShowAddUnitModal(false);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal mendaftarkan unit baru');
    } finally {
      setSavingUnit(false);
    }
  };

  const fileInputDamageRef = useRef<HTMLInputElement>(null);
  const fileInputOldPartRef = useRef<HTMLInputElement>(null);

  // Permissions check
  const isMechanicRole = user?.role_id === 'MECHANIC';
  const canCreate = Boolean(user?.role_id === 'SUPER_ADMIN' || user?.permissions?.includes('mechanic_request.create'));
  const canApprove = Boolean(user?.role_id === 'SUPER_ADMIN' || user?.permissions?.includes('mechanic_request.approve'));
  const canFulfill = Boolean(user?.role_id === 'SUPER_ADMIN' || user?.permissions?.includes('mechanic_request.fulfill'));

  // Container warehouses accessible by user
  const containerWarehouses = useMemo(() => {
    if (!user) return [];
    if (user.role_id === 'SUPER_ADMIN' || user.role_id === 'MANAGER') {
      return (user.warehouses || []).filter((w) => w.warehouse_type === 'CONTAINER');
    }
    return (user.warehouses || []).filter((w) => w.warehouse_type === 'CONTAINER');
  }, [user]);

  // Initial warehouse selection
  useEffect(() => {
    if (containerWarehouses.length > 0 && !activeWarehouse) {
      setActiveWarehouse(containerWarehouses[0].id);
      setFormWarehouse(containerWarehouses[0].id);
    }
  }, [containerWarehouses, activeWarehouse]);

  // Fetch initial master data
  useEffect(() => {
    const fetchMaster = async () => {
      try {
        const [eq, emp, parts, sites] = await Promise.all([
          masterApi.getEquipment(),
          masterApi.getEmployees(),
          masterApi.getSpareParts(),
          masterApi.getSites(),
        ]);
        setEquipmentList(eq || []);
        const mechs = (emp || []).filter((e: Employee) => e.is_mechanic || e.department_id?.includes('MECH'));
        setMechanicsList(mechs.length > 0 ? mechs : emp || []);
        setSparePartsList(parts || []);
        setSitesList(sites || []);
      } catch (err) {
        console.error('Gagal memuat master data:', err);
      }
    };
    fetchMaster();
  }, []);

  // Fetch stock whenever active warehouse changes
  useEffect(() => {
    if (!activeWarehouse) return;
    const fetchStock = async () => {
      try {
        const stockData = await inventoryApi.getStock(activeWarehouse);
        setStockList(stockData || []);
      } catch (err) {
        console.error('Gagal memuat stok kontainer:', err);
      }
    };
    fetchStock();
  }, [activeWarehouse]);

  // Fetch mechanic context if mechanic user
  useEffect(() => {
    if (isMechanicRole && user) {
      mechanicRequestApi.getContext().then((ctx) => {
        if (ctx.employee) {
          setFormMechanicId(ctx.employee.id);
          setFormMechanicName(ctx.employee.name);
        } else {
          setFormMechanicName(user.full_name);
        }
      }).catch((e) => console.error('Error fetching mechanic context:', e));
    }
  }, [isMechanicRole, user]);

  // Fetch requests list & summary
  const fetchRequests = async () => {
    if (!activeWarehouse) return;
    setLoading(true);
    try {
      const [listData, sumData] = await Promise.all([
        mechanicRequestApi.listRequests({
          warehouse_id: activeWarehouse,
          status: statusFilter || undefined,
          request_type: typeFilter || undefined,
          search: searchQuery || undefined,
          mine: onlyMine || undefined,
        }),
        mechanicRequestApi.getSummary(activeWarehouse),
      ]);
      setRequests(listData || []);
      setSummary(sumData || null);
    } catch (err) {
      console.error('Gagal memuat daftar permohonan:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [activeWarehouse, statusFilter, typeFilter, searchQuery, onlyMine]);

  // Open detail modal
  const handleOpenDetail = async (req: MechanicRequest) => {
    try {
      const res = await mechanicRequestApi.getDetail(req.id, activeWarehouse);
      setDetailRequest(res.request);
      setDetailItems(res.items);
      setDetailHistory(res.history);
      // Init action quantities
      const initialQtys: Record<string, number> = {};
      res.items.forEach((itm) => {
        initialQtys[itm.id] = Number(itm.approved_qty ?? itm.requested_qty);
      });
      setActionItemQty(initialQtys);
      setIsDetailOpen(true);
    } catch (err) {
      console.error('Gagal memuat detail:', err);
    }
  };

  // Handle Image compression & base64
  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: (val: string | null) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Ukuran foto terlalu besar. Maksimal 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        const scaleSize = MAX_WIDTH / img.width;
        if (scaleSize < 1) {
          canvas.width = MAX_WIDTH;
          canvas.height = img.height * scaleSize;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setter(dataUrl);
      };
    };
    reader.readAsDataURL(file);
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingId(null);
    setFormType('REPLACEMENT');
    setFormWarehouse(activeWarehouse);
    setFormSite(sitesList[0]?.id || '');
    setFormUnit('');
    setFormHmKm('');
    setFormWorkOrder('');
    setFormMaintType('CORRECTIVE');
    setFormPriority('NORMAL');
    if (isMechanicRole) {
      setFormMechanicName(user?.full_name || '');
    } else {
      setFormMechanicId(mechanicsList[0]?.id || '');
      setFormMechanicName(mechanicsList[0]?.name || '');
    }
    setFormDamageCat('WEAR');
    setFormDamageDesc('');
    setFormDamagePhoto(null);
    setFormOldPartPhoto(null);
    setFormReturnReason('UNUSED');
    setFormRefIssueNo('');
    setFormNotes('');
    setFormItems([{ spare_part_id: '', qty: 1, item_condition: 'NEW' }]);
    setFormError(null);
    setIsCreateOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (req: MechanicRequest) => {
    setEditingId(req.id);
    setFormType(req.request_type);
    setFormWarehouse(req.warehouse_id);
    setFormSite(req.site_id || '');
    setFormUnit(req.unit_number || '');
    setFormHmKm(req.hm_km ? String(req.hm_km) : '');
    setFormWorkOrder(req.work_order_number || '');
    setFormMaintType(req.maintenance_type || 'CORRECTIVE');
    setFormPriority(req.priority || 'NORMAL');
    setFormMechanicId(req.mechanic_id || '');
    setFormMechanicName(req.mechanic_name || '');
    setFormDamageCat((req.damage_category as DamageCategory) || 'WEAR');
    setFormDamageDesc(req.damage_description || '');
    setFormDamagePhoto(req.damage_photo_url || null);
    setFormOldPartPhoto(req.old_part_photo_url || null);
    setFormReturnReason((req.return_reason as ReturnReason) || 'UNUSED');
    setFormRefIssueNo(req.reference_issue_number || '');
    setFormNotes(req.notes || '');
    setFormError(null);

    // Fetch items for edit
    mechanicRequestApi.getDetail(req.id, req.warehouse_id).then((res) => {
      setFormItems(
        res.items.map((i) => ({
          spare_part_id: i.spare_part_id,
          qty: Number(i.requested_qty),
          item_condition: i.item_condition || 'NEW',
          notes: i.notes || '',
        }))
      );
      setIsCreateOpen(true);
    });
  };

  // Submit Create or Edit Form
  const handleSubmitForm = async (force: boolean = false) => {
    setFormError(null);

    // Validation
    if (!formWarehouse) {
      setFormError('Gudang kontainer wajib dipilih');
      return;
    }

    if (formType === 'REPLACEMENT') {
      if (!formUnit.trim()) {
        setFormError('Nomor lambung unit wajib diisi untuk permohonan penggantian');
        return;
      }
      if (!formDamageDesc.trim()) {
        setFormError('Deskripsi kerusakan wajib diisi');
        return;
      }
      if (!formDamagePhoto) {
        setFormError('Foto bukti kerusakan wajib dilampirkan');
        return;
      }
    }

    if (formItems.length === 0 || formItems.some((i) => !i.spare_part_id || i.qty <= 0)) {
      setFormError('Pastikan semua baris spare part terisi dengan jumlah qty > 0');
      return;
    }

    // Selected Unit details
    const selectedEq = equipmentList.find((e) => e.unit_number === formUnit || e.id === formUnit);

    const payload: any = {
      request_type: formType,
      warehouse_id: formWarehouse,
      site_id: formSite || undefined,
      unit_number: formUnit || undefined,
      unit_name: selectedEq?.name || formUnit || undefined,
      unit_type: selectedEq?.equipment_type_id || undefined,
      ct_number: selectedEq?.ct_number || undefined,
      serial_number: selectedEq?.serial_number || undefined,
      hm_km: formHmKm ? Number(formHmKm) : 0,
      work_order_number: formWorkOrder || undefined,
      maintenance_type: formMaintType || undefined,
      priority: formPriority,
      mechanic_id: formMechanicId || undefined,
      mechanic_name: formMechanicName || undefined,
      damage_category: formType === 'REPLACEMENT' ? formDamageCat : undefined,
      damage_description: formType === 'REPLACEMENT' ? formDamageDesc : undefined,
      damage_photo_url: formType === 'REPLACEMENT' ? formDamagePhoto : undefined,
      old_part_photo_url: formType === 'REPLACEMENT' ? formOldPartPhoto : undefined,
      return_reason: formType === 'RETURN' ? formReturnReason : undefined,
      reference_issue_number: formType === 'RETURN' ? formRefIssueNo : undefined,
      notes: formNotes || undefined,
      items: formItems.map((itm) => ({
        spare_part_id: itm.spare_part_id,
        qty: Number(itm.qty),
        item_condition: formType === 'RETURN' ? itm.item_condition : undefined,
        notes: itm.notes || undefined,
      })),
    };

    setIsSubmitting(true);
    try {
      if (editingId) {
        await mechanicRequestApi.updateRequest(editingId, payload);
        setIsCreateOpen(false);
        fetchRequests();
      } else {
        const res = await mechanicRequestApi.createRequest(payload, force);
        if (res.duplicate_warning) {
          setDuplicateWarning(res.message);
          setPendingSubmitPayload(payload);
          return;
        }
        setIsCreateOpen(false);
        fetchRequests();
      }
    } catch (err: any) {
      setFormError(err.response?.data?.message || err.message || 'Gagal menyimpan permohonan');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm Force Submit
  const handleConfirmForceSubmit = async () => {
    if (!pendingSubmitPayload) return;
    setIsSubmitting(true);
    try {
      await mechanicRequestApi.createRequest(pendingSubmitPayload, true);
      setDuplicateWarning(null);
      setPendingSubmitPayload(null);
      setIsCreateOpen(false);
      fetchRequests();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Gagal submit permohonan');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Execute Approval Actions
  const handleExecuteAction = async () => {
    if (!detailRequest || !actionType) return;
    setIsActionSubmitting(true);
    try {
      if (actionType === 'APPROVE') {
        const itemsPayload = detailItems.map((i) => ({
          item_id: i.id,
          qty: Number(actionItemQty[i.id] ?? i.requested_qty),
        }));
        await mechanicRequestApi.approveRequest(detailRequest.id, {
          notes: actionNotes || undefined,
          items: itemsPayload,
        });
      } else if (actionType === 'REVISION') {
        if (!actionNotes.trim()) {
          alert('Catatan alasan revisi wajib diisi');
          setIsActionSubmitting(false);
          return;
        }
        await mechanicRequestApi.requestRevision(detailRequest.id, { notes: actionNotes });
      } else if (actionType === 'REJECT') {
        if (!actionNotes.trim()) {
          alert('Alasan penolakan wajib diisi');
          setIsActionSubmitting(false);
          return;
        }
        await mechanicRequestApi.rejectRequest(detailRequest.id, { reason: actionNotes });
      } else if (actionType === 'CANCEL') {
        await mechanicRequestApi.cancelRequest(detailRequest.id, { reason: actionNotes || undefined });
      } else if (actionType === 'FULFILL') {
        const itemsPayload = detailItems.map((i) => ({
          item_id: i.id,
          qty: Number(actionItemQty[i.id] ?? i.approved_qty ?? i.requested_qty),
        }));
        const res = await mechanicRequestApi.fulfillRequest(detailRequest.id, {
          notes: actionNotes || undefined,
          items: itemsPayload,
        });
        alert(res.message);
      }

      setActionType(null);
      setActionNotes('');
      setIsDetailOpen(false);
      fetchRequests();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Aksi gagal dieksekusi');
    } finally {
      setIsActionSubmitting(false);
    }
  };

  // Helper render status badge
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'SUBMITTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5" />
            Menunggu Approval
          </span>
        );
      case 'REVISION_REQUESTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-500/15 text-orange-300 border border-orange-500/30">
            <Undo2 className="w-3.5 h-3.5" />
            Perlu Revisi
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Disetujui (Siap Fulfill)
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <Check className="w-3.5 h-3.5" />
            Selesai (Barang Diserahkan)
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5" />
            Ditolak
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-400 border border-slate-500/30">
            <AlertCircle className="w-3.5 h-3.5" />
            Dibatalkan
          </span>
        );
      default:
        return <span className="text-xs text-slate-400">{status}</span>;
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-96 bg-gradient-to-l from-cyan-500/10 via-transparent to-transparent pointer-events-none" />
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                Permohonan Stock Mekanik
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {isMechanicRole ? 'Portal Mekanik' : 'Admin & Approval'}
                </span>
              </h1>
              <p className="text-xs text-slate-400">
                Pengajuan spare part penggantian kerusakan dan pengembalian stock langsung ke Gudang Kontainer
              </p>
            </div>
          </div>
        </div>

        {/* Actions & Gudang Selector */}
        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">Gudang Kontainer:</span>
            <select
              value={activeWarehouse}
              onChange={(e) => setActiveWarehouse(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl px-3 py-2 font-medium focus:outline-hidden focus:border-cyan-500 transition-all cursor-pointer"
            >
              {containerWarehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} ({wh.id})
                </option>
              ))}
            </select>
          </div>

          {canCreate && (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-cyan-500/20 transition-all cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>+ Ajukan Permohonan</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI / Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="glass-panel p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-slate-400">Total Pengajuan</div>
              <div className="text-lg font-bold text-slate-100">{summary.total}</div>
            </div>
            <Layers className="w-6 h-6 text-slate-600" />
          </div>
          <div className="glass-panel p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-amber-400 font-medium">Menunggu Approval</div>
              <div className="text-lg font-bold text-amber-300">{summary.submitted}</div>
            </div>
            <Clock className="w-6 h-6 text-amber-500/60" />
          </div>
          <div className="glass-panel p-3.5 rounded-xl border border-orange-500/20 bg-orange-500/5 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-orange-400 font-medium">Perlu Revisi</div>
              <div className="text-lg font-bold text-orange-300">{summary.revision_requested}</div>
            </div>
            <Undo2 className="w-6 h-6 text-orange-500/60" />
          </div>
          <div className="glass-panel p-3.5 rounded-xl border border-cyan-500/20 bg-cyan-500/5 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-cyan-400 font-medium">Disetujui</div>
              <div className="text-lg font-bold text-cyan-300">{summary.approved}</div>
            </div>
            <CheckCircle2 className="w-6 h-6 text-cyan-500/60" />
          </div>
          <div className="glass-panel p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-emerald-400 font-medium">Selesai (Fulfill)</div>
              <div className="text-lg font-bold text-emerald-300">{summary.completed}</div>
            </div>
            <Check className="w-6 h-6 text-emerald-500/60" />
          </div>
          <div className="glass-panel p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5 flex items-center justify-between">
            <div>
              <div className="text-[11px] text-rose-400 font-medium">Ditolak / Batal</div>
              <div className="text-lg font-bold text-rose-300">{summary.rejected + summary.cancelled}</div>
            </div>
            <XCircle className="w-6 h-6 text-rose-500/60" />
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari no. request, unit, mekanik, WO..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-lg focus:outline-hidden focus:border-cyan-500 transition-all"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-cyan-500"
          >
            <option value="">Semua Status</option>
            <option value="SUBMITTED">Menunggu Approval</option>
            <option value="REVISION_REQUESTED">Perlu Revisi</option>
            <option value="APPROVED">Disetujui</option>
            <option value="COMPLETED">Selesai</option>
            <option value="REJECTED">Ditolak</option>
            <option value="CANCELLED">Dibatalkan</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-hidden focus:border-cyan-500"
          >
            <option value="">Semua Tipe</option>
            <option value="REPLACEMENT">Penggantian (Part Rusak)</option>
            <option value="RETURN">Pengembalian Part</option>
          </select>

          {/* Only Mine checkbox */}
          {!isMechanicRole && (
            <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none ml-2">
              <input
                type="checkbox"
                checked={onlyMine}
                onChange={(e) => setOnlyMine(e.target.checked)}
                className="rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-0"
              />
              <span>Hanya inputan saya</span>
            </label>
          )}
        </div>

        <button
          onClick={fetchRequests}
          className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition-all cursor-pointer"
          title="Segarkan data"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>

      {/* Main Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">No. Permohonan</th>
                <th className="py-3 px-4">Tipe</th>
                <th className="py-3 px-4">Unit / HM</th>
                <th className="py-3 px-4">Mekanik</th>
                <th className="py-3 px-4">Item & Qty</th>
                <th className="py-3 px-4">Bukti Foto</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="w-8 h-8 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-2" />
                    Memuat permohonan...
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    Tidak ada permohonan yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* No. Permohonan & Tanggal */}
                    <td className="py-3 px-4 font-mono">
                      <div className="font-semibold text-cyan-400">{req.request_number}</div>
                      <div className="text-[10px] text-slate-500">
                        {new Date(req.created_at).toLocaleDateString('id-ID', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    </td>

                    {/* Tipe Permohonan */}
                    <td className="py-3 px-4">
                      {req.request_type === 'REPLACEMENT' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                          <Wrench className="w-3 h-3" />
                          Penggantian
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
                          <RotateCcw className="w-3 h-3" />
                          Pengembalian
                        </span>
                      )}
                    </td>

                    {/* Unit / HM */}
                    <td className="py-3 px-4">
                      {req.unit_number ? (
                        <>
                          <div className="font-bold text-slate-200">{req.unit_number}</div>
                          <div className="text-[10px] text-slate-500">
                            HM: {Number(req.hm_km || 0).toLocaleString()} | {req.site_id || '-'}
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-500 italic">-</span>
                      )}
                    </td>

                    {/* Mekanik */}
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-200">{req.mechanic_name}</div>
                      <div className="text-[10px] text-slate-500 flex items-center gap-1">
                        <span>Via: {req.input_channel}</span>
                        {req.revision_count > 0 && (
                          <span className="text-orange-400">({req.revision_count}x revisi)</span>
                        )}
                      </div>
                    </td>

                    {/* Item Count */}
                    <td className="py-3 px-4">
                      <div className="text-slate-200 font-medium">
                        {req.items_count ?? 1} Spare Part
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Total: {Number(req.total_qty || 0)} Pcs
                      </div>
                    </td>

                    {/* Bukti Foto */}
                    <td className="py-3 px-4">
                      {req.damage_photo_url ? (
                        <button
                          onClick={() => setPreviewPhotoUrl(req.damage_photo_url || null)}
                          className="w-9 h-9 rounded-lg overflow-hidden border border-slate-700 hover:border-cyan-400 transition-all cursor-pointer relative group"
                        >
                          <img
                            src={req.damage_photo_url}
                            alt="Bukti Kerusakan"
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                          />
                          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Eye className="w-3.5 h-3.5 text-cyan-300" />
                          </div>
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-600 italic">Tanpa foto</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">{renderStatusBadge(req.status)}</td>

                    {/* Aksi Button */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenDetail(req)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 hover:border-cyan-500/40 text-xs font-medium transition-all cursor-pointer"
                        >
                          Detail
                        </button>

                        {/* Edit button if requester and pending/revision */}
                        {(req.status === 'SUBMITTED' || req.status === 'REVISION_REQUESTED') &&
                          (canCreate || req.requester_user_id === user?.id) && (
                            <button
                              onClick={() => handleOpenEdit(req)}
                              className="p-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-amber-400 border border-slate-700 transition-all cursor-pointer"
                              title="Edit / Revisi Permohonan"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DETAIL & ACTIONS */}
      {isDetailOpen && detailRequest && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-4xl max-h-[90vh] rounded-2xl border border-slate-800 flex flex-col overflow-hidden shadow-2xl animate-scale-in">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    Permohonan {detailRequest.request_number}
                    {renderStatusBadge(detailRequest.status)}
                  </h3>
                  <div className="text-xs text-slate-400">
                    Diajukan oleh {detailRequest.requester_name} ({detailRequest.mechanic_name}) pada{' '}
                    {new Date(detailRequest.created_at).toLocaleString('id-ID')}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsDetailOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Content Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Revision note warning if any */}
              {detailRequest.status === 'REVISION_REQUESTED' && detailRequest.revision_notes && (
                <div className="p-4 rounded-xl border border-orange-500/30 bg-orange-500/10 text-orange-200 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-orange-300">
                    <AlertTriangle className="w-4 h-4" />
                    Catatan Revisi dari Admin Kontainer:
                  </div>
                  <p>{detailRequest.revision_notes}</p>
                </div>
              )}

              {/* Info Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-900/40 border border-slate-800 text-xs">
                <div>
                  <div className="text-slate-500 text-[11px]">Tipe Permohonan</div>
                  <div className="font-semibold text-slate-200 mt-0.5">
                    {detailRequest.request_type === 'REPLACEMENT' ? 'Penggantian Part Rusak' : 'Pengembalian Part'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-[11px]">Gudang Kontainer</div>
                  <div className="font-semibold text-slate-200 mt-0.5">{detailRequest.warehouse_id}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[11px]">Unit / Lambung</div>
                  <div className="font-semibold text-cyan-300 mt-0.5">
                    {detailRequest.unit_number || '-'} {detailRequest.hm_km ? `(${detailRequest.hm_km} HM)` : ''}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-[11px]">Work Order & Sektor</div>
                  <div className="font-semibold text-slate-200 mt-0.5">
                    {detailRequest.work_order_number || '-'} ({detailRequest.site_id || '-'})
                  </div>
                </div>
              </div>

              {/* Bukti Kerusakan & Analisa */}
              {detailRequest.request_type === 'REPLACEMENT' && (
                <div className="space-y-3 p-4 rounded-xl border border-slate-800 bg-slate-900/20">
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                    <Camera className="w-4 h-4 text-cyan-400" />
                    Form Pembuktian Kerusakan
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                    <div className="md:col-span-2 space-y-2">
                      <div>
                        <span className="text-slate-500 font-medium">Kategori Kerusakan:</span>{' '}
                        <span className="font-semibold text-amber-300">
                          {detailRequest.damage_category || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 font-medium">Analisa & Deskripsi Kerusakan:</span>
                        <p className="mt-1 p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 whitespace-pre-wrap">
                          {detailRequest.damage_description || '-'}
                        </p>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500 font-medium block mb-1.5">Foto Bukti Kerusakan:</span>
                      {detailRequest.damage_photo_url ? (
                        <div
                          onClick={() => setPreviewPhotoUrl(detailRequest.damage_photo_url || null)}
                          className="w-full h-32 rounded-xl overflow-hidden border border-slate-700 relative group cursor-pointer"
                        >
                          <img
                            src={detailRequest.damage_photo_url}
                            alt="Bukti Kerusakan"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-cyan-300 text-xs font-medium">
                            <Eye className="w-4 h-4 mr-1" /> Perbesar
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-32 rounded-xl border border-dashed border-slate-700 flex items-center justify-center text-slate-600 text-xs">
                          Tidak ada foto
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Items List */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Package className="w-4 h-4 text-cyan-400" />
                  Daftar Spare Part ({detailItems.length} Item)
                </h4>
                <div className="rounded-xl border border-slate-800 overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 border-b border-slate-800 text-slate-400 text-[10px]">
                      <tr>
                        <th className="py-2.5 px-3">Part Number & Nama</th>
                        <th className="py-2.5 px-3">Satuan</th>
                        <th className="py-2.5 px-3">Stok Kontainer</th>
                        <th className="py-2.5 px-3">Qty Diminta</th>
                        <th className="py-2.5 px-3">Qty Disetujui</th>
                        {detailRequest.status === 'COMPLETED' && (
                          <th className="py-2.5 px-3">Qty Diserahkan</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 text-slate-300">
                      {detailItems.map((itm) => (
                        <tr key={itm.id}>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-cyan-300">{itm.spare_part_id}</div>
                            <div className="text-[11px] text-slate-400">{itm.part_name}</div>
                          </td>
                          <td className="py-2.5 px-3">{itm.unit_of_measure}</td>
                          <td className="py-2.5 px-3 font-semibold text-slate-300">
                            {Number(itm.stock_on_hand ?? 0)}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-100">
                            {Number(itm.requested_qty)}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-cyan-400">
                            {itm.approved_qty !== null ? Number(itm.approved_qty) : '-'}
                          </td>
                          {detailRequest.status === 'COMPLETED' && (
                            <td className="py-2.5 px-3 font-bold text-emerald-400">
                              {Number(itm.fulfilled_qty ?? itm.approved_qty)}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* History Timeline */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-slate-200 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  Jejak Alur & Timeline
                </h4>
                <div className="space-y-2 border-l-2 border-slate-800 ml-2 pl-4 text-xs">
                  {detailHistory.map((h) => (
                    <div key={h.id} className="relative group">
                      <div className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-cyan-400 border-2 border-slate-900" />
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-200">{h.action}</span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(h.created_at).toLocaleString('id-ID')}
                        </span>
                        <span className="text-[10px] text-cyan-400">oleh {h.actor_name} ({h.actor_role})</span>
                      </div>
                      {h.notes && <div className="text-slate-400 text-[11px] mt-0.5">{h.notes}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer Action Buttons */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {/* Cancel button if SUBMITTED or REVISION_REQUESTED */}
                {(detailRequest.status === 'SUBMITTED' || detailRequest.status === 'REVISION_REQUESTED') &&
                  (canApprove || detailRequest.requester_user_id === user?.id) && (
                    <button
                      onClick={() => setActionType('CANCEL')}
                      className="px-3 py-1.5 rounded-xl border border-slate-700 hover:border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition-all cursor-pointer"
                    >
                      Batalkan Permohonan
                    </button>
                  )}
              </div>

              <div className="flex items-center gap-2">
                {/* Admin Kontainer actions for SUBMITTED */}
                {detailRequest.status === 'SUBMITTED' && canApprove && (
                  <>
                    <button
                      onClick={() => setActionType('REJECT')}
                      className="px-3.5 py-1.5 rounded-xl border border-rose-500/40 text-rose-300 hover:bg-rose-500/10 text-xs font-semibold transition-all cursor-pointer"
                    >
                      Tolak
                    </button>
                    <button
                      onClick={() => setActionType('REVISION')}
                      className="px-3.5 py-1.5 rounded-xl border border-orange-500/40 text-orange-300 hover:bg-orange-500/10 text-xs font-semibold transition-all cursor-pointer"
                    >
                      Minta Revisi
                    </button>
                    <button
                      onClick={() => setActionType('APPROVE')}
                      className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
                    >
                      Setujui (Approve)
                    </button>
                  </>
                )}

                {/* Admin Kontainer action for APPROVED -> FULFILL */}
                {detailRequest.status === 'APPROVED' && canFulfill && (
                  <button
                    onClick={() => setActionType('FULFILL')}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    Serahkan Barang Fisik (Fulfill)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ACTION DIALOG MODAL (Approve with Qty change, Revision note, Reject, Fulfill) */}
      {actionType && detailRequest && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-2xl border border-slate-800 p-6 space-y-4 shadow-2xl animate-scale-in">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              {actionType === 'APPROVE' && 'Konfirmasi Persetujuan Permohonan'}
              {actionType === 'REVISION' && 'Kembalikan untuk Revisi'}
              {actionType === 'REJECT' && 'Tolak Permohonan'}
              {actionType === 'CANCEL' && 'Batalkan Permohonan'}
              {actionType === 'FULFILL' && 'Serah Terima Barang & Potong Stok'}
            </h3>

            <p className="text-xs text-slate-400">
              {actionType === 'APPROVE' &&
                'Anda dapat menyesuaikan jumlah approved qty untuk setiap item jika dibutuhkan sebelum menyetujui.'}
              {actionType === 'REVISION' &&
                'Masukkan catatan atau bagian yang perlu diperbaiki/dilengkapi oleh mekanik.'}
              {actionType === 'REJECT' && 'Masukkan alasan penolakan permohonan ini.'}
              {actionType === 'CANCEL' && 'Apakah Anda yakin ingin membatalkan permohonan ini?'}
              {actionType === 'FULFILL' &&
                'Klik konfirmasi untuk mencatat serah terima fisik barang. Transaksi POS resmi (ISS) akan diterbitkan otomatis dan stok fisik kontainer akan terpotong.'}
            </p>

            {/* Quantity adjustments on APPROVE or FULFILL */}
            {(actionType === 'APPROVE' || actionType === 'FULFILL') && (
              <div className="space-y-2 max-h-48 overflow-y-auto p-2 bg-slate-900/60 rounded-xl border border-slate-800">
                {detailItems.map((itm) => (
                  <div key={itm.id} className="flex items-center justify-between text-xs gap-3">
                    <div className="truncate flex-1">
                      <span className="font-bold text-cyan-300">{itm.spare_part_id}</span>
                      <span className="text-[10px] text-slate-400 block truncate">{itm.part_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500">
                        Diminta: {Number(itm.requested_qty)}
                      </span>
                      <input
                        type="number"
                        min="0"
                        max={Number(itm.requested_qty)}
                        value={actionItemQty[itm.id] ?? Number(itm.requested_qty)}
                        onChange={(e) =>
                          setActionItemQty({
                            ...actionItemQty,
                            [itm.id]: Number(e.target.value),
                          })
                        }
                        className="w-16 px-2 py-1 bg-slate-950 border border-slate-700 text-slate-100 rounded text-center text-xs font-bold"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Notes textarea */}
            <div className="space-y-1">
              <label className="text-[11px] text-slate-400 font-medium">
                {actionType === 'REVISION' || actionType === 'REJECT'
                  ? 'Alasan / Catatan (Wajib):'
                  : 'Catatan Tambahan (Opsional):'}
              </label>
              <textarea
                rows={3}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="Tulis catatan di sini..."
                className="w-full p-2.5 bg-slate-900 border border-slate-800 text-slate-200 text-xs rounded-xl focus:outline-hidden focus:border-cyan-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setActionType(null)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                disabled={isActionSubmitting}
                onClick={handleExecuteAction}
                className="px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
              >
                {isActionSubmitting ? 'Memproses...' : 'Konfirmasi & Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREATE / EDIT REQUEST */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-3xl max-h-[92vh] rounded-2xl border border-slate-800 flex flex-col overflow-hidden shadow-2xl animate-scale-in">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    {editingId ? 'Edit / Revisi Permohonan' : 'Form Pengajuan Permohonan Stock'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {formType === 'REPLACEMENT'
                      ? 'Penggantian part rusak dengan bukti foto kerusakan & analisa'
                      : 'Pengembalian part tidak terpakai ke gudang kontainer'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-all cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-3 p-1 bg-slate-900/80 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setFormType('REPLACEMENT')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    formType === 'REPLACEMENT'
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Wrench className="w-4 h-4" />
                  <span>Penggantian Part Rusak (REPLACEMENT)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFormType('RETURN')}
                  className={`py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    formType === 'RETURN'
                      ? 'bg-purple-500 text-slate-950 shadow-md shadow-purple-500/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Pengembalian Stock (RETURN)</span>
                </button>
              </div>

              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Warehouse & Mechanic Identity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">
                    Gudang Kontainer Tujuan *
                  </label>
                  <select
                    value={formWarehouse}
                    onChange={(e) => setFormWarehouse(e.target.value)}
                    className="w-full p-2.5 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl focus:outline-hidden focus:border-cyan-500"
                  >
                    {containerWarehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.name} ({wh.id})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 font-medium block mb-1">
                    Mekanik Pemohon *
                  </label>
                  {isMechanicRole ? (
                    <input
                      type="text"
                      disabled
                      value={formMechanicName}
                      className="w-full p-2.5 bg-slate-900/50 border border-slate-800 text-cyan-300 font-semibold text-xs rounded-xl cursor-not-allowed"
                    />
                  ) : (
                    <select
                      value={formMechanicId}
                      onChange={(e) => {
                        setFormMechanicId(e.target.value);
                        const m = filteredMechanics.find((mech) => mech.id === e.target.value);
                        if (m) setFormMechanicName(m.name);
                      }}
                      className="w-full p-2.5 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl focus:outline-hidden focus:border-cyan-500"
                    >
                      {filteredMechanics.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.id})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* REPLACEMENT Specific Fields */}
              {formType === 'REPLACEMENT' && (
                <div className="space-y-4 p-4 rounded-xl border border-slate-800 bg-slate-900/40">
                  <h4 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Wrench className="w-4 h-4" /> Data Unit & Kerusakan
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs text-slate-400 block">No. Lambung Unit *</label>
                        <button
                          type="button"
                          onClick={() => {
                            setNewUnitType(effectiveDivision === 'DT' ? 'DUMP_TRUCK' : 'HEAVY_EQUIPMENT');
                            setShowAddUnitModal(true);
                          }}
                          className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ Unit Baru</span>
                        </button>
                      </div>
                      <input
                        type="text"
                        placeholder={effectiveDivision === 'DT' ? 'Contoh: DT-001, DT-002...' : 'Contoh: EX-101, DZ-201...'}
                        value={formUnit}
                        onChange={(e) => setFormUnit(e.target.value.toUpperCase())}
                        list="unit-options"
                        className="w-full p-2 bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg font-bold font-mono"
                      />
                      <datalist id="unit-options">
                        {filteredEquipment.map((eq) => (
                          <option key={eq.id} value={eq.unit_number}>
                            {eq.name} ({eq.current_hm_km} HM)
                          </option>
                        ))}
                      </datalist>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">HM / KM Unit</label>
                      <input
                        type="number"
                        placeholder="0.0"
                        value={formHmKm}
                        onChange={(e) => setFormHmKm(e.target.value)}
                        className="w-full p-2 bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Lokasi Site</label>
                      <select
                        value={formSite}
                        onChange={(e) => setFormSite(e.target.value)}
                        className="w-full p-2 bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg"
                      >
                        {sitesList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">No. Work Order</label>
                      <input
                        type="text"
                        placeholder="WO-XXXX..."
                        value={formWorkOrder}
                        onChange={(e) => setFormWorkOrder(e.target.value)}
                        className="w-full p-2 bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Kategori Kerusakan *</label>
                      <select
                        value={formDamageCat}
                        onChange={(e) => setFormDamageCat(e.target.value as DamageCategory)}
                        className="w-full p-2 bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg"
                      >
                        <option value="WEAR">WEAR (Aus / Umur Pakai)</option>
                        <option value="BROKEN">BROKEN (Patah / Rusak Fisik)</option>
                        <option value="LEAK">LEAK (Bocor Oli / Fluida)</option>
                        <option value="BURNT">BURNT (Terbakar / Korsleting)</option>
                        <option value="ACCIDENT">ACCIDENT (Insiden Lapangan)</option>
                        <option value="OTHER">OTHER (Lainnya)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">Prioritas</label>
                      <select
                        value={formPriority}
                        onChange={(e) => setFormPriority(e.target.value as any)}
                        className="w-full p-2 bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg font-semibold"
                      >
                        <option value="LOW">LOW</option>
                        <option value="NORMAL">NORMAL</option>
                        <option value="HIGH">HIGH</option>
                        <option value="EMERGENCY">EMERGENCY (Breakdown)</option>
                      </select>
                    </div>
                  </div>

                  {/* Deskripsi Kerusakan */}
                  <div>
                    <label className="text-xs text-slate-400 block mb-1">
                      Deskripsi Kerusakan & Gejala Analisa *
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Jelaskan kondisi komponen yang rusak, indikasi alarm, atau kebocoran..."
                      value={formDamageDesc}
                      onChange={(e) => setFormDamageDesc(e.target.value)}
                      className="w-full p-2 bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg"
                    />
                  </div>

                  {/* Foto Bukti Kerusakan */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                    <div>
                      <label className="text-xs text-slate-300 font-semibold flex items-center gap-1.5 mb-1.5">
                        <Camera className="w-4 h-4 text-cyan-400" />
                        Foto Bukti Kerusakan (Wajib) *
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        ref={fileInputDamageRef}
                        onChange={(e) => handleImageUpload(e, setFormDamagePhoto)}
                        className="hidden"
                      />
                      {formDamagePhoto ? (
                        <div className="relative w-full h-32 rounded-xl border border-cyan-500/40 overflow-hidden group">
                          <img
                            src={formDamagePhoto}
                            alt="Damage Preview"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setFormDamagePhoto(null)}
                            className="absolute top-2 right-2 p-1 rounded-full bg-slate-950/80 text-rose-400 hover:text-rose-200 transition-colors cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputDamageRef.current?.click()}
                          className="w-full h-32 rounded-xl border-2 border-dashed border-slate-700 hover:border-cyan-400 flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-cyan-300 transition-all cursor-pointer bg-slate-950/50"
                        >
                          <Camera className="w-6 h-6" />
                          <span className="text-xs font-semibold">Ambil / Upload Foto Kerusakan</span>
                          <span className="text-[10px] text-slate-500">Maksimal 5MB (JPG/PNG)</span>
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1.5">
                        Foto Part Copotan / Bekas (Opsional)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        ref={fileInputOldPartRef}
                        onChange={(e) => handleImageUpload(e, setFormOldPartPhoto)}
                        className="hidden"
                      />
                      {formOldPartPhoto ? (
                        <div className="relative w-full h-32 rounded-xl border border-slate-700 overflow-hidden group">
                          <img
                            src={formOldPartPhoto}
                            alt="Old Part Preview"
                            className="w-full h-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => setFormOldPartPhoto(null)}
                            className="absolute top-2 right-2 p-1 rounded-full bg-slate-950/80 text-rose-400 hover:text-rose-200 transition-colors cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileInputOldPartRef.current?.click()}
                          className="w-full h-32 rounded-xl border border-dashed border-slate-800 hover:border-slate-600 flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-slate-300 transition-all cursor-pointer bg-slate-950/30"
                        >
                          <Upload className="w-5 h-5" />
                          <span className="text-xs">Upload Foto Part Bekas</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* RETURN Specific Fields */}
              {formType === 'RETURN' && (
                <div className="space-y-4 p-4 rounded-xl border border-slate-800 bg-slate-900/40">
                  <h4 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                    <RotateCcw className="w-4 h-4" /> Data Pengembalian Stock
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Alasan Pengembalian *
                      </label>
                      <select
                        value={formReturnReason}
                        onChange={(e) => setFormReturnReason(e.target.value as ReturnReason)}
                        className="w-full p-2 bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg"
                      >
                        <option value="UNUSED">UNUSED (Batal Pakai / Pekerjaan Selesai)</option>
                        <option value="EXCESS">EXCESS (Kelebihan Ambil Barang)</option>
                        <option value="WRONG_PART">WRONG_PART (Salah Part Number / Spek)</option>
                        <option value="WO_CANCELLED">WO_CANCELLED (Work Order Dibatalkan)</option>
                        <option value="OTHER">OTHER (Lainnya)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-slate-400 block mb-1">
                        Referensi No. POS / Pengeluaran Asal (Opsional)
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: ISS-20261012-00001..."
                        value={formRefIssueNo}
                        onChange={(e) => setFormRefIssueNo(e.target.value)}
                        className="w-full p-2 bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Items Table Form */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-cyan-400" /> Daftar Spare Part yang Diajukan
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setFormItems([
                        ...formItems,
                        { spare_part_id: '', qty: 1, item_condition: 'NEW' },
                      ])
                    }
                    className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-400 text-xs font-semibold rounded-lg border border-slate-700 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Tambah Baris
                  </button>
                </div>

                <div className="space-y-2">
                  {formItems.map((item, idx) => {
                    const stockItem = stockList.find((s) => s.spare_part_id === item.spare_part_id);
                    return (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center gap-3 text-xs"
                      >
                        <div className="flex-1 min-w-[220px]">
                          <select
                            value={item.spare_part_id}
                            onChange={(e) => {
                              const newItems = [...formItems];
                              newItems[idx].spare_part_id = e.target.value;
                              setFormItems(newItems);
                            }}
                            className="w-full p-2 bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg"
                          >
                            <option value="">Pilih Spare Part...</option>
                            {sparePartsList.map((sp) => (
                              <option key={sp.id} value={sp.id}>
                                {sp.id} - {sp.part_name} ({sp.unit_of_measure})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Stock On-Hand Info */}
                        {formType === 'REPLACEMENT' && (
                          <div className="text-[11px] text-slate-400 whitespace-nowrap">
                            Stok: <span className="font-bold text-cyan-400">{stockItem?.qty_on_hand ?? 0}</span>
                          </div>
                        )}

                        {/* Qty Input */}
                        <div className="w-20">
                          <input
                            type="number"
                            min="1"
                            placeholder="Qty"
                            value={item.qty}
                            onChange={(e) => {
                              const newItems = [...formItems];
                              newItems[idx].qty = Number(e.target.value);
                              setFormItems(newItems);
                            }}
                            className="w-full p-2 bg-slate-950 border border-slate-700 text-slate-100 text-xs rounded-lg text-center font-bold"
                          />
                        </div>

                        {/* Item condition for RETURN */}
                        {formType === 'RETURN' && (
                          <div className="w-28">
                            <select
                              value={item.item_condition || 'NEW'}
                              onChange={(e) => {
                                const newItems = [...formItems];
                                newItems[idx].item_condition = e.target.value as ItemCondition;
                                setFormItems(newItems);
                              }}
                              className="w-full p-2 bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg"
                            >
                              <option value="NEW">NEW (Baru)</option>
                              <option value="GOOD">GOOD (Bagus)</option>
                              <option value="DAMAGED">DAMAGED (Rusak)</option>
                            </select>
                          </div>
                        )}

                        {/* Delete row button */}
                        {formItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newItems = formItems.filter((_, i) => i !== idx);
                              setFormItems(newItems);
                            }}
                            className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* General Notes */}
              <div>
                <label className="text-xs text-slate-400 block mb-1">Catatan Tambahan (Opsional)</label>
                <input
                  type="text"
                  placeholder="Keterangan tambahan..."
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  className="w-full p-2 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg"
                />
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-all cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleSubmitForm(false)}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-bold shadow-lg shadow-cyan-500/20 transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Mengirim...' : editingId ? 'Simpan Revisi' : 'Submit Permohonan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DUPLICATE WARNING MODAL */}
      {duplicateWarning && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-70 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-amber-500/30 p-6 space-y-4 shadow-2xl animate-scale-in">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Peringatan Duplikasi Permohonan</h3>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">{duplicateWarning}</p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setDuplicateWarning(null)}
                className="px-3.5 py-1.5 rounded-xl border border-slate-700 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-all cursor-pointer"
              >
                Periksa Kembali
              </button>
              <button
                disabled={isSubmitting}
                onClick={handleConfirmForceSubmit}
                className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all cursor-pointer"
              >
                {isSubmitting ? 'Mengirim...' : 'Tetap Ajukan Permohonan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHOTO PREVIEW LIGHTBOX */}
      {previewPhotoUrl && (
        <div
          onClick={() => setPreviewPhotoUrl(null)}
          className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-80 flex items-center justify-center p-4 cursor-zoom-out"
        >
          <div className="relative max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
            <img src={previewPhotoUrl} alt="Preview Foto" className="w-full h-full object-contain" />
            <button
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute top-3 right-3 p-2 rounded-full bg-slate-950/80 text-slate-200 hover:text-white"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {/* QUICK ADD UNIT MODAL (Instruksi #4) */}
      {showAddUnitModal && (
        <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-cyan-500/30 p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="w-4 h-4 text-cyan-400" />
                Registrasi Unit Equipment Baru
              </h3>
              <button
                type="button"
                onClick={() => setShowAddUnitModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickAddUnit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Nomor Lambung Unit *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: DT-088 / EX-2005"
                  value={newUnitNumber}
                  onChange={(e) => setNewUnitNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono uppercase focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Nama / Model Unit *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Dump Truck Scania P410"
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Kategori Unit</label>
                  <select
                    value={newUnitType}
                    onChange={(e) => setNewUnitType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                  >
                    {effectiveDivision !== 'DT' && (
                      <option value="HEAVY_EQUIPMENT">Heavy Equipment</option>
                    )}
                    {effectiveDivision !== 'HE' && (
                      <option value="DUMP_TRUCK">Dump Truck</option>
                    )}
                    <option value="SUPPORT_VEHICLE">Support Vehicle</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">HM / KM Awal</label>
                  <input
                    type="number"
                    placeholder="0"
                    value={newUnitHmKm || ''}
                    onChange={(e) => setNewUnitHmKm(e.target.value ? Number(e.target.value) : undefined)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Nomor Seri / Serial Number</label>
                <input
                  type="text"
                  placeholder="Contoh: SN-SCN-2026-99"
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
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold disabled:opacity-50 cursor-pointer"
                >
                  {savingUnit ? 'Menyimpan...' : 'Simpan & Pilih Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
