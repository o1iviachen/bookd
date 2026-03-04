import * as admin from 'firebase-admin';
import { getLiveFixtures, getFixtures } from '../apiFootball';
import { transformFixtureToMatch } from '../transforms';
import { COLLECTIONS, FIRESTORE_BATCH_SIZE } from '../config';
import { SyncLeague, getEnabledLeagues, getLeagueByApiIdMap } from '../leagueHelper';

const db = admin.firestore();

/**
 * Fetches all currently live fixtures and updates scores in Firestore.
 * Also checks for stale matches (IN_PLAY/PAUSED 2+ hrs, SCHEDULED/TIMED 3+ hrs)
 * and re-fetches their status from the API.
 * Called every 2 minutes via Cloud Scheduler.
 */
export async function syncLiveMatches(): Promise<number> {
  let updated = 0;

  try {
    // 1. Update currently live matches
    const leagues = await getEnabledLeagues();
    const trackedIds = new Set(leagues.map((l) => l.apiId));
    const leagueMap = await getLeagueByApiIdMap();
    const liveFixtures = await getLiveFixtures();
    const tracked = liveFixtures.filter((f) => trackedIds.has(f.league.id));

    if (tracked.length > 0) {
      for (let i = 0; i < tracked.length; i += FIRESTORE_BATCH_SIZE) {
        const chunk = tracked.slice(i, i + FIRESTORE_BATCH_SIZE);
        const batch = db.batch();

        for (const fixture of chunk) {
          const matchDoc = transformFixtureToMatch(fixture, leagueMap);
          if (!matchDoc) continue;

          const ref = db.collection(COLLECTIONS.MATCHES).doc(String(fixture.fixture.id));
          batch.set(ref, {
            ...matchDoc,
            cachedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });
        }

        await batch.commit();
      }

      updated += tracked.length;
      console.log(`[syncLive] Updated ${tracked.length} live matches`);
    }

    // 2. Check for stale matches: kickoff was 3+ hours ago but still not FINISHED
    const staleUpdated = await syncStaleMatches(leagueMap);
    updated += staleUpdated;

    if (updated === 0) {
      console.log('[syncLive] No live or stale matches to update');
    }

    return updated;
  } catch (err: any) {
    console.error('[syncLive] Error:', err.message);
    return updated;
  }
}

/**
 * Finds matches in Firestore that should be finished but still have a
 * non-finished status, then re-fetches from API to update.
 *
 * Two cases:
 * - IN_PLAY/PAUSED with kickoff 2+ hours ago (match should be over by now)
 * - SCHEDULED/TIMED with kickoff 3+ hours ago (match was never marked live)
 */
async function syncStaleMatches(leagueMap: Map<number, SyncLeague>): Promise<number> {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

    const staleQueries: { statuses: string[]; cutoff: string }[] = [
      { statuses: ['IN_PLAY', 'PAUSED'], cutoff: twoHoursAgo.toISOString() },
      { statuses: ['SCHEDULED', 'TIMED'], cutoff: threeHoursAgo.toISOString() },
    ];
    const staleIds: number[] = [];

    for (const { statuses, cutoff } of staleQueries) {
      for (const status of statuses) {
        const snap = await db.collection(COLLECTIONS.MATCHES)
          .where('status', '==', status)
          .where('kickoff', '<=', cutoff)
          .limit(20)
          .get();

        snap.docs.forEach((d) => {
          const id = d.data().id;
          if (id && !staleIds.includes(id)) staleIds.push(id);
        });

        if (staleIds.length >= 20) break;
      }
      if (staleIds.length >= 20) break;
    }

    // Cap at 20 (API-Football limit per ids request)
    const idsToFetch = staleIds.slice(0, 20);

    if (idsToFetch.length === 0) return 0;

    console.log(`[syncLive] Found ${idsToFetch.length} stale matches, re-fetching from API`);

    const fixtures = await getFixtures({ ids: idsToFetch.join('-') });

    console.log(`[syncLive] API returned ${fixtures.length} fixtures for ${idsToFetch.length} stale IDs`);

    if (fixtures.length === 0) return 0;

    for (let i = 0; i < fixtures.length; i += FIRESTORE_BATCH_SIZE) {
      const chunk = fixtures.slice(i, i + FIRESTORE_BATCH_SIZE);
      const batch = db.batch();

      for (const fixture of chunk) {
        const matchDoc = transformFixtureToMatch(fixture, leagueMap);
        if (!matchDoc) continue;

        const ref = db.collection(COLLECTIONS.MATCHES).doc(String(fixture.fixture.id));
        batch.set(ref, {
          ...matchDoc,
          cachedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      await batch.commit();
    }

    console.log(`[syncLive] Updated ${fixtures.length} stale matches`);
    return fixtures.length;
  } catch (err: any) {
    console.error('[syncLive] Error syncing stale matches:', err.message);
    return 0;
  }
}
