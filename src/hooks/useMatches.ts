import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getMatchesByDate, getMatchById, getMatchesByDateRange } from '../services/matchService';
import { getMatchDetail } from '../services/footballApi';

export function useMatchesByDate(date: Date) {
  const dateKey = date.toISOString().split('T')[0];
  const isToday = dateKey === new Date().toISOString().split('T')[0];
  return useQuery({
    queryKey: ['matches', dateKey],
    queryFn: () => getMatchesByDate(date),
    staleTime: isToday ? 2 * 60 * 1000 : 10 * 60 * 1000,
    placeholderData: keepPreviousData,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    refetchOnWindowFocus: false,
    refetchInterval: (query) => {
      const matches = query.state.data;
      const hasLive = matches?.some(
        (m) => m.status === 'IN_PLAY' || m.status === 'PAUSED'
      );
      return hasLive ? 60000 : false;
    },
  });
}

export function useMatch(matchId: number) {
  return useQuery({
    queryKey: ['match', matchId],
    queryFn: () => getMatchById(matchId),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useMatchDetail(matchId: number) {
  return useQuery({
    queryKey: ['matchDetail', matchId],
    queryFn: () => getMatchDetail(matchId),
    staleTime: 5 * 60 * 1000,
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
