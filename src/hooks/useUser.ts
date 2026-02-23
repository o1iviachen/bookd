import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserProfile, updateUserProfile } from '../services/firestore/users';
import { followUser, unfollowUser, searchUsers } from '../services/firestore/users';
import { toggleWatchedMatch, toggleLikedMatch, markMatchWatched, addCustomTag, removeCustomTag } from '../services/firestore/users';

export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => getUserProfile(userId),
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}

export function useFollowUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { currentUserId: string; targetUserId: string; senderInfo?: { username: string; avatar: string | null } }) =>
      followUser(params.currentUserId, params.targetUserId, params.senderInfo),
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['user', params.currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['user', params.targetUserId] });
    },
  });
}

export function useUnfollowUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { currentUserId: string; targetUserId: string }) =>
      unfollowUser(params.currentUserId, params.targetUserId),
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['user', params.currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['user', params.targetUserId] });
    },
  });
}

export function useSearchUsers(queryStr: string) {
  return useQuery({
    queryKey: ['search', 'users', queryStr],
    queryFn: () => searchUsers(queryStr),
    enabled: queryStr.length >= 2,
    staleTime: 30 * 1000,
  });
}

export function useToggleWatched() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { userId: string; matchId: number }) =>
      toggleWatchedMatch(params.userId, params.matchId),
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['user', params.userId] });
    },
  });
}

export function useToggleLiked() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { userId: string; matchId: number }) =>
      toggleLikedMatch(params.userId, params.matchId),
    onMutate: async (params) => {
      const queryKey = ['user', params.userId];
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        const liked: number[] = old.likedMatchIds || [];
        const isLiked = liked.some((id: number) => Number(id) === Number(params.matchId));
        return {
          ...old,
          likedMatchIds: isLiked
            ? liked.filter((id: number) => Number(id) !== Number(params.matchId))
            : [...liked, Number(params.matchId)],
          watchedMatchIds: isLiked
            ? old.watchedMatchIds
            : [...new Set([...(old.watchedMatchIds || []), Number(params.matchId)])],
        };
      });
      return { previous, queryKey };
    },
    onError: (_err, _params, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.queryKey, context.previous);
      }
    },
    onSettled: (_, __, params) => {
      queryClient.invalidateQueries({ queryKey: ['user', params.userId] });
    },
  });
}

export function useMarkWatched() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { userId: string; matchId: number }) =>
      markMatchWatched(params.userId, params.matchId),
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['user', params.userId] });
    },
  });
}

export function useAddCustomTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { userId: string; tag: string }) =>
      addCustomTag(params.userId, params.tag),
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['user', params.userId] });
    },
  });
}

export function useRemoveCustomTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { userId: string; tag: string }) =>
      removeCustomTag(params.userId, params.tag),
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['user', params.userId] });
    },
  });
}
