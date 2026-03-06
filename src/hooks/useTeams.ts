import { useMemo } from 'react';
import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { getTeamDetail, getTeamMatches, getAllTeams, SearchableTeam, searchPlayersQuery, getMatchesForPerson, PersonMatchAppearance } from '../services/footballApi';

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
// League tier for team search ranking (lower = more popular)
const LEAGUE_TIER: Record<string, number> = {
  PL: 1, CL: 1, PD: 1, BL1: 1, SA: 1, FL1: 1,
  EL: 2, ECL: 2, ELC: 2, DED: 2, PPL: 2,
  FAC: 3, EFL: 3, SPL: 3, SL: 3, BEL: 3, BSA: 3, ARG: 3,
  MLS: 4, LMX: 4, SAU: 4, JPL: 4, AUS: 4,
  WC: 5, EURO: 5, NL: 5, CA: 5,
};

// International-only competition codes — teams with ONLY these are national teams
const INTERNATIONAL_CODES = new Set(['WC', 'EURO', 'NL', 'CA']);

function isNationalTeam(team: SearchableTeam): boolean {
  // National teams: competition codes are exclusively international
  if (team.competitionCodes.length > 0 && team.competitionCodes.every((c) => INTERNATIONAL_CODES.has(c))) return true;
  // Fallback: team name matches its own country (e.g. name: "Argentina", country: "Argentina")
  if (team.name && team.country && team.name.toLowerCase() === team.country.toLowerCase()) return true;
  return false;
}

function getTeamTier(competitionCodes: string[]): number {
  let best = 6;
  for (const code of competitionCodes) {
    const tier = LEAGUE_TIER[code];
    if (tier !== undefined && tier < best) best = tier;
  }
  return best;
}

export function useSearchTeams(query: string, active = true) {
  const enabled = query.length >= 2 && active;
  const { data: allTeams, isLoading } = useQuery({
    queryKey: ['allTeams'],
    queryFn: getAllTeams,
    staleTime: 10 * 60 * 1000,
    enabled,
  });

  const { clubs, nationalTeams } = useMemo(() => {
    if (!allTeams || !enabled) return { clubs: [], nationalTeams: [] };
    const q = query.toLowerCase();
    const matched = allTeams.filter((t) =>
      t.name?.toLowerCase().includes(q) ||
      t.shortName?.toLowerCase().includes(q)
    );
    const clubResults = matched
      .filter((t) => !isNationalTeam(t))
      .sort((a, b) => getTeamTier(a.competitionCodes) - getTeamTier(b.competitionCodes) || a.name.localeCompare(b.name))
      .slice(0, 30);
    const nationalResults = matched
      .filter((t) => isNationalTeam(t))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { clubs: clubResults, nationalTeams: nationalResults };
  }, [allTeams, query, enabled]);

  return { data: clubs, nationalTeams, isLoading: isLoading && enabled };
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

// Search players via Firestore prefix query — paginated, ordered by leagueTier
export function useSearchPlayers(query: string, active = true) {
  return useInfiniteQuery({
    queryKey: ['searchPlayers', query],
    queryFn: ({ pageParam }) => searchPlayersQuery(query, pageParam),
    initialPageParam: undefined as { leagueTier: number; docId: string } | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: query.length >= 2 && active,
    staleTime: 2 * 60 * 1000,
  });
}
