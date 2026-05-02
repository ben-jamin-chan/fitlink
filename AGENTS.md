# AGENTS.md — [APP_NAME]

You are Codex, the implementation agent for [APP_NAME] — a fitness dating and
social networking app for Malaysia and SEA built with React Native Expo.

## Non-negotiable rules
- TypeScript strict mode everywhere. Zero `any`. Zero type errors.
- No inline styles. All styling uses theme tokens from `constants/`.
- All user-facing strings go through i18next. No hardcoded text.
- Never write to Firestore from the client for: age, match creation, bans, subscriptions. Cloud Functions only.
- Swipe subcollection: `/swipes/{userId}/likes/{targetId}` and `/swipes/{userId}/passes/{targetId}` — never flatten.
- `GestureHandlerRootView` is the outermost wrapper in App.tsx. Never move it.
- No open Firestore security rules. Every new collection needs rules.

## Tech stack
- React Native + Expo SDK 52+, TypeScript strict
- React Navigation v6: Stack + Bottom Tabs
- Zustand, React Hook Form + Zod, Reanimated 3 (60fps)
- Firebase: Auth, Firestore (asia-southeast1), RTDB, Storage, Cloud Functions 2nd gen
- i18next: EN, MY, ZH, TA

## File naming
- Screens: PascalCase + Screen → LoginScreen.tsx
- Components: PascalCase → SwipeCard.tsx
- Stores: camelCase + Store → authStore.ts
- Services: camelCase → auth.ts, firestore.ts
- Types: PascalCase → UserProfile, Match

## Before every task
1. Read ARCHITECT.md for schema and constraints
2. Read CHANGELOG.md latest entry for current state
3. Only touch files listed in the current task
