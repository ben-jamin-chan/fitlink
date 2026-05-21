import React, { useEffect, useRef, useState } from 'react'

import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  ToastAndroid,
  TouchableOpacity,
  View,
} from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import type { Timestamp } from 'firebase/firestore'
import type { TFunction } from 'i18next'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'
import { z } from 'zod'

import { useProfileStore } from '@/store/profileStore'

import { PhotoGrid } from '@/components/profile/PhotoGrid'
import { Input } from '@/components/ui/Input'
import { Slider } from '@/components/ui/Slider'

import type { ProfileStackParamList } from '@/app/navigation/MainTabNavigator'
import { MultiSelect, SingleSelect } from '@/app/onboarding/Step3Screen'
import { mapFirebaseError } from '@/utils/errorUtils'
import type {
  DrinkingStatus,
  FitnessLevel,
  Gender,
  LookingFor,
  SmokingStatus,
  UserProfile,
} from '@/types/user'

import {
  borderRadius,
  colors,
  MAX_BIO_LENGTH,
  MAX_PHOTOS,
  spacing,
  typography,
} from '@/constants/theme'

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

type EditProfileNavProp = StackNavigationProp<
  ProfileStackParamList,
  'EditProfile'
>

interface SelectOption<TValue extends string> {
  value: TValue
  labelKey: string
}

interface SectionHeaderProps {
  label: string
}

const MIN_HEIGHT = 140
const MAX_HEIGHT = 220
const DEFAULT_HEIGHT = 170
const MIN_AGE = 18
const MAX_AGE = 60
const DEFAULT_MAX_AGE = 45
const MIN_DISTANCE_KM = 5
const MAX_DISTANCE_KM = 100
const DEFAULT_DISTANCE_KM = 25
const COUNTER_DANGER_THRESHOLD = 20

const ACTIVITY_OPTIONS: Array<SelectOption<string>> = [
  { value: 'Gym', labelKey: 'onboarding.step3.activityOptions.gym' },
  { value: 'Running', labelKey: 'onboarding.step3.activityOptions.running' },
  { value: 'Cycling', labelKey: 'onboarding.step3.activityOptions.cycling' },
  { value: 'Swimming', labelKey: 'onboarding.step3.activityOptions.swimming' },
  { value: 'Yoga', labelKey: 'onboarding.step3.activityOptions.yoga' },
  { value: 'Hiking', labelKey: 'onboarding.step3.activityOptions.hiking' },
  { value: 'CrossFit', labelKey: 'onboarding.step3.activityOptions.crossFit' },
  { value: 'Boxing', labelKey: 'onboarding.step3.activityOptions.boxing' },
  { value: 'Dancing', labelKey: 'onboarding.step3.activityOptions.dancing' },
  { value: 'Badminton', labelKey: 'onboarding.step3.activityOptions.badminton' },
  { value: 'Football', labelKey: 'onboarding.step3.activityOptions.football' },
  { value: 'Basketball', labelKey: 'onboarding.step3.activityOptions.basketball' },
  { value: 'Tennis', labelKey: 'onboarding.step3.activityOptions.tennis' },
  {
    value: 'Martial Arts',
    labelKey: 'onboarding.step3.activityOptions.martialArts',
  },
  {
    value: 'Rock Climbing',
    labelKey: 'onboarding.step3.activityOptions.rockClimbing',
  },
  { value: 'Pilates', labelKey: 'onboarding.step3.activityOptions.pilates' },
]

const FITNESS_LEVEL_OPTIONS: Array<SelectOption<FitnessLevel>> = [
  {
    value: 'beginner',
    labelKey: 'onboarding.step3.fitnessLevelOptions.beginner',
  },
  {
    value: 'intermediate',
    labelKey: 'onboarding.step3.fitnessLevelOptions.intermediate',
  },
  {
    value: 'advanced',
    labelKey: 'onboarding.step3.fitnessLevelOptions.advanced',
  },
  {
    value: 'athlete',
    labelKey: 'onboarding.step3.fitnessLevelOptions.athlete',
  },
]

const WORKOUT_FREQUENCY_OPTIONS: Array<SelectOption<string>> = [
  { value: '1-2x/week', labelKey: 'onboarding.step3.frequencyOptions.oneToTwo' },
  {
    value: '3-4x/week',
    labelKey: 'onboarding.step3.frequencyOptions.threeToFour',
  },
  { value: '5-6x/week', labelKey: 'onboarding.step3.frequencyOptions.fiveToSix' },
  { value: 'Daily', labelKey: 'onboarding.step3.frequencyOptions.daily' },
]

const FITNESS_GOAL_OPTIONS: Array<SelectOption<string>> = [
  { value: 'Weight loss', labelKey: 'onboarding.step4.goals.options.weightLoss' },
  { value: 'Muscle gain', labelKey: 'onboarding.step4.goals.options.muscleGain' },
  { value: 'Maintenance', labelKey: 'onboarding.step4.goals.options.maintenance' },
  {
    value: 'Athletic performance',
    labelKey: 'onboarding.step4.goals.options.athleticPerformance',
  },
  {
    value: 'General health',
    labelKey: 'onboarding.step4.goals.options.generalHealth',
  },
  { value: 'Flexibility', labelKey: 'onboarding.step4.goals.options.flexibility' },
  { value: 'Endurance', labelKey: 'onboarding.step4.goals.options.endurance' },
]

const DIETARY_PREFERENCE_OPTIONS: Array<SelectOption<string>> = [
  {
    value: 'No preference',
    labelKey: 'onboarding.step4.diet.options.noPreference',
  },
  { value: 'Vegetarian', labelKey: 'onboarding.step4.diet.options.vegetarian' },
  { value: 'Vegan', labelKey: 'onboarding.step4.diet.options.vegan' },
  { value: 'Pescatarian', labelKey: 'onboarding.step4.diet.options.pescatarian' },
  { value: 'Keto', labelKey: 'onboarding.step4.diet.options.keto' },
  { value: 'Halal', labelKey: 'onboarding.step4.diet.options.halal' },
  { value: 'Paleo', labelKey: 'onboarding.step4.diet.options.paleo' },
  { value: 'Gluten-free', labelKey: 'onboarding.step4.diet.options.glutenFree' },
]

const SMOKING_OPTIONS: Array<SelectOption<SmokingStatus>> = [
  { value: 'yes', labelKey: 'onboarding.step4.smoking.options.yes' },
  { value: 'no', labelKey: 'onboarding.step4.smoking.options.no' },
  {
    value: 'occasionally',
    labelKey: 'onboarding.step4.smoking.options.occasionally',
  },
]

const DRINKING_OPTIONS: Array<SelectOption<DrinkingStatus>> = [
  { value: 'yes', labelKey: 'onboarding.step4.drinking.options.yes' },
  { value: 'no', labelKey: 'onboarding.step4.drinking.options.no' },
  { value: 'socially', labelKey: 'onboarding.step4.drinking.options.socially' },
]

const RELIGION_OPTIONS: Array<SelectOption<string>> = [
  { value: 'Islam', labelKey: 'onboarding.step5.religion.options.islam' },
  { value: 'Buddhism', labelKey: 'onboarding.step5.religion.options.buddhism' },
  {
    value: 'Christianity',
    labelKey: 'onboarding.step5.religion.options.christianity',
  },
  { value: 'Hinduism', labelKey: 'onboarding.step5.religion.options.hinduism' },
  { value: 'Sikhism', labelKey: 'onboarding.step5.religion.options.sikhism' },
  {
    value: 'No preference',
    labelKey: 'onboarding.step5.religion.options.noPreference',
  },
  {
    value: 'Prefer not to say',
    labelKey: 'onboarding.step5.religion.options.preferNotToSay',
  },
]

const LOOKING_FOR_OPTIONS: Array<SelectOption<LookingFor>> = [
  { value: 'friends', labelKey: 'onboarding.step6.lookingForOptions.friends' },
  {
    value: 'workout_partners',
    labelKey: 'onboarding.step6.lookingForOptions.workoutPartners',
  },
  { value: 'dating', labelKey: 'onboarding.step6.lookingForOptions.dating' },
]

const GENDER_PREFERENCE_OPTIONS: Array<SelectOption<string>> = [
  { value: 'male', labelKey: 'onboarding.step6.genderPreferenceOptions.men' },
  { value: 'female', labelKey: 'onboarding.step6.genderPreferenceOptions.women' },
  {
    value: 'everyone',
    labelKey: 'onboarding.step6.genderPreferenceOptions.everyone',
  },
]

const GENDER_LABEL_KEYS: Record<Gender, string> = {
  male: 'onboarding.step1.male',
  female: 'onboarding.step1.female',
  'non-binary': 'onboarding.step1.nonBinary',
}

const SectionHeader = ({ label }: SectionHeaderProps): React.JSX.Element => (
  <Text style={styles.sectionHeader}>{label}</Text>
)

export default function EditProfileScreen(): React.JSX.Element {
  const { t } = useTranslation()
  const navigation = useNavigation<EditProfileNavProp>()
  const { profile, updateProfile, isLoading } = useProfileStore()
  const allowNavigationRef = useRef(false)
  const [photoUris, setPhotoUris] = useState<string[]>(profile?.photos ?? [])
  const [photosDirty, setPhotosDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
    reset,
  } = useForm<EditProfileForm>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: buildDefaultValues(profile),
  })

  const hasChanges = isDirty || photosDirty
  const isBusy = isSaving || isLoading
  const isSaveDisabled = !hasChanges || isBusy
  const ageRangeMin = watch('ageRangeMin')
  const ageRangeMax = watch('ageRangeMax')

  useEffect((): void => {
    if (profile === null || isDirty || photosDirty) {
      return
    }

    reset(buildDefaultValues(profile))
    setPhotoUris(profile.photos)
  }, [profile, reset, isDirty, photosDirty])

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (allowNavigationRef.current || !hasChanges) {
        return
      }

      event.preventDefault()
      Alert.alert(t('editProfile.discardTitle'), t('editProfile.discardMessage'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('editProfile.discard'),
          style: 'destructive',
          onPress: (): void => {
            allowNavigationRef.current = true
            navigation.dispatch(event.data.action)
          },
        },
      ])
    })

    return unsubscribe
  }, [navigation, hasChanges, t])

  const handlePhotosChange = (uris: string[]): void => {
    setPhotoUris(uris)
    setPhotosDirty(true)
  }

  const handleClose = (): void => {
    navigation.goBack()
  }

  const onSave = async (data: EditProfileForm): Promise<void> => {
    setIsSaving(true)

    try {
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
        lookingFor: getValidLookingFor(data.lookingFor),
        preferences: {
          ageRange: { min: data.ageRangeMin, max: data.ageRangeMax },
          distanceKm: data.distanceKm,
          genders: data.genders,
        },
      })

      const profileError = useProfileStore.getState().error
      if (profileError !== null) {
        showToast(t(profileError))
        return
      }

      showToast(t('editProfile.saveSuccess'))
      reset(data)
      setPhotosDirty(false)
      allowNavigationRef.current = true
      navigation.goBack()
    } catch (error: unknown) {
      const message = mapProfileError(error)
      showToast(t(message))
    } finally {
      setIsSaving(false)
    }
  }

  if (profile === null) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleClose}
          style={styles.headerButton}
          activeOpacity={0.7}
          accessibilityLabel={t('common.close')}
        >
          <Ionicons name="close" size={24} color={colors.gray[800]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('editProfile.title')}</Text>
        <TouchableOpacity
          onPress={handleSubmit(onSave)}
          style={styles.headerButton}
          disabled={isSaveDisabled}
          activeOpacity={0.7}
          accessibilityLabel={t('common.save')}
        >
          {isBusy ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text
              style={[
                styles.headerSave,
                isSaveDisabled && styles.headerSaveDisabled,
              ]}
            >
              {t('common.save')}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader label={t('editProfile.sections.photos')} />
        <PhotoGrid
          photoUris={photoUris}
          onPhotosChange={handlePhotosChange}
          maxPhotos={MAX_PHOTOS}
          readOnly={false}
        />
        <Text style={styles.photoGuidelines}>
          {t('editProfile.photoGuidelines')}
        </Text>

        <SectionHeader label={t('editProfile.sections.basicInfo')} />
        <Controller
          control={control}
          name="firstName"
          render={({ field: { onChange, value } }): React.JSX.Element => (
            <Input
              label={t('editProfile.firstName')}
              value={value}
              onChangeText={onChange}
              error={translateError(errors.firstName?.message, t)}
              maxLength={50}
              autoCapitalize="words"
            />
          )}
        />

        <View style={styles.readOnlyField}>
          <Text style={styles.readOnlyLabel}>{t('editProfile.dob')}</Text>
          <View style={styles.readOnlyRow}>
            <Text style={styles.readOnlyValue}>
              {profile.dateOfBirth !== undefined
                ? formatDOB(profile.dateOfBirth)
                : t('profile.unavailable')}
            </Text>
            <Ionicons
              name="information-circle-outline"
              size={16}
              color={colors.gray[400]}
            />
          </View>
          <Text style={styles.readOnlyHint}>{t('editProfile.dobHint')}</Text>
        </View>

        <View style={styles.readOnlyField}>
          <Text style={styles.readOnlyLabel}>{t('editProfile.gender')}</Text>
          <Text style={styles.readOnlyValue}>
            {t(GENDER_LABEL_KEYS[profile.gender])}
          </Text>
        </View>

        <SectionHeader label={t('editProfile.sections.fitnessProfile')} />
        <Controller
          control={control}
          name="activities"
          render={({ field: { onChange, value } }): React.JSX.Element => (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{t('editProfile.activities')}</Text>
              <MultiSelect
                options={getOptionLabels(ACTIVITY_OPTIONS, t)}
                selected={valuesToLabels(value, ACTIVITY_OPTIONS, t)}
                onChange={(labels: string[]): void => {
                  onChange(labelsToValues(labels, ACTIVITY_OPTIONS, t))
                }}
                min={1}
                max={10}
              />
              {errors.activities !== undefined && (
                <Text style={styles.fieldError}>
                  {translateError(errors.activities.message, t)}
                </Text>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="fitnessLevel"
          render={({ field: { onChange, value } }): React.JSX.Element => (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>
                {t('editProfile.fitnessLevel')}
              </Text>
              <SingleSelect
                options={getOptionLabels(FITNESS_LEVEL_OPTIONS, t)}
                selected={valueToLabel(value, FITNESS_LEVEL_OPTIONS, t)}
                onChange={(label: string): void => {
                  const nextValue = labelToValue(label, FITNESS_LEVEL_OPTIONS, t)
                  if (nextValue !== null) {
                    onChange(nextValue)
                  }
                }}
              />
            </View>
          )}
        />

        <Controller
          control={control}
          name="workoutFrequency"
          render={({ field: { onChange, value } }): React.JSX.Element => (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{t('editProfile.frequency')}</Text>
              <SingleSelect
                options={getOptionLabels(WORKOUT_FREQUENCY_OPTIONS, t)}
                selected={valueToLabel(value, WORKOUT_FREQUENCY_OPTIONS, t)}
                onChange={(label: string): void => {
                  const nextValue = labelToValue(label, WORKOUT_FREQUENCY_OPTIONS, t)
                  if (nextValue !== null) {
                    onChange(nextValue)
                  }
                }}
              />
              {errors.workoutFrequency !== undefined && (
                <Text style={styles.fieldError}>
                  {translateError(errors.workoutFrequency.message, t)}
                </Text>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="fitnessGoals"
          render={({ field: { onChange, value } }): React.JSX.Element => (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{t('editProfile.goals')}</Text>
              <MultiSelect
                options={getOptionLabels(FITNESS_GOAL_OPTIONS, t)}
                selected={valuesToLabels(value, FITNESS_GOAL_OPTIONS, t)}
                onChange={(labels: string[]): void => {
                  onChange(labelsToValues(labels, FITNESS_GOAL_OPTIONS, t))
                }}
                min={1}
                max={5}
              />
              {errors.fitnessGoals !== undefined && (
                <Text style={styles.fieldError}>
                  {translateError(errors.fitnessGoals.message, t)}
                </Text>
              )}
            </View>
          )}
        />

        <SectionHeader label={t('editProfile.sections.lifestyle')} />
        <Controller
          control={control}
          name="dietaryPreference"
          render={({ field: { onChange, value } }): React.JSX.Element => (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{t('editProfile.diet')}</Text>
              <SingleSelect
                options={getOptionLabels(DIETARY_PREFERENCE_OPTIONS, t)}
                selected={valueToLabel(value, DIETARY_PREFERENCE_OPTIONS, t)}
                onChange={(label: string): void => {
                  const nextValue = labelToValue(label, DIETARY_PREFERENCE_OPTIONS, t)
                  if (nextValue !== null) {
                    onChange(nextValue)
                  }
                }}
              />
              {errors.dietaryPreference !== undefined && (
                <Text style={styles.fieldError}>
                  {translateError(errors.dietaryPreference.message, t)}
                </Text>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="smoking"
          render={({ field: { onChange, value } }): React.JSX.Element => (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{t('editProfile.smoking')}</Text>
              <SingleSelect
                options={getOptionLabels(SMOKING_OPTIONS, t)}
                selected={valueToLabel(value, SMOKING_OPTIONS, t)}
                onChange={(label: string): void => {
                  const nextValue = labelToValue(label, SMOKING_OPTIONS, t)
                  if (nextValue !== null) {
                    onChange(nextValue)
                  }
                }}
              />
            </View>
          )}
        />

        <Controller
          control={control}
          name="drinking"
          render={({ field: { onChange, value } }): React.JSX.Element => (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{t('editProfile.drinking')}</Text>
              <SingleSelect
                options={getOptionLabels(DRINKING_OPTIONS, t)}
                selected={valueToLabel(value, DRINKING_OPTIONS, t)}
                onChange={(label: string): void => {
                  const nextValue = labelToValue(label, DRINKING_OPTIONS, t)
                  if (nextValue !== null) {
                    onChange(nextValue)
                  }
                }}
              />
            </View>
          )}
        />

        <SectionHeader label={t('editProfile.sections.about')} />
        <Controller
          control={control}
          name="bio"
          render={({ field: { onChange, value } }): React.JSX.Element => {
            const remaining = MAX_BIO_LENGTH - value.length

            return (
              <View style={styles.fieldBlock}>
                <Input
                  label={t('editProfile.bio')}
                  value={value}
                  onChangeText={onChange}
                  multiline
                  numberOfLines={4}
                  maxLength={MAX_BIO_LENGTH}
                  error={translateError(errors.bio?.message, t)}
                  placeholder={t('editProfile.bioPlaceholder')}
                  autoCapitalize="sentences"
                />
                <Text
                  style={[
                    styles.charCounter,
                    remaining < COUNTER_DANGER_THRESHOLD &&
                      styles.charCounterRed,
                  ]}
                >
                  {t('editProfile.charCounter', { remaining })}
                </Text>
              </View>
            )
          }}
        />

        <Controller
          control={control}
          name="height"
          render={({ field: { onChange, value } }): React.JSX.Element => (
            <View style={styles.fieldBlock}>
              <Slider
                label={t('editProfile.height')}
                min={MIN_HEIGHT}
                max={MAX_HEIGHT}
                value={value}
                onChange={onChange}
                formatLabel={(sliderValue: number): string =>
                  t('profile.heightCm', { height: sliderValue })
                }
              />
            </View>
          )}
        />

        <Controller
          control={control}
          name="religion"
          render={({ field: { onChange, value } }): React.JSX.Element => (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>
                {t('editProfile.religion')}
                <Text style={styles.optional}> {t('editProfile.optional')}</Text>
              </Text>
              <SingleSelect
                options={getOptionLabels(RELIGION_OPTIONS, t)}
                selected={valueToLabel(value ?? '', RELIGION_OPTIONS, t)}
                onChange={(label: string): void => {
                  const nextValue = labelToValue(label, RELIGION_OPTIONS, t)
                  if (nextValue !== null) {
                    onChange(nextValue)
                  }
                }}
              />
            </View>
          )}
        />

        <SectionHeader label={t('editProfile.sections.preferences')} />
        <Controller
          control={control}
          name="lookingFor"
          render={({ field: { onChange, value } }): React.JSX.Element => (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>{t('editProfile.lookingFor')}</Text>
              <MultiSelect
                options={getOptionLabels(LOOKING_FOR_OPTIONS, t)}
                selected={valuesToLabels(value, LOOKING_FOR_OPTIONS, t)}
                onChange={(labels: string[]): void => {
                  onChange(labelsToValues(labels, LOOKING_FOR_OPTIONS, t))
                }}
                min={1}
                max={3}
              />
              {errors.lookingFor !== undefined && (
                <Text style={styles.fieldError}>
                  {translateError(errors.lookingFor.message, t)}
                </Text>
              )}
            </View>
          )}
        />

        <Text style={styles.fieldLabel}>{t('editProfile.ageRange')}</Text>
        <View style={styles.ageRangeRow}>
          <Controller
            control={control}
            name="ageRangeMin"
            render={({ field: { onChange, value } }): React.JSX.Element => (
              <View style={styles.ageSlider}>
                <Slider
                  label={t('editProfile.ageMin')}
                  min={MIN_AGE}
                  max={Math.max(MIN_AGE, ageRangeMax - 1)}
                  value={value}
                  onChange={onChange}
                  formatLabel={(sliderValue: number): string =>
                    String(sliderValue)
                  }
                />
              </View>
            )}
          />
          <Controller
            control={control}
            name="ageRangeMax"
            render={({ field: { onChange, value } }): React.JSX.Element => (
              <View style={styles.ageSlider}>
                <Slider
                  label={t('editProfile.ageMax')}
                  min={Math.min(MAX_AGE, ageRangeMin + 1)}
                  max={MAX_AGE}
                  value={value}
                  onChange={onChange}
                  formatLabel={(sliderValue: number): string =>
                    String(sliderValue)
                  }
                />
              </View>
            )}
          />
        </View>

        <Controller
          control={control}
          name="distanceKm"
          render={({ field: { onChange, value } }): React.JSX.Element => (
            <View style={styles.fieldBlock}>
              <Slider
                label={t('editProfile.distance')}
                min={MIN_DISTANCE_KM}
                max={MAX_DISTANCE_KM}
                value={value}
                onChange={onChange}
                formatLabel={(sliderValue: number): string =>
                  t('onboarding.step6.distanceValue', {
                    value: sliderValue,
                  })
                }
              />
            </View>
          )}
        />

        <Controller
          control={control}
          name="genders"
          render={({ field: { onChange, value } }): React.JSX.Element => (
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>
                {t('editProfile.genderPreference')}
              </Text>
              <MultiSelect
                options={getOptionLabels(GENDER_PREFERENCE_OPTIONS, t)}
                selected={valuesToLabels(value, GENDER_PREFERENCE_OPTIONS, t)}
                onChange={(labels: string[]): void => {
                  onChange(labelsToValues(labels, GENDER_PREFERENCE_OPTIONS, t))
                }}
                min={1}
                max={3}
              />
              {errors.genders !== undefined && (
                <Text style={styles.fieldError}>
                  {translateError(errors.genders.message, t)}
                </Text>
              )}
            </View>
          )}
        />
      </ScrollView>
    </SafeAreaView>
  )
}

function buildDefaultValues(profile: UserProfile | null): EditProfileForm {
  return {
    firstName: profile?.firstName ?? '',
    bio: profile?.bio ?? '',
    height: profile?.height ?? DEFAULT_HEIGHT,
    religion: profile?.religion ?? '',
    activities: profile?.activities ?? [],
    fitnessLevel: profile?.fitnessLevel ?? 'beginner',
    workoutFrequency: profile?.workoutFrequency ?? '',
    dietaryPreference: profile?.dietaryPreference ?? '',
    fitnessGoals: profile?.fitnessGoals ?? [],
    smoking: profile?.smoking ?? 'no',
    drinking: profile?.drinking ?? 'no',
    lookingFor: profile?.lookingFor ?? [],
    ageRangeMin: profile?.preferences.ageRange.min ?? MIN_AGE,
    ageRangeMax: profile?.preferences.ageRange.max ?? DEFAULT_MAX_AGE,
    distanceKm: profile?.preferences.distanceKm ?? DEFAULT_DISTANCE_KM,
    genders: profile?.preferences.genders ?? [],
  }
}

async function syncPhotos(newUris: string[], oldUrls: string[]): Promise<void> {
  const { uploadPhoto, deletePhoto } = useProfileStore.getState()

  for (let index = oldUrls.length - 1; index >= 0; index -= 1) {
    if (!newUris.includes(oldUrls[index])) {
      await deletePhoto(index)
      throwIfProfileStoreError()
    }
  }

  for (let index = 0; index < newUris.length; index += 1) {
    const uri = newUris[index]

    if (!uri.startsWith('https://')) {
      await uploadPhoto(uri, index)
      throwIfProfileStoreError()
    }
  }
}

function formatDOB(timestamp: Timestamp): string {
  const date = timestamp.toDate()
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()

  return `${day}/${month}/${year}`
}

function getOptionLabels<TValue extends string>(
  options: Array<SelectOption<TValue>>,
  t: TFunction,
): string[] {
  return options.map((option: SelectOption<TValue>): string =>
    t(option.labelKey)
  )
}

function valueToLabel<TValue extends string>(
  value: TValue | string,
  options: Array<SelectOption<TValue>>,
  t: TFunction,
): string | null {
  const option = options.find(
    (candidate: SelectOption<TValue>): boolean => candidate.value === value
  )

  return option !== undefined ? t(option.labelKey) : null
}

function valuesToLabels<TValue extends string>(
  values: string[],
  options: Array<SelectOption<TValue>>,
  t: TFunction,
): string[] {
  return values
    .map((value: string): string | null => valueToLabel(value, options, t))
    .filter((label: string | null): label is string => label !== null)
}

function labelToValue<TValue extends string>(
  label: string,
  options: Array<SelectOption<TValue>>,
  t: TFunction,
): TValue | null {
  const option = options.find(
    (candidate: SelectOption<TValue>): boolean => t(candidate.labelKey) === label
  )

  return option?.value ?? null
}

function labelsToValues<TValue extends string>(
  labels: string[],
  options: Array<SelectOption<TValue>>,
  t: TFunction,
): TValue[] {
  return labels
    .map((label: string): TValue | null => labelToValue(label, options, t))
    .filter((value: TValue | null): value is TValue => value !== null)
}

function getValidLookingFor(values: string[]): LookingFor[] {
  return values.filter((value: string): value is LookingFor =>
    LOOKING_FOR_OPTIONS.some(
      (option: SelectOption<LookingFor>): boolean => option.value === value
    )
  )
}

function translateError(
  message: string | undefined,
  t: TFunction,
): string | undefined {
  return message !== undefined && message !== '' ? t(message) : undefined
}

function throwIfProfileStoreError(): void {
  const profileError = useProfileStore.getState().error

  if (profileError !== null) {
    throw new Error(profileError)
  }
}

function mapProfileError(error: unknown): string {
  if (error instanceof Error && error.message.startsWith('profile.')) {
    return error.message
  }

  return mapFirebaseError(error)
}

function showToast(message: string): void {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT)
    return
  }

  Alert.alert(message)
}

const styles = StyleSheet.create({
  ageRangeRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  ageSlider: {
    flex: 1,
  },
  charCounter: {
    alignSelf: 'flex-end',
    color: colors.gray[600],
    fontSize: typography.sizes.xs,
    marginTop: spacing.xs,
  },
  charCounterRed: {
    color: colors.danger,
  },
  fieldBlock: {
    marginBottom: spacing.md,
  },
  fieldError: {
    color: colors.danger,
    fontSize: typography.sizes.xs,
    marginLeft: spacing.xs,
    marginTop: spacing.xs,
  },
  fieldLabel: {
    color: colors.gray[800],
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  header: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.gray[200],
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerButton: {
    alignItems: 'center',
    height: spacing.xl,
    justifyContent: 'center',
    minWidth: spacing.xxl,
  },
  headerSave: {
    color: colors.primary,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  headerSaveDisabled: {
    color: colors.gray[400],
  },
  headerTitle: {
    color: colors.gray[900],
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  loadingContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  optional: {
    color: colors.gray[500],
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
  },
  photoGuidelines: {
    color: colors.gray[600],
    fontSize: typography.sizes.sm,
    lineHeight: typography.sizes.sm * typography.lineHeights.normal,
    marginTop: spacing.sm,
  },
  readOnlyField: {
    backgroundColor: colors.surface,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  readOnlyHint: {
    color: colors.gray[500],
    fontSize: typography.sizes.xs,
    marginTop: spacing.xs,
  },
  readOnlyLabel: {
    color: colors.gray[600],
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.xs,
  },
  readOnlyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  readOnlyValue: {
    color: colors.gray[900],
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  scrollView: {
    backgroundColor: colors.background,
    flex: 1,
  },
  sectionHeader: {
    color: colors.gray[900],
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
    marginTop: spacing.xl,
  },
})
