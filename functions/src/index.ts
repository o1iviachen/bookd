import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

import { syncMatchesForDateRange } from './sync/syncMatches';
import { syncAllStandings } from './sync/syncStandings';
import { syncMissingDetails, syncMatchDetails } from './sync/syncDetails';
import { syncLiveMatches } from './sync/syncLive';
import { runBackfill, buildTeamsFromMatches, buildPlayersAndEnrichTeams, fetchTeamColors, enrichPlayersFromSquads, backfillPlayerNameLower, generateSearchPrefixes, getLeagueTier } from './sync/backfill';

// ─── Push Notifications ───
export { sendPushNotification } from './notifications';

// ─── Content Moderation ───
export { moderateReviewMedia } from './moderateMedia';

// ─── User Account ───
export { deleteAccount } from './user';

// ─── Reports ───
export { submitReport } from './report';

/**
 * One-time migration: backfill kickoff + season into matchDetails docs.
 * Required so getMatchesForPerson can sort by kickoff DESC (most recent first).
 * Safe to re-run — skips docs that already have a kickoff field.
 *   GET /backfillMatchDetailKickoffs
 */
export const backfillMatchDetailKickoffs = functions
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .https.onRequest(async (_req, res) => {
    try {
      const db = admin.firestore();
      const BATCH_SIZE = 500;
      let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
      let updated = 0;
      let skipped = 0;

      while (true) {
        let q: FirebaseFirestore.Query = db.collection('matchDetails').limit(BATCH_SIZE);
        if (lastDoc) q = q.startAfter(lastDoc);

        const snap = await q.get();
        if (snap.empty) break;

        const needsKickoff = snap.docs.filter((d) => !d.data().kickoff);
        skipped += snap.docs.length - needsKickoff.length;

        if (needsKickoff.length > 0) {
          const matchRefs = needsKickoff.map((d) =>
            db.collection('matches').doc(String(d.data().matchId))
          );
          const matchSnaps = await db.getAll(...matchRefs);

          const batch = db.batch();
          for (let i = 0; i < needsKickoff.length; i++) {
            const matchData = matchSnaps[i].data();
            if (matchData?.kickoff) {
              batch.update(needsKickoff[i].ref, {
                kickoff: matchData.kickoff,
                season: matchData.season ?? null,
              });
              updated++;
            }
          }
          await batch.commit();
        }

        lastDoc = snap.docs[snap.docs.length - 1];
        console.log(`[backfillMatchDetailKickoffs] ${updated + skipped} processed (${updated} updated, ${skipped} skipped)`);
      }

      res.json({ success: true, updated, skipped, total: updated + skipped });
    } catch (err: any) {
      console.error('[backfillMatchDetailKickoffs] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

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
 * Detail backfill: runs every 2 minutes.
 * Queries matches with hasDetails == false to find exactly the ones needing work.
 * Processes ~28 matches per run (4 API calls each = ~112 calls/run).
 * 720 runs/day × ~28 matches = ~20,160 matches/day, exactly 10x the original rate.
 * ~50 Firestore reads per run instead of ~55,000 with the old full-scan approach.
 */
export const detailBackfill = functions
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .pubsub.schedule('every 2 minutes')
  .onRun(async () => {
    const db = admin.firestore();

    // Query only matches that are missing details
    const snapshot = await db.collection('matches')
      .where('status', '==', 'FINISHED')
      .where('hasDetails', '==', false)
      .limit(28)
      .get();

    if (snapshot.empty) return;

    const fixtureIds = snapshot.docs.map((d) => d.data().id as number);
    const synced = await syncMatchDetails(fixtureIds);

    if (synced > 0) {
      console.log(`[detailBackfill] Synced ${synced} match details`);
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

      // Batch-check which ones already have details
      const detailRefs = allIds.map((id) => db.collection('matchDetails').doc(String(id)));
      const detailSnaps = await db.getAll(...detailRefs);
      const missingIds = allIds.filter((_, i) => !detailSnaps[i].exists).slice(0, batchLimit);

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
 * One-time migration: sets hasDetails flag on all match documents.
 * - Matches WITH details in matchDetails collection → hasDetails: true
 * - Matches WITHOUT details → hasDetails: false
 * This enables the efficient detailBackfill query (where hasDetails == false).
 *   GET /migrateHasDetails
 */
export const migrateHasDetails = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onRequest(async (req, res) => {
    try {
      const db = admin.firestore();
      const BATCH_SIZE = 500;

      // Step 1: Get all matchDetails IDs (these matches have details)
      const detailsSnapshot = await db.collection('matchDetails').select().get();
      const detailIds = new Set(detailsSnapshot.docs.map((d) => d.id));
      console.log(`[migrateHasDetails] Found ${detailIds.size} matchDetails docs`);

      // Step 2: Iterate all finished matches and set hasDetails accordingly
      let lastDoc: any = null;
      let markedTrue = 0;
      let markedFalse = 0;

      while (true) {
        let q = db.collection('matches')
          .where('status', '==', 'FINISHED')
          .limit(BATCH_SIZE);

        if (lastDoc) {
          q = q.startAfter(lastDoc);
        }

        const snapshot = await q.get();
        if (snapshot.empty) break;

        const batch = db.batch();
        for (const doc of snapshot.docs) {
          const fixtureId = String(doc.data().id);
          const hasDetails = detailIds.has(fixtureId);
          batch.update(doc.ref, { hasDetails });
          if (hasDetails) markedTrue++;
          else markedFalse++;
        }
        await batch.commit();

        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        console.log(`[migrateHasDetails] Processed ${markedTrue + markedFalse} matches so far...`);
      }

      res.json({
        success: true,
        markedTrue,
        markedFalse,
        total: markedTrue + markedFalse,
      });
    } catch (err: any) {
      console.error('[migrateHasDetails] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

/**
 * One-time migration: fix player names by applying shortName() logic.
 * Rewrites name, nameLower, searchName for all player docs.
 *   GET /fixPlayerNames
 */
export const fixPlayerNames = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onRequest(async (req, res) => {
    try {
      const db = admin.firestore();
      const BATCH_SIZE = 500;

      // Same sets as client-side formatName.ts
      const PARTICLES = new Set([
        'de', 'da', 'do', 'dos', 'das', 'di', 'del', 'della', 'degli',
        'van', 'von', 'den', 'der', 'el', 'al', 'bin', 'ibn',
        'le', 'la', 'les', 'du', 'des',
      ]);
      const FILLERS = new Set([
        'santos', 'silva', 'souza', 'sousa', 'oliveira', 'lima', 'pereira',
        'ferreira', 'almeida', 'costa', 'rodrigues', 'martins', 'araujo',
        'aveiro', 'junior', 'neto', 'filho', 'cuccittini',
      ]);

      function fixName(fullName: string): string {
        if (!fullName) return fullName;
        const parts = fullName.trim().split(/\s+/);
        if (parts.length <= 2) return fullName.trim();

        const first = parts[0];
        let lastNameIdx = -1;
        for (let i = parts.length - 1; i >= 1; i--) {
          const lower = parts[i].toLowerCase();
          if (!FILLERS.has(lower) && !PARTICLES.has(lower)) {
            lastNameIdx = i;
            break;
          }
        }
        if (lastNameIdx === -1) lastNameIdx = parts.length - 1;

        let startIdx = lastNameIdx;
        while (startIdx > 1 && PARTICLES.has(parts[startIdx - 1].toLowerCase())) {
          startIdx--;
        }

        return `${first} ${parts.slice(startIdx, lastNameIdx + 1).join(' ')}`;
      }

      function extractSearch(name: string): string {
        const lower = name.toLowerCase().trim();
        const dotMatch = lower.match(/^[a-z]\.\s+(.+)$/);
        if (dotMatch) return dotMatch[1];
        const parts = lower.split(/\s+/);
        if (parts.length <= 1) return lower;
        return parts[parts.length - 1];
      }

      let lastDoc: any = null;
      let fixed = 0;
      let unchanged = 0;

      while (true) {
        let q = db.collection('players').limit(BATCH_SIZE);
        if (lastDoc) q = q.startAfter(lastDoc);

        const snapshot = await q.get();
        if (snapshot.empty) break;

        const batch = db.batch();
        let batchWrites = 0;

        for (const doc of snapshot.docs) {
          const data = doc.data();
          const oldName = data.name || '';
          const newName = fixName(oldName);

          if (newName !== oldName) {
            batch.update(doc.ref, {
              name: newName,
              nameLower: newName.toLowerCase(),
              searchName: extractSearch(newName),
            });
            batchWrites++;
            fixed++;
          } else {
            unchanged++;
          }
        }

        if (batchWrites > 0) await batch.commit();
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        console.log(`[fixPlayerNames] Processed ${fixed + unchanged} players (${fixed} fixed, ${unchanged} unchanged)`);
      }

      res.json({ success: true, fixed, unchanged, total: fixed + unchanged });
    } catch (err: any) {
      console.error('[fixPlayerNames] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

/**
 * One-time migration: add searchPrefixes array to all player docs.
 * Enables word-level search via array-contains queries.
 *   GET /migrateSearchPrefixes
 */
export const migrateSearchPrefixes = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onRequest(async (req, res) => {
    try {
      const db = admin.firestore();
      const BATCH_SIZE = 500;
      let lastDoc: any = null;
      let updated = 0;

      while (true) {
        let q = db.collection('players').limit(BATCH_SIZE);
        if (lastDoc) q = q.startAfter(lastDoc);

        const snapshot = await q.get();
        if (snapshot.empty) break;

        const batch = db.batch();
        for (const doc of snapshot.docs) {
          const data = doc.data();
          if (data.name) {
            batch.update(doc.ref, {
              searchPrefixes: generateSearchPrefixes(data.name),
            });
            updated++;
          }
        }
        await batch.commit();
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        console.log(`[migrateSearchPrefixes] Processed ${updated} players`);
      }

      res.json({ success: true, updated });
    } catch (err: any) {
      console.error('[migrateSearchPrefixes] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

/**
 * Migrate leagueTier onto all player docs based on their currentTeam's competitionCodes.
 *   GET /migrateLeagueTier
 */
export const migrateLeagueTier = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onRequest(async (req, res) => {
    try {
      const db = admin.firestore();

      // Build a map of teamId → competitionCodes from all team docs
      const teamCompCodes = new Map<number, string[]>();
      const teamsSnap = await db.collection('teams').get();
      for (const d of teamsSnap.docs) {
        const data = d.data();
        if (data.id && data.competitionCodes) {
          teamCompCodes.set(data.id, data.competitionCodes);
        }
      }
      console.log(`[migrateLeagueTier] Loaded ${teamCompCodes.size} teams`);

      // Paginate through all player docs
      let updated = 0;
      let lastDoc: any = null;

      while (true) {
        let q = db.collection('players').orderBy('id').limit(500);
        if (lastDoc) q = q.startAfter(lastDoc);
        const snap = await q.get();
        if (snap.empty) break;

        const batch = db.batch();
        for (const d of snap.docs) {
          const data = d.data();
          const teamId = data.currentTeam?.id;
          const codes = teamId ? teamCompCodes.get(teamId) : undefined;
          const tier = getLeagueTier(codes);
          batch.update(d.ref, { leagueTier: tier });
        }
        await batch.commit();
        updated += snap.docs.length;
        lastDoc = snap.docs[snap.docs.length - 1];
        console.log(`[migrateLeagueTier] Processed ${updated} players`);
      }

      res.json({ success: true, updated });
    } catch (err: any) {
      console.error('[migrateLeagueTier] Error:', err);
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
