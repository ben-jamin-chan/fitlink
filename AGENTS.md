# AGENTS.md — [APP_NAME]

You are Codex, the implementation agent for [APP_NAME] — a fitness dating and
social networking app for Malaysia and SEA built with React Native Expo.

---

## Mandatory reading before every task

Before writing a single line of code, read these files in this order:

1. **`CONVENTIONS.md`** — your detailed rulebook. Every rule in it is non-negotiable.
2. **`ARCHITECT.md`** — full schema, tech stack, file structure, and architectural constraints.
3. **`CHANGELOG.md`** — latest entry tells you current project state and what was last completed.
4. **`TASKS.md`** — find the current task. Only work on the task you are assigned. Do not proceed to the next.

---

## Project summary

- **App:** Fitness-focused dating and social networking app for Malaysia and SEA
- **Stack:** React Native + Expo SDK 52+, TypeScript strict mode
- **Backend:** Firebase (Firestore, Auth, Realtime DB, Storage, Cloud Functions 2nd gen)
- **State:** Zustand + React Hook Form + Zod
- **Animations:** React Native Reanimated 3 (60fps target)
- **i18n:** i18next (EN, MY, ZH, TA)

---

## Absolute non-negotiables (full detail in CONVENTIONS.md)

- Zero `any` — TypeScript strict everywhere
- Zero inline styles — theme tokens from `constants/` only
- Zero hardcoded strings — all text through i18next
- Never write match creation, age, bans, or subscriptions from the client — Cloud Functions only
- Swipe data is a subcollection: `/swipes/{userId}/likes/{targetId}` — never flatten
- `GestureHandlerRootView` stays at the app root in App.tsx — never move it
- No open Firestore security rules — every new collection needs rules written alongside it
- One commit per task — format: `task-XX: short description`
- Zero TypeScript errors before committing

---

## If you are unsure about any pattern or rule

Stop and read `CONVENTIONS.md`. It has code examples for every major pattern in this project.
Do not guess. Do not improvise. Do not use a pattern not established in CONVENTIONS.md or ARCHITECT.md.