# CHANGELOG.md — [APP_NAME]

> Update this file at the end of every completed phase or significant implementation session. The Architect reads the latest entry to restore context at the start of each new session.

---

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
