# CODEX PROMPT — Task 103: Unit Tests — recordSwipe

@CONVENTIONS.md @ARCHITECT.md

---

## Pre-Task Dependency Check

**Required outputs from prior tasks:**

- Task 102 must have created `functions/jest.config.ts` — verify it is present
- Task 102 must have created `functions/src/__tests__/helpers/firebaseAdminMock.ts` — verify it is present
- Task 102 must have created `functions/src/__tests__/helpers/stripeMock.ts` — verify it is present
- Task 102 must have added a `"test"` script to `functions/package.json` — verify it runs `jest`

If any listed dependency is absent: output a DEPENDENCY ERROR block and do not proceed.

---

## Context

- `functions/src/recordSwipe.ts` — the callable CF under test. Handles `like`, `pass`, and `superlike` directions. Enforces a daily like limit for free users (50/day). Superlike is Pro-only. `rewindSwipe.ts` is a separate callable — `recordSwipe` does NOT accept a `'rewind'` direction.
- `functions/src/__tests__/helpers/firebaseAdminMock.ts` — shared Admin SDK mock with `resetAllMocks()` helper. Exports `mockFirestore`, `mockAuth`, `mockStorage`.
- `functions/src/__tests__/helpers/stripeMock.ts` — exists but NOT needed here. `recordSwipe` makes no Stripe calls. Do not import it.
- `functions/jest.config.ts` — Jest config with `ts-jest` preset, `node` environment.

**Architectural boundary:** This task creates one new test file only. `functions/src/recordSwipe.ts` must not be modified. If a test reveals the CF needs a change, stop and report it.

---

## Task 103 — Unit Tests: recordSwipe

**Files to create:**
- `functions/src/__tests__/recordSwipe.test.ts`

**Files to modify:**
- None

---

### `functions/src/__tests__/recordSwipe.test.ts`

Before writing any test code, read `functions/src/recordSwipe.ts` in full to determine:
- How the CF is exported (wrapped `onCall` or plain async handler)
- Exact Firestore field names (`count`, `resetAt`, premium check field path)
- Exact return shape (`remainingLikes`, any additional fields)
- How the premium check is performed (reads user doc vs. token claims)
- Whether `dailyLikes` is a subcollection doc or a field on the user doc
- Whether it uses `runTransaction` for the daily like counter

Then implement all 9 test cases below using the real CF field names and return shapes:

```typescript
import * as admin from 'firebase-admin'
import {
  mockFirestore,
  resetAllMocks,
} from './helpers/firebaseAdminMock'

// jest.mock must appear before any CF import
jest.mock('firebase-admin', () => {
  const mock = require('./helpers/firebaseAdminMock')
  return mock.adminMock  // adjust to the actual top-level export name in firebaseAdminMock.ts
})

// Import the CF AFTER jest.mock. Read recordSwipe.ts for the correct export name.
// If it only exports the onCall-wrapped function, use firebase-functions-test to
// unwrap it, or extract the inner async function for direct invocation.

const FREE_DAILY_LIMIT = 50  // match the constant used in recordSwipe.ts
const FUTURE_RESET_MS = Date.now() + 24 * 60 * 60 * 1000
const PAST_RESET_MS   = Date.now() - 60 * 1000

const makeRequest = (
  uid: string | null,
  data: Record<string, unknown>,
  isPremium = false,
) => ({
  auth: uid
    ? { uid, token: { premium: isPremium ? { active: true } : undefined } }
    : null,
  data,
  rawRequest: {} as never,
})

// Wire stubDailyLikes using the mock chain from firebaseAdminMock.ts.
// If recordSwipe uses runTransaction, mock it so the callback receives a
// transaction object with get() returning the stubbed snapshot and update()/set()
// as jest.fn(). This is the correct pattern for unit-testing transaction logic.
const stubDailyLikes = (count: number, resetAtMs: number) => {
  // Implementation: read both firebaseAdminMock.ts and recordSwipe.ts for the exact wiring.
}

beforeEach(() => {
  resetAllMocks()
})

describe('recordSwipe', () => {

  it('throws unauthenticated when request.auth is null', async () => {
    const req = makeRequest(null, { targetId: 'user2', direction: 'like' })
    await expect(/* call handler with req */).rejects.toMatchObject({ code: 'unauthenticated' })
  })

  it('throws invalid-argument for an unrecognised direction', async () => {
    // 'rewind' is NOT a valid recordSwipe direction — use it to verify the guard
    const req = makeRequest('user1', { targetId: 'user2', direction: 'rewind' })
    await expect(/* call handler */).rejects.toMatchObject({ code: 'invalid-argument' })
  })

  it('records a pass without touching dailyLikes', async () => {
    const req = makeRequest('user1', { targetId: 'user2', direction: 'pass' })
    const result = await /* call handler */
    // Assert pass doc written to swipes/{uid}/passes/{targetId}
    // Assert dailyLikes NOT read or written (check mock call counts)
    expect(result).toBeDefined()
  })

  it('records a like and returns correct remainingLikes for a free user under limit', async () => {
    stubDailyLikes(10, FUTURE_RESET_MS)
    const req = makeRequest('user1', { targetId: 'user2', direction: 'like' })
    const result = await /* call handler */
    // Assert like doc written; remainingLikes === FREE_DAILY_LIMIT - 11
    expect(result).toMatchObject({ remainingLikes: FREE_DAILY_LIMIT - 11 })
  })

  it('throws resource-exhausted when free user has reached the daily like limit', async () => {
    stubDailyLikes(FREE_DAILY_LIMIT, FUTURE_RESET_MS)
    const req = makeRequest('user1', { targetId: 'user2', direction: 'like' })
    await expect(/* call handler */).rejects.toMatchObject({ code: 'resource-exhausted' })
  })

  it('records a like without limit enforcement for a premium user', async () => {
    // Do NOT stub dailyLikes unless the CF reads it for premium users.
    // Read recordSwipe.ts to confirm the premium bypass path.
    const req = makeRequest('user1', { targetId: 'user2', direction: 'like' }, true)
    const result = await /* call handler */
    // Assert like doc written; assert dailyLikes NOT read
    // Assert result.remainingLikes is the unlimited sentinel from the real CF
    expect(result).toBeDefined()
  })

  it('throws permission-denied when a free user attempts a superlike', async () => {
    const req = makeRequest('user1', { targetId: 'user2', direction: 'superlike' })
    await expect(/* call handler */).rejects.toMatchObject({ code: 'permission-denied' })
  })

  it('records a superlike with isSuperLike: true for a premium user', async () => {
    const req = makeRequest('user1', { targetId: 'user2', direction: 'superlike' }, true)
    const result = await /* call handler */
    // Assert swipe doc written with isSuperLike: true
    expect(result).toBeDefined()
  })

  it('treats a past resetAt as a fresh count of 0 and allows the like', async () => {
    stubDailyLikes(FREE_DAILY_LIMIT, PAST_RESET_MS)
    const req = makeRequest('user1', { targetId: 'user2', direction: 'like' })
    const result = await /* call handler */
    expect(result).toMatchObject({ remainingLikes: FREE_DAILY_LIMIT - 1 })
  })

})
```

---

## Important Architecture Notes for Codex

1. **Do not modify `recordSwipe.ts`.** If a test reveals a bug, stop and produce a ROLLBACK REPORT.

2. **`'rewind'` is not a valid direction.** Test 2 uses it as the invalid input. No test should expect `'rewind'` to succeed.

3. **Import only `firebaseAdminMock`.** `stripeMock` is not needed for this CF.

4. **`jest.mock` before CF import.** Required for `ts-jest` module resolution correctness.

5. **Match real CF internals.** Read `recordSwipe.ts` before writing tests — premium check, field names, return shape, transaction pattern must all match the real source.

6. **Transaction mocking.** If the CF uses `runTransaction`, mock it so the callback executes synchronously with a stubbed snapshot. Wire this in the test file, not in `firebaseAdminMock.ts`, unless the mock genuinely lacks the method.

7. **`resetAllMocks()` in `beforeEach`.** No test may depend on state from a previous test.

---

## Rollback Protocol

If `npm --prefix functions test` fails and cannot be resolved without modifying `recordSwipe.ts` or breaking the shared mocks:

1. Delete `functions/src/__tests__/recordSwipe.test.ts`
2. Output a ROLLBACK REPORT listing: which test case failed, actual CF behaviour vs. expectation, whether the mismatch is in the test or CF source
3. Stop. Bring the report to the Architect.

---

## Codex Self-Check (Run Before Declaring Done)

**TypeScript**
- [ ] `npm --prefix functions run build` — zero errors
- [ ] `npx tsc --noEmit` — zero errors in root
- [ ] Zero `any` types in test file
- [ ] Zero unexplained type assertions

**Conventions**
- [ ] Zero `console.log` in test file
- [ ] Import paths resolve correctly from `__tests__/` directory

**Tests**
- [ ] `npm --prefix functions test` — all 9 test cases pass, zero failures
- [ ] All 9 cases are distinct and cover their stated scenarios
- [ ] `resetAllMocks()` in `beforeEach`
- [ ] No real network calls, timers, or Firebase emulator used
- [ ] `stripeMock` NOT imported

**Architecture**
- [ ] `recordSwipe.ts` NOT modified
- [ ] `firebaseAdminMock.ts` NOT modified (or change is safe for Tasks 104–105 and documented in CHANGELOG)
- [ ] `jest.mock('firebase-admin', ...)` before any CF import

---

## Acceptance Criteria

- [ ] `functions/src/__tests__/recordSwipe.test.ts` created
- [ ] All 9 test cases present per TASKS_PHASE4.md spec
- [ ] Field names and return shapes match actual `recordSwipe.ts`
- [ ] `npm --prefix functions test` exits code 0, all 9 passing
- [ ] `npm --prefix functions run build` still exits code 0
- [ ] `firebaseAdminMock.ts`, `stripeMock.ts`, and `recordSwipe.ts` unchanged

---

## Do Not Touch

`functions/src/recordSwipe.ts`,
`functions/src/__tests__/helpers/firebaseAdminMock.ts` (only touch if a method is genuinely missing and the addition is safe for Tasks 104–105),
`functions/src/__tests__/helpers/stripeMock.ts`,
`functions/src/index.ts`,
`functions/jest.config.ts`,
`firestore.rules`,
`App.tsx`,
`store/authStore.ts`

---

## Commit

```
git commit -m "task-103: unit tests for recordSwipe CF"
```

---

## After This Session

Update `CHANGELOG.md` using this template:

```
## [Phase 4E — Task 103] — YYYY-MM-DD

### Completed

- Task 103: Unit tests — recordSwipe
- All 9 test cases implemented and passing

### Files Created

- functions/src/__tests__/recordSwipe.test.ts: full Jest suite for recordSwipe CF

### Files Modified

- [firebaseAdminMock.ts if a mock method was added — explain why and confirm Tasks 104–105 are unaffected; otherwise "None"]

### Architecture Decisions

- [How premium check is performed — reads user doc or token claims. Tasks 104–105 will need the same stub pattern.]
- [Whether runTransaction was used and how it was mocked.]

### Conflict Risks Introduced

- None — test file only; no CF source or shared mocks modified

### Known Issues / Deferred

- None

### Next Up

- Task 104: Unit tests — activateBoost & createCheckin
```

---

## Reasoning Level

Medium
