# Sync Logic

## Match Lifecycle

```
dailyPrepopulate creates match doc (SCHEDULED, hasDetails: false)
  → lineupSync fetches lineups 60 min before kickoff (every 5 min)
  → liveSync updates scores/events/stats every 1 min (IN_PLAY / PAUSED)
  → liveSync detects FINISHED transition → full detail sync (hasDetails: true) → standings update
  → staleSync catches missed matches hourly (safety net) → standings update
  → computeAggregates rolls up popularity/ratings nightly
```

---

## Scheduled Functions

### 1. `dailyPrepopulate` — 05:00 UTC daily

**Purpose:** 7-day match lookahead and standings refresh.

**Steps:**
1. Fetch fixtures from API-Football for yesterday → 7 days ahead, across all tracked leagues
2. Write/merge each fixture as a match doc in Firestore
3. Fetch and write league standings for all tracked leagues

**Firestore writes:**
- `matches/{fixtureId}` — full match doc (merge)
- `standings/{leagueCode}_{season}` — league table

**API-Football endpoints:**
- `GET /fixtures?league={id}&season={year}&from={date}&to={date}` — once per tracked league
- `GET /standings?league={id}&season={year}` — once per tracked league

**API calls:** ~60 per run

---

### 2. `lineupSync` — every 5 minutes

**Purpose:** Fetch pre-match lineups for matches starting within 60 minutes.

**Steps:**
1. Query `matches` where `status IN ['SCHEDULED', 'TIMED']` and `kickoff` within next 60 min
2. For each match:
   a. If **>10 min to kickoff**: check if `matchDetails/{id}` already has lineups → skip if yes
   b. If **≤10 min to kickoff**: always fetch (override for last-minute changes)
   c. Call `getFixtureLineups(fixtureId)` — 1 API call
   d. If lineups have players, transform with `transformLineupOnly()` and merge-write to `matchDetails/{id}`

**Firestore writes:**
- `matchDetails/{fixtureId}` — lineup-only doc (merge): lineups, bench, coaches, formations, playerIds

**API-Football endpoints:**
- `GET /fixtures/lineups?fixture={id}` — once per match in the 60-min window

**API calls:** ~6,000/day (1 per match × up to 12 attempts per match before lineup found)

---

### 3. `liveSync` — every 1 minute

**Purpose:** Update scores, events, and stats for in-play matches. Detect match completion and trigger full detail sync.

**Steps:**
1. Query today's matches from Firestore (`kickoff` within today UTC)
2. Group by `competition.code`, compute per-league active window:
   - `earliest` = min kickoff in league
   - `latest` = max kickoff in league
   - League is **active** if: `now >= earliest - 15min AND (now <= latest + 3hrs OR !allFinished)`
3. For each **active league**:
   a. Call `getFixtures({ league: apiId, season, date: todayStr })` — 1 API call
   b. Batch-write returned fixtures to `matches` collection (scores, status, elapsed)
   c. Classify each fixture:
      - **Live** (`IN_PLAY` / `PAUSED`): add to live list
      - **Just finished** (API says `FINISHED`, Firestore was `IN_PLAY` / `PAUSED`): add to just-finished list
4. For each **live match** — update events + stats:
   a. Call `getFixtureEvents(id)` + `getFixtureStats(id)` — 2 API calls
   b. Transform with `transformLiveEventDetails()`
   c. Merge-write to `matchDetails/{id}`
5. For each **just-finished match** — full detail sync:
   a. Call `syncMatchDetails([id], true)` — 4 API calls (fixture + lineups + events + stats)
   b. Writes complete `matchDetails` doc and sets `hasDetails: true` on match
6. If any matches just finished in this league — **update standings**:
   a. Call `syncLeagueStandings(code, apiId, season)` — 1 API call
   b. Writes updated league table to `standings/{code}_{season}`

**Firestore writes:**
- `matches/{fixtureId}` — updated scores, status, elapsed, `cachedAt` (merge)
- `matchDetails/{fixtureId}` — events/stats during match (merge), full doc on finish
- `standings/{leagueCode}_{season}` — updated when matches finish in a league

**API-Football endpoints (per cycle):**
- `GET /fixtures?league={id}&season={year}&date={today}` — once per active league
- `GET /fixtures/events?fixture={id}` — once per live match
- `GET /fixtures/statistics?fixture={id}` — once per live match
- `GET /fixtures?id={id}` + lineups + events + stats — 4 calls per just-finished match
- `GET /standings?league={id}&season={year}` — once per league with just-finished matches

**API calls (peak example — 10 active leagues, 50 live matches):**
- League fixtures: 10 calls
- Live events+stats: 50 × 2 = 100 calls
- Just-finished details: ~5 × 4 = 20 calls
- Standings updates: ~5 calls (leagues with finished matches)
- Total: ~135 calls/min. Estimated ~13,000/day.

---

### 4. `staleSync` — every 1 hour

**Purpose:** Safety net for matches that finished but were missed by live sync (e.g., during function downtime).

**Steps:**
1. Query `matches` where `status == 'FINISHED'` and `hasDetails == false` and `kickoff <= (now - 4hrs)`, limit 50
2. Query `matches` where `status == 'IN_PLAY'` or `'PAUSED'` and `kickoff <= (now - 3hrs)`, limit 20 each (stuck matches)
3. For finished matches: call `syncMatchDetails([id])` — 4 API calls each
4. For stuck matches: re-fetch fixture from API to update status. If now FINISHED, sync details
5. **Update standings** for each league that had finished matches — 1 API call per league
6. Sets `hasDetails: true` on match doc after successful detail sync

**Firestore writes:**
- `matchDetails/{fixtureId}` — full detail doc with `syncedAt`
- `matches/{fixtureId}` — sets `hasDetails: true`; stuck matches also get status update
- `standings/{leagueCode}_{season}` — updated for leagues with finished matches

**API-Football endpoints (per match):**
- `GET /fixtures?id={id}` — fixture info (also used to re-fetch stuck matches)
- `GET /fixtures/lineups?fixture={id}` — lineups
- `GET /fixtures/events?fixture={id}` — events
- `GET /fixtures/statistics?fixture={id}` — stats
- `GET /standings?league={id}&season={year}` — once per league with finished matches

**API calls:** ~200/hour max (50 × 4 + standings). Safety net only; most matches get details from live sync.

---

### 5. `computeAggregates` — 03:00 UTC daily

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

## API Budget

| Function | Schedule | API Calls/Day |
|----------|----------|---------------|
| `dailyPrepopulate` | Daily 05:00 UTC | ~60 |
| `lineupSync` | Every 5 min | ~6,000 |
| `liveSync` | Every 1 min | ~13,000 |
| `staleSync` | Every 1 hour | ~200 |
| **Total** | | **~19,260** |

Daily limit: 75,000 requests. Headroom: ~55,000 for manual syncs, backfills, and spikes.

---

## Data Written Per Sync

### Match doc (`matches/{fixtureId}`)

Written by `dailyPrepopulate` and `liveSync` via `transformFixtureToMatch`:

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
| `elapsed` | number \| null | Current match minute (e.g. 45, 90+3) — enables live minute display |
| `hasDetails` | boolean | `false` on creation, set `true` after full detail sync |
| `legacyId` | null | Reserved for football-data.org migration |
| `cachedAt` | timestamp | Server timestamp on each write |

Client-side writes (not from sync): `ratingSum`, `ratingCount`, `reviewCount`, `ratingBuckets`, `motmVotes`

---

### Match detail doc (`matchDetails/{fixtureId}`)

Written progressively by `lineupSync`, `liveSync`, and `staleSync`:

**Phase 1 — Pre-match (lineupSync, via `transformLineupOnly`):**

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

**Phase 2 — Live (liveSync, via `transformLiveEventDetails`):**

| Field | Type | Description |
|-------|------|-------------|
| `goals` | object[] | `{ minute, team: {id}, scorer: {id, name}, assist: {id, name} \| null, detail }` |
| `bookings` | object[] | `{ minute, team: {id}, player: {id, name}, card }` — card: `YELLOW`, `RED`, `YELLOW_RED` |
| `substitutions` | object[] | `{ minute, team: {id}, playerOut: {id, name}, playerIn: {id, name} }` |
| `events` | object[] | Full timeline: `{ minute, extraMinute, teamId, playerId, playerName, assistId, assistName, type, detail, comments }` |
| `stats` | object \| null | `{ ballPossession, shots, shotsOnTarget, corners, fouls, offsides, yellowCards, redCards, saves }` — each as `[home, away]` |
| `referee` | string \| null | |
| `halfTimeScore` | object \| null | `{ home, away }` |

**Phase 3 — Finished (liveSync or staleSync, via `transformFixtureDetails`):**

All fields above, plus full lineups/bench/coaches if not already present. Sets `hasDetails: true` on match doc.

| Field | Type | Description |
|-------|------|-------------|
| `attendance` | null | Not available on current API tier |
| `syncedAt` | timestamp | Server timestamp |

---

### Standings doc (`standings/{leagueCode}_{season}`)

Written by `dailyPrepopulate`, `liveSync` (on match finish), `staleSync` (on match finish), and `manualSync` via `transformStandings`:

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
- **Merge writes**: `{ merge: true }` preserves client-written fields (ratings, MOTM votes) and allows progressive matchDetails enrichment
- **Flag-based backfill**: `hasDetails == false` query avoids scanning all finished matches
- **Per-league active windows**: Only queries leagues with matches in the relevant time window, avoiding unnecessary API calls
- **Transition detection**: Compares API status vs Firestore status to detect match completion and trigger full detail sync
- **Early exit for lineups**: Skips matches that already have lineups (unless within 10 min of kickoff)
- **Rate limit handling**: Stops processing on 429 to avoid wasting API calls
