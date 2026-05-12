# CODEX PROMPT — Task 18
# Onboarding Step 3: Fitness Profile

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Tasks 01–17 are complete. The following now exist and must not be touched unless explicitly stated:
- `store/onboardingStore.ts` — holds `OnboardingDraft` with all 6 steps of partial profile data, persisted to AsyncStorage
- `components/ui/Button.tsx` — primary/outline/ghost variants, loading and disabled states
- `components/ui/Input.tsx` — label, error, secureTextEntry, multiline support
- `components/profile/PhotoGrid.tsx` — 3-column grid, 6 slots, Primary badge, remove button
- `utils/imageUtils.ts` — `compressImage`, `pickAndCompressImage`
- `app/onboarding/OnboardingNavigator.tsx` — stack with Step1–6, shared `OnboardingHeader`
- `app/onboarding/Step1Screen.tsx` — firstName, DOB, gender, city (complete)
- `app/onboarding/Step2Screen.tsx` — photo grid, min 2 photos, saves local URIs (complete)
- `app/onboarding/Step3Screen.tsx` — **currently a placeholder, to be replaced**
- `constants/theme.ts` — re-exports `colors`, `spacing`, `typography`
- `types/user.ts` — `FitnessLevel` type: `'beginner' | 'intermediate' | 'advanced' | 'athlete'`
- `i18n/en.json` — all translation keys; `my.json`, `zh.json`, `ta.json` are placeholder copies

Task 18 creates two new reusable UI components (`MultiSelect`, `SingleSelect`) and builds the real Step 3 screen.

---

## Task 18 — Onboarding Step 3: Fitness Profile

**Files to create:**
- `components/ui/MultiSelect.tsx`
- `components/ui/SingleSelect.tsx`
- `app/onboarding/Step3Screen.tsx`

**Files to modify:**
- `app/onboarding/OnboardingNavigator.tsx` — swap placeholder with real Step3Screen
- `i18n/en.json` — add step3 keys
- `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add same keys as English placeholders

---

### 1. `components/ui/MultiSelect.tsx` — Create new

Chip-style multi-select. Export the props interface as a named export alongside the component.

```typescript
export interface MultiSelectProps {
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  min?: number
  max?: number
}
```

Behaviour:
- Renders chips in a wrapping row (`flexWrap: 'wrap'`, `flexDirection: 'row'`)
- **Selected chip:** `colors.primary` background, white text, `colors.primary` border
- **Unselected chip:** `colors.gray[200]` background, `colors.gray[800]` text, `colors.gray[400]` border
- Tapping a **selected** chip deselects it — unless `selected.length <= min` (ignore tap silently)
- Tapping an **unselected** chip selects it — unless `selected.length >= max` (ignore tap silently)
- Chip styles: `spacing.sm` vertical padding, `spacing.md` horizontal padding, `borderRadius: 20`, `borderWidth: 1`
- Font size: `typography.sizes.sm`, font weight: `typography.weights.medium`
- Gap between chips: `spacing.sm` (use `margin` on each chip, not gap — RN 0.71 compatibility)
- **Zero inline styles** — all in `StyleSheet.create` at bottom of file
- **Named export only** — no default export

---

### 2. `components/ui/SingleSelect.tsx` — Create new

Same visual design as `MultiSelect` but enforces exactly one selection at all times.

```typescript
export interface SingleSelectProps {
  options: string[]
  selected: string | null
  onChange: (selected: string) => void
}
```

Behaviour:
- Tapping an unselected chip calls `onChange` with that value
- Tapping the already-selected chip does nothing (cannot deselect to null)
- Renders with identical chip styles as `MultiSelect`
- **Named export only** — no default export

---

### 3. `app/onboarding/Step3Screen.tsx` — Create new (replaces placeholder)

```typescript
// Layout: flex: 1 container, ScrollView for content, fixed Button at bottom
// Header: OnboardingHeader with step={3} (import from OnboardingNavigator)
// Section 1: Activities (MultiSelect)
// Section 2: Fitness Level (SingleSelect)
// Section 3: Workout Frequency (SingleSelect)
// Bottom: Next Button (disabled until all 3 sections valid)
```

**Activities MultiSelect:**
- Label: `t('onboarding.step3.activitiesLabel')`
- `min={1}`, `max={10}`
- Options in this exact order:
  ```
  'Gym', 'Running', 'Cycling', 'Swimming', 'Yoga', 'Hiking',
  'CrossFit', 'Boxing', 'Dancing', 'Badminton', 'Football',
  'Basketball', 'Tennis', 'Martial Arts', 'Rock Climbing', 'Pilates'
  ```

**Fitness Level SingleSelect:**
- Label: `t('onboarding.step3.fitnessLevelLabel')`
- Options: `'Beginner'`, `'Intermediate'`, `'Advanced'`, `'Athlete'`
- Map display value to `FitnessLevel` type on save:
  ```typescript
  const fitnessLevelMap: Record<string, FitnessLevel> = {
    'Beginner': 'beginner',
    'Intermediate': 'intermediate',
    'Advanced': 'advanced',
    'Athlete': 'athlete',
  }
  ```

**Workout Frequency SingleSelect:**
- Label: `t('onboarding.step3.frequencyLabel')`
- Options: `'1-2x/week'`, `'3-4x/week'`, `'5-6x/week'`, `'Daily'`

**Next button:**
- Disabled until: `activities.length >= 1 AND fitnessLevel !== null AND workoutFrequency !== null`
- On press: save to `onboardingStore` draft using `setDraft({...})`:
  ```typescript
  {
    activities,                          // string[]
    fitnessLevel: fitnessLevelMap[selectedFitnessLevel],   // FitnessLevel
    workoutFrequency: selectedFrequency, // string
  }
  ```
- Then: `navigation.navigate('Step4')`

**Layout structure (no inline styles):**
```
<View style={styles.container}>               // flex: 1
  <OnboardingHeader step={3} />
  <ScrollView style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}>
    <Text style={styles.sectionLabel}>...</Text>
    <MultiSelect ... />
    <Text style={styles.sectionLabel}>...</Text>
    <SingleSelect ... />
    <Text style={styles.sectionLabel}>...</Text>
    <SingleSelect ... />
    <View style={styles.bottomSpacer} />      // prevents last section hidden behind button
  </ScrollView>
  <View style={styles.buttonContainer}>
    <Button ... />
  </View>
</View>
```

- Section label style: `typography.sizes.md`, `typography.weights.semibold`, `colors.gray[800]`, `marginBottom: spacing.sm`, `marginTop: spacing.lg`
- `buttonContainer`: `paddingHorizontal: spacing.md`, `paddingBottom: spacing.xl`, `paddingTop: spacing.sm`, `backgroundColor: colors.background`
- **Default export** (React Navigation screen requirement)

---

### 4. `app/onboarding/OnboardingNavigator.tsx` — Modify

Replace the Step3 placeholder import and registration with the real `Step3Screen`:

```typescript
// Remove:
// import { Step3Placeholder } from '...'  (or however placeholder is defined)

// Add:
import Step3Screen from '@/app/onboarding/Step3Screen'

// In the navigator, replace the placeholder screen registration with:
<Stack.Screen name="Step3" component={Step3Screen} />
```

Do not touch any other screen registrations, the `OnboardingHeader` component, or navigator options.

---

### 5. `i18n/en.json` — Modify

Add under the existing `"onboarding"` key:

```json
"step3": {
  "title": "Your Fitness Profile",
  "activitiesLabel": "What activities do you do? (pick up to 10)",
  "fitnessLevelLabel": "What's your fitness level?",
  "frequencyLabel": "How often do you work out?"
}
```

---

### 6. `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — Modify

Add the identical `step3` block under `onboarding` in each file (same English values as placeholders):

```json
"step3": {
  "title": "Your Fitness Profile",
  "activitiesLabel": "What activities do you do? (pick up to 10)",
  "fitnessLevelLabel": "What's your fitness level?",
  "frequencyLabel": "How often do you work out?"
}
```

---

## Type Constraints

- `onboardingStore` draft field names must exactly match `types/user.ts`:
  - `activities: string[]`
  - `fitnessLevel: FitnessLevel` (import from `@/types/user`)
  - `workoutFrequency: string`
- Check `onboardingStore.ts` `setDraft` signature before writing — do not add new fields to the store
- `SingleSelect` internal state: `string | null` — never `any`
- `MultiSelect` internal state: `string[]` — never `any`

---

## Import Order (CONVENTIONS.md Section 5)

All files must follow this order:
1. React imports
2. React Native imports
3. Third-party libraries (alphabetical)
4. Internal — stores (`@/store/`)
5. Internal — components (`@/components/`)
6. Internal — hooks (`@/hooks/`)
7. Internal — services (`@/services/`)
8. Internal — types (`@/types/`)
9. Internal — constants (`@/constants/`)
10. Props interface (directly above component)
11. Component declaration
12. `StyleSheet.create` at bottom

---

## Acceptance Criteria

- [ ] `MultiSelect` enforces `min`/`max` — tap below min and above max are silently ignored
- [ ] `MultiSelect` visual state: selected chips are `colors.primary`, unselected are `colors.gray[200]`
- [ ] `SingleSelect` enforces single selection — tapping current selection does nothing
- [ ] All 16 activities render without clipping or overflow
- [ ] Next button is disabled until all 3 sections have a valid selection
- [ ] On Next: `activities`, `fitnessLevel` (as `FitnessLevel` type), `workoutFrequency` saved to `onboardingStore`
- [ ] On Next: navigates to Step 4
- [ ] `OnboardingNavigator` uses real `Step3Screen`, not placeholder
- [ ] `i18n` keys added to all 4 language files
- [ ] `tsc --noEmit` passes with zero errors
- [ ] Zero `any` usage
- [ ] Zero inline styles
- [ ] All strings through `useTranslation()` — no hardcoded text

## Do Not Touch
- `store/onboardingStore.ts` — do not add or rename fields
- `types/user.ts` — do not modify
- `components/ui/Button.tsx`, `components/ui/Input.tsx`
- `components/profile/PhotoGrid.tsx`, `utils/imageUtils.ts`
- `app/onboarding/Step1Screen.tsx`, `app/onboarding/Step2Screen.tsx`
- Steps 4, 5, 6 placeholder screens
- `app/navigation/RootNavigator.tsx`, `app/navigation/MainTabNavigator.tsx`
- `services/`, `store/authStore.ts`, `store/profileStore.ts`

## Commit
```
git commit -m "task-18: fitness profile step with MultiSelect and SingleSelect components"
```

---

## After This Session

Update CHANGELOG.md:

```
## [Phase 2.3] — YYYY-MM-DD
### Completed
- Task 18: Onboarding Step 3 built (activities MultiSelect, fitness level, workout frequency)
- MultiSelect component created in components/ui/
- SingleSelect component created in components/ui/
- OnboardingNavigator updated to use real Step3Screen

### Files Created / Modified
- components/ui/MultiSelect.tsx: chip multi-select, min/max enforcement, primary colour selected state
- components/ui/SingleSelect.tsx: chip single-select, cannot deselect, same chip styles as MultiSelect
- app/onboarding/Step3Screen.tsx: activities (16 options, max 10), fitness level, frequency; Next disabled until all valid
- app/onboarding/OnboardingNavigator.tsx: Step3Screen placeholder replaced with real screen
- i18n/en.json, my.json, zh.json, ta.json: step3 keys added

### Known Issues / Deferred
- Display strings for fitness level ('Beginner' etc.) are mapped to FitnessLevel enum values on save — display translations deferred until native speaker review

### Next Up
- Task 19: Onboarding Step 4 — Lifestyle (diet, fitness goals, smoking, drinking)
```

Then return to this Claude Project with the updated CHANGELOG entry for the Task 19 prompt.

---

## Reasoning Level
Medium — component logic is explicit, but the `FitnessLevel` enum mapping and `onboardingStore` field name alignment require careful attention before writing.
