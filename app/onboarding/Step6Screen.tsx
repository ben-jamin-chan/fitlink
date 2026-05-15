import React, { useEffect, useState } from 'react'

import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import * as Localization from 'expo-localization'
import { GeoPoint } from 'firebase/firestore'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/store/authStore'
import { useOnboardingStore } from '@/store/onboardingStore'
import type { OnboardingDraft } from '@/store/onboardingStore'

import { Button } from '@/components/ui/Button'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'
import { MultiSelect } from '@/components/ui/MultiSelect'
import { Slider } from '@/components/ui/Slider'

import { OnboardingHeader } from '@/app/onboarding/OnboardingNavigator'
import type { OnboardingStackParamList } from '@/app/onboarding/OnboardingNavigator'
import { createUserProfile } from '@/services/firebase/firestore'
import { uploadAllProfilePhotos } from '@/services/firebase/storage'
import { mapFirebaseError } from '@/utils/errorUtils'
import type { LookingFor, UserLocation } from '@/types/user'

import {
  MIN_PHOTOS,
  colors,
  spacing,
  typography,
} from '@/constants/theme'

const STEP = 6
const MIN_AGE = 18
const MAX_AGE = 60
const DEFAULT_AGE_MAX = 35
const MIN_DISTANCE_KM = 5
const MAX_DISTANCE_KM = 100
const DEFAULT_DISTANCE_KM = 25
const FALLBACK_COUNTRY = 'Malaysia'
const FALLBACK_LANGUAGE = 'en'

type Step6NavigationProp = StackNavigationProp<OnboardingStackParamList, 'Step6'>

interface LookingForOption {
  label: string
  value: LookingFor
}

interface GenderPreferenceOption {
  label: string
  value: string
}

interface RequiredDraft {
  firstName: string
  dateOfBirth: string
  gender: NonNullable<OnboardingDraft['gender']>
  city: string
  country: string
  photoUris: string[]
  bio: string
  height: number
  activities: string[]
  fitnessLevel: NonNullable<OnboardingDraft['fitnessLevel']>
  workoutFrequency: string
  dietaryPreference: string
  fitnessGoals: string[]
  smoking: NonNullable<OnboardingDraft['smoking']>
  drinking: NonNullable<OnboardingDraft['drinking']>
}

const labelsToLookingFor = (
  labels: string[],
  options: LookingForOption[]
): LookingFor[] =>
  labels
    .map((label: string): LookingFor | undefined => {
      return options.find((option) => option.label === label)?.value
    })
    .filter((value: LookingFor | undefined): value is LookingFor => {
      return value !== undefined
    })

const lookingForToLabels = (
  values: LookingFor[],
  options: LookingForOption[]
): string[] =>
  values
    .map((value: LookingFor): string | undefined => {
      return options.find((option) => option.value === value)?.label
    })
    .filter((label: string | undefined): label is string => {
      return label !== undefined
    })

const labelsToGenderPreference = (
  labels: string[],
  options: GenderPreferenceOption[]
): string[] =>
  labels
    .map((label: string): string | undefined => {
      return options.find((option) => option.label === label)?.value
    })
    .filter((value: string | undefined): value is string => {
      return value !== undefined
    })

const genderPreferenceToLabels = (
  values: string[],
  options: GenderPreferenceOption[]
): string[] =>
  values
    .map((value: string): string | undefined => {
      return options.find((option) => option.value === value)?.label
    })
    .filter((label: string | undefined): label is string => {
      return label !== undefined
    })

const getDeviceLanguage = (): string => {
  const locale = Localization.getLocales()[0]?.languageTag ?? FALLBACK_LANGUAGE
  const language = locale.split('-')[0]

  return language !== '' ? language : FALLBACK_LANGUAGE
}

const buildLocation = (city: string, country: string): UserLocation => ({
  city,
  country,
  coordinates: new GeoPoint(0, 0),
})

export default function Step6Screen(): React.JSX.Element {
  const { t } = useTranslation()
  const navigation = useNavigation<Step6NavigationProp>()
  const { draft, updateDraft, setCurrentStep, clearDraft } =
    useOnboardingStore()
  const { user, setHasCompletedOnboarding } = useAuthStore()

  const lookingForOptions: LookingForOption[] = [
    {
      label: t('onboarding.step6.lookingForOptions.friends'),
      value: 'friends',
    },
    {
      label: t('onboarding.step6.lookingForOptions.workoutPartners'),
      value: 'workout_partners',
    },
    {
      label: t('onboarding.step6.lookingForOptions.dating'),
      value: 'dating',
    },
  ]
  const genderPreferenceOptions: GenderPreferenceOption[] = [
    {
      label: t('onboarding.step6.genderPreferenceOptions.men'),
      value: 'male',
    },
    {
      label: t('onboarding.step6.genderPreferenceOptions.women'),
      value: 'female',
    },
    {
      label: t('onboarding.step6.genderPreferenceOptions.everyone'),
      value: 'everyone',
    },
  ]

  const [lookingFor, setLookingFor] = useState<LookingFor[]>(
    draft.lookingFor ?? []
  )
  const [ageMin, setAgeMin] = useState<number>(
    draft.preferredAgeMin ?? MIN_AGE
  )
  const [ageMax, setAgeMax] = useState<number>(
    draft.preferredAgeMax ?? DEFAULT_AGE_MAX
  )
  const [distanceKm, setDistanceKm] = useState<number>(
    draft.preferredDistanceKm ?? DEFAULT_DISTANCE_KM
  )
  const [genderPreference, setGenderPreference] = useState<string[]>(
    draft.preferredGenders ?? []
  )
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [uploadMessage, setUploadMessage] = useState<string>('')

  useEffect((): void => {
    setCurrentStep(STEP)
  }, [setCurrentStep])

  const isValid =
    lookingFor.length > 0 && genderPreference.length > 0 && ageMin < ageMax

  const getRequiredDraft = (): RequiredDraft | null => {
    const missingKeys: string[] = []

    if (draft.firstName === undefined || draft.firstName === '') {
      missingKeys.push(t('onboarding.submit.missingFields.firstName'))
    }
    if (draft.dateOfBirth === undefined || draft.dateOfBirth === '') {
      missingKeys.push(t('onboarding.submit.missingFields.dateOfBirth'))
    }
    if (draft.gender === undefined) {
      missingKeys.push(t('onboarding.submit.missingFields.gender'))
    }
    if (draft.city === undefined || draft.city === '') {
      missingKeys.push(t('onboarding.submit.missingFields.location'))
    }
    if (draft.photoUris === undefined || draft.photoUris.length < MIN_PHOTOS) {
      missingKeys.push(t('onboarding.submit.missingFields.photos'))
    }
    if (draft.bio === undefined || draft.bio === '') {
      missingKeys.push(t('onboarding.submit.missingFields.bio'))
    }
    if (draft.height === undefined) {
      missingKeys.push(t('onboarding.submit.missingFields.height'))
    }
    if (draft.activities === undefined || draft.activities.length === 0) {
      missingKeys.push(t('onboarding.submit.missingFields.activities'))
    }
    if (draft.fitnessLevel === undefined) {
      missingKeys.push(t('onboarding.submit.missingFields.fitnessLevel'))
    }
    if (
      draft.workoutFrequency === undefined ||
      draft.workoutFrequency === ''
    ) {
      missingKeys.push(t('onboarding.submit.missingFields.workoutFrequency'))
    }
    if (
      draft.dietaryPreference === undefined ||
      draft.dietaryPreference === ''
    ) {
      missingKeys.push(t('onboarding.submit.missingFields.dietaryPreference'))
    }
    if (draft.fitnessGoals === undefined || draft.fitnessGoals.length === 0) {
      missingKeys.push(t('onboarding.submit.missingFields.fitnessGoals'))
    }
    if (draft.smoking === undefined) {
      missingKeys.push(t('onboarding.submit.missingFields.smoking'))
    }
    if (draft.drinking === undefined) {
      missingKeys.push(t('onboarding.submit.missingFields.drinking'))
    }

    if (missingKeys.length > 0) {
      Alert.alert(
        t('errors.generic'),
        t('onboarding.submit.missingFieldsMessage', {
          fields: missingKeys.join(', '),
        })
      )
      return null
    }

    if (
      draft.firstName === undefined ||
      draft.dateOfBirth === undefined ||
      draft.gender === undefined ||
      draft.city === undefined ||
      draft.photoUris === undefined ||
      draft.bio === undefined ||
      draft.height === undefined ||
      draft.activities === undefined ||
      draft.fitnessLevel === undefined ||
      draft.workoutFrequency === undefined ||
      draft.dietaryPreference === undefined ||
      draft.fitnessGoals === undefined ||
      draft.smoking === undefined ||
      draft.drinking === undefined
    ) {
      return null
    }

    return {
      firstName: draft.firstName,
      dateOfBirth: draft.dateOfBirth,
      gender: draft.gender,
      city: draft.city,
      country: draft.country ?? FALLBACK_COUNTRY,
      photoUris: draft.photoUris,
      bio: draft.bio,
      height: draft.height,
      activities: draft.activities,
      fitnessLevel: draft.fitnessLevel,
      workoutFrequency: draft.workoutFrequency,
      dietaryPreference: draft.dietaryPreference,
      fitnessGoals: draft.fitnessGoals,
      smoking: draft.smoking,
      drinking: draft.drinking,
    }
  }

  const handleAgeMinChange = (value: number): void => {
    setAgeMin(Math.min(value, ageMax - 1))
  }

  const handleAgeMaxChange = (value: number): void => {
    setAgeMax(Math.max(value, ageMin + 1))
  }

  const saveDraft = (): void => {
    updateDraft({
      lookingFor,
      preferredAgeMin: ageMin,
      preferredAgeMax: ageMax,
      preferredDistanceKm: distanceKm,
      preferredGenders: genderPreference,
    })
  }

  const handleBack = (): void => {
    saveDraft()
    setCurrentStep(5)
    navigation.navigate('Step5')
  }

  const handleCompleteProfile = async (): Promise<void> => {
    if (!isValid || user === null) {
      return
    }

    saveDraft()

    const requiredDraft = getRequiredDraft()
    if (requiredDraft === null) {
      return
    }

    setIsSubmitting(true)
    setUploadMessage(t('onboarding.submit.uploadingPhotos'))

    try {
      const downloadUrls = await uploadAllProfilePhotos(
        user.uid,
        requiredDraft.photoUris,
        (percent: number): void => {
          setUploadMessage(
            t('onboarding.submit.uploadProgress', { percent })
          )
        }
      )

      setUploadMessage(t('onboarding.submit.savingProfile'))

      await createUserProfile({
        uid: user.uid,
        firstName: requiredDraft.firstName,
        dateOfBirth: new Date(requiredDraft.dateOfBirth),
        gender: requiredDraft.gender,
        location: buildLocation(requiredDraft.city, requiredDraft.country),
        photos: downloadUrls,
        bio: requiredDraft.bio,
        height: requiredDraft.height,
        religion: draft.religion,
        activities: requiredDraft.activities,
        fitnessLevel: requiredDraft.fitnessLevel,
        workoutFrequency: requiredDraft.workoutFrequency,
        dietaryPreference: requiredDraft.dietaryPreference,
        fitnessGoals: requiredDraft.fitnessGoals,
        smoking: requiredDraft.smoking,
        drinking: requiredDraft.drinking,
        lookingFor,
        preferences: {
          ageRange: { min: ageMin, max: ageMax },
          distanceKm,
          genders: genderPreference,
        },
        language: getDeviceLanguage(),
      })

      clearDraft()
      setHasCompletedOnboarding(true)
    } catch (error: unknown) {
      Alert.alert(t('errors.generic'), t(mapFirebaseError(error)))
    } finally {
      setIsSubmitting(false)
      setUploadMessage('')
    }
  }

  return (
    <View style={styles.root}>
      <LoadingOverlay visible={isSubmitting} message={uploadMessage} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <OnboardingHeader step={STEP} />

        <View style={styles.content}>
          <Text style={styles.title}>{t('onboarding.step6.title')}</Text>
          <Text style={styles.subtitle}>
            {t('onboarding.step6.subtitle')}
          </Text>

          <Text style={styles.sectionLabel}>
            {t('onboarding.step6.lookingFor')}
          </Text>
          <MultiSelect
            options={lookingForOptions.map(
              (option: LookingForOption): string => option.label
            )}
            selected={lookingForToLabels(lookingFor, lookingForOptions)}
            onChange={(labels: string[]): void => {
              setLookingFor(labelsToLookingFor(labels, lookingForOptions))
            }}
            min={1}
          />

          <Text style={styles.sectionLabel}>
            {t('onboarding.step6.genderPreference')}
          </Text>
          <MultiSelect
            options={genderPreferenceOptions.map(
              (option: GenderPreferenceOption): string => option.label
            )}
            selected={genderPreferenceToLabels(
              genderPreference,
              genderPreferenceOptions
            )}
            onChange={(labels: string[]): void => {
              setGenderPreference(
                labelsToGenderPreference(labels, genderPreferenceOptions)
              )
            }}
            min={1}
          />

          <Text style={styles.sectionLabel}>
            {t('onboarding.step6.ageRange')}
          </Text>
          <Text style={styles.rangeHint}>
            {t('onboarding.step6.ageRangeValue', {
              min: ageMin,
              max: ageMax,
            })}
          </Text>
          <Slider
            label={t('onboarding.step6.ageMin')}
            min={MIN_AGE}
            max={MAX_AGE}
            value={ageMin}
            onChange={handleAgeMinChange}
            formatLabel={(value: number): string => `${value}`}
          />
          <Slider
            label={t('onboarding.step6.ageMax')}
            min={MIN_AGE}
            max={MAX_AGE}
            value={ageMax}
            onChange={handleAgeMaxChange}
            formatLabel={(value: number): string => `${value}`}
          />

          <Text style={styles.sectionLabel}>
            {t('onboarding.step6.distance')}
          </Text>
          <Slider
            label={t('onboarding.step6.distance')}
            min={MIN_DISTANCE_KM}
            max={MAX_DISTANCE_KM}
            value={distanceKm}
            onChange={setDistanceKm}
            formatLabel={(value: number): string =>
              t('onboarding.step6.distanceValue', { value })
            }
          />
        </View>
      </ScrollView>

      <View style={styles.buttonRow}>
        <View style={styles.backButton}>
          <Button
            label={t('common.back')}
            onPress={handleBack}
            variant="outline"
            disabled={isSubmitting}
          />
        </View>
        <View style={styles.nextButton}>
          <Button
            label={t('onboarding.completeProfile')}
            onPress={handleCompleteProfile}
            disabled={!isValid || isSubmitting}
            loading={isSubmitting}
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
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xxl,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.gray[900],
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  subtitle: {
    fontSize: typography.sizes.md,
    color: colors.gray[600],
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.gray[800],
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  rangeHint: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
    marginBottom: spacing.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    backgroundColor: colors.background,
    gap: spacing.sm,
  },
  backButton: {
    flex: 1,
  },
  nextButton: {
    flex: 2,
  },
})
