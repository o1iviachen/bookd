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
exports.LEAGUE_TIER = void 0;
exports.getLeagueTier = getLeagueTier;
exports.runBackfill = runBackfill;
exports.buildTeamsFromMatches = buildTeamsFromMatches;
exports.buildPlayersAndEnrichTeams = buildPlayersAndEnrichTeams;
exports.fetchTeamColors = fetchTeamColors;
exports.enrichPlayersFromSquads = enrichPlayersFromSquads;
exports.generateSearchPrefixes = generateSearchPrefixes;
exports.backfillPlayerNameLower = backfillPlayerNameLower;
const config_1 = require("../config");
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
// League tier for player popularity ranking (lower = more popular)
// Players on top-tier teams sort first in search results
exports.LEAGUE_TIER = {
    // Tier 1 — Top 5 European leagues + Champions League
    PL: 1, CL: 1, PD: 1, BL1: 1, SA: 1, FL1: 1,
    // Tier 2 — Other European cups + strong leagues
    EL: 2, ECL: 2, ELC: 2, DED: 2, PPL: 2,
    // Tier 3 — National cups + mid-tier leagues
    FAC: 3, EFL: 3, SPL: 3, SL: 3, BEL: 3, BSA: 3, ARG: 3,
    // Tier 4 — Other leagues
    MLS: 4, LMX: 4, SAU: 4, JPL: 4, AUS: 4,
    // Tier 5 — International (players appear here but primarily belong to a club)
    WC: 5, EURO: 5, NL: 5, CA: 5,
};
const DEFAULT_LEAGUE_TIER = 6;
/** Get the best (lowest) league tier for a set of competition codes */
function getLeagueTier(competitionCodes) {
    if (!competitionCodes || competitionCodes.length === 0)
        return DEFAULT_LEAGUE_TIER;
    let best = DEFAULT_LEAGUE_TIER;
    for (const code of competitionCodes) {
        const tier = exports.LEAGUE_TIER[code];
        if (tier !== undefined && tier < best)
            best = tier;
    }
    return best;
}
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
    const { leagueCode, season, includeDetails } = options;
    const leagues = leagueCode
        ? config_1.SYNC_LEAGUES.filter((l) => l.code === leagueCode)
        : config_1.SYNC_LEAGUES;
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
    return { leagues: leagues.length, matches: totalMatches, details: totalDetails };
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
async function buildTeamsFromMatches() {
    var _a, _b, _c, _d;
    const teamsMap = new Map();
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
            // Extract home team
            if (((_a = data.homeTeam) === null || _a === void 0 ? void 0 : _a.id) && !teamsMap.has(data.homeTeam.id)) {
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
            else if ((_b = data.homeTeam) === null || _b === void 0 ? void 0 : _b.id) {
                const existing = teamsMap.get(data.homeTeam.id);
                if (!existing.competitionCodes.includes(data.competition.code)) {
                    existing.competitionCodes.push(data.competition.code);
                }
            }
            // Extract away team
            if (((_c = data.awayTeam) === null || _c === void 0 ? void 0 : _c.id) && !teamsMap.has(data.awayTeam.id)) {
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
            else if ((_d = data.awayTeam) === null || _d === void 0 ? void 0 : _d.id) {
                const existing = teamsMap.get(data.awayTeam.id);
                if (!existing.competitionCodes.includes(data.competition.code)) {
                    existing.competitionCodes.push(data.competition.code);
                }
            }
        }
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }
    // Write teams to Firestore
    const teams = Array.from(teamsMap.values());
    for (let i = 0; i < teams.length; i += 450) {
        const chunk = teams.slice(i, i + 450);
        const batch = db.batch();
        for (const team of chunk) {
            batch.set(db.collection(config_1.COLLECTIONS.TEAMS).doc(String(team.id)), { ...team, syncedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
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
async function buildPlayersAndEnrichTeams() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    const playersMap = new Map();
    const teamCoaches = new Map();
    // Determine current season — only use these matches for coach assignment
    const now = new Date();
    const month = now.getMonth() + 1;
    const currentSeason = month >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    console.log(`[buildPlayers] Current season: ${currentSeason}`);
    // Read all matchDetails in batches, collecting matchIds we need
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
        const homeTeamId = (_a = matchData === null || matchData === void 0 ? void 0 : matchData.homeTeam) === null || _a === void 0 ? void 0 : _a.id;
        const awayTeamId = (_b = matchData === null || matchData === void 0 ? void 0 : matchData.awayTeam) === null || _b === void 0 ? void 0 : _b.id;
        const homeTeamName = (_c = matchData === null || matchData === void 0 ? void 0 : matchData.homeTeam) === null || _c === void 0 ? void 0 : _c.name;
        const awayTeamName = (_d = matchData === null || matchData === void 0 ? void 0 : matchData.awayTeam) === null || _d === void 0 ? void 0 : _d.name;
        const homeTeamCrest = (_e = matchData === null || matchData === void 0 ? void 0 : matchData.homeTeam) === null || _e === void 0 ? void 0 : _e.crest;
        const awayTeamCrest = (_f = matchData === null || matchData === void 0 ? void 0 : matchData.awayTeam) === null || _f === void 0 ? void 0 : _f.crest;
        const competitionCode = ((_g = matchData === null || matchData === void 0 ? void 0 : matchData.competition) === null || _g === void 0 ? void 0 : _g.code) || '';
        // Helper to upsert a player — always update currentTeam if this match is newer
        const upsertPlayer = (p, teamId, teamName, teamCrest, compCode) => {
            var _a;
            if (!p.id)
                return;
            const prev = playerLatestKickoff.get(p.id) || '';
            const isNewer = kickoff >= prev;
            if (!playersMap.has(p.id)) {
                playersMap.set(p.id, {
                    id: p.id,
                    name: p.name,
                    nameLower: (p.name || '').toLowerCase(),
                    searchName: extractSearchName(p.name || ''),
                    searchPrefixes: generateSearchPrefixes(p.name || ''),
                    position: p.position || null,
                    nationality: null,
                    dateOfBirth: null,
                    photo: null,
                    currentTeam: teamId ? { id: teamId, name: teamName, crest: teamCrest } : null,
                    leagueTier: getLeagueTier(compCode ? [compCode] : []),
                });
                playerLatestKickoff.set(p.id, kickoff);
            }
            else if (isNewer && teamId) {
                const existing = playersMap.get(p.id);
                existing.currentTeam = { id: teamId, name: teamName, crest: teamCrest };
                const newTier = getLeagueTier(compCode ? [compCode] : []);
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
            if (((_h = d.homeCoach) === null || _h === void 0 ? void 0 : _h.id) && homeTeamId) {
                teamCoaches.set(homeTeamId, { id: d.homeCoach.id, name: d.homeCoach.name });
            }
            if (((_j = d.awayCoach) === null || _j === void 0 ? void 0 : _j.id) && awayTeamId) {
                teamCoaches.set(awayTeamId, { id: d.awayCoach.id, name: d.awayCoach.name });
            }
        }
        // Coaches as player docs
        if ((_k = d.homeCoach) === null || _k === void 0 ? void 0 : _k.id) {
            upsertPlayer({ id: d.homeCoach.id, name: d.homeCoach.name, position: 'Coach' }, homeTeamId, homeTeamName, homeTeamCrest, competitionCode);
        }
        if ((_l = d.awayCoach) === null || _l === void 0 ? void 0 : _l.id) {
            upsertPlayer({ id: d.awayCoach.id, name: d.awayCoach.name, position: 'Coach' }, awayTeamId, awayTeamName, awayTeamCrest, competitionCode);
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
            if (existingNameMap.has(player.id)) {
                // Player already enriched — only update currentTeam and position, not name fields
                const { name, nameLower, searchName, ...rest } = player;
                batch.set(ref, { ...rest, syncedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            }
            else {
                batch.set(ref, { ...player, syncedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
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
 * Fetches team colors and venue info from API-Football for all teams in Firestore.
 * Processes in batches to stay within rate limits.
 */
async function fetchTeamColors(batchLimit = 100) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    // Get teams that don't have colors yet
    const snapshot = await db.collection(config_1.COLLECTIONS.TEAMS)
        .where('clubColors', '==', null)
        .limit(batchLimit)
        .get();
    // If that query fails (clubColors field might not exist), get all teams
    let teamDocs = snapshot.docs;
    if (teamDocs.length === 0) {
        const allSnap = await db.collection(config_1.COLLECTIONS.TEAMS).limit(batchLimit).get();
        teamDocs = allSnap.docs.filter((d) => !d.data().clubColors);
    }
    let updated = 0;
    for (const teamDoc of teamDocs) {
        const teamId = teamDoc.data().id;
        try {
            // Rate limit
            await new Promise((r) => setTimeout(r, config_2.RATE_LIMIT_DELAY_MS));
            const response = await axios_1.default.get(`${config_2.API_FOOTBALL_BASE}/teams`, {
                params: { id: teamId },
                headers: { 'x-apisports-key': config_2.API_FOOTBALL_KEY },
                timeout: 15000,
            });
            const teamData = (_b = (_a = response.data) === null || _a === void 0 ? void 0 : _a.response) === null || _b === void 0 ? void 0 : _b[0];
            if (teamData) {
                const update = {};
                if ((_c = teamData.team) === null || _c === void 0 ? void 0 : _c.colors) {
                    // API-Football returns colors as an object with player/goalkeeper keys
                    // Extract the primary color
                    const primary = (_e = (_d = teamData.team.colors) === null || _d === void 0 ? void 0 : _d.player) === null || _e === void 0 ? void 0 : _e.primary;
                    const secondary = (_g = (_f = teamData.team.colors) === null || _f === void 0 ? void 0 : _f.player) === null || _g === void 0 ? void 0 : _g.number;
                    if (primary) {
                        update.clubColors = `#${primary}`;
                        if (secondary && secondary !== primary) {
                            update.clubColors = `#${primary} / #${secondary}`;
                        }
                    }
                }
                if ((_h = teamData.venue) === null || _h === void 0 ? void 0 : _h.name) {
                    update.venue = teamData.venue.name;
                }
                if ((_j = teamData.venue) === null || _j === void 0 ? void 0 : _j.city) {
                    update.country = teamData.venue.city;
                }
                if ((_k = teamData.team) === null || _k === void 0 ? void 0 : _k.founded) {
                    update.founded = teamData.team.founded;
                }
                if (Object.keys(update).length > 0) {
                    await db.collection(config_1.COLLECTIONS.TEAMS).doc(String(teamId)).set(update, { merge: true });
                    updated++;
                }
            }
        }
        catch (err) {
            console.error(`[fetchTeamColors] Error for team ${teamId}:`, err.message);
        }
    }
    console.log(`[fetchTeamColors] Updated ${updated} teams with colors/venue data`);
    return updated;
}
/**
 * Enriches player docs with FULL names, photo, nationality, DOB by fetching
 * /players?team={id}&season={year} for each team. This endpoint returns
 * firstname, lastname, full name, nationality, birth date, and photo.
 * It's paginated (20 per page) so ~2 API calls per team.
 *
 * Query params:
 *   ?limit=50 — how many teams to process per invocation (default 50)
 *   ?offset=0 — skip this many teams (for resuming)
 */
async function enrichPlayersFromSquads(batchLimit = 50, offset = 0) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    // Determine current season
    const now = new Date();
    const month = now.getMonth() + 1;
    const currentSeason = month >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    // Get all team IDs from Firestore
    const teamsSnap = await db.collection(config_1.COLLECTIONS.TEAMS)
        .orderBy('id')
        .offset(offset)
        .limit(batchLimit)
        .get();
    let teamsProcessed = 0;
    let playersEnriched = 0;
    let apiCalls = 0;
    for (const teamDoc of teamsSnap.docs) {
        const teamData = teamDoc.data();
        const teamId = teamData.id;
        const teamName = teamData.name;
        const teamCrest = teamData.crest;
        const teamTier = getLeagueTier(teamData.competitionCodes);
        try {
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
                        nationality: null, // backfilled in Phase 3
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
                totalPages = ((_a = data === null || data === void 0 ? void 0 : data.paging) === null || _a === void 0 ? void 0 : _a.total) || 1;
                page++;
            }
            if (allPlayers.length > 0) {
                let batch = db.batch();
                let batchCount = 0;
                for (const entry of allPlayers) {
                    const p = entry.player;
                    if (!(p === null || p === void 0 ? void 0 : p.id))
                        continue;
                    const firstWord = (p.firstname || '').split(/\s+/)[0];
                    const rawName = p.name
                        || (firstWord && p.lastname ? `${firstWord} ${p.lastname}` : p.firstname || p.lastname || '');
                    const fullName = decodeEntities(rawName);
                    const pos = ((_d = (_c = (_b = entry.statistics) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.games) === null || _d === void 0 ? void 0 : _d.position) || null;
                    const playerRef = db.collection(config_1.COLLECTIONS.PLAYERS).doc(String(p.id));
                    const searchName = extractSearchName(fullName);
                    batch.set(playerRef, {
                        id: p.id,
                        name: fullName,
                        nameLower: fullName.toLowerCase(),
                        searchName,
                        searchPrefixes: generateSearchPrefixes(fullName),
                        photo: p.photo || null,
                        nationality: p.nationality || null,
                        dateOfBirth: ((_e = p.birth) === null || _e === void 0 ? void 0 : _e.date) || null,
                        position: pos ? mapSquadPosition(pos) : undefined,
                        currentTeam: { id: teamId, name: teamName, crest: teamCrest },
                        leagueTier: teamTier,
                        syncedAt: admin.firestore.FieldValue.serverTimestamp(),
                    }, { merge: true });
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
            // ─── Phase 4: Fetch team info (venue, founded, colors) ───
            apiCalls++;
            const teamInfoResponse = await (0, apiFootball_1.getTeamInfo)(teamId);
            const teamUpdate = {};
            if (teamInfoResponse) {
                if ((_f = teamInfoResponse.venue) === null || _f === void 0 ? void 0 : _f.name)
                    teamUpdate.venue = teamInfoResponse.venue.name;
                if ((_g = teamInfoResponse.team) === null || _g === void 0 ? void 0 : _g.founded)
                    teamUpdate.founded = teamInfoResponse.team.founded;
                if ((_k = (_j = (_h = teamInfoResponse.team) === null || _h === void 0 ? void 0 : _h.colors) === null || _j === void 0 ? void 0 : _j.player) === null || _k === void 0 ? void 0 : _k.primary) {
                    const primary = teamInfoResponse.team.colors.player.primary;
                    const secondary = teamInfoResponse.team.colors.player.number;
                    teamUpdate.clubColors = `#${primary}`;
                    if (secondary && secondary !== primary) {
                        teamUpdate.clubColors = `#${primary} / #${secondary}`;
                    }
                }
            }
            // ─── Phase 5: Fetch coach with full name ───
            apiCalls++;
            const coachResponse = await (0, apiFootball_1.getTeamCoach)(teamId);
            if (coachResponse) {
                // Prefer firstname + lastname for full name (name field is often abbreviated like "P. Guardiola")
                const firstName = (coachResponse.firstname || '').trim();
                const lastName = (coachResponse.lastname || '').trim();
                const coachName = decodeEntities(firstName && lastName ? `${firstName} ${lastName}`
                    : firstName || lastName || coachResponse.name || '');
                teamUpdate.coach = { id: coachResponse.id, name: coachName };
                // Also update the coach's player doc with full name + photo + DOB
                const coachRef = db.collection(config_1.COLLECTIONS.PLAYERS).doc(String(coachResponse.id));
                await coachRef.set({
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
                }, { merge: true });
            }
            // ─── Phase 6: Build activeCompetitions from competitionCodes ───
            const compCodes = teamData.competitionCodes || [];
            if (compCodes.length > 0) {
                const activeCompetitions = compCodes
                    .map((code) => {
                    const league = config_1.SYNC_LEAGUES.find((l) => l.code === code);
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
                    teamUpdate.activeCompetitions = activeCompetitions;
                }
            }
            // Write all team updates in one call
            if (Object.keys(teamUpdate).length > 0) {
                await db.collection(config_1.COLLECTIONS.TEAMS).doc(String(teamId)).set({ ...teamUpdate, syncedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            }
            teamsProcessed++;
            console.log(`[enrichPlayers] Team ${teamId} (${teamName}): squad=${currentSquad.length}, enriched=${allPlayers.length}, coach=${(coachResponse === null || coachResponse === void 0 ? void 0 : coachResponse.name) || 'n/a'}`);
        }
        catch (err) {
            console.error(`[enrichPlayers] Error for team ${teamId}:`, err.message);
            teamsProcessed++;
        }
    }
    console.log(`[enrichPlayers] Done: ${teamsProcessed} teams, ${playersEnriched} players, ${apiCalls} API calls`);
    return { teamsProcessed, playersEnriched, apiCalls };
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
//# sourceMappingURL=backfill.js.map