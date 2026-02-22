import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { getMatchesByDate, getMatchById, getMatchesByDateRange } from '../services/footballApi';

export function useMatchesByDate(date: Date) {
  const dateKey = date.toISOString().split('T')[0];
  return useQuery({
    queryKey: ['matches', dateKey],
    queryFn: () => getMatchesByDate(date),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
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
    staleTime: 60 * 1000,
  });
}

export function useMatchesRange(from: Date, to: Date) {
  const fromKey = from.toISOString().split('T')[0];
  const toKey = to.toISOString().split('T')[0];
  return useQuery({
    queryKey: ['matches', 'range', fromKey, toKey],
    queryFn: () => getMatchesByDateRange(from, to),
    staleTime: 5 * 60 * 1000,
  });
}
