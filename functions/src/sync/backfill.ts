import { SYNC_LEAGUES, BACKFILL_SEASONS, COLLECTIONS, FIRESTORE_BATCH_SIZE } from '../config';
import { syncLeagueSeason } from './syncMatches';
import { syncLeagueStandings } from './syncStandings';
import { syncMatchDetails } from './syncDetails';
import * as admin from 'firebase-admin';
import { getFixtures, getTeamSquad, getTeamInfo, getTeamCoach } from '../apiFootball';
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

// League tier for player popularity ranking (lower = more popular)
// Players on top-tier teams sort first in search results
export const LEAGUE_TIER: Record<string, number> = {
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
export function getLeagueTier(competitionCodes?: string[]): number {
  if (!competitionCodes || competitionCodes.length === 0) return DEFAULT_LEAGUE_TIER;
  let best = DEFAULT_LEAGUE_TIER;
  for (const code of competitionCodes) {
    const tier = LEAGUE_TIER[code];
    if (tier !== undefined && tier < best) best = tier;
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
export async function runBackfill(options: {
  leagueCode?: string;
  season?: number;
  includeDetails?: boolean;
}): Promise<{ leagues: number; matches: number; details: number }> {
  const { leagueCode, season, includeDetails } = options;

  const leagues = leagueCode
    ? SYNC_LEAGUES.filter((l) => l.code === leagueCode)
    : SYNC_LEAGUES;

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

  return { leagues: leagues.length, matches: totalMatches, details: totalDetails };
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
export async function buildTeamsFromMatches(): Promise<number> {
  const teamsMap = new Map<number, Record<string, any>>();

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

      // Extract home team
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

      // Extract away team
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
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
  }

  // Write teams to Firestore
  const teams = Array.from(teamsMap.values());
  for (let i = 0; i < teams.length; i += 450) {
    const chunk = teams.slice(i, i + 450);
    const batch = db.batch();
    for (const team of chunk) {
      batch.set(
        db.collection(COLLECTIONS.TEAMS).doc(String(team.id)),
        { ...team, syncedAt: admin.firestore.FieldValue.serverTimestamp() },
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
export async function buildPlayersAndEnrichTeams(): Promise<{ players: number; teams: number }> {
  const playersMap = new Map<number, Record<string, any>>();
  const teamCoaches = new Map<number, { id: number; name: string }>();

  // Determine current season — only use these matches for coach assignment
  const now = new Date();
  const month = now.getMonth() + 1;
  const currentSeason = month >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  console.log(`[buildPlayers] Current season: ${currentSeason}`);

  // Read all matchDetails in batches, collecting matchIds we need
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
    // Coaches as player docs — preserve formerPosition if they were a player
    if (d.homeCoach?.id) {
      const existing = playersMap.get(d.homeCoach.id);
      if (existing && existing.position && existing.position !== 'Coach') {
        existing.formerPosition = existing.position;
      }
      upsertPlayer(
        { id: d.homeCoach.id, name: d.homeCoach.name, position: 'Coach' },
        homeTeamId, homeTeamName, homeTeamCrest, competitionCode
      );
    }
    if (d.awayCoach?.id) {
      const existing = playersMap.get(d.awayCoach.id);
      if (existing && existing.position && existing.position !== 'Coach') {
        existing.formerPosition = existing.position;
      }
      upsertPlayer(
        { id: d.awayCoach.id, name: d.awayCoach.name, position: 'Coach' },
        awayTeamId, awayTeamName, awayTeamCrest, competitionCode
      );
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
      if (existingNameMap.has(player.id)) {
        // Player already enriched — only update currentTeam and position, not name fields
        const { name, nameLower, searchName, ...rest } = player;
        batch.set(ref, { ...rest, syncedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      } else {
        batch.set(ref, { ...player, syncedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
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
        if (teamData.venue?.city) {
          update.country = teamData.venue.city;
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
    const teamTier = getLeagueTier(teamData.competitionCodes);

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
    const teamTier = getLeagueTier(teamData.competitionCodes);

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
      if (compCodes.length > 0) {
        const activeCompetitions = compCodes
          .map((code: string) => {
            const league = SYNC_LEAGUES.find((l) => l.code === code);
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
