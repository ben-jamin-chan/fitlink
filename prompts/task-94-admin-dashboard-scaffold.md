# CODEX PROMPT — Task 94: Admin Dashboard — Project Scaffold & Auth

@CONVENTIONS.md @ARCHITECT.md

---

## Pre-Task Dependency Check

**Required outputs from prior tasks / pre-flight steps:**

- **Pre-flight Step B** — `firebase.json` must contain a `hosting` array with an `"admin"` target entry pointing to `"admin/build"`. Verify this entry exists before writing any code.
- **Pre-flight Step C** — At least one Firebase UID must have `{ admin: true }` custom claim set via Admin SDK one-off script. Verify with a note in your plan (you cannot check this from source, but confirm the pre-flight is documented).
- **Task 89** must have produced `constants/regions.ts` with `SUPPORTED_COUNTRIES`, `SEA_CITIES`, `COUNTRY_TIMEZONES`, `COUNTRY_CURRENCIES`, `COUNTRY_CALLING_CODES` — verify the file exists and exports these names.
- **Task 93** must have produced a clean `firestore.indexes.json` — verify the file is present and valid JSON.

If any listed dependency is absent: output a DEPENDENCY ERROR block at the top of your response, list what is missing, and do not proceed with implementation.

```
<!-- DEPENDENCY ERROR
  Missing: firebase.json does not contain a hosting target named "admin".
  Cannot proceed. Complete Pre-flight Step B before running Task 94.
-->
```

---

## Context

Task 94 creates the `/admin/` subfolder in the monorepo — a separate React + Vite web app that provides a moderation dashboard for Fitlink. It is **not** a React Native app, does not use Expo, and does not share any `@/` alias or Expo SDK imports with the mobile app.

**What already exists:**
- `functions/src/index.ts` — all Cloud Function exports; do not modify in this task
- `firestore.rules` — existing rules; do not modify in this task
- `firebase.json` — must already have the admin hosting target from Pre-flight Step B; do not add a hosting target here — verify it exists only
- `constants/regions.ts` — exists from Task 89; do not import it inside `/admin/`
- `.gitignore` — exists; add two lines only (see below)

**What this task builds:**
- A complete React + TypeScript + Vite scaffold in `/admin/`
- Google-only Firebase Auth sign-in for admin accounts
- `AdminRoute` component that reads the `admin` custom claim from the ID token and redirects unauthorized users to `/`
- A stub `DashboardPage` with three empty tab panels (filled in Task 95)

**Architectural boundaries — read carefully:**

**The admin app uses the Firebase client SDK only. It does NOT use the Firebase Admin SDK.** Admin SDK is server-only (Cloud Functions). The dashboard authenticates with Firebase Auth (client SDK), reads Firestore with the client SDK under the existing security rules, and calls a Cloud Function (`adminAction`, added in Task 95) for any destructive actions (ban). Direct Firestore writes for bans do NOT happen from the dashboard client.

**No destructive Firestore writes in this task.** Task 94 is scaffold + auth only. `DashboardPage` is a stub. All moderation actions (ban/warn/dismiss) are Task 95.

**Never import from `@/` aliases, Expo packages, Zustand, React Navigation, React Native, or i18next inside `/admin/`.** The admin app is a plain React web app.

**`admin/src/firebase.ts` must use `initializeApp` with Vite env vars (`VITE_FIREBASE_*`), NOT `EXPO_PUBLIC_*` vars.** Different build tool, different env var prefix.

**The `AdminRoute` custom claim check must be async.** `getIdTokenResult()` is a Promise. The component must show a loading state while the claim is being fetched and must not render children until the claim is confirmed.

**Google Sign-In is the only auth method for the admin app.** No phone OTP, no email/password, no Apple Sign-In. Admin accounts are Google-authenticated internal accounts only.

**`LoginPage` must verify the `admin` claim after sign-in.** If a valid Google account signs in but has no `admin: true` custom claim, sign them out immediately and show an "Unauthorised" error. Do not allow unauthenticated or non-admin users to reach any dashboard page.

---

## Task 94 — Admin Dashboard: Project Scaffold & Auth

**Files to create:**
- `admin/index.html`
- `admin/vite.config.ts`
- `admin/tsconfig.json`
- `admin/package.json`
- `admin/.env.example`
- `admin/src/main.tsx`
- `admin/src/App.tsx`
- `admin/src/firebase.ts`
- `admin/src/pages/LoginPage.tsx`
- `admin/src/pages/DashboardPage.tsx`
- `admin/src/components/AdminRoute.tsx`

**Files to modify:**
- `.gitignore` — add `admin/node_modules/` and `admin/build/` exclusion entries

---

### `admin/index.html`

Standard Vite HTML entry point. References `/src/main.tsx` as the module entry.

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Fitlink Admin</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

### `admin/vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'build',
  },
})
```

---

### `admin/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Also create `admin/tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

---

### `admin/package.json`

```json
{
  "name": "fitlink-admin",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "firebase": "^10.12.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.23.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.4.5",
    "vite": "^5.3.1"
  }
}
```

---

### `admin/.env.example`

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_DATABASE_URL=
```

---

### `admin/src/firebase.ts`

Initialises Firebase using Vite env vars. Exports `auth`, `db`, and `functions` for use throughout the admin app. No Admin SDK — client SDK only.

```typescript
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getFunctions } from 'firebase/functions'

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID as string,
  databaseURL:       import.meta.env.VITE_FIREBASE_DATABASE_URL as string,
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const functions = getFunctions(app, 'asia-southeast1')
```

---

### `admin/src/components/AdminRoute.tsx`

Guards any route that requires an authenticated admin user. Reads the `admin` custom claim from the Firebase ID token result. Shows a loading state while the claim is being fetched. Redirects to `/` if the user is unauthenticated or if the `admin` claim is absent or false.

```typescript
import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '../firebase'

interface AdminRouteProps {
  children: React.ReactNode
}

type ClaimStatus = 'loading' | 'authorised' | 'unauthorised'

export const AdminRoute = ({ children }: AdminRouteProps): React.JSX.Element => {
  const [status, setStatus] = useState<ClaimStatus>('loading')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setStatus('unauthorised')
        return
      }

      try {
        // Force refresh: false — use the cached token if still valid.
        // The LoginPage already verified the claim at sign-in time.
        // This check is the route-level guard on subsequent navigations.
        const tokenResult = await user.getIdTokenResult(false)
        const isAdmin = tokenResult.claims['admin'] === true
        setStatus(isAdmin ? 'authorised' : 'unauthorised')
      } catch {
        setStatus('unauthorised')
      }
    })

    return unsubscribe
  }, [])

  if (status === 'loading') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <p>Verifying access…</p>
      </div>
    )
  }

  if (status === 'unauthorised') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
```

---

### `admin/src/pages/LoginPage.tsx`

Google Sign-In only. After a successful Google sign-in, reads the `admin` custom claim. If the claim is absent, signs the user out immediately and shows an "Unauthorised" error. Only navigates to `/dashboard` if the claim is confirmed.

```typescript
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from 'firebase/auth'
import { auth } from '../firebase'

export const LoginPage = (): React.JSX.Element => {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleGoogleSignIn = async (): Promise<void> => {
    setError(null)
    setIsLoading(true)

    try {
      const provider = new GoogleAuthProvider()
      const credential = await signInWithPopup(auth, provider)

      // Verify the admin custom claim immediately after sign-in
      const tokenResult = await credential.user.getIdTokenResult(true) // force refresh
      const isAdmin = tokenResult.claims['admin'] === true

      if (!isAdmin) {
        // Not an admin — sign out and show error
        await signOut(auth)
        setError('This account does not have admin access. Contact your administrator.')
        return
      }

      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sign-in failed. Please try again.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'system-ui, sans-serif',
      backgroundColor: '#f9fafb',
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '8px',
        padding: '40px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        width: '360px',
        textAlign: 'center',
      }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: '#111827' }}>
          Fitlink Admin
        </h1>
        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '32px' }}>
          Sign in with your admin Google account
        </p>

        {error !== null && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '16px',
            fontSize: '14px',
            color: '#dc2626',
            textAlign: 'left',
          }}>
            {error}
          </div>
        )}

        <button
          onClick={() => { void handleGoogleSignIn() }}
          disabled={isLoading}
          style={{
            width: '100%',
            padding: '10px 16px',
            backgroundColor: isLoading ? '#9ca3af' : '#1a73e8',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            fontSize: '15px',
            fontWeight: 600,
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {isLoading ? 'Signing in…' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  )
}
```

---

### `admin/src/pages/DashboardPage.tsx`

Stub only in this task. Three tab buttons (Reports | Flags | Users) with empty panels. Filled in Task 95. Includes the page header with signed-in email and Sign Out button.

```typescript
import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from '../firebase'

type TabName = 'Reports' | 'Flags' | 'Users'
const TABS: TabName[] = ['Reports', 'Flags', 'Users']

export const DashboardPage = (): React.JSX.Element => {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabName>('Reports')
  const [adminEmail, setAdminEmail] = useState<string>('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user?.email) {
        setAdminEmail(user.email)
      }
    })
    return unsubscribe
  }, [])

  const handleSignOut = async (): Promise<void> => {
    await signOut(auth)
    navigate('/', { replace: true })
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        height: '56px',
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
      }}>
        <span style={{ fontWeight: 700, fontSize: '18px', color: '#111827' }}>
          Fitlink Admin
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '14px', color: '#6b7280' }}>{adminEmail}</span>
          <button
            onClick={() => { void handleSignOut() }}
            style={{
              fontSize: '14px',
              color: '#dc2626',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        gap: '0',
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: '#ffffff',
        padding: '0 24px',
      }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? '#1a73e8' : '#6b7280',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #1a73e8' : '2px solid transparent',
              cursor: 'pointer',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Panel — stub content; replaced in Task 95 */}
      <main style={{ padding: '32px 24px' }}>
        <p style={{ fontSize: '14px', color: '#9ca3af' }}>
          {activeTab} panel — coming in Task 95
        </p>
      </main>
    </div>
  )
}
```

---

### `admin/src/App.tsx`

Top-level router. Two routes: `/` → `LoginPage` (public), `/dashboard` → `DashboardPage` (guarded by `AdminRoute`). Any other path redirects to `/`.

```typescript
import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { AdminRoute } from './components/AdminRoute'

const App = (): React.JSX.Element => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route
          path="/dashboard"
          element={
            <AdminRoute>
              <DashboardPage />
            </AdminRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
```

---

### `admin/src/main.tsx`

Standard Vite + React entry point. Renders `App` into `#root`.

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

const rootEl = document.getElementById('root')
if (rootEl === null) {
  throw new Error('Root element not found — check admin/index.html for <div id="root">')
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

---

### `.gitignore` — Update

Add these two lines to the existing `.gitignore` file. Do not remove any existing entries. Find the `node_modules` section and append:

```
admin/node_modules/
admin/build/
```

---

## Important Architecture Notes for Codex

1. **No `@/` alias inside `/admin/`.** The Vite app has no `module-resolver` plugin. All imports within `/admin/src/` must use relative paths (e.g. `'../firebase'`, `'./pages/LoginPage'`). Absolute path aliases from the mobile app do not exist here.

2. **No Expo, React Native, Zustand, i18next, or React Navigation imports inside `/admin/`.** These packages are not listed in `admin/package.json` and will cause build failures if imported.

3. **`VITE_FIREBASE_*` env vars, not `EXPO_PUBLIC_*`.** Vite exposes env vars prefixed with `VITE_` via `import.meta.env`. The `EXPO_PUBLIC_` prefix is Expo-specific and has no effect in a Vite build.

4. **`AdminRoute` uses `onAuthStateChanged`, not a one-time `getIdTokenResult` call.** The auth state listener correctly handles the case where the page is refreshed and Firebase restores the session from the local IndexedDB cache. A one-time call at component mount would fire before Firebase restores the session, always redirecting to `/`.

5. **`LoginPage` must force-refresh the ID token after Google sign-in** (`getIdTokenResult(true)`). Custom claims are added out-of-band by the Firebase Admin SDK — the token cached in the client may predate the claim being set. Forcing a refresh ensures the claim is present before the dashboard is entered.

6. **`DashboardPage` is a stub.** Do not implement `ReportsPanel`, `FlagsPanel`, or `UsersPanel` in this task — those are Task 95. The stub must compile and render; empty tab panels are correct.

7. **`admin/src/firebase.ts` exports three named exports:** `auth`, `db`, `functions`. All three are used in Task 95. Ensure the `functions` instance specifies the `'asia-southeast1'` region — passed as the second argument to `getFunctions(app, 'asia-southeast1')`.

8. **`signInWithPopup` is correct for an admin web app.** This is not a mobile app; `signInWithPopup` works correctly in a browser environment. The mobile app uses `expo-auth-session`; the admin web app uses the standard Firebase Web SDK popup flow.

9. **Inline styles are acceptable in the admin app.** The admin app is not subject to the mobile app's `StyleSheet.create` rule (which is a React Native convention). Plain CSS-in-JS style objects are fine here. A CSS framework is explicitly excluded from the dependency list to keep the scaffold minimal.

10. **`void` operator on async event handlers.** For `onClick` handlers that call `async` functions, use `() => { void handleFn() }` — this satisfies `@typescript-eslint/no-floating-promises` and matches the pattern used in the mobile app for consistency.

---

## Rollback Protocol

If `npm --prefix admin run build` produces errors that cannot be resolved without:
- Importing from the mobile app's `@/` alias tree, OR
- Adding packages not listed in `admin/package.json`, OR
- Changing `firebase.json` in a way that contradicts the Pre-flight Step B configuration

**Then:**
1. Do not commit any partial changes
2. Revert all files in `admin/` to their state at session start
3. Output a `<!-- ROLLBACK REPORT -->` block listing the file, the error, and the decision needed
4. Stop. Do not attempt a workaround. Bring the report back to the Architect.

---

## Codex Self-Check (Run Before Declaring Done)

**TypeScript**
- [ ] `npm --prefix admin run build` — zero errors (this runs `tsc && vite build`)
- [ ] Zero `any` types in all new `/admin/src/` files
- [ ] Zero type assertions (`as X`) without an explanatory comment

**Conventions (admin-specific)**
- [ ] Zero `@/` imports inside `/admin/src/` — all imports are relative paths
- [ ] Zero imports from `expo-*`, `react-native*`, `zustand`, `i18next`, `@react-navigation/*`
- [ ] Zero imports from `firebase-admin` — client SDK only
- [ ] `VITE_FIREBASE_*` env vars used — not `EXPO_PUBLIC_*`
- [ ] `functions` instance in `firebase.ts` specifies `'asia-southeast1'` region

**Auth & Security**
- [ ] `AdminRoute` uses `onAuthStateChanged` (not a one-time fetch) to handle session restore
- [ ] `LoginPage` calls `getIdTokenResult(true)` (force refresh) after Google sign-in
- [ ] `LoginPage` calls `signOut(auth)` before setting the error if the admin claim is absent
- [ ] No route in `App.tsx` allows unauthenticated access to `/dashboard`
- [ ] `DashboardPage` is a stub — no Firestore reads or writes in this task

**Architecture**
- [ ] `DashboardPage` renders three tab buttons and empty panels — no moderation logic
- [ ] `admin/.env.example` contains all 7 `VITE_FIREBASE_*` keys
- [ ] `.gitignore` additions are appended — no existing entries removed
- [ ] `admin/node_modules/` and `admin/build/` are excluded in `.gitignore`

**Platform**
- [ ] `signInWithPopup` used (correct for web) — not `expo-auth-session` or `signInWithRedirect`

---

## Acceptance Criteria

- [ ] `npm --prefix admin install` completes without error
- [ ] `npm --prefix admin run build` completes with zero TypeScript errors and produces `admin/build/`
- [ ] Navigating to `/` renders `LoginPage` with a "Sign in with Google" button
- [ ] Clicking "Sign in with Google" triggers Firebase `signInWithPopup` with `GoogleAuthProvider`
- [ ] A Google account without `admin: true` custom claim is signed out immediately and sees the "Unauthorised" error message on `LoginPage`
- [ ] A Google account with `admin: true` custom claim is navigated to `/dashboard` after sign-in
- [ ] Directly visiting `/dashboard` without being signed in redirects to `/` (via `AdminRoute`)
- [ ] Directly visiting `/dashboard` signed in but without the `admin` claim redirects to `/` (via `AdminRoute`)
- [ ] `DashboardPage` renders the header (app name, email, Sign Out), three tab buttons, and empty stub panels
- [ ] Clicking "Sign Out" on the dashboard calls `signOut(auth)` and navigates to `/`
- [ ] All other paths (`/anything-else`) redirect to `/`
- [ ] `admin/.env.example` contains all 7 `VITE_FIREBASE_*` keys with empty values
- [ ] `admin/node_modules/` and `admin/build/` are present in root `.gitignore`
- [ ] Zero `@/` imports, Expo imports, or Admin SDK imports anywhere in `/admin/src/`

---

## Do Not Touch

`functions/src/index.ts`, `functions/src/` (any existing Cloud Function), `firestore.rules`, `firestore.indexes.json`, `firebase.json` (verify the admin hosting target exists — do not modify the file), `constants/regions.ts`, `store/`, `app/`, `components/`, `services/`, `types/`, `i18n/`, `package.json` (root), `tsconfig.json` (root), `babel.config.js`

---

## Commit

```
git commit -m "task-94: admin dashboard scaffold, auth, and AdminRoute claim guard"
```

---

## After This Session

Update `CHANGELOG.md` using this exact template:

```
## [Phase 4B — Task 94] — YYYY-MM-DD

### Completed

- Task 94: Admin dashboard project scaffold and auth
- admin/: React + Vite app scaffolded with Google-only sign-in
- AdminRoute: custom claim guard (admin: true) with loading state and redirect
- LoginPage: Google sign-in, force-refresh claim check, unauthorised sign-out
- DashboardPage: stub with header, Sign Out, and three empty tab panels

### Files Created

- admin/index.html: Vite HTML entry point
- admin/vite.config.ts: Vite config with React plugin and build outDir 'build'
- admin/tsconfig.json: TypeScript config for React web app
- admin/tsconfig.node.json: TypeScript config for vite.config.ts
- admin/package.json: React 18, react-router-dom 6, Firebase 10, Vite 5
- admin/.env.example: 7 VITE_FIREBASE_* keys (empty values)
- admin/src/main.tsx: ReactDOM.createRoot entry point
- admin/src/App.tsx: BrowserRouter with / → LoginPage and /dashboard → AdminRoute(DashboardPage)
- admin/src/firebase.ts: initializeApp with VITE_FIREBASE_* env vars; exports auth, db, functions (asia-southeast1)
- admin/src/pages/LoginPage.tsx: Google Sign-In, admin claim verification, unauthorised error
- admin/src/pages/DashboardPage.tsx: stub header + three empty tab panels
- admin/src/components/AdminRoute.tsx: onAuthStateChanged + getIdTokenResult claim guard

### Files Modified

- .gitignore: admin/node_modules/ and admin/build/ added

### Architecture Decisions

- [Document any deviations from the prompt spec and why they are safe]
- Admin app uses Firebase client SDK only; no Admin SDK on the client
- VITE_FIREBASE_* env vars used (not EXPO_PUBLIC_*) for Vite build tool compatibility
- functions instance in firebase.ts specifies asia-southeast1 for Task 95 CF calls
- signInWithPopup used (correct for web app); not signInWithRedirect or expo-auth-session
- getIdTokenResult(true) force-refreshed after Google sign-in to ensure admin claim is current

### Conflict Risks Introduced

- admin/src/firebase.ts exports auth, db, functions — Task 95 imports all three; review before generating Task 95 prompt
- DashboardPage.tsx is a stub — Task 95 will add ReportsPanel, FlagsPanel, UsersPanel; this file has high conflict potential

### Known Issues / Deferred

- DashboardPage tab panels are stubs — filled in Task 95
- admin/build/ is in .gitignore but firebase.json hosting target for 'admin' must point to 'admin/build' — verify this matches Pre-flight Step B config

### Next Up

- Task 95: Admin Dashboard — Moderation Queue & Actions
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 95 prompt.
Attach `admin/src/firebase.ts` and `admin/src/pages/DashboardPage.tsx` alongside the CHANGELOG — Task 95 modifies both files and live inspection is needed to avoid drift.

---

## Reasoning Level

High
