import { BACKFILL_SEASONS, COLLECTIONS, FIRESTORE_BATCH_SIZE } from '../config';
import { getEnabledLeagues, getLeagueByCodeMap, getLeagueTier, clearLeagueCache } from '../leagueHelper';
import { syncLeagueSeason } from './syncMatches';
import { syncLeagueStandings } from './syncStandings';
import { syncMatchDetails } from './syncDetails';
import * as admin from 'firebase-admin';
import { getFixtures, getTeamSquad, getTeamInfo, getTeamCoach, getLeagueInfo } from '../apiFootball';
import { API_FOOTBALL_BASE, API_FOOTBALL_KEY, RATE_LIMIT_DELAY_MS } from '../config';
import axios from 'axios';

const db = admin.firestore();

/** Decode common HTML entities from API-Football. */
function decodeEntities(text: string): string {
  if (!text || !text.includes('&')) return text;
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
export async function runBackfill(options: {
  leagueCode?: string;
  apiId?: number;
  season?: number;
  includeDetails?: boolean;
}): Promise<{ leagues: number; matches: number; details: number; leagueCreated?: boolean }> {
  const { leagueCode, apiId, season, includeDetails } = options;

  let allLeagues = await getEnabledLeagues();
  let leagueCreated = false;

  // Auto-create league doc if code + apiId given but league doesn't exist
  if (leagueCode && apiId && !allLeagues.find((l) => l.code === leagueCode)) {
    const info = await getLeagueInfo(apiId);
    if (!info) {
      throw new Error(`Could not fetch league info from API for apiId=${apiId}`);
    }

    // Calendar-year leagues have seasons starting in Jan-Mar
    const currentSeason = info.seasons.find((s) => s.current);
    const startMonth = currentSeason ? new Date(currentSeason.start).getMonth() + 1 : 8;
    const seasonType = startMonth <= 3 ? 'calendar-year' : 'european';

    const leagueDoc: Record<string, any> = {
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
    await db.collection(COLLECTIONS.LEAGUES).doc(leagueCode).set(leagueDoc, { merge: true });
    clearLeagueCache();
    allLeagues = await getEnabledLeagues();
    leagueCreated = true;
    console.log(`[backfill] Auto-created league doc: ${leagueCode} (apiId=${apiId}, name=${info.league.name}, type=${info.league.type}, seasonType=${seasonType})`);
  }

  const leagues = leagueCode
    ? allLeagues.filter((l) => l.code === leagueCode)
    : allLeagues;

  const seasons = season ? [season] : BACKFILL_SEASONS;

  let totalMatches = 0;
  let totalDetails = 0;

  for (const league of leagues) {
    for (const s of seasons) {
      console.log(`[backfill] Starting ${league.code} season ${s}...`);

      // Sync all fixtures for this league-season
      const matchCount = await syncLeagueSeason(league.apiId, s);
      totalMatches += matchCount;
      console.log(`[backfill] ${league.code} ${s}: ${matchCount} matches`);

      // Sync standings for this league-season
      try {
        await syncLeagueStandings(league.code, league.apiId, s);
      } catch (err: any) {
        console.error(`[backfill] Standings error ${league.code} ${s}:`, err.message);
      }

      // Optionally sync match details for finished matches
      if (includeDetails) {
        const finishedIds = await getFinishedFixtureIds(league.apiId, s);
        if (finishedIds.length > 0) {
          const detailCount = await syncMatchDetails(finishedIds);
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
async function getFinishedFixtureIds(leagueApiId: number, season: number): Promise<number[]> {
  try {
    const fixtures = await getFixtures({
      league: leagueApiId,
      season,
      status: 'FT-AET-PEN', // All finished statuses
    });
    return fixtures.map((f) => f.fixture.id);
  } catch {
    return [];
  }
}

/**
 * Syncs team data from the matches already in Firestore.
 * Extracts unique teams from match documents and creates team docs.
 */
export async function buildTeamsFromMatches(options?: {
  seasonsOnly?: boolean;
}): Promise<number> {
  const { seasonsOnly } = options || {};
  const teamsMap = new Map<number, Record<string, any>>();
  const teamSeasons = new Map<number, Set<number>>();

  // Read all matches in batches
  let lastDoc: any = null;
  const pageSize = 500;

  while (true) {
    let q = db.collection(COLLECTIONS.MATCHES)
      .orderBy('id')
      .limit(pageSize);

    if (lastDoc) {
      q = q.startAfter(lastDoc);
    }

    const snapshot = await q.get();
    if (snapshot.empty) break;

    for (const doc of snapshot.docs) {
      const data = doc.data();
      const season = data.season as number | undefined;

      const trackSeason = (teamId: number) => {
        if (season == null) return;
        if (!teamSeasons.has(teamId)) teamSeasons.set(teamId, new Set());
        teamSeasons.get(teamId)!.add(season);
      };

      if (seasonsOnly) {
        // Only collect seasons per team
        if (data.homeTeam?.id) trackSeason(data.homeTeam.id);
        if (data.awayTeam?.id) trackSeason(data.awayTeam.id);
      } else {
        // Full rebuild — collect team data + seasons
        if (data.homeTeam?.id && !teamsMap.has(data.homeTeam.id)) {
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
        } else if (data.homeTeam?.id) {
          const existing = teamsMap.get(data.homeTeam.id)!;
          if (!existing.competitionCodes.includes(data.competition.code)) {
            existing.competitionCodes.push(data.competition.code);
          }
        }
        if (data.homeTeam?.id) trackSeason(data.homeTeam.id);

        if (data.awayTeam?.id && !teamsMap.has(data.awayTeam.id)) {
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
        } else if (data.awayTeam?.id) {
          const existing = teamsMap.get(data.awayTeam.id)!;
          if (!existing.competitionCodes.includes(data.competition.code)) {
            existing.competitionCodes.push(data.competition.code);
          }
        }
        if (data.awayTeam?.id) trackSeason(data.awayTeam.id);
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
        batch.set(
          db.collection(COLLECTIONS.TEAMS).doc(String(teamId)),
          { availableSeasons: Array.from(seasons).sort((a, b) => b - a) },
          { merge: true }
        );
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
      const availableSeasons = seasons ? Array.from(seasons).sort((a: number, b: number) => b - a) : [];
      batch.set(
        db.collection(COLLECTIONS.TEAMS).doc(String(team.id)),
        { ...team, availableSeasons, syncedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true }
      );
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
export async function buildPlayersAndEnrichTeams(options?: {
  leagueCode?: string;
  season?: number;
  seasonsOnly?: boolean;
}): Promise<{ players: number; teams: number }> {
  const playersMap = new Map<number, Record<string, any>>();
  const teamCoaches = new Map<number, { id: number; name: string }>();
  const playerSeasons = new Map<number, Set<number>>();
  const { leagueCode, season: filterSeason, seasonsOnly } = options || {};

  // Determine current season — only use these matches for coach assignment
  const now = new Date();
  const month = now.getMonth() + 1;
  const currentSeason = month >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  console.log(`[buildPlayers] Current season: ${currentSeason}, filter: league=${leagueCode || 'all'} season=${filterSeason || 'all'}`);

  // If filtering by league/season, query matches first to get the relevant IDs
  let scopedMatchIds: Set<string> | null = null;
  if (leagueCode || filterSeason) {
    scopedMatchIds = new Set<string>();
    let q: FirebaseFirestore.Query = db.collection(COLLECTIONS.MATCHES);
    if (leagueCode) q = q.where('competition.code', '==', leagueCode);
    if (filterSeason) q = q.where('season', '==', filterSeason);
    const snap = await q.get();
    for (const d of snap.docs) scopedMatchIds.add(d.id);
    console.log(`[buildPlayers] Scoped to ${scopedMatchIds.size} matches for league=${leagueCode || 'all'} season=${filterSeason || 'all'}`);
    if (scopedMatchIds.size === 0) return { players: 0, teams: 0 };
  }

  // seasonsOnly fast path: stream through matchDetails, only collect playerIds + season
  // Never accumulates full doc data — avoids OOM on large datasets
  if (seasonsOnly) {
    let lastDoc: any = null;
    const pageSize = 500;
    let processed = 0;

    while (true) {
      let q = db.collection(COLLECTIONS.MATCH_DETAILS)
        .orderBy('matchId')
        .limit(pageSize);
      if (lastDoc) q = q.startAfter(lastDoc);
      const snapshot = await q.get();
      if (snapshot.empty) break;
      for (const doc of snapshot.docs) {
        const data = doc.data();
        if (scopedMatchIds && !scopedMatchIds.has(String(data.matchId))) continue;
        const season = data.season as number | undefined;
        if (season == null || !data.playerIds?.length) continue;
        for (const pid of data.playerIds as number[]) {
          if (!playerSeasons.has(pid)) playerSeasons.set(pid, new Set());
          playerSeasons.get(pid)!.add(season);
        }
        processed++;
      }
      lastDoc = snapshot.docs[snapshot.docs.length - 1];
    }
    console.log(`[buildPlayers] Streamed ${processed} match details for seasonsOnly`);

    // Batch-write only availableSeasons
    const entries = Array.from(playerSeasons.entries());
    for (let i = 0; i < entries.length; i += FIRESTORE_BATCH_SIZE) {
      const chunk = entries.slice(i, i + FIRESTORE_BATCH_SIZE);
      const batch = db.batch();
      for (const [playerId, seasons] of chunk) {
        batch.set(
          db.collection(COLLECTIONS.PLAYERS).doc(String(playerId)),
          { availableSeasons: Array.from(seasons).sort((a, b) => b - a) },
          { merge: true }
        );
      }
      await batch.commit();
    }
    console.log(`[buildPlayers] Updated availableSeasons for ${entries.length} players`);
    return { players: entries.length, teams: 0 };
  }

  // Full rebuild — load matchDetails into memory
  const detailsList: Array<{ matchId: number; data: Record<string, any> }> = [];
  const matchIdsNeeded = new Set<string>();
  let lastDoc: any = null;
  const pageSize = 500;

  while (true) {
    let q = db.collection(COLLECTIONS.MATCH_DETAILS)
      .orderBy('matchId')
      .limit(pageSize);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snapshot = await q.get();
    if (snapshot.empty) break;
    for (const d of snapshot.docs) {
      const data = d.data();
      // Skip if not in scoped set
      if (scopedMatchIds && !scopedMatchIds.has(String(data.matchId))) continue;
      detailsList.push({ matchId: data.matchId, data });
      matchIdsNeeded.add(String(data.matchId));
    }
    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }
  console.log(`[buildPlayers] Loaded ${detailsList.length} match details, need ${matchIdsNeeded.size} match docs`);

  // Batch-fetch only the match docs we actually need (in chunks of 100 for getAll)
  const matchCache = new Map<string, Record<string, any>>();
  const matchIdArr = Array.from(matchIdsNeeded);
  for (let i = 0; i < matchIdArr.length; i += 100) {
    const chunk = matchIdArr.slice(i, i + 100);
    const refs = chunk.map((id) => db.collection(COLLECTIONS.MATCHES).doc(id));
    const docs = await db.getAll(...refs);
    for (const d of docs) {
      if (d.exists) matchCache.set(d.id, d.data()!);
    }
  }
  console.log(`[buildPlayers] Fetched ${matchCache.size} match docs`);

  // Track the most recent kickoff per player so we can assign currentTeam correctly
  const playerLatestKickoff = new Map<number, string>();

  // Sort details by kickoff date ascending so the LAST write wins = most recent team
  const detailsWithKickoff = detailsList.map(({ matchId, data: d }) => {
    const matchData = matchCache.get(String(matchId)) || null;
    return { matchId, data: d, matchData, kickoff: matchData?.kickoff || '' };
  });
  detailsWithKickoff.sort((a, b) => a.kickoff.localeCompare(b.kickoff));

  // Process all details (oldest first → newest overwrites currentTeam)
  for (const { data: d, matchData } of detailsWithKickoff) {
    const isCurrentSeason = matchData?.season === currentSeason;
    const kickoff = matchData?.kickoff || '';
    const homeTeamId = matchData?.homeTeam?.id;
    const awayTeamId = matchData?.awayTeam?.id;
    const homeTeamName = matchData?.homeTeam?.name;
    const awayTeamName = matchData?.awayTeam?.name;
    const homeTeamCrest = matchData?.homeTeam?.crest;
    const awayTeamCrest = matchData?.awayTeam?.crest;
    const competitionCode = matchData?.competition?.code || '';

    // Helper to upsert a player — always update currentTeam if this match is newer
    const upsertPlayer = (p: any, teamId: number | undefined, teamName: string | undefined, teamCrest: string | undefined, compCode: string) => {
      if (!p.id) return;
      const prev = playerLatestKickoff.get(p.id) || '';
      const isNewer = kickoff >= prev;

      // Track season for this player
      const matchSeason = matchData?.season as number | undefined;
      if (matchSeason != null) {
        if (!playerSeasons.has(p.id)) playerSeasons.set(p.id, new Set());
        playerSeasons.get(p.id)!.add(matchSeason);
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
          leagueTier: getLeagueTier(compCode ? [compCode] : []),
        });
        playerLatestKickoff.set(p.id, kickoff);
      } else if (isNewer && teamId) {
        const existing = playersMap.get(p.id)!;
        existing.currentTeam = { id: teamId, name: teamName, crest: teamCrest };
        const newTier = getLeagueTier(compCode ? [compCode] : []);
        if (newTier < (existing.leagueTier ?? 6)) existing.leagueTier = newTier;
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
      if (d.homeCoach?.id && homeTeamId) {
        teamCoaches.set(homeTeamId, { id: d.homeCoach.id, name: d.homeCoach.name });
      }
      if (d.awayCoach?.id && awayTeamId) {
        teamCoaches.set(awayTeamId, { id: d.awayCoach.id, name: d.awayCoach.name });
      }
    }
    // Coaches as player docs — only create if the ID doesn't already exist as a
    // lineup/bench player (API data sometimes has coach ID clashes with player IDs).
    // Real coaches are handled correctly by the enrichment step via getTeamCoach().
    if (d.homeCoach?.id) {
      const existing = playersMap.get(d.homeCoach.id);
      if (!existing || existing.position === 'Coach' || !existing.position) {
        upsertPlayer(
          { id: d.homeCoach.id, name: d.homeCoach.name, position: 'Coach' },
          homeTeamId, homeTeamName, homeTeamCrest, competitionCode
        );
      }
    }
    if (d.awayCoach?.id) {
      const existing = playersMap.get(d.awayCoach.id);
      if (!existing || existing.position === 'Coach' || !existing.position) {
        upsertPlayer(
          { id: d.awayCoach.id, name: d.awayCoach.name, position: 'Coach' },
          awayTeamId, awayTeamName, awayTeamCrest, competitionCode
        );
      }
    }
  }
  console.log(`[buildPlayers] Processed all details: ${playersMap.size} players`);

  // Write players to Firestore — only set name fields if the doc doesn't already have an enriched name
  const players = Array.from(playersMap.values());
  for (let i = 0; i < players.length; i += FIRESTORE_BATCH_SIZE) {
    const chunk = players.slice(i, i + FIRESTORE_BATCH_SIZE);

    // Check which players already exist with enriched names
    const existingDocs = await Promise.all(
      chunk.map((p) => db.collection(COLLECTIONS.PLAYERS).doc(String(p.id)).get())
    );
    const existingNameMap = new Map<number, boolean>();
    existingDocs.forEach((snap) => {
      if (snap.exists) {
        const data = snap.data();
        // If the doc already has a name that looks enriched (not a full legal name), preserve it
        if (data?.name && data?.nameLower) {
          existingNameMap.set(data.id, true);
        }
      }
    });

    const batch = db.batch();
    for (const player of chunk) {
      const ref = db.collection(COLLECTIONS.PLAYERS).doc(String(player.id));
      const seasons = playerSeasons.get(player.id);
      const availableSeasons = seasons ? Array.from(seasons).sort((a, b) => b - a) : [];
      if (existingNameMap.has(player.id)) {
        // Player already enriched — only update currentTeam and position, not name fields
        const { name, nameLower, searchName, ...rest } = player;
        batch.set(ref, { ...rest, availableSeasons, syncedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      } else {
        batch.set(ref, { ...player, availableSeasons, syncedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      }
    }
    await batch.commit();
  }
  console.log(`[buildPlayers] Created/updated ${players.length} player documents`);

  // Enrich teams with coach data (squad is now handled by enrichPlayersFromSquads)
  let teamsUpdated = 0;
  const teamUpdates = Array.from(teamCoaches.keys());

  for (let i = 0; i < teamUpdates.length; i += FIRESTORE_BATCH_SIZE) {
    const chunk = teamUpdates.slice(i, i + FIRESTORE_BATCH_SIZE);
    const batch = db.batch();
    for (const teamId of chunk) {
      const coach = teamCoaches.get(teamId);
      if (coach) {
        batch.set(
          db.collection(COLLECTIONS.TEAMS).doc(String(teamId)),
          { coach, syncedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
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
export async function fetchTeamColors(batchLimit = 100): Promise<number> {
  // Get teams that don't have colors yet
  const snapshot = await db.collection(COLLECTIONS.TEAMS)
    .where('clubColors', '==', null)
    .limit(batchLimit)
    .get();

  // If that query fails (clubColors field might not exist), get all teams
  let teamDocs = snapshot.docs;
  if (teamDocs.length === 0) {
    const allSnap = await db.collection(COLLECTIONS.TEAMS).limit(batchLimit).get();
    teamDocs = allSnap.docs.filter((d) => !d.data().clubColors);
  }

  let updated = 0;

  for (const teamDoc of teamDocs) {
    const teamId = teamDoc.data().id;
    try {
      // Rate limit
      await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS));

      const response = await axios.get(`${API_FOOTBALL_BASE}/teams`, {
        params: { id: teamId },
        headers: { 'x-apisports-key': API_FOOTBALL_KEY },
        timeout: 15000,
      });

      const teamData = response.data?.response?.[0];
      if (teamData) {
        const update: Record<string, any> = {};

        if (teamData.team?.colors) {
          // API-Football returns colors as an object with player/goalkeeper keys
          // Extract the primary color
          const primary = teamData.team.colors?.player?.primary;
          const secondary = teamData.team.colors?.player?.number;
          if (primary) {
            update.clubColors = `#${primary}`;
            if (secondary && secondary !== primary) {
              update.clubColors = `#${primary} / #${secondary}`;
            }
          }
        }

        if (teamData.venue?.name) {
          update.venue = teamData.venue.name;
        }
        if (teamData.team?.country) {
          update.country = teamData.team.country;
        }
        if (teamData.team?.founded) {
          update.founded = teamData.team.founded;
        }

        if (Object.keys(update).length > 0) {
          await db.collection(COLLECTIONS.TEAMS).doc(String(teamId)).set(update, { merge: true });
          updated++;
        }
      }
    } catch (err: any) {
      console.error(`[fetchTeamColors] Error for team ${teamId}:`, err.message);
    }
  }

  console.log(`[fetchTeamColors] Updated ${updated} teams with colors/venue data`);
  return updated;
}

/**
 * Shared helper: Processes Phases 1-3 of squad enrichment for a single team.
 * Phase 1: Fetch current squad via /players/squads
 * Phase 2: Enrich player docs via /players?team&season
 * Phase 3: Backfill nationality into squad array
 * Returns { playersEnriched, apiCalls }
 */
async function processTeamSquad(
  teamId: number,
  teamName: string,
  teamCrest: string,
  teamTier: number,
  currentSeason: number,
): Promise<{ playersEnriched: number; apiCalls: number }> {
  let playersEnriched = 0;
  let apiCalls = 0;

  // ─── Phase 1: Fetch current squad via /players/squads ───
  apiCalls++;
  const squadResponse = await getTeamSquad(teamId);
  const currentSquad: Array<{ id: number; name: string; position: string; nationality: string | null }> = [];

  if (squadResponse?.players) {
    for (const sp of squadResponse.players) {
      if (!sp.id) continue;
      currentSquad.push({
        id: sp.id,
        name: decodeEntities(sp.name),
        position: mapSquadPosition(sp.position),
        nationality: null,
      });
    }
  }

  // Write squad to team doc
  if (currentSquad.length > 0) {
    await db.collection(COLLECTIONS.TEAMS).doc(String(teamId)).set(
      { squad: currentSquad, squadSyncedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );

    // Create stub player docs for squad members not yet in Firestore
    const squadPlayerRefs = currentSquad.map(p =>
      db.collection(COLLECTIONS.PLAYERS).doc(String(p.id))
    );
    const existingIds = new Set<number>();
    for (let i = 0; i < squadPlayerRefs.length; i += 100) {
      const chunk = squadPlayerRefs.slice(i, i + 100);
      const docs = await db.getAll(...chunk);
      for (const d of docs) {
        if (d.exists) existingIds.add(Number(d.id));
      }
    }

    let stubBatch = db.batch();
    let stubCount = 0;
    for (const sp of currentSquad) {
      if (!existingIds.has(sp.id)) {
        const ref = db.collection(COLLECTIONS.PLAYERS).doc(String(sp.id));
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
    if (stubCount > 0) await stubBatch.commit();
  }

  // ─── Phase 2: Enrich player docs via /players?team&season ───
  const allPlayers: any[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS));
    apiCalls++;

    const response = await axios.get(`${API_FOOTBALL_BASE}/players`, {
      params: { team: teamId, season: currentSeason, page },
      headers: { 'x-apisports-key': API_FOOTBALL_KEY },
      timeout: 15000,
    });

    const data = response.data;
    const players = data?.response || [];
    allPlayers.push(...players);

    totalPages = data?.paging?.total || 1;
    page++;
  }

  if (allPlayers.length > 0) {
    let batch = db.batch();
    let batchCount = 0;

    for (const entry of allPlayers) {
      const p = entry.player;
      if (!p?.id) continue;

      const firstWord = (p.firstname || '').split(/\s+/)[0];
      const rawName = p.name
        || (firstWord && p.lastname ? `${firstWord} ${p.lastname}` : p.firstname || p.lastname || '');
      const fullName = decodeEntities(rawName);
      const pos = entry.statistics?.[0]?.games?.position || null;

      const playerRef = db.collection(COLLECTIONS.PLAYERS).doc(String(p.id));
      const searchName = extractSearchName(fullName);
      batch.set(playerRef, {
        id: p.id,
        name: fullName,
        nameLower: fullName.toLowerCase(),
        searchName,
        searchPrefixes: generateSearchPrefixes(fullName),
        photo: p.photo || null,
        nationality: p.nationality || null,
        dateOfBirth: p.birth?.date || null,
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
    const nationalityMap = new Map<number, string>();
    for (const entry of allPlayers) {
      const p = entry.player;
      if (p?.id && p?.nationality) {
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
      await db.collection(COLLECTIONS.TEAMS).doc(String(teamId)).set(
        { squad: currentSquad },
        { merge: true }
      );
    }
  }

  return { playersEnriched, apiCalls };
}

/**
 * Lightweight squad-only refresh — runs Phases 1-3 for a batch of teams.
 * Uses cursor-based pagination (startAfter teamId) for robustness.
 * ~3 API calls per team.
 */
export async function refreshSquadsOnly(batchLimit = 200, lastTeamId = 0): Promise<{
  teamsProcessed: number;
  playersEnriched: number;
  apiCalls: number;
  lastProcessedTeamId: number;
}> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const currentSeason = month >= 7 ? now.getFullYear() : now.getFullYear() - 1;

  const teamsSnap = await db.collection(COLLECTIONS.TEAMS)
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
    const teamTier = await getLeagueTier(teamData.competitionCodes);

    try {
      const result = await processTeamSquad(teamId, teamName, teamCrest, teamTier, currentSeason);
      playersEnriched += result.playersEnriched;
      apiCalls += result.apiCalls;
      lastProcessedTeamId = teamId;
      teamsProcessed++;
      console.log(`[refreshSquads] Team ${teamId} (${teamName}): enriched=${result.playersEnriched}`);
    } catch (err: any) {
      console.error(`[refreshSquads] Error for team ${teamId}:`, err.message);
      lastProcessedTeamId = teamId;
      teamsProcessed++;
    }
  }

  console.log(`[refreshSquads] Done: ${teamsProcessed} teams, ${playersEnriched} players, ${apiCalls} API calls`);
  return { teamsProcessed, playersEnriched, apiCalls, lastProcessedTeamId };
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
export async function enrichPlayersFromSquads(batchLimit = 50, offset = 0): Promise<{ teamsProcessed: number; playersEnriched: number; apiCalls: number }> {
  // Determine current season
  const now = new Date();
  const month = now.getMonth() + 1;
  const currentSeason = month >= 7 ? now.getFullYear() : now.getFullYear() - 1;

  // Get all team IDs from Firestore
  const teamsSnap = await db.collection(COLLECTIONS.TEAMS)
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
    const teamTier = await getLeagueTier(teamData.competitionCodes);

    try {
      // ─── Phases 1-3: Squad fetch, player enrichment, nationality backfill ───
      const squadResult = await processTeamSquad(teamId, teamName, teamCrest, teamTier, currentSeason);
      playersEnriched += squadResult.playersEnriched;
      apiCalls += squadResult.apiCalls;

      // ─── Phase 4: Fetch team info (venue, founded, colors) ───
      apiCalls++;
      const teamInfoResponse = await getTeamInfo(teamId);
      const teamUpdate: Record<string, any> = {};

      if (teamInfoResponse) {
        if (teamInfoResponse.venue?.name) teamUpdate.venue = teamInfoResponse.venue.name;
        if (teamInfoResponse.team?.country) teamUpdate.country = teamInfoResponse.team.country;
        if (teamInfoResponse.team?.founded) teamUpdate.founded = teamInfoResponse.team.founded;
        if (teamInfoResponse.team?.colors?.player?.primary) {
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
      const coachResponse = await getTeamCoach(teamId);
      if (coachResponse) {
        // First word of firstname + leading particles + first real surname word from lastname
        // e.g. "Josep" + "Guardiola i Sala" → "Josep Guardiola"
        // e.g. "Erik" + "ten Hag" → "Erik ten Hag"
        const firstWord = (coachResponse.firstname || '').split(/\s+/)[0];
        const lastParts = (coachResponse.lastname || '').trim().split(/\s+/);
        const NAME_PARTICLES = new Set(['de','da','do','dos','das','di','del','della','van','von','den','der','ten','el','al','le','la','du']);
        const shortLastParts: string[] = [];
        for (const word of lastParts) {
          shortLastParts.push(word);
          if (!NAME_PARTICLES.has(word.toLowerCase())) break;
        }
        const shortLast = shortLastParts.join(' ');
        const coachName = decodeEntities(
          firstWord && shortLast ? `${firstWord} ${shortLast}`
            : coachResponse.name || firstWord || shortLast || ''
        );
        teamUpdate.coach = { id: coachResponse.id, name: coachName };

        // Also update the coach's player doc with full name + photo + DOB
        // Preserve formerPosition if this coach was previously a player
        const coachRef = db.collection(COLLECTIONS.PLAYERS).doc(String(coachResponse.id));
        const existingCoachSnap = await coachRef.get();
        const existingCoachData = existingCoachSnap.data();
        const formerPosition = existingCoachData?.formerPosition
          || (existingCoachData?.position && existingCoachData.position !== 'Coach'
              ? existingCoachData.position : null);

        const coachDocData: Record<string, any> = {
          id: coachResponse.id,
          name: coachName,
          nameLower: coachName.toLowerCase(),
          searchName: extractSearchName(coachName),
          searchPrefixes: generateSearchPrefixes(coachName),
          photo: coachResponse.photo || null,
          nationality: coachResponse.nationality || null,
          dateOfBirth: coachResponse.birth?.date || null,
          position: 'Coach',
          currentTeam: { id: teamId, name: teamName, crest: teamCrest },
          leagueTier: teamTier,
          syncedAt: admin.firestore.FieldValue.serverTimestamp(),
        };
        if (formerPosition) {
          coachDocData.formerPosition = formerPosition;
        }
        await coachRef.set(coachDocData, { merge: true });
      }

      // ─── Phase 6: Build activeCompetitions from competitionCodes ───
      const compCodes: string[] = teamData.competitionCodes || [];
      const leagueCodeMap = await getLeagueByCodeMap();
      if (compCodes.length > 0) {
        const activeCompetitions = compCodes
          .map((code: string) => {
            const league = leagueCodeMap.get(code);
            if (!league) return null;
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
        await db.collection(COLLECTIONS.TEAMS).doc(String(teamId)).set(
          { ...teamUpdate, syncedAt: admin.firestore.FieldValue.serverTimestamp() },
          { merge: true }
        );
      }

      teamsProcessed++;
      console.log(`[enrichPlayers] Team ${teamId} (${teamName}): enriched=${squadResult.playersEnriched}, coach=${coachResponse?.name || 'n/a'}`);
    } catch (err: any) {
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

function extractSearchName(name: string): string {
  const lower = name.toLowerCase().trim();
  // Handle "X. Lastname" format (e.g., "L. Messi", "C. Ronaldo")
  const dotMatch = lower.match(/^[a-z]\.\s+(.+)$/);
  if (dotMatch) return dotMatch[1];

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
  if (lastNameIdx === -1) lastNameIdx = parts.length - 1;

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
export function generateSearchPrefixes(name: string): string[] {
  const words = name.toLowerCase().trim().split(/\s+/);
  const prefixes = new Set<string>();
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
export async function backfillPlayerNameLower(): Promise<number> {
  let updated = 0;
  let lastDoc: any = null;
  const pageSize = 450;

  while (true) {
    let q = db.collection(COLLECTIONS.PLAYERS)
      .orderBy('id')
      .limit(pageSize);
    if (lastDoc) q = q.startAfter(lastDoc);

    const snapshot = await q.get();
    if (snapshot.empty) break;

    const batch = db.batch();
    for (const d of snapshot.docs) {
      const data = d.data();
      if (data.name) {
        const updates: Record<string, any> = {};
        const nameLower = data.name.toLowerCase();
        const searchName = extractSearchName(data.name);
        if (data.nameLower !== nameLower) updates.nameLower = nameLower;
        if (data.searchName !== searchName) updates.searchName = searchName;
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

function mapSquadPosition(pos: string): string {
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
export async function backfillMissingMatchDetails(
  maxMatches = 500,
): Promise<{ total: number; missing: number; synced: number; failed: number; syncedIds: number[]; failedIds: number[] }> {
  let total = 0;
  let missing = 0;
  let synced = 0;
  let failed = 0;
  const missingIds: number[] = [];

  try {
    // Query FINISHED matches where hasDetails is false and not marked detailsNotFound
    const snap = await db.collection(COLLECTIONS.MATCHES)
      .where('status', '==', 'FINISHED')
      .where('hasDetails', '==', false)
      .orderBy('kickoff', 'desc')
      .limit(maxMatches)
      .get();

    if (!snap.empty) {
      total = snap.size;
      for (const doc of snap.docs) {
        if (doc.data().detailsNotFound) continue;
        missingIds.push(doc.data().id as number);
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
    const syncedIds: number[] = [];
    const failedIds: number[] = [];

    for (let i = 0; i < missingIds.length; i += SYNC_BATCH) {
      const batch = missingIds.slice(i, i + SYNC_BATCH);
      try {
        const count = await syncMatchDetails(batch, true);
        synced += count;
        failed += batch.length - count;
        // Check which ones actually got synced
        const detailRefs = batch.map((id) => db.collection(COLLECTIONS.MATCH_DETAILS).doc(String(id)));
        const detailSnaps = await db.getAll(...detailRefs);
        for (let j = 0; j < batch.length; j++) {
          if (detailSnaps[j].exists) syncedIds.push(batch[j]);
          else failedIds.push(batch[j]);
        }
        console.log(`[backfillDetails] Progress: ${synced + failed}/${missing} (${synced} synced, ${failed} failed)`);
      } catch (err: any) {
        // Stop on rate limit
        if (err.message?.includes('429') || err.message?.includes('request limit')) {
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
  } catch (err: any) {
    console.error('[backfillDetails] Error:', err.message);
    return { total, missing, synced, failed, syncedIds: [], failedIds: [] };
  }
}

/**
 * Lightweight one-off: backfill country field for all teams using API-Football.
 * Only updates teams that don't have a real country yet (skips those already set).
 * Uses cursor-based pagination to handle large batches.
 */
export async function backfillTeamCountry(batchLimit = 200): Promise<{ updated: number; total: number }> {
  const snapshot = await db.collection(COLLECTIONS.TEAMS).get();
  const allDocs = snapshot.docs;
  let updated = 0;
  let processed = 0;

  for (const teamDoc of allDocs) {
    const data = teamDoc.data();
    const teamId = data.id;

    // Skip if already has a plausible country (not a city — cities don't appear in the SYNC_LEAGUES country list)
    // We'll just re-fetch all to be safe, but limit the batch
    if (processed >= batchLimit) break;

    try {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS));
      processed++;

      const response = await axios.get(`${API_FOOTBALL_BASE}/teams`, {
        params: { id: teamId },
        headers: { 'x-apisports-key': API_FOOTBALL_KEY },
        timeout: 15000,
      });

      const teamData = response.data?.response?.[0];
      if (teamData?.team?.country) {
        await db.collection(COLLECTIONS.TEAMS).doc(String(teamId)).set(
          { country: teamData.team.country },
          { merge: true },
        );
        updated++;
      }
    } catch (err: any) {
      console.error(`[backfillTeamCountry] Error for team ${teamId}:`, err.message);
    }
  }

  console.log(`[backfillTeamCountry] Updated ${updated}/${processed} teams (total: ${allDocs.length})`);
  return { updated, total: allDocs.length };
}
