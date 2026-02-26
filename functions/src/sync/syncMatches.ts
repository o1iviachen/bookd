import * as admin from 'firebase-admin';
import { getFixtures } from '../apiFootball';
import { transformFixtureToMatch } from '../transforms';
import { SYNC_LEAGUES, COLLECTIONS, FIRESTORE_BATCH_SIZE } from '../config';

const db = admin.firestore();

/**
 * Syncs matches for a given date range across all configured leagues.
 * Called daily to fetch yesterday's results + today/tomorrow's schedule.
 */
export async function syncMatchesForDateRange(from: string, to: string): Promise<number> {
  let totalSynced = 0;

  for (const league of SYNC_LEAGUES) {
    try {
      const fixtures = await getFixtures({
        league: league.apiId,
        season: getCurrentSeason(league.apiId),
        from,
        to,
      });

      if (fixtures.length === 0) continue;

      const docs: Array<{ id: string; data: Record<string, any> }> = [];

      for (const fixture of fixtures) {
        const matchDoc = transformFixtureToMatch(fixture);
        if (!matchDoc) continue;
        docs.push({ id: String(fixture.fixture.id), data: matchDoc });
      }

      await batchWrite(docs);
      totalSynced += docs.length;

      console.log(`[syncMatches] ${league.code}: synced ${docs.length} matches (${from} to ${to})`);
    } catch (err: any) {
      console.error(`[syncMatches] Error syncing ${league.code}:`, err.message);
    }
  }

  return totalSynced;
}

/**
 * Syncs all matches for a specific league and season.
 * Used by backfill and initial setup.
 */
export async function syncLeagueSeason(leagueApiId: number, season: number): Promise<number> {
  try {
    const fixtures = await getFixtures({ league: leagueApiId, season });

    if (fixtures.length === 0) return 0;

    const docs: Array<{ id: string; data: Record<string, any> }> = [];

    for (const fixture of fixtures) {
      const matchDoc = transformFixtureToMatch(fixture);
      if (!matchDoc) continue;
      docs.push({ id: String(fixture.fixture.id), data: matchDoc });
    }

    await batchWrite(docs);
    return docs.length;
  } catch (err: any) {
    console.error(`[syncLeagueSeason] Error syncing league ${leagueApiId} season ${season}:`, err.message);
    return 0;
  }
}

// ─── Helpers ───

async function batchWrite(docs: Array<{ id: string; data: Record<string, any> }>): Promise<void> {
  for (let i = 0; i < docs.length; i += FIRESTORE_BATCH_SIZE) {
    const chunk = docs.slice(i, i + FIRESTORE_BATCH_SIZE);
    const batch = db.batch();

    for (const { id, data } of chunk) {
      const ref = db.collection(COLLECTIONS.MATCHES).doc(id);
      batch.set(ref, { ...data, cachedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }

    await batch.commit();
  }
}

/**
 * Determines the current season year for a league.
 * European leagues: season starts in Aug/Sep, so Aug-Dec = current year, Jan-Jul = previous year.
 * Southern hemisphere / calendar year leagues (MLS, BSA, JPL): use calendar year.
 */
function getCurrentSeason(leagueApiId: number): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12

  // Calendar-year leagues
  const calendarYearLeagues = [253, 71, 128, 98, 188]; // MLS, BSA, ARG, JPL, AUS
  if (calendarYearLeagues.includes(leagueApiId)) {
    return year;
  }

  // European leagues: season = start year
  return month >= 7 ? year : year - 1;
}

export { getCurrentSeason };
