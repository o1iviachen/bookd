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
const leagueHelper_1 = require("../leagueHelper");
const syncDetails_1 = require("./syncDetails");
const syncStandings_1 = require("./syncStandings");
const db = admin.firestore();
const TERMINAL_STATUSES = new Set(['FINISHED', 'CANCELLED', 'POSTPONED']);
const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'SUSPENDED']);
const PRE_WINDOW_MINS = 15;
const POST_WINDOW_HRS = 3;
/**
 * Per-minute live sync: fetches fixtures per active league, updates scores/status,
 * and fetches events/stats for each live match.
 * Detects FINISHED transitions and runs full detail sync for just-finished matches.
 */
async function syncLiveMatches() {
    var _a, _b, _c, _d, _e;
    let matchesUpdated = 0;
    let detailsUpdated = 0;
    try {
        const now = Date.now();
        const leagues = await (0, leagueHelper_1.getEnabledLeagues)();
        const leagueMap = await (0, leagueHelper_1.getLeagueByApiIdMap)();
        const leagueByCode = new Map(leagues.map((l) => [l.code, l]));
        // 1. Query today's matches from Firestore
        const todayStart = startOfDayUTC(new Date());
        const todayEnd = endOfDayUTC(new Date());
        const snap = await db.collection(config_1.COLLECTIONS.MATCHES)
            .where('kickoff', '>=', todayStart)
            .where('kickoff', '<=', todayEnd)
            .get();
        console.log(`[liveSync] Found ${snap.size} matches today (${todayStart} to ${todayEnd})`);
        if (snap.empty) {
            return { matchesUpdated: 0, detailsUpdated: 0 };
        }
        // 2. Group by league and compute windows
        const windowMap = new Map();
        for (const doc of snap.docs) {
            const data = doc.data();
            const code = (_a = data.competition) === null || _a === void 0 ? void 0 : _a.code;
            if (!code)
                continue;
            const kickoffMs = new Date(data.kickoff).getTime();
            const status = data.status;
            const fixtureId = data.id;
            let win = windowMap.get(code);
            if (!win) {
                const league = leagueByCode.get(code);
                if (!league)
                    continue;
                win = {
                    code,
                    apiId: league.apiId,
                    season: (0, leagueHelper_1.getSeasonForLeague)(league),
                    earliest: kickoffMs,
                    latest: kickoffMs,
                    allFinished: true,
                    matchStatuses: new Map(),
                };
                windowMap.set(code, win);
            }
            if (kickoffMs < win.earliest)
                win.earliest = kickoffMs;
            if (kickoffMs > win.latest)
                win.latest = kickoffMs;
            if (!TERMINAL_STATUSES.has(status))
                win.allFinished = false;
            win.matchStatuses.set(fixtureId, status);
        }
        for (const [code, win] of windowMap) {
            const ids = [...win.matchStatuses.entries()].map(([id, s]) => `${id}(${s})`).join(', ');
            console.log(`[liveSync] ${code}: ${win.matchStatuses.size} matches [${ids}]`);
        }
        // 3. Process each active league
        for (const win of windowMap.values()) {
            // Check if league is in active window
            const windowStart = win.earliest - PRE_WINDOW_MINS * 60 * 1000;
            const windowEnd = win.latest + POST_WINDOW_HRS * 60 * 60 * 1000;
            if (now < windowStart) {
                console.log(`[liveSync] ${win.code}: skipped (window starts in ${((windowStart - now) / 60000).toFixed(0)} min)`);
                continue;
            }
            if (now > windowEnd && win.allFinished) {
                console.log(`[liveSync] ${win.code}: skipped (all finished, window ended ${((now - windowEnd) / 60000).toFixed(0)} min ago)`);
                continue;
            }
            // Fetch fixtures from API for this league
            const dateStr = formatDateUTC(new Date());
            const fixtures = await (0, apiFootball_1.getFixtures)({
                league: win.apiId,
                season: win.season,
                from: dateStr,
                to: dateStr,
                timezone: 'UTC',
            });
            console.log(`[liveSync] ${win.code}: API returned ${fixtures.length} fixtures (apiId=${win.apiId}, season=${win.season}, date=${dateStr})`);
            if (fixtures.length === 0)
                continue;
            // Batch-write match updates
            const liveIds = [];
            const justFinishedIds = [];
            const fixtureById = new Map();
            for (let i = 0; i < fixtures.length; i += config_1.FIRESTORE_BATCH_SIZE) {
                const chunk = fixtures.slice(i, i + config_1.FIRESTORE_BATCH_SIZE);
                const batch = db.batch();
                for (const fixture of chunk) {
                    const matchDoc = (0, transforms_1.transformFixtureToMatch)(fixture, leagueMap);
                    if (!matchDoc)
                        continue;
                    const fid = fixture.fixture.id;
                    fixtureById.set(fid, fixture);
                    const ref = db.collection(config_1.COLLECTIONS.MATCHES).doc(String(fid));
                    const isNew = !win.matchStatuses.has(fid);
                    batch.set(ref, {
                        ...matchDoc,
                        ...(isNew && { hasDetails: false }),
                        cachedAt: admin.firestore.FieldValue.serverTimestamp(),
                    }, { merge: true });
                    const apiStatus = matchDoc.status;
                    const fsStatus = win.matchStatuses.get(fid);
                    if (LIVE_STATUSES.has(apiStatus)) {
                        liveIds.push(fid);
                    }
                    // Detect FINISHED transition: was live/scheduled, now finished
                    if (apiStatus === 'FINISHED' && fsStatus && !TERMINAL_STATUSES.has(fsStatus)) {
                        justFinishedIds.push(fid);
                    }
                    matchesUpdated++;
                }
                await batch.commit();
            }
            console.log(`[liveSync] ${win.code}: ${liveIds.length} live [${liveIds.join(',')}], ${justFinishedIds.length} just-finished [${justFinishedIds.join(',')}]`);
            // Fetch events + stats for live matches
            for (const fid of liveIds) {
                try {
                    const fixture = fixtureById.get(fid);
                    const [events, stats] = await Promise.all([
                        (0, apiFootball_1.getFixtureEvents)(fid),
                        (0, apiFootball_1.getFixtureStats)(fid),
                    ]);
                    console.log(`[liveSync] ${fid} API events(${events.length}): ${JSON.stringify(events.slice(0, 3))}`);
                    console.log(`[liveSync] ${fid} API stats(${stats.length}): ${JSON.stringify(stats.map((s) => { var _a; return ({ team: s.team.id, stats: (_a = s.statistics) === null || _a === void 0 ? void 0 : _a.slice(0, 4) }); }))}`);
                    const detailDoc = (0, transforms_1.transformLiveEventDetails)(fid, events, stats, fixture);
                    console.log(`[liveSync] ${fid} writing matchDetails: goals=${(_b = detailDoc.goals) === null || _b === void 0 ? void 0 : _b.length}, bookings=${(_c = detailDoc.bookings) === null || _c === void 0 ? void 0 : _c.length}, subs=${(_d = detailDoc.substitutions) === null || _d === void 0 ? void 0 : _d.length}, events=${(_e = detailDoc.events) === null || _e === void 0 ? void 0 : _e.length}, hasStats=${!!detailDoc.stats}`);
                    await db.collection(config_1.COLLECTIONS.MATCH_DETAILS).doc(String(fid)).set({ ...detailDoc, syncedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
                    detailsUpdated++;
                }
                catch (err) {
                    console.error(`[liveSync] Error fetching details for ${fid}:`, err.message);
                }
            }
            // Full detail sync for just-finished matches
            for (const fid of justFinishedIds) {
                try {
                    await (0, syncDetails_1.syncMatchDetails)([fid], true);
                    detailsUpdated++;
                    console.log(`[liveSync] Full detail sync for just-finished match ${fid}`);
                }
                catch (err) {
                    console.error(`[liveSync] Error syncing finished match ${fid}:`, err.message);
                }
            }
            // Update standings when matches finish in this league
            if (justFinishedIds.length > 0) {
                try {
                    await (0, syncStandings_1.syncLeagueStandings)(win.code, win.apiId, win.season);
                    console.log(`[liveSync] ${win.code}: standings updated after ${justFinishedIds.length} match(es) finished`);
                }
                catch (err) {
                    console.error(`[liveSync] ${win.code}: error updating standings:`, err.message);
                }
            }
            if (liveIds.length > 0 || justFinishedIds.length > 0) {
                console.log(`[liveSync] ${win.code}: ${fixtures.length} fixtures, ` +
                    `${liveIds.length} live, ${justFinishedIds.length} just finished`);
            }
        }
        return { matchesUpdated, detailsUpdated };
    }
    catch (err) {
        console.error('[liveSync] Error:', err.message);
        return { matchesUpdated, detailsUpdated };
    }
}
// ─── Helpers ───
function startOfDayUTC(date) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString();
}
function endOfDayUTC(date) {
    const d = new Date(date);
    d.setUTCHours(23, 59, 59, 999);
    return d.toISOString();
}
function formatDateUTC(date) {
    return date.toISOString().split('T')[0];
}
//# sourceMappingURL=syncLive.js.map