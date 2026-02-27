"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.backfillPlayerIds = exports.migratePlayerNames = exports.enrichPlayers = exports.enrichTeams = exports.buildPlayers = exports.syncAllDetails = exports.syncDetailsForLeague = exports.manualSync = exports.buildTeams = exports.backfill = exports.liveSync = exports.dailySync = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
admin.initializeApp();
const syncMatches_1 = require("./sync/syncMatches");
const syncStandings_1 = require("./sync/syncStandings");
const syncDetails_1 = require("./sync/syncDetails");
const syncLive_1 = require("./sync/syncLive");
const backfill_1 = require("./sync/backfill");
// ─── Scheduled Functions ───
/**
 * Daily sync: runs at 06:00 UTC every day.
 * Fetches yesterday's results, today's schedule, and tomorrow's schedule.
 * Also syncs standings and missing match details.
 */
exports.dailySync = functions
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
    const matchCount = await (0, syncMatches_1.syncMatchesForDateRange)(yesterday, dayAfter);
    console.log(`[dailySync] Synced ${matchCount} matches`);
    // Sync standings
    const standingsCount = await (0, syncStandings_1.syncAllStandings)();
    console.log(`[dailySync] Synced ${standingsCount} league standings`);
    // Sync details for recently finished matches
    const detailsCount = await (0, syncDetails_1.syncMissingDetails)();
    console.log(`[dailySync] Synced ${detailsCount} match details`);
    console.log('[dailySync] Complete');
});
/**
 * Live match sync: runs every 2 minutes.
 * Updates scores for currently in-play matches.
 */
exports.liveSync = functions
    .runWith({ timeoutSeconds: 60, memory: '256MB' })
    .pubsub.schedule('every 2 minutes')
    .onRun(async () => {
    const count = await (0, syncLive_1.syncLiveMatches)();
    if (count > 0) {
        console.log(`[liveSync] Updated ${count} live matches`);
    }
});
// ─── HTTP Functions (admin/backfill) ───
/**
 * Backfill historical data. Call via HTTP:
 *   GET /backfill?league=PL&season=2023&details=true
 *   GET /backfill (all leagues, all seasons, no details)
 */
exports.backfill = functions
    .runWith({ timeoutSeconds: 540, memory: '1GB' })
    .https.onRequest(async (req, res) => {
    // Basic auth check — only allow from authorized sources
    const authHeader = req.headers.authorization;
    const expectedKey = process.env.ADMIN_KEY;
    if (expectedKey && authHeader !== `Bearer ${expectedKey}`) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    const leagueCode = req.query.league;
    const season = req.query.season ? parseInt(req.query.season, 10) : undefined;
    const includeDetails = req.query.details === 'true';
    console.log(`[backfill] Starting: league=${leagueCode || 'all'}, season=${season || 'all'}, details=${includeDetails}`);
    try {
        const result = await (0, backfill_1.runBackfill)({ leagueCode, season, includeDetails });
        res.json({
            success: true,
            ...result,
        });
    }
    catch (err) {
        console.error('[backfill] Error:', err);
        res.status(500).json({ error: err.message });
    }
});
/**
 * Build team documents from existing match data.
 * Call after backfill to populate the teams collection.
 */
exports.buildTeams = functions
    .runWith({ timeoutSeconds: 540, memory: '512MB' })
    .https.onRequest(async (req, res) => {
    try {
        const count = await (0, backfill_1.buildTeamsFromMatches)();
        res.json({ success: true, teams: count });
    }
    catch (err) {
        console.error('[buildTeams] Error:', err);
        res.status(500).json({ error: err.message });
    }
});
/**
 * Manual trigger: sync matches for a specific date range.
 *   GET /manualSync?from=2024-01-01&to=2024-01-07
 */
exports.manualSync = functions
    .runWith({ timeoutSeconds: 540, memory: '512MB' })
    .https.onRequest(async (req, res) => {
    const action = req.query.action;
    // Standings-only sync
    if (action === 'standings') {
        try {
            const count = await (0, syncStandings_1.syncAllStandings)();
            res.json({ success: true, standings: count });
        }
        catch (err) {
            console.error('[manualSync] Standings error:', err);
            res.status(500).json({ error: err.message });
        }
        return;
    }
    const from = req.query.from;
    const to = req.query.to;
    if (!from || !to) {
        res.status(400).json({ error: 'Missing from/to query params (YYYY-MM-DD). Or use ?action=standings' });
        return;
    }
    try {
        const matchCount = await (0, syncMatches_1.syncMatchesForDateRange)(from, to);
        res.json({ success: true, matches: matchCount });
    }
    catch (err) {
        console.error('[manualSync] Error:', err);
        res.status(500).json({ error: err.message });
    }
});
/**
 * Sync match details (lineups/stats/events) for a league+season.
 * Processes in batches to avoid timeout.
 *   GET /syncDetailsForLeague?league=PL&season=2024&limit=50
 */
exports.syncDetailsForLeague = functions
    .runWith({ timeoutSeconds: 540, memory: '1GB' })
    .https.onRequest(async (req, res) => {
    const leagueCode = req.query.league;
    const season = req.query.season ? parseInt(req.query.season, 10) : undefined;
    const batchLimit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
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
        const allIds = snapshot.docs.map((d) => d.data().id);
        // Check which ones already have details
        const missingIds = [];
        for (const id of allIds) {
            const detailDoc = await db.collection('matchDetails').doc(String(id)).get();
            if (!detailDoc.exists) {
                missingIds.push(id);
            }
            if (missingIds.length >= batchLimit)
                break;
        }
        if (missingIds.length === 0) {
            res.json({ success: true, synced: 0, remaining: 0, message: 'All details already synced' });
            return;
        }
        const synced = await (0, syncDetails_1.syncMatchDetails)(missingIds);
        const remaining = allIds.length - (allIds.length - missingIds.length) - synced;
        res.json({
            success: true,
            synced,
            totalMatches: allIds.length,
            remaining: Math.max(0, allIds.length - synced - (allIds.length - missingIds.length)),
            message: remaining > 0 ? 'Call again to sync more' : 'Complete',
        });
    }
    catch (err) {
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
exports.syncAllDetails = functions
    .runWith({ timeoutSeconds: 540, memory: '1GB' })
    .https.onRequest(async (req, res) => {
    const batchLimit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    try {
        const result = await (0, syncDetails_1.syncAllMissingDetails)(batchLimit);
        res.json({ success: true, ...result });
    }
    catch (err) {
        console.error('[syncAllDetails] Error:', err);
        res.status(500).json({ error: err.message });
    }
});
/**
 * Build player documents and enrich teams with coach/squad from match details.
 * Call after syncing match details.
 */
exports.buildPlayers = functions
    .runWith({ timeoutSeconds: 540, memory: '1GB' })
    .https.onRequest(async (req, res) => {
    try {
        const result = await (0, backfill_1.buildPlayersAndEnrichTeams)();
        res.json({ success: true, ...result });
    }
    catch (err) {
        console.error('[buildPlayers] Error:', err);
        res.status(500).json({ error: err.message });
    }
});
/**
 * Fetch team colors and venue info from API-Football.
 *   GET /enrichTeams?limit=100
 */
exports.enrichTeams = functions
    .runWith({ timeoutSeconds: 540, memory: '512MB' })
    .https.onRequest(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
    try {
        const updated = await (0, backfill_1.fetchTeamColors)(limit);
        res.json({ success: true, updated });
    }
    catch (err) {
        console.error('[enrichTeams] Error:', err);
        res.status(500).json({ error: err.message });
    }
});
/**
 * Enrich player docs with photos from API-Football /players/squads endpoint.
 * Processes teams in batches. Call multiple times with offset to cover all teams.
 *   GET /enrichPlayers?limit=50&offset=0
 */
exports.enrichPlayers = functions
    .runWith({ timeoutSeconds: 540, memory: '512MB' })
    .https.onRequest(async (req, res) => {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset, 10) : 0;
    try {
        const result = await (0, backfill_1.enrichPlayersFromSquads)(limit, offset);
        res.json({ success: true, ...result });
    }
    catch (err) {
        console.error('[enrichPlayers] Error:', err);
        res.status(500).json({ error: err.message });
    }
});
/**
 * One-time migration: add nameLower field to all player docs for search.
 *   GET /migratePlayerNames
 */
exports.migratePlayerNames = functions
    .runWith({ timeoutSeconds: 540, memory: '512MB' })
    .https.onRequest(async (req, res) => {
    try {
        const count = await (0, backfill_1.backfillPlayerNameLower)();
        res.json({ success: true, updated: count });
    }
    catch (err) {
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
exports.backfillPlayerIds = functions
    .runWith({ timeoutSeconds: 540, memory: '512MB' })
    .https.onRequest(async (req, res) => {
    var _a, _b;
    const batchLimit = req.query.limit ? parseInt(req.query.limit, 10) : 500;
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
            const playerIds = [];
            for (const arr of [data.homeLineup, data.homeBench, data.awayLineup, data.awayBench]) {
                if (Array.isArray(arr)) {
                    for (const p of arr) {
                        if (p === null || p === void 0 ? void 0 : p.id)
                            playerIds.push(p.id);
                    }
                }
            }
            if ((_a = data.homeCoach) === null || _a === void 0 ? void 0 : _a.id)
                playerIds.push(data.homeCoach.id);
            if ((_b = data.awayCoach) === null || _b === void 0 ? void 0 : _b.id)
                playerIds.push(data.awayCoach.id);
            if (playerIds.length > 0) {
                batch.update(doc.ref, { playerIds });
                updated++;
            }
        }
        if (updated > 0)
            await batch.commit();
        res.json({
            success: true,
            total: snapshot.size,
            updated,
            skipped,
            message: updated > 0 ? `Updated ${updated} docs. Run again if more remain.` : 'All docs already have playerIds.',
        });
    }
    catch (err) {
        console.error('[backfillPlayerIds] Error:', err);
        res.status(500).json({ error: err.message });
    }
});
// ─── Helpers ───
function formatDate(date) {
    return date.toISOString().split('T')[0];
}
function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}
function daysFromNow(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
}
//# sourceMappingURL=index.js.map