# Cloud Functions Summary

## Scheduled Functions

| Function | Schedule | Description |
|----------|----------|-------------|
| `dailySync` | `0 6 * * *` (06:00 UTC daily) | Syncs yesterday's results, today + tomorrow's schedule, league standings, and missing match details |
| `liveSync` | Every 2 minutes | Updates scores for currently in-play matches |
| `detailBackfill` | Every 2 minutes | Syncs lineups/stats/events for finished matches missing details (`hasDetails == false`). ~28 matches per run |
| `computeAggregates` | `0 3 * * *` (03:00 UTC daily) | Paginates all reviews and writes pre-computed popular + highest-rated match lists to `aggregates` collection |

## Firestore Triggers

| Function | Trigger | Description |
|----------|---------|-------------|
| `sendPushNotification` | `onCreate` on `notifications/{id}` | Sends Expo push notification based on notification type and user preferences |
| `moderateReviewMedia` | `onWrite` on `reviews/{id}` | Checks review media URLs via Google Cloud Vision SafeSearch; flags inappropriate content |

## Callable Functions (client-invoked)

| Function | Description |
|----------|-------------|
| `deleteAccount` | Deletes all user data (reviews, comments, lists, notifications, user doc) and Firebase Auth account |
| `submitReport` | Saves a content report to Firestore and emails admin (if email env vars configured) |

## HTTP Functions (admin/manual)

### Data Sync
| Function | Endpoint | Description |
|----------|----------|-------------|
| `backfill` | `GET /backfill?league=PL&season=2023&details=true` | Backfill historical match data for a league/season. Requires `ADMIN_KEY` bearer token |
| `manualSync` | `GET /manualSync?from=2024-01-01&to=2024-01-07` | Sync matches for a date range. Also supports `?action=standings` |
| `syncDetailsForLeague` | `GET /syncDetailsForLeague?league=PL&season=2024&limit=50` | Sync match details (lineups/stats/events) for a league+season |

### Team & Player Data
| Function | Endpoint | Description |
|----------|----------|-------------|
| `buildTeams` | `GET /buildTeams` | Build team documents from existing match data |
| `buildPlayers` | `GET /buildPlayers` | Build player documents and enrich teams with coach/squad from match details |
| `enrichTeams` | `GET /enrichTeams?limit=100` | Fetch team colors and venue info from API-Football |
| `enrichPlayers` | `GET /enrichPlayers?limit=50&offset=0` | Enrich player docs with photos from API-Football squads endpoint |

### Migrations (one-time)
| Function | Endpoint | Description |
|----------|----------|-------------|
| `backfillMatchDetailKickoffs` | `GET /backfillMatchDetailKickoffs` | Add kickoff + season fields to matchDetails docs |
| `migrateHasDetails` | `GET /migrateHasDetails` | Set `hasDetails` flag on all match docs (enables efficient detailBackfill query) |
| `fixPlayerNames` | `GET /fixPlayerNames` | Apply shortName() logic to player names |
| `migratePlayerNames` | `GET /migratePlayerNames` | Add `nameLower` field to player docs for search |
| `migrateSearchPrefixes` | `GET /migrateSearchPrefixes` | Add `searchPrefixes` array to player docs for word-level search |
| `migrateLeagueTier` | `GET /migrateLeagueTier` | Set `leagueTier` on player docs based on their team's competition |
| `backfillPlayerIds` | `GET /backfillPlayerIds?limit=500` | Add `playerIds` array to matchDetails docs for array-contains queries |
| `backfillMatchRatings` | `GET /backfillMatchRatings` | Recompute ratingSum/ratingCount/reviewCount/ratingBuckets for all matches from reviews |
| `migrateLegacyMatches` | `GET /migrateLegacyMatches?dryRun=false` | Remap football-data.org match IDs to API-Football IDs, migrate reviews |
| `auditTeamIds` | `GET /auditTeamIds?dryRun=false` | Find and fix team ID mismatches across all matches, clean up stale team docs |

### Diagnostics
| Function | Endpoint | Description |
|----------|----------|-------------|
| `triggerAggregates` | `GET /triggerAggregates` | Manual trigger for `computeAggregates` (same logic, HTTP instead of scheduled) |
| `diagnoseTeams` | `GET /diagnoseTeams?names=wolves,arsenal` | Find matches where team name/crest conflicts exist |
