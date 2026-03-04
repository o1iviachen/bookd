import * as admin from 'firebase-admin';
import { getFixtures } from '../apiFootball';
import { transformFixtureToMatch } from '../transforms';
import { COLLECTIONS, FIRESTORE_BATCH_SIZE } from '../config';
import { getEnabledLeagues, getLeagueByApiIdMap, getSeasonForLeague } from '../leagueHelper';

const db = admin.firestore();

/**
 * Syncs matches for a given date range across all enabled leagues.
 * Called daily to fetch yesterday's results + today/tomorrow's schedule.
 */
export async function syncMatchesForDateRange(from: string, to: string): Promise<number> {
  const leagues = await getEnabledLeagues();
  const leagueMap = await getLeagueByApiIdMap();
  let totalSynced = 0;

  for (const league of leagues) {
    try {
      const fixtures = await getFixtures({
        league: league.apiId,
        season: getSeasonForLeague(league),
        from,
        to,
      });

      if (fixtures.length === 0) continue;

      const docs: Array<{ id: string; data: Record<string, any> }> = [];

      for (const fixture of fixtures) {
        const matchDoc = transformFixtureToMatch(fixture, leagueMap);
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
    const leagueMap = await getLeagueByApiIdMap();
    const fixtures = await getFixtures({ league: leagueApiId, season });

    if (fixtures.length === 0) return 0;

    const docs: Array<{ id: string; data: Record<string, any> }> = [];

    for (const fixture of fixtures) {
      const matchDoc = transformFixtureToMatch(fixture, leagueMap);
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
