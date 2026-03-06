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
  startAfter,
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

function docToMatch(data: Record<string, any>, docId: string): Match {
  const home = data.homeTeam ?? { id: 0, name: 'Unknown', shortName: 'UNK', crest: '' };
  const away = data.awayTeam ?? { id: 0, name: 'Unknown', shortName: 'UNK', crest: '' };
  const ratingSum = data.ratingSum ?? 0;
  const ratingCount = data.ratingCount ?? 0;
  return {
    id: Number(docId),
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
    ratingSum,
    ratingCount,
    avgRating: ratingCount > 0 ? ratingSum / ratingCount : undefined,
    reviewCount: data.reviewCount ?? undefined,
    ratingBuckets: data.ratingBuckets ?? undefined,
    legacyId: data.legacyId ?? undefined,
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
    // Convert local day boundaries to UTC so matches are grouped by user's local date
    const localStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
    const localEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
    const startOfDay = localStart.toISOString();
    const endOfDay = localEnd.toISOString();

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
      .filter((d) => isValidMatch(d.data()))
      .map((d) => docToMatch(d.data(), d.id));
  } catch (err) {
    console.error('[getMatchesByDate] Firestore query failed:', err);
    return [];
  }
}

export async function getMatchesByDateRange(from: Date, to: Date): Promise<Match[]> {
  try {
    // Convert local day boundaries to UTC so matches are grouped by user's local date
    const fromStart = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 0, 0, 0);
    const toEnd = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59);
    const fromStr = fromStart.toISOString();
    const toStr = toEnd.toISOString();

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
      .filter((d) => isValidMatch(d.data()))
      .map((d) => docToMatch(d.data(), d.id));
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
    return docToMatch(snapshot.docs[0].data(), snapshot.docs[0].id);
  }
  return docToMatch(docSnap.data()!, docSnap.id);
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
      .filter((d) => isValidMatch(d.data()))
      .map((d) => docToMatch(d.data(), d.id));

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
      .filter((d) => isValidMatch(d.data()))
      .map((d) => docToMatch(d.data(), d.id));

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
  detail?: string; // "Normal Goal", "Own Goal", "Penalty", etc.
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

  const [homeLineup, homeBench, awayLineup, awayBench] = await Promise.all([
    enrichPlayerNames(data.homeLineup || []),
    enrichPlayerNames(data.homeBench || []),
    enrichPlayerNames(data.awayLineup || []),
    enrichPlayerNames(data.awayBench || []),
  ]);

  return {
    match,
    homeLineup,
    homeBench,
    awayLineup,
    awayBench,
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

// ─── Name enrichment helper ───
// Replaces abbreviated names (e.g. "E. Haaland") with full names from the players collection.
// Only fetches docs for players whose names look abbreviated to minimise reads.
async function enrichPlayerNames<T extends { id: number; name: string }>(players: T[]): Promise<T[]> {
  if (players.length === 0) return players;
  const toEnrich = players.filter((p) => /^[A-Z]\.\s/.test(p.name));
  if (toEnrich.length === 0) return players;

  const nameMap = new Map<number, string>();
  await Promise.all(
    toEnrich.map(async (p) => {
      try {
        const snap = await getDoc(doc(db, PLAYERS, String(p.id)));
        if (snap.exists()) {
          const data = snap.data() as { name?: string };
          if (data.name) nameMap.set(p.id, data.name);
        }
      } catch { /* ignore — use original name */ }
    })
  );

  return players.map((p) => {
    const enriched = nameMap.get(p.id);
    return enriched ? { ...p, name: enriched } : p;
  });
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
  const squad = await enrichPlayerNames(data.squad || []);

  return {
    id: data.id ?? teamId,
    name: data.name ?? 'Unknown Team',
    shortName: data.shortName || (data.name ? data.name.substring(0, 3).toUpperCase() : 'UNK'),
    crest: data.crest ?? '',
    venue: data.venue || null,
    founded: data.founded || null,
    clubColors: data.clubColors || null,
    coach: data.coach || null,
    squad,
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
      if (!isValidMatch(data)) continue; // Require season to exclude old football-data.org matches (conflicting team IDs)
      const match = docToMatch(data, d.id);
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
  photo: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  position: string | null;
  formerPosition: string | null;
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
      photo: null,
      dateOfBirth: null,
      nationality: null,
      position: null,
      formerPosition: null,
      shirtNumber: null,
      currentTeam: null,
    };
  }

  const data = docSnap.data();

  return {
    id: data.id ?? personId,
    name: data.name ?? 'Unknown Player',
    photo: data.photo || null,
    dateOfBirth: data.dateOfBirth || null,
    nationality: data.nationality || null,
    position: data.position || null,
    formerPosition: data.formerPosition || null,
    shirtNumber: null,
    currentTeam: data.currentTeam || null,
  };
}

// Person's appearance info for a given match
export interface PersonMatchAppearance {
  match: Match;
  role: 'starter' | 'sub' | 'coach';
  teamSide: 'home' | 'away';  // which side the person was on
  subbedIn?: number;  // minute subbed in (if bench player came on)
  goals: number;
  yellowCard: boolean;
  redCard: boolean;
}

// Fetch matches where a person appeared in the squad (lineup/bench/coach)
// Uses the playerIds array-contains index on matchDetails
export async function getMatchesForPerson(personId: number): Promise<PersonMatchAppearance[]> {
  try {
    // Query matchDetails where playerIds contains this person.
    // Sort by kickoff desc so we get the most recent 200 matches, not oldest 100.
    // Requires composite index: matchDetails playerIds(CONTAINS) + kickoff(DESC)
    const detailsSnap = await getDocs(query(
      collection(db, MATCH_DETAILS),
      where('playerIds', 'array-contains', personId),
      orderBy('kickoff', 'desc'),
      limit(200)
    ));

    if (detailsSnap.empty) return [];

    // Build role map from matchDetails docs
    const roleMap = new Map<number, { role: 'starter' | 'sub' | 'coach'; teamSide: 'home' | 'away'; subbedIn?: number; goals: number; yellowCard: boolean; redCard: boolean }>();
    for (const d of detailsSnap.docs) {
      const data = d.data();
      const matchId = data.matchId as number;
      if (!matchId) continue;

      let role: 'starter' | 'sub' | 'coach' = 'sub';
      let teamSide: 'home' | 'away' = 'home';
      let subbedIn: number | undefined;

      // Check starting XI (home then away separately to determine side)
      if ((data.homeLineup || []).some((p: any) => p?.id === personId)) {
        role = 'starter';
        teamSide = 'home';
      } else if ((data.awayLineup || []).some((p: any) => p?.id === personId)) {
        role = 'starter';
        teamSide = 'away';
      }
      // Check bench
      else if ((data.homeBench || []).some((p: any) => p?.id === personId)) {
        role = 'sub';
        teamSide = 'home';
        const subs = data.substitutions || [];
        const sub = subs.find((s: any) => s?.playerIn?.id === personId);
        if (sub) subbedIn = sub.minute;
      } else if ((data.awayBench || []).some((p: any) => p?.id === personId)) {
        role = 'sub';
        teamSide = 'away';
        const subs = data.substitutions || [];
        const sub = subs.find((s: any) => s?.playerIn?.id === personId);
        if (sub) subbedIn = sub.minute;
      }
      // Check coach
      else if (data.homeCoach?.id === personId) {
        role = 'coach';
        teamSide = 'home';
      } else if (data.awayCoach?.id === personId) {
        role = 'coach';
        teamSide = 'away';
      }

      // Count goals and cards
      let goals = 0;
      let yellowCard = false;
      let redCard = false;
      for (const g of (data.goals || [])) {
        if (g?.scorer?.id === personId) goals++;
      }
      for (const b of (data.bookings || [])) {
        if (b?.player?.id === personId) {
          if (b.card === 'YELLOW') yellowCard = true;
          if (b.card === 'RED' || b.card === 'YELLOW_RED') redCard = true;
        }
      }

      roleMap.set(matchId, { role, teamSide, subbedIn, goals, yellowCard, redCard });
    }

    // Fetch parent match docs
    const uniqueIds = [...roleMap.keys()];
    const matches: Match[] = [];
    for (let i = 0; i < uniqueIds.length; i += 30) {
      const batch = uniqueIds.slice(i, i + 30);
      const snap = await getDocs(query(
        collection(db, MATCHES),
        where('id', 'in', batch)
      ));
      for (const d of snap.docs) {
        const data = d.data();
        if (isValidMatch(data)) matches.push(docToMatch(data, d.id));
      }
    }

    // Sort by date descending and build appearances
    matches.sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());
    return matches.map((match) => {
      const info = roleMap.get(match.id) || { role: 'sub' as const, teamSide: 'home' as const, goals: 0, yellowCard: false, redCard: false };
      return { match, ...info };
    });
  } catch (err) {
    console.error('[getMatchesForPerson] query failed:', err);
    return [];
  }
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
  photo: string | null;
  position: string | null;
  currentTeam: { id: number; name: string; crest: string } | null;
  leagueTier: number;
}

export interface PlayerSearchPage {
  players: SearchablePlayer[];
  nextCursor: { leagueTier: number; docId: string } | null;
}

const PLAYER_PAGE_SIZE = 30;

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

// Search players using Firestore array-contains on searchPrefixes field.
// Paginated with orderBy('leagueTier') so top-tier players come first.
export async function searchPlayersQuery(
  queryStr: string,
  cursor?: { leagueTier: number; docId: string },
): Promise<PlayerSearchPage> {
  try {
    if (queryStr.length < 2) return { players: [], nextCursor: null };

    const lower = queryStr.trim().toLowerCase();
    const words = lower.split(/\s+/).filter((w) => w.length >= 2);
    if (words.length === 0) return { players: [], nextCursor: null };

    // Pick the longest word for array-contains (most selective)
    const queryWord = words.reduce((a, b) => (a.length >= b.length ? a : b));

    // Fetch more than page size to account for client-side filtering
    const fetchLimit = PLAYER_PAGE_SIZE * 3;

    const constraints = [
      collection(db, PLAYERS),
      where('searchPrefixes', 'array-contains', queryWord),
      orderBy('leagueTier'),
      orderBy('__name__'),
      ...(cursor ? [startAfter(cursor.leagueTier, cursor.docId)] : []),
      limit(fetchLimit),
    ] as Parameters<typeof query>;

    const snap = await getDocs(query(...constraints));

    const results: SearchablePlayer[] = [];
    let lastDoc: { leagueTier: number; docId: string } | null = null;

    for (const d of snap.docs) {
      const p = d.data() as Record<string, any>;
      if (!p.id || !p.name) continue;

      lastDoc = { leagueTier: p.leagueTier ?? 6, docId: d.id };

      // Client-side: ensure ALL search words appear as prefixes of name words
      const nameWords = (p.name as string).toLowerCase().split(/\s+/);
      const allMatch = words.every((sw) =>
        nameWords.some((nw) => nw.startsWith(sw))
      );
      if (!allMatch) continue;

      results.push({
        id: p.id,
        name: p.name,
        photo: p.photo ?? null,
        position: p.position || null,
        currentTeam: p.currentTeam || null,
        leagueTier: p.leagueTier ?? 6,
      });
    }

    // Secondary sort by name within same tier
    results.sort((a, b) => a.leagueTier - b.leagueTier || a.name.localeCompare(b.name));

    const page = results.slice(0, PLAYER_PAGE_SIZE);
    const hasMore = snap.docs.length === fetchLimit;
    const nextCursor = hasMore && lastDoc ? lastDoc : null;

    return { players: page, nextCursor };
  } catch (err) {
    console.error('[searchPlayersQuery] Firestore query failed:', err);
    return { players: [], nextCursor: null };
  }
}

// ─── Browse all finished matches — paginated, newest first ───

const BROWSE_PAGE_SIZE = 30;

export async function getAllMatchesPaginated(
  cursor?: string,
): Promise<MatchSearchPage> {
  try {
    const constraints = [
      where('status', '==', 'FINISHED'),
      orderBy('kickoff', 'desc'),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(BROWSE_PAGE_SIZE),
    ];

    const snapshot = await getDocs(query(collection(db, MATCHES), ...constraints));
    const matches = snapshot.docs
      .filter((d) => isValidMatch(d.data()))
      .map((d) => docToMatch(d.data(), d.id));

    const lastDoc = snapshot.docs[snapshot.docs.length - 1];
    const nextCursor = snapshot.docs.length < BROWSE_PAGE_SIZE
      ? null
      : (lastDoc?.data().kickoff as string) ?? null;

    return { matches, nextCursor };
  } catch (err) {
    console.error('[getAllMatchesPaginated] Firestore query failed:', err);
    return { matches: [], nextCursor: null };
  }
}

// Search matches by team name — paginated, no cap
export interface MatchSearchPage {
  matches: Match[];
  nextCursor: string | null;
}

const MATCH_PAGE_SIZE = 100;

export async function searchMatchesQuery(
  queryStr: string,
  cursor?: string,
): Promise<MatchSearchPage> {
  try {
    if (queryStr.length < 2) return { matches: [], nextCursor: null };

    const allTeams = await getCachedTeams();

    // Split query into individual search terms (by space, comma, or dash)
    const terms = queryStr.toLowerCase().split(/[\s,\-]+/).filter((t) => t.length >= 2);
    if (terms.length === 0) return { matches: [], nextCursor: null };

    // For each term, find matching team IDs
    const teamIdSets: Set<number>[] = [];
    const allMatchingIds = new Set<number>();

    for (const term of terms) {
      const ids = new Set<number>();
      for (const t of allTeams) {
        if (t.name.toLowerCase().includes(term) || t.shortName.toLowerCase().includes(term)) {
          ids.add(t.id);
          allMatchingIds.add(t.id);
        }
      }
      teamIdSets.push(ids);
    }

    // Cap at 30 teams (Firestore 'in' operator limit)
    const teamIdsToQuery = [...allMatchingIds].slice(0, 30);
    if (teamIdsToQuery.length === 0) return { matches: [], nextCursor: null };

    // On first page, fetch head-to-head matches — only for multi-term searches
    // where different terms match different teams (e.g., "manchester city liverpool")
    const h2hMatches: Match[] = [];
    const h2hIds = new Set<string>();

    if (!cursor && teamIdSets.length >= 2) {
      // Cross-pair: pick top team from each term, pair across terms
      const pairQueries: ReturnType<typeof query>[] = [];
      const pairs: [number, number][] = [];

      for (let i = 0; i < teamIdSets.length && pairs.length < 4; i++) {
        for (let j = i + 1; j < teamIdSets.length && pairs.length < 4; j++) {
          // Pick top team per term (shortest name = most popular)
          const pickBest = (ids: Set<number>) => [...ids]
            .map((id) => allTeams.find((t) => t.id === id)!)
            .filter(Boolean)
            .sort((a, b) => a.name.length - b.name.length)[0];
          const a = pickBest(teamIdSets[i]);
          const b = pickBest(teamIdSets[j]);
          if (a && b && a.id !== b.id) pairs.push([a.id, b.id]);
        }
      }

      for (const [a, b] of pairs) {
        pairQueries.push(
          query(collection(db, MATCHES), where('homeTeam.id', '==', a), where('awayTeam.id', '==', b), orderBy('kickoff', 'desc'))
        );
        pairQueries.push(
          query(collection(db, MATCHES), where('homeTeam.id', '==', b), where('awayTeam.id', '==', a), orderBy('kickoff', 'desc'))
        );
      }

      if (pairQueries.length > 0) {
        const h2hSnaps = await Promise.all(pairQueries.map((q) => getDocs(q)));
        for (const snap of h2hSnaps) {
          for (const d of snap.docs) {
            if (h2hIds.has(d.id)) continue;
            h2hIds.add(d.id);
            const data = d.data() as Record<string, any>;
            if (isValidMatch(data)) {
              h2hMatches.push(docToMatch(data, d.id));
            }
          }
        }
        h2hMatches.sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());
      }
    }

    // Build paginated queries for home/away
    const homeQ = cursor
      ? query(collection(db, MATCHES), where('homeTeam.id', 'in', teamIdsToQuery), orderBy('kickoff', 'desc'), startAfter(cursor), limit(MATCH_PAGE_SIZE))
      : query(collection(db, MATCHES), where('homeTeam.id', 'in', teamIdsToQuery), orderBy('kickoff', 'desc'), limit(MATCH_PAGE_SIZE));
    const awayQ = cursor
      ? query(collection(db, MATCHES), where('awayTeam.id', 'in', teamIdsToQuery), orderBy('kickoff', 'desc'), startAfter(cursor), limit(MATCH_PAGE_SIZE))
      : query(collection(db, MATCHES), where('awayTeam.id', 'in', teamIdsToQuery), orderBy('kickoff', 'desc'), limit(MATCH_PAGE_SIZE));

    const snapshots = await Promise.all([getDocs(homeQ), getDocs(awayQ)]);

    // Track the oldest kickoff from raw results for the next cursor
    let oldestKickoff: string | null = null;
    const seen = new Set<string>();
    const allMatches: Match[] = [];

    for (const snap of snapshots) {
      for (const d of snap.docs) {
        const data = d.data();
        const kickoff = data.kickoff as string;
        if (!oldestKickoff || kickoff < oldestKickoff) oldestKickoff = kickoff;

        if (seen.has(d.id) || h2hIds.has(d.id)) continue;
        seen.add(d.id);
        if (isValidMatch(data)) {
          allMatches.push(docToMatch(data, d.id));
        }
      }
    }

    // Score each match by how many search terms it matches (via its teams)
    const matchScores = new Map<number, number>();
    for (const m of allMatches) {
      let score = 0;
      for (const termIds of teamIdSets) {
        if (termIds.has(m.homeTeam.id) || termIds.has(m.awayTeam.id)) score++;
      }
      matchScores.set(m.id, score);
    }

    // Sort: most matched terms first, then finished/live before upcoming, then by date
    allMatches.sort((a, b) => {
      const scoreA = matchScores.get(a.id) || 0;
      const scoreB = matchScores.get(b.id) || 0;
      if (scoreA !== scoreB) return scoreB - scoreA;
      const aLocked = a.status !== 'FINISHED' && a.status !== 'IN_PLAY' && a.status !== 'PAUSED';
      const bLocked = b.status !== 'FINISHED' && b.status !== 'IN_PLAY' && b.status !== 'PAUSED';
      if (aLocked !== bLocked) return aLocked ? 1 : -1;
      return new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime();
    });

    // Prepend head-to-head matches on first page
    const finalMatches = h2hMatches.length > 0 ? [...h2hMatches, ...allMatches] : allMatches;

    // Determine if there are more pages
    const hasMore = snapshots.some((s) => s.docs.length === MATCH_PAGE_SIZE);
    const nextCursor = hasMore && oldestKickoff ? oldestKickoff : null;

    return { matches: finalMatches, nextCursor };
  } catch (err) {
    console.error('[searchMatchesQuery] Firestore query failed:', err);
    return { matches: [], nextCursor: null };
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
  // Sort each group so most recent matches appear first (left in horizontal carousels)
  for (const [key, group] of groups) {
    groups.set(key, group.sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime()));
  }
  return groups;
}
