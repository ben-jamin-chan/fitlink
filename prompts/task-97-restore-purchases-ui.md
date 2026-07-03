# CODEX PROMPT — Task 97: Restore Purchases UI

@CONVENTIONS.md @ARCHITECT.md

---

## Pre-Task Dependency Check

**Required outputs from prior tasks:**
- Task 96 must have created `functions/src/restoreStripeSubscription.ts` — verify it exists
- Task 96 must have appended `restoreStripeSubscription` to `functions/src/index.ts` — verify the export is present
- The CF must return a discriminated result union:
  - `{ restored: true, tier: string, expiresAt: Timestamp }`
  - `{ restored: false, reason: 'no-customer' | 'no-active-subscription' }`

> If any listed dependency is absent: output a DEPENDENCY ERROR block at the top of your
> response, list what is missing, and do not proceed with implementation.

```
<!-- DEPENDENCY ERROR
  Missing: functions/src/restoreStripeSubscription.ts does not exist.
  Cannot proceed. Re-run Task 96 before this task.
-->
```

---

## Context

- `app/settings/PremiumScreen.tsx` — the existing premium/subscription screen. Shows pricing
  cards and subscription options for free users. This task adds a "Restore Purchases" button
  below the pricing cards, visible to free users only.
- `store/profileStore.ts` — holds `profile.premium` (the local copy of the server `premium`
  field). The restore flow must update this store directly from the CF return value so the
  UI reflects premium status immediately without an app restart.
- `services/firebase/config.ts` — exports `functions` (Firebase Functions instance) already
  initialised and pointing to `asia-southeast1`. Use this for `httpsCallable`.
- `components/ui/LoadingOverlay.tsx` — existing full-screen loading overlay component.
  Show during the CF call.
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — four language files.
  New keys must be added to all four.

**Architectural boundary:** This task makes NO changes to Cloud Functions, Firestore rules,
Firestore schema, or `functions/src/index.ts`. It is UI-only. If any CF code appears here,
that is drift — correct it.

**`profileStore` is the correct store to update** — not a hypothetical `subscriptionStore`.
The `premium` field lives on `profile` in `profileStore`, consistent with how `stripeWebhook`
writes it server-side and how the rest of the app reads it.

---

## Task 97 — Restore Purchases UI

**Files to modify:**
- `app/settings/PremiumScreen.tsx` — add "Restore Purchases" button and handler
- `store/profileStore.ts` — add `restorePremium()` action (or equivalent updater for the premium field)
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add restore i18n keys

---

### `app/settings/PremiumScreen.tsx` — Update

Add the following to the existing screen. Read the full file before making changes — do
not rewrite sections that are not part of this task.

**What to add:**

1. **New import** at the top (in the third-party section):
```typescript
import { httpsCallable } from 'firebase/functions'
```

2. **New import** for the functions instance (in the internal services section):
```typescript
import { functions } from '@/services/firebase/config'
```

3. **New local state** inside the component (alongside any existing `isLoading` state):
```typescript
const [isRestoring, setIsRestoring] = useState(false)
```

4. **New handler** inside the component:
```typescript
const handleRestorePurchases = async (): Promise<void> => {
  setIsRestoring(true)
  try {
    const restore = httpsCallable<Record<string, never>, RestoreResult>(
      functions,
      'restoreStripeSubscription'
    )
    const { data } = await restore({})

    if (data.restored) {
      restorePremium({
        tier: data.tier,
        active: true,
        expiresAt: data.expiresAt,
      })
      // Show success toast — use whatever toast utility already exists in the codebase
      // (e.g. Toast.show(), showToast(), etc. — match the existing pattern)
      showSuccessToast(t('premium.restore.success'))
    } else {
      Alert.alert(
        t('premium.restore.notFound.title'),
        t('premium.restore.notFound.message')
      )
    }
  } catch {
    Alert.alert(
      t('premium.restore.error.title'),
      t('premium.restore.error.message')
    )
  } finally {
    setIsRestoring(false)
  }
}
```

> Note on the CF error reason: both `'no-customer'` and `'no-active-subscription'` show the
> same "not found" alert to the user. Do not expose the internal reason string in any
> user-facing message. The `catch` block handles genuine CF errors (network, unhandled
> exception, unauthenticated rejection).

5. **The `RestoreResult` type** — define it locally above the component (not in `types/`
   — it is used only in this file):
```typescript
type RestoreResult =
  | { restored: true; tier: string; expiresAt: unknown }
  | { restored: false; reason: 'no-customer' | 'no-active-subscription' }
```

> `expiresAt` is typed as `unknown` here because Firestore `Timestamp` objects are
> serialised by the Firebase Functions client SDK as plain objects during transmission.
> The `restorePremium` action in the store will accept the value as-is and pass it through
> — this is consistent with how `stripeWebhook` writes `expiresAt` to the same field.
> Add an `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment if the
> linter flags this; do not use `any`.

6. **Placement of the restore button** — below the pricing cards section, above (or below)
   any existing CTA footer, visible only when the user is on the free tier:

```typescript
{!isPremium && (
  <Pressable
    style={styles.restoreButton}
    onPress={handleRestorePurchases}
    disabled={isRestoring}
  >
    <Text style={styles.restoreButtonText}>
      {t('premium.restore.button')}
    </Text>
  </Pressable>
)}
```

> `isPremium` — use whatever boolean is already derived from `profileStore` in this file
> to gate premium content. Match the existing pattern exactly.

7. **New styles** (append to the existing `StyleSheet.create({})` at the bottom — do not
   replace the existing styles):
```typescript
restoreButton: {
  alignSelf: 'center',
  marginTop: spacing.md,
  paddingVertical: spacing.xs,
  paddingHorizontal: spacing.lg,
} as ViewStyle,
restoreButtonText: {
  fontSize: typography.sizes.sm,
  color: colors.gray[400],
  textDecorationLine: 'underline',
} as TextStyle,
```

8. **LoadingOverlay** — if the file already renders `<LoadingOverlay visible={...} />`,
   add `isRestoring` as an additional condition:
```typescript
<LoadingOverlay visible={isLoading || isRestoring} />
```
   If the file does not yet have a `LoadingOverlay`, import and add one:
```typescript
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
// ...
{isRestoring && <LoadingOverlay visible />}
```

**Do not touch:** the existing pricing card layout, the existing subscribe button and its
handler, the existing premium status display logic, the `StyleSheet` entries already
present, or any navigation props.

---

### `store/profileStore.ts` — Update

Add a `restorePremium` action that updates only the `premium` field on the local profile,
without triggering a Firestore write (the CF has already written to Firestore server-side).

```typescript
// Add to the store's state actions:
restorePremium: (premium: { tier: string; active: boolean; expiresAt: unknown }) => void
```

```typescript
// Implementation inside the store's set():
restorePremium: (premium) =>
  set((state) => ({
    profile: state.profile
      ? { ...state.profile, premium: { ...premium } }
      : state.profile,
  })),
```

> This is a local-only optimistic update. If the user's `profile` is `null` for any
> reason, the action is a no-op — do not throw. The next Firestore listener refresh will
> pick up the server state regardless.

**Do not touch:** the `partialize` allowlist, the `persist` configuration, any other
store actions, or the `profile` type definition in `types/user.ts`.

---

### i18n files — Update (all four files)

Add the following keys to `i18n/en.json` under the `premium` namespace. Use the English
values as placeholders in `my.json`, `zh.json`, and `ta.json`:

```json
"premium": {
  "restore": {
    "button": "Restore Purchases",
    "success": "Your subscription has been restored.",
    "notFound": {
      "title": "No Active Subscription Found",
      "message": "We couldn't find an active subscription linked to this account. If you believe this is an error, please contact support."
    },
    "error": {
      "title": "Restore Failed",
      "message": "Something went wrong while restoring your subscription. Please try again."
    }
  }
}
```

> If a `premium` key already exists in the file, merge these keys into it — do not replace
> the existing `premium` block. Never remove or rename existing keys.

---

## Important Architecture Notes for Codex

1. **No CF code in this task.** `restoreStripeSubscription` is already deployed (Task 96).
   This task only calls it from the client. Do not modify any file in `functions/`.

2. **`profileStore` for premium state.** The `premium` field on `profile` is the single
   source of truth for subscription status in the client. The `restorePremium()` action
   updates this field locally. Do not introduce a separate store or a separate piece of
   state for subscription status.

3. **Both `no-customer` and `no-active-subscription` show the same user-facing message.**
   The internal reason discriminator is for logging/debugging only. Never surface it to
   the user.

4. **`isRestoring` is component-local state.** It is not added to the Zustand store — it
   is purely a UI loading flag for this one button press. Use `useState`.

5. **Match existing toast pattern.** Inspect `PremiumScreen.tsx` to find the toast utility
   already in use (it may be a custom `showToast`, a third-party library, or an Alert).
   Use whatever is already there — do not introduce a new toast library.

6. **`expiresAt` serialisation.** Firebase callable functions serialise Firestore
   `Timestamp` values as plain `{ seconds, nanoseconds }` objects during transit. The
   `restorePremium` action accepts this as-is and stores it on `profile.premium.expiresAt`.
   This matches the existing shape written by `stripeWebhook`. Do not attempt to
   reconstruct a `Timestamp` instance on the client.

---

## Rollback Protocol

If `npx tsc --noEmit` produces errors that cannot be resolved without:
- Modifying a file in the "Do Not Touch" list, OR
- Making an assumption about `restoreStripeSubscription`'s return shape that cannot be
  verified from `functions/src/restoreStripeSubscription.ts`

**Then:**
1. Do not commit any partial changes
2. Revert all files touched in this session to their state at session start
3. Output a `<!-- ROLLBACK REPORT -->` block listing the conflict and what is needed
4. Stop. Do not attempt a workaround.

---

## Codex Self-Check (Run Before Declaring Done)

**TypeScript**
- [ ] `npx tsc --noEmit` — zero errors in root
- [ ] Zero `any` types introduced
- [ ] Zero type assertions (`as X`) without an explanatory comment

**Conventions**
- [ ] Zero `console.log` / `console.error` / `console.warn` in any client file
- [ ] Zero inline styles — `style={{ }}` does not appear in any JSX
- [ ] Zero relative imports — `../../` does not appear in touched files
- [ ] All new user-facing strings added to all 4 i18n files (en, my, zh, ta)
- [ ] All new style values use `colors`, `spacing`, `typography` from `constants/theme`

**Firebase / Security**
- [ ] No server-only fields written from the client
- [ ] No files in `functions/` were modified
- [ ] `httpsCallable` is used correctly — the CF is called with an empty payload `{}`

**Architecture**
- [ ] `restorePremium()` action updates only `profile.premium` — no other store fields touched
- [ ] `isRestoring` is `useState`, not a Zustand store field
- [ ] `partialize` allowlist in `profileStore` was not modified
- [ ] Both `no-customer` and `no-active-subscription` reasons show the same user-facing message
- [ ] "Restore Purchases" button is only rendered when the user is on the free tier

**Platform**
- [ ] Ask: "Would this break on Android?" — answer must be No
- [ ] Ask: "Would this break on iOS?" — answer must be No

---

## Acceptance Criteria

- [ ] "Restore Purchases" text button renders below pricing cards on `PremiumScreen` for free users only
- [ ] Button is not visible when the user already has an active premium subscription
- [ ] Tapping the button shows `LoadingOverlay` (or equivalent) for the duration of the CF call
- [ ] On `restored: true`: `profileStore.profile.premium` is updated locally; success toast shown; premium UI renders without app restart
- [ ] On `restored: false` (either reason): `Alert` with `t('premium.restore.notFound.title')` and `t('premium.restore.notFound.message')` is shown; the internal reason is not surfaced to the user
- [ ] On CF error (network, auth, etc.): `Alert` with `t('premium.restore.error.title')` and `t('premium.restore.error.message')` is shown; no crash
- [ ] `restorePremium()` action added to `profileStore`; it updates only `profile.premium`; it is a no-op if `profile` is null
- [ ] All 4 i18n keys (`premium.restore.button`, `.success`, `.notFound.*`, `.error.*`) present in all 4 language files
- [ ] `npx tsc --noEmit` — zero errors after this task

---

## Do Not Touch

`functions/` (entire directory — no CF changes in this task),
`firestore.rules`,
`firestore.indexes.json`,
`types/user.ts` (do not change the `premium` type definition),
`store/authStore.ts`,
`services/firebase/config.ts`,
`constants/` (do not add or modify theme tokens),
`i18n/` existing keys (additions only — never remove or rename)

---

## Commit

```
git commit -m "task-97: restore purchases UI on PremiumScreen"
```

---

## After This Session

Update `CHANGELOG.md` using this exact template:

```
## [Phase 4C — Task 97] — YYYY-MM-DD

### Completed

- Task 97: Restore Purchases UI
- Added "Restore Purchases" button to PremiumScreen (free users only)
- Added restorePremium() action to profileStore for local premium state update
- Wired httpsCallable to restoreStripeSubscription CF with correct result handling

### Files Created

- None

### Files Modified

- app/settings/PremiumScreen.tsx: added Restore Purchases button, handler, isRestoring state, RestoreResult type, new styles
- store/profileStore.ts: added restorePremium() action
- i18n/en.json: added premium.restore.* keys
- i18n/my.json: added premium.restore.* keys (EN placeholders)
- i18n/zh.json: added premium.restore.* keys (EN placeholders)
- i18n/ta.json: added premium.restore.* keys (EN placeholders)

### Architecture Decisions

- [Any non-obvious choice — e.g. which toast utility was matched, how expiresAt was handled]

### Conflict Risks Introduced

- app/settings/PremiumScreen.tsx modified — note if any upcoming task also touches this file
- None — if no conflicts are anticipated

### Known Issues / Deferred

- None

### Next Up

- Task 98: deleteAccount Cloud Function (Phase 4D — independent of Phase 4C)
```

Then come to claude.ai with the updated CHANGELOG.md and request the next task prompt.
Attach specific modified files only if: tsc failed, the next task touches the same files,
or Codex produced unexpected output.

---

## Reasoning Level

Low
