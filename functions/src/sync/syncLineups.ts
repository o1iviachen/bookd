import * as admin from 'firebase-admin';
import { getFixtureLineups } from '../apiFootball';
import { transformLineupOnly } from '../transforms';
import { COLLECTIONS } from '../config';

const db = admin.firestore();

/**
 * Fetches lineups for matches starting within the next 60 minutes.
 * Runs every 5 minutes via Cloud Scheduler.
 *
 * - 60–10 min before kickoff: fetches lineup, writes only if not already stored
 * - Last 10 min before kickoff: always writes (override for last-minute changes)
 */
export async function syncPreMatchLineups(): Promise<number> {
  let synced = 0;

  try {
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const sixtyMinFromNow = new Date(now + 60 * 60 * 1000).toISOString();

    // Find scheduled matches with kickoff in the next 60 minutes
    const snap = await db.collection(COLLECTIONS.MATCHES)
      .where('status', 'in', ['SCHEDULED', 'TIMED'])
      .where('kickoff', '>=', nowIso)
      .where('kickoff', '<=', sixtyMinFromNow)
      .get();

    if (snap.empty) return 0;

    console.log(`[lineupSync] Found ${snap.size} matches starting within 60 min`);

    for (const doc of snap.docs) {
      const match = doc.data();
      const fixtureId = match.id as number;
      const kickoffMs = new Date(match.kickoff).getTime();
      const minutesUntilKickoff = (kickoffMs - now) / (60 * 1000);

      // If more than 10 min away, check if we already have lineups
      if (minutesUntilKickoff > 10) {
        const detailDoc = await db.collection(COLLECTIONS.MATCH_DETAILS).doc(String(fixtureId)).get();
        if (detailDoc.exists) {
          const data = detailDoc.data();
          if (data?.homeLineup?.length > 0) {
            continue; // Already have lineups, skip until last 10 min
          }
        }
      }

      // Fetch lineups from API
      const lineups = await getFixtureLineups(fixtureId);

      if (!lineups || lineups.length === 0) {
        continue; // Lineups not available yet
      }

      // Check if lineups actually contain players (API may return empty arrays)
      const hasPlayers = lineups.some((l) => l.startXI && l.startXI.length > 0);
      if (!hasPlayers) continue;

      const lineupDoc = transformLineupOnly(
        fixtureId,
        lineups,
        match.homeTeam.id,
        match.awayTeam.id,
        match.kickoff,
        match.season,
      );

      await db.collection(COLLECTIONS.MATCH_DETAILS).doc(String(fixtureId)).set(
        { ...lineupDoc, syncedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true },
      );

      synced++;
      console.log(`[lineupSync] ${fixtureId}: lineup synced (${minutesUntilKickoff.toFixed(0)} min to kickoff)`);
    }

    return synced;
  } catch (err: any) {
    console.error('[lineupSync] Error:', err.message);
    return synced;
  }
}
