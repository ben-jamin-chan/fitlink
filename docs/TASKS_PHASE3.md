# TASKS_PHASE3.md — [APP_NAME]
# Phase 3: Expansion (Months 7–12)
# Updated: June 2026 — Session A upgrades

> **How to use this file:**
> - One task at a time in Codex. Never batch multiple tasks in one prompt.
> - Check off each task after Codex completes and you have reviewed the diff.
> - Git commit after every task: `git commit -m "task-XX: <description>"`
> - **Always check CHANGELOG.md before generating a prompt** — it is the authoritative
>   source of what is actually in the codebase. The checkboxes below are the spec baseline,
>   not live completion status.
> - If Codex drifts or produces unexpected output, bring the diff back to claude.ai Architect
>   for review before proceeding.
> - Tasks are ordered by dependency — do not skip ahead. See the Dependency Map below.

---

## Consumed Task Numbers (Git History Only)

The following commit numbers exist in git but are **not Phase 3 spec tasks**. They were
unplanned Phase 2 remediation commits run after Phase 2 testing. Do not generate prompts
for these numbers. Do not look for them in this spec file.

| Commit | Description | Status |
|---|---|---|
| `task-70` | Phase 2 remediation — [see CHANGELOG] | In git, not in spec |
| `task-71` | Phase 2 remediation — [see CHANGELOG] | In git, not in spec |
| `task-72` | Phase 2 remediation — [see CHANGELOG] | In git, not in spec |
| `task-73` | Phase 2 remediation — [see CHANGELOG] | In git, not in spec |
| `task-74` | Phase 2 remediation — [see CHANGELOG] | In git, not in spec |

**The first Phase 3 spec task is Task 75.** Adjust the next commit number to the next
unused number in your git log if 75 is already consumed.

---

## Inter-Task Dependency Map

Use this before generating any prompt. A task cannot be started until all its dependencies
are complete and confirmed in CHANGELOG.md.

```
Task 70 (Types)
  └─► Task 71 (Stripe Portal)      — needs no Task 70 output
  └─► Task 72 (Rewind)             — needs no Task 70 output
  └─► Task 73 (Incognito)          — needs no Task 70 output
  └─► Task 74 (Boost)              — needs no Task 70 output
  └─► Task 75 (Matches Filter)     — needs MatchFilters type from Task 70 / types/match.ts
  └─► Task 76 (Voice Messages)     — independent of Task 70
  └─► Task 77 (Video Profile)      — needs videoProfileUrl field confirmed in types/user.ts (Task 70)
  └─► Task 78 (Places Service)     — independent of Task 70
  └─► Task 79 (Gym Check-In)       — needs GymCheckin, GymPlace types (Task 70) + Task 78 service
  └─► Task 80 (Events)             — needs FitlinkEvent, EventLocation types (Task 70)
  └─► Task 81 (SEA Regions)        — needs timezone field in types/user.ts (Task 70)
  └─► Task 83 (Background Active)  — needs updateLastActive() extracted from Task 70 or earlier

Task 78 (Places Service)
  └─► Task 79 (Gym Check-In)       — searchNearbyGyms() must exist

Task 79 (Gym Check-In)
  └─► Task 80 (Events)             — independent (separate collection)

Task 81 (SEA Regions)
  └─► Task 82 (Timezone Resets)    — timezone field must be written to Firestore first

Task 82 (Timezone Resets) + Task 83 (Background Active)
  └─► Task 84 (Notifications)      — independent, but best after 82/83 for stable state

Tasks 79 + 80 + 84 + 85 + 86
  └─► Task 87 (Security Rules)     — consolidates rules for all Phase 3 collections

Task 87 (Security Rules)
  └─► Task 88 (Indexes)            — final pass; no code dependencies, only JSON
```

**Critical chains that must not be broken:**
- `Task 70 → Task 77` (videoProfileUrl type)
- `Task 70 → Task 79` (GymCheckin, GymPlace types)
- `Task 70 → Task 81` (timezone type)
- `Task 78 → Task 79` (searchNearbyGyms service)
- `Task 81 → Task 82` (timezone field in Firestore)
- `Tasks 79+80+85+86 → Task 87` (rules consolidation)
- `Task 87 → Task 88` (rules before indexes for correctness)

---

## Phase 3 Scope

Phase 3 ships four major epics on top of the working Phase 2 Growth build, targeting
50,000 users across SEA by Month 12:

1. **Deferred Premium Features** — Rewind (undo last swipe), Incognito Mode, Profile Boost,
   Stripe Customer Portal (real Cloud Function session), Matches advanced filter/search
2. **Rich Media in Chat** — Voice messages (record, send, playback), Video profiles
   (short loop on profile card and full profile modal)
3. **Events & Community** — Gym check-ins via Google Places, Workout events (create,
   discover, RSVP), Events tab in bottom navigation
4. **SEA Expansion & Infrastructure** — Singapore + Thailand region expansion, per-user
   timezone daily resets, background `lastActive`, notification badge management,
   Strava disconnect cleanup, admin moderation queue hardening

---

### Deferred Items from Phase 2 Being Resolved in Phase 3

From `TASKS_PHASE2.md` "Deferred to Phase 3" section:

- **Rewind** — `rewind()` is a UI no-op for premium users; actual card restoration is Phase 3
- **Incognito Mode** — UI gate exists in Phase 2; backend (`getDiscoveryStack` exclusion) is Phase 3
- **Profile Boost** — Pro tier feature, 1x per month; not started in Phase 2
- **Stripe Customer Portal** — `PremiumScreen` has a `Linking.openURL` placeholder; real server-side Stripe portal session is Phase 3
- **Advanced Matches filter/search** — gate exists; real filter UI + logic is Phase 3
- **Video profiles** — deferred from Phase 2
- **Voice messages** — deferred from Phase 2
- **Events / gym meetups** — deferred from Phase 2
- **Gym check-ins via Google Places** — deferred from Phase 2
- **SEA expansion** (Singapore, Thailand) — deferred from Phase 2
- **Background `lastActive`** when app fully quit — deferred from Phase 2
- **App Store `restorePurchases()`** — remains deferred to Phase 4 (out of scope)
- **RTL layout support** — remains deferred to Phase 4 (out of scope)
- **Admin moderation dashboard** (web UI) — remains deferred to Phase 4; but Firestore
  collections (`/admin_queue`, `/flags`) need security rules and indexes this phase

---

### New Firestore Schema (Phase 3 Additions)

`/users/{userId}` — new fields:
```typescript
timezone: string              // IANA string e.g. 'Asia/Kuala_Lumpur' — set at onboarding
incognito: boolean            // Pro feature; hidden from discovery when true
boostExpiresAt?: Timestamp    // Pro feature; boosted until this time (server-managed)
videoProfileUrl?: string      // Cloud Storage URL for short video loop (max 15s)
gymCheckin?: {                // Denormalised from /gymCheckins for SwipeCard reads
  gymName: string
  expiresAt: Timestamp
}
```

`/events/{eventId}` — new collection:
```typescript
{
  creatorId: string
  title: string
  description: string
  activityType: string
  location: { name: string; address: string; coordinates: GeoPoint; placeId: string }
  startAt: Timestamp
  endAt: Timestamp
  maxAttendees: number | null
  attendees: string[]
  city: string
  country: string
  createdAt: Timestamp
  cancelled: boolean
}
```

`/gymCheckins/{checkinId}` — new collection:
```typescript
{
  userId: string
  placeId: string
  gymName: string
  coordinates: GeoPoint
  city: string
  checkedInAt: Timestamp
  expiresAt: Timestamp         // 2 hours after check-in
}
```

`/users/{uid}/notificationPreferences/prefs` — new subcollection document:
```typescript
{
  newMatches: boolean
  newMessages: boolean
  likedMe: boolean
}
```

> **Schema routing rules (avoid drift):**
> - `location.country` is nested under `location` — not top-level
> - `timezone` is top-level — not nested under `location`
> - `boostExpiresAt` is server-managed — block client writes in `firestore.rules`
> - `gymCheckin` is written by `createCheckin` CF and cleared by client + `FieldValue.delete()`

---

## ⚙️ PRE-FLIGHT: Manual Setup (Before Task 75)

These steps require your browser and third-party consoles — Codex cannot do them.

**Step A — Google Places API**
1. In Google Cloud Console, enable the **Places API (New)** for your Firebase project
2. Create an API key restricted to your app bundle identifier (iOS) and package name (Android)
3. Add to `.env`:
   ```
   EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIzaSy...
   ```

**Step B — Stripe Customer Portal**
1. In Stripe Dashboard → Billing → Customer portal → Activate portal
2. Configure: allowed plan changes, cancellation, billing history

**Step C — Apple Background Modes (for Task 83)**
1. In Apple Developer portal, add "Background fetch" capability to your App ID
2. Codex handles the `app.json` changes in Task 83

**Step D — Production Firebase**
- Create `gym-dating-prod` Firebase project mirroring `gym-dating-dev` if not done yet
- Update `.firebaserc` to add `"production"` alias

✅ Pre-flight complete when: Google Places API key in `.env`, Stripe portal activated.

---

## 🔄 PHASE 3A: Types, Schema & Deferred Premium Features
### Tasks 70–75

---

### Task 70 — Update TypeScript Types for Phase 3
- **File(s):** `types/user.ts`, `types/event.ts` (new), `types/checkin.ts` (new)
- **Dependencies:** None — first task of Phase 3
- **Action:**
  - `types/user.ts` — add five new fields, do not remove or rename existing fields:
    - `timezone?: string`
    - `incognito?: boolean`
    - `boostExpiresAt?: Timestamp`
    - `videoProfileUrl?: string`
    - `gymCheckin?: { gymName: string; expiresAt: Timestamp }`
  - `types/event.ts` — new file, named exports only:
    - `EventLocation` interface: `{ name: string; address: string; coordinates: GeoPoint; placeId: string }`
    - `FitlinkEvent` interface — all fields from the schema above, using `Timestamp` for all dates
    - `EventRSVPStatus` type: `'attending' | 'notAttending' | 'none'`
    - `EventWithAttendeeProfiles` interface: extends `FitlinkEvent`, adds `attendeeProfiles: UserProfile[]`
  - `types/checkin.ts` — new file, named exports only:
    - `GymCheckin` interface — all fields from the schema above
    - `GymPlace` interface: `{ placeId: string; name: string; address: string; coordinates: GeoPoint; rating?: number; photoUrl?: string }`
  - Run `npx tsc --noEmit` — zero errors required before Task 71
- **Output:** Two new type files; `user.ts` updated; tsc clean
- **Reasoning Level:** Low

---

### Task 71 — Stripe Customer Portal Cloud Function
- **File(s):** `functions/src/createStripePortalSession.ts` (new),
  `app/settings/PremiumScreen.tsx`, `functions/src/index.ts`
- **Dependencies:** None (does not depend on Task 70 output)
- **Context:** `PremiumScreen.tsx` currently uses `Linking.openURL` with a static URL from
  `EXPO_PUBLIC_STRIPE_BILLING_PORTAL_URL`. This task replaces that with a proper server-side
  Stripe Billing Portal session so the URL is authenticated, scoped to the customer, and
  generated on demand.
- **Action:**
  - `functions/src/createStripePortalSession.ts` — 2nd gen callable (`asia-southeast1`):
    - Auth check; throw `HttpsError('unauthenticated', ...)` if `!request.auth`
    - Read `users/{uid}.stripeCustomerId` from Firestore; throw `HttpsError('failed-precondition', 'no-customer')` if absent
    - Call `stripe.billingPortal.sessions.create({ customer: customerId, return_url: 'fitlink://settings' })`
    - Return `{ url: string }`
    - Export from `functions/src/index.ts`
  - `app/settings/PremiumScreen.tsx` — update "Manage Subscription" button handler:
    - Remove `EXPO_PUBLIC_STRIPE_BILLING_PORTAL_URL` reference
    - Call `createStripePortalSession` Cloud Function via `httpsCallable`
    - Show `LoadingOverlay` while call is in flight
    - On success: `Linking.openURL(result.data.url)`
    - On error: show translated `Alert`
  - Add i18n keys: `subscription.portal.loading`, `subscription.portal.error` to all 4 language files
  - Run `npm --prefix functions run build` — zero errors
- **Output:** "Manage Subscription" opens a real Stripe Customer Portal session; no static URL
  in the client; tsc and functions build clean
- **Reasoning Level:** Medium

---

### Task 72 — Rewind (Undo Last Swipe) for Premium Users
- **File(s):** `store/discoveryStore.ts`, `functions/src/recordSwipe.ts`
- **Dependencies:** None (does not depend on Task 70 output)
- **Conflict risk:** `recordSwipe.ts` — if Task 84 is already complete, verify the
  `'liked_me'` push notification logic added in Task 84 is not overwritten here.
- **Action:**
  - `store/discoveryStore.ts`:
    - Add `swipeHistory: Array<{ targetId: string; direction: 'like' | 'pass' | 'superlike' }>`
      to state — **in-memory only, never persisted** (exclude from Zustand `partialize`)
    - After every successful `recordSwipe` Cloud Function call, push `{ targetId, direction }`
      onto `swipeHistory` (cap at 5 entries — shift oldest if full)
    - `rewind()` action — currently a no-op stub; replace with:
      1. Check `subscriptionStore.isPremium()` — if false: `showUpsell('rewind')` and return
      2. Pop last entry from `swipeHistory` — if empty: show toast `t('discovery.rewind.empty')` and return
      3. Call `recordSwipe` Cloud Function with `{ targetId, direction: 'rewind' }`
      4. On success: fetch the rewound user's profile via `getUserProfile(targetId)` from
         `services/firebase/firestore.ts` and unshift it to index 0 of `stack`
      5. If the rewound direction was `'like'` or `'superlike'`: decrement `dailyLikesCount`
         by 1 (min 0)
  - `functions/src/recordSwipe.ts` — extend direction union:
    - Change `direction: 'like' | 'pass' | 'superlike'` to include `'rewind'`
    - For `'rewind'`:
      - Attempt to delete `/swipes/{uid}/likes/{targetId}`; catch and ignore if not found
      - Attempt to delete `/swipes/{uid}/passes/{targetId}`; catch and ignore if not found
      - If a like/superlike doc was deleted: run Firestore transaction to decrement
        `users/{uid}/dailyLikes.count` by 1 (min 0, using `Math.max(0, current - 1)`)
      - Return `{ success: true; wasLike: boolean }`
      - **Add comment:** rewind cannot un-match — if `onSwipeCreated` already fired and created
        a match, that match persists. Only the swipe doc is deleted.
  - Add i18n keys: `discovery.rewind.empty`, `discovery.rewind.success` to all 4 language files
  - Run `npx tsc --noEmit` and `npm --prefix functions run build` — both zero errors
- **Constraints:** `swipeHistory` must be excluded from Zustand `persist` allowlist — it is
  session-only state. Never write swipe history to Firestore or AsyncStorage.
- **Output:** Premium users can rewind the last swipe; swipe doc deleted server-side; profile
  re-appears at top of stack; free users see upsell modal
- **Reasoning Level:** High

---

### Task 73 — Incognito Mode (Pro Feature)
- **File(s):** `functions/src/getDiscoveryStack.ts`, `app/settings/SettingsScreen.tsx`,
  `store/profileStore.ts`, `firestore.rules`
- **Dependencies:** None (does not depend on Task 70 output for runtime, but types are cleaner after it)
- **Action:**
  - `functions/src/getDiscoveryStack.ts`:
    - Add `incognito: true` to the candidate exclusion filter alongside `banned: true` and
      `paused: true`
    - Incognito users are invisible in all other users' discovery stacks
    - Incognito users still see the full stack themselves — they can like, match, and message
  - `app/settings/SettingsScreen.tsx` — Privacy section, below "Pause Profile" toggle:
    - Add "Incognito Mode" row with a toggle
    - Toggle is only operable when `subscriptionStore.isPremium()` AND
      `profile.premium.tier === 'pro'`
    - Free or Plus users tapping the row: `navigation.navigate('Premium')`
    - On toggle: `profileStore.updateProfile({ incognito: !profile.incognito })`
    - Helper text below toggle: `t('settings.privacy.incognito.hint')`
      — "Only users you like can see you"
  - `firestore.rules`:
    - `incognito` is a user preference, not server-managed. Allow client writes to `incognito`
      (same pattern as `paused`). Add a comment:
      `// incognito — soft Pro gate, enforced by getDiscoveryStack; not restricted by rules`
  - Add i18n keys: `settings.privacy.incognito.title`, `settings.privacy.incognito.hint`,
    `settings.privacy.incognito.proOnly` to all 4 language files
  - Run `npm --prefix functions run build` — zero errors
- **Output:** Pro users can toggle incognito; `getDiscoveryStack` excludes them from all stacks;
  non-Pro users see gate UI; tsc and functions build clean
- **Reasoning Level:** Medium

---

### Task 74 — Profile Boost (Pro Feature)
- **File(s):** `functions/src/activateBoost.ts` (new), `functions/src/getDiscoveryStack.ts`,
  `app/profile/ProfileScreen.tsx`, `functions/src/index.ts`
- **Dependencies:** None (does not depend on Task 70 output)
- **Conflict risk:** `getDiscoveryStack.ts` — if Task 73 is complete, the `incognito` filter
  added there must not be removed here.
- **Action:**
  - `functions/src/activateBoost.ts` — 2nd gen callable (`asia-southeast1`):
    - Auth check
    - Read `users/{uid}.premium` — throw `HttpsError('permission-denied', 'pro-required')`
      if `premium.tier !== 'pro'`
    - If `users/{uid}.boostExpiresAt` is in the future: throw
      `HttpsError('already-exists', 'boost-active')` with remaining milliseconds in details
    - Set `users/{uid}.boostExpiresAt` to
      `Timestamp.fromMillis(Date.now() + 30 * 60 * 1000)` using Admin SDK
      (do not use `serverTimestamp()` here — we need a deterministic future value)
    - Return `{ boostExpiresAt: Timestamp }`
    - Export from `functions/src/index.ts`
  - `functions/src/getDiscoveryStack.ts`:
    - After computing `score`: if `candidate.boostExpiresAt` exists and is in the future,
      add `+5` to `score`
    - Boosted Pro users get `+8` total bonus (`+3` existing for `premium.active` + `+5` boost)
  - `app/profile/ProfileScreen.tsx`:
    - Add "Boost Profile" row in the action area — only rendered when
      `profile.premium?.tier === 'pro'`
    - When `profile.boostExpiresAt` is in the future: show "Boosted — {N}m remaining" text
      (compute remaining minutes from `boostExpiresAt.toMillis() - Date.now()`)
    - On press: call `activateBoost` Cloud Function, update `profileStore.profile.boostExpiresAt`
      from the return value, show success toast `t('profile.boost.success')`
    - Non-Pro tap: `navigation.navigate('Premium')`
  - `boostExpiresAt` is server-managed — add to server-only field block in `firestore.rules`
    (this will be consolidated in Task 87)
  - Add i18n keys: `profile.boost.activate`, `profile.boost.active`, `profile.boost.proOnly`,
    `profile.boost.success` to all 4 language files
  - Run `npm --prefix functions run build` — zero errors
- **Output:** Pro users can activate a 30-minute boost; discovery scores boosted candidates
  higher; cooldown prevents re-activation; tsc and functions build clean
- **Reasoning Level:** High

---

### Task 75 — Matches Advanced Search & Filter
- **File(s):** `app/matches/MatchesScreen.tsx`, `components/matches/FilterModal.tsx` (new),
  `store/matchStore.ts`, `types/match.ts`
- **Dependencies:** `types/match.ts` from Task 70 (verify `MatchFilters` interface exists or create it here)
- **Action:**
  - `types/match.ts` — add:
    ```typescript
    export interface MatchFilters {
      sortBy: 'recent' | 'active' | 'name'
      activities: string[]
      status: 'all' | 'unread' | 'hasMessages' | 'new'
    }
    ```
  - `store/matchStore.ts`:
    - Add `activeFilters: MatchFilters` to state with default:
      `{ sortBy: 'recent', activities: [], status: 'all' }`
    - Add `setActiveFilters(filters: MatchFilters): void` action
    - Add `filteredMatches(searchQuery: string): MatchWithProfile[]` getter — computed from
      `matches` + `activeFilters` + `searchQuery`. No additional Firestore queries —
      operates entirely on the already-loaded `matches` array:
      - `status: 'unread'` → `match[uid + '_unread'] > 0`
      - `status: 'hasMessages'` → `match.lastMessage != null`
      - `status: 'new'` → `match.lastMessage == null`
      - `activities` → `otherUser.activities` intersects `activeFilters.activities`
      - `sortBy: 'active'` → sort by `otherUser.lastActive DESC`
      - `sortBy: 'name'` → sort by `otherUser.firstName ASC`
      - Name search → case-insensitive `includes` on `otherUser.firstName`
  - `components/matches/FilterModal.tsx` — new named export, bottom-sheet style modal:
    - **Sort** section: 3-chip `SingleSelect` — Recent / Active / Name
    - **Activity** section: multi-select chips reusing the same 16 activities from onboarding
    - **Status** section: 4-chip `SingleSelect` — All / Unread / Messages / New
    - "Apply" button → `matchStore.setActiveFilters(draft)` then close
    - "Reset" button → reset draft to defaults, call `setActiveFilters(defaults)`, close
    - Dismiss: backdrop tap or swipe down
    - Reuse `MultiSelect` and `SingleSelect` from `components/ui/`
    - All styles in `StyleSheet.create`, all strings through `t()`
  - `app/matches/MatchesScreen.tsx`:
    - Wire search bar `onChangeText` → local `searchQuery: string` state
    - Replace FlatList data source with `matchStore.filteredMatches(searchQuery)`
    - Filter icon (`options-outline` Ionicons, top-right): visible only to premium users;
      non-premium tap → `navigation.navigate('Premium')`
    - Red dot badge on filter icon when any filter deviates from defaults
    - Filter icon press → local `isFilterModalVisible` state toggle
    - Render `<FilterModal visible={isFilterModalVisible} onClose={() => setIsFilterModalVisible(false)} />`
  - Add i18n keys: `matches.filter.*` to all 4 language files
- **Output:** Premium search and filter working; non-premium gate correct; tsc clean
- **Reasoning Level:** Medium

---

## 🎥 PHASE 3B: Rich Media in Chat
### Tasks 76–77

---

### Task 76 — Voice Message Recording & Playback
- **File(s):** `components/chat/VoiceMessageRecorder.tsx` (new),
  `components/chat/VoiceMessageBubble.tsx` (new), `components/chat/ChatInput.tsx`,
  `app/chat/ChatScreen.tsx`, `store/chatStore.ts`, `services/firebase/storage.ts`,
  `services/firebase/realtime.ts`
- **Dependencies:** None — independent of Phase 3A tasks
- **Action:**
  - Install: `npx expo install expo-av`
  - `VoiceMessageRecorder.tsx` — named export:
    - Hold-to-record via `Gesture.LongPress()` composed with `Gesture.Pan()` using
      `Gesture.Simultaneous()` (RNGH v2 — same pattern as rest of codebase)
    - While recording: pulsing `Animated.View` circle (React Native core `Animated`,
      not Reanimated — no gesture interaction needed on the animation itself)
    - Slide left > 80px horizontally during hold → cancel recording
    - Max 60 seconds: `setTimeout` auto-stops and transitions to preview state
    - On release without cancel: stop `Audio.Recording`, show preview row with "Send"
      and "Cancel" buttons
    - Call `Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })`
      on mount; call with `allowsRecordingIOS: false` on unmount
  - `VoiceMessageBubble.tsx` — named export:
    - Props: `audioUrl: string`, `duration: number` (seconds), `isOwnMessage: boolean`
    - Play/pause icon + static waveform bar visualisation (a row of `View`s with varying
      heights — no third-party lib) + duration text formatted as `"0:12"`
    - Playback via `Audio.Sound.createAsync()`; release on unmount via `sound.unloadAsync()`
    - `Animated.Value` for playback progress, drives a width-percentage overlay on the bars
    - After full playback: bars colour changes to `colors.secondary` ("heard" state)
  - `services/firebase/storage.ts`:
    - Add `uploadVoiceMessage(matchId: string, localUri: string): Promise<string>` —
      uploads to `chats/{matchId}/audio/{uuid}.m4a`, returns download URL
  - `services/firebase/realtime.ts`:
    - RTDB message schema already supports `type: 'voice'` — no schema change
    - Add `sendVoiceMessage(matchId: string, senderId: string, audioUrl: string, duration: number): Promise<void>`
  - `store/chatStore.ts`:
    - Add `sendVoiceMessage(localUri: string, duration: number): Promise<void>` action:
      upload via `storage.uploadVoiceMessage` → call `realtime.sendVoiceMessage` →
      update Firestore match `lastMessage: '🎤 Voice message'`
  - `components/chat/ChatInput.tsx`:
    - Mic button already exists in the input row (from Task 32)
    - On mic button press: toggle local `isRecording: boolean` state
    - Render `<VoiceMessageRecorder>` as an overlay above the input bar when `isRecording` is true
  - `app/chat/ChatScreen.tsx`:
    - Render `<VoiceMessageBubble>` for `message.type === 'voice'`
  - Add i18n keys: `chat.voice.hold`, `chat.voice.slideCancel`, `chat.voice.send`,
    `chat.voice.cancel`, `chat.voice.heard`, `chat.voice.lastMessage` to all 4 language files
- **Constraints:** `Audio.Recording` and `Audio.Sound` must both be unloaded in `useEffect`
  cleanup — never leave an active audio session open after unmount. Audio session setup
  must complete before `startAsync()` is called. File recording format: `.m4a` on iOS,
  `.3gp` on Android — use `Audio.RecordingOptionsPresets.HIGH_QUALITY` which handles both.
- **Output:** Hold-to-record works; slide-to-cancel works; voice message sends and appears
  in chat; playback with progress works; tsc clean
- **Reasoning Level:** High

---

### Task 77 — Video Profile Loop
- **File(s):** `components/profile/VideoProfilePicker.tsx` (new),
  `components/discovery/SwipeCard.tsx`, `components/discovery/FullProfileModal.tsx`,
  `app/profile/EditProfileScreen.tsx`, `store/profileStore.ts`,
  `services/firebase/storage.ts`
- **Dependencies:** `types/user.ts` must include `videoProfileUrl?: string` (Task 70)
- **Action:**
  - Install: `npx expo install expo-video`
  - **Video constraints:** max 15 seconds, max 50MB, H.264
  - `services/firebase/storage.ts`:
    - Add `uploadVideoProfile(uid: string, localUri: string): Promise<string>` —
      uploads to `users/{uid}/video/profile.mp4`, returns download URL
  - `store/profileStore.ts`:
    - Add `updateVideoProfile(localUri: string): Promise<void>` — calls
      `storage.uploadVideoProfile` then `updateProfile({ videoProfileUrl })`
    - Add `removeVideoProfile(): Promise<void>` — calls
      `updateProfile({ videoProfileUrl: '' })`
  - `components/profile/VideoProfilePicker.tsx` — named export:
    - Tap → `expo-image-picker` with `mediaTypes: ['videos']`, `videoMaxDuration: 15`
    - Before uploading: check file size with `expo-file-system` `getInfoAsync()` — if
      `size > 50 * 1024 * 1024`, show `Alert` with `t('profile.video.tooLarge')` and abort
    - Show thumbnail preview + "Remove" option once a video is selected
    - Upload via `profileStore.updateVideoProfile(localUri)` with `LoadingOverlay`
    - On error: revert local preview state, show error toast
  - `app/profile/EditProfileScreen.tsx` — Photos section:
    - Add a "Video" row below the photo grid, renders `<VideoProfilePicker />`
    - If `profile.videoProfileUrl` non-empty: show thumbnail + "Remove" button
  - `components/discovery/SwipeCard.tsx`:
    - If `user.videoProfileUrl` is set: show a `🎥` chip in the activity badges row
    - **Do not autoplay** — 60fps constraint; badge only, opens FullProfileModal on tap
    - **Do not import `expo-video` in this file** — performance constraint
  - `components/discovery/FullProfileModal.tsx` — Photo gallery section:
    - If `profile.videoProfileUrl` is set: add a "Video" tab alongside the photo
      pagination dots
    - When "Video" tab is active: render `expo-video` `VideoView` with props
      `loop`, `muted={false}`, `contentFit="cover"`; call `player.play()` on tab activate
    - In `useEffect` cleanup and on tab switch away: call `player.pause()`
  - Add i18n keys: `profile.video.add`, `profile.video.remove`, `profile.video.tooLarge`,
    `profile.video.uploading`, `profile.video.tab` to all 4 language files
  - Document in `BUILD.md`: `expo-video` requires a development build
- **Constraints:** Video must not autoplay in `SwipeCard` — discovery performance constraint.
  Always check file size before upload. `expo-video` player must be paused on modal close
  and tab switch to release the media session and avoid audio bleed.
- **Output:** Users can upload a 15s video loop; plays in `FullProfileModal`; `🎥` badge on
  `SwipeCard`; no autoplay in discovery; tsc clean
- **Reasoning Level:** High

---

## 📍 PHASE 3C: Events & Community
### Tasks 78–80

---

### Task 78 — Google Places Gym Search Service
- **File(s):** `services/places.ts` (new)
- **Dependencies:** `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` in `.env` (Pre-flight Step A)
- **Action:**
  - `services/places.ts` — typed HTTP client for the Google Places API (New). Never use `any`.
    Define all API response shapes as local interfaces inside this file:
    ```typescript
    interface NearbySearchResponse { places: PlaceResult[] }
    interface PlaceResult {
      id: string
      displayName: { text: string }
      formattedAddress: string
      location: { latitude: number; longitude: number }
      rating?: number
      photos?: Array<{ name: string }>
    }
    ```
  - `searchNearbyGyms(coords: { latitude: number; longitude: number }, radiusMeters: number): Promise<GymPlace[]>`:
    - `POST https://places.googleapis.com/v1/places:searchNearby`
    - Headers:
      - `X-Goog-Api-Key: ${process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY}`
      - `X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.photos`
    - Body:
      ```json
      {
        "includedTypes": ["gym", "fitness_center", "sports_complex"],
        "locationRestriction": {
          "circle": {
            "center": { "latitude": ..., "longitude": ... },
            "radius": radiusMeters
          }
        },
        "maxResultCount": 10
      }
      ```
    - Map results to `GymPlace[]` (from `types/checkin.ts`)
  - `getPlacePhotoUrl(photoName: string, maxWidth: number): string`:
    - Returns `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${API_KEY}`
    - Pure string construction — no fetch needed
  - Add `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY` to `.env.example`
- **Constraints:** Client API key only. Never pass this key to Cloud Functions — a
  separate unrestricted server key would be needed for server-side lookups, which is out
  of scope for Phase 3.
- **Output:** `places.searchNearbyGyms()` compiles and returns `GymPlace[]`; tsc clean
- **Reasoning Level:** Low

---

### Task 79 — Gym Check-In Feature
- **File(s):** `functions/src/createCheckin.ts` (new), `store/checkinStore.ts` (new),
  `app/checkin/GymCheckinScreen.tsx` (new), `components/checkin/GymSearchList.tsx` (new),
  `components/checkin/ActiveCheckinBanner.tsx` (new), `app/profile/ProfileScreen.tsx`,
  `components/discovery/SwipeCard.tsx`, `app/navigation/MainTabNavigator.tsx`,
  `functions/src/index.ts`, `firestore.rules`
- **Dependencies:** Task 78 (`services/places.ts` must exist and export `searchNearbyGyms`);
  Task 70 (`types/checkin.ts` must export `GymCheckin` and `GymPlace`)
- **Action:**
  - Install: `npx expo install expo-location`
  - `functions/src/createCheckin.ts` — 2nd gen callable (`asia-southeast1`):
    - Accept `{ placeId: string; gymName: string; latitude: number; longitude: number; city: string }`
    - Auth check
    - Check for an existing active check-in: query `/gymCheckins` where
      `userId == uid AND expiresAt > now`; if found, throw
      `HttpsError('already-exists', 'already-checked-in')`
    - Write `/gymCheckins/{auto-id}`:
      ```
      userId, placeId, gymName,
      coordinates: new admin.firestore.GeoPoint(latitude, longitude),
      city,
      checkedInAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromMillis(Date.now() + 2 * 60 * 60 * 1000)
      ```
    - Also write `users/{uid}.gymCheckin: { gymName, expiresAt }` in the same batch
      (denormalised for SwipeCard reads without extra collection query)
    - Return `{ checkinId: string; expiresAt: Timestamp }`
    - Export from `functions/src/index.ts`
  - `store/checkinStore.ts` — Zustand store, **not persisted**:
    - State: `activeCheckin: GymCheckin | null`, `isLoading: boolean`
    - `subscribeToActiveCheckin(uid: string)`: Firestore `onSnapshot` on `/gymCheckins`
      where `userId == uid AND expiresAt > Timestamp.now()`; updates `activeCheckin`;
      returns unsubscribe function
    - `unsubscribeFromActiveCheckin()`: calls stored unsubscribe
    - `checkIn(gym: GymPlace): Promise<void>`: calls `createCheckin` Cloud Function
    - `checkOut(): Promise<void>`: `deleteDoc` on `activeCheckin` document; also clears
      `users/{uid}.gymCheckin` via `updateDoc` with `FieldValue.delete()`
  - `components/checkin/GymSearchList.tsx` — named export `FlatList`:
    - Props: `gyms: GymPlace[]`, `onSelect: (gym: GymPlace) => void`, `isLoading: boolean`
    - Each row: `fitness-outline` Ionicons icon, name bold, address gray, optional rating
  - `app/checkin/GymCheckinScreen.tsx` — default export screen:
    - On mount: request foreground location permission via `expo-location`;
      call `places.searchNearbyGyms(coords, 2000)` on permission grant
    - Search bar filters `GymSearchList` client-side by name
    - Tap gym → `Alert.alert` confirm → `checkinStore.checkIn(gym)` →
      `navigation.goBack()` + toast `t('checkin.success', { gymName })`
    - If already checked in: `Alert` showing current gym + "Check Out" option
  - `components/checkin/ActiveCheckinBanner.tsx` — named export compact banner:
    - Props: `checkin: GymCheckin`, `onCheckOut: () => void`
    - Shows gym name, live countdown (`Xh Ym remaining` via `setInterval` every 60s in
      local state), "Check Out" button
  - `app/profile/ProfileScreen.tsx`:
    - Call `checkinStore.subscribeToActiveCheckin(uid)` in `useEffect` on mount;
      call `checkinStore.unsubscribeFromActiveCheckin()` in cleanup
    - Render `<ActiveCheckinBanner>` above "Check In" row when `activeCheckin != null`
    - Add "📍 Check In to a Gym" tappable row below `TodayActivityCard` →
      `navigation.navigate('GymCheckin')`
  - `MainTabNavigator.tsx`:
    - `GymCheckin` is a screen within the Profile stack (not a new tab)
    - Add to `ProfileStackParamList` and register as a screen
  - `components/discovery/SwipeCard.tsx`:
    - Read `user.gymCheckin`; if present and `expiresAt.toMillis() > Date.now()`: show
      `"📍 At gym"` chip badge in the activity badges row
  - `firestore.rules`:
    - `/gymCheckins/{id}`: Admin SDK creates (bypasses rules); owner can read and delete;
      no client create; no client update
    - `/gymCheckins/{id}` read: `request.auth.uid == resource.data.userId`
    - `/gymCheckins/{id}` delete: `request.auth.uid == resource.data.userId`
  - Add i18n keys: `checkin.title`, `checkin.success`, `checkin.alreadyCheckedIn`,
    `checkin.confirmTitle`, `checkin.confirmMessage`, `checkin.checkOut`,
    `checkin.banner.remaining` to all 4 language files
  - Run `npm --prefix functions run build` — zero errors
- **Output:** Gym check-in works end to end; active check-in shown on profile and SwipeCard;
  check-out removes the doc; 2-hour expiry automatic via `expiresAt` field
- **Reasoning Level:** Extra High

---

### Task 80 — Workout Events: Create & Discover
- **File(s):** `functions/src/createEvent.ts` (new), `functions/src/rsvpEvent.ts` (new),
  `store/eventsStore.ts` (new), `app/events/EventsScreen.tsx` (new),
  `app/events/CreateEventScreen.tsx` (new), `app/events/EventDetailScreen.tsx` (new),
  `components/events/EventCard.tsx` (new), `app/navigation/MainTabNavigator.tsx`,
  `functions/src/index.ts`, `firestore.rules`, `firestore.indexes.json`
- **Dependencies:** Task 70 (`types/event.ts` must export `FitlinkEvent`, `EventLocation`,
  `EventRSVPStatus`); Task 79 is independent but both touch `MainTabNavigator.tsx` — if
  both are being done in sequence, generate Task 80 prompt after Task 79 CHANGELOG is confirmed
- **Conflict risk:** `MainTabNavigator.tsx` — also modified by Task 79. Verify Task 79
  changes are present before touching this file.
- **Action:**
  - `functions/src/createEvent.ts` — 2nd gen callable (`asia-southeast1`):
    - Auth check
    - Accept all `FitlinkEvent` fields except `creatorId`, `attendees`, `createdAt`, `cancelled`
    - Validate: `startAt > Date.now()`, `endAt > startAt`, `title.length >= 5`
    - Write `/events/{auto-id}`:
      `creatorId: uid`, `attendees: [uid]`, `cancelled: false`,
      `createdAt: FieldValue.serverTimestamp()`
    - Return `{ eventId: string }`
    - Export from `functions/src/index.ts`
  - `functions/src/rsvpEvent.ts` — 2nd gen callable (`asia-southeast1`):
    - Accept `{ eventId: string; action: 'join' | 'leave' }`
    - Auth check
    - Read event; verify `cancelled === false`
    - For `'join'`: verify `maxAttendees == null || attendees.length < maxAttendees`
    - `FieldValue.arrayUnion(uid)` / `FieldValue.arrayRemove(uid)`
    - Return `{ attendees: string[] }`
    - Export from `functions/src/index.ts`
  - `store/eventsStore.ts` — Zustand, not persisted:
    - State: `upcomingEvents: FitlinkEvent[]`, `myEvents: FitlinkEvent[]`, `isLoading: boolean`
    - `fetchUpcomingEvents(city: string)`: query `/events` — `city == city`,
      `cancelled == false`, `startAt > Timestamp.now()`, order `startAt ASC`, limit 20
    - `fetchMyEvents(uid: string)`: query `attendees array-contains uid`, order `startAt ASC`
    - `createEvent(data): Promise<string>`: calls CF, returns `eventId`
    - `rsvp(eventId: string, action: 'join' | 'leave'): Promise<void>`: calls CF;
      optimistically updates `upcomingEvents` and `myEvents` arrays locally
  - `components/events/EventCard.tsx` — named export:
    - Activity type icon (map activity name → Ionicons icon, e.g. `barbell-outline` for Gym,
      `bicycle-outline` for Cycling) + gradient card
    - Title, formatted date/time (`DD MMM, HH:mm`), location name, attendee count,
      RSVP status pill ("Attending" in green / "Join" in primary)
    - Tap → navigate to `EventDetail`
  - `app/events/EventsScreen.tsx` — default export:
    - Two tabs: "Discover" (upcoming by city) and "My Events" (joined or created)
    - Pull-to-refresh each tab
    - Floating "+" FAB (bottom-right, `add-circle` Ionicons, `colors.primary`) →
      `navigation.navigate('CreateEvent')`
    - Empty states per tab with CTAs
  - `app/events/CreateEventScreen.tsx` — default export:
    - React Hook Form + Zod: `title` (min 5), `description`, `activityType` (`SingleSelect`
      reusing onboarding chip component), `locationName` + `locationAddress` + `placeId`
      (text input + Google Places autocomplete using `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY`),
      `startAt` (date/time picker), `endAt` (date/time picker, must be > startAt),
      `maxAttendees` (optional numeric input, blank = unlimited)
    - Submit → `eventsStore.createEvent()` → success toast → `navigation.goBack()`
  - `app/events/EventDetailScreen.tsx` — default export:
    - Full event info; attendee avatar row (first 5 via `getUserProfile()`)
    - RSVP button: "Join Event" / "Leave Event" / "Event Full" (disabled if full)
    - Creator only: "Cancel Event" button → `Alert` confirm →
      `updateDoc(eventRef, { cancelled: true })`
    - Share: `Share.share({ message: t('events.shareMessage', { title, link: 'fitlink://events/' + eventId }) })`
  - `app/navigation/MainTabNavigator.tsx`:
    - Add **Events** as 5th bottom tab between Matches and Profile
    - Icon: `calendar-outline` (Ionicons), active: `calendar`
    - Create `EventsStackNavigator` (screens: `Events`, `CreateEvent`, `EventDetail`)
    - Update `MainTabParamList` type to include `Events`
  - `firestore.rules`:
    - `/events/{id}`:
      - `allow read: if request.auth != null;`
      - Create: deny (CF only)
      - Update: `request.auth.uid == resource.data.creatorId` AND
        `request.resource.data.keys().hasOnly(['title', 'description', 'maxAttendees', 'cancelled'])`
      - Delete: deny
    - `/gymCheckins` rules already added in Task 79 — do not duplicate
  - `firestore.indexes.json` — add:
    - `/events`: `(city ASC, cancelled ASC, startAt ASC)`
    - `/events`: `(attendees ARRAY_CONTAINS, startAt ASC)`
  - Add i18n keys: `events.*` to all 4 language files
  - Run `npm --prefix functions run build` — zero errors
- **Output:** Events tab in navigation; create/discover/RSVP all work; cancel works for
  creator; indexes ready; tsc and functions build clean
- **Reasoning Level:** Extra High

---

## 🌏 PHASE 3D: SEA Expansion & Infrastructure
### Tasks 81–88

---

### Task 81 — SEA Expansion: Singapore & Thailand Regions
- **File(s):** `constants/regions.ts` (new), `app/onboarding/Step1Screen.tsx`,
  `store/onboardingStore.ts`, `services/firebase/firestore.ts`,
  `services/stripe.ts`, `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json`
- **Dependencies:** Task 70 (`timezone` field must exist in `types/user.ts`)
- **Action:**
  - `constants/regions.ts` — new file:
    ```typescript
    export const SUPPORTED_COUNTRIES = ['Malaysia', 'Singapore', 'Thailand'] as const
    export type SupportedCountry = typeof SUPPORTED_COUNTRIES[number]

    export const COUNTRY_TIMEZONES: Record<SupportedCountry, string> = {
      Malaysia:  'Asia/Kuala_Lumpur',
      Singapore: 'Asia/Singapore',
      Thailand:  'Asia/Bangkok',
    }

    export const SEA_CITIES: Record<SupportedCountry, string[]> = {
      Malaysia:  ['Kuala Lumpur', 'Selangor', 'Penang', 'Johor Bahru', 'Ipoh',
                  'Melaka', 'Kota Kinabalu', 'Kuching', 'Kuantan', 'Alor Setar'],
      Singapore: ['Central', 'East', 'North', 'South', 'West'],
      Thailand:  ['Bangkok', 'Chiang Mai', 'Phuket', 'Pattaya', 'Hat Yai'],
    }
    ```
  - `store/onboardingStore.ts`:
    - Add `country: string` and `timezone: string` to `OnboardingDraft`
    - Default: `country: 'Malaysia'`, `timezone: 'Asia/Kuala_Lumpur'`
  - `app/onboarding/Step1Screen.tsx`:
    - Replace the existing city-only field with a two-level flow:
      1. Country `SingleSelect`: Malaysia / Singapore / Thailand
      2. City `SingleSelect` populated from `SEA_CITIES[selectedCountry]`
    - On country selection: auto-set `onboardingStore.draft.timezone` from `COUNTRY_TIMEZONES`
    - Auto-detect timezone on screen mount:
      `const detectedTz = Intl.DateTimeFormat().resolvedOptions().timeZone` and pre-select
      the matching country if found
    - Store both `country` and `city` in `onboardingStore`
  - `services/firebase/firestore.ts` `createUserProfile()`:
    - Accept and write `timezone` and `country` from the profile data
  - `services/stripe.ts` `getStripePrices()`:
    - Verify Thailand (`THB`) pricing is present per PRD Section 5.12; add if missing
    - Verify Singapore (`SGD`) pricing is present; add if missing
  - i18n files:
    - Add `onboarding.step1.country.label`, `onboarding.step1.country.placeholder`
    - Add region display keys for Thailand cities (English values as placeholders in my/zh/ta)
- **Output:** New users can register with SG or TH city; `timezone` written to Firestore;
  Stripe pricing exists for SGD and THB; tsc clean
- **Reasoning Level:** Medium

---

### Task 82 — Per-User Timezone Daily Resets
- **File(s):** `functions/src/recordSwipe.ts`, `functions/src/verifyProfilePhoto.ts`
- **Dependencies:** Task 81 (`timezone` field must be written to Firestore for new users)
- **Context:** Both functions contain `getNextMidnightMs()` with a UTC+8 hardcode. Now that
  `timezone` is written to the user doc (Task 81), this can be resolved properly.
- **Conflict risk:** `recordSwipe.ts` — also modified in Task 72 (rewind direction union).
  If Task 72 is complete, the `'rewind'` direction must not be removed.
- **Action:**
  - In both `recordSwipe.ts` and `verifyProfilePhoto.ts`, replace the hardcoded
    `getNextMidnightMs()` with:
    ```typescript
    async function getNextMidnightMs(uid: string): Promise<number> {
      const userDoc = await admin.firestore().doc(`users/${uid}`).get()
      const timezone: string = userDoc.data()?.timezone ?? 'Asia/Kuala_Lumpur'

      const now = new Date()
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      const localDateStr = formatter.format(now) // "2026-06-07"
      const [year, month, day] = localDateStr.split('-').map(Number)

      const nextMidnightLocal = new Date(year, month - 1, day + 1)
      const utcOffset = now.getTime() - Date.UTC(
        now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
        now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()
      )
      return nextMidnightLocal.getTime() - utcOffset
    }
    ```
  - Update all callers to `await getNextMidnightMs(uid)` (it is now async due to the Firestore read)
  - Fall back to `'Asia/Kuala_Lumpur'` if `timezone` field is absent (covers existing users
    who signed up before Task 81)
  - Run `npm --prefix functions run build` — zero errors
- **Output:** Daily like and verification attempt resets fire at the user's actual local midnight;
  UTC+8 hardcode removed from both functions
- **Reasoning Level:** Medium

---

### Task 83 — Background `lastActive` Updates (iOS)
- **File(s):** `app.json`, `hooks/useLastActive.ts`, `services/firebase/firestore.ts`,
  `store/authStore.ts`, `BUILD.md`
- **Dependencies:** `updateLastActive()` — either extracted already or extracted in this task
- **Action:**
  - Install: `npx expo install expo-background-fetch expo-task-manager`
  - `app.json` — add to `ios.infoPlist`:
    ```json
    "UIBackgroundModes": ["fetch", "remote-notification"]
    ```
  - `services/firebase/firestore.ts`:
    - Extract the `lastActive` write into a standalone named export:
      ```typescript
      export const updateLastActive = async (uid: string): Promise<void> => {
        await updateDoc(doc(db, 'users', uid), { lastActive: serverTimestamp() })
      }
      ```
  - `store/authStore.ts`:
    - After successful login: `await AsyncStorage.setItem('fitlink-uid', uid)`
    - In `logout()`: `await AsyncStorage.removeItem('fitlink-uid')`
  - `hooks/useLastActive.ts`:
    - At **module scope** (outside the hook, at the top of the file):
      ```typescript
      const BACKGROUND_FETCH_TASK = 'fitlink-lastactive-fetch'

      TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
        try {
          const uid = await AsyncStorage.getItem('fitlink-uid')
          if (!uid) return BackgroundFetch.BackgroundFetchResult.NoData
          await updateLastActive(uid)
          return BackgroundFetch.BackgroundFetchResult.NewData
        } catch {
          return BackgroundFetch.BackgroundFetchResult.Failed
        }
      })
      ```
    - Inside hook body:
      ```typescript
      useEffect(() => {
        BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
          minimumInterval: 300,
          stopOnTerminate: false,
          startOnBoot: false,
        }).catch(() => {})  // intentional — Expo Go rejects silently
        return () => {
          BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK).catch(() => {})
        }
      }, [])
      ```
  - `BUILD.md`: document that background fetch requires a development build
- **Constraints:** `TaskManager.defineTask` at module scope — never inside hook body.
  Never import Zustand in the task callback. The silent `.catch(() => {})` is intentional.
- **Output:** `lastActive` updates in iOS background; `uid` persisted in AsyncStorage for
  the task; foreground heartbeat continues; tsc clean
- **Reasoning Level:** High

---

### Task 84 — Notification Badge Count & Granular Preferences
- **File(s):** `hooks/useNotifications.ts`, `store/authStore.ts`,
  `app/settings/SettingsScreen.tsx`, `functions/src/onNewMessage.ts`,
  `functions/src/recordSwipe.ts`, `firestore.rules`
- **Dependencies:** None blocking, but Task 83 (`authStore` changes) may conflict — verify
  Task 83 `AsyncStorage` additions are present before modifying `authStore.ts` here.
- **Conflict risk:** `recordSwipe.ts` — also modified in Tasks 72 and 82. Verify both
  previous changes are intact before adding the "liked me" push logic here.
- **Action:**
  - **App icon badge count:**
    - `hooks/useNotifications.ts`: on every `AppState` change to `'active'`:
      1. Compute total unread from `matchStore.matches`:
         `matches.reduce((sum, m) => sum + ((m as Record<string, unknown>)[uid + '_unread'] as number ?? 0), 0)`
      2. `Notifications.setBadgeCountAsync(totalUnread)`
    - `store/authStore.ts` `logout()`: call `Notifications.setBadgeCountAsync(0)`
  - **Notification preferences subcollection:**
    - Schema: `/users/{uid}/notificationPreferences/prefs`
    - `app/settings/SettingsScreen.tsx` notification toggles: also write to
      `/users/{uid}/notificationPreferences/prefs` via `setDoc(prefRef, { [key]: value }, { merge: true })`
    - On `SettingsScreen` mount: read current preferences from Firestore
  - **`functions/src/onNewMessage.ts`**:
    - Read `/users/{recipientId}/notificationPreferences/prefs`
    - If `prefs.newMessages === false`: skip push entirely
    - If doc absent: send push (default)
  - **"Someone liked you" push (Premium only):**
    - `functions/src/recordSwipe.ts`: after writing the like doc, when `direction !== 'rewind'`:
      1. Read `users/{targetId}.premium.active` and `users/{targetId}.expoPushToken`
      2. If `premium.active === true` and token exists:
         - Read `/users/{targetId}/notificationPreferences/prefs`
         - If `prefs.likedMe !== false`: send Expo push
  - `firestore.rules`:
    - `/users/{uid}/notificationPreferences/prefs`: owner read/write only
  - Run `npm --prefix functions run build` — zero errors
- **Output:** Badge count correct; resets to 0 on logout; notification preferences respected
- **Reasoning Level:** High

---

### Task 85 — Strava Disconnect Cleanup Cloud Function
- **File(s):** `functions/src/onStravaDisconnected.ts` (new),
  `functions/src/utils/crypto.ts` (new if not existing),
  `functions/src/index.ts`, `services/strava.ts`
- **Dependencies:** None
- **Context:** Phase 2 Task 60 noted: "Strava token cleanup on disconnect deferred to Phase 3."
- **Action:**
  - If `decryptToken`/`encryptToken` are duplicated across exchange and sync functions:
    extract into `functions/src/utils/crypto.ts` first.
  - `functions/src/onStravaDisconnected.ts` — 2nd gen `onDocumentUpdated` on `/users/{userId}`:
    - Guard: only proceed if `strava.connected` changed from `true` to `false`
    - Best-effort token revocation (swallow all errors):
      ```typescript
      try {
        const accessToken = decryptToken(encryptedAccessToken)
        await fetch('https://www.strava.com/oauth/deauthorize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `access_token=${accessToken}`,
        })
      } catch { /* swallow */ }
      ```
    - Hard-delete credential fields:
      ```typescript
      await admin.firestore().doc(`users/${userId}`).update({
        'fitnessTracking.strava.accessToken': FieldValue.delete(),
        'fitnessTracking.strava.refreshToken': FieldValue.delete(),
        'fitnessTracking.strava.expiresAt':    FieldValue.delete(),
      })
      ```
  - Export from `functions/src/index.ts`
  - Run `npm --prefix functions run build` — zero errors
- **Output:** Strava tokens revoked and credential fields deleted on disconnect; tsc clean
- **Reasoning Level:** High

---

### Task 86 — Admin Moderation Queue: Harden & Secure
- **File(s):** `functions/src/checkReportThreshold.ts`, `functions/src/moderatePhoto.ts`,
  `firestore.rules`, `firestore.indexes.json`
- **Dependencies:** None
- **Action:**
  - Audit `checkReportThreshold.ts`: add `status: 'pending'` to all `/admin_queue` writes
  - Audit `moderatePhoto.ts`: add `status: 'pending'` to all `/flags` writes
  - Add inline type interfaces in each CF file (not imported from `types/`)
  - `firestore.rules`:
    ```
    match /admin_queue/{docId} { allow read, write: if false; }
    match /flags/{docId}       { allow read, write: if false; }
    ```
  - `firestore.indexes.json`:
    - `/admin_queue`: `(status ASC, createdAt DESC)`
    - `/flags`: `(status ASC, createdAt DESC)`
  - Run `npm --prefix functions run build` — zero errors
- **Output:** Admin queue and flags explicitly secured; `status` on all writes; indexes ready
- **Reasoning Level:** Medium

---

### Task 87 — Phase 3 Firestore Security Rules Update
- **File(s):** `firestore.rules`
- **Dependencies:** Tasks 79, 80, 84, 85, 86 — all collections must be defined before rules
  are written. Verify in CHANGELOG before generating this prompt.
- **Action:** Extend existing Phase 1/2 rules — do not rewrite from scratch.
  - `/events/{id}` — read public, create CF-only, update creator-only (title/description/maxAttendees/cancelled), delete deny
  - `/gymCheckins/{id}` — read/delete owner only, create CF-only, update deny
  - `/users/{uid}/notificationPreferences/prefs` — owner read/write
  - `/users/{uid}` — update `doesNotModifyServerOnlyFields()` to add `boostExpiresAt`
  - Confirm `/admin_queue` and `/flags` deny rules from Task 86 are present
  - Run emulator probe: `firebase emulators:exec --only firestore "node -e \"process.exit(0)\""`
- **Output:** All Phase 3 collections secured; Phase 1/2 rules untouched
- **Reasoning Level:** Extra High

---

### Task 88 — Phase 3 Firestore Indexes
- **File(s):** `firestore.indexes.json`
- **Dependencies:** Task 87 (security rules should be correct before deploying indexes)
- **Action:** Add composite indexes — preserve all existing indexes:
  - `/events`: `(city ASC, cancelled ASC, startAt ASC)`
  - `/events`: `(attendees ARRAY_CONTAINS, startAt ASC)`
  - `/gymCheckins`: `(userId ASC, expiresAt DESC)`
  - `/gymCheckins`: `(city ASC, expiresAt DESC)`
  - Confirm `/admin_queue` and `/flags` indexes from Task 86 are present
  - Validate JSON:
    ```bash
    node -e "JSON.parse(require('fs').readFileSync('firestore.indexes.json','utf8')); console.log('valid')"
    ```
- **Output:** `firestore.indexes.json` valid; all Phase 3 indexes present; no duplicates
- **Reasoning Level:** Low

---

## ✅ PHASE 3 DONE CHECKLIST

Before declaring Phase 3 ready for SEA expansion:

**Deferred Premium Features**
- [ ] "Manage Subscription" opens real Stripe Customer Portal session (not static URL)
- [ ] Rewind restores last-swiped card for premium users; swipe doc deleted server-side
- [ ] Incognito mode hides Pro users from all discovery stacks
- [ ] Profile Boost adds score bonus for 30 minutes; cooldown enforced server-side
- [ ] Matches search filters by name, activity, and status for premium users

**Rich Media**
- [ ] Voice messages: hold-to-record, slide-to-cancel, send, playback with progress
- [ ] Video profile: upload max 15s/50MB, plays in `FullProfileModal`, `🎥` badge on `SwipeCard`
- [ ] No video autoplay in discovery (60fps preserved)

**Events & Community**
- [ ] Google Places gym search returns typed `GymPlace[]` results
- [ ] Gym check-in creates Firestore doc via Cloud Function; expires after 2 hours
- [ ] Check-out deletes the check-in doc and clears `users/{uid}.gymCheckin`
- [ ] "At gym" badge appears on `SwipeCard` for active check-ins
- [ ] Events tab is the 5th tab in bottom navigation
- [ ] Create, discover, and RSVP to workout events all work end-to-end
- [ ] Creator can cancel an event

**SEA Expansion**
- [ ] Singapore and Thailand available in onboarding country + city selection
- [ ] `timezone` written to Firestore for all new users
- [ ] Daily reset logic uses per-user IANA timezone; UTC+8 hardcode removed from both functions
- [ ] Stripe pricing present for SGD and THB

**Infrastructure**
- [ ] App icon badge count correct on foreground; resets to 0 on logout
- [ ] Notification preferences in Firestore respected by `onNewMessage` CF
- [ ] "Liked me" push delivered for premium users (does not reveal liker identity)
- [ ] Background `lastActive` registered on iOS; `uid` stored in AsyncStorage for task
- [ ] Strava tokens revoked and credential fields deleted on disconnect
- [ ] `/admin_queue` and `/flags` explicitly secured in Firestore rules
- [ ] `status: 'pending'` on all new admin queue and flags writes
- [ ] Phase 3 Firestore indexes deployed

**Code Quality**
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npm --prefix functions run build` — zero errors
- [ ] Zero `any` usage
- [ ] Zero `console.log` in client files
- [ ] All new strings through `t()` with entries in all 4 language files

---

## Deferred to Phase 4

- Admin moderation web dashboard (UI for reviewing `/admin_queue` and `/flags`)
- App Store `restorePurchases()` receipt validation
- RTL layout support (Arabic/Urdu)
- Philippines, Indonesia, Vietnam (SEA Tier 2)
- Improved face-matching ML model for `verifyProfilePhoto`
- Voice message transcription
- In-app video calling
- Live GPS workout tracking (real-time location sharing)
- Gym/workout-only partner discovery mode
- SEO / web landing pages

---

*TASKS_PHASE3.md — [APP_NAME] | June 2026*
*Generate TASKS_PHASE4.md after Phase 3 ships.*
*Phase 2 ended at Task 69. Unplanned remediation: Tasks 70–74 in git (not in spec). Phase 3 spec: Tasks 75–88 (14 tasks).*
