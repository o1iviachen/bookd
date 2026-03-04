import { ApiFixture, ApiFixtureEvent, ApiFixtureLineup, ApiFixtureStats, ApiStanding } from '../apiFootball';
import { SyncLeague } from '../leagueHelper';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

function merge<T extends Record<string, any>>(base: T, overrides?: DeepPartial<T>): T {
  if (!overrides) return base;
  const result = { ...base };
  for (const key of Object.keys(overrides) as Array<keyof T>) {
    const val = overrides[key];
    if (val !== undefined && typeof val === 'object' && val !== null && !Array.isArray(val)) {
      result[key] = merge(base[key] as any, val as any);
    } else if (val !== undefined) {
      result[key] = val as any;
    }
  }
  return result;
}

export function makeApiFixture(overrides?: DeepPartial<ApiFixture>): ApiFixture {
  return merge<ApiFixture>({
    fixture: {
      id: 1001,
      referee: 'M. Oliver',
      timezone: 'UTC',
      date: '2025-01-15T15:00:00+00:00',
      timestamp: 1736953200,
      venue: { id: 556, name: 'Old Trafford', city: 'Manchester' },
      status: { long: 'Match Finished', short: 'FT', elapsed: 90 },
    },
    league: {
      id: 39,
      name: 'Premier League',
      country: 'England',
      logo: 'https://media.api-sports.io/football/leagues/39.png',
      flag: 'https://media.api-sports.io/flags/gb.svg',
      season: 2024,
      round: 'Regular Season - 15',
    },
    teams: {
      home: { id: 33, name: 'Manchester United', logo: 'https://media.api-sports.io/football/teams/33.png', winner: true },
      away: { id: 40, name: 'Liverpool', logo: 'https://media.api-sports.io/football/teams/40.png', winner: false },
    },
    goals: { home: 2, away: 1 },
    score: {
      halftime: { home: 1, away: 0 },
      fulltime: { home: 2, away: 1 },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null },
    },
  }, overrides);
}

export function makeApiEvent(overrides?: DeepPartial<ApiFixtureEvent>): ApiFixtureEvent {
  return merge<ApiFixtureEvent>({
    time: { elapsed: 45, extra: null },
    team: { id: 33, name: 'Manchester United', logo: 'https://logo.png' },
    player: { id: 101, name: 'B. Fernandes' },
    assist: { id: 102, name: 'M. Rashford' },
    type: 'Goal',
    detail: 'Normal Goal',
    comments: null,
  }, overrides);
}

export function makeApiLineup(overrides?: Partial<ApiFixtureLineup>): ApiFixtureLineup {
  const base: ApiFixtureLineup = {
    team: { id: 33, name: 'Manchester United', logo: 'https://logo.png' },
    coach: { id: 201, name: 'E. ten Hag', photo: 'https://photo.png' },
    formation: '4-2-3-1',
    startXI: [
      { player: { id: 301, name: 'A. Onana', number: 24, pos: 'G' } },
      { player: { id: 302, name: 'D. Dalot', number: 20, pos: 'D' } },
      { player: { id: 303, name: 'R. Varane', number: 19, pos: 'D' } },
      { player: { id: 304, name: 'L. Martinez', number: 6, pos: 'D' } },
      { player: { id: 305, name: 'L. Shaw', number: 23, pos: 'D' } },
      { player: { id: 306, name: 'Casemiro', number: 18, pos: 'M' } },
      { player: { id: 307, name: 'K. Mainoo', number: 37, pos: 'M' } },
      { player: { id: 308, name: 'A. Garnacho', number: 17, pos: 'M' } },
      { player: { id: 309, name: 'B. Fernandes', number: 8, pos: 'M' } },
      { player: { id: 310, name: 'M. Rashford', number: 10, pos: 'F' } },
      { player: { id: 311, name: 'R. Hojlund', number: 11, pos: 'F' } },
    ],
    substitutes: [
      { player: { id: 312, name: 'T. Heaton', number: 22, pos: 'G' } },
      { player: { id: 313, name: 'J. Evans', number: 35, pos: 'D' } },
    ],
  };
  return { ...base, ...overrides };
}

export function makeApiStats(teamId: number, overrides?: Array<{ type: string; value: number | string | null }>): ApiFixtureStats {
  return {
    team: { id: teamId, name: 'Team', logo: 'https://logo.png' },
    statistics: overrides || [
      { type: 'Ball Possession', value: '55%' },
      { type: 'Total Shots', value: 12 },
      { type: 'Shots on Goal', value: 5 },
      { type: 'Corner Kicks', value: 6 },
      { type: 'Fouls', value: 10 },
      { type: 'Offsides', value: 2 },
      { type: 'Yellow Cards', value: 3 },
      { type: 'Red Cards', value: 0 },
      { type: 'Goalkeeper Saves', value: 4 },
    ],
  };
}

export function makeApiStanding(overrides?: Partial<ApiStanding>): ApiStanding {
  return {
    rank: 1,
    team: { id: 40, name: 'Liverpool', logo: 'https://logo.png' },
    points: 45,
    goalsDiff: 28,
    group: 'Premier League',
    form: 'WWWDW',
    status: 'same',
    description: 'Champions League',
    all: {
      played: 19,
      win: 14,
      draw: 3,
      lose: 2,
      goals: { for: 45, against: 17 },
    },
    ...overrides,
  };
}

export function makeSyncLeague(overrides?: Partial<SyncLeague>): SyncLeague {
  return {
    code: 'PL',
    apiId: 39,
    name: 'Premier League',
    country: 'England',
    tier: 1,
    isCup: false,
    seasonType: 'european',
    enabled: true,
    ...overrides,
  };
}

export function makeLeagueMap(entries?: Array<Partial<SyncLeague>>): Map<number, SyncLeague> {
  if (!entries) {
    const pl = makeSyncLeague();
    return new Map([[pl.apiId, pl]]);
  }
  return new Map(entries.map((e) => {
    const league = makeSyncLeague(e);
    return [league.apiId, league];
  }));
}
