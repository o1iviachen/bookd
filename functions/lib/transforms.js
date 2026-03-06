"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformFixtureToMatch = transformFixtureToMatch;
exports.transformFixtureDetails = transformFixtureDetails;
exports.transformLineupOnly = transformLineupOnly;
exports.transformLiveEventDetails = transformLiveEventDetails;
exports.transformStandings = transformStandings;
/** Decode common HTML entities that API-Football may embed in names. */
function decodeEntities(text) {
    if (!text || !text.includes('&'))
        return text;
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
// ─── Match Status Mapping ───
// API-Football status codes → our MatchStatus
const STATUS_MAP = {
    TBD: 'SCHEDULED',
    NS: 'SCHEDULED',
    '1H': 'IN_PLAY',
    HT: 'PAUSED',
    '2H': 'IN_PLAY',
    ET: 'IN_PLAY',
    BT: 'PAUSED',
    P: 'IN_PLAY',
    SUSP: 'SUSPENDED',
    INT: 'PAUSED',
    FT: 'FINISHED',
    AET: 'FINISHED',
    PEN: 'FINISHED',
    PST: 'POSTPONED',
    CANC: 'CANCELLED',
    ABD: 'CANCELLED',
    AWD: 'FINISHED',
    WO: 'FINISHED',
    LIVE: 'IN_PLAY',
};
// Find our internal competition code from API-Football league ID
function getCompetitionCode(apiLeagueId, leagueMap) {
    var _a;
    return ((_a = leagueMap.get(apiLeagueId)) === null || _a === void 0 ? void 0 : _a.code) || null;
}
// Generate a shortName from a full team name
// Strips common prefixes/suffixes (FC, CF, etc.) and keeps the recognizable name
function makeShortName(name) {
    // Strip common club designators
    const stripped = name
        .replace(/\b(FC|CF|AC|SC|SS|AS|US|RC|CD|UD|SD|SL|SK|IF|BK|FK|NK|GNK|TSG|VfB|VfL|1\.\s*FC|1\.\s*FSV|BSC|KRC|SV|SpVgg)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    // If stripping removed everything, use original
    return stripped || name;
}
// ─── Fixture → Match Document ───
function transformFixtureToMatch(fixture, leagueMap) {
    const code = getCompetitionCode(fixture.league.id, leagueMap);
    if (!code)
        return null;
    const league = leagueMap.get(fixture.league.id);
    return {
        id: fixture.fixture.id,
        legacyId: null,
        competition: {
            id: fixture.league.id,
            name: (league === null || league === void 0 ? void 0 : league.name) || fixture.league.name,
            emblem: fixture.league.logo,
            code,
        },
        homeTeam: {
            id: fixture.teams.home.id,
            name: fixture.teams.home.name,
            shortName: makeShortName(fixture.teams.home.name),
            crest: fixture.teams.home.logo,
        },
        awayTeam: {
            id: fixture.teams.away.id,
            name: fixture.teams.away.name,
            shortName: makeShortName(fixture.teams.away.name),
            crest: fixture.teams.away.logo,
        },
        homeScore: fixture.goals.home,
        awayScore: fixture.goals.away,
        status: STATUS_MAP[fixture.fixture.status.short] || 'SCHEDULED',
        kickoff: fixture.fixture.date,
        venue: fixture.fixture.venue.name,
        matchday: parseMatchday(fixture.league.round),
        stage: parseStage(fixture.league.round),
        season: fixture.league.season,
        round: fixture.league.round,
        elapsed: fixture.fixture.status.elapsed,
    };
}
// Parse matchday number from round string like "Regular Season - 15"
function parseMatchday(round) {
    const match = round.match(/Regular Season\s*-\s*(\d+)/i);
    if (match)
        return parseInt(match[1], 10);
    const matchdayMatch = round.match(/Matchday\s*(\d+)/i);
    if (matchdayMatch)
        return parseInt(matchdayMatch[1], 10);
    // Champions League / Europa League league stage: "League Stage - 1"
    const leagueStageMatch = round.match(/League Stage\s*-\s*(\d+)/i);
    if (leagueStageMatch)
        return parseInt(leagueStageMatch[1], 10);
    // Group stage: "Group A - 3", "Group Stage - 5"
    const groupMatch = round.match(/Group\s*\w*\s*-\s*(\d+)/i);
    if (groupMatch)
        return parseInt(groupMatch[1], 10);
    return null;
}
// Parse knockout stage from round string
function parseStage(round) {
    const lower = round.toLowerCase();
    if (lower.includes('regular season') || lower.includes('league stage') || lower.includes('group')) {
        if (lower.includes('league stage'))
            return 'LEAGUE_STAGE';
        return null;
    }
    if (lower.includes('preliminary'))
        return 'PRELIMINARY_ROUND';
    if (lower.includes('qualifying') || lower.includes('qualification'))
        return 'QUALIFYING_ROUND';
    if (lower.includes('play-off') || lower.includes('playoff'))
        return 'PLAYOFFS';
    if (lower.includes('round of 32') || lower.includes('32nd'))
        return 'LAST_32';
    if (lower.includes('round of 16') || lower.includes('16th'))
        return 'LAST_16';
    if (lower.includes('quarter'))
        return 'QUARTER_FINALS';
    if (lower.includes('semi'))
        return 'SEMI_FINALS';
    if (lower.includes('3rd place') || lower.includes('third place'))
        return 'THIRD_PLACE';
    if (lower.includes('final'))
        return 'FINAL';
    return round; // Return raw round string if we can't map it
}
// ─── Shared Helpers ───
// Map API-Football position codes to readable strings
function mapPosition(pos) {
    switch (pos) {
        case 'G': return 'Goalkeeper';
        case 'D': return 'Defender';
        case 'M': return 'Midfielder';
        case 'F': return 'Forward';
        default: return pos;
    }
}
// Transform lineup player arrays
function mapPlayers(players) {
    return players.map((p) => ({
        id: p.player.id,
        name: decodeEntities(p.player.name),
        position: mapPosition(p.player.pos),
        shirtNumber: p.player.number,
    }));
}
// Extract a stat value from API-Football stats
function getStat(teamStats, type) {
    const stat = teamStats.statistics.find((s) => s.type === type);
    if (!stat || stat.value === null)
        return 0;
    if (typeof stat.value === 'string') {
        return parseInt(stat.value.replace('%', ''), 10) || 0;
    }
    return stat.value;
}
// Build match stats from home/away team stats
function buildMatchStats(homeStats, awayStats) {
    if (!homeStats || !awayStats)
        return null;
    return {
        ballPossession: [getStat(homeStats, 'Ball Possession'), getStat(awayStats, 'Ball Possession')],
        shots: [getStat(homeStats, 'Total Shots'), getStat(awayStats, 'Total Shots')],
        shotsOnTarget: [getStat(homeStats, 'Shots on Goal'), getStat(awayStats, 'Shots on Goal')],
        corners: [getStat(homeStats, 'Corner Kicks'), getStat(awayStats, 'Corner Kicks')],
        fouls: [getStat(homeStats, 'Fouls'), getStat(awayStats, 'Fouls')],
        offsides: [getStat(homeStats, 'Offsides'), getStat(awayStats, 'Offsides')],
        yellowCards: [getStat(homeStats, 'Yellow Cards'), getStat(awayStats, 'Yellow Cards')],
        redCards: [getStat(homeStats, 'Red Cards'), getStat(awayStats, 'Red Cards')],
        saves: [getStat(homeStats, 'Goalkeeper Saves'), getStat(awayStats, 'Goalkeeper Saves')],
    };
}
// Transform events into goals, bookings, substitutions, and timeline
function buildEventData(events) {
    const goals = events
        .filter((e) => e.type === 'Goal')
        .map((e) => ({
        minute: e.time.elapsed,
        team: { id: e.team.id },
        scorer: { id: e.player.id, name: decodeEntities(e.player.name) },
        assist: e.assist.id ? { id: e.assist.id, name: decodeEntities(e.assist.name) } : null,
        detail: e.detail,
    }));
    const bookings = events
        .filter((e) => e.type === 'Card')
        .map((e) => ({
        minute: e.time.elapsed,
        team: { id: e.team.id },
        player: { id: e.player.id, name: decodeEntities(e.player.name) },
        card: e.detail === 'Yellow Card' ? 'YELLOW' : e.detail === 'Red Card' ? 'RED' : 'YELLOW_RED',
    }));
    const substitutions = events
        .filter((e) => e.type === 'subst')
        .map((e) => ({
        minute: e.time.elapsed,
        team: { id: e.team.id },
        playerOut: { id: e.player.id, name: decodeEntities(e.player.name) },
        playerIn: { id: e.assist.id || 0, name: decodeEntities(e.assist.name || '') },
    }));
    const timeline = events.map((e) => ({
        minute: e.time.elapsed,
        extraMinute: e.time.extra,
        teamId: e.team.id,
        playerId: e.player.id,
        playerName: decodeEntities(e.player.name),
        assistId: e.assist.id,
        assistName: decodeEntities(e.assist.name || '') || null,
        type: e.type,
        detail: e.detail,
        comments: e.comments,
    }));
    return { goals, bookings, substitutions, timeline };
}
// ─── Fixture Details → Full MatchDetail Document ───
function transformFixtureDetails(fixtureId, lineups, events, stats, fixture) {
    var _a, _b, _c;
    const homeLineupData = lineups.find((l) => l.team.id === fixture.teams.home.id);
    const awayLineupData = lineups.find((l) => l.team.id === fixture.teams.away.id);
    const matchStats = buildMatchStats(stats.find((s) => s.team.id === fixture.teams.home.id), stats.find((s) => s.team.id === fixture.teams.away.id));
    const { goals, bookings, substitutions, timeline } = buildEventData(events);
    // Collect all player/coach IDs for efficient per-player queries (array-contains)
    const playerIds = [];
    for (const arr of [homeLineupData === null || homeLineupData === void 0 ? void 0 : homeLineupData.startXI, homeLineupData === null || homeLineupData === void 0 ? void 0 : homeLineupData.substitutes, awayLineupData === null || awayLineupData === void 0 ? void 0 : awayLineupData.startXI, awayLineupData === null || awayLineupData === void 0 ? void 0 : awayLineupData.substitutes]) {
        if (arr)
            for (const p of arr)
                if ((_a = p.player) === null || _a === void 0 ? void 0 : _a.id)
                    playerIds.push(p.player.id);
    }
    if ((_b = homeLineupData === null || homeLineupData === void 0 ? void 0 : homeLineupData.coach) === null || _b === void 0 ? void 0 : _b.id)
        playerIds.push(homeLineupData.coach.id);
    if ((_c = awayLineupData === null || awayLineupData === void 0 ? void 0 : awayLineupData.coach) === null || _c === void 0 ? void 0 : _c.id)
        playerIds.push(awayLineupData.coach.id);
    return {
        matchId: fixtureId,
        kickoff: fixture.fixture.date,
        season: fixture.league.season,
        playerIds,
        homeLineup: (homeLineupData === null || homeLineupData === void 0 ? void 0 : homeLineupData.startXI) ? mapPlayers(homeLineupData.startXI) : [],
        homeBench: (homeLineupData === null || homeLineupData === void 0 ? void 0 : homeLineupData.substitutes) ? mapPlayers(homeLineupData.substitutes) : [],
        awayLineup: (awayLineupData === null || awayLineupData === void 0 ? void 0 : awayLineupData.startXI) ? mapPlayers(awayLineupData.startXI) : [],
        awayBench: (awayLineupData === null || awayLineupData === void 0 ? void 0 : awayLineupData.substitutes) ? mapPlayers(awayLineupData.substitutes) : [],
        homeCoach: homeLineupData
            ? { id: homeLineupData.coach.id, name: homeLineupData.coach.name }
            : null,
        awayCoach: awayLineupData
            ? { id: awayLineupData.coach.id, name: awayLineupData.coach.name }
            : null,
        homeFormation: (homeLineupData === null || homeLineupData === void 0 ? void 0 : homeLineupData.formation) || null,
        awayFormation: (awayLineupData === null || awayLineupData === void 0 ? void 0 : awayLineupData.formation) || null,
        goals,
        stats: matchStats,
        bookings,
        substitutions,
        events: timeline,
        referee: decodeEntities(fixture.fixture.referee || '') || null,
        halfTimeScore: fixture.score.halftime.home !== null
            ? { home: fixture.score.halftime.home, away: fixture.score.halftime.away }
            : null,
        attendance: null, // API-Football doesn't provide attendance on this tier
    };
}
// ─── Lineup-Only Transform (for pre-match lineup sync) ───
function transformLineupOnly(fixtureId, lineups, homeTeamId, awayTeamId, kickoff, season) {
    var _a, _b, _c;
    const homeLineupData = lineups.find((l) => l.team.id === homeTeamId);
    const awayLineupData = lineups.find((l) => l.team.id === awayTeamId);
    const playerIds = [];
    for (const arr of [homeLineupData === null || homeLineupData === void 0 ? void 0 : homeLineupData.startXI, homeLineupData === null || homeLineupData === void 0 ? void 0 : homeLineupData.substitutes, awayLineupData === null || awayLineupData === void 0 ? void 0 : awayLineupData.startXI, awayLineupData === null || awayLineupData === void 0 ? void 0 : awayLineupData.substitutes]) {
        if (arr)
            for (const p of arr)
                if ((_a = p.player) === null || _a === void 0 ? void 0 : _a.id)
                    playerIds.push(p.player.id);
    }
    if ((_b = homeLineupData === null || homeLineupData === void 0 ? void 0 : homeLineupData.coach) === null || _b === void 0 ? void 0 : _b.id)
        playerIds.push(homeLineupData.coach.id);
    if ((_c = awayLineupData === null || awayLineupData === void 0 ? void 0 : awayLineupData.coach) === null || _c === void 0 ? void 0 : _c.id)
        playerIds.push(awayLineupData.coach.id);
    return {
        matchId: fixtureId,
        kickoff,
        season,
        playerIds,
        homeLineup: (homeLineupData === null || homeLineupData === void 0 ? void 0 : homeLineupData.startXI) ? mapPlayers(homeLineupData.startXI) : [],
        homeBench: (homeLineupData === null || homeLineupData === void 0 ? void 0 : homeLineupData.substitutes) ? mapPlayers(homeLineupData.substitutes) : [],
        awayLineup: (awayLineupData === null || awayLineupData === void 0 ? void 0 : awayLineupData.startXI) ? mapPlayers(awayLineupData.startXI) : [],
        awayBench: (awayLineupData === null || awayLineupData === void 0 ? void 0 : awayLineupData.substitutes) ? mapPlayers(awayLineupData.substitutes) : [],
        homeCoach: homeLineupData
            ? { id: homeLineupData.coach.id, name: homeLineupData.coach.name }
            : null,
        awayCoach: awayLineupData
            ? { id: awayLineupData.coach.id, name: awayLineupData.coach.name }
            : null,
        homeFormation: (homeLineupData === null || homeLineupData === void 0 ? void 0 : homeLineupData.formation) || null,
        awayFormation: (awayLineupData === null || awayLineupData === void 0 ? void 0 : awayLineupData.formation) || null,
    };
}
// ─── Live Event/Stats Transform (for in-match updates) ───
function transformLiveEventDetails(fixtureId, events, stats, fixture) {
    const matchStats = buildMatchStats(stats.find((s) => s.team.id === fixture.teams.home.id), stats.find((s) => s.team.id === fixture.teams.away.id));
    const { goals, bookings, substitutions, timeline } = buildEventData(events);
    return {
        matchId: fixtureId,
        kickoff: fixture.fixture.date,
        season: fixture.league.season,
        goals,
        stats: matchStats,
        bookings,
        substitutions,
        events: timeline,
        referee: decodeEntities(fixture.fixture.referee || '') || null,
        halfTimeScore: fixture.score.halftime.home !== null
            ? { home: fixture.score.halftime.home, away: fixture.score.halftime.away }
            : null,
    };
}
// ─── Standings Transform ───
function transformStandings(standings) {
    return standings.map((s) => ({
        position: s.rank,
        team: {
            id: s.team.id,
            name: s.team.name,
            shortName: makeShortName(s.team.name),
            crest: s.team.logo,
        },
        playedGames: s.all.played,
        won: s.all.win,
        draw: s.all.draw,
        lost: s.all.lose,
        goalsFor: s.all.goals.for,
        goalsAgainst: s.all.goals.against,
        goalDifference: s.goalsDiff,
        points: s.points,
        description: s.description || null,
    }));
}
//# sourceMappingURL=transforms.js.map