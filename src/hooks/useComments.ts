import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCommentsForReview,
  createComment,
  toggleCommentLike,
  deleteComment,
} from '../services/firestore/comments';

export function useCommentsForReview(reviewId: string) {
  return useQuery({
    queryKey: ['comments', reviewId],
    queryFn: () => getCommentsForReview(reviewId),
    staleTime: 5 * 60 * 1000,
    enabled: !!reviewId,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      reviewId: string;
      userId: string;
      username: string;
      userAvatar: string | null;
      text: string;
      parentId?: string | null;
      gifUrl?: string | null;
    }) => createComment(
      params.reviewId,
      params.userId,
      params.username,
      params.userAvatar,
      params.text,
      params.parentId || null,
      params.gifUrl || null,
    ),
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['comments', params.reviewId] });
    },
  });
}

export function useToggleCommentLike() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { commentId: string; userId: string; reviewId: string; senderInfo?: { username: string; avatar: string | null } }) =>
      toggleCommentLike(params.commentId, params.userId, params.senderInfo),
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['comments', params.reviewId] });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments'] });
    },
  });
}
