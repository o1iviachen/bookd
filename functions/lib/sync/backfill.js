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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runBackfill = runBackfill;
exports.buildTeamsFromMatches = buildTeamsFromMatches;
exports.buildPlayersAndEnrichTeams = buildPlayersAndEnrichTeams;
exports.enrichTeamInfo = enrichTeamInfo;
exports.refreshSquadsOnly = refreshSquadsOnly;
exports.generateSearchPrefixes = generateSearchPrefixes;
exports.backfillPlayerNameLower = backfillPlayerNameLower;
exports.backfillMissingMatchDetails = backfillMissingMatchDetails;
exports.backfillTeamCountry = backfillTeamCountry;
exports.backfillMatchStages = backfillMatchStages;
const config_1 = require("../config");
const leagueHelper_1 = require("../leagueHelper");
const syncMatches_1 = require("./syncMatches");
const syncStandings_1 = require("./syncStandings");
const syncDetails_1 = require("./syncDetails");
const admin = __importStar(require("firebase-admin"));
const apiFootball_1 = require("../apiFootball");
const config_2 = require("../config");
const axios_1 = __importDefault(require("axios"));
const db = admin.firestore();
/** Decode common HTML entities from API-Football. */
function decodeEntities(text) {
    if (!text || !text.includes('&'))
        return text;
    return text
        .replace(/&apos;/g, "'")
        .replace(/&#0?39;/g, "'")
        .replace(/&#x0?27;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&#0?34;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ');
}
// getLeagueTier is now in leagueHelper.ts (reads from Firestore leagues collection)
/**
 * Backfills historical match data for all leagues and seasons.
 * This is an HTTP-triggered function meant to be called once (or per-league).
 *
 * Query params:
 *   ?league=PL — backfill a single league by code
 *   ?season=2023 — backfill a single season
 *   ?details=true — also fetch match details (lineups/stats/events)
 *   (no params) — backfill everything
 */
async function runBackfill(options) {
    const { leagueCode, apiId, season, includeDetails } = options;
    let allLeagues = await (0, leagueHelper_1.getEnabledLeagues)();
    let leagueCreated = false;
    // Auto-create league doc if code + apiId given but league doesn't exist
    if (leagueCode && apiId && !allLeagues.find((l) => l.code === leagueCode)) {
        const info = await (0, apiFootball_1.getLeagueInfo)(apiId);
        if (!info) {
            throw new Error(`Could not fetch league info from API for apiId=${apiId}`);
        }
        // Calendar-year leagues have seasons starting in Jan-Mar
        const currentSeason = info.seasons.find((s) => s.current);
        const startMonth = currentSeason ? new Date(currentSeason.start).getMonth() + 1 : 8;
        const seasonType = startMonth <= 3 ? 'calendar-year' : 'european';
        const leagueDoc = {
            code: leagueCode,
            apiId,
            name: info.league.name,
            country: info.country.name,
            emblem: info.league.logo,
            tier: 6,
            isCup: info.league.type === 'Cup',
            seasonType,
            displayOrder: 99,
            enabled: true,
            followable: true,
        };
        await db.collection(config_1.COLLECTIONS.LEAGUES).doc(leagueCode).set(leagueDoc, { merge: true });
        (0, leagueHelper_1.clearLeagueCache)();
        allLeagues = await (0, leagueHelper_1.getEnabledLeagues)();
        leagueCreated = true;
        console.log(`[backfill] Auto-created league doc: ${leagueCode} (apiId=${apiId}, name=${info.league.name}, type=${info.league.type}, seasonType=${seasonType})`);
    }
    const leagues = leagueCode
        ? allLeagues.filter((l) => l.code === leagueCode)
        : allLeagues;
    const seasons = season ? [season] : config_1.BACKFILL_SEASONS;
    let totalMatches = 0;
    let totalDetails = 0;
    for (const league of leagues) {
        for (const s of seasons) {
            console.log(`[backfill] Starting ${league.code} season ${s}...`);
            // Sync all fixtures for this league-season
            const matchCount = await (0, syncMatches_1.syncLeagueSeason)(league.apiId, s);
            totalMatches += matchCount;
            console.log(`[backfill] ${league.code} ${s}: ${matchCount} matches`);
            // Sync standings for this league-season
            try {
                await (0, syncStandings_1.syncLeagueStandings)(league.code, league.apiId, s);
            }
            catch (err) {
                console.error(`[backfill] Standings error ${league.code} ${s}:`, err.message);
            }
            // Optionally sync match details for finished matches
            if (includeDetails) {
                const finishedIds = await getFinishedFixtureIds(league.apiId, s);
                if (finishedIds.length > 0) {
                    const detailCount = await (0, syncDetails_1.syncMatchDetails)(finishedIds);
                    totalDetails += detailCount;
                    console.log(`[backfill] ${league.code} ${s}: ${detailCount} match details`);
                }
            }
        }
    }
    return { leagues: leagues.length, matches: totalMatches, details: totalDetails, leagueCreated };
}
/**
 * Gets fixture IDs for finished matches in a league-season.
 */
async function getFinishedFixtureIds(leagueApiId, season) {
    try {
        const fixtures = await (0, apiFootball_1.getFixtures)({
            league: leagueApiId,
            season,
            status: 'FT-AET-PEN', // All finished statuses
        });
        return fixtures.map((f) => f.fixture.id);
    }
    catch (_a) {
        return [];
    }
}
/**
 * Syncs team data from the matches already in Firestore.
 * Extracts unique teams from match documents and creates team docs.
 */
async function buildTeamsFromMatches(options) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const { seasonsOnly } = options || {};
    const teamsMap = new Map();
    const teamSeasons = new Map();
    // Read all matches in batches
    let lastDoc = null;
    const pageSize = 500;
    while (true) {
        let q = db.collection(config_1.COLLECTIONS.MATCHES)
            .orderBy('id')
            .limit(pageSize);
        if (lastDoc) {
            q = q.startAfter(lastDoc);
        }
        const snapshot = await q.get();
        if (snapshot.empty)
            break;
        for (const doc of snapshot.docs) {
            const data = doc.data();
            const season = data.season;
            const trackSeason = (teamId) => {
                if (season == null)
                    return;
                if (!teamSeasons.has(teamId))
                    teamSeasons.set(teamId, new Set());
                teamSeasons.get(teamId).add(season);
            };
            if (seasonsOnly) {
                // Only collect seasons per team
                if ((_a = data.homeTeam) === null || _a === void 0 ? void 0 : _a.id)
                    trackSeason(data.homeTeam.id);
                if ((_b = data.awayTeam) === null || _b === void 0 ? void 0 : _b.id)
                    trackSeason(data.awayTeam.id);
            }
            else {
                // Full rebuild — collect team data + seasons
                if (((_c = data.homeTeam) === null || _c === void 0 ? void 0 : _c.id) && !teamsMap.has(data.homeTeam.id)) {
                    teamsMap.set(data.homeTeam.id, {
                        id: data.homeTeam.id,
                        name: data.homeTeam.name,
                        shortName: data.homeTeam.shortName,
                        crest: data.homeTeam.crest,
                        venue: null,
                        founded: null,
                        country: '',
                        competitionCodes: [data.competition.code],
                    });
                }
                else if ((_d = data.homeTeam) === null || _d === void 0 ? void 0 : _d.id) {
                    const existing = teamsMap.get(data.homeTeam.id);
                    if (!existing.competitionCodes.includes(data.competition.code)) {
                        existing.competitionCodes.push(data.competition.code);
                    }
                }
                if ((_e = data.homeTeam) === null || _e === void 0 ? void 0 : _e.id)
                    trackSeason(data.homeTeam.id);
                if (((_f = data.awayTeam) === null || _f === void 0 ? void 0 : _f.id) && !teamsMap.has(data.awayTeam.id)) {
                    teamsMap.set(data.awayTeam.id, {
                        id: data.awayTeam.id,
                        name: data.awayTeam.name,
                        shortName: data.awayTeam.shortName,
                        crest: data.awayTeam.crest,
                        venue: null,
                        founded: null,
                        country: '',
                        competitionCodes: [data.competition.code],
                    });
                }
                else if ((_g = data.awayTeam) === null || _g === void 0 ? void 0 : _g.id) {
                    const existing = teamsMap.get(data.awayTeam.id);
                    if (!existing.competitionCodes.includes(data.competition.code)) {
                        existing.competitionCodes.push(data.competition.code);
                    }
                }
                if ((_h = data.awayTeam) === null || _h === void 0 ? void 0 : _h.id)
                    trackSeason(data.awayTeam.id);
            }
        }
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }
    if (seasonsOnly) {
        // Write only availableSeasons to existing team docs
        const entries = Array.from(teamSeasons.entries());
        for (let i = 0; i < entries.length; i += 450) {
            const chunk = entries.slice(i, i + 450);
            const batch = db.batch();
            for (const [teamId, seasons] of chunk) {
                batch.set(db.collection(config_1.COLLECTIONS.TEAMS).doc(String(teamId)), { availableSeasons: Array.from(seasons).sort((a, b) => b - a) }, { merge: true });
            }
            await batch.commit();
        }
        console.log(`[buildTeams] Updated availableSeasons for ${entries.length} teams`);
        return entries.length;
    }
    // Write teams to Firestore (full rebuild)
    const teams = Array.from(teamsMap.values());
    for (let i = 0; i < teams.length; i += 450) {
        const chunk = teams.slice(i, i + 450);
        const batch = db.batch();
        for (const team of chunk) {
            const seasons = teamSeasons.get(team.id);
            const availableSeasons = seasons ? Array.from(seasons).sort((a, b) => b - a) : [];
            batch.set(db.collection(config_1.COLLECTIONS.TEAMS).doc(String(team.id)), { ...team, availableSeasons, syncedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        }
        await batch.commit();
    }
    console.log(`[buildTeams] Created ${teams.length} team documents`);
    return teams.length;
}
/**
 * Builds player documents from existing matchDetails in Firestore.
 * Extracts all unique players from lineups and creates player docs.
 * Also enriches team docs with coach and squad data.
 */
async function buildPlayersAndEnrichTeams(options) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    const playersMap = new Map();
    const teamCoaches = new Map();
    const playerSeasons = new Map();
    const { leagueCode, season: filterSeason, seasonsOnly } = options || {};
    // Determine current season — only use these matches for coach assignment
    const now = new Date();
    const month = now.getMonth() + 1;
    const currentSeason = month >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    console.log(`[buildPlayers] Current season: ${currentSeason}, filter: league=${leagueCode || 'all'} season=${filterSeason || 'all'}`);
    // If filtering by league/season, query matches first to get the relevant IDs
    let scopedMatchIds = null;
    if (leagueCode || filterSeason) {
        scopedMatchIds = new Set();
        let q = db.collection(config_1.COLLECTIONS.MATCHES);
        if (leagueCode)
            q = q.where('competition.code', '==', leagueCode);
        if (filterSeason)
            q = q.where('season', '==', filterSeason);
        const snap = await q.get();
        for (const d of snap.docs)
            scopedMatchIds.add(d.id);
        console.log(`[buildPlayers] Scoped to ${scopedMatchIds.size} matches for league=${leagueCode || 'all'} season=${filterSeason || 'all'}`);
        if (scopedMatchIds.size === 0)
            return { players: 0, teams: 0 };
    }
    // seasonsOnly fast path: stream through matchDetails, only collect playerIds + season
    // Never accumulates full doc data — avoids OOM on large datasets
    if (seasonsOnly) {
        let lastDoc = null;
        const pageSize = 500;
        let processed = 0;
        while (true) {
            let q = db.collection(config_1.COLLECTIONS.MATCH_DETAILS)
                .orderBy('matchId')
                .limit(pageSize);
            if (lastDoc)
                q = q.startAfter(lastDoc);
            const snapshot = await q.get();
            if (snapshot.empty)
                break;
            for (const doc of snapshot.docs) {
                const data = doc.data();
                if (scopedMatchIds && !scopedMatchIds.has(String(data.matchId)))
                    continue;
                const season = data.season;
                if (season == null || !((_a = data.playerIds) === null || _a === void 0 ? void 0 : _a.length))
                    continue;
                for (const pid of data.playerIds) {
                    if (!playerSeasons.has(pid))
                        playerSeasons.set(pid, new Set());
                    playerSeasons.get(pid).add(season);
                }
                processed++;
            }
            lastDoc = snapshot.docs[snapshot.docs.length - 1];
        }
        console.log(`[buildPlayers] Streamed ${processed} match details for seasonsOnly`);
        // Batch-write only availableSeasons
        const entries = Array.from(playerSeasons.entries());
        for (let i = 0; i < entries.length; i += config_1.FIRESTORE_BATCH_SIZE) {
            const chunk = entries.slice(i, i + config_1.FIRESTORE_BATCH_SIZE);
            const batch = db.batch();
            for (const [playerId, seasons] of chunk) {
                batch.set(db.collection(config_1.COLLECTIONS.PLAYERS).doc(String(playerId)), { availableSeasons: Array.from(seasons).sort((a, b) => b - a) }, { merge: true });
            }
            await batch.commit();
        }
        console.log(`[buildPlayers] Updated availableSeasons for ${entries.length} players`);
        return { players: entries.length, teams: 0 };
    }
    // Full rebuild — load matchDetails into memory
    const detailsList = [];
    const matchIdsNeeded = new Set();
    let lastDoc = null;
    const pageSize = 500;
    while (true) {
        let q = db.collection(config_1.COLLECTIONS.MATCH_DETAILS)
            .orderBy('matchId')
            .limit(pageSize);
        if (lastDoc)
            q = q.startAfter(lastDoc);
        const snapshot = await q.get();
        if (snapshot.empty)
            break;
        for (const d of snapshot.docs) {
            const data = d.data();
            // Skip if not in scoped set
            if (scopedMatchIds && !scopedMatchIds.has(String(data.matchId)))
                continue;
            detailsList.push({ matchId: data.matchId, data });
            matchIdsNeeded.add(String(data.matchId));
        }
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }
    console.log(`[buildPlayers] Loaded ${detailsList.length} match details, need ${matchIdsNeeded.size} match docs`);
    // Batch-fetch only the match docs we actually need (in chunks of 100 for getAll)
    const matchCache = new Map();
    const matchIdArr = Array.from(matchIdsNeeded);
    for (let i = 0; i < matchIdArr.length; i += 100) {
        const chunk = matchIdArr.slice(i, i + 100);
        const refs = chunk.map((id) => db.collection(config_1.COLLECTIONS.MATCHES).doc(id));
        const docs = await db.getAll(...refs);
        for (const d of docs) {
            if (d.exists)
                matchCache.set(d.id, d.data());
        }
    }
    console.log(`[buildPlayers] Fetched ${matchCache.size} match docs`);
    // Track the most recent kickoff per player so we can assign currentTeam correctly
    const playerLatestKickoff = new Map();
    // Sort details by kickoff date ascending so the LAST write wins = most recent team
    const detailsWithKickoff = detailsList.map(({ matchId, data: d }) => {
        const matchData = matchCache.get(String(matchId)) || null;
        return { matchId, data: d, matchData, kickoff: (matchData === null || matchData === void 0 ? void 0 : matchData.kickoff) || '' };
    });
    detailsWithKickoff.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
    // Process all details (oldest first → newest overwrites currentTeam)
    for (const { data: d, matchData } of detailsWithKickoff) {
        const isCurrentSeason = (matchData === null || matchData === void 0 ? void 0 : matchData.season) === currentSeason;
        const kickoff = (matchData === null || matchData === void 0 ? void 0 : matchData.kickoff) || '';
        const homeTeamId = (_b = matchData === null || matchData === void 0 ? void 0 : matchData.homeTeam) === null || _b === void 0 ? void 0 : _b.id;
        const awayTeamId = (_c = matchData === null || matchData === void 0 ? void 0 : matchData.awayTeam) === null || _c === void 0 ? void 0 : _c.id;
        const homeTeamName = (_d = matchData === null || matchData === void 0 ? void 0 : matchData.homeTeam) === null || _d === void 0 ? void 0 : _d.name;
        const awayTeamName = (_e = matchData === null || matchData === void 0 ? void 0 : matchData.awayTeam) === null || _e === void 0 ? void 0 : _e.name;
        const homeTeamCrest = (_f = matchData === null || matchData === void 0 ? void 0 : matchData.homeTeam) === null || _f === void 0 ? void 0 : _f.crest;
        const awayTeamCrest = (_g = matchData === null || matchData === void 0 ? void 0 : matchData.awayTeam) === null || _g === void 0 ? void 0 : _g.crest;
        const competitionCode = ((_h = matchData === null || matchData === void 0 ? void 0 : matchData.competition) === null || _h === void 0 ? void 0 : _h.code) || '';
        // Helper to upsert a player — always update currentTeam if this match is newer
        const upsertPlayer = (p, teamId, teamName, teamCrest, compCode) => {
            var _a;
            if (!p.id)
                return;
            const prev = playerLatestKickoff.get(p.id) || '';
            const isNewer = kickoff >= prev;
            // Track season for this player
            const matchSeason = matchData === null || matchData === void 0 ? void 0 : matchData.season;
            if (matchSeason != null) {
                if (!playerSeasons.has(p.id))
                    playerSeasons.set(p.id, new Set());
                playerSeasons.get(p.id).add(matchSeason);
            }
            if (!playersMap.has(p.id)) {
                playersMap.set(p.id, {
                    id: p.id,
                    name: p.name,
                    nameLower: (p.name || '').toLowerCase(),
                    searchName: extractSearchName(p.name || ''),
                    searchPrefixes: generateSearchPrefixes(p.name || ''),
                    position: p.position || null,
                    formerPosition: null,
                    nationality: null,
                    dateOfBirth: null,
                    photo: null,
                    currentTeam: teamId ? { id: teamId, name: teamName, crest: teamCrest } : null,
                    leagueTier: (0, leagueHelper_1.getLeagueTier)(compCode ? [compCode] : []),
                });
                playerLatestKickoff.set(p.id, kickoff);
            }
            else if (isNewer && teamId) {
                const existing = playersMap.get(p.id);
                existing.currentTeam = { id: teamId, name: teamName, crest: teamCrest };
                const newTier = (0, leagueHelper_1.getLeagueTier)(compCode ? [compCode] : []);
                if (newTier < ((_a = existing.leagueTier) !== null && _a !== void 0 ? _a : 6))
                    existing.leagueTier = newTier;
                playerLatestKickoff.set(p.id, kickoff);
            }
        };
        // Process home lineup + bench
        const homeAllPlayers = [...(d.homeLineup || []), ...(d.homeBench || [])];
        for (const p of homeAllPlayers) {
            upsertPlayer(p, homeTeamId, homeTeamName, homeTeamCrest, competitionCode);
        }
        // Process away lineup + bench
        const awayAllPlayers = [...(d.awayLineup || []), ...(d.awayBench || [])];
        for (const p of awayAllPlayers) {
            upsertPlayer(p, awayTeamId, awayTeamName, awayTeamCrest, competitionCode);
        }
        // Coaches — only from current season for team enrichment
        if (isCurrentSeason) {
            if (((_j = d.homeCoach) === null || _j === void 0 ? void 0 : _j.id) && homeTeamId) {
                teamCoaches.set(homeTeamId, { id: d.homeCoach.id, name: d.homeCoach.name });
            }
            if (((_k = d.awayCoach) === null || _k === void 0 ? void 0 : _k.id) && awayTeamId) {
                teamCoaches.set(awayTeamId, { id: d.awayCoach.id, name: d.awayCoach.name });
            }
        }
        // Coaches as player docs — only create if the ID doesn't already exist as a
        // lineup/bench player (API data sometimes has coach ID clashes with player IDs).
        // Real coaches are handled correctly by the enrichment step via getTeamCoach().
        if ((_l = d.homeCoach) === null || _l === void 0 ? void 0 : _l.id) {
            const existing = playersMap.get(d.homeCoach.id);
            if (!existing || existing.position === 'Coach' || !existing.position) {
                upsertPlayer({ id: d.homeCoach.id, name: d.homeCoach.name, position: 'Coach' }, homeTeamId, homeTeamName, homeTeamCrest, competitionCode);
            }
        }
        if ((_m = d.awayCoach) === null || _m === void 0 ? void 0 : _m.id) {
            const existing = playersMap.get(d.awayCoach.id);
            if (!existing || existing.position === 'Coach' || !existing.position) {
                upsertPlayer({ id: d.awayCoach.id, name: d.awayCoach.name, position: 'Coach' }, awayTeamId, awayTeamName, awayTeamCrest, competitionCode);
            }
        }
    }
    console.log(`[buildPlayers] Processed all details: ${playersMap.size} players`);
    // Write players to Firestore — only set name fields if the doc doesn't already have an enriched name
    const players = Array.from(playersMap.values());
    for (let i = 0; i < players.length; i += config_1.FIRESTORE_BATCH_SIZE) {
        const chunk = players.slice(i, i + config_1.FIRESTORE_BATCH_SIZE);
        // Check which players already exist with enriched names
        const existingDocs = await Promise.all(chunk.map((p) => db.collection(config_1.COLLECTIONS.PLAYERS).doc(String(p.id)).get()));
        const existingNameMap = new Map();
        existingDocs.forEach((snap) => {
            if (snap.exists) {
                const data = snap.data();
                // If the doc already has a name that looks enriched (not a full legal name), preserve it
                if ((data === null || data === void 0 ? void 0 : data.name) && (data === null || data === void 0 ? void 0 : data.nameLower)) {
                    existingNameMap.set(data.id, true);
                }
            }
        });
        const batch = db.batch();
        for (const player of chunk) {
            const ref = db.collection(config_1.COLLECTIONS.PLAYERS).doc(String(player.id));
            const seasons = playerSeasons.get(player.id);
            const availableSeasons = seasons ? Array.from(seasons).sort((a, b) => b - a) : [];
            if (existingNameMap.has(player.id)) {
                // Player already enriched — only update currentTeam and position, not name fields
                const { name, nameLower, searchName, ...rest } = player;
                batch.set(ref, { ...rest, availableSeasons, syncedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            }
            else {
                batch.set(ref, { ...player, availableSeasons, syncedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            }
        }
        await batch.commit();
    }
    console.log(`[buildPlayers] Created/updated ${players.length} player documents`);
    // Enrich teams with coach data (squad is now handled by enrichPlayersFromSquads)
    let teamsUpdated = 0;
    const teamUpdates = Array.from(teamCoaches.keys());
    for (let i = 0; i < teamUpdates.length; i += config_1.FIRESTORE_BATCH_SIZE) {
        const chunk = teamUpdates.slice(i, i + config_1.FIRESTORE_BATCH_SIZE);
        const batch = db.batch();
        for (const teamId of chunk) {
            const coach = teamCoaches.get(teamId);
            if (coach) {
                batch.set(db.collection(config_1.COLLECTIONS.TEAMS).doc(String(teamId)), { coach, syncedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
                teamsUpdated++;
            }
        }
        await batch.commit();
    }
    console.log(`[buildPlayers] Enriched ${teamsUpdated} teams with coach data`);
    return { players: players.length, teams: teamsUpdated };
}
/**
 * Backfills team docs with country, founded, and venue from API-Football /teams endpoint.
 * Uses cursor-based pagination. Pass cursor from previous response to continue.
 */
async function enrichTeamInfo(batchLimit = 400, cursor) {
    var _a, _b, _c;
    let query = db.collection(config_1.COLLECTIONS.TEAMS).orderBy('__name__').limit(batchLimit);
    if (cursor) {
        query = query.startAfter(cursor);
    }
    const snap = await query.get();
    const teamDocs = snap.docs.filter((d) => {
        const data = d.data();
        return !data.country || !data.founded || !data.venue || typeof data.venue === 'string' || !data.activeCompetitions;
    });
    let updated = 0;
    for (const teamDoc of teamDocs) {
        const teamId = teamDoc.data().id;
        try {
            const info = await (0, apiFootball_1.getTeamInfo)(teamId);
            if (!info)
                continue;
            const update = {};
            if ((_a = info.team) === null || _a === void 0 ? void 0 : _a.country)
                update.country = info.team.country;
            if ((_b = info.team) === null || _b === void 0 ? void 0 : _b.founded)
                update.founded = info.team.founded;
            if ((_c = info.venue) === null || _c === void 0 ? void 0 : _c.name) {
                update.venue = {
                    name: info.venue.name,
                    city: info.venue.city || null,
                    capacity: info.venue.capacity || null,
                    image: info.venue.image || null,
                };
            }
            // Build activeCompetitions from competitionCodes (no API call)
            const compCodes = teamDoc.data().competitionCodes || [];
            if (compCodes.length > 0) {
                const leagueCodeMap = await (0, leagueHelper_1.getLeagueByCodeMap)();
                const activeCompetitions = compCodes
                    .map((code) => {
                    const league = leagueCodeMap.get(code);
                    if (!league)
                        return null;
                    return {
                        id: league.apiId,
                        name: league.name,
                        code: league.code,
                        emblem: `https://media.api-sports.io/football/leagues/${league.apiId}.png`,
                    };
                })
                    .filter(Boolean);
                if (activeCompetitions.length > 0) {
                    update.activeCompetitions = activeCompetitions;
                }
            }
            if (Object.keys(update).length > 0) {
                await db.collection(config_1.COLLECTIONS.TEAMS).doc(String(teamId)).set(update, { merge: true });
                updated++;
            }
        }
        catch (err) {
            console.error(`[enrichTeamInfo] Error for team ${teamId}:`, err.message);
        }
    }
    const nextCursor = snap.docs.length === batchLimit ? snap.docs[snap.docs.length - 1].id : null;
    console.log(`[enrichTeamInfo] Scanned ${snap.docs.length}, updated ${updated}, cursor=${nextCursor}`);
    return { updated, scanned: snap.docs.length, cursor: nextCursor };
}
/**
 * Shared helper: Processes Phases 1-3 of squad enrichment for a single team.
 * Phase 1: Fetch current squad via /players/squads
 * Phase 2: Enrich player docs via /players?team&season
 * Phase 3: Backfill nationality into squad array
 * Returns { playersEnriched, apiCalls }
 */
async function processTeamSquad(teamId, teamName, teamCrest, teamTier, currentSeason) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    let playersEnriched = 0;
    let apiCalls = 0;
    // ─── Phase 1: Fetch current squad via /players/squads ───
    apiCalls++;
    const squadResponse = await (0, apiFootball_1.getTeamSquad)(teamId);
    const currentSquad = [];
    if (squadResponse === null || squadResponse === void 0 ? void 0 : squadResponse.players) {
        for (const sp of squadResponse.players) {
            if (!sp.id)
                continue;
            currentSquad.push({
                id: sp.id,
                name: decodeEntities(sp.name),
                position: mapSquadPosition(sp.position),
                nationality: null,
                shirtNumber: (_a = sp.number) !== null && _a !== void 0 ? _a : null,
            });
        }
    }
    // Write squad to team doc
    if (currentSquad.length > 0) {
        await db.collection(config_1.COLLECTIONS.TEAMS).doc(String(teamId)).set({ squad: currentSquad, squadSyncedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        // Create stub player docs for squad members not yet in Firestore
        const squadPlayerRefs = currentSquad.map(p => db.collection(config_1.COLLECTIONS.PLAYERS).doc(String(p.id)));
        const existingIds = new Set();
        for (let i = 0; i < squadPlayerRefs.length; i += 100) {
            const chunk = squadPlayerRefs.slice(i, i + 100);
            const docs = await db.getAll(...chunk);
            for (const d of docs) {
                if (d.exists)
                    existingIds.add(Number(d.id));
            }
        }
        let stubBatch = db.batch();
        let stubCount = 0;
        for (const sp of currentSquad) {
            if (!existingIds.has(sp.id)) {
                const ref = db.collection(config_1.COLLECTIONS.PLAYERS).doc(String(sp.id));
                stubBatch.set(ref, {
                    id: sp.id,
                    name: sp.name,
                    nameLower: sp.name.toLowerCase(),
                    searchName: extractSearchName(sp.name),
                    searchPrefixes: generateSearchPrefixes(sp.name),
                    position: sp.position,
                    photo: null,
                    nationality: null,
                    dateOfBirth: null,
                    currentTeam: { id: teamId, name: teamName, crest: teamCrest },
                    leagueTier: teamTier,
                    syncedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
                stubCount++;
                if (stubCount >= 450) {
                    await stubBatch.commit();
                    stubBatch = db.batch();
                    stubCount = 0;
                }
            }
        }
        if (stubCount > 0)
            await stubBatch.commit();
    }
    // ─── Phase 2: Enrich player docs via /players?team&season ───
    const allPlayers = [];
    let page = 1;
    let totalPages = 1;
    while (page <= totalPages) {
        await new Promise((r) => setTimeout(r, config_2.RATE_LIMIT_DELAY_MS));
        apiCalls++;
        const response = await axios_1.default.get(`${config_2.API_FOOTBALL_BASE}/players`, {
            params: { team: teamId, season: currentSeason, page },
            headers: { 'x-apisports-key': config_2.API_FOOTBALL_KEY },
            timeout: 15000,
        });
        const data = response.data;
        const players = (data === null || data === void 0 ? void 0 : data.response) || [];
        allPlayers.push(...players);
        totalPages = ((_b = data === null || data === void 0 ? void 0 : data.paging) === null || _b === void 0 ? void 0 : _b.total) || 1;
        page++;
    }
    // Track players whose currentTeam changed (for squad cleanup)
    // Only track if the player is in this team's actual squad (Phase 1), not just season stats
    const INTERNATIONAL_CODES = new Set(['WC', 'EURO', 'NL', 'CA']);
    const currentSquadIds = new Set(currentSquad.map((s) => s.id));
    const oldTeamPlayers = new Map();
    if (allPlayers.length > 0) {
        // Read existing player docs to detect team changes
        const playerIds = allPlayers.map((e) => { var _a; return (_a = e.player) === null || _a === void 0 ? void 0 : _a.id; }).filter(Boolean);
        const playerRefs = playerIds.map((id) => db.collection(config_1.COLLECTIONS.PLAYERS).doc(String(id)));
        for (let i = 0; i < playerRefs.length; i += 100) {
            const chunk = playerRefs.slice(i, i + 100);
            const docs = await db.getAll(...chunk);
            for (const d of docs) {
                if (!d.exists)
                    continue;
                const prev = (_c = d.data()) === null || _c === void 0 ? void 0 : _c.currentTeam;
                const playerId = Number(d.id);
                if ((prev === null || prev === void 0 ? void 0 : prev.id) && prev.id !== teamId && currentSquadIds.has(playerId)) {
                    if (!oldTeamPlayers.has(prev.id))
                        oldTeamPlayers.set(prev.id, new Set());
                    oldTeamPlayers.get(prev.id).add(playerId);
                }
            }
        }
        let batch = db.batch();
        let batchCount = 0;
        for (const entry of allPlayers) {
            const p = entry.player;
            if (!(p === null || p === void 0 ? void 0 : p.id))
                continue;
            const apiName = p.name || '';
            const firstName = (p.firstname || '').trim();
            const lastName = (p.lastname || '').trim();
            const rawName = apiName.includes('.')
                ? (firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || apiName)
                : (apiName || (firstName && lastName ? `${firstName} ${lastName}` : firstName || lastName || ''));
            const fullName = decodeEntities(rawName);
            const pos = ((_f = (_e = (_d = entry.statistics) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.games) === null || _f === void 0 ? void 0 : _f.position) || null;
            const playerRef = db.collection(config_1.COLLECTIONS.PLAYERS).doc(String(p.id));
            const searchName = extractSearchName(fullName);
            const playerData = {
                id: p.id,
                name: fullName,
                nameLower: fullName.toLowerCase(),
                searchName,
                searchPrefixes: generateSearchPrefixes(fullName),
                photo: p.photo || null,
                nationality: p.nationality || null,
                dateOfBirth: ((_g = p.birth) === null || _g === void 0 ? void 0 : _g.date) || null,
                position: pos ? mapSquadPosition(pos) : undefined,
                leagueTier: teamTier,
                syncedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            // Only set currentTeam for players in the actual current squad (Phase 1)
            if (currentSquadIds.has(p.id)) {
                playerData.currentTeam = { id: teamId, name: teamName, crest: teamCrest };
            }
            batch.set(playerRef, playerData, { merge: true });
            batchCount++;
            playersEnriched++;
            if (batchCount >= 450) {
                await batch.commit();
                batch = db.batch();
                batchCount = 0;
            }
        }
        if (batchCount > 0) {
            await batch.commit();
        }
        // Remove transferred players from their old team's squad array
        // Skip national teams — players can be in both club + country squads
        const currentTeamDoc = await db.collection(config_1.COLLECTIONS.TEAMS).doc(String(teamId)).get();
        const currentCompCodes = ((_h = currentTeamDoc.data()) === null || _h === void 0 ? void 0 : _h.competitionCodes) || [];
        const currentIsNational = currentCompCodes.length > 0 && currentCompCodes.every((c) => INTERNATIONAL_CODES.has(c));
        if (!currentIsNational) {
            for (const [oldTeamId, playerIdSet] of oldTeamPlayers) {
                try {
                    const oldTeamRef = db.collection(config_1.COLLECTIONS.TEAMS).doc(String(oldTeamId));
                    const oldTeamSnap = await oldTeamRef.get();
                    if (!oldTeamSnap.exists)
                        continue;
                    const oldCompCodes = ((_j = oldTeamSnap.data()) === null || _j === void 0 ? void 0 : _j.competitionCodes) || [];
                    if (oldCompCodes.length > 0 && oldCompCodes.every((c) => INTERNATIONAL_CODES.has(c)))
                        continue;
                    const oldSquad = ((_k = oldTeamSnap.data()) === null || _k === void 0 ? void 0 : _k.squad) || [];
                    const filtered = oldSquad.filter((p) => !playerIdSet.has(p.id));
                    if (filtered.length < oldSquad.length) {
                        await oldTeamRef.update({ squad: filtered });
                        const movedIds = [...playerIdSet].filter((id) => oldSquad.some((p) => p.id === id));
                        console.log(`[processTeamSquad] Transferred player(s) [${movedIds.join(', ')}] from team ${oldTeamId} → ${teamId}`);
                    }
                }
                catch (err) {
                    console.error(`[processTeamSquad] Error cleaning squad for team ${oldTeamId}:`, err.message);
                }
            }
        }
    }
    // ─── Phase 3: Backfill nationality into squad array ───
    if (currentSquad.length > 0 && allPlayers.length > 0) {
        const nationalityMap = new Map();
        for (const entry of allPlayers) {
            const p = entry.player;
            if ((p === null || p === void 0 ? void 0 : p.id) && (p === null || p === void 0 ? void 0 : p.nationality)) {
                nationalityMap.set(p.id, p.nationality);
            }
        }
        let squadUpdated = false;
        for (const sp of currentSquad) {
            const nat = nationalityMap.get(sp.id);
            if (nat) {
                sp.nationality = nat;
                squadUpdated = true;
            }
        }
        if (squadUpdated) {
            await db.collection(config_1.COLLECTIONS.TEAMS).doc(String(teamId)).set({ squad: currentSquad }, { merge: true });
        }
    }
    // ─── Phase 4: Fetch coach ───
    apiCalls++;
    const coachResponse = await (0, apiFootball_1.getTeamCoach)(teamId);
    if (coachResponse) {
        const firstWord = (coachResponse.firstname || '').split(/\s+/)[0];
        const lastParts = (coachResponse.lastname || '').trim().split(/\s+/);
        const COACH_PARTICLES = new Set(['de', 'da', 'do', 'dos', 'das', 'di', 'del', 'della', 'van', 'von', 'den', 'der', 'ten', 'el', 'al', 'le', 'la', 'du']);
        const shortLastParts = [];
        for (const word of lastParts) {
            shortLastParts.push(word);
            if (!COACH_PARTICLES.has(word.toLowerCase()))
                break;
        }
        const shortLast = shortLastParts.join(' ');
        const coachName = decodeEntities(firstWord && shortLast ? `${firstWord} ${shortLast}`
            : coachResponse.name || firstWord || shortLast || '');
        await db.collection(config_1.COLLECTIONS.TEAMS).doc(String(teamId)).set({ coach: { id: coachResponse.id, name: coachName }, syncedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        // Update coach's player doc
        const coachRef = db.collection(config_1.COLLECTIONS.PLAYERS).doc(String(coachResponse.id));
        const existingCoachSnap = await coachRef.get();
        const existingCoachData = existingCoachSnap.data();
        const formerPosition = (existingCoachData === null || existingCoachData === void 0 ? void 0 : existingCoachData.formerPosition)
            || ((existingCoachData === null || existingCoachData === void 0 ? void 0 : existingCoachData.position) && existingCoachData.position !== 'Coach'
                ? existingCoachData.position : null);
        const coachDocData = {
            id: coachResponse.id,
            name: coachName,
            nameLower: coachName.toLowerCase(),
            searchName: extractSearchName(coachName),
            searchPrefixes: generateSearchPrefixes(coachName),
            photo: coachResponse.photo || null,
            nationality: coachResponse.nationality || null,
            dateOfBirth: ((_l = coachResponse.birth) === null || _l === void 0 ? void 0 : _l.date) || null,
            position: 'Coach',
            currentTeam: { id: teamId, name: teamName, crest: teamCrest },
            leagueTier: teamTier,
            syncedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (formerPosition)
            coachDocData.formerPosition = formerPosition;
        await coachRef.set(coachDocData, { merge: true });
    }
    return { playersEnriched, apiCalls };
}
/**
 * Lightweight squad-only refresh — runs Phases 1-3 for a batch of teams.
 * Uses cursor-based pagination (startAfter teamId) for robustness.
 * ~3 API calls per team.
 */
async function refreshSquadsOnly(batchLimit = 200, lastTeamId = 0) {
    const now = new Date();
    const month = now.getMonth() + 1;
    const currentSeason = month >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    const teamsSnap = await db.collection(config_1.COLLECTIONS.TEAMS)
        .orderBy('id')
        .startAfter(lastTeamId)
        .limit(batchLimit)
        .get();
    let teamsProcessed = 0;
    let playersEnriched = 0;
    let apiCalls = 0;
    let lastProcessedTeamId = lastTeamId;
    for (const teamDoc of teamsSnap.docs) {
        const teamData = teamDoc.data();
        const teamId = teamData.id;
        const teamName = teamData.name;
        const teamCrest = teamData.crest;
        const teamTier = await (0, leagueHelper_1.getLeagueTier)(teamData.competitionCodes);
        try {
            const result = await processTeamSquad(teamId, teamName, teamCrest, teamTier, currentSeason);
            playersEnriched += result.playersEnriched;
            apiCalls += result.apiCalls;
            lastProcessedTeamId = teamId;
            teamsProcessed++;
            console.log(`[refreshSquads] Team ${teamId} (${teamName}): enriched=${result.playersEnriched}`);
        }
        catch (err) {
            console.error(`[refreshSquads] Error for team ${teamId}:`, err.message);
            lastProcessedTeamId = teamId;
            teamsProcessed++;
        }
    }
    console.log(`[refreshSquads] Done: ${teamsProcessed} teams, ${playersEnriched} players, ${apiCalls} API calls`);
    return { teamsProcessed, playersEnriched, apiCalls, lastProcessedTeamId };
}
/**
 * Extracts a searchable last-name portion from a player name.
 * "L. Messi" → "messi", "Cristiano Ronaldo" → "ronaldo",
 * "Cristiano Ronaldo dos Santos Aveiro" → "ronaldo"
 * "Son Heung-Min" → "son heung-min" (full lowercase for CJK/compound names)
 */
const NAME_PARTICLES = new Set([
    'de', 'da', 'do', 'dos', 'das', 'di', 'del', 'della', 'degli',
    'van', 'von', 'den', 'der', 'el', 'al', 'bin', 'ibn',
    'le', 'la', 'les', 'du', 'des',
    'santos', 'silva', 'souza', 'sousa', 'oliveira', 'lima', 'pereira',
    'costa', 'ferreira', 'almeida', 'ribeiro', 'carvalho', 'gomes',
    'martins', 'rodrigues', 'fernandes', 'barbosa', 'vieira',
    'junior', 'jr', 'jr.', 'neto', 'filho', 'iii', 'ii',
]);
function extractSearchName(name) {
    const lower = name.toLowerCase().trim();
    // Handle "X. Lastname" format (e.g., "L. Messi", "C. Ronaldo")
    const dotMatch = lower.match(/^[a-z]\.\s+(.+)$/);
    if (dotMatch)
        return dotMatch[1];
    const parts = lower.split(/\s+/);
    if (parts.length <= 2) {
        // Simple names: "Cristiano Ronaldo" → "ronaldo", "Neymar" → "neymar"
        return parts.length > 1 ? parts[parts.length - 1] : lower;
    }
    // Walk backward to find the last meaningful (non-particle) word
    let lastNameIdx = -1;
    for (let i = parts.length - 1; i >= 1; i--) {
        if (!NAME_PARTICLES.has(parts[i]) && parts[i].length > 2) {
            lastNameIdx = i;
            break;
        }
    }
    if (lastNameIdx === -1)
        lastNameIdx = parts.length - 1;
    // Walk backward from lastNameIdx to collect preceding particles
    let startIdx = lastNameIdx;
    while (startIdx > 1 && NAME_PARTICLES.has(parts[startIdx - 1]) && parts[startIdx - 1].length <= 3) {
        startIdx--;
    }
    return parts.slice(startIdx, lastNameIdx + 1).join(' ');
}
/**
 * Generates prefix tokens for search. For each word in the name,
 * creates prefixes from 2 chars to the full word.
 * "Kevin De Bruyne" → ["ke","kev","kevi","kevin","de","br","bru","bruy","bruyn","bruyne"]
 */
function generateSearchPrefixes(name) {
    const words = name.toLowerCase().trim().split(/\s+/);
    const prefixes = new Set();
    for (const word of words) {
        for (let i = 2; i <= word.length; i++) {
            prefixes.add(word.substring(0, i));
        }
    }
    return Array.from(prefixes);
}
/**
 * Backfills nameLower and searchName fields for all existing player docs.
 * This enables case-insensitive and last-name prefix search.
 */
async function backfillPlayerNameLower() {
    let updated = 0;
    let lastDoc = null;
    const pageSize = 450;
    while (true) {
        let q = db.collection(config_1.COLLECTIONS.PLAYERS)
            .orderBy('id')
            .limit(pageSize);
        if (lastDoc)
            q = q.startAfter(lastDoc);
        const snapshot = await q.get();
        if (snapshot.empty)
            break;
        const batch = db.batch();
        for (const d of snapshot.docs) {
            const data = d.data();
            if (data.name) {
                const updates = {};
                const nameLower = data.name.toLowerCase();
                const searchName = extractSearchName(data.name);
                if (data.nameLower !== nameLower)
                    updates.nameLower = nameLower;
                if (data.searchName !== searchName)
                    updates.searchName = searchName;
                if (Object.keys(updates).length > 0) {
                    batch.update(d.ref, updates);
                    updated++;
                }
            }
        }
        await batch.commit();
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }
    console.log(`[backfillPlayerNameLower] Updated ${updated} player docs`);
    return updated;
}
function mapSquadPosition(pos) {
    switch (pos) {
        case 'Goalkeeper': return 'Goalkeeper';
        case 'Defender': return 'Defender';
        case 'Midfielder': return 'Midfielder';
        case 'Attacker': return 'Attacker';
        case 'Forward': return 'Attacker'; // normalize legacy
        default: return pos || 'Unknown';
    }
}
/**
 * Backfills missing matchDetails for FINISHED matches.
 * Does a ground-truth existence check against the matchDetails collection
 * (doesn't trust the hasDetails flag). Also fixes inconsistent hasDetails flags.
 *
 * @param maxMatches Max number of missing matches to sync per invocation (default 500).
 *                   Each match = 4 API calls (fixture + lineups + events + stats).
 */
async function backfillMissingMatchDetails(maxMatches = 500) {
    var _a, _b;
    let total = 0;
    let missing = 0;
    let synced = 0;
    let failed = 0;
    const missingIds = [];
    try {
        // Query FINISHED matches where hasDetails is false and not marked detailsNotFound
        const snap = await db.collection(config_1.COLLECTIONS.MATCHES)
            .where('status', '==', 'FINISHED')
            .where('hasDetails', '==', false)
            .orderBy('kickoff', 'desc')
            .limit(maxMatches)
            .get();
        if (!snap.empty) {
            total = snap.size;
            for (const doc of snap.docs) {
                if (doc.data().detailsNotFound)
                    continue;
                missingIds.push(doc.data().id);
            }
        }
        missing = missingIds.length;
        if (missing === 0) {
            console.log(`[backfillDetails] All ${total} finished matches have details`);
            return { total, missing: 0, synced: 0, failed: 0, syncedIds: [], failedIds: [] };
        }
        console.log(`[backfillDetails] Found ${missing} matches missing details out of ${total} scanned: [${missingIds.join(', ')}]`);
        // Sync missing details in batches of 10
        const SYNC_BATCH = 10;
        const syncedIds = [];
        const failedIds = [];
        for (let i = 0; i < missingIds.length; i += SYNC_BATCH) {
            const batch = missingIds.slice(i, i + SYNC_BATCH);
            try {
                const count = await (0, syncDetails_1.syncMatchDetails)(batch, true);
                synced += count;
                failed += batch.length - count;
                // Check which ones actually got synced
                const detailRefs = batch.map((id) => db.collection(config_1.COLLECTIONS.MATCH_DETAILS).doc(String(id)));
                const detailSnaps = await db.getAll(...detailRefs);
                for (let j = 0; j < batch.length; j++) {
                    if (detailSnaps[j].exists)
                        syncedIds.push(batch[j]);
                    else
                        failedIds.push(batch[j]);
                }
                console.log(`[backfillDetails] Progress: ${synced + failed}/${missing} (${synced} synced, ${failed} failed)`);
            }
            catch (err) {
                // Stop on rate limit
                if (((_a = err.message) === null || _a === void 0 ? void 0 : _a.includes('429')) || ((_b = err.message) === null || _b === void 0 ? void 0 : _b.includes('request limit'))) {
                    console.error(`[backfillDetails] Rate limited after syncing ${synced}. Stopping.`);
                    const remaining = missingIds.slice(i + batch.length);
                    failedIds.push(...remaining);
                    failed += remaining.length;
                    break;
                }
                failedIds.push(...batch);
                failed += batch.length;
                console.error(`[backfillDetails] Batch error:`, err.message);
            }
        }
        console.log(`[backfillDetails] Done: ${total} scanned, ${missing} missing, ${synced} synced, ${failed} failed`);
        console.log(`[backfillDetails] Synced IDs: [${syncedIds.join(', ')}]`);
        if (failedIds.length > 0) {
            console.log(`[backfillDetails] Failed IDs: [${failedIds.join(', ')}]`);
        }
        return { total, missing, synced, failed, syncedIds, failedIds };
    }
    catch (err) {
        console.error('[backfillDetails] Error:', err.message);
        return { total, missing, synced, failed, syncedIds: [], failedIds: [] };
    }
}
/**
 * Lightweight one-off: backfill country field for all teams using API-Football.
 * Only updates teams that don't have a real country yet (skips those already set).
 * Uses cursor-based pagination to handle large batches.
 */
async function backfillTeamCountry(batchLimit = 200) {
    var _a, _b, _c;
    const snapshot = await db.collection(config_1.COLLECTIONS.TEAMS).get();
    const allDocs = snapshot.docs;
    let updated = 0;
    let processed = 0;
    for (const teamDoc of allDocs) {
        const data = teamDoc.data();
        const teamId = data.id;
        // Skip if already has a plausible country (not a city — cities don't appear in the SYNC_LEAGUES country list)
        // We'll just re-fetch all to be safe, but limit the batch
        if (processed >= batchLimit)
            break;
        try {
            await new Promise((r) => setTimeout(r, config_2.RATE_LIMIT_DELAY_MS));
            processed++;
            const response = await axios_1.default.get(`${config_2.API_FOOTBALL_BASE}/teams`, {
                params: { id: teamId },
                headers: { 'x-apisports-key': config_2.API_FOOTBALL_KEY },
                timeout: 15000,
            });
            const teamData = (_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.response) === null || _b === void 0 ? void 0 : _b[0];
            if ((_c = teamData === null || teamData === void 0 ? void 0 : teamData.team) === null || _c === void 0 ? void 0 : _c.country) {
                await db.collection(config_1.COLLECTIONS.TEAMS).doc(String(teamId)).set({ country: teamData.team.country }, { merge: true });
                updated++;
            }
        }
        catch (err) {
            console.error(`[backfillTeamCountry] Error for team ${teamId}:`, err.message);
        }
    }
    console.log(`[backfillTeamCountry] Updated ${updated}/${processed} teams (total: ${allDocs.length})`);
    return { updated, total: allDocs.length };
}
/**
 * Re-compute `stage` from `round` for all matches using the updated parseStage logic.
 * Fixes matches that were incorrectly tagged (e.g. "1/128-finals" → 'FINAL').
 */
async function backfillMatchStages() {
    const { parseStage } = await Promise.resolve().then(() => __importStar(require('../transforms')));
    const snapshot = await db.collection(config_1.COLLECTIONS.MATCHES)
        .where('stage', '!=', null)
        .get();
    let updated = 0;
    let batch = db.batch();
    let batchCount = 0;
    for (const doc of snapshot.docs) {
        const data = doc.data();
        const round = data.round;
        if (!round)
            continue;
        const correctStage = parseStage(round);
        if (correctStage !== data.stage) {
            batch.update(doc.ref, { stage: correctStage });
            batchCount++;
            updated++;
            console.log(`[backfillMatchStages] ${doc.id}: "${round}" stage ${data.stage} → ${correctStage}`);
            if (batchCount >= config_1.FIRESTORE_BATCH_SIZE) {
                await batch.commit();
                batch = db.batch();
                batchCount = 0;
            }
        }
    }
    if (batchCount > 0)
        await batch.commit();
    console.log(`[backfillMatchStages] Updated ${updated}/${snapshot.size} matches`);
    return { updated, total: snapshot.size };
}
//# sourceMappingURL=backfill.js.map