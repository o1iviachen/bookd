import { addDays } from 'date-fns';
import { footballApi } from '../config/api';
import { Match, Competition, Team } from '../types/match';
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
