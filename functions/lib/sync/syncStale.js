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
exports.syncStaleMatchDetails = syncStaleMatchDetails;
const admin = __importStar(require("firebase-admin"));
const config_1 = require("../config");
const apiFootball_1 = require("../apiFootball");
const transforms_1 = require("../transforms");
const leagueHelper_1 = require("../leagueHelper");
const syncDetails_1 = require("./syncDetails");
const syncStandings_1 = require("./syncStandings");
const db = admin.firestore();
/**
 * Finds stale matches and syncs their details:
 * 1. FINISHED matches 4+ hours past kickoff with hasDetails == false
 * 2. IN_PLAY/PAUSED matches 3+ hours past kickoff (stuck — missed FINISHED transition)
 *
 * For stuck matches, re-fetches the fixture to update status before syncing details.
 * Runs hourly as a safety net for matches missed by the live sync.
 */
async function syncStaleMatchDetails() {
    var _a;
    let synced = 0;
    try {
        const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
        const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
        // 1. FINISHED matches missing details
        const finishedSnap = await db.collection(config_1.COLLECTIONS.MATCHES)
            .where('status', '==', 'FINISHED')
            .where('hasDetails', '==', false)
            .where('kickoff', '<=', fourHoursAgo)
            .limit(50)
            .get();
        // 2. Stuck IN_PLAY matches (3+ hours past kickoff)
        const stuckInPlaySnap = await db.collection(config_1.COLLECTIONS.MATCHES)
            .where('status', '==', 'IN_PLAY')
            .where('kickoff', '<=', threeHoursAgo)
            .limit(20)
            .get();
        const stuckPausedSnap = await db.collection(config_1.COLLECTIONS.MATCHES)
            .where('status', '==', 'PAUSED')
            .where('kickoff', '<=', threeHoursAgo)
            .limit(20)
            .get();
        // Track league codes that had finished matches (for standings sync)
        const leaguesWithFinished = new Set();
        // Process finished matches missing details (skip those marked detailsNotFound)
        if (!finishedSnap.empty) {
            const fixtureIds = finishedSnap.docs
                .filter((d) => !d.data().detailsNotFound)
                .map((d) => {
                var _a;
                const dataId = d.data().id;
                if (String(dataId) !== d.id) {
                    console.warn(`[staleSync] Doc ID mismatch: doc.id=${d.id}, data.id=${dataId}`);
                }
                const code = (_a = d.data().competition) === null || _a === void 0 ? void 0 : _a.code;
                if (code)
                    leaguesWithFinished.add(code);
                return dataId;
            });
            console.log(`[staleSync] Found ${fixtureIds.length} stale finished matches without details: ${fixtureIds.join(', ')}`);
            synced += await (0, syncDetails_1.syncMatchDetails)(fixtureIds);
        }
        // Process stuck IN_PLAY/PAUSED matches — re-fetch fixture to update status, then sync details
        const stuckDocs = [...stuckInPlaySnap.docs, ...stuckPausedSnap.docs];
        if (stuckDocs.length > 0) {
            const leagueMap = await (0, leagueHelper_1.getLeagueByApiIdMap)();
            const stuckIds = [];
            for (const doc of stuckDocs) {
                const fixtureId = doc.data().id;
                try {
                    const fixture = await (0, apiFootball_1.getFixtureById)(fixtureId);
                    if (!fixture)
                        continue;
                    // Update match doc with latest status from API
                    const matchDoc = (0, transforms_1.transformFixtureToMatch)(fixture, leagueMap);
                    if (matchDoc) {
                        await db.collection(config_1.COLLECTIONS.MATCHES).doc(doc.id).set({ ...matchDoc, cachedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
                        console.log(`[staleSync] Updated stuck match ${fixtureId}: ${doc.data().status} → ${matchDoc.status}`);
                        if (matchDoc.status === 'FINISHED') {
                            stuckIds.push(fixtureId);
                            const code = (_a = matchDoc.competition) === null || _a === void 0 ? void 0 : _a.code;
                            if (code)
                                leaguesWithFinished.add(code);
                        }
                    }
                }
                catch (err) {
                    console.error(`[staleSync] Error re-fetching stuck match ${fixtureId}:`, err.message);
                }
            }
            if (stuckIds.length > 0) {
                console.log(`[staleSync] Syncing details for ${stuckIds.length} newly-finished stuck matches`);
                synced += await (0, syncDetails_1.syncMatchDetails)(stuckIds, true);
            }
        }
        // Update standings for leagues that had finished matches
        if (leaguesWithFinished.size > 0) {
            const codeMap = await (0, leagueHelper_1.getLeagueByCodeMap)();
            for (const code of leaguesWithFinished) {
                const league = codeMap.get(code);
                if (!league)
                    continue;
                try {
                    await (0, syncStandings_1.syncLeagueStandings)(code, league.apiId, (0, leagueHelper_1.getSeasonForLeague)(league));
                    console.log(`[staleSync] ${code}: standings updated`);
                }
                catch (err) {
                    console.error(`[staleSync] ${code}: error updating standings:`, err.message);
                }
            }
        }
        if (synced > 0) {
            console.log(`[staleSync] Total synced: ${synced}`);
        }
        return synced;
    }
    catch (err) {
        console.error('[staleSync] Error:', err.message);
        return synced;
    }
}
//# sourceMappingURL=syncStale.js.map