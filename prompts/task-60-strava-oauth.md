# CODEX PROMPT — Task 60: Strava OAuth Integration

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Task 59 is complete. The fitness types and store foundation are in place. The following files are
confirmed built and must not be recreated:

- `types/fitness.ts` — exports `FitnessSource` (alias for `FitnessTrackingSource`), `TodayStats`,
  `WorkoutSession`, `StravaActivity`, `FitnessConnectionStatus`. All Task 60 code imports from here.
- `store/fitnessStore.ts` — `useFitnessStore` with state (`todayStats`, `connections`, `isLoading`,
  `shareOnProfile`) and six actions. `connectSource`, `disconnectSource`, and `syncNow` are currently
  stubs with `console.warn`. Task 60 wires these for `'strava'` only by calling into `services/strava.ts`.
- `types/subscription.ts` — defines `FitnessTrackingSource`, `TodayStats`, `WorkoutSession`,
  `StravaConnection`, and `FitnessTracking` (re-exported via `types/fitness.ts`).
- `types/user.ts` — `UserProfile.fitnessTracking` is typed as `FitnessTracking | undefined`.
- `functions/src/index.ts` — all existing exports must be preserved; only two new exports are added.
- `functions/src/exchangeStravaToken.ts` — does **not** exist yet; this task creates it.
- `functions/src/syncStravaActivity.ts` — does **not** exist yet; this task creates it.
- `services/strava.ts` — does **not** exist yet; this task creates it.
- `functions/.env.example` — already has `EXPO_PUBLIC_STRAVA_CLIENT_ID` and
  `STRAVA_CLIENT_SECRET` placeholder keys (from pre-flight Step B). This task adds
  `STRAVA_TOKEN_ENCRYPTION_KEY`.
- `expo-web-browser`, `expo-auth-session`, `expo-linking` — all installed in Task 48. No new
  package installs are required for the client service layer.
- `services/firebase/firestore.ts` — `updateUserProfile()` is already exported and used throughout
  the codebase. Task 60's `disconnectStrava()` uses it for clearing Strava Firestore fields.

**Critical boundary — secrets must never reach the client bundle.**
`STRAVA_CLIENT_SECRET` and `STRAVA_TOKEN_ENCRYPTION_KEY` are Cloud Function environment
variables only. They must never appear in any file prefixed with `EXPO_PUBLIC_` and must never
be imported in `services/`, `store/`, `app/`, `components/`, or `hooks/`.

**Critical boundary — `connectSource` / `disconnectSource` / `syncNow` stubs in `fitnessStore.ts`
must be wired to the real Strava functions in this task for `source === 'strava'` only.**
Do not remove the stubs for `'appleHealth'` and `'googleFit'` — those are wired in Tasks 61 and 62.

---

## Task 60 — Strava OAuth Integration

**Files to create:**
- `services/strava.ts`
- `functions/src/exchangeStravaToken.ts`
- `functions/src/syncStravaActivity.ts`

**Files to modify:**
- `store/fitnessStore.ts` — wire `connectSource('strava')`, `disconnectSource('strava')`,
  `syncNow('strava')` stubs to real Strava service functions
- `functions/src/index.ts` — add exports for `exchangeStravaToken` and `syncStravaActivity`
- `functions/.env.example` — add `STRAVA_TOKEN_ENCRYPTION_KEY` placeholder key

---

### `services/strava.ts`

This is the client-side Strava service. It handles the OAuth browser flow and delegates all
token exchange and activity fetching to Cloud Functions. This file is consumed by `fitnessStore.ts`
when `source === 'strava'`. It is also used by `ConnectedAppsScreen` (Task 64).

```typescript
import * as WebBrowser from 'expo-web-browser'
import * as AuthSession from 'expo-auth-session'
import { httpsCallable } from 'firebase/functions'
import { doc, updateDoc } from 'firebase/firestore'
import { db, functions } from '@/services/firebase/config'
import { useFitnessStore } from '@/store/fitnessStore'
import type { TodayStats } from '@/types/fitness'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExchangeStravaTokenRequest {
  code: string
}

interface ExchangeStravaTokenResponse {
  success: boolean
}

interface SyncStravaActivityResponse {
  steps: number
  distance: number
  calories: number
  workouts: Array<{ type: string; duration: number; distance?: number; calories?: number }>
}

// ---------------------------------------------------------------------------
// Constants — never secrets; client ID is a public identifier
// ---------------------------------------------------------------------------

const STRAVA_CLIENT_ID = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID ?? ''
const STRAVA_SCOPE = 'activity:read_all'
const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize'

// ---------------------------------------------------------------------------
// connectStrava
// ---------------------------------------------------------------------------

/**
 * Launches the Strava OAuth browser flow, exchanges the auth code via a
 * Cloud Function, and updates fitnessStore with the connected status.
 *
 * Returns true on success, false if the user cancelled or an error occurred.
 * Throws only for unrecoverable programming errors (missing client ID).
 */
export const connectStrava = async (uid: string): Promise<boolean> => {
  if (!STRAVA_CLIENT_ID) {
    throw new Error(
      'EXPO_PUBLIC_STRAVA_CLIENT_ID is not set. ' +
        'Add it to your .env file and restart the dev server.'
    )
  }

  // Build the redirect URI using the app scheme configured in app.json ("fitlink")
  const redirectUri = AuthSession.makeRedirectUri({ scheme: 'fitlink', path: 'strava-auth' })

  // Build the Strava authorization URL
  const authUrl =
    `${STRAVA_AUTH_URL}` +
    `?client_id=${STRAVA_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&approval_prompt=auto` +
    `&scope=${STRAVA_SCOPE}`

  // Open the browser and wait for the redirect
  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri)

  if (result.type !== 'success') {
    // User cancelled or browser was dismissed — not an error
    return false
  }

  // Parse the authorization code from the redirect URL
  const url = result.url
  const codeMatch = url.match(/[?&]code=([^&]+)/)
  if (!codeMatch || !codeMatch[1]) {
    // No code in redirect — Strava returned an error
    return false
  }
  const code = codeMatch[1]

  // Exchange the code for tokens via Cloud Function (never client-side)
  const exchange = httpsCallable<ExchangeStravaTokenRequest, ExchangeStravaTokenResponse>(
    functions,
    'exchangeStravaToken'
  )
  const response = await exchange({ code })

  if (!response.data.success) {
    return false
  }

  // Update store connection status (Firestore is updated server-side by the Cloud Function)
  useFitnessStore.getState().setConnectionStatus('strava', { connected: true, lastSync: null })

  return true
}

// ---------------------------------------------------------------------------
// syncStrava
// ---------------------------------------------------------------------------

/**
 * Triggers a Strava activity sync via Cloud Function.
 * Returns the updated TodayStats on success.
 * Throws if the function call fails — caller must catch.
 */
export const syncStrava = async (): Promise<TodayStats> => {
  const syncFn = httpsCallable<Record<string, never>, SyncStravaActivityResponse>(
    functions,
    'syncStravaActivity'
  )
  const response = await syncFn({})
  const data = response.data

  // Map Cloud Function response to TodayStats shape
  const stats: TodayStats = {
    steps: data.steps,
    distance: data.distance,
    calories: data.calories,
    workouts: data.workouts,
    updatedAt: null, // populated by Firestore serverTimestamp server-side; null is safe for local display
    source: 'strava',
  }

  return stats
}

// ---------------------------------------------------------------------------
// disconnectStrava
// ---------------------------------------------------------------------------

/**
 * Clears the Strava connection in Firestore and updates the store.
 * Token deletion is handled by clearing fitnessTracking.strava on the server;
 * the client clears only the connection status fields it owns.
 *
 * Note: The accessToken and refreshToken fields are server-managed and blocked
 * from client writes by Firestore security rules. This update only touches
 * `connected` and `lastSync` which are allowed client fields.
 */
export const disconnectStrava = async (uid: string): Promise<void> => {
  const userRef = doc(db, 'users', uid)
  await updateDoc(userRef, {
    'fitnessTracking.strava.connected': false,
    'fitnessTracking.strava.lastSync': null,
  })

  // Clear store connection status
  useFitnessStore
    .getState()
    .setConnectionStatus('strava', { connected: false, lastSync: null })
}
```

---

### `store/fitnessStore.ts` — Update

Wire the three Strava stubs to real service calls. All other actions, state, and persist config
remain exactly as Task 59 built them. Do not touch `connectSource`/`disconnectSource`/`syncNow`
for `'appleHealth'` or `'googleFit'` — those remain stubs.

Add the following import at the top of the file (with other service imports):

```typescript
import {
  connectStrava,
  syncStrava,
  disconnectStrava,
} from '@/services/strava'
```

Also add a new action `setConnectionStatus` to the store so `services/strava.ts` can update the
connection state without importing the whole store in a circular fashion. Add it to both the
interface and the implementation:

```typescript
// Add to the store state interface:
setConnectionStatus: (
  source: FitnessSource,
  status: FitnessConnectionStatus
) => void

// Add to the create() implementation:
setConnectionStatus: (source, status) =>
  set((state) => ({
    connections: { ...state.connections, [source]: status },
  })),
```

Replace the existing `connectSource`, `disconnectSource`, and `syncNow` implementations. The
new implementations dispatch on `source` and call the real Strava service functions when
`source === 'strava'`; the other branches keep their `console.warn` stubs until Tasks 61–62:

```typescript
connectSource: async (uid, source) => {
  set({ isLoading: true })
  try {
    if (source === 'strava') {
      await connectStrava(uid)
    } else if (source === 'appleHealth') {
      console.warn('connectSource(appleHealth) not yet implemented — Task 61')
    } else if (source === 'googleFit') {
      console.warn('connectSource(googleFit) not yet implemented — Task 62')
    }
  } finally {
    set({ isLoading: false })
  }
},

disconnectSource: async (uid, source) => {
  set({ isLoading: true })
  try {
    if (source === 'strava') {
      await disconnectStrava(uid)
    } else if (source === 'appleHealth') {
      console.warn('disconnectSource(appleHealth) not yet implemented — Task 61')
    } else if (source === 'googleFit') {
      console.warn('disconnectSource(googleFit) not yet implemented — Task 62')
    }
  } finally {
    set({ isLoading: false })
  }
},

syncNow: async (uid, source) => {
  set({ isLoading: true })
  try {
    if (source === 'strava') {
      const stats = await syncStrava()
      set({ todayStats: stats })
    } else if (source === 'appleHealth') {
      console.warn('syncNow(appleHealth) not yet implemented — Task 61')
    } else if (source === 'googleFit') {
      console.warn('syncNow(googleFit) not yet implemented — Task 62')
    }
  } finally {
    set({ isLoading: false })
  }
},
```

Do not touch `fetchTodayStats`, `setShareOnProfile`, the persist config, the initial state, or
the i18n keys.

---

### `functions/src/exchangeStravaToken.ts`

2nd gen callable function (`asia-southeast1`). Receives the OAuth `code` from the client,
exchanges it for Strava access + refresh tokens, encrypts the refresh token with AES-256-CBC,
and writes all fields to `users/{uid}.fitnessTracking.strava` in Firestore.

The encryption key and Strava client secret are read from Cloud Function environment variables
only — never from `process.env.EXPO_PUBLIC_*`.

```typescript
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import * as crypto from 'crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExchangeStravaTokenData {
  code: string
}

interface StravaTokenResponse {
  token_type: string
  expires_at: number
  expires_in: number
  refresh_token: string
  access_token: string
  athlete: { id: number }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Encrypts plaintext using AES-256-CBC.
 * Returns a colon-separated string: "iv:encryptedHex"
 * The IV is randomly generated per encryption call for security.
 */
const encryptToken = (plaintext: string, keyHex: string): string => {
  const key = Buffer.from(keyHex, 'hex')
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

export const exchangeStravaToken = onCall(
  { region: 'asia-southeast1' },
  async (request: CallableRequest<ExchangeStravaTokenData>) => {
    // Auth guard
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in')
    }
    const uid = request.auth.uid

    // Input validation
    const { code } = request.data
    if (!code || typeof code !== 'string' || code.trim().length === 0) {
      throw new HttpsError('invalid-argument', 'code must be a non-empty string')
    }

    // Read secrets from environment (Cloud Function runtime only)
    const stravaClientId = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID
    const stravaClientSecret = process.env.STRAVA_CLIENT_SECRET
    const encryptionKeyHex = process.env.STRAVA_TOKEN_ENCRYPTION_KEY

    if (!stravaClientId || !stravaClientSecret || !encryptionKeyHex) {
      throw new HttpsError(
        'internal',
        'Strava credentials are not configured in the Cloud Function environment'
      )
    }

    // Exchange authorization code for tokens
    const tokenRes = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: stravaClientId,
        client_secret: stravaClientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      const errorBody: unknown = await tokenRes.json().catch(() => null)
      console.error('Strava token exchange failed', tokenRes.status, errorBody)
      throw new HttpsError('internal', 'Strava token exchange failed')
    }

    const tokens = (await tokenRes.json()) as StravaTokenResponse

    // Encrypt the refresh token before storing
    const encryptedRefreshToken = encryptToken(tokens.refresh_token, encryptionKeyHex)

    // Write to Firestore — server-managed fields, Admin SDK bypasses security rules
    const userRef = admin.firestore().doc(`users/${uid}`)
    await userRef.update({
      'fitnessTracking.strava.connected': true,
      'fitnessTracking.strava.accessToken': tokens.access_token,
      'fitnessTracking.strava.refreshToken': encryptedRefreshToken,
      'fitnessTracking.strava.expiresAt': tokens.expires_at,
      'fitnessTracking.strava.lastSync': admin.firestore.FieldValue.serverTimestamp(),
    })

    return { success: true }
  }
)
```

---

### `functions/src/syncStravaActivity.ts`

2nd gen callable function (`asia-southeast1`). Reads the user's Strava tokens from Firestore,
refreshes the access token if expired (decrypting / re-encrypting the refresh token), fetches
activities from the last 7 days via the Strava API, calculates today's stats, writes the result
to `users/{uid}.fitnessTracking.todayStats`, and returns a `TodayStats`-compatible payload.

```typescript
import { onCall, HttpsError, CallableRequest } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import * as crypto from 'crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StravaConnection {
  connected: boolean
  accessToken: string
  refreshToken: string   // AES-256-CBC encrypted — format: "iv:encryptedHex"
  expiresAt: number      // Unix timestamp in seconds
  lastSync: admin.firestore.Timestamp | null
}

interface StravaActivity {
  id: number
  name: string
  type: string
  start_date: string     // ISO 8601
  moving_time: number    // seconds
  distance: number       // metres
  total_elevation_gain: number
  calories: number | null
}

interface SyncStravaActivityResponse {
  steps: number
  distance: number
  calories: number
  workouts: Array<{ type: string; duration: number; distance?: number; calories?: number }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const encryptToken = (plaintext: string, keyHex: string): string => {
  const key = Buffer.from(keyHex, 'hex')
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`
}

const decryptToken = (ciphertext: string, keyHex: string): string => {
  const [ivHex, encryptedHex] = ciphertext.split(':')
  if (!ivHex || !encryptedHex) {
    throw new Error('Invalid encrypted token format')
  }
  const key = Buffer.from(keyHex, 'hex')
  const iv = Buffer.from(ivHex, 'hex')
  const encryptedBuffer = Buffer.from(encryptedHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
  const decrypted = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()])
  return decrypted.toString('utf8')
}

/** Returns Unix timestamp in seconds for midnight in UTC+8 (Asia/Kuala_Lumpur). */
const getTodayStartUnix = (): number => {
  const now = new Date()
  // UTC+8 offset: subtract 8 hours to get UTC, then floor to UTC midnight, then add 8 hours back
  const utc8OffsetMs = 8 * 60 * 60 * 1000
  const utc8Now = new Date(now.getTime() + utc8OffsetMs)
  const utc8Midnight = new Date(
    Date.UTC(utc8Now.getUTCFullYear(), utc8Now.getUTCMonth(), utc8Now.getUTCDate())
  )
  // Convert back to UTC epoch: subtract offset
  return Math.floor((utc8Midnight.getTime() - utc8OffsetMs) / 1000)
}

// ---------------------------------------------------------------------------
// Function
// ---------------------------------------------------------------------------

export const syncStravaActivity = onCall(
  { region: 'asia-southeast1' },
  async (request: CallableRequest<Record<string, never>>): Promise<SyncStravaActivityResponse> => {
    // Auth guard
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be logged in')
    }
    const uid = request.auth.uid

    // Read secrets
    const stravaClientId = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID
    const stravaClientSecret = process.env.STRAVA_CLIENT_SECRET
    const encryptionKeyHex = process.env.STRAVA_TOKEN_ENCRYPTION_KEY

    if (!stravaClientId || !stravaClientSecret || !encryptionKeyHex) {
      throw new HttpsError('internal', 'Strava credentials not configured')
    }

    // Read user's Strava connection from Firestore
    const userDoc = await admin.firestore().doc(`users/${uid}`).get()
    if (!userDoc.exists) {
      throw new HttpsError('not-found', 'User profile not found')
    }

    const userData = userDoc.data() as Record<string, unknown>
    const fitnessTracking = userData['fitnessTracking'] as Record<string, unknown> | undefined
    const stravaData = fitnessTracking?.['strava'] as StravaConnection | undefined

    if (!stravaData?.connected) {
      throw new HttpsError('failed-precondition', 'Strava is not connected for this user')
    }

    // Refresh access token if expired (with 60s buffer)
    const nowUnix = Math.floor(Date.now() / 1000)
    let accessToken = stravaData.accessToken

    if (nowUnix >= stravaData.expiresAt - 60) {
      const decryptedRefresh = decryptToken(stravaData.refreshToken, encryptionKeyHex)

      const refreshRes = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: stravaClientId,
          client_secret: stravaClientSecret,
          grant_type: 'refresh_token',
          refresh_token: decryptedRefresh,
        }),
      })

      if (!refreshRes.ok) {
        throw new HttpsError('internal', 'Failed to refresh Strava token')
      }

      const refreshed = (await refreshRes.json()) as {
        access_token: string
        refresh_token: string
        expires_at: number
      }

      accessToken = refreshed.access_token
      const newEncryptedRefresh = encryptToken(refreshed.refresh_token, encryptionKeyHex)

      // Persist new tokens
      await admin.firestore().doc(`users/${uid}`).update({
        'fitnessTracking.strava.accessToken': accessToken,
        'fitnessTracking.strava.refreshToken': newEncryptedRefresh,
        'fitnessTracking.strava.expiresAt': refreshed.expires_at,
      })
    }

    // Fetch activities from last 7 days
    const sevenDaysAgoUnix = nowUnix - 7 * 24 * 60 * 60
    const activitiesRes = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?after=${sevenDaysAgoUnix}&per_page=50`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (!activitiesRes.ok) {
      throw new HttpsError('internal', 'Failed to fetch Strava activities')
    }

    const activities = (await activitiesRes.json()) as StravaActivity[]

    // Filter to activities that started today (UTC+8)
    const todayStartUnix = getTodayStartUnix()
    const todayActivities = activities.filter((a) => {
      const activityUnix = Math.floor(new Date(a.start_date).getTime() / 1000)
      return activityUnix >= todayStartUnix
    })

    // Calculate aggregated stats
    const totalDistanceKm =
      todayActivities.reduce((sum, a) => sum + a.distance, 0) / 1000
    const totalCalories = todayActivities.reduce((sum, a) => sum + (a.calories ?? 0), 0)

    const workouts = todayActivities.map((a) => ({
      type: a.type,
      duration: Math.round(a.moving_time / 60), // seconds → minutes
      distance: a.distance > 0 ? Math.round((a.distance / 1000) * 10) / 10 : undefined,
      calories: a.calories ?? undefined,
    }))

    const stats: SyncStravaActivityResponse = {
      steps: 0, // Strava does not track step count
      distance: Math.round(totalDistanceKm * 10) / 10,
      calories: Math.round(totalCalories),
      workouts,
    }

    // Persist today's stats and update lastSync
    await admin.firestore().doc(`users/${uid}`).update({
      'fitnessTracking.todayStats': {
        ...stats,
        source: 'strava',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      'fitnessTracking.strava.lastSync': admin.firestore.FieldValue.serverTimestamp(),
    })

    return stats
  }
)
```

---

### `functions/src/index.ts` — Update

Add the two new exports. All existing exports must be preserved exactly as they are — do not
modify, reorder, or remove any other export.

```typescript
// Add these two lines alongside the existing exports:
export { exchangeStravaToken } from './exchangeStravaToken'
export { syncStravaActivity } from './syncStravaActivity'
```

---

### `functions/.env.example` — Update

Append the new key to the end of the file. Do not remove or reorder any existing keys.

```
# Strava token encryption — 64-character hex string (32 bytes AES-256 key)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
STRAVA_TOKEN_ENCRYPTION_KEY=
```

---

## Important Architecture Notes for Codex

1. **Strava secrets stay in Cloud Functions only.** `STRAVA_CLIENT_SECRET` and
   `STRAVA_TOKEN_ENCRYPTION_KEY` must never appear in any file under `services/`, `store/`,
   `app/`, `components/`, or `hooks/`. They are read exclusively via `process.env` inside
   `functions/src/`. The only client-side Strava env var is `EXPO_PUBLIC_STRAVA_CLIENT_ID`
   (a public identifier, not a secret).

2. **Refresh token encryption is mandatory before any Firestore write.** The raw Strava
   refresh token must never be stored in plaintext. Always call `encryptToken()` before writing
   and `decryptToken()` before using. Both helpers are defined locally in each Cloud Function
   file (no shared utility file) to keep each function self-contained and deployable
   independently.

3. **`fitnessTracking.strava.accessToken` and `refreshToken` are server-managed fields.**
   The client's `disconnectStrava()` only updates `connected: false` and `lastSync: null` —
   the fields it is permitted to write. It must not attempt to delete or null out
   `accessToken` or `refreshToken` because Firestore security rules will block those writes.
   Token cleanup on disconnect is a Phase 3 Cloud Function trigger.

4. **`connectSource`, `disconnectSource`, and `syncNow` stubs for `'appleHealth'` and
   `'googleFit'` must remain as `console.warn` stubs.** Do not remove them, convert them to
   errors, or add any logic for those platforms. Tasks 61 and 62 own those branches.

5. **`setConnectionStatus` is a new store action required by `services/strava.ts`.** Add it
   to the store interface and implementation in `fitnessStore.ts`. It must update
   `state.connections[source]` immutably using a spread — never mutate state directly.

6. **Cloud Functions use `admin.firestore.FieldValue.serverTimestamp()` — never `new Date()`.**
   Client-side Firestore writes use `serverTimestamp()` from `firebase/firestore`. These are
   different imports — do not mix them.

7. **`functions/src/index.ts` exports must not be reordered or removed.** Only append the two
   new exports. Any existing function that is removed from the index will cause a deployment
   error.

8. **The `TodayStats.updatedAt` field returned from `services/strava.ts → syncStrava()` is
   typed as `null`.** The real timestamp is written server-side by the Cloud Function via
   `serverTimestamp()`. The client uses `null` as a safe placeholder; the displayed "last
   synced" time comes from a fresh Firestore read in `fitnessStore.fetchTodayStats()`,
   not from the sync response.

9. **`expo-web-browser`, `expo-auth-session`, and `expo-linking` are already installed.**
   Do not run any `npx expo install` or `npm install` commands in the client package. No
   new packages are needed for `services/strava.ts`.

10. **`fetch` is available natively in Node 18 Cloud Function runtime.** Do not add
    `node-fetch` or any other fetch polyfill to `functions/package.json`.

---

## Acceptance Criteria

- [ ] `services/strava.ts` created — exports `connectStrava`, `syncStrava`, `disconnectStrava`
      as named exports with explicit argument and return types; zero `any`
- [ ] `functions/src/exchangeStravaToken.ts` created — 2nd gen callable, `asia-southeast1`
      region, auth guard present, reads secrets from `process.env` (not `EXPO_PUBLIC_`),
      encrypts refresh token with `encryptToken()` before Firestore write
- [ ] `functions/src/syncStravaActivity.ts` created — 2nd gen callable, `asia-southeast1`
      region, auth guard present, decrypts refresh token for API call, re-encrypts new
      refresh token if token was refreshed, calculates today's stats and persists them
- [ ] `store/fitnessStore.ts` updated — `setConnectionStatus` action added; `connectSource`,
      `disconnectSource`, and `syncNow` dispatch to real Strava functions when
      `source === 'strava'`; stubs for `appleHealth` and `googleFit` unchanged
- [ ] `functions/src/index.ts` updated — `exchangeStravaToken` and `syncStravaActivity`
      exported; all pre-existing exports untouched
- [ ] `functions/.env.example` updated — `STRAVA_TOKEN_ENCRYPTION_KEY` placeholder key added
- [ ] Zero `any` usage in all new and modified files
- [ ] All imports in `services/strava.ts` use `@/` alias — no relative paths
- [ ] No `STRAVA_CLIENT_SECRET` or `STRAVA_TOKEN_ENCRYPTION_KEY` reference anywhere in client
      source (`services/`, `store/`, `app/`, `components/`, `hooks/`)
- [ ] `EXPO_PUBLIC_STRAVA_CLIENT_ID` is the only Strava env var referenced in client source
- [ ] `admin.firestore.FieldValue.serverTimestamp()` used for all timestamp writes inside
      Cloud Functions — no `new Date()` calls
- [ ] `npx tsc --noEmit` passes at project root with zero errors
- [ ] `npx tsc --noEmit` passes inside `functions/` with zero errors
- [ ] No `console.log` left in any modified client-side file

---

## Do Not Touch

`App.tsx`, `app.json`, `services/firebase/config.ts`, `services/firebase/firestore.ts`,
`types/user.ts`, `types/subscription.ts`, `types/match.ts`, `types/message.ts`,
`constants/`, `i18n/`, `firestore.rules`, `firestore.indexes.json`,
`functions/src/onUserCreated.ts`, `functions/src/onSwipeCreated.ts`,
`functions/src/getDiscoveryStack.ts`, `functions/src/verifyProfilePhoto.ts`,
`functions/src/recordSwipe.ts`, `functions/src/createStripeCheckout.ts`,
`functions/src/stripeWebhook.ts`, `functions/src/onNewMessage.ts`,
`functions/src/unmatchUser.ts`, `functions/package.json`

---

## Commit

```
git commit -m "task-60: Strava OAuth integration — client service, exchangeStravaToken, syncStravaActivity"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 2D — Task 60] — YYYY-MM-DD

### Completed

- Task 60: Strava OAuth Integration
- services/strava.ts: connectStrava (OAuth browser flow), syncStrava (callable wrapper),
  disconnectStrava (Firestore clear)
- functions/src/exchangeStravaToken.ts: 2nd gen callable, token exchange, AES-256-CBC
  refresh token encryption, Firestore write
- functions/src/syncStravaActivity.ts: 2nd gen callable, token refresh logic, Strava
  activities API fetch, today stats calculation, Firestore persist
- store/fitnessStore.ts: setConnectionStatus action added; connectSource/disconnectSource/
  syncNow wired for 'strava'; appleHealth/googleFit stubs preserved
- functions/src/index.ts: two new exports added
- functions/.env.example: STRAVA_TOKEN_ENCRYPTION_KEY added

### Files Created / Modified

- services/strava.ts: created — connectStrava, syncStrava, disconnectStrava named exports
- functions/src/exchangeStravaToken.ts: created — onCall, auth guard, token exchange, encrypt
- functions/src/syncStravaActivity.ts: created — onCall, auth guard, token refresh, API fetch,
  stats write
- store/fitnessStore.ts: setConnectionStatus added; strava dispatch wired in 3 actions
- functions/src/index.ts: exchangeStravaToken and syncStravaActivity exports added
- functions/.env.example: STRAVA_TOKEN_ENCRYPTION_KEY placeholder added

### Architecture Decisions

- encryptToken/decryptToken are defined locally in each Cloud Function file (not a shared
  utility) — each function is self-contained and deployable independently
- disconnectStrava only updates connected/lastSync fields on the client path; raw token fields
  are server-managed and blocked from client writes by Firestore security rules
- TodayStats.updatedAt is null in the syncStrava() return value — the real timestamp is
  written server-side; callers use fetchTodayStats() for display
- fetch() used natively in Node 18 — no node-fetch dependency added

### Known Issues / Deferred

- Strava token cleanup (nulling accessToken/refreshToken) on disconnect deferred to Phase 3
  Cloud Function trigger on user deletion or explicit revocation
- Strava steps are always 0 — Strava API does not provide step counts

### Next Up

- Task 61: Apple Health Integration (services/healthKit.ts, hooks/useAppleHealth.ts, iOS only)
```

Then return to claude.ai with the updated CHANGELOG.md and request the Task 61 prompt.

---

## Reasoning Level

High — Cloud Function token encryption, OAuth redirect parsing, token refresh logic with
conditional re-encryption, and store action wiring with precise stub-preservation constraints.
