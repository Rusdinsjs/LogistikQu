import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../api';

export const REPORT_KEYS = {
  all: ['reports'] as const,
  byUnit: () => [...REPORT_KEYS.all, 'unit'] as const,
  bySite: () => [...REPORT_KEYS.all, 'site'] as const,
  byMechanic: () => [...REPORT_KEYS.all, 'mechanic'] as const,
};

export function useReportsByUnit() {
  return useQuery({
    queryKey: REPORT_KEYS.byUnit(),
    queryFn: () => reportsApi.byUnit(),
    staleTime: 60 * 1000,
  });
}

export function useReportsBySite() {
  return useQuery({
    queryKey: REPORT_KEYS.bySite(),
    queryFn: () => reportsApi.bySite(),
    staleTime: 60 * 1000,
  });
}

export function useReportsByMechanic() {
  return useQuery({
    queryKey: REPORT_KEYS.byMechanic(),
    queryFn: () => reportsApi.byMechanic(),
    staleTime: 60 * 1000,
  });
}
