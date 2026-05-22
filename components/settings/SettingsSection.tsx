import React from 'react'

import { StyleSheet, Text, View } from 'react-native'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

interface SettingsSectionProps {
  title: string
  children: React.ReactNode
  danger?: boolean
}

export const SettingsSection = ({
  title,
  children,
  danger = false,
}: SettingsSectionProps): React.JSX.Element => (
  <View style={styles.container}>
    <Text style={[styles.title, danger && styles.titleDanger]}>{title}</Text>
    <View style={styles.card}>{children}</View>
  </View>
)

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  title: {
    color: colors.gray[500],
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
    textTransform: 'uppercase',
  },
  titleDanger: {
    color: colors.danger,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
})
