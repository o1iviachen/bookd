# Sync Logic

## Match Lifecycle

```
dailySync creates match doc (SCHEDULED)
  → liveSync updates scores every 2 min (IN_PLAY / PAUSED)
  → liveSync or stale check marks it FINISHED
  → detailBackfill fills in lineups/stats/events
  → computeAggregates rolls up popularity/ratings nightly
```

---

## Scheduled Functions

### 1. `dailySync` — 06:00 UTC daily

**Purpose:** Refresh match schedule, standings, and missing details.

**Steps:**
1. Fetch fixtures from API-Football for yesterday → day-after-tomorrow, across all tracked leagues
2. Write/merge each fixture as a match doc in Firestore
3. Fetch and write league standings for all tracked leagues
4. Find finished matches from the last 7 days missing details, sync them

**Firestore writes:**
- `matches/{fixtureId}` — full match doc (merge)
- `standings/{leagueCode}_{season}` — league table
- `matchDetails/{fixtureId}` — lineups/stats/events for recently finished matches
- Sets `hasDetails: true` on match docs after syncing details

**API-Football endpoints:**
- `GET /fixtures?league={id}&season={year}&from={date}&to={date}` — once per tracked league
- `GET /standings?league={id}&season={year}` — once per tracked league
- `GET /fixtures?id={id}` — for each match missing details
- `GET /fixtures/lineups?fixture={id}` — for each match missing details
- `GET /fixtures/events?fixture={id}` — for each match missing details
- `GET /fixtures/statistics?fixture={id}` — for each match missing details

**API calls:** ~15–50 per run (varies by league activity)

---

### 2. `liveSync` — every 2 minutes

**Purpose:** Update scores for in-play matches and catch stale matches.

**Steps:**
1. Call `getLiveFixtures()` — returns only currently in-play matches from API-Football
2. Filter to tracked leagues
3. Batch-write each fixture as a match doc (merge) with updated scores/status
4. Run stale match recovery:
   - `IN_PLAY` / `PAUSED` with kickoff **2+ hours ago** → re-fetch from API (should be finished)
   - `SCHEDULED` / `TIMED` with kickoff **3+ hours ago** → re-fetch from API (never went live)
   - Cap: 20 stale IDs per run (API-Football limit per `ids` request)

**Firestore writes:**
- `matches/{fixtureId}` — updated scores, status, `cachedAt` (merge)

**API-Football endpoints:**
- `GET /fixtures?live=all` — all currently in-play fixtures worldwide
- `GET /fixtures?id={id1}-{id2}-...` — batch re-fetch for stale matches (up to 20 IDs)

**API calls:** 1 (`getLiveFixtures`) + 0–1 (`getFixtures` for stale IDs)

---

### 3. `detailBackfill` — every 2 minutes

**Purpose:** Backfill lineups, stats, and events for finished matches.

**Steps:**
1. Query `matches` where `status == 'FINISHED'` and `hasDetails == false` (limit 28)
2. For each match, fetch 4 endpoints in parallel:
   - `getFixtureById()` — referee, venue info
   - `getFixtureLineups()` — starting XI, bench, formations, coaches
   - `getFixtureEvents()` — goals, bookings, substitutions, full timeline
   - `getFixtureStats()` — possession, shots, corners, fouls, etc.
3. Transform and write to `matchDetails` collection
4. Set `hasDetails: true` on the match doc
5. Stop immediately on 429 (rate limit)

**Firestore writes:**
- `matchDetails/{fixtureId}` — full detail doc with `syncedAt`
- `matches/{fixtureId}` — sets `hasDetails: true`

**API-Football endpoints (per match, in parallel):**
- `GET /fixtures?id={id}` — fixture info (referee, venue)
- `GET /fixtures/lineups?fixture={id}` — starting XI, bench, formations, coaches
- `GET /fixtures/events?fixture={id}` — goals, cards, substitutions
- `GET /fixtures/statistics?fixture={id}` — possession, shots, corners, etc.

**API calls:** ~112 per run (28 matches × 4 calls)
**Throughput:** ~20,160 matches/day (720 runs × 28)

---

### 4. `computeAggregates` — 03:00 UTC daily

**Purpose:** Pre-compute popular and highest-rated match lists from reviews.

**Steps:**
1. Paginate through all reviews in batches of 500
2. Count reviews per `matchId` (popularity) and sum ratings per `matchId`
3. Sort and write top results

**Firestore writes:**
- `aggregates/popularMatchIds` — `{ entries: [{matchId, count}], updatedAt }`
- `aggregates/highestRatedMatchIds` — `{ entries: [{matchId, avgRating, count}], updatedAt }`

**API calls:** 0 (Firestore-only)

---

## Data Written Per Sync

### Match doc (`matches/{fixtureId}`)

Written by `dailySync` and `liveSync` via `transformFixtureToMatch`:

| Field | Type | Description |
|-------|------|-------------|
| `id` | number | API-Football fixture ID |
| `competition` | object | `{ id, name, emblem, code }` |
| `homeTeam` | object | `{ id, name, shortName, crest }` |
| `awayTeam` | object | `{ id, name, shortName, crest }` |
| `homeScore` | number \| null | Goals scored by home team |
| `awayScore` | number \| null | Goals scored by away team |
| `status` | string | `SCHEDULED`, `TIMED`, `IN_PLAY`, `PAUSED`, `FINISHED`, `POSTPONED`, `CANCELLED`, `SUSPENDED` |
| `kickoff` | string | ISO 8601 timestamp |
| `venue` | string \| null | Stadium name |
| `matchday` | number \| null | Parsed from round string |
| `stage` | string \| null | Knockout stage (e.g. `QUARTER_FINALS`) or null for league play |
| `season` | number | Season year |
| `round` | string | Raw round string from API |
| `legacyId` | null | Reserved for football-data.org migration |
| `cachedAt` | timestamp | Server timestamp on each write |
| `hasDetails` | boolean | Set by `detailBackfill` |

Client-side writes (not from sync): `ratingSum`, `ratingCount`, `reviewCount`, `ratingBuckets`, `motmVotes`

---

### Match detail doc (`matchDetails/{fixtureId}`)

Written by `detailBackfill` and `dailySync` via `transformFixtureDetails`:

| Field | Type | Description |
|-------|------|-------------|
| `matchId` | number | Fixture ID |
| `kickoff` | string | ISO 8601 timestamp |
| `season` | number | Season year |
| `playerIds` | number[] | All player + coach IDs (for `array-contains` queries) |
| `homeLineup` | object[] | Starting XI: `{ id, name, position, shirtNumber }` |
| `homeBench` | object[] | Substitutes (same shape) |
| `awayLineup` | object[] | Starting XI |
| `awayBench` | object[] | Substitutes |
| `homeCoach` | object \| null | `{ id, name }` |
| `awayCoach` | object \| null | `{ id, name }` |
| `homeFormation` | string \| null | e.g. `"4-3-3"` |
| `awayFormation` | string \| null | |
| `goals` | object[] | `{ minute, team: {id}, scorer: {id, name}, assist: {id, name} \| null, detail }` |
| `bookings` | object[] | `{ minute, team: {id}, player: {id, name}, card }` — card: `YELLOW`, `RED`, `YELLOW_RED` |
| `substitutions` | object[] | `{ minute, team: {id}, playerOut: {id, name}, playerIn: {id, name} }` |
| `events` | object[] | Full timeline: `{ minute, extraMinute, teamId, playerId, playerName, assistId, assistName, type, detail, comments }` |
| `stats` | object \| null | `{ ballPossession, shots, shotsOnTarget, corners, fouls, offsides, yellowCards, redCards, saves }` — each as `[home, away]` |
| `referee` | string \| null | |
| `halfTimeScore` | object \| null | `{ home, away }` |
| `attendance` | null | Not available on current API tier |
| `syncedAt` | timestamp | Server timestamp |

---

### Standings doc (`standings/{leagueCode}_{season}`)

Written by `dailySync` and `manualSync` via `transformStandings`:

| Field | Type | Description |
|-------|------|-------------|
| `competitionCode` | string | e.g. `"PL"` |
| `season` | number | Season year |
| `table` | object[] | `{ position, team: {id, name, shortName, crest}, playedGames, won, draw, lost, goalsFor, goalsAgainst, goalDifference, points }` |
| `groups` | object[] \| undefined | Only for multi-group competitions (e.g. CL groups): `{ name, table[] }` |
| `syncedAt` | timestamp | |

---

## Status Mapping

API-Football status codes → internal `MatchStatus`:

| API Status | Mapped To | Meaning |
|------------|-----------|---------|
| `TBD`, `NS` | `SCHEDULED` | Not started |
| `1H`, `2H`, `ET`, `P`, `LIVE` | `IN_PLAY` | Match in progress |
| `HT`, `BT`, `INT` | `PAUSED` | Half-time / break |
| `FT`, `AET`, `PEN`, `AWD`, `WO` | `FINISHED` | Match complete |
| `PST` | `POSTPONED` | |
| `CANC`, `ABD` | `CANCELLED` | |
| `SUSP` | `SUSPENDED` | |

---

## Season Logic

```
European leagues (PL, La Liga, etc.): season = year when Aug–Dec, year-1 when Jan–Jul
Calendar-year leagues (MLS, BSA, ARG, JPL, AUS): season = current year
```

---

## Optimization Patterns

- **Batch writes**: 500-doc Firestore batches (Firestore limit)
- **Merge writes**: `{ merge: true }` preserves client-written fields (ratings, MOTM votes)
- **Flag-based backfill**: `hasDetails == false` query avoids scanning all finished matches
- **Batch existence checks**: `db.getAll()` instead of N+1 `getDoc()` calls
- **Rate limit handling**: Stops processing on 429 to avoid wasting API calls
- **Stale match recovery**: Catches matches stuck in wrong status (2–3 hour thresholds)
