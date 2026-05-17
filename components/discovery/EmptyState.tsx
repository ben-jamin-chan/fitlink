import React from 'react'

import { StyleSheet, Text, View } from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'

import { colors, spacing, typography } from '@/constants/theme'

const EMPTY_ICON_SIZE = 80

interface EmptyStateProps {
  onRefresh: () => void
  onEditPreferences: () => void
}

export const EmptyState = ({
  onRefresh,
  onEditPreferences,
}: EmptyStateProps): React.JSX.Element => {
  const { t } = useTranslation()

  return (
    <View style={styles.container}>
      <Ionicons
        name="search-outline"
        size={EMPTY_ICON_SIZE}
        color={colors.gray[400]}
      />
      <View style={styles.copy}>
        <Text style={styles.title}>{t('discovery.empty.title')}</Text>
        <Text style={styles.subtitle}>{t('discovery.empty.subtitle')}</Text>
      </View>
      <View style={styles.actions}>
        <Button
          label={t('discovery.empty.refresh')}
          onPress={onRefresh}
          variant="primary"
          fullWidth
        />
        <Button
          label={t('discovery.empty.editPreferences')}
          onPress={onEditPreferences}
          variant="outline"
          fullWidth
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
    width: '100%',
  },
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  copy: {
    gap: spacing.sm,
    marginBottom: spacing.xl,
    marginTop: spacing.lg,
  },
  subtitle: {
    color: colors.gray[600],
    fontSize: typography.sizes.md,
    textAlign: 'center',
  },
  title: {
    color: colors.gray[900],
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    textAlign: 'center',
  },
})
