import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getUserProfile, updateUserProfile } from '../services/firestore/users';
import { followUser, unfollowUser, searchUsers } from '../services/firestore/users';
import { toggleWatchedMatch, toggleLikedMatch, markMatchWatched, addCustomTag, removeCustomTag, renameCustomTag, getFollowedTeamIdsForUsers } from '../services/firestore/users';
import { renameTagOnReviews, removeTagFromReviews } from '../services/firestore/reviews';

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
    onSettled: (_data, _err, params) => {
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
    onSettled: (_data, _err, params) => {
      queryClient.invalidateQueries({ queryKey: ['user', params.currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['user', params.targetUserId] });
    },
  });
}

// Batch fetch followed team IDs for a set of user IDs (e.g. reviewers)
export function useReviewerTeamIds(userIds: string[]) {
  const key = userIds.slice().sort().join(',');
  return useQuery({
    queryKey: ['reviewerTeamIds', key],
    queryFn: () => getFollowedTeamIdsForUsers(userIds),
    enabled: userIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSearchUsers(queryStr: string, active = true) {
  return useQuery({
    queryKey: ['search', 'users', queryStr],
    queryFn: () => searchUsers(queryStr),
    enabled: queryStr.length >= 2 && active,
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

export function useRenameTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { userId: string; oldTag: string; newTag: string }) => {
      await renameCustomTag(params.userId, params.oldTag, params.newTag);
      await renameTagOnReviews(params.userId, params.oldTag, params.newTag);
    },
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['user', params.userId] });
      queryClient.invalidateQueries({ queryKey: ['reviews', 'user', params.userId] });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { userId: string; tag: string }) => {
      await removeCustomTag(params.userId, params.tag);
      await removeTagFromReviews(params.userId, params.tag);
    },
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['user', params.userId] });
      queryClient.invalidateQueries({ queryKey: ['reviews', 'user', params.userId] });
    },
  });
}
