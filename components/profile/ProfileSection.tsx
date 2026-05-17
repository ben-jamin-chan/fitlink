import React from 'react'

import { StyleSheet, Text, View } from 'react-native'

import { colors, spacing, typography } from '@/constants/theme'

interface ProfileSectionProps {
  title: string
  children: React.ReactNode
}

export const ProfileSection = ({
  title,
  children,
}: ProfileSectionProps): React.JSX.Element => (
  <View style={styles.container}>
    <Text style={styles.title}>{title}</Text>
    {children}
  </View>
)

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xl,
  },
  title: {
    color: colors.gray[500],
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
})
