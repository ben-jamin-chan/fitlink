# CODEX PROMPT — Task 22
# Cloud Function: onUserCreated

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 2.6 complete. The full 6-step onboarding flow is wired end to end. On Step 6 completion, `createUserProfile()` writes the user document to `/users/{userId}` in Firestore — **intentionally omitting the `age` field** because age must be calculated server-side. Task 22 fills that gap.

Relevant existing files:
- `services/firebase/firestore.ts` — `createUserProfile()` writes `dateOfBirth` (Timestamp) but leaves `age` absent
- `functions/src/` — directory exists but is empty (no Cloud Functions written yet)
- `types/user.ts` — `UserProfile` interface has `age: number` as a required field
- `firestore.rules` — `/users/{userId}` write rules exist; `age`, `banned`, `verified` are server-only fields that the client cannot write
- Firebase project is set up in `asia-southeast1` region (Firestore, Storage, Functions)

**This is the first Cloud Function in the project.** Codex must also set up the `functions/` package properly (Node.js 18, TypeScript, 2nd gen) before writing the function itself.

---

## Task 22 — Cloud Function: onUserCreated

**Files to create:**
- `functions/package.json`
- `functions/tsconfig.json`
- `functions/.eslintrc.js`
- `functions/src/index.ts`
- `functions/src/onUserCreated.ts`

**Files to modify:**
- `firebase.json` — add functions config
- `firestore.rules` — verify `age` write is blocked from client (review only, no edit unless missing)

---

### `functions/package.json`

Standard Firebase Functions Node.js 18 + TypeScript setup:

```json
{
  "name": "functions",
  "scripts": {
    "lint": "eslint --ext .js,.ts .",
    "build": "tsc",
    "build:watch": "tsc --watch",
    "serve": "npm run build && firebase emulators:start --only functions",
    "shell": "npm run build && firebase functions:shell",
    "start": "npm run shell",
    "deploy": "firebase deploy --only functions",
    "logs": "firebase functions:log"
  },
  "engines": {
    "node": "18"
  },
  "main": "lib/index.js",
  "dependencies": {
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^4.9.0"
  },
  "devDependencies": {
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint": "^8.0.0",
    "eslint-config-google": "^0.14.0",
    "typescript": "^5.4.0"
  },
  "private": true
}
```

---

### `functions/tsconfig.json`

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "outDir": "lib",
    "sourceMap": true,
    "strict": true,
    "target": "es2017",
    "esModuleInterop": true
  },
  "compileOnSave": true,
  "include": ["src"]
}
```

---

### `functions/.eslintrc.js`

```javascript
module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    sourceType: "module",
  },
  ignorePatterns: [
    "/lib/**/*",
  ],
  plugins: [
    "@typescript-eslint",
  ],
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "quotes": ["error", "double"],
  },
};
```

---

### `functions/src/onUserCreated.ts`

**Trigger:** Firebase Auth `user().onCreate` — fires whenever a new Firebase Auth account is created.

**Logic:**
1. Look up the new user's Firestore document at `/users/{uid}` to read `dateOfBirth`
2. Calculate `age` in whole years from `dateOfBirth` to today
3. If `age < 18`: set `banned: true`, `banReason: 'UNDERAGE'` — block the account
4. If `age >= 18`: write `age` to the user document
5. In both cases, update `lastActive` to server timestamp

**Critical constraints:**
- This is a **2nd gen** Firebase Function — use `onDocumentCreated` from `firebase-functions/v2/firestore` for Firestore triggers, and `beforeUserCreated`/`onUserCreated` from `firebase-functions/v2/auth` for Auth triggers
- Auth `onCreate` trigger is 1st gen: `functions.auth.user().onCreate`. For 2nd gen, use `onDocumentCreated` on `/users/{uid}` instead — trigger when the Firestore user doc is first created (Step 6 completion). This is safer because `dateOfBirth` is guaranteed to exist on the Firestore write, unlike on the Auth event (which fires before Firestore write completes).
- Use `admin.firestore.FieldValue.serverTimestamp()` for all timestamp writes — never `new Date()`
- Never trust `age` from the client — always compute from `dateOfBirth` Timestamp
- Region: `asia-southeast1`
- Export as 2nd gen function

```typescript
import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { FieldValue, Timestamp } from "firebase-admin/firestore";

// Initialise admin SDK once (guards against duplicate init in index.ts)
if (admin.apps.length === 0) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Triggered when a new user document is created in /users/{uid} at
 * onboarding Step 6 completion.
 *
 * Responsibilities:
 * - Calculate age server-side from dateOfBirth (client value cannot be trusted)
 * - Auto-ban accounts where calculated age < 18
 * - Write age (and banReason if applicable) back to the user document
 *
 * The client intentionally omits `age` from its createUserProfile() write.
 * This function is the authoritative source of truth for the age field.
 */
export const onUserCreated = onDocumentCreated(
  {
    document: "users/{uid}",
    region: "asia-southeast1",
  },
  async (event): Promise<void> => {
    const uid = event.params.uid;
    const data = event.data?.data();

    if (data === undefined) {
      console.error(`onUserCreated: no data for uid=${uid}`);
      return;
    }

    // dateOfBirth is stored as a Firestore Timestamp
    const dateOfBirth = data["dateOfBirth"] as Timestamp | undefined;

    if (dateOfBirth === undefined) {
      console.error(
        `onUserCreated: missing dateOfBirth for uid=${uid}. Skipping age calculation.`
      );
      return;
    }

    const age = calculateAgeInYears(dateOfBirth.toDate());

    if (age < 18) {
      // Under-18 — ban immediately, block all discovery and activity
      await db.doc(`users/${uid}`).update({
        age,
        banned: true,
        banReason: "UNDERAGE",
        bannedAt: FieldValue.serverTimestamp(),
        lastActive: FieldValue.serverTimestamp(),
      });

      console.warn(
        `onUserCreated: uid=${uid} is under 18 (age=${age}). Account auto-banned.`
      );

      // Revoke Firebase Auth tokens so the user cannot continue using the app
      try {
        await admin.auth().revokeRefreshTokens(uid);
      } catch (err) {
        console.error(
          `onUserCreated: failed to revoke tokens for uid=${uid}`,
          err
        );
      }

      return;
    }

    // Age is valid — write calculated age to user document
    await db.doc(`users/${uid}`).update({
      age,
      lastActive: FieldValue.serverTimestamp(),
    });

    console.log(`onUserCreated: uid=${uid} age=${age} written successfully.`);
  }
);

/**
 * Calculates complete years between a birth date and today.
 * Does not round — a person born today is 0 years old.
 */
function calculateAgeInYears(dateOfBirth: Date): number {
  const today = new Date();

  let age = today.getFullYear() - dateOfBirth.getFullYear();

  // Check if the birthday has occurred yet this calendar year
  const hasHadBirthdayThisYear =
    today.getMonth() > dateOfBirth.getMonth() ||
    (today.getMonth() === dateOfBirth.getMonth() &&
      today.getDate() >= dateOfBirth.getDate());

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return age;
}
```

---

### `functions/src/index.ts`

The barrel file that exports all Cloud Functions. Only `onUserCreated` exists at this stage — future tasks will add more exports here.

```typescript
import * as admin from "firebase-admin";

// Initialise Firebase Admin SDK once at module load
// Guard prevents duplicate initialisation across hot reloads
if (admin.apps.length === 0) {
  admin.initializeApp();
}

export { onUserCreated } from "./onUserCreated";
```

---

### `firebase.json` — Update

Add the `functions` block if it does not already exist. Merge with any existing content — do not overwrite Firestore or Storage configuration:

```json
{
  "functions": {
    "source": "functions",
    "codebase": "default",
    "ignore": [
      "node_modules",
      ".git",
      "firebase-debug.log",
      "firebase-debug.*.log",
      "*.local"
    ]
  }
}
```

---

### `firestore.rules` — Review Only

Open `firestore.rules` and verify the `/users/{userId}` write rule **prevents the client from writing `age`, `banned`, `banReason`, `bannedAt`, or `verified`**. The rule should already contain something like:

```
allow write: if request.auth.uid == userId
  && !("age" in request.resource.data)
  && !("banned" in request.resource.data)
  && !("verified" in request.resource.data);
```

If those field guards are missing, add them. If the rule already covers these fields correctly from Task 21, make no changes.

---

## Emulator Testing Instructions

After implementation, Codex must verify the function works in the emulator before completing:

```bash
# From project root
cd functions && npm install && npm run build && cd ..
firebase emulators:start --only auth,firestore,functions
```

**Test scenario A — Valid adult user (age 25):**
1. In Firestore emulator, create a document at `/users/test-uid-adult` with:
   ```json
   {
     "dateOfBirth": <Timestamp for a date 25 years ago>,
     "firstName": "Test",
     "banned": false
   }
   ```
2. After trigger fires, verify document now has `age: 25` and `banned: false`

**Test scenario B — Underage user (age 16):**
1. Create `/users/test-uid-minor` with `dateOfBirth` 16 years ago
2. After trigger fires, verify: `age: 16`, `banned: true`, `banReason: "UNDERAGE"`, `bannedAt` is set

**Test scenario C — Missing dateOfBirth:**
1. Create `/users/test-uid-nodob` without a `dateOfBirth` field
2. Function should log an error and return without crashing — document unchanged

---

## Architecture Notes for Codex

1. **2nd gen trigger pattern.** The trigger is `onDocumentCreated("users/{uid}")` — not the Auth `onCreate` trigger. This guarantees `dateOfBirth` is present in the document when the function fires, because `createUserProfile()` (Task 21) writes it in the same atomic operation. The Auth `onCreate` fires before the Firestore write completes, making it unreliable for reading profile data.

2. **Admin SDK init guard.** Both `index.ts` and `onUserCreated.ts` contain the `admin.apps.length === 0` guard. This is intentional — emulator hot-reloads can re-execute module-level code. The guard is idempotent and safe.

3. **Token revocation for underage users.** `revokeRefreshTokens(uid)` is wrapped in its own try/catch so a token revocation failure does not prevent the ban from being written to Firestore. The Firestore ban is the authoritative gate — token revocation is a best-effort additional layer.

4. **No `age` on the initial client write.** Do not modify `services/firebase/firestore.ts` — it is correct as-is. The client omits `age` intentionally. The function is the only writer of `age`.

5. **`calculateAgeInYears` lives in `onUserCreated.ts`**, not in a shared utils file. It is private to this function. If other functions need age calculation later, extract to `functions/src/utils/dateUtils.ts` at that time — do not pre-optimise now.

6. **No client-side imports from `functions/`.** The `functions/` directory is a separate Node.js package. Nothing in the React Native app should import from it. Types shared between the app and functions are defined in `types/` (client) — not in `functions/src/`.

---

## Acceptance Criteria

- [ ] `functions/package.json` created with Node.js 18 engine, firebase-admin and firebase-functions dependencies
- [ ] `functions/tsconfig.json` created with strict mode, commonjs output to `lib/`
- [ ] `functions/src/index.ts` created — exports `onUserCreated`, admin SDK initialised with guard
- [ ] `functions/src/onUserCreated.ts` created — `onDocumentCreated` on `users/{uid}`, region `asia-southeast1`
- [ ] `calculateAgeInYears` correctly handles birthday-not-yet-this-year case
- [ ] Valid adult users: `age` field written, `banned` unchanged
- [ ] Underage users: `age` written, `banned: true`, `banReason: "UNDERAGE"`, `bannedAt` set, tokens revoked
- [ ] Missing `dateOfBirth`: function logs error and exits without crashing or partial writes
- [ ] `firebase.json` includes functions source configuration
- [ ] `firestore.rules` blocks client writes to `age`, `banned`, `banReason`, `bannedAt`, `verified`
- [ ] `cd functions && npm run build` exits with zero TypeScript errors
- [ ] No `any` types anywhere in functions TypeScript
- [ ] No `new Date()` for timestamp writes — `FieldValue.serverTimestamp()` only
- [ ] Emulator test scenarios A, B, and C verified manually

## Do Not Touch
`services/firebase/firestore.ts`, `store/onboardingStore.ts`, `app/onboarding/`, `types/`, `constants/`, `components/`, `store/`, `App.tsx`, `i18n/`, any auth or onboarding screen

## Commit
`git commit -m "task-22: cloud function onUserCreated — server-side age calculation and underage auto-ban"`

---

## After This Session

Update `CHANGELOG.md`:
```
## [Phase 3.1] — YYYY-MM-DD
### Completed
- Task 22: Cloud Function onUserCreated implemented (2nd gen, asia-southeast1)
- functions/ package bootstrapped (Node.js 18, TypeScript strict, firebase-admin, firebase-functions v4)
- Age calculated server-side from dateOfBirth Timestamp — client never writes age
- Underage accounts (age < 18) auto-banned: banned=true, banReason="UNDERAGE", tokens revoked
- firebase.json updated with functions source configuration
- firestore.rules verified: age, banned, banReason, bannedAt, verified are server-only fields

### Files Created / Modified
- functions/package.json: Node.js 18, firebase-admin ^12, firebase-functions ^4, TypeScript dev deps
- functions/tsconfig.json: strict mode, commonjs, output to lib/
- functions/.eslintrc.js: TypeScript ESLint rules, no-explicit-any as error
- functions/src/index.ts: admin SDK init guard, exports onUserCreated
- functions/src/onUserCreated.ts: onDocumentCreated trigger, calculateAgeInYears, underage ban + token revoke
- firebase.json: functions block added
- firestore.rules: verified server-only field guards (age, banned, etc.)

### Schema Changes
- /users/{uid}.age: now populated by onUserCreated Cloud Function on document creation
- /users/{uid}.banReason: "UNDERAGE" set for auto-banned accounts
- /users/{uid}.bannedAt: Timestamp set on auto-ban

### Known Issues / Deferred
- onUserCreated fires on Firestore document create, not Firebase Auth onCreate — this means if Step 6 fails mid-write and no document is created, the function never fires; the client already guards this with LoadingOverlay + retry
- Token revocation is best-effort (wrapped in try/catch); the Firestore ban is the authoritative gate

### Next Up
- Task 23: Cloud Function getDiscoveryStack (HTTP callable, scoring algorithm, candidate filtering)
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 23 prompt.

---

## Reasoning Level
Medium-High
