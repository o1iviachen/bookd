import * as admin from 'firebase-admin';
import { getFixtures, getFixtureEvents, getFixtureStats } from '../apiFootball';
import { transformFixtureToMatch, transformLiveEventDetails } from '../transforms';
import { COLLECTIONS, FIRESTORE_BATCH_SIZE } from '../config';
import { getEnabledLeagues, getLeagueByApiIdMap, getSeasonForLeague } from '../leagueHelper';
import { syncMatchDetails } from './syncDetails';
import { syncLeagueStandings } from './syncStandings';

const db = admin.firestore();

const TERMINAL_STATUSES = new Set(['FINISHED', 'CANCELLED', 'POSTPONED']);
const LIVE_STATUSES = new Set(['IN_PLAY', 'PAUSED', 'SUSPENDED']);
const PRE_WINDOW_MINS = 15;
const POST_WINDOW_HRS = 3;

interface LeagueWindow {
  code: string;
  apiId: number;
  season: number;
  earliest: number; // ms
  latest: number;   // ms
  allFinished: boolean;
  matchStatuses: Map<number, string>; // fixtureId → Firestore status
}

/**
 * Per-minute live sync: fetches fixtures per active league, updates scores/status,
 * and fetches events/stats for each live match.
 * Detects FINISHED transitions and runs full detail sync for just-finished matches.
 */
export async function syncLiveMatches(): Promise<{ matchesUpdated: number; detailsUpdated: number }> {
  let matchesUpdated = 0;
  let detailsUpdated = 0;

  try {
    const now = Date.now();
    const leagues = await getEnabledLeagues();
    const leagueMap = await getLeagueByApiIdMap();
    const leagueByCode = new Map(leagues.map((l) => [l.code, l]));

    // 1. Query today's matches from Firestore
    const todayStart = startOfDayUTC(new Date());
    const todayEnd = endOfDayUTC(new Date());

    const snap = await db.collection(COLLECTIONS.MATCHES)
      .where('kickoff', '>=', todayStart)
      .where('kickoff', '<=', todayEnd)
      .get();

    console.log(`[liveSync] Found ${snap.size} matches today (${todayStart} to ${todayEnd})`);

    if (snap.empty) {
      return { matchesUpdated: 0, detailsUpdated: 0 };
    }

    // 2. Group by league and compute windows
    const windowMap = new Map<string, LeagueWindow>();

    for (const doc of snap.docs) {
      const data = doc.data();
      const code = data.competition?.code as string;
      if (!code) continue;

      const kickoffMs = new Date(data.kickoff).getTime();
      const status = data.status as string;
      const fixtureId = data.id as number;

      let win = windowMap.get(code);
      if (!win) {
        const league = leagueByCode.get(code);
        if (!league) continue;
        win = {
          code,
          apiId: league.apiId,
          season: getSeasonForLeague(league),
          earliest: kickoffMs,
          latest: kickoffMs,
          allFinished: true,
          matchStatuses: new Map(),
        };
        windowMap.set(code, win);
      }

      if (kickoffMs < win.earliest) win.earliest = kickoffMs;
      if (kickoffMs > win.latest) win.latest = kickoffMs;
      if (!TERMINAL_STATUSES.has(status)) win.allFinished = false;
      win.matchStatuses.set(fixtureId, status);
    }

    for (const [code, win] of windowMap) {
      const ids = [...win.matchStatuses.entries()].map(([id, s]) => `${id}(${s})`).join(', ');
      console.log(`[liveSync] ${code}: ${win.matchStatuses.size} matches [${ids}]`);
    }

    // 3. Process each active league
    for (const win of windowMap.values()) {
      // Check if league is in active window
      const windowStart = win.earliest - PRE_WINDOW_MINS * 60 * 1000;
      const windowEnd = win.latest + POST_WINDOW_HRS * 60 * 60 * 1000;

      if (now < windowStart) {
        console.log(`[liveSync] ${win.code}: skipped (window starts in ${((windowStart - now) / 60000).toFixed(0)} min)`);
        continue;
      }
      if (now > windowEnd && win.allFinished) {
        console.log(`[liveSync] ${win.code}: skipped (all finished, window ended ${((now - windowEnd) / 60000).toFixed(0)} min ago)`);
        continue;
      }

      // Fetch fixtures from API for this league
      const dateStr = formatDateUTC(new Date());
      const fixtures = await getFixtures({
        league: win.apiId,
        season: win.season,
        from: dateStr,
        to: dateStr,
        timezone: 'UTC',
      });

      console.log(`[liveSync] ${win.code}: API returned ${fixtures.length} fixtures (apiId=${win.apiId}, season=${win.season}, date=${dateStr})`);
      if (fixtures.length === 0) continue;

      // Batch-write match updates
      const liveIds: number[] = [];
      const justFinishedIds: number[] = [];
      const fixtureById = new Map<number, typeof fixtures[0]>();

      for (let i = 0; i < fixtures.length; i += FIRESTORE_BATCH_SIZE) {
        const chunk = fixtures.slice(i, i + FIRESTORE_BATCH_SIZE);
        const batch = db.batch();

        for (const fixture of chunk) {
          const matchDoc = transformFixtureToMatch(fixture, leagueMap);
          if (!matchDoc) continue;

          const fid = fixture.fixture.id;
          fixtureById.set(fid, fixture);

          const ref = db.collection(COLLECTIONS.MATCHES).doc(String(fid));
          const isNew = !win.matchStatuses.has(fid);
          batch.set(ref, {
            ...matchDoc,
            ...(isNew && { hasDetails: false }),
            cachedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true });

          const apiStatus = matchDoc.status;
          const fsStatus = win.matchStatuses.get(fid);

          if (LIVE_STATUSES.has(apiStatus)) {
            liveIds.push(fid);
          }

          // Detect FINISHED transition: was live/scheduled, now finished
          if (apiStatus === 'FINISHED' && fsStatus && !TERMINAL_STATUSES.has(fsStatus)) {
            justFinishedIds.push(fid);
          }

          matchesUpdated++;
        }

        await batch.commit();
      }

      console.log(`[liveSync] ${win.code}: ${liveIds.length} live [${liveIds.join(',')}], ${justFinishedIds.length} just-finished [${justFinishedIds.join(',')}]`);

      // Fetch events + stats for live matches
      for (const fid of liveIds) {
        try {
          const fixture = fixtureById.get(fid)!;
          const [events, stats] = await Promise.all([
            getFixtureEvents(fid),
            getFixtureStats(fid),
          ]);

          console.log(`[liveSync] ${fid} API events(${events.length}): ${JSON.stringify(events.slice(0, 3))}`);
          console.log(`[liveSync] ${fid} API stats(${stats.length}): ${JSON.stringify(stats.map((s) => ({ team: s.team.id, stats: s.statistics?.slice(0, 4) })))}`);

          const detailDoc = transformLiveEventDetails(fid, events, stats, fixture);

          console.log(`[liveSync] ${fid} writing matchDetails: goals=${detailDoc.goals?.length}, bookings=${detailDoc.bookings?.length}, subs=${detailDoc.substitutions?.length}, events=${detailDoc.events?.length}, hasStats=${!!detailDoc.stats}`);

          await db.collection(COLLECTIONS.MATCH_DETAILS).doc(String(fid)).set(
            { ...detailDoc, syncedAt: admin.firestore.FieldValue.serverTimestamp() },
            { merge: true },
          );

          detailsUpdated++;
        } catch (err: any) {
          console.error(`[liveSync] Error fetching details for ${fid}:`, err.message);
        }
      }

      // Full detail sync for just-finished matches
      for (const fid of justFinishedIds) {
        try {
          await syncMatchDetails([fid], true);
          detailsUpdated++;
          console.log(`[liveSync] Full detail sync for just-finished match ${fid}`);
        } catch (err: any) {
          console.error(`[liveSync] Error syncing finished match ${fid}:`, err.message);
        }
      }

      // Update standings when matches finish in this league
      if (justFinishedIds.length > 0) {
        try {
          await syncLeagueStandings(win.code, win.apiId, win.season);
          console.log(`[liveSync] ${win.code}: standings updated after ${justFinishedIds.length} match(es) finished`);
        } catch (err: any) {
          console.error(`[liveSync] ${win.code}: error updating standings:`, err.message);
        }
      }

      if (liveIds.length > 0 || justFinishedIds.length > 0) {
        console.log(
          `[liveSync] ${win.code}: ${fixtures.length} fixtures, ` +
          `${liveIds.length} live, ${justFinishedIds.length} just finished`,
        );
      }
    }

    return { matchesUpdated, detailsUpdated };
  } catch (err: any) {
    console.error('[liveSync] Error:', err.message);
    return { matchesUpdated, detailsUpdated };
  }
}

// ─── Helpers ───

function startOfDayUTC(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfDayUTC(date: Date): string {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d.toISOString();
}

function formatDateUTC(date: Date): string {
  return date.toISOString().split('T')[0];
}
