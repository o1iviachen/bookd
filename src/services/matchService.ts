import * as footballApi from './footballApi';
import { getCachedMatch, getCachedMatchesByIds, setCachedMatch, setCachedMatches } from './firestore/matches';
import { Match } from '../types/match';

/**
 * Cache-aware wrapper around footballApi.
 * FINISHED matches are served from cache; live/scheduled matches always hit the API.
 */

export async function getMatchById(id: number): Promise<Match> {
  // Try cache first
  const cached = await getCachedMatch(id);
  if (cached && cached.status === 'FINISHED') {
    return cached;
  }

  // API fallback
  const match = await footballApi.getMatchById(id);

  // Cache the result (fire-and-forget)
  setCachedMatch(match).catch(() => {});

  return match;
}

export async function getMatchesByDate(date: Date): Promise<Match[]> {
  // Always hit API for date browsing (live data)
  const matches = await footballApi.getMatchesByDate(date);

  // Cache all results in background
  setCachedMatches(matches).catch(() => {});

  return matches;
}

export async function getMatchesByDateRange(from: Date, to: Date): Promise<Match[]> {
  // Always hit API for range browsing (live data)
  const matches = await footballApi.getMatchesByDateRange(from, to);

  // Cache all results in background
  setCachedMatches(matches).catch(() => {});

  return matches;
}

export async function getMatchesByIds(ids: number[]): Promise<Map<number, Match>> {
  if (ids.length === 0) return new Map();

  // Batch cache lookup
  const cached = await getCachedMatchesByIds(ids);

  // Find misses (or non-FINISHED matches that need refreshing)
  const missingIds = ids.filter((id) => {
    const m = cached.get(id);
    return !m || m.status !== 'FINISHED';
  });

  if (missingIds.length === 0) return cached;

  // Fetch missing from API individually
  const apiResults = await Promise.allSettled(
    missingIds.map((id) => footballApi.getMatchById(id))
  );

  const newMatches: Match[] = [];
  apiResults.forEach((result) => {
    if (result.status === 'fulfilled') {
      cached.set(result.value.id, result.value);
      newMatches.push(result.value);
    }
  });

  // Cache new results in background
  if (newMatches.length > 0) {
    setCachedMatches(newMatches).catch(() => {});
  }

  return cached;
}

// Re-export utilities that don't need caching
export { groupMatchesByCompetition } from './footballApi';
