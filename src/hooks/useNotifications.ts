import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNotificationsForUser,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/firestore/notifications';
import { filterBlockedContent } from '../utils/blockFilter';

export function useNotifications(userId: string, blockedUsers?: Set<string>) {
  return useQuery({
    queryKey: ['notifications', userId],
    queryFn: () => getNotificationsForUser(userId),
    enabled: !!userId,
    staleTime: 30 * 1000,
    select: (data) => blockedUsers?.size ? filterBlockedContent(data, blockedUsers, (n) => n.senderId) : data,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
