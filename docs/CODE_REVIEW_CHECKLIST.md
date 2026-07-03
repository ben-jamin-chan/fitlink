# CODE_REVIEW_CHECKLIST.md — [APP_NAME]
# Adapted from ECC's code-reviewer.md for the React Native / Expo / Firebase stack.
# Paste this entire file into a second Codex session after any task to get a
# structured review of the diff. This is NOT run automatically — you invoke it.

---

## How to Use This File

After Codex completes a task and you've committed (or before committing, if you want
a second opinion first):

1. Open a fresh Codex session in Cursor (same repo, same branch)
2. Paste this entire file as the prompt, followed by: "Review the diff from task-XX
   against this checklist. Do not make changes — report only."
3. Codex runs `git diff` (or `git diff --staged` if uncommitted) and reviews against
   the sections below
4. Read the verdict. BLOCK → fix before committing. WARNING → your call. APPROVE → ship it.

This is the manual equivalent of ECC's `code-reviewer` subagent, scoped to our stack.

---

## Review Process

1. **Gather context** — `git diff --staged` and `git diff`. If no diff, check
   `git log --oneline -5` for the most recent commit.
2. **Understand scope** — Which files changed, what task they belong to, how they connect.
3. **Read surrounding code** — Don't review changes in isolation. Read the full file,
   check imports, callers, and the Zustand store shape if a store was touched.
4. **Apply the checklist below**, CRITICAL → LOW.
5. **Report findings** in the format at the bottom. Only report what you're >80% confident
   is a real issue.

---

## Confidence-Based Filtering

- **Report** if >80% confident it's a real issue
- **Skip** stylistic preferences unless they violate CONVENTIONS.md
- **Skip** issues in unchanged code unless CRITICAL security issues
- **Consolidate** similar issues ("3 components missing `t()` wrapping" not 3 separate findings)
- **Prioritize** issues that cause bugs, security holes, or data loss

### Pre-Report Gate

Before writing a finding, answer all four. Any "no" or "unsure" → downgrade severity or drop.

1. **Can I cite the exact line?** File and line number. "Somewhere in the discovery
   store" is not actionable.
2. **Can I describe the concrete failure mode?** Name the input, state, and bad outcome.
   If you can't name the trigger, you're pattern-matching, not reviewing.
3. **Have I read the surrounding context?** Check callers, the relevant type in `types/`,
   and whether a guard already exists one frame up.
4. **Is the severity defensible?** A missing JSDoc is never HIGH. A single `any` in a
   test fixture is never CRITICAL.

### HIGH / CRITICAL Require Proof

Include: exact snippet + line, the specific failure scenario (input/state/outcome), and
why existing guards (types, Firestore rules, framework defaults) don't already catch it.
If you can't produce all three, demote to MEDIUM or drop.

### Zero Findings Is a Valid Outcome

A clean review is a valid review. Do not manufacture findings to justify running this
checklist. If the diff is small, typed correctly, and follows CONVENTIONS.md, the correct
output is a zero-row summary with verdict APPROVE.

---

## Common False Positives — Skip These

Patterns reviewers commonly over-flag in this codebase specifically:

- **"Consider adding error handling"** on a call already wrapped by the caller's
  `try/catch`, or already covered by `ErrorBoundary` at app root.
- **"Missing input validation"** on an internal `services/` or `store/` function whose
  only caller already validates via Zod (React Hook Form screens). Trace the caller first.
- **"Magic number"** for well-known constants already explained by context: `100` (swipe
  threshold px), `15` (rotation degrees), `60` (seconds), `300` (background fetch interval
  seconds), HTTP-adjacent status-like codes. Only flag genuinely unexplained numbers.
- **"Function too long"** for `StyleSheet.create({})` objects, i18n key blocks, or
  exhaustive `switch` statements over a fixed union (e.g. `HttpsError` code handling).
- **"Missing JSDoc"** on a single-purpose hook or service function whose name and
  signature are self-describing (`useLastActive`, `getUserProfile`).
- **"Prefer `const`"** when the variable is reassigned inside a `.onUpdate()` worklet —
  read the whole gesture handler before flagging.
- **"Possible null/undefined"** when a preceding `if (!request.auth)` guard or optional
  chaining (`?.`) already narrows the type. Trace type flow, don't pattern-match on `?.`.
- **"N+1 reads"** on a fixed-cardinality loop (e.g. iterating the 4 supported languages,
  or the fixed 16 onboarding activities) — this is not the same as N+1 over user-scale data.
- **"Missing await"** on an intentionally fire-and-forget call — e.g. a `void
  Notifications.setBadgeCountAsync(...)` or analytics ping that shouldn't block the UI thread.
- **"Should add a test"** — testing infrastructure is a known, accepted gap for this
  project (see ARCHITECT.md "Deferred" section). Do not flag missing tests as an issue
  unless the task explicitly required them.
- **"Hardcoded value"** inside an i18n placeholder value (English text used as a
  placeholder in `my.json`/`zh.json`/`ta.json` before real translation) — this is the
  documented CONVENTIONS.md pattern, not a bug.

When tempted to flag one of these, ask: "Would Benjamin actually change this in review?"
If no, skip it.

---

## Review Checklist

### Security & Data Integrity (CRITICAL)

- **Server-only field written from client** — `age`, `banned`, `premium`, `photoVerified`,
  `verifiedAt`, `boostExpiresAt`, `stripeCustomerId` appearing in any client-side `updateDoc`
  or `setDoc` call
- **Missing `request.auth` check** — any new Cloud Function without `if (!request.auth)
  throw new HttpsError('unauthenticated', ...)` as the first line
- **Missing region** — any new Cloud Function not specifying `{ region: 'asia-southeast1' }`
- **`new Date()` instead of `serverTimestamp()`** — any Firestore timestamp write using
  client time instead of `serverTimestamp()` / `FieldValue.serverTimestamp()`
- **Counter decrement without transaction** — any read-then-write counter pattern
  (`dailyLikes.count`, `attendees.length` checks) using a batch instead of `runTransaction`
- **`FieldValue.delete()` on a required field** — check the field is genuinely optional
  in its `types/` interface before allowing deletion
- **Exposed Strava/Stripe credentials** — `accessToken`, `refreshToken`,
  `stripeCustomerId` readable from a client-facing Firestore read or logged to console
- **Firestore rules gap** — a new collection or field with no corresponding rule (falls
  through to implicit deny is *safe* but must still be explicit per CONVENTIONS.md)

```typescript
// BAD: server-only field written from client
await updateDoc(userRef, { premium: { tier: 'pro', active: true } })

// GOOD: client only ever reads premium status; CF (stripeWebhook) writes it
const isPro = profile.premium?.tier === 'pro'
```

```typescript
// BAD: batch used for a counter decrement (race condition)
const batch = db.batch()
batch.update(dailyLikesRef, { count: currentCount - 1 })

// GOOD: transaction reads current value at write time
await db.runTransaction(async (tx) => {
  const doc = await tx.get(dailyLikesRef)
  const current = doc.data()?.count ?? 0
  tx.update(dailyLikesRef, { count: Math.max(0, current - 1) })
})
```

### Code Quality (HIGH)

- **Large functions** (>50 lines) — split, unless it's a `StyleSheet.create` or exhaustive switch
- **Large files** (>800 lines) — extract by responsibility
- **Deep nesting** (>4 levels) — early returns, extracted helpers
- **Missing error handling** — unhandled promise rejection, empty `catch {}` with no comment
- **Mutation in Zustand store** — direct mutation of state instead of returning a new object
  in `set()`
- **`console.log` / `console.error` / `console.warn`** left in any client or function file
- **Dead code** — commented-out blocks, unused imports, unreachable branches
- **Relative imports** — `../../` anywhere instead of `@/`
- **Inline styles** — `style={{ }}` anywhere in JSX
- **Hardcoded user-facing string** — English text not wrapped in `t()`

```typescript
// BAD: direct mutation in Zustand
set((state) => { state.swipeHistory.push(entry); return state })

// GOOD: new array
set((state) => ({ swipeHistory: [...state.swipeHistory, entry] }))
```

### React Native / Expo Patterns (HIGH)

- **Reanimated 2 API used** — `useAnimatedGestureHandler` anywhere (removed in Reanimated 3)
- **State update inside a worklet** — `setState` or Zustand `set()` called directly inside
  `.onUpdate()` / `.onEnd()` without `runOnJS()`
- **`expo-video` imported in `SwipeCard.tsx`** — breaks the 60fps discovery constraint
  (video belongs only in `FullProfileModal.tsx`)
- **Missing `Platform.OS` guard** — any Apple HealthKit, Google Fit, or Apple Sign-In code
  without a platform check
- **`TaskManager.defineTask` inside a hook body** — must be at module scope
- **Zustand store imported inside a background task callback** — background tasks run in
  an isolated JS context; only `AsyncStorage` + extracted `services/` functions are valid
- **Missing dependency array entries** — `useEffect` referencing a value not listed in deps
- **Missing cleanup** — `Audio.Recording` / `Audio.Sound` / `expo-video` player not
  unloaded/paused in `useEffect` cleanup or on navigation away
- **Index used as list key** — `key={i}` on a `FlatList`/`.map()` over reorderable data
  (matches, events) instead of a stable ID

```typescript
// BAD: Zustand action called directly inside a worklet
.onEnd((event) => {
  if (event.translationX > 100) {
    useDiscoveryStore.getState().recordSwipe('right')  // wrong thread
  }
})

// GOOD: runOnJS bridges back to the JS thread
.onEnd((event) => {
  if (event.translationX > 100) {
    runOnJS(onSwipeRight)()
  }
})
```

### Firebase / Cloud Functions Patterns (HIGH)

- **`onDocumentUpdated` with no before/after guard** — trigger body runs on every
  document write instead of checking the specific field delta first
- **Unbounded Firestore query** — a query on a potentially large collection with no
  `.limit()` (e.g. `/events`, `/matches`)
- **N+1 Firestore reads at user scale** — fetching related documents in a loop instead of
  batching with `Promise.allSettled` or a single query with `where ... in`
- **Missing `HttpsError` code specificity** — throwing a generic error instead of the
  correct code from the reference table in CONVENTIONS.md (`already-exists`,
  `failed-precondition`, `permission-denied`, etc.)
- **Client error message leakage** — raw Firebase/Firestore error text shown to the user
  instead of going through `mapFirebaseError()`

### Performance (MEDIUM)

- **Inefficient discovery scoring** — O(n²) candidate comparison where O(n) suffices
- **Missing `React.memo` / `useMemo`** on an expensive computation re-run every render
  (e.g. `filteredMatches()` recomputing the full sort/filter on every keystroke without
  debounce)
- **Large unoptimized image** — upload skipping the `expo-image-manipulator` compression step
- **Synchronous heavy work on the JS thread** — anything that could block animation frames
  during a swipe gesture

### Best Practices (LOW)

- **TODO without a task reference** — `// TODO: fix this` instead of `// TODO(task-XX): fix this`
- **Poor naming** — single-letter variables in non-trivial logic
- **Inconsistent formatting** — mixed quote styles, inconsistent semicolons

---

## Review Output Format

```
[CRITICAL] Server-only field written from client
File: store/profileStore.ts:47
Issue: `updateProfile()` includes `premium` in its writable payload, allowing a client
  call to set their own premium tier. This bypasses stripeWebhook and grants free premium.
Fix: Remove `premium` from the client-writable fields; it must only ever be read.

  await updateProfile({ premium: { tier: 'pro' } })   // BAD — client sets own tier
  // premium is set exclusively by stripeWebhook CF — never write it from client
```

### Summary Format

```
## Review Summary — Task XX

| Severity | Count | Status |
|----------|-------|--------|
| CRITICAL | 0     | pass   |
| HIGH     | 1     | warn   |
| MEDIUM   | 2     | info   |
| LOW      | 0     | note   |

Verdict: WARNING — 1 HIGH issue should be resolved before merge.
```

## Approval Criteria

- **APPROVE** — No CRITICAL or HIGH issues, including a clean review with zero findings
- **WARNING** — HIGH issues only (can merge with caution, your call)
- **BLOCK** — Any CRITICAL issue — must fix before committing

Do not withhold approval to appear rigorous. If the diff is clean, approve it.

---

## AI-Generated Code Addendum

Since every diff reviewed here was written by Codex, prioritize:

1. **Behavioral regressions** — did this task's change silently break a constraint from
   an earlier task (e.g. Task 84 touching `recordSwipe.ts` and accidentally dropping the
   `'rewind'` direction added in Task 72)?
2. **Trust boundary assumptions** — did Codex assume a client value is safe when it
   should have been re-validated server-side?
3. **Hidden coupling / architecture drift** — did Codex introduce a pattern that works
   but contradicts an established one (e.g. a new Zustand store action that uses
   `useState` internally instead of the store's own `set()`)?
4. **Unnecessary complexity** — did Codex over-engineer a Low/Medium task with patterns
   only justified at High/Extra High (e.g. adding a transaction where a simple write
   would do, or introducing a new abstraction layer for a single call site)?

---

*CODE_REVIEW_CHECKLIST.md — [APP_NAME] | June 2026*
*Adapted from ECC's code-reviewer.md for React Native / Expo / Firebase / Zustand.*
*Pair with SECURITY_REVIEW_CHECKLIST.md for tasks touching Cloud Functions or Firestore rules.*
