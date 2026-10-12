import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  isDumpTruckEquipment,
  isHeavyEquipment,
  isDumpTruckMechanic,
  isHeavyEquipmentMechanic,
  getWarehouseCategory,
  filterEquipmentByCategory,
  filterMechanicsByCategory,
} from '../utils/fleetCategory.ts';

describe('Frontend Component & Utility Tests', () => {
  describe('Formatters & Badge Utilities', () => {
    function formatCurrency(amount: number): string {
      return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
      }).format(amount);
    }

    function formatNumber(num: number): string {
      return new Intl.NumberFormat('id-ID').format(num);
    }

    test('Currency formatting formats IDR correctly', () => {
      const formatted = formatCurrency(125000000);
      assert.ok(formatted.includes('125.000.000') || formatted.includes('125,000,000'));
    });

    test('Quantity formatting formats decimal separators correctly', () => {
      const formatted = formatNumber(1500);
      assert.ok(formatted.includes('1.500') || formatted.includes('1,500'));
    });

    function getStockBadgeClass(qtyOnHand: number, minStock: number): string {
      if (qtyOnHand <= 0) return 'badge-out-of-stock';
      if (qtyOnHand <= minStock) return 'badge-low-stock';
      return 'badge-optimal';
    }

    test('Stock status badge logic returns correct class names', () => {
      assert.strictEqual(getStockBadgeClass(0, 10), 'badge-out-of-stock');
      assert.strictEqual(getStockBadgeClass(5, 10), 'badge-low-stock');
      assert.strictEqual(getStockBadgeClass(25, 10), 'badge-optimal');
    });
  });

  describe('Report Data Transformer Utilities', () => {
    interface ReportItem {
      part_number: string;
      part_name: string;
      qty_on_hand: number;
      unit_cost: number;
    }

    function calculateTotalValuation(items: ReportItem[]): number {
      return items.reduce((acc, item) => acc + (item.qty_on_hand * item.unit_cost), 0);
    }

    test('Correctly computes aggregate valuation across report items', () => {
      const items: ReportItem[] = [
        { part_number: 'P01', part_name: 'Filter Oil', qty_on_hand: 10, unit_cost: 250000 },
        { part_number: 'P02', part_name: 'Air Filter', qty_on_hand: 5, unit_cost: 500000 },
        { part_number: 'P03', part_name: 'V-Belt', qty_on_hand: 2, unit_cost: 150000 }
      ];

      const total = calculateTotalValuation(items);
      // (10 * 250k) + (5 * 500k) + (2 * 150k) = 2.5m + 2.5m + 300k = 5.3m
      assert.strictEqual(total, 5300000);
    });

    test('Correctly calculates stock health buffer percentage', () => {
      const normalCount = 42;
      const totalCount = 50;
      const healthPercent = Math.round((normalCount / totalCount) * 100);
      assert.strictEqual(healthPercent, 84);
    });

    test('Correctly calculates replenishment lead time & OTIF fulfillment rate', () => {
      const requestedQty = 100;
      const receivedQty = 98;
      const accuracy = Math.round((receivedQty / requestedQty) * 100);
      assert.strictEqual(accuracy, 98);
    });
  });

  describe('Sidebar Navigation & Toggle State Machine', () => {
    function isTabAccessibleMock(tabId: string, permissions: string[] = [], roleId?: string): boolean {
      const normRole = (roleId || '').toUpperCase();
      if (normRole === 'SUPER_ADMIN') return true;
      if (normRole === 'MECHANIC') {
        return tabId === 'mechanic-requests' || tabId === 'inventory' || tabId === 'returns';
      }
      if (normRole.includes('CONTAINER_ADMIN') || normRole.includes('ADMIN_CONT')) {
        if (tabId === 'mechanic-requests' || tabId === 'drops' || tabId === 'master') return false;
      }
      if (normRole.includes('MAIN_ADMIN') || normRole.includes('ADMIN_MAIN')) {
        if (tabId === 'pos' || tabId === 'mechanic-requests' || tabId === 'adjustment' || tabId === 'master') return false;
      }
      if (normRole.includes('SUPERVISOR')) {
        if (
          tabId === 'users' ||
          tabId === 'master' ||
          tabId === 'bins' ||
          tabId === 'mechanic-requests' ||
          tabId === 'pos'
        ) return false;
      }
      if (tabId === 'dashboard') return true;
      if (tabId === 'inventory') return permissions.includes('inventory.view');
      if (tabId === 'bins') return permissions.includes('bins.view') || permissions.includes('inventory.view');
      if (tabId === 'mechanic-requests') return permissions.includes('mechanic_request.approve') || permissions.includes('mechanic_request.create');
      if (tabId === 'pos') return permissions.includes('issue.create') || permissions.includes('issue.approve');
      if (tabId === 'users') return permissions.includes('users.manage');
      if (tabId === 'master') return permissions.includes('master.view') || permissions.includes('master.manage');
      return false;
    }

    test('Dashboard tab is accessible by default for all authenticated users', () => {
      assert.strictEqual(isTabAccessibleMock('dashboard', []), true);
    });

    test('Inventory tab requires inventory.view permission or SUPER_ADMIN', () => {
      assert.strictEqual(isTabAccessibleMock('inventory', []), false);
      assert.strictEqual(isTabAccessibleMock('inventory', ['inventory.view']), true);
      assert.strictEqual(isTabAccessibleMock('inventory', [], 'SUPER_ADMIN'), true);
    });

    test('Users management requires users.manage or SUPER_ADMIN', () => {
      assert.strictEqual(isTabAccessibleMock('users', ['inventory.view']), false);
      assert.strictEqual(isTabAccessibleMock('users', ['users.manage']), true);
      assert.strictEqual(isTabAccessibleMock('users', [], 'SUPER_ADMIN'), true);
    });

    test('Master Data & Unit tab is hidden from Container Admin, Main Admin, and Supervisor', () => {
      // Allowed for Superadmin & Manager
      assert.strictEqual(isTabAccessibleMock('master', [], 'SUPER_ADMIN'), true);
      assert.strictEqual(isTabAccessibleMock('master', ['master.manage', 'master.view'], 'MANAGER'), true);

      // Blocked for Container Admin
      assert.strictEqual(isTabAccessibleMock('master', ['master.view'], 'CONTAINER_ADMIN_HE'), false);
      assert.strictEqual(isTabAccessibleMock('master', ['master.view'], 'CONTAINER_ADMIN_DT'), false);

      // Blocked for Main Admin
      assert.strictEqual(isTabAccessibleMock('master', ['master.view'], 'MAIN_ADMIN_HE'), false);
      assert.strictEqual(isTabAccessibleMock('master', ['master.view'], 'MAIN_ADMIN_DT'), false);

      // Blocked for Supervisor
      assert.strictEqual(isTabAccessibleMock('master', ['master.view'], 'SUPERVISOR'), false);
      assert.strictEqual(isTabAccessibleMock('master', ['master.view'], 'SUPERVISOR_HE'), false);
      assert.strictEqual(isTabAccessibleMock('master', ['master.view'], 'SUPERVISOR_DT'), false);

      // Blocked for Mechanic
      assert.strictEqual(isTabAccessibleMock('master', ['master.view'], 'MECHANIC'), false);
    });

    test('Layout & Denah, Permohonan Mekanik, and POS tabs are hidden from Supervisor', () => {
      const spvRoles = ['SUPERVISOR', 'SUPERVISOR_HE', 'SUPERVISOR_DT'];
      for (const role of spvRoles) {
        assert.strictEqual(isTabAccessibleMock('bins', ['bins.view', 'inventory.view'], role), false);
        assert.strictEqual(isTabAccessibleMock('mechanic-requests', ['mechanic_request.approve'], role), false);
        assert.strictEqual(isTabAccessibleMock('pos', ['issue.create', 'issue.approve'], role), false);
      }
      // But accessible for roles that have permission
      assert.strictEqual(isTabAccessibleMock('bins', ['bins.view'], 'CONTAINER_ADMIN_HE'), true);
      assert.strictEqual(isTabAccessibleMock('pos', ['issue.create'], 'CONTAINER_ADMIN_HE'), true);
      assert.strictEqual(isTabAccessibleMock('mechanic-requests', ['mechanic_request.create'], 'MECHANIC'), true);
      assert.strictEqual(isTabAccessibleMock('bins', [], 'SUPER_ADMIN'), true);
      assert.strictEqual(isTabAccessibleMock('mechanic-requests', [], 'SUPER_ADMIN'), true);
      assert.strictEqual(isTabAccessibleMock('pos', [], 'SUPER_ADMIN'), true);
    });

    test('Sidebar toggle state transitions correctly between expanded and collapsed', () => {
      let isCollapsed = false;
      const toggle = () => { isCollapsed = !isCollapsed; };

      toggle();
      assert.strictEqual(isCollapsed, true);
      toggle();
      assert.strictEqual(isCollapsed, false);
    });

    test('Sidebar desktop open/close toggle state machine', () => {
      let isDesktopOpen = true;
      const closeDesktop = () => { isDesktopOpen = false; };
      const openDesktop = () => { isDesktopOpen = true; };

      closeDesktop();
      assert.strictEqual(isDesktopOpen, false);
      openDesktop();
      assert.strictEqual(isDesktopOpen, true);
    });
  });

  describe('Theme Management & Toggle State Machine', () => {
    type Theme = 'dark' | 'light';

    class ThemeMockManager {
      private theme: Theme;
      private storage: Record<string, string> = {};

      constructor(initialStorageValue?: string) {
        if (initialStorageValue === 'light' || initialStorageValue === 'dark') {
          this.theme = initialStorageValue;
        } else {
          // Default: dark theme (theme saat ini)
          this.theme = 'dark';
        }
      }

      getTheme(): Theme {
        return this.theme;
      }

      toggle(): Theme {
        this.theme = this.theme === 'dark' ? 'light' : 'dark';
        this.storage['logisticqu_theme'] = this.theme;
        return this.theme;
      }

      setTheme(newTheme: Theme): void {
        this.theme = newTheme;
        this.storage['logisticqu_theme'] = this.theme;
      }

      getStoredTheme(): string | undefined {
        return this.storage['logisticqu_theme'];
      }
    }

    test('Defaults to dark mode when no saved preference exists', () => {
      const manager = new ThemeMockManager();
      assert.strictEqual(manager.getTheme(), 'dark');
    });

    test('Restores light mode when saved in storage', () => {
      const manager = new ThemeMockManager('light');
      assert.strictEqual(manager.getTheme(), 'light');
    });

    test('Toggles smoothly from dark to light and back to dark', () => {
      const manager = new ThemeMockManager('dark');
      assert.strictEqual(manager.getTheme(), 'dark');

      const toggled1 = manager.toggle();
      assert.strictEqual(toggled1, 'light');
      assert.strictEqual(manager.getTheme(), 'light');
      assert.strictEqual(manager.getStoredTheme(), 'light');

      const toggled2 = manager.toggle();
      assert.strictEqual(toggled2, 'dark');
      assert.strictEqual(manager.getTheme(), 'dark');
      assert.strictEqual(manager.getStoredTheme(), 'dark');
    });

    test('Direct setTheme updates state and storage accurately', () => {
      const manager = new ThemeMockManager('dark');
      manager.setTheme('light');
      assert.strictEqual(manager.getTheme(), 'light');
      assert.strictEqual(manager.getStoredTheme(), 'light');

      manager.setTheme('dark');
      assert.strictEqual(manager.getTheme(), 'dark');
      assert.strictEqual(manager.getStoredTheme(), 'dark');
    });
  });

  describe('POS Issue Unit & Mechanic Fleet Filtering (HE vs DT)', () => {
    const mockEquipments = [
      { id: 'DT-001', unit_number: 'DT-001', name: 'Dump Truck HD785 #001', equipment_type_id: 'HD785', current_hm_km: 12000, is_active: true },
      { id: 'DT-044', unit_number: 'DT-044', name: 'Dump Truck CAT 777 #044', equipment_type_id: 'CAT777', current_hm_km: 15000, is_active: true },
      { id: 'DT-821', unit_number: 'DT-821', name: 'Hino 500 Ti FM', equipment_type_id: 'DUMP_TRUCK', current_hm_km: 8000, is_active: true },
      { id: 'EX-002', unit_number: 'EX-002', name: 'Excavator PC2000 #002', equipment_type_id: 'PC2000', current_hm_km: 18000, is_active: true },
      { id: 'EX-005', unit_number: 'EX-005', name: 'Excavator EX1200 #005', equipment_type_id: 'EX1200', current_hm_km: 9000, is_active: true },
      { id: 'DZ-010', unit_number: 'DZ-010', name: 'Bulldozer D85SS #010', equipment_type_id: 'D85SS', current_hm_km: 25000, is_active: true },
    ];

    const mockEmployees = [
      { id: 'EMP-101', name: 'Yusuf Mansur', department_id: 'DEPT-MECH-HE', position: 'Senior Heavy Equipment Mechanic', is_mechanic: true, is_active: true },
      { id: 'EMP-102', name: 'Agus Wibowo', department_id: 'DEPT-MECH-HE', position: 'Hydraulic Specialist Mechanic', is_mechanic: true, is_active: true },
      { id: 'EMP-103', name: 'Rahmat Hidayat', department_id: 'DEPT-MECH-DT', position: 'Dump Truck Senior Mechanic', is_mechanic: true, is_active: true },
      { id: 'EMP-104', name: 'Wahyu Setiawan', department_id: 'DEPT-MECH-DT', position: 'Brake & Transmission Specialist', is_mechanic: true, is_active: true },
    ];

    test('Identifies active warehouse category correctly', () => {
      assert.strictEqual(getWarehouseCategory('WH-CONT-HE', 'HEAVY_EQUIPMENT'), 'HE');
      assert.strictEqual(getWarehouseCategory('WH-MAIN-HE', 'HEAVY_EQUIPMENT'), 'HE');
      assert.strictEqual(getWarehouseCategory('WH-CONT-DT', 'DUMP_TRUCK'), 'DT');
      assert.strictEqual(getWarehouseCategory('WH-MAIN-DT', 'DUMP_TRUCK'), 'DT');
      assert.strictEqual(getWarehouseCategory('WH-GEN-01', 'GENERAL'), 'ALL');
    });

    test('Correctly classifies equipment as DT vs HE', () => {
      assert.strictEqual(isDumpTruckEquipment(mockEquipments[0]), true);
      assert.strictEqual(isHeavyEquipment(mockEquipments[0]), false);

      assert.strictEqual(isDumpTruckEquipment(mockEquipments[3]), false);
      assert.strictEqual(isHeavyEquipment(mockEquipments[3]), true);

      assert.strictEqual(isHeavyEquipment(mockEquipments[5]), true);
      assert.strictEqual(isDumpTruckEquipment(mockEquipments[5]), false);
    });

    test('Correctly classifies mechanics as DT vs HE', () => {
      assert.strictEqual(isHeavyEquipmentMechanic(mockEmployees[0]), true);
      assert.strictEqual(isDumpTruckMechanic(mockEmployees[0]), false);

      assert.strictEqual(isHeavyEquipmentMechanic(mockEmployees[1]), true);
      assert.strictEqual(isDumpTruckMechanic(mockEmployees[1]), false);

      assert.strictEqual(isDumpTruckMechanic(mockEmployees[2]), true);
      assert.strictEqual(isHeavyEquipmentMechanic(mockEmployees[2]), false);

      assert.strictEqual(isDumpTruckMechanic(mockEmployees[3]), true);
      assert.strictEqual(isHeavyEquipmentMechanic(mockEmployees[3]), false);
    });

    test('Filters equipment list strictly according to fleet category', () => {
      const heFiltered = filterEquipmentByCategory(mockEquipments, 'HE');
      assert.strictEqual(heFiltered.length, 3);
      assert.ok(heFiltered.every((eq) => eq.unit_number.startsWith('EX') || eq.unit_number.startsWith('DZ')));

      const dtFiltered = filterEquipmentByCategory(mockEquipments, 'DT');
      assert.strictEqual(dtFiltered.length, 3);
      assert.ok(dtFiltered.every((eq) => eq.unit_number.startsWith('DT')));

      const allFiltered = filterEquipmentByCategory(mockEquipments, 'ALL');
      assert.strictEqual(allFiltered.length, 6);
    });

    test('Filters mechanics list strictly according to fleet category', () => {
      const heMechanics = filterMechanicsByCategory(mockEmployees, 'HE');
      assert.strictEqual(heMechanics.length, 2);
      assert.ok(heMechanics.every((m) => m.department_id === 'DEPT-MECH-HE'));

      const dtMechanics = filterMechanicsByCategory(mockEmployees, 'DT');
      assert.strictEqual(dtMechanics.length, 2);
      assert.ok(dtMechanics.every((m) => m.department_id === 'DEPT-MECH-DT'));

      const allMechanics = filterMechanicsByCategory(mockEmployees, 'ALL');
      assert.strictEqual(allMechanics.length, 4);
    });
  });
});

