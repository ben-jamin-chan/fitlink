# Codex Prompt — Task 99: Delete Account Screen

@CONVENTIONS.md @ARCHITECT.md

---

## Pre-Task Dependency Check

**Required outputs from prior tasks:**

- Task 98 must have created `functions/src/deleteAccount.ts` — verify the file exists
- Task 98 must have appended `deleteAccount` to `functions/src/index.ts` — verify the export is present
- Task 97 must have exported `functions` from `services/firebase/config.ts` — verify this export is present (used by the callable invocation below)

If any listed dependency is absent: output a DEPENDENCY ERROR block at the top of your response, list what is missing, and do not proceed with implementation.

```
<!-- DEPENDENCY ERROR
  Missing: [describe what is absent]
  Cannot proceed. Re-run the relevant prior task before this task.
-->
```

---

## Context

- `functions/src/deleteAccount.ts` — callable CF that executes the full PDPA deletion sequence (Stripe cancel-at-period-end → Firestore subcollections → user doc → swipes → matches → gym check-ins → Storage → RTDB → Firebase Auth last); returns `{ success: true }`
- `services/firebase/config.ts` — exports `auth`, `db`, `functions` (region-pinned to `asia-southeast1`); use the shared `functions` export for `httpsCallable`, do not create an ad hoc `getFunctions()` instance
- `services/firebase/auth.ts` — contains `signOut`, `sendOTP` / `signInWithPhoneNumber` wrappers; reference for the correct phone re-auth call signature
- `store/authStore.ts` — holds `isAuthenticated`, `hasCompletedOnboarding`; exposes a `reset()` or equivalent clear action
- `store/profileStore.ts` — holds the user profile; added `restorePremium()` in Task 97; exposes a `reset()` or equivalent clear action
- `store/discoveryStore.ts`, `store/matchStore.ts`, `store/chatStore.ts` — each exposes a `reset()` or equivalent clear action; verify the exact action name by reading each store file before using it
- `app/settings/SettingsScreen.tsx` — the entry point; may already have a "Delete Account" row in a Danger Zone section; wire it if present, add it if absent
- `app/navigation/` — the settings stack navigator that must receive the new `DeleteAccountScreen`; identify the correct navigator file by reading the navigation folder
- `i18n/en.json` — add all `deleteAccount.*` keys here and mirror to the other three language files

**Architectural boundaries — read before writing any code:**

**No Firestore writes from this screen.** The `deleteAccount` CF handles all data removal server-side. The client only calls the CF and reacts to the result.

**Re-authentication is mandatory.** The delete button must remain disabled until re-auth has explicitly succeeded. Do not infer re-auth success from any other state. Use a `reAuthComplete: boolean` local state flag set to `true` only inside the success callback of the re-auth call.

**Navigation after deletion must replace the entire stack.** Use `navigation.reset({ index: 0, routes: [{ name: 'Welcome' }] })` (or the equivalent root reset for your navigator structure) — not `navigate`, not `goBack`. The user must not be able to press Back after deletion.

**Store clearing happens client-side after CF success.** Call each store's `reset()` action, then `auth.signOut()`, then `AsyncStorage.clear()`, in that order, before navigating.

**`functions/src/index.ts` is append-only** — do not touch it in this task; Task 99 adds no new Cloud Functions.

---

## Task 99 — Delete Account Screen

**Files to create:**
- `app/settings/DeleteAccountScreen.tsx`

**Files to modify:**
- `app/settings/SettingsScreen.tsx` — add/wire "Delete Account" row in Danger Zone section
- `app/navigation/[settings stack file]` — register `DeleteAccountScreen`
- `i18n/en.json` — add `deleteAccount.*` keys
- `i18n/my.json` — mirror keys (English placeholder values)
- `i18n/zh.json` — mirror keys (English placeholder values)
- `i18n/ta.json` — mirror keys (English placeholder values)

---

### `app/settings/DeleteAccountScreen.tsx`

This is the PDPA-compliant account deletion screen. It is a default export (screen-level component). It is structured in three sequential sections: what will be deleted, re-authentication, and final confirmation.

The screen uses a `ScrollView` so the confirmation section is reachable on small screens after the re-auth section expands.

```typescript
import React, { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Alert,
  Pressable,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { httpsCallable } from 'firebase/functions'
import {
  PhoneAuthProvider,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth'
import AsyncStorage from '@react-native-async-storage/async-storage'

import { useAuthStore } from '@/store/authStore'
import { useProfileStore } from '@/store/profileStore'
import { useDiscoveryStore } from '@/store/discoveryStore'
import { useMatchStore } from '@/store/matchStore'
import { useChatStore } from '@/store/chatStore'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { auth, functions } from '@/services/firebase/config'
import { colors, spacing, typography } from '@/constants/theme'

// IMPORTANT: Read each store file to confirm the exact name of its clear/reset action
// before finalising imports. The action is likely named reset() on each store.
// Replace the placeholder action names below with the real ones found in the store files.

type ReAuthMethod = 'phone' | 'google' | 'email' | 'unknown'

// Detect which provider the current user authenticated with.
// Firebase Auth user has a providerData array; use the first entry's providerId.
const getReAuthMethod = (): ReAuthMethod => {
  const user = auth.currentUser
  if (!user) return 'unknown'
  const providerId = user.providerData[0]?.providerId ?? ''
  if (providerId === 'phone') return 'phone'
  if (providerId === 'google.com') return 'google'
  if (providerId === 'password') return 'email'
  return 'unknown'
}

export default function DeleteAccountScreen(): React.JSX.Element {
  const { t } = useTranslation()

  // Re-auth state
  const [reAuthComplete, setReAuthComplete] = useState(false)
  const [reAuthMethod] = useState<ReAuthMethod>(getReAuthMethod)

  // Phone re-auth state
  const [phoneOtp, setPhoneOtp] = useState('')
  const [phoneVerificationId, setPhoneVerificationId] = useState<string | null>(null)
  const [otpSent, setOtpSent] = useState(false)

  // Email re-auth state
  const [emailPassword, setEmailPassword] = useState('')

  // Confirmation text state
  const [confirmText, setConfirmText] = useState('')

  // Loading states
  const [reAuthLoading, setReAuthLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Store reset actions — verify exact action names against each store file
  const resetAuth = useAuthStore((s) => s.reset)
  const resetProfile = useProfileStore((s) => s.reset)
  const resetDiscovery = useDiscoveryStore((s) => s.reset)
  const resetMatch = useMatchStore((s) => s.reset)
  const resetChat = useChatStore((s) => s.reset)

  // ─── Re-auth: Phone ─────────────────────────────────────────────────────────

  const handleSendOtp = async (): Promise<void> => {
    const user = auth.currentUser
    if (!user?.phoneNumber) return
    setReAuthLoading(true)
    try {
      // Use the existing signInWithPhoneNumber pattern from services/firebase/auth.ts
      // Pass a null recaptcha verifier for re-auth (Firebase Auth handles it internally
      // when called on an already-authenticated session via reauthenticateWithPhoneNumber).
      // If the project uses a specific RecaptchaVerifier setup, replicate it here.
      const provider = new PhoneAuthProvider(auth)
      // <!-- ARCHITECT NOTE: PhoneAuthProvider.verifyPhoneNumber requires a RecaptchaVerifier.
      // Read services/firebase/auth.ts to see how the existing sendOTP call is wired and
      // replicate that verifier setup here. If the verifier is created inline there, do the same. -->
      const verificationId = await provider.verifyPhoneNumber(
        user.phoneNumber,
        // Replace with the RecaptchaVerifier instance used in services/firebase/auth.ts
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        null as any // placeholder — replace with real verifier; add ARCHITECT NOTE comment
      )
      setPhoneVerificationId(verificationId)
      setOtpSent(true)
    } catch {
      Alert.alert(t('deleteAccount.reAuth.errorTitle'), t('deleteAccount.reAuth.sendOtpError'))
    } finally {
      setReAuthLoading(false)
    }
  }

  const handleVerifyOtp = async (): Promise<void> => {
    if (!phoneVerificationId || phoneOtp.length < 6) return
    setReAuthLoading(true)
    try {
      const credential = PhoneAuthProvider.credential(phoneVerificationId, phoneOtp)
      await reauthenticateWithCredential(auth.currentUser!, credential)
      setReAuthComplete(true)
    } catch {
      Alert.alert(t('deleteAccount.reAuth.errorTitle'), t('deleteAccount.reAuth.invalidOtp'))
    } finally {
      setReAuthLoading(false)
    }
  }

  // ─── Re-auth: Google ─────────────────────────────────────────────────────────

  const handleGoogleReAuth = async (): Promise<void> => {
    setReAuthLoading(true)
    try {
      // Read services/firebase/auth.ts for the GoogleSignin import and signIn pattern.
      // The pattern is: GoogleSignin.signIn() → GoogleAuthProvider.credential(idToken) →
      // reauthenticateWithCredential(auth.currentUser, credential)
      // Replicate that exact pattern here. Import GoogleSignin from
      // @react-native-google-signin/google-signin and GoogleAuthProvider from firebase/auth.
      // <!-- ARCHITECT NOTE: import GoogleSignin and GoogleAuthProvider;
      // replicate the existing signInWithGoogle pattern from auth.ts for re-auth. -->
      throw new Error('Google re-auth: replace this placeholder with the real implementation')
    } catch {
      Alert.alert(t('deleteAccount.reAuth.errorTitle'), t('deleteAccount.reAuth.googleError'))
    } finally {
      setReAuthLoading(false)
    }
  }

  // ─── Re-auth: Email ──────────────────────────────────────────────────────────

  const handleEmailReAuth = async (): Promise<void> => {
    const user = auth.currentUser
    if (!user?.email || !emailPassword) return
    setReAuthLoading(true)
    try {
      const credential = EmailAuthProvider.credential(user.email, emailPassword)
      await reauthenticateWithCredential(user, credential)
      setReAuthComplete(true)
    } catch {
      Alert.alert(t('deleteAccount.reAuth.errorTitle'), t('deleteAccount.reAuth.wrongPassword'))
    } finally {
      setReAuthLoading(false)
    }
  }

  // ─── Final deletion ──────────────────────────────────────────────────────────

  const handleDeletePress = (): void => {
    Alert.alert(
      t('deleteAccount.finalConfirm.title'),
      t('deleteAccount.finalConfirm.message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('deleteAccount.finalConfirm.deleteButton'),
          style: 'destructive',
          onPress: () => void handleConfirmedDelete(),
        },
      ]
    )
  }

  const handleConfirmedDelete = async (): Promise<void> => {
    setDeleteLoading(true)
    try {
      const deleteAccount = httpsCallable<Record<string, never>, { success: boolean }>(
        functions,
        'deleteAccount'
      )
      await deleteAccount({})

      // Clear all client state in order: stores → auth → AsyncStorage → navigate
      resetAuth()
      resetProfile()
      resetDiscovery()
      resetMatch()
      resetChat()
      await auth.signOut()
      await AsyncStorage.clear()

      // Replace the entire navigation stack so the user cannot navigate back
      // Read the root navigator to confirm the exact screen name for WelcomeScreen/LandingScreen.
      // Use navigation.reset() — not navigate() or goBack().
      // <!-- ARCHITECT NOTE: import useNavigation with the correct ParamList type for the
      // root navigator. The reset target must be the pre-auth landing screen (WelcomeScreen
      // or LandingScreen — whichever is the root unauthenticated screen in RootNavigator).
      // The RootNavigator re-renders on authStore state change, so the reset and the store
      // clear together ensure the user lands on the auth flow. -->
    } catch {
      setDeleteLoading(false)
      Alert.alert(t('deleteAccount.error.title'), t('deleteAccount.error.message'))
    }
    // Note: do not set deleteLoading(false) on success — the screen will unmount on navigation
  }

  // ─── Render helpers ──────────────────────────────────────────────────────────

  const deleteEnabled = reAuthComplete && confirmText === 'DELETE'

  const renderReAuthSection = (): React.JSX.Element => {
    if (reAuthComplete) {
      return (
        <View style={styles.reAuthComplete}>
          <Text style={styles.reAuthCompleteText}>{t('deleteAccount.reAuth.verified')}</Text>
        </View>
      )
    }

    if (reAuthMethod === 'phone') {
      return (
        <View style={styles.reAuthSection}>
          <Text style={styles.reAuthLabel}>{t('deleteAccount.reAuth.phoneLabel')}</Text>
          {!otpSent ? (
            <Pressable
              style={styles.reAuthButton}
              onPress={() => void handleSendOtp()}
              disabled={reAuthLoading}
            >
              <Text style={styles.reAuthButtonText}>{t('deleteAccount.reAuth.sendOtp')}</Text>
            </Pressable>
          ) : (
            <View>
              <TextInput
                style={styles.input}
                value={phoneOtp}
                onChangeText={setPhoneOtp}
                keyboardType="number-pad"
                maxLength={6}
                placeholder={t('deleteAccount.reAuth.otpPlaceholder')}
                placeholderTextColor={colors.gray[400]}
              />
              <Pressable
                style={styles.reAuthButton}
                onPress={() => void handleVerifyOtp()}
                disabled={reAuthLoading || phoneOtp.length < 6}
              >
                <Text style={styles.reAuthButtonText}>{t('deleteAccount.reAuth.verifyOtp')}</Text>
              </Pressable>
            </View>
          )}
        </View>
      )
    }

    if (reAuthMethod === 'google') {
      return (
        <View style={styles.reAuthSection}>
          <Text style={styles.reAuthLabel}>{t('deleteAccount.reAuth.googleLabel')}</Text>
          <Pressable
            style={styles.reAuthButton}
            onPress={() => void handleGoogleReAuth()}
            disabled={reAuthLoading}
          >
            <Text style={styles.reAuthButtonText}>{t('deleteAccount.reAuth.googleButton')}</Text>
          </Pressable>
        </View>
      )
    }

    if (reAuthMethod === 'email') {
      return (
        <View style={styles.reAuthSection}>
          <Text style={styles.reAuthLabel}>{t('deleteAccount.reAuth.emailLabel')}</Text>
          <TextInput
            style={styles.input}
            value={emailPassword}
            onChangeText={setEmailPassword}
            secureTextEntry
            placeholder={t('deleteAccount.reAuth.passwordPlaceholder')}
            placeholderTextColor={colors.gray[400]}
            autoCapitalize="none"
          />
          <Pressable
            style={styles.reAuthButton}
            onPress={() => void handleEmailReAuth()}
            disabled={reAuthLoading || !emailPassword}
          >
            <Text style={styles.reAuthButtonText}>{t('deleteAccount.reAuth.confirmPassword')}</Text>
          </Pressable>
        </View>
      )
    }

    // Fallback: unknown provider
    return (
      <View style={styles.reAuthSection}>
        <Text style={styles.sectionBody}>{t('deleteAccount.reAuth.unknownProvider')}</Text>
      </View>
    )
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Section 1 — What will be deleted */}
        <Text style={styles.sectionTitle}>{t('deleteAccount.whatWillBeDeleted.title')}</Text>
        <View style={styles.bulletList}>
          {[
            t('deleteAccount.whatWillBeDeleted.profile'),
            t('deleteAccount.whatWillBeDeleted.matches'),
            t('deleteAccount.whatWillBeDeleted.subscription'),
            t('deleteAccount.whatWillBeDeleted.activityData'),
            t('deleteAccount.whatWillBeDeleted.cannotRecover'),
          ].map((item) => (
            <View key={item} style={styles.bulletRow}>
              <Text style={styles.bulletDot}>{'\u2022'}</Text>
              <Text style={styles.bulletText}>{item}</Text>
            </View>
          ))}
        </View>

        {/* Section 2 — Re-authentication */}
        <Text style={styles.sectionTitle}>{t('deleteAccount.reAuth.title')}</Text>
        <Text style={styles.sectionBody}>{t('deleteAccount.reAuth.description')}</Text>
        {renderReAuthSection()}

        {/* Section 3 — Final confirmation */}
        <Text style={styles.sectionTitle}>{t('deleteAccount.confirm.title')}</Text>
        <Text style={styles.sectionBody}>{t('deleteAccount.confirm.typeInstruction')}</Text>
        <TextInput
          style={styles.input}
          value={confirmText}
          onChangeText={setConfirmText}
          autoCapitalize="characters"
          placeholder="DELETE"
          placeholderTextColor={colors.gray[400]}
          editable={reAuthComplete}
        />

        <Pressable
          style={[
            styles.deleteButton,
            !deleteEnabled && styles.deleteButtonDisabled,
          ]}
          onPress={handleDeletePress}
          disabled={!deleteEnabled}
        >
          <Text style={styles.deleteButtonText}>{t('deleteAccount.confirm.deleteButton')}</Text>
        </Pressable>
      </ScrollView>

      {(reAuthLoading || deleteLoading) && <LoadingOverlay />}
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  } as ViewStyle,
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  } as ViewStyle,
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.gray[900],
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  } as TextStyle,
  sectionBody: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
    lineHeight: typography.sizes.sm * 1.5,
    marginBottom: spacing.md,
  } as TextStyle,
  bulletList: {
    marginBottom: spacing.md,
  } as ViewStyle,
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  } as ViewStyle,
  bulletDot: {
    fontSize: typography.sizes.sm,
    color: colors.gray[500],
    marginRight: spacing.sm,
    lineHeight: typography.sizes.sm * 1.5,
  } as TextStyle,
  bulletText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.gray[700],
    lineHeight: typography.sizes.sm * 1.5,
  } as TextStyle,
  reAuthSection: {
    marginBottom: spacing.md,
  } as ViewStyle,
  reAuthLabel: {
    fontSize: typography.sizes.sm,
    color: colors.gray[700],
    marginBottom: spacing.sm,
  } as TextStyle,
  reAuthButton: {
    backgroundColor: colors.gray[100],
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  } as ViewStyle,
  reAuthButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.gray[800],
  } as TextStyle,
  reAuthComplete: {
    backgroundColor: colors.success + '20', // 12% opacity — adjust if colors.success is not defined; use colors.green[100] or similar
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    alignItems: 'center',
  } as ViewStyle,
  reAuthCompleteText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.success ?? colors.gray[800], // use colors.success if defined, else fallback
  } as TextStyle,
  input: {
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.sm,
    color: colors.gray[900],
    backgroundColor: colors.white ?? colors.background,
    marginBottom: spacing.sm,
  } as TextStyle,
  deleteButton: {
    backgroundColor: colors.error ?? '#DC2626',
    borderRadius: 8,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  } as ViewStyle,
  deleteButtonDisabled: {
    opacity: 0.4,
  } as ViewStyle,
  deleteButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.white ?? '#FFFFFF',
  } as TextStyle,
})
```

---

### `app/settings/SettingsScreen.tsx` — Update

Read the existing file first. If a "Delete Account" row already exists in a Danger Zone section, wire its `onPress` to `navigation.navigate('DeleteAccountScreen')`. If it does not exist, add it at the bottom of the settings list as a new Danger Zone section.

```typescript
// Add to navigation:
navigation.navigate('DeleteAccountScreen')

// If a Danger Zone section does not already exist, add at bottom of ScrollView:
// <Text style={styles.dangerZoneTitle}>{t('settings.dangerZone.title')}</Text>
// <Pressable style={styles.dangerRow} onPress={() => navigation.navigate('DeleteAccountScreen')}>
//   <Text style={styles.dangerRowText}>{t('settings.dangerZone.deleteAccount')}</Text>
// </Pressable>

// Danger zone styles — add to StyleSheet.create({}) if the section is new:
// dangerZoneTitle: { fontSize: typography.sizes.xs, color: colors.gray[500], ... } as TextStyle,
// dangerRow: { ... } as ViewStyle,
// dangerRowText: { color: colors.error ?? '#DC2626', ... } as TextStyle,
```

Do not remove any existing rows, sections, or styles from `SettingsScreen.tsx`. If i18n keys `settings.dangerZone.title` and `settings.dangerZone.deleteAccount` do not already exist, add them to all 4 language files alongside the `deleteAccount.*` keys below.

---

### Settings Stack Navigator — Update

Read the current settings stack navigator file in `app/navigation/`. Register `DeleteAccountScreen`:

```typescript
// Add import:
import DeleteAccountScreen from '@/app/settings/DeleteAccountScreen'

// Add to ParamList (if the navigator uses a typed ParamList):
DeleteAccountScreen: undefined

// Add to Stack:
<Stack.Screen
  name="DeleteAccountScreen"
  component={DeleteAccountScreen}
  options={{ title: t('deleteAccount.screenTitle') }}
/>
```

Do not reorder or remove any existing screen registrations.

---

### `i18n/en.json` — Add Keys

Add the following keys. The exact nesting must match the project's existing i18n structure (check `en.json` for whether translations use nested objects or dot-separated flat keys and follow the same pattern):

```json
{
  "deleteAccount": {
    "screenTitle": "Delete Account",
    "whatWillBeDeleted": {
      "title": "What will be deleted",
      "profile": "Your profile and photos",
      "matches": "All your matches and conversations",
      "subscription": "Your subscription (cancels at end of current billing period if active)",
      "activityData": "All your activity data",
      "cannotRecover": "Your account cannot be recovered"
    },
    "reAuth": {
      "title": "Verify your identity",
      "description": "For your security, please verify your identity before deleting your account.",
      "verified": "✓ Identity verified",
      "phoneLabel": "We will send a verification code to your phone number.",
      "sendOtp": "Send verification code",
      "otpPlaceholder": "6-digit code",
      "verifyOtp": "Verify code",
      "invalidOtp": "The code you entered is incorrect. Please try again.",
      "googleLabel": "Re-authenticate with your Google account to continue.",
      "googleButton": "Continue with Google",
      "googleError": "Google authentication failed. Please try again.",
      "emailLabel": "Enter your password to continue.",
      "passwordPlaceholder": "Your password",
      "confirmPassword": "Confirm",
      "wrongPassword": "Incorrect password. Please try again.",
      "unknownProvider": "Unable to verify identity. Please contact support.",
      "errorTitle": "Verification failed",
      "sendOtpError": "Could not send verification code. Please try again."
    },
    "confirm": {
      "title": "Final confirmation",
      "typeInstruction": "Type DELETE in the field below to confirm you want to permanently delete your account.",
      "deleteButton": "Delete My Account"
    },
    "finalConfirm": {
      "title": "Are you absolutely sure?",
      "message": "This action is permanent and cannot be undone. All your data will be deleted.",
      "deleteButton": "Yes, Delete Account"
    },
    "error": {
      "title": "Deletion failed",
      "message": "Something went wrong. Please try again. If the problem persists, contact support."
    }
  },
  "settings": {
    "dangerZone": {
      "title": "DANGER ZONE",
      "deleteAccount": "Delete Account"
    }
  }
}
```

Add all keys above to `i18n/my.json`, `i18n/zh.json`, and `i18n/ta.json` using the English values as placeholders. **Never remove or rename existing keys in any language file.**

---

## Important Architecture Notes for Codex

1. **Navigation reset pattern.** After deletion succeeds, do not use `navigation.navigate()` or `navigation.goBack()`. Use `navigation.reset({ index: 0, routes: [{ name: 'WelcomeScreen' }] })` (or the correct screen name for the pre-auth landing screen as registered in `RootNavigator.tsx`). Read `RootNavigator.tsx` to confirm the exact screen name before writing this call. If the RootNavigator auto-redirects on `authStore.isAuthenticated === false` (which it likely does), the `reset()` call is belt-and-suspenders — both mechanisms together ensure the user lands on auth flow.

2. **Store reset action names.** The scaffold above uses `s.reset` as the assumed action name on each store. Before writing the final code, read `store/authStore.ts`, `store/profileStore.ts`, `store/discoveryStore.ts`, `store/matchStore.ts`, and `store/chatStore.ts` to confirm the exact action name (`reset`, `clearStore`, `clearState`, etc.). Use whatever is actually defined — do not invent a new action.

3. **`reAuthComplete` flag is the gate, not the input value.** The flag is set to `true` only inside the `catch`-free path of a successful `reauthenticateWithCredential()` call. It must not be set based on the OTP input length, password length, or any other heuristic. This is the security gate.

4. **Phone re-auth RecaptchaVerifier.** The `PhoneAuthProvider.verifyPhoneNumber()` call requires a `RecaptchaVerifier` instance. Read `services/firebase/auth.ts` to see how the existing OTP send flow creates its verifier and replicate the exact same setup. If the existing code uses `new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' })`, do the same. Do not pass `null` — the placeholder in the scaffold above is a stub that must be replaced.

5. **CF callable payload is empty.** `deleteAccount` reads the UID exclusively from `request.auth.uid` server-side. The client callable is invoked with an empty object `{}`. Do not pass any UID or user data in the payload.

6. **`LoadingOverlay` blocks interaction during async ops.** Both `reAuthLoading` and `deleteLoading` should show the `LoadingOverlay`. The existing `LoadingOverlay` component in `components/ui/LoadingOverlay.tsx` is the correct import — do not build a new one.

7. **`ScrollView` + `keyboardShouldPersistTaps="handled"`.** The password input and OTP input are inside a `ScrollView`. Without `keyboardShouldPersistTaps="handled"`, tapping a button while the keyboard is open will dismiss the keyboard without triggering the button. This prop is required.

8. **Color fallbacks.** The scaffold references `colors.success`, `colors.error`, and `colors.white`. Read `constants/colors.ts` to confirm which of these tokens exist and use the correct token names. If `colors.error` is named differently (e.g. `colors.red[600]`, `colors.destructive`), use that name. Never hardcode hex values — derive from the theme.

---

## Rollback Protocol

If `npx tsc --noEmit` produces errors that cannot be resolved without:
- Modifying a file in the "Do Not Touch" list, OR
- Making an assumption about a prior task's output that cannot be verified, OR
- Changing a schema field in a way that contradicts ARCHITECT.md

**Then:**
1. Do not commit any partial changes
2. Revert all files touched in this session to their state at session start
3. Output a `<!-- ROLLBACK REPORT -->` block listing the file, the error, and what decision is needed
4. Stop. Bring the report back to the Architect.

---

## Codex Self-Check (Run Before Declaring Done)

**TypeScript**
- [ ] `npx tsc --noEmit` — zero errors in root
- [ ] Zero `any` types introduced — search diff for `: any` and `as any`
- [ ] Zero type assertions (`as X`) without an explanatory comment

**Conventions**
- [ ] Zero `console.log` / `console.error` / `console.warn` in any client file
- [ ] Zero inline styles — `style={{ }}` does not appear in any JSX
- [ ] Zero relative imports — `../../` does not appear anywhere in touched files
- [ ] All new user-facing strings added to all 4 i18n files (en, my, zh, ta)
- [ ] All new constants use values from `constants/theme` — no hardcoded hex, px, or font sizes (color fallback comments replaced with real token names)

**Firebase / Security**
- [ ] No server-only fields written from the client — the screen calls only `httpsCallable`, never `updateDoc` or `setDoc`
- [ ] CF is called with empty payload `{}` — no UID or user data passed from client

**Architecture**
- [ ] `reAuthComplete` is set to `true` only inside the success path of `reauthenticateWithCredential()` — not based on input length or any other heuristic
- [ ] Delete button is disabled unless `reAuthComplete === true && confirmText === 'DELETE'`
- [ ] Navigation after deletion uses `navigation.reset()` — not `navigate()` or `goBack()`
- [ ] Store clears happen before `auth.signOut()` and `AsyncStorage.clear()`
- [ ] `functions/src/index.ts` was not modified
- [ ] `PhoneAuthProvider.verifyPhoneNumber()` uses a real `RecaptchaVerifier` instance, not `null`
- [ ] `LoadingOverlay` rendered when `reAuthLoading || deleteLoading` is true

**Platform**
- [ ] `keyboardShouldPersistTaps="handled"` on the `ScrollView`
- [ ] Ask: "Would this break on Android?" — answer must be No
- [ ] Ask: "Would this break on iOS?" — answer must be No

---

## Acceptance Criteria

- [ ] `app/settings/DeleteAccountScreen.tsx` created as a default export screen
- [ ] Section 1 displays all five "what will be deleted" bullet points from i18n
- [ ] Section 2 renders the correct re-auth UI based on the user's Firebase Auth provider
- [ ] Re-authentication with phone (OTP), Google, and email (password) all set `reAuthComplete = true` on success
- [ ] Section 3 delete button is disabled until `reAuthComplete === true` AND `confirmText === 'DELETE'`
- [ ] Tapping the enabled delete button shows a destructive `Alert.alert` confirmation
- [ ] On CF success: all Zustand stores cleared, `auth.signOut()` called, `AsyncStorage.clear()` called, navigation stack replaced
- [ ] On CF error: `Alert` shown, user remains on screen
- [ ] `LoadingOverlay` visible during re-auth and during CF call
- [ ] `DeleteAccountScreen` registered in settings stack navigator
- [ ] "Delete Account" row wired in `SettingsScreen.tsx` Danger Zone section
- [ ] All `deleteAccount.*` i18n keys present in all 4 language files
- [ ] `npx tsc --noEmit` passes with zero errors

---

## Do Not Touch

`functions/src/deleteAccount.ts` (CF is complete — do not modify), `functions/src/index.ts` (append-only — this task adds no CFs), `services/firebase/config.ts` (the `functions` export from Task 97 is already correct — do not modify), `store/authStore.ts` / `store/profileStore.ts` / `store/discoveryStore.ts` / `store/matchStore.ts` / `store/chatStore.ts` (read-only — use existing reset actions, do not add new ones), `constants/`, `firestore.rules`, `firestore.indexes.json`, any existing i18n keys (additions only — never remove or rename)

---

## Commit

```
git commit -m "task-99: delete account screen with re-auth and PDPA-compliant CF call"
```

---

## After This Session

Update `CHANGELOG.md` using this exact template:

```
## [Phase 4D — Task 99] — YYYY-MM-DD

### Completed

- Task 99: Delete Account screen
- [Describe what was built — one line per major deliverable]

### Files Created

- app/settings/DeleteAccountScreen.tsx: [brief description]

### Files Modified

- app/settings/SettingsScreen.tsx: [what changed]
- app/navigation/[navigator file]: [what changed]
- i18n/en.json: added deleteAccount.* keys
- i18n/my.json: mirrored deleteAccount.* keys (English placeholders)
- i18n/zh.json: mirrored deleteAccount.* keys (English placeholders)
- i18n/ta.json: mirrored deleteAccount.* keys (English placeholders)

### Architecture Decisions

- [Any non-obvious choice and why]
- [How RecaptchaVerifier was wired for phone re-auth]
- [Which reset action name was used for each store and why if it differed from `reset`]
- [How navigation.reset() was called and which screen name was used]

### Conflict Risks Introduced

- app/settings/SettingsScreen.tsx modified — Task 100 (Blocked Users) also touches this file; review before generating Task 100 prompt
- None beyond the above

### Known Issues / Deferred

- Unit coverage for deleteAccount CF remains scheduled for Task 105
- [Any intentionally deferred items]

### Next Up

- Task 100: Blocked Users screen
```

Then come to claude.ai with the updated CHANGELOG.md and request the Task 100 prompt.

---

## Reasoning Level

High
