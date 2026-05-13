import React from 'react'

import { StyleSheet, Text, View } from 'react-native'

import RNSlider from '@react-native-community/slider'

import { colors, spacing, typography } from '@/constants/theme'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
  formatLabel: (value: number) => string
  disabled?: boolean
}

export const Slider = ({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  formatLabel,
  disabled = false,
}: SliderProps): React.JSX.Element => {
  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.formattedValue}>{formatLabel(value)}</Text>
      </View>
      <RNSlider
        style={styles.slider}
        value={value}
        minimumValue={min}
        maximumValue={max}
        step={step}
        onValueChange={onChange}
        minimumTrackTintColor={colors.primary}
        maximumTrackTintColor={colors.gray[200]}
        thumbTintColor={colors.primary}
        disabled={disabled}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: typography.sizes.sm,
    color: colors.gray[600],
    fontWeight: typography.weights.medium,
  },
  formattedValue: {
    fontSize: typography.sizes.md,
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  slider: {
    width: '100%',
    height: 40,
  },
})
