import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../../api';
import type { UserManagementItem, UpdateUserPayload } from '../../types';

export const USER_KEYS = {
  all: ['users'] as const,
  list: () => [...USER_KEYS.all, 'list'] as const,
  roles: () => [...USER_KEYS.all, 'roles'] as const,
  permissions: () => [...USER_KEYS.all, 'permissions'] as const,
};

export function useUsersList() {
  return useQuery<UserManagementItem[]>({
    queryKey: USER_KEYS.list(),
    queryFn: () => userApi.listUsers(),
    staleTime: 60 * 1000,
  });
}

export function useUserRoles() {
  return useQuery({
    queryKey: USER_KEYS.roles(),
    queryFn: () => userApi.listRoles(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserPermissions() {
  return useQuery({
    queryKey: USER_KEYS.permissions(),
    queryFn: () => userApi.listPermissions(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserPayload }) =>
      userApi.updateUser(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_KEYS.list() });
    },
  });
}
