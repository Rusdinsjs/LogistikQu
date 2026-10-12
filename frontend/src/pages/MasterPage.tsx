import React, { useEffect, useState } from 'react';
import { masterApi } from '../api';
import { useAuth } from '../context/AuthContext';
import { confirmDialog } from '../context/ToastContext';
import {
  canViewFinancials,
  type SparePart,
  type Equipment,
  type Employee,
  type Site,
  type WarehouseInfo,
  type WarehouseCategory,
  type MobileDevice,
} from '../types';
import {
  Boxes,
  Truck,
  Users,
  MapPin,
  Search,
  CheckCircle,
  AlertOctagon,
  Building2,
  RotateCcw,
  Plus,
  X,
  UserPlus,
  Edit2,
  Trash2,
  Power,
  PowerOff,
  Info,
  Tag,
  GitBranch,
  Box,
  Camera,
  Smartphone,
  QrCode as QrIcon,
  Eye,
} from 'lucide-react';
import { QrCodeView } from '../components/common/QrCodeView';
import { PhotoUploadZone } from '../components/common/PhotoUploadZone';

export const MasterPage: React.FC = () => {
  const { user } = useAuth();
  const hasFinancialAccess = canViewFinancials(user);
  const canManageMaster =
    user?.role_id === 'SUPER_ADMIN' ||
    user?.permissions?.includes('master.manage');

  const [activeTab, setActiveTab] = useState<'parts' | 'equipment' | 'employees' | 'sites' | 'warehouses' | 'devices'>('parts');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseInfo[]>([]);
  const [devices, setDevices] = useState<MobileDevice[]>([]);

  // Mobile Device Modal & Form State
  const [showDeviceModal, setShowDeviceModal] = useState(false);
  const [deviceModalMode, setDeviceModalMode] = useState<'create' | 'edit'>('create');
  const [deviceFormId, setDeviceFormId] = useState('');
  const [deviceFormName, setDeviceFormName] = useState('');
  const [deviceFormWarehouseId, setDeviceFormWarehouseId] = useState('');
  const [deviceFormUserId, setDeviceFormUserId] = useState('');
  const [deviceFormAppVersion, setDeviceFormAppVersion] = useState('2.0.0');
  const [deviceFormPhotoUrl, setDeviceFormPhotoUrl] = useState('');
  const [deviceFormQrCode, setDeviceFormQrCode] = useState('');
  const [deviceFormActive, setDeviceFormActive] = useState(true);
  const [savingDevice, setSavingDevice] = useState(false);
  const [selectedDeviceDetail, setSelectedDeviceDetail] = useState<MobileDevice | null>(null);

  // Toggle Core Return state
  const [updatingPartId, setUpdatingPartId] = useState<string | null>(null);

  // QR Code & Photo preview modal states
  const [selectedQrPart, setSelectedQrPart] = useState<SparePart | null>(null);
  const [previewMasterPhoto, setPreviewMasterPhoto] = useState<SparePart | null>(null);

  // Add Equipment Modal
  const [showAddUnitModal, setShowAddUnitModal] = useState(false);
  const [newUnitNumber, setNewUnitNumber] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitType, setNewUnitType] = useState('HEAVY_EQUIPMENT');
  const [newUnitSerial, setNewUnitSerial] = useState('');
  const [newUnitHmKm, setNewUnitHmKm] = useState<number | undefined>(undefined);
  const [savingUnit, setSavingUnit] = useState(false);

  // Add Employee Modal
  const [showAddEmpModal, setShowAddEmpModal] = useState(false);
  const [newEmpName, setNewEmpName] = useState('');
  const [newEmpPosition, setNewEmpPosition] = useState('Mekanik Alat Berat');
  const [newEmpIsMechanic, setNewEmpIsMechanic] = useState(true);
  const [savingEmp, setSavingEmp] = useState(false);

  // Site Modal (Add / Edit)
  const [showSiteModal, setShowSiteModal] = useState(false);
  const [siteModalMode, setSiteModalMode] = useState<'create' | 'edit'>('create');
  const [siteFormId, setSiteFormId] = useState('');
  const [siteFormName, setSiteFormName] = useState('');
  const [siteFormDesc, setSiteFormDesc] = useState('');
  const [siteFormActive, setSiteFormActive] = useState(true);
  const [savingSite, setSavingSite] = useState(false);

  // Warehouse Modal (Add / Edit)
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [warehouseModalMode, setWarehouseModalMode] = useState<'create' | 'edit'>('create');
  const [warehouseFormId, setWarehouseFormId] = useState('');
  const [warehouseFormName, setWarehouseFormName] = useState('');
  const [warehouseFormType, setWarehouseFormType] = useState<'MAIN' | 'CONTAINER'>('CONTAINER');
  const [warehouseFormCategory, setWarehouseFormCategory] = useState<string>('HEAVY_EQUIPMENT');
  const [warehouseFormParentIds, setWarehouseFormParentIds] = useState<string[]>([]);
  const [warehouseFormDesc, setWarehouseFormDesc] = useState('');
  const [warehouseFormActive, setWarehouseFormActive] = useState(true);
  const [savingWarehouse, setSavingWarehouse] = useState(false);

  // Warehouse Categories Master State
  const [warehouseCategories, setWarehouseCategories] = useState<WarehouseCategory[]>([]);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [catEditMode, setCatEditMode] = useState<'create' | 'edit'>('create');
  const [catFormId, setCatFormId] = useState('');
  const [catFormName, setCatFormName] = useState('');
  const [catFormDesc, setCatFormDesc] = useState('');
  const [catFormActive, setCatFormActive] = useState(true);
  const [savingCategory, setSavingCategory] = useState(false);

  const loadCategories = async () => {
    try {
      const cats = await masterApi.listWarehouseCategories();
      setWarehouseCategories(cats);
    } catch (err) {
      console.error('Failed to load warehouse categories:', err);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      if (activeTab === 'parts') {
        const data = await masterApi.getSpareParts(search || undefined);
        setSpareParts(data);
      } else if (activeTab === 'equipment') {
        const data = await masterApi.getEquipment(search || undefined);
        setEquipmentList(data);
      } else if (activeTab === 'employees') {
        const data = await masterApi.getEmployees();
        setEmployees(data);
      } else if (activeTab === 'sites') {
        const data = await masterApi.getSites();
        setSites(data);
      } else if (activeTab === 'warehouses') {
        const [whData, catData] = await Promise.all([
          masterApi.getWarehouses(),
          masterApi.listWarehouseCategories(),
        ]);
        setWarehouses(whData);
        setWarehouseCategories(catData);
      } else if (activeTab === 'devices') {
        const [devData, whData, empData] = await Promise.all([
          masterApi.getDevices(),
          warehouses.length > 0 ? Promise.resolve(warehouses) : masterApi.getWarehouses(),
          employees.length > 0 ? Promise.resolve(employees) : masterApi.getEmployees(),
        ]);
        setDevices(devData);
        if (warehouses.length === 0) setWarehouses(whData);
        if (employees.length === 0) setEmployees(empData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    loadCategories();
  }, [activeTab, search]);

  const handleToggleCoreReturn = async (part: SparePart) => {
    setUpdatingPartId(part.id);
    const newStatus = !part.requires_core_return;
    try {
      await masterApi.updateSparePart(part.id, {
        requires_core_return: newStatus,
      });
      setSpareParts(
        spareParts.map((p) =>
          p.id === part.id ? { ...p, requires_core_return: newStatus } : p
        )
      );
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal mengubah status retur part');
    } finally {
      setUpdatingPartId(null);
    }
  };

  const handleCreateEquipment = async (e: React.FormEvent) => {
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

      const newEq: Equipment = {
        id: created.equipment_id,
        unit_number: newUnitNumber.trim().toUpperCase(),
        name: newUnitName.trim(),
        equipment_type_id: newUnitType,
        serial_number: newUnitSerial.trim() || undefined,
        current_hm_km: newUnitHmKm ?? 0,
        is_active: true,
      };

      setEquipmentList([newEq, ...equipmentList]);
      setNewUnitNumber('');
      setNewUnitName('');
      setNewUnitSerial('');
      setNewUnitHmKm(undefined);
      setShowAddUnitModal(false);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal menambahkan unit alat berat');
    } finally {
      setSavingUnit(false);
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmpName.trim()) {
      alert('Nama karyawan wajib diisi!');
      return;
    }

    setSavingEmp(true);
    try {
      const created = await masterApi.createEmployee({
        name: newEmpName.trim(),
        position: newEmpPosition.trim() || 'Staff',
        is_mechanic: newEmpIsMechanic,
      });

      const newEmployee: Employee = {
        id: created.employee_id,
        name: newEmpName.trim(),
        position: newEmpPosition.trim() || 'Staff',
        is_mechanic: newEmpIsMechanic,
        is_active: true,
      };

      setEmployees([newEmployee, ...employees]);
      setNewEmpName('');
      setShowAddEmpModal(false);
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal menambahkan karyawan/mekanik');
    } finally {
      setSavingEmp(false);
    }
  };

  // --- SITE CRUD HANDLERS ---
  const openCreateSiteModal = () => {
    setSiteModalMode('create');
    setSiteFormId('');
    setSiteFormName('');
    setSiteFormDesc('');
    setSiteFormActive(true);
    setShowSiteModal(true);
  };

  const openEditSiteModal = (site: Site) => {
    setSiteModalMode('edit');
    setSiteFormId(site.id);
    setSiteFormName(site.name);
    setSiteFormDesc(site.description || '');
    setSiteFormActive(site.is_active);
    setShowSiteModal(true);
  };

  const handleSaveSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!siteFormName.trim()) {
      alert('Nama Titik Site wajib diisi!');
      return;
    }

    setSavingSite(true);
    try {
      if (siteModalMode === 'create') {
        const res = await masterApi.createSite({
          id: siteFormId.trim() || undefined,
          name: siteFormName.trim(),
          description: siteFormDesc.trim() || undefined,
          is_active: siteFormActive,
        });
        alert(res.message || 'Titik Site berhasil disimpan');
      } else {
        const res = await masterApi.updateSite(siteFormId, {
          name: siteFormName.trim(),
          description: siteFormDesc.trim() || undefined,
          is_active: siteFormActive,
        });
        alert(res.message || 'Titik Site berhasil diperbarui');
      }
      setShowSiteModal(false);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal menyimpan Titik Site');
    } finally {
      setSavingSite(false);
    }
  };

  const handleToggleSiteStatus = async (site: Site) => {
    const nextStatus = !site.is_active;
    const confirmMsg = nextStatus
      ? `Aktifkan kembali Titik Site "${site.name}"?`
      : `Nonaktifkan Titik Site "${site.name}"?`;
    if (!(await confirmDialog(confirmMsg))) return;

    try {
      await masterApi.updateSite(site.id, { is_active: nextStatus });
      setSites(sites.map((s) => (s.id === site.id ? { ...s, is_active: nextStatus } : s)));
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal mengubah status site');
    }
  };

  const handleDeleteSite = async (site: Site) => {
    if (
      !(await confirmDialog(
        `Hapus Titik Site "${site.name}" (${site.id})? Jika site memiliki riwayat unit/transaksi, statusnya akan dialihkan ke Non-Aktif.`
      ))
    ) {
      return;
    }

    try {
      const res = await masterApi.deleteSite(site.id);
      alert(res.message);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal menghapus Titik Site');
    }
  };

  // --- WAREHOUSE CRUD HANDLERS ---
  const toggleParentWarehouse = (mainWhId: string) => {
    if (warehouseFormParentIds.includes(mainWhId)) {
      setWarehouseFormParentIds(warehouseFormParentIds.filter((id) => id !== mainWhId));
    } else {
      setWarehouseFormParentIds([...warehouseFormParentIds, mainWhId]);
    }
  };

  const openCreateWarehouseModal = () => {
    setWarehouseModalMode('create');
    setWarehouseFormId('');
    setWarehouseFormName('');
    setWarehouseFormType('CONTAINER');
    setWarehouseFormCategory(warehouseCategories[0]?.id || 'HEAVY_EQUIPMENT');
    const defaultParent = warehouses.find((w) => w.warehouse_type === 'MAIN')?.id;
    setWarehouseFormParentIds(defaultParent ? [defaultParent] : []);
    setWarehouseFormDesc('');
    setWarehouseFormActive(true);
    setShowWarehouseModal(true);
  };

  const openEditWarehouseModal = (wh: WarehouseInfo) => {
    setWarehouseModalMode('edit');
    setWarehouseFormId(wh.id);
    setWarehouseFormName(wh.name);
    setWarehouseFormType(wh.warehouse_type);
    setWarehouseFormCategory(wh.category || warehouseCategories[0]?.id || 'HEAVY_EQUIPMENT');
    const parents = (wh.parent_warehouse_ids && wh.parent_warehouse_ids.length > 0)
      ? wh.parent_warehouse_ids
      : (wh.parent_warehouse_id ? [wh.parent_warehouse_id] : []);
    setWarehouseFormParentIds(parents);
    setWarehouseFormDesc(wh.description || '');
    setWarehouseFormActive(wh.is_active ?? true);
    setShowWarehouseModal(true);
  };

  const handleSaveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!warehouseFormName.trim()) {
      alert('Nama Gudang wajib diisi!');
      return;
    }

    setSavingWarehouse(true);
    try {
      const parentIds = warehouseFormType === 'CONTAINER' ? warehouseFormParentIds : [];
      const primaryParentId = parentIds.length > 0 ? parentIds[0] : null;
      if (warehouseModalMode === 'create') {
        const res = await masterApi.createWarehouse({
          id: warehouseFormId.trim() || undefined,
          name: warehouseFormName.trim(),
          warehouse_type: warehouseFormType,
          category: warehouseFormCategory,
          parent_warehouse_id: primaryParentId,
          parent_warehouse_ids: parentIds,
          description: warehouseFormDesc.trim() || undefined,
          is_active: warehouseFormActive,
        });
        alert(res.message || 'Gudang berhasil disimpan');
      } else {
        const res = await masterApi.updateWarehouse(warehouseFormId, {
          name: warehouseFormName.trim(),
          warehouse_type: warehouseFormType,
          category: warehouseFormCategory,
          parent_warehouse_id: primaryParentId,
          parent_warehouse_ids: parentIds,
          description: warehouseFormDesc.trim() || undefined,
          is_active: warehouseFormActive,
        });
        alert(res.message || 'Gudang berhasil diperbarui');
      }
      setShowWarehouseModal(false);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal menyimpan Gudang');
    } finally {
      setSavingWarehouse(false);
    }
  };

  // --- WAREHOUSE CATEGORY CRUD HANDLERS ---
  const handleOpenCreateCategory = () => {
    setCatEditMode('create');
    setCatFormId('');
    setCatFormName('');
    setCatFormDesc('');
    setCatFormActive(true);
  };

  const handleOpenEditCategory = (cat: WarehouseCategory) => {
    setCatEditMode('edit');
    setCatFormId(cat.id);
    setCatFormName(cat.name);
    setCatFormDesc(cat.description || '');
    setCatFormActive(cat.is_active);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catFormName.trim()) {
      alert('Nama Kategori wajib diisi!');
      return;
    }
    setSavingCategory(true);
    try {
      if (catEditMode === 'create') {
        const res = await masterApi.createWarehouseCategory({
          id: catFormId.trim() || undefined,
          name: catFormName.trim(),
          description: catFormDesc.trim() || undefined,
          is_active: catFormActive,
        });
        alert(res.message || 'Kategori gudang berhasil disimpan');
      } else {
        const res = await masterApi.updateWarehouseCategory(catFormId, {
          name: catFormName.trim(),
          description: catFormDesc.trim() || undefined,
          is_active: catFormActive,
        });
        alert(res.message || 'Kategori gudang berhasil diperbarui');
      }
      handleOpenCreateCategory();
      await loadCategories();
      if (activeTab === 'warehouses') {
        loadData();
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Gagal menyimpan kategori';
      alert(errMsg);
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (cat: WarehouseCategory) => {
    if (
      !(await confirmDialog(
        `Hapus kategori "${cat.name}"? Jika masih ada gudang yang menggunakannya, kategori akan dinonaktifkan (soft delete).`
      ))
    ) {
      return;
    }
    try {
      const res = await masterApi.deleteWarehouseCategory(cat.id);
      alert(res.message || 'Kategori berhasil dihapus');
      loadCategories();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal menghapus kategori');
    }
  };

  const handleToggleWarehouseStatus = async (wh: WarehouseInfo) => {
    const currentActive = wh.is_active ?? true;
    const nextStatus = !currentActive;
    const confirmMsg = nextStatus
      ? `Aktifkan kembali Gudang "${wh.name}"?`
      : `Nonaktifkan Gudang "${wh.name}"?`;
    if (!(await confirmDialog(confirmMsg))) return;

    try {
      await masterApi.updateWarehouse(wh.id, { is_active: nextStatus });
      setWarehouses(warehouses.map((w) => (w.id === wh.id ? { ...w, is_active: nextStatus } : w)));
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal mengubah status gudang');
    }
  };

  const handleDeleteWarehouse = async (wh: WarehouseInfo) => {
    if (
      !(await confirmDialog(
        `Hapus Gudang "${wh.name}" (${wh.id})? Jika gudang memiliki riwayat stok/transaksi, statusnya akan dialihkan ke Non-Aktif.`
      ))
    ) {
      return;
    }

    try {
      const res = await masterApi.deleteWarehouse(wh.id);
      alert(res.message);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal menghapus Gudang');
    }
  };

  // --- MOBILE DEVICE CRUD HANDLERS ---
  const openCreateDeviceModal = () => {
    setDeviceModalMode('create');
    setDeviceFormId('');
    setDeviceFormName('');
    setDeviceFormWarehouseId(warehouses[0]?.id || 'WH-CONT-HE');
    setDeviceFormUserId('');
    setDeviceFormAppVersion('2.0.0');
    setDeviceFormPhotoUrl('');
    setDeviceFormQrCode('');
    setDeviceFormActive(true);
    setShowDeviceModal(true);
  };

  const openEditDeviceModal = (d: MobileDevice) => {
    setDeviceModalMode('edit');
    setDeviceFormId(d.device_id);
    setDeviceFormName(d.device_name);
    setDeviceFormWarehouseId(d.assigned_warehouse_id || '');
    setDeviceFormUserId(d.assigned_user_id || '');
    setDeviceFormAppVersion(d.app_version || '2.0.0');
    setDeviceFormPhotoUrl(d.photo_url || '');
    setDeviceFormQrCode(d.qr_code || `DEVICE:${d.device_id}`);
    setDeviceFormActive(d.is_active);
    setShowDeviceModal(true);
  };

  const handleSaveDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceFormName.trim()) {
      alert('Nama Perangkat wajib diisi!');
      return;
    }
    if (deviceModalMode === 'create' && !deviceFormId.trim()) {
      alert('Device ID wajib diisi!');
      return;
    }

    setSavingDevice(true);
    try {
      const qrVal = deviceFormQrCode.trim() || `DEVICE:${deviceFormId.trim().toUpperCase()}`;
      if (deviceModalMode === 'create') {
        await masterApi.createDevice({
          device_id: deviceFormId.trim().toUpperCase(),
          device_name: deviceFormName.trim(),
          assigned_warehouse_id: deviceFormWarehouseId || null,
          assigned_user_id: deviceFormUserId || null,
          app_version: deviceFormAppVersion.trim() || '2.0.0',
          photo_url: deviceFormPhotoUrl.trim() || null,
          qr_code: qrVal,
          is_active: deviceFormActive,
        });
        alert(`Perangkat '${deviceFormId.trim().toUpperCase()}' berhasil didaftarkan`);
      } else {
        await masterApi.updateDevice(deviceFormId, {
          device_name: deviceFormName.trim(),
          assigned_warehouse_id: deviceFormWarehouseId || null,
          assigned_user_id: deviceFormUserId || null,
          app_version: deviceFormAppVersion.trim() || '2.0.0',
          photo_url: deviceFormPhotoUrl.trim() || null,
          qr_code: qrVal,
          is_active: deviceFormActive,
        });
        alert(`Perangkat '${deviceFormId}' berhasil diperbarui`);
      }
      setShowDeviceModal(false);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.response?.data?.message || 'Gagal menyimpan perangkat');
    } finally {
      setSavingDevice(false);
    }
  };

  const handleToggleDeviceActive = async (d: MobileDevice) => {
    const nextStatus = !d.is_active;
    const confirmMsg = nextStatus
      ? `Aktifkan kembali perangkat '${d.device_id}' (${d.device_name})?`
      : `Nonaktifkan perangkat '${d.device_id}' (${d.device_name})? Perangkat yang dinonaktifkan tidak dapat melakukan sinkronisasi batch.`;
    if (!(await confirmDialog(confirmMsg))) return;

    try {
      await masterApi.updateDevice(d.device_id, { is_active: nextStatus });
      setDevices(devices.map((item) => (item.device_id === d.device_id ? { ...item, is_active: nextStatus } : item)));
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal mengubah status perangkat');
    }
  };

  const handleDeleteDevice = async (d: MobileDevice) => {
    if (
      !(await confirmDialog(
        `Hapus / cabut izin perangkat '${d.device_id}' (${d.device_name})? Jika perangkat memiliki riwayat transaksi offline, perangkat akan dinonaktifkan secara aman.`
      ))
    ) {
      return;
    }
    try {
      const res = await masterApi.deleteDevice(d.device_id);
      alert(res.message);
      loadData();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Gagal menghapus perangkat');
    }
  };

  const formatLastSync = (timestamp?: string | null) => {
    if (!timestamp) return 'Belum pernah sync';
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return 'Belum pernah sync';
    const diffMs = Date.now() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Baru saja (< 1 mnt)';
    if (diffMins < 60) return `${diffMins} menit lalu`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} jam lalu`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} hari lalu (${date.toLocaleDateString('id-ID')})`;
  };

  // Filtered lists for Sites, Warehouses, and Devices
  const filteredSites = sites.filter(
    (s) =>
      !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase()) ||
      (s.description && s.description.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredWarehouses = warehouses.filter(
    (w) =>
      !search ||
      w.name.toLowerCase().includes(search.toLowerCase()) ||
      w.id.toLowerCase().includes(search.toLowerCase()) ||
      w.warehouse_type.toLowerCase().includes(search.toLowerCase()) ||
      w.category.toLowerCase().includes(search.toLowerCase()) ||
      (w.description && w.description.toLowerCase().includes(search.toLowerCase()))
  );

  const filteredDevices = devices.filter(
    (d) =>
      !search ||
      d.device_id.toLowerCase().includes(search.toLowerCase()) ||
      d.device_name.toLowerCase().includes(search.toLowerCase()) ||
      (d.assigned_warehouse_id && d.assigned_warehouse_id.toLowerCase().includes(search.toLowerCase())) ||
      (d.assigned_warehouse_name && d.assigned_warehouse_name.toLowerCase().includes(search.toLowerCase())) ||
      (d.assigned_user_name && d.assigned_user_name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
          <Boxes className="w-7 h-7 text-cyan-400" />
          Master Data Operasional
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Katalog referensi suku cadang (aturan Core Return), armada alat berat, personil mekanik, titik site operasional, dan konfigurasi gudang SJS-VIPO.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setActiveTab('parts');
              setSearch('');
            }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              activeTab === 'parts'
                ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Boxes className="w-4 h-4" /> Suku Cadang ({spareParts.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('equipment');
              setSearch('');
            }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              activeTab === 'equipment'
                ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Truck className="w-4 h-4" /> Unit Alat Berat ({equipmentList.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('employees');
              setSearch('');
            }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              activeTab === 'employees'
                ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" /> Karyawan & Mekanik ({employees.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('sites');
              setSearch('');
            }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              activeTab === 'sites'
                ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <MapPin className="w-4 h-4" /> Titik Site ({sites.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('warehouses');
              setSearch('');
            }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              activeTab === 'warehouses'
                ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Building2 className="w-4 h-4" /> Daftar Gudang ({warehouses.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('devices');
              setSearch('');
            }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              activeTab === 'devices'
                ? 'bg-slate-800 text-cyan-400 border border-cyan-500/30 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" /> Perangkat Mobile ({devices.length})
          </button>
        </div>

        {/* Action Buttons for Tabs */}
        <div>
          {activeTab === 'equipment' && (
            <button
              onClick={() => setShowAddUnitModal(true)}
              className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Unit Alat Berat</span>
            </button>
          )}

          {activeTab === 'employees' && (
            <button
              onClick={() => setShowAddEmpModal(true)}
              className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>+ Tambah Karyawan / Mekanik</span>
            </button>
          )}

          {activeTab === 'sites' && canManageMaster && (
            <button
              onClick={openCreateSiteModal}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Titik Site</span>
            </button>
          )}

          {activeTab === 'warehouses' && canManageMaster && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  handleOpenCreateCategory();
                  setShowCategoryModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 font-semibold text-xs flex items-center gap-1.5 transition-all"
                title="Buka Master Kategori Gudang untuk Tambah / Edit Kategori"
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Kategori Gudang ({warehouseCategories.length})</span>
              </button>
              <button
                type="button"
                onClick={openCreateWarehouseModal}
                className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>+ Tambah Gudang Baru</span>
              </button>
            </div>
          )}

          {activeTab === 'devices' && canManageMaster && (
            <button
              type="button"
              onClick={openCreateDeviceModal}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>+ Tambah Perangkat Mobile</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="glass-card p-4 rounded-xl flex items-center gap-3">
        <Search className="w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={
            activeTab === 'parts'
              ? 'Cari nama suku cadang, part number...'
              : activeTab === 'equipment'
              ? 'Cari kode unit (e.g. EX-201, DT-501)...'
              : activeTab === 'employees'
              ? 'Cari nama karyawan atau posisi...'
              : activeTab === 'sites'
              ? 'Cari nama titik site, kode site...'
              : activeTab === 'devices'
              ? 'Cari device ID (e.g. ANDROID-WH-001), nama perangkat, gudang...'
              : 'Cari nama gudang, kode gudang, kategori...'
          }
          className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-xs text-slate-400 hover:text-white">
            Hapus
          </button>
        )}
      </div>

      {/* TAB CONTENT: PARTS */}
      {activeTab === 'parts' && (
        <div className="glass-card rounded-2xl overflow-hidden border border-slate-800/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3.5 text-center w-14">Foto</th>
                  <th className="px-5 py-3.5">Part Number & QR</th>
                  <th className="px-5 py-3.5">Deskripsi Suku Cadang</th>
                  <th className="px-5 py-3.5">Kategori</th>
                  <th className="px-5 py-3.5">Satuan</th>
                  {hasFinancialAccess && <th className="px-5 py-3.5 text-right">Harga Satuan (Cost)</th>}
                  <th className="px-5 py-3.5 text-center">Wajib Retur (Core)</th>
                  <th className="px-5 py-3.5 text-center">Critical Part</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={hasFinancialAccess ? 8 : 7} className="px-5 py-8 text-center text-slate-400">
                      Memuat katalog suku cadang...
                    </td>
                  </tr>
                ) : spareParts.length === 0 ? (
                  <tr>
                    <td colSpan={hasFinancialAccess ? 8 : 7} className="px-5 py-8 text-center text-slate-500">
                      Tidak ada suku cadang ditemukan
                    </td>
                  </tr>
                ) : (
                  spareParts.map((part) => (
                    <tr key={part.id} className="hover:bg-slate-800/30 transition">
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setPreviewMasterPhoto(part)}
                          className="w-10 h-10 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 hover:border-cyan-400 transition flex items-center justify-center mx-auto"
                          title="Lihat foto suku cadang"
                        >
                          {part.photo_url ? (
                            <img
                              src={part.photo_url}
                              alt={part.part_name}
                              className="w-full h-full object-cover hover:scale-110 transition"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <Camera className="w-4 h-4 text-slate-600" />
                          )}
                        </button>
                      </td>
                      <td className="px-5 py-4 font-mono font-bold text-cyan-400">
                        <div className="flex items-center gap-2">
                          <span>{part.id}</span>
                          <button
                            type="button"
                            onClick={() => setSelectedQrPart(part)}
                            className="p-1 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-cyan-300 transition"
                            title="Lihat QR Code & Cetak Tag"
                          >
                            <QrIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="px-5 py-4 font-semibold text-slate-200">{part.part_name}</td>
                      <td className="px-5 py-4 text-xs">
                        <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                          {part.category || part.equipment_category || 'General'}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-xs font-mono text-slate-300">
                        {part.unit_of_measure}
                      </td>
                      {hasFinancialAccess && (
                        <td className="px-5 py-4 text-xs font-mono text-right text-emerald-400 font-semibold">
                          {part.unit_cost !== undefined && part.unit_cost !== null
                            ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(part.unit_cost)
                            : '-'}
                        </td>
                      )}
                      <td className="px-5 py-4 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleCoreReturn(part)}
                          disabled={updatingPartId === part.id}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                            part.requires_core_return
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 shadow-sm'
                              : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
                          }`}
                          title="Klik untuk mengubah aturan kewajiban retur part bekas"
                        >
                          <RotateCcw className={`w-3 h-3 ${updatingPartId === part.id ? 'animate-spin' : ''}`} />
                          <span>{part.requires_core_return ? 'Wajib Retur' : 'Tidak Wajib'}</span>
                        </button>
                      </td>
                      <td className="px-5 py-4 text-center">
                        {part.critical_level === 'CRITICAL' || part.requires_issue_approval ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                            <AlertOctagon className="w-3 h-3" /> Critical
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400">
                            Normal
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
      )}

      {/* MODAL QR CODE TAG SUKU CADANG */}
      {selectedQrPart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-sm rounded-2xl border border-cyan-500/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">QR Code Tag Suku Cadang</h3>
                <p className="text-xs text-cyan-300 font-mono font-bold mt-0.5">{selectedQrPart.id}</p>
              </div>
              <button onClick={() => setSelectedQrPart(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <QrCodeView
              value={selectedQrPart.qr_code || `QR-PART-${selectedQrPart.id}`}
              size={170}
              title={selectedQrPart.id}
              partName={selectedQrPart.part_name}
              subtitle={selectedQrPart.category || selectedQrPart.equipment_category || 'General'}
              warehouseName="Master LogistikQu"
              rackLocation="KATALOG PUSAT"
              showActions={true}
            />
          </div>
        </div>
      )}

      {/* FULL PHOTO PREVIEW MODAL */}
      {previewMasterPhoto && previewMasterPhoto.photo_url && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/95 backdrop-blur-lg"
          onClick={() => setPreviewMasterPhoto(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setPreviewMasterPhoto(null)}
              className="absolute -top-12 right-0 p-2 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewMasterPhoto.photo_url}
              alt={previewMasterPhoto.part_name}
              className="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-slate-700"
            />
            <div className="mt-3 text-center">
              <span className="font-mono font-bold text-cyan-300">{previewMasterPhoto.id}</span>
              <span className="mx-2 text-slate-500">•</span>
              <span className="font-semibold text-white">{previewMasterPhoto.part_name}</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: EQUIPMENT */}
      {activeTab === 'equipment' && (
        <div className="glass-card rounded-2xl overflow-hidden border border-slate-800/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">Nomor Unit (Unit ID)</th>
                  <th className="px-5 py-3.5">Model / Tipe</th>
                  <th className="px-5 py-3.5">Kategori Armada</th>
                  <th className="px-5 py-3.5 text-right">Hour Meter (HM)</th>
                  <th className="px-5 py-3.5 text-right">Kilometer (KM)</th>
                  <th className="px-5 py-3.5 text-center">Status Unit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                      Memuat daftar alat berat...
                    </td>
                  </tr>
                ) : equipmentList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-slate-500">
                      Tidak ada unit alat berat ditemukan
                    </td>
                  </tr>
                ) : (
                  equipmentList.map((eq) => (
                    <tr key={eq.id} className="hover:bg-slate-800/30 transition">
                      <td className="px-5 py-4 font-mono font-bold text-cyan-400">{eq.unit_number || eq.id}</td>
                      <td className="px-5 py-4 font-semibold text-slate-200">{eq.name}</td>
                      <td className="px-5 py-4 text-xs text-slate-300">{eq.equipment_type_id || 'Alat Berat'}</td>
                      <td className="px-5 py-4 text-right font-mono text-cyan-300">
                        {eq.current_hm_km ?? 0} HM
                      </td>
                      <td className="px-5 py-4 text-right font-mono text-slate-300">
                        {eq.current_hm_km ?? 0} KM
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle className="w-3 h-3" /> {eq.is_active ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: EMPLOYEES */}
      {activeTab === 'employees' && (
        <div className="glass-card rounded-2xl overflow-hidden border border-slate-800/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-5 py-3.5">ID Karyawan</th>
                  <th className="px-5 py-3.5">Nama Lengkap</th>
                  <th className="px-5 py-3.5">Departemen</th>
                  <th className="px-5 py-3.5">Jabatan / Role</th>
                  <th className="px-5 py-3.5 text-center">Kategori</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-800/30 transition">
                    <td className="px-5 py-4 font-mono font-semibold text-cyan-400">{emp.id}</td>
                    <td className="px-5 py-4 font-semibold text-slate-200">{emp.name}</td>
                    <td className="px-5 py-4 text-xs text-slate-400">{emp.department_id || (emp.is_mechanic ? 'Maintenance & Repair' : 'Logistics')}</td>
                    <td className="px-5 py-4 text-xs">
                      <span className="px-2.5 py-1 rounded-md bg-slate-800 text-cyan-300 border border-slate-700">
                        {emp.position || (emp.is_mechanic ? 'Mekanik / Teknisi' : 'Staff Operasional')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {emp.is_mechanic ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                          Mekanik
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                          Staff
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB CONTENT: SITES */}
      {activeTab === 'sites' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-bold text-white">Daftar Titik Site Penambangan SJS-VIPO</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                {filteredSites.length} Titik Lokasi
              </span>
            </div>
            {!canManageMaster && (
              <span className="text-xs text-slate-400 italic flex items-center gap-1">
                <Info className="w-3.5 h-3.5" /> Hanya Super Admin / Manager yang dapat menambah atau mengubah site
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSites.map((st) => (
              <div
                key={st.id}
                className="glass-card p-5 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/50">
                        {st.id}
                      </span>
                      <h3 className="text-base font-bold text-slate-100 mt-2">{st.name}</h3>
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border flex items-center gap-1 ${
                        st.is_active
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {st.is_active ? <CheckCircle className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                      {st.is_active ? 'Aktif' : 'Non-Aktif'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2 line-clamp-2">
                    {st.description || 'Area penambangan operasional SJS-VIPO'}
                  </p>
                </div>

                {canManageMaster && (
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => handleToggleSiteStatus(st)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border transition ${
                        st.is_active
                          ? 'text-amber-300 border-amber-500/30 hover:bg-amber-500/15'
                          : 'text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/15'
                      }`}
                      title={st.is_active ? 'Nonaktifkan site ini' : 'Aktifkan site ini'}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{st.is_active ? 'Nonaktifkan' : 'Aktifkan'}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditSiteModal(st)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                        title="Edit detail site"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSite(st)}
                        className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-200 border border-rose-800/40 transition"
                        title="Hapus / Nonaktifkan site"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {filteredSites.length === 0 && (
            <div className="glass-card p-12 text-center text-slate-400 rounded-2xl border border-slate-800">
              Tidak ada titik site yang sesuai dengan kriteria pencarian.
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: WAREHOUSES */}
      {activeTab === 'warehouses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-bold text-white">Daftar Gudang Logistik (Utama & Kontainer)</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                {filteredWarehouses.length} Gudang
              </span>
            </div>
            {!canManageMaster && (
              <span className="text-xs text-slate-400 italic flex items-center gap-1">
                <Info className="w-3.5 h-3.5" /> Hanya Super Admin / Manager yang dapat menambah atau mengubah gudang
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            {filteredWarehouses.map((wh) => (
              <div
                key={wh.id}
                className="glass-card p-5 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/50">
                          {wh.id}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                            wh.warehouse_type === 'MAIN'
                              ? 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                              : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {wh.warehouse_type === 'MAIN' ? '🏢 GUDANG INDUK' : '📦 GUDANG SUB (KONTAINER)'}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                          {warehouseCategories.find((c) => c.id === wh.category)?.name || wh.category}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-slate-100 mt-2">{wh.name}</h3>

                      {/* RELASI MULTI-PENYUPLAI ATAU SUB-KONTAINER */}
                      {wh.warehouse_type === 'CONTAINER' && (() => {
                        const parents = (wh.parent_warehouse_ids && wh.parent_warehouse_ids.length > 0)
                          ? wh.parent_warehouse_ids
                          : (wh.parent_warehouse_id ? [wh.parent_warehouse_id] : []);
                        if (parents.length > 0) {
                          return (
                            <div className="flex items-center gap-1.5 flex-wrap pt-1.5">
                              <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                                <GitBranch className="w-3 h-3 text-indigo-400" /> Disuplai oleh:
                              </span>
                              {parents.map((pid) => {
                                const parentWh = warehouses.find((p) => p.id === pid);
                                return (
                                  <span
                                    key={pid}
                                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1"
                                    title={`Gudang Induk Penyuplai: ${parentWh?.name || pid}`}
                                  >
                                    <span>{parentWh ? parentWh.name : pid}</span>
                                  </span>
                                );
                              })}
                            </div>
                          );
                        }
                        return (
                          <div className="pt-1 text-[11px] text-slate-500 italic">
                            Belum terhubung ke Gudang Induk penyuplai
                          </div>
                        );
                      })()}

                      {wh.warehouse_type === 'MAIN' && (() => {
                        const subs = (wh.supplied_sub_warehouse_ids && wh.supplied_sub_warehouse_ids.length > 0)
                          ? wh.supplied_sub_warehouse_ids
                          : warehouses
                              .filter((sub) => sub.warehouse_type === 'CONTAINER' && (sub.parent_warehouse_ids?.includes(wh.id) || sub.parent_warehouse_id === wh.id))
                              .map((s) => s.id);
                        return (
                          <div className="flex items-center gap-1.5 flex-wrap pt-1.5">
                            <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                              <Box className="w-3 h-3 text-cyan-400" /> Menyuplai Sub:
                            </span>
                            {subs.length > 0 ? (
                              subs.map((sid) => {
                                const subWh = warehouses.find((s) => s.id === sid);
                                return (
                                  <span
                                    key={sid}
                                    className="px-2 py-0.5 rounded text-[11px] font-medium bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 flex items-center gap-1"
                                    title={`Gudang Sub Kontainer: ${subWh?.name || sid}`}
                                  >
                                    <span>{subWh ? subWh.name : sid}</span>
                                  </span>
                                );
                              })
                            ) : (
                              <span className="text-[11px] text-slate-500 italic">Belum ada kontainer terhubung</span>
                            )}
                          </div>
                        );
                      })()}
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border flex items-center gap-1 shrink-0 ${
                        (wh.is_active ?? true)
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {(wh.is_active ?? true) ? <CheckCircle className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                      {(wh.is_active ?? true) ? 'Aktif' : 'Non-Aktif'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 mt-2">
                    {wh.description || 'Gudang operasional inventori suku cadang SJS-VIPO.'}
                  </p>
                </div>

                {canManageMaster && (
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => handleToggleWarehouseStatus(wh)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border transition ${
                        (wh.is_active ?? true)
                          ? 'text-amber-300 border-amber-500/30 hover:bg-amber-500/15'
                          : 'text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/15'
                      }`}
                      title={(wh.is_active ?? true) ? 'Nonaktifkan gudang ini' : 'Aktifkan gudang ini'}
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>{(wh.is_active ?? true) ? 'Nonaktifkan' : 'Aktifkan'}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditWarehouseModal(wh)}
                        className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition flex items-center gap-1"
                        title="Edit data gudang"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteWarehouse(wh)}
                        className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-200 border border-rose-800/40 transition"
                        title="Hapus / Nonaktifkan gudang"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {filteredWarehouses.length === 0 && (
            <div className="glass-card p-12 text-center text-slate-400 rounded-2xl border border-slate-800">
              Tidak ada gudang yang sesuai dengan kriteria pencarian.
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: MOBILE DEVICES */}
      {activeTab === 'devices' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-cyan-400" />
              <h2 className="text-base font-bold text-white">Daftar Master Perangkat Mobile & Handheld SJS</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                {filteredDevices.length} Perangkat Terdaftar
              </span>
            </div>
            {!canManageMaster && (
              <span className="text-xs text-slate-400 italic flex items-center gap-1">
                <Info className="w-3.5 h-3.5" /> Hanya Super Admin / Manager yang dapat mendaftarkan atau mengubah perangkat
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDevices.map((dev) => {
              const lastSyncText = formatLastSync(dev.last_sync_at);
              const isRecentlyActive = dev.last_sync_at
                ? Date.now() - new Date(dev.last_sync_at).getTime() < 15 * 60 * 1000
                : false;

              return (
                <div
                  key={dev.device_id}
                  className="glass-card p-5 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        {/* Device Photo Thumbnail */}
                        <div
                          onClick={() => setSelectedDeviceDetail(dev)}
                          className="w-12 h-12 rounded-xl border border-slate-700 bg-slate-900/80 shrink-0 overflow-hidden cursor-pointer hover:border-cyan-500/60 transition flex items-center justify-center group"
                          title="Klik untuk melihat detail & foto"
                        >
                          {dev.photo_url ? (
                            <img
                              src={dev.photo_url}
                              alt={dev.device_name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                            />
                          ) : (
                            <Smartphone className="w-6 h-6 text-slate-500 group-hover:text-cyan-400 transition" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-950/50 px-2 py-0.5 rounded border border-cyan-800/60">
                              {dev.device_id}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono bg-slate-800/80 px-1.5 py-0.5 rounded">
                              v{dev.app_version || '2.0.0'}
                            </span>
                          </div>
                          <h3
                            onClick={() => setSelectedDeviceDetail(dev)}
                            className="text-sm font-bold text-slate-100 mt-1 line-clamp-1 hover:text-cyan-400 cursor-pointer transition"
                            title={dev.device_name}
                          >
                            {dev.device_name}
                          </h3>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border flex items-center gap-1 shrink-0 ${
                          dev.is_active
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        }`}
                      >
                        {dev.is_active ? <CheckCircle className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                        {dev.is_active ? 'Aktif' : 'Non-Aktif'}
                      </span>
                    </div>

                    <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-800/60 space-y-2 text-xs">
                      <div className="flex items-center justify-between text-slate-400">
                        <span className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-slate-500" /> Gudang Penugasan:
                        </span>
                        <span className="font-medium text-slate-200">
                          {dev.assigned_warehouse_name
                            ? `${dev.assigned_warehouse_id} (${dev.assigned_warehouse_name})`
                            : dev.assigned_warehouse_id || '-'}
                        </span>
                      </div>

                      {dev.assigned_user_name && (
                        <div className="flex items-center justify-between text-slate-400">
                          <span className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-slate-500" /> Penanggung Jawab:
                          </span>
                          <span className="font-medium text-slate-200">{dev.assigned_user_name}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-slate-400 pt-1 border-t border-slate-800/40">
                        <span className="flex items-center gap-1.5">
                          {isRecentlyActive ? (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                          ) : (
                            <span className="h-2 w-2 rounded-full bg-slate-500"></span>
                          )}
                          Status Terakhir Online:
                        </span>
                        <span
                          className={`font-mono text-[11px] ${
                            isRecentlyActive ? 'text-emerald-400 font-bold' : 'text-slate-400'
                          }`}
                        >
                          {lastSyncText}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs gap-2">
                    {/* Tombol Detail Perangkat */}
                    <button
                      type="button"
                      onClick={() => setSelectedDeviceDetail(dev)}
                      className="px-3 py-1.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-400 hover:text-cyan-300 border border-cyan-800/40 font-semibold flex items-center gap-1.5 transition"
                      title="Lihat Detail & QR Code Perangkat"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Detail</span>
                    </button>

                    <div className="flex items-center gap-1">
                      {canManageMaster && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleDeviceActive(dev)}
                            className={`p-1.5 rounded-lg border transition ${
                              dev.is_active
                                ? 'text-amber-300 border-amber-500/30 hover:bg-amber-500/15'
                                : 'text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/15'
                            }`}
                            title={dev.is_active ? 'Nonaktifkan Perangkat' : 'Aktifkan Perangkat'}
                          >
                            {dev.is_active ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditDeviceModal(dev)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                            title="Edit Perangkat"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteDevice(dev)}
                            className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-200 border border-rose-800/40 transition"
                            title="Hapus / Nonaktifkan Perangkat"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredDevices.length === 0 && (
            <div className="glass-card p-12 text-center text-slate-400 rounded-2xl border border-slate-800">
              Tidak ada perangkat mobile yang sesuai dengan kriteria pencarian.
            </div>
          )}
        </div>
      )}

      {/* MODAL ADD EQUIPMENT */}
      {showAddUnitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-cyan-500/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-cyan-400">
                <Truck className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">Tambah Unit Alat Berat Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddUnitModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEquipment} className="space-y-3 text-xs">
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
                  {savingUnit ? 'Menyimpan...' : 'Simpan Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL ADD EMPLOYEE */}
      {showAddEmpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-cyan-500/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-cyan-400">
                <UserPlus className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">Tambah Karyawan / Mekanik Baru</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddEmpModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Nama Lengkap *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Bambang Sugiharto"
                  value={newEmpName}
                  onChange={(e) => setNewEmpName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Posisi / Jabatan</label>
                <input
                  type="text"
                  placeholder="Contoh: Senior Heavy Equipment Mechanic"
                  value={newEmpPosition}
                  onChange={(e) => setNewEmpPosition(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="is_mechanic_checkbox"
                  checked={newEmpIsMechanic}
                  onChange={(e) => setNewEmpIsMechanic(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <label htmlFor="is_mechanic_checkbox" className="text-slate-300 cursor-pointer">
                  Karyawan ini adalah Mekanik Lapangan (dapat dipilih di POS)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddEmpModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingEmp}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold disabled:opacity-50"
                >
                  {savingEmp ? 'Menyimpan...' : 'Simpan Karyawan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL SITE (CREATE / EDIT) */}
      {showSiteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-cyan-500/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-cyan-400">
                <MapPin className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">
                  {siteModalMode === 'create' ? 'Tambah Titik Site Baru' : 'Edit Titik Site Operasional'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowSiteModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSite} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">
                  Kode / ID Site {siteModalMode === 'create' ? '(Opsional, misal: SITE-VALE-D)' : '(ID Permanen)'}
                </label>
                <input
                  type="text"
                  disabled={siteModalMode === 'edit'}
                  placeholder="Auto-generate jika dikosongkan"
                  value={siteFormId}
                  onChange={(e) => setSiteFormId(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono uppercase focus:border-cyan-500 focus:outline-none disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Nama Titik Site *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Site Sorowako Blok D"
                  value={siteFormName}
                  onChange={(e) => setSiteFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Deskripsi / Detail Lokasi</label>
                <textarea
                  rows={3}
                  placeholder="Area operasional Blok D SJS-VIPO..."
                  value={siteFormDesc}
                  onChange={(e) => setSiteFormDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="site_active_checkbox"
                  checked={siteFormActive}
                  onChange={(e) => setSiteFormActive(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <label htmlFor="site_active_checkbox" className="text-slate-300 cursor-pointer">
                  Status Titik Site Aktif (dapat dipilih pada transaksi POS dan unit)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowSiteModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingSite}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold disabled:opacity-50"
                >
                  {savingSite ? 'Menyimpan...' : siteModalMode === 'create' ? 'Simpan Site' : 'Perbarui Site'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL WAREHOUSE (CREATE / EDIT) */}
      {showWarehouseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-cyan-500/40 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-cyan-400">
                <Building2 className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">
                  {warehouseModalMode === 'create' ? 'Tambah Gudang Logistik Baru' : 'Edit Konfigurasi Gudang'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWarehouseModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveWarehouse} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">
                  ID Gudang {warehouseModalMode === 'create' ? '(Opsional, misal: WH-CONT-03 / WH-MAIN-AUX)' : '(ID Permanen)'}
                </label>
                <input
                  type="text"
                  disabled={warehouseModalMode === 'edit'}
                  placeholder="Auto-generate jika dikosongkan"
                  value={warehouseFormId}
                  onChange={(e) => setWarehouseFormId(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono uppercase focus:border-cyan-500 focus:outline-none disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Nama Gudang *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Gudang Kontainer Site C Petea"
                  value={warehouseFormName}
                  onChange={(e) => setWarehouseFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">Tingkat / Tipe Gudang *</label>
                  <select
                    value={warehouseFormType}
                    onChange={(e) => setWarehouseFormType(e.target.value as any)}
                    className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    <option value="CONTAINER">📦 Gudang Sub (Kontainer Lapangan)</option>
                    <option value="MAIN">🏢 Gudang Induk (Pusat / Main Hub)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-400">Kategori Gudang *</label>
                    <button
                      type="button"
                      onClick={() => {
                        loadCategories();
                        handleOpenCreateCategory();
                        setShowCategoryModal(true);
                      }}
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-0.5"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      <span>+ Kelola</span>
                    </button>
                  </div>
                  <select
                    value={warehouseFormCategory}
                    onChange={(e) => setWarehouseFormCategory(e.target.value)}
                    className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-cyan-500 focus:outline-none"
                  >
                    {warehouseCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} {!cat.is_active ? '(Non-Aktif)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {warehouseFormType === 'CONTAINER' && (
                <div className="p-3 bg-slate-950/60 rounded-xl border border-indigo-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-indigo-300 font-semibold flex items-center gap-1.5">
                      <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Gudang Induk Penyuplai (Dapat Lebih dari 1) *</span>
                    </label>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono font-bold">
                      {warehouseFormParentIds.length} terpilih
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Centang satu atau beberapa Gudang Induk yang menjadi sumber pasokan (drop STO & replenishment) untuk Gudang Sub ini:
                  </p>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {warehouses
                      .filter((w) => w.warehouse_type === 'MAIN')
                      .map((mw) => {
                        const isSelected = warehouseFormParentIds.includes(mw.id);
                        const catName = warehouseCategories.find((c) => c.id === mw.category)?.name || mw.category;
                        return (
                          <div
                            key={mw.id}
                            onClick={() => toggleParentWarehouse(mw.id)}
                            className={`p-2 rounded-lg border cursor-pointer transition flex items-center justify-between gap-2 ${
                              isSelected
                                ? 'bg-indigo-950/40 border-indigo-500/50 text-white'
                                : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}} // handled by parent onClick
                                className="w-4 h-4 rounded border-slate-700 text-indigo-500 focus:ring-0 cursor-pointer"
                              />
                              <div>
                                <div className="text-xs font-semibold">{mw.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">
                                  {mw.id} • {catName}
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-medium">
                                Penyuplai Aktif
                              </span>
                            )}
                          </div>
                        );
                      })}
                  </div>

                  <div className="flex items-center justify-between pt-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        const allMainIds = warehouses.filter((w) => w.warehouse_type === 'MAIN').map((w) => w.id);
                        setWarehouseFormParentIds(allMainIds);
                      }}
                      className="text-indigo-400 hover:text-indigo-300 underline"
                    >
                      Pilih Semua Gudang Induk
                    </button>
                    {warehouseFormParentIds.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setWarehouseFormParentIds([])}
                        className="text-slate-400 hover:text-rose-400 underline"
                      >
                        Kosongkan Pilihan
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-slate-400 mb-1">Deskripsi / Keterangan</label>
                <textarea
                  rows={3}
                  placeholder="Gudang kontainer operasional penyedia suku cadang cepat tanggap..."
                  value={warehouseFormDesc}
                  onChange={(e) => setWarehouseFormDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="warehouse_active_checkbox"
                  checked={warehouseFormActive}
                  onChange={(e) => setWarehouseFormActive(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <label htmlFor="warehouse_active_checkbox" className="text-slate-300 cursor-pointer">
                  Status Gudang Aktif (dapat digunakan untuk penyimpanan stok & transaksi)
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowWarehouseModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingWarehouse}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold disabled:opacity-50"
                >
                  {savingWarehouse ? 'Menyimpan...' : warehouseModalMode === 'create' ? 'Simpan Gudang' : 'Perbarui Gudang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KELOLA MASTER KATEGORI GUDANG */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-2xl rounded-2xl border border-cyan-500/40 p-6 shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-cyan-400">
                <Tag className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">Master Kategori Gudang Logistik</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                  {warehouseCategories.length} Kategori
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-hidden flex-1">
              {/* Form Tambah/Edit Kategori (2 kolom) */}
              <div className="md:col-span-2 p-4 bg-slate-900/80 rounded-xl border border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-cyan-400 flex items-center justify-between">
                  <span>{catEditMode === 'create' ? '+ Tambah Kategori' : 'Edit Kategori'}</span>
                  {catEditMode === 'edit' && (
                    <button
                      type="button"
                      onClick={handleOpenCreateCategory}
                      className="text-[10px] text-slate-400 hover:text-white underline font-normal"
                    >
                      Batal Edit
                    </button>
                  )}
                </h4>

                <form onSubmit={handleSaveCategory} className="space-y-2.5 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">
                      ID Kategori {catEditMode === 'create' ? '(Opsional)' : '(ID Permanen)'}
                    </label>
                    <input
                      type="text"
                      disabled={catEditMode === 'edit'}
                      placeholder="e.g. DRILLING / FIXED_PLANT"
                      value={catFormId}
                      onChange={(e) => setCatFormId(e.target.value.toUpperCase())}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white font-mono uppercase focus:border-cyan-500 focus:outline-none disabled:opacity-60"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Nama Kategori *</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Drilling & Exploration Fleet"
                      value={catFormName}
                      onChange={(e) => setCatFormName(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Keterangan / Cakupan</label>
                    <textarea
                      rows={2}
                      placeholder="Suku cadang peralatan pengeboran dan eksplorasi..."
                      value={catFormDesc}
                      onChange={(e) => setCatFormDesc(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="cat_active_checkbox"
                      checked={catFormActive}
                      onChange={(e) => setCatFormActive(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-700 text-cyan-500 focus:ring-0"
                    />
                    <label htmlFor="cat_active_checkbox" className="text-slate-300 cursor-pointer text-[11px]">
                      Kategori Aktif
                    </label>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={savingCategory}
                      className="w-full py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs disabled:opacity-50"
                    >
                      {savingCategory ? 'Menyimpan...' : catEditMode === 'create' ? '+ Simpan Kategori' : 'Perbarui Kategori'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Daftar Kategori (3 kolom) */}
              <div className="md:col-span-3 space-y-2 overflow-y-auto max-h-[50vh] pr-1">
                <h4 className="text-xs font-semibold text-slate-400 sticky top-0 bg-slate-950/80 py-1">
                  Daftar Kategori Terdaftar
                </h4>
                {warehouseCategories.map((cat) => (
                  <div
                    key={cat.id}
                    className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-start justify-between gap-2 hover:border-slate-700 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-800/40">
                          {cat.id}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${
                            cat.is_active
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {cat.is_active ? 'Aktif' : 'Non-Aktif'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-200">{cat.name}</p>
                      {cat.description && (
                        <p className="text-[11px] text-slate-400 line-clamp-2">{cat.description}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditCategory(cat)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                        title="Edit Kategori"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat)}
                        className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-400 hover:text-rose-200 border border-rose-800/40 transition"
                        title="Hapus / Nonaktifkan Kategori"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCategoryModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DEVICE (CREATE / EDIT) */}
      {showDeviceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-cyan-500/40 p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-cyan-400">
                <Smartphone className="w-5 h-5" />
                <h3 className="text-sm font-bold text-white">
                  {deviceModalMode === 'create' ? 'Tambah Perangkat Mobile Baru' : 'Edit Perangkat Mobile'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDeviceModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDevice} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">Device ID (Unik) *</label>
                <input
                  type="text"
                  required
                  disabled={deviceModalMode === 'edit'}
                  placeholder="Contoh: ANDROID-WH-003 atau TAB-MEK-01"
                  value={deviceFormId}
                  onChange={(e) => setDeviceFormId(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono uppercase focus:border-cyan-500 focus:outline-none disabled:opacity-50 disabled:bg-slate-950"
                />
                {deviceModalMode === 'create' && (
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    ID ini akan dicatat pada aplikasi Android dan menjadi pengenal saat sinkronisasi offline.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Nama / Model Perangkat *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Zebra TC57 Handheld Kontainer Sorowako"
                  value={deviceFormName}
                  onChange={(e) => setDeviceFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Gudang Penugasan</label>
                <select
                  value={deviceFormWarehouseId}
                  onChange={(e) => setDeviceFormWarehouseId(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="">-- Tanpa Penugasan Gudang --</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.id} - {w.name} ({w.warehouse_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Penanggung Jawab / Karyawan (Opsional)</label>
                <select
                  value={deviceFormUserId}
                  onChange={(e) => setDeviceFormUserId(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-200 focus:border-cyan-500 focus:outline-none"
                >
                  <option value="">-- Tanpa Penanggung Jawab Khusus --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} {emp.position ? `(${emp.position})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Versi Aplikasi (Default: 2.0.0)</label>
                <input
                  type="text"
                  placeholder="2.0.0"
                  value={deviceFormAppVersion}
                  onChange={(e) => setDeviceFormAppVersion(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <PhotoUploadZone
                value={deviceFormPhotoUrl}
                onChange={setDeviceFormPhotoUrl}
                label="Foto Fisik Perangkat Hardware"
                helperText="Pilih dari folder laptop/PC, atau ambil gambar langsung jika memakai Handphone"
              />

              <div>
                <label className="block text-slate-400 mb-1">Kode QR / Barcode Stiker Aset (Opsional)</label>
                <input
                  type="text"
                  placeholder={`DEVICE:${deviceFormId || 'ANDROID-WH-XXX'}`}
                  value={deviceFormQrCode}
                  onChange={(e) => setDeviceFormQrCode(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono focus:border-cyan-500 focus:outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Format default: DEVICE:ID_PERANGKAT (digunakan untuk cetak label stiker aset).
                </p>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="device_active_checkbox"
                  checked={deviceFormActive}
                  onChange={(e) => setDeviceFormActive(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <label htmlFor="device_active_checkbox" className="text-slate-300 cursor-pointer">
                  Perangkat Aktif & Diizinkan Sinkronisasi Batch
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDeviceModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingDevice}
                  className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold disabled:opacity-50"
                >
                  {savingDevice
                    ? 'Menyimpan...'
                    : deviceModalMode === 'create'
                    ? 'Simpan Perangkat'
                    : 'Perbarui Perangkat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETAIL PERANGKAT MOBILE */}
      {selectedDeviceDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-panel w-full max-w-2xl rounded-2xl border border-cyan-500/40 p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-cyan-400 bg-cyan-950/50 px-2.5 py-0.5 rounded border border-cyan-800/60">
                      {selectedDeviceDetail.device_id}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border flex items-center gap-1 ${
                        selectedDeviceDetail.is_active
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      }`}
                    >
                      {selectedDeviceDetail.is_active ? <CheckCircle className="w-3 h-3" /> : <PowerOff className="w-3 h-3" />}
                      {selectedDeviceDetail.is_active ? 'Aktif & Diizinkan Sync' : 'Non-Aktif (Dicabut)'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-1">{selectedDeviceDetail.device_name}</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDeviceDetail(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: 2 Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Kolom Kiri: Foto Perangkat & QR Code */}
              <div className="space-y-4">
                {/* Foto Perangkat */}
                <div className="glass-card p-4 rounded-xl border border-slate-800/80 space-y-2">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Camera className="w-4 h-4 text-cyan-400" /> Foto Fisik Perangkat
                  </span>
                  {selectedDeviceDetail.photo_url ? (
                    <div className="relative group overflow-hidden rounded-xl border border-slate-700 bg-slate-900 aspect-video flex items-center justify-center">
                      <img
                        src={selectedDeviceDetail.photo_url}
                        alt={selectedDeviceDetail.device_name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-6 text-center space-y-2">
                      <Smartphone className="w-8 h-8 text-slate-600 mx-auto" />
                      <p className="text-xs text-slate-400">Belum ada foto fisik perangkat.</p>
                      {canManageMaster && (
                        <button
                          type="button"
                          onClick={() => {
                            const dev = selectedDeviceDetail;
                            setSelectedDeviceDetail(null);
                            openEditDeviceModal(dev);
                          }}
                          className="text-[11px] text-cyan-400 hover:underline font-semibold"
                        >
                          + Tambah Foto via Edit
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* QR Code Aset & Stiker Print */}
                <div className="glass-card p-4 rounded-xl border border-slate-800/80 space-y-3">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <QrIcon className="w-4 h-4 text-cyan-400" /> Label QR Code / Barcode Aset
                  </span>
                  <div className="flex justify-center bg-slate-900/60 p-3 rounded-xl border border-slate-800">
                    <QrCodeView
                      value={selectedDeviceDetail.qr_code || `DEVICE:${selectedDeviceDetail.device_id}`}
                      size={150}
                      title={selectedDeviceDetail.device_id}
                      subtitle={selectedDeviceDetail.device_name}
                      warehouseName={selectedDeviceDetail.assigned_warehouse_name || selectedDeviceDetail.assigned_warehouse_id || 'Belum Ditugaskan'}
                      showActions={true}
                    />
                  </div>
                </div>
              </div>

              {/* Kolom Kanan: Rincian Spesifikasi & Heartbeat */}
              <div className="space-y-3">
                <div className="glass-card p-4 rounded-xl border border-slate-800/80 space-y-3 text-xs">
                  <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-cyan-400" /> Informasi Teknis & Audit
                  </span>

                  <div className="space-y-2.5 pt-1">
                    <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                      <span className="text-slate-400">Device ID:</span>
                      <span className="font-mono font-bold text-cyan-400">{selectedDeviceDetail.device_id}</span>
                    </div>

                    <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                      <span className="text-slate-400">Model / Nama:</span>
                      <span className="font-semibold text-slate-200 text-right">{selectedDeviceDetail.device_name}</span>
                    </div>

                    <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                      <span className="text-slate-400">Gudang Penugasan:</span>
                      <span className="font-medium text-slate-200 text-right">
                        {selectedDeviceDetail.assigned_warehouse_name
                          ? `${selectedDeviceDetail.assigned_warehouse_id} - ${selectedDeviceDetail.assigned_warehouse_name}`
                          : selectedDeviceDetail.assigned_warehouse_id || 'Tidak Ditugaskan'}
                      </span>
                    </div>

                    <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                      <span className="text-slate-400">Penanggung Jawab:</span>
                      <span className="font-medium text-slate-200 text-right">
                        {selectedDeviceDetail.assigned_user_name || 'Umum / Pool Lapangan'}
                      </span>
                    </div>

                    <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                      <span className="text-slate-400">Versi LogistikQu Android:</span>
                      <span className="font-mono text-slate-300">v{selectedDeviceDetail.app_version || '2.0.0'}</span>
                    </div>

                    <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                      <span className="text-slate-400">Isi QR Code Text:</span>
                      <span className="font-mono text-[11px] text-slate-400 text-right break-all">
                        {selectedDeviceDetail.qr_code || `DEVICE:${selectedDeviceDetail.device_id}`}
                      </span>
                    </div>

                    <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                      <span className="text-slate-400">Terakhir Sinkronisasi:</span>
                      <span className="font-mono font-medium text-cyan-300 text-right">
                        {formatLastSync(selectedDeviceDetail.last_sync_at)}
                      </span>
                    </div>

                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-400">Didaftarkan Pada:</span>
                      <span className="text-slate-300 font-mono text-[11px]">
                        {new Date(selectedDeviceDetail.created_at).toLocaleString('id-ID')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Info Callout */}
                <div className="bg-cyan-950/30 border border-cyan-800/40 rounded-xl p-3 text-[11px] text-cyan-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" /> Pemasangan Stiker Aset
                  </div>
                  <p className="text-cyan-200/80 leading-relaxed">
                    Cetak QR Code di samping menggunakan printer label tahan cuaca (thermal/laminated) dan tempelkan pada bagian belakang tablet/handheld sebagai tanda registrasi resmi inventaris IT SJS-VIPO.
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              {canManageMaster && (
                <button
                  type="button"
                  onClick={() => {
                    const dev = selectedDeviceDetail;
                    setSelectedDeviceDetail(null);
                    openEditDeviceModal(dev);
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Edit2 className="w-3.5 h-3.5" /> Edit Perangkat
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedDeviceDetail(null)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold ml-auto"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
