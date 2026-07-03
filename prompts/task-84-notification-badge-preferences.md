# CODEX PROMPT — Task 84: Notification Badge Count & Granular Preferences

@CONVENTIONS.md @ARCHITECT.md

---

## Pre-Task Dependency Check

**Required outputs from prior tasks:**
- Task 83 must have added `AsyncStorage.setItem('fitlink-uid', uid)` on login and
  `AsyncStorage.removeItem('fitlink-uid')` in `logout()` inside `store/authStore.ts` — verify
  both calls are present before modifying this file.
- `matchStore` must expose a `matches` array where each match document has a dynamic
  `[uid + '_unread']: number` key (per ARCHITECT.md `/matches/{matchId}` schema) — verify
  this shape exists before writing the badge-count reducer in `useNotifications.ts`.

If either dependency is absent, output a DEPENDENCY ERROR block and stop:

```
<!-- DEPENDENCY ERROR
  Missing: [describe exactly what is missing]
  Cannot proceed. Bring this back to the Architect before continuing.
-->
```

---

## Context

- `store/authStore.ts` — already persists `'fitlink-uid'` to `AsyncStorage` on login/logout
  (Task 83). You are only ADDING a badge-reset call inside the existing `logout()` function —
  do not touch the AsyncStorage lines themselves.
- `store/matchStore.ts` — existing, holds the live `matches` array used elsewhere in the app
  (Matches screen, filters). Read from it; do not modify its shape in this task.
- `functions/src/onNewMessage.ts` — existing Realtime DB trigger that sends Expo push on new
  messages. You are adding a preferences-read guard at the top of its existing logic — do not
  rewrite the rest of the function.
- `functions/src/recordSwipe.ts` — existing 2nd-gen callable (`asia-southeast1`). Created in
  Task 55, hardened in a Phase 2 remediation pass, modified in Task 82 for the per-user
  timezone `getNextMidnightMs()` helper. **Its `direction` parameter has only ever been
  `'like' | 'pass' | 'superlike'` — there is no `'rewind'` value and there never has been.**

**IMPORTANT — architecture correction from the original task spec:** Rewind (Task 72) was
NOT implemented by extending `recordSwipe.ts` with a `'rewind'` direction. It was implemented
as a fully separate `functions/src/rewindSwipe.ts` callable that deletes the swipe document
directly and never calls `recordSwipe.ts`. **Do not write a `direction !== 'rewind'` guard
anywhere in this task** — that branch is dead code, since `'rewind'` can never be the value of
`direction` in this function. Use the positive condition instead:
`direction === 'like' || direction === 'superlike'`. This is both correct and clearer to read.

**Do not modify `functions/src/rewindSwipe.ts` in this task.** It is out of scope.

---

## Task 84 — Notification Badge Count & Granular Preferences

**Files to create:**
- `hooks/useNotifications.ts`

**Files to modify:**
- `store/authStore.ts` — add badge reset call inside existing `logout()`
- `app/settings/SettingsScreen.tsx` — add notification preferences toggles section
- `functions/src/onNewMessage.ts` — add preferences-read guard before sending push
- `functions/src/recordSwipe.ts` — add "liked me" push after a successful like/superlike write
- `firestore.rules` — add owner-only rule for the new `notificationPreferences` subcollection

---

### `hooks/useNotifications.ts`

> New hook. Mounted once near the app root (alongside other app-lifecycle hooks). Listens for
> `AppState` transitions to `'active'` and syncs the OS app icon badge count to the total
> unread message count across all of the user's matches. Read-only with respect to
> `matchStore` — never writes to it.

```typescript
// 1. React imports
import { useEffect, useRef } from 'react'

// 2. React Native imports
import { AppState, AppStateStatus } from 'react-native'

// 3. Third-party libraries (alphabetical)
import * as Notifications from 'expo-notifications'

// 4. Internal — stores
import { useAuthStore } from '@/store/authStore'
import { useMatchStore } from '@/store/matchStore'

// Module-scope helper — pure function, easy to reason about and test in isolation.
// Not a background task, so no TaskManager/AsyncStorage isolation concerns here —
// this runs in the normal foreground JS context.
const computeTotalUnread = (
  matches: Array<Record<string, unknown>>,
  uid: string
): number => {
  return matches.reduce((sum, match) => {
    const unread = match[`${uid}_unread`]
    return sum + (typeof unread === 'number' ? unread : 0)
  }, 0)
}

export const useNotifications = (): void => {
  const uid = useAuthStore((state) => state.user?.uid)
  const matches = useMatchStore((state) => state.matches)
  const isMatchesLoading = useMatchStore((state) => state.isLoading)

  // Keep latest values in refs so the AppState listener (registered once) always
  // reads current state without needing to re-subscribe on every matches/uid change.
  const matchesRef = useRef(matches)
  const uidRef = useRef(uid)
  const isLoadingRef = useRef(isMatchesLoading)

  useEffect(() => {
    matchesRef.current = matches
    uidRef.current = uid
    isLoadingRef.current = isMatchesLoading
  }, [matches, uid, isMatchesLoading])

  useEffect(() => {
    const syncBadge = (status: AppStateStatus): void => {
      if (status !== 'active') return
      if (!uidRef.current) return
      // Guard: skip sync until matchStore has completed its initial load — otherwise
      // an empty matches array on cold start would incorrectly zero out the badge.
      if (isLoadingRef.current) return

      const total = computeTotalUnread(matchesRef.current, uidRef.current)
      void Notifications.setBadgeCountAsync(total)
    }

    const subscription = AppState.addEventListener('change', syncBadge)

    // Also sync once on mount in case the app is already active when this hook mounts.
    syncBadge(AppState.currentState)

    return () => {
      subscription.remove()
    }
  }, [])
}
```

---

### `store/authStore.ts` — Update

> Only the existing `logout()` function changes. Do not touch the `AsyncStorage` uid
> persistence added in Task 83 — this is an additive change alongside it.

```typescript
// Add import at the top of the file (alongside existing third-party imports):
import * as Notifications from 'expo-notifications'

// Inside the existing logout() function, ADD the badge reset call.
// Do not remove or reorder the existing AsyncStorage.removeItem('fitlink-uid') line —
// place the badge reset alongside it, order does not matter between these two calls:

// Existing (Task 83) — do not modify:
//   await AsyncStorage.removeItem('fitlink-uid')

// New — add this line in the same logout() function body:
await Notifications.setBadgeCountAsync(0)
```

> Do not touch any other part of `authStore.ts` — the auth state shape, `initialise()`,
> or the persist/partialize configuration are all out of scope for this task.

---

### `functions/src/onNewMessage.ts` — Update

> Add a preferences-read guard at the top of the existing push-sending logic. Do not rewrite
> the message-formatting or Expo push payload construction — only add the early-return guard.

```typescript
// Add near the top of the function body, after recipientId is known and before
// constructing/sending the Expo push payload:

const prefsSnap = await admin
  .firestore()
  .doc(`users/${recipientId}/notificationPreferences/prefs`)
  .get()

// Absent doc = all preferences true (opt-in by default) — only skip if explicitly false.
const newMessagesEnabled = prefsSnap.data()?.newMessages !== false

if (!newMessagesEnabled) {
  return // Recipient has explicitly disabled new-message notifications
}

// Existing push-sending logic continues unchanged below this point.
```

> Do not touch the existing Expo push token lookup, payload construction, or error handling
> below this guard.

---

### `functions/src/recordSwipe.ts` — Update

> Add a "someone liked you" push for premium recipients after a successful like/superlike
> write. This is additive — locate the existing point in the function where the like/superlike
> document write has already succeeded (after the transaction commits), and add this logic
> there. Do not modify the transaction itself, the daily-limit enforcement, or the Task 82
> `getNextMidnightMs(uid)` timezone helper.

```typescript
// Add after the existing transaction that writes the like/superlike document has
// successfully committed. Use the positive condition — direction is only ever
// 'like' | 'pass' | 'superlike' in this function; there is no 'rewind' case to exclude.

if (direction === 'like' || direction === 'superlike') {
  // Short-circuit on a single cheap field read before reading anything else —
  // most liked targets are free-tier, so avoid the extra reads in the common case.
  const targetSnap = await admin.firestore().doc(`users/${targetId}`).get()
  const targetData = targetSnap.data()

  if (targetData?.premium?.active === true && targetData?.expoPushToken) {
    const prefsSnap = await admin
      .firestore()
      .doc(`users/${targetId}/notificationPreferences/prefs`)
      .get()

    // Absent doc = all preferences true (opt-in by default)
    const likedMeEnabled = prefsSnap.data()?.likedMe !== false

    if (likedMeEnabled) {
      // Reuse the existing Expo push-sending utility already used elsewhere in this
      // codebase (e.g. onNewMessage.ts) — do not hand-roll a new Expo SDK call here.
      // Push body must NOT reveal the liker's identity — generic "Someone liked you!"
      // copy only, per the Phase 3 Done Checklist requirement.
      await sendExpoPush(targetData.expoPushToken, {
        title: t('notifications.likedMe.title'), // translated server-side string, or
                                                    // a fixed neutral string per your
                                                    // existing push i18n pattern
        body: t('notifications.likedMe.body'),
      })
    }
  }
}
```

> **Architecture note:** if this codebase's existing push-sending pattern in
> `onNewMessage.ts` uses a different utility name than `sendExpoPush`, use that same
> existing utility instead of introducing a new one. Do not create a second push-sending
> helper if one already exists — check `onNewMessage.ts` and any `functions/src/utils/`
> file first.

---

### `firestore.rules` — Update

> Add a new rule block for the `notificationPreferences` subcollection. Do not modify any
> existing rule for `/users/{uid}` or any other collection.

```
match /users/{uid}/notificationPreferences/{docId} {
  allow read, write: if request.auth != null && request.auth.uid == uid;
}
```

> Place this inside the existing `match /users/{uid} { ... }` block as a nested subcollection
> rule, following whatever nesting pattern the file already uses for other subcollections
> (e.g. `dailyLikes`). Do not touch the parent `/users/{uid}` rule itself.

---

### `app/settings/SettingsScreen.tsx` — Update

> Add a notification preferences section. Reuse the existing toggle/row component pattern
> already used elsewhere in this screen (e.g. the "Pause Profile" / "Incognito Mode" rows) —
> do not introduce a new toggle component.

```typescript
// Add to imports:
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/services/firebase/config'

// Add local state for the three preference toggles (this screen does not use a
// dedicated Zustand store for this — local useState is acceptable here since these
// are screen-local UI toggles backed directly by a single Firestore document read/write,
// not shared app state):
const [newMatches, setNewMatches] = useState(true)
const [newMessages, setNewMessages] = useState(true)
const [likedMe, setLikedMe] = useState(true)

// On mount, read current preferences:
useEffect(() => {
  const loadPreferences = async (): Promise<void> => {
    if (!uid) return
    const prefRef = doc(db, 'users', uid, 'notificationPreferences', 'prefs')
    const snap = await getDoc(prefRef)
    const data = snap.data()
    // Absent doc or absent field = true (opt-in by default)
    setNewMatches(data?.newMatches !== false)
    setNewMessages(data?.newMessages !== false)
    setLikedMe(data?.likedMe !== false)
  }
  void loadPreferences()
}, [uid])

// Toggle handler — writes ONLY the single changed key via merge: true.
// Do not write all three fields on every toggle — that would be a needless full-document
// write and could silently overwrite a preference the user set in another session.
const handleTogglePreference = async (
  key: 'newMatches' | 'newMessages' | 'likedMe',
  value: boolean
): Promise<void> => {
  if (!uid) return
  const prefRef = doc(db, 'users', uid, 'notificationPreferences', 'prefs')
  await setDoc(prefRef, { [key]: value }, { merge: true })
}
```

```typescript
// Add the UI section — place in the Notifications area of the screen, using the
// existing settings row/toggle component:

<SettingsRow
  label={t('settings.notifications.newMatches.title')}
  value={newMatches}
  onValueChange={(value) => {
    setNewMatches(value)
    void handleTogglePreference('newMatches', value)
  }}
/>
<SettingsRow
  label={t('settings.notifications.newMessages.title')}
  value={newMessages}
  onValueChange={(value) => {
    setNewMessages(value)
    void handleTogglePreference('newMessages', value)
  }}
/>
<SettingsRow
  label={t('settings.notifications.likedMe.title')}
  value={likedMe}
  onValueChange={(value) => {
    setLikedMe(value)
    void handleTogglePreference('likedMe', value)
  }}
/>
```

> Use whatever the existing settings row component is actually named in this codebase
> (e.g. it may be `ToggleRow`, `SettingsToggle`, etc. — match the existing "Pause Profile"
> row's component, do not assume `SettingsRow` is the real name). Do not touch any other
> section of `SettingsScreen.tsx`.

---

### Mount `useNotifications()` — App Root

> This hook must be called once, near the app root, alongside other lifecycle hooks
> (e.g. wherever `useLastActive()` from Task 83 is mounted). Find that existing mount point
> and add the new hook call alongside it — do not create a second mount location.

```typescript
// In whatever file currently calls useLastActive() (per Task 83 — likely App.tsx or a
// root-level provider component), add:

import { useNotifications } from '@/hooks/useNotifications'

// Inside the component body, alongside the existing useLastActive() call:
useNotifications()
```

---

## Important Architecture Notes for Codex

1. **No `'rewind'` guard in `recordSwipe.ts`.** `direction` in this function is only ever
   `'like' | 'pass' | 'superlike'`. Rewind is handled entirely by the separate
   `rewindSwipe.ts` callable, which this task does not touch. Use
   `direction === 'like' || direction === 'superlike'` — never write or check for
   `direction !== 'rewind'`.

2. **Reuse the existing push-sending utility.** Check `onNewMessage.ts` and
   `functions/src/utils/` for an existing Expo push helper before writing a new one in
   `recordSwipe.ts`. Do not introduce a duplicate push-sending implementation.

3. **Absent preferences doc means all-true, not all-false.** Every read of
   `notificationPreferences/prefs` must use `!== false` (not `=== true`) so that a user who
   has never visited the settings screen still receives notifications by default.

4. **Single-field merge writes only.** `SettingsScreen.tsx` must write exactly the one
   toggled key via `setDoc(ref, { [key]: value }, { merge: true })` — never write all three
   preference fields on a single toggle interaction.

5. **Badge sync must not fire before `matchStore` has loaded.** Use the store's existing
   loading flag to gate the `AppState` listener — an empty `matches` array during initial
   load must not zero out a real pending badge count.

6. **`useNotifications()` is foreground-only.** This is not a background task — do not use
   `TaskManager.defineTask` or any background-fetch pattern here. It is a normal hook reacting
   to `AppState`, mounted in the regular JS context. Background `lastActive` (Task 83) is a
   separate, unrelated mechanism — do not conflate the two.

7. **"Liked me" push body must stay generic.** Do not include the liker's name, photo, or any
   identifying detail in the push title/body — "Someone liked you!" or equivalent only. This
   matches the Phase 3 Done Checklist requirement that this push "does not reveal the liker's
   identity."

---

## Rollback Protocol

If `npx tsc --noEmit` or `npm --prefix functions run build` produces errors that cannot be
resolved without:
- Modifying a file in the "Do Not Touch" list, OR
- Making an assumption about a prior task's output that cannot be verified, OR
- Discovering that `recordSwipe.ts` or `onNewMessage.ts` already has unrelated uncommitted
  changes that conflict with this task's edits

**Then:**
1. Do not commit any partial changes
2. Revert all files touched in this session to their state at session start
3. Output a `<!-- ROLLBACK REPORT -->` block listing which file caused the conflict, what the
   error was, and what information or decision is needed to proceed
4. Stop. Do not attempt a workaround. Bring the report back to the Architect.

---

## Codex Self-Check (Run Before Declaring Done)

**TypeScript**
- [ ] `npx tsc --noEmit` — zero errors in root
- [ ] `npm --prefix functions run build` — zero errors
- [ ] Zero `any` types introduced
- [ ] Zero type assertions (`as X`) without an explanatory comment

**Conventions**
- [ ] Zero `console.log` / `console.error` / `console.warn` in any client or function file
- [ ] Zero inline styles — `style={{ }}` does not appear in any touched JSX
- [ ] Zero relative imports — `../../` does not appear anywhere in touched files
- [ ] All new user-facing strings (`notifications.likedMe.*`,
      `settings.notifications.*`) added to all 4 i18n files (en, my, zh, ta)
- [ ] All new constants use values from `constants/theme` — no hardcoded hex, px, or font sizes

**Firebase / Security**
- [ ] No server-only fields written from the client
      (`age`, `banned`, `premium`, `photoVerified`, `verifiedAt`, `boostExpiresAt`)
- [ ] `recordSwipe.ts` and `onNewMessage.ts` retain their existing
      `if (!request.auth) throw new HttpsError(...)` guards — not removed or weakened
- [ ] Both touched Cloud Functions still specify `{ region: 'asia-southeast1' }`
- [ ] `serverTimestamp()` used for any new timestamp writes — `new Date()` not introduced
- [ ] No `FieldValue.delete()` introduced in this task (not needed for this task's scope)

**Architecture**
- [ ] No Zustand store imported inside any background task callback (not applicable here,
      but confirm `useNotifications.ts` does not accidentally introduce a `TaskManager` call)
- [ ] No `expo-video` import anywhere touched
- [ ] `recordSwipe.ts`'s daily-limit transaction and Task 82 timezone helper are untouched
- [ ] `authStore.ts`'s Task 83 `AsyncStorage` lines are untouched — only the badge reset
      was added
- [ ] Files in the "Do Not Touch" list were not modified
- [ ] No `direction !== 'rewind'` string appears anywhere in the diff

**Platform**
- [ ] `AppState` listener works correctly on both iOS and Android — `Notifications.
      setBadgeCountAsync` is iOS-meaningful but safe to call on Android (no-op or harmless)
- [ ] Ask: "Would this break on Android?" — answer must be No
- [ ] Ask: "Would this break on iOS?" — answer must be No

---

## Acceptance Criteria

- [ ] `hooks/useNotifications.ts` created, exports `useNotifications` as a named export
- [ ] `useNotifications()` is mounted once near the app root, alongside the existing Task 83
      `useLastActive()` call
- [ ] App icon badge count updates correctly on `AppState` → `'active'` transitions
- [ ] Badge count resets to `0` in `authStore.ts`'s `logout()`
- [ ] `/users/{uid}/notificationPreferences/prefs` is readable and writable only by the
      document owner per the new `firestore.rules` block
- [ ] `SettingsScreen.tsx` reads existing preferences on mount and writes only the single
      toggled key on each interaction
- [ ] `onNewMessage.ts` skips the push when `prefs.newMessages === false`, sends by default
      when the preferences doc is absent
- [ ] `recordSwipe.ts` sends a "liked me" push only when: direction is `'like'` or
      `'superlike'`, target is `premium.active === true`, target has an `expoPushToken`, and
      `prefs.likedMe !== false`
- [ ] The "liked me" push body does not reveal the liker's identity
- [ ] No `'rewind'` string comparison exists anywhere in `recordSwipe.ts`'s new code
- [ ] All new user-facing strings use `t()` with entries in all 4 i18n files
- [ ] `tsc --noEmit` and `npm --prefix functions run build` both pass with zero errors

---

## Do Not Touch

`App.tsx` (only add the `useNotifications()` call at its existing hook-mounting location —
do not restructure the file), `store/authStore.ts` (only add the single
`Notifications.setBadgeCountAsync(0)` line inside `logout()` — the Task 83 `AsyncStorage`
logic, `initialise()`, and the persist/partialize configuration are untouched),
`store/matchStore.ts` (read-only in this task), `functions/src/rewindSwipe.ts` (entirely
out of scope), `functions/src/recordSwipe.ts`'s existing transaction, daily-limit logic, and
Task 82 `getNextMidnightMs(uid)` helper (only the new post-commit push logic is added),
`services/firebase/config.ts`, `types/user.ts`, `constants/`, `i18n/` (except adding new
keys — never remove or rename existing keys)

---

## Commit

```
git commit -m "task-84: notification badge count and granular preferences"
```

---

## After This Session

Update `CHANGELOG.md` using the standard template from CODEX_PROMPT_FORMAT_REFERENCE.md.
In the **Architecture Decisions** section, explicitly note the spec correction made in this
task:

```
### Architecture Decisions

- TASKS_PHASE3.md's original Task 84 spec assumed recordSwipe.ts had a 'rewind' direction
  (from Task 72). Task 72 was actually implemented as a separate rewindSwipe.ts callable
  that never calls recordSwipe.ts. The "liked me" push guard was written as the positive
  condition (direction === 'like' || direction === 'superlike') instead of the originally
  specified negative guard (direction !== 'rewind'), since the negative guard would have
  been dead code. ARCHITECT.md's Cloud Functions table still describes recordSwipe as
  supporting a 'rewind' direction and does not list rewindSwipe — this is a pre-existing
  documentation drift, not something this task introduced, and should be corrected in a
  future ARCHITECT.md revision pass.
```

In **Conflict Risks Introduced**, note:

```
### Conflict Risks Introduced

- Modified recordSwipe.ts — Task 87 (Firestore security rules) and Task 88 (indexes) do
  not depend on this change, but any future task touching recordSwipe.ts should be aware
  the "liked me" push logic now runs after every successful like/superlike transaction.
- Added firestore.rules block for notificationPreferences — Task 87 consolidates all
  Phase 3 rules; confirm this block is preserved (not duplicated or overwritten) when
  generating that task's prompt.
```

Then come to claude.ai with the updated CHANGELOG.md and request the next task prompt.

---

## Reasoning Level

High
