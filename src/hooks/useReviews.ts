import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  getReviewsForMatch,
  getReviewsForUser,
  getRecentReviews,
  getReviewById,
  createReview,
  updateReview,
  voteOnReview,
  deleteReview,
  getAvgRatingsForMatches,
  getReviewUpvoterIds,
  getReviewsUpvotedByUser,
  searchReviews,
} from '../services/firestore/reviews';
import { ReviewMedia } from '../types/review';
import { useAuth } from '../context/AuthContext';

export function useReviewsForMatch(matchId: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['reviews', 'match', matchId, user?.uid],
    queryFn: () => getReviewsForMatch(matchId, user?.uid),
    staleTime: 30 * 1000,
  });
}

export function useReviewsForUser(userId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['reviews', 'user', userId, user?.uid],
    queryFn: () => getReviewsForUser(userId, user?.uid),
    staleTime: 30 * 1000,
    enabled: !!userId,
  });
}

export function useRecentReviews() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['reviews', 'recent', user?.uid],
    queryFn: () => getRecentReviews(user?.uid),
    staleTime: 30 * 1000,
    retry: 2,
  });
}

export function useReview(reviewId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['review', reviewId, user?.uid],
    queryFn: () => getReviewById(reviewId, user?.uid),
    enabled: !!reviewId,
  });
}

export function useCreateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      matchId: number;
      userId: string;
      username: string;
      userAvatar: string | null;
      rating: number;
      text: string;
      tags: string[];
      media?: ReviewMedia[];
    }) =>
      createReview(
        params.matchId,
        params.userId,
        params.username,
        params.userAvatar,
        params.rating,
        params.text,
        params.tags,
        params.media || []
      ),
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['reviews', 'match', params.matchId] });
      queryClient.invalidateQueries({ queryKey: ['reviews', 'user', params.userId] });
      queryClient.invalidateQueries({ queryKey: ['reviews', 'recent'] });
    },
  });
}

export function useUpdateReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      reviewId: string;
      data: {
        rating?: number;
        text?: string;
        tags?: string[];
        media?: ReviewMedia[];
      };
    }) => updateReview(params.reviewId, params.data),
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['review', params.reviewId] });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
}

export function useVoteOnReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { reviewId: string; userId: string; voteType: 'up' | 'down'; senderInfo?: { username: string; avatar: string | null } }) =>
      voteOnReview(params.reviewId, params.userId, params.voteType, params.senderInfo),
    onMutate: async (params) => {
      // Optimistically update the review vote state in all cached review lists
      await queryClient.cancelQueries({ queryKey: ['reviews'] });
      const isToggle = params.voteType === 'up';
      queryClient.setQueriesData<any[]>({ queryKey: ['reviews'] }, (old) => {
        if (!old) return old;
        return old.map((r: any) => {
          if (r.id !== params.reviewId) return r;
          const wasVoted = r.userVote === params.voteType;
          return {
            ...r,
            userVote: wasVoted ? null : params.voteType,
            upvotes: isToggle
              ? wasVoted ? Math.max(0, (r.upvotes || 0) - 1) : (r.upvotes || 0) + 1
              : r.upvotes,
          };
        });
      });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['review'] });
    },
  });
}

export function useLikedReviews(userId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['reviews', 'liked', userId],
    queryFn: () => getReviewsUpvotedByUser(userId, user?.uid),
    staleTime: 60 * 1000,
    enabled: !!userId,
  });
}

export function useReviewUpvoters(reviewId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['reviewUpvoters', reviewId],
    queryFn: () => getReviewUpvoterIds(reviewId),
    staleTime: 60 * 1000,
    enabled: enabled && !!reviewId,
  });
}

export function useAvgRatings(matchIds: number[]) {
  return useQuery({
    queryKey: ['avgRatings', matchIds],
    queryFn: () => getAvgRatingsForMatches(matchIds),
    staleTime: 60 * 1000,
    enabled: matchIds.length > 0,
  });
}

export function useDeleteReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteReview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
  });
}

export function useSearchReviews(queryStr: string, active = true) {
  return useQuery({
    queryKey: ['searchReviews', queryStr],
    queryFn: () => searchReviews(queryStr),
    enabled: queryStr.length >= 3 && active,
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}
