import React, { useCallback, useEffect, useMemo, useState } from 'react'

import {
  Alert,
  Image,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import type { RouteProp } from '@react-navigation/native'
import type { StackNavigationProp } from '@react-navigation/stack'
import { doc, updateDoc } from 'firebase/firestore'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'

import { useAuthStore } from '@/store/authStore'
import { useEventsStore } from '@/store/eventsStore'

import { Button } from '@/components/ui/Button'
import { LoadingOverlay } from '@/components/ui/LoadingOverlay'

import { db } from '@/services/firebase/config'
import { getUserProfile } from '@/services/firebase/firestore'

import type { EventsStackParamList } from '@/app/navigation/MainTabNavigator'
import type { FitlinkEvent } from '@/types/event'
import type { UserProfile } from '@/types/user'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

type EventDetailNavigationProp = StackNavigationProp<
  EventsStackParamList,
  'EventDetail'
>

type EventDetailRouteProp = RouteProp<EventsStackParamList, 'EventDetail'>

interface EventDetailScreenProps {
  navigation: EventDetailNavigationProp
  route: EventDetailRouteProp
}

interface AttendeeAvatarProps {
  profile: UserProfile
}

interface EventDetailScreenStyles {
  activityBadge: ViewStyle
  activityBadgeText: TextStyle
  avatar: ImageStyle
  avatarFallback: ViewStyle
  avatarMore: ViewStyle
  avatarMoreText: TextStyle
  avatarRow: ViewStyle
  buttonWrap: ViewStyle
  cancelledBanner: ViewStyle
  cancelledText: TextStyle
  container: ViewStyle
  description: TextStyle
  infoRow: ViewStyle
  infoText: TextStyle
  missingText: TextStyle
  missingWrap: ViewStyle
  sectionLabel: TextStyle
  scrollContent: ViewStyle
  title: TextStyle
  topBar: ViewStyle
  topBarButton: ViewStyle
}

const FULL_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
  weekday: 'long',
  year: 'numeric',
}

const ACTIVITY_LABEL_KEYS: Record<string, string> = {
  badminton: 'events.activities.badminton',
  basketball: 'events.activities.basketball',
  boxing: 'events.activities.boxing',
  climbing: 'events.activities.climbing',
  crossfit: 'events.activities.crossFit',
  cycling: 'events.activities.cycling',
  dancing: 'events.activities.dancing',
  football: 'events.activities.football',
  gym: 'events.activities.gym',
  hiking: 'events.activities.hiking',
  muaythai: 'events.activities.muayThai',
  pilates: 'events.activities.pilates',
  running: 'events.activities.running',
  swimming: 'events.activities.swimming',
  tennis: 'events.activities.tennis',
  yoga: 'events.activities.yoga',
}

const ICON_SIZE = 24
const INFO_ICON_SIZE = 18
const AVATAR_ICON_SIZE = 18

const getActivityKey = (activityType: string): string =>
  activityType.toLowerCase().replace(/\s+/g, '')

const formatEventDate = (millis: number, locale: string): string =>
  new Date(millis).toLocaleString(locale, FULL_DATE_OPTIONS)

const AttendeeAvatar = ({
  profile,
}: AttendeeAvatarProps): React.JSX.Element => {
  const primaryPhoto = profile.photos[0]

  if (primaryPhoto === undefined || primaryPhoto.length === 0) {
    return (
      <View style={styles.avatarFallback}>
        <Ionicons
          name="person-outline"
          size={AVATAR_ICON_SIZE}
          color={colors.gray[500]}
        />
      </View>
    )
  }

  return <Image source={{ uri: primaryPhoto }} style={styles.avatar} />
}

export default function EventDetailScreen({
  navigation,
  route,
}: EventDetailScreenProps): React.JSX.Element {
  const { t, i18n } = useTranslation()
  const { eventId } = route.params
  const userId = useAuthStore((state) => state.user?.uid)
  const upcomingEvents = useEventsStore((state) => state.upcomingEvents)
  const myEvents = useEventsStore((state) => state.myEvents)
  const rsvp = useEventsStore((state) => state.rsvp)
  const fetchUpcomingEvents = useEventsStore(
    (state) => state.fetchUpcomingEvents
  )
  const fetchMyEvents = useEventsStore((state) => state.fetchMyEvents)
  const fetchEventById = useEventsStore((state) => state.fetchEventById)
  const [fallbackEvent, setFallbackEvent] = useState<FitlinkEvent | null>(null)
  const [attendeeProfiles, setAttendeeProfiles] = useState<UserProfile[]>([])
  const [isFetchingEvent, setIsFetchingEvent] = useState<boolean>(false)
  const [isEventMissing, setIsEventMissing] = useState<boolean>(false)
  const [isRsvpLoading, setIsRsvpLoading] = useState<boolean>(false)
  const [isCancelling, setIsCancelling] = useState<boolean>(false)

  const storeEvent = useMemo(
    (): FitlinkEvent | undefined =>
      upcomingEvents.find((event) => event.id === eventId) ??
      myEvents.find((event) => event.id === eventId),
    [eventId, myEvents, upcomingEvents]
  )
  const event = storeEvent ?? fallbackEvent

  useEffect(() => {
    if (storeEvent !== undefined) {
      setFallbackEvent(null)
      setIsEventMissing(false)
      return
    }

    let isActive = true
    setIsFetchingEvent(true)

    void fetchEventById(eventId)
      .then((loadedEvent: FitlinkEvent | null): void => {
        if (!isActive) {
          return
        }

        setFallbackEvent(loadedEvent)
        setIsEventMissing(loadedEvent === null)
      })
      .catch((): void => {
        if (isActive) {
          setIsEventMissing(true)
        }
      })
      .finally((): void => {
        if (isActive) {
          setIsFetchingEvent(false)
        }
      })

    return (): void => {
      isActive = false
    }
  }, [eventId, fetchEventById, storeEvent])

  useEffect(() => {
    if (event === null) {
      setAttendeeProfiles([])
      return undefined
    }

    let isActive = true
    const attendeeIds = event.attendees.slice(0, 5)

    const fetchProfiles = async (): Promise<void> => {
      const profiles = await Promise.all(
        attendeeIds.map((attendeeId) =>
          getUserProfile(attendeeId).catch(() => null)
        )
      )

      if (isActive) {
        setAttendeeProfiles(
          profiles.filter(
            (profile): profile is UserProfile => profile !== null
          )
        )
      }
    }

    void fetchProfiles()

    return (): void => {
      isActive = false
    }
  }, [event])

  const isAttending =
    event !== null && userId !== undefined && event.attendees.includes(userId)
  const isCreator = event !== null && userId === event.creatorId
  const isFull =
    event !== null &&
    event.maxAttendees !== null &&
    event.attendees.length >= event.maxAttendees
  const activityLabelKey =
    event === null ? undefined : ACTIVITY_LABEL_KEYS[getActivityKey(event.activityType)]
  const activityLabel =
    event === null
      ? ''
      : activityLabelKey === undefined
        ? event.activityType
        : t(activityLabelKey)

  const refreshEvent = useCallback(async (): Promise<void> => {
    if (event === null) {
      return
    }

    const loadedEvent = await fetchEventById(event.id)
    setFallbackEvent(loadedEvent)

    await fetchUpcomingEvents(event.city)

    if (userId !== undefined) {
      await fetchMyEvents(userId)
    }
  }, [event, fetchEventById, fetchMyEvents, fetchUpcomingEvents, userId])

  const handleRsvp = useCallback(async (): Promise<void> => {
    if (event === null || userId === undefined) {
      return
    }

    setIsRsvpLoading(true)

    try {
      await rsvp(event.id, isAttending ? 'leave' : 'join')
      await refreshEvent()
    } catch {
      Alert.alert(
        t('events.detail.rsvpErrorTitle'),
        t('events.detail.rsvpErrorMessage')
      )
    } finally {
      setIsRsvpLoading(false)
    }
  }, [event, isAttending, refreshEvent, rsvp, t, userId])

  const handleCancelEvent = useCallback((): void => {
    if (event === null) {
      return
    }

    Alert.alert(
      t('events.detail.cancelConfirmTitle'),
      t('events.detail.cancelConfirmMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('events.detail.cancelConfirm'),
          style: 'destructive',
          onPress: (): void => {
            setIsCancelling(true)
            void updateDoc(doc(db, 'events', event.id), {
              cancelled: true,
            })
              .then((): void => {
                navigation.goBack()
              })
              .catch((): void => {
                Alert.alert(
                  t('events.detail.cancelErrorTitle'),
                  t('events.detail.cancelErrorMessage')
                )
              })
              .finally((): void => {
                setIsCancelling(false)
              })
          },
        },
      ]
    )
  }, [event, navigation, t])

  const handleShare = useCallback(async (): Promise<void> => {
    if (event === null) {
      return
    }

    await Share.share({
      message: t('events.shareMessage', {
        link: `fitlink://events/${event.id}`,
        title: event.title,
      }),
    })
  }, [event, t])

  if (event === null) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <LoadingOverlay
          visible={isFetchingEvent && !isEventMissing}
          message={t('common.loading')}
        />
        {isEventMissing && (
          <View style={styles.missingWrap}>
            <Text style={styles.missingText}>{t('events.detail.notFound')}</Text>
            <Button label={t('common.back')} onPress={navigation.goBack} />
          </View>
        )}
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <LoadingOverlay
        visible={isRsvpLoading || isCancelling}
        message={t('common.loading')}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.topBarButton}
            onPress={navigation.goBack}
            activeOpacity={0.8}
          >
            <Ionicons
              name="arrow-back"
              size={ICON_SIZE}
              color={colors.gray[800]}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.topBarButton}
            onPress={() => {
              void handleShare()
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="share-outline"
              size={ICON_SIZE}
              color={colors.gray[800]}
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>{event.title}</Text>

        <View style={styles.activityBadge}>
          <Text style={styles.activityBadgeText}>{activityLabel}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons
            name="calendar-outline"
            size={INFO_ICON_SIZE}
            color={colors.primary}
          />
          <Text style={styles.infoText}>
            {formatEventDate(event.startAt.toMillis(), i18n.language)}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons
            name="time-outline"
            size={INFO_ICON_SIZE}
            color={colors.primary}
          />
          <Text style={styles.infoText}>
            {t('events.detail.endsAt', {
              time: formatEventDate(event.endAt.toMillis(), i18n.language),
            })}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons
            name="location-outline"
            size={INFO_ICON_SIZE}
            color={colors.primary}
          />
          <Text style={styles.infoText}>
            {event.location.name}
            {event.location.address.length > 0
              ? `, ${event.location.address}`
              : ''}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons
            name="people-outline"
            size={INFO_ICON_SIZE}
            color={colors.primary}
          />
          <Text style={styles.infoText}>
            {event.maxAttendees !== null
              ? t('events.detail.attendeesOf', {
                  count: event.attendees.length,
                  max: event.maxAttendees,
                })
              : t('events.detail.attendeesUnlimited', {
                  count: event.attendees.length,
                })}
          </Text>
        </View>

        {attendeeProfiles.length > 0 && (
          <View style={styles.avatarRow}>
            {attendeeProfiles.map((profile) => (
              <AttendeeAvatar key={profile.uid} profile={profile} />
            ))}
            {event.attendees.length > attendeeProfiles.length && (
              <View style={styles.avatarMore}>
                <Text style={styles.avatarMoreText}>
                  +{event.attendees.length - attendeeProfiles.length}
                </Text>
              </View>
            )}
          </View>
        )}

        <Text style={styles.sectionLabel}>{t('events.detail.about')}</Text>
        <Text style={styles.description}>{event.description}</Text>

        {!event.cancelled && (
          <View style={styles.buttonWrap}>
            <Button
              label={
                isAttending
                  ? t('events.detail.leave')
                  : isFull
                    ? t('events.detail.full')
                    : t('events.detail.join')
              }
              onPress={handleRsvp}
              variant={isAttending ? 'outline' : 'primary'}
              disabled={!isAttending && isFull}
              loading={isRsvpLoading}
            />
          </View>
        )}

        {isCreator && !event.cancelled && (
          <View style={styles.buttonWrap}>
            <Button
              label={t('events.detail.cancel')}
              onPress={handleCancelEvent}
              variant="outline"
              loading={isCancelling}
            />
          </View>
        )}

        {event.cancelled && (
          <View style={styles.cancelledBanner}>
            <Text style={styles.cancelledText}>
              {t('events.detail.cancelled')}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create<EventDetailScreenStyles>({
  activityBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.gray[100],
    borderColor: colors.primary,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  activityBadgeText: {
    color: colors.primary,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  avatar: {
    borderColor: colors.white,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    height: spacing.xl + spacing.xs,
    marginRight: -spacing.sm,
    width: spacing.xl + spacing.xs,
  },
  avatarFallback: {
    alignItems: 'center',
    backgroundColor: colors.gray[200],
    borderColor: colors.white,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    height: spacing.xl + spacing.xs,
    justifyContent: 'center',
    marginRight: -spacing.sm,
    width: spacing.xl + spacing.xs,
  },
  avatarMore: {
    alignItems: 'center',
    backgroundColor: colors.gray[200],
    borderColor: colors.white,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    height: spacing.xl + spacing.xs,
    justifyContent: 'center',
    width: spacing.xl + spacing.xs,
  },
  avatarMoreText: {
    color: colors.gray[600],
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  avatarRow: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: spacing.lg,
    marginTop: spacing.sm,
  },
  buttonWrap: {
    marginBottom: spacing.sm,
  },
  cancelledBanner: {
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    borderColor: colors.danger,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.md,
    padding: spacing.md,
  },
  cancelledText: {
    color: colors.danger,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  description: {
    color: colors.gray[600],
    fontSize: typography.sizes.md,
    lineHeight: typography.sizes.md * typography.lineHeights.normal,
    marginBottom: spacing.lg,
  },
  infoRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  infoText: {
    color: colors.gray[700],
    flex: 1,
    fontSize: typography.sizes.sm,
  },
  missingText: {
    color: colors.gray[600],
    fontSize: typography.sizes.md,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  missingWrap: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  sectionLabel: {
    color: colors.gray[800],
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    marginBottom: spacing.xs,
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  title: {
    color: colors.gray[900],
    fontSize: typography.sizes.xxl,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.sm,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingTop: spacing.md,
  },
  topBarButton: {
    padding: spacing.xs,
  },
})
