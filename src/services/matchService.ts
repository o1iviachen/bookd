/**
 * Match service — thin wrapper over footballApi.
 *
 * Previously this layer managed a Firestore cache on top of external API calls.
 * Now that footballApi reads directly from Firestore (synced by Cloud Functions),
 * this file simply re-exports those functions for backward compatibility.
 */

import * as footballApi from './footballApi';
import { Match } from '../types/match';

export async function getMatchById(id: number): Promise<Match> {
  return footballApi.getMatchById(id);
}

export async function getMatchesByDate(date: Date): Promise<Match[]> {
  return footballApi.getMatchesByDate(date);
}

export async function getMatchesByDateRange(from: Date, to: Date): Promise<Match[]> {
  return footballApi.getMatchesByDateRange(from, to);
}

export async function getMatchesByIds(ids: number[]): Promise<Map<number, Match>> {
  if (ids.length === 0) return new Map();

  const results = await Promise.allSettled(
    ids.map((id) => footballApi.getMatchById(id))
  );

  const map = new Map<number, Match>();
  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      map.set(result.value.id, result.value);
    }
  });

  return map;
}

// Re-export utilities
export { groupMatchesByCompetition } from './footballApi';
