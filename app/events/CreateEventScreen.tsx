import React, { useState } from 'react'

import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import type { TextStyle, ViewStyle } from 'react-native'

import DateTimePicker from '@react-native-community/datetimepicker'
import type { DateTimePickerEvent } from '@react-native-community/datetimepicker'
import { zodResolver } from '@hookform/resolvers/zod'
import type { StackNavigationProp } from '@react-navigation/stack'
import { Controller, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'
import { z } from 'zod'

import { useEventsStore } from '@/store/eventsStore'
import { useProfileStore } from '@/store/profileStore'

import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'

import type { EventsStackParamList } from '@/app/navigation/MainTabNavigator'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

type CreateEventNavigationProp = StackNavigationProp<
  EventsStackParamList,
  'CreateEvent'
>

interface CreateEventScreenProps {
  navigation: CreateEventNavigationProp
}

interface ActivityOption {
  value: string
  labelKey: string
}

interface CreateEventScreenStyles {
  chip: ViewStyle
  chipGrid: ViewStyle
  chipSelected: ViewStyle
  chipText: TextStyle
  chipTextSelected: TextStyle
  container: ViewStyle
  dateButton: ViewStyle
  dateButtonText: TextStyle
  datePickerContainer: ViewStyle
  errorText: TextStyle
  field: ViewStyle
  iosDatePicker: ViewStyle
  label: TextStyle
  screenTitle: TextStyle
  scroll: ViewStyle
  scrollContent: ViewStyle
  submitButton: ViewStyle
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000
const ONE_HOUR_MS = 60 * 60 * 1000

const ACTIVITY_OPTIONS: ActivityOption[] = [
  { value: 'Gym', labelKey: 'events.activities.gym' },
  { value: 'Running', labelKey: 'events.activities.running' },
  { value: 'Cycling', labelKey: 'events.activities.cycling' },
  { value: 'Swimming', labelKey: 'events.activities.swimming' },
  { value: 'Yoga', labelKey: 'events.activities.yoga' },
  { value: 'Hiking', labelKey: 'events.activities.hiking' },
  { value: 'Basketball', labelKey: 'events.activities.basketball' },
  { value: 'Football', labelKey: 'events.activities.football' },
  { value: 'Tennis', labelKey: 'events.activities.tennis' },
  { value: 'Badminton', labelKey: 'events.activities.badminton' },
  { value: 'Climbing', labelKey: 'events.activities.climbing' },
  { value: 'CrossFit', labelKey: 'events.activities.crossFit' },
  { value: 'Muay Thai', labelKey: 'events.activities.muayThai' },
  { value: 'Boxing', labelKey: 'events.activities.boxing' },
  { value: 'Pilates', labelKey: 'events.activities.pilates' },
  { value: 'Dancing', labelKey: 'events.activities.dancing' },
]

const createEventSchema = z
  .object({
    activityType: z.string().min(1, 'events.create.errors.activityRequired'),
    city: z.string().trim().min(1, 'events.create.errors.cityRequired'),
    country: z.string().trim().min(1, 'events.create.errors.cityRequired'),
    description: z
      .string()
      .trim()
      .min(1, 'events.create.errors.descriptionRequired'),
    endAt: z.date(),
    locationAddress: z
      .string()
      .trim()
      .min(1, 'events.create.errors.locationRequired'),
    locationLatitude: z.number(),
    locationLongitude: z.number(),
    locationName: z
      .string()
      .trim()
      .min(1, 'events.create.errors.locationRequired'),
    locationPlaceId: z.string(),
    maxAttendeesRaw: z.string().refine((value) => {
      const trimmedValue = value.trim()

      if (trimmedValue.length === 0) {
        return true
      }

      const parsedValue = Number.parseInt(trimmedValue, 10)

      return /^\d+$/.test(trimmedValue) && parsedValue > 0
    }, 'events.create.errors.maxAttendeesInvalid'),
    startAt: z
      .date()
      .refine(
        (value) => value.getTime() > Date.now(),
        'events.create.errors.startFuture'
      ),
    title: z.string().trim().min(5, 'events.create.errors.titleMin'),
  })
  .refine((data) => data.endAt.getTime() > data.startAt.getTime(), {
    message: 'events.create.errors.endAfterStart',
    path: ['endAt'],
  })

type CreateEventFormData = z.infer<typeof createEventSchema>

const getDefaultStart = (): Date => new Date(Date.now() + ONE_DAY_MS)

const getDefaultEnd = (startAt: Date): Date =>
  new Date(startAt.getTime() + ONE_HOUR_MS)

const formatDateTime = (date: Date, locale: string): string =>
  date.toLocaleString(locale, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  })

const getErrorText = (
  message: string | undefined,
  translate: (key: string) => string
): string | undefined => {
  return message === undefined ? undefined : translate(message)
}

const parseMaxAttendees = (rawValue: string): number | null => {
  const trimmedValue = rawValue.trim()

  if (trimmedValue.length === 0) {
    return null
  }

  return Number.parseInt(trimmedValue, 10)
}

export default function CreateEventScreen({
  navigation,
}: CreateEventScreenProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const profile = useProfileStore((state) => state.profile)
  const createEvent = useEventsStore((state) => state.createEvent)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [showStartPicker, setShowStartPicker] = useState<boolean>(false)
  const [showEndPicker, setShowEndPicker] = useState<boolean>(false)
  const defaultStart = getDefaultStart()
  const defaultEnd = getDefaultEnd(defaultStart)
  const profileCoordinates = profile?.location.coordinates

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateEventFormData>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      activityType: '',
      city: profile?.location.city ?? '',
      country: profile?.location.country ?? 'Malaysia',
      description: '',
      endAt: defaultEnd,
      locationAddress: '',
      locationLatitude: profileCoordinates?.latitude ?? 0,
      locationLongitude: profileCoordinates?.longitude ?? 0,
      locationName: '',
      locationPlaceId: '',
      maxAttendeesRaw: '',
      startAt: defaultStart,
      title: '',
    },
  })

  const selectedActivity = watch('activityType')
  const startAt = watch('startAt')
  const endAt = watch('endAt')

  const handleStartDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ): void => {
    if (Platform.OS === 'android' || event.type === 'set') {
      setShowStartPicker(false)
    }

    if (event.type === 'dismissed' || selectedDate === undefined) {
      return
    }

    setValue('startAt', selectedDate, {
      shouldDirty: true,
      shouldValidate: true,
    })

    if (endAt.getTime() <= selectedDate.getTime()) {
      setValue('endAt', getDefaultEnd(selectedDate), {
        shouldDirty: true,
        shouldValidate: true,
      })
    }
  }

  const handleEndDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date
  ): void => {
    if (Platform.OS === 'android' || event.type === 'set') {
      setShowEndPicker(false)
    }

    if (event.type === 'dismissed' || selectedDate === undefined) {
      return
    }

    setValue('endAt', selectedDate, {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  const handleCreateEvent = async (
    data: CreateEventFormData
  ): Promise<void> => {
    setIsSubmitting(true)

    try {
      await createEvent({
        activityType: data.activityType,
        city: data.city.trim(),
        country: data.country.trim(),
        description: data.description.trim(),
        endAt: data.endAt.getTime(),
        locationAddress: data.locationAddress.trim(),
        locationLatitude: data.locationLatitude,
        locationLongitude: data.locationLongitude,
        locationName: data.locationName.trim(),
        locationPlaceId: data.locationPlaceId.trim(),
        maxAttendees: parseMaxAttendees(data.maxAttendeesRaw),
        startAt: data.startAt.getTime(),
        title: data.title.trim(),
      })
      navigation.goBack()
    } catch {
      Alert.alert(
        t('events.create.errorTitle'),
        t('events.create.errorMessage')
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LoadingOverlay
        visible={isSubmitting}
        message={t('events.create.submitting')}
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.screenTitle}>{t('events.create.title')}</Text>

        <View style={styles.field}>
          <Controller
            control={control}
            name="title"
            render={({ field: { onBlur, onChange, value } }) => (
              <Input
                label={t('events.create.titleLabel')}
                placeholder={t('events.create.titlePlaceholder')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={getErrorText(errors.title?.message, t)}
                autoCapitalize="sentences"
                maxLength={80}
              />
            )}
          />
        </View>

        <View style={styles.field}>
          <Controller
            control={control}
            name="description"
            render={({ field: { onBlur, onChange, value } }) => (
              <Input
                label={t('events.create.descriptionLabel')}
                placeholder={t('events.create.descriptionPlaceholder')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={getErrorText(errors.description?.message, t)}
                autoCapitalize="sentences"
                multiline
                numberOfLines={4}
                maxLength={500}
              />
            )}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('events.create.activityLabel')}</Text>
          <View style={styles.chipGrid}>
            {ACTIVITY_OPTIONS.map((activity) => (
              <TouchableOpacity
                key={activity.value}
                style={[
                  styles.chip,
                  selectedActivity === activity.value && styles.chipSelected,
                ]}
                onPress={() =>
                  setValue('activityType', activity.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedActivity === activity.value &&
                      styles.chipTextSelected,
                  ]}
                >
                  {t(activity.labelKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {errors.activityType !== undefined && (
            <Text style={styles.errorText}>
              {t(errors.activityType.message ?? 'events.create.errors.activityRequired')}
            </Text>
          )}
        </View>

        <View style={styles.field}>
          <Controller
            control={control}
            name="locationName"
            render={({ field: { onBlur, onChange, value } }) => (
              <Input
                label={t('events.create.locationLabel')}
                placeholder={t('events.create.locationPlaceholder')}
                value={value}
                onChangeText={(text) => {
                  onChange(text)
                  setValue('locationAddress', text, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }}
                onBlur={onBlur}
                error={
                  getErrorText(errors.locationName?.message, t) ??
                  getErrorText(errors.city?.message, t)
                }
                autoCapitalize="words"
                maxLength={120}
              />
            )}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('events.create.startLabel')}</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowStartPicker(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.dateButtonText}>
              {formatDateTime(startAt, i18n.language)}
            </Text>
          </TouchableOpacity>
          {showStartPicker && (
            <View style={styles.datePickerContainer}>
              <DateTimePicker
                value={startAt}
                mode="datetime"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={handleStartDateChange}
                style={styles.iosDatePicker}
              />
            </View>
          )}
          {errors.startAt !== undefined && (
            <Text style={styles.errorText}>
              {t(errors.startAt.message ?? 'events.create.errors.startFuture')}
            </Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t('events.create.endLabel')}</Text>
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowEndPicker(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.dateButtonText}>
              {formatDateTime(endAt, i18n.language)}
            </Text>
          </TouchableOpacity>
          {showEndPicker && (
            <View style={styles.datePickerContainer}>
              <DateTimePicker
                value={endAt}
                mode="datetime"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={startAt}
                onChange={handleEndDateChange}
                style={styles.iosDatePicker}
              />
            </View>
          )}
          {errors.endAt !== undefined && (
            <Text style={styles.errorText}>
              {t(errors.endAt.message ?? 'events.create.errors.endAfterStart')}
            </Text>
          )}
        </View>

        <View style={styles.field}>
          <Controller
            control={control}
            name="maxAttendeesRaw"
            render={({ field: { onBlur, onChange, value } }) => (
              <Input
                label={t('events.create.maxAttendeesLabel')}
                placeholder={t('events.create.maxAttendeesPlaceholder')}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={getErrorText(errors.maxAttendeesRaw?.message, t)}
                keyboardType="number-pad"
                maxLength={3}
              />
            )}
          />
        </View>

        <View style={styles.submitButton}>
          <Button
            label={t('events.create.submit')}
            onPress={handleSubmit(handleCreateEvent)}
            loading={isSubmitting}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create<CreateEventScreenStyles>({
  chip: {
    backgroundColor: colors.surface,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.gray[700],
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  chipTextSelected: {
    color: colors.white,
    fontWeight: typography.weights.semibold,
  },
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  dateButton: {
    backgroundColor: colors.surface,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  dateButtonText: {
    color: colors.gray[900],
    fontSize: typography.sizes.md,
  },
  datePickerContainer: {
    backgroundColor: colors.surface,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.sizes.xs,
    marginTop: spacing.xs,
  },
  field: {
    marginBottom: spacing.lg,
  },
  iosDatePicker: {
    height: 160,
  },
  label: {
    color: colors.gray[700],
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.xs,
  },
  screenTitle: {
    color: colors.gray[900],
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.lg,
    marginTop: spacing.md,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  submitButton: {
    marginTop: spacing.sm,
  },
})
