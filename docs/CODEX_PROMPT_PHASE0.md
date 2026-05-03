# CODEX PROMPT — Phase 0 Scaffold (Tasks 01–03)

> Paste this entire prompt into Codex in Cursor to begin the project.
> Do NOT execute until you have completed the Firebase Pre-flight steps in TASKS.md.

---

## Context

You are implementing [APP_NAME] — a fitness-focused dating and social networking app for Malaysia and SEA.
Stack: React Native + Expo SDK 52+, TypeScript strict mode, Firebase backend.
This is a brand-new empty folder. Nothing exists yet.

Read ARCHITECT.md and TASKS.md before doing anything. They are your source of truth.

---

## Session Goal

Complete Tasks 01, 02, and 03 in sequence. Do not proceed to Task 04 in this session.
Commit after each task is verified working.

---

## Task 01 — Initialize Expo Project

Run:
```bash
npx create-expo-app@latest [app-name] --template blank-typescript
cd [app-name]
```

Then update `tsconfig.json` to:
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

Verify: `npx expo start` boots on simulator.

Acceptance criteria: app loads, `tsc --noEmit` zero errors.
Commit: `git commit -m "task-01: initialize expo project with strict typescript"`

---

## Task 02 — Install All Phase 1 Dependencies

Run:
```bash
npx expo install \
  @react-navigation/native \
  @react-navigation/stack \
  @react-navigation/bottom-tabs \
  react-native-screens \
  react-native-safe-area-context \
  react-native-gesture-handler \
  react-native-reanimated \
  zustand \
  react-hook-form \
  @hookform/resolvers \
  zod \
  i18next \
  react-i18next \
  firebase \
  expo-image-picker \
  expo-image-manipulator \
  expo-local-authentication \
  expo-notifications \
  expo-haptics \
  @expo/vector-icons \
  @react-native-async-storage/async-storage

npm install --save-dev @types/i18next
```

Acceptance criteria: no peer dep conflicts, app still boots.
Commit: `git commit -m "task-02: install phase 1 dependencies"`

---

## Task 03 — Create Folder Structure and AGENTS.md

Part 1 — Create these folders with a .gitkeep file in each:

  app/auth/
  app/onboarding/
  app/discovery/
  app/matches/
  app/chat/
  app/profile/
  app/settings/
  app/navigation/
  components/ui/
  components/profile/
  components/discovery/
  components/chat/
  store/
  services/firebase/
  hooks/
  types/
  constants/
  utils/
  i18n/
  functions/src/

Part 2 — Create AGENTS.md in the project root with this content:

---AGENTS.md START---
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
---AGENTS.md END---

Acceptance criteria: 20 folders with .gitkeep, AGENTS.md in root.
Do not touch: App.tsx, package.json, tsconfig.json
Commit: `git commit -m "task-03: folder structure and AGENTS.md"`

---

## After This Session

Go to claude.ai. Paste ARCHITECT.md + latest CHANGELOG.md entry.
Ask: "Generate the Codex prompt for Tasks 04 and 05 (TypeScript types and theme system)."
