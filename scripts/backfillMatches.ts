/**
 * Backfill script: fetches 5 years of match history from football-data.org
 * and caches it in Firestore.
 *
 * Usage:
 *   npx ts-node scripts/backfillMatches.ts
 *
 * Prerequisites:
 *   npm install --save-dev firebase-admin ts-node typescript
 *
 * The script respects the free-tier rate limit of 10 requests/minute
 * by waiting 7 seconds between each API call.
 */

import * as admin from 'firebase-admin';
import axios from 'axios';

// --- Firebase Admin Setup ---
const serviceAccount = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!serviceAccount) {
  console.log('Tip: Set GOOGLE_APPLICATION_CREDENTIALS env var to your service account JSON path.');
  console.log('Falling back to default credentials...\n');
}

admin.initializeApp({
  credential: serviceAccount
    ? admin.credential.cert(serviceAccount)
    : admin.credential.applicationDefault(),
  projectId: 'bookd-ff19a',
});

const db = admin.firestore();

// --- Football API Setup ---
const FOOTBALL_API_KEY = '60f29fe942f8450aa17a04d6544509f8';
const api = axios.create({
  baseURL: 'https://api.football-data.org/v4',
  timeout: 15000,
  headers: { 'X-Auth-Token': FOOTBALL_API_KEY },
});

// --- Competition codes (from FOLLOWABLE_LEAGUES in constants.ts) ---
const COMPETITIONS = ['PL', 'BL1', 'PD', 'SA', 'FL1', 'CL', 'ELC', 'DED', 'PPL', 'BSA'];

// Seasons to backfill (football-data.org uses the starting year)
const SEASONS = [2021, 2022, 2023, 2024, 2025];

const COMPETITION_NAME_MAP: Record<string, string> = {
  'Primera Division': 'La Liga',
  'Série A': 'Serie A',
  'Ligue 1 Uber Eats': 'Ligue 1',
};

interface ApiMatch {
  id: number;
  competition: { id: number; name: string; emblem: string; code: string };
  homeTeam: { id: number; name: string; shortName: string; crest: string };
  awayTeam: { id: number; name: string; shortName: string; crest: string };
  score: { fullTime: { home: number | null; away: number | null } };
  status: string;
  utcDate: string;
  venue: string | null;
  matchday: number | null;
}

function transformMatch(m: ApiMatch) {
  return {
    id: m.id,
    competition: {
      id: m.competition.id,
      name: COMPETITION_NAME_MAP[m.competition.name] || m.competition.name,
      emblem: m.competition.emblem,
      code: m.competition.code,
    },
    homeTeam: {
      id: m.homeTeam.id,
      name: m.homeTeam.name,
      shortName: m.homeTeam.shortName,
      crest: m.homeTeam.crest,
    },
    awayTeam: {
      id: m.awayTeam.id,
      name: m.awayTeam.name,
      shortName: m.awayTeam.shortName,
      crest: m.awayTeam.crest,
    },
    homeScore: m.score.fullTime.home,
    awayScore: m.score.fullTime.away,
    status: m.status,
    kickoff: m.utcDate,
    venue: m.venue,
    matchday: m.matchday,
    cachedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function backfill() {
  let totalCached = 0;
  let totalRequests = 0;

  for (const code of COMPETITIONS) {
    for (const season of SEASONS) {
      totalRequests++;
      console.log(`[${totalRequests}] Fetching ${code} season ${season}...`);

      try {
        const response = await api.get(`/competitions/${code}/matches`, {
          params: { season, status: 'FINISHED' },
        });

        const matches: ApiMatch[] = response.data.matches || [];
        const finishedMatches = matches.filter((m) => m.status === 'FINISHED');

        if (finishedMatches.length === 0) {
          console.log(`  → No finished matches found.`);
        } else {
          // Batch write to Firestore (max 500 per batch)
          const batchSize = 500;
          for (let i = 0; i < finishedMatches.length; i += batchSize) {
            const chunk = finishedMatches.slice(i, i + batchSize);
            const batch = db.batch();
            for (const match of chunk) {
              const docRef = db.collection('matches').doc(String(match.id));
              batch.set(docRef, transformMatch(match));
            }
            await batch.commit();
          }

          totalCached += finishedMatches.length;
          console.log(`  → Cached ${finishedMatches.length} matches. (Total: ${totalCached})`);
        }
      } catch (err: any) {
        if (err.response?.status === 429) {
          console.log(`  → Rate limited! Waiting 60s...`);
          await sleep(60000);
          // Retry this combination
          totalRequests--;
          continue;
        }
        console.error(`  → Error: ${err.message}`);
      }

      // Rate limit: ~7s between requests (10 req/min)
      await sleep(7000);
    }
  }

  console.log(`\nDone! Cached ${totalCached} matches total across ${totalRequests} API calls.`);
  process.exit(0);
}

backfill().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
