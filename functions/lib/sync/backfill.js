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
exports.fetchTeamColors = fetchTeamColors;
exports.enrichPlayersFromSquads = enrichPlayersFromSquads;
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
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    const playersMap = new Map();
    const teamCoaches = new Map();
    const teamSquads = new Map();
    // Determine current season — only use these matches for squad building
    const now = new Date();
    const month = now.getMonth() + 1;
    const currentSeason = month >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    console.log(`[buildPlayers] Current season for squads: ${currentSeason}`);
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
        // Helper to upsert a player — always update currentTeam if this match is newer
        const upsertPlayer = (p, teamId, teamName, teamCrest) => {
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
                    position: p.position || null,
                    nationality: null,
                    dateOfBirth: null,
                    photo: null,
                    currentTeam: teamId ? { id: teamId, name: teamName, crest: teamCrest } : null,
                });
                playerLatestKickoff.set(p.id, kickoff);
            }
            else if (isNewer && teamId) {
                const existing = playersMap.get(p.id);
                existing.currentTeam = { id: teamId, name: teamName, crest: teamCrest };
                playerLatestKickoff.set(p.id, kickoff);
            }
        };
        // Process home lineup + bench
        const homeAllPlayers = [...(d.homeLineup || []), ...(d.homeBench || [])];
        for (const p of homeAllPlayers) {
            upsertPlayer(p, homeTeamId, homeTeamName, homeTeamCrest);
            if (isCurrentSeason && homeTeamId && p.id) {
                if (!teamSquads.has(homeTeamId))
                    teamSquads.set(homeTeamId, new Map());
                const squad = teamSquads.get(homeTeamId);
                if (!squad.has(p.id)) {
                    squad.set(p.id, { id: p.id, name: p.name, position: p.position || null, nationality: null });
                }
            }
        }
        // Process away lineup + bench
        const awayAllPlayers = [...(d.awayLineup || []), ...(d.awayBench || [])];
        for (const p of awayAllPlayers) {
            upsertPlayer(p, awayTeamId, awayTeamName, awayTeamCrest);
            if (isCurrentSeason && awayTeamId && p.id) {
                if (!teamSquads.has(awayTeamId))
                    teamSquads.set(awayTeamId, new Map());
                const squad = teamSquads.get(awayTeamId);
                if (!squad.has(p.id)) {
                    squad.set(p.id, { id: p.id, name: p.name, position: p.position || null, nationality: null });
                }
            }
        }
        // Coaches — only from current season for team enrichment
        if (isCurrentSeason) {
            if (((_g = d.homeCoach) === null || _g === void 0 ? void 0 : _g.id) && homeTeamId) {
                teamCoaches.set(homeTeamId, { id: d.homeCoach.id, name: d.homeCoach.name });
            }
            if (((_h = d.awayCoach) === null || _h === void 0 ? void 0 : _h.id) && awayTeamId) {
                teamCoaches.set(awayTeamId, { id: d.awayCoach.id, name: d.awayCoach.name });
            }
        }
        // Coaches as player docs
        if ((_j = d.homeCoach) === null || _j === void 0 ? void 0 : _j.id) {
            upsertPlayer({ id: d.homeCoach.id, name: d.homeCoach.name, position: 'Coach' }, homeTeamId, homeTeamName, homeTeamCrest);
        }
        if ((_k = d.awayCoach) === null || _k === void 0 ? void 0 : _k.id) {
            upsertPlayer({ id: d.awayCoach.id, name: d.awayCoach.name, position: 'Coach' }, awayTeamId, awayTeamName, awayTeamCrest);
        }
    }
    console.log(`[buildPlayers] Processed all details: ${playersMap.size} players, ${teamSquads.size} teams with squads`);
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
    // Enrich teams with coach and squad data
    let teamsUpdated = 0;
    const teamIds = new Set([...teamCoaches.keys(), ...teamSquads.keys()]);
    const teamUpdates = Array.from(teamIds);
    for (let i = 0; i < teamUpdates.length; i += config_1.FIRESTORE_BATCH_SIZE) {
        const chunk = teamUpdates.slice(i, i + config_1.FIRESTORE_BATCH_SIZE);
        const batch = db.batch();
        for (const teamId of chunk) {
            const update = {
                syncedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            const coach = teamCoaches.get(teamId);
            if (coach) {
                update.coach = coach;
            }
            const squad = teamSquads.get(teamId);
            if (squad) {
                update.squad = Array.from(squad.values());
            }
            batch.set(db.collection(config_1.COLLECTIONS.TEAMS).doc(String(teamId)), update, { merge: true });
            teamsUpdated++;
        }
        await batch.commit();
    }
    console.log(`[buildPlayers] Enriched ${teamsUpdated} teams with coach/squad data`);
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
    var _a, _b, _c, _d, _e;
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
        const teamId = teamDoc.data().id;
        const teamName = teamDoc.data().name;
        const teamCrest = teamDoc.data().crest;
        try {
            // Fetch all pages of players for this team+season
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
                // API-Football returns paging info
                totalPages = ((_a = data === null || data === void 0 ? void 0 : data.paging) === null || _a === void 0 ? void 0 : _a.total) || 1;
                page++;
            }
            if (allPlayers.length === 0) {
                teamsProcessed++;
                continue;
            }
            // Batch-update player docs with full name data
            let batch = db.batch();
            let batchCount = 0;
            for (const entry of allPlayers) {
                const p = entry.player;
                if (!(p === null || p === void 0 ? void 0 : p.id))
                    continue;
                // Prefer p.name — it's the common/display name from API-Football (e.g. "Cristiano Ronaldo")
                // firstname + lastname gives the full legal name (e.g. "Cristiano Ronaldo dos Santos Aveiro")
                const fullName = p.name
                    || ((p.firstname && p.lastname) ? `${p.firstname} ${p.lastname}` : `${p.firstname || ''} ${p.lastname || ''}`.trim());
                // Derive position from statistics if available
                const pos = ((_d = (_c = (_b = entry.statistics) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.games) === null || _d === void 0 ? void 0 : _d.position) || null;
                const playerRef = db.collection(config_1.COLLECTIONS.PLAYERS).doc(String(p.id));
                // Always extract searchName from the display name (handles particles properly)
                const searchName = extractSearchName(fullName);
                batch.set(playerRef, {
                    id: p.id,
                    name: fullName,
                    nameLower: fullName.toLowerCase(),
                    searchName,
                    photo: p.photo || null,
                    nationality: p.nationality || null,
                    dateOfBirth: ((_e = p.birth) === null || _e === void 0 ? void 0 : _e.date) || null,
                    position: pos ? mapSquadPosition(pos) : undefined,
                    currentTeam: { id: teamId, name: teamName, crest: teamCrest },
                    syncedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
                batchCount++;
                playersEnriched++;
                // Firestore batch limit is 500
                if (batchCount >= 450) {
                    await batch.commit();
                    batch = db.batch();
                    batchCount = 0;
                }
            }
            if (batchCount > 0) {
                await batch.commit();
            }
            teamsProcessed++;
            console.log(`[enrichPlayers] Team ${teamId} (${teamName}): ${allPlayers.length} players, ${page - 1} API calls`);
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
    // For long names (3+ words), find the SECOND word as surname if it's meaningful,
    // otherwise walk backwards skipping particles
    // "Cristiano Ronaldo dos Santos Aveiro" → parts[1] = "ronaldo" (meaningful)
    // Check if parts[1] is a common surname (not a particle)
    if (!NAME_PARTICLES.has(parts[1]) && parts[1].length > 2) {
        return parts[1];
    }
    // Walk backwards to find a meaningful last name
    for (let i = parts.length - 1; i >= 1; i--) {
        if (!NAME_PARTICLES.has(parts[i]) && parts[i].length > 2) {
            return parts[i];
        }
    }
    return parts[parts.length - 1];
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
        case 'Attacker': return 'Forward';
        default: return pos || 'Unknown';
    }
}
//# sourceMappingURL=backfill.js.map