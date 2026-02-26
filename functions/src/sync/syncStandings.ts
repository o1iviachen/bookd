import * as admin from 'firebase-admin';
import { getStandings } from '../apiFootball';
import { transformStandings } from '../transforms';
import { SYNC_LEAGUES, COLLECTIONS } from '../config';
import { getCurrentSeason } from './syncMatches';

const db = admin.firestore();

/**
 * Syncs league standings for all configured leagues.
 * Writes to the `standings` collection with doc ID: `{code}_{season}`
 */
export async function syncAllStandings(): Promise<number> {
  let totalSynced = 0;

  for (const league of SYNC_LEAGUES) {
    try {
      const season = getCurrentSeason(league.apiId);
      const standingsGroups = await getStandings(league.apiId, season);

      if (standingsGroups.length === 0) continue;

      // For most leagues, there's one group. For CL group stage, there are multiple.
      // We store the first group as the main table, and all groups if there are multiple.
      const docId = `${league.code}_${season}`;
      const mainTable = standingsGroups[0] || [];

      const docData: Record<string, any> = {
        competitionCode: league.code,
        season,
        table: transformStandings(mainTable),
        syncedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // If there are multiple groups (e.g., CL groups), store them all
      if (standingsGroups.length > 1) {
        docData.groups = standingsGroups.map((group, i) => ({
          name: group[0]?.group || `Group ${i + 1}`,
          table: transformStandings(group),
        }));
      }

      await db.collection(COLLECTIONS.STANDINGS).doc(docId).set(docData, { merge: true });
      totalSynced++;

      console.log(`[syncStandings] ${league.code}: synced standings (${mainTable.length} teams)`);
    } catch (err: any) {
      console.error(`[syncStandings] Error syncing ${league.code}:`, err.message);
    }
  }

  return totalSynced;
}

/**
 * Syncs standings for a single league.
 */
export async function syncLeagueStandings(leagueCode: string, leagueApiId: number, season: number): Promise<void> {
  const standingsGroups = await getStandings(leagueApiId, season);
  if (standingsGroups.length === 0) return;

  const mainTable = standingsGroups[0] || [];
  const docId = `${leagueCode}_${season}`;

  const docData: Record<string, any> = {
    competitionCode: leagueCode,
    season,
    table: transformStandings(mainTable),
    syncedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (standingsGroups.length > 1) {
    docData.groups = standingsGroups.map((group, i) => ({
      name: group[0]?.group || `Group ${i + 1}`,
      table: transformStandings(group),
    }));
  }

  await db.collection(COLLECTIONS.STANDINGS).doc(docId).set(docData, { merge: true });
  console.log(`[syncStandings] ${leagueCode}: synced standings (${mainTable.length} teams)`);
}
