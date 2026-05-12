import React from 'react'

import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { colors, spacing, typography } from '@/constants/theme'

export interface SingleSelectProps {
  options: string[]
  selected: string | null
  onChange: (selected: string) => void
}

export const SingleSelect = ({
  options,
  selected,
  onChange,
}: SingleSelectProps): React.JSX.Element => {
  const handlePress = (option: string): void => {
    if (selected === option) {
      return
    }

    onChange(option)
  }

  return (
    <View style={styles.container}>
      {options.map((option) => {
        const isSelected = selected === option

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
