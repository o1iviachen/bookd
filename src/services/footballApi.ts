import { addDays } from 'date-fns';
import { footballApi } from '../config/api';
import { Match, Competition, Team, Coach } from '../types/match';
import { toApiDateString } from '../utils/formatDate';

interface ApiMatch {
  id: number;
  competition: {
    id: number;
    name: string;
    emblem: string;
    code: string;
  };
  homeTeam: {
    id: number;
    name: string;
    shortName: string;
    crest: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName: string;
    crest: string;
  };
  score: {
    fullTime: { home: number | null; away: number | null };
  };
  status: string;
  utcDate: string;
  venue: string | null;
  matchday: number | null;
  stage: string | null;
}

// Normalise API competition names to the common names we use everywhere.
const COMPETITION_NAME_MAP: Record<string, string> = {
  'Primera Division': 'La Liga',
  'Série A': 'Serie A',
  'Ligue 1 Uber Eats': 'Ligue 1',
};

function transformMatch(apiMatch: ApiMatch): Match {
  return {
    id: apiMatch.id,
    competition: {
      id: apiMatch.competition.id,
      name: COMPETITION_NAME_MAP[apiMatch.competition.name] || apiMatch.competition.name,
      emblem: apiMatch.competition.emblem,
      code: apiMatch.competition.code,
    },
    homeTeam: {
      id: apiMatch.homeTeam.id,
      name: apiMatch.homeTeam.name,
      shortName: apiMatch.homeTeam.shortName,
      crest: apiMatch.homeTeam.crest,
    },
    awayTeam: {
      id: apiMatch.awayTeam.id,
      name: apiMatch.awayTeam.name,
      shortName: apiMatch.awayTeam.shortName,
      crest: apiMatch.awayTeam.crest,
    },
    homeScore: apiMatch.score.fullTime.home,
    awayScore: apiMatch.score.fullTime.away,
    status: apiMatch.status as Match['status'],
    kickoff: apiMatch.utcDate,
    venue: apiMatch.venue,
    matchday: apiMatch.matchday,
    stage: apiMatch.stage || null,
  };
}

export async function getMatchesByDate(date: Date): Promise<Match[]> {
  const dateStr = toApiDateString(date);
  const nextDay = toApiDateString(addDays(date, 1));
  const response = await footballApi.get('/matches', {
    params: { dateFrom: dateStr, dateTo: nextDay },
  });
  return (response.data.matches || []).map(transformMatch);
}

export async function getMatchesByDateRange(from: Date, to: Date): Promise<Match[]> {
  const response = await footballApi.get('/matches', {
    params: {
      dateFrom: toApiDateString(from),
      dateTo: toApiDateString(addDays(to, 1)),
    },
  });
  return (response.data.matches || []).map(transformMatch);
}

export async function getMatchById(id: number): Promise<Match> {
  const response = await footballApi.get(`/matches/${id}`);
  return transformMatch(response.data);
}

export async function getCompetitionMatches(
  competitionId: number,
  matchday?: number
): Promise<Match[]> {
  const params: Record<string, any> = {};
  if (matchday) params.matchday = matchday;

  const response = await footballApi.get(`/competitions/${competitionId}/matches`, { params });
  return (response.data.matches || []).map(transformMatch);
}

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
  const response = await footballApi.get(`/competitions/${competitionCode}/standings`);
  const table = response.data.standings?.[0]?.table || [];
  return table.map((row: any) => ({
    position: row.position,
    team: {
      id: row.team.id,
      name: row.team.name,
      shortName: row.team.shortName,
      crest: row.team.crest,
    },
    playedGames: row.playedGames,
    won: row.won,
    draw: row.draw,
    lost: row.lost,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDifference: row.goalDifference,
    points: row.points,
  }));
}

export async function getCompetitionMatchesByCode(
  competitionCode: string,
  matchday?: number
): Promise<Match[]> {
  const params: Record<string, any> = {};
  if (matchday) params.matchday = matchday;
  const response = await footballApi.get(`/competitions/${competitionCode}/matches`, { params });
  return (response.data.matches || []).map(transformMatch);
}

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
  const response = await footballApi.get(`/matches/${id}`);
  const data = response.data;
  const match = transformMatch(data);

  const homeLineup = data.homeTeam?.lineup?.map((p: any) => ({
    id: p.id, name: p.name, position: p.position, shirtNumber: p.shirtNumber,
  })) || [];
  const homeBench = data.homeTeam?.bench?.map((p: any) => ({
    id: p.id, name: p.name, position: p.position, shirtNumber: p.shirtNumber,
  })) || [];
  const awayLineup = data.awayTeam?.lineup?.map((p: any) => ({
    id: p.id, name: p.name, position: p.position, shirtNumber: p.shirtNumber,
  })) || [];
  const awayBench = data.awayTeam?.bench?.map((p: any) => ({
    id: p.id, name: p.name, position: p.position, shirtNumber: p.shirtNumber,
  })) || [];

  const goals: MatchGoal[] = (data.goals || []).map((g: any) => ({
    minute: g.minute,
    team: { id: g.team.id },
    scorer: { id: g.scorer.id, name: g.scorer.name },
    assist: g.assist?.id ? { id: g.assist.id, name: g.assist.name } : null,
  }));

  // Parse statistics from both teams
  // The API may return statistics as an object with keys like "corner_kicks", "fouls", etc.
  // or it may not be present at all on the free tier.
  let stats: MatchStats | null = null;
  const homeStat = data.homeTeam?.statistics;
  const awayStat = data.awayTeam?.statistics;
  if (homeStat && awayStat) {
    const parseNum = (val: any): number => {
      if (typeof val === 'string') return parseInt(val, 10) || 0;
      return val ?? 0;
    };
    stats = {
      ballPossession: [parseNum(homeStat.ball_possession), parseNum(awayStat.ball_possession)],
      shots: [parseNum(homeStat.shots), parseNum(awayStat.shots)],
      shotsOnTarget: [parseNum(homeStat.shots_on_goal), parseNum(awayStat.shots_on_goal)],
      corners: [parseNum(homeStat.corner_kicks), parseNum(awayStat.corner_kicks)],
      fouls: [parseNum(homeStat.fouls), parseNum(awayStat.fouls)],
      offsides: [parseNum(homeStat.offsides), parseNum(awayStat.offsides)],
      yellowCards: [parseNum(homeStat.yellow_cards), parseNum(awayStat.yellow_cards)],
      redCards: [parseNum(homeStat.red_cards), parseNum(awayStat.red_cards)],
      saves: [parseNum(homeStat.saves), parseNum(awayStat.saves)],
    };
  }

  // Parse bookings (may not be present on all tiers)
  const bookings: MatchBooking[] = (data.bookings || [])
    .filter((b: any) => b?.team?.id && b?.player?.id)
    .map((b: any) => ({
      minute: b.minute,
      team: { id: b.team.id },
      player: { id: b.player.id, name: b.player.name },
      card: b.card as 'YELLOW' | 'RED' | 'YELLOW_RED',
    }));

  // Parse substitutions (may not be present on all tiers)
  const substitutions: MatchSubstitution[] = (data.substitutions || [])
    .filter((s: any) => s?.team?.id && s?.playerOut?.id && s?.playerIn?.id)
    .map((s: any) => ({
      minute: s.minute,
      team: { id: s.team.id },
      playerOut: { id: s.playerOut.id, name: s.playerOut.name },
      playerIn: { id: s.playerIn.id, name: s.playerIn.name },
  }));

  return {
    match,
    homeLineup,
    homeBench,
    awayLineup,
    awayBench,
    homeCoach: data.homeTeam?.coach?.id
      ? { id: data.homeTeam.coach.id, name: data.homeTeam.coach.name }
      : null,
    awayCoach: data.awayTeam?.coach?.id
      ? { id: data.awayTeam.coach.id, name: data.awayTeam.coach.name }
      : null,
    homeFormation: data.homeTeam?.formation || null,
    awayFormation: data.awayTeam?.formation || null,
    goals,
    referee: data.referees?.[0]?.name || null,
    stats,
    bookings,
    substitutions,
    halfTimeScore: data.score?.halfTime || null,
    attendance: data.attendance || null,
  };
}

/* ─── Team & Person detail endpoints ─── */

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
  const response = await footballApi.get(`/teams/${teamId}`);
  const d = response.data;
  return {
    id: d.id,
    name: d.name,
    shortName: d.shortName,
    crest: d.crest,
    venue: d.venue || null,
    founded: d.founded || null,
    clubColors: d.clubColors || null,
    coach: d.coach?.id ? { id: d.coach.id, name: d.coach.name } : null,
    squad: (d.squad || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      position: p.position || 'Unknown',
      nationality: p.nationality || '',
    })),
    activeCompetitions: (d.runningCompetitions || []).map((c: any) => ({
      id: c.id,
      name: COMPETITION_NAME_MAP[c.name] || c.name,
      code: c.code,
      emblem: c.emblem,
    })),
  };
}

export async function getTeamMatches(teamId: number, status?: string): Promise<Match[]> {
  const params: Record<string, any> = {};
  if (status) params.status = status;
  const response = await footballApi.get(`/teams/${teamId}/matches`, { params });
  return (response.data.matches || []).map(transformMatch);
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
  const response = await footballApi.get(`/persons/${personId}`);
  const d = response.data;
  return {
    id: d.id,
    name: d.name,
    dateOfBirth: d.dateOfBirth || null,
    nationality: d.nationality || null,
    position: d.position || null,
    shirtNumber: d.shirtNumber || null,
    currentTeam: d.currentTeam?.id
      ? { id: d.currentTeam.id, name: d.currentTeam.name, crest: d.currentTeam.crest }
      : null,
  };
}

// Group matches by competition for display
export function groupMatchesByCompetition(matches: Match[]): Map<string, Match[]> {
  const groups = new Map<string, Match[]>();
  for (const match of matches) {
    const key = match.competition.name;
    const existing = groups.get(key) || [];
    existing.push(match);
    groups.set(key, existing);
  }
  return groups;
}
