import React, { useEffect, useMemo, useState } from 'react'

import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import DateTimePicker from '@react-native-community/datetimepicker'
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { useNavigation } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { useOnboardingStore } from '@/store/onboardingStore'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

import {
  OnboardingHeader,
  type OnboardingStackParamList,
} from '@/app/onboarding/OnboardingNavigator'
import type { Gender } from '@/types/user'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

type Step1NavigationProp = StackNavigationProp<OnboardingStackParamList, 'Step1'>

const STEP = 1
const MIN_AGE_YEARS = 18

const genderValues: [Gender, Gender, Gender] = ['male', 'female', 'non-binary']

const step1Schema = z.object({
  firstName: z.string().trim().min(2).max(50),
  dateOfBirth: z.date(),
  gender: z.enum(genderValues),
  city: z.string().trim().min(2),
})

const getMaxDate = (): Date => {
  const date = new Date()
  date.setFullYear(date.getFullYear() - MIN_AGE_YEARS)
  return date
}

const formatDateDisplay = (date: Date): string =>
  date.toLocaleDateString('en-MY', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

const genders: { value: Gender; labelKey: string }[] = [
  { value: 'male', labelKey: 'onboarding.step1.male' },
  { value: 'female', labelKey: 'onboarding.step1.female' },
  { value: 'non-binary', labelKey: 'onboarding.step1.nonBinary' },
]

export default function Step1Screen(): React.JSX.Element {
  const { t } = useTranslation()
  const navigation = useNavigation<Step1NavigationProp>()
  const { draft, updateDraft, setCurrentStep } = useOnboardingStore()

  const [firstName, setFirstName] = useState(draft.firstName ?? '')
  const [dateOfBirth, setDateOfBirth] = useState<Date>(
    draft.dateOfBirth !== undefined ? new Date(draft.dateOfBirth) : getMaxDate()
  )
  const [dobSelected, setDobSelected] = useState(
    draft.dateOfBirth !== undefined
  )
  const [showPicker, setShowPicker] = useState(false)
  const [gender, setGender] = useState<Gender | undefined>(draft.gender)
  const [city, setCity] = useState(draft.city ?? '')

  useEffect((): void => {
    setCurrentStep(STEP)
  }, [setCurrentStep])

  const firstNameError =
    firstName.length > 0 && !step1Schema.shape.firstName.safeParse(firstName).success
      ? t('errors.profile.minActivities')
      : undefined

  const isValid = useMemo(
    (): boolean =>
      step1Schema.safeParse({
        firstName,
        dateOfBirth: dobSelected ? dateOfBirth : undefined,
        gender,
        city,
      }).success && dateOfBirth <= getMaxDate(),
    [city, dateOfBirth, dobSelected, firstName, gender]
  )

  const handleDateChange = (
    event: DateTimePickerEvent,
    selected?: Date
  ): void => {
    if (Platform.OS === 'android') {
      setShowPicker(false)

      if (event.type === 'dismissed') {
        return
      }
    }

    if (selected !== undefined) {
      setDateOfBirth(selected)
      setDobSelected(true)
    }
  }

  const handleNext = (): void => {
    updateDraft({
      firstName: firstName.trim(),
      dateOfBirth: dateOfBirth.toISOString(),
      gender,
      city: city.trim(),
      country: 'Malaysia',
    })
    setCurrentStep(2)
    navigation.navigate('Step2')
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <OnboardingHeader step={STEP} />

      <View style={styles.content}>
        <Text style={styles.title}>{t('onboarding.step1.title')}</Text>

        <View style={styles.field}>
          <Input
            label={t('onboarding.step1.firstName')}
            placeholder={t('onboarding.step1.firstNamePlaceholder')}
            value={firstName}
            onChangeText={setFirstName}
            error={firstNameError}
            autoCapitalize="words"
            textContentType="givenName"
            maxLength={50}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('onboarding.step1.dateOfBirth')}</Text>

          {Platform.OS === 'ios' ? (
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
            <>
              <TouchableOpacity
                style={[
                  styles.dateButton,
                  !dobSelected && styles.dateButtonPlaceholder,
                ]}
                onPress={() => setShowPicker(true)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dateButtonText,
                    !dobSelected && styles.dateButtonPlaceholderText,
                  ]}
                >
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

        <View style={styles.field}>
          <Text style={styles.label}>{t('onboarding.step1.gender')}</Text>
          <View style={styles.genderRow}>
            {genders.map(({ value, labelKey }) => (
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

        <View style={styles.field}>
          <Input
            label={t('onboarding.step1.location')}
            placeholder={t('onboarding.step1.location')}
            value={city}
            onChangeText={setCity}
            autoCapitalize="words"
            textContentType="addressCity"
            maxLength={100}
          />
        </View>

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
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.gray[900],
    marginBottom: spacing.xl,
    marginTop: spacing.md,
  },
  field: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.gray[700],
    marginBottom: spacing.xs,
  },
  datePickerContainer: {
    borderWidth: 1.5,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  iosDatePicker: {
    height: 120,
  },
  dateButton: {
    height: 52,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  dateButtonPlaceholder: {
    borderColor: colors.gray[300],
  },
  dateButtonText: {
    fontSize: typography.sizes.md,
    color: colors.gray[900],
  },
  dateButtonPlaceholderText: {
    color: colors.gray[400],
  },
  genderRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  genderChip: {
    flex: 1,
    height: 44,
    borderWidth: 1.5,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  genderChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  genderChipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.gray[700],
  },
  genderChipTextSelected: {
    color: colors.white,
  },
  buttonWrapper: {
    marginTop: spacing.xl,
  },
})
