export interface Team {
  id: number;
  name: string;
  shortName: string;
  crest: string;
}

export interface Competition {
  id: number;
  name: string;
  emblem: string;
  code: string;
}

export type MatchStatus =
  | 'SCHEDULED'
  | 'TIMED'
  | 'IN_PLAY'
  | 'PAUSED'
  | 'FINISHED'
  | 'POSTPONED'
  | 'CANCELLED'
  | 'SUSPENDED';

export interface Coach {
  id: number;
  name: string;
}

export interface Match {
  id: number;
  competition: Competition;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number | null;
  awayScore: number | null;
  status: MatchStatus;
  kickoff: string;
  venue: string | null;
  matchday: number | null;
  stage: string | null;
  // Aggregate stats — updated atomically on review write/delete
  ratingSum?: number;
  ratingCount?: number;
  // Computed on read from ratingSum/ratingCount — not stored in Firestore
  avgRating?: number;
  reviewCount?: number;
  // Per-bucket rating counts: key = rating × 10 as string (e.g. 3.5 → "35")
  ratingBuckets?: Record<string, number>;
  // Fan-type-specific rating buckets (same key format as ratingBuckets)
  ratingBucketsHome?: Record<string, number>;
  ratingBucketsAway?: Record<string, number>;
  ratingBucketsNeutral?: Record<string, number>;
  // Legacy ID from football-data.org migration — reviews may reference this old ID
  legacyId?: number;
  motmVotes?: Record<string, number>;

  elapsed?: number | null;
  statusShort?: string | null;
}
