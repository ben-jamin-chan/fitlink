# Codex Prompt — Task 105: Unit Tests — deleteAccount & restoreStripeSubscription

@CONVENTIONS.md @ARCHITECT.md

---

## Pre-Task Dependency Check

**Required outputs from prior tasks:**

- Task 102 must have created `functions/jest.config.ts` — verify it exists
- Task 102 must have created `functions/src/__tests__/helpers/firebaseAdminMock.ts` — verify it exists
- Task 102 must have created `functions/src/__tests__/helpers/stripeMock.ts` — verify it exists
- Task 98 must have created `functions/src/deleteAccount.ts` — verify it exists
- Task 96 must have created `functions/src/restoreStripeSubscription.ts` — verify it exists

If any listed dependency is absent: output a DEPENDENCY ERROR block at the top of your response and do not proceed.

```
<!-- DEPENDENCY ERROR
  Missing: [list what is absent]
  Cannot proceed. Re-run the relevant prior task before this one.
-->
```

---

## Context

The Jest harness (Task 102) is installed in `functions/` with `ts-jest`, `@types/jest`, and `firebase-functions-test`. Shared mock helpers live at:

- `functions/src/__tests__/helpers/firebaseAdminMock.ts` — exports `mockFirestore`, `mockAuth`, `mockStorage`, `mockDatabase`, and a `resetAllMocks()` helper. The mock covers `admin.firestore()`, `admin.auth()`, `admin.storage()`, `admin.database()`, `admin.firestore.FieldValue`, `admin.firestore.Timestamp`, and `admin.firestore.GeoPoint`.
- `functions/src/__tests__/helpers/stripeMock.ts` — exports a `mockStripe` object with `subscriptions.list`, `subscriptions.update`, `billingPortal.sessions.create`, `customers.create`, and a `resetStripeMocks()` helper.

Two prior test suites have established the pattern:

- `functions/src/__tests__/recordSwipe.test.ts` — uses path-aware Firestore mocks local to the test file; premium check reads from `/users/{uid}.premium.active`; `runTransaction` mocked via callback interception.
- `functions/src/__tests__/activateBoost.test.ts` and `createCheckin.test.ts` — local path/query-aware mocks added inside each test file; shared helper mocks not modified.

**Critical instruction before writing any test case:** Read the actual source of `functions/src/deleteAccount.ts` and `functions/src/restoreStripeSubscription.ts` in full before writing a single assertion. Field names, return shapes, error codes, and deletion ordering must match the source exactly. Do not write tests from the spec or this prompt alone — the implementation is the ground truth.

**Known source-reality details from prior task CHANGELOG entries (confirmed from Tasks 96 and 98):**

- `deleteAccount.ts`: Stripe step uses `cancel_at_period_end: true`, not immediate cancellation. Stripe failure is swallowed and deletion continues. Auth deletion is the final step (step 9). The function returns `{ success: true }`.
- `restoreStripeSubscription.ts`: reads `stripeCustomerId` server-side from Firestore (client-supplied value ignored). Returns a discriminated result union: `{ restored: false, reason: 'no-customer' }`, `{ restored: false, reason: 'no-active-subscription' }`, or `{ restored: true, tier, expiresAt }`. On success, writes `premium.active`, `premium.tier`, `premium.subscriptionId`, and `premium.expiresAt` — the actual implementation also writes `premium.subscriptionId`, which does not appear in the original spec but is confirmed from the Task 96 CHANGELOG. Tests must assert on what the source actually writes.

**Do not modify any shared mock helper files.** Add all path/query-aware overrides as local mocks inside each new test file, exactly as Tasks 103 and 104 did.

---

## Task 105 — Unit Tests: deleteAccount & restoreStripeSubscription

**Files to create:**
- `functions/src/__tests__/deleteAccount.test.ts`
- `functions/src/__tests__/restoreStripeSubscription.test.ts`

**Files to modify:**
- None — test files only; no CF source files, no shared mock helpers, no `functions/src/index.ts`

---

### `functions/src/__tests__/deleteAccount.test.ts`

Write a Jest unit test suite for `functions/src/deleteAccount.ts`. Before writing any test, read the source in full — pay particular attention to the deletion sequence, which steps are best-effort (Stripe, individual Storage file deletions), which step must be last (Firebase Auth), and exactly what `stripe.subscriptions.list` and `stripe.subscriptions.update` are called with.

**Required test cases:**

1. **Auth rejection** — unauthenticated call (no `request.auth`) throws `HttpsError` with code `'unauthenticated'`.

2. **No `stripeCustomerId` — skips Stripe step** — user document has no `stripeCustomerId` field. Verify `stripe.subscriptions.list` is NOT called. Verify all Firestore, Storage, RTDB, and Auth deletion steps still execute. Auth deletion must still be the final step.

3. **Active Stripe subscription — cancelled at period end** — user has a `stripeCustomerId` and Stripe returns an active subscription. Verify `stripe.subscriptions.update` is called with `{ cancel_at_period_end: true }`. Verify it is NOT called with `{ cancel_immediately: true }` or any immediate-cancel variant.

4. **Stripe failure — swallowed, deletion continues** — `stripe.subscriptions.list` throws an error. Verify the error is caught and does not propagate. Verify Auth deletion still executes (i.e. Stripe failure does not abort the sequence).

5. **Full happy path — Auth deleted last** — user has `stripeCustomerId`, active subscription, subcollections, Storage files, and RTDB chat nodes. Verify all mock calls occur. Verify Firebase Auth `deleteUser` is called after all other deletion steps. Use `jest.fn()` call-order tracking (inspect `mock.invocationCallOrder` or equivalent) to assert Auth deletion is the final write operation. The function returns `{ success: true }`.

**Mocking guidance:**

- Mock `firebase-admin` using the shared `firebaseAdminMock.ts` helpers as the base. Add path-aware overrides locally in this test file for the specific document reads and subcollection queries `deleteAccount.ts` performs.
- Mock `stripe` using the shared `stripeMock.ts` helpers. Override `subscriptions.list` per-test to return either an active subscription or an empty list.
- Call `resetAllMocks()` and `resetStripeMocks()` in `beforeEach`.
- Stub the Firestore subcollection query pattern (e.g. `collection().where().get()`) to return a `QuerySnapshot` with the docs needed for each test case. For the full happy-path test, return at least one doc per subcollection so you can verify deletion is called for each.
- For call-order verification in test case 5: capture each major step's mock function and compare `.mock.invocationCallOrder` values, or use a shared call-log array where each step pushes a label, then assert the Auth label is last.

**Import pattern:** Follow the exact import pattern used in `recordSwipe.test.ts` and `activateBoost.test.ts` — jest.mock at the top, then pull the mocked instances from the helper exports.

---

### `functions/src/__tests__/restoreStripeSubscription.test.ts`

Write a Jest unit test suite for `functions/src/restoreStripeSubscription.ts`. Before writing any test, read the source in full — pay particular attention to the return shape, which fields are written to Firestore on success, how tier is resolved from price IDs, and whether `subscriptionId` is included in the Firestore write.

**Required test cases:**

1. **Auth rejection** — unauthenticated call throws `HttpsError` with code `'unauthenticated'`.

2. **No `stripeCustomerId`** — user document has no `stripeCustomerId`. Verify `stripe.subscriptions.list` is NOT called. Function returns `{ restored: false, reason: 'no-customer' }`.

3. **No active Stripe subscription** — user has `stripeCustomerId`; `stripe.subscriptions.list` returns empty data array. Function returns `{ restored: false, reason: 'no-active-subscription' }`. Verify no Firestore write is made.

4. **Active subscription found — Firestore written and result returned** — user has `stripeCustomerId`; `stripe.subscriptions.list` returns one active subscription with a recognised price ID mapping to a known tier. Verify Firestore `update` is called with:
   - `premium.active: true`
   - `premium.tier: <expected tier>`
   - `premium.expiresAt: <a Timestamp derived from `current_period_end`>`
   - `premium.subscriptionId: <the subscription ID>`
   
   Function returns `{ restored: true, tier: <expected tier>, expiresAt: <value> }`.

   Choose a price ID from the env vars your source file reads. If the source resolves tier from a `PRICE_TIER_MAP` at module scope, stub `process.env` with a test price ID and set the corresponding map value — or inspect the source to see which map entry is hardcoded vs env-driven, and seed accordingly.

**Mocking guidance:**

- Use shared helpers as the base; add local overrides for the specific `doc().get()` reads `restoreStripeSubscription.ts` performs.
- For test case 4, seed `stripe.subscriptions.list` to return a mock subscription object with at least `id`, `status: 'active'`, `current_period_end` (Unix timestamp number), and `items.data[0].price.id` (or whichever field the source uses to resolve the price ID — read the source to confirm).
- Call `resetAllMocks()` and `resetStripeMocks()` in `beforeEach`.

---

## Important Architecture Notes for Codex

1. **Read the source before writing tests.** Every field name, return value, error code, and step order in the tests must be derived from reading `deleteAccount.ts` and `restoreStripeSubscription.ts` directly. The spec in TASKS_PHASE4.md and this prompt are starting points, not ground truth. If the source differs from the spec, the source wins — add a comment noting the discrepancy.

2. **Do not modify shared mock helpers.** `firebaseAdminMock.ts` and `stripeMock.ts` are shared across the test suite. All per-test or per-file overrides go inside the new test files using `jest.fn().mockResolvedValueOnce(...)` or `jest.fn().mockReturnValue(...)` locally.

3. **Do not touch any CF source file.** `deleteAccount.ts`, `restoreStripeSubscription.ts`, and `functions/src/index.ts` must not be modified. If a test requires a behaviour not present in the source, note it in a comment and skip that assertion rather than patching the source.

4. **Call-order verification for deleteAccount test case 5.** Jest tracks invocation order on all `jest.fn()` instances via `mock.invocationCallOrder`. The Auth `deleteUser` mock's `invocationCallOrder[0]` must be greater than the `invocationCallOrder[0]` of every other deletion mock. Do not rely on `mock.calls.length` alone — use call order explicitly.

5. **Stripe subscription ID field.** The `stripe.subscriptions.list` response shape varies by implementation. Read the source to confirm whether the CF accesses `subscription.id`, `data[0].id`, or something else before seeding the mock.

6. **`restoreStripeSubscription` writes `premium.subscriptionId`.** This field is confirmed from the Task 96 CHANGELOG and is not in the original spec. The test for the happy-path write must assert this field is included in the Firestore update call — do not omit it.

7. **No new imports in CF source files.** If a test would require adding an export or changing a function signature in a CF source file, do not do it. Restructure the test approach instead.

---

## Rollback Protocol

If `npm --prefix functions test` produces failures that cannot be resolved without:
- Modifying a CF source file, OR
- Modifying a shared mock helper in a way that could break existing test suites (Tasks 103–104), OR
- Making an assumption about source behaviour that cannot be verified by reading the file

**Then:**
1. Revert all files touched in this session to their state at session start
2. Output a `<!-- ROLLBACK REPORT -->` block listing:
   - Which test case caused the failure
   - What the actual source behaviour is versus what the test assumed
   - What clarification or decision is needed
3. Stop. Bring the report back to the Architect.

---

## Codex Self-Check (Run Before Declaring Done)

**TypeScript**
- [ ] `npm --prefix functions run build` — zero errors (build must still pass; test files must not break the production build)
- [ ] `npm --prefix functions test` — all tests pass, zero failures across all test files (Tasks 103, 104, and 105)
- [ ] Zero `any` types introduced in the new test files
- [ ] Zero type assertions (`as X`) without an explanatory comment

**Test correctness**
- [ ] Every test case reads the actual CF source for field names and return shapes before asserting — no assertions derived from the spec alone
- [ ] `resetAllMocks()` and `resetStripeMocks()` called in `beforeEach` in both test files
- [ ] `deleteAccount` test case 5 uses call-order tracking (not just `toHaveBeenCalled()`) to verify Auth deletion is the final step
- [ ] `restoreStripeSubscription` test case 4 asserts `premium.subscriptionId` is included in the Firestore update call
- [ ] No CF source files modified (`deleteAccount.ts`, `restoreStripeSubscription.ts`, `index.ts`)
- [ ] No shared mock helper files modified (`firebaseAdminMock.ts`, `stripeMock.ts`)
- [ ] All 9 test cases (5 deleteAccount + 4 restoreStripeSubscription) pass

**Architecture**
- [ ] Files in the "Do Not Touch" list were not modified

---

## Acceptance Criteria

- [ ] `functions/src/__tests__/deleteAccount.test.ts` created with 5 passing test cases
- [ ] `functions/src/__tests__/restoreStripeSubscription.test.ts` created with 4 passing test cases
- [ ] All 9 new test cases pass when running `npm --prefix functions test`
- [ ] All prior test cases from Tasks 103 and 104 still pass (no regressions)
- [ ] Auth deletion verified as the final step in `deleteAccount` via call-order assertion
- [ ] `premium.subscriptionId` asserted in the `restoreStripeSubscription` happy-path write
- [ ] No shared mock helpers modified
- [ ] No CF source files modified
- [ ] `npm --prefix functions run build` still passes with zero errors

---

## Do Not Touch

`functions/src/deleteAccount.ts`, `functions/src/restoreStripeSubscription.ts`, `functions/src/index.ts` (CF sources — tests must not require source changes), `functions/src/__tests__/helpers/firebaseAdminMock.ts`, `functions/src/__tests__/helpers/stripeMock.ts` (shared helpers — modifications could break Tasks 103 and 104 test suites), `functions/src/__tests__/recordSwipe.test.ts`, `functions/src/__tests__/activateBoost.test.ts`, `functions/src/__tests__/createCheckin.test.ts` (prior test files — must not be touched)

---

## Commit

```
git commit -m "task-105: unit tests for deleteAccount and restoreStripeSubscription"
```

---

## After This Session

Update `CHANGELOG.md` using this exact template:

```
## [Phase 4E — Task 105] — YYYY-MM-DD

### Completed

- Task 105: Unit tests — deleteAccount & restoreStripeSubscription
- deleteAccount: 5 test cases — [list them]
- restoreStripeSubscription: 4 test cases — [list them]

### Files Created

- functions/src/__tests__/deleteAccount.test.ts: [brief description]
- functions/src/__tests__/restoreStripeSubscription.test.ts: [brief description]

### Files Modified

- None

### Architecture Decisions

- [Any source-reality deviations found by reading the actual CF source — e.g. field names that differ from the spec, additional fields written, etc.]
- [Note whether call-order tracking approach used in deleteAccount test 5]

### Conflict Risks Introduced

- None — test files only; no CF source or shared mock helpers modified

### Known Issues / Deferred

- None

### Next Up

- Task 106: Phase 4 Firestore Security Rules — admin audit & warnings
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 106 prompt.

---

## Reasoning Level

Medium
