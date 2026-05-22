# CODEX PROMPT — Task 39
# Firestore Security Rules

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 1F begins. All Phase 1 screens, stores, and services are complete (Tasks 01–38). The app currently runs against Firestore in **test mode** (open read/write), which was set during the Firebase Pre-flight setup. This task locks down every collection to production-ready rules before beta deployment.

Relevant existing collections written to by the client and Cloud Functions:

| Collection path | Written by |
|---|---|
| `/users/{userId}` | Client (onboarding, editProfile, settings) + Cloud Functions (onUserCreated, onSwipeCreated) |
| `/swipes/{userId}/likes/{targetId}` | Client (discoveryStore.swipeRight, swipeSuperLike) |
| `/swipes/{userId}/passes/{targetId}` | Client (discoveryStore.swipeLeft) |
| `/users/{userId}/dailyLikes` | Client (discoveryStore via firestore.ts helpers) |
| `/matches/{matchId}` | Cloud Function only (onSwipeCreated) |
| `/matches/{matchId}/messages/{messageId}` | Client (chatStore / realtime.ts writes to RTDB — Firestore messages subcollection is defined in schema but chat message delivery uses RTDB; Firestore is used for match metadata only) |
| `/reports/{reportId}` | Client (reporting flow from chat/profile) |

**Critical architecture reminders Codex must respect:**
- `banned`, `verified`, `age` on `/users/{userId}` are **server-only fields** — never written from the client. Rules must explicitly block client modification of these fields.
- `/matches/{matchId}` documents are **created and updated by Cloud Functions only** — client must never write directly.
- The swipe subcollection path is immutable: `/swipes/{userId}/likes/{targetId}` and `/swipes/{userId}/passes/{targetId}` — never flat.
- `paused` on `/users/{userId}` **is** client-writable (user toggles it in Settings). It must not be in the server-only block list.

---

## Task 39 — Firestore Security Rules

**File to create:**
- `firestore.rules`

**File to verify exists (do not modify):**
- `firebase.json` — must reference `"firestore": { "rules": "firestore.rules" }`. If this key is missing, add it. Do not change anything else in `firebase.json`.

---

### Full `firestore.rules` to produce

Write a single `firestore.rules` file using Firebase Security Rules v2 syntax. Follow the structure below exactly. Add an inline comment above each rule block explaining the security intent.

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ─── Helper functions ─────────────────────────────────────────────────────

    // Returns true if the requester is authenticated
    function isAuthenticated() {
      return request.auth != null;
    }

    // Returns true if the requester owns this document (uid matches path segment)
    function isOwner(userId) {
      return request.auth.uid == userId;
    }

    // Returns true if the incoming write does NOT touch server-only fields.
    // These fields are managed exclusively by Cloud Functions and must never
    // be written from a client — even by the account owner.
    function doesNotModifyServerOnlyFields() {
      return !(
        request.resource.data.diff(resource.data).affectedKeys()
          .hasAny(['banned', 'verified', 'age', 'stats', 'verifiedAt', 'bannedAt', 'banReason'])
      );
    }

    // Returns true if the requester is a participant in the given match
    function isMatchParticipant(matchId) {
      return request.auth.uid in
        get(/databases/$(database)/documents/matches/$(matchId)).data.users;
    }

    // ─── /users/{userId} ──────────────────────────────────────────────────────
    // Any authenticated user can read any profile (required for discovery stack).
    // Users can only update their own document, and cannot touch server-only fields.
    // Cloud Functions bypass these rules using the Admin SDK.
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated() && isOwner(userId);
      allow update: if isAuthenticated() && isOwner(userId) && doesNotModifyServerOnlyFields();
      allow delete: if false; // account deletion handled by Cloud Function / auth.ts deleteAccount()

      // ─── /users/{userId}/dailyLikes ─────────────────────────────────────────
      // The dailyLikes document tracks the free-user like count.
      // Only the owning user can read or write their own limit document.
      match /dailyLikes/{doc} {
        allow read, write: if isAuthenticated() && isOwner(userId);
      }
    }

    // ─── /swipes/{userId}/likes/{targetId} ───────────────────────────────────
    // A user can only create a like under their own swiper path.
    // The target user can also read (needed to detect mutual likes client-side,
    // though the real mutual-like check runs in the onSwipeCreated Cloud Function).
    // Updates and deletes are permanently blocked — swipes are immutable.
    match /swipes/{userId}/likes/{targetId} {
      allow create: if isAuthenticated() && isOwner(userId);
      allow read:   if isAuthenticated() && (isOwner(userId) || request.auth.uid == targetId);
      allow update: if false;
      allow delete: if false;
    }

    // ─── /swipes/{userId}/passes/{targetId} ──────────────────────────────────
    // A user can only create a pass under their own swiper path.
    // Only the owning user can read their own passes.
    // Updates and deletes are permanently blocked.
    match /swipes/{userId}/passes/{targetId} {
      allow create: if isAuthenticated() && isOwner(userId);
      allow read:   if isAuthenticated() && isOwner(userId);
      allow update: if false;
      allow delete: if false;
    }

    // ─── /matches/{matchId} ──────────────────────────────────────────────────
    // Matches are created and updated exclusively by the onSwipeCreated
    // Cloud Function using the Admin SDK. Client can read their own matches.
    // matchId format: [uid1, uid2].sort().join('_')
    match /matches/{matchId} {
      allow read:             if isAuthenticated() && isMatchParticipant(matchId);
      allow create, update:   if false; // Cloud Function only
      allow delete:           if false; // Cloud Function only (unmatch flow)

      // ─── /matches/{matchId}/messages/{messageId} ───────────────────────────
      // Firestore message subcollection (used for persistent history queries).
      // Real-time delivery goes through Firebase Realtime Database (RTDB),
      // but the Firestore copy is written by the client for history.
      // Both participants can read. Create allowed if sender matches requester.
      // Updates and deletes permanently blocked — message history is immutable.
      match /messages/{messageId} {
        allow read:   if isAuthenticated() && isMatchParticipant(matchId);
        allow create: if isAuthenticated()
                      && isMatchParticipant(matchId)
                      && request.auth.uid == request.resource.data.senderId;
        allow update: if false;
        allow delete: if false;
      }
    }

    // ─── /reports/{reportId} ─────────────────────────────────────────────────
    // Any authenticated user can file a report, but only if they are the reporter.
    // Reports cannot be read, updated, or deleted by clients — admin only.
    match /reports/{reportId} {
      allow create: if isAuthenticated()
                    && request.auth.uid == request.resource.data.reporterId;
      allow read:   if false;
      allow update: if false;
      allow delete: if false;
    }

    // ─── Default deny ────────────────────────────────────────────────────────
    // Any collection not explicitly matched above is denied for all operations.
    match /{document=**} {
      allow read, write: if false;
    }

  }
}
```

---

### `firebase.json` — Verify and patch if needed

Open `firebase.json`. Ensure it contains a `"firestore"` key that points to the rules file and indexes file:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  }
}
```

If these keys are already present and correct, do not touch `firebase.json`. If the `"firestore"` block is missing or incomplete, add only those keys. Do not change `"functions"`, `"hosting"`, `"storage"`, or any other section.

---

## Architecture Notes for Codex

### Why `doesNotModifyServerOnlyFields()` instead of field-level allow lists

An allow-list approach (`request.resource.data.keys().hasOnly([...allowed...])`) would break every time a new user field is added. The deny-list approach (`affectedKeys().hasAny([...blocked...])`) is safer here — it only blocks writes to specifically dangerous fields and passes through any new fields added to the schema by default. This matches the project's "server-only fields" model where `banned`, `verified`, `age`, `stats`, `verifiedAt`, `bannedAt`, and `banReason` are the only fields that require server enforcement.

### Why `paused` is NOT in the server-only block list

`paused` is explicitly user-controlled (Settings screen → Pause Account toggle). The client calls `updateDoc` directly with `{ paused: true/false }`. It must remain writable from the client.

### Why `/matches/{matchId}` blocks client writes entirely

Match documents are created by `onSwipeCreated` (Cloud Function) and updated by `onNewMessage` (unread count). The `unmatch` flow in `matchStore.ts` calls a Cloud Function rather than deleting the document directly. No client path legitimately writes to `/matches`. Blocking this at the rules level enforces the invariant permanently.

### `isMatchParticipant` and the cross-document `get()` call

The `isMatchParticipant` helper performs a `get()` on the match document to check the `users` array. This counts as a document read and is billed accordingly. It is used only on `/matches/{matchId}` reads and `/matches/{matchId}/messages` reads and creates — both are low-frequency operations (not in hot discovery paths), so the billing impact is acceptable.

### RTDB vs Firestore for chat

Real-time message delivery runs through Firebase Realtime Database (`/chats/{matchId}/messages/`). RTDB has its own separate security rules (not in this file). The Firestore `/matches/{matchId}/messages/` subcollection is a persistent history store written by the client when a message is sent. Both paths need to be secured — this task covers the Firestore side only. RTDB rules are deferred to Phase 2.

---

## Acceptance Criteria

- [ ] `firestore.rules` file exists at project root
- [ ] Rules version is `'2'`
- [ ] `/users/{userId}`: any authenticated user can read; owner can create and update; `banned`, `verified`, `age`, `stats`, `verifiedAt`, `bannedAt`, `banReason` cannot be set from client
- [ ] `/users/{userId}`: `paused` IS writable by the owner (not in block list)
- [ ] `/users/{userId}/dailyLikes`: read and write allowed only for the document owner
- [ ] `/swipes/{userId}/likes/{targetId}`: create allowed for owner only; read allowed for owner and target; update and delete blocked
- [ ] `/swipes/{userId}/passes/{targetId}`: create and read for owner only; update and delete blocked
- [ ] `/matches/{matchId}`: read for participants only; create, update, delete all blocked for clients
- [ ] `/matches/{matchId}/messages/{messageId}`: read for participants; create for participants where senderId matches auth uid; update and delete blocked
- [ ] `/reports/{reportId}`: create only if `reporterId == request.auth.uid`; read/update/delete blocked
- [ ] Default catch-all `/{document=**}` denies everything not explicitly matched
- [ ] Helper functions `isAuthenticated()`, `isOwner()`, `doesNotModifyServerOnlyFields()`, `isMatchParticipant()` are defined once and reused — no duplication
- [ ] `firebase.json` references `"rules": "firestore.rules"` in the `"firestore"` block
- [ ] `firebase deploy --only firestore:rules` completes without syntax errors (run against emulator to verify)
- [ ] No TypeScript changes — this task is rules-only

## Do Not Touch

`store/`, `services/`, `app/`, `components/`, `hooks/`, `types/`, `constants/`, `utils/`, `i18n/`, `functions/`, `App.tsx`, `babel.config.js`, `tsconfig.json`, `package.json`

Only touch: `firestore.rules` (create), `firebase.json` (patch if incomplete — nothing else).

## Commit

```
git commit -m "task-39: firestore security rules — all collections locked, server-only fields protected"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 1F — Task 39] — YYYY-MM-DD

### Completed

- Task 39: Firestore security rules written for all Phase 1 collections
- Server-only fields (banned, verified, age, stats, verifiedAt, bannedAt, banReason) blocked from client writes via doesNotModifyServerOnlyFields() helper
- paused remains client-writable (Settings toggle)
- /matches/{matchId} fully locked — client create/update/delete denied, Cloud Function Admin SDK bypasses rules
- Daily likes subcollection scoped to document owner only
- Swipes immutable — update and delete permanently blocked
- Reports write-once, read-never for clients
- Default catch-all denies all unmatched collections

### Files Created / Modified

- firestore.rules: full production security rules for all Phase 1 collections
- firebase.json: verified/patched to reference firestore.rules and firestore.indexes.json

### Architecture Decisions

- Deny-list approach for server-only fields (affectedKeys().hasAny([...])) preferred over allow-list to avoid breaking on new field additions
- isMatchParticipant() uses cross-document get() — acceptable for low-frequency match reads, not used in discovery hot path
- RTDB security rules deferred to Phase 2 (chat delivery via RTDB is separate from Firestore rules)
- /matches delete blocked at rules level even though unmatch flow exists — unmatch calls a Cloud Function

### Known Issues / Deferred

- RTDB rules (/chats/{matchId}) not covered by this task — Phase 2
- Admin moderation collections (flags, admin_queue) not yet defined — Phase 2

### Next Up

- Task 40: Firestore indexes (firestore.indexes.json)
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 40 prompt.

---

## Reasoning Level
Low — this is a single-file rules task with no TypeScript. The rules are fully specified above. Codex should transcribe, verify `firebase.json`, and commit.
