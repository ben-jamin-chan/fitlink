# CODEX PROMPT — Task 21
# Onboarding Step 6 — Preferences + Profile Submit

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 2.5 complete. Relevant existing files:

- `store/onboardingStore.ts` — `OnboardingDraft` has fields: `lookingFor?: LookingFor[]`, `ageRange?: [number, number]`, `distanceKm?: number`, `genderPreference?: string[]`, `photoUris?: string[]`. `updateDraft()`, `setCurrentStep()`, `clearDraft()` available. Store is persisted via AsyncStorage.
- `store/authStore.ts` — `user: FirebaseUser | null`, `isAuthenticated: boolean`, `hasCompletedOnboarding: boolean`, `setHasCompletedOnboarding(value: boolean)` action available. Setting `hasCompletedOnboarding: true` causes `RootNavigator` to render `MainTabNavigator` automatically.
- `app/onboarding/OnboardingNavigator.tsx` — has inline `Step6Screen` placeholder; `OnboardingHeader` exported; `OnboardingStackParamList` has `Step6`
- `app/onboarding/Step5Screen.tsx` — real Step 5 screen, navigates to `Step6` on Next
- `components/ui/MultiSelect.tsx` — reusable chip multi-select from Task 18
- `components/ui/Slider.tsx` — labelled RNSlider wrapper from Task 20
- `components/ui/Button.tsx` — primary/outline/ghost variants, `loading` prop
- `components/ui/LoadingOverlay.tsx` — full-screen overlay with spinner (stub exists — if not yet real, implement it fully in this task)
- `utils/imageUtils.ts` — `compressImage(uri): Promise<string>` exported
- `services/firebase/config.ts` — `auth`, `db` (Firestore), `storage` exported
- `types/user.ts` — `UserProfile`, `LookingFor`, `Gender`, `FitnessLevel` all exported
- `constants/theme.ts` — `colors`, `spacing`, `typography`, `MIN_PHOTOS`, `MAX_PHOTOS` exported
- `i18n/en.json` — strings to be seeded under `onboarding.step6.*` and `onboarding.submit.*`

All photo URIs collected in Steps 2–5 are **local device URIs** stored in `onboardingStore.draft.photoUris`. They have not been uploaded yet. This task performs the actual upload to Firebase Storage followed by writing the complete profile to Firestore. This is the only task that touches Firebase Storage photo upload during onboarding.

---

## Task 21 — Onboarding Step 6: Preferences + Profile Submit

**Files to create:**
- `services/firebase/storage.ts`
- `services/firebase/firestore.ts`
- `app/onboarding/Step6Screen.tsx`

**Files to modify:**
- `app/onboarding/OnboardingNavigator.tsx` — swap inline `Step6Screen` placeholder with real screen
- `components/ui/LoadingOverlay.tsx` — implement fully if only a stub exists
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add step6 and submit keys

---

### `services/firebase/storage.ts`

Photo upload utility used here and later in Task 37 (Edit Profile).

```typescript
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage'
import { storage } from '@/services/firebase/config'
import { compressImage } from '@/utils/imageUtils'

/**
 * Uploads a single photo to Firebase Storage.
 * Compresses before upload (idempotent — safe to call on already-compressed URIs).
 * Returns the public download URL.
 *
 * Storage path: users/{userId}/photos/photo_{index}_{timestamp}.jpg
 *
 * @param userId     - Firebase Auth UID
 * @param index      - Zero-based position in photos array (0 = primary)
 * @param localUri   - Local device URI (from expo-image-picker or expo-image-manipulator)
 * @param onProgress - Optional callback receiving upload percentage (0–100)
 */
export const uploadProfilePhoto = async (
  userId: string,
  index: number,
  localUri: string,
  onProgress?: (percent: number) => void
): Promise<string> => {
  const compressedUri = await compressImage(localUri)

  const response = await fetch(compressedUri)
  const blob = await response.blob()

  const filename = `users/${userId}/photos/photo_${index}_${Date.now()}.jpg`
  const storageRef = ref(storage, filename)
  const uploadTask = uploadBytesResumable(storageRef, blob)

  return new Promise<string>((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        if (onProgress) {
          const percent = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100
          )
          onProgress(percent)
        }
      },
      (error) => reject(error),
      async () => {
        const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref)
        resolve(downloadUrl)
      }
    )
  })
}

/**
 * Uploads all photos in sequence and returns an ordered array of download URLs.
 * Index position is preserved — index 0 is always the primary photo.
 *
 * @param userId     - Firebase Auth UID
 * @param localUris  - Array of local URIs (2–6 photos)
 * @param onProgress - Receives overall percentage (0–100) across all uploads
 */
export const uploadAllProfilePhotos = async (
  userId: string,
  localUris: string[],
  onProgress?: (percent: number) => void
): Promise<string[]> => {
  const downloadUrls: string[] = []
  const total = localUris.length

  for (let i = 0; i < total; i++) {
    const uri = localUris[i]
    const downloadUrl = await uploadProfilePhoto(userId, i, uri, (singlePercent) => {
      if (onProgress) {
        // Overall progress = (completed photos + current photo fraction) / total
        const overall = Math.round(((i + singlePercent / 100) / total) * 100)
        onProgress(overall)
      }
    })
    downloadUrls.push(downloadUrl)
  }

  return downloadUrls
}

/**
 * Deletes a photo from Firebase Storage by its full download URL.
 * Used by Edit Profile (Task 37) when a photo is removed.
 */
export const deleteProfilePhoto = async (downloadUrl: string): Promise<void> => {
  const photoRef = ref(storage, downloadUrl)
  await deleteObject(photoRef)
}
```

---

### `services/firebase/firestore.ts`

User profile creation and update utilities. Only the functions needed for Task 21 are defined here. Additional read/update helpers will be added by Tasks 35, 37, and 38 without touching this file's existing exports.

```typescript
import {
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/services/firebase/config'
import type { UserProfile, LookingFor } from '@/types/user'

/**
 * Shape of data written to /users/{userId} at the end of onboarding.
 * All fields required by the Firestore schema are set here with safe defaults.
 *
 * CRITICAL: `age` is intentionally omitted — it is calculated server-side by the
 * onUserCreated Cloud Function (Task 22) and must never be written from the client.
 */
interface CreateUserProfileInput {
  uid: string
  firstName: string
  dateOfBirth: Date
  gender: UserProfile['gender']
  location: UserProfile['location']
  photos: string[]             // Firebase Storage download URLs (not local URIs)
  bio: string
  height: number
  religion?: string
  activities: string[]
  fitnessLevel: UserProfile['fitnessLevel']
  workoutFrequency: string
  dietaryPreference: string
  fitnessGoals: string[]
  smoking: UserProfile['smoking']
  drinking: UserProfile['drinking']
  lookingFor: LookingFor[]
  preferences: UserProfile['preferences']
  language: string
}

/**
 * Writes a new user profile document to /users/{userId}.
 * Called exactly once — at Step 6 completion during onboarding.
 *
 * Fields set server-side (NOT set here):
 *   - age: set by onUserCreated Cloud Function
 *
 * Fields set to safe defaults here:
 *   - stats: { likes: 0, passes: 0, matches: 0 }
 *   - subscription: { tier: 'free' }
 *   - verified: false
 *   - paused: false
 *   - banned: false
 *   - createdAt, lastActive: serverTimestamp()
 */
export const createUserProfile = async (
  input: CreateUserProfileInput
): Promise<void> => {
  const userRef = doc(db, 'users', input.uid)

  const profileData = {
    uid: input.uid,
    firstName: input.firstName,
    dateOfBirth: Timestamp.fromDate(input.dateOfBirth),
    // age intentionally omitted — Cloud Function writes this field
    gender: input.gender,
    location: input.location,
    photos: input.photos,
    bio: input.bio,
    height: input.height,
    // religion omitted when undefined or empty string — Firestore rejects undefined values
    ...(input.religion !== undefined && input.religion !== ''
      ? { religion: input.religion }
      : {}),
    activities: input.activities,
    fitnessLevel: input.fitnessLevel,
    workoutFrequency: input.workoutFrequency,
    dietaryPreference: input.dietaryPreference,
    fitnessGoals: input.fitnessGoals,
    smoking: input.smoking,
    drinking: input.drinking,
    lookingFor: input.lookingFor,
    preferences: input.preferences,
    stats: { likes: 0, passes: 0, matches: 0 },
    subscription: { tier: 'free' as const },
    verified: false,
    paused: false,
    banned: false,
    language: input.language,
    createdAt: serverTimestamp(),
    lastActive: serverTimestamp(),
  }

  await setDoc(userRef, profileData)
}

/**
 * Partial update to /users/{userId}.
 * Used by Tasks 35–38 (profile store, edit profile, settings).
 *
 * NEVER call this with age, banned, or verified — those are server-only fields.
 */
export const updateUserProfile = async (
  userId: string,
  data: Partial<Omit<UserProfile, 'uid' | 'age' | 'banned' | 'verified' | 'createdAt'>>
): Promise<void> => {
  const userRef = doc(db, 'users', userId)
  await updateDoc(userRef, {
    ...data,
    lastActive: serverTimestamp(),
  })
}
```

---

### `components/ui/LoadingOverlay.tsx`

Implement fully if it only exists as a stub. Skip this file entirely if it is already a complete, working component.

```typescript
import React from 'react'
import {
  Modal,
  View,
  ActivityIndicator,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { colors, spacing, typography } from '@/constants/theme'

interface LoadingOverlayProps {
  visible: boolean
  message?: string
}

export const LoadingOverlay = ({
  visible,
  message,
}: LoadingOverlayProps): React.JSX.Element => (
  <Modal transparent animationType="fade" visible={visible}>
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={colors.primary} />
        {message !== undefined && message !== '' && (
          <Text style={styles.message}>{message}</Text>
        )}
      </View>
    </View>
  </Modal>
)

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.xxl,
    alignItems: 'center',
    gap: spacing.md,
    minWidth: 160,
  } as ViewStyle,
  message: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
    textAlign: 'center',
    marginTop: spacing.sm,
  } as TextStyle,
})
```

---

### `app/onboarding/Step6Screen.tsx`

The final onboarding step. Collects preferences, then on "Complete Profile":

1. Validates all fields (lookingFor ≥ 1, genderPreference ≥ 1, ageMin < ageMax)
2. Guards that earlier steps populated required draft fields
3. Shows `LoadingOverlay` with progress messages
4. Uploads photos sequentially to Firebase Storage
5. Writes complete profile to Firestore via `createUserProfile`
6. Clears `onboardingStore` draft
7. Sets `authStore.hasCompletedOnboarding = true` → `RootNavigator` automatically renders `MainTabNavigator`

```typescript
import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Alert,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import * as Localization from 'expo-localization'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { Slider } from '@/components/ui/Slider'
import { Button } from '@/components/ui/Button'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { OnboardingHeader } from '@/app/onboarding/OnboardingNavigator'
import { useOnboardingStore } from '@/store/onboardingStore'
import { useAuthStore } from '@/store/authStore'
import { uploadAllProfilePhotos } from '@/services/firebase/storage'
import { createUserProfile } from '@/services/firebase/firestore'
import { mapFirebaseError } from '@/utils/errorUtils'
import { colors, spacing, typography } from '@/constants/theme'
import type { LookingFor, UserProfile } from '@/types/user'

const STEP = 6
const MIN_AGE = 18
const MAX_AGE = 60
const MIN_DISTANCE_KM = 5
const MAX_DISTANCE_KM = 100

// ─── Option tables ────────────────────────────────────────────────────────────
// We keep label↔value tables here so MultiSelect (which works with strings) can
// round-trip to/from the typed enum values stored in Zustand and Firestore.

interface LookingForOption {
  label: string
  value: LookingFor
}

const LOOKING_FOR_OPTIONS: LookingForOption[] = [
  { label: 'Friends', value: 'friends' },
  { label: 'Workout Partners', value: 'workout_partners' },
  { label: 'Dating', value: 'dating' },
]

interface GenderPrefOption {
  label: string
  value: string
}

const GENDER_PREF_OPTIONS: GenderPrefOption[] = [
  { label: 'Men', value: 'male' },
  { label: 'Women', value: 'female' },
  { label: 'Everyone', value: 'everyone' },
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const labelsToLookingFor = (labels: string[]): LookingFor[] =>
  labels
    .map((label) => LOOKING_FOR_OPTIONS.find((o) => o.label === label)?.value)
    .filter((v): v is LookingFor => v !== undefined)

const lookingForToLabels = (values: LookingFor[]): string[] =>
  values
    .map((v) => LOOKING_FOR_OPTIONS.find((o) => o.value === v)?.label)
    .filter((l): l is string => l !== undefined)

const labelsToGenderPref = (labels: string[]): string[] =>
  labels
    .map((label) => GENDER_PREF_OPTIONS.find((o) => o.label === label)?.value)
    .filter((v): v is string => v !== undefined)

const genderPrefToLabels = (values: string[]): string[] =>
  values
    .map((v) => GENDER_PREF_OPTIONS.find((o) => o.value === v)?.label)
    .filter((l): l is string => l !== undefined)

// ─── Component ────────────────────────────────────────────────────────────────

export default function Step6Screen(): React.JSX.Element {
  const { t } = useTranslation()
  const { draft, updateDraft, clearDraft } = useOnboardingStore()
  const { user, setHasCompletedOnboarding } = useAuthStore()

  // Preference state — pre-fill from draft on re-enter
  const [lookingFor, setLookingFor] = useState<LookingFor[]>(
    draft.lookingFor ?? []
  )
  const [ageMin, setAgeMin] = useState<number>(draft.ageRange?.[0] ?? 18)
  const [ageMax, setAgeMax] = useState<number>(draft.ageRange?.[1] ?? 35)
  const [distanceKm, setDistanceKm] = useState<number>(draft.distanceKm ?? 25)
  const [genderPreference, setGenderPreference] = useState<string[]>(
    draft.genderPreference ?? []
  )

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadMessage, setUploadMessage] = useState('')

  // Validation — Next enabled only when all required preference fields are set
  const isValid =
    lookingFor.length > 0 &&
    genderPreference.length > 0 &&
    ageMin < ageMax

  // Age slider handlers — enforce min < max constraint
  const handleAgeMinChange = (value: number): void => {
    setAgeMin(Math.min(value, ageMax - 1))
  }

  const handleAgeMaxChange = (value: number): void => {
    setAgeMax(Math.max(value, ageMin + 1))
  }

  const handleCompleteProfile = async (): Promise<void> => {
    if (!isValid || user === null) return

    // Persist the current preferences to the draft before submission
    updateDraft({
      lookingFor,
      ageRange: [ageMin, ageMax],
      distanceKm,
      genderPreference,
    })

    // Guard: verify that earlier steps populated all required fields.
    // This should never fire in normal flow but protects against edge cases
    // where the user restores a corrupted draft from AsyncStorage.
    const missingFields: string[] = []
    if (!draft.firstName) missingFields.push('name')
    if (!draft.dateOfBirth) missingFields.push('date of birth')
    if (!draft.gender) missingFields.push('gender')
    if (!draft.location) missingFields.push('location')
    if (!draft.photoUris || draft.photoUris.length < 2) missingFields.push('photos (min 2)')
    if (!draft.bio) missingFields.push('bio')
    if (!draft.height) missingFields.push('height')
    if (!draft.activities || draft.activities.length === 0) missingFields.push('activities')
    if (!draft.fitnessLevel) missingFields.push('fitness level')
    if (!draft.workoutFrequency) missingFields.push('workout frequency')
    if (!draft.dietaryPreference) missingFields.push('dietary preference')
    if (!draft.fitnessGoals || draft.fitnessGoals.length === 0) missingFields.push('fitness goals')
    if (!draft.smoking) missingFields.push('smoking')
    if (!draft.drinking) missingFields.push('drinking')

    if (missingFields.length > 0) {
      Alert.alert(
        t('errors.generic'),
        `Please go back and complete: ${missingFields.join(', ')}.`
      )
      return
    }

    setIsSubmitting(true)
    setUploadMessage(t('onboarding.submit.uploadingPhotos'))

    try {
      // 1 — Upload photos to Firebase Storage sequentially
      const photoUris = draft.photoUris as string[]
      const downloadUrls = await uploadAllProfilePhotos(
        user.uid,
        photoUris,
        (percent) => {
          setUploadMessage(t('onboarding.submit.uploadProgress', { percent }))
        }
      )

      // 2 — Write profile document to Firestore
      setUploadMessage(t('onboarding.submit.savingProfile'))

      await createUserProfile({
        uid: user.uid,
        firstName: draft.firstName as string,
        dateOfBirth: draft.dateOfBirth as Date,
        gender: draft.gender as UserProfile['gender'],
        location: draft.location as UserProfile['location'],
        photos: downloadUrls,
        bio: draft.bio as string,
        height: draft.height as number,
        religion: draft.religion,          // undefined is handled inside createUserProfile
        activities: draft.activities as string[],
        fitnessLevel: draft.fitnessLevel as UserProfile['fitnessLevel'],
        workoutFrequency: draft.workoutFrequency as string,
        dietaryPreference: draft.dietaryPreference as string,
        fitnessGoals: draft.fitnessGoals as string[],
        smoking: draft.smoking as UserProfile['smoking'],
        drinking: draft.drinking as UserProfile['drinking'],
        lookingFor,
        preferences: {
          ageRange: { min: ageMin, max: ageMax },
          distanceKm,
          genders: genderPreference,
        },
        language: Localization.locale.split('-')[0] ?? 'en',
      })

      // 3 — Clear local draft now that all data is safely in Firestore
      clearDraft()

      // 4 — Mark onboarding complete.
      // RootNavigator observes hasCompletedOnboarding and will automatically
      // swap in MainTabNavigator. Do NOT call navigation.navigate() here.
      setHasCompletedOnboarding(true)
    } catch (error: unknown) {
      const message = mapFirebaseError(error)
      Alert.alert(t('errors.generic'), message)
    } finally {
      setIsSubmitting(false)
      setUploadMessage('')
    }
  }

  return (
    <>
      <LoadingOverlay visible={isSubmitting} message={uploadMessage} />

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <OnboardingHeader step={STEP} />

        <View style={styles.content}>
          <Text style={styles.title}>{t('onboarding.step6.title')}</Text>
          <Text style={styles.subtitle}>{t('onboarding.step6.subtitle')}</Text>

          {/* Looking For */}
          <Text style={styles.sectionLabel}>
            {t('onboarding.step6.lookingFor')}
          </Text>
          <MultiSelect
            options={LOOKING_FOR_OPTIONS.map((o) => o.label)}
            selected={lookingForToLabels(lookingFor)}
            onChange={(labels) => setLookingFor(labelsToLookingFor(labels))}
            min={1}
          />

          {/* Gender Preference */}
          <Text style={styles.sectionLabel}>
            {t('onboarding.step6.genderPreference')}
          </Text>
          <MultiSelect
            options={GENDER_PREF_OPTIONS.map((o) => o.label)}
            selected={genderPrefToLabels(genderPreference)}
            onChange={(labels) => setGenderPreference(labelsToGenderPref(labels))}
            min={1}
          />

          {/* Age Range */}
          <Text style={styles.sectionLabel}>
            {t('onboarding.step6.ageRange')}
          </Text>
          <Text style={styles.rangeHint}>
            {t('onboarding.step6.ageRangeValue', { min: ageMin, max: ageMax })}
          </Text>
          <Slider
            label={t('onboarding.step6.ageMin')}
            min={MIN_AGE}
            max={MAX_AGE}
            value={ageMin}
            onChange={handleAgeMinChange}
            formatLabel={(v) => `${v}`}
          />
          <Slider
            label={t('onboarding.step6.ageMax')}
            min={MIN_AGE}
            max={MAX_AGE}
            value={ageMax}
            onChange={handleAgeMaxChange}
            formatLabel={(v) => `${v}`}
          />

          {/* Distance */}
          <Text style={styles.sectionLabel}>
            {t('onboarding.step6.distance')}
          </Text>
          <Slider
            label=""
            min={MIN_DISTANCE_KM}
            max={MAX_DISTANCE_KM}
            value={distanceKm}
            onChange={setDistanceKm}
            formatLabel={(v) => `${v} km`}
          />

          <View style={styles.buttonWrapper}>
            <Button
              label={t('onboarding.completeProfile')}
              onPress={handleCompleteProfile}
              disabled={!isValid || isSubmitting}
              loading={isSubmitting}
            />
          </View>
        </View>
      </ScrollView>
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: colors.background,
  } as ViewStyle,
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  } as ViewStyle,
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.gray[900],
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  } as TextStyle,
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.gray[600],
    marginBottom: spacing.xl,
  } as TextStyle,
  sectionLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.gray[800],
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  } as TextStyle,
  rangeHint: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
    marginBottom: spacing.xs,
  } as TextStyle,
  buttonWrapper: {
    marginTop: spacing.xl,
  } as ViewStyle,
})
```

---

### `app/onboarding/OnboardingNavigator.tsx` — Update

```typescript
// Add import:
import Step6Screen from '@/app/onboarding/Step6Screen'

// Remove this placeholder:
const Step6Screen = (): React.JSX.Element => <StepPlaceholder step={6} />

// The Stack.Screen registration stays exactly the same:
<Stack.Screen name="Step6" component={Step6Screen} />
```

Do not touch Steps 1–5 or `OnboardingHeader`.

---

### i18n Updates

Add the following keys to **all four** translation files (`en.json`, `my.json`, `zh.json`, `ta.json`). Use the English values as placeholders in the non-English files.

```json
{
  "onboarding": {
    "step6": {
      "title": "Your Preferences",
      "subtitle": "Tell us who you're looking to connect with",
      "lookingFor": "I'm looking for",
      "genderPreference": "Show me",
      "ageRange": "Age Range",
      "ageRangeValue": "{{min}} – {{max}} years old",
      "ageMin": "Minimum age",
      "ageMax": "Maximum age",
      "distance": "Maximum Distance"
    },
    "submit": {
      "uploadingPhotos": "Uploading your photos…",
      "uploadProgress": "Uploading photos… {{percent}}%",
      "savingProfile": "Almost there…"
    }
  }
}
```

Also confirm `onboarding.completeProfile` is present in all four files (seeded in Task 07). Add it if missing:

```json
{
  "onboarding": {
    "completeProfile": "Complete Profile"
  }
}
```

---

## Important Architecture Notes for Codex

1. **`age` field must NOT be written from the client.** `createUserProfile` intentionally omits it. The `onUserCreated` Cloud Function (Task 22) calculates and writes `age` server-side from `dateOfBirth`. If any code in this task writes `age` to Firestore, remove it immediately.

2. **`serverTimestamp()` for all Firestore timestamps.** `createdAt` and `lastActive` must use `serverTimestamp()` from `firebase/firestore`. Never pass `new Date()` or `Timestamp.now()` for these fields.

3. **Safe defaults on submission.** The profile document must be written with: `stats: { likes: 0, passes: 0, matches: 0 }`, `subscription: { tier: 'free' }`, `verified: false`, `paused: false`, `banned: false`. These are the correct initial values and are never sourced from user input.

4. **`religion` is optional — omit, do not write `undefined`.** If `draft.religion` is undefined or empty string, the spread conditional in `createUserProfile` omits the field entirely. Writing `religion: undefined` to Firestore throws a runtime SDK error.

5. **Navigation after completion is automatic — do NOT call `navigation.navigate()`.** Setting `setHasCompletedOnboarding(true)` in `authStore` causes `RootNavigator` to re-render and swap in `MainTabNavigator`. Any manual navigation call will cause a navigator conflict crash.

6. **Age sliders are independent — not a dual-handle component.** Two `Slider` instances are used. The `handleAgeMinChange` clamps min to `ageMax - 1`, and `handleAgeMaxChange` clamps max to `ageMin + 1`. The "Complete Profile" button's `disabled` prop also enforces `ageMin < ageMax` as a final guard.

7. **Photo upload is sequential — do not parallelise.** `uploadAllProfilePhotos` uploads photos one at a time using a `for` loop. Do not replace this with `Promise.all` — concurrent uploads from the same mobile client are unreliable on Firebase Storage.

8. **`expo-localization` for language detection.** Use `Localization.locale.split('-')[0]` for the `language` field. Default to `'en'` if the result is empty or undefined.

9. **Error handling is non-optional.** Wrap the full submit in `try/catch`. Use `mapFirebaseError(error)` from `utils/errorUtils.ts` to get a user-friendly string. Show it in an `Alert`. Always call `setIsSubmitting(false)` in `finally` — even on success (the LoadingOverlay must always dismiss).

10. **Label↔value mapping for MultiSelect.** `MultiSelect` receives and returns `string[]` of display labels. The helper functions `labelsToLookingFor`, `lookingForToLabels`, `labelsToGenderPref`, and `genderPrefToLabels` translate between display labels and enum/stored values. These must be correct or Firestore will receive display strings instead of enum values.

---

## Acceptance Criteria

- [ ] `services/firebase/storage.ts` created — `uploadProfilePhoto`, `uploadAllProfilePhotos`, `deleteProfilePhoto` exported with correct TypeScript signatures
- [ ] `services/firebase/firestore.ts` created — `createUserProfile`, `updateUserProfile` exported
- [ ] `createUserProfile` does **not** write `age` field — intentionally omitted
- [ ] `createUserProfile` uses `serverTimestamp()` for `createdAt` and `lastActive` — not `new Date()`
- [ ] `createUserProfile` writes safe defaults: `stats`, `subscription`, `verified: false`, `paused: false`, `banned: false`
- [ ] `religion` field conditionally omitted when undefined/empty — not written as `undefined`
- [ ] `LoadingOverlay` is a fully working component (Modal, ActivityIndicator, optional message)
- [ ] `Step6Screen` renders: Looking For (MultiSelect, min 1), Gender Preference (MultiSelect, min 1), Age Range (two sliders, min < max enforced), Distance slider
- [ ] MultiSelect onChange correctly maps labels back to typed enum values before storing
- [ ] All preference fields pre-fill from `onboardingStore.draft` on screen re-enter
- [ ] "Complete Profile" button disabled when: `lookingFor` empty, `genderPreference` empty, or `ageMin >= ageMax`
- [ ] Tapping "Complete Profile" shows `LoadingOverlay` with progress messages during upload
- [ ] Photos upload sequentially (not in parallel) to `users/{userId}/photos/photo_{index}_{timestamp}.jpg`
- [ ] Firestore document written to `/users/{userId}` with all required fields
- [ ] On success: `clearDraft()` called, `setHasCompletedOnboarding(true)` called, no `navigation.navigate()` called
- [ ] On Firebase/network error: `Alert` shown with `mapFirebaseError` message, `LoadingOverlay` hidden
- [ ] `OnboardingNavigator.tsx` updated — Step6Screen placeholder replaced with real screen
- [ ] All four i18n files updated with `step6.*` and `submit.*` keys
- [ ] Zero inline styles (`style={{ ... }}` never appears in JSX)
- [ ] All user-facing strings through `t()` — no hardcoded text
- [ ] `tsc --noEmit` passes with zero errors
- [ ] No `any` types anywhere in new files

## Do Not Touch

`store/authStore.ts`, `app/onboarding/Step1Screen.tsx` through `Step5Screen.tsx`, `utils/imageUtils.ts`, `utils/errorUtils.ts`, `components/ui/MultiSelect.tsx`, `components/ui/Slider.tsx`, `components/ui/Button.tsx`, `types/`, `constants/`, `App.tsx`, `app/navigation/RootNavigator.tsx`, all navigation files except `OnboardingNavigator.tsx`

## Commit

`git commit -m "task-21: onboarding step 6 preferences and profile submit with storage upload and firestore write"`

---

## After This Session

Update `CHANGELOG.md`:

```
## [Phase 2.6] — YYYY-MM-DD
### Completed
- Task 21: Onboarding Step 6 built (preferences, photo upload, Firestore profile write)
- services/firebase/storage.ts created (uploadProfilePhoto, uploadAllProfilePhotos, deleteProfilePhoto)
- services/firebase/firestore.ts created (createUserProfile, updateUserProfile)
- LoadingOverlay fully implemented (if was previously a stub)
- OnboardingNavigator updated to use real Step6Screen
- Full onboarding flow is now end-to-end: Steps 1–6 complete, profile lands in Firestore

### Files Created / Modified
- services/firebase/storage.ts: sequential photo upload with per-photo and overall progress callbacks, deleteProfilePhoto
- services/firebase/firestore.ts: createUserProfile (safe defaults, age omitted), updateUserProfile
- app/onboarding/Step6Screen.tsx: lookingFor MultiSelect, genderPreference MultiSelect, age range dual sliders (min < max enforced), distance slider, submit with LoadingOverlay and sequential photo upload
- components/ui/LoadingOverlay.tsx: Modal-based overlay with ActivityIndicator and optional message text (fully implemented)
- app/onboarding/OnboardingNavigator.tsx: Step6Screen placeholder replaced with real screen
- i18n/en.json, my.json, zh.json, ta.json: step6 and submit keys added

### Schema Changes
- /users/{userId} document now being written by client at onboarding completion
- age field intentionally omitted from client write — awaiting onUserCreated Cloud Function (Task 22)
- religion field written conditionally (omitted when undefined/empty string)

### Known Issues / Deferred
- age field will be absent/0 on user documents until Task 22 (onUserCreated Cloud Function) is deployed
- Looking For / Gender Preference label↔value mapping is English-only; translation of chip labels deferred to native speaker review
- Drag-to-reorder photos deferred to Phase 2

### Next Up
- Task 22: Cloud Function onUserCreated (calculates age server-side from dateOfBirth, auto-bans under-18 accounts)
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 22 prompt.

---

## Reasoning Level
High
