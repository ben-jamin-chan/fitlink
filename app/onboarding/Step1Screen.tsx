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
import { SingleSelect } from '@/components/ui/SingleSelect'

import {
  OnboardingHeader,
  type OnboardingStackParamList,
} from '@/app/onboarding/OnboardingNavigator'
import type { Gender } from '@/types/user'

import {
  COUNTRY_TIMEZONES,
  SEA_CITIES,
  SUPPORTED_COUNTRIES,
} from '@/constants/regions'
import type { SupportedCountry } from '@/constants/regions'
import { borderRadius, colors, spacing, typography } from '@/constants/theme'

type Step1NavigationProp = StackNavigationProp<OnboardingStackParamList, 'Step1'>

const STEP = 1
const MIN_AGE_YEARS = 18
const DEFAULT_COUNTRY: SupportedCountry = 'Malaysia'

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

interface CountryOption {
  label: string
  value: SupportedCountry
}

interface CityOption {
  label: string
  value: string
}

const getSupportedCountry = (
  country: string | undefined
): SupportedCountry | null =>
  SUPPORTED_COUNTRIES.find(
    (supportedCountry: SupportedCountry): boolean =>
      supportedCountry === country
  ) ?? null

const detectCountryFromTimezone = (): SupportedCountry | null => {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone

    return (
      SUPPORTED_COUNTRIES.find(
        (country: SupportedCountry): boolean =>
          COUNTRY_TIMEZONES[country] === timezone
      ) ?? null
    )
  } catch {
    return null
  }
}

const getCityTranslationKey = (
  country: SupportedCountry,
  city: string
): string => `regions.city.${country}.${city.replace(/\s+/g, '_')}`

const isCityInCountry = (
  country: SupportedCountry,
  city: string
): boolean => SEA_CITIES[country].includes(city)

const isUntouchedDefaultRegion = (
  country: SupportedCountry | null,
  timezone: string | undefined,
  city: string
): boolean =>
  country === DEFAULT_COUNTRY &&
  (timezone === undefined || timezone === COUNTRY_TIMEZONES[DEFAULT_COUNTRY]) &&
  city === ''

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
  const [selectedCountry, setSelectedCountry] = useState<SupportedCountry>(
    getSupportedCountry(draft.country) ?? DEFAULT_COUNTRY
  )

  useEffect((): void => {
    setCurrentStep(STEP)
  }, [setCurrentStep])

  useEffect((): void => {
    const storedCountry = getSupportedCountry(draft.country)
    const detectedCountry = detectCountryFromTimezone()
    const storedCity = draft.city ?? ''
    const shouldUseDetectedCountry =
      storedCountry === null ||
      isUntouchedDefaultRegion(storedCountry, draft.timezone, storedCity)
    const nextCountry =
      shouldUseDetectedCountry
        ? detectedCountry ?? storedCountry ?? DEFAULT_COUNTRY
        : storedCountry ?? DEFAULT_COUNTRY
    const shouldClearCity =
      storedCity !== '' && !isCityInCountry(nextCountry, storedCity)

    setSelectedCountry(nextCountry)

    if (shouldClearCity) {
      setCity('')
    }

    if (
      draft.country !== nextCountry ||
      draft.timezone !== COUNTRY_TIMEZONES[nextCountry] ||
      shouldClearCity
    ) {
      updateDraft({
        country: nextCountry,
        timezone: COUNTRY_TIMEZONES[nextCountry],
        ...(shouldClearCity ? { city: '' } : {}),
      })
    }
    // Timezone auto-detection is intentionally a one-time mount step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const countryOptions = useMemo(
    (): CountryOption[] =>
      SUPPORTED_COUNTRIES.map(
        (country: SupportedCountry): CountryOption => ({
          label: t(`regions.country.${country}`),
          value: country,
        })
      ),
    [t]
  )

  const cityOptions = useMemo(
    (): CityOption[] =>
      SEA_CITIES[selectedCountry].map(
        (cityOption: string): CityOption => ({
          label: t(getCityTranslationKey(selectedCountry, cityOption)),
          value: cityOption,
        })
      ),
    [selectedCountry, t]
  )

  const selectedCountryLabel =
    countryOptions.find(
      (option: CountryOption): boolean => option.value === selectedCountry
    )?.label ?? null

  const selectedCityLabel =
    cityOptions.find((option: CityOption): boolean => option.value === city)
      ?.label ?? null

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
      }).success &&
      dateOfBirth <= getMaxDate() &&
      isCityInCountry(selectedCountry, city),
    [city, dateOfBirth, dobSelected, firstName, gender, selectedCountry]
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

  const handleCountrySelect = (country: SupportedCountry): void => {
    setSelectedCountry(country)
    setCity('')
    updateDraft({
      country,
      timezone: COUNTRY_TIMEZONES[country],
      city: '',
    })
  }

  const handleCountryLabelSelect = (label: string): void => {
    const country = countryOptions.find(
      (option: CountryOption): boolean => option.label === label
    )?.value

    if (country !== undefined) {
      handleCountrySelect(country)
    }
  }

  const handleCityLabelSelect = (label: string): void => {
    const nextCity = cityOptions.find(
      (option: CityOption): boolean => option.label === label
    )?.value

    if (nextCity !== undefined) {
      setCity(nextCity)
      updateDraft({ city: nextCity })
    }
  }

  const handleNext = (): void => {
    updateDraft({
      firstName: firstName.trim(),
      dateOfBirth: dateOfBirth.toISOString(),
      gender,
      city: city.trim(),
      country: selectedCountry,
      timezone: COUNTRY_TIMEZONES[selectedCountry],
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
          <Text style={styles.label}>
            {t('onboarding.step1.country.label')}
          </Text>
          <SingleSelect
            options={countryOptions.map(
              (option: CountryOption): string => option.label
            )}
            selected={selectedCountryLabel}
            onChange={handleCountryLabelSelect}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('onboarding.step1.location')}</Text>
          <SingleSelect
            options={cityOptions.map(
              (option: CityOption): string => option.label
            )}
            selected={selectedCityLabel}
            onChange={handleCityLabelSelect}
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
