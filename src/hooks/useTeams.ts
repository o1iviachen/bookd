import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getTeamDetail, getTeamMatches, getAllTeams, searchPlayersQuery, getMatchesForPerson, PersonMatchAppearance } from '../services/footballApi';

export function useTeamDetail(teamId: number) {
  return useQuery({
    queryKey: ['teamDetail', teamId],
    queryFn: () => getTeamDetail(teamId),
    enabled: !!teamId,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
}

export function useTeamMatches(teamId: number) {
  return useQuery({
    queryKey: ['teamMatches', teamId],
    queryFn: () => getTeamMatches(teamId, 'FINISHED'),
    enabled: !!teamId,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

// Fetch all teams ONCE when search is active, cache for 10 minutes
export function useSearchTeams(query: string, active = true) {
  const enabled = query.length >= 2 && active;
  const { data: allTeams, isLoading } = useQuery({
    queryKey: ['allTeams'],
    queryFn: getAllTeams,
    staleTime: 10 * 60 * 1000,
    enabled,
  });

  const data = useMemo(() => {
    if (!allTeams || !enabled) return [];
    const q = query.toLowerCase();
    return allTeams
      .filter((t) =>
        t.name?.toLowerCase().includes(q) ||
        t.shortName?.toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [allTeams, query, enabled]);

  return { data, isLoading: isLoading && enabled };
}

// Fetch matches where a person appeared in the squad (lineup/bench/coach)
export function usePersonMatches(personId: number) {
  return useQuery({
    queryKey: ['personMatches', personId],
    queryFn: () => getMatchesForPerson(personId),
    enabled: !!personId,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}

// Search players via Firestore prefix query — fast, no bulk fetch
export function useSearchPlayers(query: string, active = true) {
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['searchPlayers', query],
    queryFn: () => searchPlayersQuery(query),
    enabled: query.length >= 2 && active,
    staleTime: 2 * 60 * 1000,
  });

  return { data: data || [], isLoading: isLoading && query.length >= 2, isFetching };
}
