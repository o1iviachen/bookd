import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['review'] });
    },
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
