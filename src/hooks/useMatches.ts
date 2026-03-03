import { useEffect } from 'react';
import { useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { getMatchesByDate, getMatchById, getMatchesByDateRange } from '../services/matchService';
import { getMatchDetail, searchMatchesQuery } from '../services/footballApi';
import { addDays } from 'date-fns';

export function useMatchesByDate(date: Date, enabled = true) {
  const dateKey = date.toISOString().split('T')[0];
  const todayKey = new Date().toISOString().split('T')[0];
  const isToday = dateKey === todayKey;
  const isPast = dateKey < todayKey;
  const queryClient = useQueryClient();

  // Prefetch adjacent dates so swiping feels instant
  useEffect(() => {
    if (!enabled) return;
    const prefetch = (d: Date) => {
      const key = d.toISOString().split('T')[0];
      queryClient.prefetchQuery({
        queryKey: ['matches', key],
        queryFn: () => getMatchesByDate(d),
        staleTime: 10 * 60 * 1000,
      });
    };
    prefetch(addDays(date, -1));
    prefetch(addDays(date, 1));
  }, [dateKey, queryClient, enabled]);

  return useQuery({
    queryKey: ['matches', dateKey],
    queryFn: () => getMatchesByDate(date),
    enabled,
    staleTime: (query) => {
      const matches = query.state.data;
      if (isPast) return Infinity;
      // Today/future: if all matches are finished, no need to refetch
      const allDone = matches?.length && matches.every((m) => m.status === 'FINISHED');
      if (allDone) return Infinity;
      return isToday ? 2 * 60 * 1000 : 10 * 60 * 1000;
    },
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const matches = query.state.data;
      const hasLive = matches?.some(
        (m) => m.status === 'IN_PLAY' || m.status === 'PAUSED'
      );
      return hasLive ? 10000 : false;
    },
  });
}

export function useMatch(matchId: number) {
  return useQuery({
    queryKey: ['match', matchId],
    queryFn: () => getMatchById(matchId),
    staleTime: (query) => {
      const match = query.state.data;
      return match?.status === 'FINISHED' ? Infinity : 30 * 1000;
    },
    refetchInterval: (query) => {
      const match = query.state.data;
      const isLive = match?.status === 'IN_PLAY' || match?.status === 'PAUSED';
      return isLive ? 10000 : false;
    },
    retry: 1,
  });
}

export function useMatchDetail(matchId: number) {
  return useQuery({
    queryKey: ['matchDetail', matchId],
    queryFn: () => getMatchDetail(matchId),
    staleTime: (query) => {
      const detail = query.state.data;
      return detail?.match.status === 'FINISHED' ? Infinity : 30 * 1000;
    },
    refetchInterval: (query) => {
      const detail = query.state.data;
      const isLive = detail?.match.status === 'IN_PLAY' || detail?.match.status === 'PAUSED';
      return isLive ? 10000 : false;
    },
    retry: 1,
  });
}

export function useMatchesRange(from: Date, to: Date) {
  const fromKey = from.toISOString().split('T')[0];
  const toKey = to.toISOString().split('T')[0];
  return useQuery({
    queryKey: ['matches', 'range', fromKey, toKey],
    queryFn: () => getMatchesByDateRange(from, to),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
}

export function useSearchMatches(queryStr: string, active = true) {
  return useInfiniteQuery({
    queryKey: ['searchMatches', queryStr],
    queryFn: ({ pageParam }) => searchMatchesQuery(queryStr, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: queryStr.length >= 2 && active,
    staleTime: 2 * 60 * 1000,
  });
}
