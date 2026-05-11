# CODEX PROMPT — Task 17
# Onboarding Step 2 — Photos

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 2.1 complete. Relevant existing files:
- `store/onboardingStore.ts` — `OnboardingDraft` has `photoUris?: string[]` as Step 2 field; `updateDraft()` and `setCurrentStep()` available
- `app/onboarding/OnboardingNavigator.tsx` — has inline `Step2Screen` placeholder; `OnboardingHeader` exported; `OnboardingStackParamList` has `Step2`
- `app/onboarding/Step1Screen.tsx` — real Step 1 screen, navigates to `Step2` on Next
- `expo-image-picker` and `expo-image-manipulator` — both installed in Task 02
- `constants/theme.ts` — `MAX_PHOTOS = 6`, `MIN_PHOTOS = 2` exported from `constants/spacing.ts`
- `i18n/en.json` — strings under `onboarding.step2.*` already seeded

Task 17 builds the photo selection step. Photos are stored as **local URIs only** in `onboardingStore`. They are NOT uploaded to Firebase Storage here — upload happens at Step 6 completion. If Codex tries to upload here, that is architectural drift and must be corrected.

---

## Task 17 — Onboarding Step 2: Photos

**Files to create:**
- `utils/imageUtils.ts`
- `components/profile/PhotoGrid.tsx`
- `app/onboarding/Step2Screen.tsx`

**Files to modify:**
- `app/onboarding/OnboardingNavigator.tsx` — swap inline `Step2Screen` placeholder with real screen

---

### `utils/imageUtils.ts`

Image compression utility. Used here in Step 2 and later in Task 36 (Edit Profile photo management).

```typescript
import * as ImageManipulator from 'expo-image-manipulator'

const MAX_WIDTH_PX = 1080
const QUALITY = 0.8

/**
 * Compresses and resizes an image to fit within MAX_WIDTH_PX at QUALITY.
 * Returns the URI of the compressed image.
 * Always call this before storing or uploading any user photo.
 */
export const compressImage = async (uri: string): Promise<string> => {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_WIDTH_PX } }],
    {
      compress: QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    }
  )
  return result.uri
}

/**
 * Requests media library permission and launches the image picker.
 * Returns the selected local URI after compression, or null if cancelled/denied.
 */
export const pickAndCompressImage = async (): Promise<string | null> => {
  const { requestMediaLibraryPermissionsAsync, launchImageLibraryAsync, MediaTypeOptions } =
    await import('expo-image-picker')

  const { status } = await requestMediaLibraryPermissionsAsync()
  if (status !== 'granted') {
    return null
  }

  const result = await launchImageLibraryAsync({
    mediaTypes: MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [3, 4],           // portrait crop — matches profile card ratio
    quality: 1,               // pick at full quality, then compress ourselves
  })

  if (result.canceled || result.assets.length === 0) {
    return null
  }

  const rawUri = result.assets[0].uri
  const compressedUri = await compressImage(rawUri)
  return compressedUri
}
```

---

### `components/profile/PhotoGrid.tsx`

3-column grid with up to 6 photo slots. Tap empty slot → pick + compress → add. Tap X on filled slot → remove. First slot labelled "Primary". Reusable by Edit Profile screen (Task 37) and this onboarding step.

```typescript
import React from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Dimensions,
  ViewStyle,
  TextStyle,
  ImageStyle,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { pickAndCompressImage } from '@/utils/imageUtils'
import { colors, spacing, typography, borderRadius } from '@/constants/theme'
import { MAX_PHOTOS } from '@/constants/theme'

const SCREEN_WIDTH = Dimensions.get('window').width
const GRID_PADDING = spacing.lg * 2       // left + right padding of parent
const GRID_GAP = spacing.sm
const SLOT_SIZE = (SCREEN_WIDTH - GRID_PADDING - GRID_GAP * 2) / 3

interface PhotoGridProps {
  photoUris: string[]
  onPhotosChange: (uris: string[]) => void
  maxPhotos?: number
}

export const PhotoGrid = ({
  photoUris,
  onPhotosChange,
  maxPhotos = MAX_PHOTOS,
}: PhotoGridProps): React.JSX.Element => {
  const { t } = useTranslation()

  const handleAddPhoto = async (slotIndex: number): Promise<void> => {
    const uri = await pickAndCompressImage()
    if (uri === null) {
      // Permission denied — show alert
      if (photoUris.length === 0) {
        Alert.alert(
          t('errors.photo.permission'),
          '',
          [{ text: t('common.ok' as 'common.done') }]
        )
      }
      return
    }
    const newUris = [...photoUris]
    newUris[slotIndex] = uri
    onPhotosChange(newUris.filter(Boolean))
  }

  const handleRemovePhoto = (index: number): void => {
    const newUris = photoUris.filter((_, i) => i !== index)
    onPhotosChange(newUris)
  }

  // Build array of exactly `maxPhotos` slots (filled or empty)
  const slots = Array(maxPhotos)
    .fill(null)
    .map((_, i) => photoUris[i] ?? null)

  return (
    <View style={styles.grid}>
      {slots.map((uri, index) => (
        <View key={index} style={styles.slot}>
          {uri !== null ? (
            // Filled slot
            <View style={styles.filledSlot}>
              <Image source={{ uri }} style={styles.photo} />
              {/* Primary badge on first slot */}
              {index === 0 && (
                <View style={styles.primaryBadge}>
                  <Text style={styles.primaryText}>
                    {t('onboarding.step2.primary')}
                  </Text>
                </View>
              )}
              {/* Remove button */}
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemovePhoto(index)}
                activeOpacity={0.8}
              >
                <Ionicons name="close-circle" size={22} color={colors.white} />
              </TouchableOpacity>
            </View>
          ) : (
            // Empty slot — only tappable if within current count + 1
            <TouchableOpacity
              style={styles.emptySlot}
              onPress={() => handleAddPhoto(index)}
              activeOpacity={0.7}
              disabled={index > photoUris.length}   // don't skip gaps
            >
              <Ionicons
                name="add"
                size={28}
                color={index > photoUris.length ? colors.gray[300] : colors.gray[400]}
              />
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
  } as ViewStyle,
  slot: {
    width: SLOT_SIZE,
    height: SLOT_SIZE * (4 / 3),    // 3:4 portrait ratio
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  } as ViewStyle,
  filledSlot: {
    flex: 1,
    position: 'relative',
  } as ViewStyle,
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.md,
  } as ImageStyle,
  primaryBadge: {
    position: 'absolute',
    bottom: spacing.xs,
    left: spacing.xs,
    backgroundColor: colors.overlay,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
  } as ViewStyle,
  primaryText: {
    fontSize: typography.sizes.xs,
    color: colors.white,
    fontWeight: typography.weights.semibold,
  } as TextStyle,
  removeButton: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
  } as ViewStyle,
  emptySlot: {
    flex: 1,
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.gray[200],
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  } as ViewStyle,
})
```

---

### `app/onboarding/Step2Screen.tsx`

```typescript
import React, { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useTranslation } from 'react-i18next'
import { OnboardingHeader } from '@/app/onboarding/OnboardingNavigator'
import { PhotoGrid } from '@/components/profile/PhotoGrid'
import { Button } from '@/components/ui/Button'
import { useOnboardingStore } from '@/store/onboardingStore'
import { colors, spacing, typography } from '@/constants/theme'
import { MIN_PHOTOS } from '@/constants/theme'
import type { OnboardingStackParamList } from '@/app/onboarding/OnboardingNavigator'

type Step2NavProp = StackNavigationProp<OnboardingStackParamList, 'Step2'>

const STEP = 2

export default function Step2Screen(): React.JSX.Element {
  const { t } = useTranslation()
  const navigation = useNavigation<Step2NavProp>()
  const { draft, updateDraft, setCurrentStep } = useOnboardingStore()

  const [photoUris, setPhotoUris] = useState<string[]>(draft.photoUris ?? [])

  const isValid = photoUris.length >= MIN_PHOTOS

  const handleNext = (): void => {
    updateDraft({ photoUris })
    setCurrentStep(3)
    navigation.navigate('Step3')
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <OnboardingHeader step={STEP} />

      <View style={styles.content}>
        <Text style={styles.title}>{t('onboarding.step2.title')}</Text>
        <Text style={styles.subtitle}>{t('onboarding.step2.subtitle')}</Text>

        <View style={styles.gridWrapper}>
          <PhotoGrid
            photoUris={photoUris}
            onPhotosChange={setPhotoUris}
          />
        </View>

        <Text style={styles.guidelines}>{t('onboarding.step2.guidelines')}</Text>

        <View style={styles.buttonWrapper}>
          <Button
            label={t('common.next')}
            onPress={handleNext}
            disabled={!isValid}
          />
        </View>
      </View>
    </ScrollView>
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
  gridWrapper: {
    marginBottom: spacing.md,
  } as ViewStyle,
  guidelines: {
    fontSize: typography.sizes.sm,
    color: colors.gray[500],
    textAlign: 'center',
    marginBottom: spacing.lg,
  } as TextStyle,
  buttonWrapper: {
    marginTop: spacing.md,
  } as ViewStyle,
})
```

---

### `app/onboarding/OnboardingNavigator.tsx` — Update

```typescript
// Add import:
import Step2Screen from '@/app/onboarding/Step2Screen'

// Remove:
const Step2Screen = (): React.JSX.Element => <StepPlaceholder step={2} />

// The Stack.Screen registration stays the same:
<Stack.Screen name="Step2" component={Step2Screen} />
```

Do not touch Step3–Step6 placeholders or `OnboardingHeader`.

---

## Important Architecture Notes for Codex

1. **No Firebase upload in this task.** `photoUris` contains local device URIs. Firebase Storage upload happens in Step6Screen (Task 21). If any upload code appears in this task, remove it.

2. **Gap handling in the grid.** Empty slots beyond `photoUris.length` are shown but not tappable — `disabled={index > photoUris.length}` prevents users from jumping ahead and creating gaps. Slot 0 is always tappable (first photo). Slot 1 is tappable only if slot 0 is filled. Etc.

3. **Permission denial.** If the user denies media library access, `pickAndCompressImage` returns `null`. Show an alert telling them to allow photo access in Settings. Don't crash silently.

4. **`MIN_PHOTOS` is 2, `MAX_PHOTOS` is 6** — both imported from `constants/theme`.

---

## Acceptance Criteria

- [ ] `utils/imageUtils.ts` created — `compressImage` and `pickAndCompressImage` exported
- [ ] `PhotoGrid` renders 6 slots in 3-column layout with correct 3:4 aspect ratio
- [ ] First slot shows "Primary" badge when a photo is in it
- [ ] Tapping an empty slot opens device photo library
- [ ] Selected photo is compressed (1080px, 80% quality) before storing URI
- [ ] "X" button on filled slot removes that photo and shifts remaining correctly
- [ ] Empty slots beyond current count are visually dimmed and not tappable
- [ ] Next button disabled until 2+ photos selected
- [ ] Photos pre-fill from persisted draft on screen re-enter
- [ ] On Next: `updateDraft({ photoUris })`, `setCurrentStep(3)`, navigate to Step3
- [ ] No Firebase upload code present
- [ ] Zero inline styles, all text through `t()`
- [ ] `tsc --noEmit` passes with zero errors

## Do Not Touch
`utils/errorUtils.ts`, `store/onboardingStore.ts`, `store/authStore.ts`, `app/onboarding/Step1Screen.tsx`, `components/ui/`, `types/`, `constants/`, `i18n/`, `App.tsx`, all navigation files except `OnboardingNavigator.tsx`

## Commit
`git commit -m "task-17: onboarding step 2 photos with photo grid and image compression"`

---

## After This Session

Update `CHANGELOG.md`:
```
## [Phase 2.2] — YYYY-MM-DD
### Completed
- Task 17: Onboarding Step 2 built (photo selection, compression, grid)
- utils/imageUtils.ts created (compressImage, pickAndCompressImage)
- PhotoGrid component created in components/profile/
- OnboardingNavigator updated to use real Step2Screen

### Files Created / Modified
- utils/imageUtils.ts: compressImage (1080px, 80% quality), pickAndCompressImage (picker + compress)
- components/profile/PhotoGrid.tsx: 3-column grid, 6 slots, 3:4 ratio, Primary badge, remove button
- app/onboarding/Step2Screen.tsx: photo grid, min 2 photos required, saves local URIs to draft
- app/onboarding/OnboardingNavigator.tsx: Step2Screen placeholder replaced with real screen

### Known Issues / Deferred
- Photo upload to Firebase Storage deferred to Step 6 completion (Task 21)
- Drag-to-reorder photos deferred to Phase 2

### Next Up
- Task 18: Onboarding Step 3 — Fitness Profile (activities MultiSelect, fitness level, frequency)
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 18 prompt.

---

## Reasoning Level
Medium
