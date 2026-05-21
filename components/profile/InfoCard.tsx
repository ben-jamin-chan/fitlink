import React from 'react'

import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'

import { Ionicons } from '@expo/vector-icons'

import { borderRadius, colors, spacing, typography } from '@/constants/theme'

interface InfoCardProps {
  title: string
  onEdit?: () => void
  children: React.ReactNode
}

interface InfoRowProps {
  icon: React.ComponentProps<typeof Ionicons>['name']
  label: string
  value: string
}

export const InfoCard = ({
  title,
  onEdit,
  children,
}: InfoCardProps): React.JSX.Element => {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {onEdit !== undefined && (
          <TouchableOpacity
            onPress={onEdit}
            hitSlop={editHitSlop}
            activeOpacity={0.7}
          >
            <Ionicons
              name="pencil-outline"
              size={spacing.lg - spacing.xs}
              color={colors.primary}
            />
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  )
}

export const InfoRow = ({
  icon,
  label,
  value,
}: InfoRowProps): React.JSX.Element => {
  return (
    <View style={rowStyles.row}>
      <Ionicons
        name={icon}
        size={spacing.md}
        color={colors.gray[500]}
        style={rowStyles.icon}
      />
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  )
}

const editHitSlop = {
  bottom: spacing.sm,
  left: spacing.sm,
  right: spacing.sm,
  top: spacing.sm,
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.gray[800],
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
  },
})

const rowStyles = StyleSheet.create({
  icon: {
    marginRight: spacing.sm,
    width: spacing.lg - spacing.xs,
  },
  label: {
    color: colors.gray[500],
    flex: 1,
    fontSize: typography.sizes.sm,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    paddingVertical: spacing.xs,
  },
  value: {
    color: colors.gray[800],
    flexShrink: 1,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    textAlign: 'right',
  },
})
