import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getListsForUser,
  getRecentLists,
  getListById,
  createList,
  deleteList,
  addMatchToList,
  removeMatchFromList,
} from '../services/firestore/lists';

export function useListsForUser(userId: string) {
  return useQuery({
    queryKey: ['lists', 'user', userId],
    queryFn: () => getListsForUser(userId),
    enabled: !!userId,
    staleTime: 60 * 1000,
  });
}

export function useRecentLists() {
  return useQuery({
    queryKey: ['lists', 'recent'],
    queryFn: getRecentLists,
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
    }) => createList(params.userId, params.username, params.name, params.description, params.matchIds),
    onSuccess: (_, params) => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
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
    },
  });
}
