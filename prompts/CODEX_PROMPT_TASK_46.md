# CODEX PROMPT — Task 46
# Final App Wiring Audit

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 1F is on its final task. All 45 preceding tasks are complete. The following are confirmed
present and working based on CHANGELOG.md:

- `App.tsx` — `AppRoot` inner component pattern, `navigationRef`, `useNotifications()`, `useLastActive()`
- `app/navigation/RootNavigator.tsx` — full routing logic: `AuthNavigator`, `OnboardingNavigator`, `MainTabs`, `BiometricPrompt`
- `store/authStore.ts` — `isAuthenticated`, `hasCompletedOnboarding`, `biometricVerified`, `initialise()`, `logout()`
- `store/profileStore.ts` — `fetchProfile()` returns `UserProfile | null`
- `store/discoveryStore.ts` — `isUpsellVisible`, swipe actions with daily limit enforcement
- `hooks/useNotifications.ts` — registration, foreground listener, deep-link tap handler
- `hooks/useLastActive.ts` — `AppState` heartbeat, 5-min interval, `serverTimestamp()`
- `hooks/useBiometric.ts` — support check, enable/disable, authenticate
- `services/firebase/config.ts` — exports `auth`, `db`, `storage`, `rtdb`
- `services/firebase/auth.ts` — all auth functions
- `services/firebase/firestore.ts` — profile CRUD, daily likes
- `services/notifications.ts` — `registerForPushNotifications`, `unregisterPushNotifications`
- `utils/errorUtils.ts` — `mapFirebaseError`
- `utils/imageUtils.ts` — `compressImage`, `pickAndCompressImage`
- `components/ui/` — `Button`, `Input`, `LoadingOverlay`, `Toast`, `ErrorBoundary`, `OTPInput`, `PhoneInput`, `ProgressDots`, `Slider`, `MultiSelect`, `SingleSelect`
- `components/discovery/` — `SwipeCard`, `ActionButtons`, `FullProfileModal`, `MatchCelebrationModal`, `UpsellModal`
- `components/chat/` — `MessageBubble`, `ChatInput`, `MatchCard`, `MessageListItem`
- `components/profile/` — `PhotoGrid`
- `i18n/` — `en.json`, `my.json`, `zh.json`, `ta.json` — all screens seeded
- All Cloud Functions in `functions/src/` — deployable to emulator
- `firestore.rules` and `firestore.indexes.json` — ready to deploy

Task 46 is a **read, verify, and fix** task — not a build task. Codex must audit the full project
against the checklist below, fix every violation found, and confirm the result. No new features.
No new files unless a required stub is genuinely missing.

---

## Task 46 — Final App Wiring Audit

**Files to audit (primary):**
- `App.tsx`
- `app/navigation/RootNavigator.tsx`
- All files in `store/`
- All files in `services/firebase/`
- All files in `hooks/`
- All files in `components/ui/`
- All screen files in `app/**/*.tsx`

**Files that may need fixes:** any file where a violation is found

**Files to create only if missing:**
- `components/ui/Toast.tsx` (singleton toast — if not yet implemented)
- `components/ui/ErrorBoundary.tsx` (if not yet wrapping the app root)

---

## Audit Checklist — Execute in Order

Codex must work through every item below. For each item: **check → report finding → fix if needed**.

---

### 1. App.tsx Provider Order

Verify `App.tsx` has this **exact** outer provider order, with no extra wrappers in between:

```tsx
<GestureHandlerRootView style={{ flex: 1 }}>
  <SafeAreaProvider>
    <ErrorBoundary>
      <NavigationContainer ref={navigationRef}>
        <AppRoot />
      </NavigationContainer>
    </ErrorBoundary>
  </SafeAreaProvider>
</GestureHandlerRootView>
```

Where `AppRoot` is the inner functional component that calls hooks (`useNotifications`,
`useLastActive`) and renders `<RootNavigator />`.

**Rules:**
- `GestureHandlerRootView` must be the absolute outermost wrapper — never move it
- `ErrorBoundary` must wrap `NavigationContainer` so navigation crashes are caught
- `navigationRef` created with `React.createRef<NavigationContainerRef<RootStackParamList>>()`
  or `useNavigationContainerRef()` at module scope (outside `AppRoot`)
- i18n import side-effect (`import '@/i18n'`) must appear before any JSX render
- Firebase config import (`import '@/services/firebase/config'`) must appear before any JSX render
- `SplashScreen.preventAutoHideAsync()` called at module scope; `SplashScreen.hideAsync()` called
  after Firebase `initialise()` resolves inside `AppRoot`

Fix any deviations found.

---

### 2. Splash Screen Hide

Confirm `expo-splash-screen` is used correctly:

```typescript
import * as SplashScreen from 'expo-splash-screen'

SplashScreen.preventAutoHideAsync()   // top-level, outside component

// Inside AppRoot useEffect (after auth initialise() resolves):
useEffect(() => {
  const unsub = useAuthStore.getState().initialise()
  // initialise() must call SplashScreen.hideAsync() when auth state is determined
  return unsub
}, [])
```

The splash screen must **not** hide until `authStore.initialise()` has determined auth state
(authenticated or not). If `SplashScreen.hideAsync()` is called too early (e.g. at module scope
or immediately in a `useEffect` without waiting for auth), fix it.

Acceptable pattern — call `hideAsync()` inside `initialise()` once `onAuthStateChanged` fires for
the first time:

```typescript
// store/authStore.ts — inside initialise()
onAuthStateChanged(auth, async (firebaseUser) => {
  if (firebaseUser) {
    // ... fetch profile, set state
  } else {
    set({ isAuthenticated: false, isLoading: false })
  }
  await SplashScreen.hideAsync()   // always hide after first auth event
})
```

Fix if `hideAsync()` is called at the wrong time or is missing entirely.

---

### 3. i18n Initialisation Timing

Confirm `i18n/index.ts` is imported **before** any component renders. The import must appear at
the top of `App.tsx` as a side-effect import:

```typescript
import '@/i18n'   // must be before any JSX
```

Confirm `i18next` is fully initialised synchronously (the `initReactI18next` setup in
`i18n/index.ts` must not be async). If it is async, any component rendering before `init()`
resolves will show missing translations. Fix if async pattern used.

---

### 4. Firebase Config Import

Confirm `services/firebase/config.ts` is imported once at the top of `App.tsx` as a side-effect
(or is pulled in indirectly via `authStore` which imports it). There must be **no duplicate
`initializeApp()` calls** — confirm the `getApps().length === 0` guard is in `config.ts`.

---

### 5. GestureHandlerRootView

Confirm `GestureHandlerRootView` appears **only once** in the entire codebase — in `App.tsx`.
Search for all usages:

```bash
grep -r "GestureHandlerRootView" --include="*.tsx" --include="*.ts" .
```

If found in any screen or component file other than `App.tsx`, remove it from those files. It must
not be added per-screen.

---

### 6. useNotifications and useLastActive Placement

Confirm both hooks are called inside `AppRoot` (the inner functional component in `App.tsx`), not
at the module scope and not inside any screen component:

```typescript
const AppRoot = (): React.JSX.Element => {
  useNotifications(navigationRef)
  useLastActive()
  return <RootNavigator />
}
```

If either hook is called elsewhere (e.g. inside `RootNavigator` or a tab screen), move it to
`AppRoot`.

---

### 7. ErrorBoundary Placement

Confirm `<ErrorBoundary>` wraps the navigation tree in `App.tsx`. It must catch errors thrown
during render of any screen. Confirm `ErrorBoundary` is a React class component with:

- `componentDidCatch(error, info)` — logs error (console.error for now)
- `getDerivedStateFromError()` — sets `hasError: true`
- Fallback render: friendly "Something went wrong" screen with an "Restart App" button that calls
  `Updates.reloadAsync()` from `expo-updates` (or `RNRestart` if installed), or simply resets
  `hasError` state to show the app again

If `ErrorBoundary` is a function component (impossible — error boundaries must be class
components), rewrite it as a class component.

---

### 8. TypeScript Strict Mode — Zero Errors

Run:

```bash
npx tsc --noEmit
```

Fix **every** TypeScript error reported. Common categories to watch for:

- `any` usage — replace with correct types or `unknown` + type guard
- Missing return types on exported functions
- `Timestamp` used where `Date` was accidentally written
- Unused imports or variables (`noUnusedLocals` / `noUnusedParameters` are enabled)
- Missing `null` checks on optional fields
- Incorrect `StyleSheet.create` style types (use `ViewStyle`, `TextStyle`, `ImageStyle`)

Do not suppress errors with `// @ts-ignore` or `// @ts-expect-error` unless a comment explains
an unavoidable third-party typing issue.

Output after fix: `npx tsc --noEmit` exits with code 0 and zero lines of output.

---

### 9. Zero `any` Usage

Run:

```bash
grep -rn ": any" --include="*.ts" --include="*.tsx" . \
  | grep -v node_modules \
  | grep -v ".d.ts"
```

Also:

```bash
grep -rn "as any" --include="*.ts" --include="*.tsx" . \
  | grep -v node_modules
```

For every hit:
- Replace `: any` with the correct specific type, or `unknown` + a type guard if the type is
  genuinely dynamic
- Replace `as any` with a type-safe alternative; if truly unavoidable, add an inline comment:
  `// eslint-disable-next-line @typescript-eslint/no-explicit-any — <reason>`

---

### 10. Hardcoded String Audit

Run:

```bash
grep -rn \
  --include="*.tsx" \
  --include="*.ts" \
  --exclude-dir=node_modules \
  --exclude-dir=functions \
  --exclude-dir=i18n \
  'title="\|label="\|placeholder="\|message="\|text="[A-Z]' \
  app/ components/ store/ hooks/
```

Also scan for JSX text nodes that contain English words (rough check):

```bash
grep -rn ">[A-Z][a-z]" --include="*.tsx" app/ components/ \
  | grep -v "//\|/\*\|import\|{t(" \
  | grep -v node_modules
```

For every hit that is a user-visible string **not** wrapped in `t()`:
1. Add the key to `i18n/en.json` under the appropriate namespace
2. Add the same key (English value as placeholder) to `my.json`, `zh.json`, `ta.json`
3. Replace the hardcoded string with `{t('namespace.key')}`

Strings that are **not** user-visible and do not need translation:
- `console.log` / `console.error` messages
- Comment strings
- TypeScript string literal types
- Firebase collection/document path strings
- Regex patterns
- URL strings
- `testID` props

---

### 11. console.log Audit

Run:

```bash
grep -rn "console\.log" --include="*.ts" --include="*.tsx" . \
  | grep -v node_modules \
  | grep -v functions/
```

Remove every `console.log` found in `app/`, `components/`, `store/`, `hooks/`, `services/`,
`utils/`.

`console.error` and `console.warn` are acceptable in error handlers and catch blocks — leave
those.

Cloud Functions (`functions/`) are exempt — Firebase logging uses `console.log` by design.

---

### 12. No Relative Path Imports

Run:

```bash
grep -rn "from '\.\." --include="*.ts" --include="*.tsx" app/ components/ store/ hooks/ services/ utils/ \
  | grep -v node_modules
```

Every hit must be converted to use the `@/` alias. For example:

```typescript
// ❌ Wrong
import { Button } from '../../components/ui/Button'

// ✅ Correct
import { Button } from '@/components/ui/Button'
```

---

### 13. Inline Styles Audit

Run:

```bash
grep -rn "style={{" --include="*.tsx" app/ components/ \
  | grep -v node_modules
```

Every `style={{ ... }}` prop in JSX is a violation. For each:
1. Move the style object into `StyleSheet.create({})` at the bottom of the file
2. Replace the inline style with the named style reference

The only acceptable exception: `<GestureHandlerRootView style={{ flex: 1 }}>` in `App.tsx` —
this single instance is permitted because `StyleSheet` import is unnecessary for one value at
the app root.

---

### 14. serverTimestamp() — No Client Date Objects

Run:

```bash
grep -rn "new Date()\|Date\.now()" --include="*.ts" --include="*.tsx" \
  app/ store/ services/ hooks/ \
  | grep -v node_modules \
  | grep -v "// ok\|resetAt\|comparison\|heartbeat"
```

Any `new Date()` or `Date.now()` used as a **value written to Firestore** is a violation. Fix
by replacing with `serverTimestamp()` from `firebase/firestore`.

`new Date()` used for **local comparisons** (e.g. checking if `resetAt` is before today,
computing age display strings) is acceptable — leave those.

---

### 15. Toast Singleton — Confirm Working

Confirm `Toast.tsx` exposes a global `showToast(message: string, type: 'success' | 'error' | 'info')` API that works from any file without needing a React context or prop drilling.

Acceptable patterns:
- A module-level `ref` stored in a singleton module (`toastRef`) that `Toast` registers on mount, 
  and `showToast` calls imperatively
- A Zustand micro-store for toast state

Confirm `<Toast />` (or equivalent) is rendered inside `AppRoot` in `App.tsx` so it sits above
all screens. If missing, add it.

---

### 16. Navigation Type Safety

Confirm `RootStackParamList` and `MainTabParamList` are defined and all `useNavigation()` and
`navigation.navigate()` calls are typed. No `any` navigation types.

Check `app/navigation/RootNavigator.tsx` exports `RootStackParamList`.
Check `app/navigation/MainTabNavigator.tsx` exports `MainTabParamList`.

All screen components that use `useNavigation` must import the typed prop:

```typescript
import type { StackNavigationProp } from '@react-navigation/stack'
import type { RootStackParamList } from '@/app/navigation/RootNavigator'

type MyScreenNavProp = StackNavigationProp<RootStackParamList, 'MyScreen'>
const navigation = useNavigation<MyScreenNavProp>()
```

Fix any screens using untyped `useNavigation()`.

---

### 17. Firestore Rules and Indexes — Confirm Files Exist

Confirm both files are non-empty and well-formed:

```bash
cat firestore.rules
cat firestore.indexes.json
```

`firestore.rules` must have explicit rules for:
- `/users/{userId}` — read authenticated, write only own doc, server-only fields denied
- `/swipes/{userId}/likes/{targetId}` — create own, read own or target, no update/delete
- `/swipes/{userId}/passes/{targetId}` — create own, read own, no update/delete
- `/matches/{matchId}` — read if in users array, no client write
- `/reports/{reportId}` — create own, no read/update/delete
- Default deny all

If either file is empty or missing rules for any of the above collections, restore from the
TASKS.md Task 39/40 definitions.

---

### 18. Final Compile Confirmation

After all fixes are applied, run the full audit sign-off:

```bash
# 1. TypeScript
npx tsc --noEmit

# 2. No any remaining
grep -rn ": any\|as any" --include="*.ts" --include="*.tsx" \
  app/ components/ store/ hooks/ services/ utils/ \
  | grep -v node_modules

# 3. No console.log
grep -rn "console\.log" --include="*.ts" --include="*.tsx" \
  app/ components/ store/ hooks/ services/ utils/ \
  | grep -v node_modules

# 4. No relative imports
grep -rn "from '\.\." --include="*.ts" --include="*.tsx" \
  app/ components/ store/ hooks/ services/ utils/ \
  | grep -v node_modules

# 5. No inline styles (except GestureHandlerRootView in App.tsx)
grep -rn "style={{" --include="*.tsx" app/ components/ \
  | grep -v node_modules \
  | grep -v "App.tsx"
```

All five commands must produce **zero output**. Report results for each.

---

## Acceptance Criteria

- [ ] `App.tsx` has correct provider order: `GestureHandlerRootView` → `SafeAreaProvider` → `ErrorBoundary` → `NavigationContainer` → `AppRoot`
- [ ] `i18n` imported as side-effect at top of `App.tsx` before any JSX
- [ ] Firebase config imported and guarded against duplicate init
- [ ] `SplashScreen.hideAsync()` called inside `initialise()` after first `onAuthStateChanged` fires
- [ ] `useNotifications(navigationRef)` and `useLastActive()` called inside `AppRoot` only
- [ ] `GestureHandlerRootView` appears only in `App.tsx` — confirmed by grep
- [ ] `ErrorBoundary` is a class component wrapping the navigation tree
- [ ] `npx tsc --noEmit` exits with zero errors and zero output
- [ ] Zero `: any` or `as any` in `app/`, `components/`, `store/`, `hooks/`, `services/`, `utils/`
- [ ] Zero `console.log` in same directories
- [ ] Zero relative path imports (`from '../`) in same directories
- [ ] Zero inline `style={{ }}` in `app/` and `components/` (except `GestureHandlerRootView`)
- [ ] Zero hardcoded user-visible English strings outside `i18n/` files
- [ ] `new Date()` / `Date.now()` not used as Firestore write values
- [ ] `Toast` singleton renders in `AppRoot` and `showToast()` callable from any module
- [ ] All `useNavigation()` calls are typed with `StackNavigationProp` or `BottomTabNavigationProp`
- [ ] `firestore.rules` covers all 5 required collections
- [ ] `firestore.indexes.json` has composite index for discovery query
- [ ] All five audit bash commands produce zero output

---

## Do Not Touch

`functions/` (Cloud Functions are exempt from client-side audits)  
`i18n/` JSON files (except to add missing keys from hardcoded string audit)  
`AGENTS.md`  
`firestore.rules` and `firestore.indexes.json` (only fix if content is missing/broken)  
`.env`, `.env.example`  
`app.json`

---

## Commit

```
git commit -m "task-46: final app wiring audit — zero ts errors, zero any, zero hardcoded strings"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 1F — Task 46] — YYYY-MM-DD

### Completed

- Task 46: Final app wiring audit — Phase 1 MVP complete
- App.tsx provider order confirmed and fixed where needed
- SplashScreen.hideAsync() wired correctly to onAuthStateChanged first fire
- i18n and Firebase config import order verified
- GestureHandlerRootView confirmed to appear only once (App.tsx)
- useNotifications and useLastActive confirmed inside AppRoot only
- ErrorBoundary confirmed as class component wrapping NavigationContainer
- npx tsc --noEmit passes with zero errors
- Zero `any` usage across all client-side files
- Zero console.log in app/, components/, store/, hooks/, services/, utils/
- Zero relative imports — all use @/ alias
- Zero inline styles in JSX (except GestureHandlerRootView in App.tsx)
- Zero hardcoded user-visible strings — all through t()
- Toast singleton confirmed rendering in AppRoot
- Navigation types confirmed across all screens
- firestore.rules and firestore.indexes.json confirmed complete

### Files Created / Modified

- App.tsx: [list any fixes applied]
- store/authStore.ts: [if SplashScreen.hideAsync fix applied]
- [any other files fixed during audit]

### Architecture Decisions

- SplashScreen hides inside onAuthStateChanged callback — guarantees no flash of wrong screen
- ErrorBoundary outside NavigationContainer — catches navigation-level errors
- Toast singleton uses module-level ref pattern — avoids context threading through navigator

### Known Issues / Deferred

- Background silent push for lastActive update — deferred to Phase 2
- Crashlytics integration (replace console.error in ErrorBoundary) — deferred to Phase 2
- "Upgrade Now" CTA in UpsellModal — stub, wired to Stripe in Phase 2

### Phase 1 MVP Status

✅ COMPLETE — All 46 tasks done. Ready for TestFlight + Android internal testing beta.

### Next Up

- Generate TASKS_PHASE2.md (premium/subscriptions, photo verification, fitness integrations)
- EAS Build configuration for TestFlight submission
```

---

## Reasoning Level
High — this is a correctness audit with many independent checks. Work methodically through each numbered item. Do not skip items because they "probably pass." Run every grep command. Report each finding before fixing.
