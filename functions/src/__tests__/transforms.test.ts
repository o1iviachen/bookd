import { transformFixtureToMatch, transformFixtureDetails, transformStandings, transformLineupOnly, transformLiveEventDetails } from '../transforms';
import {
  makeApiFixture,
  makeApiEvent,
  makeApiLineup,
  makeApiStats,
  makeApiStanding,
  makeLeagueMap,
  makeSyncLeague,
} from './fixtures';

// ─── transformFixtureToMatch ───

describe('transformFixtureToMatch', () => {
  const leagueMap = makeLeagueMap();

  it('returns a valid match doc with all fields', () => {
    const fixture = makeApiFixture();
    const result = transformFixtureToMatch(fixture, leagueMap)!;

    expect(result).not.toBeNull();
    expect(result.id).toBe(1001);
    expect(result.competition).toEqual({
      id: 39,
      name: 'Premier League',
      emblem: fixture.league.logo,
      code: 'PL',
    });
    expect(result.homeTeam.id).toBe(33);
    expect(result.homeTeam.name).toBe('Manchester United');
    expect(result.awayTeam.id).toBe(40);
    expect(result.awayTeam.name).toBe('Liverpool');
    expect(result.homeScore).toBe(2);
    expect(result.awayScore).toBe(1);
    expect(result.status).toBe('FINISHED');
    expect(result.kickoff).toBe('2025-01-15T15:00:00+00:00');
    expect(result.venue).toBe('Old Trafford');
    expect(result.matchday).toBe(15);
    expect(result.stage).toBeNull();
    expect(result.season).toBe(2024);
    expect(result.round).toBe('Regular Season - 15');
  });

  it('returns null when league not in leagueMap', () => {
    const fixture = makeApiFixture({ league: { id: 9999 } });
    expect(transformFixtureToMatch(fixture, leagueMap)).toBeNull();
  });

  it('uses league name from leagueMap over fixture data', () => {
    const map = makeLeagueMap([{ apiId: 39, name: 'English Premier League' }]);
    const fixture = makeApiFixture();
    const result = transformFixtureToMatch(fixture, map)!;
    expect(result.competition.name).toBe('English Premier League');
  });

  // ── Status mapping ──

  const statusCases: Array<[string, string]> = [
    ['NS', 'SCHEDULED'],
    ['TBD', 'SCHEDULED'],
    ['1H', 'IN_PLAY'],
    ['2H', 'IN_PLAY'],
    ['ET', 'IN_PLAY'],
    ['P', 'IN_PLAY'],
    ['LIVE', 'IN_PLAY'],
    ['HT', 'PAUSED'],
    ['BT', 'PAUSED'],
    ['INT', 'PAUSED'],
    ['FT', 'FINISHED'],
    ['AET', 'FINISHED'],
    ['PEN', 'FINISHED'],
    ['AWD', 'FINISHED'],
    ['WO', 'FINISHED'],
    ['PST', 'POSTPONED'],
    ['CANC', 'CANCELLED'],
    ['ABD', 'CANCELLED'],
    ['SUSP', 'SUSPENDED'],
  ];

  it.each(statusCases)('maps status %s → %s', (apiStatus, expected) => {
    const fixture = makeApiFixture({ fixture: { status: { short: apiStatus } } });
    const result = transformFixtureToMatch(fixture, leagueMap)!;
    expect(result.status).toBe(expected);
  });

  it('defaults unknown status to SCHEDULED', () => {
    const fixture = makeApiFixture({ fixture: { status: { short: 'UNKNOWN' } } });
    const result = transformFixtureToMatch(fixture, leagueMap)!;
    expect(result.status).toBe('SCHEDULED');
  });

  // ── shortName (makeShortName tested indirectly) ──

  it('strips FC suffix from team names', () => {
    const fixture = makeApiFixture({
      teams: {
        home: { name: 'Chelsea FC' },
        away: { name: 'Arsenal FC' },
      },
    });
    const result = transformFixtureToMatch(fixture, leagueMap)!;
    expect(result.homeTeam.shortName).toBe('Chelsea');
    expect(result.awayTeam.shortName).toBe('Arsenal');
  });

  it('strips FC prefix from team names', () => {
    const fixture = makeApiFixture({
      teams: { home: { name: 'FC Barcelona' } },
    });
    const result = transformFixtureToMatch(fixture, leagueMap)!;
    expect(result.homeTeam.shortName).toBe('Barcelona');
  });

  it('strips 1. FC prefix', () => {
    const fixture = makeApiFixture({
      teams: { home: { name: '1. FC Köln' } },
    });
    const result = transformFixtureToMatch(fixture, leagueMap)!;
    expect(result.homeTeam.shortName).toBe('Köln');
  });

  it('keeps name unchanged when no prefix/suffix to strip', () => {
    const fixture = makeApiFixture({
      teams: { home: { name: 'Liverpool' } },
    });
    const result = transformFixtureToMatch(fixture, leagueMap)!;
    expect(result.homeTeam.shortName).toBe('Liverpool');
  });

  // ── parseMatchday (tested indirectly) ──

  const matchdayCases: Array<[string, number | null]> = [
    ['Regular Season - 15', 15],
    ['Regular Season - 1', 1],
    ['Matchday 3', 3],
    ['League Stage - 1', 1],
    ['Group A - 3', 3],
    ['Group Stage - 5', 5],
    ['Quarter-finals', null],
    ['Semi-finals', null],
    ['Final', null],
    ['Round of 16', null],
  ];

  it.each(matchdayCases)('parseMatchday: "%s" → %s', (round, expected) => {
    const fixture = makeApiFixture({ league: { round } });
    const result = transformFixtureToMatch(fixture, leagueMap)!;
    expect(result.matchday).toBe(expected);
  });

  // ── parseStage (tested indirectly) ──

  const stageCases: Array<[string, string | null]> = [
    ['Regular Season - 15', null],
    ['League Stage - 1', 'LEAGUE_STAGE'],
    ['Round of 16', 'LAST_16'],
    ['Round of 32', 'LAST_32'],
    ['Quarter-finals', 'QUARTER_FINALS'],
    ['Semi-finals', 'SEMI_FINALS'],
    ['Final', 'FINAL'],
    ['3rd Place Final', 'THIRD_PLACE'],
    ['Preliminary Round', 'PRELIMINARY_ROUND'],
    ['Qualifying Round 1', 'QUALIFYING_ROUND'],
    ['Qualification Round', 'QUALIFYING_ROUND'],
    ['Play-offs', 'PLAYOFFS'],
  ];

  it.each(stageCases)('parseStage: "%s" → %s', (round, expected) => {
    const fixture = makeApiFixture({ league: { round } });
    const result = transformFixtureToMatch(fixture, leagueMap)!;
    expect(result.stage).toBe(expected);
  });
});

// ─── transformFixtureDetails ───

describe('transformFixtureDetails', () => {
  const fixture = makeApiFixture();

  it('builds lineups from startXI and substitutes', () => {
    const homeLineup = makeApiLineup({ team: { id: 33, name: 'Man Utd', logo: '' } });
    const awayLineup = makeApiLineup({
      team: { id: 40, name: 'Liverpool', logo: '' },
      coach: { id: 202, name: 'A. Slot', photo: '' },
      formation: '4-3-3',
      startXI: [
        { player: { id: 401, name: 'Alisson', number: 1, pos: 'G' } },
      ],
      substitutes: [
        { player: { id: 402, name: 'C. Kelleher', number: 62, pos: 'G' } },
      ],
    });

    const result = transformFixtureDetails(1001, [homeLineup, awayLineup], [], [], fixture);

    expect(result.homeLineup).toHaveLength(11);
    expect(result.homeBench).toHaveLength(2);
    expect(result.awayLineup).toHaveLength(1);
    expect(result.awayBench).toHaveLength(1);
    expect(result.homeFormation).toBe('4-2-3-1');
    expect(result.awayFormation).toBe('4-3-3');
    expect(result.homeCoach).toEqual({ id: 201, name: 'E. ten Hag' });
    expect(result.awayCoach).toEqual({ id: 202, name: 'A. Slot' });
  });

  it('maps position codes correctly', () => {
    const lineup = makeApiLineup({
      startXI: [
        { player: { id: 1, name: 'GK', number: 1, pos: 'G' } },
        { player: { id: 2, name: 'DEF', number: 2, pos: 'D' } },
        { player: { id: 3, name: 'MID', number: 3, pos: 'M' } },
        { player: { id: 4, name: 'FWD', number: 4, pos: 'F' } },
      ],
    });

    const result = transformFixtureDetails(1001, [lineup], [], [], fixture);
    expect(result.homeLineup[0].position).toBe('Goalkeeper');
    expect(result.homeLineup[1].position).toBe('Defender');
    expect(result.homeLineup[2].position).toBe('Midfielder');
    expect(result.homeLineup[3].position).toBe('Forward');
  });

  it('extracts goals from events', () => {
    const events = [
      makeApiEvent({ type: 'Goal', detail: 'Normal Goal', time: { elapsed: 23, extra: null } }),
      makeApiEvent({ type: 'Goal', detail: 'Penalty', time: { elapsed: 78, extra: null }, assist: { id: null, name: null } }),
    ];

    const result = transformFixtureDetails(1001, [], events, [], fixture);
    expect(result.goals).toHaveLength(2);
    expect(result.goals[0].minute).toBe(23);
    expect(result.goals[0].detail).toBe('Normal Goal');
    expect(result.goals[0].assist).toEqual({ id: 102, name: 'M. Rashford' });
    expect(result.goals[1].minute).toBe(78);
    expect(result.goals[1].assist).toBeNull();
  });

  it('extracts bookings from events', () => {
    const events = [
      makeApiEvent({ type: 'Card', detail: 'Yellow Card', time: { elapsed: 30, extra: null } }),
      makeApiEvent({ type: 'Card', detail: 'Red Card', time: { elapsed: 65, extra: null } }),
      makeApiEvent({ type: 'Card', detail: 'Second Yellow card', time: { elapsed: 80, extra: null } }),
    ];

    const result = transformFixtureDetails(1001, [], events, [], fixture);
    expect(result.bookings).toHaveLength(3);
    expect(result.bookings[0].card).toBe('YELLOW');
    expect(result.bookings[1].card).toBe('RED');
    expect(result.bookings[2].card).toBe('YELLOW_RED');
  });

  it('extracts substitutions from events', () => {
    const events = [
      makeApiEvent({
        type: 'subst',
        detail: 'Substitution 1',
        time: { elapsed: 60, extra: null },
        player: { id: 310, name: 'M. Rashford' },
        assist: { id: 313, name: 'J. Evans' },
      }),
    ];

    const result = transformFixtureDetails(1001, [], events, [], fixture);
    expect(result.substitutions).toHaveLength(1);
    expect(result.substitutions[0].playerOut).toEqual({ id: 310, name: 'M. Rashford' });
    expect(result.substitutions[0].playerIn).toEqual({ id: 313, name: 'J. Evans' });
    expect(result.substitutions[0].minute).toBe(60);
  });

  it('handles empty lineups', () => {
    const result = transformFixtureDetails(1001, [], [], [], fixture);
    expect(result.homeLineup).toEqual([]);
    expect(result.homeBench).toEqual([]);
    expect(result.awayLineup).toEqual([]);
    expect(result.awayBench).toEqual([]);
    expect(result.homeCoach).toBeNull();
    expect(result.awayCoach).toBeNull();
    expect(result.homeFormation).toBeNull();
    expect(result.awayFormation).toBeNull();
  });

  it('handles missing stats (null)', () => {
    const result = transformFixtureDetails(1001, [], [], [], fixture);
    expect(result.stats).toBeNull();
  });

  it('builds stats from home and away team data', () => {
    const homeStats = makeApiStats(33);
    const awayStats = makeApiStats(40, [
      { type: 'Ball Possession', value: '45%' },
      { type: 'Total Shots', value: 8 },
      { type: 'Shots on Goal', value: 3 },
      { type: 'Corner Kicks', value: 4 },
      { type: 'Fouls', value: 12 },
      { type: 'Offsides', value: 1 },
      { type: 'Yellow Cards', value: 2 },
      { type: 'Red Cards', value: 1 },
      { type: 'Goalkeeper Saves', value: 3 },
    ]);

    const result = transformFixtureDetails(1001, [], [], [homeStats, awayStats], fixture);
    expect(result.stats).not.toBeNull();
    expect(result.stats!.ballPossession).toEqual([55, 45]);
    expect(result.stats!.shots).toEqual([12, 8]);
    expect(result.stats!.shotsOnTarget).toEqual([5, 3]);
    expect(result.stats!.corners).toEqual([6, 4]);
    expect(result.stats!.fouls).toEqual([10, 12]);
    expect(result.stats!.yellowCards).toEqual([3, 2]);
    expect(result.stats!.redCards).toEqual([0, 1]);
    expect(result.stats!.saves).toEqual([4, 3]);
  });

  it('decodes HTML entities in player names', () => {
    const events = [
      makeApiEvent({
        type: 'Goal',
        player: { id: 1, name: "N&apos;Golo Kant&eacute;" },
        assist: { id: 2, name: "L&apos;Equipe" },
      }),
    ];

    const result = transformFixtureDetails(1001, [], events, [], fixture);
    expect(result.goals[0].scorer.name).toBe("N'Golo Kant&eacute;");
    expect(result.goals[0].assist!.name).toBe("L'Equipe");
  });

  it('decodes HTML entities in referee name', () => {
    const fix = makeApiFixture({ fixture: { referee: "D&apos;Angelo" } });
    const result = transformFixtureDetails(1001, [], [], [], fix);
    expect(result.referee).toBe("D'Angelo");
  });

  it('maps halftime score correctly', () => {
    const result = transformFixtureDetails(1001, [], [], [], fixture);
    expect(result.halfTimeScore).toEqual({ home: 1, away: 0 });
  });

  it('returns null halftime score when not available', () => {
    const fix = makeApiFixture({
      score: { halftime: { home: null, away: null } },
    });
    const result = transformFixtureDetails(1001, [], [], [], fix);
    expect(result.halfTimeScore).toBeNull();
  });

  it('collects all playerIds from lineups and coaches', () => {
    const homeLineup = makeApiLineup({
      team: { id: 33, name: 'Man Utd', logo: '' },
      coach: { id: 201, name: 'Coach A', photo: '' },
      startXI: [{ player: { id: 1, name: 'P1', number: 1, pos: 'G' } }],
      substitutes: [{ player: { id: 2, name: 'P2', number: 2, pos: 'D' } }],
    });
    const awayLineup = makeApiLineup({
      team: { id: 40, name: 'Liverpool', logo: '' },
      coach: { id: 202, name: 'Coach B', photo: '' },
      startXI: [{ player: { id: 3, name: 'P3', number: 1, pos: 'G' } }],
      substitutes: [{ player: { id: 4, name: 'P4', number: 2, pos: 'D' } }],
    });

    const result = transformFixtureDetails(1001, [homeLineup, awayLineup], [], [], fixture);
    expect(result.playerIds).toEqual(expect.arrayContaining([1, 2, 3, 4, 201, 202]));
    expect(result.playerIds).toHaveLength(6);
  });

  it('builds full event timeline', () => {
    const events = [
      makeApiEvent({ type: 'Goal', time: { elapsed: 10, extra: null } }),
      makeApiEvent({ type: 'Card', detail: 'Yellow Card', time: { elapsed: 35, extra: 2 } }),
    ];

    const result = transformFixtureDetails(1001, [], events, [], fixture);
    expect(result.events).toHaveLength(2);
    expect(result.events[0].minute).toBe(10);
    expect(result.events[0].extraMinute).toBeNull();
    expect(result.events[0].type).toBe('Goal');
    expect(result.events[1].minute).toBe(35);
    expect(result.events[1].extraMinute).toBe(2);
  });
});

// ─── transformStandings ───

describe('transformStandings', () => {
  it('maps standings to correct shape', () => {
    const standings = [
      makeApiStanding({ rank: 1, team: { id: 40, name: 'Liverpool', logo: 'https://l.png' }, points: 45 }),
      makeApiStanding({ rank: 2, team: { id: 42, name: 'Arsenal FC', logo: 'https://a.png' }, points: 40 }),
    ];

    const result = transformStandings(standings);
    expect(result).toHaveLength(2);

    expect(result[0].position).toBe(1);
    expect(result[0].team.id).toBe(40);
    expect(result[0].team.name).toBe('Liverpool');
    expect(result[0].team.shortName).toBe('Liverpool');
    expect(result[0].points).toBe(45);

    expect(result[1].position).toBe(2);
    expect(result[1].team.name).toBe('Arsenal FC');
    expect(result[1].team.shortName).toBe('Arsenal');
  });

  it('maps all stats fields correctly', () => {
    const standing = makeApiStanding({
      all: { played: 19, win: 14, draw: 3, lose: 2, goals: { for: 45, against: 17 } },
      goalsDiff: 28,
    });

    const [result] = transformStandings([standing]);
    expect(result.playedGames).toBe(19);
    expect(result.won).toBe(14);
    expect(result.draw).toBe(3);
    expect(result.lost).toBe(2);
    expect(result.goalsFor).toBe(45);
    expect(result.goalsAgainst).toBe(17);
    expect(result.goalDifference).toBe(28);
  });

  it('handles empty standings array', () => {
    expect(transformStandings([])).toEqual([]);
  });
});

// ─── transformFixtureToMatch — new fields ───

describe('transformFixtureToMatch new fields', () => {
  const leagueMap = makeLeagueMap();

  it('includes elapsed from fixture status', () => {
    const fixture = makeApiFixture({ fixture: { status: { elapsed: 67 } } });
    const result = transformFixtureToMatch(fixture, leagueMap)!;
    expect(result.elapsed).toBe(67);
  });

  it('elapsed is null for scheduled matches', () => {
    const fixture = makeApiFixture({ fixture: { status: { short: 'NS', elapsed: null } } });
    const result = transformFixtureToMatch(fixture, leagueMap)!;
    expect(result.elapsed).toBeNull();
  });

  it('does not include hasDetails (set by callers for new docs only)', () => {
    const fixture = makeApiFixture();
    const result = transformFixtureToMatch(fixture, leagueMap)!;
    expect(result.hasDetails).toBeUndefined();
  });
});

// ─── transformLineupOnly ───

describe('transformLineupOnly', () => {
  it('returns lineup fields only', () => {
    const homeLineup = makeApiLineup({
      team: { id: 33, name: 'Man Utd', logo: '' },
      coach: { id: 201, name: 'Coach A', photo: '' },
      formation: '4-2-3-1',
      startXI: [{ player: { id: 1, name: 'P1', number: 1, pos: 'G' } }],
      substitutes: [{ player: { id: 2, name: 'P2', number: 2, pos: 'D' } }],
    });
    const awayLineup = makeApiLineup({
      team: { id: 40, name: 'Liverpool', logo: '' },
      coach: { id: 202, name: 'Coach B', photo: '' },
      formation: '4-3-3',
      startXI: [{ player: { id: 3, name: 'P3', number: 1, pos: 'G' } }],
      substitutes: [],
    });

    const result = transformLineupOnly(1001, [homeLineup, awayLineup], 33, 40, '2025-01-15T15:00:00Z', 2024);

    expect(result.matchId).toBe(1001);
    expect(result.kickoff).toBe('2025-01-15T15:00:00Z');
    expect(result.season).toBe(2024);
    expect(result.homeLineup).toHaveLength(1);
    expect(result.homeBench).toHaveLength(1);
    expect(result.awayLineup).toHaveLength(1);
    expect(result.awayBench).toHaveLength(0);
    expect(result.homeFormation).toBe('4-2-3-1');
    expect(result.awayFormation).toBe('4-3-3');
    expect(result.homeCoach).toEqual({ id: 201, name: 'Coach A' });
    expect(result.awayCoach).toEqual({ id: 202, name: 'Coach B' });
    expect(result.playerIds).toEqual(expect.arrayContaining([1, 2, 3, 201, 202]));
  });

  it('does not include event or stats fields', () => {
    const result = transformLineupOnly(1001, [], 33, 40, '2025-01-15T15:00:00Z', 2024);
    expect(result).not.toHaveProperty('goals');
    expect(result).not.toHaveProperty('stats');
    expect(result).not.toHaveProperty('bookings');
    expect(result).not.toHaveProperty('events');
    expect(result).not.toHaveProperty('referee');
  });

  it('handles empty lineups', () => {
    const result = transformLineupOnly(1001, [], 33, 40, '2025-01-15T15:00:00Z', 2024);
    expect(result.homeLineup).toEqual([]);
    expect(result.awayLineup).toEqual([]);
    expect(result.homeCoach).toBeNull();
    expect(result.awayCoach).toBeNull();
    expect(result.homeFormation).toBeNull();
    expect(result.playerIds).toEqual([]);
  });
});

// ─── transformLiveEventDetails ───

describe('transformLiveEventDetails', () => {
  const fixture = makeApiFixture();

  it('returns events and stats fields only', () => {
    const events = [
      makeApiEvent({ type: 'Goal', time: { elapsed: 23, extra: null } }),
      makeApiEvent({ type: 'Card', detail: 'Yellow Card', time: { elapsed: 45, extra: null } }),
      makeApiEvent({ type: 'subst', time: { elapsed: 60, extra: null } }),
    ];
    const homeStats = makeApiStats(33);
    const awayStats = makeApiStats(40);

    const result = transformLiveEventDetails(1001, events, [homeStats, awayStats], fixture);

    expect(result.matchId).toBe(1001);
    expect(result.kickoff).toBe(fixture.fixture.date);
    expect(result.season).toBe(2024);
    expect(result.goals).toHaveLength(1);
    expect(result.bookings).toHaveLength(1);
    expect(result.substitutions).toHaveLength(1);
    expect(result.events).toHaveLength(3);
    expect(result.stats).not.toBeNull();
    expect(result.referee).toBe('M. Oliver');
    expect(result.halfTimeScore).toEqual({ home: 1, away: 0 });
  });

  it('does not include lineup fields', () => {
    const result = transformLiveEventDetails(1001, [], [], fixture);
    expect(result).not.toHaveProperty('homeLineup');
    expect(result).not.toHaveProperty('awayLineup');
    expect(result).not.toHaveProperty('homeBench');
    expect(result).not.toHaveProperty('awayBench');
    expect(result).not.toHaveProperty('homeCoach');
    expect(result).not.toHaveProperty('homeFormation');
    expect(result).not.toHaveProperty('playerIds');
  });

  it('handles empty events and stats', () => {
    const result = transformLiveEventDetails(1001, [], [], fixture);
    expect(result.goals).toEqual([]);
    expect(result.bookings).toEqual([]);
    expect(result.substitutions).toEqual([]);
    expect(result.events).toEqual([]);
    expect(result.stats).toBeNull();
  });
});
