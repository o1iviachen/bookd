import { useQuery, useInfiniteQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  getReviewsForMatch,
  getReviewsForUser,
  getRecentReviews,
  getRecentReviewsPaginated,
  getPopularMatchIdsThisWeek,
  getPopularMatchIdsAllTime,
  getHighestRatedMatchIds,
  getReviewById,
  createReview,
  updateReview,
  voteOnReview,
  deleteReview,
  getReviewUpvoterIds,
  getReviewsUpvotedByUser,
  searchReviews,
  getReviewsForMatches,
  getUserMotmVote,
} from '../services/firestore/reviews';
import { ReviewMedia } from '../types/review';
import { useAuth } from '../context/AuthContext';

export function useReviewsForMatch(matchId: number) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['reviews', 'match', matchId, user?.uid],
    queryFn: () => getReviewsForMatch(matchId, user?.uid),
    staleTime: 5 * 60 * 1000,
  });
}

export function useReviewsForUser(userId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['reviews', 'user', userId, user?.uid],
    queryFn: () => getReviewsForUser(userId, user?.uid),
    staleTime: 5 * 60 * 1000,
    enabled: !!userId,
  });
}

export function useRecentReviews() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['reviews', 'recent', user?.uid],
    queryFn: () => getRecentReviews(user?.uid),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

export function useRecentReviewsPaginated() {
  const { user } = useAuth();
  return useInfiniteQuery({
    queryKey: ['reviews', 'recent', 'paginated', user?.uid],
    queryFn: ({ pageParam }) => getRecentReviewsPaginated(user?.uid, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

export function usePopularMatchIdsThisWeek() {
  return useQuery({
    queryKey: ['reviews', 'popularThisWeek'],
    queryFn: () => getPopularMatchIdsThisWeek(),
    staleTime: Infinity,
  });
}

export function usePopularMatchIdsAllTime() {
  return useQuery({
    queryKey: ['reviews', 'popularAllTime'],
    queryFn: () => getPopularMatchIdsAllTime(),
    staleTime: Infinity,
  });
}

export function useHighestRatedMatchIds() {
  return useQuery({
    queryKey: ['reviews', 'highestRated'],
    queryFn: () => getHighestRatedMatchIds(),
    staleTime: Infinity,
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
      isSpoiler?: boolean;
      motmPlayerId?: number;
      language?: string;
    }) =>
      createReview(
        params.matchId,
        params.userId,
        params.username,
        params.userAvatar,
        params.rating,
        params.text,
        params.tags,
        params.media || [],
        params.isSpoiler || false,
        params.motmPlayerId,
        undefined,
        params.language,
      ),
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['reviews', 'match', params.matchId] });
      queryClient.invalidateQueries({ queryKey: ['reviews', 'user', params.userId] });
      queryClient.invalidateQueries({ queryKey: ['reviews', 'recent'] });
      if (params.motmPlayerId) {
        queryClient.invalidateQueries({ queryKey: ['match', params.matchId] });
        queryClient.invalidateQueries({ queryKey: ['motmVote', params.matchId] });
      }
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
        isSpoiler?: boolean;
        motmPlayerId?: number | null;
        motmPlayerName?: string | null;
        language?: string;
      };
      matchId?: number;
      userId?: string;
      oldRating?: number;
    }) => updateReview(params.reviewId, params.data, params.matchId, params.userId, params.oldRating),
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['review', params.reviewId] });
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      if (params.matchId) {
        queryClient.invalidateQueries({ queryKey: ['match', params.matchId] });
      }
    },
  });
}

export function useVoteOnReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { reviewId: string; userId: string; voteType: 'up' | 'down'; senderInfo?: { username: string; avatar: string | null } }) =>
      voteOnReview(params.reviewId, params.userId, params.voteType, params.senderInfo),
    onMutate: async (params) => {
      await queryClient.cancelQueries({ queryKey: ['reviews'] });
      await queryClient.cancelQueries({ queryKey: ['review', params.reviewId] });

      const updateReview = (r: any) => {
        if (r.id !== params.reviewId) return r;
        const wasVoted = r.userVote === params.voteType;
        return {
          ...r,
          userVote: wasVoted ? null : params.voteType,
          upvotes: params.voteType === 'up'
            ? wasVoted ? Math.max(0, (r.upvotes || 0) - 1) : (r.upvotes || 0) + 1
            : r.upvotes,
        };
      };

      // Update flat review arrays (match reviews, user reviews, etc.)
      queryClient.setQueriesData<any>({ queryKey: ['reviews'] }, (old: any) => {
        if (!old) return old;
        // Paginated (infinite query) — has pages array
        if (old.pages) {
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              reviews: page.reviews?.map(updateReview) ?? page,
            })),
          };
        }
        // Flat array
        if (Array.isArray(old)) return old.map(updateReview);
        return old;
      });

      // Update single review cache
      queryClient.setQueriesData<any>({ queryKey: ['review', params.reviewId] }, (old: any) => {
        if (!old) return old;
        return updateReview(old);
      });
    },
    onSettled: (_, __, params) => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['review', params.reviewId] });
    },
  });
}

export function useLikedReviews(userId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['reviews', 'liked', userId],
    queryFn: () => getReviewsUpvotedByUser(userId, user?.uid),
    staleTime: 10 * 60 * 1000,
    enabled: !!userId,
  });
}

export function useReviewUpvoters(reviewId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['reviewUpvoters', reviewId],
    queryFn: () => getReviewUpvoterIds(reviewId),
    staleTime: 10 * 60 * 1000,
    enabled: enabled && !!reviewId,
  });
}

export function useReviewsForMatches(matchIds: number[]) {
  return useQuery({
    queryKey: ['reviews', 'matches', matchIds],
    queryFn: () => getReviewsForMatches(matchIds),
    staleTime: 5 * 60 * 1000,
    enabled: matchIds.length > 0,
  });
}


export function useDeleteReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteReview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['match'] });
      queryClient.invalidateQueries({ queryKey: ['motmVote'] });
    },
  });
}

export function useUserMotmVote(matchId: number, userId?: string) {
  return useQuery({
    queryKey: ['motmVote', matchId, userId],
    queryFn: () => getUserMotmVote(matchId, userId!),
    enabled: !!matchId && !!userId,
    staleTime: 5 * 60 * 1000,
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
