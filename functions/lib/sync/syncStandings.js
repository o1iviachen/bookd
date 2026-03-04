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
exports.syncAllStandings = syncAllStandings;
exports.syncLeagueStandings = syncLeagueStandings;
const admin = __importStar(require("firebase-admin"));
const apiFootball_1 = require("../apiFootball");
const transforms_1 = require("../transforms");
const config_1 = require("../config");
const leagueHelper_1 = require("../leagueHelper");
const db = admin.firestore();
/**
 * Syncs league standings for all configured leagues.
 * Writes to the `standings` collection with doc ID: `{code}_{season}`
 */
async function syncAllStandings() {
    const leagues = await (0, leagueHelper_1.getEnabledLeagues)();
    let totalSynced = 0;
    for (const league of leagues) {
        try {
            const season = (0, leagueHelper_1.getSeasonForLeague)(league);
            const standingsGroups = await (0, apiFootball_1.getStandings)(league.apiId, season);
            if (standingsGroups.length === 0)
                continue;
            // For most leagues, there's one group. For CL group stage, there are multiple.
            // We store the first group as the main table, and all groups if there are multiple.
            const docId = `${league.code}_${season}`;
            const mainTable = standingsGroups[0] || [];
            const docData = {
                competitionCode: league.code,
                season,
                table: (0, transforms_1.transformStandings)(mainTable),
                syncedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            // If there are multiple groups (e.g., CL groups), store them all
            if (standingsGroups.length > 1) {
                docData.groups = standingsGroups.map((group, i) => {
                    var _a;
                    return ({
                        name: ((_a = group[0]) === null || _a === void 0 ? void 0 : _a.group) || `Group ${i + 1}`,
                        table: (0, transforms_1.transformStandings)(group),
                    });
                });
            }
            await db.collection(config_1.COLLECTIONS.STANDINGS).doc(docId).set(docData, { merge: true });
            totalSynced++;
            console.log(`[syncStandings] ${league.code}: synced standings (${mainTable.length} teams)`);
        }
        catch (err) {
            console.error(`[syncStandings] Error syncing ${league.code}:`, err.message);
        }
    }
    return totalSynced;
}
/**
 * Syncs standings for a single league.
 */
async function syncLeagueStandings(leagueCode, leagueApiId, season) {
    const standingsGroups = await (0, apiFootball_1.getStandings)(leagueApiId, season);
    if (standingsGroups.length === 0)
        return;
    const mainTable = standingsGroups[0] || [];
    const docId = `${leagueCode}_${season}`;
    const docData = {
        competitionCode: leagueCode,
        season,
        table: (0, transforms_1.transformStandings)(mainTable),
        syncedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    if (standingsGroups.length > 1) {
        docData.groups = standingsGroups.map((group, i) => {
            var _a;
            return ({
                name: ((_a = group[0]) === null || _a === void 0 ? void 0 : _a.group) || `Group ${i + 1}`,
                table: (0, transforms_1.transformStandings)(group),
            });
        });
    }
    await db.collection(config_1.COLLECTIONS.STANDINGS).doc(docId).set(docData, { merge: true });
    console.log(`[syncStandings] ${leagueCode}: synced standings (${mainTable.length} teams)`);
}
//# sourceMappingURL=syncStandings.js.map