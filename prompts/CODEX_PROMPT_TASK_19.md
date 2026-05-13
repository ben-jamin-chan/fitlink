# CODEX PROMPT — Task 19
# Onboarding Step 4 — Lifestyle

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 2.3 complete. Relevant existing files:
- `store/onboardingStore.ts` — `OnboardingDraft` has `activities`, `fitnessLevel`, `workoutFrequency` fields from Task 18; `updateDraft()` and `setCurrentStep()` available; **check whether `dietaryPreference`, `fitnessGoals`, `smoking`, `drinking` fields exist — add them to `OnboardingDraft` if missing, with correct types, touching no other store logic**
- `app/onboarding/OnboardingNavigator.tsx` — has inline `Step4Screen` placeholder; `OnboardingHeader` exported; `OnboardingStackParamList` has `Step4`
- `app/onboarding/Step3Screen.tsx` — real Step 3 screen, navigates to `Step4` on Next
- `components/ui/MultiSelect.tsx` — chip-style multi-select, `min`/`max` enforced, primary colour on selected; **do not modify**
- `components/ui/SingleSelect.tsx` — chip-style single-select, cannot deselect; **do not modify**
- `components/ui/Button.tsx` — primary and ghost variants
- `components/ui/ProgressDots.tsx` — 6 dots, accepts `step` prop
- `constants/theme.ts` — `colors`, `spacing`, `typography` re-exported
- `i18n/en.json` — add `onboarding.step4.*` keys (see i18n section below)

Task 19 builds the lifestyle step. Display strings (e.g. `'No'`, `'Occasionally'`) must be mapped to the correct enum values (`'no'`, `'occasionally'`) before saving to the store. If Codex saves raw display strings to `smoking` or `drinking` instead of the typed enum values, that is a type error and must be corrected.

---

## Task 19 — Onboarding Step 4: Lifestyle

**Files to create:**
- `app/onboarding/Step4Screen.tsx`

**Files to modify:**
- `store/onboardingStore.ts` — add missing draft fields to `OnboardingDraft` interface only if absent (no other changes)
- `app/onboarding/OnboardingNavigator.tsx` — swap inline `Step4Screen` placeholder with real screen
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add `onboarding.step4.*` keys

---

### `store/onboardingStore.ts` — Conditional update only

Check whether `OnboardingDraft` already has these four fields. If any are missing, add them with the exact types below. Do not touch actions, persistence config, or any other field.

```typescript
// Fields to add to OnboardingDraft if not already present:
dietaryPreference?: string                          // raw option string e.g. 'Halal'
fitnessGoals?: string[]                             // array of goal strings
smoking?: 'yes' | 'no' | 'occasionally'
drinking?: 'yes' | 'no' | 'socially'
```

---

### `app/onboarding/Step4Screen.tsx`

Import order must follow CONVENTIONS.md Section 5 exactly.

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
import { MultiSelect } from '@/components/ui/MultiSelect'
import { SingleSelect } from '@/components/ui/SingleSelect'
import { Button } from '@/components/ui/Button'
import { useOnboardingStore } from '@/store/onboardingStore'
import { colors, spacing, typography } from '@/constants/theme'
import type { OnboardingStackParamList } from '@/app/onboarding/OnboardingNavigator'

type Step4NavProp = StackNavigationProp<OnboardingStackParamList, 'Step4'>

const STEP = 4
const MAX_GOALS = 5

// Display → store value maps (display strings are never stored directly)
const SMOKING_MAP: Record<string, 'yes' | 'no' | 'occasionally'> = {
  No: 'no',
  Occasionally: 'occasionally',
  Yes: 'yes',
}
const SMOKING_REVERSE_MAP: Record<string, string> = {
  no: 'No',
  occasionally: 'Occasionally',
  yes: 'Yes',
}

const DRINKING_MAP: Record<string, 'yes' | 'no' | 'socially'> = {
  No: 'no',
  Socially: 'socially',
  Yes: 'yes',
}
const DRINKING_REVERSE_MAP: Record<string, string> = {
  no: 'No',
  socially: 'Socially',
  yes: 'Yes',
}

const DIET_OPTIONS = [
  'No preference',
  'Vegetarian',
  'Vegan',
  'Pescatarian',
  'Keto',
  'Halal',
  'Paleo',
  'Gluten-free',
]

const GOAL_OPTIONS = [
  'Weight loss',
  'Muscle gain',
  'Maintenance',
  'Athletic performance',
  'General health',
  'Flexibility',
  'Endurance',
]

const SMOKING_OPTIONS = ['No', 'Occasionally', 'Yes']
const DRINKING_OPTIONS = ['No', 'Socially', 'Yes']

export const Step4Screen = (): React.JSX.Element => {
  const { t } = useTranslation()
  const navigation = useNavigation<Step4NavProp>()
  const { draft, updateDraft, setCurrentStep } = useOnboardingStore()

  // Pre-fill from persisted draft — reverse-map stored enum values to display strings
  const [diet, setDiet] = useState<string | null>(
    draft.dietaryPreference ?? null
  )
  const [goals, setGoals] = useState<string[]>(draft.fitnessGoals ?? [])
  const [smoking, setSmoking] = useState<string | null>(
    draft.smoking ? SMOKING_REVERSE_MAP[draft.smoking] : null
  )
  const [drinking, setDrinking] = useState<string | null>(
    draft.drinking ? DRINKING_REVERSE_MAP[draft.drinking] : null
  )

  const isValid =
    diet !== null &&
    goals.length >= 1 &&
    smoking !== null &&
    drinking !== null

  const goalsCounterText =
    goals.length === 0
      ? t('onboarding.step4.goals.counterEmpty', { max: MAX_GOALS })
      : t('onboarding.step4.goals.counter', {
          selected: goals.length,
          max: MAX_GOALS,
        })

  const handleNext = (): void => {
    if (diet === null || smoking === null || drinking === null) return

    updateDraft({
      dietaryPreference: diet,
      fitnessGoals: goals,
      smoking: SMOKING_MAP[smoking],
      drinking: DRINKING_MAP[drinking],
    })
    setCurrentStep(5)
    navigation.navigate('Step5')
  }

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <OnboardingHeader step={STEP} />

        <View style={styles.content}>
          <Text style={styles.title}>{t('onboarding.step4.title')}</Text>

          {/* Dietary Preference */}
          <Text style={styles.sectionLabel}>
            {t('onboarding.step4.diet.label')}
          </Text>
          <SingleSelect
            options={DIET_OPTIONS}
            selected={diet}
            onChange={setDiet}
          />

          {/* Fitness Goals */}
          <Text style={styles.sectionLabel}>
            {t('onboarding.step4.goals.label')}
          </Text>
          <MultiSelect
            options={GOAL_OPTIONS}
            selected={goals}
            onChange={setGoals}
            min={1}
            max={MAX_GOALS}
          />
          <Text style={styles.counter}>{goalsCounterText}</Text>

          {/* Smoking */}
          <Text style={styles.sectionLabel}>
            {t('onboarding.step4.smoking.label')}
          </Text>
          <SingleSelect
            options={SMOKING_OPTIONS}
            selected={smoking}
            onChange={setSmoking}
          />

          {/* Drinking */}
          <Text style={styles.sectionLabel}>
            {t('onboarding.step4.drinking.label')}
          </Text>
          <SingleSelect
            options={DRINKING_OPTIONS}
            selected={drinking}
            onChange={setDrinking}
          />
        </View>
      </ScrollView>

      {/* Fixed bottom button row — outside ScrollView */}
      <View style={styles.buttonRow}>
        <View style={styles.backButton}>
          <Button
            label={t('common.back')}
            onPress={() => navigation.goBack()}
            variant="ghost"
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
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  } as ViewStyle,
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  } as ViewStyle,
  content: {
    paddingHorizontal: spacing.lg,
  } as ViewStyle,
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.gray[800],
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  } as TextStyle,
  sectionLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.gray[800],
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  } as TextStyle,
  counter: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  } as TextStyle,
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    backgroundColor: colors.background,
    gap: spacing.sm,
  } as ViewStyle,
  backButton: {
    flex: 1,
  } as ViewStyle,
  nextButton: {
    flex: 2,
  } as ViewStyle,
})
```

---

### `app/onboarding/OnboardingNavigator.tsx` — Update

```typescript
// Add import:
import { Step4Screen } from '@/app/onboarding/Step4Screen'

// Remove:
const Step4Screen = (): React.JSX.Element => <StepPlaceholder step={4} />

// The Stack.Screen registration stays the same:
<Stack.Screen name="Step4" component={Step4Screen} />
```

Do not touch Step1–Step3 real screens, Step5–Step6 placeholders, or `OnboardingHeader`.

---

### i18n — Add to all 4 files

Add the following under the existing `onboarding` key in `en.json`, `my.json`, `zh.json`, `ta.json`. Use English values as placeholders in the non-English files until native speaker translations are provided.

```json
"step4": {
  "title": "Your Lifestyle",
  "diet": {
    "label": "Dietary Preference"
  },
  "goals": {
    "label": "Fitness Goals",
    "counter": "{{selected}} / {{max}} selected",
    "counterEmpty": "Select up to {{max}}"
  },
  "smoking": {
    "label": "Smoking"
  },
  "drinking": {
    "label": "Drinking"
  }
}
```

---

## Important Architecture Notes for Codex

1. **Enum mapping is mandatory.** `smoking` and `drinking` in the store are typed as `'yes' | 'no' | 'occasionally'` and `'yes' | 'no' | 'socially'` respectively. Display strings (`'No'`, `'Occasionally'`, `'Socially'`) must never be saved directly. Always pass through `SMOKING_MAP` and `DRINKING_MAP` before calling `updateDraft()`. TypeScript strict mode will catch this if mappings are missing — do not suppress the error with a cast.

2. **Pre-fill reverse mapping.** On mount, stored enum values are converted back to display strings via `SMOKING_REVERSE_MAP` and `DRINKING_REVERSE_MAP` so that `SingleSelect`'s `selected` prop receives the correct display string. Without this, a user who navigates back to Step 4 will see all fields blank even though data was already saved.

3. **Reuse `MultiSelect` and `SingleSelect` exactly as-is.** Do not add props, rename them, or change their internal logic. They were built in Task 18 and are stable.

4. **Fixed button row sits outside `ScrollView`.** The Back/Next row must not scroll away when the user scrolls down through the fields. Achieve this by wrapping the screen in a `<View style={{ flex: 1 }}>`, placing `ScrollView` above the button row, and the button row beneath — both as siblings inside that root `View`.

5. **Goals counter must update live.** The `goalsCounterText` value is derived from `goals.length` on every render — no `useEffect` needed. It shows the empty state text when nothing is selected, and the `"X / 5 selected"` format once at least one goal is picked.

6. **`dietaryPreference` is stored as the raw display string.** Unlike `smoking` and `drinking`, dietary preference options don't have a separate enum in the schema — they are stored verbatim (e.g. `'Halal'`, `'Vegan'`). No mapping needed.

7. **Named export only.** `Step4Screen` uses a named export (`export const Step4Screen`), not a default export — consistent with CONVENTIONS.md Section 4 which permits default exports only for screen-level components used in React Navigation. Check Task 16 and Task 18 to confirm the export pattern used there and match it exactly.

---

## Acceptance Criteria

- [ ] `Step4Screen` renders all four sections: Dietary Preference, Fitness Goals, Smoking, Drinking
- [ ] Dietary Preference `SingleSelect` shows 8 options in the correct order; exactly one can be selected
- [ ] Fitness Goals `MultiSelect` shows 7 options; min 1, max 5 enforced; counter text updates live
- [ ] Smoking `SingleSelect` shows `No`, `Occasionally`, `Yes`; exactly one can be selected
- [ ] Drinking `SingleSelect` shows `No`, `Socially`, `Yes`; exactly one can be selected
- [ ] Next button disabled until all four fields have a valid selection
- [ ] Back button calls `navigation.goBack()` without clearing Step 3 data
- [ ] On Next: `smoking` stored as `'no' | 'occasionally' | 'yes'` — never as a display string
- [ ] On Next: `drinking` stored as `'no' | 'socially' | 'yes'` — never as a display string
- [ ] On Next: `dietaryPreference` stored as raw display string; `fitnessGoals` stored as `string[]`
- [ ] Pre-fill works correctly when user navigates back then forward again — all four fields restore from draft
- [ ] Back/Next button row is fixed at screen bottom and does not scroll
- [ ] `OnboardingNavigator.tsx` uses real `Step4Screen` — placeholder removed
- [ ] `OnboardingDraft` interface has all four new fields with correct types
- [ ] i18n keys added to all 4 translation files
- [ ] Zero inline styles — all styling in `StyleSheet.create` using theme tokens
- [ ] Zero hardcoded strings — all labels and text through `t()`
- [ ] `tsc --noEmit` passes with zero errors

## Do Not Touch
`components/ui/MultiSelect.tsx`, `components/ui/SingleSelect.tsx`, `components/ui/Button.tsx`, `components/ui/ProgressDots.tsx`, `store/authStore.ts`, `app/onboarding/Step1Screen.tsx`, `app/onboarding/Step2Screen.tsx`, `app/onboarding/Step3Screen.tsx`, `utils/imageUtils.ts`, `components/profile/PhotoGrid.tsx`, `types/`, `constants/`, `services/`, `App.tsx`, all navigation files except `OnboardingNavigator.tsx`

## Commit
`git commit -m "task-19: onboarding step 4 lifestyle with diet, goals, smoking, drinking"`

---

## After This Session

Update `CHANGELOG.md`:
```
## [Phase 2.4] — YYYY-MM-DD
### Completed
- Task 19: Onboarding Step 4 built (dietary preference, fitness goals, smoking, drinking)
- SingleSelect and MultiSelect reused from Task 18 without modification
- OnboardingNavigator updated to use real Step4Screen

### Files Created / Modified
- app/onboarding/Step4Screen.tsx: four lifestyle fields, enum mapping for smoking/drinking, pre-fill from draft, fixed button row
- app/onboarding/OnboardingNavigator.tsx: Step4Screen placeholder replaced with real screen
- store/onboardingStore.ts: OnboardingDraft updated with dietaryPreference, fitnessGoals, smoking, drinking fields (if not already present)
- i18n/en.json, my.json, zh.json, ta.json: step4 keys added

### Known Issues / Deferred
- Display strings for smoking/drinking options ('No', 'Occasionally', 'Socially') are UI-only — mapped to enum values on save; translations deferred until native speaker review

### Next Up
- Task 20: Onboarding Step 5 — About You (bio textarea, height slider, religion dropdown, Slider component)
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 20 prompt.

---

## Reasoning Level
Medium
