# Search Architecture

## What Changed (March 2026)

| Area | Before | After |
|------|--------|-------|
| **Matches** | Client fetches all ~1,836 teams + 3-7 Firestore round trips | 1 Cloud Function call (`searchMatches`) |
| **Teams** | Client fetches all ~1,836 team docs (full collection scan) | 1 doc read from `searchIndexes/teams` |
| **Lists** | Fetches top 100 lists, client-side string filter | Firestore `array-contains` on `searchPrefixes` field |
| **Reviews** | Fetches top 100 reviews, client-side filter | **Removed** from search |
| **Players** | Firestore prefix query on `searchPrefixes` | No change |
| **Users** | Firestore prefix query on `searchPrefixes` | No change |

---

## Matches Search

**Architecture**: Cloud Function (`searchMatches`) — callable via `httpsCallable`

**Flow**:
1. Client calls `searchMatchesQuery(query, cursor?)` in `footballApi.ts`
2. This invokes the `searchMatches` Cloud Function (1 HTTPS call)
3. Cloud Function reads team index from in-memory cache (5-min TTL) or falls back to `searchIndexes/teams` doc
4. Splits query into terms, finds matching team IDs in memory
5. For multi-term queries (e.g. "arsenal chelsea"), runs head-to-head Firestore queries first
6. Runs paginated home/away `in` queries on `matches` collection
7. Scores matches by how many search terms they match, sorts by relevance + date
8. Returns `{ matches, nextCursor }` to client

**Key files**:
- `functions/src/search.ts` — Cloud Function implementation
- `src/services/footballApi.ts` — `searchMatchesQuery()` calls the function
- `src/hooks/useTeams.ts` — `useSearchMatches` hook (unchanged interface)

**Performance**: ~200-400ms per search (was 2-5s). Cold start adds 1-3s on first call after idle.

---

## Teams Search

**Architecture**: Single Firestore document at `searchIndexes/teams`

**Flow**:
1. Client calls `getAllTeams()` in `footballApi.ts`
2. Reads single doc `searchIndexes/teams` — contains compact array of all teams
3. React Query caches with `staleTime: Infinity` (data only changes via background rebuild)
4. `useSearchTeams` hook filters cached array in memory by query string
5. Results split into clubs vs national teams, sorted by league tier

**Index rebuild workflow** (when teams change):
- `onTeamWrite` trigger in `functions/src/index.ts` fires on any `teams/{teamId}` write
- Calls `rebuildTeamSearchIndex()` in `functions/src/sync/backfill.ts`
- Reads all team docs, writes compact `{id, name, shortName, crest, country, competitionCodes}` array to `searchIndexes/teams`
- Note: batch team operations trigger multiple rebuilds — consider debouncing or calling explicitly after batch completes

**Key files**:
- `functions/src/sync/backfill.ts` — `rebuildTeamSearchIndex()`
- `functions/src/index.ts` — `onTeamWrite` trigger, `rebuildTeamIndex` HTTP endpoint
- `src/services/footballApi.ts` — `getAllTeams()` reads index doc
- `src/hooks/useTeams.ts` — `useSearchTeams` hook

**Index doc size**: ~180 KB for ~1,836 teams. Firestore doc limit is 1 MB.

---

## Lists Search

**Architecture**: `searchPrefixes` field on each list document + Firestore `array-contains` query

**How searchPrefixes work**:
- For each word in the list name, generates prefixes from 2 chars to the full word
- Example: "Best Goals 2024" → `["be","bes","best","go","goa","goal","goals","20","202","2024"]`
- Stored as an array field on the list document
- Firestore `array-contains` matches any single prefix, enabling type-ahead search

**Flow**:
1. When a list is created (`createList`), `searchPrefixes` is generated from the name
2. When a list name is updated (`updateList`), `searchPrefixes` is regenerated
3. `searchLists(query)` takes the first word of the query, queries Firestore:
   ```
   where('searchPrefixes', 'array-contains', prefix)
   orderBy('createdAt', 'desc')
   limit(20)
   ```

**Backfill**: `backfillListSearchPrefixes()` in `backfill.ts` adds prefixes to all existing list docs. Run once after deploy via `backfillListPrefixes` HTTP endpoint.

**Key files**:
- `src/utils/searchPrefixes.ts` — `generateSearchPrefixes()` utility
- `src/services/firestore/lists.ts` — `createList()`, `updateList()`, `searchLists()`
- `functions/src/sync/backfill.ts` — `backfillListSearchPrefixes()`

---

## Players Search

**Architecture**: Firestore prefix query (unchanged)

**Flow**:
1. Each player doc has a `searchPrefixes` array (generated during player enrichment)
2. `searchPlayersQuery()` in `footballApi.ts` queries:
   ```
   where('searchPrefixes', 'array-contains', prefix)
   orderBy('leagueTier', 'asc')
   limit(20)
   ```
3. Results paginated via `useInfiniteQuery` in `useSearchPlayers` hook

**Key files**:
- `src/services/footballApi.ts` — `searchPlayersQuery()`
- `src/hooks/useTeams.ts` — `useSearchPlayers` hook

---

## Users Search

**Architecture**: Firestore prefix query (unchanged)

**Flow**:
1. Each user doc has a `searchPrefixes` array (generated on profile update)
2. `searchUsers()` queries Firestore with `array-contains` on the first word of the query
3. Results limited to 20

**Key files**:
- `src/services/firestore/users.ts` — `searchUsers()`
- Search screen uses this directly

---

## Deployment Checklist

1. `firebase deploy --only functions` — deploy Cloud Functions
2. Call `rebuildTeamIndex` endpoint — creates `searchIndexes/teams` doc
3. Call `backfillListPrefixes` endpoint — adds searchPrefixes to existing lists
4. Deploy app update — client code uses Cloud Functions + new queries
