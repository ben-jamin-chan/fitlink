# SECURITY_REVIEW_CHECKLIST.md — [APP_NAME]
# Adapted from ECC's security-reviewer.md for Firebase Cloud Functions, Firestore
# security rules, Stripe, and Strava OAuth. Most of OWASP Top 10 does not apply to
# this architecture (no SQL, no XML parsing, no cookie-based CSRF surface) — this
# checklist is narrowed to what actually matters for our stack.

---

## How to Use This File

Paste this entire file into a second Codex session as a prompt: "Review the diff from
task-XX against this checklist. Report only — do not make changes."

**Always run this** (not optional) for any task that touches:
- A new or modified Cloud Function
- `firestore.rules`
- Strava OAuth token handling
- Stripe checkout, webhook, or portal session code
- Any field on `/users/{uid}` that interacts with server-only fields

For everything else, `CODE_REVIEW_CHECKLIST.md` alone is sufficient.

---

## Why This Is Narrower Than Generic OWASP Checklists

| OWASP Top 10 Item | Applies to Fitlink? | Why |
|---|---|---|
| Injection (SQL) | ❌ No | Firestore has no SQL surface |
| Broken Authentication | ✅ Yes | Firebase Auth + `request.auth` checks |
| Sensitive Data Exposure | ✅ Yes | Strava tokens, Stripe customer IDs |
| XXE | ❌ No | No XML parsing anywhere in the stack |
| Broken Access Control | ✅ Yes | Firestore rules + server-only fields |
| Security Misconfiguration | ✅ Yes | Region config, App Check, env vars |
| XSS | ⚠️ Minimal | React Native doesn't render raw HTML; low surface |
| Insecure Deserialization | ❌ No | No untrusted serialized object deserialization |
| Known Vulnerable Dependencies | ✅ Yes | `npm audit` still applies |
| Insufficient Logging | ✅ Yes | Crashlytics + avoiding PII in logs |

A generic OWASP pass on this codebase produces noise (flagging for SQL injection that
cannot occur). Use the checklist below instead — it's the narrowed, stack-specific version.

---

## Review Workflow

### 1. Initial Scan
```bash
npm audit --audit-level=high
npm --prefix functions audit --audit-level=high
```
Search the diff for hardcoded secrets, then review the specific high-risk areas listed
in "Always run this" above.

### 2. Fitlink-Specific Threat Model

Walk through these in order — they map to the actual attack surface of this app:

**A. Client → Cloud Function boundary**
- Can a client call this function without authenticating? (`request.auth` check)
- Can an authenticated-but-unauthorized user call this function and get a result they
  shouldn't (e.g. a free user calling `activateBoost`, a non-creator calling event update)?
- Does the function trust any client-supplied value it shouldn't (age, premium tier,
  `boostExpiresAt`)?

**B. Firestore rules boundary**
- Does every new collection have an explicit rule (not just implicit deny)?
- Does `doesNotModifyServerOnlyFields()` cover every field that's CF-managed?
- Can a user read another user's private subcollection (`dailyLikes`,
  `notificationPreferences`, encrypted Strava credentials)?

**C. Third-party credential boundary**
- Are Strava `accessToken` / `refreshToken` ever readable from a client Firestore read?
- Are they ever logged to console, Crashlytics, or an error message shown to the user?
- Is the Stripe API key referenced anywhere outside `functions/src` (i.e. leaked into
  client bundle via a wrong `EXPO_PUBLIC_` prefix)?

**D. Race conditions on shared counters**
- Daily like count, boost cooldown, event `maxAttendees` — read-then-write patterns that
  need `runTransaction`, not a batch or plain `update()`

**E. Rate limiting / abuse surface**
- Auth attempts (5/hour — already enforced via App Check, verify not weakened)
- OTP resend (60s client timer + 5 max server attempts)
- Daily likes (50/day free tier — verify still enforced server-side, not just client UI)

### 3. Code Pattern Review

| Pattern | Severity | Fix |
|---|---|---|
| Hardcoded API key / Stripe secret / Strava client secret | CRITICAL | `process.env`, never in source |
| `EXPO_PUBLIC_` prefix on a value that must stay server-only | CRITICAL | Remove prefix; access only in `functions/src` |
| Missing `request.auth` check as first line of callable CF | CRITICAL | Add `if (!request.auth) throw new HttpsError('unauthenticated', ...)` |
| Server-only field in client `updateDoc`/`setDoc` payload | CRITICAL | Remove; route through the owning Cloud Function |
| Counter read-then-write via batch instead of transaction | CRITICAL | Use `runTransaction` |
| Strava token logged or returned to client | CRITICAL | Strip from any response payload; never `console.log` |
| `FieldValue.delete()` on a required schema field | HIGH | Verify field is `optional` in `types/`; use empty value instead if required |
| `onDocumentUpdated` trigger with no before/after guard | HIGH | Add explicit field-delta check before proceeding |
| New Firestore collection with no explicit rule | HIGH | Add explicit `allow read, write: if false` at minimum, then scope up |
| Raw Firebase error shown to user | MEDIUM | Route through `mapFirebaseError()` |
| Missing region on new Cloud Function | MEDIUM | Add `{ region: 'asia-southeast1' }` |
| PII (name, phone, email, location) in `console.log` | MEDIUM | Remove or redact before logging |

```typescript
// CRITICAL — Strava token exposed in CF response
export const exchangeStravaToken = onCall({ region: 'asia-southeast1' }, async (request) => {
  const tokens = await exchangeWithStrava(code)
  return { tokens }  // BAD — leaks accessToken/refreshToken to client
})

// GOOD — store server-side, return only a connection status
export const exchangeStravaToken = onCall({ region: 'asia-southeast1' }, async (request) => {
  const tokens = await exchangeWithStrava(code)
  await admin.firestore().doc(`users/${request.auth.uid}`).update({
    'fitnessTracking.strava.connected': true,
    'fitnessTracking.strava.accessToken': encryptToken(tokens.access_token),
    'fitnessTracking.strava.refreshToken': encryptToken(tokens.refresh_token),
  })
  return { connected: true }  // no raw token in the response
})
```

```typescript
// CRITICAL — missing auth check
export const activateBoost = onCall({ region: 'asia-southeast1' }, async (request) => {
  const uid = request.auth.uid  // BAD — crashes if request.auth is null, but worse:
  // an unauthenticated check should reject explicitly before this line is ever reached
})

// GOOD — explicit check first
export const activateBoost = onCall({ region: 'asia-southeast1' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in')
  }
  const uid = request.auth.uid
})
```

---

## Common False Positives

- `.env.example` containing placeholder/empty values — not a real secret
- Test/dev Firebase project credentials clearly scoped to `gym-dating-dev`
- `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` being client-visible — this is **intentional**
  per Task 78's constraints (restricted by bundle ID, not meant to be server-only)
- `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` being client-visible — Stripe publishable keys
  are designed to be public; only the *secret* key is sensitive
- Strava `clientId` (not `clientSecret`) appearing in client code — the client ID is
  not sensitive, only the secret and the exchanged tokens are

**Always verify which Stripe/Strava key is which before flagging — publishable/client
IDs are not secrets; secret keys and exchanged user tokens are.**

---

## Emergency Response

If a CRITICAL issue is found (especially: exposed Stripe secret key, exposed Strava
client secret, or a security-rules gap that's already been deployed):

1. Document the issue with file, line, and exact exposure
2. Stop and flag to Benjamin immediately — do not continue with the current task
3. If a real secret was exposed (not a placeholder): rotate it in the relevant
   dashboard (Stripe Dashboard / Strava API settings / Firebase console) before
   continuing any further work
4. If a Firestore rules gap was already deployed: deploy the corrected rule
   immediately, then audit whether any data was accessed during the gap window
5. After remediation: scan the rest of the codebase for the same pattern —
   a single instance often indicates a repeated mistake elsewhere

---

## When to Run This Checklist

**Always:** New Cloud Function, any `firestore.rules` change, Strava OAuth code, Stripe
checkout/webhook/portal code, any change to server-only field handling, dependency updates
in `functions/package.json`.

**Immediately (out of band, don't wait for task completion):** If you ever suspect a
secret was committed to git history, if `npm audit` reports a CRITICAL CVE, or before
any production Firebase project deployment (`gym-dating-prod`).

---

## Success Metrics

- Zero CRITICAL issues
- All HIGH issues addressed before commit
- No secrets, tokens, or PII in any logged output
- `npm audit` clean at `--audit-level=high` for both root and `functions/`
- Every new Cloud Function has the auth check, the region, and the correct `HttpsError` code

---

*SECURITY_REVIEW_CHECKLIST.md — [APP_NAME] | June 2026*
*Adapted from ECC's security-reviewer.md — narrowed to the Firebase/Stripe/Strava attack surface.*
*Pair with CODE_REVIEW_CHECKLIST.md for general code quality review.*
