import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const db = admin.firestore();

// ─── In-memory team cache (persists across warm invocations) ───

interface CompactTeam {
  id: number;
  name: string;
  shortName: string;
  crest: string;
  country: string;
  competitionCodes: string[];
}

let cachedTeams: CompactTeam[] | null = null;
let cachedTeamsTs = 0;
const TEAM_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

async function getTeamIndex(): Promise<CompactTeam[]> {
  if (cachedTeams && Date.now() - cachedTeamsTs < TEAM_CACHE_TTL) {
    return cachedTeams;
  }
  const snap = await db.collection('searchIndexes').doc('teams').get();
  if (!snap.exists) return [];
  cachedTeams = (snap.data()?.teams as CompactTeam[]) || [];
  cachedTeamsTs = Date.now();
  return cachedTeams;
}

// ─── Match helpers (mirrored from client footballApi.ts) ───

function cleanShortName(name: string, shortName?: string): string {
  if (shortName && shortName.length > 3) return shortName;
  const stripped = name
    .replace(/\b(FC|CF|AC|SC|SS|AS|US|RC|CD|UD|SD|SL|SK|IF|BK|FK|NK|GNK|TSG|VfB|VfL|1\.\s*FC|1\.\s*FSV|BSC|KRC|SV|SpVgg)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return stripped || name;
}

function isValidMatch(data: Record<string, any>): boolean {
  return (
    data.id != null &&
    data.competition?.id != null &&
    data.homeTeam?.id != null &&
    data.awayTeam?.id != null &&
    data.kickoff != null &&
    data.season != null
  );
}

function docToMatch(data: Record<string, any>, docId: string) {
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
    ratingBucketsHome: data.ratingBucketsHome ?? undefined,
    ratingBucketsAway: data.ratingBucketsAway ?? undefined,
    ratingBucketsNeutral: data.ratingBucketsNeutral ?? undefined,
    legacyId: data.legacyId ?? undefined,
    elapsed: data.elapsed ?? null,
    statusShort: data.statusShort ?? null,
    discussionCount: data.discussionCount ?? 0,
  };
}

// ─── searchMatches callable ───

const MATCH_PAGE_SIZE = 100;

export const searchMatches = functions
  .runWith({ timeoutSeconds: 30, memory: '256MB' })
  .https.onCall(async (data) => {
    const queryStr = (data.query as string) || '';
    const cursor = (data.cursor as string) || undefined;

    if (queryStr.length < 2) return { matches: [], nextCursor: null };

    const allTeams = await getTeamIndex();

    // Split query into individual search terms
    const terms = queryStr.toLowerCase().split(/[\s,\-]+/).filter((t: string) => t.length >= 2);
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

    // On first page, fetch head-to-head matches for multi-term searches
    const h2hMatches: any[] = [];
    const h2hIds = new Set<string>();

    if (!cursor && teamIdSets.length >= 2) {
      const pairs: [number, number][] = [];
      for (let i = 0; i < teamIdSets.length && pairs.length < 4; i++) {
        for (let j = i + 1; j < teamIdSets.length && pairs.length < 4; j++) {
          const pickBest = (ids: Set<number>) => [...ids]
            .map((id) => allTeams.find((t) => t.id === id)!)
            .filter(Boolean)
            .sort((a, b) => a.name.length - b.name.length)[0];
          const a = pickBest(teamIdSets[i]);
          const b = pickBest(teamIdSets[j]);
          if (a && b && a.id !== b.id) pairs.push([a.id, b.id]);
        }
      }

      const pairQueries: FirebaseFirestore.Query[] = [];
      for (const [a, b] of pairs) {
        pairQueries.push(
          db.collection('matches').where('homeTeam.id', '==', a).where('awayTeam.id', '==', b).orderBy('kickoff', 'desc')
        );
        pairQueries.push(
          db.collection('matches').where('homeTeam.id', '==', b).where('awayTeam.id', '==', a).orderBy('kickoff', 'desc')
        );
      }

      if (pairQueries.length > 0) {
        const h2hSnaps = await Promise.all(pairQueries.map((q) => q.get()));
        for (const snap of h2hSnaps) {
          for (const d of snap.docs) {
            if (h2hIds.has(d.id)) continue;
            h2hIds.add(d.id);
            const matchData = d.data();
            if (isValidMatch(matchData)) {
              h2hMatches.push(docToMatch(matchData, d.id));
            }
          }
        }
        h2hMatches.sort((a: any, b: any) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime());
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
    let oldestKickoff: string | null = null;
    const seen = new Set<string>();
    const allMatches: any[] = [];

    for (const snap of snapshots) {
      for (const d of snap.docs) {
        const matchData = d.data();
        const kickoff = matchData.kickoff as string;
        if (!oldestKickoff || kickoff < oldestKickoff) oldestKickoff = kickoff;

        if (seen.has(d.id) || h2hIds.has(d.id)) continue;
        seen.add(d.id);
        if (isValidMatch(matchData)) {
          allMatches.push(docToMatch(matchData, d.id));
        }
      }
    }

    // Score each match by how many search terms it matches
    const matchScores = new Map<number, number>();
    for (const m of allMatches) {
      let score = 0;
      for (const termIds of teamIdSets) {
        if (termIds.has(m.homeTeam.id) || termIds.has(m.awayTeam.id)) score++;
      }
      matchScores.set(m.id, score);
    }

    // Sort: most matched terms first, then finished/live before upcoming, then by date
    allMatches.sort((a: any, b: any) => {
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
  });
