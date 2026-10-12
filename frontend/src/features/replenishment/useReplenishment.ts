import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { replenishmentApi } from '../../api';

export const REPLENISHMENT_KEYS = {
  all: ['replenishment'] as const,
  requests: (warehouseId?: string, status?: string) =>
    [...REPLENISHMENT_KEYS.all, 'requests', warehouseId, status] as const,
  recommendations: (warehouseId: string) =>
    [...REPLENISHMENT_KEYS.all, 'recommendations', warehouseId] as const,
  intelligence: (warehouseId: string) =>
    [...REPLENISHMENT_KEYS.all, 'intelligence', warehouseId] as const,
};

export function useReplenishmentRequests(warehouseId?: string, status?: string) {
  return useQuery({
    queryKey: REPLENISHMENT_KEYS.requests(warehouseId, status),
    queryFn: () => replenishmentApi.listRequests(warehouseId, status),
    staleTime: 15 * 1000,
  });
}

export function useReplenishmentRecommendations(warehouseId: string) {
  return useQuery({
    queryKey: REPLENISHMENT_KEYS.recommendations(warehouseId),
    queryFn: () => replenishmentApi.getRecommendations(warehouseId),
    enabled: Boolean(warehouseId),
    staleTime: 30 * 1000,
  });
}

export function useReplenishmentIntelligence(warehouseId: string) {
  return useQuery({
    queryKey: REPLENISHMENT_KEYS.intelligence(warehouseId),
    queryFn: () => replenishmentApi.getIntelligence(warehouseId),
    enabled: Boolean(warehouseId),
    staleTime: 30 * 1000,
  });
}

export function useApproveReplenishment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      notes,
    }: {
      requestId: string;
      notes?: string;
    }) => replenishmentApi.approveRequest(requestId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REPLENISHMENT_KEYS.all });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
