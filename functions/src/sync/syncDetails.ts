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
      // Uses allSettled so partial data is still written if some calls fail
      const [fixtureResult, lineupsResult, eventsResult, statsResult] = await Promise.allSettled([
        getFixtureById(fixtureId),
        getFixtureLineups(fixtureId),
        getFixtureEvents(fixtureId),
        getFixtureStats(fixtureId),
      ]);

      const fixture = fixtureResult.status === 'fulfilled' ? fixtureResult.value : null;
      const lineups = lineupsResult.status === 'fulfilled' ? lineupsResult.value : null;
      const events = eventsResult.status === 'fulfilled' ? eventsResult.value : null;
      const stats = statsResult.status === 'fulfilled' ? statsResult.value : null;

      // Check for 403 on any call — mark detailsNotFound
      const allResults = [fixtureResult, lineupsResult, eventsResult, statsResult];
      const has403 = allResults.some(
        (r) => r.status === 'rejected' && r.reason?.message?.includes('403'),
      );
      if (has403) {
        console.warn(`[syncDetails] 403 for fixture ${fixtureId} — marking detailsNotFound to stop retries`);
        await db.collection(COLLECTIONS.MATCHES).doc(String(fixtureId)).update({ detailsNotFound: true });
        continue;
      }

      // Check for rate limit on any call — stop processing
      const hasRateLimit = allResults.some(
        (r) => r.status === 'rejected' && (r.reason?.message?.includes('429') || r.reason?.message?.includes('request limit')),
      );
      if (hasRateLimit) {
        console.error(`[syncDetails] API rate limit hit after syncing ${synced} fixtures. Stopping.`);
        break;
      }

      if (!fixture) {
        console.warn(`[syncDetails] Fixture ${fixtureId}: API returned no data — skipping`);
        continue;
      }

      // Log partial data warnings
      const missing: string[] = [];
      if (!lineups?.length) missing.push('lineups');
      if (!events?.length) missing.push('events');
      if (!stats?.length) missing.push('stats');
      if (missing.length > 0) {
        console.warn(`[syncDetails] Fixture ${fixtureId}: missing ${missing.join(', ')} — writing partial details`);
      }

      const detailDoc = transformFixtureDetails(fixtureId, lineups || [], events || [], stats || [], fixture);

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

  // Filter out matches marked as detailsNotFound (403 from API)
  const eligibleDocs = matchesSnapshot.docs.filter((d) => !d.data().detailsNotFound);
  const fixtureIds = eligibleDocs.map((d) => d.data().id as number);

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
