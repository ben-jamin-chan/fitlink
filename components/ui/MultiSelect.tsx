import React from 'react'

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { colors, spacing, typography } from '@/constants/theme'

export interface MultiSelectProps {
  options: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  min?: number
  max?: number
}

export const MultiSelect = ({
  options,
  selected,
  onChange,
  min,
  max,
}: MultiSelectProps): React.JSX.Element => {
  const handlePress = (option: string): void => {
    const isSelected = selected.includes(option)

    if (isSelected) {
      if (min !== undefined && selected.length <= min) {
        return
      }

      onChange(selected.filter((value) => value !== option))
      return
    }

    if (max !== undefined && selected.length >= max) {
      return
    }

    onChange([...selected, option])
  }

  return (
    <View style={styles.container}>
      {options.map((option) => {
        const isSelected = selected.includes(option)

        return (
          <TouchableOpacity
            key={option}
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => handlePress(option)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.chipText,
                isSelected && styles.chipTextSelected,
              ]}
            >
              {option}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: colors.gray[200],
    borderColor: colors.gray[400],
    borderRadius: 20,
    borderWidth: 1,
    margin: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    color: colors.gray[800],
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  chipTextSelected: {
    color: colors.white,
  },
})
