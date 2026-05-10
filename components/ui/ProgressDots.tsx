import React from 'react'

import { StyleSheet, View } from 'react-native'

import { borderRadius, colors, spacing } from '@/constants/theme'

interface ProgressDotsProps {
  totalSteps: number
  currentStep: number
}

export const ProgressDots = ({
  totalSteps,
  currentStep,
}: ProgressDotsProps): React.JSX.Element => (
  <View style={styles.container}>
    {Array.from({ length: totalSteps }, (_, index) => {
      const step = index + 1

      return (
        <View
          key={step}
          style={[
            styles.dot,
            step === currentStep ? styles.dotActive : styles.dotInactive,
            step < currentStep && styles.dotCompleted,
          ]}
        />
      )
    })}
  </View>
)

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  dot: {
    width: spacing.sm,
    height: spacing.sm,
    borderRadius: borderRadius.full,
  },
  dotActive: {
    width: spacing.lg,
    backgroundColor: colors.primary,
  },
  dotInactive: {
    backgroundColor: colors.gray[200],
  },
  dotCompleted: {
    backgroundColor: colors.primary,
    opacity: 0.4,
  },
})
