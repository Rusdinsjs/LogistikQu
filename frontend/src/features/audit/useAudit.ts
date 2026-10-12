import { useQuery } from '@tanstack/react-query';
import { auditApi } from '../../api';

export const AUDIT_KEYS = {
  all: ['audit'] as const,
  logs: () => [...AUDIT_KEYS.all, 'logs'] as const,
};

export function useAuditLogs() {
  return useQuery({
    queryKey: AUDIT_KEYS.logs(),
    queryFn: () => auditApi.listAuditLogs(),
    staleTime: 10 * 1000,
  });
}
