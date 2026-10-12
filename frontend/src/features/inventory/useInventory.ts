import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '../../api';
import type { InventoryStockItem } from '../../types';

export const INVENTORY_KEYS = {
  all: ['inventory'] as const,
  stock: (warehouseId?: string, search?: string) =>
    [...INVENTORY_KEYS.all, 'stock', warehouseId, search] as const,
  movements: (warehouseId?: string, partId?: string) =>
    [...INVENTORY_KEYS.all, 'movements', warehouseId, partId] as const,
};

export function useInventoryStock(warehouseId: string, search?: string) {
  return useQuery<InventoryStockItem[]>({
    queryKey: INVENTORY_KEYS.stock(warehouseId, search),
    queryFn: () => inventoryApi.getStock(warehouseId, search),
    enabled: Boolean(warehouseId),
    staleTime: 30 * 1000,
  });
}

export function useInventoryMovements(warehouseId: string, partId: string) {
  return useQuery({
    queryKey: INVENTORY_KEYS.movements(warehouseId, partId),
    queryFn: () => inventoryApi.getMovements(warehouseId, partId),
    enabled: Boolean(warehouseId && partId),
    staleTime: 15 * 1000,
  });
}

export function useImportInitialStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ warehouseId, rows }: { warehouseId: string; rows: any[] }) =>
      inventoryApi.importInitialStock(warehouseId, rows),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: INVENTORY_KEYS.stock(variables.warehouseId),
      });
      queryClient.invalidateQueries({
        queryKey: ['dashboard'],
      });
    },
  });
}
