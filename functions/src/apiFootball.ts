import axios, { AxiosInstance } from 'axios';
import { API_FOOTBALL_BASE, API_FOOTBALL_KEY, RATE_LIMIT_DELAY_MS } from './config';

// API-Football HTTP client with built-in rate limiting
let lastRequestTime = 0;

const client: AxiosInstance = axios.create({
  baseURL: API_FOOTBALL_BASE,
  timeout: 30000,
  headers: {
    'x-apisports-key': API_FOOTBALL_KEY,
  },
});

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < RATE_LIMIT_DELAY_MS) {
    await new Promise((r) => setTimeout(r, RATE_LIMIT_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

// Raw API-Football response types
export interface ApiFixture {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string; // ISO string
    timestamp: number;
    venue: {
      id: number | null;
      name: string | null;
      city: string | null;
    };
    status: {
      long: string;
      short: string; // FT, NS, 1H, 2H, HT, PST, CANC, etc.
      elapsed: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo: string;
    flag: string | null;
    season: number;
    round: string; // "Regular Season - 15", "Round of 16", etc.
  };
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null };
    away: { id: number; name: string; logo: string; winner: boolean | null };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
}

export interface ApiFixtureEvent {
  time: { elapsed: number; extra: number | null };
  team: { id: number; name: string; logo: string };
  player: { id: number; name: string };
  assist: { id: number | null; name: string | null };
  type: string; // "Goal", "Card", "subst", "Var"
  detail: string; // "Normal Goal", "Yellow Card", "Substitution 1", etc.
  comments: string | null;
}

export interface ApiFixtureLineup {
  team: { id: number; name: string; logo: string };
  coach: { id: number; name: string; photo: string };
  formation: string;
  startXI: Array<{
    player: { id: number; name: string; number: number; pos: string };
  }>;
  substitutes: Array<{
    player: { id: number; name: string; number: number; pos: string };
  }>;
}

export interface ApiFixtureStats {
  team: { id: number; name: string; logo: string };
  statistics: Array<{
    type: string; // "Shots on Goal", "Ball Possession", etc.
    value: number | string | null;
  }>;
}

export interface ApiStanding {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  goalsDiff: number;
  group: string;
  form: string | null;
  status: string;
  description: string | null;
  all: {
    played: number;
    win: number;
    draw: number;
    lose: number;
    goals: { for: number; against: number };
  };
}

export interface ApiPlayer {
  player: {
    id: number;
    name: string;
    firstname: string;
    lastname: string;
    age: number | null;
    birth: { date: string | null; place: string | null; country: string | null };
    nationality: string | null;
    height: string | null;
    weight: string | null;
    photo: string;
  };
  statistics: Array<{
    team: { id: number; name: string; logo: string };
    league: { id: number; name: string; country: string; logo: string; season: number };
    games: { position: string | null; appearences: number | null };
  }>;
}

// ─── API Methods ───

export async function getFixtures(params: {
  league?: number;
  season?: number;
  date?: string; // YYYY-MM-DD
  from?: string;
  to?: string;
  live?: string; // "all"
  ids?: string; // comma-separated fixture IDs
  status?: string;
  timezone?: string; // e.g. "UTC"
}): Promise<ApiFixture[]> {
  await rateLimit();
  const response = await client.get('/fixtures', { params });
  return response.data.response || [];
}

export async function getFixtureById(fixtureId: number): Promise<ApiFixture | null> {
  await rateLimit();
  const response = await client.get('/fixtures', { params: { id: fixtureId } });
  const fixtures = response.data.response || [];
  return fixtures[0] || null;
}

export async function getFixtureEvents(fixtureId: number): Promise<ApiFixtureEvent[]> {
  await rateLimit();
  const response = await client.get('/fixtures/events', { params: { fixture: fixtureId } });
  return response.data.response || [];
}

export async function getFixtureLineups(fixtureId: number): Promise<ApiFixtureLineup[]> {
  await rateLimit();
  const response = await client.get('/fixtures/lineups', { params: { fixture: fixtureId } });
  return response.data.response || [];
}

export async function getFixtureStats(fixtureId: number): Promise<ApiFixtureStats[]> {
  await rateLimit();
  const response = await client.get('/fixtures/statistics', { params: { fixture: fixtureId } });
  return response.data.response || [];
}

export async function getStandings(leagueId: number, season: number): Promise<ApiStanding[][]> {
  await rateLimit();
  const response = await client.get('/standings', { params: { league: leagueId, season } });
  const standings = response.data.response || [];
  if (standings.length === 0) return [];
  // Returns array of groups (each group is an array of standings)
  return (standings[0].league?.standings || []) as ApiStanding[][];
}

export async function getPlayerById(playerId: number, season?: number): Promise<ApiPlayer | null> {
  await rateLimit();
  const params: Record<string, any> = { id: playerId };
  if (season) params.season = season;
  const response = await client.get('/players', { params });
  const players = response.data.response || [];
  return players[0] || null;
}

export async function getLiveFixtures(): Promise<ApiFixture[]> {
  await rateLimit();
  const response = await client.get('/fixtures', { params: { live: 'all' } });
  return response.data.response || [];
}

// ─── Squad ───

export interface ApiSquadPlayer {
  id: number;
  name: string;
  age: number | null;
  number: number | null;
  position: string; // "Goalkeeper", "Defender", "Midfielder", "Attacker"
  photo: string;
}

export interface ApiSquadResponse {
  team: { id: number; name: string; logo: string };
  players: ApiSquadPlayer[];
}

export async function getTeamSquad(teamId: number): Promise<ApiSquadResponse | null> {
  await rateLimit();
  const response = await client.get('/players/squads', { params: { team: teamId } });
  const squads = response.data.response || [];
  return squads[0] || null;
}

// ─── Team Info ───

export interface ApiTeamInfo {
  team: {
    id: number;
    name: string;
    country?: string;
    logo: string;
    founded: number | null;
    colors?: {
      player?: { primary?: string; number?: string };
      goalkeeper?: { primary?: string; number?: string };
    };
  };
  venue: {
    id: number | null;
    name: string | null;
    city: string | null;
    capacity: number | null;
  };
}

export async function getTeamInfo(teamId: number): Promise<ApiTeamInfo | null> {
  await rateLimit();
  const response = await client.get('/teams', { params: { id: teamId } });
  const teams = response.data.response || [];
  return teams[0] || null;
}

// ─── Coach ───

export interface ApiCoach {
  id: number;
  name: string;
  firstname: string;
  lastname: string;
  nationality: string | null;
  photo: string;
  birth: { date: string | null; place: string | null; country: string | null };
  career: Array<{
    team: { id: number; name: string; logo: string };
    start: string | null;
    end: string | null;
  }>;
}

export interface ApiLeagueInfo {
  league: { id: number; name: string; type: string; logo: string };
  country: { name: string; code: string | null; flag: string | null };
  seasons: { year: number; start: string; end: string; current: boolean }[];
}

export async function getLeagueInfo(leagueId: number): Promise<ApiLeagueInfo | null> {
  await rateLimit();
  const response = await client.get('/leagues', { params: { id: leagueId } });
  const data: ApiLeagueInfo[] = response.data.response || [];
  return data.length > 0 ? data[0] : null;
}

export async function getTeamCoach(teamId: number): Promise<ApiCoach | null> {
  await rateLimit();
  const response = await client.get('/coachs', { params: { team: teamId } });
  const coaches: ApiCoach[] = response.data.response || [];
  if (coaches.length === 0) return null;

  // Find the coach whose career has this team with no end date (= current)
  for (const coach of coaches) {
    const current = (coach.career || []).find(
      (c) => c.team?.id === teamId && !c.end
    );
    if (current) return coach;
  }
  // Fallback: return the last coach entry
  return coaches[coaches.length - 1];
}
