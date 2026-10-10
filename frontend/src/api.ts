import axios from 'axios';
import type {
  AuditLog,
  CreateIssuePayload,
  DashboardSummary,
  DemoUser,
  Employee,
  Equipment,
  InventoryStockItem,
  IssueDetail,
  IssueTransaction,
  MainDrop,
  MechanicReport,
  RecommendationItem,
  ReplenishmentDetail,
  ReplenishmentRequest,
  Site,
  SiteReport,
  SparePart,
  StockAdjustment,
  StockMovement,
  UnitReport,
  UserProfile,
  WarehouseInfo,
  UserManagementItem,
  RoleItem,
  CreateUserPayload,
  UpdateUserPayload,
  UpdateProfilePayload,
  CreateEquipmentPayload,
  CreateEmployeePayload,
  UpdateSparePartPayload,
  UsedPartReturn,
  ReceiveContainerReturnPayload,
  TransferMainReturnPayload,
  CompleteReturnPayload,
} from './types';

export const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('logisticqu_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  login: async (username: string, password: string = 'password123') => {
    const res = await api.post<{ token: string; user: UserProfile }>('/auth/login', { username, password });
    return res.data;
  },
  getMe: async () => {
    const res = await api.get<UserProfile>('/auth/me');
    return res.data;
  },
  updateProfile: async (payload: UpdateProfilePayload) => {
    const res = await api.put<UserProfile>('/auth/profile', payload);
    return res.data;
  },
  getDemoUsers: async () => {
    const res = await api.get<{ demo_users: DemoUser[] }>('/auth/demo-users');
    return res.data.demo_users;
  },
};

export const masterApi = {
  getSpareParts: async (search?: string) => {
    const res = await api.get<SparePart[]>('/master/spare-parts', { params: { search } });
    return res.data;
  },
  getEquipment: async (search?: string) => {
    const res = await api.get<Equipment[]>('/master/equipment', { params: { search } });
    return res.data;
  },
  getEmployees: async () => {
    const res = await api.get<Employee[]>('/master/employees');
    return res.data;
  },
  getSites: async () => {
    const res = await api.get<Site[]>('/master/sites');
    return res.data;
  },
  getWarehouses: async () => {
    const res = await api.get<WarehouseInfo[]>('/master/warehouses');
    return res.data;
  },
  createEquipment: async (payload: CreateEquipmentPayload) => {
    const res = await api.post<{ success: boolean; equipment_id: string; message: string }>('/master/equipment', payload);
    return res.data;
  },
  createEmployee: async (payload: CreateEmployeePayload) => {
    const res = await api.post<{ success: boolean; employee_id: string; message: string }>('/master/employees', payload);
    return res.data;
  },
  updateSparePart: async (id: string, payload: UpdateSparePartPayload) => {
    const res = await api.put<{ success: boolean; message: string }>(`/master/spare-parts/${id}`, payload);
    return res.data;
  },
};

export const inventoryApi = {
  getStock: async (warehouse_id: string, search?: string) => {
    const res = await api.get<InventoryStockItem[]>('/inventory/stock', {
      params: { warehouse_id, search },
    });
    return res.data;
  },
  getMovements: async (warehouse_id: string, spare_part_id: string) => {
    const res = await api.get<StockMovement[]>(`/inventory/stock/${warehouse_id}/${spare_part_id}/movements`);
    return res.data;
  },
  getDashboardSummary: async (warehouse_id: string) => {
    const res = await api.get<DashboardSummary>('/inventory/dashboard-summary', {
      params: { warehouse_id },
    });
    return res.data;
  },
  importInitialStock: async (warehouse_id: string, rows: any[]) => {
    const res = await api.post('/inventory/import-initial', { warehouse_id, rows });
    return res.data;
  },
};

export const issueApi = {
  createIssue: async (payload: CreateIssuePayload, force?: boolean) => {
    const res = await api.post<{
      success?: boolean;
      duplicate_warning?: boolean;
      message?: string;
      transaction_number?: string;
      issue_id?: string;
    }>('/issues', payload, { params: { force } });
    return res.data;
  },
  listIssues: async (warehouse_id: string, search?: string, status?: string) => {
    const res = await api.get<IssueTransaction[]>('/issues', {
      params: { warehouse_id, search, status },
    });
    return res.data;
  },
  getIssueDetail: async (id: string) => {
    const res = await api.get<IssueDetail>(`/issues/${id}`);
    return res.data;
  },
  approveCritical: async (id: string) => {
    const res = await api.post(`/issues/${id}/approve`);
    return res.data;
  },
};

export const replenishmentApi = {
  getRecommendations: async (warehouse_id: string) => {
    const res = await api.get<RecommendationItem[]>('/replenishment/recommendations', {
      params: { warehouse_id },
    });
    return res.data;
  },
  createRequest: async (container_warehouse_id: string, items: any[], notes?: string) => {
    const res = await api.post('/replenishment/requests', {
      container_warehouse_id,
      items,
      notes,
    });
    return res.data;
  },
  listRequests: async (warehouse_id?: string, status?: string) => {
    const res = await api.get<ReplenishmentRequest[]>('/replenishment/requests', {
      params: { warehouse_id, status },
    });
    return res.data;
  },
  getRequestDetail: async (id: string) => {
    const res = await api.get<ReplenishmentDetail>(`/replenishment/requests/${id}`);
    return res.data;
  },
  verifyRequest: async (id: string, items: any[], admin_notes?: string) => {
    const res = await api.put(`/replenishment/requests/${id}/verify`, { items, admin_notes });
    return res.data;
  },
  approveRequest: async (id: string, supervisor_notes?: string) => {
    const res = await api.put(`/replenishment/requests/${id}/approve`, { supervisor_notes });
    return res.data;
  },
  supervisorReject: async (id: string, reason: string) => {
    const res = await api.put(`/replenishment/requests/${id}/supervisor-reject`, { reason });
    return res.data;
  },
  returnToContainer: async (id: string, reason: string) => {
    const res = await api.put(`/replenishment/requests/${id}/return-to-container`, { reason });
    return res.data;
  },
  receiveDrop: async (id: string) => {
    const res = await api.post(`/replenishment/requests/${id}/receive`);
    return res.data;
  },
};

export const dropApi = {
  listDrops: async (container_warehouse_id?: string) => {
    const res = await api.get<MainDrop[]>('/drops', { params: { container_warehouse_id } });
    return res.data;
  },
  getDropDetail: async (id: string) => {
    const res = await api.get(`/drops/${id}`);
    return res.data;
  },
};

export const adjustmentApi = {
  createAdjustment: async (warehouse_id: string, reason: string, items: any[], notes?: string) => {
    const res = await api.post('/adjustments', { warehouse_id, reason, items, notes });
    return res.data;
  },
  listAdjustments: async () => {
    const res = await api.get<StockAdjustment[]>('/adjustments');
    return res.data;
  },
  approveAdjustment: async (id: string) => {
    const res = await api.put(`/adjustments/${id}/approve`);
    return res.data;
  },
};

export const reportsApi = {
  byUnit: async () => {
    const res = await api.get<UnitReport[]>('/reports/consumption-by-unit');
    return res.data;
  },
  bySite: async () => {
    const res = await api.get<SiteReport[]>('/reports/consumption-by-site');
    return res.data;
  },
  byMechanic: async () => {
    const res = await api.get<MechanicReport[]>('/reports/consumption-by-mechanic');
    return res.data;
  },
};

export const auditApi = {
  listAuditLogs: async () => {
    const res = await api.get<AuditLog[]>('/audit-logs');
    return res.data;
  },
};

export const userApi = {
  listUsers: async () => {
    const res = await api.get<UserManagementItem[]>('/users');
    return res.data;
  },
  listRoles: async () => {
    const res = await api.get<RoleItem[]>('/roles');
    return res.data;
  },
  createUser: async (payload: CreateUserPayload) => {
    const res = await api.post<{ success: boolean; user_id: string; message: string }>('/users', payload);
    return res.data;
  },
  updateUser: async (id: string, payload: UpdateUserPayload) => {
    const res = await api.put<{ success: boolean; message: string }>(`/users/${id}`, payload);
    return res.data;
  },
};

export const returnsApi = {
  getReturns: async (params?: { warehouse_id?: string; status?: string; search?: string }) => {
    const res = await api.get<UsedPartReturn[]>('/returns', { params });
    return res.data;
  },
  getDetail: async (id: string) => {
    const res = await api.get<UsedPartReturn>(`/returns/${id}`);
    return res.data;
  },
  receiveAtContainer: async (id: string, payload: ReceiveContainerReturnPayload) => {
    const res = await api.post<{ success: boolean; message: string }>(`/returns/${id}/receive-container`, payload);
    return res.data;
  },
  transferToMain: async (id: string, payload: TransferMainReturnPayload) => {
    const res = await api.post<{ success: boolean; message: string }>(`/returns/${id}/transfer-main`, payload);
    return res.data;
  },
  completeReturn: async (id: string, payload: CompleteReturnPayload) => {
    const res = await api.post<{ success: boolean; message: string }>(`/returns/${id}/complete`, payload);
    return res.data;
  },
};

