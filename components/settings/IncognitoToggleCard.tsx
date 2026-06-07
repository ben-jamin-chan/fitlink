import React, { useState } from 'react'

import {
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'
import type { TextStyle, ViewStyle } from 'react-native'

import { Ionicons } from '@expo/vector-icons'
import type { StackNavigationProp } from '@react-navigation/stack'
import { useTranslation } from 'react-i18next'

import { useProfileStore } from '@/store/profileStore'
import { useSubscriptionStore } from '@/store/subscriptionStore'
import { showToast } from '@/store/toastStore'

import { PremiumBadge } from '@/components/ui/PremiumBadge'

import type { RootStackParamList } from '@/app/navigation/RootNavigator'

import { colors, spacing, typography } from '@/constants/theme'

const SWITCH_TRACK_COLOR = {
  false: colors.gray[300],
  true: colors.primary,
}

interface IncognitoToggleCardStyles {
  badgeRow: ViewStyle
  card: ViewStyle
  description: TextStyle
  headerRow: ViewStyle
  icon: TextStyle
  iconTitleRow: ViewStyle
  title: TextStyle
}

interface IncognitoToggleCardProps {
  navigation: StackNavigationProp<RootStackParamList>
}

export const IncognitoToggleCard = ({
  navigation,
}: IncognitoToggleCardProps): React.JSX.Element => {
  const { t } = useTranslation()
  const profile = useProfileStore((state) => state.profile)
  const updateProfile = useProfileStore((state) => state.updateProfile)
  const isPremium = useSubscriptionStore((state) => state.isPremium)
  const selectedTier = useSubscriptionStore((state) => state.selectedTier)
  const [isUpdating, setIsUpdating] = useState<boolean>(false)

  const isProUser = isPremium() && selectedTier === 'pro'
  const isIncognito = profile?.incognito ?? false

  const handleToggle = async (nextValue: boolean): Promise<void> => {
    if (!isProUser) {
      navigation.navigate('Premium')
      return
    }

    setIsUpdating(true)

    try {
      await updateProfile({ incognito: nextValue })

      if (useProfileStore.getState().error !== null) {
        showToast(t('settings.incognito.errorToast'), 'error')
        return
      }

      showToast(
        nextValue
          ? t('settings.incognito.enabledToast')
          : t('settings.incognito.disabledToast'),
        'success'
      )
    } catch {
      showToast(t('settings.incognito.errorToast'), 'error')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.iconTitleRow}>
          <Ionicons
            name="eye-off-outline"
            size={spacing.lg}
            color={colors.gray[800]}
            style={styles.icon}
          />
          <Text style={styles.title} numberOfLines={2}>
            {t('settings.incognito.title')}
          </Text>
        </View>
        <View style={styles.badgeRow}>
          <PremiumBadge tier="pro" size="sm" />
          <Switch
            value={isProUser ? isIncognito : false}
            onValueChange={handleToggle}
            disabled={isUpdating}
            trackColor={SWITCH_TRACK_COLOR}
            thumbColor={colors.white}
            ios_backgroundColor={colors.gray[300]}
          />
        </View>
      </View>
      <Text style={styles.description}>
        {t('settings.incognito.description')}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create<IncognitoToggleCardStyles>({
  badgeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginLeft: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderBottomColor: colors.gray[200],
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  description: {
    color: colors.gray[600],
    fontSize: typography.sizes.sm,
    lineHeight: typography.sizes.sm * typography.lineHeights.normal,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  icon: {
    marginRight: spacing.sm,
  },
  iconTitleRow: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
  },
  title: {
    color: colors.gray[900],
    flex: 1,
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
  },
})
