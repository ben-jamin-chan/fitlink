# CHANGELOG.md — [APP_NAME]

> Update this file at the end of every completed phase or significant implementation session. The Architect reads the latest entry to restore context at the start of each new session.

---

## [Phase 1D — Task 34] — 2026-05-20

### Completed

- Task 34: MatchCelebrationModal — confetti, animated photo pop-in, shared activities badge, Send Message → ChatScreen navigation, Keep Swiping dismiss

### Files Created / Modified

- components/discovery/MatchCelebrationModal.tsx: full celebration modal with Reanimated animation sequence, ConfettiCannon, icebreaker suggestion, queue-draining dismiss pattern
- app/discovery/DiscoveryScreen.tsx: modal wired to matchStore.newMatchIds, pendingMatch resolved, current user profile data passed into modal
- store/matchStore.ts: clearNewMatch(matchId) action added
- store/profileStore.ts: minimal read-only profile hydration added so DiscoveryScreen can pass current user photos and activities; Task 35 still owns full profile store actions
- services/firebase/realtime.ts: duplicate _unread increment removed from client message sends (now Cloud Function only)
- app/navigation/MainTabNavigator.tsx: Matches nested chat params accept optional icebreakerSuggestion
- i18n/*.json: discovery.matchCelebration.* keys added to all four locale files

### Packages Added

- react-native-confetti-cannon

### Architecture Decisions

- One modal at a time: newMatchIds[0] drives render; clearNewMatch shifts queue
- Dismiss animation gate: runOnJS(clearNewMatch) fires only after withTiming completes
- Confetti imperative ref + setTimeout: avoids firing before modal is visible
- currentUserActivities is passed from profileStore.profile.activities; no hardcoded empty activity list remains

### Known Issues / Deferred

- Icebreaker pre-fill in ChatScreen input not yet implemented; the navigation param is passed for future ChatScreen wiring
- Task 35 remains responsible for full profileStore capabilities: updateProfile, uploadPhoto, deletePhoto, and richer loading/error UX

### Next Up

- Task 35: ProfileStore — fetchProfile, updateProfile, uploadPhoto, deletePhoto

## [Phase 1D — Task 33] — 2026-05-19
### Completed
- Task 33: onNewMessage Cloud Function — push notification on new RTDB message

### Files Created / Modified
- functions/src/onNewMessage.ts: RTDB onValueCreated trigger (2nd gen), increments unread count, sends Expo push notification via fetch, validates token format, handles missing tokens gracefully
- functions/src/index.ts: export { onNewMessage } added
- firebase.json: Realtime Database rules configuration added
- database.rules.json: RTDB chat, metadata, and presence rules added for emulator/deploy config

### Architecture Decisions
- Unread increment separated from push send — always runs, push is best-effort
- Expo Push API used (not FCM direct) — correct for Expo-managed workflow
- DeviceNotRegistered cleanup deferred to Phase 2 maintenance function
- fetch used natively (Node 18) — no node-fetch dependency added

### Known Issues / Deferred
- DeviceNotRegistered token cleanup deferred (Phase 2)
- Notification badge count (iOS) not yet set — requires separate unread query
- Push notification delivery for matches (as opposed to messages) handled in Task 34 (match celebration)
- RTDB_INSTANCE must be set in each deployed functions environment
- Client RTDB send helpers currently also increment unread counts; remove that client-side increment when client files are in scope to avoid double counts

### Next Up
- Task 34: MatchCelebrationModal — confetti animation, both user photos, "Send Message" + "Keep Swiping" CTAs

## [Phase 4.4] — 2026-05-19
### Completed
- Task 32: ChatScreen built — real-time messages, MessageBubble, ChatInput, typing indicator, image send
- MessageBubble: sent/received variants, image support, timestamp, read receipts
- ChatInput: multiline auto-grow, image picker delegation to chatStore.sendImage, send button state
- ChatScreen: custom header, inverted FlatList, date separators, icebreaker chips, fullscreen image viewer, unmatch flow
- chat.uploading and other missing chat.* i18n keys added to all 4 language files
- AppState listener for flushOfflineQueue wired in ChatScreen
- Image upload driven by chatStore.sendImage internally — no storage changes in this task

### Files Created / Modified
- components/chat/MessageBubble.tsx: bubble variants, image thumbnail, timestamp, read receipts
- components/chat/ChatInput.tsx: multiline input, image button, send button
- app/chat/ChatScreen.tsx: full conversation screen with all Task 32 features
- app/navigation/MainTabNavigator.tsx: Chat placeholder replaced with ChatScreen
- i18n/en.json, my.json, zh.json, ta.json: chat.* keys completed

### Known Issues / Deferred
- "View Profile" from chat header menu is a stub — deferred to FullProfileModal Phase 2 integration
- "Report User" from chat header is a stub — wired in Task 38
- "Delete Message" from long press is a stub — RTDB delete deferred to Phase 2
- Pinch-to-zoom in fullscreen image viewer deferred to Phase 2
- Proper clipboard library (@react-native-clipboard/clipboard) deferred to Phase 2

### Next Up
- Task 33: Cloud Function onNewMessage (RTDB trigger → Expo push notification on new chat message)

## [Phase 4.3] — 2026-05-18
### Completed
- Task 31: Chat store and Firebase Realtime Database service layer built
- services/firebase/realtime.ts: subscribeToMessages, sendTextMessage, sendImageMessage, markMessagesAsRead, setTypingStatus, subscribeToTyping, registerPresence, setOffline, subscribeToPresence
- store/chatStore.ts: openChat, closeChat, sendMessage, sendImage, onTypingStart, markAsRead, flushOfflineQueue
- RTDBMessage, RTDBPresence, QueuedMessage types defined and exported
- Offline message queue via AsyncStorage (flush on foreground)
- Typing debounce (1 second)
- i18n chat.* namespace added to all 4 language files

### Files Created / Modified
- services/firebase/realtime.ts: full RTDB service layer
- store/chatStore.ts: chat session store with subscriptions, send, upload, queue
- i18n/en.json, my.json, zh.json, ta.json: chat.* keys added

### Known Issues / Deferred
- AppState listener for flushOfflineQueue not yet wired — Task 32 (ChatScreen) calls flushOfflineQueue on foreground
- ChatScreen, MessageBubble, ChatInput not yet built — Task 32
- RTDB security rules not yet set — Phase 2

### Next Up
- Task 32: ChatScreen + MessageBubble + ChatInput (UI layer consuming chatStore)

## [Phase 4.2] — 2026-05-17
### Completed
- Task 30: MatchesScreen built — 2-tab (Matches grid + Messages list), real-time from matchStore
- MatchCard component: photo, name, NEW badge, unread badge, online dot, verified badge, long-press action sheet
- MessageListItem component: avatar with online dot, name, message preview, relative timestamp, unread badge, swipe-to-unmatch
- MatchesNavigator (Stack) created to wrap MatchesScreen + Chat placeholder
- MainTabNavigator Matches tab wired to MatchesNavigator
- i18n matches.* keys confirmed / extended in all 4 language files

### Files Created / Modified
- components/chat/MatchCard.tsx: grid card component with badges and long-press actions
- components/chat/MessageListItem.tsx: list row with swipe-to-unmatch via PanResponder + Animated
- app/matches/MatchesScreen.tsx: tab switcher, grid, list, empty states, matchStore subscription
- app/navigation/MainTabNavigator.tsx: MatchesNavigator (stack) added, Chat placeholder registered
- i18n/en.json, my.json, zh.json, ta.json: matches.* keys confirmed / added

### Known Issues / Deferred
- Navigation to Chat uses placeholder screen — real ChatScreen built in Task 32
- "View Profile" in long-press action sheet is a no-op stub — wired when FullProfileModal accepts external trigger
- "Report" in long-press action sheet is a no-op stub — reporting service wired in Task 38

### Next Up
- Task 31: Chat Store (chatStore.ts, services/firebase/realtime.ts — RTDB subscription, send message, offline queue)

## [Phase 4.1] — 2026-05-17
### Completed
- Task 29: matchStore built — real-time Firestore listener, MatchWithProfile resolution, unmatch, markAsRead
- subscribeToMatches, deleteMatch, resetUnreadCount added to services/firebase/firestore.ts
- getUserProfile added to firestore.ts
- newMatchIds first-load suppression implemented
- i18n matches.* keys added to all 4 language files

### Files Created / Modified
- store/matchStore.ts: full match store, listener management, optimistic unmatch, unread reset
- services/firebase/firestore.ts: subscribeToMatches, deleteMatch, resetUnreadCount, getUserProfile added
- types/match.ts: id field and MatchWithProfile confirmed present; nullable lastMessage fields aligned with Cloud Function output
- i18n/en.json, my.json, zh.json, ta.json: matches.* namespace added

### Known Issues / Deferred
- subscribeToMatches not yet called from RootNavigator or hook — wired in Task 30 (MatchesScreen)
- unsubscribeFromMatches not yet called on sign-out — wired in Task 38 (SettingsScreen logout flow)
- MatchCelebrationModal (Task 34) reads newMatchIds — not yet built

### Next Up
- Task 30: MatchesScreen (grid + messages tabs, MatchCard, MessageListItem, real-time from matchStore)

## [Phase 3.7] — 2026-05-17
### Completed
- Task 28: FullProfileModal built — scrollable profile, photo carousel, shared interest highlights, action bar
- PhotoViewer component created — pinch-to-zoom, swipe-down to dismiss
- ProfileSection reusable section wrapper created
- ActivityBadge extended with 'shared' variant (highlighted shared activities)
- DiscoveryScreen handleInfo stub replaced with real modal wiring
- Report category sheet implemented (Firestore write stubbed, TODO Task 38)
- i18n profile.* keys added to all 4 language files

### Files Created / Modified
- components/discovery/FullProfileModal.tsx: full scrollable modal, photo carousel, sections, action bar, report sheet
- components/discovery/PhotoViewer.tsx: fullscreen viewer, pinch-to-zoom, swipe-down dismiss
- components/profile/ProfileSection.tsx: reusable titled section wrapper
- components/discovery/ActivityBadge.tsx: 'shared' variant added
- app/discovery/DiscoveryScreen.tsx: handleInfo stub replaced, FullProfileModal wired with modalProfile state
- i18n/en.json, my.json, zh.json, ta.json: profile.* namespace added

### Known Issues / Deferred
- Report Firestore write (addDoc to /reports) deferred to Task 38 (SettingsScreen reporting service)
- Distance display (X km away) shows city name only — geo-distance calculation deferred to Phase 2
- Pinch-to-zoom on card photos inside SwipeCard still not implemented — interaction model differs from modal
- Discovery currently passes `viewerProfile={null}` because `store/profileStore.ts` is not present in this repo state; shared-interest rendering is ready for callers that provide the viewer profile.

### Next Up
- Task 29: Match Store (Firestore real-time listener on /matches, MatchWithProfile type resolution, unmatch action)

## [Phase 3.6] — 2026-05-17
### Completed
- Task 27: DiscoveryScreen built — card stack orchestration, z-ordered rendering, gesture isolation
- ActionButtons component: 5 buttons, haptics, premium lock badge, disabled state
- EmptyState component: icon, copy, Refresh and Edit Preferences CTAs
- UpsellModal stub: trigger-aware headline, benefits list, Coming Soon alert on upgrade tap
- dailyLimitReached flag added to discoveryStore
- i18n keys added: discovery.empty.* and discovery.upsell.*
- MainTabNavigator Discover tab wired to real DiscoveryScreen

### Files Created / Modified
- components/discovery/ActionButtons.tsx: 5 action buttons, haptics, premium gate lock badge
- components/discovery/EmptyState.tsx: empty stack view with refresh CTA
- components/discovery/UpsellModal.tsx: presentational paywall stub, 3 trigger types
- app/discovery/DiscoveryScreen.tsx: card stack, swipe handlers, auto-refetch, upsell integration
- store/discoveryStore.ts: dailyLimitReached boolean added and swipe advancement ownership moved to DiscoveryScreen
- i18n/en.json, my.json, zh.json, ta.json: discovery.empty.* and discovery.upsell.* keys added
- app/navigation/MainTabNavigator.tsx: Discover tab placeholder replaced with DiscoveryScreen

### Known Issues / Deferred
- FullProfileModal (Task 28) not yet built — onTapInfo shows Alert stub with TODO comment
- Rewind action is no-op even for premium users — full undo stack deferred to Phase 2
- Edit Preferences button in EmptyState calls no-op stub — wired in Task 38 (SettingsScreen)
- UpsellModal onUpgrade shows Coming Soon alert only — Phase 2 wires to PremiumScreen
- Premium subscription state is not yet exposed by authStore/profileStore in this repo state, so DiscoveryScreen currently treats users as free tier until that store source exists

### Next Up
- Task 28: FullProfileModal (scrollable profile view, shared-interest highlights, photo fullscreen, like/pass/super like from modal)

## [Phase 3.5] — 2026-05-16
### Completed
- Task 26: SwipeCard component built (Reanimated 3, Gesture.Pan(), 60fps)
- ActivityBadge chip component created
- SwipeLabel overlay component created (LIKE/NOPE/SUPER, SharedValue-driven opacity)
- expo-linear-gradient installed and gradient overlay implemented
- Photo carousel with left/centre/right tap zones
- Haptics wired per swipe direction

### Files Created / Modified
- components/discovery/SwipeCard.tsx: full swipe card with gesture, animation, exit, layout
- components/discovery/SwipeLabel.tsx: LIKE/NOPE/SUPER labels driven by SharedValue opacity
- components/discovery/ActivityBadge.tsx: pill chip for activity and fitness level display
- package.json, package-lock.json: expo-linear-gradient installed
- i18n/en.json, my.json, zh.json, ta.json: discovery.swipe.* and activeNow/activeHoursAgo/activeDaysAgo keys added

### Known Issues / Deferred
- Actual GPS distance from viewer not shown — deferred to Phase 2; city name and lastActive shown instead
- Pinch-to-zoom on card photo deferred to FullProfileModal (Task 28)
- "Active today" badge from fitness tracker data deferred to Phase 2 (Strava/Health integration)

### Next Up
- Task 27: DiscoveryScreen (renders card stack, wires ActionButtons to discoveryStore, empty state, upsell modal stub)

## [Phase 3.4] — 2026-05-16
### Completed
- Task 25: Discovery Zustand store implemented (discoveryStore.ts)
- fetchStack calls getDiscoveryStack callable, resolves IDs to UserProfile objects
- swipeRight/swipeLeft/swipeSuperLike write to Firestore swipe subcollections
- Daily like limit enforced for free users (50 likes/day, reset at midnight)
- Auto-refetch signal (isRefetching) fires when stack drops to <= 3 cards
- getDailyLikesDoc and incrementDailyLikes added to services/firebase/firestore.ts

### Files Created / Modified
- store/discoveryStore.ts: full discovery store with all swipe actions and limit logic
- services/firebase/firestore.ts: getDailyLikesDoc, incrementDailyLikes added
- i18n/en.json, my.json, zh.json, ta.json: discovery.* keys added/confirmed

### Known Issues / Deferred
- advanceStack sets isRefetching:true as a signal; DiscoveryScreen (Task 27) must observe this flag and call fetchStack(userId) itself; the store does not auto-call fetchStack to avoid auth coupling
- Distance-based filtering still deferred (same as Task 23 note); city-level only in Phase 1
- score field still present in getDiscoveryStack response; strip before production

### Next Up
- Task 26: SwipeCard component (Reanimated 3, Gesture.Pan(), 60fps, LIKE/NOPE/SUPER labels, photo pagination dots)

## Format

```
## [Phase X.Y] — YYYY-MM-DD
### Completed
- List of what was built

### Files Created / Modified
- path/to/file.ts: description

### Schema Changes
- Any Firestore collection or field additions/changes

### Known Issues / Deferred
- Anything skipped or flagged for later

### Next Up
- What Phase X.Y+1 should tackle
```

## [Phase 3.3] — 2026-05-15
### Completed
- Task 24: Cloud Function onSwipeCreated implemented (2nd gen Firestore trigger, asia-southeast1)
- Mutual like detection: reads reverse swipe doc, creates match only if both sides exist
- matchId = [userId, targetId].sort().join('_') — canonical, consistent with future matchStore usage
- Idempotency guard prevents duplicate match creation on at-least-once redelivery
- Batch write atomically creates match doc + increments stats.matches on both user docs
- sendMatchNotifications stubbed with logger.info — full push implementation deferred to Task 33

### Files Created / Modified
- functions/src/onSwipeCreated.ts: onDocumentCreated trigger, mutual like check, idempotency guard, batch write, notification stub
- functions/src/index.ts: onSwipeCreated export added

### Known Issues / Deferred
- Push notifications to both matched users not yet sent — stub only; Task 33 (onNewMessage) will add Expo Push API calls
- No Firestore transaction used (batch is sufficient here because the idempotency guard handles the race condition window; a full transaction would be more robust for very high concurrency — revisit in Phase 2 if needed)

### Next Up
- Task 25: Discovery Zustand store (discoveryStore.ts — fetchStack callable, swipeRight, swipeLeft, swipeSuperLike, daily limit check, auto-refetch when stack < 3)

## [Phase 3.2] — 2026-05-15
### Completed
- Task 23: Cloud Function getDiscoveryStack implemented (2nd gen callable, asia-southeast1)
- Scoring algorithm from PRD.md Section 5.3 implemented: activities, fitness level, frequency, recency, premium, verified, diet, and lookingFor overlap
- Bidirectional age and gender filtering applied
- Exclusion set covers liked, passed, matched, and blocked users
- Composite Firestore index (location.city, banned, paused, lastActive DESC) confirmed in firestore.indexes.json

### Files Created / Modified
- functions/src/getDiscoveryStack.ts: callable function with local types, scoreCandidate, fetchExcludedIds, bidirectional age/gender checks
- functions/src/index.ts: added getDiscoveryStack export
- firestore.indexes.json: composite index for discovery query added

### Known Issues / Deferred
- score field included in response for debugging — strip before production launch
- lookingFor overlap scoring uses loaded caller and candidate arrays; this remains an unindexed field
- Distance-based filtering is not yet applied — city-level filtering is used in Phase 1; geo-distance filtering is deferred to Phase 2 using Geohash or a geo library
- If city population is small, QUERY_LIMIT=100 may exhaust available candidates quickly; expanding to country-level fallback is a Phase 2 enhancement

### Next Up
- Task 24: Cloud Function onSwipeCreated (Firestore trigger, mutual like detection, match document creation, stats increment)

## [Phase 3.1] — 2026-05-14
### Completed
- Task 22: Cloud Function onUserCreated implemented (2nd gen, asia-southeast1)
- functions/ package bootstrapped (Node.js 18, TypeScript strict, firebase-admin, firebase-functions v4)
- Age calculated server-side from dateOfBirth Timestamp — client never writes age
- Underage accounts (age < 18) auto-banned: banned=true, banReason="UNDERAGE", tokens revoked
- firebase.json updated with functions source configuration
- firestore.rules verified and tightened: age, banned, banReason, bannedAt, verified are server-only fields

### Files Created / Modified
- functions/package.json: Node.js 18, firebase-admin ^12, firebase-functions ^4, TypeScript dev deps
- functions/tsconfig.json: strict mode, commonjs, output to lib/
- functions/.eslintrc.js: TypeScript ESLint rules, no-explicit-any as error
- functions/src/index.ts: admin SDK init guard, exports onUserCreated
- functions/src/onUserCreated.ts: onDocumentCreated trigger, calculateAgeInYears, underage ban + token revoke
- firebase.json: functions block added
- firestore.rules: server-only field guards include age, banned, banReason, bannedAt, verified

### Schema Changes
- /users/{uid}.age: now populated by onUserCreated Cloud Function on document creation
- /users/{uid}.banReason: "UNDERAGE" set for auto-banned accounts
- /users/{uid}.bannedAt: Timestamp set on auto-ban

### Known Issues / Deferred
- onUserCreated fires on Firestore document create, not Firebase Auth onCreate — this means if Step 6 fails mid-write and no document is created, the function never fires; the client already guards this with LoadingOverlay + retry
- Token revocation is best-effort (wrapped in try/catch); the Firestore ban is the authoritative gate

### Next Up
- Task 23: Cloud Function getDiscoveryStack (HTTP callable, scoring algorithm, candidate filtering)

## [Phase 2.6] — 2026-05-14
### Completed
- Task 21: Onboarding Step 6 built (preferences, photo upload, Firestore profile write)
- services/firebase/storage.ts created (uploadProfilePhoto, uploadAllProfilePhotos, deleteProfilePhoto)
- services/firebase/firestore.ts created (createUserProfile, updateUserProfile)
- LoadingOverlay fully implemented
- OnboardingNavigator updated to use real Step6Screen
- Full onboarding flow is now end-to-end: Steps 1–6 complete, profile lands in Firestore

### Files Created / Modified
- services/firebase/storage.ts: sequential photo upload with per-photo and overall progress callbacks, deleteProfilePhoto
- services/firebase/firestore.ts: createUserProfile (safe defaults, age omitted), updateUserProfile
- app/onboarding/Step6Screen.tsx: lookingFor MultiSelect, genderPreference MultiSelect, age range dual sliders (min < max enforced), distance slider, submit with LoadingOverlay and sequential photo upload
- components/ui/LoadingOverlay.tsx: Modal-based overlay with ActivityIndicator and optional message text
- app/onboarding/OnboardingNavigator.tsx: Step6Screen placeholder replaced with real screen
- i18n/en.json, my.json, zh.json, ta.json: step6 and submit keys added
- firestore.rules, storage.rules: scoped user profile and photo upload rules added

### Schema Changes
- /users/{userId} document now being written by client at onboarding completion
- age field intentionally omitted from client write — awaiting onUserCreated Cloud Function (Task 22)
- religion field written conditionally (omitted when undefined/empty string)
- Firebase Storage writes now allowed only for the authenticated user's own profile photo path

### Known Issues / Deferred
- age field will be absent/0 on user documents until Task 22 (onUserCreated Cloud Function) is deployed
- Looking For / Gender Preference label↔value mapping is English-only; translation of chip labels deferred to native speaker review
- Location coordinates currently use a neutral GeoPoint placeholder because Step 1 only captures city/country; precise location capture remains deferred
- Drag-to-reorder photos deferred to Phase 2

### Next Up
- Task 22: Cloud Function onUserCreated (calculates age server-side from dateOfBirth, auto-bans under-18 accounts)

## [Phase 2.5] — 2026-05-13
### Completed
- Task 20: Onboarding Step 5 built (bio textarea, height slider, religion modal picker)
- Slider component created in components/ui/
- @react-native-community/slider installed
- OnboardingNavigator updated to use real Step5Screen

### Files Created / Modified
- components/ui/Slider.tsx: labelled RNSlider wrapper, primary tint, formatted value display
- app/onboarding/Step5Screen.tsx: bio (50-500 chars, live counter), height slider (140-220 cm, default 170), religion modal picker (optional, 7 options)
- app/onboarding/OnboardingNavigator.tsx: Step5Screen placeholder replaced with real screen
- store/onboardingStore.ts: confirmed bio, height, religion fields on OnboardingDraft
- i18n/en.json, my.json, zh.json, ta.json: step5 keys added

### Known Issues / Deferred
- Religion display strings are English placeholders in my/zh/ta - deferred to native speaker review
- Height field does not expose an imperial (ft/in) toggle - deferred to Phase 2 polish

### Next Up
- Task 21: Onboarding Step 6 - Preferences + Profile Submit (lookingFor, age range, distance, gender preference, Firebase photo upload, createUserProfile)

## [Phase 2.4] — 2026-05-13
### Completed
- Task 19: Onboarding Step 4 built (dietary preference, fitness goals, smoking, drinking)
- SingleSelect and MultiSelect reused from Task 18 without modification
- OnboardingNavigator updated to use real Step4Screen

### Files Created / Modified
- app/onboarding/Step4Screen.tsx: four lifestyle fields, enum mapping for smoking/drinking, pre-fill from draft, fixed button row
- app/onboarding/OnboardingNavigator.tsx: Step4Screen placeholder replaced with real screen
- store/onboardingStore.ts: OnboardingDraft already had dietaryPreference, fitnessGoals, smoking, drinking fields with correct types
- i18n/en.json, my.json, zh.json, ta.json: step4 keys added

### Known Issues / Deferred
- Display strings for smoking/drinking options ('No', 'Occasionally', 'Socially') are UI-only — mapped to enum values on save; translations deferred until native speaker review

### Next Up
- Task 20: Onboarding Step 5 — About You (bio textarea, height slider, religion dropdown, Slider component)

## [Phase 2.3] — 2026-05-12
### Completed
- Task 18: Onboarding Step 3 built (activities MultiSelect, fitness level, workout frequency)
- MultiSelect component created in components/ui/
- SingleSelect component created in components/ui/
- OnboardingNavigator updated to use real Step3Screen

### Files Created / Modified
- components/ui/MultiSelect.tsx: chip multi-select, min/max enforcement, primary colour selected state
- components/ui/SingleSelect.tsx: chip single-select, cannot deselect, same chip styles as MultiSelect
- app/onboarding/Step3Screen.tsx: activities (16 options, max 10), fitness level, frequency; Next disabled until all valid
- app/onboarding/OnboardingNavigator.tsx: Step3Screen placeholder replaced with real screen
- i18n/en.json, my.json, zh.json, ta.json: step3 keys added

### Known Issues / Deferred
- Display strings for fitness level ('Beginner' etc.) are mapped to FitnessLevel enum values on save — display translations deferred until native speaker review

### Next Up
- Task 19: Onboarding Step 4 — Lifestyle (diet, fitness goals, smoking, drinking)

## [Phase 2.2] — 2026-05-11
### Completed
- Task 17: Onboarding Step 2 built (photo selection, compression, grid)
- utils/imageUtils.ts created (compressImage, pickAndCompressImage)
- PhotoGrid component created in components/profile/
- OnboardingNavigator updated to use real Step2Screen

### Files Created / Modified
- utils/imageUtils.ts: compressImage (1080px, 80% quality), pickAndCompressImage (picker + compress)
- components/profile/PhotoGrid.tsx: 3-column grid, 6 slots, 3:4 ratio, Primary badge, remove button
- app/onboarding/Step2Screen.tsx: photo grid, min 2 photos required, saves local URIs to draft
- app/onboarding/OnboardingNavigator.tsx: Step2Screen placeholder replaced with real screen

### Known Issues / Deferred
- Photo upload to Firebase Storage deferred to Step 6 completion (Task 21)
- Drag-to-reorder photos deferred to Phase 2

### Next Up
- Task 18: Onboarding Step 3 — Fitness Profile (activities MultiSelect, fitness level, frequency)

## [Phase 2.1] — 2026-05-10
### Completed
- Task 16: Onboarding Step 1 built (firstName, dateOfBirth, gender, city)
- Installed @react-native-community/datetimepicker
- OnboardingNavigator updated to use real Step1Screen

### Files Created / Modified
- app/onboarding/Step1Screen.tsx: first name, DOB picker (iOS inline/Android dialog), gender chips, city input
- app/onboarding/OnboardingNavigator.tsx: Step1Screen placeholder replaced with real screen
- package.json: added @react-native-community/datetimepicker
- app.json: added datetimepicker Expo config plugin

### Next Up
- Task 17: Onboarding Step 2 — Photos (PhotoGrid, expo-image-picker, compression)

## [Phase 2.0] — 2026-05-10
### Completed
- Task 15: Onboarding shell built — OnboardingNavigator, ProgressDots, onboardingStore
- RootNavigator updated to use real OnboardingNavigator
- New users now land on Step 1 placeholder after authentication

### Files Created / Modified
- store/onboardingStore.ts: OnboardingDraft interface, draft + currentStep state, persisted
- components/ui/ProgressDots.tsx: 6 dots, active/completed/inactive states
- app/onboarding/OnboardingNavigator.tsx: stack with Step1–6 placeholders, shared OnboardingHeader
- app/navigation/RootNavigator.tsx: OnboardingPlaceholder replaced with OnboardingNavigator

### Next Up
- Task 16: Onboarding Step 1 — Basic Info (firstName, dateOfBirth, gender, city)

## [Phase 1.9] — 2026-05-10
### Completed
- Task 14: Email login and sign up screens built, Input component created
- All 5 auth screens are now real — AuthNavigator has zero placeholder components
- Authentication phase (Tasks 08–14) complete

### Files Created / Modified
- components/ui/Input.tsx: label, error, secureTextEntry with eye toggle, multiline support
- app/auth/EmailLoginScreen.tsx: RHF+Zod, signInWithEmail, inline errors, link to SignUp
- app/auth/SignUpScreen.tsx: RHF+Zod, signUpWithEmail, password strength, confirm match
- app/navigation/AuthNavigator.tsx: EmailLoginPlaceholder and SignUpPlaceholder removed

### Next Up
- Task 15: Onboarding shell — OnboardingNavigator, ProgressDots, onboardingStore

## [Phase 1.8] — 2026-05-10
### Completed
- Task 13: OTP verify screen built, OTPInput component created
- Full phone auth flow end-to-end: Phone → OTP → main app (Discover tab)
- AuthNavigator updated to use real OTPVerifyScreen

### Files Created / Modified
- components/ui/OTPInput.tsx: 6-box input, auto-advance, backspace, paste support, auto-submit
- app/auth/OTPVerifyScreen.tsx: auto-verify on completion, resend with countdown, error clears boxes
- app/navigation/AuthNavigator.tsx: OTPVerifyPlaceholder replaced with OTPVerifyScreen

### Next Up
- Task 14: Email login + sign up screens + Input component

## [Phase 1.7] — 2026-05-09
### Completed
- Task 12: Phone login screen built, PhoneInput component created
- services/firebase/auth.ts: added setPendingConfirmation/getPendingConfirmation for ConfirmationResult handoff
- AuthNavigator updated to use real PhoneLoginScreen

### Files Created / Modified
- components/ui/PhoneInput.tsx: country code picker (9 SEA+global codes), phone field, error state
- app/auth/PhoneLoginScreen.tsx: RHF+Zod, sendOTP, 5-attempt lockout with countdown
- services/firebase/auth.ts: module-level ConfirmationResult store (3 new exports)
- app/navigation/AuthNavigator.tsx: PhoneLoginPlaceholder replaced with PhoneLoginScreen

### Known Issues / Deferred
- sendOTP in Expo Go requires test phone numbers in Firebase Console (no reCAPTCHA yet)
- Add test number: Firebase Console → Authentication → Sign-in method → Phone → Test numbers

### Next Up
- Task 13: OTP verify screen + OTPInput component

## [Phase 1.6] — 2026-05-08
### Completed
- Task 11: Landing screen built, Button component created
- AuthNavigator updated to use real LandingScreen

### Files Created / Modified
- components/ui/Button.tsx: primary/outline/ghost variants, loading and disabled states
- app/auth/LandingScreen.tsx: logo, tagline, auth buttons (Apple iOS-only), terms
- app/navigation/AuthNavigator.tsx: LandingPlaceholder replaced with LandingScreen

### Next Up
- Task 12: Phone login screen + PhoneInput component

## [Phase 1.5] — 2026-05-07
### Completed
- Task 10: authStore fully implemented — replaces stub
- Firebase onAuthStateChanged wired via initialise() called in App.tsx
- AsyncStorage persistence for isAuthenticated and hasCompletedOnboarding
- Navigation now reacts automatically to auth state changes

### Files Created / Modified
- store/authStore.ts: full rewrite with persist middleware, initialise(), logout()
- App.tsx: added useEffect to call initialise() and wire cleanup

### Next Up
- Task 11: Landing screen + Button component

## [Phase 1.4] — 2026-05-06
### Completed
- Task 09: Auth service layer created (sendOTP, verifyOTP, signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple stub, signOut, subscribeToAuthState)
- utils/errorUtils.ts created (mapFirebaseError returns i18n keys)

### Files Created / Modified
- services/firebase/auth.ts: all auth functions, AppError type
- utils/errorUtils.ts: mapFirebaseError, isFirebaseError, FIREBASE_ERROR_MAP

### Known Issues / Deferred
- signInWithGoogle uses signInWithPopup — works in Expo Go dev only, needs expo-auth-session for production (TODO comment added)
- signInWithApple is a stub — needs @invertase/react-native-apple-authentication and a development build
- Phone auth reCAPTCHA: use Firebase Console test phone numbers for now — production reCAPTCHA wired in Task 12

### Next Up
- Task 10: Auth Zustand store (full implementation — replaces stub, wires subscribeToAuthState, persists with AsyncStorage)

## [Phase 1.3] — 2026-05-05
### Completed
- Task 08: Navigation shell complete — RootNavigator, AuthNavigator, MainTabNavigator
- App.tsx rewritten with correct provider order (GestureHandlerRootView → SafeAreaProvider → NavigationContainer)
- authStore stub created for navigation gating
- All 5 auth screens and 4 main tab screens have placeholder components

### Files Created / Modified
- App.tsx: full rewrite with correct provider stack
- app/navigation/RootNavigator.tsx: root stack, auth gating logic
- app/navigation/AuthNavigator.tsx: stack navigator for auth screens
- app/navigation/MainTabNavigator.tsx: bottom tab navigator with Ionicons
- store/authStore.ts: stub store (isAuthenticated, isLoading, hasCompletedOnboarding)

### Known Issues / Deferred
- `npx expo start --offline` still fails before Metro boots because `/opt/homebrew/bin/node` is Node.js v23.11.0 and Expo CLI hits `ERR_SOCKET_BAD_PORT`; `npx tsc --noEmit` passes.

### Next Up
- Task 09: Auth service layer (signInWithPhone, verifyOTP, signInWithEmail, signOut)
- Prerequisite for Task 09: populate .env with Firebase values, add GoogleService-Info.plist and google-services.json

---

## [Phase 1.2] — 2026-05-03
### Completed
- Task 06: Firebase config initialised, .env.example created, secrets gitignored
- Task 07: i18n initialised with expo-localization, 4 language files seeded (EN, MY, ZH, TA)

### Files Created / Modified
- `services/firebase/config.ts`: Firebase app init with auth, db, storage, rtdb exports
- `.env.example`: 7 Firebase env var keys, all empty
- `.gitignore`: added .env, GoogleService-Info.plist, google-services.json
- `i18n/index.ts`: i18next init with device locale detection
- `i18n/en.json`: full English translation file for all Phase 1 screens
- `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json`: placeholder translations (same as EN)
- `package.json`, `package-lock.json`, `app.json`: added expo-localization dependency/config plugin

### Known Issues / Deferred
- .env not yet populated — developer must copy .env.example → .env and fill in Firebase values before Task 09 (auth screens need live Firebase connection)
- GoogleService-Info.plist and google-services.json not yet added to project — needed for Task 09
- `npx expo start` still fails in this shell before Metro boots because `/opt/homebrew/bin/node` is Node.js v23.11.0 and Expo CLI hits `ERR_SOCKET_BAD_PORT`; `npx tsc --noEmit` passes.

### Next Up
- Task 08: Navigation shell (RootNavigator, AuthNavigator, MainTabNavigator, GestureHandlerRootView)

## [Phase 1.1] — 2026-05-03

### Completed
- Path alias configured (`@/` → project root)
- Task 04: TypeScript types created (user, match, message, subscription)
- Task 05: Theme system created (colors, spacing, typography, theme re-export)

### Files Created / Modified
- `tsconfig.json`: added baseUrl and paths for `@/` alias
- `babel.config.js`: added module-resolver plugin and reanimated plugin
- `types/user.ts`, `types/match.ts`, `types/message.ts`, `types/subscription.ts`
- `constants/colors.ts`, `constants/spacing.ts`, `constants/typography.ts`, `constants/theme.ts`

### Schema Changes
- No Firestore schema changes; TypeScript interfaces now mirror the existing ARCHITECT.md schema.

### Known Issues / Deferred
- `npx expo start` currently fails before Metro boots with Expo CLI `ERR_SOCKET_BAD_PORT` under Node.js v23.11.0; `npx tsc --noEmit` passes.
- Pre-existing scaffold hardcoded color values remain in `App.tsx` and `app.json`; they were not changed because Tasks 04–05 explicitly scoped edits away from earlier files.

### Next Up
- Task 06: Firebase config setup
- Task 07: i18n setup

## [Phase 0.1] — April 2026

### Completed
- Full document audit and revision session (claude.ai)
- ARCHITECT.md revised: fixed swipe schema conflict (subcollection structure), added missing user fields (`paused`, `banned`, `expoPushToken`, `reportedBy`), updated workflow section for Codex-specific flow, added `AGENTS.md` to file structure
- TASKS.md revised: fixed Expo init command, added Firebase manual pre-flight section, added AGENTS.md creation to Task 03, added `app/navigation/` to folder structure, fixed Task 08 to require `GestureHandlerRootView` at root from the start, corrected task count to 46
- CHANGELOG.md revised: updated format
- PRD.md: pending surgical fixes (see Known Issues below) — not regenerated due to length

### Files Created / Modified
- `ARCHITECT.md`: Schema fix, missing fields, workflow update, AGENTS.md reference
- `TASKS.md`: Pre-flight section, Task 01 command fix, Task 03 AGENTS.md creation, Task 08 provider order fix, task numbering corrected to 46
- `CHANGELOG.md`: This entry

### Schema Changes
- Swipe schema clarified: subcollection structure `/swipes/{userId}/likes/{targetId}` is canonical (not flat `/swipes/{swipeId}`)
- Added to `/users/{userId}` schema: `paused: boolean`, `banned: boolean`, `expoPushToken?: string`
- Added `/reports/{reportId}` collection to schema

<!-- ### Known Issues / Deferred 
- **PRD.md needs these surgical edits (apply manually or in next Architect session):**
  1. Section 7.1: Replace "Full schema already detailed in Epic 2, 3, 4 requirements above" with the actual canonical schema from ARCHITECT.md
  2. Section 5.5 FR-2.3.1: Swipe path in example code is already correct (`/swipes/{userId}/likes/{targetUserId}`) — ARCHITECT.md was the one that was wrong (now fixed)
  3. Section 10.2: Remove references to "Fitafy research document (provided)" and "TeamUp research document (provided)" — these files don't exist
  4. Add `paused`, `banned`, `expoPushToken` fields to wherever user schema appears in PRD
- **App name not yet decided** — `[APP_NAME]` placeholder used throughout all docs. Do a global find-and-replace when name is locked.kjdkjasdnbaksjdbaksfhbaskdfnjbasdhjkadknasdbk
- **AGENTS.md** is created by Task 03 in TASKS.md — it does not exist until then. -->

### Next Up
- Pre-flight: Firebase project setup (manual — browser steps in TASKS.md)
- Task 01: Initialize Expo project
- Task 02: Install Phase 1 dependencies
- Task 03: Create folder structure + AGENTS.md
