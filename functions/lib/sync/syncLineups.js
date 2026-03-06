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
exports.syncPreMatchLineups = syncPreMatchLineups;
const admin = __importStar(require("firebase-admin"));
const apiFootball_1 = require("../apiFootball");
const transforms_1 = require("../transforms");
const config_1 = require("../config");
const db = admin.firestore();
/**
 * Fetches lineups for matches starting within the next 60 minutes.
 * Runs every 5 minutes via Cloud Scheduler.
 *
 * - 60–10 min before kickoff: fetches lineup, writes only if not already stored
 * - Last 10 min before kickoff: always writes (override for last-minute changes)
 */
async function syncPreMatchLineups() {
    var _a;
    let synced = 0;
    try {
        const now = Date.now();
        const nowIso = new Date(now).toISOString();
        const sixtyMinFromNow = new Date(now + 60 * 60 * 1000).toISOString();
        // Find scheduled matches with kickoff in the next 60 minutes
        const snap = await db.collection(config_1.COLLECTIONS.MATCHES)
            .where('status', 'in', ['SCHEDULED', 'TIMED'])
            .where('kickoff', '>=', nowIso)
            .where('kickoff', '<=', sixtyMinFromNow)
            .get();
        if (snap.empty)
            return 0;
        console.log(`[lineupSync] Found ${snap.size} matches starting within 60 min`);
        for (const doc of snap.docs) {
            const match = doc.data();
            const fixtureId = match.id;
            const kickoffMs = new Date(match.kickoff).getTime();
            const minutesUntilKickoff = (kickoffMs - now) / (60 * 1000);
            // If more than 10 min away, check if we already have lineups
            if (minutesUntilKickoff > 10) {
                const detailDoc = await db.collection(config_1.COLLECTIONS.MATCH_DETAILS).doc(String(fixtureId)).get();
                if (detailDoc.exists) {
                    const data = detailDoc.data();
                    if (((_a = data === null || data === void 0 ? void 0 : data.homeLineup) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                        continue; // Already have lineups, skip until last 10 min
                    }
                }
            }
            // Fetch lineups from API
            const lineups = await (0, apiFootball_1.getFixtureLineups)(fixtureId);
            if (!lineups || lineups.length === 0) {
                continue; // Lineups not available yet
            }
            // Check if lineups actually contain players (API may return empty arrays)
            const hasPlayers = lineups.some((l) => l.startXI && l.startXI.length > 0);
            if (!hasPlayers)
                continue;
            const lineupDoc = (0, transforms_1.transformLineupOnly)(fixtureId, lineups, match.homeTeam.id, match.awayTeam.id, match.kickoff, match.season);
            await db.collection(config_1.COLLECTIONS.MATCH_DETAILS).doc(String(fixtureId)).set({ ...lineupDoc, syncedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            synced++;
            console.log(`[lineupSync] ${fixtureId}: lineup synced (${minutesUntilKickoff.toFixed(0)} min to kickoff)`);
        }
        return synced;
    }
    catch (err) {
        console.error('[lineupSync] Error:', err.message);
        return synced;
    }
}
//# sourceMappingURL=syncLineups.js.map