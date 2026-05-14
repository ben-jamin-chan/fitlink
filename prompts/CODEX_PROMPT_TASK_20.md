# CODEX PROMPT — Task 20
# Onboarding Step 5 — About You

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 2.4 complete. Relevant existing files:
- `store/onboardingStore.ts` — `OnboardingDraft` has `bio?: string`, `height?: number`, `religion?: string` as Step 5 fields; `updateDraft()` and `setCurrentStep()` available
- `app/onboarding/OnboardingNavigator.tsx` — has inline `Step5Screen` placeholder; `OnboardingHeader` exported; `OnboardingStackParamList` has `Step5`
- `app/onboarding/Step4Screen.tsx` — real Step 4 screen, navigates to `Step5` on Next
- `components/ui/Button.tsx` — primary and outline variants, `disabled` prop
- `components/ui/Input.tsx` — supports `multiline`, `numberOfLines`, `maxLength`
- `components/ui/MultiSelect.tsx` and `components/ui/SingleSelect.tsx` — exist, do not touch
- `@react-native-community/slider` — **not yet installed**, must be installed in this task
- `i18n/en.json` — strings under `onboarding.step5.*` must be seeded in this task

Task 20 builds the "About You" step. It introduces one new shared UI primitive (`Slider`) and three fields: bio textarea, height slider, and religion picker. The religion picker is built with React Native `Modal` + `FlatList` — no third-party picker library.

---

## Task 20 — Onboarding Step 5: About You

**Files to create:**
- `components/ui/Slider.tsx`
- `app/onboarding/Step5Screen.tsx`

**Files to modify:**
- `app/onboarding/OnboardingNavigator.tsx` — swap inline `Step5Screen` placeholder with real screen
- `store/onboardingStore.ts` — add `bio`, `height`, `religion` fields to `OnboardingDraft` if not already present; do not touch anything else
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add `onboarding.step5` keys

---

### Install dependency first

```bash
npx expo install @react-native-community/slider
```

---

### `components/ui/Slider.tsx`

Reusable labelled slider. Used here in Step 5 and later in Task 38 (Settings discovery preferences — distance range).

The library export is also named `Slider` — alias it on import to avoid a duplicate identifier error:

```typescript
import RNSlider from '@react-native-community/slider'
```

Full file:

```typescript
// 1. React imports
import React from 'react'

// 2. React Native imports
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native'

// 3. Third-party libraries
import RNSlider from '@react-native-community/slider'

// 9. Internal — constants
import { colors, spacing, typography } from '@/constants/theme'

// Props interface
interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  formatLabel: (value: number) => string
  disabled?: boolean
}

// Component
export const Slider = ({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatLabel,
  disabled = false,
}: SliderProps): React.JSX.Element => {
  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.formattedValue}>{formatLabel(value)}</Text>
      </View>
      <RNSlider
        style={styles.slider}
        value={value}
        minimumValue={min}
        maximumValue={max}
        step={step}
        onValueChange={onChange}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.gray[200]}
        thumbTintColor={colors.primary}
        disabled={disabled}
      />
    </View>
  )
}

// StyleSheet
const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  } as ViewStyle,
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  } as ViewStyle,
  label: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
    fontWeight: typography.weights.medium,
  } as TextStyle,
  formattedValue: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    fontWeight: typography.weights.bold,
  } as TextStyle,
  slider: {
    width: '100%',
    height: 40,
  } as ViewStyle,
})
```

---

### `app/onboarding/Step5Screen.tsx`

Bio, height, and religion are all local `useState` — React Hook Form is not used in this screen. Height is a slider and religion is a modal picker; neither benefits from RHF. Bio has a manual length check before allowing Next. This is consistent with CONVENTIONS.md §7.

```typescript
// 1. React imports
import React, { useState } from 'react'

// 2. React Native imports
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ListRenderItemInfo,
} from 'react-native'

// 3. Third-party libraries
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useTranslation } from 'react-i18next'
import { Ionicons } from '@expo/vector-icons'

// 4. Internal — stores
import { useOnboardingStore } from '@/store/onboardingStore'

// 5. Internal — components
import { OnboardingHeader } from '@/app/onboarding/OnboardingNavigator'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Slider } from '@/components/ui/Slider'

// 8. Internal — types
import type { OnboardingStackParamList } from '@/app/onboarding/OnboardingNavigator'

// 9. Internal — constants
import { colors, spacing, typography } from '@/constants/theme'

// Module-level constants
const STEP = 5
const BIO_MIN = 50
const BIO_MAX = 500
const HEIGHT_MIN = 140
const HEIGHT_MAX = 220
const HEIGHT_DEFAULT = 170
const COUNTER_DANGER_THRESHOLD = 20   // turns red when ≤20 chars remaining

const RELIGION_OPTIONS: string[] = [
  'Islam',
  'Buddhism',
  'Christianity',
  'Hinduism',
  'Sikhism',
  'No preference',
  'Prefer not to say',
]

type Step5NavProp = StackNavigationProp<OnboardingStackParamList, 'Step5'>

export default function Step5Screen(): React.JSX.Element {
  const { t } = useTranslation()
  const navigation = useNavigation<Step5NavProp>()
  const { draft, updateDraft, setCurrentStep } = useOnboardingStore()

  const [bio, setBio] = useState<string>(draft.bio ?? '')
  const [height, setHeight] = useState<number>(draft.height ?? HEIGHT_DEFAULT)
  const [religion, setReligion] = useState<string | undefined>(draft.religion)
  const [isReligionModalOpen, setIsReligionModalOpen] = useState<boolean>(false)

  const charCount = bio.length
  const charsRemaining = BIO_MAX - charCount
  const isValid = charCount >= BIO_MIN

  const handleNext = (): void => {
    updateDraft({ bio, height, religion })
    setCurrentStep(6)
    navigation.navigate('Step6')
  }

  const handleSelectReligion = (option: string): void => {
    setReligion(option)
    setIsReligionModalOpen(false)
  }

  const handleClearReligion = (): void => {
    setReligion(undefined)
    setIsReligionModalOpen(false)
  }

  const renderReligionOption = ({
    item,
  }: ListRenderItemInfo<string>): React.JSX.Element => {
    const isSelected = religion === item
    return (
      <TouchableOpacity
        style={styles.modalOption}
        onPress={() => handleSelectReligion(item)}
        activeOpacity={0.7}
      >
        <Text style={styles.modalOptionText}>{item}</Text>
        {isSelected && (
          <Ionicons name="checkmark" size={20} color={colors.primary} />
        )}
      </TouchableOpacity>
    )
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <OnboardingHeader step={STEP} />

        <View style={styles.content}>
          <Text style={styles.title}>{t('onboarding.step5.title')}</Text>

          {/* Bio */}
          <Text style={styles.fieldLabel}>{t('onboarding.step5.bio.label')}</Text>
          <Input
            placeholder={t('onboarding.step5.bio.placeholder')}
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={5}
            maxLength={BIO_MAX}
          />
          <View style={styles.counterRow}>
            {charCount > 0 && charCount < BIO_MIN ? (
              <Text style={styles.bioError}>{t('onboarding.step5.bio.errorMin')}</Text>
            ) : (
              <View />
            )}
            <Text
              style={[
                styles.counter,
                charsRemaining <= COUNTER_DANGER_THRESHOLD && styles.counterDanger,
              ]}
            >
              {charCount}/{BIO_MAX}
            </Text>
          </View>

          {/* Height */}
          <Text style={styles.fieldLabel}>{t('onboarding.step5.height.label')}</Text>
          <Slider
            label={t('onboarding.step5.height.label')}
            value={height}
            min={HEIGHT_MIN}
            max={HEIGHT_MAX}
            step={1}
            onChange={setHeight}
            formatLabel={(v) => `${v} cm`}
          />

          {/* Religion */}
          <Text style={styles.fieldLabel}>{t('onboarding.step5.religion.label')}</Text>
          <TouchableOpacity
            style={styles.pickerRow}
            onPress={() => setIsReligionModalOpen(true)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.pickerText,
                religion === undefined && styles.pickerPlaceholder,
              ]}
            >
              {religion ?? t('onboarding.step5.religion.placeholder')}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.gray[400]} />
          </TouchableOpacity>

          {/* Back / Next */}
          <View style={styles.buttonRow}>
            <View style={styles.backButton}>
              <Button
                label={t('common.back')}
                onPress={() => navigation.goBack()}
                variant="outline"
              />
            </View>
            <View style={styles.nextButton}>
              <Button
                label={t('common.next')}
                onPress={handleNext}
                disabled={!isValid}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Religion Modal */}
      <Modal
        visible={isReligionModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsReligionModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t('onboarding.step5.religion.modalTitle')}
              </Text>
              <TouchableOpacity onPress={() => setIsReligionModalOpen(false)}>
                <Ionicons name="close" size={24} color={colors.gray[600]} />
              </TouchableOpacity>
            </View>

            {religion !== undefined && (
              <TouchableOpacity
                style={styles.clearRow}
                onPress={handleClearReligion}
                activeOpacity={0.7}
              >
                <Text style={styles.clearText}>
                  {t('onboarding.step5.religion.clearSelection')}
                </Text>
              </TouchableOpacity>
            )}

            <FlatList
              data={RELIGION_OPTIONS}
              keyExtractor={(item) => item}
              renderItem={renderReligionOption}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        </View>
      </Modal>
    </>
  )
}

// StyleSheet
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
    marginBottom: spacing.xl,
    marginTop: spacing.md,
  } as TextStyle,
  fieldLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.gray[700],
    marginBottom: spacing.xs,
    marginTop: spacing.lg,
  } as TextStyle,
  counterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
  } as ViewStyle,
  counter: {
    fontSize: typography.sizes.xs,
    color: colors.gray[600],
  } as TextStyle,
  counterDanger: {
    color: colors.danger,
  } as TextStyle,
  bioError: {
    fontSize: typography.sizes.xs,
    color: colors.danger,
  } as TextStyle,
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.surface,
  } as ViewStyle,
  pickerText: {
    fontSize: typography.sizes.md,
    color: colors.gray[900],
  } as TextStyle,
  pickerPlaceholder: {
    color: colors.gray[400],
  } as TextStyle,
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xxl,
  } as ViewStyle,
  backButton: {
    flex: 1,
  } as ViewStyle,
  nextButton: {
    flex: 2,
  } as ViewStyle,
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  } as ViewStyle,
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: spacing.xxl,
    maxHeight: '70%',
  } as ViewStyle,
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
  } as ViewStyle,
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.gray[900],
  } as TextStyle,
  clearRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  } as ViewStyle,
  clearText: {
    fontSize: typography.sizes.md,
    color: colors.danger,
  } as TextStyle,
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  } as ViewStyle,
  modalOptionText: {
    fontSize: typography.sizes.md,
    color: colors.gray[900],
  } as TextStyle,
  separator: {
    height: 1,
    backgroundColor: colors.gray[100],
    marginHorizontal: spacing.lg,
  } as ViewStyle,
})
```

---

### `app/onboarding/OnboardingNavigator.tsx` — Update

```typescript
// Add import:
import Step5Screen from '@/app/onboarding/Step5Screen'

// Remove:
const Step5Screen = (): React.JSX.Element => <StepPlaceholder step={5} />

// The Stack.Screen registration stays the same:
<Stack.Screen name="Step5" component={Step5Screen} />
```

Do not touch Step1–Step4 real screens, the Step6 placeholder, or `OnboardingHeader`.

---

### i18n — All four files

Merge the following into the existing `onboarding` object in `en.json`, `my.json`, `zh.json`, and `ta.json`. Use English values as placeholders in the non-English files — translations deferred to native speaker review.

```json
"step5": {
  "title": "About You",
  "bio": {
    "label": "About Me",
    "placeholder": "Tell people about yourself, your fitness journey, and what you're looking for...",
    "errorMin": "Write at least 50 characters so matches can get to know you"
  },
  "height": {
    "label": "Height"
  },
  "religion": {
    "label": "Religion (Optional)",
    "placeholder": "Select religion",
    "modalTitle": "Select Religion",
    "clearSelection": "Clear selection"
  }
}
```

---

## Important Architecture Notes for Codex

1. **`useState` is correct for all three fields.** Bio, height, and religion are purely local UI state until Next is tapped. CONVENTIONS.md §7 permits `useState` for local UI state. RHF is not needed here and must not be introduced.

2. **Religion is optional — it must not block Next.** The only gate on the Next button is `bio.length >= BIO_MIN`. If religion is `undefined` when the user taps Next, that is valid and must be passed to `updateDraft` as `undefined`.

3. **Counter logic has two separate concerns.** The `{charCount}/500` counter turns `colors.danger` when ≤20 characters *remaining* (i.e. near the maximum). The "too short" error message appears when `charCount > 0 && charCount < 50`. These are independent — do not conflate them.

4. **`Slider` naming collision.** `@react-native-community/slider` exports a default named `Slider`. Always import it as `RNSlider`. If the alias is missing, TypeScript will throw a duplicate identifier error at module scope.

5. **No Firebase in this task.** The only writes are to `onboardingStore` local Zustand state via `updateDraft`. Firebase Storage upload happens in Step6Screen (Task 21). If any Firebase import appears, remove it.

---

## Acceptance Criteria

- [ ] `@react-native-community/slider` installed via `npx expo install`
- [ ] `Slider` component renders label row (label left, formatted value right in `colors.primary`) and slider track with primary-coloured thumb and fill
- [ ] Height slider defaults to 170 cm (or restores from draft), moves in 1 cm steps, live-updates the formatted value label
- [ ] Bio textarea enforces 500-char maximum via `maxLength`
- [ ] `{charCount}/500` counter always visible below bio
- [ ] Counter text turns `colors.danger` when ≤20 characters remaining
- [ ] "Too short" error message appears below counter when `charCount` is between 1 and 49
- [ ] Next button disabled until bio reaches 50 characters
- [ ] Religion picker row opens bottom-sheet modal on tap
- [ ] Modal lists all 7 options; selected option shows checkmark
- [ ] "Clear selection" row appears in modal only when a religion is already selected
- [ ] Selecting an option closes modal and reflects selection in picker row
- [ ] Clearing selection closes modal and shows placeholder text
- [ ] Religion `undefined` does not disable Next
- [ ] Back button navigates to Step 4 without touching the store
- [ ] On Next: `updateDraft({ bio, height, religion })`, `setCurrentStep(6)`, navigate to `Step6`
- [ ] Screen pre-fills all three fields from `onboardingStore.draft` on re-entry
- [ ] `OnboardingHeader` reflects step 5 of 6
- [ ] Zero inline styles, all text through `t()`
- [ ] `tsc --noEmit` passes with zero errors

## Do Not Touch
`utils/imageUtils.ts`, `components/profile/PhotoGrid.tsx`, `components/ui/MultiSelect.tsx`, `components/ui/SingleSelect.tsx`, `components/ui/Button.tsx`, `components/ui/Input.tsx`, `components/ui/ProgressDots.tsx`, `store/authStore.ts`, `app/onboarding/Step1Screen.tsx`, `app/onboarding/Step2Screen.tsx`, `app/onboarding/Step3Screen.tsx`, `app/onboarding/Step4Screen.tsx`, `types/`, `constants/`, `App.tsx`, all navigation files except `OnboardingNavigator.tsx`

## Commit
`git commit -m "task-20: onboarding step 5 — bio textarea, height slider, religion picker"`

---

## After This Session

Update `CHANGELOG.md`:
```
## [Phase 2.5] — YYYY-MM-DD
### Completed
- Task 20: Onboarding Step 5 built (bio textarea, height slider, religion modal picker)
- Slider component created in components/ui/
- @react-native-community/slider installed
- OnboardingNavigator updated to use real Step5Screen

### Files Created / Modified
- components/ui/Slider.tsx: labelled RNSlider wrapper, primary tint, formatted value display
- app/onboarding/Step5Screen.tsx: bio (50–500 chars, live counter), height slider (140–220 cm, default 170), religion modal picker (optional, 7 options)
- app/onboarding/OnboardingNavigator.tsx: Step5Screen placeholder replaced with real screen
- store/onboardingStore.ts: confirmed/added bio, height, religion fields on OnboardingDraft
- i18n/en.json, my.json, zh.json, ta.json: step5 keys added

### Known Issues / Deferred
- Religion display strings are English placeholders in my/zh/ta — deferred to native speaker review
- Height field does not expose an imperial (ft/in) toggle — deferred to Phase 2 polish

### Next Up
- Task 21: Onboarding Step 6 — Preferences + Profile Submit (lookingFor, age range, distance, gender preference, Firebase photo upload, createUserProfile)
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 21 prompt.

---

## Reasoning Level
Medium