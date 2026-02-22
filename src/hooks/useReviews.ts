import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getReviewsForMatch,
  getReviewsForUser,
  getRecentReviews,
  getReviewById,
  createReview,
  voteOnReview,
  deleteReview,
} from '../services/firestore/reviews';
import { ReviewMedia } from '../types/review';
import { useAuth } from '../context/AuthContext';

export function useReviewsForMatch(matchId: number) {
  return useQuery({
    queryKey: ['reviews', 'match', matchId],
    queryFn: () => getReviewsForMatch(matchId),
    staleTime: 30 * 1000,
  });
}

export function useReviewsForUser(userId: string) {
  return useQuery({
    queryKey: ['reviews', 'user', userId],
    queryFn: () => getReviewsForUser(userId),
    staleTime: 30 * 1000,
    enabled: !!userId,
  });
}

export function useRecentReviews() {
  return useQuery({
    queryKey: ['reviews', 'recent'],
    queryFn: getRecentReviews,
    staleTime: 30 * 1000,
  });
}

export function useReview(reviewId: string) {
  return useQuery({
    queryKey: ['review', reviewId],
    queryFn: () => getReviewById(reviewId),
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

export function useVoteOnReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { reviewId: string; userId: string; voteType: 'up' | 'down' }) =>
      voteOnReview(params.reviewId, params.userId, params.voteType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
    },
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
