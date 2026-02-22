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
    mutationFn: (params: { currentUserId: string; targetUserId: string }) =>
      followUser(params.currentUserId, params.targetUserId),
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
    onSuccess: (_, params) => {
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
