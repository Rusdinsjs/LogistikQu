import type { Employee, Equipment, UserProfile } from '../types';

export type FleetCategory = 'HE' | 'DT' | 'ALL';

/**
 * Raw helper to check whether a unit number / type / name belongs to the Dump Truck (DT) fleet.
 */
export const isDumpTruckUnitRaw = (
  unitNumber?: string,
  unitType?: string,
  unitName?: string,
  ctNumber?: string
): boolean => {
  const typeId = (unitType || '').trim().toUpperCase();
  const unitNum = (unitNumber || '').trim().toUpperCase();
  const name = (unitName || '').trim().toUpperCase();
  const ct = (ctNumber || '').trim().toUpperCase();

  if (
    typeId === 'HEAVY_EQUIPMENT' ||
    typeId === 'PC2000' ||
    typeId === 'EX1200' ||
    typeId === 'D85SS' ||
    typeId === 'EXCAVATOR' ||
    typeId === 'DOZER' ||
    unitNum.startsWith('EX') ||
    unitNum.startsWith('DZ') ||
    unitNum.startsWith('PC') ||
    unitNum.startsWith('EQ')
  ) {
    return false;
  }

  return (
    typeId === 'DUMP_TRUCK' ||
    typeId === 'DT' ||
    typeId === 'HD785' ||
    typeId === 'CAT777' ||
    typeId.includes('DUMP') ||
    typeId.includes('HAUL') ||
    unitNum.startsWith('DT') ||
    unitNum.startsWith('HD') ||
    ct.startsWith('CT-DT') ||
    name.includes('DUMP') ||
    name.includes('HAUL') ||
    name.includes('HD785') ||
    name.includes('CAT 777') ||
    name.includes('CAT777') ||
    name.includes('SCANIA') ||
    name.includes('VOLVO FMX') ||
    name.includes('HINO') ||
    name.includes('QUESTER') ||
    name.includes('ACTROS')
  );
};

/**
 * Determines whether a unit record matches the requested FleetCategory ('HE', 'DT', or 'ALL').
 */
export const isUnitNumberInCategory = (
  unitNumber?: string,
  unitType?: string,
  unitName?: string,
  category: FleetCategory = 'ALL'
): boolean => {
  if (!category || category === 'ALL') return true;
  const isDt = isDumpTruckUnitRaw(unitNumber, unitType, unitName);
  if (category === 'DT') return isDt;
  if (category === 'HE') return !isDt;
  return true;
};

/**
 * Determines whether an equipment unit belongs to the Dump Truck (DT) fleet.
 */
export const isDumpTruckEquipment = (eq: Equipment): boolean => {
  return isDumpTruckUnitRaw(eq.unit_number, eq.equipment_type_id, eq.name, eq.ct_number);
};

/**
 * Determines whether an equipment unit belongs to the Heavy Equipment (HE) fleet.
 */
export const isHeavyEquipment = (eq: Equipment): boolean => {
  const typeId = (eq.equipment_type_id || '').toUpperCase();
  const unitNum = (eq.unit_number || '').toUpperCase();
  const name = (eq.name || '').toUpperCase();
  const ct = (eq.ct_number || '').toUpperCase();

  return (
    typeId === 'HEAVY_EQUIPMENT' ||
    typeId === 'PC2000' ||
    typeId === 'EX1200' ||
    typeId === 'D85SS' ||
    typeId === 'EXCAVATOR' ||
    typeId === 'DOZER' ||
    unitNum.startsWith('EX') ||
    unitNum.startsWith('DZ') ||
    unitNum.startsWith('PC') ||
    unitNum.startsWith('WL') ||
    unitNum.startsWith('GD') ||
    unitNum.startsWith('HE') ||
    unitNum.startsWith('EQ') ||
    ct.startsWith('CT-EX') ||
    ct.startsWith('CT-DZ') ||
    ct.startsWith('CT-HE') ||
    name.includes('EXCAVATOR') ||
    name.includes('BULLDOZER') ||
    name.includes('DOZER') ||
    name.includes('SHOVEL') ||
    name.includes('PC2000') ||
    name.includes('EX1200') ||
    name.includes('D85SS') ||
    name.includes('ALAT BERAT') ||
    name.includes('HEAVY EQUIPMENT')
  );
};

/**
 * Determines whether a mechanic belongs to Dump Truck (DT) maintenance.
 */
export const isDumpTruckMechanic = (m: Employee): boolean => {
  const dept = (m.department_id || '').toUpperCase();
  const pos = (m.position || '').toUpperCase();
  const name = (m.name || '').toUpperCase();

  return (
    dept === 'DEPT-MECH-DT' ||
    dept.includes('-DT') ||
    dept.includes('DUMP_TRUCK') ||
    pos.includes('DUMP TRUCK') ||
    pos.includes('HAULING') ||
    pos.includes('HAUL TRUCK') ||
    pos.includes('DT') ||
    name.includes('DT')
  );
};

/**
 * Determines whether a mechanic belongs to Heavy Equipment (HE) maintenance.
 */
export const isHeavyEquipmentMechanic = (m: Employee): boolean => {
  const dept = (m.department_id || '').toUpperCase();
  const pos = (m.position || '').toUpperCase();
  const name = (m.name || '').toUpperCase();

  return (
    dept === 'DEPT-MECH-HE' ||
    dept.includes('-HE') ||
    dept.includes('HEAVY_EQUIPMENT') ||
    pos.includes('HEAVY EQUIPMENT') ||
    pos.includes('ALAT BERAT') ||
    pos.includes('HYDRAULIC') ||
    pos.includes('EXCAVATOR') ||
    pos.includes('DOZER') ||
    pos.includes('HE') ||
    name.includes('HE')
  );
};

/**
 * Infers initial fleet category from active warehouse ID or category string.
 */
export const getWarehouseCategory = (whId: string, whCategory?: string): FleetCategory => {
  const upperWhId = (whId || '').toUpperCase();
  const upperCat = (whCategory || '').toUpperCase();

  if (
    upperCat === 'DUMP_TRUCK' ||
    upperWhId.includes('DT') ||
    upperWhId.includes('DUMP TRUCK')
  ) {
    return 'DT';
  }
  if (
    upperCat === 'HEAVY_EQUIPMENT' ||
    upperWhId.includes('HE') ||
    upperWhId.includes('ALAT BERAT') ||
    upperWhId.includes('HEAVY EQUIPMENT')
  ) {
    return 'HE';
  }
  return 'ALL';
};

/**
 * Determines the strict fleet division ('HE', 'DT', or 'ALL') assigned to a user account.
 * Admin (Utama & Kontainer), Supervisor, and Mekanik are strictly scoped to their division ('HE' or 'DT'),
 * whereas SUPER_ADMIN and MANAGER have access to 'ALL'.
 */
export const getUserFleetCategory = (user?: UserProfile | null): FleetCategory => {
  if (!user) return 'ALL';
  const roleUpper = (user.role_id || '').toUpperCase();
  if (roleUpper === 'SUPER_ADMIN' || roleUpper === 'MANAGER') {
    return 'ALL';
  }
  if (roleUpper.endsWith('_HE') || roleUpper.includes('_HE_')) {
    return 'HE';
  }
  if (roleUpper.endsWith('_DT') || roleUpper.includes('_DT_')) {
    return 'DT';
  }

  const whs = user.warehouses || [];
  if (whs.length > 0) {
    const hasHe = whs.some(
      (w) => (w.category || '').toUpperCase() === 'HEAVY_EQUIPMENT' || w.id.toUpperCase().includes('HE')
    );
    const hasDt = whs.some(
      (w) => (w.category || '').toUpperCase() === 'DUMP_TRUCK' || w.id.toUpperCase().includes('DT')
    );
    if (hasHe && !hasDt) return 'HE';
    if (hasDt && !hasHe) return 'DT';
  }

  const usernameUpper = (user.username || '').toUpperCase();
  if (usernameUpper.endsWith('_DT') || usernameUpper.includes('_DT_')) return 'DT';
  if (usernameUpper.endsWith('_HE') || usernameUpper.includes('_HE_')) return 'HE';

  return 'ALL';
};

/**
 * Checks whether a warehouse belongs to the requested FleetCategory ('HE', 'DT', or 'ALL').
 */
export const isWarehouseInCategory = (
  warehouseId?: string,
  warehouseCategory?: string,
  category: FleetCategory = 'ALL'
): boolean => {
  if (!category || category === 'ALL') return true;
  const whCat = getWarehouseCategory(warehouseId || '', warehouseCategory);
  if (whCat === 'ALL') return true;
  return whCat === category;
};

/**
 * Filters an equipment array based on the requested FleetCategory.
 */
export const filterEquipmentByCategory = (
  list: Equipment[],
  category: FleetCategory
): Equipment[] => {
  if (category === 'DT') {
    return list.filter(isDumpTruckEquipment);
  }
  if (category === 'HE') {
    return list.filter((eq) => isHeavyEquipment(eq) || !isDumpTruckEquipment(eq));
  }
  return list;
};

/**
 * Filters a mechanic array based on the requested FleetCategory.
 */
export const filterMechanicsByCategory = (
  list: Employee[],
  category: FleetCategory
): Employee[] => {
  if (category === 'DT') {
    return list.filter(isDumpTruckMechanic);
  }
  if (category === 'HE') {
    return list.filter((m) => isHeavyEquipmentMechanic(m) || !isDumpTruckMechanic(m));
  }
  return list;
};

