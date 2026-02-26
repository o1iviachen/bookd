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
exports.syncMatchesForDateRange = syncMatchesForDateRange;
exports.syncLeagueSeason = syncLeagueSeason;
exports.getCurrentSeason = getCurrentSeason;
const admin = __importStar(require("firebase-admin"));
const apiFootball_1 = require("../apiFootball");
const transforms_1 = require("../transforms");
const config_1 = require("../config");
const db = admin.firestore();
/**
 * Syncs matches for a given date range across all configured leagues.
 * Called daily to fetch yesterday's results + today/tomorrow's schedule.
 */
async function syncMatchesForDateRange(from, to) {
    let totalSynced = 0;
    for (const league of config_1.SYNC_LEAGUES) {
        try {
            const fixtures = await (0, apiFootball_1.getFixtures)({
                league: league.apiId,
                season: getCurrentSeason(league.apiId),
                from,
                to,
            });
            if (fixtures.length === 0)
                continue;
            const docs = [];
            for (const fixture of fixtures) {
                const matchDoc = (0, transforms_1.transformFixtureToMatch)(fixture);
                if (!matchDoc)
                    continue;
                docs.push({ id: String(fixture.fixture.id), data: matchDoc });
            }
            await batchWrite(docs);
            totalSynced += docs.length;
            console.log(`[syncMatches] ${league.code}: synced ${docs.length} matches (${from} to ${to})`);
        }
        catch (err) {
            console.error(`[syncMatches] Error syncing ${league.code}:`, err.message);
        }
    }
    return totalSynced;
}
/**
 * Syncs all matches for a specific league and season.
 * Used by backfill and initial setup.
 */
async function syncLeagueSeason(leagueApiId, season) {
    try {
        const fixtures = await (0, apiFootball_1.getFixtures)({ league: leagueApiId, season });
        if (fixtures.length === 0)
            return 0;
        const docs = [];
        for (const fixture of fixtures) {
            const matchDoc = (0, transforms_1.transformFixtureToMatch)(fixture);
            if (!matchDoc)
                continue;
            docs.push({ id: String(fixture.fixture.id), data: matchDoc });
        }
        await batchWrite(docs);
        return docs.length;
    }
    catch (err) {
        console.error(`[syncLeagueSeason] Error syncing league ${leagueApiId} season ${season}:`, err.message);
        return 0;
    }
}
// ─── Helpers ───
async function batchWrite(docs) {
    for (let i = 0; i < docs.length; i += config_1.FIRESTORE_BATCH_SIZE) {
        const chunk = docs.slice(i, i + config_1.FIRESTORE_BATCH_SIZE);
        const batch = db.batch();
        for (const { id, data } of chunk) {
            const ref = db.collection(config_1.COLLECTIONS.MATCHES).doc(id);
            batch.set(ref, { ...data, cachedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        }
        await batch.commit();
    }
}
/**
 * Determines the current season year for a league.
 * European leagues: season starts in Aug/Sep, so Aug-Dec = current year, Jan-Jul = previous year.
 * Southern hemisphere / calendar year leagues (MLS, BSA, JPL): use calendar year.
 */
function getCurrentSeason(leagueApiId) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // 1-12
    // Calendar-year leagues
    const calendarYearLeagues = [253, 71, 128, 98, 188]; // MLS, BSA, ARG, JPL, AUS
    if (calendarYearLeagues.includes(leagueApiId)) {
        return year;
    }
    // European leagues: season = start year
    return month >= 7 ? year : year - 1;
}
//# sourceMappingURL=syncMatches.js.map