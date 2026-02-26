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
exports.syncLiveMatches = syncLiveMatches;
const admin = __importStar(require("firebase-admin"));
const apiFootball_1 = require("../apiFootball");
const transforms_1 = require("../transforms");
const config_1 = require("../config");
const db = admin.firestore();
// Set of league IDs we track
const TRACKED_LEAGUE_IDS = new Set(config_1.SYNC_LEAGUES.map((l) => l.apiId));
/**
 * Fetches all currently live fixtures and updates scores in Firestore.
 * Also checks for stale matches (kickoff 3+ hours ago but still SCHEDULED/TIMED)
 * and updates their status from the API.
 * Called every 2 minutes via Cloud Scheduler.
 */
async function syncLiveMatches() {
    let updated = 0;
    try {
        // 1. Update currently live matches
        const liveFixtures = await (0, apiFootball_1.getLiveFixtures)();
        const tracked = liveFixtures.filter((f) => TRACKED_LEAGUE_IDS.has(f.league.id));
        if (tracked.length > 0) {
            for (let i = 0; i < tracked.length; i += config_1.FIRESTORE_BATCH_SIZE) {
                const chunk = tracked.slice(i, i + config_1.FIRESTORE_BATCH_SIZE);
                const batch = db.batch();
                for (const fixture of chunk) {
                    const matchDoc = (0, transforms_1.transformFixtureToMatch)(fixture);
                    if (!matchDoc)
                        continue;
                    const ref = db.collection(config_1.COLLECTIONS.MATCHES).doc(String(fixture.fixture.id));
                    batch.set(ref, {
                        ...matchDoc,
                        cachedAt: admin.firestore.FieldValue.serverTimestamp(),
                    }, { merge: true });
                }
                await batch.commit();
            }
            updated += tracked.length;
            console.log(`[syncLive] Updated ${tracked.length} live matches`);
        }
        // 2. Check for stale matches: kickoff was 3+ hours ago but still not FINISHED
        const staleUpdated = await syncStaleMatches();
        updated += staleUpdated;
        if (updated === 0) {
            console.log('[syncLive] No live or stale matches to update');
        }
        return updated;
    }
    catch (err) {
        console.error('[syncLive] Error:', err.message);
        return updated;
    }
}
/**
 * Finds matches in Firestore that should be finished (kickoff 3+ hours ago)
 * but still have a non-finished status, then re-fetches from API to update.
 */
async function syncStaleMatches() {
    try {
        const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
        // Query for matches with kickoff before 3 hours ago that aren't finished
        const staleStatuses = ['SCHEDULED', 'TIMED'];
        const staleIds = [];
        for (const status of staleStatuses) {
            const snap = await db.collection(config_1.COLLECTIONS.MATCHES)
                .where('status', '==', status)
                .where('kickoff', '<=', threeHoursAgo.toISOString())
                .limit(20)
                .get();
            snap.docs.forEach((d) => {
                const id = d.data().id;
                if (id && !staleIds.includes(id))
                    staleIds.push(id);
            });
            if (staleIds.length >= 20)
                break;
        }
        // Cap at 20 (API-Football limit per ids request)
        const idsToFetch = staleIds.slice(0, 20);
        if (idsToFetch.length === 0)
            return 0;
        console.log(`[syncLive] Found ${idsToFetch.length} stale matches, re-fetching from API`);
        const fixtures = await (0, apiFootball_1.getFixtures)({ ids: idsToFetch.join('-') });
        console.log(`[syncLive] API returned ${fixtures.length} fixtures for ${idsToFetch.length} stale IDs`);
        if (fixtures.length === 0)
            return 0;
        for (let i = 0; i < fixtures.length; i += config_1.FIRESTORE_BATCH_SIZE) {
            const chunk = fixtures.slice(i, i + config_1.FIRESTORE_BATCH_SIZE);
            const batch = db.batch();
            for (const fixture of chunk) {
                const matchDoc = (0, transforms_1.transformFixtureToMatch)(fixture);
                if (!matchDoc)
                    continue;
                const ref = db.collection(config_1.COLLECTIONS.MATCHES).doc(String(fixture.fixture.id));
                batch.set(ref, {
                    ...matchDoc,
                    cachedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            }
            await batch.commit();
        }
        console.log(`[syncLive] Updated ${fixtures.length} stale matches`);
        return fixtures.length;
    }
    catch (err) {
        console.error('[syncLive] Error syncing stale matches:', err.message);
        return 0;
    }
}
//# sourceMappingURL=syncLive.js.map