import * as admin from 'firebase-admin';
import { getFixtureById, getFixtureEvents, getFixtureLineups, getFixtureStats } from '../apiFootball';
import { transformFixtureDetails } from '../transforms';
import { COLLECTIONS } from '../config';

const db = admin.firestore();

/**
 * Syncs match details (lineups, stats, events) for a list of fixture IDs.
 * Only fetches details for finished matches that don't already have details.
 * Uses 3 API calls per fixture (lineups + events + stats). Skips fixture fetch
 * since basic fixture data is already in the matches collection.
 */
export async function syncMatchDetails(fixtureIds: number[], force = false): Promise<number> {
  let synced = 0;

  for (const fixtureId of fixtureIds) {
    try {
      // Skip if already synced (unless forced)
      if (!force) {
        const existing = await db.collection(COLLECTIONS.MATCH_DETAILS).doc(String(fixtureId)).get();
        if (existing.exists) continue;
      }

      // Fetch lineups, events, stats, and fixture in parallel (4 calls)
      // We need the fixture for referee and venue info not stored in matches collection
      const [fixture, lineups, events, stats] = await Promise.all([
        getFixtureById(fixtureId),
        getFixtureLineups(fixtureId),
        getFixtureEvents(fixtureId),
        getFixtureStats(fixtureId),
      ]);

      if (!fixture) continue;

      const detailDoc = transformFixtureDetails(fixtureId, lineups, events, stats, fixture);

      await db.collection(COLLECTIONS.MATCH_DETAILS).doc(String(fixtureId)).set({
        ...detailDoc,
        syncedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Mark the match as having details so we never re-scan it
      await db.collection(COLLECTIONS.MATCHES).doc(String(fixtureId)).update({
        hasDetails: true,
      });

      synced++;
      console.log(`[syncDetails] Synced details for fixture ${fixtureId}`);
    } catch (err: any) {
      // If we hit an API rate limit, stop processing to avoid wasting calls
      if (err.message?.includes('request limit') || err.message?.includes('429')) {
        console.error(`[syncDetails] API rate limit hit after syncing ${synced} fixtures. Stopping.`);
        break;
      }
      console.error(`[syncDetails] Error syncing fixture ${fixtureId}:`, err.message);
    }
  }

  return synced;
}

/**
 * Finds recently finished matches that are missing details and syncs them.
 * Checks the last 7 days to catch any matches missed by previous failed syncs.
 * Uses batch existence checks instead of N+1 getDoc calls.
 * Also marks synced matches with hasDetails: true.
 */
export async function syncMissingDetails(): Promise<number> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const matchesSnapshot = await db
    .collection(COLLECTIONS.MATCHES)
    .where('status', '==', 'FINISHED')
    .where('kickoff', '>=', sevenDaysAgo.toISOString())
    .get();

  if (matchesSnapshot.empty) return 0;

  const fixtureIds = matchesSnapshot.docs.map((d) => d.data().id as number);

  // Batch-check which details already exist using getAll instead of N+1 getDoc
  const detailRefs = fixtureIds.map((id) =>
    db.collection(COLLECTIONS.MATCH_DETAILS).doc(String(id))
  );
  const detailSnaps = await db.getAll(...detailRefs);
  const missingIds = fixtureIds.filter((_, i) => !detailSnaps[i].exists);

  if (missingIds.length === 0) return 0;

  console.log(`[syncMissingDetails] Found ${missingIds.length} missing details out of ${fixtureIds.length} recent finished matches`);
  return await syncMatchDetails(missingIds);
}
