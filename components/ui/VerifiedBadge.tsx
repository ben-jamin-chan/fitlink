import React from 'react'

import {
  Alert,
  StyleSheet,
  TouchableOpacity,
} from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'

import { colors, spacing } from '@/constants/theme'

const SMALL_ICON_SIZE = spacing.md
const MEDIUM_ICON_SIZE = spacing.md + spacing.xs

interface VerifiedBadgeProps {
  visible: boolean
  size?: 'sm' | 'md'
}

export const VerifiedBadge = ({
  visible,
  size = 'md',
}: VerifiedBadgeProps): React.JSX.Element | null => {
  const { t } = useTranslation()

  if (!visible) {
    return null
  }

  const iconSize = size === 'sm' ? SMALL_ICON_SIZE : MEDIUM_ICON_SIZE

  const handleLongPress = (): void => {
    Alert.alert('', t('profile.verifiedBadge.tooltip'))
  }

  return (
    <TouchableOpacity
      onLongPress={handleLongPress}
      activeOpacity={0.7}
      style={styles.container}
      accessible
      accessibilityLabel={t('profile.verifiedBadge.tooltip')}
      accessibilityRole="image"
    >
      <Ionicons
        name="checkmark-circle"
        size={iconSize}
        color={colors.secondary}
      />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
  },
})
