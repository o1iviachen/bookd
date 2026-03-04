import {
  collection,
  doc,
  getDoc,
  getDocs,
  writeBatch,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../config/firebase';
import { Match } from '../../types/match';

const MATCHES_COLLECTION = 'matches';

function matchToDoc(match: Match): Record<string, any> {
  return {
    id: match.id,
    competition: match.competition,
    homeTeam: match.homeTeam,
    awayTeam: match.awayTeam,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    status: match.status,
    kickoff: match.kickoff,
    venue: match.venue,
    matchday: match.matchday,
    stage: match.stage ?? null,
    cachedAt: serverTimestamp(),
  };
}

function docToMatch(data: Record<string, any>, docId: string): Match {
  return {
    id: Number(docId),
    competition: data.competition,
    homeTeam: data.homeTeam,
    awayTeam: data.awayTeam,
    homeScore: data.homeScore,
    awayScore: data.awayScore,
    status: data.status,
    kickoff: data.kickoff,
    venue: data.venue,
    matchday: data.matchday,
    stage: data.stage ?? null,
  };
}

export async function getCachedMatch(matchId: number): Promise<Match | null> {
  const docSnap = await getDoc(doc(db, MATCHES_COLLECTION, String(matchId)));
  if (!docSnap.exists()) return null;
  return docToMatch(docSnap.data(), docSnap.id);
}

export async function setCachedMatch(match: Match): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, MATCHES_COLLECTION, String(match.id)), matchToDoc(match));
  await batch.commit();
}

export async function getCachedMatchesByIds(matchIds: number[]): Promise<Map<number, Match>> {
  const result = new Map<number, Match>();
  if (matchIds.length === 0) return result;

  const batches: number[][] = [];
  for (let i = 0; i < matchIds.length; i += 30) {
    batches.push(matchIds.slice(i, i + 30));
  }

  for (const batch of batches) {
    const q = query(
      collection(db, MATCHES_COLLECTION),
      where('id', 'in', batch)
    );
    const snapshot = await getDocs(q);
    snapshot.docs.forEach((d) => {
      const match = docToMatch(d.data(), d.id);
      result.set(match.id, match);
    });
  }

  return result;
}

export async function getCachedMatchesByDate(dateStr: string): Promise<Match[]> {
  // dateStr format: "2025-01-15"
  // kickoff is stored as ISO string, so we query for strings starting with dateStr
  const startOfDay = `${dateStr}T00:00:00Z`;
  const endOfDay = `${dateStr}T23:59:59Z`;
  const q = query(
    collection(db, MATCHES_COLLECTION),
    where('kickoff', '>=', startOfDay),
    where('kickoff', '<=', endOfDay)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => docToMatch(d.data(), d.id));
}

export async function setCachedMatches(matches: Match[]): Promise<void> {
  if (matches.length === 0) return;

  // Firestore writeBatch max is 500 operations
  const batchSize = 500;
  for (let i = 0; i < matches.length; i += batchSize) {
    const chunk = matches.slice(i, i + batchSize);
    const batch = writeBatch(db);
    for (const match of chunk) {
      batch.set(doc(db, MATCHES_COLLECTION, String(match.id)), matchToDoc(match));
    }
    await batch.commit();
  }
}
