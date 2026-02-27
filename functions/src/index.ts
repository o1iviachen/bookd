import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

import { syncMatchesForDateRange } from './sync/syncMatches';
import { syncAllStandings } from './sync/syncStandings';
import { syncMissingDetails, syncMatchDetails, syncAllMissingDetails } from './sync/syncDetails';
import { syncLiveMatches } from './sync/syncLive';
import { runBackfill, buildTeamsFromMatches, buildPlayersAndEnrichTeams, fetchTeamColors, enrichPlayersFromSquads, backfillPlayerNameLower } from './sync/backfill';

// ─── Push Notifications ───
export { sendPushNotification } from './notifications';

// ─── Scheduled Functions ───

/**
 * Daily sync: runs at 06:00 UTC every day.
 * Fetches yesterday's results, today's schedule, and tomorrow's schedule.
 * Also syncs standings and missing match details.
 */
export const dailySync = functions
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .pubsub.schedule('0 6 * * *')
  .timeZone('UTC')
  .onRun(async () => {
    const yesterday = formatDate(daysAgo(1));
    const today = formatDate(new Date());
    const tomorrow = formatDate(daysFromNow(1));
    const dayAfter = formatDate(daysFromNow(2));

    console.log('[dailySync] Starting...');

    // Sync matches: yesterday through day-after-tomorrow
    const matchCount = await syncMatchesForDateRange(yesterday, dayAfter);
    console.log(`[dailySync] Synced ${matchCount} matches`);

    // Sync standings
    const standingsCount = await syncAllStandings();
    console.log(`[dailySync] Synced ${standingsCount} league standings`);

    // Sync details for recently finished matches
    const detailsCount = await syncMissingDetails();
    console.log(`[dailySync] Synced ${detailsCount} match details`);

    console.log('[dailySync] Complete');
  });

/**
 * Live match sync: runs every 2 minutes.
 * Updates scores for currently in-play matches.
 */
export const liveSync = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .pubsub.schedule('every 2 minutes')
  .onRun(async () => {
    const count = await syncLiveMatches();
    if (count > 0) {
      console.log(`[liveSync] Updated ${count} live matches`);
    }
  });

/**
 * Detail backfill: runs every 5 minutes.
 * Syncs lineups/stats/events for finished matches that are missing details.
 * Processes 50 matches per run (~200 API calls, well within 300 req/min limit).
 * Also backfills playerIds for any newly synced docs.
 */
export const detailBackfill = functions
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .pubsub.schedule('every 5 minutes')
  .onRun(async () => {
    const result = await syncAllMissingDetails(50);
    if (result.synced > 0) {
      console.log(`[detailBackfill] Synced ${result.synced} match details (${result.remaining} remaining)`);

      // Backfill playerIds for newly synced docs
      const db = admin.firestore();
      const snapshot = await db.collection('matchDetails').limit(500).get();
      const batch = db.batch();
      let updated = 0;

      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (data.playerIds && Array.isArray(data.playerIds) && data.playerIds.length > 0) continue;

        const playerIds: number[] = [];
        for (const arr of [data.homeLineup, data.homeBench, data.awayLineup, data.awayBench]) {
          if (Array.isArray(arr)) {
            for (const p of arr) {
              if (p?.id) playerIds.push(p.id);
            }
          }
        }
        if (data.homeCoach?.id) playerIds.push(data.homeCoach.id);
        if (data.awayCoach?.id) playerIds.push(data.awayCoach.id);

        if (playerIds.length > 0) {
          batch.update(doc.ref, { playerIds });
          updated++;
        }
      }

      if (updated > 0) {
        await batch.commit();
        console.log(`[detailBackfill] Backfilled playerIds for ${updated} docs`);
      }
    }
  });

// ─── HTTP Functions (admin/backfill) ───

/**
 * Backfill historical data. Call via HTTP:
 *   GET /backfill?league=PL&season=2023&details=true
 *   GET /backfill (all leagues, all seasons, no details)
 */
export const backfill = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onRequest(async (req, res) => {
    // Basic auth check — only allow from authorized sources
    const authHeader = req.headers.authorization;
    const expectedKey = process.env.ADMIN_KEY;
    if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const leagueCode = req.query.league as string | undefined;
    const season = req.query.season ? parseInt(req.query.season as string, 10) : undefined;
    const includeDetails = req.query.details === 'true';

    console.log(`[backfill] Starting: league=${leagueCode || 'all'}, season=${season || 'all'}, details=${includeDetails}`);

    try {
      const result = await runBackfill({ leagueCode, season, includeDetails });
      res.json({
        success: true,
        ...result,
      });
    } catch (err: any) {
      console.error('[backfill] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

/**
 * Build team documents from existing match data.
 * Call after backfill to populate the teams collection.
 */
export const buildTeams = functions
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    try {
      const count = await buildTeamsFromMatches();
      res.json({ success: true, teams: count });
    } catch (err: any) {
      console.error('[buildTeams] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

/**
 * Manual trigger: sync matches for a specific date range.
 *   GET /manualSync?from=2024-01-01&to=2024-01-07
 */
export const manualSync = functions
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    const action = req.query.action as string | undefined;

    // Standings-only sync
    if (action === 'standings') {
      try {
        const count = await syncAllStandings();
        res.json({ success: true, standings: count });
      } catch (err: any) {
        console.error('[manualSync] Standings error:', err);
        res.status(500).json({ error: err.message });
      }
      return;
    }

    const from = req.query.from as string;
    const to = req.query.to as string;

    if (!from || !to) {
      res.status(400).json({ error: 'Missing from/to query params (YYYY-MM-DD). Or use ?action=standings' });
      return;
    }

    try {
      const matchCount = await syncMatchesForDateRange(from, to);
      res.json({ success: true, matches: matchCount });
    } catch (err: any) {
      console.error('[manualSync] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

/**
 * Sync match details (lineups/stats/events) for a league+season.
 * Processes in batches to avoid timeout.
 *   GET /syncDetailsForLeague?league=PL&season=2024&limit=50
 */
export const syncDetailsForLeague = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onRequest(async (req, res) => {
    const leagueCode = req.query.league as string;
    const season = req.query.season ? parseInt(req.query.season as string, 10) : undefined;
    const batchLimit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    if (!leagueCode) {
      res.status(400).json({ error: 'Missing league query param' });
      return;
    }

    try {
      const db = admin.firestore();

      // Find finished matches for this league that don't have details yet
      let q = db.collection('matches')
        .where('competition.code', '==', leagueCode)
        .where('status', '==', 'FINISHED');

      if (season) {
        q = q.where('season', '==', season);
      }

      const snapshot = await q.get();
      const allIds = snapshot.docs.map((d) => d.data().id as number);

      // Check which ones already have details
      const missingIds: number[] = [];
      for (const id of allIds) {
        const detailDoc = await db.collection('matchDetails').doc(String(id)).get();
        if (!detailDoc.exists) {
          missingIds.push(id);
        }
        if (missingIds.length >= batchLimit) break;
      }

      if (missingIds.length === 0) {
        res.json({ success: true, synced: 0, remaining: 0, message: 'All details already synced' });
        return;
      }

      const synced = await syncMatchDetails(missingIds);
      const remaining = allIds.length - (allIds.length - missingIds.length) - synced;

      res.json({
        success: true,
        synced,
        totalMatches: allIds.length,
        remaining: Math.max(0, allIds.length - synced - (allIds.length - missingIds.length)),
        message: remaining > 0 ? 'Call again to sync more' : 'Complete',
      });
    } catch (err: any) {
      console.error('[syncDetailsForLeague] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

/**
 * Bulk sync ALL missing match details across all leagues.
 * Processes up to `limit` matches per call (default 50).
 * Call repeatedly until remaining=0.
 *   GET /syncAllDetails?limit=50
 */
export const syncAllDetails = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onRequest(async (req, res) => {
    const batchLimit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    try {
      const result = await syncAllMissingDetails(batchLimit);
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error('[syncAllDetails] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

/**
 * Build player documents and enrich teams with coach/squad from match details.
 * Call after syncing match details.
 */
export const buildPlayers = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onRequest(async (req, res) => {
    try {
      const result = await buildPlayersAndEnrichTeams();
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error('[buildPlayers] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

/**
 * Fetch team colors and venue info from API-Football.
 *   GET /enrichTeams?limit=100
 */
export const enrichTeams = functions
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    try {
      const updated = await fetchTeamColors(limit);
      res.json({ success: true, updated });
    } catch (err: any) {
      console.error('[enrichTeams] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

/**
 * Enrich player docs with photos from API-Football /players/squads endpoint.
 * Processes teams in batches. Call multiple times with offset to cover all teams.
 *   GET /enrichPlayers?limit=50&offset=0
 */
export const enrichPlayers = functions
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
    try {
      const result = await enrichPlayersFromSquads(limit, offset);
      res.json({ success: true, ...result });
    } catch (err: any) {
      console.error('[enrichPlayers] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

/**
 * One-time migration: add nameLower field to all player docs for search.
 *   GET /migratePlayerNames
 */
export const migratePlayerNames = functions
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    try {
      const count = await backfillPlayerNameLower();
      res.json({ success: true, updated: count });
    } catch (err: any) {
      console.error('[migratePlayerNames] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

/**
 * Backfill playerIds into existing matchDetails documents.
 * Reads lineup/bench/coach data already stored in each doc and writes
 * the playerIds array so array-contains queries work.
 *   GET /backfillPlayerIds?limit=500
 */
export const backfillPlayerIds = functions
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    const batchLimit = req.query.limit ? parseInt(req.query.limit as string, 10) : 500;
    try {
      const db = admin.firestore();
      // Find matchDetails that don't have playerIds yet
      const snapshot = await db.collection('matchDetails').limit(batchLimit).get();

      let updated = 0;
      let skipped = 0;
      const batch = db.batch();

      for (const doc of snapshot.docs) {
        const data = doc.data();

        // Skip if already has playerIds
        if (data.playerIds && Array.isArray(data.playerIds) && data.playerIds.length > 0) {
          skipped++;
          continue;
        }

        // Extract player IDs from lineup data
        const playerIds: number[] = [];
        for (const arr of [data.homeLineup, data.homeBench, data.awayLineup, data.awayBench]) {
          if (Array.isArray(arr)) {
            for (const p of arr) {
              if (p?.id) playerIds.push(p.id);
            }
          }
        }
        if (data.homeCoach?.id) playerIds.push(data.homeCoach.id);
        if (data.awayCoach?.id) playerIds.push(data.awayCoach.id);

        if (playerIds.length > 0) {
          batch.update(doc.ref, { playerIds });
          updated++;
        }
      }

      if (updated > 0) await batch.commit();

      res.json({
        success: true,
        total: snapshot.size,
        updated,
        skipped,
        message: updated > 0 ? `Updated ${updated} docs. Run again if more remain.` : 'All docs already have playerIds.',
      });
    } catch (err: any) {
      console.error('[backfillPlayerIds] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

// ─── Helpers ───

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
