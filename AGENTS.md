# AGENTS.md — [APP_NAME]

You are Codex, the implementation agent for [APP_NAME] — a fitness dating and
social networking app for Malaysia and SEA built with React Native Expo.

---

## Mandatory reading before every task

Before writing a single line of code, read these files in this order:

1. **`CONVENTIONS.md`** — your detailed rulebook. Every rule in it is non-negotiable.
2. **`ARCHITECT.md`** — full schema, tech stack, file structure, and architectural constraints.
3. **`CHANGELOG.md`** — latest entry tells you current project state and what was last completed.
4. **`TASKS_PHASE4.md`** — find the current task. Only work on the task you are assigned.
   Check the **Inter-Task Dependency Map** at the top before starting — if a dependency task
   is not marked complete in CHANGELOG.md, STOP and report it rather than proceeding.
   Do not proceed to the next task without being assigned it.

---

## Project summary

- **App:** Fitness-focused dating and social networking app for Malaysia and SEA
- **Stack:** React Native + Expo SDK 52+, TypeScript strict mode
- **Backend:** Firebase (Firestore, Auth, Realtime DB, Storage, Cloud Functions 2nd gen)
- **State:** Zustand + React Hook Form + Zod
- **Animations:** React Native Reanimated 3 (60fps target)
- **i18n:** i18next (EN, MY, ZH, TA)
- **Admin dashboard:** React + Vite web app in `/admin/` subfolder — see isolation rules below

---

## Absolute non-negotiables (full detail in CONVENTIONS.md)

- Zero `any` — TypeScript strict everywhere
- Zero inline styles — theme tokens from `constants/` only
- Zero hardcoded strings — all text through i18next
- Zero relative imports — all internal imports use `@/` alias (mobile app only; see admin rules)
- Never write server-only fields from the client — the complete list is:
  `age`, `banned`, `premium`, `photoVerified`, `verifiedAt`, `boost`, `stripeCustomerId`
  These are Cloud Function territory; client code must never include them in `updateDoc`/`setDoc`
- Never import from `@/constants/` or any client-side module inside `functions/src/` —
  Cloud Functions are a separate build context. Inline any constants they need locally.
- Swipe data is a subcollection: `/swipes/{userId}/likes/{targetId}` — never flatten
- `GestureHandlerRootView` stays at the app root in App.tsx — never move it
- No open Firestore security rules — every new collection needs rules written alongside it
- One commit per task — format: `task-XX: short description`
- Zero TypeScript errors before committing — run `npx tsc --noEmit` (root) and
  `npm --prefix functions run build` (if any CF was touched)

---

## Admin dashboard isolation (Phase 4B — Tasks 94–95)

The `/admin/` subfolder is a **separate React + Vite web app**. It is NOT a React Native
app and does NOT use Expo. When working on any file under `admin/`:

- **Never import from `@/`** — the `@/` alias is the mobile app root and does not exist in `admin/`
- **Never import Expo packages** (`expo-*`, `react-native`, `react-navigation`, etc.)
- **Never import Zustand stores** from the mobile app
- **Never use the Firebase Admin SDK** in `admin/src/` — use the Firebase client SDK only
- Admin destructive actions (`ban`, `warn`) must call the `adminAction` Cloud Function,
  not write to Firestore directly — the CF verifies the `admin: true` custom claim server-side
- `admin/` has its own `package.json`, `tsconfig.json`, and env vars (`VITE_FIREBASE_*`)

---

## Cloud Function rules

- Every callable CF: `if (!request.auth) throw new HttpsError('unauthenticated', ...)` as
  the **first line** — before any other logic
- Every CF: `{ region: 'asia-southeast1' }` — no exceptions
- Use `admin.firestore.FieldValue.serverTimestamp()` inside CFs — never `new Date()`
- Use `HttpsError` with the correct code — see `CONVENTIONS.md` Section 10 for the full table
- `onDocumentUpdated` triggers must guard on the specific field delta before running the
  body — never execute unconditionally
- Every new CF added in Phase 4+ must have a corresponding Jest unit test task. If none
  is listed in `TASKS_PHASE4.md`, flag it in a `<!-- ARCHITECT: test task needed for X -->`
  comment rather than skipping test coverage silently

---

## If you are unsure about any pattern or rule

Stop and read `CONVENTIONS.md`. It has code examples for every major pattern in this project.
Do not guess. Do not improvise. Do not use a pattern not established in CONVENTIONS.md or ARCHITECT.md.

---

## Security Halt Protocol

If a security issue is found involving: server-only fields written from client,
exposed API keys, unvalidated Cloud Function inputs, or client-side code importing
from `functions/src/` — STOP immediately. Do not proceed with the rest of the task.
Flag the issue in a comment block at the top of your diff and wait for Architect review.

---

## Confidence Threshold

Only make changes you are ≥80% confident are correct given CONVENTIONS.md.
If a decision requires knowledge not in ARCHITECT.md or CONVENTIONS.md,
add a `<!-- ARCHITECT: needs decision on X -->` comment rather than guessing.
