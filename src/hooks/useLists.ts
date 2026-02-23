import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import {
  getListsForUser,
  getRecentLists,
  getListById,
  getListsContainingMatch,
  createList,
  updateList,
  deleteList,
  addMatchToList,
  removeMatchFromList,
  updateMatchOrder,
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
    staleTime: 60 * 1000,
  });
}

export function useListsForMatch(matchId: number) {
  return useQuery({
    queryKey: ['lists', 'match', matchId],
    queryFn: () => getListsContainingMatch(matchId),
    enabled: !!matchId,
    staleTime: 60 * 1000,
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
