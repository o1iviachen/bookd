import { useQuery } from '@tanstack/react-query';
import { getTeamDetail, getTeamMatches } from '../services/footballApi';

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
