# CODEX PROMPT — Task 38
# Settings Screen

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 1E is nearly complete. Task 37 (EditProfileScreen) shipped. Relevant existing files:

- `store/authStore.ts` — `logout()` clears auth state, signs out Firebase, clears AsyncStorage; `user` holds `FirebaseUser | null`
- `store/profileStore.ts` — `profile: UserProfile | null`, `updateProfile(partial)` writes to Firestore; `reset()` clears local state
- `services/firebase/auth.ts` — `signOut(): Promise<void>`, `deleteAccount(): Promise<void>` (or similar — check actual export; if delete is missing, add it in `auth.ts` as part of this task)
- `services/firebase/firestore.ts` — `updateUserProfile(uid, data)` available
- `services/notifications.ts` — `registerForPushNotifications(): Promise<boolean>` exists (Task 42 stub or real)
- `components/ui/Button.tsx` — primary / outline / ghost variants, loading state
- `components/ui/Toast.tsx` — `showToast(message, type)` available globally
- `app/navigation/MainTabNavigator.tsx` — Settings tab is inside `ProfileStackNavigator`; `SettingsScreen` is currently a placeholder
- `i18n/en.json` — `settings.*` keys not yet added; this task seeds them
- `constants/theme.ts` — `colors`, `spacing`, `typography` all available
- `hooks/useLastActive.ts` — exists; no changes needed here

**Task 37 architecture note (important for Task 38):**
EditProfileScreen is navigated to from ProfileScreen, which lives in `ProfileStackNavigator`. The Settings tab in MainTabNavigator is the **fourth bottom tab** and uses its own stack. SettingsScreen is reached by tapping the Settings tab directly — it is **not** pushed from ProfileScreen's stack. Do not change this routing.

---

## Task 38 — Settings Screen

**Files to create:**
- `app/settings/SettingsScreen.tsx`
- `components/settings/SettingsSection.tsx`
- `components/settings/SettingsRow.tsx`
- `app/settings/DeleteAccountScreen.tsx`

**Files to modify:**
- `app/navigation/MainTabNavigator.tsx` — replace Settings tab placeholder with `SettingsScreen` (and add `DeleteAccount` route to its stack)
- `services/firebase/auth.ts` — add `deleteAccount()` if not already present
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add `settings.*` keys

---

## Detailed Spec

### `components/settings/SettingsSection.tsx`

Section wrapper with a section title above a bordered group of rows. Handles visual grouping — Danger Zone section has red title text.

```typescript
interface SettingsSectionProps {
  title: string
  children: React.ReactNode
  danger?: boolean          // if true, title color is colors.danger
}
```

- Title: small caps style (`typography.sizes.sm`, `fontWeight: semibold`, `colors.gray[500]`, uppercase via `textTransform`)
- If `danger === true`: title uses `colors.danger` instead
- Children rendered inside a white surface card with `borderRadius.md`, thin border `colors.gray[200]`, overflow hidden

---

### `components/settings/SettingsRow.tsx`

Single row inside a section. Flexible — used for navigation arrows, toggles, destructive actions, and info-only display.

```typescript
type SettingsRowVariant = 'navigate' | 'toggle' | 'destructive' | 'info'

interface SettingsRowProps {
  label: string
  variant?: SettingsRowVariant        // default: 'navigate'
  value?: string                      // right-side value text (info rows)
  isEnabled?: boolean                 // for toggle rows
  onToggle?: (val: boolean) => void   // for toggle rows
  onPress?: () => void                // for navigate/destructive rows
  icon?: keyof typeof Ionicons.glyphMap  // optional left icon
  iconColor?: string                  // defaults to colors.gray[600]
  disabled?: boolean
  isLast?: boolean                    // omits bottom border divider on last row in group
}
```

- Left: optional Ionicons icon + label text (dark, `typography.sizes.md`)
- Right:
  - `navigate`: value text (gray) + chevron-forward icon
  - `toggle`: `Switch` component (thumb color `colors.primary`)
  - `destructive`: label text in `colors.danger`, no right element
  - `info`: value text only, no chevron, no press handler
- Separator line between rows (omit if `isLast`)
- No inline styles. All from StyleSheet.

---

### `app/settings/SettingsScreen.tsx`

Full settings screen. `ScrollView` with `SettingsSection` + `SettingsRow` groups.

#### Section 1 — Account

| Row | Type | Behaviour |
|---|---|---|
| Phone Number | `info` | Shows `user.phoneNumber` (from Firebase `auth.currentUser`). Non-editable. |
| Email | `info` | Shows `user.email` or `t('settings.account.noEmail')`. Non-editable. |
| Language | `navigate` | Shows current language name. Opens a language picker modal (inline `Modal` or `ActionSheet`). See Language Picker below. |
| Log Out | `destructive` | Confirmation `Alert`, then `authStore.logout()`. |

#### Section 2 — Discovery Preferences

These are inline-editable. Changes call `profileStore.updateProfile()` immediately (no Save button — auto-save on change).

| Row | Type | Behaviour |
|---|---|---|
| Pause Profile | `toggle` | Reads `profile.paused`. On toggle: `updateProfile({ paused: !current })`. Show toast: `t('settings.discovery.pausedOn')` or `t('settings.discovery.pausedOff')`. |
| Age Range | `navigate` | Shows "18 – 35". Navigates to inline bottom sheet or modal with dual sliders (min 18, max 60). On confirm: `updateProfile({ preferences: { ...preferences, ageRange: { min, max } } })`. |
| Distance | `navigate` | Shows "50 km". Opens modal with single slider (5–100 km). On confirm: `updateProfile({ preferences: { ...preferences, distanceKm: value } })`. |
| Gender Preference | `navigate` | Shows selected genders joined by comma. Opens modal with `MultiSelect` from Step 3. On confirm: `updateProfile({ preferences: { ...preferences, genders: selected } })`. |
| Looking For | `navigate` | Shows selected items joined by comma. Opens modal with MultiSelect (Friends, Workout Partners, Dating). On confirm: `updateProfile({ lookingFor: selected })`. |

**Discovery preference modals** share a common pattern:
- `Modal` with `animationType="slide"` from bottom
- Title + control (slider or MultiSelect)
- "Done" button closes modal and fires `updateProfile`
- Never nest two Modals — use local `useState<'ageRange' | 'distance' | 'genderPref' | 'lookingFor' | null>` for `activeModal`

#### Section 3 — Notifications

Push notification preferences stored in `AsyncStorage` under key `notificationPrefs`. Reads on mount, writes on toggle.

```typescript
interface NotificationPrefs {
  pushEnabled: boolean
  newMatches: boolean
  newMessages: boolean
}
```

| Row | Type | Behaviour |
|---|---|---|
| Push Notifications | `toggle` | Master toggle. If enabling and permission not granted: calls `registerForPushNotifications()`. If denied, show alert directing user to Settings (`Linking.openSettings()`). Does NOT cascade-disable child toggles in UI — just saves `pushEnabled: false`. |
| New Matches | `toggle` | Only shown if `pushEnabled`. Saves to `notificationPrefs`. |
| New Messages | `toggle` | Only shown if `pushEnabled`. Saves to `notificationPrefs`. |

#### Section 4 — Privacy

| Row | Type | Behaviour |
|---|---|---|
| Show Me on fitlink | `toggle` | Alias for `paused` — same as Pause Profile. Show both for discoverability; they must stay in sync (same `updateProfile` call). When toggled OFF: show/hide modal with the same warning text. |
| Blocked Users | `navigate` | Shows "(n) blocked". For Phase 1 this is a stub — navigates to a simple screen showing "No blocked users" placeholder. |

#### Section 5 — Subscription

**If `profile.subscription.tier === 'free'`:**
- Gradient banner card (green → blue, `expo-linear-gradient`), "Upgrade to Premium" headline, short benefits list, "Upgrade Now" `Button` → stub `Alert` for Phase 2.

**If `profile.subscription.tier === 'premium'`:**
- Row: "Plan" → `info` → "Premium"
- Row: "Renews" → `info` → formatted expiry date (if `subscription.expiresAt` exists — use `toDate().toLocaleDateString()`)
- Row: "Manage Subscription" → `navigate` → stub `Alert` for Phase 2

#### Section 6 — Support

| Row | Behaviour |
|---|---|
| Help Centre | `Linking.openURL('https://help.fitlink.app')` |
| Contact Us | `Linking.openURL('mailto:support@fitlink.app?subject=Support%20Request')` |
| Rate fitlink | `Linking.openURL(Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL)` — define both as constants at top of file with placeholder values |
| Terms of Service | `Linking.openURL('https://fitlink.app/terms')` |
| Privacy Policy | `Linking.openURL('https://fitlink.app/privacy')` |
| App Version | `info` row, value from `Constants.expoConfig?.version ?? '1.0.0'` (import `Constants` from `expo-constants`) |

#### Section 7 — Danger Zone

Title in `colors.danger`. One row:

| Row | Behaviour |
|---|---|
| Delete Account | `destructive`. Alert confirmation: Title `t('settings.danger.deleteTitle')`, message `t('settings.danger.deleteMessage')`. If confirmed: navigate to `DeleteAccountScreen`. |

---

### Language Picker Modal

Triggered from Account → Language row. Inline `Modal` (not a new screen).

Languages:
```typescript
const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ms', label: 'Bahasa Melayu', flag: '🇲🇾' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'ta', label: 'தமிழ்', flag: '🇮🇳' },
] as const
```

On select:
1. Call `i18n.changeLanguage(code)` — applies immediately, no restart
2. Call `profileStore.updateProfile({ language: code })` — persists to Firestore
3. Close modal

Current language shown with a checkmark. Modal has a "Cancel" button.

---

### `app/settings/DeleteAccountScreen.tsx`

A focused, simple screen. Not a modal — a real stack screen.

**Layout:**
1. Warning icon (Ionicons `warning-outline`, large, `colors.danger`)
2. Headline: `t('settings.danger.deleteScreen.title')` — "Delete Your Account"
3. Bulleted list of what will be deleted:
   - Your profile and photos
   - All your matches and messages
   - Your subscription (no refund)
4. Confirmation: `TextInput` requiring user to type `"DELETE"` to unlock the button (case-sensitive). Show helper text: `t('settings.danger.deleteScreen.typeToConfirm')` — "Type DELETE to confirm".
5. "Permanently Delete Account" `Button` (variant `primary`, background `colors.danger`):
   - Only enabled when input === `'DELETE'`
   - On press: show `LoadingOverlay`
   - Call `deleteAccount()` from `services/firebase/auth.ts`
   - On success: `authStore.logout()` — `RootNavigator` redirects to auth automatically
   - On error: hide overlay, show `Toast` with error message

**`deleteAccount()` in `services/firebase/auth.ts`** (add if missing):
```typescript
export const deleteAccount = async (): Promise<void> => {
  const user = auth.currentUser
  if (!user) throw new AppError('auth/no-user', 'No authenticated user')

  const uid = user.uid

  // 1. Delete all photos from Storage
  //    Best-effort — don't throw if files are missing
  try {
    const storageRef = ref(storage, `users/${uid}/photos`)
    // List and delete — Firebase Storage listAll
    const list = await listAll(storageRef)
    await Promise.all(list.items.map((item) => deleteObject(item)))
  } catch (_) {
    // Non-fatal — Firestore cleanup is more important
  }

  // 2. Delete Firestore user document
  await deleteDoc(doc(db, 'users', uid))

  // 3. Delete Firebase Auth account (must be last — loses auth context)
  await user.delete()
}
```

> **Note:** Firestore security rules allow users to delete their own `/users/{uid}` doc. Matches and swipes subcollections are cleaned up by a Cloud Function trigger in Phase 2. For Phase 1, note this limitation with a `// TODO Phase 2: onUserDeleted Cloud Function cleans up matches, swipes, chats` comment.

---

### `app/navigation/MainTabNavigator.tsx` — Update

The Settings tab currently has a placeholder. Replace it with a `SettingsStackNavigator`:

```typescript
// New stack for the Settings tab
const SettingsStack = createStackNavigator<SettingsStackParamList>()

type SettingsStackParamList = {
  Settings: undefined
  DeleteAccount: undefined
}

const SettingsStackNavigator = (): React.JSX.Element => (
  <SettingsStack.Navigator screenOptions={{ headerShown: false }}>
    <SettingsStack.Screen name="Settings" component={SettingsScreen} />
    <SettingsStack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
  </SettingsStack.Navigator>
)
```

Replace the Settings tab's `component` with `SettingsStackNavigator`.

---

### i18n Keys to Add

Add to **all four** locale files (`en.json`, `my.json`, `zh.json`, `ta.json`). Non-English files use the English value as placeholder.

```json
{
  "settings": {
    "title": "Settings",
    "account": {
      "title": "Account",
      "phone": "Phone Number",
      "email": "Email",
      "noEmail": "Not set",
      "language": "Language",
      "logout": "Log Out",
      "logoutConfirm": "Are you sure you want to log out?",
      "logoutTitle": "Log Out"
    },
    "discovery": {
      "title": "Discovery",
      "pause": "Pause Profile",
      "pausedOn": "Profile paused — you're hidden from discovery",
      "pausedOff": "Profile visible — you're back in discovery",
      "ageRange": "Age Range",
      "distance": "Distance",
      "genderPref": "Gender Preference",
      "lookingFor": "Looking For",
      "km": "{{value}} km",
      "ageRangeValue": "{{min}} – {{max}}",
      "done": "Done"
    },
    "notifications": {
      "title": "Notifications",
      "push": "Push Notifications",
      "matches": "New Matches",
      "messages": "New Messages",
      "permissionDenied": "Enable notifications in your device Settings to receive alerts.",
      "openSettings": "Open Settings"
    },
    "privacy": {
      "title": "Privacy",
      "showMe": "Show Me on fitlink",
      "blockedUsers": "Blocked Users",
      "blockedCount": "{{count}} blocked",
      "noBlocked": "No blocked users"
    },
    "subscription": {
      "title": "Subscription",
      "upgrade": "Upgrade to Premium",
      "upgradeSubtitle": "Unlimited likes, see who liked you, and more.",
      "upgradeButton": "Upgrade Now",
      "plan": "Plan",
      "planPremium": "Premium",
      "renews": "Renews",
      "manage": "Manage Subscription",
      "comingSoon": "Subscription management coming soon."
    },
    "support": {
      "title": "Support",
      "helpCentre": "Help Centre",
      "contactUs": "Contact Us",
      "rate": "Rate fitlink",
      "terms": "Terms of Service",
      "privacy": "Privacy Policy",
      "version": "App Version"
    },
    "danger": {
      "title": "Danger Zone",
      "deleteAccount": "Delete Account",
      "deleteTitle": "Delete Account?",
      "deleteMessage": "This will permanently delete your profile, matches, and messages. This action cannot be undone.",
      "deleteScreen": {
        "title": "Delete Your Account",
        "whatDeleted": "The following will be permanently deleted:",
        "item1": "Your profile and photos",
        "item2": "All your matches and messages",
        "item3": "Your subscription (non-refundable)",
        "typeToConfirm": "Type DELETE to confirm",
        "confirmButton": "Permanently Delete Account",
        "placeholder": "Type DELETE here"
      }
    }
  }
}
```

---

## Architecture Constraints

1. **No inline styles.** Every style in `StyleSheet.create({})`.
2. **No hardcoded strings.** All text via `useTranslation()`.
3. **Discovery preference modals use a single `activeModal` state string** — never nest two `Modal` components.
4. **`Switch` component**: use React Native's built-in `Switch`. Set `trackColor={{ true: colors.primary }}` and `thumbColor={colors.white}`.
5. **`updateProfile` calls are fire-and-forget** in discovery preference toggles — catch errors and show `Toast`, but don't block UI.
6. **Language change is instant** — `i18n.changeLanguage(code)` applies before modal closes.
7. **`deleteAccount` flow**: Storage → Firestore → Firebase Auth (in that order). Auth deletion must be last.
8. **DeleteAccountScreen is a stack screen** (not a modal) so it gets a safe-area header with a back button — use `navigation.goBack()` as close gesture.
9. **Notification prefs in AsyncStorage only** — not Firestore. These are device-local. Key: `'@fitlink/notificationPrefs'`.
10. **Log Out confirmation** uses `Alert.alert` — two buttons: Cancel and "Log Out" (destructive style).
11. **`Linking.openURL` calls** should be wrapped in `try/catch`; on error show `Toast` with `t('errors.generic')`.

---

## Acceptance Criteria

- [ ] `SettingsSection` and `SettingsRow` components created with correct variant rendering
- [ ] All 7 sections render with correct rows
- [ ] Pause Profile toggle reads and writes `profile.paused` via `profileStore.updateProfile()`
- [ ] Discovery preference modals open, show current values, and save on Done
- [ ] Language picker changes language immediately (`i18n.changeLanguage`) and saves to Firestore
- [ ] Push notification master toggle requests permission if not granted; shows alert if denied
- [ ] Granular notification toggles only visible when `pushEnabled: true`
- [ ] Notification prefs persist to AsyncStorage across sessions
- [ ] Subscription section shows correct state for free vs premium tier
- [ ] Support rows open correct external URLs
- [ ] App Version row shows real version string from `expo-constants`
- [ ] Log Out: Alert confirmation → `authStore.logout()` → RootNavigator redirects to auth
- [ ] Delete Account: navigates to `DeleteAccountScreen`
- [ ] `DeleteAccountScreen`: "DELETE" text gate works, button disabled until correct input
- [ ] `deleteAccount()`: Storage (best-effort) → Firestore doc → Firebase Auth → `authStore.logout()`
- [ ] `SettingsStackParamList` typed correctly in `MainTabNavigator`
- [ ] All i18n keys added to all four locale files
- [ ] Zero inline styles
- [ ] `tsc --noEmit` passes with zero errors

---

## Do Not Touch

`store/authStore.ts` (except reading `user`), `store/profileStore.ts` (except calling `updateProfile` and reading `profile`), `store/discoveryStore.ts`, `store/matchStore.ts`, `store/chatStore.ts`, `components/ui/`, `app/profile/ProfileScreen.tsx`, `app/profile/EditProfileScreen.tsx`, `app/navigation/AuthNavigator.tsx`, `app/navigation/RootNavigator.tsx`, `types/`, `constants/`, `utils/`, `functions/`, `firestore.rules`

---

## Commit

```
git commit -m "task-38: settings screen with discovery prefs, notifications, language picker, danger zone"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 1E — Task 38] — YYYY-MM-DD

### Completed

- Task 38: SettingsScreen — 7 sections: account, discovery, notifications, privacy, subscription, support, danger zone
- DeleteAccountScreen — typed DELETE gate, storage + Firestore + Auth deletion chain
- SettingsSection + SettingsRow shared components (navigate / toggle / destructive / info variants)
- Language picker modal — i18n.changeLanguage + profileStore.updateProfile
- Discovery preference modals (age range, distance, gender pref, looking for)
- Notification prefs in AsyncStorage (pushEnabled, newMatches, newMessages)
- deleteAccount() added to services/firebase/auth.ts

### Files Created / Modified

- app/settings/SettingsScreen.tsx: full 7-section settings screen
- app/settings/DeleteAccountScreen.tsx: DELETE confirmation gate, deletion chain
- components/settings/SettingsSection.tsx: section wrapper with optional danger styling
- components/settings/SettingsRow.tsx: navigate / toggle / destructive / info variants
- app/navigation/MainTabNavigator.tsx: Settings tab replaced with SettingsStackNavigator (Settings → DeleteAccount)
- services/firebase/auth.ts: deleteAccount() added (Storage + Firestore + Auth)
- i18n/en.json, my.json, zh.json, ta.json: settings.* keys added

### Architecture Decisions

- Single `activeModal` string state manages all discovery preference modals — no nested Modals
- Notification prefs stored in AsyncStorage only (device-local, not Firestore)
- deleteAccount() order: Storage (best-effort) → Firestore → Firebase Auth — Auth last to preserve uid access
- Language change applies immediately via i18n.changeLanguage before modal close
- SettingsStack wraps Settings tab so DeleteAccount pushes without dismissing tab bar

### Known Issues / Deferred

- Match/swipe/chat cleanup on account deletion deferred to Phase 2 onUserDeleted Cloud Function
- Photo drag-to-reorder not in scope (Phase 2)
- Subscription management (Stripe portal) is a stub — Phase 2

### Next Up

- Task 39: Firestore security rules
```

---

## Reasoning Level
High — significant UI surface area, multi-modal state management, auth deletion chain, cross-cutting concerns (i18n, storage, Firestore, AsyncStorage).
