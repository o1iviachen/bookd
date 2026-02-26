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
 */
export async function syncMissingDetails(): Promise<number> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const matchesSnapshot = await db
    .collection(COLLECTIONS.MATCHES)
    .where('status', '==', 'FINISHED')
    .where('kickoff', '>=', sevenDaysAgo.toISOString())
    .get();

  const fixtureIds: number[] = [];
  for (const doc of matchesSnapshot.docs) {
    fixtureIds.push(doc.data().id);
  }

  if (fixtureIds.length === 0) return 0;

  console.log(`[syncMissingDetails] Found ${fixtureIds.length} recent finished matches to check`);
  return await syncMatchDetails(fixtureIds);
}

/**
 * Bulk syncs all finished matches missing details across all leagues.
 * Processes up to `limit` matches per call. Returns count and whether more remain.
 */
export async function syncAllMissingDetails(batchLimit = 50): Promise<{ synced: number; remaining: number }> {
  // Find ALL finished matches
  const matchesSnapshot = await db
    .collection(COLLECTIONS.MATCHES)
    .where('status', '==', 'FINISHED')
    .get();

  // Check which ones are missing details
  const missingIds: number[] = [];
  for (const matchDoc of matchesSnapshot.docs) {
    const fixtureId = matchDoc.data().id;
    const detailDoc = await db.collection(COLLECTIONS.MATCH_DETAILS).doc(String(fixtureId)).get();
    if (!detailDoc.exists) {
      missingIds.push(fixtureId);
    }
    if (missingIds.length >= batchLimit) break;
  }

  if (missingIds.length === 0) {
    return { synced: 0, remaining: 0 };
  }

  const totalMissing = matchesSnapshot.docs.length; // approximate
  const synced = await syncMatchDetails(missingIds);
  return { synced, remaining: Math.max(0, totalMissing - synced) };
}
