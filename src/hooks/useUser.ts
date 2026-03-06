import { useMemo, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { getUserProfile, updateUserProfile, getBlockList } from '../services/firestore/users';
import { followUser, unfollowUser, searchUsers, blockUser, unblockUser } from '../services/firestore/users';
import { toggleWatchedMatch, toggleLikedMatch, markMatchWatched, addCustomTag, removeCustomTag, renameCustomTag, getFollowedTeamIdsForUsers } from '../services/firestore/users';
import { filterBlockedContent } from '../utils/blockFilter';
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

export function useSearchUsers(queryStr: string, active = true, blockedUsers?: Set<string>) {
  return useQuery({
    queryKey: ['search', 'users', queryStr],
    queryFn: () => searchUsers(queryStr),
    enabled: queryStr.length >= 2 && active,
    staleTime: 30 * 1000,
    select: (data) => blockedUsers?.size ? filterBlockedContent(data, blockedUsers, (u) => u.id) : data,
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

/**
 * Returns a Set of all user IDs that are blocked (either blocked by current user
 * or have blocked the current user) for mutual blocking.
 * Uses a dedicated query with short staleTime so the blocked user's device
 * picks up the block quickly (their blockedBy array updates in Firestore).
 */
export function useBlockedUsers(userId: string | undefined): Set<string> {
  const queryClient = useQueryClient();
  const navigation = useNavigation();
  const { data, refetch } = useQuery({
    queryKey: ['blockList', userId],
    queryFn: () => getBlockList(userId!),
    enabled: !!userId,
    staleTime: 10 * 1000,
  });

  // Refetch on screen focus (tab switches don't remount in React Native)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (userId) refetch();
    });
    return unsubscribe;
  }, [navigation, userId, refetch]);

  const fingerprint = useMemo(() => {
    if (!data) return '';
    return [...data.blockedUsers, '|', ...data.blockedBy].join(',');
  }, [data]);

  const prevFingerprint = useRef(fingerprint);
  useEffect(() => {
    if (userId && fingerprint && prevFingerprint.current !== fingerprint) {
      prevFingerprint.current = fingerprint;
      queryClient.invalidateQueries({ queryKey: ['user', userId] });
    }
  }, [fingerprint, userId, queryClient]);

  return useMemo(() => {
    if (!data) return new Set<string>();
    return new Set([...data.blockedUsers, ...data.blockedBy]);
  }, [data]);
}

export function useBlockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { currentUserId: string; targetUserId: string }) =>
      blockUser(params.currentUserId, params.targetUserId),
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: ['user', params.currentUserId] });
      await queryClient.cancelQueries({ queryKey: ['user', params.targetUserId] });
      await queryClient.cancelQueries({ queryKey: ['blockList', params.currentUserId] });

      const prevCurrent = queryClient.getQueryData(['user', params.currentUserId]);
      const prevTarget = queryClient.getQueryData(['user', params.targetUserId]);
      const prevBlockList = queryClient.getQueryData(['blockList', params.currentUserId]);

      queryClient.setQueryData(['user', params.currentUserId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          blockedUsers: [...new Set([...(old.blockedUsers || []), params.targetUserId])],
          following: (old.following || []).filter((id: string) => id !== params.targetUserId),
          followers: (old.followers || []).filter((id: string) => id !== params.targetUserId),
        };
      });

      queryClient.setQueryData(['user', params.targetUserId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          following: (old.following || []).filter((id: string) => id !== params.currentUserId),
          followers: (old.followers || []).filter((id: string) => id !== params.currentUserId),
        };
      });

      queryClient.setQueryData(['blockList', params.currentUserId], (old: any) => {
        if (!old) return { blockedUsers: [params.targetUserId], blockedBy: [] };
        return { ...old, blockedUsers: [...new Set([...old.blockedUsers, params.targetUserId])] };
      });

      return { prevCurrent, prevTarget, prevBlockList };
    },
    onError: (_err, params, context) => {
      if (context?.prevCurrent) queryClient.setQueryData(['user', params.currentUserId], context.prevCurrent);
      if (context?.prevTarget) queryClient.setQueryData(['user', params.targetUserId], context.prevTarget);
      if (context?.prevBlockList) queryClient.setQueryData(['blockList', params.currentUserId], context.prevBlockList);
    },
    onSettled: (_data, _err, params) => {
      queryClient.invalidateQueries({ queryKey: ['blockList', params.currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['user', params.currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['user', params.targetUserId] });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useUnblockUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { currentUserId: string; targetUserId: string }) =>
      unblockUser(params.currentUserId, params.targetUserId),
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: ['user', params.currentUserId] });
      await queryClient.cancelQueries({ queryKey: ['blockList', params.currentUserId] });

      const prevCurrent = queryClient.getQueryData(['user', params.currentUserId]);
      const prevBlockList = queryClient.getQueryData(['blockList', params.currentUserId]);

      queryClient.setQueryData(['user', params.currentUserId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          blockedUsers: (old.blockedUsers || []).filter((id: string) => id !== params.targetUserId),
        };
      });

      queryClient.setQueryData(['blockList', params.currentUserId], (old: any) => {
        if (!old) return old;
        return { ...old, blockedUsers: old.blockedUsers.filter((id: string) => id !== params.targetUserId) };
      });

      return { prevCurrent, prevBlockList };
    },
    onError: (_err, params, context) => {
      if (context?.prevCurrent) queryClient.setQueryData(['user', params.currentUserId], context.prevCurrent);
      if (context?.prevBlockList) queryClient.setQueryData(['blockList', params.currentUserId], context.prevBlockList);
    },
    onSettled: (_data, _err, params) => {
      queryClient.invalidateQueries({ queryKey: ['blockList', params.currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['user', params.currentUserId] });
      queryClient.invalidateQueries({ queryKey: ['user', params.targetUserId] });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['comments'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
