import React from 'react'

import {
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import { Ionicons } from '@expo/vector-icons'

import { colors, spacing, typography } from '@/constants/theme'

export type SettingsRowVariant = 'navigate' | 'toggle' | 'destructive' | 'info'

interface SettingsRowProps {
  label: string
  variant?: SettingsRowVariant
  value?: string
  isEnabled?: boolean
  onToggle?: (val: boolean) => void
  onPress?: () => void
  icon?: keyof typeof Ionicons.glyphMap
  iconColor?: string
  disabled?: boolean
  isLast?: boolean
}

const SWITCH_TRACK_COLOR = {
  false: colors.gray[300],
  true: colors.primary,
}

export const SettingsRow = ({
  label,
  variant = 'navigate',
  value,
  isEnabled = false,
  onToggle,
  onPress,
  icon,
  iconColor = colors.gray[600],
  disabled = false,
  isLast = false,
}: SettingsRowProps): React.JSX.Element => {
  const isPressable =
    (variant === 'navigate' || variant === 'destructive') &&
    onPress !== undefined &&
    !disabled
  const labelStyle =
    variant === 'destructive' ? styles.labelDestructive : styles.label

  const renderRightElement = (): React.JSX.Element | null => {
    if (variant === 'toggle') {
      return (
        <Switch
          value={isEnabled}
          onValueChange={onToggle}
          disabled={disabled}
          trackColor={SWITCH_TRACK_COLOR}
          thumbColor={colors.white}
          ios_backgroundColor={colors.gray[300]}
        />
      )
    }

    if (variant === 'info') {
      return value !== undefined && value !== '' ? (
        <Text style={styles.value} numberOfLines={1}>
          {value}
        </Text>
      ) : null
    }

    if (variant === 'navigate') {
      return (
        <View style={styles.navigateRight}>
          {value !== undefined && value !== '' && (
            <Text style={styles.value} numberOfLines={1}>
              {value}
            </Text>
          )}
          <Ionicons
            name="chevron-forward"
            size={spacing.lg}
            color={colors.gray[400]}
          />
        </View>
      )
    }

    return null
  }

  return (
    <TouchableOpacity
      style={[
        styles.row,
        !isLast && styles.rowBorder,
        disabled && styles.rowDisabled,
      ]}
      onPress={onPress}
      disabled={!isPressable}
      activeOpacity={0.75}
    >
      <View style={styles.left}>
        {icon !== undefined && (
          <Ionicons name={icon} size={spacing.lg} color={iconColor} />
        )}
        <Text style={labelStyle} numberOfLines={1}>
          {label}
        </Text>
      </View>
      {renderRightElement()}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  rowBorder: {
    borderBottomColor: colors.gray[200],
    borderBottomWidth: 1,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  label: {
    color: colors.gray[900],
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    flex: 1,
  },
  labelDestructive: {
    color: colors.danger,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    flex: 1,
  },
  navigateRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    maxWidth: '45%',
  },
  value: {
    color: colors.gray[600],
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.regular,
    flexShrink: 1,
  },
})
