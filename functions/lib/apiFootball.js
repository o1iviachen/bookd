"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFixtures = getFixtures;
exports.getFixtureById = getFixtureById;
exports.getFixtureEvents = getFixtureEvents;
exports.getFixtureLineups = getFixtureLineups;
exports.getFixtureStats = getFixtureStats;
exports.getStandings = getStandings;
exports.getPlayerById = getPlayerById;
exports.getLiveFixtures = getLiveFixtures;
exports.getTeamSquad = getTeamSquad;
exports.getTeamInfo = getTeamInfo;
exports.getTeamCoach = getTeamCoach;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("./config");
// API-Football HTTP client with built-in rate limiting
let lastRequestTime = 0;
const client = axios_1.default.create({
    baseURL: config_1.API_FOOTBALL_BASE,
    timeout: 30000,
    headers: {
        'x-apisports-key': config_1.API_FOOTBALL_KEY,
    },
});
async function rateLimit() {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < config_1.RATE_LIMIT_DELAY_MS) {
        await new Promise((r) => setTimeout(r, config_1.RATE_LIMIT_DELAY_MS - elapsed));
    }
    lastRequestTime = Date.now();
}
// ─── API Methods ───
async function getFixtures(params) {
    await rateLimit();
    const response = await client.get('/fixtures', { params });
    return response.data.response || [];
}
async function getFixtureById(fixtureId) {
    await rateLimit();
    const response = await client.get('/fixtures', { params: { id: fixtureId } });
    const fixtures = response.data.response || [];
    return fixtures[0] || null;
}
async function getFixtureEvents(fixtureId) {
    await rateLimit();
    const response = await client.get('/fixtures/events', { params: { fixture: fixtureId } });
    return response.data.response || [];
}
async function getFixtureLineups(fixtureId) {
    await rateLimit();
    const response = await client.get('/fixtures/lineups', { params: { fixture: fixtureId } });
    return response.data.response || [];
}
async function getFixtureStats(fixtureId) {
    await rateLimit();
    const response = await client.get('/fixtures/statistics', { params: { fixture: fixtureId } });
    return response.data.response || [];
}
async function getStandings(leagueId, season) {
    var _a;
    await rateLimit();
    const response = await client.get('/standings', { params: { league: leagueId, season } });
    const standings = response.data.response || [];
    if (standings.length === 0)
        return [];
    // Returns array of groups (each group is an array of standings)
    return (((_a = standings[0].league) === null || _a === void 0 ? void 0 : _a.standings) || []);
}
async function getPlayerById(playerId, season) {
    await rateLimit();
    const params = { id: playerId };
    if (season)
        params.season = season;
    const response = await client.get('/players', { params });
    const players = response.data.response || [];
    return players[0] || null;
}
async function getLiveFixtures() {
    await rateLimit();
    const response = await client.get('/fixtures', { params: { live: 'all' } });
    return response.data.response || [];
}
async function getTeamSquad(teamId) {
    await rateLimit();
    const response = await client.get('/players/squads', { params: { team: teamId } });
    const squads = response.data.response || [];
    return squads[0] || null;
}
async function getTeamInfo(teamId) {
    await rateLimit();
    const response = await client.get('/teams', { params: { id: teamId } });
    const teams = response.data.response || [];
    return teams[0] || null;
}
async function getTeamCoach(teamId) {
    await rateLimit();
    const response = await client.get('/coachs', { params: { team: teamId } });
    const coaches = response.data.response || [];
    if (coaches.length === 0)
        return null;
    // Find the coach whose career has this team with no end date (= current)
    for (const coach of coaches) {
        const current = (coach.career || []).find((c) => { var _a; return ((_a = c.team) === null || _a === void 0 ? void 0 : _a.id) === teamId && !c.end; });
        if (current)
            return coach;
    }
    // Fallback: return the last coach entry
    return coaches[coaches.length - 1];
}
//# sourceMappingURL=apiFootball.js.map