import * as admin from 'firebase-admin';
import { COLLECTIONS } from '../config';
import { getFixtureById } from '../apiFootball';
import { transformFixtureToMatch } from '../transforms';
import { getLeagueByApiIdMap, getLeagueByCodeMap, getSeasonForLeague } from '../leagueHelper';
import { syncMatchDetails } from './syncDetails';
import { syncLeagueStandings } from './syncStandings';

const db = admin.firestore();

/**
 * Finds stale matches and syncs their details:
 * 1. FINISHED matches 4+ hours past kickoff with hasDetails == false
 * 2. IN_PLAY/PAUSED matches 3+ hours past kickoff (stuck — missed FINISHED transition)
 *
 * For stuck matches, re-fetches the fixture to update status before syncing details.
 * Runs hourly as a safety net for matches missed by the live sync.
 */
export async function syncStaleMatchDetails(): Promise<number> {
  let synced = 0;

  try {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

    // 1. FINISHED matches missing details
    const finishedSnap = await db.collection(COLLECTIONS.MATCHES)
      .where('status', '==', 'FINISHED')
      .where('hasDetails', '==', false)
      .where('kickoff', '<=', fourHoursAgo)
      .limit(50)
      .get();

    // 2. Stuck IN_PLAY matches (3+ hours past kickoff)
    const stuckInPlaySnap = await db.collection(COLLECTIONS.MATCHES)
      .where('status', '==', 'IN_PLAY')
      .where('kickoff', '<=', threeHoursAgo)
      .limit(20)
      .get();

    const stuckPausedSnap = await db.collection(COLLECTIONS.MATCHES)
      .where('status', '==', 'PAUSED')
      .where('kickoff', '<=', threeHoursAgo)
      .limit(20)
      .get();

    // Track league codes that had finished matches (for standings sync)
    const leaguesWithFinished = new Set<string>();

    // Process finished matches missing details (skip those marked detailsNotFound)
    if (!finishedSnap.empty) {
      const fixtureIds = finishedSnap.docs
        .filter((d) => !d.data().detailsNotFound)
        .map((d) => {
          const dataId = d.data().id;
          if (String(dataId) !== d.id) {
            console.warn(`[staleSync] Doc ID mismatch: doc.id=${d.id}, data.id=${dataId}`);
          }
          const code = d.data().competition?.code as string;
          if (code) leaguesWithFinished.add(code);
          return dataId as number;
        });
      console.log(`[staleSync] Found ${fixtureIds.length} stale finished matches without details: ${fixtureIds.join(', ')}`);
      synced += await syncMatchDetails(fixtureIds);
    }

    // Process stuck IN_PLAY/PAUSED matches — re-fetch fixture to update status, then sync details
    const stuckDocs = [...stuckInPlaySnap.docs, ...stuckPausedSnap.docs];
    if (stuckDocs.length > 0) {
      const leagueMap = await getLeagueByApiIdMap();
      const stuckIds: number[] = [];

      for (const doc of stuckDocs) {
        const fixtureId = doc.data().id as number;
        try {
          const fixture = await getFixtureById(fixtureId);
          if (!fixture) continue;

          // Update match doc with latest status from API
          const matchDoc = transformFixtureToMatch(fixture, leagueMap);
          if (matchDoc) {
            await db.collection(COLLECTIONS.MATCHES).doc(doc.id).set(
              { ...matchDoc, cachedAt: admin.firestore.FieldValue.serverTimestamp() },
              { merge: true },
            );
            console.log(`[staleSync] Updated stuck match ${fixtureId}: ${doc.data().status} → ${matchDoc.status}`);

            if (matchDoc.status === 'FINISHED') {
              stuckIds.push(fixtureId);
              const code = matchDoc.competition?.code as string;
              if (code) leaguesWithFinished.add(code);
            }
          }
        } catch (err: any) {
          console.error(`[staleSync] Error re-fetching stuck match ${fixtureId}:`, err.message);
        }
      }

      if (stuckIds.length > 0) {
        console.log(`[staleSync] Syncing details for ${stuckIds.length} newly-finished stuck matches`);
        synced += await syncMatchDetails(stuckIds, true);
      }
    }

    // Update standings for leagues that had finished matches
    if (leaguesWithFinished.size > 0) {
      const codeMap = await getLeagueByCodeMap();
      for (const code of leaguesWithFinished) {
        const league = codeMap.get(code);
        if (!league) continue;
        try {
          await syncLeagueStandings(code, league.apiId, getSeasonForLeague(league));
          console.log(`[staleSync] ${code}: standings updated`);
        } catch (err: any) {
          console.error(`[staleSync] ${code}: error updating standings:`, err.message);
        }
      }
    }

    if (synced > 0) {
      console.log(`[staleSync] Total synced: ${synced}`);
    }

    return synced;
  } catch (err: any) {
    console.error('[staleSync] Error:', err.message);
    return synced;
  }
}
