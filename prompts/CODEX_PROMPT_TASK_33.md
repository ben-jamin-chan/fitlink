# CODEX PROMPT — Task 33
# Cloud Function: onNewMessage — Push Notifications on New Chat Message

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 1D is nearly complete. Tasks 29–32 delivered the full match and chat stack:

- `store/matchStore.ts` — real-time Firestore listener on `/matches`, `MatchWithProfile[]` state, `unmatch()`, `markAsRead()`
- `store/chatStore.ts` — RTDB message subscription, `sendMessage()`, `sendImage()`, offline queue
- `services/firebase/realtime.ts` — `subscribeToMessages`, `sendMessage`, `unsubscribeFromMessages`
- `app/matches/MatchesScreen.tsx` — matches grid + messages list, real-time updates
- `app/chat/ChatScreen.tsx` — full chat UI, read receipts, image send
- `components/chat/MessageBubble.tsx`, `components/chat/ChatInput.tsx`

Also relevant from earlier tasks:
- `services/notifications.ts` (Task 42 stub may not yet exist — if it does not, this function is the first place push tokens are consumed server-side; client-side registration happens later in Task 42)
- `store/authStore.ts` — `user.uid` available
- Firestore schema — `users/{userId}.expoPushToken?: string` (set by client on notification permission grant; may be absent if user declined)
- Firestore schema — `matches/{matchId}` has `users: [string, string]` and `{userId}_unread: number`
- RTDB schema — `/chats/{matchId}/messages/{messageId}` has `senderId`, `text`, `imageUrl?`, `timestamp`

**This task is a Cloud Function only.** No client-side files are changed.

---

## Task 33 — Cloud Function: `onNewMessage`

**Files to create:**
- `functions/src/onNewMessage.ts`

**Files to modify:**
- `functions/src/index.ts` — export `onNewMessage`

---

### Architecture: How Push Delivery Works

```
User A sends message
  → RTDB write at /chats/{matchId}/messages/{messageId}
    → onNewMessage trigger fires
      → reads match doc from Firestore to find recipient ID
      → reads recipient's expoPushToken from Firestore
      → increments {recipientId}_unread on match doc
      → POSTs to Expo Push API (https://exp.host/--/api/v2/push/send)
        → notification delivered to recipient's device
```

The function uses the **Expo Push API** (HTTP POST), not Firebase Cloud Messaging directly. This is correct for Expo-managed apps — Expo wraps FCM/APNs internally.

---

### `functions/src/onNewMessage.ts`

```typescript
import * as admin from 'firebase-admin'
import { onValueCreated } from 'firebase-functions/v2/database'
import { HttpsError } from 'firebase-functions/v2/https'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RtdbMessage {
  senderId: string
  text: string | null
  imageUrl: string | null
  timestamp: number
  read: boolean
}

interface ExpoPushPayload {
  to: string
  title: string
  body: string
  data: Record<string, string>
  sound: 'default'
  badge?: number
}

interface ExpoPushResponse {
  data: Array<{
    status: 'ok' | 'error'
    id?: string
    message?: string
    details?: { error?: string }
  }>
}

// ---------------------------------------------------------------------------
// Helper: send one Expo push notification
// ---------------------------------------------------------------------------

const sendExpoPushNotification = async (
  payload: ExpoPushPayload
): Promise<void> => {
  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    console.error(
      `[onNewMessage] Expo push HTTP error: ${response.status} ${response.statusText}`
    )
    return
  }

  const result = (await response.json()) as ExpoPushResponse

  // Log per-ticket errors (don't throw — a failed push must not block the trigger)
  for (const ticket of result.data) {
    if (ticket.status === 'error') {
      console.error('[onNewMessage] Expo push ticket error:', ticket.message, ticket.details)

      // DeviceNotRegistered → token is stale, remove it to avoid future waste
      if (ticket.details?.error === 'DeviceNotRegistered') {
        // We can't easily know *which* user's token this is at this point,
        // so we log and rely on the client to re-register on next open.
        console.warn('[onNewMessage] DeviceNotRegistered — token may be stale')
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Helper: truncate message body for notification preview
// ---------------------------------------------------------------------------

const buildNotificationBody = (message: RtdbMessage): string => {
  if (message.imageUrl !== null) {
    return '📷 Sent a photo'
  }
  if (message.text === null || message.text.trim().length === 0) {
    return 'Sent a message'
  }
  // Truncate long messages to avoid notification overflow
  const MAX_BODY_LENGTH = 100
  return message.text.length > MAX_BODY_LENGTH
    ? `${message.text.slice(0, MAX_BODY_LENGTH)}…`
    : message.text
}

// ---------------------------------------------------------------------------
// Cloud Function: onNewMessage
// Trigger: RTDB onCreate at /chats/{matchId}/messages/{messageId}
// ---------------------------------------------------------------------------

export const onNewMessage = onValueCreated(
  {
    ref: '/chats/{matchId}/messages/{messageId}',
    region: 'asia-southeast1',
    // RTDB instance — must match the URL configured in firebase.json
    instance: process.env.RTDB_INSTANCE ?? '',
  },
  async (event) => {
    const { matchId, messageId } = event.params

    // Safely cast the RTDB snapshot value
    const messageData = event.data.val() as RtdbMessage | null
    if (messageData === null) {
      console.warn(`[onNewMessage] No data at messageId=${messageId}, skipping`)
      return
    }

    const { senderId } = messageData

    // ------------------------------------------------------------------
    // 1. Get match document to find the recipient
    // ------------------------------------------------------------------
    const matchRef = admin.firestore().doc(`matches/${matchId}`)
    const matchSnap = await matchRef.get()

    if (!matchSnap.exists) {
      console.warn(`[onNewMessage] Match document not found: ${matchId}`)
      return
    }

    const matchData = matchSnap.data() as {
      users: [string, string]
      [key: string]: unknown
    }

    const recipientId = matchData.users.find((uid) => uid !== senderId)
    if (recipientId === undefined) {
      console.warn(
        `[onNewMessage] Could not determine recipient for match=${matchId}, sender=${senderId}`
      )
      return
    }

    // ------------------------------------------------------------------
    // 2. Increment unread count for recipient on the match document
    //    Do this regardless of whether push is sent (powers badge + list UI)
    // ------------------------------------------------------------------
    const unreadKey = `${recipientId}_unread`
    await matchRef.update({
      [unreadKey]: admin.firestore.FieldValue.increment(1),
    })

    // ------------------------------------------------------------------
    // 3. Get recipient's push token and sender's display name
    // ------------------------------------------------------------------
    const [recipientSnap, senderSnap] = await Promise.all([
      admin.firestore().doc(`users/${recipientId}`).get(),
      admin.firestore().doc(`users/${senderId}`).get(),
    ])

    if (!recipientSnap.exists) {
      console.warn(`[onNewMessage] Recipient user not found: ${recipientId}`)
      return
    }

    const recipientData = recipientSnap.data() as { expoPushToken?: string }
    const expoPushToken = recipientData.expoPushToken

    // Token may be absent if user declined notification permission — this is normal
    if (expoPushToken === undefined || expoPushToken === null || expoPushToken === '') {
      console.info(
        `[onNewMessage] Recipient ${recipientId} has no push token — skipping push`
      )
      return
    }

    // Validate token format (Expo tokens start with "ExponentPushToken[")
    if (!expoPushToken.startsWith('ExponentPushToken[')) {
      console.warn(
        `[onNewMessage] Unexpected push token format for ${recipientId}: ${expoPushToken.slice(0, 20)}…`
      )
      return
    }

    const senderData = senderSnap.exists
      ? (senderSnap.data() as { firstName?: string })
      : null
    const senderName = senderData?.firstName ?? 'Someone'

    // ------------------------------------------------------------------
    // 4. Send push notification via Expo Push API
    // ------------------------------------------------------------------
    const notificationBody = buildNotificationBody(messageData)

    await sendExpoPushNotification({
      to: expoPushToken,
      title: senderName,
      body: notificationBody,
      sound: 'default',
      data: {
        type: 'message',
        matchId,
        senderId,
      },
    })

    console.info(
      `[onNewMessage] Push sent to ${recipientId} for match=${matchId} message=${messageId}`
    )
  }
)
```

---

### `functions/src/index.ts` — Update

Add the export alongside existing function exports. Do not remove or reorder existing exports.

```typescript
// Add this line with the other exports:
export { onNewMessage } from './onNewMessage'
```

---

### `firebase.json` — Verify RTDB configuration

Ensure `firebase.json` includes the Realtime Database instance URL. The `onValueCreated` trigger requires the `instance` field to match the actual RTDB URL (e.g. `your-project-default-rtdb`). If it is already configured, make no changes. If absent, add:

```json
{
  "database": {
    "rules": "database.rules.json"
  }
}
```

And confirm `RTDB_INSTANCE` is set in `functions/.env` (or `functions/src/config.ts`) pointing to the RTDB instance name (the subdomain from the RTDB URL, without `.firebaseio.com`).

---

## Important Architecture Notes for Codex

### 1. Use `onValueCreated` (2nd gen), not `functions.database.ref().onCreate()` (v1)

```typescript
// ✅ Correct — 2nd gen RTDB trigger
import { onValueCreated } from 'firebase-functions/v2/database'

export const onNewMessage = onValueCreated(
  { ref: '/chats/{matchId}/messages/{messageId}', region: 'asia-southeast1' },
  async (event) => {
    const { matchId } = event.params
    const data = event.data.val()
  }
)

// ❌ Wrong — v1 API
export const onNewMessage = functions.database
  .ref('/chats/{matchId}/messages/{messageId}')
  .onCreate(async (snapshot, context) => { ... })
```

### 2. Never throw inside the trigger body for non-fatal errors

Push failures (bad token, Expo API error, missing token) must be logged but must **not** throw. Throwing would cause Firebase to retry the trigger, leading to duplicate notifications. Only genuinely unexpected errors (e.g. Firestore unavailable) may propagate.

### 3. Unread increment always runs — push is best-effort

`{recipientId}_unread` on the match document is incremented **before** the push token check. This ensures the badge and message list UI stay accurate even when push is disabled or the token is absent.

### 4. `fetch` is available in Node 18 Cloud Functions

No need to import `node-fetch`. Node 18 has native `fetch`. Do not add it as a dependency.

### 5. Expo push token format

Valid Expo tokens begin with `ExponentPushToken[` and end with `]`. Validate before sending to avoid unnecessary API calls with malformed tokens (e.g. FCM tokens accidentally stored in the wrong field).

### 6. RTDB `instance` field

The `instance` field in `onValueCreated` options is the RTDB instance **name** (not the full URL). It is the subdomain portion of the RTDB URL:
- Full URL: `https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app`
- Instance name: `your-project-default-rtdb`

Read this from `process.env.RTDB_INSTANCE` — never hardcode it.

### 7. DeviceNotRegistered handling

When Expo returns `DeviceNotRegistered`, the token is permanently stale (device uninstalled app or revoked permission). A full implementation would delete the token from Firestore at this point. This is deferred to a cleanup Cloud Function in Phase 2. For now, log the error and continue.

---

## Acceptance Criteria

- [ ] `onNewMessage.ts` created in `functions/src/`
- [ ] Function uses `onValueCreated` from `firebase-functions/v2/database` (2nd gen)
- [ ] Function exports from `functions/src/index.ts`
- [ ] Region set to `asia-southeast1`
- [ ] `{recipientId}_unread` incremented on match document for every new message, regardless of push outcome
- [ ] Recipient's `expoPushToken` read from Firestore `/users/{recipientId}`
- [ ] If token is absent or empty: logs info and returns without error (not a crash)
- [ ] If token does not start with `ExponentPushToken[`: logs warning and returns
- [ ] Notification title = sender's `firstName` from Firestore (fallback: "Someone")
- [ ] Notification body = message text truncated to 100 chars, or "📷 Sent a photo" for image messages
- [ ] Notification `data` payload contains `{ type: 'message', matchId, senderId }`
- [ ] Push sent via `fetch` to `https://exp.host/--/api/v2/push/send`
- [ ] Expo ticket errors logged but not thrown (no retry loop)
- [ ] No hardcoded project IDs or RTDB URLs — all from `process.env`
- [ ] Zero TypeScript errors (`tsc --noEmit` in `functions/`)
- [ ] Zero `any` types
- [ ] Function deployable to Firebase emulator with `firebase emulators:start`
- [ ] `functions/src/index.ts` updated, no existing exports removed

## Do Not Touch
`functions/src/onUserCreated.ts`, `functions/src/onSwipeCreated.ts`, `functions/src/getDiscoveryStack.ts`, any client-side files under `app/`, `store/`, `services/`, `components/`, `hooks/`, `types/`, `constants/`, `i18n/`, `utils/`

## Commit
`git commit -m "task-33: cloud function onNewMessage push notification on new chat message"`

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 1D — Task 33] — YYYY-MM-DD
### Completed
- Task 33: onNewMessage Cloud Function — push notification on new RTDB message

### Files Created / Modified
- functions/src/onNewMessage.ts: RTDB onValueCreated trigger (2nd gen), increments unread count,
  sends Expo push notification via fetch, validates token format, handles missing tokens gracefully
- functions/src/index.ts: export { onNewMessage } added

### Architecture Decisions
- Unread increment separated from push send — always runs, push is best-effort
- Expo Push API used (not FCM direct) — correct for Expo-managed workflow
- DeviceNotRegistered cleanup deferred to Phase 2 maintenance function
- fetch used natively (Node 18) — no node-fetch dependency added

### Known Issues / Deferred
- DeviceNotRegistered token cleanup deferred (Phase 2)
- Notification badge count (iOS) not yet set — requires separate unread query
- Push notification delivery for matches (as opposed to messages) handled in Task 34 (match celebration)

### Next Up
- Task 34: MatchCelebrationModal — confetti animation, both user photos, "Send Message" + "Keep Swiping" CTAs
```

Then bring ARCHITECT.md + this CHANGELOG entry to claude.ai for the Task 34 prompt.

---

## Reasoning Level
Medium-High — 2nd gen RTDB trigger API has subtle differences from v1 (event shape, instance config, params access). The unread-before-push ordering and non-throwing error handling are load-bearing architectural decisions.
