import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

import { syncMatchesForDateRange } from './sync/syncMatches';
import { syncAllStandings } from './sync/syncStandings';
import { syncMatchDetails } from './sync/syncDetails';
import { syncLiveMatches } from './sync/syncLive';
import { syncPreMatchLineups } from './sync/syncLineups';
import { syncStaleMatchDetails } from './sync/syncStale';
import { runBackfill, buildTeamsFromMatches, buildPlayersAndEnrichTeams, fetchTeamColors, enrichPlayersFromSquads, refreshSquadsOnly, backfillPlayerNameLower, generateSearchPrefixes, backfillMissingMatchDetails } from './sync/backfill';
import { getLeagueTier } from './leagueHelper';
import { SYNC_LEAGUES, COLLECTIONS } from './config';

// ─── Push Notifications ───
export { sendPushNotification } from './notifications';

import { sendPreMatchNotifications, handleMatchStatusChange } from './matchEventNotifications';

// ─── Match Event Notifications ───

export const preMatchNotify = functions
  .runWith({ timeoutSeconds: 120, memory: '256MB' })
  .pubsub.schedule('every 5 minutes')
  .onRun(async () => {
    const count = await sendPreMatchNotifications();
    if (count > 0) console.log(`[preMatchNotify] Sent for ${count} matches`);
  });

export const onMatchStatusChange = functions
  .runWith({ timeoutSeconds: 60, memory: '256MB' })
  .firestore.document('matches/{matchId}')
  .onUpdate(async (change) => {
    await handleMatchStatusChange(change);
  });

// ─── Content Moderation ───
export { moderateReviewMedia } from './moderateMedia';

// ─── User Account ───
export { deleteAccount } from './user';

// ─── Reports ───
export { submitReport } from './report';

// ─── Translation ───
export { translateText } from './translate';

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
 * Daily prepopulation: runs at 05:00 UTC every day.
 * Fetches yesterday's results + next 7 days of upcoming matches.
 * Also syncs standings for all leagues.
 */
export const dailyPrepopulate = functions
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .pubsub.schedule('0 5 * * *')
  .timeZone('UTC')
  .onRun(async () => {
    const yesterday = formatDate(daysAgo(1));
    const weekAhead = formatDate(daysFromNow(7));

    console.log('[dailyPrepopulate] Starting...');

    const matchCount = await syncMatchesForDateRange(yesterday, weekAhead);
    console.log(`[dailyPrepopulate] Synced ${matchCount} matches (${yesterday} to ${weekAhead})`);

    const standingsCount = await syncAllStandings();
    console.log(`[dailyPrepopulate] Synced ${standingsCount} league standings`);

    console.log('[dailyPrepopulate] Complete');
  });

/**
 * Lineup sync: runs every 5 minutes.
 * Fetches lineups for matches starting within the next 60 minutes.
 * Overrides lineup data in the last 10 minutes before kickoff.
 */
export const lineupSync = functions
  .runWith({ timeoutSeconds: 120, memory: '256MB' })
  .pubsub.schedule('every 5 minutes')
  .onRun(async () => {
    const synced = await syncPreMatchLineups();
    if (synced > 0) console.log(`[lineupSync] Synced ${synced} lineups`);
  });

/**
 * Live sync: runs every 1 minute.
 * Per-league fixture queries for active leagues, updates scores/status.
 * Fetches events + stats for each live match.
 * Runs full detail sync when a match transitions to FINISHED.
 */
export const liveSync = functions
  .runWith({ timeoutSeconds: 120, memory: '512MB' })
  .pubsub.schedule('every 1 minutes')
  .onRun(async () => {
    const result = await syncLiveMatches();
    if (result.matchesUpdated > 0) {
      console.log(`[liveSync] ${result.matchesUpdated} matches, ${result.detailsUpdated} details`);
    }
  });

/**
 * Stale sync: runs every hour.
 * Catches finished matches 4+ hours past kickoff that are still missing
 * complete match details. Safety net for anything the live sync missed.
 */
export const staleSync = functions
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .pubsub.schedule('every 1 hours')
  .onRun(async () => {
    const synced = await syncStaleMatchDetails();
    if (synced > 0) console.log(`[staleSync] Synced ${synced} stale match details`);
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
 * Backfill missing matchDetails for FINISHED matches.
 * Does ground-truth existence check (not just hasDetails flag).
 * Also fixes inconsistent hasDetails flags.
 *   GET /backfillDetails
 *   GET /backfillDetails?max=1000
 */
export const backfillDetails = functions
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    try {
      const max = parseInt(req.query.max as string) || 500;
      const result = await backfillMissingMatchDetails(max);
      res.json(result);
    } catch (err: any) {
      console.error('[backfillDetails] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

/**
 * Scheduled backfill: processes up to 100 missing matchDetails every 5 minutes.
 * 100 matches × 4 API calls = 400 calls per run.
 * 288 runs/day × 400 = ~115K max (stops early when no missing matches remain).
 */
export const scheduledBackfillDetails = functions
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .pubsub.schedule('every 2 minutes')
  .onRun(async () => {
    const result = await backfillMissingMatchDetails(100);
    if (result.missing > 0) {
      console.log(`[scheduledBackfillDetails] ${result.synced} synced, ${result.failed} failed, ${result.missing} were missing`);
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
          const tier = await getLeagueTier(codes);
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
 * Manual trigger for squad-only refresh (Phases 1-3).
 *   GET /triggerSquadRefresh?limit=200
 * Uses cursor stored in aggregates/squadRefreshCursor.
 */
export const triggerSquadRefresh = functions
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 200;
    try {
      const db = admin.firestore();
      const cursorDoc = await db.collection('aggregates').doc('squadRefreshCursor').get();
      const lastTeamId = cursorDoc.exists ? (cursorDoc.data()?.lastTeamId ?? 0) : 0;

      const result = await refreshSquadsOnly(limit, lastTeamId);

      if (result.teamsProcessed < limit) {
        // Completed full cycle — reset cursor
        await db.collection('aggregates').doc('squadRefreshCursor').set({
          lastTeamId: 0,
          lastCompletedCycle: admin.firestore.FieldValue.serverTimestamp(),
          lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        await db.collection('aggregates').doc('squadRefreshCursor').set({
          lastTeamId: result.lastProcessedTeamId,
          lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      }

      res.json({ success: true, ...result, cursorReset: result.teamsProcessed < limit });
    } catch (err: any) {
      console.error('[triggerSquadRefresh] Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

/**
 * Scheduled squad refresh — runs daily at 04:00 UTC.
 * During transfer windows (Jan, Jun-Aug): runs every day.
 * Outside transfer windows: runs Mondays only.
 * Processes 200 teams per invocation using cursor-based batching.
 */
export const squadRefresh = functions
  .runWith({ timeoutSeconds: 540, memory: '512MB' })
  .pubsub.schedule('0 4 * * *')
  .timeZone('UTC')
  .onRun(async () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday

    const isTransferWindow = (month >= 6 && month <= 8) || month === 1;

    if (!isTransferWindow && dayOfWeek !== 1) {
      console.log('[squadRefresh] Skipping — not a transfer window and not Monday');
      return;
    }

    const BATCH_SIZE = 200;
    const db = admin.firestore();
    const cursorDoc = await db.collection('aggregates').doc('squadRefreshCursor').get();
    const lastTeamId = cursorDoc.exists ? (cursorDoc.data()?.lastTeamId ?? 0) : 0;

    console.log(`[squadRefresh] Starting at cursor=${lastTeamId}, transferWindow=${isTransferWindow}`);

    const result = await refreshSquadsOnly(BATCH_SIZE, lastTeamId);

    if (result.teamsProcessed < BATCH_SIZE) {
      await db.collection('aggregates').doc('squadRefreshCursor').set({
        lastTeamId: 0,
        lastCompletedCycle: admin.firestore.FieldValue.serverTimestamp(),
        lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('[squadRefresh] Completed full cycle. Cursor reset to 0.');
    } else {
      await db.collection('aggregates').doc('squadRefreshCursor').set({
        lastTeamId: result.lastProcessedTeamId,
        lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      console.log(`[squadRefresh] Next cursor: ${result.lastProcessedTeamId}`);
    }

    console.log(`[squadRefresh] Done: ${result.teamsProcessed} teams, ${result.playersEnriched} players, ${result.apiCalls} API calls`);
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

/**
 * Daily aggregate computation: runs at 03:00 UTC every day.
 * Paginates through ALL reviews (no limit) and writes pre-computed
 * popular + highest-rated match ID lists to the 'aggregates' collection.
 * The app reads from these documents instead of doing expensive full scans.
 */
export const computeAggregates = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .pubsub.schedule('0 3 * * *')
  .timeZone('UTC')
  .onRun(async () => {
    const db = admin.firestore();
    const BATCH_SIZE = 500;

    const counts = new Map<number, number>();
    const totals = new Map<number, { sum: number; count: number }>();

    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let totalProcessed = 0;

    // Paginate through all reviews — no limit
    while (true) {
      let q: FirebaseFirestore.Query = db.collection('reviews').orderBy('createdAt', 'desc').limit(BATCH_SIZE);
      if (lastDoc) q = q.startAfter(lastDoc);

      const snap = await q.get();
      if (snap.empty) break;

      for (const d of snap.docs) {
        const data = d.data();
        const matchId = data.matchId as number;
        const rating = data.rating as number;
        if (!matchId) continue;

        // Popular: count by matchId
        counts.set(matchId, (counts.get(matchId) || 0) + 1);

        // Highest rated: sum ratings
        if (rating) {
          const existing = totals.get(matchId) || { sum: 0, count: 0 };
          existing.sum += rating;
          existing.count += 1;
          totals.set(matchId, existing);
        }
      }

      lastDoc = snap.docs[snap.docs.length - 1];
      totalProcessed += snap.docs.length;
      console.log(`[computeAggregates] Processed ${totalProcessed} reviews...`);
    }

    // Build and sort popular list
    const popularEntries = [...counts.entries()]
      .map(([matchId, count]) => ({ matchId, count }))
      .sort((a, b) => b.count - a.count);

    // Build and sort highest-rated list
    const highestRatedEntries = [...totals.entries()]
      .map(([matchId, { sum, count }]) => ({ matchId, avgRating: Math.round((sum / count) * 100) / 100, count }))
      .sort((a, b) => b.avgRating - a.avgRating || b.count - a.count);

    const updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await db.collection('aggregates').doc('popularMatchIds').set({
      entries: popularEntries,
      updatedAt,
    });

    await db.collection('aggregates').doc('highestRatedMatchIds').set({
      entries: highestRatedEntries,
      updatedAt,
    });

    console.log(`[computeAggregates] Done. ${popularEntries.length} popular, ${highestRatedEntries.length} rated. Total reviews: ${totalProcessed}`);
  });

/**
 * Manual trigger for computeAggregates — same logic as the scheduled function.
 * Run via: GET /triggerAggregates
 */
export const triggerAggregates = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onRequest(async (_req, res) => {
    const db = admin.firestore();
    const BATCH_SIZE = 500;
    const counts = new Map<number, number>();
    const totals = new Map<number, { sum: number; count: number }>();
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let totalProcessed = 0;

    while (true) {
      let q: FirebaseFirestore.Query = db.collection('reviews').orderBy('createdAt', 'desc').limit(BATCH_SIZE);
      if (lastDoc) q = q.startAfter(lastDoc);
      const snap = await q.get();
      if (snap.empty) break;
      for (const d of snap.docs) {
        const data = d.data();
        const matchId = data.matchId as number;
        const rating = data.rating as number;
        if (!matchId) continue;
        counts.set(matchId, (counts.get(matchId) || 0) + 1);
        if (rating) {
          const existing = totals.get(matchId) || { sum: 0, count: 0 };
          existing.sum += rating;
          existing.count += 1;
          totals.set(matchId, existing);
        }
      }
      lastDoc = snap.docs[snap.docs.length - 1];
      totalProcessed += snap.docs.length;
    }

    const popularEntries = [...counts.entries()]
      .map(([matchId, count]) => ({ matchId, count }))
      .sort((a, b) => b.count - a.count);

    const highestRatedEntries = [...totals.entries()]
      .map(([matchId, { sum, count }]) => ({ matchId, avgRating: Math.round((sum / count) * 100) / 100, count }))
      .sort((a, b) => b.avgRating - a.avgRating || b.count - a.count);

    const updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection('aggregates').doc('popularMatchIds').set({ entries: popularEntries, updatedAt });
    await db.collection('aggregates').doc('highestRatedMatchIds').set({ entries: highestRatedEntries, updatedAt });

    res.json({ popular: popularEntries.length, highestRated: highestRatedEntries.length, totalReviews: totalProcessed });
  });

/**
 * One-time backfill: compute ratingSum, ratingCount, reviewCount, ratingBuckets for all existing match docs.
 * Run once after deployment via: GET /backfillMatchRatings
 * Safe to re-run — overwrites with correct values each time.
 */
export const backfillMatchRatings = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onRequest(async (_req, res) => {
    const db = admin.firestore();
    const BATCH_SIZE = 500;

    // Aggregate all reviews into per-match stats
    const stats = new Map<number, { ratingSum: number; ratingCount: number; reviewCount: number; ratingBuckets: Record<string, number> }>();
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    let totalReviews = 0;

    while (true) {
      let q: FirebaseFirestore.Query = db.collection('reviews').limit(BATCH_SIZE);
      if (lastDoc) q = q.startAfter(lastDoc);
      const snap = await q.get();
      if (snap.empty) break;

      for (const d of snap.docs) {
        const data = d.data();
        const matchId = data.matchId as number;
        const rating = (data.rating ?? 0) as number;
        if (!matchId) continue;
        const existing = stats.get(matchId) || { ratingSum: 0, ratingCount: 0, reviewCount: 0, ratingBuckets: {} };
        existing.reviewCount++;
        if (rating > 0) {
          existing.ratingSum += rating;
          existing.ratingCount++;
          const key = String(Math.round(rating * 10));
          existing.ratingBuckets[key] = (existing.ratingBuckets[key] || 0) + 1;
        }
        stats.set(matchId, existing);
      }

      lastDoc = snap.docs[snap.docs.length - 1];
      totalReviews += snap.docs.length;
    }

    // Write to match docs in batches of 500
    let matchesUpdated = 0;
    const entries = Array.from(stats.entries());
    for (let i = 0; i < entries.length; i += 500) {
      const batch = db.batch();
      for (const [matchId, { ratingSum, ratingCount, reviewCount, ratingBuckets }] of entries.slice(i, i + 500)) {
        batch.update(db.collection('matches').doc(String(matchId)), { ratingSum, ratingCount, reviewCount, ratingBuckets });
        matchesUpdated++;
      }
      await batch.commit();
    }

    console.log(`[backfillMatchRatings] Done. ${totalReviews} reviews → ${matchesUpdated} matches updated`);
    res.json({ success: true, reviewsProcessed: totalReviews, matchesUpdated });
  });

// ─── Helpers ───

/**
 * One-time migration: clean up old football-data.org match documents.
 *
 * Old matches (pre-API-Football) lack a `season` field and use football-data.org
 * team/match IDs which collide with API-Football IDs (e.g. Man City = 65 in
 * football-data.org but Nottingham Forest = 65 in API-Football).
 *
 * For each old match:
 * 1. Try to find a matching API-Football match (same kickoff date + similar team names)
 * 2. If found: remap reviews to the new matchId, set legacyId, delete old docs
 * 3. If not found: delete old match doc (reviews become orphaned)
 *
 * Usage:
 *   GET /migrateLegacyMatches              — dry run (preview only)
 *   GET /migrateLegacyMatches?dryRun=false — execute migration
 */
export const migrateLegacyMatches = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onRequest(async (req, res) => {
    const dryRun = req.query.dryRun !== 'false';
    const db = admin.firestore();

    console.log(`[migrateLegacyMatches] Starting (dryRun=${dryRun})...`);

    // Step 1: Find all old matches (no season field)
    const BATCH_SIZE = 500;
    const legacyMatches: { id: string; data: Record<string, any> }[] = [];
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

    while (true) {
      let q: FirebaseFirestore.Query = db.collection('matches').limit(BATCH_SIZE);
      if (lastDoc) q = q.startAfter(lastDoc);
      const snap = await q.get();
      if (snap.empty) break;

      for (const d of snap.docs) {
        const data = d.data();
        if (data.season == null) {
          legacyMatches.push({ id: d.id, data });
        }
      }
      lastDoc = snap.docs[snap.docs.length - 1];
    }

    console.log(`[migrateLegacyMatches] Found ${legacyMatches.length} legacy match docs`);

    if (legacyMatches.length === 0) {
      res.json({ success: true, message: 'No legacy matches found', dryRun });
      return;
    }

    // Step 2: Build a lookup of API-Football matches by kickoff date for matching
    // Group legacy matches by kickoff date to batch-query
    const dateSet = new Set<string>();
    for (const m of legacyMatches) {
      if (m.data.kickoff) {
        dateSet.add(m.data.kickoff.split('T')[0]); // YYYY-MM-DD
      }
    }

    // For each date, load all API-Football matches (have season field)
    const apiMatchesByDate = new Map<string, { id: string; data: Record<string, any> }[]>();
    for (const date of dateSet) {
      const dayStart = `${date}T00:00:00`;
      const dayEnd = `${date}T23:59:59`;
      const snap = await db.collection('matches')
        .where('kickoff', '>=', dayStart)
        .where('kickoff', '<=', dayEnd)
        .get();

      const matches = snap.docs
        .filter((d) => d.data().season != null) // Only API-Football matches
        .map((d) => ({ id: d.id, data: d.data() }));
      apiMatchesByDate.set(date, matches);
    }

    // Step 3: For each legacy match, try to find a corresponding API-Football match
    function normalize(name: string): string {
      return name.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    function teamsMatch(legacyHome: string, legacyAway: string, apiHome: string, apiAway: string): boolean {
      const lh = normalize(legacyHome);
      const la = normalize(legacyAway);
      const ah = normalize(apiHome);
      const aa = normalize(apiAway);
      // Substring match in either direction (e.g. "Arsenal" matches "Arsenal FC")
      return (ah.includes(lh) || lh.includes(ah)) && (aa.includes(la) || la.includes(aa));
    }

    const results: {
      matched: { legacyId: string; newId: string; home: string; away: string; reviewsRemapped: number }[];
      unmatched: { legacyId: string; home: string; away: string; reviewCount: number }[];
      errors: string[];
    } = { matched: [], unmatched: [], errors: [] };

    for (const legacy of legacyMatches) {
      const legacyId = legacy.id;
      const homeName = legacy.data.homeTeam?.name || '';
      const awayName = legacy.data.awayTeam?.name || '';
      const kickoff = legacy.data.kickoff || '';
      const date = kickoff.split('T')[0];

      // Find reviews for this legacy match
      const reviewSnap = await db.collection('reviews')
        .where('matchId', '==', Number(legacyId))
        .get();
      const reviewCount = reviewSnap.docs.length;

      // Try to find matching API-Football match
      const candidates = apiMatchesByDate.get(date) || [];
      const match = candidates.find((c) => {
        const cHome = c.data.homeTeam?.name || '';
        const cAway = c.data.awayTeam?.name || '';
        return teamsMatch(homeName, awayName, cHome, cAway);
      });

      if (match) {
        const newMatchId = match.id;
        console.log(`  [MATCH] Legacy ${legacyId} (${homeName} vs ${awayName}) → API-Football ${newMatchId}`);

        if (!dryRun) {
          try {
            const batch = db.batch();

            // Set legacyId on the API-Football match doc
            batch.update(db.collection('matches').doc(newMatchId), {
              legacyId: Number(legacyId),
            });

            // Remap reviews to new matchId
            for (const reviewDoc of reviewSnap.docs) {
              batch.update(reviewDoc.ref, { matchId: Number(newMatchId) });
            }

            // Delete old match doc
            batch.delete(db.collection('matches').doc(legacyId));

            // Move matchDetails if exists
            const oldDetailSnap = await db.collection('matchDetails').doc(legacyId).get();
            if (oldDetailSnap.exists) {
              batch.delete(db.collection('matchDetails').doc(legacyId));
              // Don't copy old details — API-Football details are better
            }

            await batch.commit();
          } catch (err: any) {
            results.errors.push(`Failed to migrate ${legacyId}: ${err.message}`);
            console.error(`  [ERROR] ${legacyId}:`, err.message);
            continue;
          }
        }

        results.matched.push({ legacyId, newId: newMatchId, home: homeName, away: awayName, reviewsRemapped: reviewCount });
      } else {
        console.log(`  [NO MATCH] Legacy ${legacyId} (${homeName} vs ${awayName}) — ${reviewCount} reviews`);

        if (!dryRun) {
          try {
            const batch = db.batch();
            batch.delete(db.collection('matches').doc(legacyId));

            const oldDetailSnap = await db.collection('matchDetails').doc(legacyId).get();
            if (oldDetailSnap.exists) {
              batch.delete(db.collection('matchDetails').doc(legacyId));
            }

            // Leave reviews as-is — they'll get "match not found" but no data loss
            await batch.commit();
          } catch (err: any) {
            results.errors.push(`Failed to delete ${legacyId}: ${err.message}`);
            console.error(`  [ERROR] ${legacyId}:`, err.message);
          }
        }

        results.unmatched.push({ legacyId, home: homeName, away: awayName, reviewCount });
      }
    }

    const summary = {
      success: true,
      dryRun,
      totalLegacy: legacyMatches.length,
      matched: results.matched.length,
      unmatched: results.unmatched.length,
      errors: results.errors.length,
      details: results,
    };

    console.log(`[migrateLegacyMatches] Done. ${results.matched.length} matched, ${results.unmatched.length} unmatched, ${results.errors.length} errors`);
    res.json(summary);
  });

/**
 * Thorough team ID audit + fix for ALL matches.
 *
 * Builds a reliable team name → API-Football ID mapping from matches that have a
 * `season` field (known-good API-Football data), then scans every match document
 * and fixes any where the team ID doesn't match the expected ID for that team name.
 *
 * Also cleans up the `teams` collection: deletes team docs whose ID doesn't match
 * the canonical API-Football ID for that team name.
 *
 * Usage:
 *   GET /auditTeamIds              — dry run (report only)
 *   GET /auditTeamIds?dryRun=false — execute fixes
 */
export const auditTeamIds = functions
  .runWith({ timeoutSeconds: 540, memory: '1GB' })
  .https.onRequest(async (req, res) => {
    const dryRun = req.query.dryRun !== 'false';
    const db = admin.firestore();
    const BATCH_SIZE = 500;

    console.log(`[auditTeamIds] Starting (dryRun=${dryRun})...`);

    // Step 1: Build canonical name → ID map from API-Football matches (have season)
    // Use the most frequent ID per team name as the canonical one
    const nameIdCounts = new Map<string, Map<number, number>>();
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

    while (true) {
      let q: FirebaseFirestore.Query = db.collection('matches').limit(BATCH_SIZE);
      if (lastDoc) q = q.startAfter(lastDoc);
      const snap = await q.get();
      if (snap.empty) break;

      for (const d of snap.docs) {
        const data = d.data();
        if (!data.season) continue; // Skip non-API-Football matches
        for (const side of ['homeTeam', 'awayTeam']) {
          const team = data[side];
          if (!team?.name || !team?.id) continue;
          const name = team.name.toLowerCase().trim();
          if (!nameIdCounts.has(name)) nameIdCounts.set(name, new Map());
          const idMap = nameIdCounts.get(name)!;
          idMap.set(team.id, (idMap.get(team.id) || 0) + 1);
        }
      }
      lastDoc = snap.docs[snap.docs.length - 1];
    }

    // Determine canonical ID per name (most frequent)
    const canonicalIds = new Map<string, number>();
    for (const [name, idMap] of nameIdCounts.entries()) {
      let bestId = 0, bestCount = 0;
      for (const [id, count] of idMap.entries()) {
        if (count > bestCount) { bestId = id; bestCount = count; }
      }
      canonicalIds.set(name, bestId);
    }

    console.log(`[auditTeamIds] Built canonical map for ${canonicalIds.size} team names`);

    // Step 2: Scan ALL matches and find team ID mismatches
    const fixes: { matchId: string; side: string; teamName: string; oldId: number; newId: number }[] = [];
    const deletions: string[] = []; // Match IDs to delete (no season, leftover)
    lastDoc = null;

    while (true) {
      let q: FirebaseFirestore.Query = db.collection('matches').limit(BATCH_SIZE);
      if (lastDoc) q = q.startAfter(lastDoc);
      const snap = await q.get();
      if (snap.empty) break;

      for (const d of snap.docs) {
        const data = d.data();

        // Delete matches without season (leftover football-data.org)
        if (!data.season) {
          deletions.push(d.id);
          continue;
        }

        for (const side of ['homeTeam', 'awayTeam'] as const) {
          const team = data[side];
          if (!team?.name || !team?.id) continue;
          const name = team.name.toLowerCase().trim();
          const canonical = canonicalIds.get(name);
          if (canonical && canonical !== team.id) {
            fixes.push({
              matchId: d.id,
              side,
              teamName: team.name,
              oldId: team.id,
              newId: canonical,
            });
          }
        }
      }
      lastDoc = snap.docs[snap.docs.length - 1];
    }

    console.log(`[auditTeamIds] Found ${fixes.length} team ID mismatches, ${deletions.length} seasonless matches`);

    // Step 3: Check teams collection for stale entries
    const staleTeams: { id: string; name: string; canonicalId: number; reason: string }[] = [];
    lastDoc = null;
    while (true) {
      let q: FirebaseFirestore.Query = db.collection('teams').limit(BATCH_SIZE);
      if (lastDoc) q = q.startAfter(lastDoc);
      const snap = await q.get();
      if (snap.empty) break;

      for (const d of snap.docs) {
        const data = d.data();
        if (!data.name) continue;

        // Flag teams with legacy football-data.org crests
        const crest = data.crest || '';
        if (crest.includes('crests.football-data.org')) {
          staleTeams.push({ id: d.id, name: data.name, canonicalId: 0, reason: 'legacy-crest' });
          continue;
        }

        const name = data.name.toLowerCase().trim();
        const canonical = canonicalIds.get(name);
        if (canonical && canonical !== data.id) {
          staleTeams.push({ id: d.id, name: data.name, canonicalId: canonical, reason: 'id-mismatch' });
        }
      }
      lastDoc = snap.docs[snap.docs.length - 1];
    }

    console.log(`[auditTeamIds] Found ${staleTeams.length} stale team docs`);

    // Step 4: Apply fixes
    if (!dryRun) {
      // Fix match team IDs
      for (let i = 0; i < fixes.length; i += 500) {
        const batch = db.batch();
        for (const fix of fixes.slice(i, i + 500)) {
          const matchRef = db.collection('matches').doc(fix.matchId);
          batch.update(matchRef, {
            [`${fix.side}.id`]: fix.newId,
          });
        }
        await batch.commit();
      }

      // Delete seasonless matches
      for (let i = 0; i < deletions.length; i += 500) {
        const batch = db.batch();
        for (const id of deletions.slice(i, i + 500)) {
          batch.delete(db.collection('matches').doc(id));
        }
        await batch.commit();
      }

      // Delete stale team docs
      for (let i = 0; i < staleTeams.length; i += 500) {
        const batch = db.batch();
        for (const t of staleTeams.slice(i, i + 500)) {
          batch.delete(db.collection('teams').doc(t.id));
        }
        await batch.commit();
      }
    }

    const summary = {
      success: true,
      dryRun,
      teamIdFixes: fixes.length,
      seasonlessDeleted: deletions.length,
      staleTeamsDeleted: staleTeams.length,
      fixes: fixes.slice(0, 50), // Limit output size
      staleTeams,
      deletions: deletions.slice(0, 20),
    };

    console.log(`[auditTeamIds] Done.`);
    res.json(summary);
  });

/**
 * Deep diagnostic: find all matches where team name + crest don't match.
 * Also dumps the teams collection entries for suspect teams.
 * Usage: GET /diagnoseTeams?names=wolves,swansea,arsenal,ipswich
 */
export const diagnoseTeams = functions
  .runWith({ timeoutSeconds: 300, memory: '512MB' })
  .https.onRequest(async (req, res) => {
    const db = admin.firestore();
    const namesParam = (req.query.names as string || 'wolves,swansea,arsenal,ipswich').toLowerCase();
    const searchNames = namesParam.split(',').map(n => n.trim());
    const BATCH_SIZE = 500;

    // 1. Dump ALL team docs that match the search names
    const teamDocs: any[] = [];
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    while (true) {
      let q: FirebaseFirestore.Query = db.collection('teams').limit(BATCH_SIZE);
      if (lastDoc) q = q.startAfter(lastDoc);
      const snap = await q.get();
      if (snap.empty) break;
      for (const d of snap.docs) {
        const data = d.data();
        const nameLC = (data.name || '').toLowerCase();
        const shortLC = (data.shortName || '').toLowerCase();
        if (searchNames.some(s => nameLC.includes(s) || shortLC.includes(s))) {
          teamDocs.push({ docId: d.id, id: data.id, name: data.name, shortName: data.shortName, crest: data.crest });
        }
      }
      lastDoc = snap.docs[snap.docs.length - 1];
    }

    // 2. Build full team ID → {name, crest} map from all API-Football matches
    // Collect every unique (teamId, name, crest) triple
    const teamIdData = new Map<number, { name: string; crest: string; count: number }[]>();
    lastDoc = null;
    while (true) {
      let q: FirebaseFirestore.Query = db.collection('matches').limit(BATCH_SIZE);
      if (lastDoc) q = q.startAfter(lastDoc);
      const snap = await q.get();
      if (snap.empty) break;
      for (const d of snap.docs) {
        const data = d.data();
        for (const side of ['homeTeam', 'awayTeam']) {
          const team = data[side];
          if (!team?.id) continue;
          const key = team.id as number;
          if (!teamIdData.has(key)) teamIdData.set(key, []);
          const entries = teamIdData.get(key)!;
          const existing = entries.find(e => e.name === team.name && e.crest === team.crest);
          if (existing) {
            existing.count++;
          } else {
            entries.push({ name: team.name, crest: team.crest, count: 1 });
          }
        }
      }
      lastDoc = snap.docs[snap.docs.length - 1];
    }

    // 3. Find team IDs that have CONFLICTING data (multiple name/crest combos)
    const conflicts: { teamId: number; variants: { name: string; crest: string; count: number }[] }[] = [];
    for (const [teamId, variants] of teamIdData.entries()) {
      if (variants.length > 1) {
        conflicts.push({ teamId, variants });
      }
    }

    // 4. Find matches where search names appear with unexpected data
    const suspectMatches: any[] = [];
    lastDoc = null;
    while (true) {
      let q: FirebaseFirestore.Query = db.collection('matches').limit(BATCH_SIZE);
      if (lastDoc) q = q.startAfter(lastDoc);
      const snap = await q.get();
      if (snap.empty) break;
      for (const d of snap.docs) {
        const data = d.data();
        for (const side of ['homeTeam', 'awayTeam']) {
          const team = data[side];
          if (!team?.name) continue;
          const nameLC = team.name.toLowerCase();
          if (searchNames.some(s => nameLC.includes(s))) {
            suspectMatches.push({
              matchId: d.id,
              side,
              teamId: team.id,
              teamName: team.name,
              crest: team.crest,
              season: data.season || null,
              kickoff: data.kickoff?.toDate?.()?.toISOString?.() || data.kickoff,
            });
          }
        }
      }
      lastDoc = snap.docs[snap.docs.length - 1];
    }

    res.json({
      teamDocs,
      conflicts: conflicts.sort((a, b) => b.variants.length - a.variants.length),
      suspectMatches: suspectMatches.slice(0, 100),
    });
  });

/**
 * One-time seed: populate the `leagues` collection with all league metadata.
 * Consolidates SYNC_LEAGUES, LEAGUE_TIER, FOLLOWABLE_LEAGUES, CUP_COMPETITIONS,
 * calendar-year logic, and display order into a single Firestore collection.
 *   GET /seedLeagues
 */
export const seedLeagues = functions.https.onRequest(async (_req, res) => {
  const CUP_CODES = new Set(['CL', 'EL', 'ECL', 'FAC', 'EFL', 'WC', 'EURO', 'NL', 'CA']);
  const CALENDAR_YEAR_IDS = new Set([253, 71, 128, 98, 188]); // MLS, BSA, ARG, JPL, AUS
  const NON_FOLLOWABLE = new Set(['NL', 'CA']);

  const TIER_MAP: Record<string, number> = {
    PL: 1, CL: 1, PD: 1, BL1: 1, SA: 1, FL1: 1,
    EL: 2, ECL: 2, ELC: 2, DED: 2, PPL: 2,
    FAC: 3, EFL: 3, SPL: 3, SL: 3, BEL: 3, BSA: 3, ARG: 3,
    MLS: 4, LMX: 4, SAU: 4, JPL: 4, AUS: 4,
    WC: 5, EURO: 5, NL: 5, CA: 5,
  };

  // Display order matches current FOLLOWABLE_LEAGUES order + remaining leagues
  const DISPLAY_ORDER: Record<string, number> = {
    PL: 1, BL1: 2, PD: 3, SA: 4, FL1: 5,
    CL: 6, EL: 7, ELC: 8, DED: 9, PPL: 10,
    BSA: 11, MLS: 12, LMX: 13, SAU: 14, SL: 15,
    ECL: 16, FAC: 17, EFL: 18, SPL: 19, BEL: 20,
    ARG: 21, JPL: 22, AUS: 23, WC: 24, EURO: 25,
    NL: 26, CA: 27,
  };

  const batch = admin.firestore().batch();
  let count = 0;

  for (const league of SYNC_LEAGUES) {
    const doc: Record<string, any> = {
      code: league.code,
      apiId: league.apiId,
      name: league.name,
      country: league.country,
      emblem: `https://media.api-sports.io/football/leagues/${league.apiId}.png`,
      tier: TIER_MAP[league.code] || 6,
      isCup: CUP_CODES.has(league.code),
      seasonType: CALENDAR_YEAR_IDS.has(league.apiId) ? 'calendar-year' : 'european',
      displayOrder: DISPLAY_ORDER[league.code] || 99,
      enabled: true,
      followable: !NON_FOLLOWABLE.has(league.code),
    };
    batch.set(
      admin.firestore().collection(COLLECTIONS.LEAGUES).doc(league.code),
      doc,
      { merge: true }
    );
    count++;
  }

  await batch.commit();
  res.json({ seeded: count });
});

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
