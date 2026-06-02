import React from 'react'

import {
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import type { TextStyle, ViewStyle } from 'react-native'

import { useTranslation } from 'react-i18next'

import type { FitnessSource, TodayStats } from '@/types/fitness'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

const MINUTE_IN_MS = 60_000
const MINUTES_IN_HOUR = 60

interface TodayActivityCardProps {
  stats: TodayStats
  source: FitnessSource
  isOwn: boolean
}

export const TodayActivityCard = ({
  stats,
  source,
  isOwn,
}: TodayActivityCardProps): React.JSX.Element => {
  const { t } = useTranslation()

  const sourceLabel: string = (() => {
    if (source === 'appleHealth') {
      return t('fitness.source.appleHealth')
    }

    if (source === 'googleFit') {
      return t('fitness.source.googleFit')
    }

    return t('fitness.source.strava')
  })()

  const lastUpdatedLabel: string = (() => {
    if (stats.updatedAt === null) {
      return t('fitness.activity.justSynced')
    }

    const diffMs = Date.now() - stats.updatedAt.toMillis()
    const diffMin = Math.floor(diffMs / MINUTE_IN_MS)

    if (diffMin < 1) {
      return t('fitness.activity.justSynced')
    }

    if (diffMin < MINUTES_IN_HOUR) {
      return t('fitness.activity.updatedMinutesAgo', { count: diffMin })
    }

    return t('fitness.activity.updatedHoursAgo', {
      count: Math.floor(diffMin / MINUTES_IN_HOUR),
    })
  })()

  const latestWorkout = stats.workouts.length > 0 ? stats.workouts[0] : null

  const handlePress = (): void => {
    if (!isOwn) {
      return
    }

    Alert.alert(
      t('fitness.activity.detailTitle'),
      t('fitness.activity.detailComingSoon'),
    )
  }

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={isOwn ? 0.85 : 1}
      disabled={!isOwn}
      accessibilityRole={isOwn ? 'button' : undefined}
    >
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>
          {t('fitness.activity.sectionTitle')}
        </Text>
        <Text style={styles.sourceLabel}>{sourceLabel}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <Text style={styles.statEmoji}>👟</Text>
          <Text style={styles.statValue}>{stats.steps.toLocaleString()}</Text>
          <Text style={styles.statUnit}>{t('fitness.activity.steps')}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.statCell}>
          <Text style={styles.statEmoji}>🔥</Text>
          <Text style={styles.statValue}>
            {Math.round(stats.calories).toLocaleString()}
          </Text>
          <Text style={styles.statUnit}>{t('fitness.activity.calories')}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.statCell}>
          <Text style={styles.statEmoji}>📏</Text>
          <Text style={styles.statValue}>{stats.distance.toFixed(1)}</Text>
          <Text style={styles.statUnit}>{t('fitness.activity.distanceKm')}</Text>
        </View>
      </View>

      {latestWorkout !== null && (
        <View style={styles.workoutRow}>
          <Text style={styles.workoutText}>
            {t('fitness.activity.workoutSummary', {
              duration: t('fitness.activity.workoutDuration', {
                count: Math.round(latestWorkout.duration),
              }),
              type: latestWorkout.type,
            })}
          </Text>
        </View>
      )}

      <Text style={styles.lastUpdated}>{lastUpdatedLabel}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginVertical: spacing.sm,
    padding: spacing.md,
  } as ViewStyle,
  divider: {
    backgroundColor: colors.gray[200],
    height: spacing.xl + spacing.sm,
    width: StyleSheet.hairlineWidth,
  } as ViewStyle,
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  } as ViewStyle,
  lastUpdated: {
    color: colors.gray[400],
    fontSize: typography.sizes.xs,
    marginTop: spacing.xs,
  } as TextStyle,
  sectionTitle: {
    color: colors.gray[800],
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  } as TextStyle,
  sourceLabel: {
    color: colors.gray[600],
    fontSize: typography.sizes.xs,
  } as TextStyle,
  statCell: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  } as ViewStyle,
  statEmoji: {
    fontSize: typography.sizes.lg,
  } as TextStyle,
  statsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
  } as ViewStyle,
  statUnit: {
    color: colors.gray[600],
    fontSize: typography.sizes.xs,
  } as TextStyle,
  statValue: {
    color: colors.gray[800],
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  } as TextStyle,
  workoutRow: {
    borderTopColor: colors.gray[200],
    borderTopWidth: 1,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  } as ViewStyle,
  workoutText: {
    color: colors.gray[600],
    fontSize: typography.sizes.sm,
  } as TextStyle,
})
