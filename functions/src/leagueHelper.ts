import * as admin from 'firebase-admin';
import { COLLECTIONS } from './config';

export interface SyncLeague {
  code: string;
  apiId: number;
  name: string;
  country: string;
  tier: number;
  isCup: boolean;
  seasonType: 'european' | 'calendar-year';
  enabled: boolean;
}

let cachedLeagues: SyncLeague[] | null = null;

/** Fetch enabled leagues from Firestore. Cached for the lifetime of a function invocation. */
export async function getEnabledLeagues(): Promise<SyncLeague[]> {
  if (cachedLeagues) return cachedLeagues;
  const snap = await admin.firestore()
    .collection(COLLECTIONS.LEAGUES)
    .where('enabled', '==', true)
    .get();
  cachedLeagues = snap.docs.map((d) => d.data() as SyncLeague);
  return cachedLeagues;
}

/** Build a Map<apiId, SyncLeague> for O(1) lookups in transforms. */
export async function getLeagueByApiIdMap(): Promise<Map<number, SyncLeague>> {
  const leagues = await getEnabledLeagues();
  return new Map(leagues.map((l) => [l.apiId, l]));
}

/** Build a Map<code, SyncLeague> for O(1) lookups by code. */
export async function getLeagueByCodeMap(): Promise<Map<string, SyncLeague>> {
  const leagues = await getEnabledLeagues();
  return new Map(leagues.map((l) => [l.code, l]));
}

/** Get current season year based on league's seasonType. */
export function getSeasonForLeague(league: SyncLeague): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return league.seasonType === 'calendar-year' ? year : (month >= 7 ? year : year - 1);
}

/** Get the best (lowest) league tier for a set of competition codes. */
export async function getLeagueTier(competitionCodes?: string[]): Promise<number> {
  if (!competitionCodes || competitionCodes.length === 0) return 6;
  const codeMap = await getLeagueByCodeMap();
  let best = 6;
  for (const code of competitionCodes) {
    const tier = codeMap.get(code)?.tier;
    if (tier !== undefined && tier < best) best = tier;
  }
  return best;
}

/** Clear the cache (useful between long-running function phases). */
export function clearLeagueCache(): void {
  cachedLeagues = null;
}
