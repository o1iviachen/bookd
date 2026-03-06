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
exports.syncMatchDetails = syncMatchDetails;
exports.syncMissingDetails = syncMissingDetails;
const admin = __importStar(require("firebase-admin"));
const apiFootball_1 = require("../apiFootball");
const transforms_1 = require("../transforms");
const config_1 = require("../config");
const db = admin.firestore();
/**
 * Syncs match details (lineups, stats, events) for a list of fixture IDs.
 * Only fetches details for finished matches that don't already have details.
 * Uses 3 API calls per fixture (lineups + events + stats). Skips fixture fetch
 * since basic fixture data is already in the matches collection.
 */
async function syncMatchDetails(fixtureIds, force = false) {
    let synced = 0;
    for (const fixtureId of fixtureIds) {
        try {
            // Skip if already synced (unless forced)
            if (!force) {
                const existing = await db.collection(config_1.COLLECTIONS.MATCH_DETAILS).doc(String(fixtureId)).get();
                if (existing.exists)
                    continue;
            }
            // Fetch lineups, events, stats, and fixture in parallel (4 calls)
            // Uses allSettled so partial data is still written if some calls fail
            const [fixtureResult, lineupsResult, eventsResult, statsResult] = await Promise.allSettled([
                (0, apiFootball_1.getFixtureById)(fixtureId),
                (0, apiFootball_1.getFixtureLineups)(fixtureId),
                (0, apiFootball_1.getFixtureEvents)(fixtureId),
                (0, apiFootball_1.getFixtureStats)(fixtureId),
            ]);
            const fixture = fixtureResult.status === 'fulfilled' ? fixtureResult.value : null;
            const lineups = lineupsResult.status === 'fulfilled' ? lineupsResult.value : null;
            const events = eventsResult.status === 'fulfilled' ? eventsResult.value : null;
            const stats = statsResult.status === 'fulfilled' ? statsResult.value : null;
            // Check for 403 on any call — mark detailsNotFound
            const allResults = [fixtureResult, lineupsResult, eventsResult, statsResult];
            const has403 = allResults.some((r) => { var _a, _b; return r.status === 'rejected' && ((_b = (_a = r.reason) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.includes('403')); });
            if (has403) {
                console.warn(`[syncDetails] 403 for fixture ${fixtureId} — marking detailsNotFound to stop retries`);
                await db.collection(config_1.COLLECTIONS.MATCHES).doc(String(fixtureId)).update({ detailsNotFound: true });
                continue;
            }
            // Check for rate limit on any call — stop processing
            const hasRateLimit = allResults.some((r) => { var _a, _b, _c, _d; return r.status === 'rejected' && (((_b = (_a = r.reason) === null || _a === void 0 ? void 0 : _a.message) === null || _b === void 0 ? void 0 : _b.includes('429')) || ((_d = (_c = r.reason) === null || _c === void 0 ? void 0 : _c.message) === null || _d === void 0 ? void 0 : _d.includes('request limit'))); });
            if (hasRateLimit) {
                console.error(`[syncDetails] API rate limit hit after syncing ${synced} fixtures. Stopping.`);
                break;
            }
            if (!fixture) {
                console.warn(`[syncDetails] Fixture ${fixtureId}: API returned no data — skipping`);
                continue;
            }
            // Log partial data warnings
            const missing = [];
            if (!(lineups === null || lineups === void 0 ? void 0 : lineups.length))
                missing.push('lineups');
            if (!(events === null || events === void 0 ? void 0 : events.length))
                missing.push('events');
            if (!(stats === null || stats === void 0 ? void 0 : stats.length))
                missing.push('stats');
            if (missing.length > 0) {
                console.warn(`[syncDetails] Fixture ${fixtureId}: missing ${missing.join(', ')} — writing partial details`);
            }
            const detailDoc = (0, transforms_1.transformFixtureDetails)(fixtureId, lineups || [], events || [], stats || [], fixture);
            await db.collection(config_1.COLLECTIONS.MATCH_DETAILS).doc(String(fixtureId)).set({
                ...detailDoc,
                syncedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // Mark the match as having details so we never re-scan it
            await db.collection(config_1.COLLECTIONS.MATCHES).doc(String(fixtureId)).update({
                hasDetails: true,
            });
            synced++;
            console.log(`[syncDetails] Synced details for fixture ${fixtureId}`);
        }
        catch (err) {
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
async function syncMissingDetails() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const matchesSnapshot = await db
        .collection(config_1.COLLECTIONS.MATCHES)
        .where('status', '==', 'FINISHED')
        .where('kickoff', '>=', sevenDaysAgo.toISOString())
        .get();
    if (matchesSnapshot.empty)
        return 0;
    // Filter out matches marked as detailsNotFound (403 from API)
    const eligibleDocs = matchesSnapshot.docs.filter((d) => !d.data().detailsNotFound);
    const fixtureIds = eligibleDocs.map((d) => d.data().id);
    // Batch-check which details already exist using getAll instead of N+1 getDoc
    const detailRefs = fixtureIds.map((id) => db.collection(config_1.COLLECTIONS.MATCH_DETAILS).doc(String(id)));
    const detailSnaps = await db.getAll(...detailRefs);
    const missingIds = fixtureIds.filter((_, i) => !detailSnaps[i].exists);
    if (missingIds.length === 0)
        return 0;
    console.log(`[syncMissingDetails] Found ${missingIds.length} missing details out of ${fixtureIds.length} recent finished matches`);
    return await syncMatchDetails(missingIds);
}
//# sourceMappingURL=syncDetails.js.map