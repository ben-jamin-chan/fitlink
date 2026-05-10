# CODEX PROMPT — Task 16
# Onboarding Step 1 — Basic Info

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 2.0 complete. Onboarding shell exists:
- `store/onboardingStore.ts` — `draft`, `updateDraft()`, `setCurrentStep()`, `clearDraft()`; `OnboardingDraft` has `firstName`, `dateOfBirth`, `gender`, `city`, `country` as Step 1 fields
- `app/onboarding/OnboardingNavigator.tsx` — has inline `Step1Screen` placeholder + `OnboardingHeader` exported; `OnboardingStackParamList` defines Step1–Step6
- `components/ui/Button.tsx` and `components/ui/Input.tsx` — both available
- `i18n/en.json` — strings under `onboarding.step1.*` already seeded
- `types/user.ts` — `Gender` type: `'male' | 'female' | 'non-binary'`

Task 16 replaces the `Step1Screen` placeholder with the real screen. It also installs `@react-native-community/datetimepicker` which is required for the date of birth picker and was not included in Task 02's install list.

---

## Task 16 — Onboarding Step 1: Basic Info

**Install before coding:**
```bash
npx expo install @react-native-community/datetimepicker
```

**Files to create:**
- `app/onboarding/Step1Screen.tsx`

**Files to modify:**
- `app/onboarding/OnboardingNavigator.tsx` — swap inline `Step1Screen` placeholder with real screen

---

### `app/onboarding/Step1Screen.tsx`

Collects: First Name, Date of Birth, Gender, City. Validates before enabling Next. Saves to `onboardingStore` on Next and navigates to Step 2.

```typescript
import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native'
import DateTimePicker, {
  DateTimePickerEvent,
} from '@react-native-community/datetimepicker'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { useTranslation } from 'react-i18next'
import { OnboardingHeader } from '@/app/onboarding/OnboardingNavigator'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useOnboardingStore } from '@/store/onboardingStore'
import { colors, spacing, typography, borderRadius } from '@/constants/theme'
import type { Gender } from '@/types/user'
import type { OnboardingStackParamList } from '@/app/onboarding/OnboardingNavigator'

type Step1NavProp = StackNavigationProp<OnboardingStackParamList, 'Step1'>

const STEP = 1
const MIN_AGE_YEARS = 18

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getMaxDate = (): Date => {
  const d = new Date()
  d.setFullYear(d.getFullYear() - MIN_AGE_YEARS)
  return d
}

const formatDateDisplay = (date: Date): string =>
  date.toLocaleDateString('en-MY', { day: '2-digit', month: 'long', year: 'numeric' })

const GENDERS: { value: Gender; labelKey: string }[] = [
  { value: 'male', labelKey: 'onboarding.step1.male' },
  { value: 'female', labelKey: 'onboarding.step1.female' },
  { value: 'non-binary', labelKey: 'onboarding.step1.nonBinary' },
]

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function Step1Screen(): React.JSX.Element {
  const { t } = useTranslation()
  const navigation = useNavigation<Step1NavProp>()
  const { draft, updateDraft, setCurrentStep } = useOnboardingStore()

  // Local state — initialised from persisted draft so user can resume
  const [firstName, setFirstName] = useState(draft.firstName ?? '')
  const [dateOfBirth, setDateOfBirth] = useState<Date>(
    draft.dateOfBirth !== undefined
      ? new Date(draft.dateOfBirth)
      : getMaxDate()
  )
  const [dobSelected, setDobSelected] = useState(draft.dateOfBirth !== undefined)
  const [showPicker, setShowPicker] = useState(false)   // Android: controls dialog visibility
  const [gender, setGender] = useState<Gender | undefined>(draft.gender)
  const [city, setCity] = useState(draft.city ?? '')

  // ─── Validation ─────────────────────────────────────────────────────────────

  const firstNameError =
    firstName.length > 0 && (firstName.length < 2 || firstName.length > 50)
      ? t('errors.profile.minActivities')  // reuse generic min-length error — acceptable for now
      : undefined

  const isValid =
    firstName.trim().length >= 2 &&
    firstName.trim().length <= 50 &&
    dobSelected &&
    gender !== undefined &&
    city.trim().length >= 2

  // ─── Date picker handlers ────────────────────────────────────────────────────

  const handleDateChange = (event: DateTimePickerEvent, selected?: Date): void => {
    if (Platform.OS === 'android') {
      setShowPicker(false)
      if (event.type === 'dismissed') return
    }
    if (selected !== undefined) {
      setDateOfBirth(selected)
      setDobSelected(true)
    }
  }

  // ─── Next ────────────────────────────────────────────────────────────────────

  const handleNext = (): void => {
    updateDraft({
      firstName: firstName.trim(),
      dateOfBirth: dateOfBirth.toISOString(),
      gender,
      city: city.trim(),
      country: 'Malaysia',        // default — location picker is Phase 2 enhancement
    })
    setCurrentStep(2)
    navigation.navigate('Step2')
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <OnboardingHeader step={STEP} />

      <View style={styles.content}>
        <Text style={styles.title}>{t('onboarding.step1.title')}</Text>

        {/* First Name */}
        <View style={styles.field}>
          <Input
            label={t('onboarding.step1.firstName')}
            placeholder={t('onboarding.step1.firstName')}
            value={firstName}
            onChangeText={setFirstName}
            error={firstNameError}
            autoCapitalize="words"
            textContentType="givenName"
            maxLength={50}
          />
        </View>

        {/* Date of Birth */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('onboarding.step1.dateOfBirth')}</Text>

          {Platform.OS === 'ios' ? (
            // iOS: inline wheel picker
            <View style={styles.datePickerContainer}>
              <DateTimePicker
                value={dateOfBirth}
                mode="date"
                display="spinner"
                maximumDate={getMaxDate()}
                minimumDate={new Date(1940, 0, 1)}
                onChange={handleDateChange}
                style={styles.iosDatePicker}
              />
            </View>
          ) : (
            // Android: tap to open dialog
            <>
              <TouchableOpacity
                style={[styles.dateButton, !dobSelected && styles.dateButtonPlaceholder]}
                onPress={() => setShowPicker(true)}
                activeOpacity={0.7}
              >
                <Text style={[styles.dateButtonText, !dobSelected && styles.dateButtonPlaceholderText]}>
                  {dobSelected
                    ? formatDateDisplay(dateOfBirth)
                    : t('onboarding.step1.dateOfBirth')}
                </Text>
              </TouchableOpacity>
              {showPicker && (
                <DateTimePicker
                  value={dateOfBirth}
                  mode="date"
                  display="default"
                  maximumDate={getMaxDate()}
                  minimumDate={new Date(1940, 0, 1)}
                  onChange={handleDateChange}
                />
              )}
            </>
          )}
        </View>

        {/* Gender */}
        <View style={styles.field}>
          <Text style={styles.label}>{t('onboarding.step1.gender')}</Text>
          <View style={styles.genderRow}>
            {GENDERS.map(({ value, labelKey }) => (
              <TouchableOpacity
                key={value}
                style={[
                  styles.genderChip,
                  gender === value && styles.genderChipSelected,
                ]}
                onPress={() => setGender(value)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.genderChipText,
                    gender === value && styles.genderChipTextSelected,
                  ]}
                >
                  {t(labelKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* City */}
        <View style={styles.field}>
          <Input
            label={t('onboarding.step1.location')}
            placeholder="e.g. Kuala Lumpur"
            value={city}
            onChangeText={setCity}
            autoCapitalize="words"
            textContentType="addressCity"
            maxLength={100}
          />
        </View>

        {/* Next Button */}
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
    marginBottom: spacing.xl,
    marginTop: spacing.md,
  } as TextStyle,
  field: {
    marginBottom: spacing.lg,
  } as ViewStyle,
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.gray[700],
    marginBottom: spacing.xs,
  } as TextStyle,

  // Date picker — iOS
  datePickerContainer: {
    borderWidth: 1.5,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  } as ViewStyle,
  iosDatePicker: {
    height: 120,
  } as ViewStyle,

  // Date picker — Android trigger button
  dateButton: {
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  } as ViewStyle,
  dateButtonPlaceholder: {
    borderColor: colors.gray[300],
  } as ViewStyle,
  dateButtonText: {
    fontSize: typography.sizes.md,
    color: colors.gray[900],
  } as TextStyle,
  dateButtonPlaceholderText: {
    color: colors.gray[400],
  } as TextStyle,

  // Gender chips
  genderRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  } as ViewStyle,
  genderChip: {
    flex: 1,
    height: 44,
    borderWidth: 1.5,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  } as ViewStyle,
  genderChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  } as ViewStyle,
  genderChipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.gray[700],
  } as TextStyle,
  genderChipTextSelected: {
    color: colors.white,
  } as TextStyle,

  buttonWrapper: {
    marginTop: spacing.xl,
  } as ViewStyle,
})
```

---

### `app/onboarding/OnboardingNavigator.tsx` — Update

Replace the inline `Step1Screen` definition with the real screen import. Same pattern as auth screens:

```typescript
// Add import at top:
import Step1Screen from '@/app/onboarding/Step1Screen'

// Replace:
const Step1Screen = (): React.JSX.Element => <StepPlaceholder step={1} />

// With: (remove the const definition entirely, the import replaces it)
// And update the Stack.Screen registration if needed — it should already reference Step1Screen
```

The `Stack.Screen name="Step1"` registration stays the same. Remove the inline `Step1Screen` component definition. `StepPlaceholder` and the remaining `Step2Screen`–`Step6Screen` inline components stay untouched.

---

## Acceptance Criteria

- [ ] `@react-native-community/datetimepicker` installed
- [ ] First Name field validates: 2–50 chars, shows error inline
- [ ] Date of birth: iOS shows inline wheel picker, Android shows button that opens dialog
- [ ] Date picker enforces 18+ minimum (max date = today minus 18 years)
- [ ] Date picker minimum date = 1940 (prevents invalid very old dates)
- [ ] Gender: 3 chip buttons, selected chip is green filled, deselected is gray outline
- [ ] City: text input, minimum 2 chars required
- [ ] Next button disabled until all 4 fields are valid
- [ ] On Next: `updateDraft()` called with all 4 fields, `setCurrentStep(2)` called, navigates to Step2 placeholder
- [ ] If user exits and re-enters onboarding, fields are pre-filled from persisted draft
- [ ] `OnboardingNavigator` uses real `Step1Screen` — inline placeholder removed
- [ ] Zero inline styles, all text through `t()`
- [ ] `tsc --noEmit` passes with zero errors

## Do Not Touch
`store/onboardingStore.ts`, `components/ui/Button.tsx`, `components/ui/Input.tsx`, `store/authStore.ts`, `app/navigation/RootNavigator.tsx`, `types/`, `constants/`, `i18n/`, `App.tsx`

## Commit
`git commit -m "task-16: onboarding step 1 basic info screen"`

---

## After This Session

Update `CHANGELOG.md`:
```
## [Phase 2.1] — YYYY-MM-DD
### Completed
- Task 16: Onboarding Step 1 built (firstName, dateOfBirth, gender, city)
- Installed @react-native-community/datetimepicker
- OnboardingNavigator updated to use real Step1Screen

### Files Created / Modified
- app/onboarding/Step1Screen.tsx: first name, DOB picker (iOS inline/Android dialog), gender chips, city input
- app/onboarding/OnboardingNavigator.tsx: Step1Screen placeholder replaced with real screen
- package.json: added @react-native-community/datetimepicker

### Next Up
- Task 17: Onboarding Step 2 — Photos (PhotoGrid, expo-image-picker, compression)
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 17 prompt.

---

## Reasoning Level
Medium
