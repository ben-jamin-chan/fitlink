# CODEX PROMPT — Task 15
# Onboarding Shell — OnboardingNavigator, ProgressDots, onboardingStore

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 1.9 complete. Authentication phase is fully done (Tasks 08–14). The following are relevant to this task:
- `store/authStore.ts` — has `hasCompletedOnboarding: boolean` and `setHasCompletedOnboarding()`
- `app/navigation/RootNavigator.tsx` — currently shows an inline `OnboardingPlaceholder` component when `isAuthenticated: true` + `hasCompletedOnboarding: false`. Also has `RootStackParamList` with `Onboarding: undefined`.
- `types/user.ts` — `UserProfile` interface defines all fields that onboarding collects
- `i18n/en.json` — strings under `onboarding.*` namespace already seeded

Task 15 builds the onboarding shell: the Zustand store that holds draft profile data across all 6 steps, the progress indicator component, and the navigator that sequences the 6 step screens. Step screens themselves (Steps 1–6) are placeholders here — they get built in Tasks 16–21.

---

## Task 15 — Onboarding Shell

**Files to create:**
- `store/onboardingStore.ts`
- `components/ui/ProgressDots.tsx`
- `app/onboarding/OnboardingNavigator.tsx`

**Files to modify:**
- `app/navigation/RootNavigator.tsx` — replace `OnboardingPlaceholder` with `OnboardingNavigator`

---

### `store/onboardingStore.ts`

Holds all partial profile data collected across all 6 steps. Persisted to AsyncStorage so the user can exit mid-onboarding and resume where they left off.

```typescript
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type {
  Gender,
  FitnessLevel,
  LookingFor,
  SmokingStatus,
  DrinkingStatus,
} from '@/types/user'

// ─── Draft profile — all fields optional as they are filled step by step ──────

export interface OnboardingDraft {
  // Step 1 — Basic Info
  firstName?: string
  dateOfBirth?: string           // ISO string — converted to Timestamp on submit
  gender?: Gender
  city?: string
  country?: string

  // Step 2 — Photos (local URIs only — uploaded on Step 6 submit)
  photoUris?: string[]

  // Step 3 — Fitness Profile
  activities?: string[]
  fitnessLevel?: FitnessLevel
  workoutFrequency?: string

  // Step 4 — Lifestyle
  dietaryPreference?: string
  fitnessGoals?: string[]
  smoking?: SmokingStatus
  drinking?: DrinkingStatus

  // Step 5 — About You
  bio?: string
  height?: number
  religion?: string

  // Step 6 — Preferences
  lookingFor?: LookingFor[]
  preferredAgeMin?: number
  preferredAgeMax?: number
  preferredDistanceKm?: number
  preferredGenders?: string[]
}

// ─── Store shape ──────────────────────────────────────────────────────────────

interface OnboardingState {
  draft: OnboardingDraft
  currentStep: number              // 1–6, used to restore step on resume

  // Actions
  updateDraft: (partial: Partial<OnboardingDraft>) => void
  setCurrentStep: (step: number) => void
  clearDraft: () => void           // called after successful profile creation in Step 6
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      draft: {},
      currentStep: 1,

      updateDraft: (partial) =>
        set((state) => ({
          draft: { ...state.draft, ...partial },
        })),

      setCurrentStep: (step) => set({ currentStep: step }),

      clearDraft: () => set({ draft: {}, currentStep: 1 }),
    }),
    {
      name: 'onboarding-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist everything — user must be able to resume after app close
      partialize: (state) => ({
        draft: state.draft,
        currentStep: state.currentStep,
      }),
    }
  )
)
```

---

### `components/ui/ProgressDots.tsx`

6 dots indicating progress through the onboarding steps. Active dot uses `colors.primary`, inactive uses `colors.gray[200]`.

```typescript
import React from 'react'
import { View, StyleSheet, ViewStyle } from 'react-native'
import { colors, spacing, borderRadius } from '@/constants/theme'

interface ProgressDotsProps {
  totalSteps: number
  currentStep: number        // 1-indexed
}

export const ProgressDots = ({
  totalSteps,
  currentStep,
}: ProgressDotsProps): React.JSX.Element => (
  <View style={styles.container}>
    {Array(totalSteps)
      .fill(null)
      .map((_, index) => (
        <View
          key={index}
          style={[
            styles.dot,
            index + 1 === currentStep ? styles.dotActive : styles.dotInactive,
            index + 1 < currentStep && styles.dotCompleted,
          ]}
        />
      ))}
  </View>
)

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  } as ViewStyle,
  dot: {
    width: 8,
    height: 8,
    borderRadius: borderRadius.full,
  } as ViewStyle,
  dotActive: {
    backgroundColor: colors.primary,
    width: 24,              // active dot is wider (pill shape)
  } as ViewStyle,
  dotInactive: {
    backgroundColor: colors.gray[200],
  } as ViewStyle,
  dotCompleted: {
    backgroundColor: colors.primary,
    opacity: 0.4,
  } as ViewStyle,
})
```

---

### `app/onboarding/OnboardingNavigator.tsx`

Stack navigator for Steps 1–6. Each step is a placeholder screen for now — replaced in Tasks 16–21. The navigator also renders `ProgressDots` in a shared header area above the step content.

```typescript
import React from 'react'
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native'
import { createStackNavigator } from '@react-navigation/stack'
import { useTranslation } from 'react-i18next'
import { ProgressDots } from '@/components/ui/ProgressDots'
import { colors, spacing, typography } from '@/constants/theme'

export type OnboardingStackParamList = {
  Step1: undefined
  Step2: undefined
  Step3: undefined
  Step4: undefined
  Step5: undefined
  Step6: undefined
}

const Stack = createStackNavigator<OnboardingStackParamList>()

const TOTAL_STEPS = 6

// ─── Shared onboarding header ─────────────────────────────────────────────────

interface OnboardingHeaderProps {
  step: number
}

export const OnboardingHeader = ({ step }: OnboardingHeaderProps): React.JSX.Element => {
  const { t } = useTranslation()
  return (
    <View style={styles.header}>
      <Text style={styles.stepLabel}>
        {t('onboarding.step', { current: step, total: TOTAL_STEPS })}
      </Text>
      <ProgressDots totalSteps={TOTAL_STEPS} currentStep={step} />
    </View>
  )
}

// ─── Placeholder screens — replaced in Tasks 16–21 ───────────────────────────

const StepPlaceholder = ({ step }: { step: number }): React.JSX.Element => (
  <View style={styles.placeholder}>
    <OnboardingHeader step={step} />
    <View style={styles.placeholderContent}>
      <Text style={styles.placeholderText}>Step {step}</Text>
    </View>
  </View>
)

const Step1Screen = (): React.JSX.Element => <StepPlaceholder step={1} />
const Step2Screen = (): React.JSX.Element => <StepPlaceholder step={2} />
const Step3Screen = (): React.JSX.Element => <StepPlaceholder step={3} />
const Step4Screen = (): React.JSX.Element => <StepPlaceholder step={4} />
const Step5Screen = (): React.JSX.Element => <StepPlaceholder step={5} />
const Step6Screen = (): React.JSX.Element => <StepPlaceholder step={6} />

// ─── Navigator ────────────────────────────────────────────────────────────────

export const OnboardingNavigator = (): React.JSX.Element => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      cardStyle: { backgroundColor: colors.background },
      animationEnabled: true,
    }}
  >
    <Stack.Screen name="Step1" component={Step1Screen} />
    <Stack.Screen name="Step2" component={Step2Screen} />
    <Stack.Screen name="Step3" component={Step3Screen} />
    <Stack.Screen name="Step4" component={Step4Screen} />
    <Stack.Screen name="Step5" component={Step5Screen} />
    <Stack.Screen name="Step6" component={Step6Screen} />
  </Stack.Navigator>
)

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
    gap: spacing.md,
  } as ViewStyle,
  stepLabel: {
    fontSize: typography.sizes.sm,
    color: colors.gray[500],
    textAlign: 'center',
  } as TextStyle,
  placeholder: {
    flex: 1,
    backgroundColor: colors.background,
  } as ViewStyle,
  placeholderContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  } as ViewStyle,
  placeholderText: {
    fontSize: typography.sizes.lg,
    color: colors.gray[400],
  } as TextStyle,
})
```

---

### `app/navigation/RootNavigator.tsx` — Update

Replace the inline `OnboardingPlaceholder` component with the real `OnboardingNavigator`. Also update the import and the `RootStackParamList` if needed.

```typescript
// Add import:
import { OnboardingNavigator } from '@/app/onboarding/OnboardingNavigator'

// Replace the Stack.Screen for Onboarding:
// Before:
<Stack.Screen name="Onboarding" component={OnboardingPlaceholder} />

// After:
<Stack.Screen name="Onboarding" component={OnboardingNavigator} />
```

Remove the `OnboardingPlaceholder` component definition from `RootNavigator.tsx` entirely. Do not change `RootStackParamList`, the auth gating logic, or the loading spinner.

---

## How Onboarding Routing Works After This Task

```
User signs up (phone OTP or email)
  → authStore: isAuthenticated = true, hasCompletedOnboarding = false
  → RootNavigator renders OnboardingNavigator
  → OnboardingNavigator shows Step1 placeholder

User navigates Step1 → Step2 → ... → Step6
  → each step calls onboardingStore.updateDraft() and navigation.navigate('StepN+1')
  → Step6 on submit: creates Firestore profile, calls authStore.setHasCompletedOnboarding(true)
  → RootNavigator sees hasCompletedOnboarding = true → switches to MainTabNavigator
```

Note: The `setHasCompletedOnboarding(true)` call happens in `Step6Screen` (Task 21), not here.

---

## Acceptance Criteria

- [ ] `onboardingStore.ts` created — `draft`, `currentStep`, `updateDraft`, `setCurrentStep`, `clearDraft`
- [ ] Store persists `draft` and `currentStep` to AsyncStorage — user can exit and resume
- [ ] `ProgressDots` renders 6 dots — active dot is wide pill in `colors.primary`, completed dots faded, inactive dots gray
- [ ] `OnboardingNavigator` is a stack with 6 screens (Step1–Step6)
- [ ] Each step shows `OnboardingHeader` with step label and `ProgressDots` at current step
- [ ] `RootNavigator` uses real `OnboardingNavigator` — `OnboardingPlaceholder` removed
- [ ] After signing up with a test account, the app shows Step 1 placeholder (not "Landing")
- [ ] Zero inline styles, all text through `t()`
- [ ] `tsc --noEmit` passes with zero errors

## Do Not Touch
All auth screens, `components/ui/Button.tsx`, `components/ui/Input.tsx`, `store/authStore.ts`, `services/`, `types/`, `constants/`, `i18n/`, `App.tsx`, `AuthNavigator.tsx`, `MainTabNavigator.tsx`

## Commit
`git commit -m "task-15: onboarding shell with navigator, progress dots, and store"`

---

## After This Session

Update `CHANGELOG.md`:
```
## [Phase 2.0] — YYYY-MM-DD
### Completed
- Task 15: Onboarding shell built — OnboardingNavigator, ProgressDots, onboardingStore
- RootNavigator updated to use real OnboardingNavigator
- New users now land on Step 1 placeholder after authentication

### Files Created / Modified
- store/onboardingStore.ts: OnboardingDraft interface, draft + currentStep state, persisted
- components/ui/ProgressDots.tsx: 6 dots, active/completed/inactive states
- app/onboarding/OnboardingNavigator.tsx: stack with Step1–6 placeholders, shared OnboardingHeader
- app/navigation/RootNavigator.tsx: OnboardingPlaceholder replaced with OnboardingNavigator

### Next Up
- Task 16: Onboarding Step 1 — Basic Info (firstName, dateOfBirth, gender, city)
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 16 prompt.

---

## Reasoning Level
Medium-Low — navigator and store patterns are established, structure is prescribed. ProgressDots is purely visual.
