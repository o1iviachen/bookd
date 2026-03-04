import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLeagues } from '../services/firestore/leagues';
import { League } from '../types/league';

export function useLeagues() {
  return useQuery({
    queryKey: ['leagues'],
    queryFn: getLeagues,
    staleTime: Infinity,
  });
}

export function useFollowableLeagues() {
  const { data: leagues, ...rest } = useLeagues();
  const followable = useMemo(
    () => leagues?.filter((l) => l.followable) ?? [],
    [leagues]
  );
  return { data: followable, ...rest };
}

export function useLeagueMap() {
  const { data: leagues, ...rest } = useLeagues();
  const map = useMemo(() => {
    const m = new Map<string, League>();
    leagues?.forEach((l) => m.set(l.code, l));
    return m;
  }, [leagues]);
  return { data: map, ...rest };
}
