/**
 * Football data service — reads all match/team/player data from Firestore.
 *
 * Data is synced into Firestore by Cloud Functions (see functions/src/).
 * This file replaces the old football-data.org API calls with Firestore reads.
 * All exported function signatures and types are preserved for backward compatibility.
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Match, Coach } from '../types/match';

// ─── Collection names (must match functions/src/config.ts) ───

const MATCHES = 'matches';
const MATCH_DETAILS = 'matchDetails';
const STANDINGS = 'standings';
const TEAMS = 'teams';
const PLAYERS = 'players';

// ─── In-memory team cache for fast search ───
let cachedTeams: { id: number; name: string; shortName: string }[] | null = null;
let cachedTeamsTimestamp = 0;
const TEAM_CACHE_TTL = 30 * 60 * 1000; // 30 minutes

async function getCachedTeams(): Promise<{ id: number; name: string; shortName: string }[]> {
  if (cachedTeams && Date.now() - cachedTeamsTimestamp < TEAM_CACHE_TTL) {
    return cachedTeams;
  }
  const teamsSnap = await getDocs(collection(db, TEAMS));
  cachedTeams = teamsSnap.docs.map((d) => {
    const t = d.data();
    return { id: t.id, name: t.name || '', shortName: t.shortName || '' };
  });
  cachedTeamsTimestamp = Date.now();
  return cachedTeams;
}

// ─── Helpers ───

// Strip common club designators to make a readable short name
function cleanShortName(name: string, shortName?: string): string {
  // If the shortName is already a good readable name (not a 3-letter code), use it
  if (shortName && shortName.length > 3) return shortName;
  // Otherwise derive from the full name
  const stripped = name
    .replace(/\b(FC|CF|AC|SC|SS|AS|US|RC|CD|UD|SD|SL|SK|IF|BK|FK|NK|GNK|TSG|VfB|VfL|1\.\s*FC|1\.\s*FSV|BSC|KRC|SV|SpVgg)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped || name;
}

function docToMatch(data: Record<string, any>): Match {
  const home = data.homeTeam ?? { id: 0, name: 'Unknown', shortName: 'UNK', crest: '' };
  const away = data.awayTeam ?? { id: 0, name: 'Unknown', shortName: 'UNK', crest: '' };
  return {
    id: data.id,
    competition: data.competition ?? { id: 0, name: 'Unknown', code: '', emblem: '' },
    homeTeam: { ...home, shortName: cleanShortName(home.name, home.shortName) },
    awayTeam: { ...away, shortName: cleanShortName(away.name, away.shortName) },
    homeScore: data.homeScore ?? null,
    awayScore: data.awayScore ?? null,
    status: data.status ?? 'SCHEDULED',
    kickoff: data.kickoff ?? new Date().toISOString(),
    venue: data.venue ?? null,
    matchday: data.matchday ?? null,
    stage: data.stage ?? null,
  };
}

function isValidMatch(data: Record<string, any>): boolean {
  return (
    data.id != null &&
    data.competition?.id != null &&
    data.homeTeam?.id != null &&
    data.awayTeam?.id != null &&
    data.kickoff != null &&
    data.season != null // Only include API-Football data (excludes old football-data.org matches)
  );
}

// ─── Match queries ───

export async function getMatchesByDate(date: Date): Promise<Match[]> {
  try {
    // Use local date parts (not toISOString which converts to UTC and shifts the day)
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const startOfDay = `${dateStr}T00:00:00Z`;
    const endOfDay = `${dateStr}T23:59:59Z`;

    // Use season filter to skip old football-data.org docs & orderBy for index use
    const month = date.getMonth() + 1;
    const season = month >= 7 ? date.getFullYear() : date.getFullYear() - 1;

    const q = query(
      collection(db, MATCHES),
      where('season', '==', season),
      where('kickoff', '>=', startOfDay),
      where('kickoff', '<=', endOfDay),
      orderBy('kickoff', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((d) => d.data())
      .filter(isValidMatch)
      .map(docToMatch);
  } catch (err) {
    console.error('[getMatchesByDate] Firestore query failed:', err);
    return [];
  }
}

export async function getMatchesByDateRange(from: Date, to: Date): Promise<Match[]> {
  try {
    const fromDate = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
    const toDate = `${to.getFullYear()}-${String(to.getMonth() + 1).padStart(2, '0')}-${String(to.getDate()).padStart(2, '0')}`;
    const fromStr = `${fromDate}T00:00:00Z`;
    const toStr = `${toDate}T23:59:59Z`;

    const month = from.getMonth() + 1;
    const season = month >= 7 ? from.getFullYear() : from.getFullYear() - 1;

    const q = query(
      collection(db, MATCHES),
      where('season', '==', season),
      where('kickoff', '>=', fromStr),
      where('kickoff', '<=', toStr),
      orderBy('kickoff', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((d) => d.data())
      .filter(isValidMatch)
      .map(docToMatch);
  } catch (err) {
    console.error('[getMatchesByDateRange] Firestore query failed:', err);
    return [];
  }
}

export async function getMatchById(id: number): Promise<Match> {
  const docSnap = await getDoc(doc(db, MATCHES, String(id)));
  if (!docSnap.exists()) {
    // Try legacy ID lookup (for matches referenced by old football-data.org IDs)
    const q = query(
      collection(db, MATCHES),
      where('legacyId', '==', id),
      limit(1)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      throw new Error(`Match ${id} not found`);
    }
    return docToMatch(snapshot.docs[0].data());
  }
  return docToMatch(docSnap.data());
}

// ─── Competition queries ───

export interface Standing {
  position: number;
  team: { id: number; name: string; shortName: string; crest: string };
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export async function getCompetitionStandings(competitionCode: string): Promise<Standing[]> {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const season = month >= 7 ? year : year - 1;

    const docSnap = await getDoc(doc(db, STANDINGS, `${competitionCode}_${season}`));
    if (!docSnap.exists()) return [];

    const data = docSnap.data();
    return ((data.table || []) as Standing[]).map((s) => ({
      ...s,
      team: {
        ...s.team,
        shortName: cleanShortName(s.team.name, s.team.shortName),
      },
    }));
  } catch (err) {
    console.error('[getCompetitionStandings] Firestore query failed:', err);
    return [];
  }
}

export async function getCompetitionMatches(
  competitionId: number,
  matchday?: number
): Promise<Match[]> {
  try {
    const q = query(
      collection(db, MATCHES),
      where('competition.id', '==', competitionId)
    );

    const snapshot = await getDocs(q);
    let matches = snapshot.docs
      .map((d) => d.data())
      .filter(isValidMatch)
      .map(docToMatch);

    if (matchday) {
      matches = matches.filter((m) => m.matchday === matchday);
    }

    return matches;
  } catch (err) {
    console.error('[getCompetitionMatches] Firestore query failed:', err);
    return [];
  }
}

export async function getCompetitionMatchesByCode(
  competitionCode: string,
  matchday?: number
): Promise<Match[]> {
  try {
    // Determine current season to avoid fetching all historical data
    const now = new Date();
    const month = now.getMonth() + 1;
    const season = month >= 7 ? now.getFullYear() : now.getFullYear() - 1;

    const q = query(
      collection(db, MATCHES),
      where('competition.code', '==', competitionCode),
      where('season', '==', season),
      orderBy('kickoff', 'asc')
    );

    const snapshot = await getDocs(q);
    let matches = snapshot.docs
      .map((d) => d.data())
      .filter(isValidMatch)
      .map(docToMatch);

    if (matchday) {
      matches = matches.filter((m) => m.matchday === matchday);
    }

    return matches;
  } catch (err) {
    console.error('[getCompetitionMatchesByCode] Firestore query failed:', err);
    return [];
  }
}

// ─── Match Detail ───

export interface MatchPlayer {
  id: number;
  name: string;
  position: string | null;
  shirtNumber: number | null;
}

export interface MatchGoal {
  minute: number;
  team: { id: number };
  scorer: { id: number; name: string };
  assist: { id: number; name: string } | null;
}

export interface MatchStats {
  ballPossession: [number, number];
  shots: [number, number];
  shotsOnTarget: [number, number];
  corners: [number, number];
  fouls: [number, number];
  offsides: [number, number];
  yellowCards: [number, number];
  redCards: [number, number];
  saves: [number, number];
}

export interface MatchBooking {
  minute: number;
  team: { id: number };
  player: { id: number; name: string };
  card: 'YELLOW' | 'RED' | 'YELLOW_RED';
}

export interface MatchSubstitution {
  minute: number;
  team: { id: number };
  playerOut: { id: number; name: string };
  playerIn: { id: number; name: string };
}

export interface MatchDetail {
  match: Match;
  homeLineup: MatchPlayer[];
  homeBench: MatchPlayer[];
  awayLineup: MatchPlayer[];
  awayBench: MatchPlayer[];
  homeCoach: Coach | null;
  awayCoach: Coach | null;
  homeFormation: string | null;
  awayFormation: string | null;
  goals: MatchGoal[];
  referee: string | null;
  stats: MatchStats | null;
  bookings: MatchBooking[];
  substitutions: MatchSubstitution[];
  halfTimeScore: { home: number | null; away: number | null } | null;
  attendance: number | null;
}

export async function getMatchDetail(id: number): Promise<MatchDetail> {
  const match = await getMatchById(id);

  // Use match.id (which may differ from `id` if legacy ID was used)
  const detailSnap = await getDoc(doc(db, MATCH_DETAILS, String(match.id)));

  if (!detailSnap.exists()) {
    // Return match with empty details if not synced yet
    return {
      match,
      homeLineup: [],
      homeBench: [],
      awayLineup: [],
      awayBench: [],
      homeCoach: null,
      awayCoach: null,
      homeFormation: null,
      awayFormation: null,
      goals: [],
      referee: null,
      stats: null,
      bookings: [],
      substitutions: [],
      halfTimeScore: null,
      attendance: null,
    };
  }

  const data = detailSnap.data();

  return {
    match,
    homeLineup: data.homeLineup || [],
    homeBench: data.homeBench || [],
    awayLineup: data.awayLineup || [],
    awayBench: data.awayBench || [],
    homeCoach: data.homeCoach || null,
    awayCoach: data.awayCoach || null,
    homeFormation: data.homeFormation || null,
    awayFormation: data.awayFormation || null,
    goals: data.goals || [],
    referee: data.referee || null,
    stats: data.stats || null,
    bookings: data.bookings || [],
    substitutions: data.substitutions || [],
    halfTimeScore: data.halfTimeScore || null,
    attendance: data.attendance || null,
  };
}

// ─── Team & Person Detail ───

export interface TeamDetail {
  id: number;
  name: string;
  shortName: string;
  crest: string;
  venue: string | null;
  founded: number | null;
  clubColors: string | null;
  coach: Coach | null;
  squad: { id: number; name: string; position: string; nationality: string }[];
  activeCompetitions: { id: number; name: string; code: string; emblem: string }[];
}

export async function getTeamDetail(teamId: number): Promise<TeamDetail> {
  const docSnap = await getDoc(doc(db, TEAMS, String(teamId)));

  if (!docSnap.exists()) {
    // Return a placeholder instead of throwing to prevent crashes
    return {
      id: teamId,
      name: 'Unknown Team',
      shortName: 'UNK',
      crest: '',
      venue: null,
      founded: null,
      clubColors: null,
      coach: null,
      squad: [],
      activeCompetitions: [],
    };
  }

  const data = docSnap.data();

  return {
    id: data.id ?? teamId,
    name: data.name ?? 'Unknown Team',
    shortName: data.shortName || (data.name ? data.name.substring(0, 3).toUpperCase() : 'UNK'),
    crest: data.crest ?? '',
    venue: data.venue || null,
    founded: data.founded || null,
    clubColors: null,
    coach: null,
    squad: data.squad || [],
    activeCompetitions: data.activeCompetitions || [],
  };
}

export async function getTeamMatches(teamId: number, status?: string): Promise<Match[]> {
  try {
    // Firestore doesn't support OR queries across different fields,
    // so we run two queries and merge results
    const homeQ = query(
      collection(db, MATCHES),
      where('homeTeam.id', '==', teamId)
    );
    const awayQ = query(
      collection(db, MATCHES),
      where('awayTeam.id', '==', teamId)
    );

    const [homeSnap, awaySnap] = await Promise.all([
      getDocs(homeQ),
      getDocs(awayQ),
    ]);

    const matchMap = new Map<number, Match>();

    for (const d of [...homeSnap.docs, ...awaySnap.docs]) {
      const data = d.data();
      if (!isValidMatch(data)) continue;
      const match = docToMatch(data);
      if (status && match.status !== status) continue;
      matchMap.set(match.id, match);
    }

    return Array.from(matchMap.values()).sort(
      (a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime()
    );
  } catch (err) {
    console.error('[getTeamMatches] Firestore query failed:', err);
    return [];
  }
}

export interface PersonDetail {
  id: number;
  name: string;
  dateOfBirth: string | null;
  nationality: string | null;
  position: string | null;
  shirtNumber: number | null;
  currentTeam: { id: number; name: string; crest: string } | null;
}

export async function getPersonDetail(personId: number): Promise<PersonDetail> {
  const docSnap = await getDoc(doc(db, PLAYERS, String(personId)));

  if (!docSnap.exists()) {
    // Return a placeholder instead of throwing to prevent crashes
    return {
      id: personId,
      name: 'Unknown Player',
      dateOfBirth: null,
      nationality: null,
      position: null,
      shirtNumber: null,
      currentTeam: null,
    };
  }

  const data = docSnap.data();

  return {
    id: data.id ?? personId,
    name: data.name ?? 'Unknown Player',
    dateOfBirth: data.dateOfBirth || null,
    nationality: data.nationality || null,
    position: data.position || null,
    shirtNumber: null,
    currentTeam: data.currentTeam || null,
  };
}

// ─── Search ───

export interface SearchableTeam {
  id: number;
  name: string;
  shortName: string;
  crest: string;
  country: string;
  competitionCodes: string[];
}

export interface SearchablePlayer {
  id: number;
  name: string;
  position: string | null;
  currentTeam: { id: number; name: string; crest: string } | null;
}

// Fetch all teams once — cached by React Query, filtered client-side
export async function getAllTeams(): Promise<SearchableTeam[]> {
  try {
    const snapshot = await getDocs(collection(db, TEAMS));
    return snapshot.docs
      .map((d) => d.data())
      .filter((t) => t.id && t.name)
      .map((t) => ({
        id: t.id,
        name: t.name,
        shortName: t.shortName || '',
        crest: t.crest || '',
        country: t.country || '',
        competitionCodes: t.competitionCodes || [],
      }));
  } catch (err) {
    console.error('[getAllTeams] Firestore query failed:', err);
    return [];
  }
}

// Search players using Firestore prefix queries on both name and nameLower fields.
// Also searches by last-name prefix to handle "L. Messi" format names.
export async function searchPlayersQuery(queryStr: string): Promise<SearchablePlayer[]> {
  try {
    if (queryStr.length < 2) return [];

    const lower = queryStr.trim().toLowerCase();

    const seen = new Set<number>();
    const results: SearchablePlayer[] = [];

    const addResult = (p: Record<string, any>) => {
      if (p.id && p.name && !seen.has(p.id)) {
        seen.add(p.id);
        results.push({
          id: p.id,
          name: p.name,
          position: p.position || null,
          currentTeam: p.currentTeam || null,
        });
      }
    };

    // Two parallel queries: nameLower prefix + searchName (last name) prefix
    const snapshots = await Promise.all([
      getDocs(query(
        collection(db, PLAYERS),
        where('nameLower', '>=', lower),
        where('nameLower', '<=', lower + '\uf8ff'),
        limit(30)
      )),
      getDocs(query(
        collection(db, PLAYERS),
        where('searchName', '>=', lower),
        where('searchName', '<=', lower + '\uf8ff'),
        limit(30)
      )),
    ]);
    for (const snap of snapshots) {
      for (const d of snap.docs) {
        addResult(d.data());
      }
    }

    return results.slice(0, 50);
  } catch (err) {
    console.error('[searchPlayersQuery] Firestore query failed:', err);
    return [];
  }
}

// Search matches by team name — searches current season
export async function searchMatchesQuery(queryStr: string): Promise<Match[]> {
  try {
    if (queryStr.length < 2) return [];

    // Step 1: Find matching teams from cached teams (fast in-memory lookup)
    const allTeams = await getCachedTeams();
    const qLower = queryStr.toLowerCase();
    const matchingTeamIds: number[] = [];

    for (const t of allTeams) {
      if (
        t.name.toLowerCase().includes(qLower) ||
        t.shortName.toLowerCase().includes(qLower)
      ) {
        matchingTeamIds.push(t.id);
      }
    }

    // Cap at 30 teams (Firestore 'in' operator limit)
    const teamIdsToQuery = matchingTeamIds.slice(0, 30);

    if (teamIdsToQuery.length === 0) return [];

    // Step 2: Use 'in' queries — just 2 queries instead of 2 per team
    const snapshots = await Promise.all([
      getDocs(query(
        collection(db, MATCHES),
        where('homeTeam.id', 'in', teamIdsToQuery),
        orderBy('kickoff', 'desc'),
        limit(50)
      )),
      getDocs(query(
        collection(db, MATCHES),
        where('awayTeam.id', 'in', teamIdsToQuery),
        orderBy('kickoff', 'desc'),
        limit(50)
      )),
    ]);

    // Step 3: Deduplicate and build match list
    const seen = new Set<string>();
    const allMatches: Match[] = [];
    for (const snap of snapshots) {
      for (const d of snap.docs) {
        if (seen.has(d.id)) continue;
        seen.add(d.id);
        const data = d.data();
        if (isValidMatch(data)) {
          allMatches.push(docToMatch(data));
        }
      }
    }

    // Sort: finished/live first, upcoming (locked) last; most recent first within each group
    allMatches.sort((a, b) => {
      const aLocked = a.status !== 'FINISHED' && a.status !== 'IN_PLAY' && a.status !== 'PAUSED';
      const bLocked = b.status !== 'FINISHED' && b.status !== 'IN_PLAY' && b.status !== 'PAUSED';
      if (aLocked !== bLocked) return aLocked ? 1 : -1;
      return new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime();
    });

    return allMatches;
  } catch (err) {
    console.error('[searchMatchesQuery] Firestore query failed:', err);
    return [];
  }
}

// ─── Utility ───

export function groupMatchesByCompetition(matches: Match[]): Map<string, Match[]> {
  const groups = new Map<string, Match[]>();
  for (const match of matches) {
    // Group by competition code to avoid duplicate sections
    // (e.g., "Champions League" vs "UEFA Champions League" from different data sources)
    const key = match.competition.code || match.competition.name;
    const existing = groups.get(key) || [];
    existing.push(match);
    groups.set(key, existing);
  }
  return groups;
}
