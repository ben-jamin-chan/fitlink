import React from 'react'

import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import type { TextStyle, ViewStyle } from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

import type { FitlinkEvent } from '@/types/event'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

type IoniconName = React.ComponentProps<typeof Ionicons>['name']

interface ActivityDisplay {
  icon: IoniconName
  labelKey: string
}

interface EventCardProps {
  event: FitlinkEvent
  currentUserId: string
  onPress: (eventId: string) => void
}

interface EventCardStyles {
  activityLabel: TextStyle
  card: ViewStyle
  headerRow: ViewStyle
  iconWrap: ViewStyle
  metaRow: ViewStyle
  metaText: TextStyle
  pill: ViewStyle
  pillAttending: ViewStyle
  pillFull: ViewStyle
  pillJoin: ViewStyle
  pillText: TextStyle
  title: TextStyle
}

const ACTIVITY_DISPLAY: Record<string, ActivityDisplay> = {
  badminton: {
    icon: 'disc-outline',
    labelKey: 'events.activities.badminton',
  },
  basketball: {
    icon: 'basketball-outline',
    labelKey: 'events.activities.basketball',
  },
  boxing: {
    icon: 'hand-right-outline',
    labelKey: 'events.activities.boxing',
  },
  climbing: {
    icon: 'flag-outline',
    labelKey: 'events.activities.climbing',
  },
  crossfit: {
    icon: 'barbell-outline',
    labelKey: 'events.activities.crossFit',
  },
  cycling: {
    icon: 'bicycle-outline',
    labelKey: 'events.activities.cycling',
  },
  dancing: {
    icon: 'musical-notes-outline',
    labelKey: 'events.activities.dancing',
  },
  football: {
    icon: 'football-outline',
    labelKey: 'events.activities.football',
  },
  gym: {
    icon: 'barbell-outline',
    labelKey: 'events.activities.gym',
  },
  hiking: {
    icon: 'trail-sign-outline',
    labelKey: 'events.activities.hiking',
  },
  muaythai: {
    icon: 'hand-right-outline',
    labelKey: 'events.activities.muayThai',
  },
  pilates: {
    icon: 'body-outline',
    labelKey: 'events.activities.pilates',
  },
  running: {
    icon: 'walk-outline',
    labelKey: 'events.activities.running',
  },
  swimming: {
    icon: 'water-outline',
    labelKey: 'events.activities.swimming',
  },
  tennis: {
    icon: 'tennisball-outline',
    labelKey: 'events.activities.tennis',
  },
  yoga: {
    icon: 'body-outline',
    labelKey: 'events.activities.yoga',
  },
}

const ICON_SIZE = 20
const META_ICON_SIZE = 14

const getActivityKey = (activityType: string): string =>
  activityType.toLowerCase().replace(/\s+/g, '')

const getActivityDisplay = (
  activityType: string
): ActivityDisplay | undefined => {
  return ACTIVITY_DISPLAY[getActivityKey(activityType)]
}

const formatEventDate = (millis: number, locale: string): string => {
  return new Date(millis).toLocaleString(locale, {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  })
}

export const EventCard = ({
  event,
  currentUserId,
  onPress,
}: EventCardProps): React.JSX.Element => {
  const { t, i18n } = useTranslation()
  const activityDisplay = getActivityDisplay(event.activityType)
  const isAttending = event.attendees.includes(currentUserId)
  const isFull =
    event.maxAttendees !== null &&
    event.attendees.length >= event.maxAttendees
  const activityLabel =
    activityDisplay !== undefined
      ? t(activityDisplay.labelKey)
      : event.activityType
  const iconName = activityDisplay?.icon ?? 'fitness-outline'
  const pillLabel = isAttending
    ? t('events.card.attending')
    : isFull
      ? t('events.card.full')
      : t('events.card.join')

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(event.id)}
      activeOpacity={0.85}
    >
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Ionicons name={iconName} size={ICON_SIZE} color={colors.white} />
        </View>
        <Text style={styles.activityLabel} numberOfLines={1}>
          {activityLabel}
        </Text>
        <View
          style={[
            styles.pill,
            isAttending
              ? styles.pillAttending
              : isFull
                ? styles.pillFull
                : styles.pillJoin,
          ]}
        >
          <Text style={styles.pillText}>{pillLabel}</Text>
        </View>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {event.title}
      </Text>

      <View style={styles.metaRow}>
        <Ionicons
          name="calendar-outline"
          size={META_ICON_SIZE}
          color={colors.gray[500]}
        />
        <Text style={styles.metaText}>
          {formatEventDate(event.startAt.toMillis(), i18n.language)}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Ionicons
          name="location-outline"
          size={META_ICON_SIZE}
          color={colors.gray[500]}
        />
        <Text style={styles.metaText} numberOfLines={1}>
          {event.location.name}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Ionicons
          name="people-outline"
          size={META_ICON_SIZE}
          color={colors.gray[500]}
        />
        <Text style={styles.metaText}>
          {event.maxAttendees !== null
            ? t('events.card.attendeesOf', {
                count: event.attendees.length,
                max: event.maxAttendees,
              })
            : t('events.card.attendeesUnlimited', {
                count: event.attendees.length,
              })}
        </Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create<EventCardStyles>({
  activityLabel: {
    color: colors.gray[600],
    flex: 1,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.md,
    elevation: 3,
    marginBottom: spacing.sm,
    padding: spacing.md,
    shadowColor: colors.black,
    shadowOffset: { height: 2, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: spacing.sm,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    height: spacing.xl,
    justifyContent: 'center',
    width: spacing.xl,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  metaText: {
    color: colors.gray[500],
    flex: 1,
    fontSize: typography.sizes.xs,
  },
  pill: {
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pillAttending: {
    backgroundColor: colors.primary,
  },
  pillFull: {
    backgroundColor: colors.gray[400],
  },
  pillJoin: {
    backgroundColor: colors.secondary,
  },
  pillText: {
    color: colors.white,
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  title: {
    color: colors.gray[900],
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.xs,
  },
})
