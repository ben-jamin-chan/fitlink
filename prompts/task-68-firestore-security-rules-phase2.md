# CODEX PROMPT — Task 68: Update Firestore Security Rules for Phase 2

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Task 68 is a pure `firestore.rules` hardening task. No client-side TypeScript files change.
No Cloud Functions change. No i18n files change. The only deliverable is an updated
`firestore.rules` file that reflects the full Phase 2 write-access model.

**Existing state you must understand before writing a single rule:**

The rules file was last comprehensively written in **Task 39** (Phase 1F). Since then, two
incremental patches have already landed:

- **Task 39B** — `/matches/{matchId}` delete blocked at rules level; `/blocked` collection
  added (deny all client access); `/matches/{matchId}` update rule was relaxed to allow
  participant-only writes for `lastMessage`, `lastMessageAt`, and `{uid}_unread` using a
  `hasOnly([...])` allow-list.

- **Task 55** — `/swipes/{userId}/likes/{targetId}` and `/swipes/{userId}/passes/{targetId}`
  client **writes** were denied (writes now go through the `recordSwipe` Cloud Function).
  The `/users/{userId}/dailyLikes` subcollection was also denied for client writes (managed by
  `recordSwipe` transactionally).

- **Task 60** (Strava) — An incremental Strava token-field block was added: clients may not
  write `fitnessTracking.strava.accessToken`, `fitnessTracking.strava.refreshToken`, or
  `fitnessTracking.strava.expiresAt`. Only disconnect semantics (`connected: false`,
  `lastSync: null`) remain client-writable on the Strava sub-object.

- **Task 50** (Stripe Cloud Functions) — The user create/update rules were tightened to block
  `premium`, `stripeCustomerId`, and the legacy `subscription` field from client writes.
  `photoVerified` and `verifiedAt` were also added to the server-only deny list at that point.

The Phase 1F `firestore.rules` base structure you are updating uses these helpers:
- `isSignedIn()` — `request.auth != null`
- `isOwner(uid)` — `request.auth.uid == uid`
- `doesNotModifyServerOnlyFields()` — checks `request.resource.data.diff(resource.data).affectedKeys().hasAny([...])` for the Phase 1 server-only field list

Your job in Task 68 is to **consolidate and extend** all of the above incremental patches into
one clean, correct, fully Phase 2–aware `firestore.rules` file. The incremental patches are
already live; Task 68 makes the file authoritative and adds the remaining Phase 2 rules that
have not yet been written.

**Relevant existing files (read-only context — do not modify):**
- `firestore.rules` — current Phase 1 + incremental Phase 2 patches; this is the file you
  will replace with the consolidated Phase 2 version
- `functions/src/recordSwipe.ts` — callable that owns all `/swipes/` writes; confirms swipes
  must be fully server-side
- `functions/src/verifyProfilePhoto.ts` — callable that owns `photoVerified` and `verifiedAt`
  writes; confirms these must be server-only
- `functions/src/createStripeCheckout.ts` and `functions/src/stripeWebhook.ts` — own all
  `premium.*` and `stripeCustomerId` writes; confirms these must be server-only
- `functions/src/exchangeStravaToken.ts` — owns all Strava token writes; confirms
  `fitnessTracking.strava.accessToken`, `.refreshToken`, `.expiresAt` must be server-only
- `store/fitnessStore.ts` — calls `setShareOnProfile()` which writes
  `fitnessTracking.shareOnProfile` from the client (this must remain client-writable)
- `services/healthKit.ts` and `services/googleFit.ts` — call `setAppleHealthConnected()` /
  `setGoogleFitConnected()` which write `fitnessTracking.appleHealth.connected`,
  `fitnessTracking.appleHealth.lastSync`, `fitnessTracking.googleFit.connected`,
  `fitnessTracking.googleFit.lastSync` from the client (these must remain client-writable)
- `app/profile/PhotoVerificationScreen.tsx` — does NOT write `photoVerified` or `verifiedAt`
  from the client; the Cloud Function does it (confirms server-only status)
- `services/firebase/storage.ts` — `uploadVerificationSelfie()` writes to
  `users/{uid}/verification/selfie_temp.jpg`; this is a Storage path, not Firestore; no
  Firestore rule needed for this path

**This task touches exactly one file: `firestore.rules`.**

**Do not modify any TypeScript file, any Cloud Function, any i18n file, any store, any
service, or any navigation file. If Codex proposes changes to any file other than
`firestore.rules`, that is architectural drift and must be rejected.**

---

## Task 68 — Update Firestore Security Rules for Phase 2

**Files to create:**
- *(none)*

**Files to modify:**
- `firestore.rules` — full rewrite consolidating Phase 1 rules, all incremental Phase 2
  patches (Tasks 39B, 50, 55, 60), and the new Phase 2 additions required by this task

---

### `firestore.rules` — Full Phase 2 Rewrite

Below is the complete, authoritative `firestore.rules` for Phase 2. Codex must produce a file
that matches this specification exactly. Every rule is explained in the inline comments so the
intent is unambiguous.

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // ─── Helpers ────────────────────────────────────────────────────────────

    function isSignedIn() {
      return request.auth != null;
    }

    function isOwner(uid) {
      return request.auth.uid == uid;
    }

    // Returns true if the write attempts to change any field that is exclusively
    // managed by Cloud Functions or the Admin SDK.
    // Phase 2 expands this list beyond Phase 1 to include premium fields,
    // verification fields, and Strava token fields.
    function doesNotModifyServerOnlyFields() {
      let serverOnlyFields = [
        // Phase 1 server-only fields
        'age',
        'banned',
        'banReason',
        'bannedAt',
        // Phase 2 server-only fields
        'photoVerified',
        'verifiedAt',
        'stripeCustomerId',
        'premium',
        // Legacy Phase 1 field — client still sees it in normalised reads
        // but must not write it
        'subscription'
      ];
      return !request.resource.data.diff(resource.data)
              .affectedKeys()
              .hasAny(serverOnlyFields);
    }

    // Returns true if a user is a participant in the given match document.
    // Used to gate match reads; not used in discovery hot path.
    function isMatchParticipant(matchId) {
      return request.auth.uid in
        get(/databases/$(database)/documents/matches/$(matchId)).data.users;
    }


    // ─── /users/{userId} ────────────────────────────────────────────────────

    match /users/{userId} {

      // Any authenticated user can read any profile.
      // Required for: discovery stack display, chat header, profile modal,
      // match card resolution in matchStore.
      allow read: if isSignedIn();

      // New user document creation:
      //   - Only the authenticated user can create their own document.
      //   - Server-only fields must be absent on creation (Cloud Functions
      //     write them after the document is created).
      allow create: if isOwner(userId) && doesNotModifyServerOnlyFields();

      // Profile update:
      //   - Only the authenticated user can update their own document.
      //   - Server-only fields (premium, photoVerified, stripeCustomerId, etc.)
      //     are blocked — managed exclusively by Cloud Functions.
      //
      // Client-writable fitnessTracking sub-fields (NOT blocked):
      //   - fitnessTracking.shareOnProfile    ← user preference toggle
      //   - fitnessTracking.appleHealth.*     ← permission grant/revoke on iOS
      //   - fitnessTracking.googleFit.*       ← permission grant/revoke on Android
      //
      // Strava token fields (BLOCKED — managed by exchangeStravaToken /
      //   syncStravaActivity Cloud Functions):
      //   - fitnessTracking.strava.accessToken
      //   - fitnessTracking.strava.refreshToken
      //   - fitnessTracking.strava.expiresAt
      //
      // Verification (BLOCKED — managed by verifyProfilePhoto Cloud Function):
      //   - photoVerified
      //   - verifiedAt
      //
      // Premium (BLOCKED — managed by Stripe webhook Cloud Function):
      //   - premium (entire sub-object)
      //   - stripeCustomerId
      allow update: if isOwner(userId)
                    && doesNotModifyServerOnlyFields()
                    && !request.resource.data.diff(resource.data)
                        .affectedKeys()
                        .hasAny([
                          'fitnessTracking.strava.accessToken',
                          'fitnessTracking.strava.refreshToken',
                          'fitnessTracking.strava.expiresAt'
                        ]);

      // Deletion is handled by the deleteAccount Cloud Function / Admin SDK.
      // Direct client delete is denied.
      allow delete: if false;


      // ── /users/{userId}/dailyLikes (single document: .../dailyLikes/doc) ──

      match /dailyLikes/{docId} {
        // Client reads the dailyLikes count to display remaining likes in the UI.
        // Writes are owned by the recordSwipe Cloud Function (Task 55).
        allow read:   if isOwner(userId);
        allow write:  if false;
      }


      // ── /users/{userId}/verificationAttempts (single document) ────────────

      match /verificationAttempts/{docId} {
        // Entirely managed by the verifyProfilePhoto Cloud Function (Task 56).
        // Clients have no read or write access.
        allow read:  if false;
        allow write: if false;
      }

    } // end /users/{userId}


    // ─── /swipes/{userId}/likes/{targetId} ──────────────────────────────────

    match /swipes/{userId}/likes/{targetId} {
      // Reads: the swipe owner (to check their own swipe history) or the target
      // (to check whether a mutual like exists — used by onSwipeCreated trigger
      // and client-side checks).
      allow read: if isSignedIn()
                  && (isOwner(userId) || isOwner(targetId));

      // Writes: DENIED for all clients.
      // All like and superlike writes go through the recordSwipe Cloud Function
      // (Task 55), which enforces the daily limit transactionally.
      // Firestore security rules deny direct client writes so there is no bypass.
      allow write: if false;
    }


    // ─── /swipes/{userId}/passes/{targetId} ─────────────────────────────────

    match /swipes/{userId}/passes/{targetId} {
      // Read: only the swipe owner (to check their own pass history).
      allow read: if isOwner(userId);

      // Write: DENIED for all clients.
      // Pass writes also go through recordSwipe Cloud Function (Task 55).
      allow write: if false;
    }


    // ─── /matches/{matchId} ─────────────────────────────────────────────────

    match /matches/{matchId} {
      // Read: only match participants.
      allow read: if isSignedIn() && isMatchParticipant(matchId);

      // Create: DENIED — match creation is exclusively the responsibility of
      // the onSwipeCreated Cloud Function (Task 24).
      allow create: if false;

      // Update: match participants may update ONLY these chat-metadata fields.
      // This allows ChatScreen to write lastMessage, lastMessageAt, and their
      // own unread counter without a Cloud Function round-trip on every send.
      // The dynamic {userId}_unread field is validated against the authenticated
      // user's UID to prevent cross-user unread tampering.
      allow update: if isSignedIn()
                    && isMatchParticipant(matchId)
                    && request.resource.data.diff(resource.data)
                        .affectedKeys()
                        .hasOnly([
                          'lastMessage',
                          'lastMessageAt',
                          (request.auth.uid + '_unread')
                        ]);

      // Delete: DENIED — unmatch goes through the unmatchUser Cloud Function
      // (Task 39B).
      allow delete: if false;


      // ── /matches/{matchId}/messages/{messageId} ──────────────────────────

      match /messages/{messageId} {
        // Read: only match participants.
        allow read: if isSignedIn() && isMatchParticipant(matchId);

        // Create: participants may write new messages; sender must be themselves.
        allow create: if isSignedIn()
                      && isMatchParticipant(matchId)
                      && isOwner(request.resource.data.senderId);

        // Update/delete: denied.
        allow update: if false;
        allow delete: if false;
      }

    } // end /matches/{matchId}


    // ─── /reports/{reportId} ────────────────────────────────────────────────

    match /reports/{reportId} {
      // Create: any authenticated user may file a report.
      // The reporterId must match their own UID (no impersonation).
      allow create: if isSignedIn()
                    && isOwner(request.resource.data.reporterId);

      // Read/update/delete: denied for clients.
      // Report review and actioning is admin-only via Firebase Console or
      // the Admin SDK.
      allow read:   if false;
      allow update: if false;
      allow delete: if false;
    }


    // ─── /blocked/{userId} ──────────────────────────────────────────────────

    match /blocked/{userId}/{document=**} {
      // Entirely managed by Cloud Functions (unmatchUser, recordSwipe).
      // No client reads or writes.
      allow read:  if false;
      allow write: if false;
    }


    // ─── Default catch-all ──────────────────────────────────────────────────

    // Any collection not explicitly matched above is denied.
    match /{document=**} {
      allow read, write: if false;
    }

  }
}
```

---

## Important Architecture Notes for Codex

1. **One file only.** This task modifies `firestore.rules` exclusively. No TypeScript file,
   Cloud Function, store, service, i18n file, or navigation file is touched. If any other file
   appears in the diff, stop and revert it.

2. **`doesNotModifyServerOnlyFields()` is a deny-list, not an allow-list.** The list grows as
   server-managed fields are added; it does not need to enumerate every field the client is
   allowed to write. The Phase 2 expansion adds `photoVerified`, `verifiedAt`,
   `stripeCustomerId`, `premium`, and legacy `subscription` to the existing Phase 1 list
   (`age`, `banned`, `banReason`, `bannedAt`).

3. **Strava token block is a separate `affectedKeys().hasAny(...)` check on update, not part
   of `doesNotModifyServerOnlyFields()`.** This keeps the helper clean and accurately reflects
   that the Strava token fields sit inside the `fitnessTracking` map rather than at the root
   user document level. The top-level `doesNotModifyServerOnlyFields()` helper uses
   dot-notation for root-level fields; nested map writes require the full dot-path string.

4. **`fitnessTracking.shareOnProfile`, `fitnessTracking.appleHealth.*`, and
   `fitnessTracking.googleFit.*` must remain client-writable.** The user's share toggle and
   the native health permission grant/revoke are local client operations. Do not add these
   paths to any deny list. Only the Strava token sub-fields are blocked.

5. **`/users/{userId}/dailyLikes` — client reads allowed, writes denied.** The UI reads the
   remaining like count from this document to display it to the user. The `recordSwipe` Cloud
   Function owns all writes. The subcollection document path is `users/{userId}/dailyLikes/doc`
   (single-document pattern); the rule must match `{docId}` to cover it.

6. **`/users/{userId}/verificationAttempts` — all client access denied.** This subcollection
   is touched only by the `verifyProfilePhoto` Cloud Function (Task 56). Clients have no
   legitimate reason to read or write it.

7. **`/matches/{matchId}` update uses a dynamic key for the unread counter.** The expression
   `(request.auth.uid + '_unread')` in `hasOnly([...])` correctly constructs the field name
   at evaluation time (e.g. `"abc123_unread"`). This prevents a participant from zeroing out
   the other user's unread count from the client.

8. **The `isMatchParticipant()` helper performs a cross-document `get()` call.** Firestore
   bills one read for each `get()` call inside security rules. This is acceptable for low-
   frequency match reads; it is deliberately not used in the discovery hot path (user reads).

9. **`/blocked` is deny-all for clients.** The blocked collection is written by the
   `unmatchUser` Cloud Function (Task 39B) and `recordSwipe` (Task 55) via the Admin SDK.
   No client should ever read or write to it.

10. **The default catch-all `match /{document=**}` must remain last.** It denies everything
    not explicitly matched above. Do not remove it or place it before any named match block.

---

## Acceptance Criteria

- [ ] `firestore.rules` is the only file in the diff — no TypeScript, store, Cloud Function,
      or i18n file has been touched
- [ ] `doesNotModifyServerOnlyFields()` deny-list includes all Phase 1 fields (`age`,
      `banned`, `banReason`, `bannedAt`) AND all Phase 2 additions (`photoVerified`,
      `verifiedAt`, `stripeCustomerId`, `premium`, `subscription`)
- [ ] `/users/{userId}` update rule additionally blocks
      `fitnessTracking.strava.accessToken`, `fitnessTracking.strava.refreshToken`, and
      `fitnessTracking.strava.expiresAt` via a separate `affectedKeys().hasAny([...])` check
- [ ] `/users/{userId}/dailyLikes/{docId}` — client reads allowed for the owner; writes
      denied for all clients
- [ ] `/users/{userId}/verificationAttempts/{docId}` — reads and writes denied for all clients
- [ ] `/swipes/{userId}/likes/{targetId}` — reads allowed for owner or target; writes denied
      for all clients
- [ ] `/swipes/{userId}/passes/{targetId}` — reads allowed for owner only; writes denied for
      all clients
- [ ] `/matches/{matchId}` create and delete are denied; update is allowed only for
      participants and only for `lastMessage`, `lastMessageAt`, and `{uid}_unread`
- [ ] `/matches/{matchId}/messages/{messageId}` create is allowed for participants where
      `senderId === request.auth.uid`; update and delete are denied
- [ ] `/reports/{reportId}` create is allowed where `reporterId === request.auth.uid`; read,
      update, and delete are denied
- [ ] `/blocked/{userId}/{document=**}` — reads and writes denied for all clients
- [ ] Default catch-all `match /{document=**}` denies all unmatched paths
- [ ] `firebase emulators:start --only firestore` starts without rules parse errors
- [ ] `npx tsc --noEmit` still passes with zero errors (no TypeScript was modified, but
      confirm the project compiles cleanly)

---

## Do Not Touch

`App.tsx`, `app.json`, `babel.config.js`, `tsconfig.json`,
`store/authStore.ts`, `store/profileStore.ts`, `store/discoveryStore.ts`,
`store/matchStore.ts`, `store/chatStore.ts`, `store/subscriptionStore.ts`,
`store/fitnessStore.ts`,
`services/firebase/config.ts`, `services/firebase/auth.ts`,
`services/firebase/firestore.ts`, `services/firebase/storage.ts`,
`services/firebase/realtime.ts`, `services/stripe.ts`, `services/strava.ts`,
`services/healthKit.ts`, `services/googleFit.ts`, `services/notifications.ts`,
`services/crashlytics.ts`,
`functions/src/index.ts`, `functions/src/recordSwipe.ts`,
`functions/src/verifyProfilePhoto.ts`, `functions/src/createStripeCheckout.ts`,
`functions/src/stripeWebhook.ts`, `functions/src/onSwipeCreated.ts`,
`functions/src/onUserCreated.ts`, `functions/src/onNewMessage.ts`,
`functions/src/exchangeStravaToken.ts`, `functions/src/syncStravaActivity.ts`,
`functions/src/unmatchUser.ts`,
`types/user.ts`, `types/match.ts`, `types/message.ts`,
`types/subscription.ts`, `types/fitness.ts`,
`constants/`, `i18n/`,
`firestore.indexes.json`, `firebase.json`, `storage.rules`,
`components/`, `app/`, `hooks/`

---

## Commit

```
git commit -m "task-68: update firestore security rules for phase 2"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 2F — Task 68] — YYYY-MM-DD

### Completed

- Task 68: Firestore security rules updated for Phase 2
- firestore.rules: full Phase 2 rewrite — consolidates Phase 1 base rules with all
  incremental Phase 2 patches (Tasks 39B, 50, 55, 60) and adds new Phase 2 additions
- doesNotModifyServerOnlyFields(): deny-list expanded to include photoVerified, verifiedAt,
  stripeCustomerId, premium, and legacy subscription fields
- /users/{userId} update rule: Strava token fields (accessToken, refreshToken, expiresAt)
  blocked from client writes via separate affectedKeys().hasAny([...]) check
- /users/{userId}/dailyLikes: client reads allowed for owner; writes denied
- /users/{userId}/verificationAttempts: all client access denied
- /swipes/ subcollections: all client writes denied (recordSwipe Cloud Function only)
- /blocked: all client access denied

### Files Created / Modified

- firestore.rules: full Phase 2 rewrite — all collections covered, server-only fields
  hardened, client-writable fitnessTracking sub-fields preserved

### Architecture Decisions

- [Note any non-obvious Firestore rules syntax decisions made, e.g. how the dynamic
  {uid}_unread key was handled in the /matches update allow-list]

### Known Issues / Deferred

- RTDB security rules (/chats/{matchId}) remain out of scope — deferred to Phase 3
- Admin moderation collections (flags, admin_queue) not yet defined — Phase 3

### Next Up

- Task 69: Phase 2 Firestore Indexes (firestore.indexes.json — add Phase 2 composite
  indexes for premium.active discovery boosting and fitnessTracking.shareOnProfile queries)
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 69 prompt.

---

## Reasoning Level

High — Security rules are a high-stakes, all-or-nothing task. A single missing rule or
incorrect field path silently opens a security gap (or silently breaks a legitimate client
write). Every rule must be verified against the concrete Cloud Function ownership model
documented in the Context section above. Codex must read all referenced function files before
writing a single rule.
