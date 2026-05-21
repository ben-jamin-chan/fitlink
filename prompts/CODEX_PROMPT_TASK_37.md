# CODEX PROMPT — Task 37
# Edit Profile Screen

@CONVENTIONS.md @ARCHITECT.md

---

## Context

Phase 1E in progress. Task 35 (profileStore) and Task 36 (ProfileScreen) are complete. Relevant existing files:

- `store/profileStore.ts` — `fetchProfile`, `updateProfile`, `uploadPhoto`, `deletePhoto` all implemented; `profile: UserProfile | null`, `isLoading: boolean`
- `app/profile/ProfileScreen.tsx` — read-only own-profile view; "Edit Profile" button navigates to `EditProfileScreen` via `ProfileStackNavigator`
- `app/navigation/MainTabNavigator.tsx` — `ProfileStackNavigator` wraps Profile tab; `EditProfileScreen` stub exists at `app/profile/EditProfileScreen.tsx`
- `components/profile/PhotoGrid.tsx` — has `readOnly` prop; when `readOnly={false}` shows empty slots, remove controls, and add button; **no drag-to-reorder (deferred to Phase 2)**
- `components/profile/ActivityChip.tsx` — pill chip for display; can be reused or adapted for selection
- `components/ui/Button.tsx` — primary/outline/ghost variants, loading + disabled states
- `components/ui/Input.tsx` — label, placeholder, error, secureTextEntry, keyboardType
- `components/ui/Slider.tsx` — min, max, value, onChange, formatLabel props
- `components/onboarding/Step3Screen.tsx` — `MultiSelect` and `SingleSelect` components built in Task 18 (reuse them)
- `utils/imageUtils.ts` — `pickAndCompressImage()` and `compressImage()` available
- `utils/errorUtils.ts` — `mapFirebaseError` available
- `i18n/en.json` — `profile.*` and `onboarding.*` keys exist; add `editProfile.*` keys as needed
- `types/user.ts` — full `UserProfile` interface with all fields

Task 37 builds the Edit Profile screen: a pre-filled React Hook Form + Zod form covering photos, basic info, fitness profile, lifestyle, about, and preferences. On save it calls `profileStore.updateProfile()` and handles photo uploads via `profileStore.uploadPhoto()` and `profileStore.deletePhoto()`. Changes reflect immediately in the ProfileScreen on return.

---

## Task 37 — Edit Profile Screen

**Files to create:**
- `app/profile/EditProfileScreen.tsx`

**Files to modify:**
- `i18n/en.json`, `i18n/my.json`, `i18n/zh.json`, `i18n/ta.json` — add `editProfile.*` keys
- `app/profile/ProfileScreen.tsx` — wire "Edit Profile" button to navigate (already navigates; confirm it passes no params)

---

### Zod Validation Schema

Define the schema **above** the component in `EditProfileScreen.tsx`. Import from `zod`.

```typescript
import { z } from 'zod'

const editProfileSchema = z.object({
  firstName: z
    .string()
    .min(2, 'editProfile.errors.firstNameMin')
    .max(50, 'editProfile.errors.firstNameMax'),
  bio: z
    .string()
    .min(50, 'editProfile.errors.bioMin')
    .max(500, 'editProfile.errors.bioMax'),
  height: z.number().min(140).max(220),
  religion: z.string().optional(),
  activities: z
    .array(z.string())
    .min(1, 'editProfile.errors.activitiesMin')
    .max(10, 'editProfile.errors.activitiesMax'),
  fitnessLevel: z.enum(['beginner', 'intermediate', 'advanced', 'athlete']),
  workoutFrequency: z.string().min(1, 'editProfile.errors.frequencyRequired'),
  dietaryPreference: z.string().min(1, 'editProfile.errors.dietRequired'),
  fitnessGoals: z
    .array(z.string())
    .min(1, 'editProfile.errors.goalsMin')
    .max(5, 'editProfile.errors.goalsMax'),
  smoking: z.enum(['yes', 'no', 'occasionally']),
  drinking: z.enum(['yes', 'no', 'socially']),
  lookingFor: z.array(z.string()).min(1, 'editProfile.errors.lookingForMin'),
  ageRangeMin: z.number().min(18).max(60),
  ageRangeMax: z.number().min(18).max(60),
  distanceKm: z.number().min(5).max(100),
  genders: z.array(z.string()).min(1, 'editProfile.errors.gendersMin'),
})

type EditProfileForm = z.infer<typeof editProfileSchema>
```

---

### Component Structure

```typescript
// EditProfileScreen.tsx

// Imports (follow CONVENTIONS.md §5 order)

// Zod schema + EditProfileForm type (above component)

// Nav type
type EditProfileNavProp = StackNavigationProp<ProfileStackParamList, 'EditProfile'>

export default function EditProfileScreen(): React.JSX.Element {
  // 1. Hooks
  const { t } = useTranslation()
  const navigation = useNavigation<EditProfileNavProp>()
  const { profile, updateProfile, uploadPhoto, deletePhoto, isLoading } = useProfileStore()

  // 2. Local UI state (permitted per CONVENTIONS.md §7 — photos are local state
  //    until save, then flushed via profileStore)
  const [photoUris, setPhotoUris] = useState<string[]>(profile?.photos ?? [])
  const [photosDirty, setPhotosDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // 3. React Hook Form
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
    reset,
  } = useForm<EditProfileForm>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: buildDefaultValues(profile),  // helper function below
  })

  // 4. Unsaved changes guard
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!isDirty && !photosDirty) return
      e.preventDefault()
      Alert.alert(
        t('editProfile.discardTitle'),
        t('editProfile.discardMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('editProfile.discard'),
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      )
    })
    return unsubscribe
  }, [navigation, isDirty, photosDirty])

  // 5. Save handler
  const onSave = async (data: EditProfileForm): Promise<void> => {
    setIsSaving(true)
    try {
      // Upload new photos (local URIs not yet in Firestore)
      if (photosDirty) {
        await syncPhotos(photoUris, profile?.photos ?? [])
      }

      await updateProfile({
        firstName: data.firstName,
        bio: data.bio,
        height: data.height,
        religion: data.religion,
        activities: data.activities,
        fitnessLevel: data.fitnessLevel,
        workoutFrequency: data.workoutFrequency,
        dietaryPreference: data.dietaryPreference,
        fitnessGoals: data.fitnessGoals,
        smoking: data.smoking,
        drinking: data.drinking,
        lookingFor: data.lookingFor as Array<'friends' | 'workout_partners' | 'dating'>,
        preferences: {
          ageRange: { min: data.ageRangeMin, max: data.ageRangeMax },
          distanceKm: data.distanceKm,
          genders: data.genders,
        },
      })

      showToast(t('editProfile.saveSuccess'), 'success')
      reset(data)        // reset isDirty
      setPhotosDirty(false)
      navigation.goBack()
    } catch (error) {
      const message = mapFirebaseError(error)
      showToast(t(message), 'error')
    } finally {
      setIsSaving(false)
    }
  }

  // render ...
}
```

**Helper functions** (define outside component, same file):

```typescript
function buildDefaultValues(profile: UserProfile | null): EditProfileForm {
  return {
    firstName: profile?.firstName ?? '',
    bio: profile?.bio ?? '',
    height: profile?.height ?? 170,
    religion: profile?.religion ?? '',
    activities: profile?.activities ?? [],
    fitnessLevel: profile?.fitnessLevel ?? 'beginner',
    workoutFrequency: profile?.workoutFrequency ?? '',
    dietaryPreference: profile?.dietaryPreference ?? '',
    fitnessGoals: profile?.fitnessGoals ?? [],
    smoking: profile?.smoking ?? 'no',
    drinking: profile?.drinking ?? 'no',
    lookingFor: profile?.lookingFor ?? [],
    ageRangeMin: profile?.preferences.ageRange.min ?? 18,
    ageRangeMax: profile?.preferences.ageRange.max ?? 45,
    distanceKm: profile?.preferences.distanceKm ?? 25,
    genders: profile?.preferences.genders ?? [],
  }
}

/**
 * Reconcile local photoUris with current Firestore photos:
 * - New local URIs (not starting with "https://") → call profileStore.uploadPhoto()
 * - Removed Firestore URLs (in old but not in new) → call profileStore.deletePhoto()
 *
 * Call ONLY when photosDirty is true.
 */
async function syncPhotos(
  newUris: string[],
  oldUrls: string[]
): Promise<void> {
  const { uploadPhoto, deletePhoto } = useProfileStore.getState()

  // Delete removed photos
  for (let i = 0; i < oldUrls.length; i++) {
    if (!newUris.includes(oldUrls[i])) {
      await deletePhoto(i)
    }
  }

  // Upload new (local) photos
  for (let i = 0; i < newUris.length; i++) {
    const uri = newUris[i]
    if (!uri.startsWith('https://')) {
      await uploadPhoto(uri, i)
    }
  }
}
```

> **Note for Codex:** `syncPhotos` calls `useProfileStore.getState()` (not the hook) because it runs outside the React render cycle. This is the established pattern from `authStore` and Task 35.

---

### Screen Layout

The screen is a `ScrollView`. The header is custom (not React Navigation default) so the Save button state reacts to `isDirty || photosDirty`.

**Header:**
```tsx
<View style={styles.header}>
  <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
    <Ionicons name="close" size={24} color={colors.gray[800]} />
  </TouchableOpacity>
  <Text style={styles.headerTitle}>{t('editProfile.title')}</Text>
  <TouchableOpacity
    onPress={handleSubmit(onSave)}
    style={styles.headerButton}
    disabled={(!isDirty && !photosDirty) || isSaving}
  >
    {isSaving ? (
      <ActivityIndicator size="small" color={colors.primary} />
    ) : (
      <Text
        style={[
          styles.headerSave,
          (!isDirty && !photosDirty) && styles.headerSaveDisabled,
        ]}
      >
        {t('common.save')}
      </Text>
    )}
  </TouchableOpacity>
</View>
```

**Section headers:** Reuse a small `SectionHeader` inline component (just a `<Text>` styled label — no need to extract to separate file).

**Sections (in order inside `ScrollView`):**

---

#### 1. Photos Section

```tsx
<SectionHeader label={t('editProfile.sections.photos')} />
<PhotoGrid
  photoUris={photoUris}
  onPhotosChange={(uris) => {
    setPhotoUris(uris)
    setPhotosDirty(true)
  }}
  maxPhotos={6}
/>
<Text style={styles.photoGuidelines}>{t('editProfile.photoGuidelines')}</Text>
```

---

#### 2. Basic Info Section

Fields: `firstName` (text input via `Input` component), Date of Birth (read-only display with info icon — DOB is not editable; show label + current DOB formatted as DD/MM/YYYY with info note "Contact support to change"), Gender (display only — same reason, not editable in Phase 1).

```tsx
<SectionHeader label={t('editProfile.sections.basicInfo')} />

{/* First Name */}
<Controller
  control={control}
  name="firstName"
  render={({ field: { onChange, value } }) => (
    <Input
      label={t('editProfile.firstName')}
      value={value}
      onChangeText={onChange}
      error={errors.firstName ? t(errors.firstName.message ?? '') : undefined}
      maxLength={50}
    />
  )}
/>

{/* Date of Birth — read-only */}
<View style={styles.readOnlyField}>
  <Text style={styles.readOnlyLabel}>{t('editProfile.dob')}</Text>
  <View style={styles.readOnlyRow}>
    <Text style={styles.readOnlyValue}>
      {profile?.dateOfBirth
        ? formatDOB(profile.dateOfBirth)
        : '—'}
    </Text>
    <Ionicons name="information-circle-outline" size={16} color={colors.gray[400]} />
  </View>
  <Text style={styles.readOnlyHint}>{t('editProfile.dobHint')}</Text>
</View>

{/* Gender — read-only */}
<View style={styles.readOnlyField}>
  <Text style={styles.readOnlyLabel}>{t('editProfile.gender')}</Text>
  <Text style={styles.readOnlyValue}>
    {profile?.gender ? t(`onboarding.step1.gender.${profile.gender}`) : '—'}
  </Text>
</View>
```

Helper:
```typescript
function formatDOB(timestamp: Timestamp): string {
  const d = timestamp.toDate()
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}
```

---

#### 3. Fitness Profile Section

Reuse `MultiSelect` (for activities and goals) and `SingleSelect` (for fitness level and frequency) from `app/onboarding/Step3Screen.tsx`. Import them — **do not duplicate the components**.

```tsx
<SectionHeader label={t('editProfile.sections.fitnessProfile')} />

{/* Activities */}
<Controller
  control={control}
  name="activities"
  render={({ field: { onChange, value } }) => (
    <>
      <Text style={styles.fieldLabel}>{t('editProfile.activities')}</Text>
      <MultiSelect
        options={ACTIVITIES}
        selected={value}
        onChange={onChange}
        min={1}
        max={10}
      />
      {errors.activities && (
        <Text style={styles.fieldError}>{t(errors.activities.message ?? '')}</Text>
      )}
    </>
  )}
/>

{/* Fitness Level */}
<Controller
  control={control}
  name="fitnessLevel"
  render={({ field: { onChange, value } }) => (
    <>
      <Text style={styles.fieldLabel}>{t('editProfile.fitnessLevel')}</Text>
      <SingleSelect
        options={FITNESS_LEVELS}
        selected={value}
        onChange={onChange}
      />
    </>
  )}
/>

{/* Workout Frequency */}
<Controller
  control={control}
  name="workoutFrequency"
  render={({ field: { onChange, value } }) => (
    <>
      <Text style={styles.fieldLabel}>{t('editProfile.frequency')}</Text>
      <SingleSelect
        options={WORKOUT_FREQUENCIES}
        selected={value}
        onChange={onChange}
      />
    </>
  )}
/>

{/* Goals */}
<Controller
  control={control}
  name="fitnessGoals"
  render={({ field: { onChange, value } }) => (
    <>
      <Text style={styles.fieldLabel}>{t('editProfile.goals')}</Text>
      <MultiSelect
        options={FITNESS_GOALS}
        selected={value}
        onChange={onChange}
        min={1}
        max={5}
      />
      {errors.fitnessGoals && (
        <Text style={styles.fieldError}>{t(errors.fitnessGoals.message ?? '')}</Text>
      )}
    </>
  )}
/>
```

---

#### 4. Lifestyle Section

```tsx
<SectionHeader label={t('editProfile.sections.lifestyle')} />

{/* Dietary Preference */}
<Controller
  control={control}
  name="dietaryPreference"
  render={({ field: { onChange, value } }) => (
    <>
      <Text style={styles.fieldLabel}>{t('editProfile.diet')}</Text>
      <SingleSelect options={DIETARY_PREFERENCES} selected={value} onChange={onChange} />
    </>
  )}
/>

{/* Smoking */}
<Controller
  control={control}
  name="smoking"
  render={({ field: { onChange, value } }) => (
    <>
      <Text style={styles.fieldLabel}>{t('editProfile.smoking')}</Text>
      <SingleSelect options={SMOKING_OPTIONS} selected={value} onChange={onChange} />
    </>
  )}
/>

{/* Drinking */}
<Controller
  control={control}
  name="drinking"
  render={({ field: { onChange, value } }) => (
    <>
      <Text style={styles.fieldLabel}>{t('editProfile.drinking')}</Text>
      <SingleSelect options={DRINKING_OPTIONS} selected={value} onChange={onChange} />
    </>
  )}
/>
```

---

#### 5. About Section

```tsx
<SectionHeader label={t('editProfile.sections.about')} />

{/* Bio */}
<Controller
  control={control}
  name="bio"
  render={({ field: { onChange, value } }) => {
    const remaining = 500 - value.length
    return (
      <>
        <Input
          label={t('editProfile.bio')}
          value={value}
          onChangeText={onChange}
          multiline
          numberOfLines={4}
          maxLength={500}
          error={errors.bio ? t(errors.bio.message ?? '') : undefined}
          placeholder={t('editProfile.bioPlaceholder')}
        />
        <Text style={[styles.charCounter, remaining < 20 && styles.charCounterRed]}>
          {remaining}
        </Text>
      </>
    )
  }}
/>

{/* Height */}
<Controller
  control={control}
  name="height"
  render={({ field: { onChange, value } }) => (
    <>
      <Text style={styles.fieldLabel}>{t('editProfile.height')}</Text>
      <Slider
        min={140}
        max={220}
        value={value}
        onChange={onChange}
        formatLabel={(v) => `${v} cm`}
      />
    </>
  )}
/>

{/* Religion */}
<Controller
  control={control}
  name="religion"
  render={({ field: { onChange, value } }) => (
    <>
      <Text style={styles.fieldLabel}>
        {t('editProfile.religion')}
        <Text style={styles.optional}> {t('editProfile.optional')}</Text>
      </Text>
      <SingleSelect
        options={RELIGION_OPTIONS}
        selected={value ?? ''}
        onChange={onChange}
      />
    </>
  )}
/>
```

---

#### 6. Preferences Section

```tsx
<SectionHeader label={t('editProfile.sections.preferences')} />

{/* Looking For */}
<Controller
  control={control}
  name="lookingFor"
  render={({ field: { onChange, value } }) => (
    <>
      <Text style={styles.fieldLabel}>{t('editProfile.lookingFor')}</Text>
      <MultiSelect
        options={LOOKING_FOR_OPTIONS}
        selected={value}
        onChange={onChange}
        min={1}
        max={3}
      />
      {errors.lookingFor && (
        <Text style={styles.fieldError}>{t(errors.lookingFor.message ?? '')}</Text>
      )}
    </>
  )}
/>

{/* Age Range — two sliders */}
<Text style={styles.fieldLabel}>{t('editProfile.ageRange')}</Text>
<View style={styles.ageRangeRow}>
  <Controller
    control={control}
    name="ageRangeMin"
    render={({ field: { onChange, value } }) => (
      <View style={styles.ageSlider}>
        <Text style={styles.ageSliderLabel}>{t('editProfile.ageMin')}</Text>
        <Slider
          min={18}
          max={watch('ageRangeMax') - 1}
          value={value}
          onChange={onChange}
          formatLabel={(v) => String(v)}
        />
      </View>
    )}
  />
  <Controller
    control={control}
    name="ageRangeMax"
    render={({ field: { onChange, value } }) => (
      <View style={styles.ageSlider}>
        <Text style={styles.ageSliderLabel}>{t('editProfile.ageMax')}</Text>
        <Slider
          min={watch('ageRangeMin') + 1}
          max={60}
          value={value}
          onChange={onChange}
          formatLabel={(v) => String(v)}
        />
      </View>
    )}
  />
</View>

{/* Distance */}
<Controller
  control={control}
  name="distanceKm"
  render={({ field: { onChange, value } }) => (
    <>
      <Text style={styles.fieldLabel}>{t('editProfile.distance')}</Text>
      <Slider
        min={5}
        max={100}
        value={value}
        onChange={onChange}
        formatLabel={(v) => `${v} km`}
      />
    </>
  )}
/>

{/* Gender Preference */}
<Controller
  control={control}
  name="genders"
  render={({ field: { onChange, value } }) => (
    <>
      <Text style={styles.fieldLabel}>{t('editProfile.genderPreference')}</Text>
      <MultiSelect
        options={GENDER_PREFERENCE_OPTIONS}
        selected={value}
        onChange={onChange}
        min={1}
        max={3}
      />
    </>
  )}
/>
```

---

### Constants (define outside component, same file)

```typescript
const ACTIVITIES = [
  'Gym', 'Running', 'Cycling', 'Swimming', 'Yoga', 'Hiking',
  'CrossFit', 'Boxing', 'Dancing', 'Badminton', 'Football',
  'Basketball', 'Tennis', 'Martial Arts', 'Rock Climbing', 'Pilates',
]

const FITNESS_LEVELS = ['beginner', 'intermediate', 'advanced', 'athlete']

const WORKOUT_FREQUENCIES = ['1-2x/week', '3-4x/week', '5-6x/week', 'Daily']

const FITNESS_GOALS = [
  'Weight loss', 'Muscle gain', 'Maintenance', 'Athletic performance',
  'General health', 'Flexibility', 'Endurance',
]

const DIETARY_PREFERENCES = [
  'No preference', 'Vegetarian', 'Vegan', 'Pescatarian',
  'Keto', 'Halal', 'Paleo', 'Gluten-free',
]

const SMOKING_OPTIONS = ['yes', 'no', 'occasionally']

const DRINKING_OPTIONS = ['yes', 'no', 'socially']

const RELIGION_OPTIONS = [
  'Islam', 'Buddhism', 'Christianity', 'Hinduism',
  'Sikhism', 'No preference', 'Prefer not to say',
]

const LOOKING_FOR_OPTIONS = ['friends', 'workout_partners', 'dating']

const GENDER_PREFERENCE_OPTIONS = ['Men', 'Women', 'Everyone']
```

---

### i18n Keys to Add

Add these to `i18n/en.json` under `editProfile`. Copy the same keys with English placeholder values to `my.json`, `zh.json`, `ta.json`:

```json
"editProfile": {
  "title": "Edit Profile",
  "discardTitle": "Discard Changes?",
  "discardMessage": "You have unsaved changes. If you go back, your changes will be lost.",
  "discard": "Discard",
  "saveSuccess": "Profile updated",
  "optional": "(optional)",
  "photoGuidelines": "Clear face photos work best. No group photos.",
  "firstName": "First Name",
  "dob": "Date of Birth",
  "dobHint": "Contact support to change your date of birth",
  "gender": "Gender",
  "bio": "About You",
  "bioPlaceholder": "Tell people about yourself...",
  "height": "Height",
  "religion": "Religion",
  "activities": "Activities (select 1–10)",
  "fitnessLevel": "Fitness Level",
  "frequency": "Workout Frequency",
  "goals": "Fitness Goals (select 1–5)",
  "diet": "Dietary Preference",
  "smoking": "Smoking",
  "drinking": "Drinking",
  "lookingFor": "Looking For",
  "ageRange": "Age Range",
  "ageMin": "Min",
  "ageMax": "Max",
  "distance": "Distance Range",
  "genderPreference": "Gender Preference",
  "charCounter": "{{remaining}} characters remaining",
  "sections": {
    "photos": "Photos",
    "basicInfo": "Basic Info",
    "fitnessProfile": "Fitness & Activities",
    "lifestyle": "Lifestyle",
    "about": "About You",
    "preferences": "Who You're Looking For"
  },
  "errors": {
    "firstNameMin": "Name must be at least 2 characters",
    "firstNameMax": "Name must be at most 50 characters",
    "bioMin": "Bio must be at least 50 characters",
    "bioMax": "Bio must be at most 500 characters",
    "activitiesMin": "Select at least 1 activity",
    "activitiesMax": "Select at most 10 activities",
    "frequencyRequired": "Please select a workout frequency",
    "dietRequired": "Please select a dietary preference",
    "goalsMin": "Select at least 1 goal",
    "goalsMax": "Select at most 5 goals",
    "lookingForMin": "Select at least 1 option",
    "gendersMin": "Select at least 1 gender preference"
  }
}
```

---

## Important Architecture Notes for Codex

1. **No direct Firebase writes in this screen.** All Firestore and Storage writes go through `profileStore.updateProfile()`, `profileStore.uploadPhoto()`, and `profileStore.deletePhoto()`. The screen only orchestrates; the store handles persistence.

2. **Photo state tracking.** `photoUris` in local state starts pre-filled from `profile.photos`. When the user adds or removes photos, `photosDirty` is set to `true`. On save, `syncPhotos()` is called — it uploads new local URIs and deletes removed URLs. After a successful save, `photosDirty` resets to `false`.

3. **`syncPhotos` accesses the store via `getState()`**, not the hook, because it runs outside the React component tree. This is the same pattern used in `authStore` for `profileStore.fetchProfile()` calls.

4. **DOB and Gender are display-only.** Do not render a form field for `dateOfBirth` or `gender` — show a read-only row with a hint. This matches PRD FR-4.2.1 ("Date of Birth — DISABLED with info icon").

5. **Age range sliders must not cross.** The min slider's `max` is `watch('ageRangeMax') - 1` and the max slider's `min` is `watch('ageRangeMin') + 1`. This uses `watch()` from React Hook Form to read the sibling field's live value.

6. **`MultiSelect` and `SingleSelect` are imported from `app/onboarding/Step3Screen.tsx`.** If they are not yet exported as named exports from that file, update `Step3Screen.tsx` to export them: `export const MultiSelect = ...` and `export const SingleSelect = ...`. Do not duplicate the component definitions.

7. **`Input` component needs a `multiline` prop.** Check `components/ui/Input.tsx` — if `multiline` and `numberOfLines` props are not already supported, add them. Multiline input should not have a fixed height; it should grow with content (up to ~120px or 4 lines) using `minHeight`.

8. **`Slider` component for height and distance.** The existing `Slider` component from Task 20 is used directly. No changes expected.

9. **Unsaved changes guard.** The `beforeRemove` listener fires when the user taps the header close button OR navigates away via the Android back gesture. Both `isDirty` (from React Hook Form) and `photosDirty` (local state) must be checked — either being true triggers the alert.

10. **No `LoadingOverlay` for individual saves.** The header Save button shows an `ActivityIndicator` in place of the "Save" text during `isSaving`. A full-screen overlay is not needed here — the save operation is fast.

---

## Acceptance Criteria

- [ ] `EditProfileScreen.tsx` created and registered in `ProfileStackNavigator`
- [ ] Form pre-fills from `profileStore.profile` on mount for all fields
- [ ] Photos section: PhotoGrid in edit mode, add/remove works, `photosDirty` tracks changes
- [ ] Basic Info: `firstName` editable, DOB and Gender are read-only rows with hint text
- [ ] Fitness Profile: Activities (MultiSelect, 1–10), Fitness Level (SingleSelect), Frequency (SingleSelect), Goals (MultiSelect, 1–5)
- [ ] Lifestyle: Diet, Smoking, Drinking all use SingleSelect
- [ ] About: Bio textarea with live character counter (red when <20 remaining), Height slider (`X cm` label), Religion optional SingleSelect
- [ ] Preferences: Looking For (MultiSelect, 1–3), Age Range (dual sliders that cannot cross), Distance slider (`X km` label), Gender Preference (MultiSelect, 1+)
- [ ] Zod validation: all required fields have inline errors in the correct language key format
- [ ] Save button disabled when form is pristine (no `isDirty`, no `photosDirty`) or while saving
- [ ] On save: `syncPhotos()` runs if `photosDirty`, then `profileStore.updateProfile()` called, success toast shown, `navigation.goBack()` called
- [ ] Unsaved changes alert fires on back/close when `isDirty || photosDirty`
- [ ] `i18n/en.json` and all 3 other locale files updated with `editProfile.*` keys
- [ ] `MultiSelect` and `SingleSelect` exported from Step3Screen (update if needed — no duplication)
- [ ] `Input` component supports `multiline` and `numberOfLines` (update if needed)
- [ ] `tsc --noEmit` passes with zero errors
- [ ] Zero inline styles, zero hardcoded strings, zero `any`

## Do Not Touch
`store/profileStore.ts`, `store/authStore.ts`, `services/firebase/`, `app/profile/ProfileScreen.tsx` (beyond confirming navigation), `components/ui/Button.tsx`, `components/ui/Slider.tsx`, `utils/imageUtils.ts`, `utils/errorUtils.ts`, `types/`, `App.tsx`, `app/navigation/RootNavigator.tsx`, `app/navigation/MainTabNavigator.tsx` (beyond confirming EditProfile stub is in `ProfileStackParamList`)

## Commit
`git commit -m "task-37: edit profile screen with form, photo sync, and unsaved changes guard"`

---

## After This Session

Update `CHANGELOG.md`:
```
## [Phase 1E — Task 37] — YYYY-MM-DD

### Completed
- Task 37: EditProfileScreen — pre-filled React Hook Form + Zod, photo management, 6 sections, unsaved changes guard, save to profileStore

### Files Created / Modified
- app/profile/EditProfileScreen.tsx: full edit screen with all 6 sections, Zod schema, syncPhotos helper, beforeRemove guard
- i18n/en.json, my.json, zh.json, ta.json: editProfile.* keys added
- app/onboarding/Step3Screen.tsx: MultiSelect and SingleSelect exported as named exports (if not already)
- components/ui/Input.tsx: multiline and numberOfLines props added (if not already)

### Architecture Decisions
- syncPhotos() uses useProfileStore.getState() (not hook) — consistent with authStore/profileStore patterns
- photosDirty local state tracks photo changes separately from RHF isDirty
- DOB and Gender are read-only display rows — not form fields
- Age range sliders use watch() to constrain each other dynamically

### Known Issues / Deferred
- Photo upload progress percentage not surfaced — binary isLoading from profileStore
- Drag-to-reorder photos deferred to Phase 2
- Location (city/state) editing not included in Task 37 — requires Google Places autocomplete, deferred to Phase 2

### Next Up
- Task 38: SettingsScreen — account, discovery preferences, notifications, privacy, subscription, danger zone
```

Then come to claude.ai with ARCHITECT.md + this CHANGELOG entry for the Task 38 prompt.

---

## Reasoning Level
High
