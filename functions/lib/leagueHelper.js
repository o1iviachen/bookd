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
exports.getEnabledLeagues = getEnabledLeagues;
exports.getLeagueByApiIdMap = getLeagueByApiIdMap;
exports.getLeagueByCodeMap = getLeagueByCodeMap;
exports.getSeasonForLeague = getSeasonForLeague;
exports.getLeagueTier = getLeagueTier;
exports.clearLeagueCache = clearLeagueCache;
const admin = __importStar(require("firebase-admin"));
const config_1 = require("./config");
let cachedLeagues = null;
/** Fetch enabled leagues from Firestore. Cached for the lifetime of a function invocation. */
async function getEnabledLeagues() {
    if (cachedLeagues)
        return cachedLeagues;
    const snap = await admin.firestore()
        .collection(config_1.COLLECTIONS.LEAGUES)
        .where('enabled', '==', true)
        .get();
    cachedLeagues = snap.docs.map((d) => d.data());
    return cachedLeagues;
}
/** Build a Map<apiId, SyncLeague> for O(1) lookups in transforms. */
async function getLeagueByApiIdMap() {
    const leagues = await getEnabledLeagues();
    return new Map(leagues.map((l) => [l.apiId, l]));
}
/** Build a Map<code, SyncLeague> for O(1) lookups by code. */
async function getLeagueByCodeMap() {
    const leagues = await getEnabledLeagues();
    return new Map(leagues.map((l) => [l.code, l]));
}
/** Get current season year based on league's seasonType. */
function getSeasonForLeague(league) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    return league.seasonType === 'calendar-year' ? year : (month >= 7 ? year : year - 1);
}
/** Get the best (lowest) league tier for a set of competition codes. */
async function getLeagueTier(competitionCodes) {
    var _a;
    if (!competitionCodes || competitionCodes.length === 0)
        return 6;
    const codeMap = await getLeagueByCodeMap();
    let best = 6;
    for (const code of competitionCodes) {
        const tier = (_a = codeMap.get(code)) === null || _a === void 0 ? void 0 : _a.tier;
        if (tier !== undefined && tier < best)
            best = tier;
    }
    return best;
}
/** Clear the cache (useful between long-running function phases). */
function clearLeagueCache() {
    cachedLeagues = null;
}
//# sourceMappingURL=leagueHelper.js.map