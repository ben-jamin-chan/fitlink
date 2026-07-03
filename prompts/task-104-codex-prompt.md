# CODEX PROMPT — Task 104: Unit Tests — activateBoost & createCheckin

@CONVENTIONS.md @ARCHITECT.md

---

## Pre-Task Dependency Check

**Required outputs from prior tasks:**

- Task 102 must have created `functions/jest.config.ts` — verify it is present
- Task 102 must have created `functions/src/__tests__/helpers/firebaseAdminMock.ts` — verify it is present
- Task 102 must have created `functions/src/__tests__/helpers/stripeMock.ts` — verify it is present
- Task 103 must have created `functions/src/__tests__/recordSwipe.test.ts` — verify it is present
- `functions/src/activateBoost.ts` must exist (Phase 2 remediation Task 74 output) — verify it is present
- `functions/src/createCheckin.ts` must exist (Phase 3 Task 79 output) — verify it is present

If any listed dependency is absent: output a DEPENDENCY ERROR block at the top of your
response, list what is missing, and do not proceed with implementation.

---

## Context

- `functions/jest.config.ts` — Jest config with ts-jest preset, node environment,
  `--passWithNoTests` flag, and `watchman: false`; established in Task 102
- `functions/src/__tests__/helpers/firebaseAdminMock.ts` — shared Admin SDK mock covering
  Firestore, Auth, Storage, RTDB, FieldValue, Timestamp, GeoPoint, and a `resetAllMocks()`
  helper; established in Task 102
- `functions/src/__tests__/helpers/stripeMock.ts` — shared Stripe mock covering
  subscriptions, customers, billingPortal, checkout.sessions, and a `resetStripeMocks()`
  helper; established in Task 102
- `functions/src/__tests__/recordSwipe.test.ts` — the established test pattern from Task 103;
  **read this file before writing Task 104 test files** — match its import style, mock
  setup/teardown pattern, and transaction-mocking approach exactly

**Critical: read the source functions before writing any test.**

Before writing a single test case, open and read:
- `functions/src/activateBoost.ts` — to confirm exact field names, error codes,
  Firestore read/write paths, and return shape
- `functions/src/createCheckin.ts` — to confirm exact payload shape, write paths
  (`/gymCheckins/{id}` + `users/{uid}.gymCheckin` denorm), batch vs. transaction usage,
  and return shape

Do not infer field names or return shapes from the spec below. Read the actual source.
If any detail in this prompt conflicts with what you find in the source, **the source wins** —
add an `<!-- ARCHITECT NOTE: prompt assumed X but source uses Y; using source -->` comment
and proceed with what the source says.

**`boost` field shape:** `boost` is a nested object `{ activatedAt: Timestamp, expiresAt: Timestamp }`
on the user document — not a flat `boostExpiresAt` field. Any test that checks the written
value must assert against the nested object shape.

**`createCheckin` uses a batch, not a transaction.** The two writes (`/gymCheckins/{id}`
doc + `users/{uid}.gymCheckin` denorm update) are independent — no read-before-write
dependency — so a `writeBatch` is correct. Mock accordingly; do not mock `runTransaction`
for createCheckin tests. If you open the source and find it does use a transaction, add
an ARCHITECT NOTE and mock accordingly.

**No modifications to existing files.** `activateBoost.ts`, `createCheckin.ts`,
`firebaseAdminMock.ts`, `stripeMock.ts`, and `recordSwipe.test.ts` are read-only
references for this task. Do not touch them.

---

## Task 104 — Unit Tests: activateBoost & createCheckin

**Files to create:**
- `functions/src/__tests__/activateBoost.test.ts`
- `functions/src/__tests__/createCheckin.test.ts`

---

### `functions/src/__tests__/activateBoost.test.ts`

Write a Jest unit test suite for `functions/src/activateBoost.ts`. Read the source
before writing any test case.

**Required test cases (5 minimum):**

1. **Auth rejection** — unauthenticated call (no `request.auth`) throws
   `HttpsError` with code `'unauthenticated'`

2. **Non-Pro user — permission denied** — authenticated call where
   `users/{uid}.premium.active` is `false` (or the `premium` field is absent) throws
   `HttpsError` with code `'permission-denied'`. Confirm the exact error code from the
   source — add an ARCHITECT NOTE if it differs.

3. **Active boost exists — already-exists** — authenticated Pro user where
   `users/{uid}.boost.expiresAt` is a future timestamp. Pin `Date.now()` to a fixed past
   value so the comparison is deterministic. Throws `HttpsError` with code `'already-exists'`.
   Confirm the exact code from the source.

4. **Pro user, no active boost — success** — authenticated Pro user where the `boost`
   field is absent or null on the user doc. Expects:
   - Firestore write with `boost: { activatedAt: <Timestamp>, expiresAt: <Timestamp> }`
     where `expiresAt` is 30 minutes after `activatedAt`
   - Return value as the source defines (read the source first)

5. **Expired boost — treated as no boost** — authenticated Pro user where
   `users/{uid}.boost.expiresAt` is a past timestamp. Pin `Date.now()` to a fixed future
   value. Expects the same success path as case 4 — a new boost is written,
   no `'already-exists'` error thrown.

**Test structure requirements:**
- Follow the same import, `jest.mock`, `beforeEach`/`afterEach`, and helper-import
  pattern as `recordSwipe.test.ts` — read that file first
- Use `resetAllMocks()` from `firebaseAdminMock.ts` in `beforeEach` or `afterEach`
- Mock `Date.now()` with `jest.spyOn(Date, 'now').mockReturnValue(fixedMs)` wherever
  timestamp comparison is needed; restore with `.mockRestore()` in cleanup
- Seed the mock user document with the minimum fields for each test case
  (e.g. `{ premium: { active: true } }` for Pro, `{}` for free user)
- Assert the specific `HttpsError` code on every error-path test — not just that
  any error was thrown

---

### `functions/src/__tests__/createCheckin.test.ts`

Write a Jest unit test suite for `functions/src/createCheckin.ts`. Read the source
before writing any test case.

**Required test cases (4 minimum):**

1. **Auth rejection** — unauthenticated call (no `request.auth`) throws
   `HttpsError` with code `'unauthenticated'`

2. **Existing active check-in — already-exists** — read the source to find exactly
   how it detects an existing active check-in (`users/{uid}.gymCheckin.expiresAt`
   comparison, a `/gymCheckins` query, or otherwise). Mock that detection path.
   Throws `HttpsError` with code `'already-exists'`.

3. **Invalid payload — invalid-argument** — read the source to identify which fields
   are required and validated. Pass a payload missing one required field. Throws
   `HttpsError` with code `'invalid-argument'`.

4. **Valid check-in — success** — authenticated call with a valid payload. Expects:
   - `batch.set()` called for `/gymCheckins/{id}` document with correct fields
     (including `userId`, `checkedInAt`, `expiresAt` 2 hours ahead)
   - `batch.update()` called for `users/{uid}.gymCheckin` denorm
     (at minimum `gymName` and `expiresAt`)
   - `batch.commit()` called
   - Return value as the source defines (read first)
   - Pin `Date.now()` for deterministic `expiresAt` assertion

**Test structure requirements:**
- Same pattern as `activateBoost.test.ts` and `recordSwipe.test.ts`
- Batch mock: `firebaseAdminMock.ts` already provides `mockFirestore.batch()` — use it.
  Assert the specific write methods the source calls. Assert `batch.commit()`.
- Use `resetAllMocks()` in cleanup
- Assert specific `HttpsError` code on every error-path test

---

## Important Architecture Notes for Codex

1. **Read the source before writing any test.** Field names, error codes, and return
   shapes come from the source — not from this spec. Add `<!-- ARCHITECT NOTE: -->`
   comments wherever the source diverges from what the spec describes.

2. **`boost` is a nested object.** Assertions on the written Firestore value must check
   `boost: { activatedAt, expiresAt }` — never `boostExpiresAt`.

3. **`createCheckin` uses a batch.** Mock `db.batch()` and assert `batch.set`,
   `batch.update`, `batch.commit`. If the source uses `runTransaction` instead,
   add an ARCHITECT NOTE and mock the transaction callback accordingly.

4. **No modifications to shared helpers.** If `firebaseAdminMock.ts` is missing a
   method needed by these tests, add it as a local mock override inside the test file —
   not in the shared helper.

5. **Timestamp determinism.** Pin `Date.now()` with `jest.spyOn` for all expiry-based
   assertions. Restore with `.mockRestore()` in cleanup.

6. **`HttpsError` code specificity.** Every error-path test must assert the exact
   `.code` property (e.g. using `expect(error.code).toBe('functions/already-exists')`
   or the equivalent Jest matcher). Catching any error is not sufficient.

7. **Pattern consistency.** Both test files must structurally match `recordSwipe.test.ts`.
   Read it first.

---

## Rollback Protocol

If `npm --prefix functions test` produces failures that cannot be resolved without:
- Modifying a source Cloud Function file, OR
- Modifying `firebaseAdminMock.ts` or `stripeMock.ts`, OR
- Making an assumption about source behaviour that cannot be verified by reading the file

**Then:**
1. Do not commit any partial test files
2. Revert both new test files
3. Output a `<!-- ROLLBACK REPORT -->` block:
   - Which function's source caused the conflict
   - What the mismatch was (e.g. "source uses runTransaction not writeBatch")
   - What information or decision is needed to proceed
4. Stop. Bring the report back to the Architect.

---

## Codex Self-Check (Run Before Declaring Done)

**Build and tests**
- [ ] `npm --prefix functions run build` — zero errors (build still passes after test files added)
- [ ] `npm --prefix functions test` — all tests pass; zero failures across ALL test files
  (`recordSwipe.test.ts` + `activateBoost.test.ts` + `createCheckin.test.ts`)
- [ ] Zero `any` types introduced in the new test files
- [ ] Zero type assertions (`as X`) without an explanatory comment

**Test correctness**
- [ ] No actual Firebase calls — all mocked via `jest.mock` or shared helpers
- [ ] `resetAllMocks()` called between tests so cases are isolated
- [ ] Every error-path test asserts the specific `HttpsError` code property
- [ ] Every success-path test asserts both the Firestore mock calls and the return value
- [ ] `Date.now()` mocked (not hardcoded) for all timestamp assertions; restored in cleanup
- [ ] `boost` assertions check nested `{ activatedAt, expiresAt }` shape — never `boostExpiresAt`
- [ ] `createCheckin` tests assert `batch.set`, `batch.update`, `batch.commit`
  (not `runTransaction`, unless the source uses it — add ARCHITECT NOTE if so)

**Architecture**
- [ ] `activateBoost.ts`, `createCheckin.ts`, `firebaseAdminMock.ts`, `stripeMock.ts`,
  and `recordSwipe.test.ts` were not modified
- [ ] `functions/src/index.ts` was not modified
- [ ] No new npm packages installed (use existing devDependencies from Task 102)

---

## Acceptance Criteria

- [ ] `functions/src/__tests__/activateBoost.test.ts` created — all 5 test cases pass
- [ ] `functions/src/__tests__/createCheckin.test.ts` created — all 4 test cases pass
- [ ] `npm --prefix functions test` exits zero across all test files
- [ ] `npm --prefix functions run build` exits zero after test files added
- [ ] All error-path tests assert specific `HttpsError` code
- [ ] All success-path tests assert both Firestore mock calls and return value
- [ ] `boost` asserted as nested object `{ activatedAt, expiresAt }` in activateBoost tests
- [ ] `createCheckin` tests assert batch pattern (with ARCHITECT NOTE if source differs)
- [ ] No source CF file or shared mock helper was modified

---

## Do Not Touch

`functions/src/activateBoost.ts` (read only — source under test),
`functions/src/createCheckin.ts` (read only — source under test),
`functions/src/__tests__/helpers/firebaseAdminMock.ts` (shared helper — read only; add
local overrides inside the test file if additional mock behaviour is needed),
`functions/src/__tests__/helpers/stripeMock.ts` (shared helper — read only),
`functions/src/__tests__/recordSwipe.test.ts` (read only — pattern reference),
`functions/src/index.ts` (append-only; this task does not add a new CF),
`firestore.rules`, `constants/`, `types/`,
all files under `app/`, `store/`, `components/`, `services/`

---

## Commit

```
git commit -m "task-104: unit tests for activateBoost and createCheckin"
```

---

## After This Session

Update `CHANGELOG.md` using this exact template:

```
## [Phase 4E — Task 104] — YYYY-MM-DD

### Completed

- Task 104: Unit tests — activateBoost & createCheckin
- activateBoost: [N] test cases — [list briefly]
- createCheckin: [N] test cases — [list briefly]

### Files Created

- functions/src/__tests__/activateBoost.test.ts: [N] test cases
- functions/src/__tests__/createCheckin.test.ts: [N] test cases

### Files Modified

- None

### Architecture Decisions

- [Any divergence found between spec and source — e.g. "createCheckin active-check reads
  from users/{uid}.gymCheckin.expiresAt, not a /gymCheckins query"]
- [Any local mock extensions added inside the test file rather than shared helper]

### Conflict Risks Introduced

- None — test files only; no CF source or shared mock helper modified

### Known Issues / Deferred

- None

### Next Up

- Task 105: Unit tests — deleteAccount & restoreStripeSubscription
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 105 prompt.

---

## Reasoning Level

Medium
