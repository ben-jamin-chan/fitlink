# Codex Prompt — Task 102: Jest Harness for Cloud Functions

@CONVENTIONS.md @ARCHITECT.md

---

## Pre-Task Dependency Check

**Required outputs from prior tasks:**
- Task 98 must have written `functions/src/deleteAccount.ts` — verify it is present (mock helpers must match its Stripe + Admin SDK call pattern)
- Task 96 must have written `functions/src/restoreStripeSubscription.ts` — verify it is present (tested in Task 105)
- `functions/src/index.ts` must exist and be append-only — verify presence; this task does NOT modify it

> If any listed dependency is absent: output a DEPENDENCY ERROR block at the top of your
> response, list what is missing, and do not proceed with implementation.

```
<!-- DEPENDENCY ERROR
  Missing: [describe what is absent]
  Cannot proceed. Re-run the relevant prior task first.
-->
```

---

## Context

This task installs the Jest testing harness inside `functions/` only. The mobile app (root package) does NOT get a test runner in Phase 4. All test files will live under `functions/src/__tests__/`. No test suites are written in this task — only the scaffolding and shared mock helpers that Tasks 103–105 will import.

**Existing files Codex needs to know about:**
- `functions/package.json` — existing; will be modified to add devDependencies and a `test` script
- `functions/tsconfig.json` — existing; governs TypeScript compilation for functions; `ts-jest` must respect it
- `functions/src/deleteAccount.ts` — uses Admin SDK (`admin.firestore()`, `admin.auth()`, `admin.storage()`) and Stripe; mock helpers must cover its call surface
- `functions/src/restoreStripeSubscription.ts` — uses Admin SDK (`admin.firestore()`) and Stripe `subscriptions.list()`; mock helpers must cover its call surface
- `functions/src/recordSwipe.ts` — uses Admin SDK (`admin.firestore()` for `runTransaction`); mock helpers must cover transaction pattern
- `functions/src/activateBoost.ts` — uses Admin SDK (`admin.firestore()`, `admin.auth().getUser()`)
- `functions/src/createCheckin.ts` — uses Admin SDK (`admin.firestore()` with `writeBatch`)

**What this task does NOT do:**
- Does not write any `.test.ts` files (those are Tasks 103–105)
- Does not modify `functions/src/index.ts`
- Does not modify any Cloud Function source files
- Does not touch the mobile app root `package.json` or any file outside `functions/`

**Architecture boundary:** `functions/` has its own isolated TypeScript environment. Jest runs in this context only. The root `tsconfig.json` already excludes `admin/` build folders — it must not be changed by this task.

---

## Task 102 — Jest Harness for Cloud Functions

**Files to create:**
- `functions/jest.config.ts`
- `functions/src/__tests__/helpers/firebaseAdminMock.ts`
- `functions/src/__tests__/helpers/stripeMock.ts`

**Files to modify:**
- `functions/package.json` — add devDependencies and `test` script

---

### `functions/package.json` — Update

Add the following devDependencies and scripts entry. Do not remove or reorder any existing entries.

```json
// Add to "devDependencies":
"@types/jest": "^29.5.12",
"firebase-functions-test": "^3.3.0",
"jest": "^29.7.0",
"ts-jest": "^29.1.4"

// Add to "scripts" (alongside the existing "build", "serve", "deploy", etc.):
"test": "jest"
```

Do not touch the existing `"build"`, `"serve"`, `"deploy"`, `"lint"` scripts or any existing dependencies in `"dependencies"`. Only add to `"devDependencies"` and `"scripts"`.

---

### `functions/jest.config.ts`

> Jest configuration for the functions package. Uses `ts-jest` to run TypeScript test files directly without a separate compile step. `testEnvironment: 'node'` is required — Cloud Functions run in Node, not a browser.

```typescript
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  setupFilesAfterEnv: [],  // intentionally empty; per-suite setup lives in beforeEach
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
  // Prevent ts-jest from recompiling on every test run when source hasn't changed
  cacheDirectory: '.jest-cache',
}

export default config
```

> **Note:** `setupFilesAfterEnv` is the correct Jest config key for files that run after the test framework is installed (i.e. after `jest-circus`/`jest-jasmine2` is set up). This is distinct from `setupFiles` which runs before the framework.

<!-- ARCHITECT NOTE: The task spec contained a typo ("setupFilesAfterFramework"). The correct Jest config key is `setupFilesAfterEnv`. Using the correct key here. -->

---

### `functions/src/__tests__/helpers/firebaseAdminMock.ts`

> Shared mock for `firebase-admin`. Imported by every CF test suite. Provides a consistent, resettable mock surface for Firestore, Auth, and Storage — the three Admin SDK services used across `recordSwipe`, `activateBoost`, `createCheckin`, `deleteAccount`, and `restoreStripeSubscription`.
>
> Design principle: each mock function is a `jest.fn()` so individual test files can override return values with `.mockResolvedValueOnce()` or `.mockReturnValueOnce()` without leaking state between tests.

```typescript
import { jest } from '@jest/globals'

// ---------------------------------------------------------------------------
// Firestore mock
// ---------------------------------------------------------------------------

// Transaction mock — supports get() and update() inside runTransaction callbacks
export const mockTransaction = {
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
}

// Query snapshot mock factory — returns a snapshot-like object with forEach + docs
export const makeQuerySnapshot = (docs: Array<{ id: string; data: () => Record<string, unknown> }>) => ({
  forEach: (cb: (doc: { id: string; data: () => Record<string, unknown> }) => void) => docs.forEach(cb),
  docs,
  empty: docs.length === 0,
  size: docs.length,
})

// Document snapshot mock factory
export const makeDocSnapshot = (data: Record<string, unknown> | null, id = 'mock-doc-id') => ({
  id,
  exists: data !== null,
  data: () => data,
})

// Collection / query chain mock
export const mockQuery = {
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  get: jest.fn(),
}

// writeBatch mock
export const mockBatch = {
  set: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  commit: jest.fn(),
}

// Document reference mock
export const mockDocRef = {
  id: 'mock-doc-id',
  get: jest.fn(),
  set: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  collection: jest.fn().mockReturnThis(),
}

// Firestore instance mock
export const mockFirestoreInstance = {
  doc: jest.fn(() => mockDocRef),
  collection: jest.fn(() => mockQuery),
  runTransaction: jest.fn(async (cb: (tx: typeof mockTransaction) => Promise<unknown>) => cb(mockTransaction)),
  writeBatch: jest.fn(() => mockBatch),
  batch: jest.fn(() => mockBatch),
}

// ---------------------------------------------------------------------------
// Auth mock
// ---------------------------------------------------------------------------

export const mockAuthInstance = {
  getUser: jest.fn(),
  deleteUser: jest.fn(),
  setCustomUserClaims: jest.fn(),
}

// ---------------------------------------------------------------------------
// Storage mock
// ---------------------------------------------------------------------------

export const mockFile = {
  delete: jest.fn(),
}

export const mockBucket = {
  file: jest.fn(() => mockFile),
  getFiles: jest.fn(),
  deleteFiles: jest.fn(),
}

export const mockStorageInstance = {
  bucket: jest.fn(() => mockBucket),
}

// ---------------------------------------------------------------------------
// firebase-admin module mock
// ---------------------------------------------------------------------------

// FieldValue sentinel mocks — return distinguishable objects so tests can
// assert that serverTimestamp() was used rather than new Date()
const mockFieldValue = {
  serverTimestamp: jest.fn(() => ({ _methodName: 'serverTimestamp' })),
  delete: jest.fn(() => ({ _methodName: 'delete' })),
  arrayUnion: jest.fn((...args: unknown[]) => ({ _methodName: 'arrayUnion', args })),
  arrayRemove: jest.fn((...args: unknown[]) => ({ _methodName: 'arrayRemove', args })),
  increment: jest.fn((n: number) => ({ _methodName: 'increment', n })),
}

// Timestamp mock
const mockTimestamp = {
  fromMillis: jest.fn((ms: number) => ({ seconds: Math.floor(ms / 1000), nanoseconds: 0, toMillis: () => ms })),
  now: jest.fn(() => ({ seconds: Math.floor(Date.now() / 1000), nanoseconds: 0 })),
}

jest.mock('firebase-admin', () => ({
  firestore: jest.fn(() => mockFirestoreInstance),
  auth: jest.fn(() => mockAuthInstance),
  storage: jest.fn(() => mockStorageInstance),
  initializeApp: jest.fn(),
  credential: {
    applicationDefault: jest.fn(),
  },
}))

jest.mock('firebase-admin/firestore', () => ({
  FieldValue: mockFieldValue,
  Timestamp: mockTimestamp,
  getFirestore: jest.fn(() => mockFirestoreInstance),
}))

// ---------------------------------------------------------------------------
// Reset helper — call in beforeEach to clear mock state between tests
// ---------------------------------------------------------------------------

export const resetAllMocks = () => {
  // Firestore
  mockFirestoreInstance.doc.mockClear()
  mockFirestoreInstance.collection.mockClear()
  mockFirestoreInstance.runTransaction.mockClear()
  mockFirestoreInstance.writeBatch.mockClear()
  mockFirestoreInstance.batch.mockClear()
  mockDocRef.get.mockClear()
  mockDocRef.set.mockClear()
  mockDocRef.update.mockClear()
  mockDocRef.delete.mockClear()
  mockDocRef.collection.mockClear()
  mockQuery.where.mockClear()
  mockQuery.limit.mockClear()
  mockQuery.orderBy.mockClear()
  mockQuery.get.mockClear()
  mockBatch.set.mockClear()
  mockBatch.update.mockClear()
  mockBatch.delete.mockClear()
  mockBatch.commit.mockClear()
  mockTransaction.get.mockClear()
  mockTransaction.set.mockClear()
  mockTransaction.update.mockClear()
  mockTransaction.delete.mockClear()
  // Auth
  mockAuthInstance.getUser.mockClear()
  mockAuthInstance.deleteUser.mockClear()
  mockAuthInstance.setCustomUserClaims.mockClear()
  // Storage
  mockStorageInstance.bucket.mockClear()
  mockBucket.file.mockClear()
  mockBucket.getFiles.mockClear()
  mockBucket.deleteFiles.mockClear()
  mockFile.delete.mockClear()
  // FieldValue
  mockFieldValue.serverTimestamp.mockClear()
  mockFieldValue.delete.mockClear()
}

export { mockFieldValue, mockTimestamp }
```

---

### `functions/src/__tests__/helpers/stripeMock.ts`

> Shared mock for the Stripe SDK. Imported by CF test suites that call Stripe (`deleteAccount`, `restoreStripeSubscription`, `createStripeCheckout`). Covers the Stripe methods actually used in Phase 4 CFs.
>
> All methods default to `jest.fn()` returning `undefined`. Individual tests override with `.mockResolvedValueOnce()` as needed.

```typescript
import { jest } from '@jest/globals'

// ---------------------------------------------------------------------------
// Stripe method mocks — grouped by resource
// ---------------------------------------------------------------------------

export const mockStripeSubscriptions = {
  list: jest.fn(),
  update: jest.fn(),
  cancel: jest.fn(),
  retrieve: jest.fn(),
}

export const mockStripeCustomers = {
  create: jest.fn(),
  retrieve: jest.fn(),
  list: jest.fn(),
}

export const mockStripeBillingPortal = {
  sessions: {
    create: jest.fn(),
  },
}

export const mockStripeCheckoutSessions = {
  create: jest.fn(),
}

// ---------------------------------------------------------------------------
// Stripe constructor mock
// The Stripe class is instantiated inside each CF with `new Stripe(secretKey, ...)`.
// We mock the module so any `new Stripe(...)` call returns the mockStripeInstance.
// ---------------------------------------------------------------------------

export const mockStripeInstance = {
  subscriptions: mockStripeSubscriptions,
  customers: mockStripeCustomers,
  billingPortal: mockStripeBillingPortal,
  checkout: {
    sessions: mockStripeCheckoutSessions,
  },
}

jest.mock('stripe', () => {
  return {
    // Default export is the Stripe class
    default: jest.fn().mockImplementation(() => mockStripeInstance),
  }
})

// ---------------------------------------------------------------------------
// Reset helper — call in beforeEach to clear mock state between tests
// ---------------------------------------------------------------------------

export const resetStripeMocks = () => {
  mockStripeSubscriptions.list.mockClear()
  mockStripeSubscriptions.update.mockClear()
  mockStripeSubscriptions.cancel.mockClear()
  mockStripeSubscriptions.retrieve.mockClear()
  mockStripeCustomers.create.mockClear()
  mockStripeCustomers.retrieve.mockClear()
  mockStripeCustomers.list.mockClear()
  mockStripeBillingPortal.sessions.create.mockClear()
  mockStripeCheckoutSessions.create.mockClear()
}
```

---

## Important Architecture Notes for Codex

1. **`functions/` is an isolated TypeScript environment.** Do not import from `@/` aliases, `constants/`, or any mobile app directory. The `functions/tsconfig.json` does not include the root `paths` aliases. Any import outside `functions/src/` or `node_modules` will fail the build.

2. **`jest.mock()` calls must be at module scope.** Jest hoists `jest.mock()` calls to the top of the file. Do not place them inside functions, `beforeEach`, or `describe` blocks. The mock declarations in `firebaseAdminMock.ts` and `stripeMock.ts` must remain at the top level of those files.

3. **`resetAllMocks()` and `resetStripeMocks()` are for test files to call in `beforeEach`.** Do not call them inside the helper files themselves — they are exported utilities, not auto-running side effects. Each test suite opts in by calling them in its own `beforeEach`.

4. **`functions/src/index.ts` is append-only and must not be touched.** This task has no reason to modify it.

5. **`jest.config.ts` key: `setupFilesAfterEnv`.** The correct Jest config property for post-framework setup files is `setupFilesAfterEnv`. The task spec contained a typo (`setupFilesAfterFramework`); `setupFilesAfterEnv` is correct and what is used above.
   <!-- ARCHITECT NOTE: The task spec had a typo here. Correct key used. -->

6. **`npm --prefix functions test` must exit zero with no test files.** When Jest finds no test files matching `**/__tests__/**/*.test.ts`, it exits with code 1 by default. Add `--passWithNoTests` to the test script in `package.json` so the harness validates without test files in place:
   ```json
   "test": "jest --passWithNoTests"
   ```

7. **`.jest-cache` should be gitignored.** After creating `jest.config.ts`, append `.jest-cache` to `functions/.gitignore` (or create one if it doesn't exist). Do not commit the Jest cache directory.

8. **The `firebase-functions-test` package is installed but not directly used in this task.** Tasks 103–105 will import `firebase-functions-test` to wrap callable invocations. Install it now so the package is available; don't import it in the helpers.

---

## Rollback Protocol

If `npm --prefix functions install` fails or `npm --prefix functions run build` produces errors after devDep additions:

1. Do not commit any partial changes
2. Revert `functions/package.json` to its pre-task state
3. Output a `<!-- ROLLBACK REPORT -->` block listing the exact error and the conflicting dependency versions
4. Stop. Bring the report back to the Architect.

---

## Codex Self-Check (Run Before Declaring Done)

**TypeScript**
- [ ] `npm --prefix functions run build` — zero errors (devDep additions must not break the existing build)
- [ ] `npm --prefix functions test -- --passWithNoTests` — exits 0 with "no tests found" or equivalent success message; zero crashes during harness initialization
- [ ] Zero `any` types introduced in either helper file
- [ ] Zero type assertions (`as X`) without an explanatory comment

**Conventions**
- [ ] Zero `console.log` / `console.error` / `console.warn` in helper files
- [ ] Zero relative imports — `../../` does not appear; all internal imports use relative paths within `functions/src/` as appropriate (no `@/` alias — not available in functions context)
- [ ] `.jest-cache` added to `functions/.gitignore` (or root `.gitignore` if no functions-level one exists)

**Firebase / Security**
- [ ] No Cloud Function source files were modified
- [ ] `functions/src/index.ts` was not touched

**Architecture**
- [ ] `jest.mock()` calls are at module scope in both helper files — not inside functions or blocks
- [ ] `resetAllMocks()` and `resetStripeMocks()` are exported but not called within the helper files themselves
- [ ] `--passWithNoTests` flag present in the `test` script in `functions/package.json`
- [ ] No imports from `@/`, `constants/`, or any directory outside `functions/`

**Platform**
- [ ] `testEnvironment: 'node'` confirmed in `jest.config.ts` — not `jsdom`

---

## Acceptance Criteria

- [ ] `functions/jest.config.ts` created with `preset: 'ts-jest'`, `testEnvironment: 'node'`, `testMatch: ['**/__tests__/**/*.test.ts']`
- [ ] `functions/src/__tests__/helpers/firebaseAdminMock.ts` created and exports: `mockFirestoreInstance`, `mockAuthInstance`, `mockStorageInstance`, `mockBatch`, `mockTransaction`, `mockDocRef`, `mockQuery`, `mockFieldValue`, `mockTimestamp`, `resetAllMocks`, `makeDocSnapshot`, `makeQuerySnapshot`
- [ ] `functions/src/__tests__/helpers/stripeMock.ts` created and exports: `mockStripeInstance`, `mockStripeSubscriptions`, `mockStripeCustomers`, `resetStripeMocks`
- [ ] `functions/package.json` updated with `jest`, `ts-jest`, `@types/jest`, `firebase-functions-test` in devDependencies
- [ ] `functions/package.json` `test` script set to `"jest --passWithNoTests"`
- [ ] `npm --prefix functions run build` passes with zero errors
- [ ] `npm --prefix functions test` exits 0 (no test files yet; `--passWithNoTests` handles this)
- [ ] `.jest-cache` added to `.gitignore`
- [ ] `functions/src/index.ts` unchanged — confirm with `git diff functions/src/index.ts` showing no changes

---

## Do Not Touch

`functions/src/index.ts` (append-only; this task has no new CF exports),
`functions/src/deleteAccount.ts` (tested in Task 105 — read only for mock surface reference),
`functions/src/restoreStripeSubscription.ts` (tested in Task 105 — read only),
`functions/src/recordSwipe.ts` (tested in Task 103 — read only),
`functions/src/activateBoost.ts` (tested in Task 104 — read only),
`functions/src/createCheckin.ts` (tested in Task 104 — read only),
`firestore.rules`,
`firestore.indexes.json`,
any file in `admin/`,
any file in `app/`,
any file in `store/`,
`constants/`,
`i18n/`

---

## Commit

```
git commit -m "task-102: jest harness for cloud functions"
```

---

## After This Session

Update `CHANGELOG.md` using this template:

```
## [Phase 4E — Task 102] — YYYY-MM-DD

### Completed

- Task 102: Jest harness for Cloud Functions
- Installed jest, ts-jest, @types/jest, firebase-functions-test in functions/devDependencies
- Created jest.config.ts with node environment and ts-jest preset
- Created firebaseAdminMock.ts: Firestore (doc, collection, runTransaction, writeBatch), Auth (getUser, deleteUser), and Storage (bucket/file) mocks + resetAllMocks() helper
- Created stripeMock.ts: Stripe subscriptions, customers, billingPortal, checkout.sessions mocks + resetStripeMocks() helper

### Files Created

- functions/jest.config.ts: Jest configuration for functions package
- functions/src/__tests__/helpers/firebaseAdminMock.ts: shared Admin SDK mock with reset helper
- functions/src/__tests__/helpers/stripeMock.ts: shared Stripe mock with reset helper

### Files Modified

- functions/package.json: added jest/ts-jest/firebase-functions-test devDependencies; added test script

### Architecture Decisions

- [Any non-obvious version pin or configuration decision made]
- `--passWithNoTests` added to test script so the harness validates before any .test.ts files exist

### Conflict Risks Introduced

- None — no CF source files touched; index.ts unchanged

### Known Issues / Deferred

- None — test suites to be written in Tasks 103–105

### Next Up

- Task 103: Unit tests — recordSwipe
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 103 prompt.

---

## Reasoning Level

Medium
