# CODEX PROMPT — Task 57: Photo Verification UI Flow

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 2C. Task 56 (`verifyProfilePhoto`) is complete and deployed to the Firebase emulator.
The Cloud Function accepts a `selfiePath` (GCS path under `users/{uid}/verification/`) and
returns `{ verified: boolean; reason?: string }` where `reason` is a snake_case machine code
(`no_face_detected`, `low_confidence`, `multiple_faces`, `profile_photo_missing`,
`face_mismatch`, `unsafe_content`, `daily_limit_reached`). The function also handles the
attempt counter and temporary file deletion internally.

Existing files Codex needs to know about:

- `functions/src/verifyProfilePhoto.ts` — callable Cloud Function; accepts `{ selfiePath: string }`;
  returns `{ verified: boolean; reason?: string }`; deletes the temp selfie via `finally` on all
  paths; enforces 3 attempts/day with UTC+8 reset
- `services/firebase/storage.ts` — exports `uploadProfilePhoto(uid, index, uri): Promise<string>`;
  Codex must **add** a new `uploadVerificationSelfie(uid, uri): Promise<string>` function here
  (uploads to `users/{uid}/verification/selfie_temp.jpg`, returns the GCS path string
  `users/{uid}/verification/selfie_temp.jpg` — NOT a download URL, since the Cloud Function
  reads via GCS URI internally)
- `services/firebase/firestore.ts` — exports `updateUserProfile(uid, partial)` for updating
  `photoVerified: true` after successful verification
- `store/profileStore.ts` — exports `updateProfile(partial: Partial<UserProfile>): Promise<void>`;
  call this after successful verification to refresh local state
- `utils/imageUtils.ts` — exports `compressImage(uri: string): Promise<string>` which returns a
  compressed local URI (1080px, 80% quality); use this before upload
- `components/ui/LoadingOverlay.tsx` — `visible: boolean`, `message?: string`; use during upload
  and function call phases
- `components/ui/Button.tsx` — primary/outline/ghost variants with `loading` and `disabled` props
- `app/navigation/RootNavigator.tsx` — `RootStackParamList` must receive a new
  `PhotoVerification` entry; `PhotoVerificationScreen` must be registered in the stack
- `app/profile/ProfileScreen.tsx` — already shows a "Verify Now" card when `!profile.photoVerified`;
  it should navigate to `PhotoVerification` in the root stack
- `app/settings/SettingsScreen.tsx` — has a verification row; it should also navigate to
  `PhotoVerification`
- `i18n/en.json` — seed all new keys under `verification.*`; mirror to `my.json`, `zh.json`,
  `ta.json` with English placeholder values
- `types/user.ts` — `UserProfile.photoVerified: boolean` and `UserProfile.verifiedAt?: Timestamp`
  already present from Task 47

**Architectural boundary — do not cross:**

**`expo-camera` is already installed (Task 48). Use `expo-camera`'s `CameraView` component
(Expo SDK 52 API) — NOT the deprecated `Camera` component. The selfie camera must be
front-facing (`facing="front"`). Do NOT use `react-native-camera` or any other camera library.**

**Upload produces a GCS storage path string, NOT a Firebase download URL. The Cloud Function
reads the file via GCS URI (`gs://bucket/path`). Pass the storage path (e.g.
`users/{uid}/verification/selfie_temp.jpg`) as `selfiePath` to the callable — never pass a
download URL.**

**The Cloud Function deletes the temp selfie internally. The UI must NOT attempt a second
delete after the callable resolves.**

---

## Task 57 — Photo Verification UI Flow

**Files to create:**
- `app/profile/PhotoVerificationScreen.tsx`
- `components/profile/SelfieCameraView.tsx`

**Files to modify:**
- `services/firebase/storage.ts` — add `uploadVerificationSelfie`
- `app/navigation/RootNavigator.tsx` — register `PhotoVerification` screen
- `app/profile/ProfileScreen.tsx` — wire "Verify Now" CTA to navigate to `PhotoVerification`
- `app/settings/SettingsScreen.tsx` — wire verification row to navigate to `PhotoVerification`
- `i18n/en.json` — add `verification.*` keys
- `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — mirror new keys with English placeholders

---

### `components/profile/SelfieCameraView.tsx`

Reusable camera component that renders a front-facing camera preview with a face-guide oval
overlay and a capture button. Used exclusively by `PhotoVerificationScreen`. Must not contain
any upload or Cloud Function logic — capture only.

```typescript
// 1. React
import React, { useRef, useState, useCallback } from 'react'

// 2. React Native
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Text,
} from 'react-native'

// 3. Third-party
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

// 9. Constants
import { colors, spacing, typography } from '@/constants/theme'

interface SelfieCameraViewProps {
  /** Called with the captured local file URI on a successful snapshot */
  onCapture: (uri: string) => void
  /** Called when the user taps the retake / cancel button */
  onRetake: () => void
  /** True while the parent is processing (upload + function call) — disables capture */
  isProcessing: boolean
}

export const SelfieCameraView = ({
  onCapture,
  onRetake,
  isProcessing,
}: SelfieCameraViewProps): React.JSX.Element => {
  const { t } = useTranslation()
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)
  const [hasCaptured, setHasCaptured] = useState(false)

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || hasCaptured || isProcessing) return
    setHasCaptured(true)
    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        base64: false,
        skipProcessing: false,
      })
      if (photo?.uri) {
        onCapture(photo.uri)
      }
    } catch {
      setHasCaptured(false)
    }
  }, [hasCaptured, isProcessing, onCapture])

  const handleRetake = useCallback(() => {
    setHasCaptured(false)
    onRetake()
  }, [onRetake])

  // Permission not yet determined — show empty container while awaiting
  if (!permission) {
    return <View style={styles.container} />
  }

  // Permission denied — show graceful prompt
  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={48} color={colors.gray[400]} />
        <Text style={styles.permissionTitle}>
          {t('verification.camera.permissionTitle')}
        </Text>
        <Text style={styles.permissionSubtitle}>
          {t('verification.camera.permissionSubtitle')}
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
          activeOpacity={0.8}
        >
          <Text style={styles.permissionButtonText}>
            {t('verification.camera.grantPermission')}
          </Text>
        </TouchableOpacity>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* Full-screen camera preview */}
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={'front' as CameraType}
      />

      {/* Face oval guide overlay */}
      <View style={styles.overlayContainer} pointerEvents="none">
        <View style={styles.ovalGuide} />
      </View>

      {/* Bottom controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.retakeButton}
          onPress={handleRetake}
          activeOpacity={0.7}
        >
          <Ionicons name="refresh-outline" size={24} color={colors.white} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.captureButton,
            (hasCaptured || isProcessing) && styles.captureButtonDisabled,
          ]}
          onPress={handleCapture}
          disabled={hasCaptured || isProcessing}
          activeOpacity={0.8}
        >
          <View style={styles.captureInner} />
        </TouchableOpacity>

        {/* Spacer balances the retake button */}
        <View style={styles.captureButtonSpacer} />
      </View>
    </View>
  )
}

const OVAL_WIDTH = 220
const OVAL_HEIGHT = 280
const CAPTURE_SIZE = 72
const RETAKE_SIZE = 44

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  } as ViewStyle,
  camera: {
    flex: 1,
  } as ViewStyle,
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  ovalGuide: {
    width: OVAL_WIDTH,
    height: OVAL_HEIGHT,
    borderRadius: OVAL_WIDTH / 2,
    borderWidth: 3,
    borderColor: colors.white,
    marginBottom: 60,
    backgroundColor: 'transparent',
  } as ViewStyle,
  controls: {
    position: 'absolute',
    bottom: spacing.xxl,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  } as ViewStyle,
  retakeButton: {
    width: RETAKE_SIZE,
    height: RETAKE_SIZE,
    borderRadius: RETAKE_SIZE / 2,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  captureButton: {
    width: CAPTURE_SIZE,
    height: CAPTURE_SIZE,
    borderRadius: CAPTURE_SIZE / 2,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.xl,
    backgroundColor: 'transparent',
  } as ViewStyle,
  captureButtonDisabled: {
    opacity: 0.4,
  } as ViewStyle,
  captureInner: {
    width: CAPTURE_SIZE - 16,
    height: CAPTURE_SIZE - 16,
    borderRadius: (CAPTURE_SIZE - 16) / 2,
    backgroundColor: colors.white,
  } as ViewStyle,
  captureButtonSpacer: {
    width: RETAKE_SIZE,
  } as ViewStyle,
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
  } as ViewStyle,
  permissionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.gray[800],
    marginTop: spacing.md,
    textAlign: 'center',
  } as TextStyle,
  permissionSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
    textAlign: 'center',
    marginTop: spacing.sm,
    lineHeight: 20,
  } as TextStyle,
  permissionButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
  } as ViewStyle,
  permissionButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.white,
  } as TextStyle,
})
```

---

### `app/profile/PhotoVerificationScreen.tsx`

Three-step verification flow managed by a `VerificationStep` state machine:
`'instructions' | 'camera' | 'result'`. Owns the entire upload and Cloud Function call
lifecycle. Screen-level component — uses `export default` per React Navigation convention.

```typescript
// 1. React
import React, { useState, useCallback } from 'react'

// 2. React Native
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Alert,
} from 'react-native'

// 3. Third-party
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'
import { httpsCallable } from 'firebase/functions'

// 4. Stores
import { useProfileStore } from '@/store/profileStore'

// 5. Components
import { Button } from '@/components/ui/Button'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { SelfieCameraView } from '@/components/profile/SelfieCameraView'

// 7. Services
import { uploadVerificationSelfie } from '@/services/firebase/storage'
import { functions } from '@/services/firebase/config'

// 8. Types
import type { StackNavigationProp } from '@react-navigation/stack'
import type { RootStackParamList } from '@/app/navigation/RootNavigator'

// 9. Constants
import { colors, spacing, typography } from '@/constants/theme'
import { compressImage } from '@/utils/imageUtils'

// ---------------------------------------------------------------------------
// Navigation type
// ---------------------------------------------------------------------------

type PhotoVerificationNavProp = StackNavigationProp<
  RootStackParamList,
  'PhotoVerification'
>

interface Props {
  navigation: PhotoVerificationNavProp
}

// ---------------------------------------------------------------------------
// Reason-code → i18n key mapping
// ---------------------------------------------------------------------------

const REASON_KEY_MAP: Record<string, string> = {
  no_face_detected: 'verification.result.reason.noFaceDetected',
  low_confidence: 'verification.result.reason.lowConfidence',
  multiple_faces: 'verification.result.reason.multipleFaces',
  profile_photo_missing: 'verification.result.reason.profilePhotoMissing',
  face_mismatch: 'verification.result.reason.faceMismatch',
  unsafe_content: 'verification.result.reason.unsafeContent',
  daily_limit_reached: 'verification.result.reason.dailyLimitReached',
}

const reasonToI18nKey = (reason: string | undefined): string =>
  (reason !== undefined && REASON_KEY_MAP[reason]) !== undefined
    ? REASON_KEY_MAP[reason as string]
    : 'verification.result.reason.generic'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VerificationStep = 'instructions' | 'camera' | 'result'

interface VerificationResult {
  verified: boolean
  reason?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_ATTEMPTS = 3

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

const PhotoVerificationScreen = ({ navigation }: Props): React.JSX.Element => {
  const { t } = useTranslation()
  const { updateProfile } = useProfileStore()

  const [step, setStep] = useState<VerificationStep>('instructions')
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [attemptCount, setAttemptCount] = useState(0)

  // -----------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------

  const handleStartCamera = useCallback(() => {
    setStep('camera')
  }, [])

  const handleCapture = useCallback(
    async (uri: string) => {
      setIsProcessing(true)
      try {
        // 1. Compress before upload
        const compressedUri = await compressImage(uri)

        // 2. Upload — returns GCS storage path, not download URL
        const selfiePath = await uploadVerificationSelfie(compressedUri)

        // 3. Call Cloud Function with the storage path
        const verifyFn = httpsCallable<
          { selfiePath: string },
          VerificationResult
        >(functions, 'verifyProfilePhoto')
        const response = await verifyFn({ selfiePath })
        const fnResult = response.data

        setAttemptCount((prev) => prev + 1)
        setResult(fnResult)

        if (fnResult.verified) {
          // Optimistically update local profile state
          await updateProfile({ photoVerified: true })
        }

        setStep('result')
      } catch {
        // Treat unexpected callable errors as a generic failure
        setAttemptCount((prev) => prev + 1)
        setResult({ verified: false, reason: 'generic' })
        setStep('result')
      } finally {
        setIsProcessing(false)
      }
    },
    [updateProfile]
  )

  const handleTryAgain = useCallback(() => {
    if (attemptCount >= MAX_ATTEMPTS) {
      Alert.alert(
        t('verification.result.limitTitle'),
        t('verification.result.limitBody'),
        [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
      )
      return
    }
    setResult(null)
    setStep('camera')
  }, [attemptCount, navigation, t])

  const handleDismissSuccess = useCallback(() => {
    navigation.goBack()
  }, [navigation])

  // -----------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------

  const renderInstructions = (): React.JSX.Element => (
    <ScrollView
      contentContainerStyle={styles.instructionsContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.iconCircle}>
        <Ionicons
          name="shield-checkmark-outline"
          size={48}
          color={colors.secondary}
        />
      </View>

      <Text style={styles.instructionsTitle}>
        {t('verification.instructions.title')}
      </Text>
      <Text style={styles.instructionsSubtitle}>
        {t('verification.instructions.subtitle')}
      </Text>

      {(
        [
          {
            icon: 'sunny-outline' as const,
            key: 'verification.instructions.tip.lighting',
          },
          {
            icon: 'eye-outline' as const,
            key: 'verification.instructions.tip.face',
          },
          {
            icon: 'glasses-outline' as const,
            key: 'verification.instructions.tip.noGlasses',
          },
          {
            icon: 'person-outline' as const,
            key: 'verification.instructions.tip.solo',
          },
        ] as const
      ).map(({ icon, key }) => (
        <View key={key} style={styles.tipRow}>
          <Ionicons
            name={icon}
            size={22}
            color={colors.primary}
            style={styles.tipIcon}
          />
          <Text style={styles.tipText}>{t(key)}</Text>
        </View>
      ))}

      <View style={styles.instructionsCta}>
        <Button
          label={t('verification.instructions.startButton')}
          onPress={handleStartCamera}
          variant="primary"
        />
      </View>
    </ScrollView>
  )

  const renderCamera = (): React.JSX.Element => (
    <View style={styles.cameraContainer}>
      <SelfieCameraView
        onCapture={handleCapture}
        onRetake={() => setStep('instructions')}
        isProcessing={isProcessing}
      />
      <LoadingOverlay
        visible={isProcessing}
        message={t('verification.camera.processing')}
      />
    </View>
  )

  const renderResult = (): React.JSX.Element => {
    const isSuccess = result?.verified === true

    return (
      <View style={styles.resultContainer}>
        <View
          style={[
            styles.resultIconCircle,
            isSuccess ? styles.resultIconSuccess : styles.resultIconFailure,
          ]}
        >
          <Ionicons
            name={isSuccess ? 'checkmark-circle' : 'close-circle'}
            size={72}
            color={colors.white}
          />
        </View>

        <Text style={styles.resultTitle}>
          {isSuccess
            ? t('verification.result.successTitle')
            : t('verification.result.failureTitle')}
        </Text>

        <Text style={styles.resultBody}>
          {isSuccess
            ? t('verification.result.successBody')
            : t(reasonToI18nKey(result?.reason))}
        </Text>

        {/* Attempt counter — only on failure */}
        {!isSuccess && attemptCount < MAX_ATTEMPTS && (
          <Text style={styles.attemptCounter}>
            {t('verification.result.attemptCount', {
              current: attemptCount,
              max: MAX_ATTEMPTS,
            })}
          </Text>
        )}

        <View style={styles.resultCta}>
          {isSuccess ? (
            <Button
              label={t('verification.result.successButton')}
              onPress={handleDismissSuccess}
              variant="primary"
            />
          ) : (
            <>
              {attemptCount < MAX_ATTEMPTS && (
                <Button
                  label={t('verification.result.tryAgainButton')}
                  onPress={handleTryAgain}
                  variant="primary"
                />
              )}
              <View style={styles.resultButtonSpacer} />
              <Button
                label={t('common.cancel')}
                onPress={() => navigation.goBack()}
                variant="outline"
              />
            </>
          )}
        </View>
      </View>
    )
  }

  // -----------------------------------------------------------
  // Root render
  // -----------------------------------------------------------

  return (
    <View style={styles.root}>
      {step === 'instructions' && renderInstructions()}
      {step === 'camera' && renderCamera()}
      {step === 'result' && renderResult()}
    </View>
  )
}

export default PhotoVerificationScreen

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  } as ViewStyle,

  // Instructions step
  instructionsContent: {
    padding: spacing.lg,
    alignItems: 'center',
    paddingBottom: spacing.xxxl,
  } as ViewStyle,
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    marginTop: spacing.xl,
  } as ViewStyle,
  instructionsTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.gray[800],
    textAlign: 'center',
    marginBottom: spacing.sm,
  } as TextStyle,
  instructionsSubtitle: {
    fontSize: typography.sizes.md,
    color: colors.gray[600],
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  } as TextStyle,
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: spacing.md,
  } as ViewStyle,
  tipIcon: {
    marginRight: spacing.sm,
    marginTop: 1,
  } as ViewStyle,
  tipText: {
    flex: 1,
    fontSize: typography.sizes.md,
    color: colors.gray[700],
    lineHeight: 22,
  } as TextStyle,
  instructionsCta: {
    width: '100%',
    marginTop: spacing.xl,
  } as ViewStyle,

  // Camera step
  cameraContainer: {
    flex: 1,
  } as ViewStyle,

  // Result step
  resultContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  } as ViewStyle,
  resultIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  } as ViewStyle,
  resultIconSuccess: {
    backgroundColor: colors.primary,
  } as ViewStyle,
  resultIconFailure: {
    backgroundColor: colors.danger,
  } as ViewStyle,
  resultTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.gray[800],
    textAlign: 'center',
    marginBottom: spacing.sm,
  } as TextStyle,
  resultBody: {
    fontSize: typography.sizes.md,
    color: colors.gray[600],
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.md,
  } as TextStyle,
  attemptCounter: {
    fontSize: typography.sizes.sm,
    color: colors.gray[400],
    textAlign: 'center',
    marginBottom: spacing.md,
  } as TextStyle,
  resultCta: {
    width: '100%',
    marginTop: spacing.lg,
  } as ViewStyle,
  resultButtonSpacer: {
    height: spacing.sm,
  } as ViewStyle,
})
```

---

### `services/firebase/storage.ts` — Update

Add `uploadVerificationSelfie` below the existing `uploadProfilePhoto` export. Do not
modify any existing export.

```typescript
// Add this exported function — returns the GCS storage path, NOT a download URL:
export const uploadVerificationSelfie = async (localUri: string): Promise<string> => {
  const currentUser = auth.currentUser
  if (!currentUser) throw new Error('User not authenticated')

  const storagePath = `users/${currentUser.uid}/verification/selfie_temp.jpg`
  const storageRef = ref(storage, storagePath)

  const response = await fetch(localUri)
  const blob = await response.blob()

  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, blob)
    task.on('state_changed', () => {}, reject, () => resolve())
  })

  // Return the storage path — Cloud Function reads via gs://bucket/<storagePath>
  return storagePath
}
```

> Use the same `auth`, `storage`, `ref`, and `uploadBytesResumable` imports already present
> in this file. Do not add new imports if they are already imported.

---

### `app/navigation/RootNavigator.tsx` — Update

```typescript
// Add to RootStackParamList:
PhotoVerification: undefined

// Add import:
import PhotoVerificationScreen from '@/app/profile/PhotoVerificationScreen'

// Add screen inside Stack.Navigator alongside existing screens:
<Stack.Screen
  name="PhotoVerification"
  component={PhotoVerificationScreen}
  options={{
    title: t('verification.navigationTitle'),
    headerBackTitleVisible: false,
  }}
/>
```

> Do not touch auth gating, `isAuthenticated`, `hasCompletedOnboarding`, or any other screen
> registration.

---

### `app/profile/ProfileScreen.tsx` — Update

Locate the existing "Verify Now" `TouchableOpacity` or `Button`. Set or update its `onPress`:

```typescript
onPress={() => navigation.navigate('PhotoVerification')}
```

> Ensure `navigation` is typed as `StackNavigationProp<RootStackParamList>` or obtained via
> `useNavigation<StackNavigationProp<RootStackParamList>>()`. Do not alter any other section
> of this file.

---

### `app/settings/SettingsScreen.tsx` — Update

Locate the existing verification / "Verify Profile" row. Set or update its `onPress`:

```typescript
onPress={() => navigation.navigate('PhotoVerification')}
```

> Do not change any other setting row or section grouping.

---

### `i18n/en.json` — Update

Add the `verification` namespace at the top level alongside existing keys. Do not modify any
existing key.

```json
"verification": {
  "navigationTitle": "Verify Profile",
  "instructions": {
    "title": "Let's Verify You're Real",
    "subtitle": "Take a selfie so we can confirm your identity matches your profile photo.",
    "tip": {
      "lighting": "Find a well-lit spot — natural light works best",
      "face": "Make sure your full face is clearly visible",
      "noGlasses": "Remove sunglasses or hats if wearing them",
      "solo": "Only you in the frame — no group selfies"
    },
    "startButton": "Start Verification"
  },
  "camera": {
    "permissionTitle": "Camera Access Required",
    "permissionSubtitle": "We need camera access to take your verification selfie.",
    "grantPermission": "Allow Camera Access",
    "processing": "Verifying your photo…"
  },
  "result": {
    "successTitle": "You're Verified!",
    "successBody": "Your verified badge will now appear on your profile.",
    "successButton": "Done",
    "failureTitle": "Verification Failed",
    "attemptCount": "Attempt {{current}} of {{max}}",
    "limitTitle": "Daily Limit Reached",
    "limitBody": "You've used all verification attempts for today. Please try again tomorrow.",
    "tryAgainButton": "Try Again",
    "reason": {
      "noFaceDetected": "We couldn't detect a face clearly. Try better lighting and ensure your face fills the oval.",
      "lowConfidence": "The photo quality was too low. Ensure good lighting and hold your phone steady.",
      "multipleFaces": "Multiple faces detected. Please take a solo selfie.",
      "profilePhotoMissing": "Your profile needs at least one photo before verifying.",
      "faceMismatch": "Your selfie doesn't appear to match your profile photo. Please use a current photo.",
      "unsafeContent": "The photo was flagged by our safety system. Please try again.",
      "dailyLimitReached": "You've reached the daily verification limit. Please try again tomorrow.",
      "generic": "Something went wrong. Please try again."
    }
  }
}
```

---

### `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — Update

Mirror the entire `verification` block from `en.json` into each file using the same English
values as placeholders. Do not modify any existing keys.

---

## Important Architecture Notes for Codex

1. **GCS path, not download URL.** `uploadVerificationSelfie` must return the storage path
   string (e.g. `users/{uid}/verification/selfie_temp.jpg`), not a Firebase download URL.
   The Cloud Function constructs the full GCS URI internally (`gs://bucket/<storagePath>`).
   Passing a download URL will cause the function to throw `invalid_argument`.

2. **Do not delete the temp selfie from the client.** `verifyProfilePhoto` deletes the GCS
   object in its own `finally` block on all paths (success, failure, and error). Any client-
   side attempt to delete the same path will either race the function or produce a no-op 404.
   There is no delete call anywhere in the UI layer.

3. **`CameraView` from `expo-camera` (SDK 52 API only).** The deprecated `Camera` component
   must not be used. `facing="front"` (typed as `CameraType`) is the correct prop for front-
   facing mode. The ref type is `React.useRef<CameraView>(null)`.

4. **`SelfieCameraView` is capture-only.** It receives `onCapture(uri)` and delivers the raw
   local URI back to `PhotoVerificationScreen`. No upload or Cloud Function logic lives
   inside this component. This boundary keeps the component reusable and testable in isolation.

5. **Attempt counter is client-side display state only.** The authoritative daily cap is
   enforced server-side in the Cloud Function. The client `attemptCount` state is used only to
   decide whether to show "Try Again" or the limit-reached alert. If the server returns
   `reason: 'daily_limit_reached'`, the UI should still surface that reason string regardless
   of the local counter value.

6. **No inline styles.** All styles in `StyleSheet.create({})`. All colors, spacing, and
   typography from `constants/theme`. No hardcoded hex values, pixel numbers, or font sizes.

7. **Export convention.** `PhotoVerificationScreen` uses `export default` (React Navigation
   screen requirement per CONVENTIONS.md Section 4). `SelfieCameraView` uses `export const`
   (named export).

8. **All strings through `t()`.** Every visible string uses `useTranslation()`. The
   `reasonToI18nKey` function translates snake_case server reason codes to i18n keys before
   passing to `t()`. Raw reason codes must never appear in rendered UI text.

9. **`LoadingOverlay` covers the camera step during processing.** After `onCapture` fires,
   `isProcessing` becomes `true`. `SelfieCameraView` receives this via prop and disables
   the capture button. `PhotoVerificationScreen` renders `LoadingOverlay` on top of the
   camera view during the upload + function call window.

10. **`common.ok` i18n key.** The `Alert` that shows when the daily limit is reached uses
    `t('common.ok')` for its button label. Confirm this key exists in `i18n/en.json` under
    the existing `common` namespace; add it if missing.

---

## Acceptance Criteria

- [ ] `components/profile/SelfieCameraView.tsx` created; exports `SelfieCameraView` as a
      named export
- [ ] `app/profile/PhotoVerificationScreen.tsx` created; uses `export default`; typed with
      `StackNavigationProp<RootStackParamList, 'PhotoVerification'>`
- [ ] `services/firebase/storage.ts` has new `uploadVerificationSelfie` export that returns
      a GCS storage path string — not a download URL; all existing exports unchanged
- [ ] `PhotoVerification: undefined` added to `RootStackParamList` and the screen registered
      in `RootNavigator.tsx`
- [ ] "Verify Now" in `ProfileScreen` navigates to `'PhotoVerification'`
- [ ] Verification row in `SettingsScreen` navigates to `'PhotoVerification'`
- [ ] `expo-camera`'s `CameraView` (SDK 52 API) used; deprecated `Camera` component absent
- [ ] Front-facing camera renders with face oval guide overlay; oval is a bordered View with
      border-radius, not an SVG or third-party library
- [ ] `SelfieCameraView` contains zero upload or Cloud Function call logic
- [ ] After capture: image compressed via `compressImage()`, uploaded via
      `uploadVerificationSelfie()`, Cloud Function called with the returned storage path
- [ ] On `verified: true`: `profileStore.updateProfile({ photoVerified: true })` called;
      success result screen shown; tapping "Done" calls `navigation.goBack()`
- [ ] On `verified: false`: failure screen shown with localised reason string via
      `reasonToI18nKey()`; "Try Again" visible only when `attemptCount < MAX_ATTEMPTS`
- [ ] Attempt counter rendered on failure result screen only
- [ ] When `attemptCount >= MAX_ATTEMPTS` and "Try Again" is tapped: `Alert` shown with
      limit title + body, then `navigation.goBack()` on dismiss
- [ ] `LoadingOverlay` visible during the upload + function call phase
- [ ] Camera permission denied state renders gracefully with "Allow Camera Access" button
- [ ] All `verification.*` i18n keys added to all 4 language files (`en`, `my`, `zh`, `ta`)
- [ ] All styles in `StyleSheet.create({})` — zero `style={{ }}` in JSX
- [ ] All imports use `@/` alias — no relative paths
- [ ] `npx tsc --noEmit` passes with zero errors after this task

---

## Do Not Touch

`functions/src/verifyProfilePhoto.ts`, `functions/src/index.ts`,
`store/discoveryStore.ts`, `store/subscriptionStore.ts`, `store/matchStore.ts`,
`store/chatStore.ts`, `services/firebase/auth.ts`, `services/firebase/config.ts`,
`firestore.rules`, `types/user.ts`, `types/subscription.ts`,
`constants/`, `components/discovery/`, `components/chat/`

---

## Commit

```
git commit -m "task-57: photo verification UI flow — SelfieCameraView, PhotoVerificationScreen, uploadVerificationSelfie"
```

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 2C — Task 57] — YYYY-MM-DD

### Completed

- Task 57: Photo Verification UI Flow implemented
- SelfieCameraView: front-facing camera with face oval guide, permission handling, capture-only
- PhotoVerificationScreen: 3-step state machine (instructions → camera → result), upload + Cloud Function lifecycle, attempt counter, localised reason-code mapping
- uploadVerificationSelfie: added to services/firebase/storage.ts — returns GCS storage path (not download URL)
- PhotoVerification registered in RootNavigator; navigate-to wired in ProfileScreen and SettingsScreen
- All verification.* i18n keys added to all 4 language files

### Files Created / Modified

- components/profile/SelfieCameraView.tsx: created — CameraView (SDK 52), oval overlay, capture/retake controls, permission denied state
- app/profile/PhotoVerificationScreen.tsx: created — instructions/camera/result step machine, upload lifecycle, reasonToI18nKey mapper
- services/firebase/storage.ts: uploadVerificationSelfie added
- app/navigation/RootNavigator.tsx: PhotoVerification added to RootStackParamList and stack
- app/profile/ProfileScreen.tsx: "Verify Now" wired to navigation.navigate('PhotoVerification')
- app/settings/SettingsScreen.tsx: verification row wired to navigation.navigate('PhotoVerification')
- i18n/en.json: verification.* namespace added
- i18n/my.json, zh.json, ta.json: verification.* mirrored with English placeholders

### Architecture Decisions

- uploadVerificationSelfie returns the GCS storage path, not a download URL — Cloud Function reads via gs:// URI internally
- Temp selfie deletion is the Cloud Function's responsibility only — no client-side delete
- Attempt counter is client-side display state; server enforces the cap and surfaces daily_limit_reached reason code
- reasonToI18nKey map translates snake_case reason codes to i18n keys before t() call — raw codes never appear in rendered text
- SelfieCameraView is capture-only; all upload and Cloud Function logic is in PhotoVerificationScreen

### Known Issues / Deferred

- [List anything left incomplete with task number where it will be resolved]

### Verification

- npx tsc --noEmit passes
- npx tsc --noEmit passes in functions/ (no changes to functions)

### Next Up

- Task 58: Verified Badge Integration (ensure photoVerified badge renders consistently across SwipeCard, FullProfileModal, MatchesScreen, ChatScreen header, and ProfileScreen using the photoVerified field)
```

---

## Reasoning Level

High — multi-step stateful UI with camera API integration, file upload pipeline, Cloud
Function callable with typed request/response, server reason-code to i18n key mapping,
navigation registration across two entry points, and camera permission handling on two
platforms.
