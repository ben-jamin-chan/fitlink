import React from 'react'

import { StyleSheet, Text, View } from 'react-native'

import { useTranslation } from 'react-i18next'

import type { PremiumTier } from '@/types/subscription'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

const BADGE_PADDING_VERTICAL = spacing.xs / 2

interface PremiumBadgeProps {
  tier: PremiumTier
  size?: 'sm' | 'md'
}

export const PremiumBadge = ({
  tier,
  size = 'md',
}: PremiumBadgeProps): React.JSX.Element => {
  const { t } = useTranslation()
  const isSmall = size === 'sm'
  const labelKey =
    tier === 'pro' ? 'subscription.badge.pro' : 'subscription.badge.plus'

  return (
    <View
      style={[
        styles.badge,
        tier === 'pro' ? styles.proBadge : styles.plusBadge,
        isSmall && styles.badgeSmall,
      ]}
    >
      <Text style={[styles.label, isSmall && styles.labelSmall]}>
        {t(labelKey)}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: BADGE_PADDING_VERTICAL,
  },
  badgeSmall: {
    paddingHorizontal: spacing.xs,
    paddingVertical: BADGE_PADDING_VERTICAL,
  },
  label: {
    color: colors.white,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  labelSmall: {
    fontSize: typography.sizes.xs,
  },
  plusBadge: {
    backgroundColor: colors.secondary,
  },
  proBadge: {
    backgroundColor: colors.warning,
  },
})
