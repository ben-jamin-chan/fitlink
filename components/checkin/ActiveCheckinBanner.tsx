import React, { useEffect, useState } from 'react'

import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import type { TextStyle, ViewStyle } from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

import type { GymCheckin } from '@/types/checkin'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

interface ActiveCheckinBannerProps {
  checkin: GymCheckin
  onCheckOut: () => void
}

interface RemainingTime {
  hours: number
  minutes: number
}

interface ActiveCheckinBannerStyles {
  banner: ViewStyle
  checkOutButton: ViewStyle
  checkOutText: TextStyle
  countdown: TextStyle
  gymName: TextStyle
  icon: TextStyle
  textContainer: ViewStyle
}

const COUNTDOWN_INTERVAL_MS = 60_000
const MILLISECONDS_PER_MINUTE = 60_000
const MINUTES_PER_HOUR = 60
const LOCATION_ICON_SIZE = 18

const getRemainingTime = (expiresAtMs: number): RemainingTime => {
  const diffMs = expiresAtMs - Date.now()

  if (diffMs <= 0) {
    return { hours: 0, minutes: 0 }
  }

  const totalMinutes = Math.floor(diffMs / MILLISECONDS_PER_MINUTE)

  return {
    hours: Math.floor(totalMinutes / MINUTES_PER_HOUR),
    minutes: totalMinutes % MINUTES_PER_HOUR,
  }
}

export const ActiveCheckinBanner = ({
  checkin,
  onCheckOut,
}: ActiveCheckinBannerProps): React.JSX.Element => {
  const { t } = useTranslation()
  const expiresAtMs = checkin.expiresAt.toMillis()
  const [remainingTime, setRemainingTime] = useState<RemainingTime>(() =>
    getRemainingTime(expiresAtMs)
  )
  const remainingLabel =
    remainingTime.hours > 0
      ? t('checkin.banner.remainingHoursMinutes', {
          hours: remainingTime.hours,
          minutes: remainingTime.minutes,
        })
      : t('checkin.banner.remainingMinutes', {
          minutes: remainingTime.minutes,
        })

  useEffect(() => {
    setRemainingTime(getRemainingTime(expiresAtMs))

    const interval = setInterval((): void => {
      setRemainingTime(getRemainingTime(expiresAtMs))
    }, COUNTDOWN_INTERVAL_MS)

    return (): void => {
      clearInterval(interval)
    }
  }, [expiresAtMs])

  return (
    <View style={styles.banner}>
      <Ionicons
        name="location"
        size={LOCATION_ICON_SIZE}
        color={colors.primary}
        style={styles.icon}
      />
      <View style={styles.textContainer}>
        <Text style={styles.gymName} numberOfLines={1}>
          {checkin.gymName}
        </Text>
        <Text style={styles.countdown}>
          {t('checkin.banner.remaining', { remaining: remainingLabel })}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.checkOutButton}
        onPress={onCheckOut}
        activeOpacity={0.8}
        accessibilityLabel={t('checkin.checkOut')}
      >
        <Text style={styles.checkOutText}>{t('checkin.checkOut')}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create<ActiveCheckinBannerStyles>({
  banner: {
    alignItems: 'center',
    backgroundColor: colors.gray[100],
    borderRadius: borderRadius.md,
    flexDirection: 'row',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  checkOutButton: {
    backgroundColor: colors.danger,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  checkOutText: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  countdown: {
    color: colors.gray[600],
    fontSize: typography.sizes.xs,
    marginTop: spacing.xs / 2,
  },
  gymName: {
    color: colors.gray[800],
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  icon: {
    marginRight: spacing.sm,
  },
  textContainer: {
    flex: 1,
  },
})
