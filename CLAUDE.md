# Workflow Orchestration

## 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately - don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

## 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

## 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

## 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

## 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes - don't over-engineer
- Challenge your own work before presenting it

## 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests - then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

# Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plans**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

# Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

# Scalability Principles

Design for many concurrent users from the start. Every read/write must be evaluated for time complexity and contention.

## O(1) Reads via Pre-computed Aggregates
- Never compute aggregates at read time by scanning all documents in a collection
- Store pre-computed results (e.g. `ratingSum`/`ratingCount` on match docs, daily aggregate snapshots in `aggregates/` collection)
- Use Cloud Functions (scheduled or triggered) to maintain aggregates asynchronously
- App reads = single `getDoc` calls, not collection scans

## Atomic Counters — No Read-Modify-Write
- Use Firestore `increment()` for any counter that multiple users can update simultaneously
- Never: read → compute new value → write (race condition at scale)
- Always: `updateDoc(ref, { count: increment(1) })` — Firestore serializes these atomically
- For rating updates: read old value once, compute delta, apply delta via `increment(delta)`

## Avoid Unbounded Collection Scans
- Never query a collection without a `limit()` in production app code
- Background Cloud Functions may paginate full collections using `startAfter()` cursor loops
- Firestore `in` queries are capped at 30 items — always chunk arrays

## Pagination in the App Layer
- All list views must use cursor-based pagination (`startAfter`, `limit`)
- Never load an entire collection to render a list
- Use `displayedCount` state + `onEndReached` to progressively load

## Query Efficiency
- Composite indexes for any query with multiple `where` + `orderBy` clauses
- `staleTime: Infinity` in React Query for data that only changes via background jobs (aggregates)
- `staleTime: 5 * 60 * 1000` for semi-stable data (team rosters, match lineups)
- No duplicate queries — check if a hook already fetches the data needed

## Concurrency Safety
- Firestore transactions for operations that must read-then-conditionally-write
- Firestore batched writes (max 500 ops) for bulk updates to keep them atomic
- Cloud Functions: set appropriate `timeoutSeconds` and `memory` for long-running jobs
- Avoid Cloud Function fan-out that writes to many docs simultaneously (triggers cascading reads)
