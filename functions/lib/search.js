"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchMatches = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const db = admin.firestore();
let cachedTeams = null;
let cachedTeamsTs = 0;
const TEAM_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
async function getTeamIndex() {
    var _a;
    if (cachedTeams && Date.now() - cachedTeamsTs < TEAM_CACHE_TTL) {
        return cachedTeams;
    }
    const snap = await db.collection('searchIndexes').doc('teams').get();
    if (!snap.exists)
        return [];
    cachedTeams = ((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.teams) || [];
    cachedTeamsTs = Date.now();
    return cachedTeams;
}
// ─── Match helpers (mirrored from client footballApi.ts) ───
function cleanShortName(name, shortName) {
    if (shortName && shortName.length > 3)
        return shortName;
    const stripped = name
        .replace(/\b(FC|CF|AC|SC|SS|AS|US|RC|CD|UD|SD|SL|SK|IF|BK|FK|NK|GNK|TSG|VfB|VfL|1\.\s*FC|1\.\s*FSV|BSC|KRC|SV|SpVgg)\b/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
    return stripped || name;
}
function isValidMatch(data) {
    var _a, _b, _c;
    return (data.id != null &&
        ((_a = data.competition) === null || _a === void 0 ? void 0 : _a.id) != null &&
        ((_b = data.homeTeam) === null || _b === void 0 ? void 0 : _b.id) != null &&
        ((_c = data.awayTeam) === null || _c === void 0 ? void 0 : _c.id) != null &&
        data.kickoff != null &&
        data.season != null);
}
function docToMatch(data, docId) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
    const home = (_a = data.homeTeam) !== null && _a !== void 0 ? _a : { id: 0, name: 'Unknown', shortName: 'UNK', crest: '' };
    const away = (_b = data.awayTeam) !== null && _b !== void 0 ? _b : { id: 0, name: 'Unknown', shortName: 'UNK', crest: '' };
    const ratingSum = (_c = data.ratingSum) !== null && _c !== void 0 ? _c : 0;
    const ratingCount = (_d = data.ratingCount) !== null && _d !== void 0 ? _d : 0;
    return {
        id: Number(docId),
        competition: (_e = data.competition) !== null && _e !== void 0 ? _e : { id: 0, name: 'Unknown', code: '', emblem: '' },
        homeTeam: { ...home, shortName: cleanShortName(home.name, home.shortName) },
        awayTeam: { ...away, shortName: cleanShortName(away.name, away.shortName) },
        homeScore: (_f = data.homeScore) !== null && _f !== void 0 ? _f : null,
        awayScore: (_g = data.awayScore) !== null && _g !== void 0 ? _g : null,
        status: (_h = data.status) !== null && _h !== void 0 ? _h : 'SCHEDULED',
        kickoff: (_j = data.kickoff) !== null && _j !== void 0 ? _j : new Date().toISOString(),
        venue: (_k = data.venue) !== null && _k !== void 0 ? _k : null,
        matchday: (_l = data.matchday) !== null && _l !== void 0 ? _l : null,
        stage: (_m = data.stage) !== null && _m !== void 0 ? _m : null,
        ratingSum,
        ratingCount,
        avgRating: ratingCount > 0 ? ratingSum / ratingCount : undefined,
        reviewCount: (_o = data.reviewCount) !== null && _o !== void 0 ? _o : undefined,
        ratingBuckets: (_p = data.ratingBuckets) !== null && _p !== void 0 ? _p : undefined,
        ratingBucketsHome: (_q = data.ratingBucketsHome) !== null && _q !== void 0 ? _q : undefined,
        ratingBucketsAway: (_r = data.ratingBucketsAway) !== null && _r !== void 0 ? _r : undefined,
        ratingBucketsNeutral: (_s = data.ratingBucketsNeutral) !== null && _s !== void 0 ? _s : undefined,
        legacyId: (_t = data.legacyId) !== null && _t !== void 0 ? _t : undefined,
        elapsed: (_u = data.elapsed) !== null && _u !== void 0 ? _u : null,
        statusShort: (_v = data.statusShort) !== null && _v !== void 0 ? _v : null,
        discussionCount: (_w = data.discussionCount) !== null && _w !== void 0 ? _w : 0,
    };
}
// ─── searchMatches callable ───
const MATCH_PAGE_SIZE = 100;
exports.searchMatches = functions
    .runWith({ timeoutSeconds: 30, memory: '256MB' })
    .https.onCall(async (data) => {
    const queryStr = data.query || '';
    const cursor = data.cursor || undefined;
    if (queryStr.length < 2)
        return { matches: [], nextCursor: null };
    const allTeams = await getTeamIndex();
    // Split query into individual search terms
    const terms = queryStr.toLowerCase().split(/[\s,\-]+/).filter((t) => t.length >= 2);
    if (terms.length === 0)
        return { matches: [], nextCursor: null };
    // For each term, find matching team IDs
    const teamIdSets = [];
    const allMatchingIds = new Set();
    for (const term of terms) {
        const ids = new Set();
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
    if (teamIdsToQuery.length === 0)
        return { matches: [], nextCursor: null };
    // On first page, fetch head-to-head matches for multi-term searches
    const h2hMatches = [];
    const h2hIds = new Set();
    if (!cursor && teamIdSets.length >= 2) {
        const pairs = [];
        for (let i = 0; i < teamIdSets.length && pairs.length < 4; i++) {
            for (let j = i + 1; j < teamIdSets.length && pairs.length < 4; j++) {
                const pickBest = (ids) => [...ids]
                    .map((id) => allTeams.find((t) => t.id === id))
                    .filter(Boolean)
                    .sort((a, b) => a.name.length - b.name.length)[0];
                const a = pickBest(teamIdSets[i]);
                const b = pickBest(teamIdSets[j]);
                if (a && b && a.id !== b.id)
                    pairs.push([a.id, b.id]);
            }
        }
        const pairQueries = [];
        for (const [a, b] of pairs) {
            pairQueries.push(db.collection('matches').where('homeTeam.id', '==', a).where('awayTeam.id', '==', b).orderBy('kickoff', 'desc'));
            pairQueries.push(db.collection('matches').where('homeTeam.id', '==', b).where('awayTeam.id', '==', a).orderBy('kickoff', 'desc'));
        }
        if (pairQueries.length > 0) {
            const h2hSnaps = await Promise.all(pairQueries.map((q) => q.get()));
            for (const snap of h2hSnaps) {
                for (const d of snap.docs) {
                    if (h2hIds.has(d.id))
                        continue;
                    h2hIds.add(d.id);
                    const matchData = d.data();
                    if (isValidMatch(matchData)) {
                        h2hMatches.push(docToMatch(matchData, d.id));
                    }
                }
            }
            h2hMatches.sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());
        }
    }
    // Build paginated queries for home/away
    let homeQ = db.collection('matches')
        .where('homeTeam.id', 'in', teamIdsToQuery)
        .orderBy('kickoff', 'desc');
    let awayQ = db.collection('matches')
        .where('awayTeam.id', 'in', teamIdsToQuery)
        .orderBy('kickoff', 'desc');
    if (cursor) {
        homeQ = homeQ.startAfter(cursor);
        awayQ = awayQ.startAfter(cursor);
    }
    homeQ = homeQ.limit(MATCH_PAGE_SIZE);
    awayQ = awayQ.limit(MATCH_PAGE_SIZE);
    const snapshots = await Promise.all([homeQ.get(), awayQ.get()]);
    // Track the oldest kickoff for next cursor
    let oldestKickoff = null;
    const seen = new Set();
    const allMatches = [];
    for (const snap of snapshots) {
        for (const d of snap.docs) {
            const matchData = d.data();
            const kickoff = matchData.kickoff;
            if (!oldestKickoff || kickoff < oldestKickoff)
                oldestKickoff = kickoff;
            if (seen.has(d.id) || h2hIds.has(d.id))
                continue;
            seen.add(d.id);
            if (isValidMatch(matchData)) {
                allMatches.push(docToMatch(matchData, d.id));
            }
        }
    }
    // Score each match by how many search terms it matches
    const matchScores = new Map();
    for (const m of allMatches) {
        let score = 0;
        for (const termIds of teamIdSets) {
            if (termIds.has(m.homeTeam.id) || termIds.has(m.awayTeam.id))
                score++;
        }
        matchScores.set(m.id, score);
    }
    // Sort: most matched terms first, then finished/live before upcoming, then by date
    allMatches.sort((a, b) => {
        const scoreA = matchScores.get(a.id) || 0;
        const scoreB = matchScores.get(b.id) || 0;
        if (scoreA !== scoreB)
            return scoreB - scoreA;
        const aLocked = a.status !== 'FINISHED' && a.status !== 'IN_PLAY' && a.status !== 'PAUSED';
        const bLocked = b.status !== 'FINISHED' && b.status !== 'IN_PLAY' && b.status !== 'PAUSED';
        if (aLocked !== bLocked)
            return aLocked ? 1 : -1;
        return new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime();
    });
    // Prepend head-to-head matches on first page
    const finalMatches = h2hMatches.length > 0 ? [...h2hMatches, ...allMatches] : allMatches;
    // Determine if there are more pages
    const hasMore = snapshots.some((s) => s.docs.length === MATCH_PAGE_SIZE);
    const nextCursor = hasMore && oldestKickoff ? oldestKickoff : null;
    return { matches: finalMatches, nextCursor };
});
//# sourceMappingURL=search.js.map