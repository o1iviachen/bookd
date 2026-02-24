import { useQuery } from '@tanstack/react-query';
import { getPersonDetail } from '../services/footballApi';

export function usePersonDetail(personId: number) {
  return useQuery({
    queryKey: ['person', personId],
    queryFn: () => getPersonDetail(personId),
    enabled: !!personId,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
}
