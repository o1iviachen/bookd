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
exports.syncAllMissingDetails = syncAllMissingDetails;
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
    var _a, _b;
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
            // We need the fixture for referee and venue info not stored in matches collection
            const [fixture, lineups, events, stats] = await Promise.all([
                (0, apiFootball_1.getFixtureById)(fixtureId),
                (0, apiFootball_1.getFixtureLineups)(fixtureId),
                (0, apiFootball_1.getFixtureEvents)(fixtureId),
                (0, apiFootball_1.getFixtureStats)(fixtureId),
            ]);
            if (!fixture)
                continue;
            const detailDoc = (0, transforms_1.transformFixtureDetails)(fixtureId, lineups, events, stats, fixture);
            await db.collection(config_1.COLLECTIONS.MATCH_DETAILS).doc(String(fixtureId)).set({
                ...detailDoc,
                syncedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            synced++;
            console.log(`[syncDetails] Synced details for fixture ${fixtureId}`);
        }
        catch (err) {
            // If we hit an API rate limit, stop processing to avoid wasting calls
            if (((_a = err.message) === null || _a === void 0 ? void 0 : _a.includes('request limit')) || ((_b = err.message) === null || _b === void 0 ? void 0 : _b.includes('429'))) {
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
async function syncMissingDetails() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const matchesSnapshot = await db
        .collection(config_1.COLLECTIONS.MATCHES)
        .where('status', '==', 'FINISHED')
        .where('kickoff', '>=', sevenDaysAgo.toISOString())
        .get();
    const fixtureIds = [];
    for (const doc of matchesSnapshot.docs) {
        fixtureIds.push(doc.data().id);
    }
    if (fixtureIds.length === 0)
        return 0;
    console.log(`[syncMissingDetails] Found ${fixtureIds.length} recent finished matches to check`);
    return await syncMatchDetails(fixtureIds);
}
/**
 * Bulk syncs all finished matches missing details across all leagues.
 * Processes up to `limit` matches per call. Returns count and whether more remain.
 */
async function syncAllMissingDetails(batchLimit = 50) {
    // Find ALL finished matches
    const matchesSnapshot = await db
        .collection(config_1.COLLECTIONS.MATCHES)
        .where('status', '==', 'FINISHED')
        .get();
    // Check which ones are missing details
    const missingIds = [];
    for (const matchDoc of matchesSnapshot.docs) {
        const fixtureId = matchDoc.data().id;
        const detailDoc = await db.collection(config_1.COLLECTIONS.MATCH_DETAILS).doc(String(fixtureId)).get();
        if (!detailDoc.exists) {
            missingIds.push(fixtureId);
        }
        if (missingIds.length >= batchLimit)
            break;
    }
    if (missingIds.length === 0) {
        return { synced: 0, remaining: 0 };
    }
    const totalMissing = matchesSnapshot.docs.length; // approximate
    const synced = await syncMatchDetails(missingIds);
    return { synced, remaining: Math.max(0, totalMissing - synced) };
}
//# sourceMappingURL=syncDetails.js.map