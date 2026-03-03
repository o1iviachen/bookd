import { useQuery, useInfiniteQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  getListsForUser,
  getRecentLists,
  getPopularListsPaginated,
  getListById,
  getListsContainingMatch,
  getListsLikedByUser,
  createList,
  updateList,
  deleteList,
  addMatchToList,
  removeMatchFromList,
  updateMatchOrder,
  toggleListLike,
  getListLikedBy,
  getCommentsForList,
  createListComment,
  deleteListComment,
  searchLists,
} from '../services/firestore/lists';

export function useListsForUser(userId: string) {
  return useQuery({
    queryKey: ['lists', 'user', userId],
    queryFn: () => getListsForUser(userId),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useRecentLists() {
  return useQuery({
    queryKey: ['lists', 'recent'],
    queryFn: getRecentLists,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

export function usePopularListsPaginated() {
  return useInfiniteQuery({
    queryKey: ['lists', 'popular', 'paginated'],
    queryFn: ({ pageParam }) => getPopularListsPaginated(pageParam),
    initialPageParam: undefined as { likes: number; docId: string } | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

export function useListsForMatch(matchId: number) {
  return useQuery({
    queryKey: ['lists', 'match', matchId],
    queryFn: () => getListsContainingMatch(matchId),
    enabled: !!matchId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useList(listId: string) {
  return useQuery({
    queryKey: ['list', listId],
    queryFn: () => getListById(listId),
    enabled: !!listId,
  });
}

export function useCreateList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      userId: string;
      username: string;
      name: string;
      description: string;
      matchIds: number[];
      ranked?: boolean;
    }) => createList(params.userId, params.username, params.name, params.description, params.matchIds, params.ranked),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
  });
}

export function useUpdateList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { listId: string; data: { name?: string; description?: string; ranked?: boolean } }) =>
      updateList(params.listId, params.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      queryClient.invalidateQueries({ queryKey: ['list'] });
    },
  });
}

export function useDeleteList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteList,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
  });
}

export function useAddMatchToList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { listId: string; matchId: number }) =>
      addMatchToList(params.listId, params.matchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      queryClient.invalidateQueries({ queryKey: ['list'] });
    },
  });
}

export function useRemoveMatchFromList() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { listId: string; matchId: number }) =>
      removeMatchFromList(params.listId, params.matchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      queryClient.invalidateQueries({ queryKey: ['list'] });
    },
  });
}

export function useUpdateMatchOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { listId: string; matchIds: number[] }) =>
      updateMatchOrder(params.listId, params.matchIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      queryClient.invalidateQueries({ queryKey: ['list'] });
    },
  });
}

export function useLikedLists(userId: string) {
  return useQuery({
    queryKey: ['lists', 'liked', userId],
    queryFn: () => getListsLikedByUser(userId),
    staleTime: 5 * 60 * 1000,
    enabled: !!userId,
  });
}

export function useListLikedBy(listId: string) {
  return useQuery({
    queryKey: ['listLikedBy', listId],
    queryFn: () => getListLikedBy(listId),
    enabled: !!listId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useToggleListLike() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { listId: string; userId: string; senderInfo?: { username: string; avatar: string | null } }) =>
      toggleListLike(params.listId, params.userId, params.senderInfo),
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['listLikedBy', params.listId] });
      queryClient.invalidateQueries({ queryKey: ['list', params.listId] });
      queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
  });
}

export function useListComments(listId: string) {
  return useQuery({
    queryKey: ['listComments', listId],
    queryFn: () => getCommentsForList(listId),
    enabled: !!listId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateListComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      listId: string;
      userId: string;
      username: string;
      userAvatar: string | null;
      text: string;
    }) => createListComment(params.listId, params.userId, params.username, params.userAvatar, params.text),
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['listComments', params.listId] });
      queryClient.invalidateQueries({ queryKey: ['lists'] });
    },
  });
}

export function useSearchLists(queryStr: string, active = true) {
  return useQuery({
    queryKey: ['searchLists', queryStr],
    queryFn: () => searchLists(queryStr),
    enabled: queryStr.length >= 3 && active,
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

export function useDeleteListComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { commentId: string; listId: string }) => deleteListComment(params.commentId),
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['listComments', params.listId] });
    },
  });
}
